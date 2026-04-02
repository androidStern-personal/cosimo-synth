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
RUNTIME_DESTINATION = REPO_ROOT / "build" / "deps" / f"cmajor-{RUNTIME_TAG}"


def _run(command: list[str], *, cwd: Path | None = None, capture: bool = False) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        cwd=cwd,
        check=True,
        text=True,
        capture_output=capture,
    )


def _runtime_looks_complete(runtime_root: Path) -> bool:
    required_paths = (
        runtime_root / ".git",
        runtime_root / "include" / "cmajor" / "helpers" / "cmaj_Patch.h",
        runtime_root / "include" / "choc" / "choc" / "gui" / "choc_WebView.h",
        runtime_root / "javascript" / "cmaj_api" / "cmaj-patch-view.js",
    )
    return all(path.exists() for path in required_paths)


def _runtime_head(runtime_root: Path) -> str | None:
    if not _runtime_looks_complete(runtime_root):
        return None

    try:
        return _run(["git", "rev-parse", "HEAD"], cwd=runtime_root, capture=True).stdout.strip()
    except subprocess.CalledProcessError:
        return None


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
            "include/choc",
        ],
        cwd=temp_destination,
    )

    fetched_head = _runtime_head(temp_destination)

    if fetched_head != RUNTIME_COMMIT:
        raise RuntimeError(
            f"Fetched Cmajor runtime commit {fetched_head or '<missing>'}, expected {RUNTIME_COMMIT} for tag {RUNTIME_TAG}."
        )

    if destination.exists():
        shutil.rmtree(destination)

    temp_destination.rename(destination)


def ensure_runtime() -> Path:
    current_head = _runtime_head(RUNTIME_DESTINATION)

    if current_head == RUNTIME_COMMIT:
        return RUNTIME_DESTINATION

    if RUNTIME_DESTINATION.exists():
        shutil.rmtree(RUNTIME_DESTINATION)

    _clone_runtime(RUNTIME_DESTINATION)

    current_head = _runtime_head(RUNTIME_DESTINATION)

    if current_head != RUNTIME_COMMIT:
        raise RuntimeError(
            f"Pinned Cmajor runtime fetch completed, but {RUNTIME_DESTINATION} resolved to {current_head or '<missing>'} instead of {RUNTIME_COMMIT}."
        )

    return RUNTIME_DESTINATION


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Fetch the pinned Cmajor runtime into build/deps and print its path."
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
