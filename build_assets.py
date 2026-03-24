from pathlib import Path

from bench import make_display_demo_bank
from wtbank import build_bank, emit_cmajor_bank_assets


def main() -> None:
    repo_root = Path(__file__).resolve().parent
    assets_dir = repo_root / "assets"
    assets_dir.mkdir(parents=True, exist_ok=True)

    bank = build_bank([make_display_demo_bank()]).bank
    emit_cmajor_bank_assets(assets_dir, bank)


if __name__ == "__main__":
    main()
