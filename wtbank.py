from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path
from typing import Any, Sequence

import numpy as np
import numpy.typing as npt
from scipy.fft import irfft, rfft
from scipy.io import wavfile

from bench import DEFAULT_SAMPLE_RATE, FixtureBank, SAMPLES_PER_FRAME

Float32Array = npt.NDArray[np.float32]
Float64Array = npt.NDArray[np.float64]
Complex128Array = npt.NDArray[np.complex128]

MIP_COUNT = 11
MAX_FRAMES_PER_TABLE = 256
PADDED_FRAME_SIZE = SAMPLES_PER_FRAME + 3
DEFAULT_SAMPLE_BLOB_FILENAME = "factory-bank.wav"
DEFAULT_MANIFEST_VALUE_FILENAME = "factory-bank.json"


@dataclass(frozen=True, slots=True)
class SourceTable:
    table_id: str
    frames: Float32Array

    def __post_init__(self) -> None:
        frames = np.asarray(self.frames, dtype=np.float32)

        if not self.table_id:
            raise ValueError("SourceTable.table_id must not be empty")
        if frames.ndim != 2:
            raise ValueError("SourceTable.frames must be a 2-D array")
        if frames.shape[1] != SAMPLES_PER_FRAME:
            raise ValueError(
                f"SourceTable.frames must have {SAMPLES_PER_FRAME} samples per frame"
            )
        if not 1 <= frames.shape[0] <= MAX_FRAMES_PER_TABLE:
            raise ValueError(
                f"SourceTable.frames must contain between 1 and {MAX_FRAMES_PER_TABLE} frames"
            )
        if not np.isfinite(frames).all():
            raise ValueError("SourceTable.frames must contain only finite values")

        object.__setattr__(self, "frames", frames)

    @property
    def num_frames(self) -> int:
        return int(self.frames.shape[0])


@dataclass(frozen=True, slots=True)
class FrameDiagnostics:
    peak_abs: float
    rms: float
    mean: float
    seam_value_jump: float
    seam_slope_jump: float


@dataclass(frozen=True, slots=True)
class TableDiagnostics:
    table_id: str
    frames: tuple[FrameDiagnostics, ...]


@dataclass(frozen=True, slots=True)
class TableMeta:
    frame_count: int
    sample_offset: int

    def __post_init__(self) -> None:
        if not 1 <= self.frame_count <= MAX_FRAMES_PER_TABLE:
            raise ValueError(
                f"TableMeta.frame_count must stay in the range [1, {MAX_FRAMES_PER_TABLE}]"
            )
        if self.sample_offset < 0:
            raise ValueError("TableMeta.sample_offset must not be negative")


@dataclass(frozen=True, slots=True)
class WavetableBank:
    tables: tuple[TableMeta, ...]
    sample_blob: Float32Array

    def __post_init__(self) -> None:
        sample_blob = np.asarray(self.sample_blob, dtype=np.float32)
        if not self.tables:
            raise ValueError("WavetableBank.tables must not be empty")
        if sample_blob.ndim != 1:
            raise ValueError("WavetableBank.sample_blob must be a 1-D array")
        if not np.isfinite(sample_blob).all():
            raise ValueError("WavetableBank.sample_blob must contain only finite values")

        expected_offset = 0
        for table in self.tables:
            expected_sample_count = table.frame_count * MIP_COUNT * PADDED_FRAME_SIZE
            if table.sample_offset != expected_offset:
                raise ValueError("WavetableBank.tables must have contiguous sample offsets")
            expected_offset += expected_sample_count

        if expected_offset != sample_blob.size:
            raise ValueError(
                "WavetableBank.sample_blob length must match the implied table sample counts"
            )

        frozen = _freeze_float32_array(sample_blob)
        object.__setattr__(self, "sample_blob", frozen)


@dataclass(frozen=True, slots=True)
class BankBuild:
    bank: WavetableBank
    diagnostics: tuple[TableDiagnostics, ...]


@dataclass(frozen=True, slots=True)
class EmittedBankAssets:
    wav_path: Path
    manifest_value_path: Path
    manifest_value: dict[str, Any]


def build_bank(source_tables: Sequence[SourceTable | FixtureBank]) -> BankBuild:
    if not source_tables:
        raise ValueError("build_bank requires at least one source table")

    tables = tuple(_coerce_source_table(table) for table in source_tables)
    seen_ids: set[str] = set()
    sample_offset = 0
    metas: list[TableMeta] = []
    sample_blocks: list[Float32Array] = []
    diagnostics: list[TableDiagnostics] = []

    for table in tables:
        if table.table_id in seen_ids:
            raise ValueError("build_bank requires unique table ids")
        seen_ids.add(table.table_id)

        table_spectra: list[Complex128Array] = []
        table_diagnostics: list[FrameDiagnostics] = []

        for frame in table.frames.astype(np.float64):
            source_mean = float(np.mean(frame))
            source_peak = float(np.max(np.abs(frame), initial=0.0))
            source_rms = float(np.sqrt(np.mean(np.square(frame))))
            seam_value_jump = float(abs(frame[0] - frame[-1]))
            seam_slope_jump = float(abs((frame[1] - frame[0]) - (frame[0] - frame[-1])))

            table_diagnostics.append(
                FrameDiagnostics(
                    peak_abs=source_peak,
                    rms=source_rms,
                    mean=source_mean,
                    seam_value_jump=seam_value_jump,
                    seam_slope_jump=seam_slope_jump,
                )
            )

            canonical_frame = frame - source_mean
            spectrum = rfft(canonical_frame)
            spectrum[0] = 0.0
            table_spectra.append(spectrum)

        table_blocks: list[Float32Array] = []
        for mip_index in range(MIP_COUNT):
            for spectrum in table_spectra:
                table_blocks.append(_build_mip_frame(spectrum, mip_index))

        table_sample_blob = np.concatenate(table_blocks, axis=0)
        sample_blocks.append(table_sample_blob)
        metas.append(TableMeta(frame_count=table.num_frames, sample_offset=sample_offset))
        diagnostics.append(
            TableDiagnostics(table_id=table.table_id, frames=tuple(table_diagnostics))
        )
        sample_offset += int(table_sample_blob.size)

    sample_blob = np.concatenate(sample_blocks, axis=0)
    bank = WavetableBank(tables=tuple(metas), sample_blob=sample_blob)
    return BankBuild(bank=bank, diagnostics=tuple(diagnostics))


def build_manifest_bank_value(
    bank: WavetableBank,
    *,
    sample_blob_resource: str = DEFAULT_SAMPLE_BLOB_FILENAME,
) -> dict[str, Any]:
    return {
        "sampleBlob": sample_blob_resource,
        "tables": [
            {
                "frameCount": table.frame_count,
                "sampleOffset": table.sample_offset,
            }
            for table in bank.tables
        ],
    }


def write_sample_blob_wav(
    path: str | Path,
    bank: WavetableBank,
    *,
    sample_rate: int = DEFAULT_SAMPLE_RATE,
) -> Path:
    output_path = Path(path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    wavfile.write(output_path, sample_rate, bank.sample_blob)
    return output_path


def write_manifest_bank_value(
    path: str | Path,
    bank: WavetableBank,
    *,
    sample_blob_resource: str = DEFAULT_SAMPLE_BLOB_FILENAME,
) -> Path:
    output_path = Path(path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_value = build_manifest_bank_value(
        bank, sample_blob_resource=sample_blob_resource
    )
    output_path.write_text(
        json.dumps(manifest_value, indent=2) + "\n",
        encoding="utf-8",
    )
    return output_path


def emit_cmajor_bank_assets(
    output_dir: str | Path,
    bank: WavetableBank,
    *,
    sample_blob_filename: str = DEFAULT_SAMPLE_BLOB_FILENAME,
    manifest_value_filename: str = DEFAULT_MANIFEST_VALUE_FILENAME,
    sample_rate: int = DEFAULT_SAMPLE_RATE,
) -> EmittedBankAssets:
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    manifest_value = build_manifest_bank_value(
        bank, sample_blob_resource=sample_blob_filename
    )
    wav_path = write_sample_blob_wav(
        output_path / sample_blob_filename, bank, sample_rate=sample_rate
    )
    manifest_value_path = output_path / manifest_value_filename
    manifest_value_path.write_text(
        json.dumps(manifest_value, indent=2) + "\n",
        encoding="utf-8",
    )
    return EmittedBankAssets(
        wav_path=wav_path,
        manifest_value_path=manifest_value_path,
        manifest_value=manifest_value,
    )


def sample_address(
    table: TableMeta,
    mip_index: int,
    frame_index: int,
    sample_index: int,
    *,
    padded_frame_size: int = PADDED_FRAME_SIZE,
    mip_count: int = MIP_COUNT,
) -> int:
    if not 0 <= mip_index < mip_count:
        raise ValueError(f"mip_index must stay in the range [0, {mip_count})")
    if not 0 <= frame_index < table.frame_count:
        raise ValueError("frame_index must address a frame inside the table")
    if not 0 <= sample_index < padded_frame_size:
        raise ValueError(
            f"sample_index must stay in the range [0, {padded_frame_size})"
        )

    return table.sample_offset + (
        ((mip_index * table.frame_count) + frame_index) * padded_frame_size
    ) + sample_index


def read_padded_sample(
    bank: WavetableBank,
    table_index: int,
    mip_index: int,
    frame_index: int,
    sample_index: int,
) -> float:
    if not 0 <= table_index < len(bank.tables):
        raise ValueError("table_index must address a table inside the bank")

    address = sample_address(
        bank.tables[table_index],
        mip_index,
        frame_index,
        sample_index,
    )
    return float(bank.sample_blob[address])


def _coerce_source_table(table: SourceTable | FixtureBank) -> SourceTable:
    if isinstance(table, SourceTable):
        return table
    if isinstance(table, FixtureBank):
        return SourceTable(table_id=table.name, frames=table.frames)
    raise TypeError("build_bank expects SourceTable or FixtureBank items")


def _build_mip_frame(spectrum: Complex128Array, mip_index: int) -> Float32Array:
    harmonic_limit = min(1 << mip_index, spectrum.size - 1)
    truncated = np.zeros_like(spectrum)
    if harmonic_limit >= 1:
        truncated[1 : harmonic_limit + 1] = spectrum[1 : harmonic_limit + 1]
    time_domain = irfft(truncated, n=SAMPLES_PER_FRAME)
    return _pad_frame(time_domain)


def _pad_frame(frame: npt.ArrayLike) -> Float32Array:
    frame_array = np.asarray(frame, dtype=np.float64)
    padded = np.empty(PADDED_FRAME_SIZE, dtype=np.float64)
    padded[0] = frame_array[-1]
    padded[1:-2] = frame_array
    padded[-2] = frame_array[0]
    padded[-1] = frame_array[1]
    return padded.astype(np.float32)


def _freeze_float32_array(values: npt.ArrayLike) -> Float32Array:
    array = np.array(values, dtype=np.float32, copy=True)
    array.flags.writeable = False
    return array
