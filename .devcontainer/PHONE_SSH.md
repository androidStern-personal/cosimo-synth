# iPhone SSH access to the Cosimo Synth Codespace

This Codespaces configuration installs Tailscale, enables Tailscale SSH on every start, installs Codex CLI, and adds a `codex-phone` command that runs Codex inside `tmux` so the session survives ordinary iPhone disconnects.

## One-time setup

1. Create or sign in to a Tailscale account. Using the same GitHub identity is simplest.
2. In the Tailscale admin console, generate an auth key for this Codespace:
   - Reusable: off
   - Ephemeral: off
   - Pre-approved: on, if device approval is enabled
   - Tags: none
3. In this GitHub repository, open **Settings → Secrets and variables → Codespaces → New repository secret**.
4. Name the secret exactly `TS_AUTH_KEY`, paste the Tailscale auth key, and save it.
5. Rebuild the existing Codespace after this configuration is merged, or create a new Codespace from the configured branch.

The key is consumed only to join the Codespace to the tailnet. The Tailscale feature stores device state in a persistent container volume for the lifetime of that Codespace. If the Codespace is deleted and recreated, generate a new key.

## Connect from iPhone

1. Install the Tailscale iOS app, sign in to the same tailnet, and turn its VPN connection on.
2. In the Tailscale device list, find the device whose name matches the GitHub Codespace name and copy its `100.x.x.x` address.
3. Create a Termius host with:
   - Address: the `100.x.x.x` Tailscale address
   - Port: `22`
   - Username: `codespace`
   - Password/key: none
4. Accept the SSH host key on the first connection.

Tailscale SSH authenticates the iPhone through the tailnet, so it does not normally need an SSH password or private key. If Termius refuses to attempt an SSH connection without an authentication method, use username `codespace+password` and enter any non-empty password; Tailscale documents that compatibility mode for SSH clients that do not support the SSH `none` authentication method.

## Start Codex

Authenticate once:

```bash
codex login --device-auth
```

Then start or reattach to the persistent Codex session:

```bash
codex-phone
```

The `codex-phone` session stays alive in `tmux` if iOS backgrounds Termius or the connection drops. Running `codex-phone` again reattaches to it.

## Codespace lifecycle

Tailscale cannot wake a stopped Codespace. If the host is unreachable, start the Codespace from GitHub's Codespaces page, wait for startup to finish, then reconnect from Termius.
