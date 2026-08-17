from pathlib import Path
import re
import subprocess


REPO_ROOT = Path(__file__).resolve().parents[1]


def _generate_wavetable_synth_cpp(output_path: Path) -> str:
    subprocess.run(
        [
            str(REPO_ROOT / "scripts/generate_cmajor_cpp_with_externals.sh"),
            str(REPO_ROOT / "WavetableSynth.cmajorpatch"),
            str(output_path),
            "CosimoCodegenPerformance",
        ],
        cwd=REPO_ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    return output_path.read_text(encoding="utf-8")


def test_mseg_audio_rate_lookup_does_not_copy_the_whole_buffer(tmp_path: Path) -> None:
    generated_cpp = tmp_path / "WavetableSynth.cpp"
    generated = _generate_wavetable_synth_cpp(generated_cpp)
    signatures = re.findall(
        r"float\s+wt__MsegReader__sampleBuffer\w*\s*\(([^)]*)\)\s*noexcept",
        generated,
    )
    assert signatures
    assert all(re.search(r"wt_MsegReader_1_State\s*&", signature) for signature in signatures)
    assert all(re.search(r"Array\s*<\s*float\s*,\s*2051\s*>", signature) is None for signature in signatures)


def test_voice_route_loop_does_not_modulo_the_flat_voice_target_table(tmp_path: Path) -> None:
    generated_cpp = tmp_path / "WavetableSynth.cpp"
    generated = _generate_wavetable_synth_cpp(generated_cpp)
    function = re.search(
        r"void\s+wt__SharedVoiceEngine__accumulateVoiceModulationTargets\s*\([^)]*\)\s*noexcept"
        r"(?P<body>.*?)"
        r"(?=\n    (?:void|bool|float|int32_t)\s+wt__SharedVoiceEngine__)",
        generated,
        re.DOTALL,
    )
    assert function is not None
    body = function.group("body")
    assert "std__intrinsics___wrap_192" not in body
    assert "voiceTargetOffsetIndex" not in body


def test_ordinary_voice_routes_execute_as_source_fanout_vectors(tmp_path: Path) -> None:
    generated_cpp = tmp_path / "WavetableSynth.cpp"
    generated = _generate_wavetable_synth_cpp(generated_cpp)
    function = re.search(
        r"void\s+wt__SharedVoiceEngine__accumulateVoiceModulationTargets\s*\([^)]*\)\s*noexcept"
        r"(?P<body>.*?)"
        r"(?=\n    (?:void|bool|float|int32_t)\s+wt__SharedVoiceEngine__)",
        generated,
        re.DOTALL,
    )
    assert function is not None
    body = function.group("body")
    assert "voiceRouteCoreScaleVectors" in body
    assert "voiceRouteCoreBiasVectors" in body
    assert "voiceArticulationRouteTransforms" in body
    assert "routeIndex >= _state.voiceRouteCount" not in body
