from __future__ import annotations

import subprocess
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
PRODUCTION_CMAKE_CALLERS = (
    "ios_auv3/CMakeLists.txt",
    "kit/tools/cmajor_runtime_build/CMakeLists.txt",
    "kit/tools/cmajor_web_runtime/CMakeLists.txt",
    "kit/tools/cmajplugin_build/CMakeLists.txt",
    "kit/tools/effect_plugin_build/CMakeLists.txt",
    "tests/native/CMakeLists.txt",
    "tools/cmajor_external_codegen/CMakeLists.txt",
    "tools/cmajor_command_build/CMakeLists.txt",
    "tools/desktop_native/CMakeLists.txt",
)
DEPENDENCY_ENTRYPOINTS = (
    "kit/cmake/CosimoDependencies.cmake",
    "kit/cmake/dependency-sources.cmake",
    "kit/fx/prod-effect.mjs",
    "kit/scripts/build_cmajplugin_vst3.sh",
    "scripts/build_desktop_native.sh",
    "scripts/generate_cmajor_cpp_with_externals.sh",
    "scripts/generate_ios_auv3_xcode_project.sh",
    "scripts/test_quickjs_modulation_restore.sh",
    "tests/helpers/desktop_harness_browser.mjs",
    "tests/helpers/live_review_server.mjs",
    "tests/native/run_bounce_quickjs_driver_probe.sh",
    "tests/native/run_three_oscillator_jit_provider.sh",
    "tests/test_desktop_native_keyboard_probe.mjs",
    "tests/test_spectral_chord_resonator_probe.py",
    "tests/test_web_renderer_audio_worklet.mjs",
    "ui/vite.shared.mjs",
    "web/build.mjs",
)


def test_production_cmake_builds_use_the_shared_dependency_module() -> None:
    for relative_path in PRODUCTION_CMAKE_CALLERS:
        source = (REPO_ROOT / relative_path).read_text(encoding="utf-8")

        assert "kit/cmake/CosimoDependencies.cmake" in source, relative_path
        assert "cosimo_add_production_dependencies()" in source, relative_path


def test_dependency_entrypoints_have_no_second_source_resolver() -> None:
    for relative_path in DEPENDENCY_ENTRYPOINTS:
        source = (REPO_ROOT / relative_path).read_text(encoding="utf-8")

        assert "ensure_cmajor_runtime" not in source, relative_path
        assert "resolve_build_dependencies" not in source, relative_path
        assert "git clone" not in source, relative_path
        assert "cmajor-lang/cmajor/releases/download" not in source, relative_path


def test_t26_runner_builds_against_research_juce_7_through_cpm() -> None:
    module = (REPO_ROOT / "kit/cmake/CosimoDependencies.cmake").read_text(encoding="utf-8")
    prototype_cmake = (
        REPO_ROOT / "tools/enhancer_wrapper_prototype/CMakeLists.txt"
    ).read_text(encoding="utf-8")
    runner = (REPO_ROOT / "tools/enhancer_wrapper_prototype/run.py").read_text(
        encoding="utf-8"
    )

    assert "cosimo_add_t26_research_juce" in module
    assert "b08520c2de1771af3dfcbfbc0e0b6b0b5eb083b0" in module
    assert "kit/cmake/CosimoDependencies.cmake" in prototype_cmake
    assert "cosimo_add_t26_research_juce()" in prototype_cmake
    assert '"cmake"' in runner
    assert '"--build"' in runner
    assert "git clone" not in runner


PRODUCTION_CMAJOR_COMMIT = "04ee24df55c4a3ba9f67d498a70c19de1aa1ad79"
PRODUCTION_CHOC_COMMIT = "98b52fb54c3b9fec03c0c13218f6557aef33eabe"
PRODUCTION_JUCE_COMMIT = "501c07674e1ad693085a7e7c398f205c2677f5da"


def test_plain_cpm_module_resolves_the_production_dependency_graph(tmp_path: Path) -> None:
    source_dir = tmp_path / "source"
    build_dir = tmp_path / "build"
    source_dir.mkdir()
    (source_dir / "CMakeLists.txt").write_text(
        f"""cmake_minimum_required(VERSION 3.16)
project(CosimoPlainCpmProbe LANGUAGES NONE)

include(\"{REPO_ROOT / 'kit' / 'cmake' / 'CosimoDependencies.cmake'}\")
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
    assert resolved["cmajor"] == PRODUCTION_CMAJOR_COMMIT
    assert resolved["choc"] == PRODUCTION_CHOC_COMMIT
    assert resolved["juce"] == PRODUCTION_JUCE_COMMIT
