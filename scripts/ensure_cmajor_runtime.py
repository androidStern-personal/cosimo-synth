#!/usr/bin/env python3
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
RUNTIME_GIT_URL = "https://github.com/cmajor-lang/cmajor.git"
RUNTIME_TAG = "1.0.3066"
RUNTIME_COMMIT = "172db53232337154d5a1c0f9a448318129dfacd9"
PATCHED_CHOC_GIT_URL = "https://github.com/androidStern/choc.git"
PATCHED_CHOC_BRANCH = "cosimo-keyboard-bridge"
PATCHED_CHOC_COMMIT = "1e79d904209abd842d688433358f9e0df7d55454"
PATCHED_CHOC_SHORT_COMMIT = PATCHED_CHOC_COMMIT[:8]
RUNTIME_DESTINATION = REPO_ROOT / "build" / "deps" / f"cmajor-{RUNTIME_TAG}-choc-{PATCHED_CHOC_SHORT_COMMIT}"
KEYBOARD_BRIDGE_MARKERS = (
    "chocHostKeyboard",
    "__chocHostKeyboardBridgeInstalled",
)


def _run(command: list[str], *, cwd: Path | None = None, capture: bool = False) -> subprocess.CompletedProcess[str]:
    if capture:
        return subprocess.run(
            command,
            cwd=cwd,
            check=True,
            text=True,
            capture_output=True,
        )

    return subprocess.run(
        command,
        cwd=cwd,
        check=True,
        text=True,
        stdout=sys.stderr,
    )


def _runtime_looks_complete(runtime_root: Path) -> bool:
    required_paths = (
        runtime_root / ".git",
        runtime_root / "include" / "cmajor" / "helpers" / "cmaj_Patch.h",
        runtime_root / "include" / "choc" / "choc" / "gui" / "choc_WebView.h",
        runtime_root / "javascript" / "cmaj_api" / "cmaj-patch-view.js",
        runtime_root / "3rdParty" / "llvm" / "release" / "osx" / "universal" / "cmake_platforms",
        runtime_root / "3rdParty" / "boost" / "asio" / "include" / "boost" / "asio.hpp",
    )
    return all(path.exists() for path in required_paths)


def _choc_head(runtime_root: Path) -> str | None:
    choc_root = runtime_root / "include" / "choc"

    if not choc_root.exists():
        return None

    try:
        return _run(["git", "rev-parse", "HEAD"], cwd=choc_root, capture=True).stdout.strip()
    except subprocess.CalledProcessError:
        return None


def _runtime_contains_keyboard_bridge(runtime_root: Path) -> bool:
    webview_header = runtime_root / "include" / "choc" / "choc" / "gui" / "choc_WebView.h"

    if not webview_header.exists():
        return False

    header_text = webview_header.read_text(encoding="utf-8")
    return all(marker in header_text for marker in KEYBOARD_BRIDGE_MARKERS)


def _runtime_head(runtime_root: Path) -> str | None:
    if not (runtime_root / ".git").exists():
        return None

    try:
        return _run(["git", "rev-parse", "HEAD"], cwd=runtime_root, capture=True).stdout.strip()
    except subprocess.CalledProcessError:
        return None


def _prepare_runtime_submodules(runtime_root: Path) -> None:
    _run(
        [
            "git",
            "-c",
            "url.https://github.com/.insteadof=git@github.com:",
            "submodule",
            "update",
            "--init",
            "--depth",
            "1",
        ],
        cwd=runtime_root,
    )

    choc_root = runtime_root / "include" / "choc"

    _run(["git", "remote", "set-url", "origin", PATCHED_CHOC_GIT_URL], cwd=choc_root)
    _run(["git", "fetch", "--depth", "1", "origin", PATCHED_CHOC_BRANCH], cwd=choc_root)
    _run(["git", "checkout", "--detach", PATCHED_CHOC_COMMIT], cwd=choc_root)


def _clone_runtime(destination: Path) -> None:
    temp_destination = destination.with_name(f"{destination.name}.tmp")

    if temp_destination.exists():
        shutil.rmtree(temp_destination)

    destination.parent.mkdir(parents=True, exist_ok=True)

    _run(
        [
            "git",
            "clone",
            "--depth",
            "1",
            "--branch",
            RUNTIME_TAG,
            RUNTIME_GIT_URL,
            str(temp_destination),
        ]
    )

    _prepare_runtime_submodules(temp_destination)

    fetched_head = _runtime_head(temp_destination)

    if fetched_head != RUNTIME_COMMIT:
        raise RuntimeError(
            f"Fetched Cmajor runtime commit {fetched_head or '<missing>'}, expected {RUNTIME_COMMIT} for tag {RUNTIME_TAG}."
        )

    fetched_choc_head = _choc_head(temp_destination)

    if fetched_choc_head != PATCHED_CHOC_COMMIT:
        raise RuntimeError(
            f"Fetched CHOC commit {fetched_choc_head or '<missing>'}, expected {PATCHED_CHOC_COMMIT}."
        )

    if not _runtime_contains_keyboard_bridge(temp_destination):
        raise RuntimeError(
            "Fetched CHOC checkout does not contain the host keyboard bridge markers."
        )

    if destination.exists():
        shutil.rmtree(destination)

    temp_destination.rename(destination)


def ensure_runtime() -> Path:
    current_head = _runtime_head(RUNTIME_DESTINATION)
    current_choc_head = _choc_head(RUNTIME_DESTINATION)

    if (
        current_head == RUNTIME_COMMIT
        and current_choc_head == PATCHED_CHOC_COMMIT
        and _runtime_contains_keyboard_bridge(RUNTIME_DESTINATION)
        and _runtime_looks_complete(RUNTIME_DESTINATION)
    ):
        return RUNTIME_DESTINATION

    if current_head == RUNTIME_COMMIT:
        _prepare_runtime_submodules(RUNTIME_DESTINATION)

        current_head = _runtime_head(RUNTIME_DESTINATION)
        current_choc_head = _choc_head(RUNTIME_DESTINATION)

        if (
            current_head == RUNTIME_COMMIT
            and current_choc_head == PATCHED_CHOC_COMMIT
            and _runtime_contains_keyboard_bridge(RUNTIME_DESTINATION)
            and _runtime_looks_complete(RUNTIME_DESTINATION)
        ):
            return RUNTIME_DESTINATION

    if RUNTIME_DESTINATION.exists():
        shutil.rmtree(RUNTIME_DESTINATION)

    _clone_runtime(RUNTIME_DESTINATION)

    current_head = _runtime_head(RUNTIME_DESTINATION)
    current_choc_head = _choc_head(RUNTIME_DESTINATION)

    if current_head != RUNTIME_COMMIT:
        raise RuntimeError(
            f"Pinned Cmajor runtime fetch completed, but {RUNTIME_DESTINATION} resolved to {current_head or '<missing>'} instead of {RUNTIME_COMMIT}."
        )

    if current_choc_head != PATCHED_CHOC_COMMIT:
        raise RuntimeError(
            f"Patched CHOC fetch completed, but {RUNTIME_DESTINATION / 'include/choc'} resolved to {current_choc_head or '<missing>'} instead of {PATCHED_CHOC_COMMIT}."
        )

    if not _runtime_contains_keyboard_bridge(RUNTIME_DESTINATION):
        raise RuntimeError(
            f"Patched CHOC checkout is missing keyboard bridge markers in {RUNTIME_DESTINATION / 'include/choc/choc/gui/choc_WebView.h'}."
        )

    return RUNTIME_DESTINATION


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Fetch the pinned Cmajor runtime with patched CHOC into build/deps and print its path."
    )
    parser.add_argument(
        "--path",
        action="store_true",
        help="Ensure the pinned runtime exists and print its absolute path.",
    )
    args = parser.parse_args()

    if not args.path:
        parser.error("Pass --path to print the pinned runtime location.")

    runtime_root = ensure_runtime()
    print(runtime_root)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (RuntimeError, subprocess.CalledProcessError) as error:
        print(f"Failed to prepare the pinned Cmajor runtime: {error}", file=sys.stderr)
        raise SystemExit(1)
