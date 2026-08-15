from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]


def test_product_source_has_no_parallel_scalar_a_renderer_or_table_transport() -> None:
    engine_source = (REPO_ROOT / "cmajor" / "FixedFrameOscillator.cmajor").read_text(encoding="utf-8")
    synth_source = (REPO_ROOT / "cmajor" / "WavetableSynth.cmajor").read_text(encoding="utf-8")

    assert "processor FixedFrameOscillator" not in engine_source
    assert "struct WavetableLoadBegin" not in engine_source
    assert "struct WavetableMipFrame" not in engine_source
    assert "struct WavetableUploadAck" not in engine_source
    assert "struct WavetableMipRequest" not in engine_source
    assert "struct RuntimeServiceState" not in engine_source
    assert "    graph Voice\n" not in synth_source
