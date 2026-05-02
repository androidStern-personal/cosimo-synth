#!/usr/bin/env python3
from __future__ import annotations

import json
import math
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from scipy.io import wavfile


REPO_ROOT = Path(__file__).resolve().parents[1]
PATCH_PATH = REPO_ROOT / "fx" / "spectral_chord_resonator" / "SpectralChordResonator.cmajorpatch"
OUTPUT_DIR = REPO_ROOT / "artifacts" / "spectral_chord_resonator"
SAMPLE_RATE = 48_000
FFT_SIZE = 2048


def require_tool(name: str) -> str:
    path = shutil.which(name)
    if path is None:
        raise RuntimeError(f"{name} is required")
    return path


def midi_note_on(note: int, velocity: int = 100) -> dict[str, int]:
    return {"message": (0x90 << 16) | (int(note) << 8) | int(velocity)}


def event(endpoint_id: str, payload: float | dict[str, int]) -> list[object]:
    return ["event", endpoint_id, payload]


def base_events(**overrides: float) -> list[list[object]]:
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
    return [event(endpoint_id, value) for endpoint_id, value in values.items()]


def deterministic_probe_signal(num_samples: int, *, amplitude: float = 0.24) -> np.ndarray:
    t = np.arange(num_samples, dtype=np.float64) / SAMPLE_RATE
    signal = (
        0.42 * np.sin(2.0 * np.pi * 173.0 * t)
        + 0.31 * np.sin(2.0 * np.pi * 797.0 * t + 0.21)
        + 0.19 * np.sin(2.0 * np.pi * 2311.0 * t + 0.73)
        + 0.11 * np.sin(2.0 * np.pi * 6137.0 * t + 1.13)
    )
    return (amplitude * signal / np.max(np.abs(signal))).astype(np.float32)


def generate_runtime(temp_dir: Path) -> Path:
    cmaj = require_tool("cmaj")
    runtime_path = temp_dir / "runtime.cjs"
    result = subprocess.run(
        [cmaj, "generate", "--target=javascript", f"--output={runtime_path}", str(PATCH_PATH)],
        cwd=PATCH_PATH.parent,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        details = "\n".join(part for part in (result.stdout.strip(), result.stderr.strip()) if part)
        raise RuntimeError(f"cmaj generate failed:\n{details}")

    runtime_source = runtime_path.read_text(encoding="utf-8")
    class_match = re.search(r"^class\s+([A-Za-z_][A-Za-z0-9_]*)", runtime_source, re.MULTILINE)
    if class_match is None:
        raise RuntimeError("Could not find generated Cmajor JavaScript class")

    runtime_path.write_text(
        runtime_source + f"\nmodule.exports = {class_match.group(1)};\n",
        encoding="utf-8",
    )
    return runtime_path


def write_render_script(temp_dir: Path) -> Path:
    render_script_path = temp_dir / "render.cjs"
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
                throw new Error(`Unsupported input kind ${kind}`);
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
    return render_script_path


def render(runtime_path: Path, render_script_path: Path, temp_dir: Path, sidechain: np.ndarray, schedule: dict[int, list[list[object]]]) -> np.ndarray:
    node = require_tool("node")
    sidechain = np.asarray(sidechain, dtype=np.float32)
    sidechain_path = temp_dir / "sidechain.f32"
    schedule_path = temp_dir / "schedule.json"
    output_path = temp_dir / "output.f32"
    sidechain.tofile(sidechain_path)
    schedule_path.write_text(json.dumps({str(k): v for k, v in schedule.items()}, indent=2) + "\n", encoding="utf-8")
    result = subprocess.run(
        [
            node,
            str(render_script_path),
            str(runtime_path),
            str(sidechain_path),
            str(schedule_path),
            str(output_path),
            str(sidechain.size),
            str(SAMPLE_RATE),
        ],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        details = "\n".join(part for part in (result.stdout.strip(), result.stderr.strip()) if part)
        raise RuntimeError(f"node render failed:\n{details}")
    return np.fromfile(output_path, dtype=np.float32).copy()


def rms(audio: np.ndarray) -> float:
    return float(np.sqrt(np.mean(np.square(audio, dtype=np.float64))))


def write_wav(path: Path, audio: np.ndarray) -> None:
    stereo = np.column_stack([audio, audio]).astype(np.float32)
    wavfile.write(path, SAMPLE_RATE, stereo)


def main() -> int:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="spectral_chord_resonator_proofs_") as temp_dir_name:
        temp_dir = Path(temp_dir_name)
        runtime_path = generate_runtime(temp_dir)
        render_script_path = write_render_script(temp_dir)
        metrics: dict[str, object] = {}

        passthrough_sidechain = deterministic_probe_signal(16_384, amplitude=0.73)
        passthrough = render(
            runtime_path,
            render_script_path,
            temp_dir,
            passthrough_sidechain,
            {0: base_events(depthIn=0.0, magFeedbackIn=0.999, phaseFeedbackIn=1.0)},
        )
        write_wav(OUTPUT_DIR / "depth_zero_passthrough.wav", passthrough)
        metrics["depth_zero_passthrough"] = {
            "max_abs_error": float(np.max(np.abs(passthrough - passthrough_sidechain))),
            "peak": float(np.max(np.abs(passthrough))),
        }

        reconstruction_sidechain = deterministic_probe_signal(65_536, amplitude=0.18)
        reconstruction = render(
            runtime_path,
            render_script_path,
            temp_dir,
            reconstruction_sidechain,
            {0: base_events(depthIn=1.0, magFeedbackIn=0.0, phaseFeedbackIn=0.0, maskFloorIn=1.0)},
        )
        write_wav(OUTPUT_DIR / "feedback_zero_reconstruction.wav", reconstruction)
        dry_settled = reconstruction_sidechain[:-FFT_SIZE][FFT_SIZE * 3:]
        wet_settled = reconstruction[FFT_SIZE:][FFT_SIZE * 3:]
        metrics["feedback_zero_reconstruction"] = {
            "gain_db": 20.0 * math.log10(rms(wet_settled) / rms(dry_settled)),
            "error_to_signal_rms": rms(wet_settled - dry_settled) / rms(dry_settled),
        }

        click = np.zeros(SAMPLE_RATE * 3, dtype=np.float32)
        click[0] = 1.0
        resonance = render(
            runtime_path,
            render_script_path,
            temp_dir,
            click,
            {
                0: base_events(
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
                + [event("midiIn", midi_note_on(57))],
            },
        )
        write_wav(OUTPUT_DIR / "click_220hz_resonance.wav", resonance)
        segment = resonance[int(0.2 * SAMPLE_RATE): SAMPLE_RATE]
        spectrum = np.fft.rfft(segment * np.hanning(segment.size))
        frequencies = np.fft.rfftfreq(segment.size, 1.0 / SAMPLE_RATE)
        search = (frequencies >= 180.0) & (frequencies <= 260.0)
        peak_frequency = float(frequencies[search][np.argmax(np.abs(spectrum[search]))])
        metrics["click_220hz_resonance"] = {
            "peak_frequency_hz": peak_frequency,
            "cents_error": 1200.0 * math.log2(peak_frequency / 220.0),
            "analysis_rms": rms(segment),
        }

        (OUTPUT_DIR / "metrics.json").write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf-8")

    print(f"Wrote proof audio and metrics to {OUTPUT_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
