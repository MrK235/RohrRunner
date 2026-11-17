#!/usr/bin/env bash
set -euo pipefail

cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
: "${ROHRRUNNER_PORT:=4173}"
export ROHRRUNNER_PORT

if ! command -v node >/dev/null 2>&1; then
  printf 'RohrRunner benötigt Node.js im PATH.\n' >&2
  exit 1
fi

log_file="${TMPDIR:-/tmp}/rohrrunner-server-${ROHRRUNNER_PORT}.log"
nohup node scripts/serve.mjs >"$log_file" 2>&1 </dev/null &
sleep 1

url="http://127.0.0.1:${ROHRRUNNER_PORT}/"
if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$url" >/dev/null 2>&1 &
elif command -v gio >/dev/null 2>&1; then
  gio open "$url" >/dev/null 2>&1 &
else
  printf 'Browser konnte nicht automatisch geöffnet werden. Öffne bitte:\n%s\n' "$url"
fi
