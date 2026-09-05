# macOS 15 clean-customer continuation

September 5, 2026: two Woods-authorized cleanup passes superseded the old disk
shortfall. L3 measured 62.41 GiB free before the authorized network-only download
and 46.75 GiB afterward. The macOS 15 restore image is now downloaded and hashed.
No existing guest has been changed, copied, booted or removed for this work.

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
The metadata requirements are satisfied. Before provisioning, still verify
Apple signing and the actual supported VZ hardware model before installing;
[Apple's supported configuration check](https://developer.apple.com/documentation/virtualization/installing-macos-on-a-virtual-machine)
is distinct from the catalog/minimum-version check.

Private evidence under L3's `enhance-that-release/` directory:
`macos15-continuation-inputs.json`, `macos15-space-preflight.json`, and
`macos15-metadata-preflight/vctool-inspect.log`, and
`macos15-provisioning/download-receipt.json`. The latter records the completed
image, exact size/hash and post-download space; the earlier space preflight is
retained as a superseded observation. The input file contains the
exact Apple URL; the log SHA-256 is
`03f2b280b41ee1bf1e2333ea234c03b5163ae250bbe0ca7eafa564f17a821280`.

## Physical storage budget

The two existing customer guests occupy 29.38 and 31.88 GiB per disk image's
allocated blocks, despite each having 64 GiB nominal sparse capacity. These are
observations of existing customer guests, not a measured fresh macOS 15 peak.

| Concurrent allocation | Planning budget |
| --- | ---: |
| New growing guest, including customer tools/build | 36 GiB |
| Restore image retained through successful installation | 15.66 GiB |
| Installation scratch and working headroom | 8 GiB |
| Total | 59.66 GiB |

The completed image occupies the 15.66 GiB allocation. The remaining reservation
is **44 GiB** for guest growth and scratch. The latest read-only observation at
2026-09-05 10:13 UTC is **45.77 GiB free**, leaving **1.77 GiB** above that estimate.
L2's native build and L3's migration fixtures have finished; Bob allocated the
next short native slot to resident research. Recheck disk and resource ownership
after that slot and immediately before provisioning.

VirtualBuddy 2.1's actual `bootDiskImagesUseASIF=false` preference selects a raw
`Disk.img`. Its generator uses `ftruncate` on the APFS host volume: 64 GiB is
logical capacity, not an up-front allocation or a host physical-space limit.
The local IPSW is passed directly to Apple's installer without an app-level
second copy. This supports the estimate's plausibility, but **44 GiB is not a
verified worst-case requirement**. Neither the inspected application source nor
Apple's installer documentation specifies a maximum temporary-space peak. The
IPSW central directory totals 16.07 GiB uncompressed; that is archive metadata,
not a measurement of the framework's scratch use. Do not represent the 8 GiB
scratch allowance as proven, or begin customer builds in the initial base slot.

Private `macos15-base-preparation/` evidence contains installed settings, exact
source receipts for tag 2.1 commit `088351b0fc67e0b24b83e7954ad48314dda4ce04`,
Apple documentation, the destination check and a concrete `HANDOFF.md`.
Do not repeat cleanup, delete shared caches or borrow another guest's storage.

## Actual provisioning procedure and boundaries

Installed `vctool` offers catalog, IPSW and MobileDevice inspection; it has no
VM-create/install command. The actual route is VirtualBuddy's new macOS wizard:
select the completed **local** IPSW, enter the owned name, enter configuration,
then confirm the configuration to start `VZMacOSInstaller`.

The owned destination is
`~/Library/Application Support/VirtualBuddy/Enhance That macOS 15 Clean Customer.vbvm`.
It is absent and its ancestors are not symlinks at the latest observation.
Recheck before entering configuration: that step already creates the bundle,
and the underlying model initializer can load an existing same-name bundle.
Set two CPUs, 8 GiB RAM and a 64 GiB raw growing boot disk explicitly, with NAT,
no shared folders, no additional disks and guest additions disabled for the
base installation. A later customer-delivery attachment is a separate step.

The app loads the IPSW through `VZMacOSRestoreImage`, requires a non-nil
`mostFeaturefulSupportedConfiguration`, and checks `hardwareModel.isSupported`
before creating boot storage. These checks have not run yet. The configuration
sheet skips VZ validation during pre-install; a visually accepted configuration
is not support proof. The app's separate TSS check is in its download path,
which local-file selection bypasses. Retain actual installer/signing success or
failure as evidence; the enabled TSS preference alone is not a signing result.

An existing, unowned **New Storage Device** dialog was observed and left
untouched. Bob has been told; its owner must finish or release it before L3
uses that UI. No actual license, Apple-account or other personal-authentication
prompt has been reached. Record any such prompt when it appears; the approved
base-provisioning policy and completed download remain settled.

## Scheduled continuation

The next proposed allocation is one exclusive **base-install** observation
window of 30 minutes, with the configuration above and no simultaneous native
work, audible capture or other guest activity. Thirty minutes is a scheduling
estimate, not a measured completion time or permission to kill an installer.
Observe progress at least once per minute and sample host-volume free space
and owned allocated blocks every five seconds; record the actual peak. An
8 GiB free-space alert and a stalled-progress alert inform Bob before extending
the slot. Neither is a verified automatic cutoff.

Cancellation has a concrete limitation: VirtualBuddy 2.1's backend cancels its
own mirrored Progress object, then calls `virtualMachine.stop()` if allowed.
It does not explicitly cancel `VZMacOSInstaller.progress`. [Apple's documentation](https://developer.apple.com/documentation/virtualization/installing-macos-on-a-virtual-machine)
directs cancellation through installer progress and says stopping or pausing
during installation has undefined behavior. Therefore do not promise a safe,
resumable timed cancel or use an app-wide kill that could affect another guest.
Keep failed installation evidence; do not reuse or remove other VM storage.

The allocation handoff must acknowledge the unmeasured scratch peak and this
cancellation behavior. Provision the base OS first, then measure its retained
allocation and remaining space before scheduling customer tools or builds.
No VM has been created, booted or installed in this preparation.

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
