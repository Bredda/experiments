#!/usr/bin/env bash
# Usage: plan.sh <epic>
# Marks an epic and its open sub-issues Ready once the sub-issues are created.
# Sub-issues already In progress, and an epic that is already In progress or
# Done, are left alone (so sub-issues can be added to a running epic).
source "$(dirname "$0")/lib.sh"
[ $# -eq 1 ] || { log "usage: $0 <epic>"; exit 2; }
init_project
epic="$1"
if ! issue_has_label "$epic" epic; then
	log "#$epic is not labelled epic"
	exit 1
fi
children="$(epic_children "$epic")"
if [ -z "$children" ]; then
	log "#$epic has no sub-issues: create them first"
	exit 1
fi
while read -r number state; do
	[ "$state" = OPEN ] || continue
	[ "$(issue_status "$number")" = "In progress" ] && continue
	set_status "$number" Ready
done <<<"$children"
case "$(issue_status "$epic")" in
"In progress" | Done) ;;
*) set_status "$epic" Ready ;;
esac
