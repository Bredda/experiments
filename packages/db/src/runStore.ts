import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { AnyEvent } from "@experiments/types/events";
import type { RunId } from "@experiments/types/ids";
import {
	type EventRecord,
	eventRecordSchema,
	type RunRecord,
	type RunStatus,
	runRecordSchema,
} from "@experiments/types/run";
import type { ScenarioConfig } from "@experiments/types/scenario";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS runs (
  run_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  seed TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scenarios (
  run_id TEXT PRIMARY KEY REFERENCES runs(run_id) ON DELETE CASCADE,
  scenario_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL REFERENCES runs(run_id) ON DELETE CASCADE,
  step INTEGER NOT NULL,
  type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  timestamp TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_run_id ON events(run_id);
`;

const RUN_SELECT = `
SELECT r.run_id, r.name, r.seed, r.status, r.created_at, s.scenario_json
FROM runs r
JOIN scenarios s ON s.run_id = r.run_id
`;

interface RunRow {
	run_id: string;
	name: string;
	seed: string;
	status: string;
	created_at: string;
	scenario_json: string;
}

interface EventRow {
	id: number;
	run_id: string;
	step: number;
	type: string;
	payload_json: string;
	timestamp: string;
}

function rowToRun(row: RunRow): RunRecord {
	return runRecordSchema.parse({
		runId: row.run_id,
		name: row.name,
		seed: row.seed,
		status: row.status,
		scenario: JSON.parse(row.scenario_json),
		createdAt: row.created_at,
	});
}

function rowToEvent(row: EventRow): EventRecord {
	return eventRecordSchema.parse({
		id: row.id,
		runId: row.run_id,
		step: row.step,
		type: row.type,
		payload: JSON.parse(row.payload_json),
		timestamp: row.timestamp,
	});
}

/**
 * SQLite-backed persistence for runs and their event logs. Events are
 * append-only: there is no update/delete on individual events, only on the
 * run they belong to.
 */
export class RunStore implements Disposable {
	readonly #db: DatabaseSync;

	constructor(dbPath: string) {
		mkdirSync(dirname(resolve(dbPath)), { recursive: true });
		this.#db = new DatabaseSync(dbPath);
		this.#db.exec("PRAGMA foreign_keys = ON");
		this.#db.exec(SCHEMA);
	}

	close(): void {
		this.#db.close();
	}

	[Symbol.dispose](): void {
		this.close();
	}

	// --- runs ---

	createRun(params: {
		runId: RunId;
		name: string;
		seed: string;
		scenario: ScenarioConfig;
		status?: RunStatus;
		createdAt?: Date;
	}): RunRecord {
		const status = params.status ?? "created";
		const createdAt = params.createdAt ?? new Date();

		this.#db.exec("BEGIN");
		try {
			this.#db
				.prepare(
					`INSERT INTO runs (run_id, name, seed, status, created_at)
         VALUES (?, ?, ?, ?, ?)`,
				)
				.run(
					params.runId,
					params.name,
					params.seed,
					status,
					createdAt.toISOString(),
				);

			this.#db
				.prepare("INSERT INTO scenarios (run_id, scenario_json) VALUES (?, ?)")
				.run(params.runId, JSON.stringify(params.scenario));

			this.#db.exec("COMMIT");
		} catch (error) {
			this.#db.exec("ROLLBACK");
			throw error;
		}

		return {
			runId: params.runId,
			name: params.name,
			seed: params.seed,
			status,
			scenario: params.scenario,
			createdAt: createdAt.toISOString(),
		};
	}

	getRun(runId: RunId): RunRecord | undefined {
		const row = this.#db
			.prepare(`${RUN_SELECT} WHERE r.run_id = ?`)
			.get(runId) as RunRow | undefined;

		return row ? rowToRun(row) : undefined;
	}

	listRuns(): RunRecord[] {
		const rows = this.#db
			.prepare(`${RUN_SELECT} ORDER BY r.created_at ASC`)
			.all() as unknown as RunRow[];

		return rows.map(rowToRun);
	}

	updateRunStatus(runId: RunId, status: RunStatus): void {
		this.#db
			.prepare("UPDATE runs SET status = ? WHERE run_id = ?")
			.run(status, runId);
	}

	deleteRun(runId: RunId): void {
		this.#db.prepare("DELETE FROM events WHERE run_id = ?").run(runId);
		this.#db.prepare("DELETE FROM scenarios WHERE run_id = ?").run(runId);
		this.#db.prepare("DELETE FROM runs WHERE run_id = ?").run(runId);
	}

	// --- events ---

	appendEvent(runId: RunId, event: AnyEvent): void {
		this.appendEvents(runId, [event]);
	}

	appendEvents(runId: RunId, events: Iterable<AnyEvent>): void {
		const insert = this.#db.prepare(
			`INSERT INTO events (run_id, step, type, payload_json, timestamp)
       VALUES (?, ?, ?, ?, ?)`,
		);

		for (const event of events) {
			insert.run(
				runId,
				event.step,
				event.type,
				JSON.stringify(event),
				event.timestamp,
			);
		}
	}

	listEvents(runId: RunId, sinceId?: number): EventRecord[] {
		const rows = (sinceId === undefined
			? this.#db
					.prepare("SELECT * FROM events WHERE run_id = ? ORDER BY id ASC")
					.all(runId)
			: this.#db
					.prepare(
						"SELECT * FROM events WHERE run_id = ? AND id > ? ORDER BY id ASC",
					)
					.all(runId, sinceId)) as unknown as EventRow[];

		return rows.map(rowToEvent);
	}
}
