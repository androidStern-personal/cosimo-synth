#!/usr/bin/env python3
"""Resolve Cosimo's immutable Cmajor/CHOC/JUCE source graph through CPM.cmake."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import stat
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, NoReturn


REPO_ROOT = Path(__file__).resolve().parents[1]
LOCK_FILE = REPO_ROOT / "cmake" / "dependencies.lock.cmake"
CPM_FILE = REPO_ROOT / "cmake" / "CPM.cmake"
CPM_PROJECT = REPO_ROOT / "cmake" / "dependencies"
RESOLVER_BUILD_ROOT = REPO_ROOT / "build" / "cpm-dependency-resolver"

LOCK_ASSIGNMENT = re.compile(r'^set\(([A-Z0-9_]+) "([^"]+)"\)$')
REQUIRED_LOCK_KEYS = (
    "COSIMO_CPM_VERSION",
    "COSIMO_CPM_COMMIT",
    "COSIMO_CPM_SHA256",
    "COSIMO_CMAJOR_REPOSITORY",
    "COSIMO_CMAJOR_COMMIT",
    "COSIMO_CHOC_REPOSITORY",
    "COSIMO_CHOC_COMMIT",
    "COSIMO_JUCE_REPOSITORY",
    "COSIMO_JUCE_COMMIT",
)


@dataclass
class ResolverError(Exception):
    code: str
    message: str
    dependency: str | None = None
    path: Path | None = None
    repair_attempted: bool = False

    def payload(self) -> dict[str, Any]:
        result: dict[str, Any] = {
            "code": self.code,
            "message": self.message,
            "repairAttempted": self.repair_attempted,
        }
        if self.dependency is not None:
            result["dependency"] = self.dependency
        if self.path is not None:
            result["path"] = str(self.path)
        return result


def _raise(code: str, message: str, **details: Any) -> NoReturn:
    raise ResolverError(code, message, **details)


def load_lock() -> dict[str, str]:
    values: dict[str, str] = {}
    duplicates: set[str] = set()
    unexpected: list[str] = []
    for line_number, raw_line in enumerate(
        LOCK_FILE.read_text(encoding="utf-8").splitlines(), start=1
    ):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue

        match = LOCK_ASSIGNMENT.fullmatch(line)
        if not match:
            unexpected.append(f"line {line_number}")
            continue

        key, value = match.groups()
        if key not in REQUIRED_LOCK_KEYS:
            unexpected.append(f"line {line_number} ({key})")
            continue
        if key in values:
            duplicates.add(key)
        values[key] = value

    missing = [key for key in REQUIRED_LOCK_KEYS if key not in values]
    invalid: list[str] = []
    full_commit = re.compile(r"^[0-9a-f]{40}$")
    full_sha256 = re.compile(r"^[0-9a-f]{64}$")
    exact_version = re.compile(r"^[0-9]+\.[0-9]+\.[0-9]+$")
    github_repository = re.compile(
        r"^https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+\.git$"
    )
    for key in (
        "COSIMO_CPM_COMMIT",
        "COSIMO_CMAJOR_COMMIT",
        "COSIMO_CHOC_COMMIT",
        "COSIMO_JUCE_COMMIT",
    ):
        if key in values and not full_commit.fullmatch(values[key]):
            invalid.append(key)
    if "COSIMO_CPM_SHA256" in values and not full_sha256.fullmatch(
        values["COSIMO_CPM_SHA256"]
    ):
        invalid.append("COSIMO_CPM_SHA256")
    if "COSIMO_CPM_VERSION" in values and not exact_version.fullmatch(
        values["COSIMO_CPM_VERSION"]
    ):
        invalid.append("COSIMO_CPM_VERSION")
    for key in (
        "COSIMO_CMAJOR_REPOSITORY",
        "COSIMO_CHOC_REPOSITORY",
        "COSIMO_JUCE_REPOSITORY",
    ):
        if key in values and not github_repository.fullmatch(values[key]):
            invalid.append(key)

    if missing or duplicates or invalid or unexpected:
        details = []
        if missing:
            details.append(f"missing: {', '.join(sorted(missing))}")
        if duplicates:
            details.append(f"duplicated: {', '.join(sorted(duplicates))}")
        if invalid:
            details.append(f"invalid: {', '.join(sorted(set(invalid)))}")
        if unexpected:
            details.append(f"unexpected content: {', '.join(unexpected)}")
        _raise(
            "LOCK_FILE_INVALID",
            f"Dependency lock identity declarations are not strict ({'; '.join(details)}).",
            path=LOCK_FILE,
        )

    actual_cpm_sha256 = hashlib.sha256(CPM_FILE.read_bytes()).hexdigest()
    if actual_cpm_sha256 != values["COSIMO_CPM_SHA256"]:
        _raise(
            "CPM_INTEGRITY_FAILURE",
            "Vendored CPM.cmake does not match the digest in dependencies.lock.cmake.",
            path=CPM_FILE,
        )

    return values


def default_cache_root() -> Path:
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Caches" / "cosimo-synth" / "cpm-source"
    if os.name == "nt":
        local_app_data = os.environ.get("LOCALAPPDATA")
        if local_app_data:
            return Path(local_app_data) / "cosimo-synth" / "cpm-source"
    xdg_cache = os.environ.get("XDG_CACHE_HOME")
    return Path(xdg_cache) / "cosimo-synth" / "cpm-source" if xdg_cache else Path.home() / ".cache" / "cosimo-synth" / "cpm-source"


def expected_source_paths(lock: dict[str, str], cache_root: Path) -> dict[str, Path]:
    cmajor = cache_root / "cosimo_cmajor" / f"cmajor-{lock['COSIMO_CMAJOR_COMMIT']}"
    return {
        "cmajor": cmajor,
        "choc": cmajor / "include" / "choc",
        "juce": cache_root / "cosimo_juce" / f"juce-{lock['COSIMO_JUCE_COMMIT']}",
    }


def _sanitise_process_output(output: str) -> str:
    output = re.sub(r"(https?://)[^/@\s]+:[^/@\s]+@", r"\1***@", output)
    output = re.sub(r"(?i)(token|password|authorization)([=: ]+)[^\s]+", r"\1\2***", output)
    lines = [line.strip() for line in output.splitlines() if line.strip()]
    return " | ".join(lines[-8:])


def _resolver_environment() -> dict[str, str]:
    environment = os.environ.copy()
    forbidden = {
        "cpm_source_cache",
        "cpm_cosimo_cmajor_source",
        "cpm_cosimo_juce_source",
        "fetchcontent_source_dir_cosimo_cmajor",
        "fetchcontent_source_dir_cosimo_juce",
        "cpm_use_local_packages",
        "cpm_local_packages_only",
    }
    for key in list(environment):
        if key.casefold() in forbidden:
            environment.pop(key, None)
    environment["GIT_OPTIONAL_LOCKS"] = "0"
    environment["GIT_TERMINAL_PROMPT"] = "0"
    return environment


def _parse_result_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        key, separator, value = line.partition("=")
        if separator:
            values[key] = value
    return values


def _run_cpm(lock: dict[str, str], cache_root: Path, offline: bool) -> dict[str, str]:
    del lock  # Identity is consumed by the CMake lock file, never repeated on the command line.
    RESOLVER_BUILD_ROOT.mkdir(parents=True, exist_ok=True)
    build_dir = Path(tempfile.mkdtemp(prefix="resolve-", dir=RESOLVER_BUILD_ROOT))
    result_file = build_dir / "resolved-dependencies.txt"
    command = [
        "cmake",
        "-S",
        str(CPM_PROJECT),
        "-B",
        str(build_dir),
        f"-DCPM_SOURCE_CACHE={cache_root}",
        f"-DCOSIMO_DEPENDENCY_RESULT_FILE={result_file}",
        f"-DCOSIMO_DEPENDENCY_OFFLINE={'ON' if offline else 'OFF'}",
        "-Wno-dev",
    ]

    try:
        result = subprocess.run(
            command,
            cwd=REPO_ROOT,
            env=_resolver_environment(),
            text=True,
            capture_output=True,
            check=False,
        )
        if result.returncode != 0:
            raw_output = f"{result.stdout}\n{result.stderr}"
            detail = _sanitise_process_output(raw_output)
            lowered = raw_output.casefold()
            if any(
                phrase in lowered
                for phrase in (
                    "authentication failed",
                    "could not read username",
                    "repository not found",
                    "permission denied (publickey)",
                    "terminal prompts disabled",
                )
            ):
                _raise(
                    "PRIVATE_REPOSITORY_ACCESS_DENIED",
                    "CPM could not access the private Cmajor/CHOC repositories. Authenticate GitHub for credential-free HTTPS Git access and retry.",
                )
            _raise(
                "CPM_CONFIGURE_FAILED",
                f"CPM dependency resolution failed. {detail}",
            )

        if not result_file.is_file():
            _raise(
                "CPM_RESULT_MISSING",
                "CPM configured without producing the dependency result manifest.",
                path=result_file,
            )
        return _parse_result_file(result_file)
    finally:
        shutil.rmtree(build_dir, ignore_errors=True)


def _normalise_repository_url(url: str) -> str:
    value = url.strip()
    if value.startswith("git@github.com:"):
        value = "https://github.com/" + value.removeprefix("git@github.com:")
    return value.removesuffix(".git").rstrip("/")


def _git(path: Path, *arguments: str) -> str:
    result = subprocess.run(
        ["git", "-C", str(path), *arguments],
        cwd=REPO_ROOT,
        env=_resolver_environment(),
        text=True,
        capture_output=True,
        check=False,
    )
    if result.returncode != 0:
        _raise(
            "CACHE_INCOMPLETE",
            f"Cached dependency is not a usable Git checkout: {_sanitise_process_output(result.stderr)}",
            path=path,
        )
    return result.stdout.rstrip()


def _git_dependency(name: str, path: Path, *arguments: str) -> str:
    try:
        return _git(path, *arguments)
    except ResolverError as error:
        if error.dependency is None:
            error.dependency = name
        raise


def _assert_expected_path(name: str, actual: Path, expected: Path) -> None:
    if actual.resolve(strict=False) != expected.resolve(strict=False):
        _raise(
            "CACHE_PATH_MISMATCH",
            f"CPM returned an unexpected {name} source location.",
            dependency=name,
            path=actual,
        )


def _validate_repository(
    name: str,
    path: Path,
    expected_repository: str,
    expected_commit: str,
    required_files: tuple[str, ...],
    *,
    ignore_submodules: bool = False,
) -> dict[str, Any]:
    if path.is_symlink():
        _raise(
            "CACHE_INCOMPLETE",
            f"Cached {name} source directory must not be a symbolic link.",
            dependency=name,
            path=path,
        )

    if not path.is_dir():
        _raise(
            "CACHE_INCOMPLETE",
            f"Cached {name} source directory is missing.",
            dependency=name,
            path=path,
        )

    for relative_path in required_files:
        if not (path / relative_path).is_file():
            _raise(
                "CACHE_INCOMPLETE",
                f"Cached {name} checkout is missing {relative_path}.",
                dependency=name,
                path=path,
            )

    actual_commit = _git_dependency(name, path, "rev-parse", "HEAD")
    if actual_commit != expected_commit:
        _raise(
            "CACHE_IDENTITY_MISMATCH",
            f"Cached {name} checkout is at {actual_commit}, expected {expected_commit}.",
            dependency=name,
            path=path,
        )

    actual_repository = _git_dependency(name, path, "remote", "get-url", "origin")
    if _normalise_repository_url(actual_repository) != _normalise_repository_url(expected_repository):
        _raise(
            "CACHE_IDENTITY_MISMATCH",
            f"Cached {name} checkout has the wrong origin repository.",
            dependency=name,
            path=path,
        )

    status_arguments = ["status", "--porcelain=v1", "--untracked-files=all"]
    if ignore_submodules:
        status_arguments.append("--ignore-submodules=all")
    dirty = _git_dependency(name, path, *status_arguments)
    if dirty:
        _raise(
            "CACHE_DIRTY",
            f"Cached {name} checkout contains modified or untracked source.",
            dependency=name,
            path=path,
        )

    return {
        "path": str(path.resolve()),
        "repository": expected_repository,
        "commit": actual_commit,
        "clean": True,
    }


def _validate_cmajor_submodules(cmajor_path: Path) -> dict[str, dict[str, str]]:
    declarations = _git_dependency(
        "cmajor",
        cmajor_path,
        "config",
        "--file",
        ".gitmodules",
        "--get-regexp",
        r"^submodule\..*\.path$",
    )
    declared: dict[str, tuple[str, str]] = {}
    for line in declarations.splitlines():
        key, path = line.split(maxsplit=1)
        name = key.removeprefix("submodule.").removesuffix(".path")
        url = _git_dependency(
            "choc" if path == "include/choc" else "cmajor",
            cmajor_path,
            "config",
            "--file",
            ".gitmodules",
            "--get",
            f"submodule.{name}.url",
        )
        declared[path] = (name, url)

    status_by_path: dict[str, tuple[str, str]] = {}
    status_output = _git_dependency(
        "cmajor", cmajor_path, "submodule", "status", "--recursive"
    )
    for line in status_output.splitlines():
        if not line:
            continue
        prefix = line[0]
        fields = line[1:].split(maxsplit=2)
        if len(fields) < 2:
            _raise(
                "CACHE_INCOMPLETE",
                "Cmajor returned malformed recursive submodule status.",
                dependency="cmajor",
                path=cmajor_path,
            )
        status_by_path[fields[1]] = (prefix, fields[0])

    if set(status_by_path) != set(declared):
        _raise(
            "CACHE_INCOMPLETE",
            "Cmajor's recursive submodule graph does not match its committed declarations.",
            dependency="cmajor",
            path=cmajor_path,
        )

    validated: dict[str, dict[str, str]] = {}
    for relative_path, (_, expected_url) in declared.items():
        dependency = "choc" if relative_path == "include/choc" else "cmajor"
        prefix, expected_commit = status_by_path[relative_path]
        submodule_path = cmajor_path / relative_path
        if (
            prefix == "-"
            or submodule_path.is_symlink()
            or not submodule_path.is_dir()
        ):
            _raise(
                "CACHE_INCOMPLETE",
                f"Cmajor submodule {relative_path} is not initialized.",
                dependency=dependency,
                path=submodule_path,
            )
        if prefix != " ":
            _raise(
                "CACHE_IDENTITY_MISMATCH",
                f"Cmajor submodule {relative_path} does not match its pinned gitlink.",
                dependency=dependency,
                path=submodule_path,
            )

        actual_commit = _git_dependency(
            dependency, submodule_path, "rev-parse", "HEAD"
        )
        if actual_commit != expected_commit:
            _raise(
                "CACHE_IDENTITY_MISMATCH",
                f"Cmajor submodule {relative_path} does not match its pinned gitlink.",
                dependency=dependency,
                path=submodule_path,
            )
        actual_url = _git_dependency(
            dependency, submodule_path, "remote", "get-url", "origin"
        )
        if _normalise_repository_url(actual_url) != _normalise_repository_url(
            expected_url
        ):
            _raise(
                "CACHE_IDENTITY_MISMATCH",
                f"Cmajor submodule {relative_path} has the wrong origin repository.",
                dependency=dependency,
                path=submodule_path,
            )
        if _git_dependency(
            dependency,
            submodule_path,
            "status",
            "--porcelain=v1",
            "--untracked-files=all",
            "--ignore-submodules=all",
        ):
            _raise(
                "CACHE_DIRTY",
                f"Cmajor submodule {relative_path} contains modified or untracked source.",
                dependency=dependency,
                path=submodule_path,
            )
        validated[relative_path] = {
            "commit": actual_commit,
            "repository": expected_url,
        }

    return validated


def _validate_all(
    lock: dict[str, str], cache_root: Path, cpm_result: dict[str, str]
) -> dict[str, dict[str, Any]]:
    expected = expected_source_paths(lock, cache_root)
    actual = {
        name: Path(cpm_result[f"{name}_source"])
        for name in ("cmajor", "choc", "juce")
    }
    for name in actual:
        _assert_expected_path(name, actual[name], expected[name])

    cmajor = _validate_repository(
        "cmajor",
        actual["cmajor"],
        lock["COSIMO_CMAJOR_REPOSITORY"],
        lock["COSIMO_CMAJOR_COMMIT"],
        (
            "LICENSE.md",
            "CMakeLists.txt",
            "include/cmajor/helpers/cmaj_Patch.h",
            "include/cmajor/helpers/cmaj_JUCEPlugin.h",
            "include/cmajor/helpers/cmaj_PatchWorker_QuickJS.h",
            ".gitmodules",
        ),
        ignore_submodules=True,
    )

    submodules = _validate_cmajor_submodules(actual["cmajor"])
    choc_submodule = submodules.get("include/choc")
    if (
        choc_submodule is None
        or choc_submodule["commit"] != lock["COSIMO_CHOC_COMMIT"]
        or _normalise_repository_url(choc_submodule["repository"])
        != _normalise_repository_url(lock["COSIMO_CHOC_REPOSITORY"])
    ):
        _raise(
            "CACHE_IDENTITY_MISMATCH",
            "Cmajor does not contain the locked, initialized CHOC submodule.",
            dependency="choc",
            path=actual["choc"],
        )

    llvm_submodule = submodules.get("3rdParty/llvm")
    llvm_path = actual["cmajor"] / "3rdParty/llvm"
    if llvm_submodule is None:
        _raise(
            "CACHE_INCOMPLETE",
            "Cmajor does not pin its required LLVM submodule.",
            dependency="cmajor",
            path=llvm_path,
        )
    if not (llvm_path / "README.md").is_file():
        _raise(
            "CACHE_INCOMPLETE",
            "Cmajor's locked LLVM submodule is missing required release files.",
            dependency="cmajor",
            path=llvm_path,
        )

    choc = _validate_repository(
        "choc",
        actual["choc"],
        lock["COSIMO_CHOC_REPOSITORY"],
        lock["COSIMO_CHOC_COMMIT"],
        (
            "LICENSE.md",
            "choc/gui/choc_WebView.h",
            "choc/javascript/choc_javascript_QuickJS.h",
            "choc/javascript/choc_javascript_Timer.h",
        ),
    )
    juce = _validate_repository(
        "juce",
        actual["juce"],
        lock["COSIMO_JUCE_REPOSITORY"],
        lock["COSIMO_JUCE_COMMIT"],
        (
            "LICENSE.md",
            "CMakeLists.txt",
            "modules/juce_audio_processors/juce_audio_processors.h",
        ),
    )
    return {"cmajor": cmajor, "choc": choc, "juce": juce}


def _make_tree_writable(path: Path) -> None:
    if not path.exists():
        return
    entries = [path]
    if path.is_dir() and not path.is_symlink():
        entries.extend(path.rglob("*"))
    for entry in entries:
        if entry.is_symlink():
            continue
        try:
            entry.chmod(entry.stat().st_mode | stat.S_IWUSR)
        except FileNotFoundError:
            pass


def _mark_tree_read_only(path: Path) -> None:
    if os.name != "nt":
        result = subprocess.run(
            ["chmod", "-R", "a-w", str(path)],
            cwd=REPO_ROOT,
            text=True,
            capture_output=True,
            check=False,
        )
        if result.returncode != 0:
            _raise(
                "CACHE_READ_ONLY_FAILED",
                "Could not mark the retrieved dependency source read-only.",
                path=path,
            )
        return

    entries = [path]
    entries.extend(path.rglob("*"))
    for entry in reversed(entries):
        if entry.is_symlink():
            continue
        try:
            entry.chmod(entry.stat().st_mode & ~0o222)
        except OSError:
            _raise(
                "CACHE_READ_ONLY_FAILED",
                "Could not mark the retrieved dependency source read-only.",
                path=path,
            )


def _repair_cache_entry(path: Path, cache_root: Path) -> None:
    root = cache_root.resolve(strict=False)
    candidate = path.parent.resolve(strict=False) / path.name
    try:
        candidate.relative_to(root)
    except ValueError:
        _raise(
            "UNSAFE_CACHE_REPAIR_REFUSED",
            "Refusing to repair a dependency path outside the selected CPM cache.",
            path=path,
        )

    if candidate == root or len(candidate.relative_to(root).parts) < 2:
        _raise(
            "UNSAFE_CACHE_REPAIR_REFUSED",
            "Refusing to repair an overly broad CPM cache path.",
            path=path,
        )

    if path.is_symlink():
        path.unlink()
        return

    _make_tree_writable(path)
    if path.is_dir():
        shutil.rmtree(path)
    elif path.exists():
        path.unlink()


def resolve_dependencies(cache_root: Path, offline: bool = False) -> dict[str, Any]:
    lock = load_lock()
    cache_root = cache_root.expanduser().resolve(strict=False)
    expected = expected_source_paths(lock, cache_root)

    if offline:
        missing = [name for name in ("cmajor", "juce") if not expected[name].is_dir()]
        if missing:
            _raise(
                "OFFLINE_CACHE_MISS",
                f"Offline CPM cache {cache_root} is missing: {', '.join(missing)}.",
                path=cache_root,
            )

    repairable = {
        "CACHE_DIRTY",
        "CACHE_IDENTITY_MISMATCH",
        "CACHE_INCOMPLETE",
        "CACHE_PATH_MISMATCH",
    }

    def repair(error: ResolverError) -> None:
        if error.code not in repairable or error.dependency is None:
            raise error
        repair_target = (
            expected["cmajor"]
            if error.dependency in {"cmajor", "choc"}
            else expected["juce"]
        )
        if not repair_target.exists() and not repair_target.is_symlink():
            raise error
        _repair_cache_entry(repair_target, cache_root)

    repair_performed = False
    try:
        cpm_result = _run_cpm(lock, cache_root, offline)
    except ResolverError as cpm_error:
        if offline or cpm_error.code != "CPM_CONFIGURE_FAILED":
            raise

        expected_result = {
            f"{name}_source": str(path) for name, path in expected.items()
        }
        try:
            _validate_all(lock, cache_root, expected_result)
        except ResolverError as cache_error:
            try:
                repair(cache_error)
            except ResolverError:
                raise cpm_error
            repair_performed = True
            try:
                cpm_result = _run_cpm(lock, cache_root, offline=False)
            except ResolverError as retry_error:
                retry_error.repair_attempted = True
                raise
        else:
            raise cpm_error

    try:
        dependencies = _validate_all(lock, cache_root, cpm_result)
    except ResolverError as error:
        if offline or repair_performed:
            raise
        repair(error)
        repair_performed = True
        cpm_result = _run_cpm(lock, cache_root, offline=False)
        try:
            dependencies = _validate_all(lock, cache_root, cpm_result)
        except ResolverError as retry_error:
            retry_error.repair_attempted = True
            raise

    for name in ("cmajor", "juce"):
        _mark_tree_read_only(expected[name])
    for details in dependencies.values():
        details["readOnly"] = True

    return {
        "schemaVersion": 1,
        "resolver": "CPM.cmake",
        "cacheRoot": str(cache_root),
        "offline": offline,
        "repairPerformed": repair_performed,
        "cpm": {
            "version": lock["COSIMO_CPM_VERSION"],
            "commit": lock["COSIMO_CPM_COMMIT"],
            "sha256": lock["COSIMO_CPM_SHA256"],
            "source": str(CPM_FILE),
        },
        "dependencies": dependencies,
    }


def _create_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--cache-root",
        type=Path,
        default=None,
        help="Override only the CPM storage root (reserved for tests and CI).",
    )
    parser.add_argument(
        "--offline",
        action="store_true",
        help="Require all locked source to already exist in the CPM cache.",
    )
    parser.add_argument(
        "--format",
        choices=("json", "tsv"),
        default="json",
        help="Select machine-readable JSON or cmajor/choc/juce tab-separated paths.",
    )
    parser.add_argument(
        "--path",
        choices=("cmajor", "choc", "juce"),
        help="Print one resolved dependency path.",
    )
    return parser


def _dependency_summary(result: dict[str, Any]) -> str:
    dependencies = result["dependencies"]
    return (
        "Cosimo CPM dependencies: "
        f"Cmajor@{dependencies['cmajor']['commit']}, "
        f"CHOC@{dependencies['choc']['commit']}, "
        f"JUCE@{dependencies['juce']['commit']} "
        f"({result['cacheRoot']})"
    )


def main(arguments: list[str] | None = None) -> int:
    options = _create_parser().parse_args(arguments)
    cache_root = options.cache_root if options.cache_root is not None else default_cache_root()
    try:
        result = resolve_dependencies(cache_root, offline=options.offline)
    except ResolverError as error:
        print(json.dumps({"error": error.payload()}, sort_keys=True), file=sys.stderr)
        return 2

    dependencies = result["dependencies"]
    if options.path:
        print(dependencies[options.path]["path"])
        print(_dependency_summary(result), file=sys.stderr)
    elif options.format == "tsv":
        print("\t".join(dependencies[name]["path"] for name in ("cmajor", "choc", "juce")))
        print(_dependency_summary(result), file=sys.stderr)
    else:
        print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
