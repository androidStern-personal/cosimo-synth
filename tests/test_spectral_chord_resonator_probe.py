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


def _base_events(**overrides: float) -> list[list[object]]:
    values = {
        "magFeedbackIn": 0.0,
        "phaseFeedbackIn": 0.0,
        "dampingIn": 0.995,
        "maskWidthCentsIn": 40.0,
        "maskFloorIn": 1.0,
        "harmonicCountIn": 1.0,
        "harmonicRolloffDbIn": 0.0,
        "magCeilingIn": 1000.0,
        "depthIn": 1.0,
        "lowCutHzIn": 20.0,
    }
    values.update(overrides)
    return [_event(endpoint_id, value) for endpoint_id, value in values.items()]


def _write_f32(path: Path, audio: np.ndarray) -> None:
    np.asarray(audio, dtype=np.float32).tofile(path)


def _deterministic_probe_signal(num_samples: int, *, amplitude: float = 0.24) -> np.ndarray:
    t = np.arange(num_samples, dtype=np.float64) / SAMPLE_RATE
    signal = (
        0.42 * np.sin(2.0 * np.pi * 173.0 * t)
        + 0.31 * np.sin(2.0 * np.pi * 797.0 * t + 0.21)
        + 0.19 * np.sin(2.0 * np.pi * 2311.0 * t + 0.73)
        + 0.11 * np.sin(2.0 * np.pi * 6137.0 * t + 1.13)
    )
    return (amplitude * signal / np.max(np.abs(signal))).astype(np.float32)


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
const sidechainPath = process.argv[3];
const schedulePath = process.argv[4];
const outputPath = process.argv[5];
const numFrames = Number(process.argv[6]);
const sampleRate = Number(process.argv[7]);

const sidechainBuffer = fs.readFileSync(sidechainPath);
const sidechain = new Float32Array(
    sidechainBuffer.buffer,
    sidechainBuffer.byteOffset,
    sidechainBuffer.byteLength / Float32Array.BYTES_PER_ELEMENT
);
const schedule = JSON.parse(fs.readFileSync(schedulePath, "utf8"));

(async () => {
    const patch = new RuntimeClass();
    await patch.initialise(4, sampleRate);

    const output = new Float32Array(numFrames);
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
        const nextOffset = nextOffsetIndex < offsets.length ? offsets[nextOffsetIndex] : numFrames;
        const framesUntilNextOffset = nextOffset > cursor ? nextOffset - cursor : 0;
        const framesThisBlock = Math.min(
            framesUntilNextOffset > 0 ? framesUntilNextOffset : numFrames - cursor,
            numFrames - cursor,
            512
        );

        if (framesThisBlock > 0) {
            const audioZeroLeft = new Float32Array(framesThisBlock);
            const audioZeroRight = new Float32Array(framesThisBlock);
            const sidechainLeft = new Float32Array(framesThisBlock);
            const sidechainRight = new Float32Array(framesThisBlock);

            for (let index = 0; index < framesThisBlock; index += 1) {
                const sample = sidechain[cursor + index] ?? 0;
                sidechainLeft[index] = sample;
                sidechainRight[index] = sample;
            }

            patch.setInputStreamFrames_audioIn([audioZeroLeft, audioZeroRight], framesThisBlock, 0);
            patch.setInputStreamFrames_sidechainIn([sidechainLeft, sidechainRight], framesThisBlock, 0);
            patch.advance(framesThisBlock);

            const outLeft = new Float32Array(framesThisBlock);
            const outRight = new Float32Array(framesThisBlock);
            patch.getOutputFrames_audioOut([outLeft, outRight], framesThisBlock, 0);
            output.set(outLeft, cursor);
            cursor += framesThisBlock;
        } else {
            applyScheduledInputs(nextOffset);
            nextOffsetIndex += 1;
        }
    }

    fs.writeFileSync(outputPath, Buffer.from(output.buffer, output.byteOffset, output.byteLength));
})().catch((error) => {
    console.error(error?.stack || String(error));
    process.exit(1);
});
""".lstrip(),
        encoding="utf-8",
    )

    return GeneratedRuntime(runtime_path=runtime_path, render_script_path=render_script_path)


def _render(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
    sidechain: np.ndarray,
    schedule: dict[int, list[list[object]]],
) -> np.ndarray:
    node = _require_tool("node")
    sidechain = np.asarray(sidechain, dtype=np.float32)
    sidechain_path = tmp_path / "sidechain.f32"
    schedule_path = tmp_path / "schedule.json"
    output_path = tmp_path / "output.f32"

    _write_f32(sidechain_path, sidechain)
    schedule_path.write_text(
        json.dumps({str(int(offset)): entries for offset, entries in schedule.items()}, indent=2) + "\n",
        encoding="utf-8",
    )

    result = subprocess.run(
        [
            node,
            str(generated_runtime.render_script_path),
            str(generated_runtime.runtime_path),
            str(sidechain_path),
            str(schedule_path),
            str(output_path),
            str(int(sidechain.size)),
            str(SAMPLE_RATE),
        ],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        details = "\n".join(part for part in (result.stdout.strip(), result.stderr.strip()) if part)
        raise AssertionError(f"node runtime render failed:\n{details}")

    rendered = np.fromfile(output_path, dtype=np.float32)
    assert rendered.shape == sidechain.shape
    return rendered


def test_depth_zero_is_sample_accurate_sidechain_passthrough(
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


def test_feedback_zero_reconstructs_sidechain_after_fft_latency(
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
                harmonicCountIn=1.0,
                harmonicRolloffDbIn=0.0,
                maskWidthCentsIn=200.0,
                lowCutHzIn=20.0,
                magCeilingIn=1000.0,
            )
            + [_event("midiIn", _midi_note_on(57))],
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
                harmonicCountIn=16.0,
                harmonicRolloffDbIn=0.0,
                maskWidthCentsIn=200.0,
                lowCutHzIn=20.0,
                magCeilingIn=1000.0,
            )
            + [_event("midiIn", _midi_note_on(48)), _event("midiIn", _midi_note_on(52)), _event("midiIn", _midi_note_on(55))],
        },
    )

    settled = rendered[int(0.1 * SAMPLE_RATE):]
    wet_limit = 1000.0 / FFT_SIZE

    assert np.isfinite(rendered).all()
    assert float(np.max(np.abs(rendered))) <= 1.0
    assert float(np.max(np.abs(settled))) <= wet_limit + 1.0e-6
    assert float(np.sqrt(np.mean(np.square(settled, dtype=np.float64)))) > 1.0e-5


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
