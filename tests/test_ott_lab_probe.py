from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path

import numpy as np
import pytest

from bench import (
    DEFAULT_SAMPLE_RATE,
    _render_cmajor_patch_via_generated_javascript,
    _require_cmaj_cli,
    is_finite,
    peak_abs,
    rms,
)


REPO_ROOT = Path(__file__).resolve().parents[1]
OTT_PATCH = REPO_ROOT / "fx" / "ott_lab" / "OttLab.cmajorpatch"
OTT_SOURCE = REPO_ROOT / "fx" / "ott_lab" / "OttLab.cmajor"
WARMUP_SAMPLES = 8192
DEFAULT_RENDER_SAMPLES = 32768


def _build_ott_probe_source() -> str:
    ott_source = OTT_SOURCE.read_text(encoding="utf-8").replace(
        "processor OttLab [[ main ]]",
        "processor OttLab",
        1,
    )

    return (
        ott_source
        + "\n"
        + """
processor OttProbeSource
{
    input value float32 modeIn [[ init: 0.0f ]];
    input value float32 frequencyHzIn [[ init: 1000.0f ]];
    input value float32 leftAmplitudeIn [[ init: 0.5f ]];
    input value float32 rightAmplitudeIn [[ init: 0.5f ]];
    output stream float32<2> out;

    int32 frameCounter = 0;
    float32 phase = 0.0f;

    void main()
    {
        loop
        {
            let mode = int32 (std::intrinsics::floor (modeIn + 0.5f));
            let frequencyHz = std::intrinsics::clamp (frequencyHzIn, 1.0f, float32 (processor.frequency) * 0.45f);
            let baseLeft = std::intrinsics::clamp (leftAmplitudeIn, 0.0f, 1.0f);
            let baseRight = std::intrinsics::clamp (rightAmplitudeIn, 0.0f, 1.0f);
            let stepFrame = int32 (0.25f * float32 (processor.frequency));
            let stepScale = mode == 1 && frameCounter < stepFrame ? 0.08f : 1.0f;
            let sample = std::intrinsics::sin (6.283185307f * phase);

            out <- float32<2> (baseLeft * stepScale * sample, baseRight * stepScale * sample);

            phase = std::intrinsics::wrap (phase + (frequencyHz / float32 (processor.frequency)), 1.0f);
            frameCounter += 1;
            advance();
        }
    }
}

processor OttProbeSplitter
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

graph OttProbe [[ main ]]
{
    input value float32 sourceMode [[ init: 0.0f ]];
    input value float32 sourceFrequencyHz [[ init: 1000.0f ]];
    input value float32 sourceLeftAmplitude [[ init: 0.5f ]];
    input value float32 sourceRightAmplitude [[ init: 0.5f ]];
    input value bool bypass [[ init: false ]];
    input value float32 mix [[ init: 100.0f ]];
    input value float32 amount [[ init: 100.0f ]];
    input value float32 timePercent [[ init: 100.0f ]];
    input value float32 inputGainDb [[ init: 0.0f ]];
    input value float32 outputGainDb [[ init: 0.0f ]];
    input value float32 upAmount [[ init: 100.0f ]];
    input value float32 downAmount [[ init: 100.0f ]];
    input value float32 detectorMode [[ init: 0.0f ]];
    input value bool softKnee [[ init: true ]];
    input value float32 kneeWidthDb [[ init: 6.0f ]];
    input value float32 stereoLink [[ init: 100.0f ]];
    input value float32 bandDrive [[ init: 0.0f ]];
    input value float32 lowMidHz [[ init: 88.2818146f ]];
    input value float32 midHighHz [[ init: 2499.99951f ]];
    input value float32 lowAboveDb [[ init: -33.75f ]];
    input value float32 lowBelowDb [[ init: -40.75f ]];
    input value float32 lowDownRatio [[ init: 66.7f ]];
    input value float32 lowUpRatio [[ init: 4.17f ]];
    input value float32 lowAttackMs [[ init: 47.8499336f ]];
    input value float32 lowReleaseMs [[ init: 282.361938f ]];
    input value float32 lowInputGainDb [[ init: 5.19999981f ]];
    input value float32 lowOutputGainDb [[ init: 10.3000002f ]];
    input value float32 midAboveDb [[ init: -30.25f ]];
    input value float32 midBelowDb [[ init: -41.75f ]];
    input value float32 midDownRatio [[ init: 66.7f ]];
    input value float32 midUpRatio [[ init: 4.17f ]];
    input value float32 midAttackMs [[ init: 22.3606815f ]];
    input value float32 midReleaseMs [[ init: 282.361938f ]];
    input value float32 midInputGainDb [[ init: 5.19999981f ]];
    input value float32 midOutputGainDb [[ init: 5.69999981f ]];
    input value float32 highAboveDb [[ init: -35.5f ]];
    input value float32 highBelowDb [[ init: -40.75f ]];
    input value float32 highDownRatio [[ init: 1000.0f ]];
    input value float32 highUpRatio [[ init: 4.17f ]];
    input value float32 highAttackMs [[ init: 13.4654493f ]];
    input value float32 highReleaseMs [[ init: 131.950104f ]];
    input value float32 highInputGainDb [[ init: 5.19999981f ]];
    input value float32 highOutputGainDb [[ init: 10.3000002f ]];

    output stream float leftOut;
    output stream float rightOut;
    output stream float dryLeftOut;
    output stream float dryRightOut;

    node source = OttProbeSource;
    node ott = OttLab;
    node wetSplit = OttProbeSplitter;
    node drySplit = OttProbeSplitter;

    connection
    {
        sourceMode -> source.modeIn;
        sourceFrequencyHz -> source.frequencyHzIn;
        sourceLeftAmplitude -> source.leftAmplitudeIn;
        sourceRightAmplitude -> source.rightAmplitudeIn;
        source.out -> ott.in, drySplit.in;
        bypass -> ott.bypass;
        mix -> ott.mix;
        amount -> ott.amount;
        timePercent -> ott.timePercent;
        inputGainDb -> ott.inputGainDb;
        outputGainDb -> ott.outputGainDb;
        upAmount -> ott.upAmount;
        downAmount -> ott.downAmount;
        detectorMode -> ott.detectorMode;
        softKnee -> ott.softKnee;
        kneeWidthDb -> ott.kneeWidthDb;
        stereoLink -> ott.stereoLink;
        bandDrive -> ott.bandDrive;
        lowMidHz -> ott.lowMidHz;
        midHighHz -> ott.midHighHz;
        lowAboveDb -> ott.lowAboveDb;
        lowBelowDb -> ott.lowBelowDb;
        lowDownRatio -> ott.lowDownRatio;
        lowUpRatio -> ott.lowUpRatio;
        lowAttackMs -> ott.lowAttackMs;
        lowReleaseMs -> ott.lowReleaseMs;
        lowInputGainDb -> ott.lowInputGainDb;
        lowOutputGainDb -> ott.lowOutputGainDb;
        midAboveDb -> ott.midAboveDb;
        midBelowDb -> ott.midBelowDb;
        midDownRatio -> ott.midDownRatio;
        midUpRatio -> ott.midUpRatio;
        midAttackMs -> ott.midAttackMs;
        midReleaseMs -> ott.midReleaseMs;
        midInputGainDb -> ott.midInputGainDb;
        midOutputGainDb -> ott.midOutputGainDb;
        highAboveDb -> ott.highAboveDb;
        highBelowDb -> ott.highBelowDb;
        highDownRatio -> ott.highDownRatio;
        highUpRatio -> ott.highUpRatio;
        highAttackMs -> ott.highAttackMs;
        highReleaseMs -> ott.highReleaseMs;
        highInputGainDb -> ott.highInputGainDb;
        highOutputGainDb -> ott.highOutputGainDb;
        ott.out -> wetSplit.in;
        wetSplit.leftOut -> leftOut;
        wetSplit.rightOut -> rightOut;
        drySplit.leftOut -> dryLeftOut;
        drySplit.rightOut -> dryRightOut;
    }
}
""".lstrip()
    )


def _build_manifest(source_filename: str) -> dict[str, object]:
    return {
        "CmajorVersion": 1,
        "ID": "dev.cosimo.ott-probe",
        "version": "1.0",
        "name": "OTT Probe",
        "description": "Exercises the standalone OTT lab processor",
        "category": "effect",
        "source": source_filename,
    }


def _write_ott_probe_patch(temp_dir: Path) -> Path:
    probe_source_path = temp_dir / "OttProbe.cmajor"
    patch_path = temp_dir / "OttProbe.cmajorpatch"

    probe_source_path.write_text(_build_ott_probe_source(), encoding="utf-8")
    patch_path.write_text(
        json.dumps(_build_manifest(probe_source_path.name), indent=2) + "\n",
        encoding="utf-8",
    )

    return patch_path


def _js_value(value: bool | float | int) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"

    return f"{float(value):.9f}"


def _setup_js(**values: bool | float | int) -> str:
    return "\n".join(
        f"patch.setInputValue_{name}({_js_value(value)}, 0);"
        for name, value in values.items()
    )


def _flat_band_setup(**overrides: bool | float | int) -> str:
    values: dict[str, bool | float | int] = {
        "mix": 100.0,
        "amount": 100.0,
        "timePercent": 100.0,
        "inputGainDb": 0.0,
        "outputGainDb": 0.0,
        "upAmount": 0.0,
        "downAmount": 0.0,
        "softKnee": False,
        "kneeWidthDb": 0.0,
        "stereoLink": 100.0,
        "bandDrive": 0.0,
        "lowMidHz": 88.2818146,
        "midHighHz": 2499.99951,
        "lowDownRatio": 1.0,
        "lowUpRatio": 1.0,
        "lowAttackMs": 47.8499336,
        "lowReleaseMs": 282.361938,
        "lowInputGainDb": 0.0,
        "lowOutputGainDb": 0.0,
        "midDownRatio": 1.0,
        "midUpRatio": 1.0,
        "midAttackMs": 22.3606815,
        "midReleaseMs": 282.361938,
        "midInputGainDb": 0.0,
        "midOutputGainDb": 0.0,
        "highDownRatio": 1.0,
        "highUpRatio": 1.0,
        "highAttackMs": 13.4654493,
        "highReleaseMs": 131.950104,
        "highInputGainDb": 0.0,
        "highOutputGainDb": 0.0,
    }
    values.update(overrides)
    return _setup_js(**values)


def _default_ott_setup(**overrides: bool | float | int) -> str:
    values: dict[str, bool | float | int] = {
        "mix": 100.0,
        "amount": 100.0,
        "timePercent": 100.0,
        "inputGainDb": 0.0,
        "outputGainDb": 0.0,
        "upAmount": 100.0,
        "downAmount": 100.0,
        "detectorMode": 0.0,
        "softKnee": True,
        "kneeWidthDb": 6.0,
        "stereoLink": 100.0,
        "bandDrive": 0.0,
        "lowMidHz": 88.2818146,
        "midHighHz": 2499.99951,
        "lowAboveDb": -33.75,
        "lowBelowDb": -40.75,
        "lowDownRatio": 66.7,
        "lowUpRatio": 4.17,
        "lowAttackMs": 47.8499336,
        "lowReleaseMs": 282.361938,
        "lowInputGainDb": 5.19999981,
        "lowOutputGainDb": 10.3000002,
        "midAboveDb": -30.25,
        "midBelowDb": -41.75,
        "midDownRatio": 66.7,
        "midUpRatio": 4.17,
        "midAttackMs": 22.3606815,
        "midReleaseMs": 282.361938,
        "midInputGainDb": 5.19999981,
        "midOutputGainDb": 5.69999981,
        "highAboveDb": -35.5,
        "highBelowDb": -40.75,
        "highDownRatio": 1000.0,
        "highUpRatio": 4.17,
        "highAttackMs": 13.4654493,
        "highReleaseMs": 131.950104,
        "highInputGainDb": 5.19999981,
        "highOutputGainDb": 10.3000002,
    }
    values.update(overrides)
    return _setup_js(**values)


def _render_ott(
    *,
    setup_js: str,
    output_endpoint_id: str = "leftOut",
    num_samples: int = DEFAULT_RENDER_SAMPLES,
) -> np.ndarray:
    with tempfile.TemporaryDirectory(prefix="ott_probe_") as temp_dir_name:
        patch_path = _write_ott_probe_patch(Path(temp_dir_name))

        return _render_cmajor_patch_via_generated_javascript(
            patch_path=patch_path,
            sample_rate=DEFAULT_SAMPLE_RATE,
            num_samples=num_samples,
            output_endpoint_id=output_endpoint_id,
            setup_js=setup_js,
        )


def _steady(audio: np.ndarray) -> np.ndarray:
    return np.asarray(audio[WARMUP_SAMPLES:], dtype=np.float64)


def _level_ratio(processed: np.ndarray, dry: np.ndarray) -> float:
    return rms(_steady(processed)) / max(rms(_steady(dry)), 1.0e-12)


@pytest.mark.cmajor
def test_ott_lab_patch_loads_in_native_cmajor_engine_without_internal_compiler_error() -> None:
    completed = subprocess.run(
        [_require_cmaj_cli(), "play", "--dry-run", "--stop-on-error", str(OTT_PATCH)],
        cwd=REPO_ROOT,
        capture_output=True,
        check=False,
        text=True,
    )

    output = completed.stdout + completed.stderr

    assert completed.returncode == 0, output
    assert "Internal compiler error" not in output
    assert "error:" not in output.lower()
    assert "Loaded: OTT Lab" in output


@pytest.mark.cmajor
def test_ott_bypass_is_transparent_even_with_aggressive_default_dynamics() -> None:
    setup = _setup_js(bypass=True, mix=100.0, amount=100.0, sourceLeftAmplitude=0.7)
    dry = _render_ott(setup_js=setup, output_endpoint_id="dryLeftOut")
    bypassed = _render_ott(setup_js=setup, output_endpoint_id="leftOut")

    residual = bypassed - dry

    assert rms(_steady(dry)) > 0.01
    assert is_finite(bypassed)
    assert rms(residual) < 1.0e-6
    assert peak_abs(residual) < 1.0e-5


@pytest.mark.cmajor
def test_ott_mix_zero_is_transparent_even_when_dynamics_are_active() -> None:
    setup = _setup_js(mix=0.0, amount=100.0, sourceLeftAmplitude=0.7)
    dry = _render_ott(setup_js=setup, output_endpoint_id="dryLeftOut")
    mix_zero = _render_ott(setup_js=setup, output_endpoint_id="leftOut")

    residual = mix_zero - dry

    assert rms(residual) < 1.0e-6
    assert peak_abs(residual) < 1.0e-5


@pytest.mark.cmajor
def test_ott_amount_zero_reconstructs_the_crossover_bands_without_level_change() -> None:
    setup = _flat_band_setup(amount=0.0, sourceFrequencyHz=1000.0, sourceLeftAmplitude=0.5)
    dry = _render_ott(setup_js=setup, output_endpoint_id="dryLeftOut")
    neutral = _render_ott(setup_js=setup, output_endpoint_id="leftOut")

    level_ratio = rms(_steady(neutral)) / max(rms(_steady(dry)), 1.0e-12)

    assert rms(_steady(dry)) > 0.01
    assert 0.995 <= level_ratio <= 1.005
    assert peak_abs(_steady(neutral)) <= peak_abs(_steady(dry)) * 1.02


@pytest.mark.cmajor
def test_downward_compression_reduces_a_loud_mid_band_tone() -> None:
    setup = _flat_band_setup(
        sourceFrequencyHz=1000.0,
        sourceLeftAmplitude=0.75,
        downAmount=100.0,
        midAboveDb=-34.0,
        midDownRatio=12.0,
    )
    dry = _render_ott(setup_js=setup, output_endpoint_id="dryLeftOut")
    compressed = _render_ott(setup_js=setup, output_endpoint_id="leftOut")

    assert is_finite(compressed)
    assert _level_ratio(compressed, dry) < 0.75


@pytest.mark.cmajor
def test_upward_compression_raises_a_quiet_mid_band_tone_without_nan_or_runaway_gain() -> None:
    setup = _flat_band_setup(
        sourceFrequencyHz=1000.0,
        sourceLeftAmplitude=0.01,
        upAmount=100.0,
        midBelowDb=-20.0,
        midUpRatio=4.0,
    )
    dry = _render_ott(setup_js=setup, output_endpoint_id="dryLeftOut")
    expanded = _render_ott(setup_js=setup, output_endpoint_id="leftOut")

    assert is_finite(expanded)
    assert _level_ratio(expanded, dry) > 2.0
    assert peak_abs(expanded) < 0.5


@pytest.mark.cmajor
def test_default_ott_loud_step_does_not_add_attack_spike_above_the_dry_input() -> None:
    setup = _default_ott_setup(
        sourceMode=1.0,
        sourceFrequencyHz=1000.0,
        sourceLeftAmplitude=0.75,
        sourceRightAmplitude=0.75,
    )
    processed = _render_ott(setup_js=setup, output_endpoint_id="leftOut", num_samples=DEFAULT_SAMPLE_RATE)
    dry = _render_ott(setup_js=setup, output_endpoint_id="dryLeftOut", num_samples=DEFAULT_SAMPLE_RATE)
    step_frame = int(0.25 * DEFAULT_SAMPLE_RATE)
    dry_first_5_ms = slice(step_frame, step_frame + int(0.005 * DEFAULT_SAMPLE_RATE))
    settled = slice(step_frame + int(0.15 * DEFAULT_SAMPLE_RATE), step_frame + int(0.25 * DEFAULT_SAMPLE_RATE))

    dry_peak = peak_abs(dry[dry_first_5_ms])
    onset_search = np.abs(processed[step_frame : step_frame + int(0.02 * DEFAULT_SAMPLE_RATE)])
    loud_indices = np.flatnonzero(onset_search > dry_peak * 0.4)

    assert is_finite(processed)
    assert dry_peak > 0.7
    assert loud_indices.size > 0
    processed_onset = step_frame + int(loud_indices[0])
    assert int(0.001 * DEFAULT_SAMPLE_RATE) <= processed_onset - step_frame <= int(0.006 * DEFAULT_SAMPLE_RATE)

    processed_first_5_ms = slice(processed_onset, processed_onset + int(0.005 * DEFAULT_SAMPLE_RATE))
    assert peak_abs(processed[processed_first_5_ms]) <= dry_peak * 0.8
    assert rms(processed[settled]) < rms(dry[settled]) * 0.35


@pytest.mark.cmajor
def test_band_drive_soft_clips_after_default_band_dynamics_without_silencing_the_signal() -> None:
    base_setup = dict(
        sourceFrequencyHz=1000.0,
        sourceLeftAmplitude=0.75,
        sourceRightAmplitude=0.75,
    )
    no_drive = _render_ott(
        setup_js=_default_ott_setup(**base_setup, bandDrive=0.0),
        output_endpoint_id="leftOut",
        num_samples=DEFAULT_SAMPLE_RATE,
    )
    driven = _render_ott(
        setup_js=_default_ott_setup(**base_setup, bandDrive=100.0),
        output_endpoint_id="leftOut",
        num_samples=DEFAULT_SAMPLE_RATE,
    )
    steady = slice(int(0.5 * DEFAULT_SAMPLE_RATE), DEFAULT_SAMPLE_RATE)
    no_drive_peak = peak_abs(no_drive[steady])
    driven_peak = peak_abs(driven[steady])

    assert is_finite(driven)
    assert no_drive_peak > 0.05
    assert driven_peak < no_drive_peak * 0.65
    assert rms(driven[steady]) > rms(no_drive[steady]) * 0.2


@pytest.mark.cmajor
def test_band_drive_does_not_clip_the_unprocessed_amount_zero_path() -> None:
    base_setup = dict(
        sourceFrequencyHz=1000.0,
        sourceLeftAmplitude=0.75,
        sourceRightAmplitude=0.75,
        amount=0.0,
        mix=100.0,
    )
    no_drive = _render_ott(
        setup_js=_default_ott_setup(**base_setup, bandDrive=0.0),
        output_endpoint_id="leftOut",
        num_samples=DEFAULT_SAMPLE_RATE,
    )
    driven = _render_ott(
        setup_js=_default_ott_setup(**base_setup, bandDrive=100.0),
        output_endpoint_id="leftOut",
        num_samples=DEFAULT_SAMPLE_RATE,
    )
    steady = slice(int(0.5 * DEFAULT_SAMPLE_RATE), DEFAULT_SAMPLE_RATE)
    residual = driven[steady] - no_drive[steady]

    assert is_finite(driven)
    assert peak_abs(no_drive[steady]) > 0.5
    assert peak_abs(residual) < 1.0e-6


@pytest.mark.cmajor
def test_stereo_link_applies_the_loud_channel_gain_reduction_to_the_quiet_channel() -> None:
    linked_setup = _flat_band_setup(
        sourceFrequencyHz=1000.0,
        sourceLeftAmplitude=0.75,
        sourceRightAmplitude=0.05,
        downAmount=100.0,
        stereoLink=100.0,
        midAboveDb=-34.0,
        midDownRatio=12.0,
    )
    independent_setup = linked_setup + "\n" + _setup_js(stereoLink=0.0)
    dry_left = _render_ott(setup_js=linked_setup, output_endpoint_id="dryLeftOut")
    dry_right = _render_ott(setup_js=linked_setup, output_endpoint_id="dryRightOut")
    linked_left = _render_ott(setup_js=linked_setup, output_endpoint_id="leftOut")
    linked_right = _render_ott(setup_js=linked_setup, output_endpoint_id="rightOut")
    independent_right = _render_ott(setup_js=independent_setup, output_endpoint_id="rightOut")

    linked_left_gain = _level_ratio(linked_left, dry_left)
    linked_right_gain = _level_ratio(linked_right, dry_right)
    independent_right_gain = _level_ratio(independent_right, dry_right)

    assert linked_left_gain < 0.75
    assert abs(linked_left_gain - linked_right_gain) < 0.08
    assert independent_right_gain > linked_right_gain * 1.5


@pytest.mark.cmajor
def test_time_control_changes_how_quickly_gain_reduction_reacts_to_a_loud_step() -> None:
    base_setup = dict(
        sourceMode=1.0,
        sourceFrequencyHz=1000.0,
        sourceLeftAmplitude=0.75,
        downAmount=100.0,
        midAboveDb=-34.0,
        midDownRatio=12.0,
    )
    fast = _render_ott(
        setup_js=_flat_band_setup(**base_setup, timePercent=10.0),
        output_endpoint_id="leftOut",
        num_samples=DEFAULT_SAMPLE_RATE,
    )
    slow = _render_ott(
        setup_js=_flat_band_setup(**base_setup, timePercent=1000.0),
        output_endpoint_id="leftOut",
        num_samples=DEFAULT_SAMPLE_RATE,
    )
    step_frame = int(0.25 * DEFAULT_SAMPLE_RATE)
    early_window = slice(step_frame + 512, step_frame + 4096)

    assert rms(slow[early_window]) > rms(fast[early_window]) * 1.15
    assert is_finite(fast)
    assert is_finite(slow)
