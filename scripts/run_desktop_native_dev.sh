#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
desktop_dev_server_origin="${COSIMO_DESKTOP_DEV_SERVER_ORIGIN:-http://127.0.0.1:5174}"
status_url="${desktop_dev_server_origin%/}/__cosimo-dev-status"
app_path="$repo_root/build/desktop_native/CosimoDesktopNative_artefacts/Release/Standalone/CosimoDesktopNative.app"
log_dir="$repo_root/build/desktop_native"
log_file="$log_dir/dev-server.log"
pid_file="$log_dir/dev-server.pid"

mkdir -p "$log_dir"

parse_origin_field() {
  local field="$1"
  python3 - "$desktop_dev_server_origin" "$field" <<'PY'
import sys
from urllib.parse import urlparse

origin = sys.argv[1]
field = sys.argv[2]
parsed = urlparse(origin)

if field == "host":
    print(parsed.hostname or "127.0.0.1")
elif field == "port":
    port = parsed.port
    if port is None:
        port = 443 if parsed.scheme == "https" else 80
    print(port)
else:
    raise SystemExit(f"Unsupported field: {field}")
PY
}

desktop_dev_server_host="$(parse_origin_field host)"
desktop_dev_server_port="$(parse_origin_field port)"

read_status_field() {
  local payload="$1"
  local field="$2"
  python3 -c '
import json
import sys

field = sys.argv[1]
payload = json.load(sys.stdin)
value = payload.get(field, "")

if isinstance(value, (dict, list)):
    print(json.dumps(value))
else:
    print(value)
' "$field" <<<"$payload"
}

kill_listener_pid() {
  local pid="$1"

  if [[ -z "$pid" ]]; then
    return
  fi

  if ! kill -0 "$pid" 2>/dev/null; then
    return
  fi

  kill "$pid" 2>/dev/null || true

  for _ in {1..50}; do
    if ! kill -0 "$pid" 2>/dev/null; then
      return
    fi

    sleep 0.1
  done

  kill -9 "$pid" 2>/dev/null || true
}

existing_status=""
if existing_status="$(curl --fail --silent --show-error "$status_url" 2>/dev/null)"; then
  existing_repo_root="$(read_status_field "$existing_status" repoRoot)"

  if [[ "$existing_repo_root" == "$repo_root" ]]; then
    existing_listener_pids="$(lsof -nP -tiTCP:"$desktop_dev_server_port" -sTCP:LISTEN 2>/dev/null || true)"

    if [[ -n "$existing_listener_pids" ]]; then
      while IFS= read -r pid; do
        kill_listener_pid "$pid"
      done <<<"$existing_listener_pids"
    fi
  else
    printf 'Port %s is already serving a different desktop dev server for %s. Refusing to replace it.\n' \
      "$desktop_dev_server_port" "$existing_repo_root" >&2
    exit 1
  fi
else
  occupied_listener_pids="$(lsof -nP -tiTCP:"$desktop_dev_server_port" -sTCP:LISTEN 2>/dev/null || true)"

  if [[ -n "$occupied_listener_pids" ]]; then
    printf 'Port %s is already in use by a process that is not the Cosimo desktop Vite server.\n' \
      "$desktop_dev_server_port" >&2
    exit 1
  fi
fi

desktop_dev_server_pid="$(
  python3 - "$repo_root" "$log_file" "$desktop_dev_server_host" "$desktop_dev_server_port" <<'PY'
import os
import shutil
import subprocess
import sys

repo_root, log_file, host, port = sys.argv[1:5]
npm_command = shutil.which("npm")

if npm_command is None:
    raise SystemExit("npm is required to start the desktop Vite dev server")

with open(log_file, "ab", buffering=0) as log_handle:
    process = subprocess.Popen(
        [
            npm_command,
            "run",
            "ui:desktop:dev",
            "--",
            "--host",
            host,
            "--port",
            port,
            "--strictPort",
        ],
        cwd=repo_root,
        stdin=subprocess.DEVNULL,
        stdout=log_handle,
        stderr=subprocess.STDOUT,
        start_new_session=True,
        env=os.environ.copy(),
    )

print(process.pid)
PY
)"
echo "$desktop_dev_server_pid" > "$pid_file"

ready=0
for _ in {1..120}; do
  if ! kill -0 "$desktop_dev_server_pid" 2>/dev/null; then
    printf 'Desktop Vite dev server exited early. Log:\n' >&2
    cat "$log_file" >&2
    exit 1
  fi

  if curl --fail --silent --show-error "$status_url" >/dev/null 2>&1; then
    ready=1
    break
  fi

  sleep 0.25
done

if [[ "$ready" -ne 1 ]]; then
  printf 'Desktop Vite dev server did not become ready at %s. Log:\n' "$status_url" >&2
  cat "$log_file" >&2
  exit 1
fi

(
  cd "$repo_root"
  COSIMO_DESKTOP_UI_SOURCE_MODE=dev-server \
  COSIMO_DESKTOP_DEV_SERVER_ORIGIN="$desktop_dev_server_origin" \
  ./scripts/build_desktop_native.sh
)

if [[ ! -d "$app_path" ]]; then
  printf 'Standalone app not found after dev build: %s\n' "$app_path" >&2
  exit 1
fi

pkill -x "CosimoDesktopNative" 2>/dev/null || true
open -na "$app_path"

printf 'Started desktop Vite dev server at %s (pid %s)\n' "$desktop_dev_server_origin" "$desktop_dev_server_pid"
printf 'Log: %s\n' "$log_file"
printf 'Launched %s\n' "$app_path"
