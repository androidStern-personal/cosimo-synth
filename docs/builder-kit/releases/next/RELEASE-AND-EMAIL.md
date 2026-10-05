# Builder Kit 0.2.0 release plan

**Prepared and qualified; not published.** Current checklist below; [qualification evidence](FINAL-PREPARATION-2026-10-04.md) stays separate.

## Source and scope

- Kit: `codex/builder-kit-020-candidate`; qualified code **9b852923**. The 0.2.0 review cleanup (`claude/builder-kit-020-review-fixes`) changes the customer kit after that qualification, so the qualification gates run again on the cleaned-up source.
- Website/email: `codex/builder-kit-release-email-318e`; qualified code **dbab0d5** in [song-machines-website](https://github.com/androidStern-personal/song-machines-website/tree/dbab0d5542166b3a451d5973de17999846f8c2e6). Later evidence commits leave runtime/assets unchanged.

| Workstream | Status and source of truth |
|---|---|
| Simplified state management | Done: declarations, saving/sync, one public field status, guarded retry. [State guide](../../../../kit/docs/PLUGIN_STATE.md). |
| Global Undo | Done: shared parameter/complex-value history, compound edits and gesture grouping. [Customer changelog](../../../../kit/CHANGELOG.md). |
| Shared data and tools | Done: native/browser preparation, generated DSP readers, consistent pinned tools. [Shared data](../../../../kit/docs/SHARED_DATA.md). |
| Component extraction | Done: composable [knobs](../../../../kit/docs/KNOBS.md), [MSEGs](../../../../kit/docs/MSEG.md), [filters](../../../../kit/docs/FILTERS.md), and [sliders](../../../../kit/docs/SLIDERS.md). Shipped examples exercise public composition, styling and modulation/playback. Cosimo reuse is integrated. |
| Customer/agent documentation | Done: [kit guide](../../../../kit/AGENTS.md), Preview/Code pages, API references, [compatibility policy](../../../../kit/docs/COMPATIBILITY.md) and per-release update prompt. A 0.1.x plugin renames one preview type; adopting state, presets and Undo is a separate customer decision. |
| Package qualification | Passed: independent installation, actual 0.1.5 customer-edit update/conflict protection, browser/audio, native build and pluginval GUI. DAW listening/save/reopen acceptance remains open. [Evidence](FINAL-PREPARATION-2026-10-04.md). |
| Websites and access | Release page/video/poster built and reviewed; not deployed. Target: [0.2.0 notes](https://song-machines.com/builder-kit/releases/0.2.0). Retain the existing checkout, entitlements and [access recovery](https://song-machines.com/enhance-that/recover); verify live paths after deployment. |
| Customer communication | HTML/text [email](EMAIL.html) and existing Resend sender ready; no messages sent. Factual notice to eligible kit owners, with update prompt, notes and recovery links. [Operator procedure](https://github.com/androidStern-personal/song-machines-website/blob/ed16453f1613d7883e7e2c59906d21ab200d3ed9/docs/RELEASE-EMAIL.md). |
| Video, branding and social | Approved v12 frozen: vertical, 46.83 seconds, Song Machines logo/sign-off and SongMachines.com. [Video/poster](https://github.com/androidStern-personal/song-machines-website/tree/dbab0d5542166b3a451d5973de17999846f8c2e6/builder-kit/releases/0.2.0), [provenance](https://github.com/androidStern-personal/song-machines-website/blob/dbab0d5542166b3a451d5973de17999846f8c2e6/evidence/release-020-media.json), [social drafts](SOCIAL.md), [launch copy](WRITEUP.md). Prepared, not posted. |

## Release sequence

**Done when:** the release tag is in the lineage, the feed manifest and release page are live, the owner email batch is delivered, the evidence is archived, master is integrated, and the next release is open.

- [ ] Requalify the cleaned-up source: export proof, customer install, 0.1.5 update with a customized plugin, browser/audio, native build and pluginval. Update the qualification date in `kit/docs/COMPATIBILITY.md` if it changes.
- [ ] Hear the customer-built plug-in in a DAW; edit, Undo/Redo, save and reopen. Record listening acceptance.
- [ ] Review/integrate both source branches through the coordinator. Confirm protected production configuration, exact release source, archive hashes and preserved customer ancestry. The release helper stamps the changelog date from the source commit.
- [ ] Publish through the existing kit/feed release helper; deploy the website and sender. Verify production download/install/update, notes/video, access recovery and checkout compatibility. Retain the previous release for recovery.
- [ ] Canary: update the owner's second Mac and one friendly owner from 0.1.5, using the published feed and the email's update prompt. Wait 48–72 hours. Continue only if both updates pass strict doctor, `npm test`, a build and a DAW project reopen, and no new support issue is open. A failure means a 0.2.1 fix, never an edit to the published release.
- [ ] Configure the deployed store's Resend callback/signing secret. Review rendered email and recipient count; verify an explicitly authorized operator delivery and its callback/inbox result.
- [ ] Send the approved owner notice using the published version/links. Check delivery outcomes; retry through the existing operator procedure. Publish approved video/social copy.
- [ ] Post-release: archive the `build/release-020-final` evidence in the lineage or evidence repository, bump `kit/kit.json` to `0.2.1-dev`, and open a `## Unreleased` section at the top of `kit/CHANGELOG.md`.

## After the email

For the first week, triage the support inbox daily. Log each reported setup or update failure with the customer's strict doctor JSON (private addresses removed) and decide whether it needs a patch release. The release page carries a **Known issues** block the owner edits directly, without a kit release; copy each confirmed issue there and into the next changelog. There is no telemetry. Never paste access tokens or customer lists into public assets.

Production configuration is still needed. At the October 4 check, notes returned 404 and recovery returned 200. Pushing these branches does not publish the release.

## Broader product launch

Retain approved pricing/rights, notices, support/refunds and commerce from the [product handoff](../../../../ENHANCE_THAT_LAUNCH_HANDOFF.md). Before wider sales launch, reconcile clean-Mac/platform and host-format acceptance, signing/notarization if replacing our free plug-in, beta/customer runthrough and purchase/download rehearsal. Historical evidence does not close these gates for 0.2.0; full-product launch decisions remain separate.
