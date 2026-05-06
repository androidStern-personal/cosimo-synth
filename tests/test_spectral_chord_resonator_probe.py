from __future__ import annotations

import json
import math
import re
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pytest


ROOT = Path(__file__).resolve().parents[1]
PATCH_PATH = ROOT / "fx" / "spectral_chord_resonator" / "SpectralChordResonator.cmajorpatch"
SPECTRAL_SOURCE_PATH = ROOT / "fx" / "spectral_chord_resonator" / "SpectralChordResonator.cmajor"
ENSURE_CMAJOR_RUNTIME = ROOT / "scripts" / "ensure_cmajor_runtime.py"
SAMPLE_RATE = 48_000
FFT_SIZE = 2048


@dataclass(frozen=True)
class GeneratedRuntime:
    runtime_path: Path
    render_script_path: Path


def _require_tool(name: str) -> str:
    path = shutil.which(name)
    if path is None:
        pytest.skip(f"{name} is required for Spectral Chord Resonator render tests")
    return path


def _midi_note_on(note: int, velocity: int = 100) -> dict[str, int]:
    return {"message": (0x90 << 16) | (int(note) << 8) | int(velocity)}


def _event(endpoint_id: str, payload: float | dict[str, int]) -> list[object]:
    return ["event", endpoint_id, payload]


def _partial_shape_upload(count: int, strengths: list[float]) -> dict[str, object]:
    values = [0.0] * 64
    for index, value in enumerate(strengths[:64]):
        values[index] = float(value)

    return {
        "count": int(count),
        "strengths": values,
    }


def _base_events(**overrides: float) -> list[list[object]]:
    values = {
        "magFeedbackIn": 0.0,
        "phaseFeedbackIn": 0.0,
        "dampingIn": 0.995,
        "maskWidthCentsIn": 40.0,
        "maskFloorIn": 1.0,
        "magCeilingIn": 1000.0,
        "depthIn": 1.0,
        "lowCutHzIn": 20.0,
    }
    values.update(overrides)
    return [_event(endpoint_id, value) for endpoint_id, value in values.items()]


def _write_f32(path: Path, audio: np.ndarray) -> None:
    np.asarray(audio, dtype=np.float32).tofile(path)


def _as_stereo_source(source: np.ndarray) -> np.ndarray:
    audio = np.asarray(source, dtype=np.float32)

    if audio.ndim == 1:
        return np.stack([audio, audio])

    if audio.ndim == 2 and audio.shape[0] == 2:
        return audio

    if audio.ndim == 2 and audio.shape[1] == 2:
        return audio.T

    raise AssertionError(f"Expected mono or stereo source audio, got shape {audio.shape}")


def _deterministic_probe_signal(num_samples: int, *, amplitude: float = 0.24) -> np.ndarray:
    t = np.arange(num_samples, dtype=np.float64) / SAMPLE_RATE
    signal = (
        0.42 * np.sin(2.0 * np.pi * 173.0 * t)
        + 0.31 * np.sin(2.0 * np.pi * 797.0 * t + 0.21)
        + 0.19 * np.sin(2.0 * np.pi * 2311.0 * t + 0.73)
        + 0.11 * np.sin(2.0 * np.pi * 6137.0 * t + 1.13)
    )
    return (amplitude * signal / np.max(np.abs(signal))).astype(np.float32)


def _rms(signal: np.ndarray) -> float:
    return float(np.sqrt(np.mean(np.square(signal, dtype=np.float64))))


def _spectral_band_energy(signal: np.ndarray, center_hz: float, *, radius_hz: float = 8.0) -> float:
    window = np.hanning(signal.size)
    spectrum = np.fft.rfft(signal * window)
    frequencies = np.fft.rfftfreq(signal.size, 1.0 / SAMPLE_RATE)
    band = (frequencies >= center_hz - radius_hz) & (frequencies <= center_hz + radius_hz)
    return float(np.sum(np.abs(spectrum[band]) ** 2))


@pytest.fixture(scope="module")
def generated_runtime(tmp_path_factory: pytest.TempPathFactory) -> GeneratedRuntime:
    cmaj = _require_tool("cmaj")
    _require_tool("node")

    temp_dir = tmp_path_factory.mktemp("spectral_chord_resonator_js")
    runtime_path = temp_dir / "runtime.cjs"
    render_script_path = temp_dir / "render.cjs"

    result = subprocess.run(
        [
            cmaj,
            "generate",
            "--target=javascript",
            f"--output={runtime_path}",
            str(PATCH_PATH),
        ],
        cwd=PATCH_PATH.parent,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        details = "\n".join(part for part in (result.stdout.strip(), result.stderr.strip()) if part)
        raise AssertionError(f"cmaj generate failed for {PATCH_PATH}:\n{details}")

    runtime_source = runtime_path.read_text(encoding="utf-8")
    class_match = re.search(r"^class\s+([A-Za-z_][A-Za-z0-9_]*)", runtime_source, re.MULTILINE)
    if class_match is None:
        raise AssertionError("Could not find the generated Cmajor JavaScript class name")

    runtime_path.write_text(
        runtime_source + f"\nmodule.exports = {class_match.group(1)};\n",
        encoding="utf-8",
    )

    render_script_path.write_text(
        """
const fs = require("fs");

const RuntimeClass = require(process.argv[2]);
const sourcePath = process.argv[3];
const schedulePath = process.argv[4];
const outputPath = process.argv[5];
const numFrames = Number(process.argv[6]);
const sampleRate = Number(process.argv[7]);
const sourceChannelCount = Number(process.argv[8] || "1");

const sourceBuffer = fs.readFileSync(sourcePath);
const source = new Float32Array(
    sourceBuffer.buffer,
    sourceBuffer.byteOffset,
    sourceBuffer.byteLength / Float32Array.BYTES_PER_ELEMENT
);
const schedule = JSON.parse(fs.readFileSync(schedulePath, "utf8"));

(async () => {
    const patch = new RuntimeClass();
    await patch.initialise(4, sampleRate);

    const outputLeft = new Float32Array(numFrames);
    const outputRight = new Float32Array(numFrames);
    const offsets = Object.keys(schedule).map((value) => Number(value)).sort((a, b) => a - b);
    let nextOffsetIndex = 0;
    let cursor = 0;

    function applyScheduledInputs(frameOffset) {
        const entries = schedule[String(frameOffset)] || [];

        for (const [kind, endpointID, payload] of entries) {
            if (kind !== "event")
                throw new Error(`Unsupported scheduled input kind: ${kind}`);

            patch[`sendInputEvent_${endpointID}`](payload);
        }
    }

    while (nextOffsetIndex < offsets.length && offsets[nextOffsetIndex] === 0) {
        applyScheduledInputs(0);
        nextOffsetIndex += 1;
    }

    while (cursor < numFrames) {
        if (nextOffsetIndex < offsets.length && offsets[nextOffsetIndex] <= cursor) {
            const eventOffset = offsets[nextOffsetIndex];

            if (eventOffset < cursor)
                throw new Error(`Scheduled input at frame ${eventOffset} was passed at cursor ${cursor}`);

            applyScheduledInputs(eventOffset);
            nextOffsetIndex += 1;
            continue;
        }

        const nextOffset = nextOffsetIndex < offsets.length ? offsets[nextOffsetIndex] : numFrames;
        const framesUntilNextOffset = nextOffset > cursor ? nextOffset - cursor : 0;
        const framesThisBlock = Math.min(
            framesUntilNextOffset > 0 ? framesUntilNextOffset : numFrames - cursor,
            numFrames - cursor,
            512
        );

        if (framesThisBlock > 0) {
            const sourceLeft = new Float32Array(framesThisBlock);
            const sourceRight = new Float32Array(framesThisBlock);

            for (let index = 0; index < framesThisBlock; index += 1) {
                const left = source[cursor + index] ?? 0;
                const right = sourceChannelCount > 1
                    ? source[numFrames + cursor + index] ?? 0
                    : left;
                sourceLeft[index] = left;
                sourceRight[index] = right;
            }

            patch.setInputStreamFrames_audioIn([sourceLeft, sourceRight], framesThisBlock, 0);
            patch.advance(framesThisBlock);

            const outLeft = new Float32Array(framesThisBlock);
            const outRight = new Float32Array(framesThisBlock);
            patch.getOutputFrames_audioOut([outLeft, outRight], framesThisBlock, 0);
            outputLeft.set(outLeft, cursor);
            outputRight.set(outRight, cursor);
            cursor += framesThisBlock;
        } else {
            applyScheduledInputs(nextOffset);
            nextOffsetIndex += 1;
        }
    }

    const output = new Float32Array(numFrames * 2);
    output.set(outputLeft, 0);
    output.set(outputRight, numFrames);
    fs.writeFileSync(outputPath, Buffer.from(output.buffer, output.byteOffset, output.byteLength));
})().catch((error) => {
    console.error(error?.stack || String(error));
    process.exit(1);
});
""".lstrip(),
        encoding="utf-8",
    )

    return GeneratedRuntime(runtime_path=runtime_path, render_script_path=render_script_path)


def _render_stereo(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
    source: np.ndarray,
    schedule: dict[int, list[list[object]]],
) -> np.ndarray:
    node = _require_tool("node")
    source_channels = _as_stereo_source(source)
    num_frames = source_channels.shape[1]
    source_path = tmp_path / "source.f32"
    schedule_path = tmp_path / "schedule.json"
    output_path = tmp_path / "output.f32"

    _write_f32(source_path, source_channels)
    schedule_path.write_text(
        json.dumps({str(int(offset)): entries for offset, entries in schedule.items()}, indent=2) + "\n",
        encoding="utf-8",
    )

    result = subprocess.run(
        [
            node,
            str(generated_runtime.render_script_path),
            str(generated_runtime.runtime_path),
            str(source_path),
            str(schedule_path),
            str(output_path),
            str(int(num_frames)),
            str(SAMPLE_RATE),
            str(int(source_channels.shape[0])),
        ],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        details = "\n".join(part for part in (result.stdout.strip(), result.stderr.strip()) if part)
        raise AssertionError(f"node runtime render failed:\n{details}")

    rendered = np.fromfile(output_path, dtype=np.float32).reshape(2, num_frames)
    assert rendered.shape == source_channels.shape
    return rendered


def _render(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
    source: np.ndarray,
    schedule: dict[int, list[list[object]]],
) -> np.ndarray:
    rendered = _render_stereo(generated_runtime, tmp_path, source, schedule)

    if np.asarray(source).ndim == 1:
        assert np.max(np.abs(rendered[0] - rendered[1])) <= 1.0e-7

    return rendered[0]


def test_depth_zero_is_sample_accurate_audio_input_passthrough(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    sidechain = _deterministic_probe_signal(16_384, amplitude=0.73)
    rendered = _render(
        generated_runtime,
        tmp_path,
        sidechain,
        {0: _base_events(depthIn=0.0, magFeedbackIn=0.999, phaseFeedbackIn=1.0)},
    )

    error = rendered - sidechain
    assert np.isfinite(rendered).all()
    assert np.max(np.abs(sidechain)) > 0.7
    assert np.max(np.abs(error)) <= 1.0e-7


def test_depth_zero_preserves_different_stereo_audio_input_channels(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    left = _deterministic_probe_signal(16_384, amplitude=0.73)
    right = np.roll(_deterministic_probe_signal(16_384, amplitude=0.41), 37)
    sidechain = np.stack([left, right])
    rendered = _render_stereo(
        generated_runtime,
        tmp_path,
        sidechain,
        {0: _base_events(depthIn=0.0, magFeedbackIn=0.999, phaseFeedbackIn=1.0)},
    )

    assert np.isfinite(rendered).all()
    assert np.max(np.abs(rendered[0] - left)) <= 1.0e-7
    assert np.max(np.abs(rendered[1] - right)) <= 1.0e-7
    assert np.max(np.abs(rendered[0] - rendered[1])) > 0.1


def test_feedback_zero_reconstructs_audio_input_after_fft_latency(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    sidechain = _deterministic_probe_signal(65_536, amplitude=0.18)
    rendered = _render(
        generated_runtime,
        tmp_path,
        sidechain,
        {0: _base_events(depthIn=1.0, magFeedbackIn=0.0, phaseFeedbackIn=0.0, maskFloorIn=1.0)},
    )

    dry = sidechain[:-FFT_SIZE]
    wet = rendered[FFT_SIZE:]
    settled = slice(FFT_SIZE * 3, None)
    dry_settled = dry[settled]
    wet_settled = wet[settled]
    error = wet_settled - dry_settled
    signal_rms = float(np.sqrt(np.mean(np.square(dry_settled, dtype=np.float64))))
    error_rms = float(np.sqrt(np.mean(np.square(error, dtype=np.float64))))
    gain_db = 20.0 * math.log10(
        float(np.sqrt(np.mean(np.square(wet_settled, dtype=np.float64)))) / signal_rms
    )

    assert np.isfinite(rendered).all()
    assert abs(gain_db) <= 0.5
    assert error_rms / signal_rms <= 0.08


def test_single_click_resonates_at_held_midi_pitch(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    sidechain = np.zeros(SAMPLE_RATE * 3, dtype=np.float32)
    sidechain[0] = 1.0
    rendered = _render(
        generated_runtime,
        tmp_path,
        sidechain,
        {
            0: _base_events(
                depthIn=1.0,
                magFeedbackIn=0.95,
                phaseFeedbackIn=1.0,
                dampingIn=0.999,
                maskFloorIn=0.0,
                maskWidthCentsIn=200.0,
                lowCutHzIn=20.0,
                magCeilingIn=1000.0,
            )
            + [
                _event("partialShapeUpload", _partial_shape_upload(1, [1.0])),
                _event("midiIn", _midi_note_on(57)),
            ],
        },
    )

    tail = rendered[int(0.2 * SAMPLE_RATE): SAMPLE_RATE]
    window = np.hanning(tail.size)
    spectrum = np.fft.rfft(tail * window)
    frequencies = np.fft.rfftfreq(tail.size, 1.0 / SAMPLE_RATE)
    search = (frequencies >= 180.0) & (frequencies <= 260.0)
    peak_frequency = float(frequencies[search][np.argmax(np.abs(spectrum[search]))])
    cents_error = 1200.0 * math.log2(peak_frequency / 220.0)

    assert np.isfinite(rendered).all()
    assert float(np.sqrt(np.mean(np.square(tail, dtype=np.float64)))) > 1.0e-4
    assert abs(cents_error) <= 5.0


def test_mono_voice_mode_retunes_existing_resonator_state_for_fast_arps(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    sidechain = np.zeros(SAMPLE_RATE * 2, dtype=np.float32)
    sidechain[0] = 1.0
    note_offsets = {
        0: 57,
        int(0.125 * SAMPLE_RATE): 60,
        int(0.250 * SAMPLE_RATE): 64,
        int(0.375 * SAMPLE_RATE): 69,
    }

    def render_for_mode(name: str, voice_mode: float) -> np.ndarray:
        render_dir = tmp_path / name
        render_dir.mkdir()
        schedule: dict[int, list[list[object]]] = {
            0: _base_events(
                depthIn=1.0,
                magFeedbackIn=0.97,
                phaseFeedbackIn=1.0,
                dampingIn=0.999,
                maskFloorIn=0.0,
                maskWidthCentsIn=200.0,
                lowCutHzIn=20.0,
                magCeilingIn=1000.0,
                voiceModeIn=voice_mode,
            )
            + [_event("partialShapeUpload", _partial_shape_upload(1, [1.0]))],
        }

        for offset, note in note_offsets.items():
            schedule.setdefault(offset, []).append(_event("midiIn", _midi_note_on(note)))

        return _render(generated_runtime, render_dir, sidechain, schedule)

    poly = render_for_mode("poly", 0.0)
    mono = render_for_mode("mono", 1.0)
    tail = slice(int(0.7 * SAMPLE_RATE), int(1.5 * SAMPLE_RATE))
    poly_old_pitch = _spectral_band_energy(poly[tail], 220.0)
    poly_final_pitch = _spectral_band_energy(poly[tail], 440.0)
    mono_old_pitch = _spectral_band_energy(mono[tail], 220.0)
    mono_final_pitch = _spectral_band_energy(mono[tail], 440.0)

    assert np.isfinite(poly).all()
    assert np.isfinite(mono).all()
    assert poly_old_pitch > poly_final_pitch * 4.0
    assert mono_final_pitch > mono_old_pitch * 4.0
    assert mono_final_pitch > poly_final_pitch * 4.0


def test_switching_to_mono_preserves_a_held_note_after_feedback_changes(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    source = np.zeros(SAMPLE_RATE * 3, dtype=np.float32)
    source[0] = 1.0
    source[int(0.8 * SAMPLE_RATE)] = 1.0
    rendered = _render(
        generated_runtime,
        tmp_path,
        source,
        {
            0: _base_events(
                depthIn=1.0,
                magFeedbackIn=0.97,
                phaseFeedbackIn=1.0,
                dampingIn=0.999,
                maskFloorIn=0.0,
                maskWidthCentsIn=200.0,
                lowCutHzIn=20.0,
                magCeilingIn=1000.0,
            )
            + [
                _event("partialShapeUpload", _partial_shape_upload(1, [1.0])),
                _event("midiIn", _midi_note_on(57)),
            ],
            int(0.2 * SAMPLE_RATE): [
                _event("midiIn", _midi_note_on(64)),
            ],
            int(0.6 * SAMPLE_RATE): [
                _event("voiceModeIn", 1.0),
            ],
            int(0.65 * SAMPLE_RATE): [
                _event("magFeedbackIn", 0.965),
            ],
        },
    )

    tail = rendered[int(1.0 * SAMPLE_RATE): int(1.8 * SAMPLE_RATE)]
    retained_note_energy = _spectral_band_energy(tail, 329.6276)
    old_note_energy = _spectral_band_energy(tail, 220.0)

    assert np.isfinite(rendered).all()
    assert _rms(tail) > 1.0e-4
    assert retained_note_energy > old_note_energy * 2.0
    assert retained_note_energy > 1.0e-5


def test_feedback_change_keeps_existing_held_note_resonating(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    source = np.zeros(SAMPLE_RATE * 3, dtype=np.float32)
    source[0] = 1.0
    source[int(0.8 * SAMPLE_RATE)] = 1.0
    rendered = _render(
        generated_runtime,
        tmp_path,
        source,
        {
            0: _base_events(
                depthIn=1.0,
                magFeedbackIn=0.97,
                phaseFeedbackIn=1.0,
                dampingIn=0.999,
                maskFloorIn=0.0,
                maskWidthCentsIn=200.0,
                lowCutHzIn=20.0,
                magCeilingIn=1000.0,
            )
            + [
                _event("partialShapeUpload", _partial_shape_upload(1, [1.0])),
                _event("midiIn", _midi_note_on(57)),
            ],
            int(0.65 * SAMPLE_RATE): [
                _event("magFeedbackIn", 0.965),
            ],
        },
    )

    tail = rendered[int(1.0 * SAMPLE_RATE): int(1.8 * SAMPLE_RATE)]
    held_note_energy = _spectral_band_energy(tail, 220.0)

    assert np.isfinite(rendered).all()
    assert _rms(tail) > 1.0e-4
    assert held_note_energy > 1.0e-5


def test_stereo_resonator_state_is_independent_per_channel(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    left = np.zeros(SAMPLE_RATE * 3, dtype=np.float32)
    right = np.zeros(SAMPLE_RATE * 3, dtype=np.float32)
    left[0] = 1.0
    rendered = _render_stereo(
        generated_runtime,
        tmp_path,
        np.stack([left, right]),
        {
            0: _base_events(
                depthIn=1.0,
                magFeedbackIn=0.95,
                phaseFeedbackIn=1.0,
                dampingIn=0.999,
                maskFloorIn=0.0,
                maskWidthCentsIn=200.0,
                lowCutHzIn=20.0,
                magCeilingIn=1000.0,
            )
            + [
                _event("partialShapeUpload", _partial_shape_upload(1, [1.0])),
                _event("midiIn", _midi_note_on(57)),
            ],
        },
    )

    left_tail = rendered[0, int(0.2 * SAMPLE_RATE): SAMPLE_RATE]
    right_tail = rendered[1, int(0.2 * SAMPLE_RATE): SAMPLE_RATE]

    assert np.isfinite(rendered).all()
    assert _rms(left_tail) > 1.0e-4
    assert float(np.max(np.abs(right_tail))) <= 1.0e-8


def test_maximum_parameters_stay_finite_and_bounded(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    rng = np.random.default_rng(17)
    sidechain = rng.uniform(-1.0, 1.0, SAMPLE_RATE * 10).astype(np.float32)
    rendered = _render(
        generated_runtime,
        tmp_path,
        sidechain,
        {
            0: _base_events(
                depthIn=1.0,
                magFeedbackIn=0.999,
                phaseFeedbackIn=1.0,
                dampingIn=1.0,
                maskFloorIn=1.0,
                maskWidthCentsIn=200.0,
                lowCutHzIn=20.0,
                magCeilingIn=1000.0,
            )
            + [
                _event("partialShapeUpload", _partial_shape_upload(64, [1.0] * 64)),
                _event("midiIn", _midi_note_on(48)),
                _event("midiIn", _midi_note_on(52)),
                _event("midiIn", _midi_note_on(55)),
            ],
        },
    )

    settled = rendered[int(0.1 * SAMPLE_RATE):]
    wet_limit = 1000.0 / FFT_SIZE

    assert np.isfinite(rendered).all()
    assert float(np.max(np.abs(rendered))) <= 1.0
    assert float(np.max(np.abs(settled))) <= wet_limit + 1.0e-6
    assert _rms(settled) > 1.0e-5


def test_partial_shape_upload_changes_resonating_harmonic_energy(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    sidechain = np.zeros(SAMPLE_RATE * 3, dtype=np.float32)
    sidechain[0] = 1.0
    common_events = _base_events(
        depthIn=1.0,
        magFeedbackIn=0.97,
        phaseFeedbackIn=1.0,
        dampingIn=0.999,
        maskFloorIn=0.0,
        maskWidthCentsIn=120.0,
        lowCutHzIn=20.0,
        magCeilingIn=1000.0,
    ) + [_event("midiIn", _midi_note_on(57))]
    fundamental_dir = tmp_path / "fundamental"
    flat_dir = tmp_path / "flat"
    fundamental_dir.mkdir()
    flat_dir.mkdir()

    fundamental_only = _render(
        generated_runtime,
        fundamental_dir,
        sidechain,
        {
            0: common_events + [_event("partialShapeUpload", _partial_shape_upload(2, [1.0, 0.0]))],
        },
    )
    flat_two_partials = _render(
        generated_runtime,
        flat_dir,
        sidechain,
        {
            0: common_events + [_event("partialShapeUpload", _partial_shape_upload(2, [1.0, 1.0]))],
        },
    )

    tail = slice(int(0.25 * SAMPLE_RATE), int(1.4 * SAMPLE_RATE))
    second_harmonic_suppressed = _spectral_band_energy(fundamental_only[tail], 440.0)
    second_harmonic_enabled = _spectral_band_energy(flat_two_partials[tail], 440.0)

    assert np.isfinite(fundamental_only).all()
    assert np.isfinite(flat_two_partials).all()
    assert second_harmonic_enabled > second_harmonic_suppressed * 3.0


def test_many_partial_shape_is_not_a_linear_gain_multiplier(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    sidechain = np.zeros(SAMPLE_RATE * 3, dtype=np.float32)
    sidechain[0] = 1.0
    common_events = _base_events(
        depthIn=1.0,
        magFeedbackIn=0.97,
        phaseFeedbackIn=1.0,
        dampingIn=0.999,
        maskFloorIn=0.0,
        maskWidthCentsIn=120.0,
        lowCutHzIn=20.0,
        magCeilingIn=1000.0,
    ) + [_event("midiIn", _midi_note_on(57))]
    fundamental_dir = tmp_path / "fundamental"
    flat_dir = tmp_path / "flat_32"
    fundamental_dir.mkdir()
    flat_dir.mkdir()

    fundamental_only = _render(
        generated_runtime,
        fundamental_dir,
        sidechain,
        {
            0: common_events + [_event("partialShapeUpload", _partial_shape_upload(1, [1.0]))],
        },
    )
    flat_32_partials = _render(
        generated_runtime,
        flat_dir,
        sidechain,
        {
            0: common_events + [_event("partialShapeUpload", _partial_shape_upload(32, [1.0] * 32))],
        },
    )

    tail = slice(int(0.25 * SAMPLE_RATE), int(1.4 * SAMPLE_RATE))
    fundamental_rms = _rms(fundamental_only[tail])
    flat_rms = _rms(flat_32_partials[tail])
    wet_limit = 1000.0 / FFT_SIZE

    assert np.isfinite(fundamental_only).all()
    assert np.isfinite(flat_32_partials).all()
    assert fundamental_rms > 1.0e-5
    assert flat_rms > fundamental_rms * 0.25
    assert flat_rms <= fundamental_rms * 4.0
    assert float(np.max(np.abs(flat_32_partials[tail]))) < wet_limit * 0.98


def test_pinned_cmajor_runtime_splits_audio_inputs_into_host_buses() -> None:
    result = subprocess.run(
        ["python3", str(ENSURE_CMAJOR_RUNTIME), "--path"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        details = "\n".join(part for part in (result.stdout.strip(), result.stderr.strip()) if part)
        raise AssertionError(f"Could not prepare pinned Cmajor runtime:\n{details}")

    runtime_root = Path(result.stdout.strip())
    header = runtime_root / "include" / "cmajor" / "helpers" / "cmaj_JUCEPlugin.h"
    header_text = header.read_text(encoding="utf-8")

    assert "COSIMO_CMAJOR_JUCE_PLUGIN_SPLIT_INPUT_BUSES" in header_text
    assert "addInputEndpointBuses" in header_text
    assert 'audioBusIndex == 0 ? "Input" : "Sidechain"' in header_text
    assert "countAudioChannels (layout.inputBuses)" in header_text
    assert "layout.getMainInputChannels()" not in header_text


def test_spectral_reserves_host_parameter_slot_zero_away_from_magnitude_feedback() -> None:
    source = SPECTRAL_SOURCE_PATH.read_text(encoding="utf-8")
    graph_start = source.index("graph SpectralChordResonatorPlugin")
    graph_source = source[graph_start:]
    parameter_pattern = re.compile(
        r"^\s*input\s+(?:value|event)\s+(?:float32|int32|bool)\b(?:<[^>]+>)?\s+"
        r"(?P<identifier>[A-Za-z_][A-Za-z0-9_]*)\s+\[\[(?P<annotation>[^\]]*)\]\];",
        re.MULTILINE,
    )
    parameters = [
        match.groupdict()
        for match in parameter_pattern.finditer(graph_source)
        if "name:" in match.group("annotation")
    ]

    assert parameters[0]["identifier"] == "hostSlot0Guard"
    assert re.search(r'name:\s*"Host Slot 0 Guard"', parameters[0]["annotation"])
    assert re.search(r"hidden:\s*true", parameters[0]["annotation"])
    assert re.search(r"automatable:\s*false", parameters[0]["annotation"])
    assert parameters[1]["identifier"] == "magFeedbackIn"
