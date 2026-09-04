# Builder Kit customer delivery

The customer receives only an access-key export and the approved public URL
piped to Bash. This is the complete shape, with a dummy key shown here:

```sh
export BUILDER_KIT_ACCESS='DUMMY_KEY'; curl -fsSL https://pub-2bb7a8a7b9b44ed3b975f3f0a6bcc756.r2.dev/install.sh | bash
```

Deliver the generated licensing notice beside the populated line. Running it
after agreeing explicitly acknowledges the JUCE terms; the hosted code records
the existing acknowledgment. Setup grants no JUCE license and accepts no Apple
agreement. Apple Command Line Tools must already be installed and accepted.

The hosted default is `$HOME/src/builder-kit-0.1.2`. Folder creation, private
installer download verification, setup and final checks happen in hosted code.
Only successful completion names the folder to open in Codex. No plugin is
built, installed, copied or edited; no browser or DAW is launched. A linked
destination or unrelated occupied folder is refused. Existing installer-owned
projects retain their customer edits on rerun.

## Maintainer preparation

From the source checkout matching the immutable release installer:

```text
node scripts/prepare_builder_kit_install.mjs --manifest <release manifest> --destination-config <non-secret destination JSON> --output-dir <new private output folder>
```

The existing Keychain capability and destination parser are reused. The fresh
mode-700 output directory must be outside Git:

- `command.sh` and `delivery.txt` are private mode-600 customer files. Never log,
  commit, publish, or include their populated contents in test evidence.
- `public/install.sh` is credential-free. Its bytes and SHA-256 are also returned
  as `publicBootstrap.script` and `publicBootstrap.sha256`; `publicBootstrap.url`
  names the approved endpoint. Publish only this file to the public `install.sh`
  object after separately authorized review and qualification.
- `feed/installers/<sha256>.sh` retains the exact existing private installer
  bytes. The existing `artifact` and `sha256` return fields still identify it.
  This entry-point correction does not replace immutable v0.1.2 artifacts.

Preparation does not publish. Obsolete `--project-dir` and `--installer-origin`
options are rejected. For owned headless proof, supply a validated absolute
`BUILDER_KIT_PROJECT_DIR` through the subprocess environment, never by extending
the delivered command or replacing `HOME`. A loopback-only
`--public-bootstrap-url` override supports deterministic tests; normal delivery
uses the approved HTTPS URL.

## Trust and failure boundary

The public script is trusted through its HTTPS origin, not a clipboard checksum.
The outer `curl -fsSL ... | bash` has ordinary shell pipeline status: a failed
public HTTP fetch prints curl's error but may leave a zero pipeline status.
The complete function definition prevents a partial function body from starting
installation. It cannot detect a transport error reported after a complete
public program was already delivered; the rejected inline trailer protocol is
not recreated. These are explicit tradeoffs of the approved short command.

The downstream private download still must complete successfully and match its
SHA-256 before execution. Existing release commit pins, runtime/tool hashes,
setup receipts and strict checks remain authoritative and unchanged. Focused
shell tests are separate from publication, real-download customer proof and
DAW acceptance. The earlier giant-line qualification record remains historical;
one physical line was not acceptance of the corrected short-command contract.
