#!/usr/bin/env python3

from __future__ import annotations

import argparse
import hashlib
import json
import math
import shutil
import statistics
import subprocess
import sys
import time
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
PATCH_MANIFEST = REPO_ROOT / "WavetableSynth.cmajorpatch"
PROFILE_HEADER_GENERATOR = REPO_ROOT / "scripts" / "generate_native_modulation_benchmark_header.mjs"
HARNESS_SOURCE = REPO_ROOT / "tests" / "native_modulation_benchmark" / "NativeModulationMatrixBenchmark.cpp"
EXPECTED_PROFILE_NAMES = {
    "voice-100",
    "voice-rack-100",
    "mixed-100",
    "combined-200",
    "stored-624-active-100",
    "active-624",
}
EXPECTED_EFFECT_CONFIGURATION = {
    "unisonVoices": 1.0,
    "warpMode": 0.0,
    "warpAmount": 0.0,
    "filterMode": 1.0,
    "filterCutoff": 1200.0,
    "globalFilterMode": 1.0,
    "globalFilterCutoff": 1200.0,
    "globalFilterResonance": 0.707107,
    "globalFilterDrive": 1.0,
    "distortionWet": 0.35,
    "ottAmount": 35.0,
    "ottMix": 35.0,
    "chorusMix": 0.3,
    "flangerMix": 0.25,
    "phaserMix": 0.25,
    "delayMix": 0.25,
    "reverbMix": 0.3,
}
ZERO_COUNTS = {"voice": 0, "macroVoice": 0, "voiceRack": 0, "macroRack": 0}
MATRIX_LOAD_BUDGETS = {
    "voice-100": 10.0,
    "voice-rack-100": 10.0,
    "mixed-100": 10.0,
    "stored-624-active-100": 10.0,
    "combined-200": 15.0,
    "active-624": 35.0,
}
QUALIFYING_BLOCKS = 4096
QUALIFYING_REPEATS = 3


def run(command: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        cwd=REPO_ROOT,
        check=True,
        capture_output=True,
        text=True,
    )


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def require_tool(name: str) -> str:
    executable = shutil.which(name)
    if executable is None:
        raise RuntimeError(f"Required tool is unavailable: {name}")
    return executable


def quoted_include_definition(name: str, path: Path) -> str:
    value = str(path.resolve())
    if '"' in value:
        raise ValueError(f"Generated include path contains a quote: {value}")
    return f'-D{name}="{value}"'


def generate_and_compile(build_dir: Path) -> tuple[Path, Path, Path, list[str]]:
    cmaj = require_tool("cmaj")
    compiler = require_tool("clang++")
    node = require_tool("node")
    build_dir.mkdir(parents=True, exist_ok=True)
    generated_cpp = build_dir / "WavetableSynth.cpp"
    profile_header = build_dir / "NativeModulationBenchmarkProfiles.hpp"
    executable = build_dir / "native-modulation-matrix-benchmark"

    run([node, str(PROFILE_HEADER_GENERATOR), "--output", str(profile_header)])
    run(
        [
            cmaj,
            "generate",
            "-O3",
            "--target=cpp",
            "--maxFramesPerBlock=128",
            str(PATCH_MANIFEST),
            f"--output={generated_cpp}",
        ]
    )
    compile_command = [
        compiler,
        "-std=c++20",
        "-O3",
        "-DNDEBUG",
        str(HARNESS_SOURCE),
        quoted_include_definition("COSIMO_GENERATED_CPP_PATH", generated_cpp),
        quoted_include_definition("COSIMO_NATIVE_BENCHMARK_PROFILE_HEADER_PATH", profile_header),
        "-o",
        str(executable),
    ]
    run(compile_command)
    return executable, generated_cpp, profile_header, compile_command


def parse_counts(fields: list[str], start: int) -> dict[str, int]:
    return {
        "voice": int(fields[start]),
        "macroVoice": int(fields[start + 1]),
        "voiceRack": int(fields[start + 2]),
        "macroRack": int(fields[start + 3]),
    }


def parse_profile(fields: list[str]) -> dict[str, object]:
    if len(fields) != 29:
        raise RuntimeError(f"Native benchmark emitted a malformed profile row ({len(fields)} fields)")
    maximum_delta = float(fields[21])
    non_finite_count = int(fields[19])
    return {
        "name": fields[1],
        "stateSha256": fields[2],
        "storedRouteCount": int(fields[3]),
        "activeRouteCount": int(fields[4]),
        "installedCounts": parse_counts(fields, 5),
        "emptyInstalledCounts": parse_counts(fields, 9),
        "emptyVoiceMask": int(fields[13]),
        "loadedVoiceMask": int(fields[14]),
        "emptyRackEnableMask": int(fields[15]),
        "loadedRackEnableMask": int(fields[16]),
        "adjacentPairCount": int(fields[17]),
        "sampleCount": int(fields[18]),
        "nonFiniteSampleCount": non_finite_count,
        "bitMismatchSampleCount": int(fields[20]),
        "maximumAbsoluteSampleDelta": maximum_delta,
        "audioEquivalent": non_finite_count == 0 and maximum_delta <= 1.0e-7,
        "emptyRms": float(fields[22]),
        "loadedRms": float(fields[23]),
        "emptyMeanNanoseconds": float(fields[24]),
        "loadedMeanNanoseconds": float(fields[25]),
        "pairedMeanDeltaNanoseconds": float(fields[26]),
        "pairedMedianDeltaNanoseconds": float(fields[27]),
        "addedRenderLoadPercentagePoints": float(fields[28]),
    }


def parse_run(output: str) -> dict[str, object]:
    metadata: dict[str, object] | None = None
    effects: dict[str, float] = {}
    profiles: list[dict[str, object]] = []
    for line in output.splitlines():
        fields = line.split("\t")
        if fields[0] == "META":
            if len(fields) != 6:
                raise RuntimeError("Native benchmark emitted malformed metadata")
            metadata = {
                "sampleRate": int(fields[1]),
                "blockSize": int(fields[2]),
                "profileGenerator": fields[3],
                "profileDocumentSha256": fields[4],
                "repeatIndex": int(fields[5]),
            }
        elif fields[0] == "EFFECT":
            if len(fields) != 3:
                raise RuntimeError("Native benchmark emitted malformed effect evidence")
            effects[fields[1]] = float(fields[2])
        elif fields[0] == "PROFILE":
            profiles.append(parse_profile(fields))
        elif line:
            raise RuntimeError(f"Native benchmark emitted an unknown record: {line}")

    if metadata is None or {str(profile["name"]) for profile in profiles} != EXPECTED_PROFILE_NAMES:
        raise RuntimeError("Native benchmark omitted required metadata or shared profiles")
    if set(effects) != set(EXPECTED_EFFECT_CONFIGURATION):
        raise RuntimeError("Native benchmark did not configure the exact full synth/effect workload")
    for name, expected in EXPECTED_EFFECT_CONFIGURATION.items():
        if not math.isclose(effects[name], expected, rel_tol=0.0, abs_tol=1.0e-6):
            raise RuntimeError(f"Native benchmark effect setting {name} differs from the declared workload")
    for profile in profiles:
        if profile["emptyInstalledCounts"] != ZERO_COUNTS:
            raise RuntimeError(f"{profile['name']} did not use an empty adjacent baseline")
        if profile["emptyVoiceMask"] != 0xFFFF or profile["loadedVoiceMask"] != 0xFFFF:
            raise RuntimeError(f"{profile['name']} did not sustain all 16 production voices")
        if profile["emptyRackEnableMask"] != 0xFF or profile["loadedRackEnableMask"] != 0xFF:
            raise RuntimeError(f"{profile['name']} did not retain all eight effects")
        if profile["audioEquivalent"] is not True:
            raise RuntimeError(f"{profile['name']} changed audio relative to its adjacent empty pair")
        if float(profile["emptyRms"]) <= 1.0e-5 or float(profile["loadedRms"]) <= 1.0e-5:
            raise RuntimeError(f"{profile['name']} did not produce non-silent production audio")
    return {"metadata": metadata, "effects": effects, "profiles": profiles}


def require_same(values: list[object], field: str) -> object:
    first = values[0]
    if any(value != first for value in values[1:]):
        raise RuntimeError(f"Native benchmark repeats disagree about {field}")
    return first


def aggregate_profile(name: str, runs: list[dict[str, object]]) -> dict[str, object]:
    records = [
        next(profile for profile in run["profiles"] if profile["name"] == name)  # type: ignore[index]
        for run in runs
    ]
    stable_fields = (
        "stateSha256",
        "storedRouteCount",
        "activeRouteCount",
        "installedCounts",
        "emptyInstalledCounts",
    )
    aggregate = {"name": name}
    for field in stable_fields:
        aggregate[field] = require_same([record[field] for record in records], f"{name}.{field}")
    aggregate.update(
        {
            "compiledCounts": aggregate["installedCounts"],
            "audioEquivalent": all(record["audioEquivalent"] is True for record in records),
            "maximumAbsoluteSampleDelta": max(float(record["maximumAbsoluteSampleDelta"]) for record in records),
            "nonFiniteSampleCount": sum(int(record["nonFiniteSampleCount"]) for record in records),
            "bitMismatchSampleCount": sum(int(record["bitMismatchSampleCount"]) for record in records),
            "emptyRms": statistics.median(float(record["emptyRms"]) for record in records),
            "loadedRms": statistics.median(float(record["loadedRms"]) for record in records),
            "emptyMeanNanoseconds": statistics.median(float(record["emptyMeanNanoseconds"]) for record in records),
            "loadedMeanNanoseconds": statistics.median(float(record["loadedMeanNanoseconds"]) for record in records),
            "pairedMeanDeltaNanoseconds": statistics.median(float(record["pairedMeanDeltaNanoseconds"]) for record in records),
            "pairedMedianDeltaNanoseconds": statistics.median(float(record["pairedMedianDeltaNanoseconds"]) for record in records),
            "addedRenderLoadPercentagePoints": statistics.median(float(record["addedRenderLoadPercentagePoints"]) for record in records),
            "adjacentPairCount": sum(int(record["adjacentPairCount"]) for record in records),
            "sampleCount": sum(int(record["sampleCount"]) for record in records),
        }
    )
    return aggregate


def assert_matrix_budgets(profiles: list[dict[str, object]]) -> None:
    by_name = {str(profile["name"]): profile for profile in profiles}
    for name, maximum_added_load in MATRIX_LOAD_BUDGETS.items():
        added_load = float(by_name[name]["addedRenderLoadPercentagePoints"])
        if added_load > maximum_added_load:
            raise RuntimeError(
                f"{name} matrix cost added {added_load:.3f} render-load points; "
                f"budget is {maximum_added_load:.3f}"
            )


def build_result(
    *,
    runs: list[dict[str, object]],
    generated_cpp: Path,
    profile_header: Path,
    compile_command: list[str],
    blocks: int,
    warmup_blocks: int,
    settle_blocks: int,
    elapsed_seconds: float,
) -> dict[str, object]:
    metadata_records = [run["metadata"] for run in runs]
    sample_rate = require_same([metadata["sampleRate"] for metadata in metadata_records], "sampleRate")  # type: ignore[index]
    block_size = require_same([metadata["blockSize"] for metadata in metadata_records], "blockSize")  # type: ignore[index]
    profile_generator = require_same([metadata["profileGenerator"] for metadata in metadata_records], "profileGenerator")  # type: ignore[index]
    document_sha = require_same([metadata["profileDocumentSha256"] for metadata in metadata_records], "profileDocumentSha256")  # type: ignore[index]
    if sample_rate != 48_000 or block_size != 128:
        raise RuntimeError("Native performer did not run the required 48 kHz / 128-frame contract")
    if profile_generator != "scripts/generate_modulation_benchmark_profiles.mjs":
        raise RuntimeError("Native performer did not consume the shared benchmark profile authority")

    profiles = [aggregate_profile(name, runs) for name in sorted(EXPECTED_PROFILE_NAMES)]
    qualifying = blocks >= QUALIFYING_BLOCKS and len(runs) >= QUALIFYING_REPEATS
    return {
        "format": "cosimo.native-modulation-benchmark",
        "version": 1,
        "productionSeam": {
            "patchManifest": "WavetableSynth.cmajorpatch",
            "generatorTarget": "cpp",
            "maxFramesPerBlock": 128,
            "profileGenerator": profile_generator,
        },
        "sampleRate": sample_rate,
        "blockSize": block_size,
        "repeatCount": len(runs),
        "qualification": "shipping" if qualifying else "smoke-only",
        "blocksPerRepeat": blocks,
        "warmupBlocksPerProfile": warmup_blocks,
        "settleBlocksPerProfile": settle_blocks,
        "voiceIndexes": list(range(16)),
        "rackEnableMask": 0xFF,
        "effectConfiguration": dict(sorted(EXPECTED_EFFECT_CONFIGURATION.items())),
        "profileDocumentSha256": document_sha,
        "generatedPerformerSha256": sha256(generated_cpp),
        "generatedProfileHeaderSha256": sha256(profile_header),
        "compilerCommand": compile_command,
        "elapsedSeconds": elapsed_seconds,
        "profiles": profiles,
    }


def positive_int(value: str) -> int:
    parsed = int(value)
    if parsed <= 0:
        raise argparse.ArgumentTypeError("value must be positive")
    return parsed


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Measure adjacent paired modulation-matrix cost in the production generated C++ patch."
    )
    parser.add_argument("--build-dir", type=Path, default=REPO_ROOT / "build" / "native_modulation_benchmark")
    parser.add_argument("--output", type=Path)
    parser.add_argument("--blocks", type=positive_int, default=4096)
    parser.add_argument("--warmup-blocks", type=positive_int, default=256)
    parser.add_argument("--settle-blocks", type=positive_int, default=128)
    parser.add_argument("--repeats", type=positive_int, default=3)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    build_dir = args.build_dir.resolve()
    output_path = args.output.resolve() if args.output is not None else None
    started = time.monotonic()
    executable, generated_cpp, profile_header, compile_command = generate_and_compile(build_dir)
    parsed_runs: list[dict[str, object]] = []
    for repeat_index in range(args.repeats):
        completed = run(
            [
                str(executable),
                "--blocks",
                str(args.blocks),
                "--warmup-blocks",
                str(args.warmup_blocks),
                "--settle-blocks",
                str(args.settle_blocks),
                "--repeat-index",
                str(repeat_index),
            ]
        )
        parsed_runs.append(parse_run(completed.stdout))

    result = build_result(
        runs=parsed_runs,
        generated_cpp=generated_cpp,
        profile_header=profile_header,
        compile_command=compile_command,
        blocks=args.blocks,
        warmup_blocks=args.warmup_blocks,
        settle_blocks=args.settle_blocks,
        elapsed_seconds=time.monotonic() - started,
    )
    if result["qualification"] == "shipping":
        assert_matrix_budgets(result["profiles"])
    encoded = json.dumps(result, indent=2) + "\n"
    if output_path is not None:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(encoded, encoding="utf-8")
    print(encoded, end="")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, RuntimeError, subprocess.CalledProcessError) as error:
        if isinstance(error, subprocess.CalledProcessError):
            if error.stdout:
                print(error.stdout, file=sys.stderr, end="")
            if error.stderr:
                print(error.stderr, file=sys.stderr, end="")
        print(f"ERROR: {error}", file=sys.stderr)
        raise SystemExit(1)
