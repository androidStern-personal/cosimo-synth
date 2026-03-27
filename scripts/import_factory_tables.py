#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import shutil
import sys
import warnings

import numpy as np
from scipy.io import wavfile
from scipy.io.wavfile import WavFileWarning

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from bench import SAMPLES_PER_FRAME
from wtbank import MAX_FRAMES_PER_TABLE


IMPORTED_SOURCE_PREFIX = Path("factory_sources/imported")


def slugify(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug or "table"


def make_unique_filename(destination_dir: Path, filename: str) -> str:
    candidate = filename
    stem = Path(filename).stem
    suffix = Path(filename).suffix
    counter = 2

    while (destination_dir / candidate).exists():
        candidate = f"{stem}-{counter}{suffix}"
        counter += 1

    return candidate


def make_unique_table_id(base_id: str, used_ids: set[str]) -> str:
    candidate = base_id
    counter = 2

    while candidate in used_ids:
        candidate = f"{base_id}-{counter}"
        counter += 1

    used_ids.add(candidate)
    return candidate


def read_wav(path: Path) -> tuple[int, np.ndarray]:
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", WavFileWarning)
        sample_rate, raw_audio = wavfile.read(path)

    return sample_rate, np.asarray(raw_audio)


def to_mono_float32(samples: np.ndarray) -> tuple[np.ndarray, list[str]]:
    notes: list[str] = []
    working = samples

    if working.ndim == 2:
        notes.append(f"downmixed {working.shape[1]} channels to mono")
        working = np.mean(working.astype(np.float32), axis=1)

    if working.ndim != 1:
        raise ValueError(f"Unsupported wav rank: {working.ndim}")

    if working.dtype == np.float32:
        return working.astype(np.float32, copy=False), notes

    if working.dtype == np.int16:
        notes.append("converted int16 to float32")
        return working.astype(np.float32) / 32768.0, notes

    if np.issubdtype(working.dtype, np.integer):
        info = np.iinfo(working.dtype)
        scale = max(abs(info.min), abs(info.max), 1)
        notes.append(f"converted {working.dtype} to float32")
        return working.astype(np.float32) / float(scale), notes

    raise ValueError(f"Unsupported sample type: {working.dtype}")


def normalise_samples(samples: np.ndarray) -> tuple[np.ndarray, list[str]]:
    mono_float32, notes = to_mono_float32(samples)
    remainder = mono_float32.size % SAMPLES_PER_FRAME

    if remainder:
        trim_count = mono_float32.size - remainder
        if trim_count <= 0:
            raise ValueError(
                f"Source wavetable needs trimming but contains fewer than {SAMPLES_PER_FRAME} samples"
            )
        notes.append(f"trimmed trailing {remainder} samples")
        mono_float32 = mono_float32[:trim_count]

    frame_count = mono_float32.size // SAMPLES_PER_FRAME
    if not 1 <= frame_count <= MAX_FRAMES_PER_TABLE:
        raise ValueError(
            f"Source wavetable must contain between 1 and {MAX_FRAMES_PER_TABLE} frames after normalization"
        )

    return mono_float32, notes


def copy_or_normalise_wav(source_path: Path, destination_path: Path) -> list[str]:
    sample_rate, samples = read_wav(source_path)
    notes: list[str] = []
    is_verbatim_copy = (
        samples.ndim == 1
        and samples.dtype in (np.float32, np.int16)
        and samples.size % SAMPLES_PER_FRAME == 0
        and 1 <= (samples.size // SAMPLES_PER_FRAME) <= MAX_FRAMES_PER_TABLE
    )

    if is_verbatim_copy:
        shutil.copy2(source_path, destination_path)
        return notes

    normalised_samples, notes = normalise_samples(samples)
    wavfile.write(destination_path, sample_rate, normalised_samples.astype(np.float32))
    return notes


def load_catalog(catalog_path: Path) -> list[dict[str, str]]:
    if not catalog_path.is_file():
        return []

    catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    if not isinstance(catalog, list):
        raise ValueError(f"Catalog must be a JSON array: {catalog_path}")

    return [entry for entry in catalog if isinstance(entry, dict)]


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Copy and flatten an external wavetable directory into assets/factory_sources/imported"
    )
    parser.add_argument("source_dir", type=Path)
    parser.add_argument(
        "--catalog",
        type=Path,
        default=Path("assets/factory-table-catalog.json"),
    )
    parser.add_argument(
        "--import-dir",
        type=Path,
        default=Path("assets/factory_sources/imported"),
    )
    args = parser.parse_args()

    repo_root = REPO_ROOT
    source_dir = args.source_dir.resolve()
    catalog_path = (repo_root / args.catalog).resolve()
    import_dir = (repo_root / args.import_dir).resolve()

    if not source_dir.is_dir():
        raise SystemExit(f"Source directory not found: {source_dir}")

    existing_catalog = load_catalog(catalog_path)
    preserved_entries = [
        entry
        for entry in existing_catalog
        if not str(entry.get("source", "")).startswith(IMPORTED_SOURCE_PREFIX.as_posix() + "/")
    ]

    if import_dir.exists():
        shutil.rmtree(import_dir)
    import_dir.mkdir(parents=True, exist_ok=True)

    source_wavs = sorted(path for path in source_dir.rglob("*.wav") if path.is_file())
    used_ids = {
        str(entry.get("tableId", "")).strip()
        for entry in preserved_entries
        if str(entry.get("tableId", "")).strip()
    }

    imported_entries: list[dict[str, str]] = []
    normalisation_notes: list[str] = []

    for source_path in source_wavs:
        destination_name = make_unique_filename(import_dir, source_path.name)
        destination_path = import_dir / destination_name
        notes = copy_or_normalise_wav(source_path, destination_path)
        relative_source = (IMPORTED_SOURCE_PREFIX / destination_name).as_posix()
        table_id = make_unique_table_id(slugify(Path(destination_name).stem), used_ids)

        imported_entries.append(
            {
                "tableId": table_id,
                "name": source_path.stem,
                "source": relative_source,
            }
        )

        if notes:
            normalisation_notes.append(
                f"{source_path.relative_to(source_dir)} -> {destination_name}: {', '.join(notes)}"
            )

    combined_catalog = preserved_entries + imported_entries
    catalog_path.write_text(json.dumps(combined_catalog, indent=2) + "\n", encoding="utf-8")

    print(f"Imported {len(imported_entries)} wavetable files into {import_dir}")
    print(f"Preserved {len(preserved_entries)} existing catalog entries")
    if normalisation_notes:
        print("Normalized files:")
        for note in normalisation_notes:
            print(f"  - {note}")


if __name__ == "__main__":
    main()
