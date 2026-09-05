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
is **44 GiB** for guest growth and scratch, against **46.75 GiB** measured free
after download. These are planning allowances, not an Apple guarantee. Bob will
serialize L2's estimated 2 GiB native-build peak before VM work; recheck actual
free space after that build and before provisioning. Do not repeat cleanup,
delete shared caches, or use an existing guest's storage to fit the budget.

## Scheduled continuation

After Bob allocates the operations and the fresh disk check passes, validate
the retained image's Apple signing and VZ hardware support. Create a separate
`Enhance That macOS 15 Clean Customer`
guest with a 64 GiB sparse disk, 8 GiB RAM and two CPUs. Installation, boot and
guest native builds wait for release of L5's audible-capture slot. Record actual
peak allocation and reduce concurrency if measured headroom is consumed.

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
