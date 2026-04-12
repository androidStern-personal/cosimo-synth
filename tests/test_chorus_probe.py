from __future__ import annotations

import json
from pathlib import Path
import subprocess
import tempfile

import numpy as np
import pytest
from scipy.fft import rfft, rfftfreq

from bench import (
    DEFAULT_SAMPLE_RATE,
    _render_cmajor_patch_via_generated_javascript,
    is_finite,
    peak_abs,
    rms,
)


REPO_ROOT = Path(__file__).resolve().parents[1]
CHORUS_SOURCE = REPO_ROOT / "cmajor" / "Chorus.cmajor"
CHORUS_RING_OFFSET_RATIO = 2.0 ** (7.0 / 12.0)
CHORUS_RING_OFFSET_MODE_RATIOS = {
    0: 2.0 ** (7.0 / 12.0),
    1: 2.0 ** (-5.0 / 12.0),
    2: 2.0,
    3: 0.5,
}


def _build_chorus_probe_source() -> str:
    return (
        CHORUS_SOURCE.read_text(encoding="utf-8")
        + "\n"
        + """
processor ChorusProbeSource
{
    input value float32 modeIn [[ init: 0.0f ]];
    input value float32 frequencyHzIn [[ init: 440.0f ]];
    input value float32 amplitudeIn [[ init: 0.5f ]];
    output stream float32<2> out;

    int32 frameCounter = 0;
    float32 phase = 0.0f;

    void main()
    {
        loop
        {
            let mode = int32 (std::intrinsics::floor (modeIn + 0.5f));
            let frequencyHz = std::intrinsics::clamp (frequencyHzIn, 1.0f, float32 (processor.frequency) * 0.45f);
            let amplitude = std::intrinsics::clamp (amplitudeIn, 0.0f, 1.0f);
            float32 sample = 0.0f;

            if (mode == 0)
            {
                sample = frameCounter == 0 ? amplitude : 0.0f;
            }
            else if (mode == 1)
            {
                let burstFrames = int32 (float32 (processor.frequency) * 0.040f);
                sample = frameCounter < burstFrames ? amplitude * std::intrinsics::sin (2.0f * wt::chorusPi * phase) : 0.0f;
            }
            else
            {
                sample = amplitude * std::intrinsics::sin (2.0f * wt::chorusPi * phase);
            }

            out <- float32<2> (sample, sample * 0.82f);
            phase = std::intrinsics::wrap (phase + (frequencyHz / float32 (processor.frequency)), 1.0f);
            frameCounter += 1;
            advance();
        }
    }
}

processor ConstantTrackingPitch
{
    input value float32 trackingHzIn [[ init: 110.0f ]];
    output stream float32 out;

    void main()
    {
        loop
        {
            out <- trackingHzIn;
            advance();
        }
    }
}

processor StereoProbeSplitter
{
    input stream float32<2> in;
    output stream float32 leftOut;
    output stream float32 rightOut;

    void main()
    {
        loop
        {
            leftOut <- in[0];
            rightOut <- in[1];
            advance();
        }
    }
}

graph ChorusProbe [[ main ]]
{
    input value float32 sourceMode [[ init: 2.0f ]];
    input value float32 sourceFrequencyHz [[ init: 440.0f ]];
    input value float32 sourceAmplitude [[ init: 0.5f ]];
    input value float32 trackingHz [[ init: 110.0f ]];
    input value float32 chorusEnabled [[ init: 1.0f ]];
    input value float32 chorusMix [[ init: 1.0f ]];
    input value float32 chorusMotionMode [[ init: 1.0f ]];
    input value float32 chorusBloomMode [[ init: 0.0f ]];
    input value float32 chorusTone [[ init: 0.5f ]];
    input value float32 chorusFeedback [[ init: 0.45f ]];
    input value float32 chorusRingAmount [[ init: 0.0f ]];
    input value float32 chorusRingOffsetMode [[ init: 0.0f ]];
    input value float32 chorusRingFineSemitones [[ init: 0.0f ]];

    output stream float leftOut;
    output stream float rightOut;
    output stream float dryLeftOut;

    node source = ChorusProbeSource;
    node tracking = ConstantTrackingPitch;
    node chorus = wt::ChorusBus;
    node wetSplit = StereoProbeSplitter;
    node drySplit = StereoProbeSplitter;

    connection
    {
        sourceMode -> source.modeIn;
        sourceFrequencyHz -> source.frequencyHzIn;
        sourceAmplitude -> source.amplitudeIn;
        trackingHz -> tracking.trackingHzIn;
        source.out -> chorus.in, drySplit.in;
        tracking.out -> chorus.trackingPitchHzIn;
        chorusEnabled -> chorus.enabledIn;
        chorusMix -> chorus.mixIn;
        chorusMotionMode -> chorus.motionModeIn;
        chorusBloomMode -> chorus.bloomModeIn;
        chorusTone -> chorus.toneIn;
        chorusFeedback -> chorus.feedbackIn;
        chorusRingAmount -> chorus.ringAmountIn;
        chorusRingOffsetMode -> chorus.ringOffsetModeIn;
        chorusRingFineSemitones -> chorus.ringFineSemitonesIn;
        chorus.out -> wetSplit.in;
        wetSplit.leftOut -> leftOut;
        wetSplit.rightOut -> rightOut;
        drySplit.leftOut -> dryLeftOut;
    }
}
""".lstrip()
    )


def _build_manifest(source_filename: str) -> dict[str, object]:
    return {
        "CmajorVersion": 1,
        "ID": "dev.cosimo.chorus-probe",
        "version": "1.0",
        "name": "Chorus Probe",
        "description": "Exercises production ChorusBus",
        "category": "effect",
        "source": source_filename,
    }


def _write_chorus_probe_patch(temp_dir: Path) -> Path:
    probe_source_path = temp_dir / "ChorusProbe.cmajor"
    patch_path = temp_dir / "ChorusProbe.cmajorpatch"

    probe_source_path.write_text(
        _build_chorus_probe_source(),
        encoding="utf-8",
    )
    patch_path.write_text(
        json.dumps(_build_manifest(probe_source_path.name), indent=2) + "\n",
        encoding="utf-8",
    )

    return patch_path


def _setup_js(
    *,
    enabled: float = 1.0,
    mix: float = 1.0,
    motion_mode: int = 1,
    bloom_mode: int = 0,
    tone: float = 0.5,
    feedback: float = 0.45,
    ring_amount: float = 0.0,
    ring_offset_mode: int = 0,
    ring_fine_semitones: float = 0.0,
    source_mode: int = 2,
    source_frequency_hz: float = 440.0,
    source_amplitude: float = 0.5,
    tracking_hz: float = 110.0,
) -> str:
    return "\n".join(
        [
            f"patch.setInputValue_sourceMode({float(source_mode):.6f}, 0);",
            f"patch.setInputValue_sourceFrequencyHz({float(source_frequency_hz):.6f}, 0);",
            f"patch.setInputValue_sourceAmplitude({float(source_amplitude):.6f}, 0);",
            f"patch.setInputValue_trackingHz({float(tracking_hz):.6f}, 0);",
            f"patch.setInputValue_chorusEnabled({float(enabled):.6f}, 0);",
            f"patch.setInputValue_chorusMix({float(mix):.6f}, 0);",
            f"patch.setInputValue_chorusMotionMode({float(motion_mode):.6f}, 0);",
            f"patch.setInputValue_chorusBloomMode({float(bloom_mode):.6f}, 0);",
            f"patch.setInputValue_chorusTone({float(tone):.6f}, 0);",
            f"patch.setInputValue_chorusFeedback({float(feedback):.6f}, 0);",
            f"patch.setInputValue_chorusRingAmount({float(ring_amount):.6f}, 0);",
            f"patch.setInputValue_chorusRingOffsetMode({float(ring_offset_mode):.6f}, 0);",
            f"patch.setInputValue_chorusRingFineSemitones({float(ring_fine_semitones):.6f}, 0);",
        ]
    )


def _render_chorus(
    *,
    setup_js: str,
    output_endpoint_id: str = "leftOut",
    num_samples: int = 16_384,
) -> np.ndarray:
    with tempfile.TemporaryDirectory(prefix="chorus_probe_") as temp_dir_name:
        temp_dir = Path(temp_dir_name)
        patch_path = _write_chorus_probe_patch(temp_dir)

        return _render_cmajor_patch_via_generated_javascript(
            patch_path=patch_path,
            sample_rate=DEFAULT_SAMPLE_RATE,
            num_samples=num_samples,
            output_endpoint_id=output_endpoint_id,
            setup_js=setup_js,
        )


def _band_energy(audio: np.ndarray, low_hz: float, high_hz: float) -> float:
    windowed = np.asarray(audio, dtype=np.float64) * np.hanning(audio.size)
    spectrum = np.abs(rfft(windowed)) ** 2
    freqs = rfftfreq(audio.size, d=1.0 / DEFAULT_SAMPLE_RATE)
    mask = (freqs >= low_hz) & (freqs <= high_hz)
    return float(np.sum(spectrum[mask]))


def _band_energy_around(audio: np.ndarray, center_hz: float, half_width_hz: float = 18.0) -> float:
    return _band_energy(audio, center_hz - half_width_hz, center_hz + half_width_hz)


@pytest.mark.cmajor
def test_chorus_probe_loads_in_native_cmajor_engine_without_internal_compiler_error() -> None:
    with tempfile.TemporaryDirectory(prefix="chorus_native_load_probe_") as temp_dir_name:
        patch_path = _write_chorus_probe_patch(Path(temp_dir_name))
        completed = subprocess.run(
            ["cmaj", "play", "--dry-run", "--stop-on-error", str(patch_path)],
            capture_output=True,
            check=False,
            text=True,
        )

    output = completed.stdout + completed.stderr

    assert "Internal compiler error" not in output
    assert "error:" not in output.lower()
    assert "Loaded: Chorus Probe" in output


@pytest.mark.cmajor
def test_chorus_disabled_is_transparent() -> None:
    setup = _setup_js(enabled=0.0, mix=1.0, feedback=0.8, bloom_mode=4, ring_amount=1.0)
    dry = _render_chorus(setup_js=setup, output_endpoint_id="dryLeftOut")
    disabled = _render_chorus(setup_js=setup, output_endpoint_id="leftOut")

    assert rms(dry) > 0.01
    assert is_finite(disabled)
    assert rms(disabled - dry) < 1e-6
    assert peak_abs(disabled - dry) < 1e-5


@pytest.mark.cmajor
def test_chorus_mix_zero_is_transparent_even_when_internal_fx_are_aggressive() -> None:
    setup = _setup_js(enabled=1.0, mix=0.0, feedback=0.95, bloom_mode=4, ring_amount=1.0)
    dry = _render_chorus(setup_js=setup, output_endpoint_id="dryLeftOut")
    mix_zero = _render_chorus(setup_js=setup, output_endpoint_id="leftOut")

    assert rms(mix_zero - dry) < 1e-6
    assert peak_abs(mix_zero - dry) < 1e-5


@pytest.mark.cmajor
def test_chorus_full_wet_removes_the_dry_impulse_and_returns_delayed_energy() -> None:
    wet = _render_chorus(
        setup_js=_setup_js(
            enabled=1.0,
            mix=1.0,
            source_mode=0,
            source_amplitude=0.8,
            feedback=0.35,
        ),
        num_samples=4096,
    )

    early = wet[:128]
    delay_window = wet[int(DEFAULT_SAMPLE_RATE * 0.006) : int(DEFAULT_SAMPLE_RATE * 0.050)]

    assert peak_abs(early) < 1e-4
    assert rms(delay_window) > 1e-4
    assert peak_abs(wet) > 1e-4


@pytest.mark.cmajor
def test_chorus_mix_progression_changes_dry_and_wet_windows_monotonically() -> None:
    dry_rms_values: list[float] = []
    wet_rms_values: list[float] = []

    for mix in [0.0, 0.25, 0.5, 0.75, 1.0]:
        rendered = _render_chorus(
            setup_js=_setup_js(
                enabled=1.0,
                mix=mix,
                source_mode=0,
                source_amplitude=0.8,
                feedback=0.35,
            ),
            num_samples=4096,
        )
        dry_rms_values.append(rms(rendered[:128]))
        wet_rms_values.append(rms(rendered[int(DEFAULT_SAMPLE_RATE * 0.006) : int(DEFAULT_SAMPLE_RATE * 0.050)]))

    assert dry_rms_values[0] > dry_rms_values[1] > dry_rms_values[2] > dry_rms_values[3] > dry_rms_values[4]
    assert wet_rms_values[0] < wet_rms_values[1] < wet_rms_values[2] < wet_rms_values[3] < wet_rms_values[4]
    assert wet_rms_values[3] > wet_rms_values[2]
    assert wet_rms_values[4] > 1e-4


@pytest.mark.cmajor
def test_motion_modes_produce_distinct_modulation() -> None:
    renders = [
        _render_chorus(
            setup_js=_setup_js(enabled=1.0, mix=1.0, motion_mode=mode, feedback=0.55),
            num_samples=32_768,
        )[4410:]
        for mode in range(4)
    ]

    for rendered in renders:
        assert is_finite(rendered)
        assert rms(rendered) > 0.001

    for left, right in zip(renders, renders[1:]):
        assert rms(left - right) > 0.0005


@pytest.mark.cmajor
def test_bloom_modes_change_tail_and_spectral_content() -> None:
    clean = _render_chorus(
        setup_js=_setup_js(source_mode=1, mix=1.0, feedback=0.72, bloom_mode=0),
        num_samples=32_768,
    )
    diffuse_large = _render_chorus(
        setup_js=_setup_js(source_mode=1, mix=1.0, feedback=0.72, bloom_mode=2),
        num_samples=32_768,
    )
    large_shimmer = _render_chorus(
        setup_js=_setup_js(source_mode=1, mix=1.0, feedback=0.72, bloom_mode=4),
        num_samples=32_768,
    )

    tail = slice(int(DEFAULT_SAMPLE_RATE * 0.120), int(DEFAULT_SAMPLE_RATE * 0.500))

    assert rms(diffuse_large[tail]) > rms(clean[tail]) * 1.41
    assert rms(large_shimmer[tail]) > rms(clean[tail]) * 1.41
    assert _band_energy(large_shimmer[tail], 1500.0, 9000.0) > _band_energy(diffuse_large[tail], 1500.0, 9000.0) * 1.05


@pytest.mark.cmajor
def test_feedback_increases_tail_without_unbounded_output() -> None:
    low_feedback = _render_chorus(
        setup_js=_setup_js(source_mode=1, mix=1.0, feedback=0.0, bloom_mode=2),
        num_samples=32_768,
    )
    high_feedback = _render_chorus(
        setup_js=_setup_js(source_mode=1, mix=1.0, feedback=0.86, bloom_mode=2),
        num_samples=32_768,
    )

    tail = slice(int(DEFAULT_SAMPLE_RATE * 0.120), int(DEFAULT_SAMPLE_RATE * 0.500))

    assert rms(high_feedback[tail]) > rms(low_feedback[tail]) * 1.25
    assert peak_abs(high_feedback) <= 1.25
    assert is_finite(high_feedback)


@pytest.mark.cmajor
def test_tone_macro_changes_loop_bandwidth() -> None:
    dark = _render_chorus(
        setup_js=_setup_js(source_mode=2, source_frequency_hz=880.0, mix=1.0, feedback=0.82, tone=0.0),
        num_samples=32_768,
    )[4410:]
    bright = _render_chorus(
        setup_js=_setup_js(source_mode=2, source_frequency_hz=880.0, mix=1.0, feedback=0.82, tone=1.0),
        num_samples=32_768,
    )[4410:]

    assert _band_energy(bright, 3000.0, 12000.0) > _band_energy(dark, 3000.0, 12000.0) * 1.15
    assert rms(dark) > 0.001
    assert rms(bright) > 0.001


@pytest.mark.cmajor
def test_ring_amount_adds_tracked_sideband_energy() -> None:
    source_hz = 440.0
    tracking_hz = 220.0
    ring_hz = tracking_hz * CHORUS_RING_OFFSET_RATIO
    lower_sideband_hz = abs(source_hz - ring_hz)
    upper_sideband_hz = source_hz + ring_hz
    ring_off = _render_chorus(
        setup_js=_setup_js(source_frequency_hz=source_hz, tracking_hz=tracking_hz, mix=1.0, feedback=0.72, ring_amount=0.0),
        num_samples=32_768,
    )[4410:]
    ring_on = _render_chorus(
        setup_js=_setup_js(source_frequency_hz=source_hz, tracking_hz=tracking_hz, mix=1.0, feedback=0.72, ring_amount=1.0),
        num_samples=32_768,
    )[4410:]

    assert rms(ring_on - ring_off) > 0.001
    assert _band_energy_around(ring_on, lower_sideband_hz) > max(_band_energy_around(ring_off, lower_sideband_hz) * 5.0, 1e-5)
    assert _band_energy_around(ring_on, upper_sideband_hz) > max(_band_energy_around(ring_off, upper_sideband_hz) * 5.0, 1e-5)


@pytest.mark.cmajor
def test_ring_offset_modes_select_expected_pitch_ratios() -> None:
    source_hz = 660.0
    tracking_hz = 220.0
    ring_off = _render_chorus(
        setup_js=_setup_js(
            source_frequency_hz=source_hz,
            tracking_hz=tracking_hz,
            mix=1.0,
            feedback=0.72,
            ring_amount=0.0,
        ),
        num_samples=32_768,
    )[4410:]

    for mode, ratio in CHORUS_RING_OFFSET_MODE_RATIOS.items():
        ring_hz = tracking_hz * ratio
        lower_sideband_hz = abs(source_hz - ring_hz)
        upper_sideband_hz = source_hz + ring_hz
        ring_on = _render_chorus(
            setup_js=_setup_js(
                source_frequency_hz=source_hz,
                tracking_hz=tracking_hz,
                mix=1.0,
                feedback=0.72,
                ring_amount=1.0,
                ring_offset_mode=mode,
            ),
            num_samples=32_768,
        )[4410:]

        assert _band_energy_around(ring_on, lower_sideband_hz) > max(_band_energy_around(ring_off, lower_sideband_hz) * 4.0, 1e-5)
        assert _band_energy_around(ring_on, upper_sideband_hz) > max(_band_energy_around(ring_off, upper_sideband_hz) * 4.0, 1e-5)


@pytest.mark.cmajor
def test_ring_fine_offsets_selected_pitch_by_whole_step_range() -> None:
    source_hz = 660.0
    tracking_hz = 220.0
    ring_off = _render_chorus(
        setup_js=_setup_js(
            source_frequency_hz=source_hz,
            tracking_hz=tracking_hz,
            mix=1.0,
            feedback=0.72,
            ring_amount=0.0,
        ),
        num_samples=32_768,
    )[4410:]

    for fine_semitones in (-2.0, 2.0):
        ring_ratio = 2.0 ** ((7.0 + fine_semitones) / 12.0)
        ring_hz = tracking_hz * ring_ratio
        lower_sideband_hz = abs(source_hz - ring_hz)
        upper_sideband_hz = source_hz + ring_hz
        ring_on = _render_chorus(
            setup_js=_setup_js(
                source_frequency_hz=source_hz,
                tracking_hz=tracking_hz,
                mix=1.0,
                feedback=0.72,
                ring_amount=1.0,
                ring_offset_mode=0,
                ring_fine_semitones=fine_semitones,
            ),
            num_samples=32_768,
        )[4410:]

        assert _band_energy_around(ring_on, lower_sideband_hz) > max(_band_energy_around(ring_off, lower_sideband_hz) * 4.0, 1e-5)
        assert _band_energy_around(ring_on, upper_sideband_hz) > max(_band_energy_around(ring_off, upper_sideband_hz) * 4.0, 1e-5)
