#!/usr/bin/env bash
# Usage: guard-push.sh   (pre-push hook: reads "<local ref> <local sha> <remote ref> <remote sha>" lines on stdin)
# Blocks the push of a branch that does not belong to a planned issue: the
# branch is <type>/<issue>-<slug>, and the issue exists, is open, is not an epic
# and is Ready or In progress. `main`, release-please branches, tags and
# deletions are not checked. Needs network access to GitHub; when it cannot
# reach it the push is blocked too. SKIP_ISSUE_GUARD=1 bypasses it.
trap 'echo "push blocked: could not check issue #${n:-?} on GitHub (missing issue, no network, or gh not authenticated). Fix it, or SKIP_ISSUE_GUARD=1 to bypass." >&2' ERR

source "$(dirname "$0")/lib.sh"

[ -z "${SKIP_ISSUE_GUARD:-}" ] || {
	log "SKIP_ISSUE_GUARD set, issue guard skipped"
	exit 0
}

block() {
	log "push blocked: $*"
	exit 1
}

zero="0000000000000000000000000000000000000000"
initialized=
while read -r _ local_sha remote_ref _; do
	[[ "$remote_ref" == refs/heads/* ]] || continue
	[ "$local_sha" != "$zero" ] || continue
	branch="${remote_ref#refs/heads/}"
	case "$branch" in
	main | release-please--*) continue ;;
	esac
	[[ "$branch" =~ ^[a-z]+/([0-9]+)- ]] ||
		block "branch '$branch' must be named <type>/<issue>-<slug>, for instance feat/123-compare-runs"
	n="${BASH_REMATCH[1]}"
	[ -n "$initialized" ] || {
		init_project
		initialized=1
	}
	state="$(issue_state "$n")"
	[ -n "$state" ] || block "issue #$n does not exist"
	[ "$state" = OPEN ] || block "issue #$n is closed"
	if issue_has_label "$n" epic; then
		block "issue #$n is an epic: use one of its sub-issues"
	fi
	status="$(issue_status "$n")"
	case "$status" in
	Ready | "In progress") ;;
	*) block "issue #$n is ${status:-not in the project}: plan it first (Ready) before pushing work for it" ;;
	esac
	log "issue #$n is $status, push allowed for $branch"
done
