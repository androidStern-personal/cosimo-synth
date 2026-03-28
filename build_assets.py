from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path
import shutil
import struct

FACTORY_BANK_SOURCE_CATALOG_FILENAME = "factory-table-catalog.json"
FACTORY_BANK_RUNTIME_CATALOG_FILENAME = "factory-bank-catalog.json"
LEGACY_FACTORY_BANK_RUNTIME_CATALOG_FILENAME = "factory-bank.json"
SAMPLES_PER_FRAME = 2048
MAX_FRAMES_PER_TABLE = 256
WAVE_FORMAT_PCM = 0x0001
WAVE_FORMAT_IEEE_FLOAT = 0x0003
PATCH_DESCRIPTION = (
    "Single-oscillator wavetable synth with MIDI input, automatable wavetable "
    "position, runtime table selection, and runtime-loaded Serum-style wavetable files."
)
PATCH_WORKER_SRC = "patch_gui/wavetable-worker.mjs"
PATCH_SOURCE_FILES = (
    "cmajor/FixedFrameOscillator.cmajor",
    "cmajor/Mseg.cmajor",
    "cmajor/WavetableSynth.cmajor",
)
PATCH_GUI_SHARED_MODULES = (
    "mseg",
    "mseg-controller",
    "responsive-layout",
    "wavetable-bank",
    "wavetable-display",
)


@dataclass(frozen=True, slots=True)
class FactoryTableSpec:
    table_id: str
    name: str
    source: Path
    source_resource: str


@dataclass(frozen=True, slots=True)
class SourceTableInfo:
    frame_count: int


@dataclass(frozen=True, slots=True)
class PatchVariant:
    manifest_filename: str
    view_src: str
    view_width: int
    view_height: int
    view_resizable: bool = True
    resource_files: tuple[str, ...] = ()


PATCH_VARIANTS = (
    PatchVariant(
        manifest_filename="WavetableSynth.cmajorpatch",
        view_src="patch_gui/index.js",
        view_width=1120,
        view_height=680,
    ),
    PatchVariant(
        manifest_filename="WavetableSynth.iOS.cmajorpatch",
        view_src="patch_gui/index.ios.js",
        view_width=393,
        view_height=648,
        resource_files=(),
    ),
)


def load_factory_table_specs(catalog_path: str | Path) -> tuple[FactoryTableSpec, ...]:
    source_path = Path(catalog_path)
    catalog = json.loads(source_path.read_text(encoding="utf-8"))

    if not isinstance(catalog, list) or not catalog:
        raise ValueError("factory-table-catalog.json must contain a non-empty array")

    seen_ids: set[str] = set()
    specs: list[FactoryTableSpec] = []

    for index, entry in enumerate(catalog):
        if not isinstance(entry, dict):
            raise ValueError("Each factory table entry must be an object")

        table_id = str(entry.get("tableId", "")).strip()
        name = str(entry.get("name", "")).strip()
        source = str(entry.get("source", "")).strip()

        if not table_id:
            raise ValueError(f"Factory table entry {index} is missing tableId")
        if table_id in seen_ids:
            raise ValueError(f"Factory table entry {index} duplicates tableId {table_id}")
        if not name:
            raise ValueError(f"Factory table entry {index} is missing name")
        if not source:
            raise ValueError(f"Factory table entry {index} is missing source")

        resolved_source = (source_path.parent / source).resolve()
        if not resolved_source.is_file():
            raise ValueError(f"Factory table source does not exist: {resolved_source}")

        seen_ids.add(table_id)
        specs.append(
            FactoryTableSpec(
                table_id=table_id,
                name=name,
                source=resolved_source,
                source_resource=str(Path("assets") / Path(source)),
            )
        )

    return tuple(specs)


def load_source_table_info(path: str | Path) -> SourceTableInfo:
    source_path = Path(path)
    payload = source_path.read_bytes()

    if len(payload) < 12 or payload[:4] != b"RIFF" or payload[8:12] != b"WAVE":
        raise ValueError(f"Source wavetable file is not a valid RIFF/WAVE file: {source_path}")

    fmt_chunk: tuple[int, int, int] | None = None
    data_chunk_size: int | None = None
    offset = 12

    while offset + 8 <= len(payload):
        chunk_id = payload[offset : offset + 4]
        chunk_size = struct.unpack_from("<I", payload, offset + 4)[0]
        chunk_start = offset + 8
        chunk_end = chunk_start + chunk_size

        if chunk_end > len(payload):
            raise ValueError(f"Source wavetable file has a truncated {chunk_id!r} chunk: {source_path}")

        chunk_data = payload[chunk_start:chunk_end]

        if chunk_id == b"fmt ":
            if chunk_size < 16:
                raise ValueError(f"Source wavetable fmt chunk is too small: {source_path}")

            audio_format, channel_count, _sample_rate, _byte_rate, block_align, bits_per_sample = struct.unpack_from(
                "<HHIIHH",
                chunk_data,
                0,
            )
            fmt_chunk = (audio_format, channel_count, block_align)

            if channel_count != 1:
                raise ValueError("Source wavetable files must be mono")

            if audio_format == WAVE_FORMAT_PCM and bits_per_sample == 16:
                expected_block_align = 2
            elif audio_format == WAVE_FORMAT_IEEE_FLOAT and bits_per_sample == 32:
                expected_block_align = 4
            else:
                raise ValueError("Source wavetable files must use float32 or int16 samples")

            if block_align != expected_block_align:
                raise ValueError(f"Source wavetable file has an unexpected block align: {source_path}")

        elif chunk_id == b"data":
            data_chunk_size = chunk_size

        offset = chunk_end + (chunk_size & 1)

    if fmt_chunk is None:
        raise ValueError(f"Source wavetable file is missing a fmt chunk: {source_path}")

    if data_chunk_size is None:
        raise ValueError(f"Source wavetable file is missing a data chunk: {source_path}")

    _audio_format, _channel_count, block_align = fmt_chunk

    if data_chunk_size % block_align != 0:
        raise ValueError(f"Source wavetable file has a partial sample frame: {source_path}")

    sample_count = data_chunk_size // block_align

    if sample_count % SAMPLES_PER_FRAME != 0:
        raise ValueError(
            f"Source wavetable files must contain a whole number of {SAMPLES_PER_FRAME}-sample frames"
        )

    frame_count = sample_count // SAMPLES_PER_FRAME

    if not 1 <= frame_count <= MAX_FRAMES_PER_TABLE:
        raise ValueError(
            f"Source wavetable files must contain between 1 and {MAX_FRAMES_PER_TABLE} frames"
        )

    return SourceTableInfo(frame_count=frame_count)


def load_factory_source_tables(specs: tuple[FactoryTableSpec, ...]) -> tuple[SourceTableInfo, ...]:
    return tuple(
        load_source_table_info(spec.source)
        for spec in specs
    )


def build_factory_bank_catalog_value(
    specs: tuple[FactoryTableSpec, ...],
) -> dict[str, object]:
    source_tables = load_factory_source_tables(specs)

    return {
        "tables": [
            {
                "tableId": spec.table_id,
                "name": spec.name,
                "frameCount": table.frame_count,
                "sourceWav": spec.source_resource,
            }
            for spec, table in zip(specs, source_tables, strict=True)
        ]
    }


def update_patch_manifest(
    repo_root: Path,
    variant: PatchVariant,
) -> None:
    manifest = {
        "CmajorVersion": 1,
        "ID": "dev.cosimo.wavetable-synth",
        "version": "0.1.1",
        "name": "Cosimo Synth",
        "description": PATCH_DESCRIPTION,
        "category": "generator",
        "manufacturer": "Cosimo",
        "plugin": {
            "pluginCode": "CmDv",
            "manufacturerCode": "Manu",
        },
        "isInstrument": True,
        "source": list(PATCH_SOURCE_FILES),
        "worker": PATCH_WORKER_SRC,
        "resources": list(variant.resource_files),
        "view": {
            "src": variant.view_src,
            "width": variant.view_width,
            "height": variant.view_height,
            "resizable": variant.view_resizable,
        },
    }
    (repo_root / variant.manifest_filename).write_text(
        json.dumps(manifest, indent=2) + "\n",
        encoding="utf-8",
    )


def sync_patch_gui_module_copies(repo_root: Path) -> None:
    patch_gui_dir = repo_root / "patch_gui"

    for module_basename in PATCH_GUI_SHARED_MODULES:
        source_path = patch_gui_dir / f"{module_basename}.mjs"
        target_path = patch_gui_dir / f"{module_basename}.js"
        shutil.copyfile(source_path, target_path)


def remove_obsolete_bank_outputs(assets_dir: Path) -> None:
    obsolete_paths = (
        assets_dir / LEGACY_FACTORY_BANK_RUNTIME_CATALOG_FILENAME,
        assets_dir / "factory-bank.wav",
    )

    for path in obsolete_paths:
        if path.exists():
            path.unlink()


def main() -> None:
    repo_root = Path(__file__).resolve().parent
    assets_dir = repo_root / "assets"
    assets_dir.mkdir(parents=True, exist_ok=True)

    catalog_source_path = assets_dir / FACTORY_BANK_SOURCE_CATALOG_FILENAME
    specs = load_factory_table_specs(catalog_source_path)
    runtime_catalog = build_factory_bank_catalog_value(specs)

    (assets_dir / FACTORY_BANK_RUNTIME_CATALOG_FILENAME).write_text(
        json.dumps(runtime_catalog, indent=2) + "\n",
        encoding="utf-8",
    )
    remove_obsolete_bank_outputs(assets_dir)
    sync_patch_gui_module_copies(repo_root)

    for variant in PATCH_VARIANTS:
        update_patch_manifest(repo_root, variant)


if __name__ == "__main__":
    main()
