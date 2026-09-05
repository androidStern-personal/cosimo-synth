# macOS 15 clean-customer continuation

September 5, 2026: **base restoration and ordinary guest setup passed** in the
separate `Enhance That macOS 15 Clean Customer` VM. Actual guest Terminal
`sw_vers` reports **macOS 15.6.1, build 24G90**. The guest reached its desktop
with a neutral local-only test account after Andrew explicitly approved the
Apple macOS license through Woods and Bob.

Normal Pause is confirmed and the UI/native CPU lease is released. Backend
PID79640 remains present and retains memory; the setup monitor exited normally.
Current observed host free space is **24.09 GiB**, with **20.484 GiB** allocated
to the owned guest. Product, kit and host qualification remain pending.

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
No terms, sign-in or security prompt was encountered or accepted during
restoration. Post-install first boot was performed only under the subsequent
allocation below; no customer software installation has been performed.

The five-second monitor recorded **48 samples over 242.727 seconds**:

| Observed result | GiB |
| --- | ---: |
| Peak sampled allocated files in the new VM | 18.492 |
| Minimum sampled host-volume free space | 25.800 |
| Retained new VM files at monitor shutdown | 18.255 |
| Fresh free space after cleanup | 26.553 |

No alert or installer cancellation occurred. Monitor PID75020 exited normally;
the restoration VZ backend PID75106 exited. VirtualBuddy PID71906 was idle at
Library when that restoration slot was released.
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
from the latest **24.09 GiB free** observation and measured 20.484 GiB guest
after setup; the 26.55/18.255 GiB restoration values are historical.
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

## First-boot checkpoint before license approval

This section preserves the earlier stop and pause; the subsequent approved
setup below resolves this checkpoint.

Bob separately allocated first boot and nonpersonal base choices, with an
explicit stop at the first actual legal, credential, security or account-creation
checkpoint. L3 opened only the new VM and clicked Play. The actual guest showed
Hello; clicking its start control reached Language, with English already
selected. No guest language choice or forward action was made.

The Language page displays this notice beneath its language list and forward
arrow (there is no separate Agree/Disagree button):

> By using this software, you agree to the terms of the software license agreement for the software. You can view the terms of the software license agreement at https://www.apple.com/legal/sla/

L3 stopped there and reported the exact notice to Bob. The unlabeled
right-facing arrow is the page's visible forward control; it was not activated.
Its subsequent behavior and legal effect have not been tested or inferred.
The displayed official license URL is [Apple Software License Agreements](https://www.apple.com/legal/sla/).
Guest `sw_vers` is unavailable at this checkpoint and has not been substituted
with restore-image metadata.
No account, credentials, permissions, tools, kit, plugin or DAW were provisioned.

Bob then explicitly allocated normal Pause for this new VM only. Clicking the
host Pause button produced the blurred paused view with central circular Play
and toolbar Play controls. No shutdown, reboot, resume or saved-state action
was used. Backend PID79640 remains present (sampled CPU 0.0%, RSS 9,474,256 KiB,
about 9.04 GiB); this is not a claim that the process or memory was released.
The UI/native CPU lease was released after this paused-state confirmation.

The separate five-second first-boot monitor PID79442 recorded a post-pause
sample, stopped normally through its stop-file, and exited 0. It recorded
67 samples over 336.779 seconds with no alerts: minimum host free space
26.046 GiB, peak allocated owned files 18.747 GiB, and final free/owned
26.050/18.744 GiB. These are sampled observations, not continuous peak bounds.
Private transport PID77849 remains alive under its separate instruction.

Private evidence is `macos15-first-boot-20260905/FINAL_FIRST_BOOT_REPORT.json`,
`pause-confirmed.json`, `language-license-checkpoint.json`, monitor result and
samples. Before/after guest screenshots and AX are retained in the task's
native CUA transcript. Both old VM Config hashes and boot-disk mtimes were
rechecked unchanged; the new saved Config hash also remains unchanged.

## Completed ordinary setup

Andrew explicitly answered YES to accepting Apple's macOS license for this
new test VM. Woods relayed the approval and Bob allocated resume and ordinary
setup, including a neutral local-only test user. This approval is recorded;
do not ask again for the same macOS agreement and VM. It did not authorize
Apple Account sign-in, other service agreements or unrelated permissions.

Preflight verified the saved configuration and both old VM receipts unchanged,
with 25.90 GiB host free space. The separate setup allocation allowed two GiB
additional guest growth, an eight GiB host floor and a 30-minute checkpoint.
L3 resumed only the new VM, completed setup and opened the actual guest desktop.
The explicit macOS Software License Agreement and its confirmation were
accepted after the existing usage notice, under that recorded approval.

Setup used English/US defaults, no migration, a new neutral local account,
no Apple Account or linked account recovery, no location services, optional
analytics or Siri, no Screen Time configuration, and Light appearance.
Credentials are fresh and retained in a separate owner-readable local file
outside Git; their values are absent from reports and transcripts.
The final update page's **Only Download Automatically** option was selected;
no update installation was invoked. This leaves a future-download setting to
account for before any longer guest run; no update-settings customization was
performed after setup.

The guest's About This Mac reports 15.6.1, and its Terminal `sw_vers` reports
ProductName macOS, ProductVersion 15.6.1 and BuildVersion 24G90. CUA's modifier
input did not preserve uppercase/underscore in this guest; mouse selection
corrected the neutral account name before creation, and shell tab completion
supplied the exact `sw_vers` command before Return. No mistyped command ran and
no keyboard, GuestApp, share or permission configuration was changed.

Normal host Pause then produced the blurred screen with central/toolbar Play.
Backend PID79640 remains present, sampled at 0.0% CPU and RSS 11,017,952 KiB
(about 10.51 GiB); this is not a memory-release claim. The UI/native CPU lease
was released. Owned monitor PID90995 stopped through its stop-file and exited
0 after the paused sample: **91 samples over 461.776 seconds**, no alerts,
maximum growth **1.740 GiB**, peak/final owned allocation **20.484 GiB**, and
minimum host free space **24.090 GiB**. Both old Config hashes and disk mtimes,
and the new Config hash, remain unchanged. Private transport PID77849 stays up.

Private `macos15-setup-20260905/FINAL_SETUP_REPORT.json` binds the setup receipt,
monitor result, and screenshot hashes. `guest-sw-vers.png` and its transcribed
text retain the actual OS readback; `apple-macos-terms.png` and
`setup-complete-paused.png` retain the approved license and final paused UI.
No tool, kit, plugin or DAW was installed or qualified in this setup allocation.

## Scheduled continuation

The completed base run used the initial 30-minute observation allocation and
finished inside its first four minutes of monitoring. That allocation is now
released. First-boot and ordinary-setup UI/native CPU leases are also released.
The guest is paused after desktop and actual OS readback. Customer tooling and
qualification require the final candidate and a new resource allocation.
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

The fresh local customer account now exists without a maintainer Apple/GitHub
login, SSH keys, home-directory shares or copied dependency/tool checkouts. Use only
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
