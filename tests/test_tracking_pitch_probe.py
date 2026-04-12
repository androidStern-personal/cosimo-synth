from __future__ import annotations

import json
from pathlib import Path
import re
import tempfile

import numpy as np
import pytest
from scipy.fft import rfft, rfftfreq

from bench import (
    DEFAULT_SAMPLE_RATE,
    _render_cmajor_patch_via_generated_javascript,
)


REPO_ROOT = Path(__file__).resolve().parents[1]
MSEG_SOURCE = REPO_ROOT / "cmajor" / "Mseg.cmajor"
FIXED_FRAME_SOURCE = REPO_ROOT / "cmajor" / "FixedFrameOscillator.cmajor"
CHORUS_SOURCE = REPO_ROOT / "cmajor" / "Chorus.cmajor"
WAVETABLE_SYNTH_SOURCE = REPO_ROOT / "cmajor" / "WavetableSynth.cmajor"
CHORUS_RING_OFFSET_RATIO = 2.0 ** (7.0 / 12.0)

PLAY_MODE_POLY = 0
PLAY_MODE_LEGATO = 2


def _note_to_frequency(pitch: float) -> float:
    return float(440.0 * (2.0 ** ((float(pitch) - 69.0) / 12.0)))


def _note_on_expr(channel: int, pitch: float, velocity: float = 1.0) -> str:
    return f"std::notes::NoteOn ({int(channel)}, {float(pitch):.1f}f, {float(velocity):.3f}f)"


def _note_off_expr(channel: int, pitch: float, velocity: float = 0.0) -> str:
    return f"std::notes::NoteOff ({int(channel)}, {float(pitch):.1f}f, {float(velocity):.3f}f)"


def _pitch_bend_expr(channel: int, semitones: float) -> str:
    return f"std::notes::PitchBend ({int(channel)}, {float(semitones):.3f}f)"


def _wavetable_synth_support_source() -> str:
    return re.split(
        r"graph\s+WavetableSynth\s+\[\[\s*main\s*\]\]",
        WAVETABLE_SYNTH_SOURCE.read_text(encoding="utf-8"),
        maxsplit=1,
    )[0]


def _build_scheduler_source(scheduled_events: list[tuple[int, str]]) -> str:
    statements = [
        "            if (frameCounter == "
        + str(int(frame_index))
        + ")\n"
        + "                noteEventOut <- "
        + expression
        + ";"
        for frame_index, expression in scheduled_events
    ]

    return (
        "processor TrackingPitchScheduler\n"
        + "{\n"
        + "    output event (std::notes::NoteOn,\n"
        + "                  std::notes::NoteOff,\n"
        + "                  std::notes::PitchBend,\n"
        + "                  std::notes::Slide,\n"
        + "                  std::notes::Pressure,\n"
        + "                  std::notes::Control) noteEventOut;\n"
        + "    int32 frameCounter = 0;\n"
        + "    void main()\n"
        + "    {\n"
        + "        loop\n"
        + "        {\n"
        + "\n".join(statements)
        + "\n"
        + "            frameCounter += 1;\n"
        + "            advance();\n"
        + "        }\n"
        + "    }\n"
        + "}\n"
    )


def _build_tracking_pitch_probe_source(scheduled_events: list[tuple[int, str]]) -> str:
    return (
        MSEG_SOURCE.read_text(encoding="utf-8")
        + "\n"
        + FIXED_FRAME_SOURCE.read_text(encoding="utf-8")
        + "\n"
        + _wavetable_synth_support_source()
        + "\n"
        + _build_scheduler_source(scheduled_events)
        + "graph TrackingPitchProbe [[ main ]]\n"
        + "{\n"
        + "    input value float32 playMode [[ init: 0.0f ]];\n"
        + "    input value float32 glideTime [[ init: 0.0f ]];\n"
        + "    output stream float trackingHz;\n"
        + "    node scheduler = TrackingPitchScheduler;\n"
        + "    node dispatcher = wt::NoteDispatcher (4);\n"
        + "    node engine = wt::SharedVoiceEngine (4);\n"
        + "    connection\n"
        + "    {\n"
        + "        scheduler.noteEventOut -> dispatcher.eventIn;\n"
        + "        playMode -> dispatcher.playModeIn;\n"
        + "        dispatcher.voiceEventOut -> engine.voiceEventIn;\n"
        + "        dispatcher.voiceRetuneOut -> engine.voiceRetuneIn;\n"
        + "        glideTime -> engine.glideTimeIn;\n"
        + "        engine.trackingPitchHzOut -> trackingHz;\n"
        + "    }\n"
        + "}\n"
    )


def _build_sine_source() -> str:
    return """
processor TrackingRingSineSource
{
    input value float32 frequencyHzIn [[ init: 1100.0f ]];
    input value float32 amplitudeIn [[ init: 0.75f ]];
    output stream float32<2> out;

    float32 phase = 0.0f;

    void main()
    {
        loop
        {
            let frequencyHz = std::intrinsics::clamp (frequencyHzIn, 1.0f, float32 (processor.frequency) * 0.45f);
            let amplitude = std::intrinsics::clamp (amplitudeIn, 0.0f, 1.0f);
            let sample = amplitude * std::intrinsics::sin (2.0f * wt::chorusPi * phase);
            out <- float32<2> (sample, sample);
            phase = std::intrinsics::wrap (phase + (frequencyHz / float32 (processor.frequency)), 1.0f);
            advance();
        }
    }
}
""".lstrip()


def _build_stereo_splitter_source() -> str:
    return """
processor TrackingRingStereoSplitter
{
    input stream float32<2> in;
    output stream float32 leftOut;

    void main()
    {
        loop
        {
            leftOut <- in[0];
            advance();
        }
    }
}
""".lstrip()


def _build_chorus_tracking_probe_source(scheduled_events: list[tuple[int, str]]) -> str:
    return (
        MSEG_SOURCE.read_text(encoding="utf-8")
        + "\n"
        + FIXED_FRAME_SOURCE.read_text(encoding="utf-8")
        + "\n"
        + CHORUS_SOURCE.read_text(encoding="utf-8")
        + "\n"
        + _wavetable_synth_support_source()
        + "\n"
        + _build_sine_source()
        + _build_stereo_splitter_source()
        + _build_scheduler_source(scheduled_events)
        + "graph ChorusTrackingProbe [[ main ]]\n"
        + "{\n"
        + "    input value float32 playMode [[ init: 0.0f ]];\n"
        + "    input value float32 glideTime [[ init: 0.0f ]];\n"
        + "    input value float32 sourceFrequencyHz [[ init: 1100.0f ]];\n"
        + "    input value float32 sourceAmplitude [[ init: 0.75f ]];\n"
        + "    input value float32 chorusEnabled [[ init: 1.0f ]];\n"
        + "    input value float32 chorusMix [[ init: 1.0f ]];\n"
        + "    input value float32 chorusMotionMode [[ init: 0.0f ]];\n"
        + "    input value float32 chorusBloomMode [[ init: 0.0f ]];\n"
        + "    input value float32 chorusTone [[ init: 0.5f ]];\n"
        + "    input value float32 chorusFeedback [[ init: 0.28f ]];\n"
        + "    input value float32 chorusRingAmount [[ init: 1.0f ]];\n"
        + "    output stream float leftOut;\n"
        + "    node scheduler = TrackingPitchScheduler;\n"
        + "    node dispatcher = wt::NoteDispatcher (4);\n"
        + "    node engine = wt::SharedVoiceEngine (4);\n"
        + "    node source = TrackingRingSineSource;\n"
        + "    node chorus = wt::ChorusBus;\n"
        + "    node splitter = TrackingRingStereoSplitter;\n"
        + "    connection\n"
        + "    {\n"
        + "        scheduler.noteEventOut -> dispatcher.eventIn;\n"
        + "        playMode -> dispatcher.playModeIn;\n"
        + "        dispatcher.voiceEventOut -> engine.voiceEventIn;\n"
        + "        dispatcher.voiceRetuneOut -> engine.voiceRetuneIn;\n"
        + "        glideTime -> engine.glideTimeIn;\n"
        + "        sourceFrequencyHz -> source.frequencyHzIn;\n"
        + "        sourceAmplitude -> source.amplitudeIn;\n"
        + "        source.out -> chorus.in;\n"
        + "        engine.trackingPitchHzOut -> chorus.trackingPitchHzIn;\n"
        + "        chorusEnabled -> chorus.enabledIn;\n"
        + "        chorusMix -> chorus.mixIn;\n"
        + "        chorusMotionMode -> chorus.motionModeIn;\n"
        + "        chorusBloomMode -> chorus.bloomModeIn;\n"
        + "        chorusTone -> chorus.toneIn;\n"
        + "        chorusFeedback -> chorus.feedbackIn;\n"
        + "        chorusRingAmount -> chorus.ringAmountIn;\n"
        + "        chorus.out -> splitter.in;\n"
        + "        splitter.leftOut -> leftOut;\n"
        + "    }\n"
        + "}\n"
    )


def _build_manifest(source_filename: str) -> dict[str, object]:
    return {
        "CmajorVersion": 1,
        "ID": "dev.cosimo.tracking-pitch-probe",
        "version": "1.0",
        "name": "Tracking Pitch Probe",
        "description": "Exercises the shared voice tracking pitch stream",
        "category": "generator",
        "source": source_filename,
    }


def _render_tracking_pitch(
    scheduled_events: list[tuple[int, str]],
    *,
    play_mode: int,
    glide_time: float = 0.0,
    num_samples: int,
) -> np.ndarray:
    with tempfile.TemporaryDirectory(prefix="tracking_pitch_probe_") as temp_dir_name:
        temp_dir = Path(temp_dir_name)
        probe_source_path = temp_dir / "TrackingPitchProbe.cmajor"
        patch_path = temp_dir / "TrackingPitchProbe.cmajorpatch"

        probe_source_path.write_text(
            _build_tracking_pitch_probe_source(scheduled_events),
            encoding="utf-8",
        )
        patch_path.write_text(
            json.dumps(_build_manifest(probe_source_path.name), indent=2) + "\n",
            encoding="utf-8",
        )

        setup_js = "\n".join(
            [
                f"patch.setInputValue_playMode({float(play_mode):.1f}, 0);",
                f"patch.setInputValue_glideTime({float(glide_time):.6f}, 0);",
            ]
        )

        return _render_cmajor_patch_via_generated_javascript(
            patch_path=patch_path,
            sample_rate=DEFAULT_SAMPLE_RATE,
            num_samples=num_samples,
            output_endpoint_id="trackingHz",
            setup_js=setup_js,
        )


def _render_chorus_tracking_audio(
    scheduled_events: list[tuple[int, str]],
    *,
    play_mode: int,
    glide_time: float = 0.0,
    source_frequency_hz: float = 1100.0,
    num_samples: int,
) -> np.ndarray:
    with tempfile.TemporaryDirectory(prefix="chorus_tracking_probe_") as temp_dir_name:
        temp_dir = Path(temp_dir_name)
        probe_source_path = temp_dir / "ChorusTrackingProbe.cmajor"
        patch_path = temp_dir / "ChorusTrackingProbe.cmajorpatch"

        probe_source_path.write_text(
            _build_chorus_tracking_probe_source(scheduled_events),
            encoding="utf-8",
        )
        patch_path.write_text(
            json.dumps(_build_manifest(probe_source_path.name), indent=2) + "\n",
            encoding="utf-8",
        )

        setup_js = "\n".join(
            [
                f"patch.setInputValue_playMode({float(play_mode):.1f}, 0);",
                f"patch.setInputValue_glideTime({float(glide_time):.6f}, 0);",
                f"patch.setInputValue_sourceFrequencyHz({float(source_frequency_hz):.6f}, 0);",
                "patch.setInputValue_sourceAmplitude(0.75, 0);",
                "patch.setInputValue_chorusEnabled(1.0, 0);",
                "patch.setInputValue_chorusMix(1.0, 0);",
                "patch.setInputValue_chorusMotionMode(0.0, 0);",
                "patch.setInputValue_chorusBloomMode(0.0, 0);",
                "patch.setInputValue_chorusTone(0.5, 0);",
                "patch.setInputValue_chorusFeedback(0.28, 0);",
                "patch.setInputValue_chorusRingAmount(1.0, 0);",
            ]
        )

        return _render_cmajor_patch_via_generated_javascript(
            patch_path=patch_path,
            sample_rate=DEFAULT_SAMPLE_RATE,
            num_samples=num_samples,
            output_endpoint_id="leftOut",
            setup_js=setup_js,
        )


def _median_window(signal: np.ndarray, start: int, stop: int) -> float:
    return float(np.median(signal[start:stop]))


def _band_energy_around(audio: np.ndarray, center_hz: float, half_width_hz: float = 22.0) -> float:
    windowed = np.asarray(audio, dtype=np.float64) * np.hanning(audio.size)
    spectrum = np.abs(rfft(windowed)) ** 2
    freqs = rfftfreq(audio.size, d=1.0 / DEFAULT_SAMPLE_RATE)
    mask = (freqs >= center_hz - half_width_hz) & (freqs <= center_hz + half_width_hz)
    return float(np.sum(spectrum[mask]))


@pytest.mark.cmajor
def test_tracking_pitch_uses_most_recent_active_voice() -> None:
    tracking = _render_tracking_pitch(
        [
            (1024, _note_on_expr(1, 60.0)),
            (4096, _note_on_expr(1, 67.0)),
            (8192, _note_off_expr(1, 67.0)),
        ],
        play_mode=PLAY_MODE_POLY,
        num_samples=12_288,
    )

    assert _median_window(tracking, 2048, 3072) == pytest.approx(_note_to_frequency(60.0), abs=1.0)
    assert _median_window(tracking, 5120, 6144) == pytest.approx(_note_to_frequency(67.0), abs=1.5)
    assert _median_window(tracking, 9216, 10_240) == pytest.approx(_note_to_frequency(60.0), abs=1.0)


@pytest.mark.cmajor
def test_tracking_pitch_follows_mono_legato_glide() -> None:
    tracking = _render_tracking_pitch(
        [
            (1024, _note_on_expr(1, 60.0)),
            (4096, _note_on_expr(1, 72.0)),
        ],
        play_mode=PLAY_MODE_LEGATO,
        glide_time=0.100,
        num_samples=12_288,
    )

    c4 = _note_to_frequency(60.0)
    c5 = _note_to_frequency(72.0)
    early = _median_window(tracking, 2048, 3072)
    mid_glide = _median_window(tracking, 5200, 5400)
    late = _median_window(tracking, 10_500, 11_500)

    assert early == pytest.approx(c4, abs=1.0)
    assert c4 * 1.05 < mid_glide < c5 * 0.95
    assert late == pytest.approx(c5, abs=2.0)


@pytest.mark.cmajor
def test_tracking_pitch_follows_pitch_bend() -> None:
    tracking = _render_tracking_pitch(
        [
            (1024, _note_on_expr(1, 60.0)),
            (4096, _pitch_bend_expr(1, 12.0)),
        ],
        play_mode=PLAY_MODE_POLY,
        num_samples=8192,
    )

    assert _median_window(tracking, 2048, 3072) == pytest.approx(_note_to_frequency(60.0), abs=1.0)
    assert _median_window(tracking, 5120, 6144) == pytest.approx(_note_to_frequency(72.0), abs=1.5)


@pytest.mark.cmajor
def test_chorus_ring_uses_realized_voice_engine_pitch_for_sidebands() -> None:
    source_hz = 1100.0
    c4_sideband_hz = source_hz - (_note_to_frequency(60.0) * CHORUS_RING_OFFSET_RATIO)
    c5_sideband_hz = source_hz - (_note_to_frequency(72.0) * CHORUS_RING_OFFSET_RATIO)
    audio = _render_chorus_tracking_audio(
        [
            (1024, _note_on_expr(1, 60.0)),
            (32_768, _pitch_bend_expr(1, 12.0)),
        ],
        play_mode=PLAY_MODE_POLY,
        source_frequency_hz=source_hz,
        num_samples=65_536,
    )

    before_bend = audio[12_000:28_000]
    after_bend = audio[45_000:61_000]

    assert _band_energy_around(before_bend, c4_sideband_hz) > _band_energy_around(before_bend, c5_sideband_hz) * 2.0
    assert _band_energy_around(after_bend, c5_sideband_hz) > _band_energy_around(after_bend, c4_sideband_hz) * 2.0
