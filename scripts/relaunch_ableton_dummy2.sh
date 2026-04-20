#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"

ableton_app="${ABLETON_APP:-/Applications/Ableton Live 11 Suite.app}"
ableton_bundle_id="${ABLETON_BUNDLE_ID:-com.ableton.live}"
ableton_process="${ABLETON_PROCESS_NAME:-Live}"
project_path="$repo_root/dummy Project/dumm-2.als"
quit_timeout_seconds="${ABLETON_QUIT_TIMEOUT_SECONDS:-30}"
dont_save_click="${ABLETON_DONT_SAVE_CLICK:-724,616}"
discard_recovery=0

usage() {
    cat <<USAGE
Usage: $(basename "$0") [--discard-recovery] [project.als]

Gracefully relaunches Ableton Live 11 Suite with the repo dummy project:
  $project_path

The shutdown path sends Ableton a normal macOS quit event with "saving no".
If Ableton still opens its own save dialog, the script sends the standard
"Don't Save" keyboard shortcuts to that dialog. It does not force-quit Live by
default, because force-quit is what marks Live as crashed and triggers the
recovery prompt on next launch.

Options:
  --discard-recovery  After Live has quit, move Live's active crash-recovery
                      files aside before launching. This discards any pending
                      Live crash recovery state and is intended only for the
                      disposable dummy test project workflow.
  -h, --help          Show this help.

Environment:
  ABLETON_APP                  Path to Ableton .app.
  ABLETON_BUNDLE_ID            Bundle id for the running Ableton app.
  ABLETON_PROCESS_NAME         Process name to wait for. Default: Live.
  ABLETON_QUIT_TIMEOUT_SECONDS Seconds to wait for graceful quit. Default: 30.
  ABLETON_DONT_SAVE_CLICK      Screen-point coordinate for Ableton's Don't Save
                               button fallback. Default: 724,616.
USAGE
}

while (($# > 0)); do
    case "$1" in
        --discard-recovery)
            discard_recovery=1
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            project_path="$1"
            shift
            ;;
    esac
done

if [[ ! -d "$ableton_app" ]]; then
    echo "Ableton app not found: $ableton_app" >&2
    exit 1
fi

if [[ ! -f "$project_path" ]]; then
    echo "Ableton project not found: $project_path" >&2
    exit 1
fi

is_live_running() {
    pgrep -x "$ableton_process" >/dev/null 2>&1
}

click_dont_save_button_by_position() {
    if command -v cliclick >/dev/null 2>&1; then
        cliclick "c:$dont_save_click"
        return
    fi

    local x="${dont_save_click%,*}"
    local y="${dont_save_click#*,}"

    osascript <<APPLESCRIPT
tell application "System Events"
  click at {$x, $y}
end tell
APPLESCRIPT
}

choose_dont_save_from_ableton_dialog() {
    osascript <<APPLESCRIPT
tell application "System Events"
  tell process "$ableton_process"
    set frontmost to true
    delay 0.1
    keystroke "q" using {command down}
    delay 0.5
    key code 2 using {command down}
    delay 0.5
    if exists then key code 51 using {command down}
  end tell
end tell
APPLESCRIPT

    sleep 1

    if is_live_running; then
        echo "Ableton did not accept the keyboard shortcuts; clicking Don't Save at $dont_save_click..."
        click_dont_save_button_by_position
    fi
}

quit_live_without_saving() {
    if ! is_live_running; then
        return
    fi

    echo "Asking Ableton to quit without saving..."
    osascript -e "tell application id \"$ableton_bundle_id\" to quit saving no" >/dev/null 2>&1 &
    local quit_event_pid=$!

    sleep 2

    if is_live_running; then
        echo "Ableton opened a save dialog; choosing Don't Save..."
        choose_dont_save_from_ableton_dialog
    fi

    local deadline=$((SECONDS + quit_timeout_seconds))
    while is_live_running; do
        if ((SECONDS >= deadline)); then
            kill "$quit_event_pid" >/dev/null 2>&1 || true
            echo "Ableton did not quit within ${quit_timeout_seconds}s." >&2
            echo "Not force-quitting, because that would trigger Live crash recovery." >&2
            exit 1
        fi

        sleep 0.25
    done

    wait "$quit_event_pid" >/dev/null 2>&1 || true
}

latest_live_preferences_dir() {
    find "$HOME/Library/Preferences/Ableton" -maxdepth 1 -type d -name "Live *" 2>/dev/null \
        | sort -V \
        | tail -n 1
}

discard_active_recovery_state() {
    local prefs_dir
    prefs_dir="$(latest_live_preferences_dir)"

    if [[ -z "$prefs_dir" || ! -d "$prefs_dir" ]]; then
        echo "No Ableton Live preferences directory found; skipping recovery cleanup."
        return
    fi

    local backup_dir="$prefs_dir/Crash/DiscardedByCosimoRelaunch-$(date +%Y%m%d-%H%M%S)"
    local moved=0
    mkdir -p "$backup_dir"

    for item in CrashRecoveryInfo.cfg CrashDetection.cfg BaseFiles Undo; do
        if [[ -e "$prefs_dir/$item" ]]; then
            mv "$prefs_dir/$item" "$backup_dir/"
            moved=1
        fi
    done

    if ((moved)); then
        echo "Moved active Ableton recovery state to:"
        echo "  $backup_dir"
    else
        rmdir "$backup_dir"
        echo "No active Ableton recovery state found."
    fi
}

quit_live_without_saving

if ((discard_recovery)); then
    discard_active_recovery_state
fi

echo "Opening Ableton project:"
echo "  $project_path"
open -a "$ableton_app" "$project_path"
