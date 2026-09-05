#!/usr/bin/env python3
"""Inventory release bytes and check the completeness of their evidence index.

This maintainer tool does not build, sign, install, publish, or perform host tests.
Evidence must come from actual qualification of the identified artifacts.
"""

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import sys


ARTIFACT_ROLES = ("pluginInstaller", "pluginDownload", "kitArchive", "cmaj", "cmajPlugin")
PACKAGE_CHECKS = (
    "source-and-tool-provenance", "inventory-and-notices", "unsigned-packaging-repeatability",
    "developer-id-signatures", "notarization-staple-gatekeeper", "package-extraction-and-hashes",
    "feed-version-available", "previous-release-recovery", "kit-build-modification-update-recovery",
)
FORMAT_CHECKS = ("no-jit-final-binary", "native-validator")
HOST_CHECKS = (
    "clean-environment", "install-rescan-name", "space-ordinary-control", "space-text-entry",
    "space-numeric-entry", "space-during-drag", "automation-write-playback",
    "preset-recall", "disk-saved-daw-project-reload", "editor-reopen", "playback",
    "offline-export", "captured-audio", "musical-acceptance",
)


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"),
                                     ensure_ascii=True).encode()).hexdigest()


def file_hash(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def relative_file(root, relative):
    if not isinstance(relative, str) or not relative or "\\" in relative:
        raise ValueError("Expected a nonempty relative file path")
    part = Path(relative)
    if part.is_absolute() or ".." in part.parts:
        raise ValueError("File path must stay inside the artifact root")
    path = root / part
    if not path.resolve().is_relative_to(root.resolve()):
        raise ValueError("File path escapes the artifact root")
    if not path.is_file() or path.is_symlink():
        raise ValueError("Expected a regular artifact or evidence file")
    return path


def inventory(root):
    root = root.resolve(strict=True)
    if not root.is_dir():
        raise ValueError("Inventory root must be a directory")
    entries = []
    for directory, directories, files in os.walk(root, followlinks=False):
        for name in sorted(directories + files):
            path = Path(directory) / name
            relative = path.relative_to(root).as_posix()
            if name in (".git", ".DS_Store") or name.startswith("._"):
                raise ValueError("Release tree contains repository or filesystem metadata")
            info = path.lstat()
            item = {"path": relative, "mode": f"{stat.S_IMODE(info.st_mode):04o}"}
            if stat.S_ISLNK(info.st_mode):
                target = os.readlink(path)
                if Path(target).is_absolute() or not path.resolve().is_relative_to(root):
                    raise ValueError("Release symlink escapes its payload")
                if not path.exists():
                    raise ValueError("Release symlink is broken")
                item.update(type="symlink", target=target)
            elif stat.S_ISDIR(info.st_mode):
                item.update(type="directory")
            elif stat.S_ISREG(info.st_mode):
                item.update(type="file", bytes=info.st_size, sha256=file_hash(path))
            else:
                raise ValueError("Release tree contains a special file")
            entries.append(item)
    entries.sort(key=lambda entry: entry["path"])
    return {"schemaVersion": 1, "entries": entries, "treeSha256": digest(entries)}


def evidence_ids(formats):
    return list(PACKAGE_CHECKS) + [
        f"{fmt}/{check}" for fmt in formats for check in FORMAT_CHECKS
    ] + [
        f"macOS{major}/{fmt}/{check}"
        for major in (15, 26) for fmt in formats for check in HOST_CHECKS
    ]


def template():
    return {
        "schemaVersion": 1,
        "purpose": "Evidence index for an unpublished candidate; publication requires Andrew's approval.",
        "candidate": {
            "sourceCommit": None, "kitCommit": None, "version": None,
            "cmajorCommit": None, "chocCommit": None, "juceCommit": None,
            "architectures": ["arm64"], "macOSMajors": [15, 26],
            "formats": {"VST3": "included", "AU": "pending"},
            "auDecision": None,
        },
        "artifacts": {role: {"path": None, "sha256": None} for role in ARTIFACT_ROLES},
        "evidence": {key: {"result": "pending", "candidateSha256": None,
                            "path": None, "sha256": None}
                     for key in evidence_ids(["VST3"])},
        "knownLimitations": [],
    }


def candidate_digest(manifest):
    return digest({"candidate": manifest["candidate"], "artifacts": manifest["artifacts"]})


def check_reference(root, reference):
    if not isinstance(reference, dict) or not re.fullmatch("[0-9a-f]{64}", str(reference.get("sha256"))):
        raise ValueError("Missing SHA-256")
    path = relative_file(root, reference.get("path"))
    if file_hash(path) != reference["sha256"]:
        raise ValueError("File bytes do not match SHA-256")


def check(manifest, root):
    errors = []
    if manifest.get("schemaVersion") != 1:
        errors.append("Unsupported manifest schema")
    candidate = manifest.get("candidate", {})
    for key in ("sourceCommit", "kitCommit", "cmajorCommit", "chocCommit", "juceCommit"):
        if not re.fullmatch("[0-9a-f]{40}", str(candidate.get(key))):
            errors.append(f"candidate.{key}: exact commit required")
    if not re.fullmatch(r"\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?", str(candidate.get("version"))):
        errors.append("candidate.version: version verified against the actual feed required")
    if candidate.get("macOSMajors") != [15, 26] or candidate.get("architectures") != ["arm64"]:
        errors.append("Retained qualification scope is Apple Silicon macOS 15 and 26")
    formats = candidate.get("formats", {})
    if formats.get("VST3") != "included" or formats.get("AU") not in ("included", "deferred"):
        errors.append("VST3 is required; AU needs an explicit included/deferred decision")
    if set(formats) != {"VST3", "AU"}:
        errors.append("Unexpected format scope")
    if not isinstance(candidate.get("auDecision"), str) or not candidate["auDecision"].strip():
        errors.append("AU decision and practical host basis must be recorded")
    artifacts = manifest.get("artifacts", {})
    if set(artifacts) != set(ARTIFACT_ROLES):
        errors.append("Exact free-plugin, kit and separate development-tool artifact roles required")
    for role in ARTIFACT_ROLES:
        try:
            check_reference(root, artifacts.get(role))
        except (ValueError, OSError) as error:
            errors.append(f"artifact {role}: {error}")
    subject = candidate_digest({"candidate": candidate, "artifacts": artifacts})
    included = [fmt for fmt in ("VST3", "AU") if formats.get(fmt) == "included"]
    evidence = manifest.get("evidence", {})
    for key in evidence_ids(included):
        row = evidence.get(key, {})
        if row.get("result") != "pass":
            errors.append(f"evidence {key}: pending, failed or unavailable")
            continue
        if row.get("candidateSha256") != subject:
            errors.append(f"evidence {key}: result belongs to a different candidate")
        try:
            check_reference(root, row)
        except (ValueError, OSError) as error:
            errors.append(f"evidence {key}: {error}")
    return {"evidenceIndexComplete": not errors, "candidateSha256": subject,
            "publicationAuthorized": False, "errors": errors}


def write_new(path, value):
    with path.open("x", encoding="utf-8") as stream:
        json.dump(value, stream, indent=2, sort_keys=True)
        stream.write("\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    inv = commands.add_parser("inventory", help="Hash exact payload paths, modes, bytes and symlinks")
    inv.add_argument("root", type=Path)
    inv.add_argument("output", type=Path)
    new = commands.add_parser("template", help="Create an entirely pending evidence index")
    new.add_argument("output", type=Path)
    for command in ("subject", "check"):
        sub = commands.add_parser(command)
        sub.add_argument("manifest", type=Path)
        if command == "check":
            sub.add_argument("--root", type=Path, required=True)
    args = parser.parse_args()
    try:
        if args.command == "inventory":
            if args.output.resolve().is_relative_to(args.root.resolve()):
                raise ValueError("Inventory output must be outside its payload root")
            write_new(args.output, inventory(args.root))
        elif args.command == "template":
            write_new(args.output, template())
        else:
            manifest = json.loads(args.manifest.read_text())
            if args.command == "subject":
                print(candidate_digest(manifest))
            else:
                result = check(manifest, args.root)
                print(json.dumps(result, indent=2))
                return 0 if result["evidenceIndexComplete"] else 1
    except (ValueError, OSError, KeyError, TypeError, AttributeError):
        # Input/OS errors can contain private paths or data. Do not echo them.
        print("Release manifest operation failed: invalid input, inaccessible file, or existing output.", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
