import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { AnyEvent } from "@experiments/types/events";
import type { RunId } from "@experiments/types/ids";
import {
	type EventRecord,
	eventRecordSchema,
	type ForkTree,
	forkTreeSchema,
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

CREATE TABLE IF NOT EXISTS forks (
  run_id TEXT PRIMARY KEY REFERENCES runs(run_id) ON DELETE CASCADE,
  parent_run_id TEXT NOT NULL REFERENCES runs(run_id),
  step INTEGER NOT NULL,
  purpose TEXT
);

CREATE INDEX IF NOT EXISTS idx_forks_parent_run_id ON forks(parent_run_id);
`;

const RUN_SELECT = `
SELECT r.run_id, r.name, r.seed, r.status, r.created_at, s.scenario_json,
  f.parent_run_id, f.step AS fork_step, f.purpose AS fork_purpose
FROM runs r
JOIN scenarios s ON s.run_id = r.run_id
LEFT JOIN forks f ON f.run_id = r.run_id
`;

// Every run of the fork tree that contains :run_id. The root is found by
// walking up, then the tree is walked down from it. `depth` is only there to
// keep the walk finite should the data ever contain a cycle.
const FORK_TREE_SELECT = `
WITH RECURSIVE ancestors(run_id, depth) AS (
  SELECT ?, 0
  UNION ALL
  SELECT f.parent_run_id, a.depth + 1
  FROM forks f JOIN ancestors a ON f.run_id = a.run_id
  WHERE a.depth < 1000
),
root(run_id) AS (
  SELECT run_id FROM ancestors ORDER BY depth DESC LIMIT 1
),
tree(run_id, depth) AS (
  SELECT run_id, 0 FROM root
  UNION ALL
  SELECT f.run_id, t.depth + 1
  FROM forks f JOIN tree t ON f.parent_run_id = t.run_id
  WHERE t.depth < 1000
)
SELECT r.run_id, r.name, r.status, r.created_at, s.scenario_json,
  f.parent_run_id, f.step AS fork_step, f.purpose AS fork_purpose,
  (SELECT COALESCE(MAX(e.step), 0) FROM events e WHERE e.run_id = r.run_id) AS played_steps,
  (SELECT run_id FROM root) AS root_run_id
FROM tree t
JOIN runs r ON r.run_id = t.run_id
JOIN scenarios s ON s.run_id = r.run_id
LEFT JOIN forks f ON f.run_id = r.run_id
ORDER BY r.created_at ASC, r.rowid ASC
`;

interface RunRow {
	run_id: string;
	name: string;
	seed: string;
	status: string;
	created_at: string;
	scenario_json: string;
	parent_run_id: string | null;
	fork_step: number | null;
	fork_purpose: string | null;
}

interface ForkNodeRow extends RunRow {
	played_steps: number;
	root_run_id: string;
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
		fork:
			row.parent_run_id === null
				? null
				: {
						parentRunId: row.parent_run_id,
						step: row.fork_step,
						purpose: row.fork_purpose,
					},
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
			fork: null,
			createdAt: createdAt.toISOString(),
		};
	}

	/**
	 * Creates a run that starts with a copy of `parentRunId`'s events up to
	 * `step` (inclusive), and records where it comes from. Payloads are copied
	 * as they are. All or nothing.
	 */
	createFork(params: {
		runId: RunId;
		parentRunId: RunId;
		step: number;
		purpose: string | null;
		name: string;
		seed: string;
		scenario: ScenarioConfig;
		status: RunStatus;
		createdAt?: Date;
	}): RunRecord {
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
					params.status,
					createdAt.toISOString(),
				);
			this.#db
				.prepare("INSERT INTO scenarios (run_id, scenario_json) VALUES (?, ?)")
				.run(params.runId, JSON.stringify(params.scenario));
			this.#db
				.prepare(
					`INSERT INTO forks (run_id, parent_run_id, step, purpose)
         VALUES (?, ?, ?, ?)`,
				)
				.run(params.runId, params.parentRunId, params.step, params.purpose);
			this.#db
				.prepare(
					`INSERT INTO events (run_id, step, type, payload_json, timestamp)
         SELECT ?, step, type, payload_json, timestamp
         FROM events WHERE run_id = ? AND step <= ? ORDER BY id ASC`,
				)
				.run(params.runId, params.parentRunId, params.step);
			this.#db.exec("COMMIT");
		} catch (error) {
			this.#db.exec("ROLLBACK");
			throw error;
		}

		return {
			runId: params.runId,
			name: params.name,
			seed: params.seed,
			status: params.status,
			scenario: params.scenario,
			fork: {
				parentRunId: params.parentRunId,
				step: params.step,
				purpose: params.purpose,
			},
			createdAt: createdAt.toISOString(),
		};
	}

	/** The fork tree that contains the run, or `undefined` if the run does not exist. */
	getForkTree(runId: RunId): ForkTree | undefined {
		const rows = this.#db
			.prepare(FORK_TREE_SELECT)
			.all(runId) as unknown as ForkNodeRow[];
		const first = rows[0];

		if (first === undefined) return undefined;

		return forkTreeSchema.parse({
			rootRunId: first.root_run_id,
			nodes: rows.map((row) => ({
				runId: row.run_id,
				name: row.name,
				status: row.status,
				parentRunId: row.parent_run_id,
				forkStep: row.fork_step,
				purpose: row.fork_purpose,
				createdAt: row.created_at,
				steps: JSON.parse(row.scenario_json).steps,
				playedSteps: row.played_steps,
			})),
		});
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

	/** Fails, and deletes nothing, while other runs were forked from this one. */
	deleteRun(runId: RunId): void {
		this.#db.exec("BEGIN");
		try {
			this.#db.prepare("DELETE FROM events WHERE run_id = ?").run(runId);
			this.#db.prepare("DELETE FROM scenarios WHERE run_id = ?").run(runId);
			this.#db.prepare("DELETE FROM forks WHERE run_id = ?").run(runId);
			this.#db.prepare("DELETE FROM runs WHERE run_id = ?").run(runId);
			this.#db.exec("COMMIT");
		} catch (error) {
			this.#db.exec("ROLLBACK");
			throw error;
		}
	}

	// --- events ---

	appendEvent(runId: RunId, event: AnyEvent): void {
		this.appendEvents(runId, [event]);
	}

	/** Appends all events or none: the batch runs in a single transaction. */
	appendEvents(runId: RunId, events: Iterable<AnyEvent>): void {
		const insert = this.#db.prepare(
			`INSERT INTO events (run_id, step, type, payload_json, timestamp)
       VALUES (?, ?, ?, ?, ?)`,
		);

		this.#db.exec("BEGIN");
		try {
			for (const event of events) {
				insert.run(
					runId,
					event.step,
					event.type,
					JSON.stringify(event),
					event.timestamp,
				);
			}
			this.#db.exec("COMMIT");
		} catch (error) {
			this.#db.exec("ROLLBACK");
			throw error;
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
