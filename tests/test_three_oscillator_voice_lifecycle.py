from __future__ import annotations

import json
from pathlib import Path
import tempfile

import pytest

from bench import DEFAULT_SAMPLE_RATE, _collect_cmajor_output_events_via_generated_javascript


REPO_ROOT = Path(__file__).resolve().parents[1]
MSEG_SOURCE = REPO_ROOT / "cmajor" / "Mseg.cmajor"
FIXED_FRAME_SOURCE = REPO_ROOT / "cmajor" / "FixedFrameOscillator.cmajor"
VOICE_REDUCER_SOURCE = REPO_ROOT / "cmajor" / "VoiceReducer.cmajor"


def _probe_source() -> str:
    return (
        MSEG_SOURCE.read_text(encoding="utf-8")
        + "\n"
        + FIXED_FRAME_SOURCE.read_text(encoding="utf-8")
        + "\n"
        + VOICE_REDUCER_SOURCE.read_text(encoding="utf-8")
        + r"""
processor ThreeOscillatorLifecycleSchedule
{
    output event (std::notes::NoteOn,
                  std::notes::NoteOff,
                  std::notes::PitchBend) voice0Out;
    output event std::notes::NoteOn voice1Out;
    output event wt::VoiceRetune voice1RetuneOut;
    int32 frameCounter;

    void main()
    {
        loop
        {
            if (frameCounter == 64)
                voice0Out <- std::notes::NoteOn (2, 60.0f, 0.8f);

            if (frameCounter == 128)
                voice1Out <- std::notes::NoteOn (3, 64.0f, 0.7f);

            // This is the exact engine-side sequence used when an allocator steals:
            // the old note leaves and the replacement starts on the same note slot.
            if (frameCounter == 192)
            {
                voice0Out <- std::notes::NoteOff (2, 60.0f, 0.0f);
                voice0Out <- std::notes::NoteOn (4, 67.0f, 0.9f);
            }

            if (frameCounter == 256)
            {
                wt::VoiceRetune retune;
                retune.channel = 5;
                retune.pitch = 72.0f;
                retune.velocity = 0.6f;
                retune.bendSemitones = 1.5f;
                retune.pressure = 0.4f;
                retune.slide = 0.3f;
                retune.retrigger = true;
                retune.glide = false;
                retune.hasArticulation = false;
                retune.selectorA = wt::articulationSelectorNone;
                retune.selectorB = 0;
                retune.durationSamples = 0;
                retune.ageSamples = 0;
                voice1RetuneOut <- retune;
            }

            // MPE expression changes the common note pitch without creating or
            // resetting only one member of the oscillator bundle.
            if (frameCounter == 320)
                voice0Out <- std::notes::PitchBend (4, 2.0f);

            frameCounter += 1;
            advance();
        }
    }
}

graph ThreeOscillatorLifecycleProbe [[ main ]]
{
    input value float32 oscillatorPhase [[ init: 0.125f ]];
    input value float32 oscillatorRandom [[ init: 0.75f ]];
    input value float32 oscillatorRetrigger [[ init: 1.0f ]];
    input value float32 unisonVoices [[ init: 8.0f ]];
    output event wt::OscillatorVoiceStartMonitor lifecycleStart;

    node schedule = ThreeOscillatorLifecycleSchedule;
    node engine = wt::SharedVoiceEngine (2);

    connection
    {
        schedule.voice0Out -> engine.voiceEventIn[0];
        schedule.voice1Out -> engine.voiceEventIn[1];
        schedule.voice1RetuneOut -> engine.voiceRetuneIn[1];
        oscillatorPhase -> engine.unisonPhaseIn;
        oscillatorRandom -> engine.unisonRandomIn;
        oscillatorRetrigger -> engine.unisonPhaseModeIn;
        unisonVoices -> engine.unisonVoicesIn;
        engine.oscillatorVoiceStartOut -> lifecycleStart;
    }
}
"""
    )


def _collect_starts() -> list[dict[str, object]]:
    with tempfile.TemporaryDirectory(prefix="three_osc_lifecycle_") as directory_name:
        directory = Path(directory_name)
        source_path = directory / "ThreeOscillatorLifecycleProbe.cmajor"
        patch_path = directory / "ThreeOscillatorLifecycleProbe.cmajorpatch"
        source_path.write_text(_probe_source(), encoding="utf-8")
        patch_path.write_text(
            json.dumps(
                {
                    "CmajorVersion": 1,
                    "ID": "dev.cosimo.three-oscillator-lifecycle-probe",
                    "version": "1.0",
                    "name": "Three Oscillator Lifecycle Probe",
                    "category": "generator",
                    "source": source_path.name,
                },
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
        return _collect_cmajor_output_events_via_generated_javascript(
            patch_path=patch_path,
            sample_rate=DEFAULT_SAMPLE_RATE,
            num_samples=1024,
            output_endpoint_id="lifecycleStart",
            setup_js="\n".join(
                (
                    "patch.setInputValue_oscillatorPhase(0.125, 0);",
                    "patch.setInputValue_oscillatorRandom(0.75, 0);",
                    "patch.setInputValue_oscillatorRetrigger(1.0, 0);",
                    "patch.setInputValue_unisonVoices(8.0, 0);",
                )
            ),
        )


@pytest.mark.cmajor
def test_note_start_steal_and_retrigger_reset_one_atomic_abc_bundle() -> None:
    starts = [entry["event"] for entry in _collect_starts()]

    # Four note starts/retriggers, each emitting exactly A, B and C.
    assert len(starts) == 12
    groups = [starts[index : index + 3] for index in range(0, len(starts), 3)]
    expected = [
        (0, 1, 2, 60.0),
        (1, 2, 3, 64.0),
        (0, 3, 4, 67.0),
        (1, 4, 5, 72.0),
    ]

    for group, (voice, generation, channel, pitch) in zip(groups, expected, strict=True):
        assert [int(event["oscillatorIndex"]) for event in group] == [0, 1, 2]
        assert {int(event["voiceIndex"]) for event in group} == {voice}
        assert {int(event["voiceGeneration"]) for event in group} == {generation}
        assert {int(event["channel"]) for event in group} == {channel}
        assert all(float(event["pitch"]) == pytest.approx(pitch) for event in group)

        first_phases = [float(event["firstUnisonPhase"]) for event in group]
        last_phases = [float(event["lastUnisonPhase"]) for event in group]
        assert all(0.0 <= phase < 1.0 for phase in first_phases + last_phases)
        assert len({round(phase, 6) for phase in first_phases}) == 3
        assert len({round(phase, 6) for phase in last_phases}) == 3

    # The later pitch-bend is note-level MPE state, so it must not start/reset a
    # partial oscillator bundle.
    assert max(int(event["voiceGeneration"]) for event in starts) == 4
