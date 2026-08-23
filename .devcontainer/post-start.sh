#!/usr/bin/env bash

# Do not make a Codespace unusable merely because optional phone access or
# Codex installation failed. Report failures and let the container finish
# starting.
set -uo pipefail

log() {
  printf '[phone-codespace] %s\n' "$*"
}

enable_tailscale_ssh() {
  if ! command -v tailscale >/dev/null 2>&1; then
    log "Tailscale CLI is not installed."
    return 0
  fi

  local ip=""
  local attempt
  for attempt in $(seq 1 20); do
    ip="$(sudo tailscale ip -4 2>/dev/null | head -n 1 || true)"
    if [[ -n "$ip" ]]; then
      break
    fi
    sleep 1
  done

  if [[ -z "$ip" ]]; then
    log "Tailscale is waiting for authentication. Add TS_AUTH_KEY as a GitHub Codespaces secret, then rebuild or restart the Codespace."
    return 0
  fi

  if sudo tailscale set --ssh >/dev/null 2>&1; then
    log "Tailscale SSH enabled at ${ip}:22 with Linux user 'codespace'."
  else
    log "Tailscale is connected at ${ip}, but enabling Tailscale SSH failed."
  fi
}

install_codex_cli() {
  if command -v codex >/dev/null 2>&1; then
    log "Codex CLI is already installed ($(codex --version 2>/dev/null || printf 'version unknown'))."
    return 0
  fi

  if ! command -v npm >/dev/null 2>&1; then
    log "npm is unavailable, so Codex CLI was not installed automatically."
    return 0
  fi

  log "Installing Codex CLI..."
  if npm install -g @openai/codex; then
    log "Codex CLI installed."
  else
    log "Codex CLI installation failed; rerun 'npm install -g @openai/codex' after connecting."
  fi
}

install_phone_helper() {
  local script_dir
  script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

  if sudo install -m 0755 "$script_dir/codex-phone" /usr/local/bin/codex-phone; then
    log "Installed the persistent phone-session helper: codex-phone"
  else
    log "Could not install the codex-phone helper."
  fi
}

enable_tailscale_ssh
install_codex_cli
install_phone_helper
