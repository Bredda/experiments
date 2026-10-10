#!/usr/bin/env bash
# Usage: sync-epic.sh <epic>
# Derives an epic from its sub-issues: In progress as soon as one is started or
# closed, closed and Done when all are closed. Epics labelled `continuous` are
# only kept In progress. Backlog -> Ready stays a human decision (plan.sh).
source "$(dirname "$0")/lib.sh"
[ $# -eq 1 ] || { log "usage: $0 <epic>"; exit 2; }
init_project
epic="$1"
if ! issue_has_label "$epic" epic; then
	log "#$epic is not an epic, nothing to do"
	exit 0
fi
state="$(issue_state "$epic")"
if issue_has_label "$epic" continuous; then
	[ "$state" = OPEN ] && set_status "$epic" "In progress"
	exit 0
fi
read -r total closed started <<<"$(epic_counts "$epic")"
if [ "$total" -eq 0 ]; then
	log "#$epic has no sub-issues"
elif [ "$closed" -eq "$total" ]; then
	[ "$state" = OPEN ] && close_issue "$epic"
	set_status "$epic" Done
elif [ "$started" -gt 0 ]; then
	[ "$state" = CLOSED ] && reopen_issue "$epic"
	set_status "$epic" "In progress"
else
	log "#$epic: no sub-issue started yet"
fi
