from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from numpy.testing import assert_allclose, assert_array_equal
import pytest
from scipy.fft import irfft, rfft
from scipy.io import wavfile

from bench import (
    FixtureBank,
    SAMPLES_PER_FRAME,
    make_blend2_bank,
    make_saw_bank,
    make_sine_bank,
    make_square_bank,
    make_sweep4_bank,
)
from wtbank import (
    DEFAULT_MANIFEST_VALUE_FILENAME,
    DEFAULT_SAMPLE_BLOB_FILENAME,
    MIP_COUNT,
    PADDED_FRAME_SIZE,
    SourceTable,
    TableMeta,
    WavetableBank,
    build_bank,
    build_manifest_bank_value,
    emit_cmajor_bank_assets,
    read_padded_sample,
    sample_address,
)


def _actual_padded_frame(
    bank: WavetableBank,
    table_index: int,
    mip_index: int,
    frame_index: int,
) -> np.ndarray:
    table = bank.tables[table_index]
    start = sample_address(table, mip_index, frame_index, 0)
    end = start + PADDED_FRAME_SIZE
    return bank.sample_blob[start:end].astype(np.float64)


def _actual_unpadded_frame(
    bank: WavetableBank,
    table_index: int,
    mip_index: int,
    frame_index: int,
) -> np.ndarray:
    return _actual_padded_frame(bank, table_index, mip_index, frame_index)[1:-2]


def _canonical_source_frame(frame: np.ndarray) -> np.ndarray:
    frame64 = np.asarray(frame, dtype=np.float64)
    return frame64 - np.mean(frame64)


def _expected_padded_frame(frame: np.ndarray, mip_index: int) -> np.ndarray:
    canonical = _canonical_source_frame(frame)
    spectrum = rfft(canonical)
    spectrum[0] = 0.0
    harmonic_limit = min(1 << mip_index, spectrum.size - 1)
    truncated = np.zeros_like(spectrum)
    truncated[1 : harmonic_limit + 1] = spectrum[1 : harmonic_limit + 1]
    time_domain = irfft(truncated, n=SAMPLES_PER_FRAME)

    padded = np.empty(PADDED_FRAME_SIZE, dtype=np.float64)
    padded[0] = time_domain[-1]
    padded[1:-2] = time_domain
    padded[-2] = time_domain[0]
    padded[-1] = time_domain[1]
    return padded


def _expected_manifest_value(
    frame_counts: list[int],
    sample_offsets: list[int],
    sample_blob_resource: str,
) -> dict[str, object]:
    return {
        "sampleBlob": sample_blob_resource,
        "tables": [
            {
                "frameCount": frame_count,
                "sampleOffset": sample_offset,
            }
            for frame_count, sample_offset in zip(frame_counts, sample_offsets, strict=True)
        ],
    }


def _assert_complex_spectrum_matches_harmonic_cap(
    actual_frame: np.ndarray,
    expected_frame: np.ndarray,
    harmonic_limit: int,
) -> None:
    actual_spectrum = rfft(actual_frame)
    expected_spectrum = rfft(expected_frame)

    assert_allclose(
        actual_spectrum[1 : harmonic_limit + 1],
        expected_spectrum[1 : harmonic_limit + 1],
        atol=1e-5,
        rtol=1e-5,
    )

    removed = actual_spectrum[harmonic_limit + 1 :]
    if removed.size:
        reference = max(np.max(np.abs(expected_spectrum[1 : harmonic_limit + 1]), initial=0.0), 1.0)
        assert np.max(np.abs(removed)) < reference * 1e-6


def test_build_bank_rejects_empty_source() -> None:
    with pytest.raises(ValueError, match="at least one source table"):
        build_bank([])


def test_build_bank_rejects_duplicate_table_ids() -> None:
    source = make_sine_bank()
    duplicate = SourceTable(table_id=source.name, frames=source.frames.copy())

    with pytest.raises(ValueError, match="unique table ids"):
        build_bank([source, duplicate])


def test_source_table_rejects_empty_table_id() -> None:
    with pytest.raises(ValueError, match="must not be empty"):
        SourceTable(
            table_id="",
            frames=np.zeros((1, SAMPLES_PER_FRAME), dtype=np.float32),
        )


def test_source_table_rejects_wrong_rank() -> None:
    with pytest.raises(ValueError, match="2-D array"):
        SourceTable(
            table_id="bad_rank",
            frames=np.zeros((SAMPLES_PER_FRAME,), dtype=np.float32),
        )


def test_source_table_rejects_wrong_frame_length() -> None:
    with pytest.raises(ValueError, match="2048 samples per frame"):
        SourceTable(
            table_id="bad_length",
            frames=np.zeros((1, SAMPLES_PER_FRAME + 1), dtype=np.float32),
        )


def test_source_table_rejects_non_finite_frames() -> None:
    frames = np.zeros((1, SAMPLES_PER_FRAME), dtype=np.float32)
    frames[0, 17] = np.nan

    with pytest.raises(ValueError, match="finite"):
        SourceTable(table_id="bad_values", frames=frames)


def test_source_table_rejects_zero_frame_tables() -> None:
    with pytest.raises(ValueError, match="between 1 and 256"):
        SourceTable(
            table_id="empty_bank",
            frames=np.zeros((0, SAMPLES_PER_FRAME), dtype=np.float32),
        )


def test_source_table_rejects_tables_larger_than_256_frames() -> None:
    with pytest.raises(ValueError, match="between 1 and 256"):
        SourceTable(
            table_id="oversized_bank",
            frames=np.zeros((257, SAMPLES_PER_FRAME), dtype=np.float32),
        )


def test_build_bank_preserves_input_order_for_runtime_indices() -> None:
    built = build_bank([make_sweep4_bank(), make_blend2_bank()])
    bank = built.bank

    assert [table.frame_count for table in bank.tables] == [4, 2]
    assert bank.tables[0].sample_offset == 0
    assert bank.tables[1].sample_offset == 4 * MIP_COUNT * PADDED_FRAME_SIZE


def test_sample_blob_is_read_only_after_build() -> None:
    built = build_bank([make_sine_bank()])

    assert built.bank.sample_blob.flags.writeable is False
    with pytest.raises(ValueError, match="read-only"):
        built.bank.sample_blob[0] = 0.0


def test_table_meta_rejects_invalid_runtime_values() -> None:
    with pytest.raises(ValueError, match="range"):
        TableMeta(frame_count=0, sample_offset=0)
    with pytest.raises(ValueError, match="range"):
        TableMeta(frame_count=257, sample_offset=0)
    with pytest.raises(ValueError, match="must not be negative"):
        TableMeta(frame_count=1, sample_offset=-1)


def test_wavetable_bank_rejects_invalid_runtime_shape() -> None:
    valid_table = TableMeta(frame_count=1, sample_offset=0)
    valid_sample_count = MIP_COUNT * PADDED_FRAME_SIZE

    with pytest.raises(ValueError, match="must not be empty"):
        WavetableBank(tables=(), sample_blob=np.zeros(1, dtype=np.float32))
    with pytest.raises(ValueError, match="1-D array"):
        WavetableBank(
            tables=(valid_table,),
            sample_blob=np.zeros((1, valid_sample_count), dtype=np.float32),
        )

    non_finite = np.zeros(valid_sample_count, dtype=np.float32)
    non_finite[3] = np.nan
    with pytest.raises(ValueError, match="finite"):
        WavetableBank(tables=(valid_table,), sample_blob=non_finite)

    with pytest.raises(ValueError, match="contiguous sample offsets"):
        WavetableBank(
            tables=(TableMeta(frame_count=1, sample_offset=1),),
            sample_blob=np.zeros(valid_sample_count, dtype=np.float32),
        )


def test_build_manifest_bank_value_matches_cmajor_bank_shape() -> None:
    built = build_bank([make_blend2_bank(), make_sweep4_bank()])
    bank = built.bank

    expected = _expected_manifest_value(
        frame_counts=[2, 4],
        sample_offsets=[
            0,
            2 * MIP_COUNT * PADDED_FRAME_SIZE,
        ],
        sample_blob_resource="bank.wav",
    )

    assert build_manifest_bank_value(bank, sample_blob_resource="bank.wav") == expected


def test_emit_cmajor_bank_assets_writes_wave_and_json(tmp_path: Path) -> None:
    built = build_bank([make_blend2_bank(), make_sweep4_bank()])
    assets = emit_cmajor_bank_assets(tmp_path, built.bank)
    expected_manifest = _expected_manifest_value(
        frame_counts=[2, 4],
        sample_offsets=[
            0,
            2 * MIP_COUNT * PADDED_FRAME_SIZE,
        ],
        sample_blob_resource=DEFAULT_SAMPLE_BLOB_FILENAME,
    )

    assert assets.wav_path == tmp_path / DEFAULT_SAMPLE_BLOB_FILENAME
    assert assets.manifest_value_path == tmp_path / DEFAULT_MANIFEST_VALUE_FILENAME
    assert assets.manifest_value == expected_manifest
    assert assets.manifest_value_path.read_text(encoding="utf-8") == (
        json.dumps(expected_manifest, indent=2) + "\n"
    )

    sample_rate, audio = wavfile.read(assets.wav_path)
    assert sample_rate > 0
    assert_array_equal(np.asarray(audio, dtype=np.float32), built.bank.sample_blob)


def test_emit_cmajor_bank_assets_is_deterministic(tmp_path: Path) -> None:
    sources = [make_blend2_bank(), make_sweep4_bank()]
    expected_manifest = _expected_manifest_value(
        frame_counts=[2, 4],
        sample_offsets=[
            0,
            2 * MIP_COUNT * PADDED_FRAME_SIZE,
        ],
        sample_blob_resource=DEFAULT_SAMPLE_BLOB_FILENAME,
    )

    first_bank = build_bank(sources).bank
    second_bank = build_bank(sources).bank
    first_assets = emit_cmajor_bank_assets(tmp_path / "first", first_bank)
    second_assets = emit_cmajor_bank_assets(tmp_path / "second", second_bank)

    assert_array_equal(first_bank.sample_blob, second_bank.sample_blob)
    assert first_assets.manifest_value == expected_manifest
    assert second_assets.manifest_value == expected_manifest
    assert first_assets.wav_path.read_bytes() == second_assets.wav_path.read_bytes()
    assert (
        first_assets.manifest_value_path.read_text(encoding="utf-8")
        == second_assets.manifest_value_path.read_text(encoding="utf-8")
        == json.dumps(expected_manifest, indent=2) + "\n"
    )


def test_sine_bank_survives_every_mip_level() -> None:
    source_bank = make_sine_bank()
    built = build_bank([source_bank])

    for mip_index in range(MIP_COUNT):
        expected = _expected_padded_frame(source_bank.frames[0], mip_index)[1:-2]
        actual = _actual_unpadded_frame(built.bank, 0, mip_index, 0)
        assert_allclose(actual, expected, atol=1e-6, rtol=1e-6)


def test_saw_bank_matches_expected_complex_spectrum_per_mip() -> None:
    source_bank = make_saw_bank()
    built = build_bank([source_bank])

    for mip_index in range(MIP_COUNT):
        actual = _actual_unpadded_frame(built.bank, 0, mip_index, 0)
        expected = _expected_padded_frame(source_bank.frames[0], mip_index)[1:-2]
        _assert_complex_spectrum_matches_harmonic_cap(actual, expected, 1 << mip_index)


def test_square_bank_matches_expected_complex_spectrum_per_mip() -> None:
    source_bank = make_square_bank()
    built = build_bank([source_bank])

    for mip_index in range(MIP_COUNT):
        actual = _actual_unpadded_frame(built.bank, 0, mip_index, 0)
        expected = _expected_padded_frame(source_bank.frames[0], mip_index)[1:-2]
        actual_spectrum = rfft(actual)
        _assert_complex_spectrum_matches_harmonic_cap(actual, expected, 1 << mip_index)

        harmonic_limit = 1 << mip_index
        even_harmonics = np.abs(actual_spectrum[2 : harmonic_limit + 1 : 2])
        if even_harmonics.size:
            assert np.max(even_harmonics) < max(abs(actual_spectrum[1]), 1.0) * 1e-6


def test_dc_is_removed_once_per_source_frame() -> None:
    positions = np.arange(SAMPLES_PER_FRAME, dtype=np.float64) / SAMPLES_PER_FRAME
    raw_frame = (0.35 + 0.6 * np.sin(2.0 * np.pi * positions)).astype(np.float32)
    source_table = SourceTable(table_id="offset_sine", frames=raw_frame.reshape(1, -1))
    built = build_bank([source_table])

    assert built.diagnostics[0].frames[0].mean == pytest.approx(0.35, abs=1e-6)

    for mip_index in range(MIP_COUNT):
        actual = _actual_unpadded_frame(built.bank, 0, mip_index, 0)
        assert abs(actual.mean()) <= 1e-7


def test_padding_contract_is_exact() -> None:
    source_bank = make_sine_bank()
    built = build_bank([source_bank])
    expected = _expected_padded_frame(source_bank.frames[0], MIP_COUNT - 1)
    actual = _actual_padded_frame(built.bank, 0, MIP_COUNT - 1, 0)

    assert actual.shape == (PADDED_FRAME_SIZE,)
    assert_allclose(actual, expected, atol=1e-6, rtol=0.0)


def test_multi_table_offsets_and_samples_are_exact_for_non_zero_offsets() -> None:
    blend2 = make_blend2_bank()
    sweep4 = make_sweep4_bank()
    built = build_bank([blend2, sweep4])
    bank = built.bank

    table_index = 1
    mip_index = MIP_COUNT - 1
    frame_index = 2
    expected_padded = _expected_padded_frame(sweep4.frames[2], mip_index)

    assert bank.tables[table_index].sample_offset > 0

    for sample_index in (0, 1, 2047, 2048, 2049, 2050):
        assert read_padded_sample(
            bank,
            table_index,
            mip_index,
            frame_index,
            sample_index,
        ) == pytest.approx(expected_padded[sample_index], abs=1e-6)


def test_sample_address_uses_non_zero_offsets_correctly() -> None:
    built = build_bank([make_blend2_bank(), make_sweep4_bank()])
    bank = built.bank
    table = bank.tables[1]

    manual = table.sample_offset + (((3 * table.frame_count) + 2) * PADDED_FRAME_SIZE) + 2050
    assert sample_address(table, 3, 2, 2050) == manual


def test_sample_address_rejects_invalid_indices() -> None:
    table = build_bank([make_sine_bank()]).bank.tables[0]

    with pytest.raises(ValueError, match="mip_index"):
        sample_address(table, -1, 0, 0)
    with pytest.raises(ValueError, match="frame_index"):
        sample_address(table, 0, 1, 0)
    with pytest.raises(ValueError, match="sample_index"):
        sample_address(table, 0, 0, PADDED_FRAME_SIZE)


def test_read_padded_sample_rejects_invalid_table_index() -> None:
    bank = build_bank([make_sine_bank()]).bank

    with pytest.raises(ValueError, match="table_index"):
        read_padded_sample(bank, 1, 0, 0, 0)
