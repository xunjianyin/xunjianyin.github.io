#!/bin/sh
# Runs the easter-egg browser suites, each in its own agent-browser session, and prints one
# line per suite: its assertions and failures. Exits non-zero when any suite fails or hangs.
#
# Usage: tests/run_easter_suites.sh [name ...]
#   name         a suite to run (lenses, lenses_pages, lenses_media, tokens, easter_egg, lens_<id>);
#                default: every suite listed below plus every tests/browser_lens_*.js
# Environment:
#   EASTER_BASE     the site's local static server (default http://localhost:8781); start one
#                   with `python3 -m http.server 8781` from the repository root
#   EASTER_SESSION  the session name prefix (default easter): sessions are <prefix>-<name>
#   EASTER_RESULTS  where each suite's full JSON result is saved (default $TMPDIR/easter-suites)
#   EASTER_LIMIT    seconds a suite may run before it counts as hung (default 600)
#
# Every suite is an async IIFE that resolves with { assertions, failures, ... }. It is started
# as a background promise (one eval) and polled, since some suites take minutes and a single
# long eval can hang the session. Every agent-browser command runs under a watchdog (macOS has
# no `timeout`, so perl's alarm stands in).
set -u

HERE=$(cd "$(dirname "$0")" && pwd)
BASE=${EASTER_BASE:-http://localhost:8781}
PREFIX=${EASTER_SESSION:-easter}
RESULTS=${EASTER_RESULTS:-${TMPDIR:-/tmp}/easter-suites}
LIMIT=${EASTER_LIMIT:-600}
POLL_S=5                 # seconds between polls
COMMAND_S=60             # watchdog for one agent-browser command
mkdir -p "$RESULTS"

watchdog() { perl -e 'alarm shift; exec @ARGV' "$@"; }
ab() { session=$1; shift; watchdog "$COMMAND_S" agent-browser --session "$session" "$@"; }

# The suites, in order: the core first, Spira last (it is the longest to settle its audio).
if [ "$#" -gt 0 ]; then
  SUITES=$(for name in "$@"; do printf '%s\n' "$HERE/browser_${name#browser_}"; done | sed 's/\.js$//; s/$/.js/')
else
  SUITES=$(
    for name in lenses lenses_pages lenses_media tokens; do printf '%s\n' "$HERE/browser_$name.js"; done
    for file in "$HERE"/browser_lens_*.js; do [ -f "$file" ] && printf '%s\n' "$file"; done
    printf '%s\n' "$HERE/browser_easter_egg.js"
  )
fi

if ! curl -s -o /dev/null "$BASE/"; then
  echo "No server at $BASE: start one with 'python3 -m http.server 8781' from the repository root." >&2
  exit 2
fi

status=0
for file in $SUITES; do
  name=$(basename "$file" .js); name=${name#browser_}
  session="$PREFIX-$(printf '%s' "$name" | tr '_' '-')"
  out="$RESULTS/$name.json"
  if [ ! -f "$file" ]; then printf '%-14s missing (%s)\n' "$name" "$file"; status=1; continue; fi
  rm -f "$out"
  began=$(date +%s)
  ab "$session" open "$BASE/" >/dev/null 2>&1 || { printf '%-14s could not open %s\n' "$name" "$BASE/"; status=1; continue; }
  # Start the suite in the page and keep its result on window.
  started=$({
    printf 'window.__easterSuite = null;\nwindow.__easterRun = '
    cat "$file"
    printf '\nPromise.resolve(window.__easterRun).then(r => { window.__easterSuite = r; }, e => { window.__easterSuite = { assertions: 0, failures: [String(e && e.stack || e)] }; });\n"started";\n'
  } | ab "$session" eval --stdin 2>&1)
  case "$started" in
    *'"started"'*) ;;
    *) printf '%-14s did not start: %s\n' "$name" "$(printf '%s' "$started" | head -3)"; ab "$session" close >/dev/null 2>&1; status=1; continue ;;
  esac
  # Poll until the result is there or the suite has run too long.
  result=null
  while :; do
    sleep "$POLL_S"
    result=$(ab "$session" eval 'window.__easterSuite' 2>/dev/null) || result=null
    [ -n "$result" ] && [ "$result" != null ] && break
    if [ $(( $(date +%s) - began )) -gt "$LIMIT" ]; then result=null; break; fi
  done
  ab "$session" close >/dev/null 2>&1
  took=$(( $(date +%s) - began ))
  if [ "$result" = null ]; then
    printf '%-14s hung (no result after %ss)\n' "$name" "$took"; status=1; continue
  fi
  printf '%s\n' "$result" > "$out"
  # One line: assertions and failures, then the first failures in full.
  line=$(python3 - "$out" "$name" "$took" <<'PY'
import json, sys
path, name, took = sys.argv[1:4]
data = json.load(open(path))
if isinstance(data, str):
    data = json.loads(data)
failures = data.get("failures", [])
print(f"{name:<14} {data.get('assertions', 0)} assertions, {len(failures)} failures ({took} s)")
for failure in failures[:8]:
    print(f"    - {str(failure)[:300]}")
sys.exit(1 if failures else 0)
PY
  ) || status=1
  printf '%s\n' "$line"
done
echo "Full results: $RESULTS"
exit $status
