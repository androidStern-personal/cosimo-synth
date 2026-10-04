# Builder Kit 0.2.0 — final preparation, October 4, 2026

Evidence record. Use the [release plan](RELEASE-AND-EMAIL.md) for the current checklist and launch scope.

Prepared and qualified; not published. The executable/source candidate is **9b85292337834aaa4ab0e49a4ee6c7638f9e77bb** on `codex/builder-kit-020-candidate`. Store/release-page source is **dbab0d5542166b3a451d5973de17999846f8c2e6** on `codex/builder-kit-release-email-318e`. Later commits that record this evidence do not change the kit or store runtime.

## Completed

- Replaced the verbose control pages with one shared reference layout: default preview, short usage, focused Preview/Code examples, and a compact API table. Full contracts remain in linked API references. Knob, MSEG, Filter and Slider are linked together, work at phone and desktop widths, and ship in the customer kit.
- Finished the slider examples and public styling/input contract. Defaults, root CSS/refs, logarithmic and discrete values, exact entry, modulation endpoints, gesture cleanup and standalone style ownership are exercised through real exported controls. Modulation badges keep their independent styling without adding styles to unrelated elements.
- Staged the exact committed source over the released 0.1.5 customer ancestry, reusing the already rebuilt/hash-verified tools from the unchanged Cmajor pin. Canonical release/export checks passed (**89 release-contract checks, 8 export checks**); current targeted export scan covered **314 files** and two internal skill links with no findings.
- Installed the staged package over loopback HTTP in a separate customer checkout: normal setup, strict doctor, typecheck, **293 passing unit checks / 6 documented skips**, **57 browser checks**, **20 state/lifecycle checks**, and **51 controls/docs checks** passed. Customer dependencies were installed independently. The unified docs build passed.
- Updated a real customized plug-in created by released 0.1.5. DSP, UI, owner identity, shared token edits and its test remained byte-identical; **295 checks / 6 documented skips** and the custom runtime build passed. A conflicting customer scaffold edit stopped without automatic resolution or loss of its files.
- Built the current customer's production Enhance That VST3 and passed pluginval strictness **5 with GUI checks enabled**. The bundle is ad-hoc signed for qualification, not a signed/notarized distribution. No shared installed plug-in was replaced.
- Ran actual Chromium AudioWorklets from the customer-pinned Cmajor helper for Enhance That and the preserved custom gain plug-in. Parameters changed finite, unclipped output. Output was muted: no human listening acceptance is claimed.
- Froze approved video **v12**, without changing its visuals: **1080×1920, 30fps, 1405 frames, 46.833333 seconds, silent**. It decodes fully; the store copy matches the approved SHA-256. The isolated composition passed HyperFrames **0.8.121** runtime, layout and contrast checks after its local CLI pin was updated from 0.8.65. The original project was preserved.
- Prepared the stable release page and its frozen video/poster in the existing store build. Updated both email templates to include sliders and the release-specific kit-update prompt. HTML/text preview, mobile/desktop layout, static validation, deployment build and all **115 store checks** pass. This is preparation, not deployment or provider/inbox acceptance.

## Evidence

`build/release-020-final/qualification.json` records the exact source, customer directories, stage results, preserved-file hashes, conflict and measured audio. Other receipts/logs live beside it; the HTML email preview is under `email/`, and the frozen video is under `assets/`. The earlier [qualification](QUALIFICATION-2026-10-04.md) remains valid historical evidence for its named source.

## Remaining release gates

1. DAW listening/acceptance: hear the customer-built plug-in, edit, Undo/Redo, and reopen a saved session. Automated pluginval GUI and measured browser audio do not replace this.
2. Integration coordinator: review the source and production destination, publish the qualified kit/feed, deploy the store release page and sender, and verify installation/update through the actual production links. The changelog stays Unreleased until the real release date is chosen.
3. Configure the store-specific Resend callback and signing secret in the deployed environment, then verify one explicitly authorized operator email before the customer batch. The sending domain is verified; the current callbacks belong to other applications. No customer data was exported or message sent.
4. Send the approved customer notice and publish the prepared video/social copy after publication and live delivery verification.

Production observation this run: the proposed release-notes path returns 404; existing access recovery returns 200. Neither the Vercel project binding/protected store environment nor the production release-destination JSON is configured in these owned worktrees. No production feed, ledger, installed plug-in, callback or deployment was changed.
