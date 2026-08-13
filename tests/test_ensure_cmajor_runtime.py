from __future__ import annotations

import ast
from pathlib import Path

import pytest

from scripts import ensure_cmajor_runtime


SCRIPT_PATH = Path(ensure_cmajor_runtime.__file__).resolve()


def test_replace_unique_anchor_replaces_one_match() -> None:
    result = ensure_cmajor_runtime._replace_unique_anchor(
        "before ANCHOR after",
        "ANCHOR",
        "PATCHED",
        label="test patch",
        path=Path("dependency.h"),
    )

    assert result == "before PATCHED after"


@pytest.mark.parametrize(
    ("source", "expected_count"),
    [
        ("no match", 0),
        ("ANCHOR then ANCHOR", 2),
    ],
)
def test_replace_unique_anchor_rejects_missing_or_ambiguous_matches(
    source: str,
    expected_count: int,
) -> None:
    with pytest.raises(
        RuntimeError,
        match=rf"test patch.*expected exactly one anchor.*found {expected_count}",
    ):
        ensure_cmajor_runtime._replace_unique_anchor(
            source,
            "ANCHOR",
            "PATCHED",
            label="test patch",
            path=Path("dependency.h"),
        )


def test_all_dependency_source_replacements_use_the_unique_anchor_guard() -> None:
    source = SCRIPT_PATH.read_text(encoding="utf-8")
    tree = ast.parse(source)
    helper = next(
        node
        for node in tree.body
        if isinstance(node, ast.FunctionDef) and node.name == "_replace_unique_anchor"
    )
    replace_call_lines = [
        node.lineno
        for node in ast.walk(tree)
        if isinstance(node, ast.Call)
        and isinstance(node.func, ast.Attribute)
        and node.func.attr == "replace"
    ]

    assert replace_call_lines
    assert all(helper.lineno <= line <= helper.end_lineno for line in replace_call_lines)


def test_patch_worker_detaches_before_destroying_its_members(tmp_path: Path) -> None:
    patch_header = tmp_path / "include" / "cmajor" / "helpers" / "cmaj_Patch.h"
    patch_header.parent.mkdir(parents=True)
    patch_header.write_text(
        """    ~PatchWorker() override
    {
        initCallback.reset();
        sendMessageCallback.reset();
        setErrorCallback.reset();
        context = {};
    }
""",
        encoding="utf-8",
    )

    ensure_cmajor_runtime._apply_cmajor_patch_worker_lifetime_patch(tmp_path)
    ensure_cmajor_runtime._apply_cmajor_patch_worker_lifetime_patch(tmp_path)

    patched = patch_header.read_text(encoding="utf-8")
    assert ensure_cmajor_runtime.CMAJOR_PATCH_WORKER_LIFETIME_PATCH_MARKER in patched
    assert patched.index("setActive (false);") < patched.index("initCallback.reset();")


def test_external_function_provider_is_forwarded_without_replacing_runtime_policy(
    tmp_path: Path,
) -> None:
    patch_header = tmp_path / "include" / "cmajor" / "helpers" / "cmaj_Patch.h"
    patch_header.parent.mkdir(parents=True)
    patch_header.write_text(
        """    std::function<cmaj::Engine()> createEngine;

        if (engine.load (errors, program,
                         shouldResolveExternals ? manifest.createExternalResolverFunction()
                                                : [] (const cmaj::ExternalVariable&) -> choc::value::Value { return {}; },
                         {}))
""",
        encoding="utf-8",
    )

    ensure_cmajor_runtime._apply_cmajor_external_function_provider_patch(tmp_path)
    ensure_cmajor_runtime._apply_cmajor_external_function_provider_patch(tmp_path)

    patched = patch_header.read_text(encoding="utf-8")
    assert patched.count(ensure_cmajor_runtime.CMAJOR_EXTERNAL_FUNCTION_PROVIDER_PATCH_MARKER) == 1
    assert "cmaj::Engine::ExternalFunctionProviderFn externalFunctionProvider;" in patched
    assert "patch.externalFunctionProvider))" in patched
    assert "shouldResolveExternals ? manifest.createExternalResolverFunction()" in patched


def test_runtime_authority_keeps_pins_and_every_required_safety_patch() -> None:
    assert ensure_cmajor_runtime.RUNTIME_TAG == "1.0.3066"
    assert (
        ensure_cmajor_runtime.RUNTIME_COMMIT
        == "172db53232337154d5a1c0f9a448318129dfacd9"
    )
    assert (
        ensure_cmajor_runtime.PATCHED_CHOC_COMMIT
        == "e50b21a272a1729bc1dd1fd368c112095cb18d5a"
    )
    assert ensure_cmajor_runtime.PATCHED_CHOC_MARKERS == (
        "chocHostKeyboard",
        "__chocHostKeyboardBridgeInstalled",
        "__chocUserFiles",
        "chocUserFiles",
        "COSIMO_HOST_KEYBOARD_RELAY_PROCESS_NAME",
        "cosimo-standalone-keyboard",
        "hostKeyboardShouldRelayToPlugin",
    )
    assert {
        ensure_cmajor_runtime.CMAJOR_PATCH_WORKER_LIFETIME_PATCH_MARKER,
        ensure_cmajor_runtime.CMAJOR_PATCH_WORKER_QUEUE_PATCH_MARKER,
        ensure_cmajor_runtime.CMAJOR_PATCH_WORKER_NONFATAL_ERROR_PATCH_MARKER,
        ensure_cmajor_runtime.CMAJOR_STORED_STATE_STRING_COMPARISON_PATCH_MARKER,
        ensure_cmajor_runtime.CHOC_QUICKJS_PENDING_JOB_PATCH_MARKER,
        ensure_cmajor_runtime.CHOC_TIMER_CLEAR_TIMEOUT_PATCH_MARKER,
        ensure_cmajor_runtime.CMAJOR_QUICKJS_RESOURCE_BRIDGE_PATCH_MARKER,
        ensure_cmajor_runtime.CMAJOR_JUCE_SIDECHAIN_PATCH_MARKER,
    } == {
        "COSIMO_CMAJOR_PATCH_WORKER_EARLY_DETACH",
        "COSIMO_CMAJOR_PATCH_WORKER_REENTRANT_QUEUE",
        "COSIMO_CMAJOR_PATCH_WORKER_NONFATAL_ERROR",
        "COSIMO_CMAJOR_STORED_STATE_STRING_CONTENT_COMPARISON",
        "COSIMO_CHOC_QUICKJS_DRAIN_PENDING_JOBS",
        "COSIMO_CHOC_TIMER_CLEAR_TIMEOUT",
        "COSIMO_CMAJOR_QUICKJS_RESOURCE_BRIDGE",
        "COSIMO_CMAJOR_JUCE_PLUGIN_SPLIT_INPUT_BUSES",
    }
    assert (
        ensure_cmajor_runtime.CMAJOR_EXTERNAL_FUNCTION_PROVIDER_PATCH_MARKER
        == "COSIMO_CMAJOR_PATCH_EXTERNAL_FUNCTION_PROVIDER"
    )

    source = SCRIPT_PATH.read_text(encoding="utf-8")
    tree = ast.parse(source)
    functions = {
        node.name: node
        for node in tree.body
        if isinstance(node, ast.FunctionDef)
    }

    def called_functions(function_name: str) -> set[str]:
        return {
            node.func.id
            for node in ast.walk(functions[function_name])
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Name)
        }

    required_apply_helpers = {
        "_apply_cosimo_choc_keyboard_relay_patch",
        "_apply_choc_quickjs_pending_job_patch",
        "_apply_choc_timer_clear_timeout_patch",
        "_apply_cmajor_patch_worker_queue_patch",
        "_apply_cmajor_patch_worker_lifetime_patch",
        "_apply_cmajor_patch_worker_nonfatal_error_patch",
        "_apply_cmajor_stored_state_string_comparison_patch",
        "_apply_cmajor_quickjs_resource_bridge_patch",
        "_apply_cmajor_external_function_provider_patch",
    }
    assert required_apply_helpers <= called_functions("_prepare_runtime_submodules")
    assert required_apply_helpers <= called_functions("ensure_runtime")
    assert "_apply_cmajor_sidechain_bus_patch" in called_functions("ensure_runtime")

    required_validation_helpers = {
        "_runtime_contains_required_choc_patches",
        "_runtime_contains_quickjs_pending_job_patch",
        "_runtime_contains_timer_clear_timeout_patch",
        "_runtime_contains_patch_worker_queue_patch",
        "_runtime_contains_patch_worker_lifetime_patch",
        "_runtime_contains_patch_worker_nonfatal_error_patch",
        "_runtime_contains_stored_state_string_comparison_patch",
        "_runtime_contains_quickjs_resource_bridge_patch",
        "_runtime_contains_external_function_provider_patch",
    }
    assert required_validation_helpers <= called_functions("_clone_runtime")
    assert required_validation_helpers <= called_functions("ensure_runtime")
    assert "_runtime_contains_required_cmajor_sidechain_patch" in called_functions(
        "ensure_runtime"
    )
