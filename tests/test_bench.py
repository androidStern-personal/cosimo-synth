import importlib.util
from pathlib import Path
import numpy as np
from numpy.testing import assert_allclose, assert_array_equal
import pytest
from scipy.io import wavfile
from typing import Callable

import bench
from bench import (
    FixtureBank,
    Recipe,
    BRIGHT_HARMONIC_COUNT,
    BRIGHT_PHASE_SEED,
    DEFAULT_FIXTURE_PEAK,
    DEFAULT_SAMPLE_RATE,
    DUMP_ENV_VAR,
    FIXTURE_BUILDERS,
    RECIPE_BUILDERS,
    SAMPLES_PER_FRAME,
    ReferenceTableProbe,
    ZeroProbe,
    dominant_bin_hz,
    dump_render_artifacts,
    is_finite,
    make_blend2_bank,
    make_blend_midpoint_recipe,
    make_bright_bank,
    make_edge_bank,
    make_frame_sweep_recipe,
    make_pitch_sweep_recipe,
    make_saw_bank,
    make_silence_recipe,
    make_sine_bank,
    make_square_bank,
    make_static_tone_recipe,
    make_sweep4_bank,
    make_zero_bank,
    maybe_write_spectrogram,
    maybe_write_wav,
    peak_abs,
    render_case,
    residual_db_excluding_bin,
    rms,
)

EXPECTED_FRAME_COUNTS = {
    "zero_bank": 1,
    "sine_bank": 1,
    "saw_bank": 1,
    "square_bank": 1,
    "bright_bank": 1,
    "edge_bank": 1,
    "blend2_bank": 2,
    "sweep4_bank": 4,
}

CONTRACT_PROBE_FACTORIES: dict[str, Callable[[], object]] = {
    # Add future probes here, e.g. "cmajor_oscillator": CmajorOscillatorProbe
    "reference_table": ReferenceTableProbe,
}


def _expected_normalized(frame: np.ndarray) -> np.ndarray:
    peak = np.max(np.abs(frame), initial=0.0)
    if peak == 0.0:
        return frame.astype(np.float32)
    return (frame * (DEFAULT_FIXTURE_PEAK / peak)).astype(np.float32)


def _expected_sine_frame() -> np.ndarray:
    positions = np.arange(SAMPLES_PER_FRAME, dtype=np.float64) / SAMPLES_PER_FRAME
    return _expected_normalized(np.sin(2.0 * np.pi * positions))


def _expected_saw_frame() -> np.ndarray:
    return _expected_normalized(
        np.linspace(-1.0, 1.0, num=SAMPLES_PER_FRAME, endpoint=False, dtype=np.float64)
    )


def _expected_square_frame() -> np.ndarray:
    indices = np.arange(SAMPLES_PER_FRAME, dtype=np.int64)
    raw = np.where(indices < SAMPLES_PER_FRAME // 2, 1.0, -1.0).astype(np.float64)
    return _expected_normalized(raw)


def _bright_harmonic_magnitudes(frame: np.ndarray) -> np.ndarray:
    spectrum = np.abs(np.fft.rfft(frame.astype(np.float64)))
    return spectrum[1:]


def _assert_with_optional_artifacts(
    case_name: str,
    sample_rate: int,
    renders: dict[str, np.ndarray],
    assertion: Callable[[], None],
) -> None:
    try:
        assertion()
    except AssertionError:
        dump_render_artifacts(case_name, sample_rate, renders, enabled=True)
        raise

    dump_render_artifacts(case_name, sample_rate, renders)


@pytest.mark.parametrize("name,builder", FIXTURE_BUILDERS.items())
def test_fixture_bank_shape_and_normalization(name: str, builder) -> None:
    bank = builder()

    assert bank.name == name
    assert bank.frames.dtype == np.float32
    assert bank.frames.shape == (EXPECTED_FRAME_COUNTS[name], SAMPLES_PER_FRAME)
    assert bank.num_frames == EXPECTED_FRAME_COUNTS[name]
    assert bank.samples_per_frame == SAMPLES_PER_FRAME
    assert np.isfinite(bank.frames).all()

    per_frame_peak = np.max(np.abs(bank.frames), axis=1)

    if name == "zero_bank":
        assert_array_equal(per_frame_peak, np.zeros_like(per_frame_peak))
    else:
        assert_allclose(
            per_frame_peak,
            np.full(EXPECTED_FRAME_COUNTS[name], DEFAULT_FIXTURE_PEAK, dtype=np.float32),
            atol=1e-6,
            rtol=0.0,
        )


def test_basic_fixture_content_matches_expected_shapes() -> None:
    zero = make_zero_bank().frames[0]
    sine = make_sine_bank().frames[0]
    saw = make_saw_bank().frames[0]
    square = make_square_bank().frames[0]

    assert_array_equal(zero, np.zeros(SAMPLES_PER_FRAME, dtype=np.float32))

    quarter = SAMPLES_PER_FRAME // 4
    half = SAMPLES_PER_FRAME // 2
    three_quarter = 3 * SAMPLES_PER_FRAME // 4
    assert sine[0] == pytest.approx(0.0, abs=1e-7)
    assert sine[quarter] == pytest.approx(DEFAULT_FIXTURE_PEAK, abs=1e-6)
    assert sine[half] == pytest.approx(0.0, abs=1e-6)
    assert sine[three_quarter] == pytest.approx(-DEFAULT_FIXTURE_PEAK, abs=1e-6)

    assert saw[0] == pytest.approx(-DEFAULT_FIXTURE_PEAK, abs=1e-6)
    assert saw[-1] > 0.98
    assert np.all(np.diff(saw) > 0.0)

    assert np.all(square[:half] == pytest.approx(DEFAULT_FIXTURE_PEAK, abs=1e-6))
    assert np.all(square[half:] == pytest.approx(-DEFAULT_FIXTURE_PEAK, abs=1e-6))


def test_bright_bank_has_expected_harmonic_span() -> None:
    bright = make_bright_bank().frames[0]
    harmonic_magnitudes = _bright_harmonic_magnitudes(bright)
    fundamental = harmonic_magnitudes[0]
    first_32 = harmonic_magnitudes[:BRIGHT_HARMONIC_COUNT]
    after_32 = harmonic_magnitudes[BRIGHT_HARMONIC_COUNT:]

    assert BRIGHT_PHASE_SEED == 1729
    assert fundamental > 0.0
    assert np.all(first_32 > fundamental * 0.025)
    assert np.max(after_32) < fundamental * 1e-4


@pytest.mark.parametrize("name,builder", FIXTURE_BUILDERS.items())
def test_fixture_generation_is_deterministic(name: str, builder) -> None:
    first = builder()
    second = builder()

    assert first.name == second.name == name
    assert_array_equal(first.frames, second.frames)


def test_multiframe_banks_use_the_expected_frames() -> None:
    blend2_bank = make_blend2_bank()
    sweep4_bank = make_sweep4_bank()

    expected_sine = _expected_sine_frame()
    expected_saw = _expected_saw_frame()
    expected_square = _expected_square_frame()

    assert_allclose(blend2_bank.frames[0], expected_sine, atol=1e-6, rtol=0.0)
    assert_allclose(blend2_bank.frames[1], expected_square, atol=1e-6, rtol=0.0)
    assert_allclose(sweep4_bank.frames[0], expected_sine, atol=1e-6, rtol=0.0)
    assert_allclose(sweep4_bank.frames[1], expected_saw, atol=1e-6, rtol=0.0)
    assert_allclose(sweep4_bank.frames[2], expected_square, atol=1e-6, rtol=0.0)
    assert np.max(_bright_harmonic_magnitudes(sweep4_bank.frames[3])[BRIGHT_HARMONIC_COUNT:]) < 1e-4


@pytest.mark.parametrize("name,builder", RECIPE_BUILDERS.items())
def test_recipe_generation_is_deterministic(name: str, builder) -> None:
    first = builder()
    second = builder()

    assert first.name == second.name
    assert first.sample_rate == second.sample_rate == DEFAULT_SAMPLE_RATE
    assert first.num_samples == second.num_samples
    assert_array_equal(first.freq_hz_curve, second.freq_hz_curve)
    assert_array_equal(first.frame_pos_curve, second.frame_pos_curve)


def test_silence_recipe_shape_and_values() -> None:
    recipe = make_silence_recipe()

    assert recipe.num_samples == DEFAULT_SAMPLE_RATE
    assert recipe.freq_hz_curve.shape == (DEFAULT_SAMPLE_RATE,)
    assert recipe.frame_pos_curve.shape == (DEFAULT_SAMPLE_RATE,)
    assert_array_equal(recipe.freq_hz_curve, np.full(DEFAULT_SAMPLE_RATE, 441.0))
    assert_array_equal(recipe.frame_pos_curve, np.zeros(DEFAULT_SAMPLE_RATE))


def test_static_tone_recipe_shape_and_values() -> None:
    recipe = make_static_tone_recipe(
        name="custom_static",
        frequency_hz=880.0,
        frame_position=0.25,
        start_phase=0.125,
    )

    assert recipe.name == "custom_static"
    assert recipe.num_samples == DEFAULT_SAMPLE_RATE
    assert_array_equal(recipe.freq_hz_curve, np.full(DEFAULT_SAMPLE_RATE, 880.0))
    assert_array_equal(recipe.frame_pos_curve, np.full(DEFAULT_SAMPLE_RATE, 0.25))
    assert recipe.start_phase == pytest.approx(0.125, abs=0.0)


def test_pitch_sweep_recipe_is_monotonic_with_exact_endpoints() -> None:
    recipe = make_pitch_sweep_recipe()

    assert recipe.num_samples == 2 * DEFAULT_SAMPLE_RATE
    assert recipe.freq_hz_curve[0] == pytest.approx(55.0, abs=1e-12)
    assert recipe.freq_hz_curve[-1] == pytest.approx(7040.0, abs=1e-9)
    assert np.all(np.diff(recipe.freq_hz_curve) > 0.0)
    assert_array_equal(recipe.frame_pos_curve, np.zeros(recipe.num_samples))


def test_frame_sweep_recipe_is_monotonic_with_exact_endpoints() -> None:
    recipe = make_frame_sweep_recipe()

    assert recipe.num_samples == 2 * DEFAULT_SAMPLE_RATE
    assert recipe.freq_hz_curve[0] == pytest.approx(220.0, abs=1e-12)
    assert recipe.freq_hz_curve[-1] == pytest.approx(220.0, abs=1e-12)
    assert recipe.frame_pos_curve[0] == pytest.approx(0.0, abs=1e-12)
    assert recipe.frame_pos_curve[-1] == pytest.approx(1.0, abs=1e-12)
    assert np.all(np.diff(recipe.frame_pos_curve) >= 0.0)


def test_edge_bank_is_mean_removed() -> None:
    bank = make_edge_bank()
    frame = bank.frames[0].astype(np.float64)

    assert abs(frame.mean()) <= 1e-9
    assert frame[0] > 0.0
    assert peak_abs(frame) == pytest.approx(DEFAULT_FIXTURE_PEAK, abs=1e-6)


def test_fixture_bank_rejects_wrong_shape() -> None:
    with pytest.raises(ValueError, match="2-D array"):
        FixtureBank(name="bad", frames=np.zeros(SAMPLES_PER_FRAME, dtype=np.float32))

    with pytest.raises(ValueError, match="2048"):
        FixtureBank(name="bad", frames=np.zeros((1, SAMPLES_PER_FRAME - 1), dtype=np.float32))


def test_recipe_rejects_invalid_values() -> None:
    with pytest.raises(ValueError, match="above 0 Hz"):
        Recipe(
            name="bad_freq",
            sample_rate=DEFAULT_SAMPLE_RATE,
            num_samples=4,
            freq_hz_curve=np.array([441.0, 0.0, 441.0, 441.0]),
            frame_pos_curve=np.zeros(4),
        )

    with pytest.raises(ValueError, match="range \\[0, 1\\]"):
        Recipe(
            name="bad_frame_pos",
            sample_rate=DEFAULT_SAMPLE_RATE,
            num_samples=4,
            freq_hz_curve=np.full(4, 441.0),
            frame_pos_curve=np.array([0.0, 0.5, 1.1, 0.0]),
        )


def test_render_case_rejects_wrong_output_shape() -> None:
    class BadProbe:
        def render(self, bank, recipe):  # noqa: ANN001, ANN201
            return np.zeros(recipe.num_samples - 1, dtype=np.float32)

    with pytest.raises(ValueError, match="expected"):
        render_case(BadProbe(), make_sine_bank(), make_static_tone_recipe())


def test_dump_requested_respects_env_var(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv(DUMP_ENV_VAR, raising=False)
    assert bench.dump_requested() is False

    monkeypatch.setenv(DUMP_ENV_VAR, "1")
    assert bench.dump_requested() is True

    monkeypatch.setenv(DUMP_ENV_VAR, "false")
    assert bench.dump_requested() is False


def test_maybe_write_wav_respects_enabled_flag(tmp_path: Path) -> None:
    wav_path = tmp_path / "tone.wav"
    audio = make_sine_bank().frames[0][:512]

    assert maybe_write_wav(wav_path, DEFAULT_SAMPLE_RATE, audio, enabled=False) is None
    assert not wav_path.exists()

    written = maybe_write_wav(wav_path, DEFAULT_SAMPLE_RATE, audio, enabled=True)

    assert written == wav_path
    assert wav_path.exists()
    assert wav_path.stat().st_size > 0

    sample_rate, written_audio = wavfile.read(wav_path)
    assert sample_rate == DEFAULT_SAMPLE_RATE
    assert written_audio.shape == audio.shape


def test_maybe_write_spectrogram_skips_short_audio(tmp_path: Path) -> None:
    spectrogram_path = tmp_path / "short.png"
    audio = make_sine_bank().frames[0][:128]

    written = maybe_write_spectrogram(
        spectrogram_path,
        DEFAULT_SAMPLE_RATE,
        audio,
        enabled=True,
    )

    assert written is None
    assert not spectrogram_path.exists()


def test_dump_render_artifacts_writes_expected_files(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    artifact_root = tmp_path / "artifacts"
    audio = make_sine_bank().frames[0][:1024]

    monkeypatch.setattr(bench, "ARTIFACTS_DIR", artifact_root)
    written = dump_render_artifacts(
        "case",
        DEFAULT_SAMPLE_RATE,
        {"tone": audio},
        enabled=True,
    )

    written_names = {path.name for path in written}
    assert "tone.wav" in written_names
    assert (artifact_root / "case" / "tone.wav").exists()

    if importlib.util.find_spec("matplotlib") is None:
        assert written_names == {"tone.wav"}
    else:
        assert "tone_spectrogram.png" in written_names
        assert (artifact_root / "case" / "tone_spectrogram.png").exists()


def test_dump_render_artifacts_skips_files_when_disabled(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    artifact_root = tmp_path / "artifacts"
    audio = make_sine_bank().frames[0][:1024]

    monkeypatch.setattr(bench, "ARTIFACTS_DIR", artifact_root)
    written = dump_render_artifacts(
        "case",
        DEFAULT_SAMPLE_RATE,
        {"tone": audio},
        enabled=False,
    )

    assert written == []
    assert not (artifact_root / "case").exists()


def test_zero_probe_silence() -> None:
    bank = make_bright_bank()
    recipe = make_static_tone_recipe(name="zero_probe_reference")
    audio = render_case(ZeroProbe(), bank, recipe)

    def assertion() -> None:
        assert is_finite(audio)
        assert peak_abs(audio) == pytest.approx(0.0, abs=0.0)
        assert rms(audio) == pytest.approx(0.0, abs=0.0)

    _assert_with_optional_artifacts(
        "test_zero_probe_silence",
        recipe.sample_rate,
        {"zero_probe": audio},
        assertion,
    )


@pytest.mark.parametrize(
    ("probe_name", "probe_factory"),
    CONTRACT_PROBE_FACTORIES.items(),
    ids=CONTRACT_PROBE_FACTORIES.keys(),
)
def test_probe_silence_is_silent(probe_name: str, probe_factory: Callable[[], object]) -> None:
    probe = probe_factory()
    bank = make_zero_bank()
    recipe = make_silence_recipe()
    audio = render_case(probe, bank, recipe)

    def assertion() -> None:
        assert is_finite(audio)
        assert peak_abs(audio) <= 1e-8
        assert rms(audio) <= 1e-8

    _assert_with_optional_artifacts(
        f"test_{probe_name}_probe_silence_is_silent",
        recipe.sample_rate,
        {"silence": audio},
        assertion,
    )


@pytest.mark.parametrize(
    ("probe_name", "probe_factory"),
    CONTRACT_PROBE_FACTORIES.items(),
    ids=CONTRACT_PROBE_FACTORIES.keys(),
)
def test_probe_sine_has_correct_peak(
    probe_name: str,
    probe_factory: Callable[[], object],
) -> None:
    probe = probe_factory()
    bank = make_sine_bank()
    recipe = make_static_tone_recipe(name="sine_static")
    audio = render_case(probe, bank, recipe)

    def assertion() -> None:
        assert is_finite(audio)
        assert peak_abs(audio) <= 1.0
        assert dominant_bin_hz(audio, recipe.sample_rate) == pytest.approx(441.0, abs=0.5)
        assert residual_db_excluding_bin(audio, recipe.sample_rate, 441.0) <= -35.0

    _assert_with_optional_artifacts(
        f"test_{probe_name}_probe_sine_has_correct_peak",
        recipe.sample_rate,
        {"sine_static": audio},
        assertion,
    )


@pytest.mark.parametrize(
    ("probe_name", "probe_factory"),
    CONTRACT_PROBE_FACTORIES.items(),
    ids=CONTRACT_PROBE_FACTORIES.keys(),
)
def test_probe_tracks_static_pitch(
    probe_name: str,
    probe_factory: Callable[[], object],
) -> None:
    probe = probe_factory()
    bank = make_sine_bank()
    low_recipe = make_static_tone_recipe(name="low_static", frequency_hz=220.0)
    high_recipe = make_static_tone_recipe(name="high_static", frequency_hz=880.0)
    low = render_case(probe, bank, low_recipe)
    high = render_case(probe, bank, high_recipe)

    def assertion() -> None:
        assert dominant_bin_hz(low, low_recipe.sample_rate) == pytest.approx(220.0, abs=0.5)
        assert dominant_bin_hz(high, high_recipe.sample_rate) == pytest.approx(880.0, abs=0.5)
        assert not np.allclose(low, high)

    _assert_with_optional_artifacts(
        f"test_{probe_name}_probe_tracks_static_pitch",
        low_recipe.sample_rate,
        {"low_static": low, "high_static": high},
        assertion,
    )


@pytest.mark.parametrize(
    ("probe_name", "probe_factory"),
    CONTRACT_PROBE_FACTORIES.items(),
    ids=CONTRACT_PROBE_FACTORIES.keys(),
)
def test_probe_blend_midpoint_is_average(
    probe_name: str,
    probe_factory: Callable[[], object],
) -> None:
    probe = probe_factory()
    blend_bank = make_blend2_bank()
    lo_recipe = make_blend_midpoint_recipe(0.0)
    hi_recipe = make_blend_midpoint_recipe(1.0)
    mid_recipe = make_blend_midpoint_recipe(0.5)

    lo = render_case(probe, blend_bank, lo_recipe)
    hi = render_case(probe, blend_bank, hi_recipe)
    mid = render_case(probe, blend_bank, mid_recipe)
    sine_reference = render_case(
        probe,
        make_sine_bank(),
        make_static_tone_recipe(name="sine_reference"),
    )
    square_reference = render_case(
        probe,
        make_square_bank(),
        make_static_tone_recipe(name="square_reference"),
    )

    def assertion() -> None:
        assert is_finite(lo)
        assert is_finite(hi)
        assert is_finite(mid)
        assert_allclose(lo, sine_reference, atol=1e-6, rtol=0.0)
        assert_allclose(hi, square_reference, atol=1e-6, rtol=0.0)
        assert_allclose(mid, 0.5 * (lo + hi), atol=1e-6, rtol=1e-6)

    _assert_with_optional_artifacts(
        f"test_{probe_name}_probe_blend_midpoint_is_average",
        lo_recipe.sample_rate,
        {
            "blend_lo": lo,
            "blend_hi": hi,
            "blend_mid": mid,
        },
        assertion,
    )


@pytest.mark.reference
@pytest.mark.parametrize(
    ("probe_name", "probe_factory"),
    CONTRACT_PROBE_FACTORIES.items(),
    ids=CONTRACT_PROBE_FACTORIES.keys(),
)
@pytest.mark.parametrize(
    ("case_name", "bank_builder"),
    [
        ("pitch_sweep_saw", FIXTURE_BUILDERS["saw_bank"]),
        ("pitch_sweep_bright", FIXTURE_BUILDERS["bright_bank"]),
    ],
)
def test_probe_pitch_sweep_is_finite(
    probe_name: str,
    probe_factory: Callable[[], object],
    case_name: str,
    bank_builder,
) -> None:
    probe = probe_factory()
    bank = bank_builder()
    recipe = make_pitch_sweep_recipe()
    audio = render_case(probe, bank, recipe)

    def assertion() -> None:
        assert is_finite(audio)
        assert peak_abs(audio) <= 1.0
        assert rms(audio) > 0.05
        assert np.ptp(audio) > 0.5

    _assert_with_optional_artifacts(
        f"test_{probe_name}_{case_name}",
        recipe.sample_rate,
        {f"{probe_name}_{case_name}": audio},
        assertion,
    )


@pytest.mark.reference
@pytest.mark.parametrize(
    ("probe_name", "probe_factory"),
    CONTRACT_PROBE_FACTORIES.items(),
    ids=CONTRACT_PROBE_FACTORIES.keys(),
)
def test_probe_frame_sweep_is_finite(
    probe_name: str,
    probe_factory: Callable[[], object],
) -> None:
    probe = probe_factory()
    bank = make_sweep4_bank()
    recipe = make_frame_sweep_recipe()
    audio = render_case(probe, bank, recipe)

    def assertion() -> None:
        assert is_finite(audio)
        assert peak_abs(audio) <= 1.0
        assert rms(audio) > 0.05
        assert np.ptp(audio) > 0.5

    _assert_with_optional_artifacts(
        f"test_{probe_name}_frame_sweep_is_finite",
        recipe.sample_rate,
        {f"{probe_name}_frame_sweep": audio},
        assertion,
    )
