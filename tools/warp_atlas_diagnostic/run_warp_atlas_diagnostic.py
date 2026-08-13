#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
import struct
import subprocess
import sys
import tempfile
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[2]
TOOL_DIR = Path(__file__).resolve().parent
RENDERER_DIR = REPO_ROOT / "native" / "three_oscillator_renderer"


class DiagnosticFailure(RuntimeError):
    pass


RUN_REPORT_KEYS = {
    "schema",
    "fixtureContract",
    "selection",
    "automaticFamilyCrossoverEnabled",
    "automaticHandoffVerified",
    "sampleRate",
    "oversampleFactor",
    "initialPhase",
    "warmupFrames",
    "captureFrames",
    "repetitions",
    "atlas",
    "renderCpuSeconds",
    "renderWallSeconds",
    "peakRssBytes",
    "cases",
}


def compile_diagnostic(output: Path) -> None:
    command = [
        "/usr/bin/c++",
        "-std=c++17",
        "-O2",
        "-Wall",
        "-Wextra",
        "-Werror",
        "-Wno-deprecated-declarations",
        "-Wno-unused-local-typedef",
        "-Wno-unused-function",
        f"-I{TOOL_DIR}",
        f"-I{RENDERER_DIR}",
        f"-I{RENDERER_DIR / 'third_party' / 'xsimd' / 'include'}",
        str(TOOL_DIR / "main.cpp"),
        str(TOOL_DIR / "AtlasFile.cpp"),
        str(RENDERER_DIR / "WarpRenderer.cpp"),
        "-o",
        str(output),
    ]
    completed = subprocess.run(
        command,
        cwd=REPO_ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    if completed.returncode != 0:
        raise DiagnosticFailure(
            "diagnostic compiler failed:\n" + completed.stdout + completed.stderr
        )


def run_capture(
    binary: Path,
    output_directory: Path,
    *,
    selection: str,
    atlas: Path | None,
    quick: bool,
) -> dict[str, Any]:
    command = [
        str(binary),
        "--output-dir",
        str(output_directory),
        "--path",
        selection,
    ]
    if atlas is not None:
        command.extend(("--atlas", str(atlas)))
    if quick:
        command.append("--quick")
    completed = subprocess.run(
        command,
        cwd=REPO_ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    if completed.returncode != 0:
        if completed.stderr:
            sys.stderr.write(completed.stderr)
        raise DiagnosticFailure(
            f"{selection} diagnostic exited with status {completed.returncode}"
        )
    try:
        report = json.loads(completed.stdout)
    except json.JSONDecodeError as error:
        raise DiagnosticFailure(
            f"{selection} diagnostic returned invalid JSON: {error}"
        ) from error
    if not isinstance(report, dict):
        raise DiagnosticFailure(f"{selection} diagnostic report is not an object")
    if report.get("schema") != "cosimo.warp-atlas-diagnostic-run.v1":
        raise DiagnosticFailure(f"{selection} diagnostic report has the wrong schema")
    missing_keys = RUN_REPORT_KEYS.difference(report)
    if missing_keys:
        raise DiagnosticFailure(
            f"{selection} diagnostic report is missing {sorted(missing_keys)}"
        )
    if not isinstance(report["atlas"], dict) or not isinstance(report["cases"], list):
        raise DiagnosticFailure(f"{selection} diagnostic report has malformed sections")
    if not all(isinstance(case, dict) for case in report["cases"]):
        raise DiagnosticFailure(f"{selection} diagnostic report has a malformed case")
    if report.get("selection") != selection:
        raise DiagnosticFailure(
            f"diagnostic reported {report.get('selection')!r} for {selection!r}"
        )
    return report


def read_float32_mono_wav(path: Path) -> list[float]:
    contents = path.read_bytes()
    if len(contents) < 44 or contents[:4] != b"RIFF" or contents[8:12] != b"WAVE":
        raise DiagnosticFailure(f"invalid WAV container: {path}")
    offset = 12
    format_tag: int | None = None
    channels: int | None = None
    bits_per_sample: int | None = None
    audio: bytes | None = None
    while offset + 8 <= len(contents):
        chunk_id = contents[offset : offset + 4]
        chunk_size = struct.unpack_from("<I", contents, offset + 4)[0]
        payload_start = offset + 8
        payload_end = payload_start + chunk_size
        if payload_end > len(contents):
            raise DiagnosticFailure(f"truncated WAV chunk: {path}")
        if chunk_id == b"fmt " and chunk_size >= 16:
            format_tag, channels = struct.unpack_from("<HH", contents, payload_start)
            bits_per_sample = struct.unpack_from("<H", contents, payload_start + 14)[0]
        elif chunk_id == b"data":
            audio = contents[payload_start:payload_end]
        offset = payload_end + (chunk_size & 1)
    if format_tag != 3 or channels != 1 or bits_per_sample != 32 or audio is None:
        raise DiagnosticFailure(f"expected mono float32 WAV: {path}")
    if len(audio) % 4 != 0:
        raise DiagnosticFailure(f"unaligned float32 WAV data: {path}")
    return list(struct.unpack(f"<{len(audio) // 4}f", audio))


def relative_path(path: Path, root: Path) -> str:
    return path.resolve().relative_to(root.resolve()).as_posix()


PAIRING_KEYS = (
    "fixtureContract",
    "sampleRate",
    "oversampleFactor",
    "initialPhase",
    "warmupFrames",
    "captureFrames",
    "repetitions",
)
CASE_PAIRING_KEYS = (
    "name",
    "family",
    "amountClass",
    "amount",
    "phaseIncrement",
    "pitchWobble",
    "mipBoundaryPitchCase",
)


def validate_pairing(runtime: dict[str, Any], atlas: dict[str, Any]) -> None:
    for key in PAIRING_KEYS:
        if runtime.get(key) != atlas.get(key):
            raise DiagnosticFailure(f"paired run mismatch at {key}")
    if runtime.get("automaticFamilyCrossoverEnabled") is not False:
        raise DiagnosticFailure("runtime-only capture did not disable family crossover")
    if atlas.get("automaticFamilyCrossoverEnabled") is not False:
        raise DiagnosticFailure("atlas-only capture did not disable family crossover")
    runtime_atlas = runtime.get("atlas", {})
    atlas_atlas = atlas.get("atlas", {})
    if runtime_atlas.get("requested") is not False:
        raise DiagnosticFailure("runtime-only capture unexpectedly requested an atlas")
    if runtime_atlas.get("viewPackedSampleCount") != 0:
        raise DiagnosticFailure("runtime-only capture did not pass an empty atlas view")
    if runtime_atlas.get("storageByteCount") != 0:
        raise DiagnosticFailure("runtime-only capture allocated atlas storage")
    if atlas_atlas.get("validated") is not True:
        raise DiagnosticFailure("atlas-only capture did not report canonical validation")
    runtime_cases = runtime.get("cases", [])
    atlas_cases = atlas.get("cases", [])
    if len(runtime_cases) != len(atlas_cases) or not runtime_cases:
        raise DiagnosticFailure("paired runs did not emit the same non-empty case set")
    for runtime_case, atlas_case in zip(runtime_cases, atlas_cases, strict=True):
        for key in CASE_PAIRING_KEYS:
            if runtime_case.get(key) != atlas_case.get(key):
                raise DiagnosticFailure(
                    f"paired case mismatch at {runtime_case.get('name')}:{key}"
                )
        if runtime_case.get("purePathVerified") is not True:
            raise DiagnosticFailure(
                f"runtime path was not pure for {runtime_case.get('name')}"
            )
        if atlas_case.get("purePathVerified") is not True:
            raise DiagnosticFailure(
                f"atlas path was not pure for {atlas_case.get('name')}"
            )
    families = {case.get("family") for case in runtime_cases}
    if families != {"bend", "pwm", "asym", "mirror"}:
        raise DiagnosticFailure(f"incomplete warp-family coverage: {sorted(families)}")
    for family in families:
        classes = {
            case.get("amountClass")
            for case in runtime_cases
            if case.get("family") == family
        }
        if not {"neutral", "extreme"}.issubset(classes):
            raise DiagnosticFailure(f"{family} lacks neutral/extreme coverage")
    if not any(case.get("mipBoundaryPitchCase") is True for case in runtime_cases):
        raise DiagnosticFailure("comparison lacks a mip-boundary pitch case")


def audio_difference(runtime: list[float], atlas: list[float]) -> dict[str, Any]:
    if len(runtime) != len(atlas) or not runtime:
        raise DiagnosticFailure("paired WAVs have different or empty sample counts")
    residual_energy = 0.0
    reference_energy = 0.0
    maximum = 0.0
    for runtime_sample, atlas_sample in zip(runtime, atlas, strict=True):
        residual = atlas_sample - runtime_sample
        residual_energy += residual * residual
        reference_energy += runtime_sample * runtime_sample
        maximum = max(maximum, abs(residual))
    rms = math.sqrt(residual_energy / len(runtime))
    if residual_energy == 0.0:
        null_snr_db: float | None = None
        bit_identical = True
    else:
        null_snr_db = (
            10.0 * math.log10(reference_energy / residual_energy)
            if reference_energy > 0.0
            else None
        )
        bit_identical = False
    return {
        "sampleCount": len(runtime),
        "maximumAbsolute": maximum,
        "rms": rms,
        "nullSnrDb": null_snr_db,
        "bitIdentical": bit_identical,
    }


def comparison_report(
    output_directory: Path,
    runtime: dict[str, Any],
    atlas: dict[str, Any],
) -> dict[str, Any]:
    validate_pairing(runtime, atlas)
    paired_cases: list[dict[str, Any]] = []
    for runtime_case, atlas_case in zip(
        runtime["cases"], atlas["cases"], strict=True
    ):
        runtime_wav = output_directory / "runtime-only" / runtime_case["wav"]
        atlas_wav = output_directory / "atlas-only" / atlas_case["wav"]
        difference = audio_difference(
            read_float32_mono_wav(runtime_wav),
            read_float32_mono_wav(atlas_wav),
        )
        paired_cases.append(
            {
                **{key: runtime_case[key] for key in CASE_PAIRING_KEYS},
                "runtimeWav": relative_path(runtime_wav, output_directory),
                "atlasWav": relative_path(atlas_wav, output_directory),
                "audioDifference": difference,
                "cpuSeconds": {
                    "runtimeOnly": runtime_case["cpuSeconds"],
                    "atlasOnly": atlas_case["cpuSeconds"],
                },
                "wallSeconds": {
                    "runtimeOnly": runtime_case["wallSeconds"],
                    "atlasOnly": atlas_case["wallSeconds"],
                },
            }
        )
    return {
        "schema": "cosimo.warp-atlas-comparison.v1",
        "purpose": "developer diagnostic comparison; no product selection is inferred",
        "similarityPassThreshold": None,
        "pairing": {
            "fixtureContract": runtime["fixtureContract"],
            "identicalTables": True,
            "identicalControlSchedules": True,
            "identicalInitialState": True,
            "identicalWarmup": True,
            "automaticFamilyCrossoverDisabled": True,
            "sampleRate": runtime["sampleRate"],
            "oversampleFactor": runtime["oversampleFactor"],
            "initialPhase": runtime["initialPhase"],
            "warmupFrames": runtime["warmupFrames"],
            "captureFrames": runtime["captureFrames"],
            "repetitions": runtime["repetitions"],
        },
        "atlas": atlas["atlas"],
        "runs": {
            "runtimeOnly": {
                "renderCpuSeconds": runtime["renderCpuSeconds"],
                "renderWallSeconds": runtime["renderWallSeconds"],
                "peakRssBytes": runtime["peakRssBytes"],
                "atlasStorageByteCount": runtime["atlas"]["storageByteCount"],
            },
            "atlasOnly": {
                "renderCpuSeconds": atlas["renderCpuSeconds"],
                "renderWallSeconds": atlas["renderWallSeconds"],
                "peakRssBytes": atlas["peakRssBytes"],
                "atlasStorageByteCount": atlas["atlas"]["storageByteCount"],
                "atlasLoadSeconds": atlas["atlas"]["loadSeconds"],
            },
        },
        "cases": paired_cases,
    }


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run the developer-only runtime/warp-atlas diagnostic."
    )
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument(
        "--atlas",
        type=Path,
        help="enable the canonical atlas; omission is the runtime-only default",
    )
    parser.add_argument(
        "--compare",
        action="store_true",
        help="emit pure runtime-only and atlas-only paired WAVs plus comparison.json",
    )
    parser.add_argument("--quick", action="store_true")
    parser.add_argument(
        "--diagnostic-binary",
        type=Path,
        help="reuse an already-built diagnostic binary",
    )
    return parser.parse_args()


def run_with_binary(arguments: argparse.Namespace, binary: Path) -> Path:
    output_directory = arguments.output_dir.resolve()
    if output_directory.exists() and any(output_directory.iterdir()):
        raise DiagnosticFailure(
            f"--output-dir must be empty to avoid mixing evidence: {output_directory}"
        )
    if arguments.compare:
        if arguments.atlas is None:
            raise DiagnosticFailure("--compare requires --atlas")
        runtime = run_capture(
            binary,
            output_directory / "runtime-only",
            selection="runtime-only",
            atlas=None,
            quick=arguments.quick,
        )
        atlas = run_capture(
            binary,
            output_directory / "atlas-only",
            selection="atlas-only",
            atlas=arguments.atlas.resolve(),
            quick=arguments.quick,
        )
        report = comparison_report(output_directory, runtime, atlas)
        report_path = output_directory / "comparison.json"
    else:
        selection = "auto-handoff" if arguments.atlas is not None else "runtime-only"
        report = run_capture(
            binary,
            output_directory,
            selection=selection,
            atlas=arguments.atlas.resolve() if arguments.atlas is not None else None,
            quick=arguments.quick,
        )
        report_path = output_directory / "diagnostic.json"
    output_directory.mkdir(parents=True, exist_ok=True)
    report_path.write_text(
        json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    return report_path


def main() -> int:
    arguments = parse_arguments()
    try:
        if arguments.diagnostic_binary is not None:
            report_path = run_with_binary(
                arguments, arguments.diagnostic_binary.resolve()
            )
        else:
            with tempfile.TemporaryDirectory(prefix="cosimo-warp-atlas-") as temporary:
                binary = Path(temporary) / "warp-atlas-diagnostic"
                compile_diagnostic(binary)
                report_path = run_with_binary(arguments, binary)
        print(report_path)
        return 0
    except DiagnosticFailure as error:
        if str(error):
            print(str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
