#!/usr/bin/env bash
# Usage: PR_BRANCH=<head branch> PR_BODY=<description> check-pr.sh
# A pull request belongs to one issue: its branch is <type>/<issue>-<slug> and
# its description says `Closes #<issue>` (or `Refs #<issue>` when the issue
# needs several pull requests). The issue must exist, be open and not be an
# epic. Release-please pull requests are exempt. Needs `gh` (read access) and
# GITHUB_REPOSITORY.
set -euo pipefail

branch="${PR_BRANCH:?PR_BRANCH is required}"
body="${PR_BODY-}"
repo="${GITHUB_REPOSITORY:-$(gh repo view --json nameWithOwner --jq .nameWithOwner)}"

fail() {
	echo "::error::$*"
	exit 1
}

case "$branch" in
release-please--*)
	echo "Release pull request, exempt"
	exit 0
	;;
esac

if [[ ! "$branch" =~ ^[a-z]+/([0-9]+)- ]]; then
	fail "Branch '$branch' must be named <type>/<issue>-<slug>, for instance feat/123-compare-runs."
fi
issue="${BASH_REMATCH[1]}"

shopt -s nocasematch
pattern="(^|[^[:alnum:]])(close[sd]?|fix(e[sd])?|resolve[sd]?|refs?)[[:space:]]*:?[[:space:]]+#${issue}([^0-9]|$)"
if [[ ! "$body" =~ $pattern ]]; then
	fail "The description must contain 'Closes #${issue}' (or 'Refs #${issue}' if the issue needs several pull requests), the issue named by the branch."
fi

if ! info="$(gh issue view "$issue" --repo "$repo" --json state,labels --jq '"\(.state) \([.labels[].name] | join(","))"' 2>/dev/null)"; then
	fail "Issue #${issue} does not exist."
fi
state="${info%% *}"
labels=",${info#* },"
[ "$state" = OPEN ] || fail "Issue #${issue} is closed."
[[ "$labels" != *,epic,* ]] || fail "Issue #${issue} is an epic: a pull request belongs to one of its sub-issues."

echo "Pull request linked to issue #${issue}"
