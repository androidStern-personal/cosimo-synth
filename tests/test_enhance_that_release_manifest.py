import copy
import importlib.util
from pathlib import Path
import tempfile
import unittest


SPEC = importlib.util.spec_from_file_location(
    "release_manifest", Path(__file__).resolve().parents[1] / "scripts/enhance_that_release_manifest.py")
release = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(release)


class ReleaseManifestTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)

    def complete_fixture(self):
        manifest = release.template()
        candidate = manifest["candidate"]
        for key in ("sourceCommit", "kitCommit", "cmajorCommit", "chocCommit", "juceCommit"):
            candidate[key] = "a" * 40
        candidate.update(version="0.1.3", formats={"VST3": "included", "AU": "deferred"},
                         auDecision="Fixture only: no practical AU host")
        for role in release.ARTIFACT_ROLES:
            artifact = self.root / role
            artifact.write_bytes(role.encode())
            manifest["artifacts"][role] = {"path": role, "sha256": release.file_hash(artifact)}
        subject = release.candidate_digest(manifest)
        proof = self.root / "proof.json"
        proof.write_text('{"fixtureOnly":true}')
        for row in manifest["evidence"].values():
            row.update(result="pass", candidateSha256=subject, path=proof.name,
                       sha256=release.file_hash(proof))
        return manifest

    def test_pending_template_cannot_complete(self):
        result = release.check(release.template(), self.root)
        self.assertFalse(result["evidenceIndexComplete"])
        self.assertTrue(any("macOS15/" in item for item in result["errors"]))
        self.assertTrue(any("macOS26/" in item for item in result["errors"]))

    def test_complete_index_never_authorizes_publication(self):
        result = release.check(self.complete_fixture(), self.root)
        self.assertEqual(result["errors"], [])
        self.assertTrue(result["evidenceIndexComplete"])
        self.assertFalse(result["publicationAuthorized"])

    def test_artifact_change_invalidates_all_old_qualification(self):
        manifest = self.complete_fixture()
        (self.root / "pluginDownload").write_bytes(b"different release")
        self.assertFalse(release.check(manifest, self.root)["evidenceIndexComplete"])
        manifest["artifacts"]["pluginDownload"]["sha256"] = release.file_hash(self.root / "pluginDownload")
        errors = release.check(manifest, self.root)["errors"]
        self.assertTrue(any("different candidate" in error for error in errors))

    def test_changed_proof_and_missing_platform_are_rejected(self):
        manifest = self.complete_fixture()
        (self.root / "proof.json").write_text("modified evidence")
        self.assertFalse(release.check(manifest, self.root)["evidenceIndexComplete"])
        manifest = self.complete_fixture()
        del manifest["evidence"]["macOS15/VST3/disk-saved-daw-project-reload"]
        self.assertFalse(release.check(manifest, self.root)["evidenceIndexComplete"])

    def test_au_inclusion_requires_its_own_matrix(self):
        manifest = self.complete_fixture()
        manifest["candidate"]["formats"]["AU"] = "included"
        errors = release.check(manifest, self.root)["errors"]
        self.assertTrue(any("macOS26/AU/" in error for error in errors))

    def test_paths_cannot_escape_release_root(self):
        manifest = self.complete_fixture()
        for path in ("../elsewhere", "/tmp/outside"):
            changed = copy.deepcopy(manifest)
            changed["artifacts"]["cmaj"]["path"] = path
            self.assertFalse(release.check(changed, self.root)["evidenceIndexComplete"])

    def test_inventory_records_modes_bytes_and_contained_links(self):
        payload = self.root / "payload"
        payload.mkdir()
        binary = payload / "binary"
        binary.write_bytes(b"version one")
        (payload / "link").symlink_to("binary")
        first = release.inventory(payload)
        self.assertEqual(release.inventory(payload), first)
        binary.chmod(0o755)
        self.assertNotEqual(release.inventory(payload)["treeSha256"], first["treeSha256"])
        binary.write_bytes(b"version two")
        self.assertNotEqual(release.inventory(payload)["entries"][0]["sha256"], first["entries"][0]["sha256"])
        (payload / "escape").symlink_to("../../outside")
        with self.assertRaises(ValueError):
            release.inventory(payload)

    def test_inventory_rejects_metadata_and_output_overwrite(self):
        (self.root / ".DS_Store").write_bytes(b"metadata")
        with self.assertRaises(ValueError):
            release.inventory(self.root)
        output = self.root / "existing.json"
        output.write_text("preserve")
        with self.assertRaises(FileExistsError):
            release.write_new(output, {})
        self.assertEqual(output.read_text(), "preserve")


if __name__ == "__main__":
    unittest.main()
