#!/usr/bin/env bash
# Shared helpers for the project scripts: source it, do not run it.
#
# Needs `gh` authenticated with the `project` scope (locally `gh auth login`,
# in Actions GH_TOKEN=${{ secrets.GH_PROJECT_PAT }}). The repository and the
# project are taken from GITHUB_REPOSITORY / PROJECT_OWNER / PROJECT_NUMBER,
# with this repository's values as defaults. DRY_RUN=1 prints each change
# instead of making it.

set -euo pipefail

REPO="${GITHUB_REPOSITORY:-$(gh repo view --json nameWithOwner --jq .nameWithOwner)}"
OWNER="${REPO%%/*}"
NAME="${REPO##*/}"
PROJECT_OWNER="${PROJECT_OWNER:-$OWNER}"
PROJECT_NUMBER="${PROJECT_NUMBER:-9}"

gql() { gh api graphql "$@"; }

log() { echo "$*" >&2; }

# Runs a change, or only prints it when DRY_RUN is set.
mutate() {
	if [ -n "${DRY_RUN:-}" ]; then
		log "[dry-run] $*"
		return 0
	fi
	"$@"
}

# Sets PROJECT_ID, STATUS_FIELD_ID and STATUS_OPTIONS (one "name<TAB>id" per line).
init_project() {
	local out
	out="$(gql \
		-f query='query($o:String!,$n:Int!){repositoryOwner(login:$o){... on ProjectV2Owner{projectV2(number:$n){id field(name:"Status"){... on ProjectV2SingleSelectField{id options{id name}}}}}}}' \
		-f o="$PROJECT_OWNER" -F n="$PROJECT_NUMBER" \
		--jq '.data.repositoryOwner.projectV2 | [.id, .field.id] , (.field.options[] | [.name, .id]) | @tsv')"
	PROJECT_ID="$(head -n1 <<<"$out" | cut -f1)"
	STATUS_FIELD_ID="$(head -n1 <<<"$out" | cut -f2)"
	STATUS_OPTIONS="$(tail -n +2 <<<"$out")"
	if [ -z "$PROJECT_ID" ] || [ -z "$STATUS_FIELD_ID" ]; then
		log "project $PROJECT_OWNER/$PROJECT_NUMBER or its Status field not found"
		return 1
	fi
}

status_option_id() {
	local id
	id="$(awk -F'\t' -v n="$1" '$1 == n { print $2 }' <<<"$STATUS_OPTIONS")"
	if [ -z "$id" ]; then
		log "unknown status '$1' (expected one of: $(cut -f1 <<<"$STATUS_OPTIONS" | paste -sd, -))"
		return 1
	fi
	echo "$id"
}

ISSUE_QUERY='query($o:String!,$r:String!,$n:Int!){repository(owner:$o,name:$r){issue(number:$n){id state labels(first:30){nodes{name}} parent{number} subIssues(first:100){nodes{number state projectItems(first:20){nodes{project{id} fieldValueByName(name:"Status"){... on ProjectV2ItemFieldSingleSelectValue{name}}}}}} projectItems(first:20){nodes{id project{id} fieldValueByName(name:"Status"){... on ProjectV2ItemFieldSingleSelectValue{name}}}}}}}'

# issue <number> <jq filter applied to the issue object>
issue() {
	gql -f query="$ISSUE_QUERY" -f o="$OWNER" -f r="$NAME" -F n="$1" \
		--jq ".data.repository.issue | $2"
}

issue_state() { issue "$1" '.state'; }
issue_parent() { issue "$1" '.parent.number // empty'; }
issue_has_label() { [ "$(issue "$1" "[.labels.nodes[].name] | index(\"$2\") != null")" = true ]; }
issue_status() {
	issue "$1" ".projectItems.nodes[] | select(.project.id == \"$PROJECT_ID\") | .fieldValueByName.name // empty"
}

# Sub-issue counts of an epic: "<total> <closed> <started>", started meaning
# closed or In progress.
epic_counts() {
	issue "$1" "[.subIssues.nodes[]] | \"\(length) \(map(select(.state == \"CLOSED\")) | length) \(map(select(.state == \"CLOSED\" or ([.projectItems.nodes[] | select(.project.id == \"$PROJECT_ID\") | .fieldValueByName.name] | index(\"In progress\") != null))) | length)\""
}

epic_children() { issue "$1" '.subIssues.nodes[] | "\(.number) \(.state)"'; }

# Project item of an issue, added to the project when it is not there yet.
ensure_item() {
	local item
	item="$(issue "$1" ".projectItems.nodes[] | select(.project.id == \"$PROJECT_ID\") | .id")"
	if [ -n "$item" ]; then
		echo "$item"
		return 0
	fi
	if [ -n "${DRY_RUN:-}" ]; then
		log "[dry-run] add #$1 to the project"
		echo "dry-run-item"
		return 0
	fi
	gql -f query='mutation($p:ID!,$c:ID!){addProjectV2ItemById(input:{projectId:$p,contentId:$c}){item{id}}}' \
		-f p="$PROJECT_ID" -f c="$(issue "$1" '.id')" --jq '.data.addProjectV2ItemById.item.id'
}

# set_status <issue> <Backlog|Ready|In progress|Done>; does nothing if already set.
set_status() {
	local current option item
	option="$(status_option_id "$2")"
	current="$(issue_status "$1")"
	if [ "$current" = "$2" ]; then
		log "#$1 already $2"
		return 0
	fi
	item="$(ensure_item "$1")"
	log "#$1 ${current:-no status} -> $2"
	mutate gql \
		-f query='mutation($p:ID!,$i:ID!,$f:ID!,$o:String!){updateProjectV2ItemFieldValue(input:{projectId:$p,itemId:$i,fieldId:$f,value:{singleSelectOptionId:$o}}){projectV2Item{id}}}' \
		-f p="$PROJECT_ID" -f i="$item" -f f="$STATUS_FIELD_ID" -f o="$option" >/dev/null
}

close_issue() { mutate gh issue close "$1" --repo "$REPO" --reason completed >/dev/null; }
reopen_issue() { mutate gh issue reopen "$1" --repo "$REPO" >/dev/null; }
