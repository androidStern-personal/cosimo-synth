#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
catalog_file="$repo_root/assets/factory-bank-catalog.json"
source_dir="$repo_root/assets/factory_sources"
output_path="$repo_root/build/ios_factory_library.zip"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --catalog)
      catalog_file="$2"
      shift 2
      ;;
    --sources)
      source_dir="$2"
      shift 2
      ;;
    --output)
      output_path="$2"
      shift 2
      ;;
    *)
      printf 'Unknown argument: %s\n' "$1" >&2
      exit 1
      ;;
  esac
done

if [[ ! -f "$catalog_file" ]]; then
  printf 'Catalog file not found: %s\n' "$catalog_file" >&2
  exit 1
fi

if [[ ! -d "$source_dir" ]]; then
  printf 'Source directory not found: %s\n' "$source_dir" >&2
  exit 1
fi

temp_dir="$(mktemp -d "${TMPDIR:-/tmp}/cosimo-ios-library.XXXXXX")"
cleanup() {
  rm -rf "$temp_dir"
}
trap cleanup EXIT

mkdir -p "$temp_dir/assets"
cp "$catalog_file" "$temp_dir/assets/factory-bank-catalog.json"
cp -R "$source_dir" "$temp_dir/assets/factory_sources"

python3 - "$temp_dir" "$output_path" <<'PY'
from pathlib import Path
import sys
import zipfile

source_root = Path(sys.argv[1])
output_path = Path(sys.argv[2])
output_path.parent.mkdir(parents=True, exist_ok=True)

with zipfile.ZipFile(output_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for path in sorted(source_root.rglob("*")):
        if path.is_file():
            archive.write(path, path.relative_to(source_root).as_posix())
PY

printf 'Built iOS factory library zip at %s\n' "$output_path"
