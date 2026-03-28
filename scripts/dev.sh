#!/usr/bin/env bash
set -euo pipefail

cleanup() {
  if [[ -n "${BACK_PID:-}" ]]; then
    kill "$BACK_PID" >/dev/null 2>&1 || true
  fi
  if [[ -n "${FRONT_PID:-}" ]]; then
    kill "$FRONT_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

echo "[DODOMIII] starting backend on http://localhost:4000"
npm --prefix backend run start:dev &
BACK_PID=$!

echo "[DODOMIII] starting frontend on http://localhost:5173"
npm --prefix frontend run dev -- --host localhost --port 5173 &
FRONT_PID=$!

wait "$BACK_PID" "$FRONT_PID"
