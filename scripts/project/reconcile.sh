#!/usr/bin/env bash
# Usage: reconcile.sh
# Repairs drift: every closed sub-issue of an epic is Done, every epic is
# derived again. Idempotent, safe to run on a schedule.
source "$(dirname "$0")/lib.sh"
init_project
for epic in $(gh issue list --repo "$REPO" --label epic --state all --limit 200 --json number --jq '.[].number'); do
	while read -r number state; do
		[ "$state" = CLOSED ] && set_status "$number" Done
	done <<<"$(epic_children "$epic")"
	"$(dirname "$0")/sync-epic.sh" "$epic"
done
