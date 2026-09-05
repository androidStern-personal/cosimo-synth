# macOS 15 clean-customer continuation

September 5, 2026: **the exact macOS 15.6.1 base restoration passed** in the
separate `Enhance That macOS 15 Clean Customer` VM. VirtualBuddy displayed
“Your macOS Virtual Machine is Ready!” and persisted `installFinished=true`.
The VM is stopped in Library. First boot, Setup Assistant/account creation,
guest OS readback and product/kit/host qualification remain pending.
The installation and UI resource slot has been released to Bob.

## Executed restore preflight

Use the regular **macOS 15.6.1, build 24G90** restore image from Apple's CDN,
listed in the [VirtualBuddy catalog](https://github.com/insidegui/VirtualBuddy/blob/main/data/ipsws_v2.json).
CDN HEAD returned 200 and exactly **16,814,137,790 bytes (15.66 GiB)**.
The full download completed with curl exit 0 and the exact expected byte count.
`UniversalMac_15.6.1_24G90_Restore.ipsw` has SHA-256
`3d87686b691ac765eb6a6b3082b2334e2af9710096a00432dd519af89ff2ea78`.

Installed VirtualBuddy 2.1 (325)'s `vctool ipsw inspect <Apple URL> --vm`
completed successfully. It fetched BuildManifest metadata through range access
and identified VirtualMac2,1, minimum host macOS 13, two CPUs, 4096 MiB RAM and
MobileDevice 1774.0.0. This host runs macOS 26.6.2 and MobileDevice 1827.120.2.
The metadata requirements are satisfied. The subsequent actual VZ restoration
below also succeeded; its real hardware-model checks and installer success are
stronger evidence than this catalog/minimum-version check.
[Apple's supported configuration check](https://developer.apple.com/documentation/virtualization/installing-macos-on-a-virtual-machine)
describes that distinction.

Private evidence under L3's `enhance-that-release/` directory:
`macos15-continuation-inputs.json`, `macos15-space-preflight.json`, and
`macos15-metadata-preflight/vctool-inspect.log`, and
`macos15-provisioning/download-receipt.json`. The latter records the completed
image, exact size/hash and post-download space; the earlier space preflight is
retained as a superseded observation. The input file contains the
exact Apple URL; the log SHA-256 is
`03f2b280b41ee1bf1e2333ea234c03b5163ae250bbe0ca7eafa564f17a821280`.

## Executed base restoration

Bob allocated one base-only VZ installation after the native A/B lease released.
The retained IPSW was fully rehashed immediately beforehand and matched the
exact hash above; free space was 45.35 GiB. The final saved configuration is
two CPUs, 8 GiB RAM, one 64 GiB raw growing boot disk, NAT, no folder shares,
no additional disks and guest additions disabled. Its SHA-256 is
`06a3984b10ca3c2cf89a5324074a8a863724d41b2deb1dac3475300119ae8b81`.

Actual hardware-model generation, sparse boot-disk creation and VZ installation
completed. The model hash is
`976e66740c64041cf9f127588f93eabf7efb9e7d3cbaee9582bcded88ba5e8d3`.
Completion was observed in the GUI and metadata by 10:46 UTC. Done closed the
owned installer and returned to Library with the new VM and both old guests.
No terms, sign-in or security prompt was encountered or accepted. No
post-install guest boot or customer software installation was performed.

The five-second monitor recorded **48 samples over 242.727 seconds**:

| Observed result | GiB |
| --- | ---: |
| Peak sampled allocated files in the new VM | 18.492 |
| Minimum sampled host-volume free space | 25.800 |
| Retained new VM files at monitor shutdown | 18.255 |
| Fresh free space after cleanup | 26.553 |

No alert or installer cancellation occurred. Monitor PID75020 exited normally;
the VZ backend PID75106 exited. VirtualBuddy PID71906 remains idle at Library.
Both old saved Config hashes are unchanged, and their boot-disk mtimes remain
September 4; no old guest was booted, stopped, edited or removed. Private
transport PID77849 remains running under its separate keepalive instruction.

Private evidence: `macos15-base-install-20260905/FINAL_BASE_RESTORE_REPORT.json`,
`monitor-result.json`, `samples.jsonl`, `install-start.json`, completion and
UI observations. Disk logical size/allocated blocks/mtime are recorded; the
64 GiB guest disk was not content-hashed. This proves restoration of the base
OS from the frozen image, not final-product acceptance or guest OS readback.

## Storage planning context

The two existing customer guests occupy 29.38 and 31.88 GiB per disk image's
allocated blocks, despite each having 64 GiB nominal sparse capacity. These are
observations of existing customer guests, not a measured fresh macOS 15 peak.

| Concurrent allocation | Planning budget |
| --- | ---: |
| New growing guest, including customer tools/build | 36 GiB |
| Restore image retained through successful installation | 15.66 GiB |
| Installation scratch and working headroom | 8 GiB |
| Total | 59.66 GiB |

The completed IPSW still occupies its 15.66 GiB allocation. The historical
**44 GiB** guest-growth/scratch estimate was used for the completed base run;
it is not 44 GiB of remaining capacity. Plan subsequent customer tools/builds
from the fresh **26.55 GiB free** observation and measured 18.255 GiB guest.
Customer-build growth remains unmeasured. Recheck disk and resource ownership
before any further guest execution. No cleanup or deletion is implied.

VirtualBuddy 2.1's actual `bootDiskImagesUseASIF=false` preference selects a raw
`Disk.img`. Its generator uses `ftruncate` on the APFS host volume: 64 GiB is
logical capacity, not an up-front allocation or a host physical-space limit.
The local IPSW is passed directly to Apple's installer without an app-level
second copy. This supports the estimate's plausibility, but **44 GiB is not a
verified worst-case requirement**. Neither the inspected application source nor
Apple's installer documentation specifies a maximum temporary-space peak. The
IPSW central directory totals 16.07 GiB uncompressed; that is archive metadata,
not a measurement of the framework's scratch use. Do not represent the 8 GiB
scratch allowance as a general bound; the measured base run above is one
successful profile, with no customer build performed.

Private `macos15-base-preparation/` evidence contains installed settings, exact
source receipts for tag 2.1 commit `088351b0fc67e0b24b83e7954ad48314dda4ce04`,
Apple documentation, the destination check and a concrete `HANDOFF.md`.
Do not repeat cleanup, delete shared caches or borrow another guest's storage.

## Actual provisioning procedure and boundaries

Installed `vctool` offers catalog, IPSW and MobileDevice inspection; it has no
VM-create/install command. The actual route is VirtualBuddy's new macOS wizard:
select the completed **local** IPSW, enter the owned name, enter configuration,
then confirm the configuration to start `VZMacOSInstaller`.

The created, owned destination is
`~/Library/Application Support/VirtualBuddy/Enhance That macOS 15 Clean Customer.vbvm`.
It was absent with no symlink ancestors before creation. Do not rerun a new
wizard with the same name: entering configuration creates the bundle, and the
model initializer can load existing same-name data. A later customer-delivery
attachment is a separate step.

The app loads the IPSW through `VZMacOSRestoreImage`, requires a non-nil
`mostFeaturefulSupportedConfiguration`, and checks `hardwareModel.isSupported`
before creating boot storage. This actual path ran successfully. The
configuration sheet skips VZ validation during pre-install, and the separate
TSS check is in the download path, which local-file selection bypasses. The
evidence is successful actual VZ restoration, not a separately executed TSS
probe or an inference from its enabled preference.

The predecessor explicitly released the old add-storage and configuration
dialogs after a saved/visible comparison; only their Cancel controls were used.
Library navigation then remained unavailable, including its source-supported
Command+0 shortcut. Bob allocated one normal GUI quit/reopen after stopped-VM
proof; the new app process restored Library and its ordinary + wizard route.
No force kill, preference reset or app patch was used. Evidence and the narrower
app-lifecycle hypothesis are in `macos15-base-preparation/NAVIGATION_DIAGNOSIS.md`;
do not confuse the successful remedy with proof of the underlying framework bug.

## Scheduled continuation

The completed base run used the initial 30-minute observation allocation and
finished inside its first four minutes of monitoring. That allocation is now
released. First boot/Setup Assistant, guest `sw_vers` readback and customer tools
require subsequent resource allocation. Stop at any actual terms, personal
authentication or security-permission checkpoint; none has yet been reached.
Do not treat elapsed time or the 8 GiB space alert as an automatic kill rule.

Cancellation has a concrete limitation: VirtualBuddy 2.1's backend cancels its
own mirrored Progress object, then calls `virtualMachine.stop()` if allowed.
It does not explicitly cancel `VZMacOSInstaller.progress`. [Apple's documentation](https://developer.apple.com/documentation/virtualization/installing-macos-on-a-virtual-machine)
directs cancellation through installer progress and says stopping or pausing
during installation has undefined behavior. Therefore do not promise a safe,
resumable timed cancel or use an app-wide kill that could affect another guest.
Keep failed installation evidence; do not reuse or remove other VM storage.

No cancellation was needed in this run. Retain this limitation for any future
restore attempt; do not generalize successful completion into proven safe
cancellation or resumability.

These implementation findings use the version-matched
[VirtualBuddy 2.1 disk generator](https://github.com/insidegui/VirtualBuddy/blob/088351b0fc67e0b24b83e7954ad48314dda4ce04/VirtualCore/Source/Virtualization/Helpers/DiskImageGenerator.swift)
and [restore backend](https://github.com/insidegui/VirtualBuddy/blob/088351b0fc67e0b24b83e7954ad48314dda4ce04/VirtualCore/Source/Restore/Installation/VirtualizationRestoreBackend.swift),
not a claim that the installed binary was rebuilt from those sources.

Create a fresh local customer account without a maintainer Apple/GitHub login,
SSH keys, home-directory shares or copied dependency/tool checkouts. Use only
the customer kit, tool archives and documented setup/dependency delivery.
An approved read-only delivery disk/share may contain the exact downloads and
test audio only. A host-loopback feed URL is not automatically reachable in a
guest; Bob must supply the candidate's reviewed guest delivery path. Separate
payload qualification from the final website/download entitlement rehearsal.

A no-purchase DAW option is REAPER's official universal build. At preparation,
[REAPER 7.79](https://www.reaper.fm/download.php) supports Intel/ARM64 and offers
a fully functional 60-day evaluation without registration. Use an owned saved
project and record the downloaded host version/hash; do not copy credentials
or purchase a license for this run. Its proof does not replace the separate
Ableton-specific keyboard checks. AU inclusion/defer remains Bob/L1's decision.

Guest provisioning may precede final packaging, but qualification must wait
for the frozen source/kit lineage, unused version, signed/notarized free-plugin
package and ZIP, final cmaj/CmajPlugin archive hashes, notices and explicit
format decision. The historical private candidate labeled 0.1.2 is not the
new final candidate. Verify those exact bytes in the guest, then follow
`ENHANCE_THAT_HOST_QUALIFICATION.md` and bind evidence to the candidate digest.
Creating a bootable guest alone does not pass macOS 15 or L3 qualification.
