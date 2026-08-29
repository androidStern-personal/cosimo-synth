from __future__ import annotations

import subprocess
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
PRODUCTION_JUCE_COMMIT = "501c07674e1ad693085a7e7c398f205c2677f5da"


def test_plain_cpm_module_resolves_the_production_dependency_graph(tmp_path: Path) -> None:
    source_dir = tmp_path / "source"
    build_dir = tmp_path / "build"
    source_dir.mkdir()
    (source_dir / "CMakeLists.txt").write_text(
        f"""cmake_minimum_required(VERSION 3.16)
project(CosimoPlainCpmProbe LANGUAGES NONE)

include(\"{REPO_ROOT / 'cmake' / 'CosimoDependencies.cmake'}\")
cosimo_add_production_dependencies()

foreach(required_path
    \"${{COSIMO_CMAJOR_SOURCE_DIR}}/include/cmajor/helpers/cmaj_Patch.h\"
    \"${{COSIMO_CHOC_SOURCE_DIR}}/choc/gui/choc_WebView.h\"
    \"${{COSIMO_JUCE_SOURCE_DIR}}/CMakeLists.txt\")
    if(NOT EXISTS \"${{required_path}}\")
        message(FATAL_ERROR \"Missing resolved dependency path: ${{required_path}}\")
    endif()
endforeach()

execute_process(
    COMMAND git -C \"${{COSIMO_CMAJOR_SOURCE_DIR}}\" rev-parse HEAD
    OUTPUT_VARIABLE actual_cmajor_commit
    OUTPUT_STRIP_TRAILING_WHITESPACE
    COMMAND_ERROR_IS_FATAL ANY)
execute_process(
    COMMAND git -C \"${{COSIMO_CHOC_SOURCE_DIR}}\" rev-parse HEAD
    OUTPUT_VARIABLE actual_choc_commit
    OUTPUT_STRIP_TRAILING_WHITESPACE
    COMMAND_ERROR_IS_FATAL ANY)
execute_process(
    COMMAND git -C \"${{COSIMO_JUCE_SOURCE_DIR}}\" rev-parse HEAD
    OUTPUT_VARIABLE actual_juce_commit
    OUTPUT_STRIP_TRAILING_WHITESPACE
    COMMAND_ERROR_IS_FATAL ANY)

file(WRITE \"${{CMAKE_BINARY_DIR}}/resolved.txt\"
    \"cmajor=${{actual_cmajor_commit}}\\n\"
    \"choc=${{actual_choc_commit}}\\n\"
    \"juce=${{actual_juce_commit}}\\n\")
""",
        encoding="utf-8",
    )

    subprocess.run(
        ["cmake", "-S", str(source_dir), "-B", str(build_dir)],
        cwd=REPO_ROOT,
        check=True,
    )

    resolved = dict(
        line.split("=", 1)
        for line in (build_dir / "resolved.txt").read_text(encoding="utf-8").splitlines()
    )
    assert resolved["cmajor"] == resolved["cmajor"].lower()
    assert len(resolved["cmajor"]) == 40
    assert resolved["choc"] == resolved["choc"].lower()
    assert len(resolved["choc"]) == 40
    assert resolved["juce"] == PRODUCTION_JUCE_COMMIT
