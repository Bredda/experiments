#!/usr/bin/env bash
# Usage: sync-parent.sh <issue>
# To run when an issue is closed: a closed issue is Done, and its epic is
# derived again (closed with its last sub-issue).
source "$(dirname "$0")/lib.sh"
[ $# -eq 1 ] || { log "usage: $0 <issue>"; exit 2; }
init_project
n="$1"
[ "$(issue_state "$n")" = CLOSED ] && set_status "$n" Done
parent="$(issue_parent "$n")"
[ -z "$parent" ] || "$(dirname "$0")/sync-epic.sh" "$parent"
