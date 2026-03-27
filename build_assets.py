from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path
import shutil
from typing import Any

from wtbank import (
    CatalogTable,
    DEFAULT_SAMPLE_BLOB_FILENAME,
    SourceTable,
    build_bank,
    build_catalog_bank_value,
    build_manifest_bank_value,
    load_source_table_wav,
    write_sample_blob_wav,
)

FACTORY_BANK_SOURCE_CATALOG_FILENAME = "factory-table-catalog.json"
FACTORY_BANK_RUNTIME_CATALOG_FILENAME = "factory-bank.json"
FACTORY_BANK_EXTERNAL_ID = "wt::factoryBank"
FACTORY_BANK_WAV_RESOURCE = "assets/factory-bank.wav"
FACTORY_BANK_CATALOG_RESOURCE = "assets/factory-bank.json"
PATCH_DESCRIPTION = (
    "Single-oscillator wavetable synth with MIDI input, automatable wavetable "
    "position, runtime table selection, and a preloaded multi-table factory bank."
)
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


@dataclass(frozen=True, slots=True)
class PatchVariant:
    manifest_filename: str
    view_src: str
    view_width: int
    view_height: int
    view_resizable: bool = True


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
            )
        )

    return tuple(specs)


def load_factory_source_tables(specs: tuple[FactoryTableSpec, ...]) -> tuple[SourceTable, ...]:
    return tuple(
        load_source_table_wav(spec.source, table_id=spec.table_id)
        for spec in specs
    )


def build_factory_bank_catalog_value(
    bank,
    specs: tuple[FactoryTableSpec, ...],
) -> dict[str, Any]:
    catalog_tables = tuple(
        CatalogTable(table_id=spec.table_id, name=spec.name)
        for spec in specs
    )
    return build_catalog_bank_value(
        bank,
        catalog_tables,
        sample_blob_resource=FACTORY_BANK_WAV_RESOURCE,
    )


def update_patch_manifest(
    repo_root: Path,
    variant: PatchVariant,
    external_value: dict[str, Any],
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
        "resources": [
            FACTORY_BANK_WAV_RESOURCE,
            FACTORY_BANK_CATALOG_RESOURCE,
        ],
        "view": {
            "src": variant.view_src,
            "width": variant.view_width,
            "height": variant.view_height,
            "resizable": variant.view_resizable,
        },
        "externals": {
            FACTORY_BANK_EXTERNAL_ID: external_value,
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


def main() -> None:
    repo_root = Path(__file__).resolve().parent
    assets_dir = repo_root / "assets"
    assets_dir.mkdir(parents=True, exist_ok=True)

    catalog_source_path = assets_dir / FACTORY_BANK_SOURCE_CATALOG_FILENAME
    specs = load_factory_table_specs(catalog_source_path)
    source_tables = load_factory_source_tables(specs)
    bank = build_bank(source_tables).bank

    write_sample_blob_wav(assets_dir / DEFAULT_SAMPLE_BLOB_FILENAME, bank)

    runtime_catalog = build_factory_bank_catalog_value(bank, specs)
    (assets_dir / FACTORY_BANK_RUNTIME_CATALOG_FILENAME).write_text(
        json.dumps(runtime_catalog, indent=2) + "\n",
        encoding="utf-8",
    )
    sync_patch_gui_module_copies(repo_root)

    patch_external = build_manifest_bank_value(
        bank,
        sample_blob_resource=FACTORY_BANK_WAV_RESOURCE,
    )
    for variant in PATCH_VARIANTS:
        update_patch_manifest(repo_root, variant, patch_external)


if __name__ == "__main__":
    main()
