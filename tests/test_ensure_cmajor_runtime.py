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
