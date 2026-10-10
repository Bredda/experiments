#!/usr/bin/env bash
# Usage: set-status.sh <issue> <Backlog|Ready|In progress|Done>
# Sets the Status of an issue in the project (adds it to the project if needed).
source "$(dirname "$0")/lib.sh"
[ $# -eq 2 ] || { log "usage: $0 <issue> <status>"; exit 2; }
init_project
set_status "$1" "$2"
