#!/usr/bin/env bash
# Usage: start.sh <issue>
# Puts an issue In progress, and its epic with it (reopened if it was closed).
source "$(dirname "$0")/lib.sh"
[ $# -eq 1 ] || { log "usage: $0 <issue>"; exit 2; }
init_project
n="$1"
if [ "$(issue_state "$n")" != OPEN ]; then
	log "#$n is closed, reopen it before starting work on it"
	exit 1
fi
set_status "$n" "In progress"
parent="$(issue_parent "$n")"
if [ -n "$parent" ]; then
	if [ "$(issue_state "$parent")" = CLOSED ]; then
		log "reopening epic #$parent"
		reopen_issue "$parent"
	fi
	set_status "$parent" "In progress"
fi
