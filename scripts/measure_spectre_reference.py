#!/usr/bin/env python3
"""Capture deterministic black-box reference renders from Wavesfactory Spectre.

This is an offline research tool, not a test that runs in CI. It requires the
official Spectre Audio Unit/VST3 and a Python environment containing pedalboard,
numpy, and scipy. Every host session is kept well below Spectre's documented
60-second demo attenuation boundary so a headless-host licensing quirk cannot
contaminate a reference render.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import plistlib
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

import numpy as np
from pedalboard import load_plugin
from scipy.io import wavfile


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = REPO_ROOT / "build" / "t26-spectre-reference"
AU_PATH = Path("/Library/Audio/Plug-Ins/Components/Spectre.component")
VST3_PATH = Path("/Library/Audio/Plug-Ins/VST3/Spectre.vst3")
LICENSE_PATH = Path(
    "/Library/Application Support/Wavesfactory/Spectre/License/License.wfl"
)
DEFAULT_SAMPLE_RATE = 48_000
SESSION_AUDIO_LIMIT_SECONDS = 40.0
SPECTRE_DEMO_DIP_SECONDS = 60.0

ALL_BANDS = ("lowshelf", "peak_01", "peak_02", "peak_03", "highshelf")
SPECTRE_COLORS = (
    "Solid",
    "Warm",
    "Tube",
    "Tape",
    "Class B",
    "Diode",
    "Digital",
    "Bit",
    "Rectify",
    "Half Rectify",
    "Clean",
)


def db_to_gain(db: float) -> float:
    return 10.0 ** (db / 20.0)


def gain_to_db(gain: float, floor_db: float = -300.0) -> float:
    if not math.isfinite(gain) or gain <= 0.0:
        return floor_db
    return max(floor_db, 20.0 * math.log10(gain))


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def sha256_audio(audio: np.ndarray) -> str:
    return hashlib.sha256(np.ascontiguousarray(audio).tobytes()).hexdigest()


def normalise_rms(audio: np.ndarray, rms_dbfs: float) -> np.ndarray:
    rms = float(np.sqrt(np.mean(np.square(audio.astype(np.float64)))))
    if rms == 0.0:
        return audio.astype(np.float32)
    return (audio * (db_to_gain(rms_dbfs) / rms)).astype(np.float32)


def stereo_from_mono(mono: np.ndarray, routing: str) -> np.ndarray:
    zeros = np.zeros_like(mono)
    if routing == "mid":
        return np.stack((mono, mono)).astype(np.float32)
    if routing == "side":
        return np.stack((mono, -mono)).astype(np.float32)
    if routing == "left":
        return np.stack((mono, zeros)).astype(np.float32)
    if routing == "right":
        return np.stack((zeros, mono)).astype(np.float32)
    raise ValueError(f"unknown stereo routing: {routing}")


def make_sine(
    sample_rate: int,
    frequency_hz: float,
    rms_dbfs: float,
    duration_seconds: float = 2.0,
    routing: str = "mid",
) -> np.ndarray:
    frame_count = int(round(sample_rate * duration_seconds))
    time = np.arange(frame_count, dtype=np.float64) / sample_rate
    peak = math.sqrt(2.0) * db_to_gain(rms_dbfs)
    mono = (peak * np.sin(2.0 * math.pi * frequency_hz * time)).astype(np.float32)
    return stereo_from_mono(mono, routing)


def make_pink(
    sample_rate: int,
    rms_dbfs: float,
    duration_seconds: float = 3.0,
    seed: int = 0x26E10001,
) -> np.ndarray:
    frame_count = int(round(sample_rate * duration_seconds))
    rng = np.random.default_rng(seed)

    def channel() -> np.ndarray:
        white = rng.standard_normal(frame_count + sample_rate).astype(np.float64)
        state = np.zeros(7, dtype=np.float64)
        output = np.zeros_like(white)
        for index, sample in enumerate(white):
            state[0] = 0.99886 * state[0] + sample * 0.0555179
            state[1] = 0.99332 * state[1] + sample * 0.0750759
            state[2] = 0.96900 * state[2] + sample * 0.1538520
            state[3] = 0.86650 * state[3] + sample * 0.3104856
            state[4] = 0.55000 * state[4] + sample * 0.5329522
            state[5] = -0.7616 * state[5] - sample * 0.0168980
            output[index] = (
                state[0]
                + state[1]
                + state[2]
                + state[3]
                + state[4]
                + state[5]
                + state[6]
                + sample * 0.5362
            )
            state[6] = sample * 0.115926
        return output[sample_rate:]

    common = channel()
    independent_left = channel()
    independent_right = channel()
    stereo = np.stack(
        (
            common * 0.78 + independent_left * 0.22,
            common * 0.78 + independent_right * 0.22,
        )
    )
    return normalise_rms(stereo, rms_dbfs)


def make_drums(sample_rate: int, rms_dbfs: float, duration_seconds: float = 4.0) -> np.ndarray:
    frame_count = int(round(sample_rate * duration_seconds))
    rng = np.random.default_rng(0x26D12F00)
    time = np.arange(frame_count, dtype=np.float64) / sample_rate
    kick_age = np.mod(time, 0.25)
    snare_age = np.mod(time + 0.25, 0.5)
    hat_age = np.mod(time, 0.125)
    noise = rng.uniform(-1.0, 1.0, frame_count)
    previous_noise = np.concatenate(([0.0], noise[:-1]))
    kick_phase = 2.0 * math.pi * (
        46.0 * kick_age + 2.8 * (1.0 - np.exp(-28.0 * kick_age))
    )
    kick = np.sin(kick_phase) * np.exp(-18.0 * kick_age)
    snare = noise * np.exp(-26.0 * snare_age) * 0.52
    hat = (noise - previous_noise) * np.exp(-95.0 * hat_age) * 0.16
    stereo = np.stack(
        (kick + snare * 0.86 + hat * 1.12, kick + snare * 1.04 - hat * 0.74)
    )
    return normalise_rms(stereo, rms_dbfs)


def make_bass(sample_rate: int, rms_dbfs: float, duration_seconds: float = 4.0) -> np.ndarray:
    frame_count = int(round(sample_rate * duration_seconds))
    time = np.arange(frame_count, dtype=np.float64) / sample_rate
    notes = np.asarray((55.0, 65.406, 73.416, 82.407))
    note_age = np.mod(time, 0.25)
    frequencies = notes[(time / 0.25).astype(np.int64) % len(notes)]
    mono = np.zeros(frame_count, dtype=np.float64)
    for harmonic in range(1, 8):
        mono += np.sin(2.0 * math.pi * frequencies * harmonic * time) / harmonic
    mono *= 0.58 + 0.42 * np.exp(-8.0 * note_age)
    return normalise_rms(np.stack((mono, mono)), rms_dbfs)


def make_bright_poly(
    sample_rate: int, rms_dbfs: float, duration_seconds: float = 4.0
) -> np.ndarray:
    frame_count = int(round(sample_rate * duration_seconds))
    time = np.arange(frame_count, dtype=np.float64) / sample_rate
    chord = (220.0, 277.183, 329.628, 415.305)
    pans = (-0.72, 0.52, -0.26, 0.76)
    stereo = np.zeros((2, frame_count), dtype=np.float64)
    for voice, (frequency, pan) in enumerate(zip(chord, pans)):
        sample = np.zeros(frame_count, dtype=np.float64)
        for harmonic in range(1, 10):
            sample += np.sin(
                2.0 * math.pi * frequency * harmonic * time + voice * 0.37
            ) / harmonic
        stereo[0] += sample * math.sqrt((1.0 - pan) * 0.5)
        stereo[1] += sample * math.sqrt((1.0 + pan) * 0.5)
    return normalise_rms(stereo, rms_dbfs)


def write_float_wav(path: Path, sample_rate: int, audio: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    wavfile.write(path, sample_rate, np.ascontiguousarray(audio.T, dtype=np.float32))


def read_float_wav(path: Path) -> tuple[int, np.ndarray]:
    sample_rate, audio = wavfile.read(path)
    if audio.ndim == 1:
        audio = np.stack((audio, audio), axis=1)
    return int(sample_rate), np.ascontiguousarray(audio.T, dtype=np.float32)


def effective_parameters(plugin: Any, names: Iterable[str]) -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    for name in names:
        parameter = plugin.parameters[name]
        result[name] = {
            "raw": float(parameter.raw_value),
            "display": parameter.string_value,
        }
    return result


def default_settings() -> dict[str, Any]:
    settings: dict[str, Any] = {
        "input_compensation": False,
        "input": 0.0,
        "output": 0.0,
        "processing": "Stereo",
        "mode": "Subtle",
        "quality": "Good",
        "de_emphasis": True,
        "dry_wet": 0.5,
    }
    for band in ALL_BANDS:
        settings[f"{band}_switch"] = False
    return settings


def one_peak_settings(
    *,
    frequency_hz: float = 1_000.0,
    gain_db: float = 9.0,
    q: float = 1.0,
    color: str = "Tube",
    processing: str = "Stereo",
    mode: str = "Medium",
    quality: str = "Good",
    de_emphasis: bool = True,
    mix: float = 0.5,
) -> dict[str, Any]:
    settings = default_settings()
    settings.update(
        {
            "peak_01_switch": True,
            "peak_01_frequency": frequency_hz,
            "peak_01_gain": gain_db,
            "peak_01_q": q,
            "peak_01_color": color,
            "peak_01_processing": processing,
            "mode": mode,
            "quality": quality,
            "de_emphasis": de_emphasis,
            "dry_wet": mix,
        }
    )
    return settings


def two_peak_settings(
    *,
    first_enabled: bool,
    second_enabled: bool,
    de_emphasis: bool,
    mode: str = "Medium",
) -> dict[str, Any]:
    settings = default_settings()
    settings.update(
        {
            "peak_01_switch": first_enabled,
            "peak_01_frequency": 500.0,
            "peak_01_gain": 9.0,
            "peak_01_q": 0.71,
            "peak_01_color": "Tube",
            "peak_01_processing": "Stereo",
            "peak_02_switch": second_enabled,
            "peak_02_frequency": 5_000.0,
            "peak_02_gain": 9.0,
            "peak_02_q": 0.71,
            "peak_02_color": "Solid",
            "peak_02_processing": "Stereo",
            "mode": mode,
            "quality": "Good",
            "de_emphasis": de_emphasis,
            "dry_wet": 0.5,
        }
    )
    return settings


def set_plugin_settings(plugin: Any, settings: dict[str, Any]) -> None:
    for name, value in settings.items():
        setattr(plugin, name, value)


class SpectreSession:
    def __init__(self, plugin_path: Path = AU_PATH) -> None:
        self.plugin_path = plugin_path
        self.plugin: Any | None = None
        self.processed_seconds = 0.0
        self.session_count = 0

    def _open(self) -> None:
        self.plugin = load_plugin(str(self.plugin_path))
        self.processed_seconds = 0.0
        self.session_count += 1

    def process(
        self,
        audio: np.ndarray,
        sample_rate: int,
        settings: dict[str, Any],
    ) -> tuple[np.ndarray, dict[str, dict[str, Any]]]:
        duration = audio.shape[1] / sample_rate
        if duration >= SESSION_AUDIO_LIMIT_SECONDS:
            raise ValueError(
                f"one render is {duration:.1f}s; references must remain below "
                f"the {SESSION_AUDIO_LIMIT_SECONDS:.0f}s safety limit"
            )
        if self.plugin is None or self.processed_seconds + duration >= SESSION_AUDIO_LIMIT_SECONDS:
            self._open()
        assert self.plugin is not None
        set_plugin_settings(self.plugin, settings)
        effective = effective_parameters(self.plugin, settings.keys())
        output = self.plugin.process(
            np.ascontiguousarray(audio, dtype=np.float32),
            sample_rate,
            buffer_size=512,
            reset=True,
        )
        self.processed_seconds += duration
        return np.ascontiguousarray(output, dtype=np.float32), effective


@dataclass(frozen=True)
class Stimulus:
    id: str
    sample_rate: int
    audio: np.ndarray
    sine_frequency_hz: float | None = None
    analysis_start_seconds: float = 0.5


@dataclass(frozen=True)
class RenderCase:
    id: str
    group: str
    stimulus_id: str
    settings: dict[str, Any]
    save_audio: bool = False


def sanitise_id(value: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_.-]+", "-", value).strip("-")


def channel_metrics(audio: np.ndarray, start_frame: int) -> dict[str, float]:
    measured = audio[:, start_frame:].astype(np.float64)
    mid = 0.5 * (measured[0] + measured[1])
    side = 0.5 * (measured[0] - measured[1])

    def rms(signal: np.ndarray) -> float:
        return float(np.sqrt(np.mean(np.square(signal))))

    return {
        "rms_dbfs": gain_to_db(rms(measured)),
        "left_rms_dbfs": gain_to_db(rms(measured[0])),
        "right_rms_dbfs": gain_to_db(rms(measured[1])),
        "mid_rms_dbfs": gain_to_db(rms(mid)),
        "side_rms_dbfs": gain_to_db(rms(side)),
        "peak_dbfs": gain_to_db(float(np.max(np.abs(measured)))),
        "left_mean": float(np.mean(measured[0])),
        "right_mean": float(np.mean(measured[1])),
    }


def complex_tone_coefficient(
    signal: np.ndarray,
    sample_rate: int,
    frequency_hz: float,
    start_frame: int,
    frame_count: int,
) -> complex:
    indices = np.arange(start_frame, start_frame + frame_count, dtype=np.float64)
    kernel = np.exp(-2j * math.pi * frequency_hz * indices / sample_rate)
    return complex(2.0 * np.mean(signal[start_frame : start_frame + frame_count] * kernel))


def harmonic_metrics(stimulus: Stimulus, output: np.ndarray) -> dict[str, Any]:
    if stimulus.sine_frequency_hz is None:
        return {}
    sample_rate = stimulus.sample_rate
    frequency = stimulus.sine_frequency_hz
    frame_count = sample_rate
    start_frame = max(
        int(round(stimulus.analysis_start_seconds * sample_rate)),
        output.shape[1] - frame_count,
    )
    mid = 0.5 * (output[0].astype(np.float64) + output[1].astype(np.float64))
    harmonic_count = max(1, min(20, int((sample_rate * 0.49) // frequency)))
    coefficients = [
        complex_tone_coefficient(
            mid,
            sample_rate,
            frequency * harmonic,
            start_frame,
            frame_count,
        )
        for harmonic in range(1, harmonic_count + 1)
    ]
    magnitudes = np.asarray([abs(value) for value in coefficients], dtype=np.float64)
    fundamental = float(magnitudes[0])
    thd = float(np.sqrt(np.sum(np.square(magnitudes[1:]))) / max(fundamental, 1.0e-30))
    return {
        "fundamental_peak_dbfs": gain_to_db(fundamental),
        "fundamental_phase_degrees": float(np.angle(coefficients[0], deg=True)),
        "harmonic_peak_dbfs": [gain_to_db(float(value)) for value in magnitudes],
        "harmonic_relative_db": [
            gain_to_db(float(value) / max(fundamental, 1.0e-30)) for value in magnitudes
        ],
        "thd_db": gain_to_db(thd),
    }


def integrated_lufs(path: Path) -> float | None:
    result = subprocess.run(
        (
            "ffmpeg",
            "-hide_banner",
            "-nostats",
            "-i",
            str(path),
            "-filter_complex",
            "ebur128",
            "-f",
            "null",
            "-",
        ),
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        return None
    matches = re.findall(r"I:\s*(-?\d+(?:\.\d+)?) LUFS", result.stderr)
    return float(matches[-1]) if matches else None


def least_squares_mix(dry: np.ndarray, wet: np.ndarray, mixed: np.ndarray) -> dict[str, float]:
    matrix = np.stack((dry.ravel(), wet.ravel()), axis=1).astype(np.float64)
    target = mixed.ravel().astype(np.float64)
    coefficients, *_ = np.linalg.lstsq(matrix, target, rcond=None)
    residual = target - matrix @ coefficients
    return {
        "dry_coefficient": float(coefficients[0]),
        "wet_coefficient": float(coefficients[1]),
        "error_rms": float(np.sqrt(np.mean(np.square(residual)))),
        "error_max": float(np.max(np.abs(residual))),
    }


class CorpusBuilder:
    def __init__(self, output_root: Path, save_all_audio: bool) -> None:
        self.output_root = output_root
        self.save_all_audio = save_all_audio
        self.inputs_dir = output_root / "inputs"
        self.outputs_dir = output_root / "outputs"
        self.listening_dir = output_root / "listening"
        self.stimuli: dict[str, Stimulus] = {}
        self.cases: list[RenderCase] = []
        self.rows: list[dict[str, Any]] = []
        self.outputs: dict[str, np.ndarray] = {}
        self.session = SpectreSession()

    def add_stimulus(self, stimulus: Stimulus) -> None:
        if stimulus.id in self.stimuli:
            return
        self.stimuli[stimulus.id] = stimulus

    def add_case(self, case: RenderCase) -> None:
        if any(existing.id == case.id for existing in self.cases):
            raise ValueError(f"duplicate case id: {case.id}")
        if case.stimulus_id not in self.stimuli:
            raise ValueError(f"unknown stimulus {case.stimulus_id} for {case.id}")
        self.cases.append(case)

    def render(self) -> None:
        self.output_root.mkdir(parents=True, exist_ok=True)
        for stimulus in self.stimuli.values():
            write_float_wav(
                self.inputs_dir / f"{sanitise_id(stimulus.id)}.wav",
                stimulus.sample_rate,
                stimulus.audio,
            )

        total = len(self.cases)
        for index, case in enumerate(self.cases, start=1):
            stimulus = self.stimuli[case.stimulus_id]
            output, effective = self.session.process(
                stimulus.audio,
                stimulus.sample_rate,
                case.settings,
            )
            if output.shape != stimulus.audio.shape:
                raise RuntimeError(
                    f"{case.id}: shape changed from {stimulus.audio.shape} to {output.shape}"
                )
            if not np.isfinite(output).all():
                raise RuntimeError(f"{case.id}: non-finite output")
            output_path = self.outputs_dir / case.group / f"{sanitise_id(case.id)}.wav"
            if self.save_all_audio or case.save_audio:
                write_float_wav(output_path, stimulus.sample_rate, output)
                relative_output_path: str | None = str(output_path.relative_to(self.output_root))
            else:
                relative_output_path = None
            start_frame = int(round(stimulus.analysis_start_seconds * stimulus.sample_rate))
            row: dict[str, Any] = {
                "id": case.id,
                "group": case.group,
                "stimulus": case.stimulus_id,
                "sample_rate": stimulus.sample_rate,
                "settings": case.settings,
                "effective_parameters": effective,
                "output_path": relative_output_path,
                "sha256_float_audio": sha256_audio(output),
                "metrics": channel_metrics(output, start_frame),
            }
            row["metrics"].update(harmonic_metrics(stimulus, output))
            self.rows.append(row)
            self.outputs[case.id] = output
            if index % 50 == 0 or index == total:
                print(f"rendered {index}/{total}", flush=True)


def add_primary_stimuli(builder: CorpusBuilder) -> None:
    for level in (-36, -24, -18, -12, -6):
        builder.add_stimulus(
            Stimulus(
                id=f"sine-1k-{level}db-rms-mid-48k",
                sample_rate=48_000,
                audio=make_sine(48_000, 1_000.0, float(level)),
                sine_frequency_hz=1_000.0,
            )
        )
    for frequency in (100, 3_000, 8_000, 12_000):
        for level in (-18, -6):
            builder.add_stimulus(
                Stimulus(
                    id=f"sine-{frequency}hz-{level}db-rms-mid-48k",
                    sample_rate=48_000,
                    audio=make_sine(48_000, float(frequency), float(level)),
                    sine_frequency_hz=float(frequency),
                )
            )
    for routing in ("mid", "side", "left", "right"):
        builder.add_stimulus(
            Stimulus(
                id=f"sine-1k--18db-rms-{routing}-48k",
                sample_rate=48_000,
                audio=make_sine(48_000, 1_000.0, -18.0, routing=routing),
                sine_frequency_hz=1_000.0,
            )
        )
    builder.add_stimulus(
        Stimulus("pink--18db-rms-48k", 48_000, make_pink(48_000, -18.0))
    )
    builder.add_stimulus(
        Stimulus("pink--24db-rms-48k", 48_000, make_pink(48_000, -24.0))
    )
    builder.add_stimulus(
        Stimulus("drums--18db-rms-48k", 48_000, make_drums(48_000, -18.0))
    )
    builder.add_stimulus(
        Stimulus("bass--18db-rms-48k", 48_000, make_bass(48_000, -18.0))
    )
    builder.add_stimulus(
        Stimulus(
            "bright-poly--18db-rms-48k", 48_000, make_bright_poly(48_000, -18.0)
        )
    )
    for sample_rate in (44_100, 96_000, 192_000):
        builder.add_stimulus(
            Stimulus(
                id=f"sine-1k--18db-rms-mid-{sample_rate}",
                sample_rate=sample_rate,
                audio=make_sine(sample_rate, 1_000.0, -18.0),
                sine_frequency_hz=1_000.0,
            )
        )


def add_dry_references(builder: CorpusBuilder) -> None:
    for stimulus in builder.stimuli.values():
        settings = default_settings()
        settings.update({"quality": "Good", "dry_wet": 0.5})
        builder.add_case(
            RenderCase(
                id=f"dry__{stimulus.id}",
                group="dry",
                stimulus_id=stimulus.id,
                settings=settings,
                save_audio=True,
            )
        )


def add_clean_and_mix_cases(builder: CorpusBuilder) -> None:
    stimulus = "sine-1k--18db-rms-mid-48k"
    for gain_db in (0, 1, 3, 6, 9, 12):
        for de_emphasis in (False, True):
            builder.add_case(
                RenderCase(
                    id=f"clean-law__gain-{gain_db}__de-{int(de_emphasis)}",
                    group="clean-law",
                    stimulus_id=stimulus,
                    settings=one_peak_settings(
                        gain_db=float(gain_db),
                        color="Clean",
                        mode="Subtle",
                        de_emphasis=de_emphasis,
                    ),
                )
            )
    for color in ("Clean", "Tube", "Solid"):
        for de_emphasis in (False, True):
            for mix in (0.0, 0.25, 0.5, 0.75, 1.0):
                builder.add_case(
                    RenderCase(
                        id=(
                            f"mix-law__{color.lower()}__de-{int(de_emphasis)}"
                            f"__mix-{mix:.2f}"
                        ),
                        group="mix-law",
                        stimulus_id=stimulus,
                        settings=one_peak_settings(
                            gain_db=9.0,
                            color=color,
                            mode="Medium",
                            de_emphasis=de_emphasis,
                            mix=mix,
                        ),
                    )
                )


def add_transfer_cases(builder: CorpusBuilder, full: bool) -> None:
    levels = (-36, -24, -18, -12, -6) if full else (-36, -18, -6)
    gains = (1, 3, 6, 9, 12) if full else (3, 6, 9, 12)
    for color in ("Tube", "Solid"):
        for mode in ("Subtle", "Medium", "Aggressive"):
            for gain_db in gains:
                for level in levels:
                    for de_emphasis in (False, True):
                        builder.add_case(
                            RenderCase(
                                id=(
                                    f"transfer__{color.lower()}__{mode.lower()}"
                                    f"__gain-{gain_db}__input-{level}__de-{int(de_emphasis)}"
                                ),
                                group="transfer",
                                stimulus_id=f"sine-1k-{level}db-rms-mid-48k",
                                settings=one_peak_settings(
                                    gain_db=float(gain_db),
                                    color=color,
                                    mode=mode,
                                    de_emphasis=de_emphasis,
                                ),
                            )
                        )


def add_shaper_transfer_cases(builder: CorpusBuilder, full: bool) -> None:
    levels = (-36, -24, -18, -12, -6) if full else (-36, -18, -6)
    gains = (1, 3, 6, 9, 12) if full else (3, 6, 9, 12)
    for color in ("Clean", "Tube", "Solid"):
        modes = ("Subtle",) if color == "Clean" else ("Subtle", "Medium", "Aggressive")
        for mode in modes:
            for gain_db in gains:
                for level in levels:
                    builder.add_case(
                        RenderCase(
                            id=(
                                f"shaper-transfer__{color.lower()}__{mode.lower()}"
                                f"__gain-{gain_db}__input-{level}"
                            ),
                            group="shaper-transfer",
                            stimulus_id=f"sine-1k-{level}db-rms-mid-48k",
                            settings=one_peak_settings(
                                gain_db=float(gain_db),
                                color=color,
                                mode=mode,
                                quality="Normal",
                                de_emphasis=False,
                                mix=1.0,
                            ),
                        )
                    )


def add_frequency_q_quality_cases(builder: CorpusBuilder, full: bool) -> None:
    frequencies = (100, 1_000, 8_000, 12_000) if full else (100, 1_000, 8_000)
    q_values = (0.7, 2.0, 8.0) if full else (0.7, 8.0)
    for color in ("Clean", "Tube", "Solid"):
        for frequency in frequencies:
            for q in q_values:
                for de_emphasis in ((False, True) if color == "Clean" else (True,)):
                    builder.add_case(
                        RenderCase(
                            id=(
                                f"frequency-q__{color.lower()}__freq-{frequency}"
                                f"__q-{q:g}__de-{int(de_emphasis)}"
                            ),
                            group="frequency-q",
                            stimulus_id=f"sine-{frequency}hz--18db-rms-mid-48k"
                            if frequency != 1_000
                            else "sine-1k--18db-rms-mid-48k",
                            settings=one_peak_settings(
                                frequency_hz=float(frequency),
                                gain_db=9.0,
                                q=q,
                                color=color,
                                mode="Medium",
                                de_emphasis=de_emphasis,
                            ),
                        )
                    )
    for color in ("Clean", "Tube", "Solid"):
        for frequency in (3_000, 8_000):
            for level in ((-18, -6) if full else (-6,)):
                for quality in ("Normal", "Good", "Best"):
                    builder.add_case(
                        RenderCase(
                            id=(
                                f"quality__{color.lower()}__freq-{frequency}"
                                f"__input-{level}__{quality.lower()}"
                            ),
                            group="quality",
                            stimulus_id=f"sine-{frequency}hz-{level}db-rms-mid-48k",
                            settings=one_peak_settings(
                                frequency_hz=float(frequency),
                                gain_db=12.0,
                                q=0.7,
                                color=color,
                                mode="Aggressive",
                                quality=quality,
                                de_emphasis=True,
                            ),
                        )
                    )
    for frequency in (8_000, 12_000):
        for q in (0.7, 8.0):
            for quality in ("Normal", "Good", "Best"):
                builder.add_case(
                    RenderCase(
                        id=(
                            f"quality-noise__clean__freq-{frequency}__q-{q:g}"
                            f"__{quality.lower()}"
                        ),
                        group="quality-noise",
                        stimulus_id="pink--24db-rms-48k",
                        settings=one_peak_settings(
                            frequency_hz=float(frequency),
                            gain_db=9.0,
                            q=q,
                            color="Clean",
                            mode="Subtle",
                            quality=quality,
                            de_emphasis=False,
                        ),
                    )
                )


def add_routing_and_topology_cases(builder: CorpusBuilder) -> None:
    for routing in ("mid", "side", "left", "right"):
        for processing in ("Stereo", "Left", "Right", "Mid", "Side"):
            builder.add_case(
                RenderCase(
                    id=f"routing__input-{routing}__process-{processing.lower()}",
                    group="routing",
                    stimulus_id=f"sine-1k--18db-rms-{routing}-48k",
                    settings=one_peak_settings(
                        gain_db=9.0,
                        color="Tube",
                        processing=processing,
                        mode="Medium",
                        de_emphasis=True,
                    ),
                )
            )
    for de_emphasis in (False, True):
        for name, first_enabled, second_enabled in (
            ("dry", False, False),
            ("band1", True, False),
            ("band2", False, True),
            ("both", True, True),
        ):
            builder.add_case(
                RenderCase(
                    id=f"parallel__{name}__de-{int(de_emphasis)}",
                    group="parallel",
                    stimulus_id="pink--18db-rms-48k",
                    settings=two_peak_settings(
                        first_enabled=first_enabled,
                        second_enabled=second_enabled,
                        de_emphasis=de_emphasis,
                    ),
                )
            )


def add_sample_rate_cases(builder: CorpusBuilder) -> None:
    for sample_rate in (44_100, 48_000, 96_000, 192_000):
        stimulus = (
            "sine-1k--18db-rms-mid-48k"
            if sample_rate == 48_000
            else f"sine-1k--18db-rms-mid-{sample_rate}"
        )
        for color in ("Clean", "Tube", "Solid"):
            builder.add_case(
                RenderCase(
                    id=f"sample-rate__{color.lower()}__{sample_rate}",
                    group="sample-rate",
                    stimulus_id=stimulus,
                    settings=one_peak_settings(
                        gain_db=9.0,
                        color=color,
                        mode="Medium",
                        quality="Good",
                        de_emphasis=True,
                    ),
                )
            )


def add_algorithm_survey(builder: CorpusBuilder) -> None:
    for color in SPECTRE_COLORS:
        for mode in ("Subtle", "Medium", "Aggressive"):
            builder.add_case(
                RenderCase(
                    id=f"algorithm-survey__{color.lower().replace(' ', '-')}__{mode.lower()}",
                    group="algorithm-survey",
                    stimulus_id="sine-1k--18db-rms-mid-48k",
                    settings=one_peak_settings(
                        gain_db=9.0,
                        color=color,
                        mode=mode,
                        quality="Normal",
                        de_emphasis=False,
                        mix=1.0,
                    ),
                )
            )


def music_settings() -> tuple[tuple[str, dict[str, Any]], ...]:
    def low(gain: float, mode: str, de_emphasis: bool = True) -> dict[str, Any]:
        return one_peak_settings(
            frequency_hz=130.0,
            gain_db=gain,
            q=0.71,
            color="Solid",
            mode=mode,
            de_emphasis=de_emphasis,
        )

    def high(gain: float, mode: str, de_emphasis: bool = True) -> dict[str, Any]:
        return one_peak_settings(
            frequency_hz=9_000.0,
            gain_db=gain,
            q=0.71,
            color="Tube",
            mode=mode,
            de_emphasis=de_emphasis,
        )

    def both(gain: float, mode: str, de_emphasis: bool = True) -> dict[str, Any]:
        settings = default_settings()
        settings.update(
            {
                "peak_01_switch": True,
                "peak_01_frequency": 130.0,
                "peak_01_gain": gain,
                "peak_01_q": 0.71,
                "peak_01_color": "Solid",
                "peak_01_processing": "Stereo",
                "peak_02_switch": True,
                "peak_02_frequency": 9_000.0,
                "peak_02_gain": gain,
                "peak_02_q": 0.71,
                "peak_02_color": "Tube",
                "peak_02_processing": "Stereo",
                "mode": mode,
                "quality": "Good",
                "de_emphasis": de_emphasis,
                "dry_wet": 0.5,
            }
        )
        return settings

    return (
        ("low-6-subtle-de", low(6.0, "Subtle")),
        ("low-9-medium-de", low(9.0, "Medium")),
        ("high-6-subtle-de", high(6.0, "Subtle")),
        ("high-9-medium-de", high(9.0, "Medium")),
        ("both-6-subtle-de", both(6.0, "Subtle")),
        ("both-9-medium-de", both(9.0, "Medium")),
        ("both-6-subtle-node", both(6.0, "Subtle", False)),
        ("both-9-medium-node", both(9.0, "Medium", False)),
    )


def add_music_cases(builder: CorpusBuilder) -> None:
    for stimulus in (
        "pink--18db-rms-48k",
        "drums--18db-rms-48k",
        "bass--18db-rms-48k",
        "bright-poly--18db-rms-48k",
    ):
        for setting_id, settings in music_settings():
            builder.add_case(
                RenderCase(
                    id=f"music__{stimulus}__{setting_id}",
                    group="music",
                    stimulus_id=stimulus,
                    settings=settings,
                    save_audio=True,
                )
            )


def compare_determinism(stimulus: Stimulus) -> dict[str, Any]:
    settings = one_peak_settings(
        gain_db=9.0,
        color="Tube",
        mode="Medium",
        quality="Good",
        de_emphasis=True,
    )
    outputs = []
    for _ in range(3):
        plugin = load_plugin(str(AU_PATH))
        set_plugin_settings(plugin, settings)
        outputs.append(
            np.ascontiguousarray(
                plugin.process(stimulus.audio, stimulus.sample_rate, buffer_size=512, reset=True),
                dtype=np.float32,
            )
        )
    return {
        "three_fresh_instances_bit_identical": all(
            np.array_equal(outputs[0], output) for output in outputs[1:]
        ),
        "maximum_difference": max(
            float(np.max(np.abs(outputs[0] - output))) for output in outputs[1:]
        ),
    }


def vst3_settings_from_au(settings: dict[str, Any]) -> dict[str, Any]:
    translated: dict[str, Any] = {}
    for name, value in settings.items():
        translated_name = name
        if name in ("input", "output"):
            translated_name = f"{name}_db"
        elif name.endswith("_frequency"):
            translated_name = f"{name}_hz"
        elif name.endswith("_gain"):
            translated_name = f"{name}_db"
        translated[translated_name] = value
    translated["bypass"] = False
    return translated


def compare_formats(stimulus: Stimulus) -> dict[str, Any]:
    settings = one_peak_settings(
        gain_db=9.0,
        color="Tube",
        mode="Medium",
        quality="Good",
        de_emphasis=True,
    )
    au = load_plugin(str(AU_PATH))
    set_plugin_settings(au, settings)
    au_output = np.ascontiguousarray(
        au.process(stimulus.audio, stimulus.sample_rate, buffer_size=512, reset=True),
        dtype=np.float32,
    )
    vst3 = load_plugin(str(VST3_PATH))
    set_plugin_settings(vst3, vst3_settings_from_au(settings))
    vst3_output = np.ascontiguousarray(
        vst3.process(stimulus.audio, stimulus.sample_rate, buffer_size=512, reset=True),
        dtype=np.float32,
    )
    difference = au_output - vst3_output
    return {
        "bit_identical": bool(np.array_equal(au_output, vst3_output)),
        "maximum_difference": float(np.max(np.abs(difference))),
        "rms_difference": float(np.sqrt(np.mean(np.square(difference)))),
    }


def analyse(builder: CorpusBuilder) -> dict[str, Any]:
    outputs = builder.outputs
    rows = {row["id"]: row for row in builder.rows}
    analysis: dict[str, Any] = {}

    stimulus_id = "sine-1k--18db-rms-mid-48k"
    dry = outputs[f"dry__{stimulus_id}"]
    dry_row = rows[f"dry__{stimulus_id}"]
    dry_fundamental_db = dry_row["metrics"]["fundamental_peak_dbfs"]

    clean_law = []
    for gain_db in (0, 1, 3, 6, 9, 12):
        off_id = f"clean-law__gain-{gain_db}__de-0"
        on_id = f"clean-law__gain-{gain_db}__de-1"
        off_row = rows[off_id]
        on_row = rows[on_id]
        output_gain_db = off_row["metrics"]["fundamental_peak_dbfs"] - dry_fundamental_db
        clean_law.append(
            {
                "selected_gain_db": gain_db,
                "measured_total_gain_db": output_gain_db,
                "error_db": output_gain_db - gain_db,
                "de_emphasis_on_total_gain_db": (
                    on_row["metrics"]["fundamental_peak_dbfs"] - dry_fundamental_db
                ),
                "de_emphasis_on_phase_degrees": (
                    on_row["metrics"]["fundamental_phase_degrees"]
                    - dry_row["metrics"]["fundamental_phase_degrees"]
                ),
            }
        )
    analysis["clean_band_gain_law"] = clean_law

    mix_law: dict[str, Any] = {}
    for color in ("Clean", "Tube", "Solid"):
        for de_emphasis in (False, True):
            prefix = f"mix-law__{color.lower()}__de-{int(de_emphasis)}"
            dry_endpoint = outputs[f"{prefix}__mix-0.00"]
            wet_endpoint = outputs[f"{prefix}__mix-1.00"]
            mix_law[f"{color.lower()}_de_{int(de_emphasis)}"] = {
                f"mix_{mix:.2f}": least_squares_mix(
                    dry_endpoint,
                    wet_endpoint,
                    outputs[f"{prefix}__mix-{mix:.2f}"],
                )
                for mix in (0.0, 0.25, 0.5, 0.75, 1.0)
            }
    analysis["mix_law"] = mix_law

    de_deltas: dict[str, np.ndarray] = {}
    for color in ("Tube", "Solid"):
        off = outputs[
            f"transfer__{color.lower()}__medium__gain-9__input--18__de-0"
        ]
        on = outputs[
            f"transfer__{color.lower()}__medium__gain-9__input--18__de-1"
        ]
        de_deltas[color] = on - off
    clean_off = outputs["mix-law__clean__de-0__mix-0.50"]
    clean_on = outputs["mix-law__clean__de-1__mix-0.50"]
    de_deltas["Clean"] = clean_on - clean_off
    de_analysis: dict[str, Any] = {}
    for color in ("Tube", "Solid"):
        difference = de_deltas[color] - de_deltas["Clean"]
        de_analysis[color] = {
            "maximum_delta_difference": float(np.max(np.abs(difference))),
            "rms_delta_difference": float(np.sqrt(np.mean(np.square(difference)))),
        }
    analysis["de_emphasis_color_independence"] = de_analysis

    symmetry: dict[str, Any] = {}
    for color in ("Solid", "Tube"):
        row = rows[f"algorithm-survey__{color.lower()}__medium"]
        relative = row["metrics"]["harmonic_relative_db"]
        symmetry[color] = {
            "h2_relative_db": relative[1],
            "h3_relative_db": relative[2],
            "thd_db": row["metrics"]["thd_db"],
        }
    analysis["tube_solid_harmonic_identity"] = symmetry

    mode_drive: dict[str, Any] = {}
    for color in ("Tube", "Solid"):
        mode_drive[color] = {}
        for mode in ("subtle", "medium", "aggressive"):
            row = rows[
                f"transfer__{color.lower()}__{mode}__gain-9__input--18__de-1"
            ]
            mode_drive[color][mode] = {
                "fundamental_peak_dbfs": row["metrics"]["fundamental_peak_dbfs"],
                "h2_relative_db": row["metrics"]["harmonic_relative_db"][1],
                "h3_relative_db": row["metrics"]["harmonic_relative_db"][2],
                "thd_db": row["metrics"]["thd_db"],
            }
    analysis["mode_drive"] = mode_drive

    shaper_transfer: dict[str, Any] = {}
    available_gain = 1 if any(
        row_id.startswith("shaper-transfer__clean__subtle__gain-1__")
        for row_id in rows
    ) else 3
    available_levels = (-36, -24, -18, -12, -6) if any(
        row_id.endswith("__input--24") for row_id in rows
    ) else (-36, -18, -6)
    available_gains = (1, 3, 6, 9, 12) if available_gain == 1 else (3, 6, 9, 12)
    for color in ("Tube", "Solid"):
        shaper_transfer[color] = {}
        for mode in ("Subtle", "Medium", "Aggressive"):
            points = []
            for gain_db in available_gains:
                for level in available_levels:
                    clean_row = rows[
                        f"shaper-transfer__clean__subtle__gain-{gain_db}__input-{level}"
                    ]
                    shaped_row = rows[
                        f"shaper-transfer__{color.lower()}__{mode.lower()}"
                        f"__gain-{gain_db}__input-{level}"
                    ]
                    clean_fundamental = clean_row["metrics"]["fundamental_peak_dbfs"]
                    shaped_fundamental = shaped_row["metrics"]["fundamental_peak_dbfs"]
                    relative = shaped_row["metrics"]["harmonic_relative_db"]
                    points.append(
                        {
                            "band_gain_db": gain_db,
                            "input_rms_dbfs": level,
                            "linear_band_peak_dbfs": clean_fundamental,
                            "fundamental_gain_vs_linear_band_db": (
                                shaped_fundamental - clean_fundamental
                            ),
                            "h2_relative_db": relative[1],
                            "h3_relative_db": relative[2],
                            "thd_db": shaped_row["metrics"]["thd_db"],
                        }
                    )
            shaper_transfer[color][mode] = points
    analysis["shaper_transfer"] = shaper_transfer

    # The Subtle-mode black box resolves to these simple transfer functions.
    # Validate the inferred constants against every measured gain/input pair;
    # harmonics below -140 dBFS are excluded because float noise dominates them.
    phase = np.arange(48, dtype=np.float64) * (2.0 * math.pi / 48.0)
    subtle_models = {
        "Solid": {"bias": 0.0},
        "Tube": {"bias": 0.125},
    }
    for color, model in subtle_models.items():
        errors_db: list[float] = []
        for gain_db in available_gains:
            for level in available_levels:
                clean_row = rows[
                    f"shaper-transfer__clean__subtle__gain-{gain_db}__input-{level}"
                ]
                shaped_row = rows[
                    f"shaper-transfer__{color.lower()}__subtle"
                    f"__gain-{gain_db}__input-{level}"
                ]
                band_peak = db_to_gain(
                    clean_row["metrics"]["fundamental_peak_dbfs"]
                )
                bias = model["bias"]
                predicted_wave = (
                    np.tanh(3.0 * band_peak * np.sin(phase) + bias)
                    - math.tanh(bias)
                ) / math.sqrt(2.0)
                predicted_wave -= np.mean(predicted_wave)
                predicted_harmonics = np.abs(np.fft.rfft(predicted_wave) / 24.0)[1:21]
                measured_harmonics = np.asarray(
                    [
                        db_to_gain(value)
                        for value in shaped_row["metrics"]["harmonic_peak_dbfs"][:20]
                    ]
                )
                for predicted, measured in zip(
                    predicted_harmonics[:9], measured_harmonics[:9]
                ):
                    if measured > db_to_gain(-140.0):
                        errors_db.append(gain_to_db(predicted / measured))
        error_array = np.asarray(errors_db)
        model.update(
            {
                "formula": (
                    "(tanh(3*x + 0.125) - tanh(0.125)) / sqrt(2)"
                    if color == "Tube"
                    else "tanh(3*x) / sqrt(2)"
                ),
                "small_signal_gain_db": gain_to_db(
                    (3.0 / math.sqrt(2.0))
                    * (1.0 - math.tanh(model["bias"]) ** 2)
                ),
                "fit_rms_error_db": float(
                    np.sqrt(np.mean(np.square(error_array)))
                ),
                "fit_maximum_error_db": float(np.max(np.abs(error_array))),
                "measured_harmonic_points": int(error_array.size),
            }
        )
    analysis["spectre_subtle_transfer_model"] = subtle_models

    difference_law_errors: list[float] = []
    for gain_db in available_gains:
        expected_difference_gain = db_to_gain(float(gain_db)) - 1.0
        for level in available_levels:
            clean_row = rows[
                f"shaper-transfer__clean__subtle__gain-{gain_db}__input-{level}"
            ]
            measured_band_peak_dbfs = clean_row["metrics"]["fundamental_peak_dbfs"]
            expected_input_peak_dbfs = float(level) + gain_to_db(math.sqrt(2.0))
            expected_band_peak_dbfs = (
                expected_input_peak_dbfs + gain_to_db(expected_difference_gain)
            )
            difference_law_errors.append(
                measured_band_peak_dbfs - expected_band_peak_dbfs
            )
    difference_error_array = np.asarray(difference_law_errors)
    analysis["linear_band_difference_law"] = {
        "formula": "band * (10^(12*amount/20) - 1)",
        "spectre_gain_range_db": [0.0, 12.0],
        "fit_rms_error_db": float(
            np.sqrt(np.mean(np.square(difference_error_array)))
        ),
        "fit_maximum_error_db": float(np.max(np.abs(difference_error_array))),
        "measured_points": int(difference_error_array.size),
    }

    parallel: dict[str, Any] = {}
    for de_emphasis in (False, True):
        d = outputs[f"parallel__dry__de-{int(de_emphasis)}"]
        b1 = outputs[f"parallel__band1__de-{int(de_emphasis)}"]
        b2 = outputs[f"parallel__band2__de-{int(de_emphasis)}"]
        both = outputs[f"parallel__both__de-{int(de_emphasis)}"]
        error = both - (b1 + b2 - d)
        parallel[f"de_{int(de_emphasis)}"] = {
            "maximum_additivity_error": float(np.max(np.abs(error))),
            "rms_additivity_error": float(np.sqrt(np.mean(np.square(error)))),
        }
    analysis["parallel_band_additivity"] = parallel

    routing: dict[str, Any] = {}
    for input_routing in ("mid", "side", "left", "right"):
        routing[input_routing] = {}
        for processing in ("stereo", "left", "right", "mid", "side"):
            row = rows[f"routing__input-{input_routing}__process-{processing}"]
            routing[input_routing][processing] = {
                "left_rms_dbfs": row["metrics"]["left_rms_dbfs"],
                "right_rms_dbfs": row["metrics"]["right_rms_dbfs"],
                "mid_rms_dbfs": row["metrics"]["mid_rms_dbfs"],
                "side_rms_dbfs": row["metrics"]["side_rms_dbfs"],
            }
    analysis["routing"] = routing

    sample_rates: dict[str, Any] = {}
    for color in ("clean", "tube", "solid"):
        sample_rates[color] = {
            str(sample_rate): {
                "fundamental_peak_dbfs": rows[
                    f"sample-rate__{color}__{sample_rate}"
                ]["metrics"]["fundamental_peak_dbfs"],
                "h2_relative_db": rows[f"sample-rate__{color}__{sample_rate}"][
                    "metrics"
                ]["harmonic_relative_db"][1],
                "h3_relative_db": rows[f"sample-rate__{color}__{sample_rate}"][
                    "metrics"
                ]["harmonic_relative_db"][2],
            }
            for sample_rate in (44_100, 48_000, 96_000, 192_000)
        }
    analysis["sample_rate"] = sample_rates
    return analysis


def build_listening_bundle(builder: CorpusBuilder, rows_by_id: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    for stimulus_id in (
        "pink--18db-rms-48k",
        "drums--18db-rms-48k",
        "bass--18db-rms-48k",
        "bright-poly--18db-rms-48k",
    ):
        dry_case_id = f"dry__{stimulus_id}"
        dry = builder.outputs[dry_case_id]
        dry_path = builder.listening_dir / stimulus_id / "00-dry.wav"
        write_float_wav(dry_path, 48_000, dry)
        dry_lufs = integrated_lufs(dry_path)
        for index, (setting_id, _) in enumerate(music_settings(), start=1):
            case_id = f"music__{stimulus_id}__{setting_id}"
            output = builder.outputs[case_id]
            raw_path = builder.listening_dir / stimulus_id / f"{index:02d}-{setting_id}-raw.wav"
            write_float_wav(raw_path, 48_000, output)
            output_lufs = integrated_lufs(raw_path)
            match_db = 0.0
            if dry_lufs is not None and output_lufs is not None:
                match_db = dry_lufs - output_lufs
            matched = (output * db_to_gain(match_db)).astype(np.float32)
            matched_path = (
                builder.listening_dir / stimulus_id / f"{index:02d}-{setting_id}-matched.wav"
            )
            write_float_wav(matched_path, 48_000, matched)
            results.append(
                {
                    "case": case_id,
                    "dry_lufs": dry_lufs,
                    "raw_lufs": output_lufs,
                    "static_match_gain_db": match_db,
                    "raw_path": str(raw_path.relative_to(builder.output_root)),
                    "matched_path": str(matched_path.relative_to(builder.output_root)),
                    "raw_rms_delta_db": (
                        rows_by_id[case_id]["metrics"]["rms_dbfs"]
                        - rows_by_id[dry_case_id]["metrics"]["rms_dbfs"]
                    ),
                }
            )
    return results


def plugin_metadata() -> dict[str, Any]:
    info_path = AU_PATH / "Contents" / "Info.plist"
    info: dict[str, Any] = {}
    if info_path.exists():
        with info_path.open("rb") as handle:
            plist = plistlib.load(handle)
        info = {
            "bundle_identifier": plist.get("CFBundleIdentifier"),
            "short_version": plist.get("CFBundleShortVersionString"),
            "bundle_version": plist.get("CFBundleVersion"),
        }
    binary_path = AU_PATH / "Contents" / "MacOS" / "Spectre"
    return {
        **info,
        "au_path": str(AU_PATH),
        "vst3_path": str(VST3_PATH),
        "au_binary_sha256": sha256_file(binary_path),
        "license_file_present": LICENSE_PATH.is_file(),
        "license_file_size": LICENSE_PATH.stat().st_size if LICENSE_PATH.is_file() else None,
        "headless_session_limit_seconds": SESSION_AUDIO_LIMIT_SECONDS,
        "documented_demo_dip_interval_seconds": SPECTRE_DEMO_DIP_SECONDS,
    }


def measure_tube_dc_decay() -> dict[str, Any]:
    """Estimate Spectre's effective residue-DC decay from a settled sine onset.

    The fitted tail includes the surrounding EQ/resampler settling, so it is range
    evidence for the fixed blocker rather than a claim to identify an internal pole.
    """
    sample_rate = 48_000
    onset_frames = sample_rate
    audio = np.zeros((2, sample_rate * 4), dtype=np.float32)
    audio[:, onset_frames:] = make_sine(
        sample_rate,
        1_000.0,
        -18.0,
        duration_seconds=3.0,
    )
    output, _ = SpectreSession().process(
        audio,
        sample_rate,
        one_peak_settings(
            frequency_hz=1_000.0,
            gain_db=12.0,
            q=1.0,
            color="Tube",
            mode="Subtle",
            de_emphasis=True,
            mix=0.5,
        ),
    )
    residue = np.mean(output, axis=0) - np.mean(audio, axis=0)
    residue = residue[onset_frames:]
    cycle_frames = sample_rate // 1_000
    cycle_count = residue.size // cycle_frames
    cycle_means = residue[: cycle_count * cycle_frames].reshape(
        cycle_count,
        cycle_frames,
    ).mean(axis=1)
    late_baseline = float(np.mean(cycle_means[-500:]))
    magnitude = np.abs(cycle_means.astype(np.float64) - late_baseline)
    time_seconds = np.arange(cycle_count, dtype=np.float64) * cycle_frames / sample_rate
    fit_mask = (
        (time_seconds >= 0.02)
        & (time_seconds <= 0.25)
        & (magnitude > 2.0e-7)
    )
    slope, intercept = np.polyfit(
        time_seconds[fit_mask],
        np.log(magnitude[fit_mask]),
        1,
    )
    fitted = intercept + slope * time_seconds[fit_mask]
    observed = np.log(magnitude[fit_mask])
    residual_sum = float(np.sum(np.square(observed - fitted)))
    total_sum = float(np.sum(np.square(observed - np.mean(observed))))
    return {
        "stimulus": "1 second silence then 3 seconds 1 kHz sine at -18 dBFS RMS",
        "settings": "Peak 1, 1 kHz, +12 dB, Q 1, Tube, Subtle, de-emphasis on, Mix 50%",
        "fit_window_seconds": [0.02, 0.25],
        "fit_point_count": int(np.count_nonzero(fit_mask)),
        "effective_decay_hz": float(-slope / (2.0 * math.pi)),
        "fit_r_squared": 1.0 - residual_sum / max(total_sum, 1.0e-30),
        "interpretation": (
            "The surrounding filter/resampler transient is included; use this only "
            "as evidence for an approximately 10-15 Hz fixed residue blocker."
        ),
    }


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--quick", action="store_true")
    parser.add_argument(
        "--metrics-only",
        action="store_true",
        help="save only the explicitly curated audio files",
    )
    args = parser.parse_args()

    for required_path in (AU_PATH, VST3_PATH, LICENSE_PATH):
        if not required_path.exists():
            raise FileNotFoundError(required_path)

    builder = CorpusBuilder(args.output.resolve(), save_all_audio=not args.metrics_only)
    add_primary_stimuli(builder)
    add_dry_references(builder)
    add_clean_and_mix_cases(builder)
    add_transfer_cases(builder, full=not args.quick)
    add_shaper_transfer_cases(builder, full=not args.quick)
    add_frequency_q_quality_cases(builder, full=not args.quick)
    add_routing_and_topology_cases(builder)
    add_sample_rate_cases(builder)
    add_algorithm_survey(builder)
    add_music_cases(builder)

    print(f"capturing {len(builder.cases)} cases to {builder.output_root}", flush=True)
    builder.render()
    rows_by_id = {row["id"]: row for row in builder.rows}
    probe = builder.stimuli["sine-1k--18db-rms-mid-48k"]
    report = {
        "schema": "cosimo.spectre-blackbox.v1",
        "plugin": plugin_metadata(),
        "authorization_note": (
            "The custom UI reopened without its authorisation panel after activation, but "
            "headless AU and VST3 hosts still exhibit the documented dip at 58-60 seconds. "
            "All corpus sessions are therefore restarted before 40 seconds; the manual states "
            "all other demo features remain fully available."
        ),
        "corpus": {
            "case_count": len(builder.rows),
            "stimulus_count": len(builder.stimuli),
            "session_count": builder.session.session_count,
            "rows_path": "measurements.json",
        },
        "determinism": compare_determinism(probe),
        "au_vst3_equivalence": compare_formats(probe),
        "analysis": analyse(builder),
    }
    report["analysis"]["tube_dc_decay_probe"] = measure_tube_dc_decay()
    report["listening_bundle"] = build_listening_bundle(builder, rows_by_id)
    write_json(builder.output_root / "measurements.json", builder.rows)
    write_json(builder.output_root / "report.json", report)
    print(
        json.dumps(
            {
                "report": str(builder.output_root / "report.json"),
                "cases": len(builder.rows),
                "sessions": builder.session.session_count,
                "deterministic": report["determinism"][
                    "three_fresh_instances_bit_identical"
                ],
                "au_vst3_bit_identical": report["au_vst3_equivalence"][
                    "bit_identical"
                ],
            },
            indent=2,
            sort_keys=True,
        ),
        flush=True,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
