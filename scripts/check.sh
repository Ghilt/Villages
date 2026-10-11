#!/usr/bin/env sh
# Every check in the repository, one part after another: the backend's, the frontend's and this folder's own.
# check.ts does the work and says what it does with --help; this only runs it, from wherever it is called.
exec node "$(dirname "$0")/check.ts" "$@"
