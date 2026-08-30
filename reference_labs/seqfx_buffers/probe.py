from __future__ import annotations

import argparse
import json
import subprocess
import time
from dataclasses import asdict, dataclass
from pathlib import Path


MAX_SAMPLE_RATE = 192_000
FULL_HISTORY_RATE = 48_000
COARSE_HISTORY_RATE = 8_000
MAX_SYNC_WINDOW_SECONDS = 48
MAX_GESTURE_HISTORY_SECONDS = MAX_SYNC_WINDOW_SECONDS * 2
RATE_PROBES = (44_100, 48_000, 88_200, 96_000, 192_000)


@dataclass(frozen=True)
class BufferAllocation:
    name: str
    sample_count: int
    copies: int
    bytes_per_sample: int
    cmajor_type: str
    split_copies: bool = False

    @property
    def byte_count(self) -> int:
        return self.sample_count * self.copies * self.bytes_per_sample


@dataclass(frozen=True)
class BufferCandidate:
    name: str
    description: str
    allocations: tuple[BufferAllocation, ...]

    @property
    def byte_count(self) -> int:
        return sum(allocation.byte_count for allocation in self.allocations)


def host_samples(seconds: float) -> int:
    return round(MAX_SAMPLE_RATE * seconds) + 8


def fixed_samples(sample_rate: int, seconds: float) -> int:
    return round(sample_rate * seconds) + 8


def candidates() -> tuple[BufferCandidate, ...]:
    stereo_float_bytes = 8
    packed_stereo_bytes = 4
    lane_count = 4
    gesture_voice_count = 2

    return (
        BufferCandidate(
            name="current-separated",
            description="Current one-second host-rate Tape and Stutter buffers per chain.",
            allocations=(
                BufferAllocation("tape", host_samples(1), lane_count, stereo_float_bytes, "float32<2>"),
                BufferAllocation("stutter", host_samples(1), lane_count, stereo_float_bytes, "float32<2>"),
            ),
        ),
        BufferCandidate(
            name="naive-host-rate",
            description="Ninety-six-second host-rate shared history plus two capture voices and modulation delay.",
            allocations=(
                BufferAllocation("history", host_samples(MAX_GESTURE_HISTORY_SECONDS), lane_count, stereo_float_bytes, "float32<2>"),
                BufferAllocation("captures", host_samples(1), lane_count * gesture_voice_count, stereo_float_bytes, "float32<2>"),
                BufferAllocation("modulation", host_samples(0.25), lane_count, stereo_float_bytes, "float32<2>"),
            ),
        ),
        BufferCandidate(
            name="fixed-48k-float",
            description="Ninety-six-second 48 kHz float history, 48 kHz capture voices, and host-rate modulation delay.",
            allocations=(
                BufferAllocation("history", fixed_samples(FULL_HISTORY_RATE, MAX_GESTURE_HISTORY_SECONDS), lane_count, stereo_float_bytes, "float32<2>"),
                BufferAllocation("captures", fixed_samples(FULL_HISTORY_RATE, 1), lane_count * gesture_voice_count, stereo_float_bytes, "float32<2>"),
                BufferAllocation("modulation", host_samples(0.25), lane_count, stereo_float_bytes, "float32<2>"),
            ),
        ),
        BufferCandidate(
            name="fixed-48k-packed",
            description="Ninety-six-second 48 kHz packed-int16 stereo history/captures plus host-rate modulation delay.",
            allocations=(
                BufferAllocation("history", fixed_samples(FULL_HISTORY_RATE, MAX_GESTURE_HISTORY_SECONDS), lane_count, packed_stereo_bytes, "int32"),
                BufferAllocation("captures", fixed_samples(FULL_HISTORY_RATE, 1), lane_count * gesture_voice_count, packed_stereo_bytes, "int32"),
                BufferAllocation("modulation", host_samples(0.25), lane_count, stereo_float_bytes, "float32<2>"),
            ),
        ),
        BufferCandidate(
            name="tiered-hybrid",
            description="Sixteen-second 48 kHz float history plus ninety-six-second 8 kHz packed stereo history.",
            allocations=(
                BufferAllocation("primaryHistory", fixed_samples(FULL_HISTORY_RATE, 16), lane_count, stereo_float_bytes, "float32<2>", split_copies=True),
                BufferAllocation("coarseHistory", fixed_samples(COARSE_HISTORY_RATE, MAX_GESTURE_HISTORY_SECONDS), lane_count, packed_stereo_bytes, "int32", split_copies=True),
                BufferAllocation("captures", fixed_samples(FULL_HISTORY_RATE, 1), lane_count * gesture_voice_count, stereo_float_bytes, "float32<2>", split_copies=True),
                BufferAllocation("modulation", host_samples(0.25), lane_count, stereo_float_bytes, "float32<2>", split_copies=True),
            ),
        ),
    )


def render_cmajor_source(candidate: BufferCandidate) -> str:
    declarations: list[str] = []
    touches: list[str] = []

    for allocation in candidate.allocations:
        if allocation.split_copies:
            for copy_index in range(allocation.copies):
                field_name = f"{allocation.name}{copy_index}"
                declarations.extend((
                    f"    {allocation.cmajor_type}[{allocation.sample_count}] {field_name};",
                    f"    wrap<{allocation.sample_count}> {field_name}Index;",
                ))
                if allocation.cmajor_type == "int32":
                    touches.append(
                        f"            {field_name}[{field_name}Index] = int32 (audioIn[0] * 32767.0f);",
                    )
                else:
                    touches.append(f"            {field_name}[{field_name}Index] = audioIn;")
                touches.append(f"            {field_name}Index += 1;")
            continue

        declarations.extend((
            f"    {allocation.cmajor_type}[{allocation.copies}, {allocation.sample_count}] {allocation.name};",
            f"    wrap<{allocation.sample_count}> {allocation.name}Index;",
        ))
        if allocation.cmajor_type == "int32":
            touches.append(
                f"            {allocation.name}[0, {allocation.name}Index] = int32 (audioIn[0] * 32767.0f);",
            )
        else:
            touches.append(f"            {allocation.name}[0, {allocation.name}Index] = audioIn;")
        touches.append(f"            {allocation.name}Index += 1;")

    return "\n".join((
        "processor SeqFxBufferProbe [[ main ]]",
        "{",
        '    input stream float32<2> audioIn [[ name: "Input" ]];',
        '    output stream float32<2> audioOut [[ name: "Output" ]];',
        "",
        *declarations,
        "",
        "    void main()",
        "    {",
        "        loop",
        "        {",
        *touches,
        "            audioOut <- audioIn;",
        "            advance();",
        "        }",
        "    }",
        "}",
        "",
    ))


def patch_manifest() -> str:
    return json.dumps({
        "CmajorVersion": 1,
        "ID": "dev.cosimo.seqfx-buffer-probe",
        "version": "1.0",
        "name": "SeqFX Buffer Probe",
        "description": "Generated memory/codegen probe",
        "category": "effect",
        "manufacturer": "Cosimo",
        "isInstrument": False,
        "source": ["Probe.cmajor"],
    }, indent=2) + "\n"


def run_command(command: list[str], *, cwd: Path) -> tuple[float, str, int]:
    started = time.perf_counter()
    completed = subprocess.run(
        command,
        cwd=cwd,
        capture_output=True,
        text=True,
    )
    return time.perf_counter() - started, completed.stdout + completed.stderr, completed.returncode


def command_evidence(seconds: float, output: str, return_code: int) -> dict[str, object]:
    meaningful_lines = [line.strip() for line in output.splitlines() if line.strip()]
    return {
        "ok": return_code == 0,
        "seconds": round(seconds, 4),
        "returnCode": return_code,
        "message": " | ".join(meaningful_lines[-3:]),
    }


def probe_candidate(candidate: BufferCandidate, output_root: Path) -> dict[str, object]:
    candidate_root = output_root / candidate.name
    candidate_root.mkdir(parents=True, exist_ok=True)
    source_path = candidate_root / "Probe.cmajor"
    patch_path = candidate_root / "Probe.cmajorpatch"
    cpp_path = candidate_root / "Probe.cpp"
    js_path = candidate_root / "Probe.js"
    source_path.write_text(render_cmajor_source(candidate), encoding="utf-8")
    patch_path.write_text(patch_manifest(), encoding="utf-8")

    cpp_path.unlink(missing_ok=True)
    js_path.unlink(missing_ok=True)
    cpp_seconds, cpp_output, cpp_return_code = run_command(
        ["cmaj", "generate", "--target=cpp", f"--output={cpp_path}", str(patch_path)],
        cwd=candidate_root,
    )
    js_seconds, js_output, js_return_code = run_command(
        ["cmaj", "generate", "--target=javascript", f"--output={js_path}", str(patch_path)],
        cwd=candidate_root,
    )
    dry_runs: dict[str, dict[str, object]] = {}
    for sample_rate in RATE_PROBES:
        elapsed, output, return_code = run_command(
            ["cmaj", "play", "--dry-run", "--stop-on-error", f"--rate={sample_rate}", str(patch_path)],
            cwd=candidate_root,
        )
        dry_runs[str(sample_rate)] = command_evidence(elapsed, output, return_code)

    return {
        "name": candidate.name,
        "description": candidate.description,
        "bufferBytes": candidate.byte_count,
        "bufferMiB": round(candidate.byte_count / (1024 * 1024), 3),
        "allocations": [
            {**asdict(allocation), "byte_count": allocation.byte_count}
            for allocation in candidate.allocations
        ],
        "cppBytes": cpp_path.stat().st_size if cpp_path.exists() else None,
        "javascriptBytes": js_path.stat().st_size if js_path.exists() else None,
        "cppGeneration": command_evidence(cpp_seconds, cpp_output, cpp_return_code),
        "javascriptGeneration": command_evidence(js_seconds, js_output, js_return_code),
        "dryRunsByRate": dry_runs,
    }


def run_probe(output_root: Path) -> dict[str, object]:
    output_root = output_root.resolve()
    output_root.mkdir(parents=True, exist_ok=True)
    results = [probe_candidate(candidate, output_root) for candidate in candidates()]
    payload: dict[str, object] = {
        "maxSampleRate": MAX_SAMPLE_RATE,
        "fullHistoryRate": FULL_HISTORY_RATE,
        "coarseHistoryRate": COARSE_HISTORY_RATE,
        "maxSyncWindowSeconds": MAX_SYNC_WINDOW_SECONDS,
        "maxGestureHistorySeconds": MAX_GESTURE_HISTORY_SECONDS,
        "rates": list(RATE_PROBES),
        "candidates": results,
    }
    (output_root / "metrics.json").write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    return payload


def validate_model() -> None:
    by_name = {candidate.name: candidate for candidate in candidates()}
    assert by_name["current-separated"].byte_count == 12_288_512
    assert by_name["naive-host-rate"].byte_count > 570 * 1024 * 1024
    assert by_name["tiered-hybrid"].byte_count < 40 * 1024 * 1024
    assert by_name["tiered-hybrid"].byte_count < by_name["fixed-48k-float"].byte_count / 3
    source = render_cmajor_source(by_name["tiered-hybrid"])
    assert "primaryHistory" in source
    assert "coarseHistory" in source
    assert "float32<2>" in source
    assert "int32" in source


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=Path("build/seqfx-buffer-probe"))
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()

    validate_model()
    if args.check:
        payload = run_probe(args.output)
        print(json.dumps(payload, indent=2))


if __name__ == "__main__":
    main()
