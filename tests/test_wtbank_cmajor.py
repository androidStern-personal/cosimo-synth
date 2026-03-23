from __future__ import annotations

import json
from pathlib import Path
import shutil
import subprocess

import numpy as np
import pytest
from scipy.fft import irfft, rfft
from scipy.io import wavfile

from bench import make_blend2_bank, make_sweep4_bank
from wtbank import (
    DEFAULT_MANIFEST_VALUE_FILENAME,
    DEFAULT_SAMPLE_BLOB_FILENAME,
    PADDED_FRAME_SIZE,
    build_bank,
    emit_cmajor_bank_assets,
)


def _require_cmaj_cli() -> str:
    cmaj = shutil.which("cmaj")
    if cmaj is None:
        raise AssertionError("cmaj CLI is required for Cmajor integration tests")
    return cmaj


def _expected_padded_frame(frame: np.ndarray, mip_index: int) -> np.ndarray:
    frame64 = np.asarray(frame, dtype=np.float64)
    canonical = frame64 - np.mean(frame64)
    spectrum = rfft(canonical)
    spectrum[0] = 0.0
    harmonic_limit = min(1 << mip_index, spectrum.size - 1)
    truncated = np.zeros_like(spectrum)
    truncated[1 : harmonic_limit + 1] = spectrum[1 : harmonic_limit + 1]
    time_domain = irfft(truncated, n=frame64.size)

    padded = np.empty(PADDED_FRAME_SIZE, dtype=np.float64)
    padded[0] = time_domain[-1]
    padded[1:-2] = time_domain
    padded[-2] = time_domain[0]
    padded[-1] = time_domain[1]
    return padded


def _build_probe_source(cases: list[dict[str, int]]) -> str:
    lines = [
        "namespace wt",
        "{",
        "    struct TableMeta",
        "    {",
        "        int32 frameCount;",
        "        int32 sampleOffset;",
        "    }",
        "",
        "    struct Bank",
        "    {",
        "        std::audio_data::Mono sampleBlob;",
        "        TableMeta[] tables;",
        "    }",
        "",
        "    external Bank factoryBank;",
        "",
        "    processor Probe [[ main ]]",
        "    {",
        "        output stream float out;",
        "",
        "        void main()",
        "        {",
    ]

    for case in cases:
        lines.extend(
            [
                "            out <- wt::factoryBank.sampleBlob.frames["
                + "wt::factoryBank.tables["
                + str(case["tableIndex"])
                + "].sampleOffset + ((("
                + str(case["mipIndex"])
                + " * wt::factoryBank.tables["
                + str(case["tableIndex"])
                + "].frameCount) + "
                + str(case["frameIndex"])
                + ") * "
                + str(PADDED_FRAME_SIZE)
                + ") + "
                + str(case["sampleIndex"])
                + "];",
                "            advance();",
            ]
        )

    lines.extend(["        }", "    }", "}"])
    return "\n".join(lines) + "\n"


def _build_patch_manifest(manifest_value: dict[str, object]) -> dict[str, object]:
    return {
        "CmajorVersion": 1,
        "ID": "dev.cosimo.bank-probe",
        "version": "1.0",
        "name": "Bank Probe",
        "description": "Bank manifest load probe",
        "category": "generator",
        "source": "BankProbe.cmajor",
        "externals": {
            "wt::factoryBank": manifest_value,
        },
    }


@pytest.mark.cmajor
def test_cmajor_patch_manifest_loads_and_reads_bank_samples(tmp_path: Path) -> None:
    cmaj = _require_cmaj_cli()

    blend2 = make_blend2_bank()
    sweep4 = make_sweep4_bank()
    built = build_bank([blend2, sweep4])
    assets = emit_cmajor_bank_assets(tmp_path, built.bank)

    cases = [
        {"tableIndex": 0, "mipIndex": 0, "frameIndex": 0, "sampleIndex": 1},
        {"tableIndex": 0, "mipIndex": 10, "frameIndex": 1, "sampleIndex": 2049},
        {"tableIndex": 1, "mipIndex": 10, "frameIndex": 2, "sampleIndex": 0},
        {"tableIndex": 1, "mipIndex": 10, "frameIndex": 2, "sampleIndex": 1},
        {"tableIndex": 1, "mipIndex": 10, "frameIndex": 2, "sampleIndex": 2047},
        {"tableIndex": 1, "mipIndex": 10, "frameIndex": 2, "sampleIndex": 2048},
        {"tableIndex": 1, "mipIndex": 10, "frameIndex": 2, "sampleIndex": 2049},
        {"tableIndex": 1, "mipIndex": 10, "frameIndex": 2, "sampleIndex": 2050},
    ]

    expected_values = np.array(
        [
            _expected_padded_frame(blend2.frames[0], 0)[1],
            _expected_padded_frame(blend2.frames[1], 10)[2049],
            _expected_padded_frame(sweep4.frames[2], 10)[0],
            _expected_padded_frame(sweep4.frames[2], 10)[1],
            _expected_padded_frame(sweep4.frames[2], 10)[2047],
            _expected_padded_frame(sweep4.frames[2], 10)[2048],
            _expected_padded_frame(sweep4.frames[2], 10)[2049],
            _expected_padded_frame(sweep4.frames[2], 10)[2050],
        ],
        dtype=np.float32,
    )

    probe_path = tmp_path / "BankProbe.cmajor"
    probe_path.write_text(_build_probe_source(cases), encoding="utf-8")

    manifest_value = json.loads(assets.manifest_value_path.read_text(encoding="utf-8"))
    patch_path = tmp_path / "BankProbe.cmajorpatch"
    patch_path.write_text(
        json.dumps(_build_patch_manifest(manifest_value), indent=2) + "\n",
        encoding="utf-8",
    )

    golden_dir = tmp_path / "golden"
    golden_dir.mkdir()
    wavfile.write(golden_dir / "expectedOutput-out.wav", 44100, expected_values)

    test_path = tmp_path / "BankProbe.cmajtest"
    test_path.write_text(
        '## runScript({ frequency:44100, blockSize:16, samplesToRender:'
        + str(len(cases))
        + ', subDir:"golden", patch:"BankProbe.cmajorpatch" })\n',
        encoding="utf-8",
    )

    result = subprocess.run(
        [cmaj, "test", str(test_path), "--singleThread"],
        cwd=tmp_path,
        capture_output=True,
        text=True,
        check=False,
    )

    if result.returncode != 0:
        details = "\n".join(
            part
            for part in (result.stdout.strip(), result.stderr.strip())
            if part
        )
        raise AssertionError(f"cmaj test failed:\n{details}")

    assert assets.wav_path.name == DEFAULT_SAMPLE_BLOB_FILENAME
    assert assets.manifest_value_path.name == DEFAULT_MANIFEST_VALUE_FILENAME
