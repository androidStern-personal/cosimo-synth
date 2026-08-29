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
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, NoReturn


REPO_ROOT = Path(__file__).resolve().parents[1]
LOCK_FILE = REPO_ROOT / "cmake" / "dependencies.lock.cmake"
CPM_FILE = REPO_ROOT / "cmake" / "CPM.cmake"
CPM_PROJECT = REPO_ROOT / "cmake" / "dependencies"
RESOLVER_BUILD_ROOT = REPO_ROOT / "build" / "cpm-dependency-resolver"
DEFAULT_LOCK_TIMEOUT_SECONDS = 900.0
LOCK_POLL_INTERVAL_SECONDS = 0.05
LOCK_FILE_NAME = ".cosimo-resolver.lock"
VALIDATION_RECEIPT_NAME = ".cosimo-validation-v1.json"

LOCK_ASSIGNMENT = re.compile(r'^set\(([A-Z0-9_]+) "([^"]+)"\)$')
CPM_RUNTIME_VERSION = re.compile(
    r"^\s*set\(CURRENT_CPM_VERSION\s+([0-9][0-9A-Za-z.-]*)\s*\)$",
    re.MULTILINE,
)
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
    operation: str
    dependency: str | None = None
    path: Path | None = None
    repair_attempted: bool = False

    def payload(self) -> dict[str, Any]:
        result: dict[str, Any] = {
            "code": self.code,
            "message": self.message,
            "operation": self.operation,
            "repairAttempted": self.repair_attempted,
        }
        result["dependency"] = self.dependency or PUBLIC_FAILURES[self.code][2]
        return result


PUBLIC_FAILURES: dict[str, tuple[str, str, str]] = {
    "LOCK_FILE_INVALID": (
        "Dependency lock validation failed.",
        "validate-lock",
        "dependency-lock",
    ),
    "CPM_INTEGRITY_FAILURE": (
        "Vendored CPM integrity validation failed.",
        "verify-cpm-integrity",
        "cpm",
    ),
    "PRIVATE_REPOSITORY_ACCESS_DENIED": (
        "GitHub access to the locked private dependency failed.",
        "retrieve-locked-source",
        "cmajor",
    ),
    "CPM_CONFIGURE_FAILED": (
        "CPM could not resolve the locked dependency graph.",
        "resolve-with-cpm",
        "dependency-graph",
    ),
    "CPM_RESULT_MISSING": (
        "CPM did not produce dependency resolution evidence.",
        "read-cpm-result",
        "dependency-graph",
    ),
    "CACHE_INCOMPLETE": (
        "Cached dependency validation found incomplete source.",
        "validate-cache",
        "dependency-graph",
    ),
    "CACHE_PATH_MISMATCH": (
        "Cached dependency path validation failed.",
        "validate-cache-path",
        "dependency-graph",
    ),
    "CACHE_IDENTITY_MISMATCH": (
        "Cached dependency identity validation failed.",
        "validate-cache-identity",
        "dependency-graph",
    ),
    "CACHE_DIRTY": (
        "Cached dependency cleanliness validation failed.",
        "validate-cache-cleanliness",
        "dependency-graph",
    ),
    "CACHE_READ_ONLY_FAILED": (
        "Cached dependency source could not be marked read-only.",
        "mark-source-read-only",
        "dependency-graph",
    ),
    "UNSAFE_CACHE_REPAIR_REFUSED": (
        "Dependency cache repair was refused by the path-safety policy.",
        "repair-cache",
        "dependency-graph",
    ),
    "UNSAFE_CACHE_PATH": (
        "Dependency cache path validation rejected a link or reparse-point escape.",
        "validate-cache-path",
        "dependency-graph",
    ),
    "OFFLINE_CACHE_MISS": (
        "The locked dependency graph is unavailable in the offline cache.",
        "resolve-offline",
        "dependency-graph",
    ),
    "CACHE_LOCK_TIMEOUT": (
        "Timed out waiting for exclusive access to the dependency cache.",
        "acquire-cache-lock",
        "dependency-graph",
    ),
}


def _raise(code: str, _internal_detail: str, **details: Any) -> NoReturn:
    message, operation, _default_dependency = PUBLIC_FAILURES[code]
    dependency = details.pop("dependency", None)
    raise ResolverError(
        code=code,
        message=message,
        operation=operation,
        dependency=dependency,
        **details,
    )


def vendored_cpm_runtime_version() -> str:
    try:
        source = CPM_FILE.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        _raise(
            "CPM_INTEGRITY_FAILURE",
            "Vendored CPM.cmake could not be read.",
            path=CPM_FILE,
        )
    matches = CPM_RUNTIME_VERSION.findall(source)
    if len(matches) != 1:
        _raise(
            "CPM_INTEGRITY_FAILURE",
            "Vendored CPM.cmake does not declare exactly one release runtime version.",
            path=CPM_FILE,
        )
    return matches[0]


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
    runtime_version = vendored_cpm_runtime_version()
    if (
        runtime_version != values["COSIMO_CPM_VERSION"]
        or "development-version" in runtime_version
    ):
        _raise(
            "CPM_INTEGRITY_FAILURE",
            "Vendored CPM runtime version does not match the locked release.",
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


def _absolute_lexical_path(path: Path) -> Path:
    return Path(os.path.abspath(os.fspath(path.expanduser())))


def _is_link_or_reparse_point(path: Path) -> bool:
    try:
        metadata = path.lstat()
    except FileNotFoundError:
        return False
    file_attributes = getattr(metadata, "st_file_attributes", 0)
    reparse_attribute = getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0)
    return stat.S_ISLNK(metadata.st_mode) or bool(
        reparse_attribute and file_attributes & reparse_attribute
    )


def _validate_cache_path_components(
    cache_root: Path,
    candidate: Path,
    dependency: str,
    *,
    allow_final_link: bool = False,
) -> None:
    root = _absolute_lexical_path(cache_root)
    target = _absolute_lexical_path(candidate)
    try:
        target.relative_to(root)
    except ValueError:
        _raise(
            "UNSAFE_CACHE_PATH",
            "Dependency cache candidate is outside the selected cache root.",
            dependency=dependency,
            path=candidate,
        )

    current = Path(target.anchor)
    for part in target.parts[1:]:
        current /= part
        try:
            current.lstat()
        except FileNotFoundError:
            break
        if _is_link_or_reparse_point(current):
            if allow_final_link and current == target:
                return
            _raise(
                "UNSAFE_CACHE_PATH",
                "Dependency cache path contains a link or reparse point.",
                dependency=dependency,
                path=current,
            )


class _CacheLock:
    def __init__(self, cache_root: Path, timeout_seconds: float):
        self.cache_root = _absolute_lexical_path(cache_root)
        self.timeout_seconds = timeout_seconds
        self.lock_file = None

    def __enter__(self):
        _validate_cache_path_components(
            self.cache_root,
            self.cache_root,
            "dependency-graph",
        )
        self.cache_root.mkdir(parents=True, exist_ok=True)
        _validate_cache_path_components(
            self.cache_root,
            self.cache_root,
            "dependency-graph",
        )
        lock_path = self.cache_root / LOCK_FILE_NAME
        _validate_cache_path_components(
            self.cache_root,
            lock_path,
            "dependency-graph",
        )
        open_flags = os.O_CREAT | os.O_RDWR
        if hasattr(os, "O_NOFOLLOW"):
            open_flags |= os.O_NOFOLLOW
        try:
            descriptor = os.open(lock_path, open_flags, 0o600)
        except OSError:
            _raise(
                "UNSAFE_CACHE_PATH",
                "Dependency cache lock file could not be opened safely.",
                dependency="dependency-graph",
                path=lock_path,
            )
        self.lock_file = os.fdopen(descriptor, "r+b", buffering=0)
        deadline = time.monotonic() + self.timeout_seconds
        while True:
            try:
                self._try_lock()
                return self
            except (BlockingIOError, OSError):
                if time.monotonic() >= deadline:
                    self.lock_file.close()
                    self.lock_file = None
                    _raise(
                        "CACHE_LOCK_TIMEOUT",
                        "Dependency cache lock acquisition timed out.",
                        dependency="dependency-graph",
                        path=lock_path,
                    )
                time.sleep(LOCK_POLL_INTERVAL_SECONDS)

    def _try_lock(self) -> None:
        if os.name == "nt":
            import msvcrt

            if os.fstat(self.lock_file.fileno()).st_size == 0:
                self.lock_file.write(b"\0")
                self.lock_file.flush()
            self.lock_file.seek(0)
            msvcrt.locking(self.lock_file.fileno(), msvcrt.LK_NBLCK, 1)
            return

        import fcntl

        fcntl.flock(self.lock_file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)

    def __exit__(self, _exception_type, _exception, _traceback) -> None:
        if self.lock_file is None:
            return
        try:
            if os.name == "nt":
                import msvcrt

                self.lock_file.seek(0)
                msvcrt.locking(self.lock_file.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                import fcntl

                fcntl.flock(self.lock_file.fileno(), fcntl.LOCK_UN)
        finally:
            self.lock_file.close()
            self.lock_file = None


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
        folded = key.casefold()
        if (
            folded in forbidden
            or folded.startswith("git_trace")
            or folded in {"git_curl_verbose", "git_debug_lookup"}
        ):
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
                "CPM dependency resolution failed.",
            )

        if not result_file.is_file():
            _raise(
                "CPM_RESULT_MISSING",
                "CPM configured without producing the dependency result manifest.",
                path=result_file,
            )
        resolved = _parse_result_file(result_file)
        if resolved.get("cpm_runtime_version") != vendored_cpm_runtime_version():
            _raise(
                "CPM_INTEGRITY_FAILURE",
                "CPM configured with an unexpected runtime version.",
                path=result_file,
            )
        return resolved
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
            "Cached dependency is not a usable Git checkout.",
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
    if _absolute_lexical_path(actual) != _absolute_lexical_path(expected):
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
    verify_clean: bool = True,
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

    if verify_clean:
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


def _required_source_files(
    name: str,
    path: Path,
    required_files: tuple[str, ...],
) -> None:
    if _is_link_or_reparse_point(path) or not path.is_dir():
        _raise(
            "CACHE_INCOMPLETE",
            f"Cached {name} source directory is missing or linked.",
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


def _validate_cmajor_submodules(
    cmajor_path: Path,
    cache_root: Path,
) -> dict[str, dict[str, str]]:
    declaration_output = _git_dependency(
        "cmajor",
        cmajor_path,
        "config",
        "--file",
        ".gitmodules",
        "--get-regexp",
        r"^submodule\..*\.(path|url)$",
    )
    declaration_fields: dict[str, dict[str, str]] = {}
    declaration_pattern = re.compile(r"^submodule\.(.+)\.(path|url)$")
    for line in declaration_output.splitlines():
        key, separator, value = line.partition(" ")
        match = declaration_pattern.fullmatch(key)
        if not separator or match is None:
            _raise(
                "CACHE_INCOMPLETE",
                "Cmajor returned malformed submodule declarations.",
                dependency="cmajor",
                path=cmajor_path,
            )
        submodule_name, field = match.groups()
        declaration_fields.setdefault(submodule_name, {})[field] = value

    declared: dict[str, tuple[str, str]] = {}
    for submodule_name, fields in declaration_fields.items():
        if set(fields) != {"path", "url"}:
            _raise(
                "CACHE_INCOMPLETE",
                "Cmajor contains an incomplete submodule declaration.",
                dependency="cmajor",
                path=cmajor_path,
            )
        declared[fields["path"]] = (submodule_name, fields["url"])

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

    inspection_script = """
cosimo_commit=$(git rev-parse HEAD) || exit 91
cosimo_origin=$(git remote get-url origin) || exit 92
printf 'COSIMO_SUBMODULE\\t%s\\t%s\\t%s\\n' "$displaypath" "$cosimo_commit" "$cosimo_origin"
""".strip()
    inspection_output = _git_dependency(
        "cmajor",
        cmajor_path,
        "submodule",
        "foreach",
        "--recursive",
        "--quiet",
        inspection_script,
    )
    inspected: dict[str, tuple[str, str]] = {}
    for line in inspection_output.splitlines():
        fields = line.split("\t")
        if len(fields) != 4 or fields[0] != "COSIMO_SUBMODULE":
            _raise(
                "CACHE_INCOMPLETE",
                "Cmajor returned malformed aggregate submodule evidence.",
                dependency="cmajor",
                path=cmajor_path,
            )
        _, relative_path, actual_commit, actual_url = fields
        inspected[relative_path] = (actual_commit, actual_url)

    if set(inspected) != set(declared):
        _raise(
            "CACHE_INCOMPLETE",
            "Cmajor's initialized submodule graph does not match its declarations.",
            dependency="cmajor",
            path=cmajor_path,
        )

    validated: dict[str, dict[str, str]] = {}
    for relative_path, (_, expected_url) in declared.items():
        dependency = "choc" if relative_path == "include/choc" else "cmajor"
        prefix, expected_commit = status_by_path[relative_path]
        submodule_path = cmajor_path / relative_path
        _validate_cache_path_components(cache_root, submodule_path, dependency)
        if (
            prefix == "-"
            or _is_link_or_reparse_point(submodule_path)
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

        actual_commit, actual_url = inspected[relative_path]
        if actual_commit != expected_commit:
            _raise(
                "CACHE_IDENTITY_MISMATCH",
                f"Cmajor submodule {relative_path} does not match its pinned gitlink.",
                dependency=dependency,
                path=submodule_path,
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
        validated[relative_path] = {
            "commit": actual_commit,
            "repository": expected_url,
        }

    return validated


def _validate_all(
    lock: dict[str, str],
    cache_root: Path,
    cpm_result: dict[str, str],
    *,
    verify_clean: bool = True,
) -> dict[str, dict[str, Any]]:
    expected = expected_source_paths(lock, cache_root)
    actual = {
        name: Path(cpm_result[f"{name}_source"])
        for name in ("cmajor", "choc", "juce")
    }
    for name in actual:
        _assert_expected_path(name, actual[name], expected[name])
        _validate_cache_path_components(
            cache_root,
            actual[name],
            name,
        )

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
        verify_clean=verify_clean,
    )

    submodules = _validate_cmajor_submodules(actual["cmajor"], cache_root)
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

    _required_source_files(
        "choc",
        actual["choc"],
        (
            "LICENSE.md",
            "choc/gui/choc_WebView.h",
            "choc/javascript/choc_javascript_QuickJS.h",
            "choc/javascript/choc_javascript_Timer.h",
        ),
    )
    choc = {
        "path": str(actual["choc"].resolve()),
        "repository": lock["COSIMO_CHOC_REPOSITORY"],
        "commit": choc_submodule["commit"],
        "clean": True,
    }
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
        verify_clean=verify_clean,
    )
    return {"cmajor": cmajor, "choc": choc, "juce": juce}


def _iter_tree_without_links(path: Path, *, top_down: bool):
    for root, directory_names, file_names in os.walk(
        path,
        topdown=top_down,
        followlinks=False,
    ):
        root_path = Path(root)
        directory_names[:] = [
            name
            for name in directory_names
            if not _is_link_or_reparse_point(root_path / name)
        ]
        yield root_path, directory_names, file_names


def _lock_identity_digest(lock: dict[str, str]) -> str:
    identity = "\n".join(f"{key}={lock[key]}" for key in REQUIRED_LOCK_KEYS)
    return hashlib.sha256(identity.encode("utf-8")).hexdigest()


def _tree_validation_fingerprint(
    path: Path,
    cache_root: Path,
    dependency: str,
) -> dict[str, Any]:
    _validate_cache_path_components(cache_root, path, dependency)
    if _is_link_or_reparse_point(path) or not path.is_dir():
        _raise(
            "CACHE_INCOMPLETE",
            "Cached dependency source is unavailable for immutable validation.",
            dependency=dependency,
            path=path,
        )

    digest = hashlib.sha256()
    entry_count = 0
    read_only = True

    def add_entry(entry: Path) -> None:
        nonlocal entry_count, read_only
        try:
            metadata = entry.lstat()
        except FileNotFoundError:
            _raise(
                "CACHE_INCOMPLETE",
                "Cached dependency changed during immutable validation.",
                dependency=dependency,
                path=entry,
            )
        relative_path = "." if entry == path else entry.relative_to(path).as_posix()
        link_target = os.readlink(entry) if stat.S_ISLNK(metadata.st_mode) else ""
        fields = (
            relative_path,
            str(stat.S_IFMT(metadata.st_mode)),
            str(stat.S_IMODE(metadata.st_mode)),
            str(metadata.st_size),
            str(metadata.st_mtime_ns),
            str(metadata.st_ctime_ns),
            link_target,
        )
        digest.update("\0".join(fields).encode("utf-8", errors="surrogateescape"))
        digest.update(b"\n")
        entry_count += 1
        if not stat.S_ISLNK(metadata.st_mode) and metadata.st_mode & 0o222:
            read_only = False

    for root, directory_names, file_names in os.walk(
        path,
        topdown=True,
        followlinks=False,
    ):
        directory_names.sort()
        file_names.sort()
        root_path = Path(root)
        add_entry(root_path)
        linked_directories = [
            name
            for name in directory_names
            if _is_link_or_reparse_point(root_path / name)
        ]
        directory_names[:] = [
            name for name in directory_names if name not in linked_directories
        ]
        for name in linked_directories:
            add_entry(root_path / name)
        for name in file_names:
            add_entry(root_path / name)

    return {
        "digest": digest.hexdigest(),
        "entries": entry_count,
        "readOnly": read_only,
    }


def _validation_receipt_path(cache_root: Path) -> Path:
    return cache_root / VALIDATION_RECEIPT_NAME


def _validation_receipt_matches(
    lock: dict[str, str],
    cache_root: Path,
    expected: dict[str, Path],
) -> bool:
    receipt_path = _validation_receipt_path(cache_root)
    _validate_cache_path_components(
        cache_root,
        receipt_path,
        "dependency-graph",
    )
    if not receipt_path.is_file():
        return False
    try:
        receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        return False
    if (
        receipt.get("schemaVersion") != 1
        or receipt.get("lockDigest") != _lock_identity_digest(lock)
        or not isinstance(receipt.get("trees"), dict)
    ):
        return False
    for dependency in ("cmajor", "juce"):
        try:
            actual = _tree_validation_fingerprint(
                expected[dependency],
                cache_root,
                dependency,
            )
        except ResolverError as error:
            if error.code == "CACHE_INCOMPLETE":
                return False
            raise
        if not actual["readOnly"] or receipt["trees"].get(dependency) != actual:
            return False
    return True


def _write_validation_receipt(
    lock: dict[str, str],
    cache_root: Path,
    expected: dict[str, Path],
) -> None:
    receipt_path = _validation_receipt_path(cache_root)
    _validate_cache_path_components(
        cache_root,
        receipt_path,
        "dependency-graph",
    )
    receipt = {
        "schemaVersion": 1,
        "lockDigest": _lock_identity_digest(lock),
        "trees": {
            dependency: _tree_validation_fingerprint(
                expected[dependency],
                cache_root,
                dependency,
            )
            for dependency in ("cmajor", "juce")
        },
    }
    if not all(tree["readOnly"] for tree in receipt["trees"].values()):
        _raise(
            "CACHE_READ_ONLY_FAILED",
            "Retrieved dependency source remained writable after read-only marking.",
            dependency="dependency-graph",
            path=cache_root,
        )
    temporary_path = receipt_path.with_suffix(f".tmp-{os.getpid()}")
    _validate_cache_path_components(
        cache_root,
        temporary_path,
        "dependency-graph",
    )
    try:
        temporary_path.write_text(
            json.dumps(receipt, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        os.replace(temporary_path, receipt_path)
    finally:
        temporary_path.unlink(missing_ok=True)


def _make_tree_writable(
    path: Path,
    cache_root: Path,
    dependency: str,
) -> None:
    _validate_cache_path_components(cache_root, path, dependency)
    if not path.exists():
        return
    try:
        if path.is_dir():
            for root, directory_names, file_names in _iter_tree_without_links(
                path, top_down=True
            ):
                root.chmod(root.stat().st_mode | stat.S_IWUSR)
                for name in (*directory_names, *file_names):
                    entry = root / name
                    if not _is_link_or_reparse_point(entry):
                        entry.chmod(entry.stat().st_mode | stat.S_IWUSR)
        else:
            path.chmod(path.stat().st_mode | stat.S_IWUSR)
    except FileNotFoundError:
        pass


def _mark_tree_read_only(
    path: Path,
    cache_root: Path,
    dependency: str,
) -> None:
    _validate_cache_path_components(cache_root, path, dependency)
    try:
        if path.is_dir():
            for root, directory_names, file_names in _iter_tree_without_links(
                path, top_down=False
            ):
                for name in (*file_names, *directory_names):
                    entry = root / name
                    if not _is_link_or_reparse_point(entry):
                        entry.chmod(entry.stat().st_mode & ~0o222)
                root.chmod(root.stat().st_mode & ~0o222)
        else:
            path.chmod(path.stat().st_mode & ~0o222)
    except OSError:
        _raise(
            "CACHE_READ_ONLY_FAILED",
            "Could not mark the retrieved dependency source read-only.",
            dependency=dependency,
            path=path,
        )


def _repair_cache_entry(
    path: Path,
    cache_root: Path,
    dependency: str = "dependency-graph",
) -> None:
    root = _absolute_lexical_path(cache_root)
    candidate = _absolute_lexical_path(path)
    try:
        candidate.relative_to(root)
    except ValueError:
        _raise(
            "UNSAFE_CACHE_REPAIR_REFUSED",
            "Refusing to repair a dependency path outside the selected CPM cache.",
            path=path,
        )

    _validate_cache_path_components(
        cache_root,
        path,
        dependency,
        allow_final_link=True,
    )

    if candidate == root or len(candidate.relative_to(root).parts) < 2:
        _raise(
            "UNSAFE_CACHE_REPAIR_REFUSED",
            "Refusing to repair an overly broad CPM cache path.",
            path=path,
        )

    if _is_link_or_reparse_point(path):
        try:
            path.unlink()
        except IsADirectoryError:
            path.rmdir()
        return

    _make_tree_writable(path, cache_root, dependency)
    if path.is_dir():
        shutil.rmtree(path)
    elif path.exists():
        path.unlink()


def _resolve_dependencies_locked(
    cache_root: Path,
    offline: bool,
) -> dict[str, Any]:
    lock = load_lock()
    expected = expected_source_paths(lock, cache_root)
    _validate_cache_path_components(cache_root, cache_root, "dependency-graph")
    _validate_cache_path_components(
        cache_root, cache_root / "cosimo_cmajor", "cmajor"
    )
    _validate_cache_path_components(cache_root, cache_root / "cosimo_juce", "juce")

    preflight_repair_performed = False
    for name in ("cmajor", "choc", "juce"):
        try:
            _validate_cache_path_components(cache_root, expected[name], name)
        except ResolverError as error:
            is_final_link = (
                error.code == "UNSAFE_CACHE_PATH"
                and error.path is not None
                and _absolute_lexical_path(error.path)
                == _absolute_lexical_path(expected[name])
                and _is_link_or_reparse_point(expected[name])
            )
            if offline or not is_final_link:
                raise
            repair_target = (
                expected["cmajor"] if name in {"cmajor", "choc"} else expected["juce"]
            )
            _repair_cache_entry(repair_target, cache_root, name)
            preflight_repair_performed = True

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
    expected_result = {
        f"{name}_source": str(path) for name, path in expected.items()
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
        _repair_cache_entry(repair_target, cache_root, error.dependency)

    repair_performed = preflight_repair_performed
    cpm_configured = False
    resolution_mode = "cpm"
    dependencies: dict[str, dict[str, Any]] | None = None
    validation_receipt_matched = False

    warm_candidate = all(
        expected[name].exists() or expected[name].is_symlink()
        for name in ("cmajor", "juce")
    )
    if warm_candidate:
        validation_receipt_matched = _validation_receipt_matches(
            lock,
            cache_root,
            expected,
        )
        try:
            dependencies = _validate_all(
                lock,
                cache_root,
                expected_result,
                verify_clean=not validation_receipt_matched,
            )
        except ResolverError as error:
            if offline:
                raise
            repair(error)
            repair_performed = True
        else:
            resolution_mode = "warm-cache"

    if dependencies is None:
        try:
            cpm_result = _run_cpm(lock, cache_root, offline)
            cpm_configured = True
        except ResolverError as cpm_error:
            if offline or cpm_error.code != "CPM_CONFIGURE_FAILED":
                raise

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
                    cpm_configured = True
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
            cpm_configured = True
            try:
                dependencies = _validate_all(lock, cache_root, cpm_result)
            except ResolverError as retry_error:
                retry_error.repair_attempted = True
                raise

    if not validation_receipt_matched:
        for name in ("cmajor", "juce"):
            _mark_tree_read_only(expected[name], cache_root, name)
        _write_validation_receipt(lock, cache_root, expected)
    for details in dependencies.values():
        details["readOnly"] = True

    return {
        "schemaVersion": 1,
        "resolver": "CPM.cmake",
        "cacheRoot": str(cache_root),
        "offline": offline,
        "repairPerformed": repair_performed,
        "resolutionMode": resolution_mode,
        "cpmConfigured": cpm_configured,
        "immutableValidation": {
            "receiptVersion": 1,
            "verified": True,
        },
        "cpm": {
            "version": lock["COSIMO_CPM_VERSION"],
            "runtimeVersion": vendored_cpm_runtime_version(),
            "commit": lock["COSIMO_CPM_COMMIT"],
            "sha256": lock["COSIMO_CPM_SHA256"],
            "source": str(CPM_FILE),
        },
        "dependencies": dependencies,
    }


def resolve_dependencies(
    cache_root: Path,
    offline: bool = False,
    lock_timeout_seconds: float = DEFAULT_LOCK_TIMEOUT_SECONDS,
) -> dict[str, Any]:
    cache_root = _absolute_lexical_path(cache_root)
    with _CacheLock(cache_root, lock_timeout_seconds):
        return _resolve_dependencies_locked(cache_root, offline)


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
        "--lock-timeout-seconds",
        type=float,
        default=DEFAULT_LOCK_TIMEOUT_SECONDS,
        help="Bound how long this process waits for the shared cache lock.",
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
        f"JUCE@{dependencies['juce']['commit']}"
    )


def main(arguments: list[str] | None = None) -> int:
    options = _create_parser().parse_args(arguments)
    cache_root = options.cache_root if options.cache_root is not None else default_cache_root()
    try:
        result = resolve_dependencies(
            cache_root,
            offline=options.offline,
            lock_timeout_seconds=max(0.0, options.lock_timeout_seconds),
        )
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
