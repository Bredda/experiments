#!/usr/bin/env bash
# Usage: improve.sh <type> <title> [body]
# Starts a small piece of work that belongs to no epic: creates an issue under
# the open `continuous` epic, puts it In progress and creates the branch
# <type>/<issue>-<slug> from origin/main (not pushed). The pull request then
# says `Closes #<issue>`. <type> is a conventional commit type.
source "$(dirname "$0")/lib.sh"
[ $# -ge 2 ] || { log "usage: $0 <type> <title> [body]"; exit 2; }
type="$1"
title="$2"
body="${3:-}"
case "$type" in
feat | fix | perf | refactor | docs | style | test | build | ci | chore | revert) ;;
*) log "unknown type '$type' (feat, fix, perf, refactor, docs, style, test, build, ci, chore, revert)"; exit 2 ;;
esac

epic="$(gh issue list --repo "$REPO" --label epic --label continuous --state open --json number --jq 'sort_by(.number) | last | .number // empty')"
[ -n "$epic" ] || { log "no open epic labelled 'continuous': create one first"; exit 1; }

slug="$(tr '[:upper:]' '[:lower:]' <<<"$title" | tr -cs 'a-z0-9' '-' | cut -c1-40 | sed 's/^-*//; s/-*$//')"
[ -n "$slug" ] || { log "the title gives an empty slug"; exit 2; }

if [ -n "${DRY_RUN:-}" ]; then
	log "[dry-run] would create '$title' under #$epic, start it and create branch $type/<n>-$slug"
	exit 0
fi

url="$(gh issue create --repo "$REPO" --title "$title" --body "${body:+$body

}Part of #$epic.")"
n="${url##*/}"
gh api "repos/$REPO/issues/$epic/sub_issues" --method POST \
	-F sub_issue_id="$(gh api "repos/$REPO/issues/$n" --jq .id)" >/dev/null
init_project
"$(dirname "$0")/start.sh" "$n"

git fetch -q origin main
git switch -c "$type/$n-$slug" origin/main
git branch --unset-upstream 2>/dev/null || true
log "issue $url, branch $type/$n-$slug (not pushed)"
