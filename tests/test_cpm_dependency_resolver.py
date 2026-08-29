from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import stat
import subprocess
import sys
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


def run_resolver(cache_root: Path, *arguments: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [
            sys.executable,
            str(RESOLVER),
            "--cache-root",
            str(cache_root),
            *arguments,
        ],
        cwd=REPO_ROOT,
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
    assert "symbolic link" in failure.value.message


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
    assert str(cache_root) in str(error["message"])
    assert not (cache_root / "cosimo_cmajor").exists()
    assert not (cache_root / "cosimo_juce").exists()


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
    assert parse_error(offline_symlink)["code"] == "CACHE_INCOMPLETE"
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
        assert "Authenticate GitHub" in str(error["message"])
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
        if re.search(r'["\x27]build["\x27]\s*,\s*["\x27]deps["\x27]', source):
            violations.append(f"{relative_path}: constructed build/deps")
        if re.search(
            r"git\s+(?:-c\s+\S+\s+)*clone[^\n]*(?:cmajor|choc|JUCE|juce)",
            source,
        ):
            violations.append(f"{relative_path}: direct dependency clone")

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
