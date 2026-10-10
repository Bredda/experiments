# Project scripts

Bash scripts built on `gh` that keep issue, epic and project statuses in sync. They are the single implementation behind both the GitHub Actions (source of truth) and the local hooks (guard rails).

Statuses: `Backlog` (idea), `Ready` (planned, sub-issues sized for one pull request), `In progress` (a branch is open), `Done` (closed). An epic is an issue labelled `epic`; its status is derived from its sub-issues, except `Backlog` → `Ready`, which is a human decision.

| Script | Does |
| --- | --- |
| `set-status.sh <issue> <status>` | Sets the Status of an issue, adding it to the project if needed |
| `plan.sh <epic>` | Epic and open sub-issues → Ready (once the sub-issues exist) |
| `start.sh <issue>` | Issue → In progress, and its epic (reopened if closed) |
| `sync-epic.sh <epic>` | Epic In progress once a sub-issue starts or closes; closed and Done when all are closed. `continuous` epics are only kept In progress |
| `sync-parent.sh <issue>` | Closed issue → Done, then `sync-epic.sh` on its epic |
| `reconcile.sh` | Repairs drift over all epics; idempotent |
| `improve.sh <type> <title> [body]` | Small work outside any epic: creates an issue under the open `continuous` epic, puts it In progress, creates the branch `<type>/<n>-<slug>` from `origin/main` |
| `check-pr.sh` | Used by the `PR issue` workflow: branch and `Closes #n` of a pull request |
| `guard-push.sh` | Used by the pre-push hook: blocks a branch without a planned issue |

Needs `gh` authenticated with the `project` scope (`gh auth login`; in Actions `GH_TOKEN` is the `GH_PROJECT_PAT` secret, since `GITHUB_TOKEN` cannot write to a user-owned project). `PROJECT_OWNER` and `PROJECT_NUMBER` default to this repository's owner and project 9. `DRY_RUN=1` prints the changes instead of making them.
