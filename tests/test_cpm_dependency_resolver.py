from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import stat
import subprocess
import sys
import time
from pathlib import Path

import pytest

from scripts import resolve_build_dependencies as dependency_resolver


REPO_ROOT = Path(__file__).resolve().parents[1]
RESOLVER = REPO_ROOT / "scripts" / "resolve_build_dependencies.py"
LOCK_FILE = REPO_ROOT / "cmake" / "dependencies.lock.cmake"
CPM_FILE = REPO_ROOT / "cmake" / "CPM.cmake"

LOCK_VALUES = dependency_resolver.load_lock()
CPM_VERSION = LOCK_VALUES["COSIMO_CPM_VERSION"]
CPM_COMMIT = LOCK_VALUES["COSIMO_CPM_COMMIT"]
CPM_SHA256 = LOCK_VALUES["COSIMO_CPM_SHA256"]
CMAJOR_REPOSITORY = LOCK_VALUES["COSIMO_CMAJOR_REPOSITORY"]
CMAJOR_COMMIT = LOCK_VALUES["COSIMO_CMAJOR_COMMIT"]
CHOC_REPOSITORY = LOCK_VALUES["COSIMO_CHOC_REPOSITORY"]
CHOC_COMMIT = LOCK_VALUES["COSIMO_CHOC_COMMIT"]
JUCE_REPOSITORY = LOCK_VALUES["COSIMO_JUCE_REPOSITORY"]
JUCE_COMMIT = LOCK_VALUES["COSIMO_JUCE_COMMIT"]

CANONICAL_DEPENDENCY_CMAKE = "cmake/dependencies/CMakeLists.txt"
DEPENDENCY_DECLARATION_PATTERN = re.compile(
    r"\b(?:CPMAddPackage|FetchContent_(?:Declare|MakeAvailable|Populate))\s*\(",
    re.IGNORECASE,
)
CPM_PACKAGE_PATTERN = re.compile(
    r"\bCPMAddPackage\s*\((?P<body>[^)]*)\)",
    re.IGNORECASE | re.DOTALL,
)
EXPECTED_CPM_PACKAGES = {
    "cosimo_cmajor": ("COSIMO_CMAJOR_REPOSITORY", "COSIMO_CMAJOR_COMMIT"),
    "cosimo_juce": ("COSIMO_JUCE_REPOSITORY", "COSIMO_JUCE_COMMIT"),
}


def _cmake_argument_values(body: str, argument: str) -> list[str]:
    return re.findall(
        rf"\b{argument}\s+(\"[^\"]*\"|[^\s)]+)",
        body,
        flags=re.IGNORECASE,
    )


def _dependency_declaration_violations(
    relative_path: str,
    source: str,
) -> list[str]:
    if relative_path == "cmake/CPM.cmake":
        return []
    if relative_path != CANONICAL_DEPENDENCY_CMAKE:
        if DEPENDENCY_DECLARATION_PATTERN.search(source):
            return [f"{relative_path}: alternate dependency declaration"]
        return []

    violations: list[str] = []
    package_bodies = [match.group("body") for match in CPM_PACKAGE_PATTERN.finditer(source)]
    fetch_content_commands = [
        match
        for match in DEPENDENCY_DECLARATION_PATTERN.finditer(source)
        if match.group(0).lower().startswith("fetchcontent_")
    ]
    if fetch_content_commands:
        violations.append(f"{relative_path}: unexpected FetchContent declaration")
    if len(package_bodies) != len(EXPECTED_CPM_PACKAGES):
        violations.append(
            f"{relative_path}: expected exactly {len(EXPECTED_CPM_PACKAGES)} CPM packages"
        )

    packages_by_name: dict[str, list[str]] = {}
    for body in package_bodies:
        names = _cmake_argument_values(body, "NAME")
        if len(names) != 1:
            violations.append(f"{relative_path}: CPM package must have exactly one NAME")
            continue
        packages_by_name.setdefault(names[0].lower(), []).append(body)

    if set(packages_by_name) != set(EXPECTED_CPM_PACKAGES):
        violations.append(f"{relative_path}: unexpected CPM package identity")

    for package_name, (repository_variable, commit_variable) in EXPECTED_CPM_PACKAGES.items():
        matching_bodies = packages_by_name.get(package_name, [])
        if len(matching_bodies) != 1:
            violations.append(
                f"{relative_path}: expected one {package_name} CPM package"
            )
            continue
        body = matching_bodies[0]
        if _cmake_argument_values(body, "GIT_REPOSITORY") != [
            f'"${{{repository_variable}}}"'
        ]:
            violations.append(
                f"{relative_path}: {package_name} repository must use the dependency lock"
            )
        if _cmake_argument_values(body, "GIT_TAG") != [f'"${{{commit_variable}}}"']:
            violations.append(
                f"{relative_path}: {package_name} commit must use the dependency lock"
            )

    return violations


def run_resolver(
    cache_root: Path,
    *arguments: str,
    environment: dict[str, str] | None = None,
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [
            sys.executable,
            str(RESOLVER),
            "--cache-root",
            str(cache_root),
            *arguments,
        ],
        cwd=REPO_ROOT,
        env=environment,
        text=True,
        capture_output=True,
        check=False,
    )


def parse_error(result: subprocess.CompletedProcess[str]) -> dict[str, object]:
    lines = [line for line in result.stderr.splitlines() if line.strip()]
    assert lines, result
    return json.loads(lines[-1])["error"]


def parse_success(result: subprocess.CompletedProcess[str]) -> dict[str, object]:
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def write_executable(path: Path, source: str) -> None:
    path.write_text(source, encoding="utf-8")
    path.chmod(0o755)


def create_synthetic_dependency_tools(
    tmp_path: Path,
) -> tuple[dict[str, str], Path]:
    fake_bin = tmp_path / "synthetic-tools"
    fake_bin.mkdir()
    cmake_log = tmp_path / "cmake-invocations.log"
    llvm_commit = "1234567890abcdef1234567890abcdef12345678"
    llvm_repository = "https://github.com/llvm/llvm-project.git"
    write_executable(
        fake_bin / "cmake",
        f"""#!{sys.executable}
import os
import sys
from pathlib import Path

arguments = {{argument.partition('=')[0]: argument.partition('=')[2] for argument in sys.argv[1:] if argument.startswith('-D')}}
cache_root = Path(arguments['-DCPM_SOURCE_CACHE'])
result_file = Path(arguments['-DCOSIMO_DEPENDENCY_RESULT_FILE'])
cmajor = cache_root / 'cosimo_cmajor' / 'cmajor-{CMAJOR_COMMIT}'
choc = cmajor / 'include' / 'choc'
juce = cache_root / 'cosimo_juce' / 'juce-{JUCE_COMMIT}'

def ensure(root, relative_path):
    target = root / relative_path
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists():
        target.write_text('synthetic dependency fixture\\n', encoding='utf-8')

for relative_path in (
    'LICENSE.md',
    'CMakeLists.txt',
    'include/cmajor/helpers/cmaj_Patch.h',
    'include/cmajor/helpers/cmaj_JUCEPlugin.h',
    'include/cmajor/helpers/cmaj_PatchWorker_QuickJS.h',
    '.gitmodules',
    '3rdParty/llvm/README.md',
):
    ensure(cmajor, relative_path)
for relative_path in (
    'LICENSE.md',
    'choc/gui/choc_WebView.h',
    'choc/javascript/choc_javascript_QuickJS.h',
    'choc/javascript/choc_javascript_Timer.h',
):
    ensure(choc, relative_path)
for relative_path in (
    'LICENSE.md',
    'CMakeLists.txt',
    'modules/juce_audio_processors/juce_audio_processors.h',
):
    ensure(juce, relative_path)

result_file.parent.mkdir(parents=True, exist_ok=True)
result_file.write_text(
    f'cpm_runtime_version={CPM_VERSION}\\ncmajor_source={{cmajor}}\\nchoc_source={{choc}}\\njuce_source={{juce}}\\n',
    encoding='utf-8',
)
with Path(os.environ['COSIMO_FAKE_CMAKE_LOG']).open('a', encoding='utf-8') as log:
    log.write('configured\\n')
""",
    )
    write_executable(
        fake_bin / "git",
        f"""#!{sys.executable}
import sys
from pathlib import Path

arguments = sys.argv[1:]
if len(arguments) < 3 or arguments[0] != '-C':
    raise SystemExit(2)
repository_path = Path(arguments[1])
command = arguments[2:]

if command[:2] == ['rev-parse', 'HEAD']:
    if repository_path.name == 'choc': print('{CHOC_COMMIT}')
    elif repository_path.name == 'llvm': print('{llvm_commit}')
    elif repository_path.name.startswith('juce-'): print('{JUCE_COMMIT}')
    else: print('{CMAJOR_COMMIT}')
elif command[:3] == ['remote', 'get-url', 'origin']:
    if repository_path.name == 'choc': print('{CHOC_REPOSITORY}')
    elif repository_path.name == 'llvm': print('{llvm_repository}')
    elif repository_path.name.startswith('juce-'): print('{JUCE_REPOSITORY}')
    else: print('{CMAJOR_REPOSITORY}')
elif command and command[0] == 'status':
    pass
elif command[:2] == ['config', '--file']:
    print('submodule.3rdParty/choc.path include/choc')
    print('submodule.3rdParty/choc.url {CHOC_REPOSITORY}')
    print('submodule.3rdParty/llvm.path 3rdParty/llvm')
    print('submodule.3rdParty/llvm.url {llvm_repository}')
elif command[:3] == ['submodule', 'status', '--recursive']:
    print(' {CHOC_COMMIT} include/choc (heads/main)')
    print(' {llvm_commit} 3rdParty/llvm (heads/main)')
elif command[:2] == ['submodule', 'foreach']:
    print('COSIMO_SUBMODULE\\tinclude/choc\\t{CHOC_COMMIT}\\t{CHOC_REPOSITORY}')
    print('COSIMO_SUBMODULE\\t3rdParty/llvm\\t{llvm_commit}\\t{llvm_repository}')
else:
    raise SystemExit(3)
""",
    )
    environment = os.environ.copy()
    environment["PATH"] = f"{fake_bin}{os.pathsep}{environment['PATH']}"
    environment["COSIMO_FAKE_CMAKE_LOG"] = str(cmake_log)
    return environment, cmake_log


def make_tree_writable(path: Path) -> None:
    if not path.exists():
        return
    if os.name != "nt":
        subprocess.run(
            ["chmod", "-R", "u+w", str(path)],
            check=True,
            text=True,
            capture_output=True,
        )
        return
    for entry in [path, *path.rglob("*")]:
        if not entry.is_symlink():
            entry.chmod(entry.stat().st_mode | stat.S_IWUSR)


@pytest.fixture
def synthetic_cpm_cache(tmp_path: Path):
    environment, cmake_log = create_synthetic_dependency_tools(tmp_path)
    cache_root = tmp_path / "synthetic-cache"
    cold_result = run_resolver(cache_root, environment=environment)
    assert cold_result.returncode == 0, cold_result.stderr
    cmake_log.write_text("", encoding="utf-8")
    try:
        yield {
            "cacheRoot": cache_root,
            "environment": environment,
            "cmakeLog": cmake_log,
        }
    finally:
        make_tree_writable(cache_root)


@pytest.fixture(scope="module")
def concurrent_shared_cache(
    tmp_path_factory: pytest.TempPathFactory,
) -> dict[str, object]:
    cache_root = tmp_path_factory.mktemp("cpm-concurrency") / "shared-cache"
    command = [
        sys.executable,
        str(RESOLVER),
        "--cache-root",
        str(cache_root),
    ]
    processes = [
        subprocess.Popen(
            command,
            cwd=REPO_ROOT,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        for _ in range(2)
    ]
    completed = []
    for process in processes:
        stdout, stderr = process.communicate(timeout=900)
        completed.append((process.returncode, stdout, stderr))

    assert all(returncode == 0 for returncode, _, _ in completed), completed
    payloads = [json.loads(stdout) for _, stdout, _ in completed]

    try:
        yield {"cacheRoot": cache_root, "payloads": payloads}
    finally:
        make_tree_writable(cache_root)


def test_dependency_lock_pins_cpm_and_all_source_identities() -> None:
    lock = LOCK_FILE.read_text(encoding="utf-8")

    assert f'set(COSIMO_CPM_VERSION "{CPM_VERSION}")' in lock
    assert f'set(COSIMO_CPM_COMMIT "{CPM_COMMIT}")' in lock
    assert f'set(COSIMO_CPM_SHA256 "{CPM_SHA256}")' in lock
    assert f'set(COSIMO_CMAJOR_COMMIT "{CMAJOR_COMMIT}")' in lock
    assert f'set(COSIMO_CHOC_COMMIT "{CHOC_COMMIT}")' in lock
    assert f'set(COSIMO_JUCE_COMMIT "{JUCE_COMMIT}")' in lock
    assert f'set(COSIMO_CMAJOR_REPOSITORY "{CMAJOR_REPOSITORY}")' in lock
    assert f'set(COSIMO_CHOC_REPOSITORY "{CHOC_REPOSITORY}")' in lock
    assert f'set(COSIMO_JUCE_REPOSITORY "{JUCE_REPOSITORY}")' in lock

    assert hashlib.sha256(CPM_FILE.read_bytes()).hexdigest() == CPM_SHA256


def test_vendored_cpm_runtime_version_matches_the_locked_release() -> None:
    assert dependency_resolver.vendored_cpm_runtime_version() == CPM_VERSION


@pytest.mark.parametrize(
    "runtime_version",
    ("1.0.0-development-version", "0.43.2"),
)
def test_development_or_mismatched_cpm_runtime_cannot_pass_integrity_validation(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    runtime_version: str,
) -> None:
    cpm_file = tmp_path / "CPM.cmake"
    cpm_file.write_text(
        f"set(CURRENT_CPM_VERSION {runtime_version})\n",
        encoding="utf-8",
    )
    cpm_digest = hashlib.sha256(cpm_file.read_bytes()).hexdigest()
    lock_file = tmp_path / "dependencies.lock.cmake"
    lock_file.write_text(
        LOCK_FILE.read_text(encoding="utf-8").replace(CPM_SHA256, cpm_digest),
        encoding="utf-8",
    )
    monkeypatch.setattr(dependency_resolver, "CPM_FILE", cpm_file)
    monkeypatch.setattr(dependency_resolver, "LOCK_FILE", lock_file)

    with pytest.raises(dependency_resolver.ResolverError) as failure:
        dependency_resolver.load_lock()

    assert failure.value.code == "CPM_INTEGRITY_FAILURE"
    assert failure.value.operation == "verify-cpm-integrity"


@pytest.mark.parametrize(
    "mutate_lock",
    (
        lambda lock: lock.replace(
            f'set(COSIMO_CMAJOR_COMMIT "{CMAJOR_COMMIT}")',
            'set(COSIMO_CMAJOR_COMMIT "main")',
        ),
        lambda lock: lock.replace(f'set(COSIMO_CHOC_COMMIT "{CHOC_COMMIT}")\n', ""),
        lambda lock: lock
        + f'\nset(COSIMO_JUCE_COMMIT "{JUCE_COMMIT}")\n',
        lambda lock: lock.replace(
            CMAJOR_REPOSITORY,
            CMAJOR_REPOSITORY.replace("https://", "https://secret@"),
        ),
        lambda lock: lock
        + '\nset(COSIMO_UNAPPROVED_COMMIT "0123456789abcdef0123456789abcdef01234567")\n',
        lambda lock: lock + "\nexecute_process(COMMAND git status)\n",
    ),
)
def test_lock_rejects_non_strict_identity_or_unexpected_content(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    mutate_lock,
) -> None:
    cpm_file = tmp_path / "CPM.cmake"
    cpm_file.write_bytes(CPM_FILE.read_bytes())
    lock_file = tmp_path / "dependencies.lock.cmake"
    lock_file.write_text(
        mutate_lock(LOCK_FILE.read_text(encoding="utf-8")),
        encoding="utf-8",
    )
    monkeypatch.setattr(dependency_resolver, "CPM_FILE", cpm_file)
    monkeypatch.setattr(dependency_resolver, "LOCK_FILE", lock_file)

    with pytest.raises(dependency_resolver.ResolverError) as failure:
        dependency_resolver.load_lock()

    assert failure.value.code == "LOCK_FILE_INVALID"


def test_cpm_failure_never_exposes_subprocess_credentials_or_git_trace(
    tmp_path: Path,
) -> None:
    fake_bin = tmp_path / "fake-bin"
    fake_bin.mkdir()
    sentinels = (
        "USERNAME_ONLY_TOKEN_SENTINEL",
        "PASSWORD_SENTINEL",
        "BASIC_CREDENTIAL_SENTINEL",
        "STANDALONE_TOKEN_SENTINEL",
        "TRACE_ENV_SENTINEL",
    )
    write_executable(
        fake_bin / "cmake",
        """#!/bin/sh
printf '%s\n' 'fatal: could not resolve https://USERNAME_ONLY_TOKEN_SENTINEL@github.com/private/repo.git' >&2
printf '%s\n' 'https://user:PASSWORD_SENTINEL@github.com/private/repo.git' >&2
printf '%s\n' 'Authorization: Basic BASIC_CREDENTIAL_SENTINEL' >&2
printf '%s\n' 'STANDALONE_TOKEN_SENTINEL' >&2
printf '%s\n' "${GIT_TRACE:-TRACE_VARIABLE_REMOVED}" >&2
exit 1
""",
    )
    environment = os.environ.copy()
    environment["PATH"] = f"{fake_bin}{os.pathsep}{environment['PATH']}"
    environment["GIT_TRACE"] = "TRACE_ENV_SENTINEL"

    result = subprocess.run(
        [
            sys.executable,
            str(RESOLVER),
            "--cache-root",
            str(tmp_path / "cache"),
        ],
        cwd=REPO_ROOT,
        env=environment,
        text=True,
        capture_output=True,
        check=False,
    )

    assert result.returncode == 2
    assert result.stdout == ""
    combined_output = result.stdout + result.stderr
    for sentinel in sentinels:
        assert sentinel not in combined_output
    assert parse_error(result) == {
        "code": "CPM_CONFIGURE_FAILED",
        "dependency": "dependency-graph",
        "message": "CPM could not resolve the locked dependency graph.",
        "operation": "resolve-with-cpm",
        "repairAttempted": False,
    }


def test_git_failure_never_exposes_subprocess_credentials_or_git_trace(
    tmp_path: Path,
) -> None:
    cache_root = tmp_path / "cache"
    expected = dependency_resolver.expected_source_paths(LOCK_VALUES, cache_root)
    required_files = {
        "cmajor": (
            "LICENSE.md",
            "CMakeLists.txt",
            "include/cmajor/helpers/cmaj_Patch.h",
            "include/cmajor/helpers/cmaj_JUCEPlugin.h",
            "include/cmajor/helpers/cmaj_PatchWorker_QuickJS.h",
            ".gitmodules",
        ),
        "choc": (
            "LICENSE.md",
            "choc/gui/choc_WebView.h",
            "choc/javascript/choc_javascript_QuickJS.h",
            "choc/javascript/choc_javascript_Timer.h",
        ),
        "juce": (
            "LICENSE.md",
            "CMakeLists.txt",
            "modules/juce_audio_processors/juce_audio_processors.h",
        ),
    }
    for dependency, relative_paths in required_files.items():
        for relative_path in relative_paths:
            file_path = expected[dependency] / relative_path
            file_path.parent.mkdir(parents=True, exist_ok=True)
            file_path.write_text("fixture\n", encoding="utf-8")

    fake_bin = tmp_path / "fake-bin"
    fake_bin.mkdir()
    write_executable(
        fake_bin / "cmake",
        """#!/bin/sh
for argument in "$@"; do
    case "$argument" in
        -DCPM_SOURCE_CACHE=*) cache_root=${argument#*=} ;;
        -DCOSIMO_DEPENDENCY_RESULT_FILE=*) result_file=${argument#*=} ;;
    esac
done
mkdir -p "$(dirname "$result_file")"
cat >"$result_file" <<EOF
cpm_runtime_version="""
        + CPM_VERSION
        + """
cmajor_source=$cache_root/cosimo_cmajor/cmajor-"""
        + CMAJOR_COMMIT
        + """
choc_source=$cache_root/cosimo_cmajor/cmajor-"""
        + CMAJOR_COMMIT
        + """/include/choc
juce_source=$cache_root/cosimo_juce/juce-"""
        + JUCE_COMMIT
        + """
EOF
""",
    )
    write_executable(
        fake_bin / "git",
        """#!/bin/sh
printf '%s\n' 'https://USERNAME_ONLY_TOKEN_SENTINEL@github.com/private/repo.git' >&2
printf '%s\n' 'https://user:PASSWORD_SENTINEL@github.com/private/repo.git' >&2
printf '%s\n' 'Authorization: Basic BASIC_CREDENTIAL_SENTINEL' >&2
printf '%s\n' 'STANDALONE_TOKEN_SENTINEL' >&2
printf '%s\n' "${GIT_TRACE:-TRACE_VARIABLE_REMOVED}" >&2
exit 1
""",
    )
    environment = os.environ.copy()
    environment["PATH"] = f"{fake_bin}{os.pathsep}{environment['PATH']}"
    environment["GIT_TRACE"] = "TRACE_ENV_SENTINEL"

    result = subprocess.run(
        [
            sys.executable,
            str(RESOLVER),
            "--cache-root",
            str(cache_root),
            "--offline",
        ],
        cwd=REPO_ROOT,
        env=environment,
        text=True,
        capture_output=True,
        check=False,
    )

    assert result.returncode == 2
    combined_output = result.stdout + result.stderr
    for sentinel in (
        "USERNAME_ONLY_TOKEN_SENTINEL",
        "PASSWORD_SENTINEL",
        "BASIC_CREDENTIAL_SENTINEL",
        "STANDALONE_TOKEN_SENTINEL",
        "TRACE_ENV_SENTINEL",
    ):
        assert sentinel not in combined_output
    assert parse_error(result) == {
        "code": "CACHE_INCOMPLETE",
        "dependency": "cmajor",
        "message": "Cached dependency validation found incomplete source.",
        "operation": "validate-cache",
        "repairAttempted": False,
    }


def test_cached_source_root_symlink_is_rejected_even_when_target_is_valid(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    target = tmp_path / "valid-target"
    target.mkdir()
    (target / "required.txt").write_text("present\n", encoding="utf-8")
    source = tmp_path / "cached-source"
    try:
        source.symlink_to(target, target_is_directory=True)
    except OSError as error:
        pytest.skip(f"directory symlinks unavailable: {error}")

    def fake_git(_name: str, _path: Path, *arguments: str) -> str:
        if arguments == ("rev-parse", "HEAD"):
            return JUCE_COMMIT
        if arguments == ("remote", "get-url", "origin"):
            return JUCE_REPOSITORY
        if arguments[:2] == ("status", "--porcelain=v1"):
            return ""
        raise AssertionError(arguments)

    monkeypatch.setattr(dependency_resolver, "_git_dependency", fake_git)

    with pytest.raises(dependency_resolver.ResolverError) as failure:
        dependency_resolver._validate_repository(
            "juce",
            source,
            JUCE_REPOSITORY,
            JUCE_COMMIT,
            ("required.txt",),
        )

    assert failure.value.code == "CACHE_INCOMPLETE"
    assert failure.value.dependency == "juce"
    assert failure.value.operation == "validate-cache"


def test_parent_cache_container_symlink_is_rejected_before_cpm_or_mutation(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    cache_root = tmp_path / "cache"
    cache_root.mkdir()
    external_root = tmp_path / "external-juce-container"
    external_root.mkdir()
    marker = external_root / "must-remain-untouched.txt"
    marker.write_text("external sentinel\n", encoding="utf-8")
    marker.chmod(0o444)
    external_root.chmod(0o555)
    container = cache_root / "cosimo_juce"
    try:
        container.symlink_to(external_root, target_is_directory=True)
    except OSError as error:
        pytest.skip(f"directory symlinks unavailable: {error}")

    def fail_if_cpm_runs(*_arguments, **_keywords):
        raise AssertionError("CPM ran before cache-component validation")

    monkeypatch.setattr(dependency_resolver, "_run_cpm", fail_if_cpm_runs)
    before_root_mode = stat.S_IMODE(external_root.stat().st_mode)
    before_marker_mode = stat.S_IMODE(marker.stat().st_mode)

    with pytest.raises(dependency_resolver.ResolverError) as failure:
        dependency_resolver.resolve_dependencies(cache_root)

    assert failure.value.payload() == {
        "code": "UNSAFE_CACHE_PATH",
        "dependency": "juce",
        "message": "Dependency cache path validation rejected a link or reparse-point escape.",
        "operation": "validate-cache-path",
        "repairAttempted": False,
    }
    assert marker.read_text(encoding="utf-8") == "external sentinel\n"
    assert stat.S_IMODE(external_root.stat().st_mode) == before_root_mode
    assert stat.S_IMODE(marker.stat().st_mode) == before_marker_mode


@pytest.mark.skipif(sys.platform == "win32", reason="fcntl probe is POSIX-only")
def test_cache_lock_timeout_is_bounded_and_typed(tmp_path: Path) -> None:
    cache_root = tmp_path / "cache"
    cache_root.mkdir()
    lock_path = cache_root / ".cosimo-resolver.lock"
    ready_path = tmp_path / "lock-ready"
    holder = subprocess.Popen(
        [
            sys.executable,
            "-c",
            """import fcntl
import pathlib
import sys
import time

lock_path = pathlib.Path(sys.argv[1])
ready_path = pathlib.Path(sys.argv[2])
with lock_path.open("a+b") as lock_file:
    fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)
    ready_path.write_text("ready", encoding="utf-8")
    time.sleep(10)
""",
            str(lock_path),
            str(ready_path),
        ],
        cwd=REPO_ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    try:
        deadline = time.monotonic() + 5
        while not ready_path.exists() and time.monotonic() < deadline:
            time.sleep(0.01)
        assert ready_path.is_file()

        result = run_resolver(
            cache_root,
            "--offline",
            "--lock-timeout-seconds",
            "0.1",
        )

        assert result.returncode == 2
        assert parse_error(result) == {
            "code": "CACHE_LOCK_TIMEOUT",
            "dependency": "dependency-graph",
            "message": "Timed out waiting for exclusive access to the dependency cache.",
            "operation": "acquire-cache-lock",
            "repairAttempted": False,
        }
    finally:
        holder.terminate()
        holder.communicate(timeout=5)


@pytest.mark.parametrize("entry_kind", ("file", "broken-symlink"))
def test_narrow_cache_repair_removes_corrupt_nondirectory_entry(
    tmp_path: Path,
    entry_kind: str,
) -> None:
    cache_root = tmp_path / "cache"
    entry = cache_root / "cosimo_juce" / "juce-corrupt"
    entry.parent.mkdir(parents=True)
    if entry_kind == "file":
        entry.write_text("interrupted checkout\n", encoding="utf-8")
    else:
        try:
            entry.symlink_to(tmp_path / "missing-target", target_is_directory=True)
        except OSError as error:
            pytest.skip(f"directory symlinks unavailable: {error}")

    dependency_resolver._repair_cache_entry(entry, cache_root)

    assert not entry.exists()
    assert not entry.is_symlink()


def test_empty_offline_cache_fails_without_attempting_retrieval(tmp_path: Path) -> None:
    cache_root = tmp_path / "empty-cpm-cache"
    result = run_resolver(cache_root, "--offline")

    assert result.returncode == 2
    error = parse_error(result)
    assert error["code"] == "OFFLINE_CACHE_MISS"
    assert error["operation"] == "resolve-offline"
    assert error["dependency"] == "dependency-graph"
    assert not (cache_root / "cosimo_cmajor").exists()
    assert not (cache_root / "cosimo_juce").exists()


def test_valid_warm_cache_skips_the_cpm_configure_path(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    cache_root = tmp_path / "warm-cache"
    expected = dependency_resolver.expected_source_paths(LOCK_VALUES, cache_root)
    expected["cmajor"].mkdir(parents=True)
    expected["choc"].mkdir(parents=True)
    expected["juce"].mkdir(parents=True)
    validated = {
        name: {
            "path": str(path),
            "repository": LOCK_VALUES[f"COSIMO_{name.upper()}_REPOSITORY"],
            "commit": LOCK_VALUES[f"COSIMO_{name.upper()}_COMMIT"],
            "clean": True,
        }
        for name, path in expected.items()
    }

    monkeypatch.setattr(dependency_resolver, "load_lock", lambda: LOCK_VALUES)
    monkeypatch.setattr(
        dependency_resolver,
        "_validate_all",
        lambda _lock, _cache_root, _result, **_keywords: validated,
    )
    monkeypatch.setattr(
        dependency_resolver,
        "_validation_receipt_matches",
        lambda *_arguments: True,
    )
    monkeypatch.setattr(
        dependency_resolver,
        "_mark_tree_read_only",
        lambda *_arguments: None,
    )

    def fail_if_cpm_runs(*_arguments, **_keywords):
        raise AssertionError("warm resolution launched CPM")

    monkeypatch.setattr(dependency_resolver, "_run_cpm", fail_if_cpm_runs)

    result = dependency_resolver.resolve_dependencies(cache_root, offline=True)

    assert result["resolutionMode"] == "warm-cache"
    assert result["cpmConfigured"] is False
    assert result["dependencies"]["cmajor"]["commit"] == CMAJOR_COMMIT


def test_warm_offline_resolution_uses_immutable_receipt_without_cpm(
    synthetic_cpm_cache: dict[str, object],
) -> None:
    cache_root = synthetic_cpm_cache["cacheRoot"]
    environment = synthetic_cpm_cache["environment"]
    cmake_log = synthetic_cpm_cache["cmakeLog"]

    started = time.monotonic()
    result = run_resolver(
        cache_root,
        "--offline",
        environment=environment,
    )
    elapsed = time.monotonic() - started

    payload = parse_success(result)
    assert payload["resolutionMode"] == "warm-cache"
    assert payload["cpmConfigured"] is False
    assert payload["immutableValidation"] == {
        "receiptVersion": 1,
        "verified": True,
    }
    assert payload["cpm"]["runtimeVersion"] == CPM_VERSION
    assert cmake_log.read_text(encoding="utf-8") == ""
    assert elapsed < 5.0, f"warm synthetic resolution took {elapsed:.2f}s"


def test_complete_submodule_graph_is_checked_with_bounded_aggregate_git_calls(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    cache_root = tmp_path / "cache"
    cmajor_path = cache_root / "cosimo_cmajor" / f"cmajor-{CMAJOR_COMMIT}"
    (cmajor_path / "include/choc").mkdir(parents=True)
    (cmajor_path / "3rdParty/llvm").mkdir(parents=True)
    llvm_commit = "1234567890abcdef1234567890abcdef12345678"
    llvm_repository = "https://github.com/llvm/llvm-project.git"
    calls: list[tuple[Path, tuple[str, ...]]] = []

    def fake_git(_dependency: str, path: Path, *arguments: str) -> str:
        calls.append((path, arguments))
        if arguments[:3] == ("config", "--file", ".gitmodules"):
            return "\n".join(
                (
                    "submodule.3rdParty/choc.path include/choc",
                    f"submodule.3rdParty/choc.url {CHOC_REPOSITORY}",
                    "submodule.3rdParty/llvm.path 3rdParty/llvm",
                    f"submodule.3rdParty/llvm.url {llvm_repository}",
                )
            )
        if arguments == ("submodule", "status", "--recursive"):
            return (
                f" {CHOC_COMMIT} include/choc (heads/main)\n"
                f" {llvm_commit} 3rdParty/llvm (heads/main)"
            )
        if arguments[:4] == ("submodule", "foreach", "--recursive", "--quiet"):
            return (
                f"COSIMO_SUBMODULE\tinclude/choc\t{CHOC_COMMIT}\t{CHOC_REPOSITORY}\n"
                f"COSIMO_SUBMODULE\t3rdParty/llvm\t{llvm_commit}\t{llvm_repository}"
            )
        raise AssertionError(arguments)

    monkeypatch.setattr(dependency_resolver, "_git_dependency", fake_git)
    validated = dependency_resolver._validate_cmajor_submodules(
        cmajor_path,
        cache_root,
    )

    assert set(validated) == {"include/choc", "3rdParty/llvm"}
    assert len(calls) == 3
    assert {path for path, _arguments in calls} == {cmajor_path}


@pytest.mark.parametrize(
    "corruption",
    ("missing-cmajor-file", "interrupted-juce-entry"),
)
def test_concurrent_warm_cache_repair_is_serialized_and_runs_cpm_once(
    synthetic_cpm_cache: dict[str, object],
    corruption: str,
) -> None:
    cache_root = synthetic_cpm_cache["cacheRoot"]
    environment = synthetic_cpm_cache["environment"]
    cmake_log = synthetic_cpm_cache["cmakeLog"]
    expected = dependency_resolver.expected_source_paths(LOCK_VALUES, cache_root)

    if corruption == "missing-cmajor-file":
        required_file = expected["cmajor"] / "include/cmajor/helpers/cmaj_Patch.h"
        required_file.parent.chmod(required_file.parent.stat().st_mode | stat.S_IWUSR)
        required_file.unlink()
    else:
        make_tree_writable(expected["juce"])
        shutil.rmtree(expected["juce"])
        expected["juce"].write_text("interrupted checkout\n", encoding="utf-8")

    command = [
        sys.executable,
        str(RESOLVER),
        "--cache-root",
        str(cache_root),
    ]
    processes = [
        subprocess.Popen(
            command,
            cwd=REPO_ROOT,
            env=environment,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        for _ in range(2)
    ]
    completed = [process.communicate(timeout=30) for process in processes]

    assert all(process.returncode == 0 for process in processes), completed
    payloads = [json.loads(stdout) for stdout, _stderr in completed]
    assert sorted(payload["resolutionMode"] for payload in payloads) == [
        "cpm",
        "warm-cache",
    ]
    assert sum(payload["repairPerformed"] for payload in payloads) == 1
    assert cmake_log.read_text(encoding="utf-8").splitlines() == ["configured"]


def test_cold_then_warm_offline_resolution_returns_locked_read_only_sources(
    concurrent_shared_cache: dict[str, object],
) -> None:
    cache_root = concurrent_shared_cache["cacheRoot"]
    cold = concurrent_shared_cache["payloads"][0]
    cold_dependencies = cold["dependencies"]

    assert cold["resolver"] == "CPM.cmake"
    assert cold["repairPerformed"] is False
    assert cold["cpm"] == {
        "commit": CPM_COMMIT,
        "runtimeVersion": CPM_VERSION,
        "sha256": CPM_SHA256,
        "source": str(CPM_FILE),
        "version": CPM_VERSION,
    }
    assert cold_dependencies["cmajor"]["commit"] == CMAJOR_COMMIT
    assert cold_dependencies["choc"]["commit"] == CHOC_COMMIT
    assert cold_dependencies["juce"]["commit"] == JUCE_COMMIT
    assert all(details["clean"] for details in cold_dependencies.values())
    assert all(details["readOnly"] for details in cold_dependencies.values())
    for dependency in cold_dependencies.values():
        dependency_path = Path(dependency["path"])
        assert dependency_path.stat().st_mode & 0o222 == 0
        assert (dependency_path / ".git").stat().st_mode & 0o222 == 0

    cmajor_path = Path(cold_dependencies["cmajor"]["path"])
    choc_path = Path(cold_dependencies["choc"]["path"])
    assert (cmajor_path / "3rdParty/llvm/README.md").is_file()
    recursive_submodules = subprocess.run(
        ["git", "-C", str(cmajor_path), "submodule", "status", "--recursive"],
        check=True,
        text=True,
        capture_output=True,
    ).stdout.splitlines()
    assert len(recursive_submodules) == 32
    assert all(line.startswith(" ") for line in recursive_submodules)
    patch_header = (cmajor_path / "include/cmajor/helpers/cmaj_Patch.h").read_text(
        encoding="utf-8"
    )
    for behavior_marker in (
        "COSIMO_CMAJOR_PATCH_WORKER_REENTRANT_QUEUE",
        "COSIMO_CMAJOR_PATCH_WORKER_EARLY_DETACH",
        "COSIMO_CMAJOR_PATCH_WORKER_NONFATAL_ERROR",
        "COSIMO_CMAJOR_STORED_STATE_STRING_CONTENT_COMPARISON",
        "COSIMO_CMAJOR_PATCH_EXTERNAL_FUNCTION_PROVIDER",
    ):
        assert patch_header.count(behavior_marker) == 1
    assert patch_header.index("setActive (false);") < patch_header.index(
        "initCallback.reset();"
    )
    assert "requestsToDeliver.swap (queuedSendMessageRequests);" in patch_header
    assert patch_header.index("requestsToDeliver.swap (queuedSendMessageRequests);") < (
        patch_header.index("for (auto& request : requestsToDeliver)")
    )
    assert "v.getString() == newValue.getString()" in patch_header
    assert "patch.externalFunctionProvider))" in patch_header
    assert 'p.setErrorStatus ("Error in patch worker script: " + error' in patch_header
    juce_plugin_header = (
        cmajor_path / "include/cmajor/helpers/cmaj_JUCEPlugin.h"
    ).read_text(encoding="utf-8")
    assert juce_plugin_header.count("COSIMO_CMAJOR_JUCE_PLUGIN_SPLIT_INPUT_BUSES") == 1
    quickjs_worker_header = (
        cmajor_path / "include/cmajor/helpers/cmaj_PatchWorker_QuickJS.h"
    ).read_text(encoding="utf-8")
    assert quickjs_worker_header.count("COSIMO_CMAJOR_QUICKJS_RESOURCE_BRIDGE") == 1
    webview_header = (choc_path / "choc/gui/choc_WebView.h").read_text(
        encoding="utf-8"
    )
    for behavior_anchor in (
        "COSIMO_HOST_KEYBOARD_RELAY_PROCESS_NAME",
        "chocHostKeyboard",
        "__chocHostKeyboardBridgeInstalled",
        "__chocUserFiles",
        "chocUserFiles",
        "hostKeyboardShouldRelayToPlugin",
    ):
        assert behavior_anchor in webview_header
    assert "COSIMO_CHOC_QUICKJS_DRAIN_PENDING_JOBS" in (
        choc_path / "choc/javascript/choc_javascript_QuickJS.h"
    ).read_text(encoding="utf-8")
    assert "COSIMO_CHOC_TIMER_CLEAR_TIMEOUT" in (
        choc_path / "choc/javascript/choc_javascript_Timer.h"
    ).read_text(encoding="utf-8")

    warm = parse_success(run_resolver(cache_root, "--offline"))
    assert warm["offline"] is True
    assert warm["repairPerformed"] is False
    assert {
        name: details["path"]
        for name, details in warm["dependencies"].items()
    } == {
        name: details["path"]
        for name, details in cold_dependencies.items()
    }


def test_concurrent_empty_cache_population_uses_one_locked_source_graph(
    concurrent_shared_cache: dict[str, object],
) -> None:
    cache_root = concurrent_shared_cache["cacheRoot"]
    payloads = concurrent_shared_cache["payloads"]
    resolved_paths = {
        tuple(payload["dependencies"][name]["path"] for name in ("cmajor", "choc", "juce"))
        for payload in payloads
    }
    assert len(resolved_paths) == 1
    assert all(
        payload["dependencies"][name]["commit"] == expected_commit
        for payload in payloads
        for name, expected_commit in (
            ("cmajor", CMAJOR_COMMIT),
            ("choc", CHOC_COMMIT),
            ("juce", JUCE_COMMIT),
        )
    )
    assert len(list((cache_root / "cosimo_cmajor").glob("cmajor-*"))) == 1
    assert len(list((cache_root / "cosimo_juce").glob("juce-*"))) == 1


def test_cache_validation_fails_offline_and_repairs_only_the_invalid_entry(
    concurrent_shared_cache: dict[str, object],
) -> None:
    cache_root = concurrent_shared_cache["cacheRoot"]
    initial = parse_success(run_resolver(cache_root))
    cmajor_path = Path(initial["dependencies"]["cmajor"]["path"])
    juce_path = Path(initial["dependencies"]["juce"]["path"])
    untracked = juce_path / "unexpected-local-overlay.txt"

    make_tree_writable(juce_path)
    untracked.write_text("must never be consumed\n", encoding="utf-8")

    offline_dirty = run_resolver(cache_root, "--offline")
    assert offline_dirty.returncode == 2
    assert parse_error(offline_dirty)["code"] == "CACHE_DIRTY"
    assert untracked.is_file()

    repaired_dirty = parse_success(run_resolver(cache_root))
    assert repaired_dirty["repairPerformed"] is True
    assert not untracked.exists()
    assert repaired_dirty["dependencies"]["cmajor"]["path"] == str(cmajor_path)

    make_tree_writable(juce_path)
    subprocess.run(
        ["git", "-C", str(juce_path), "remote", "set-url", "origin", "https://example.invalid/wrong-juce.git"],
        check=True,
        text=True,
        capture_output=True,
    )
    repaired_juce = parse_success(run_resolver(cache_root))
    assert repaired_juce["repairPerformed"] is True
    assert repaired_juce["dependencies"]["juce"]["repository"] == JUCE_REPOSITORY
    assert repaired_juce["dependencies"]["cmajor"]["path"] == str(cmajor_path)

    make_tree_writable(juce_path)
    required_header = juce_path / "modules/juce_audio_processors/juce_audio_processors.h"
    required_header.unlink()
    repaired_incomplete = parse_success(run_resolver(cache_root))
    assert repaired_incomplete["repairPerformed"] is True
    assert required_header.is_file()
    assert repaired_incomplete["dependencies"]["cmajor"]["commit"] == CMAJOR_COMMIT

    make_tree_writable(juce_path)
    subprocess.run(
        ["git", "-C", str(juce_path), "checkout", "--detach", f"{JUCE_COMMIT}^"],
        check=True,
        text=True,
        capture_output=True,
    )
    offline_wrong_commit = run_resolver(cache_root, "--offline")
    assert offline_wrong_commit.returncode == 2
    assert parse_error(offline_wrong_commit)["code"] == "CACHE_IDENTITY_MISMATCH"
    repaired_commit = parse_success(run_resolver(cache_root))
    assert repaired_commit["repairPerformed"] is True
    assert repaired_commit["dependencies"]["juce"]["commit"] == JUCE_COMMIT

    make_tree_writable(juce_path)
    (juce_path / ".git/HEAD").unlink()
    repaired_corruption = parse_success(run_resolver(cache_root))
    assert repaired_corruption["repairPerformed"] is True
    assert repaired_corruption["dependencies"]["juce"]["commit"] == JUCE_COMMIT

    choc_path = Path(repaired_corruption["dependencies"]["choc"]["path"])
    make_tree_writable(cmajor_path)
    subprocess.run(
        ["git", "-C", str(choc_path), "checkout", "--detach", f"{CHOC_COMMIT}^"],
        check=True,
        text=True,
        capture_output=True,
    )
    offline_wrong_submodule = run_resolver(cache_root, "--offline")
    assert offline_wrong_submodule.returncode == 2
    wrong_submodule_error = parse_error(offline_wrong_submodule)
    assert wrong_submodule_error["code"] == "CACHE_IDENTITY_MISMATCH"
    assert wrong_submodule_error["dependency"] == "choc"
    subprocess.run(
        ["git", "-C", str(choc_path), "checkout", "--detach", CHOC_COMMIT],
        check=True,
        text=True,
        capture_output=True,
    )
    restored = parse_success(run_resolver(cache_root))
    assert restored["repairPerformed"] is False
    assert restored["dependencies"]["choc"]["commit"] == CHOC_COMMIT

    make_tree_writable(juce_path)
    symlink_target = juce_path.with_name("juce-symlink-target")
    juce_path.rename(symlink_target)
    juce_path.symlink_to(symlink_target, target_is_directory=True)
    offline_symlink = run_resolver(cache_root, "--offline")
    assert offline_symlink.returncode == 2
    assert parse_error(offline_symlink)["code"] == "UNSAFE_CACHE_PATH"
    repaired_symlink = parse_success(run_resolver(cache_root))
    assert repaired_symlink["repairPerformed"] is True
    assert not juce_path.is_symlink()
    assert repaired_symlink["dependencies"]["juce"]["commit"] == JUCE_COMMIT

    make_tree_writable(juce_path)
    shutil.rmtree(juce_path)
    juce_path.mkdir()
    (juce_path / "interrupted-download.partial").write_text(
        "incomplete\n",
        encoding="utf-8",
    )
    repaired_interruption = parse_success(run_resolver(cache_root))
    assert repaired_interruption["repairPerformed"] is True
    assert repaired_interruption["dependencies"]["juce"]["commit"] == JUCE_COMMIT


def test_missing_private_repository_access_is_typed_and_actionable(
    tmp_path: Path,
) -> None:
    cache_root = tmp_path / "unauthenticated-cpm-cache"
    isolated_home = tmp_path / "isolated-home"
    isolated_home.mkdir()
    environment = os.environ.copy()
    environment.update(
        {
            "HOME": str(isolated_home),
            "XDG_CONFIG_HOME": str(isolated_home / "config"),
            "GIT_CONFIG_NOSYSTEM": "1",
            "GIT_CONFIG_GLOBAL": "/dev/null",
            "GIT_ASKPASS": "/usr/bin/false",
            "SSH_ASKPASS": "/usr/bin/false",
            "GIT_TERMINAL_PROMPT": "0",
        }
    )

    try:
        result = subprocess.run(
            [
                sys.executable,
                str(RESOLVER),
                "--cache-root",
                str(cache_root),
            ],
            cwd=REPO_ROOT,
            env=environment,
            text=True,
            capture_output=True,
            check=False,
        )
        assert result.returncode == 2
        error = parse_error(result)
        assert error["code"] == "PRIVATE_REPOSITORY_ACCESS_DENIED"
        assert error["dependency"] == "cmajor"
        assert error["operation"] == "retrieve-locked-source"
        assert error["message"] == "GitHub access to the locked private dependency failed."
        assert not re.search(r"https?://[^/\s]+@", result.stderr)
    finally:
        make_tree_writable(cache_root)


def test_every_active_build_entrypoint_delegates_to_the_canonical_resolver() -> None:
    expected_delegation = {
        "fx/prod-effect.mjs": "scripts/resolve_build_dependencies.py",
        "web/build.mjs": "scripts/resolve_build_dependencies.py",
        "ui/vite.shared.mjs": "resolve_build_dependencies.py",
        "tools/desktop_native/CMakeLists.txt": "ResolveBuildDependencies.cmake",
        "tools/cmajor_external_codegen/CMakeLists.txt": "ResolveBuildDependencies.cmake",
        "tools/cmajplugin_build/CMakeLists.txt": "ResolveBuildDependencies.cmake",
        "ios_auv3/CMakeLists.txt": "ResolveBuildDependencies.cmake",
        "scripts/test_quickjs_modulation_restore.sh": "resolve_build_dependencies.py",
        "tests/native/run_bounce_quickjs_driver_probe.sh": "resolve_build_dependencies.py",
        "tests/native/run_patch_worker_lifetime_probe.sh": "resolve_build_dependencies.py",
        "tests/native/run_three_oscillator_jit_provider.sh": "resolve_build_dependencies.py",
        "tests/helpers/desktop_harness_browser.mjs": "resolve_build_dependencies.py",
        "tests/helpers/live_review_server.mjs": "resolve_build_dependencies.py",
        "tests/test_ios_auv3_build.py": "resolve_build_dependencies.py",
        "tests/test_spectral_chord_resonator_probe.py": "resolve_build_dependencies.py",
        "tests/test_web_renderer_audio_worklet.mjs": "resolve_build_dependencies.py",
    }

    for relative_path, delegation in expected_delegation.items():
        source = (REPO_ROOT / relative_path).read_text(encoding="utf-8")
        assert delegation in source, relative_path
        assert "ensure_cmajor_runtime.py" not in source, relative_path
        assert "CMAJOR_SOURCE_PATH" not in source, relative_path

    cmajplugin_wrapper = (
        REPO_ROOT / "tools/cmajplugin_build/CMakeLists.txt"
    ).read_text(encoding="utf-8")
    assert "-Wno-error=implicit-int-float-conversion" in cmajplugin_wrapper
    cmajplugin_installer = (
        REPO_ROOT / "scripts/install_cmajplugin_vst3.sh"
    ).read_text(encoding="utf-8")
    assert "$build_dir/cmajplugin/CmajPlugin_artefacts" in cmajplugin_installer
    assert "$build_dir/tools/CmajPlugin/CmajPlugin_artefacts" not in cmajplugin_installer

    resolver = RESOLVER.read_text(encoding="utf-8")
    assert "_dependency_summary(result)" in resolver
    cmake_adapter = (
        REPO_ROOT / "cmake/ResolveBuildDependencies.cmake"
    ).read_text(encoding="utf-8")
    assert "cosimo-dependency-resolution.json" in cmake_adapter
    assert "Cmajor@${cmajor_commit}" in cmake_adapter
    assert "COSIMO_DEPENDENCY_CACHE_ROOT" in cmake_adapter
    assert 'list(APPEND resolver_arguments "--cache-root"' in cmake_adapter
    for relative_path in (
        "fx/prod-effect.mjs",
        "web/build.mjs",
    ):
        source = (REPO_ROOT / relative_path).read_text(encoding="utf-8")
        assert "cosimo-dependency-resolution.json" in source, relative_path
        assert "Cmajor@${cmajor.commit}" in source, relative_path
        assert "CHOC@${choc.commit}" in source, relative_path
        assert "JUCE@${juce.commit}" in source, relative_path

    web_build = (REPO_ROOT / "web/build.mjs").read_text(encoding="utf-8")
    assert 'path.join(repoRoot, "build", "dependency-evidence", "web")' in web_build
    assert 'path.join(outputDirectory, "cosimo-dependency-resolution.json")' not in web_build
    assert "(${resolution.cacheRoot})" not in web_build
    assert "async function makeBuildTreeWritable" in web_build
    assert web_build.index("await makeBuildTreeWritable(outputDirectory);") < (
        web_build.index("await fs.rm(outputDirectory")
    )
    assert web_build.index("await fs.cp(\n        path.join(runtimeRoot") < (
        web_build.index("await makeBuildTreeWritable(runtimeOutputRoot);")
    )


def test_active_entrypoints_have_no_independent_juce_clone_or_source_override() -> None:
    active_paths = (
        "fx/prod-effect.mjs",
        "scripts/build_cmajplugin_vst3.sh",
        "scripts/build_desktop_native.sh",
        "scripts/generate_cmajor_cpp_with_externals.sh",
        "scripts/generate_ios_auv3_xcode_project.sh",
        "ios_auv3/CMakeLists.txt",
        "tools/desktop_native/CMakeLists.txt",
        "tools/cmajor_external_codegen/CMakeLists.txt",
        "tools/cmajplugin_build/CMakeLists.txt",
        "ui/vite.shared.mjs",
        "web/build.mjs",
    )

    for relative_path in active_paths:
        source = (REPO_ROOT / relative_path).read_text(encoding="utf-8")
        assert "JUCE_PATH" not in source, relative_path
        assert "CMAJOR_SOURCE_PATH" not in source, relative_path
        assert "git clone" not in source, relative_path
        assert "juce-framework/JUCE" not in source, relative_path


@pytest.mark.parametrize(
    "declaration",
    (
        "CPMAddPackage(NAME alternate GIT_REPOSITORY https://example.invalid/alternate.git GIT_TAG deadbeef)",
        "cpmaddpackage(NAME alternate GIT_REPOSITORY https://example.invalid/alternate.git GIT_TAG deadbeef)",
    ),
    ids=("extra-declaration", "lowercase-extra-declaration"),
)
def test_canonical_dependency_authority_rejects_extra_package_declarations(
    declaration: str,
) -> None:
    canonical_source = (
        REPO_ROOT / "cmake/dependencies/CMakeLists.txt"
    ).read_text(encoding="utf-8")

    violations = _dependency_declaration_violations(
        "cmake/dependencies/CMakeLists.txt",
        f"{canonical_source}\n{declaration}\n",
    )

    assert violations


def test_repository_has_no_retired_dependency_provider_or_active_alternate_path() -> None:
    tracked = subprocess.run(
        ["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
        cwd=REPO_ROOT,
        check=True,
        capture_output=True,
    ).stdout.split(b"\0")
    exemptions = {
        "BUILDER_KIT_CPM_DEPENDENCY_MIGRATION.md",
        "TODOS.txt",
        "tests/test_cpm_dependency_resolver.py",
    }
    source_override_exemptions = {
        "cmake/dependencies/CMakeLists.txt",
        "scripts/resolve_build_dependencies.py",
    }
    locked_authorities = tuple(
        value
        for key, value in LOCK_VALUES.items()
        if key.endswith(("_COMMIT", "_REPOSITORY"))
    )
    forbidden_literals = (
        "ensure_cmajor_runtime.py",
        "CMAJOR_SOURCE_PATH",
        "COSIMO_CMAJOR_RUNTIME_DIR",
        "JUCE_PATH",
        "build/deps",
        "cmajor-source-",
        "androidStern/choc",
        "cmajor-lang/cmajor.git",
    )
    violations: list[str] = []

    for encoded_path in tracked:
        if not encoded_path:
            continue
        relative_path = encoded_path.decode("utf-8")
        if relative_path in exemptions:
            continue
        path = REPO_ROOT / relative_path
        if not path.is_file() or path.is_symlink():
            continue
        try:
            source = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        for literal in forbidden_literals:
            if literal in source:
                violations.append(f"{relative_path}: {literal}")
        for authority in locked_authorities:
            if authority in source and relative_path != "cmake/dependencies.lock.cmake":
                violations.append(f"{relative_path}: duplicate locked identity")
        if re.search(r'["\x27]build["\x27]\s*,\s*["\x27]deps["\x27]', source):
            violations.append(f"{relative_path}: constructed build/deps")
        if re.search(
            r"git\s+(?:-c\s+\S+\s+)*clone[^\n]*(?:cmajor|choc|JUCE|juce)",
            source,
        ):
            violations.append(f"{relative_path}: direct dependency clone")
        if re.search(
            r'["\x27]git["\x27]\s*,\s*(?:\[\s*)?["\x27]clone["\x27]',
            source,
        ):
            violations.append(f"{relative_path}: tokenized dependency clone")
        violations.extend(_dependency_declaration_violations(relative_path, source))
        if (
            relative_path not in source_override_exemptions
            and re.search(
                r"\b(?:FETCHCONTENT_SOURCE_DIR_[A-Z0-9_]+|CPM_[A-Za-z0-9_]+_SOURCE)\b",
                source,
            )
        ):
            violations.append(f"{relative_path}: dependency source substitution")

    assert not (REPO_ROOT / "scripts/ensure_cmajor_runtime.py").exists()
    assert not (REPO_ROOT / "tests/test_ensure_cmajor_runtime.py").exists()
    assert not (REPO_ROOT / "tools/enhancer_wrapper_prototype/run.py").exists()
    package_scripts = json.loads(
        (REPO_ROOT / "package.json").read_text(encoding="utf-8")
    )["scripts"]
    assert "prototype:enhancer-wrapper" not in package_scripts
    assert "prototype:enhancer-deemphasis" not in package_scripts
    de_emphasis = (
        REPO_ROOT / "tools/enhancer_wrapper_prototype/de_emphasis.py"
    ).read_text(encoding="utf-8")
    assert "import run as wrapper" not in de_emphasis
    assert "wrapper.ensure_juce" not in de_emphasis
    assert not violations, "\n".join(violations)


def test_dependency_cmake_minimum_is_consistent_across_all_callers() -> None:
    cmake_projects = (
        "cmake/dependencies/CMakeLists.txt",
        "ios_auv3/CMakeLists.txt",
        "tools/cmajor_external_codegen/CMakeLists.txt",
        "tools/cmajplugin_build/CMakeLists.txt",
        "tools/desktop_native/CMakeLists.txt",
    )
    for relative_path in cmake_projects:
        first_line = (REPO_ROOT / relative_path).read_text(encoding="utf-8").splitlines()[0]
        assert first_line == "cmake_minimum_required(VERSION 3.22)", relative_path


def test_quickjs_linux_runtime_build_is_keyed_by_locked_source_identity() -> None:
    source = (
        REPO_ROOT / "tests/native/run_bounce_quickjs_driver_probe.sh"
    ).read_text(encoding="utf-8")
    assert 'runtime_source_key="${cmajor_source_path##*/}"' in source
    assert 'runtime_build_dir="$runtime_build_root/$runtime_source_key"' in source
    assert "CMAKE_HOME_DIRECTORY:INTERNAL=" in source


def test_codespace_keeps_the_pinned_cmajor_cli_source_build_recipe() -> None:
    source = (REPO_ROOT / "docs/BOUNCE_CODESPACE_SETUP.md").read_text(encoding="utf-8")
    assert "scripts/resolve_build_dependencies.py --path cmajor" in source
    assert 'cmajor_source_key="${cmajor_source##*/}"' in source
    assert 'cmajor_cli_build_dir="build/cmajor-cli-linux/$cmajor_source_key"' in source
    assert 'cmake -S "$cmajor_source" -B "$cmajor_cli_build_dir"' in source
    assert 'cmake --build "$cmajor_cli_build_dir" --target cmaj -j 1' in source
    assert '"$cmajor_cli_build_dir/tools/command/cmaj" version' in source
    assert '-B build/cmajor-cli-linux' not in source
    assert "--target cmaj -j 1" in source
    assert "Cmajor Version: 1.0.3066" in source


def test_audio_worklet_fixture_uses_portable_node_mode_changes() -> None:
    source = (
        REPO_ROOT / "tests/test_web_renderer_audio_worklet.mjs"
    ).read_text(encoding="utf-8")
    assert "await fs.chmod(" in source
    assert 'run("chmod"' not in source
