import os
from pathlib import Path
import subprocess


REPO_ROOT = Path(__file__).resolve().parents[1]


def test_desktop_and_iphone_share_the_one_native_renderer_adapter() -> None:
    provider = (REPO_ROOT / "native/three_oscillator_renderer/RendererExternalFunctionProvider.h").read_text()
    desktop_source = (REPO_ROOT / "tools/desktop_native/Source/cmaj_PatchLoaderPlugin.cpp").read_text()
    desktop_cmake = (REPO_ROOT / "tools/desktop_native/CMakeLists.txt").read_text()
    ios_main = (REPO_ROOT / "ios_auv3/Source/CosimoPluginMain.cpp").read_text()
    ios_cmake = (REPO_ROOT / "ios_auv3/CMakeLists.txt").read_text()
    codegen = (REPO_ROOT / "tools/cmajor_external_codegen/main.cpp").read_text()

    assert '"CosimoThreeOscillatorRenderer::renderAll"' in provider
    assert "createExternalFunctionProvider()" in desktop_source
    assert "RendererBridge.cpp" in desktop_cmake
    assert "WarpRenderer.cpp" in desktop_cmake

    assert "CosimoThreeOscillatorRenderer__renderAll" in ios_main
    assert "renderAllGenerated" in ios_main
    assert "RendererBridge.cpp" in ios_cmake
    assert "WarpRenderer.cpp" in ios_cmake

    assert '"CosimoThreeOscillatorRenderer::renderAll"' not in codegen
    assert "matchesExternalFunction" in codegen


def test_ios_generation_uses_provider_aware_codegen_at_128_frames() -> None:
    generator = (REPO_ROOT / "scripts/generate_ios_auv3_plugin.sh").read_text()
    codegen = (REPO_ROOT / "tools/cmajor_external_codegen/main.cpp").read_text()

    assert "generate_cmajor_cpp_with_externals.sh" in generator
    assert "--max-frames-per-block" in generator
    assert 'setMaxBlockSize (maxFramesPerBlock)' in codegen


def test_external_codegen_builds_a_host_tool_when_called_from_an_ios_build(tmp_path: Path) -> None:
    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    cmake_log = tmp_path / "cmake.log"
    fake_cmake = fake_bin / "cmake"
    fake_cmake.write_text(
        """#!/usr/bin/env bash
set -euo pipefail
printf 'SDKROOT=%s PLATFORM_NAME=%s EFFECTIVE_PLATFORM_NAME=%s ARCHS=%s ARGS=%s\\n' \\
  "${SDKROOT-<unset>}" "${PLATFORM_NAME-<unset>}" \\
  "${EFFECTIVE_PLATFORM_NAME-<unset>}" "${ARCHS-<unset>}" "$*" \\
  >> "$COSIMO_HOST_CMAKE_LOG"

build_dir=""
while (( $# > 0 )); do
  if [[ "$1" == "-B" ]]; then
    build_dir="$2"
    break
  fi
  shift
done

if [[ -n "$build_dir" ]]; then
  mkdir -p "$build_dir"
  printf '%s\\n' \\
    '#!/usr/bin/env bash' \\
    'set -euo pipefail' \\
    'printf "// generated host performer\\n" > "$2"' \\
    > "$build_dir/cosimo_cmajor_external_codegen"
  chmod +x "$build_dir/cosimo_cmajor_external_codegen"
fi
""",
        encoding="utf-8",
    )
    fake_cmake.chmod(0o755)

    patch = tmp_path / "fixture.cmajorpatch"
    patch.write_text("{}\n", encoding="utf-8")
    output = tmp_path / "Generated.cpp"
    cmajor_source = tmp_path / "cmajor"
    cmajor_source.mkdir()

    environment = os.environ.copy()
    environment.update(
        {
            "PATH": f"{fake_bin}:{environment['PATH']}",
            "CMAJOR_SOURCE_PATH": str(cmajor_source),
            "COSIMO_CMAJOR_EXTERNAL_CODEGEN_BUILD_DIR": str(tmp_path / "host-build"),
            "COSIMO_HOST_CMAKE_LOG": str(cmake_log),
            "SDKROOT": "/fake/iPhoneSimulator.sdk",
            "PLATFORM_NAME": "iphonesimulator",
            "EFFECTIVE_PLATFORM_NAME": "-iphonesimulator",
            "ARCHS": "arm64",
        }
    )

    subprocess.run(
        [
            str(REPO_ROOT / "scripts/generate_cmajor_cpp_with_externals.sh"),
            str(patch),
            str(output),
            "Fixture",
        ],
        cwd=REPO_ROOT,
        env=environment,
        check=True,
        capture_output=True,
        text=True,
    )

    calls = cmake_log.read_text(encoding="utf-8")
    assert "SDKROOT=<unset>" in calls
    assert "PLATFORM_NAME=<unset>" in calls
    assert "EFFECTIVE_PLATFORM_NAME=<unset>" in calls
    assert "ARCHS=<unset>" in calls
    assert "-DCMAKE_OSX_SYSROOT=macosx" in calls
    assert output.read_text(encoding="utf-8") == "// generated host performer\n"
