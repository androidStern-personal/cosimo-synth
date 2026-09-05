# Enhance That — consolidated launch handoff

Prepared September 5, 2026. **Execution authorized; dispatch confirmation pending.** Authority: Andrew's decisions in Woods thread `01a03885-0e68-7411-8b3f-f69ae41b6d89`, including the latest management-only Bob and Astra/standard-speed instructions.

This is the execution handoff for the remaining launch work. It supersedes conflicting statuses, dates and requirements in the [historical roadmap](ENHANCER_LITE_BUILDER_KIT_ROADMAP.md) and [twenty-day schedule](ENHANCER_LITE_BUILDER_KIT_20_DAY_COVERAGE.md). Those documents retain useful background, not additional launch gates. The six packets below group existing BK tickets; they are not six rival coordinators or replacements for the ticket IDs.

**Outcome:** a working, qualified product and Builder Kit, finished website and purchase/download experience, usable creative and press assets, completed beta evidence, and a rehearsed launch awaiting Andrew's publication approval. Neither a code-only delivery nor a folder of plans counts as that outcome. Post-launch follow-up remains scheduled work, not something that can be completed before launch.

Andrew has authorized handing this queue to Bob and getting it genuinely in flight. Bob delegates implementation, review, integration and qualification to top-level Codex tasks; this includes scoped commits, reviewed integration/push and isolated build/test/install work needed for the approved plan. Public launch, live payment/refund tests, campaign sends, new paid services, new access and personal account/terms actions retain their explicit checkpoints. Account/commerce preparation must not activate public sales or disturb existing products. No authorization expands to unrelated repositories, tasks, source changes or deployments.

## 1. Settled scope — do not reopen from older documents

- **Products:** useful free **Enhance That** plugin; paid **Enhance That Builder Kit** sells the editable source and workflow, not disabled sound features. Public-name checks and final identity assets are work, not already-completed approvals. Preserve permanent plugin/parameter identities and saved sounds when applying the new presentation name.
- **Product behavior:** retain Enhancer Lite's existing inexpensive algorithms, Low/Bell/High shapes, Stereo/Mid/Side routing, Mid/Side amounts, Tube/Solid character, Subtle/Medium intensity, spectrum display and editing behavior. This is not authorization to redesign standalone T26, per-voice Enhancer, Polish or SeqFX. Protected product-discussion threads are not implementation workers.
- **Platform:** Apple Silicon, macOS 15 and 26; VST3 required. Andrew subsequently made Logic non-blocking: if Logic is unavailable, qualify AU in a suitable free host if practical; otherwise defer AU and launch VST3-only. Do not check Logic access now or buy a DAW. Record the actual format decision before beta freeze and make every compatibility claim match evidence.
- **Commercial offer:** $29 for the first 50 founding customers with lifetime upstream kit releases. A later $49 price requires evidence and approval, not an automatic launch step. Retain approved broad customer modification/distribution/sale rights and third-party disclosures; no plugin activation, DRM, call-home or telemetry. Do not reopen settled rights questions from old unresolved rows.
- **Distribution:** retain the existing static R2 feed and ordinary Git-mirror architecture. Do not resurrect an old custom signed-bundle server or invent per-buyer revocation of source already downloaded. Purchase eligibility and recovery still need a working customer flow.
- **Customer workflow:** one short copy/paste install command; first suggested request is “Build and install the included plugin so I can try it in my DAW.” No mandatory example duplication, renaming, authored wrapper/tests, browser-preview ritual or long maintainer setup recipe. Optional browser development remains available when useful.
- **Publishing tools:** customers' packaging/signing/distribution tooling is post-v1. Local customer build/install and broad customer rights remain. Signing and notarizing **our own finished public plugin** is retained launch work.
- **Refunds:** approved copy is “For refund requests, contact support with the reason for your request. We review each request individually.” No fixed 14-day cutoff or advertised unlimited promise; Andrew decides individual refunds.
- **Support:** purchase/download and genuine setup help, not bespoke development or merge support. No fixed public response-time guarantee.
- **Channels:** `song-machines.com`, `andrew@song-machines.com`, Polar commerce/transactional delivery, separate affirmative unchecked Resend marketing opt-in. Preserve unrelated existing site content and account products. Organic acquisition first; no paid ads, affiliates or automatic paid service upgrades.
- **People and timing:** Andrew has five testers and recruits more once there is something showable. Target ten plus two backups. The final launch film is not a recruitment prerequisite. Use completion gates, not the stale August–September calendar.
- **Separate/deferred:** hosted-Mac CI and automatic releases, unrelated dynamic-data research, customer publishing tools, paid acquisition and speculative Unicode/JUCE-fork work. No decision-provenance requirement. None is silently reintroduced as a launch dependency.

## 2. Starting point — reuse what is finished

Audit snapshot, to be refreshed at dispatch rather than treated as an immutable build base:

| Surface | Verified state | What that does not establish |
|---|---|---|
| Source | Live `origin/master` was `c297eeed62aec66e85118df06a229d9cdd8491da`. Build/framework cleanup, minimal guidance, preset isolation, safe replacement, readable DAW names and Space forwarding landed. | The currently published kit contains those fixes. |
| Private customer candidate | Lineage `c840a394094f3c6a9ea14b5f1a8041eb424b22ac`, matching the source above. Short install, unchanged-example build/install and actual Ableton name/Space/preset/editor/audio-spectrum checks passed. | Clean macOS 15/26 coverage, AU, disk-saved DAW project reload, later-version upgrade/recovery or subjective listening acceptance. |
| Published kit | The recorded v0.1.2 publication uses source `b48a09575477b67e391e6b17476c04ddd90ad08d`, lineage `5d19dfe2aabeeb77a63e83470b8115dbf08c823a`; it predates the latest build/host fixes. Choose the next version from the actual feed when releasing. | Published contents match the newer private candidate. |
| Automation/formats | All eight current Lite sound endpoints declare `automatable: false`; production effect packaging is VST3-only. | Launch automation or AU is complete. |
| Services | Polar is accessible but no Builder Kit product was found; Song Machines still presents another product. Resend has no verified Song Machines sender or prepared templates. | A working Enhance That store, product page or email flow exists. |
| CI | Current kit CI passed. Real local Mac qualification exists; the native workflow's successful contract job did not run its skipped hosted Mac build. | Hosted native-build proof or an automatic release gate. |

Do not reopen completed engineering wholesale. New automation, public naming or packaging changes still require focused regression checks on the final composition.

Evidence starting points: source `docs/BK_HOST_INTEGRATION.md`; `/private/tmp/builder-kit-customer-acceptance.ch1sNY10/RESULTS.md`; `/private/tmp/builder-kit-host-candidate.sh870fvh/candidate-summary.json` and `terminal-handoff.json`; `/Users/winterfell/Library/Application Support/BuilderKitReleases/v0.1.2-20260904-86xvBV/live-verification.json`. At dispatch preserve the relevant sanitized evidence in the launch workspace. Do not copy private delivery URLs, tokens or credentials into Git or public assets. Temporary local paths are not the eventual public handoff.

## 3. Ownership and execution rules

- **Woods:** overall product/readiness owner; creative, copy, customer-facing requirements and independent final customer-journey acceptance. Bring Andrew concrete options or results, not minor settings questionnaires. Coordinate through Bob, not directly over engineering workers.
- **Bob:** the engineering manager, not an implementer or product decision-maker. Existing coordinator: **Bob — Build reliability and AGENTS cleanup**, thread `01a06ded-e922-7b60-83a7-44332a0e3fee`, **GPT-6 Astra/xhigh, standard speed, Full Access**. He sequences assignments, manages dependencies/owners, delegates independent review and repair loops, arranges reviewed integration and release verification, and maintains the queue. He does not write product code, make assets, run the engineering test/build work himself or quietly fix a worker's implementation. Assign those execution activities, including integration operations, to appropriate top-level tasks under his sole coordination. Queue/handoff administration and reading status/review evidence are his own work. Reuse this owner; no competing Bob.
- **Workers:** create real, visible, top-level Codex tasks through the standard **Create Task tool/API**, not hidden subagents, collaboration workers, raw app-server thread creation, CLI subprocess agents or private scripts as substitutes. All workers and reviewers use **GPT-6 Astra, extra high by default, standard speed (Fast off), Full Access**. Bob may choose **Max** for genuinely complex work or **High** for very trivial work; record the reason. This explicitly supersedes older SOL/max or SOL/xhigh worker directions. Record actual thread/link/branch/worktree/scope and verify effective model, effort, speed and permissions before substantive work, not just prompt/UI claims. A restricted or misconfigured shell is not a running owner. First verify Bob, then one no-op top-level child before the real queue; if inheritance fails, stop that launch and report the specific failure without duplicate workaround owners.
- **Andrew:** creative selection, musical/product acceptance, personal account/terms/authentication actions, recruiting people, individual refund/financial decisions, and final publication/campaign approval. Beta testers supply actual external experience.
- Isolated implementation worktrees start from current source, not the older planning lineage. **Never merge this roadmap branch wholesale into source master.** Adopt the approved handoff as a scoped documentation change when integration is authorized.
- One Bob-owned queue; parallelize independent source/assets/reviews. Serialize master mutations, shared generated output, native builds, fixed ports, installed plugins and production deployments. Preserve dirty primary work, other servers, existing plugins and unsaved Ableton sessions. Bob proactively starts newly unblocked work and follows up with stalled owners without waiting for Andrew's reminders. Bring genuine product decisions to Woods, not directly into Andrew's unrelated product conversations.
- Shared live tracker: `/Users/winterfell/src/cosimo-synth/TODOS.txt`. Preparation workspace: `/private/tmp/builder-kit-roadmap.diXKwZ/cosimo-synth`, branch `codex/builder-kit-roadmap-cleanup-20260903`. Its old regular `TODOS.txt` is not the live tracker.
- Every completion needs exact artifact/source, focused proof and remaining human/host gaps. A clean committed engineering handoff precedes integration; a branch, generated mockup or “green” skipped job is not delivery evidence. Report only meaningful milestone changes or genuine decisions to Andrew.

## 4. Six work packets

### L1 — Finish the actual plugin

**Owner:** Bob; Woods verifies product scope; Andrew accepts sound. **Tickets:** BK-05, BK-07, BK-10, BK-12, BK-13 presentation, BK-30.

**Can start:** immediately after dispatch, independent of final branding and commerce. Name checks can proceed alongside code. AU feasibility is bounded work, not a reason to stall VST3.

**Deliver:**

- Apply Enhance That consistently to visible plugin/package names without changing stable identities. Keep the existing readable-name framework fix and stock JUCE.
- Expose the existing eight sound controls to normal host automation: Frequency, Q, Routing, Mid Amount, Side Amount, Character, Intensity and Shape. Preserve ranges, discrete choices and modulation/audio behavior; no new sound-design controls implied.
- Verify automation writes/plays back, state saves/restores, parameter notification and continuous/discrete changes behave safely, and the existing UI, keyboard routing and preset behavior remain intact.
- Resolve the conditional AU path using an appropriate free host when practical. If not viable, record AU deferred and remove AU/Logic claims consistently. Do not silently cut retained macOS scope.
- Freeze the agreed product content for the candidate; fix demonstrated release-blocking regressions, not speculative architecture work.

**Done when:** reviewed changes land through Bob, exact compiled candidate passes focused automation/state/host tests, names and feature inventory agree, and the AU decision is explicit. Build proof is separate from final listening and clean-machine qualification in L3/L6.

### L2 — Make the paid kit useful and the customer path complete

**Owner:** Bob for implementation; Woods for independent customer acceptance. **Tickets:** BK-14, BK-23, BK-40, BK-40A, BK-41, BK-42.

**Can start:** example design, instructions and update/recovery tests immediately. Final composed acceptance depends on L1 and L3's exact candidate.

**Deliver:**

- A real Wavefold modification example, distinct solid-color visual identity, reproducible customer prompt and completed reference branch/tag. The result must work through the shipped kit, not a private maintainer setup. It demonstrates editability; it does not replace the simple build-the-included-plugin first action.
- Concise first-run, optional development, update/recovery and troubleshooting guidance with working copy/paste commands. Reuse delivered short installer, JUCE continuation, optional preview, safe installation and identity facilities; repair only actual gaps. Uncommitted work must be explicitly handled without automatic commit/stash/discard.
- A successful update from a real older supported kit to the candidate while preserving a customer modification, plus a controlled failed-update/recovery proof. A historical version pair alone is not proof for a new release.
- Independent end-to-end run: short command → unchanged included plugin build/install → real DAW use/save/reopen → self-chosen modification → update/recovery. Preserve logs, screenshots and exact versions with secrets removed. Record elapsed friction and whether undocumented maintainer intervention was needed.
- Small support/FAQ and diagnostics package for purchase, download and setup problems. Do not turn it into custom coding support or require customers to read a large manual before trying the product.

**Done when:** the final exported kit can produce the promised result with its actual instructions and tools, the modification reference is reproducible, and success/failure recovery is observed. Source files or synthetic tests alone do not complete the customer journey.

### L3 — Produce and qualify the actual downloadable release

**Owner:** Bob; Woods independently checks customer-facing artifacts; Andrew supplies required Apple access and listening acceptance. **Tickets:** BK-03, BK-04 final-artifact review, BK-15 publication, BK-31, BK-32, BK-33, BK-34.

**Can start:** packaging/qualification preparation and clean-environment planning immediately. Final artifacts depend on L1 and relevant L2 changes.

**Deliver:**

- Properly signed/notarized finished free-plugin downloads and matching versioned Builder Kit export/tool archives. Check the finished distributed plugin's no-JIT requirement; do not ban separate development/JIT tools by conflating them with that binary.
- Actual Apple Silicon macOS 15 and 26 qualification, in retained formats. Use safe available clean environments without maintainer private-repo access. No destructive OS reset, paid host purchase or unverified claim. An unavailable platform is an explicit retained-scope gap, not a pass.
- Real host checks: installation/rescan, Space/text/numeric/drag ownership, automation, preset and disk-saved project recall, editor closed/reopened, normal playback and offline export, plus musical acceptance. Record exact hosts/OS/versions and actual audio evidence where needed; spectra are not listening approval.
- Final shipped-file/dependency/asset inventory and applicable notices matching the actual release. Preserve settled commercial rights; identify any genuinely new incompatible material rather than reopening the whole rights negotiation.
- Release manifest with source, kit lineage, tool pins, versions, hashes, signature/notarization results, qualification evidence, previous-release recovery and known limitations. A publication candidate must not overwrite an existing version or become the customer channel before approval.

**Done when:** the exact downloadable artifacts, not a different checkout, satisfy the retained support claims and customer tests. Public promotion is a later approval-controlled step. Automatic hosted-Mac CI is not required to complete this packet.

### L4 — Build the website, store and delivery experience

**Owner:** Woods for offer/content; Bob for implementation and technical verification; Andrew for required account actions. **Tickets:** BK-50, BK-51, BK-52.

**Can start:** page structure, commerce/delivery and consent implementation immediately with provisional copy. Final creative selection only blocks final appearance/copy. Final downloads depend on L3.

**Deliver:**

- A functioning Enhance That product page on the existing Song Machines site without replacing the unrelated product. Mobile and desktop layouts, honest demos, free-versus-paid explanation, compatibility, price/rights/disclosures, download/purchase calls to action, FAQ and support/refund copy.
- A dedicated Polar product/checkout and reliable free/paid download path using the existing feed architecture; purchase confirmation, recovery/resend, repeat-customer behavior and future-release eligibility. Define and verify the first-50 offer without accidental over-selling or silent price changes.
- Failure checks for interrupted payment/delivery, duplicate callbacks, wrong/expired access, repeat requests and recovery. Test mode first where available. Do not leak feed secrets in page code/logs or treat a working developer URL as proof of customer entitlement delivery. Do not invent revocation guarantees the cohort-feed design does not provide.
- Song Machines sender/domain setup and verified transactional-versus-marketing separation. Marketing opt-in stays optional and unchecked, with functional unsubscribe and consent records. Draft onboarding/follow-up emails with clear trigger, audience, timing and exit behavior; no campaign sending yet.
- A real rehearsal of page → download or purchase → receipt/access → installation → help/recovery, including relevant failure paths. Separately label sandbox proof and any later approved live purchase/refund proof.

**Done when:** a usable review environment exists and the whole flow works; final approved copy/assets/downloads can be promoted without another engineering project. Public switch-on, real financial tests and sends remain approval-gated. Do not claim existing service access means this work is already built.

### L5 — Create branding, demonstrations and the promotion package

**Owner:** Woods; scoped asset contributors may be assigned after dispatch. Bob supplies real builds and technical review. **Tickets:** BK-52A, BK-60, BK-61.

**Can start:** immediately with the selected product names and current real product. Work alongside L1–L4, not after all engineering finishes.

**Deliver in two passes:**

1. **Recruitment pass:** two or three coherent concepts combining visual identity, page layout/brand-and-offer copy, demo angle and press presentation. Recommend one for Andrew to choose. Then produce the showable page, current screenshots, short honest demonstration and compact press sheet needed to recruit more testers. Use clearly labelled provisional/mockup material only where it is not presented as working-product evidence.
2. **Launch pass:** finish the chosen identity and copy, real screenshots and loudness-matched audio examples, approximately 90-second hero demo and longer modification walkthrough, downloadable press kit (description, features, requirements, pricing, rights/support details, images, audio/video and contact), and ready-to-review email/social/pitch copy. Andrew's voice/appearance is a named recording checkpoint if used, not a prerequisite for preparing scripts, captures or edits.

Research current relevant submission/contact paths for outlets such as KVR, Bedroom Producers Blog, Rekkerd and Audio Plugin Guy, plus a focused list of 20–30 suitable smaller creators and appropriate audio-programming communities. Prepare individual pitches and an organic release/follow-up sequence. No fabricated reviews, testimonials or partnerships; customer quotes need permission. No mass sends, paid placements, ads or affiliate commitments.

**Done when:** usable assets and publishable drafts exist, the chosen direction is applied consistently to the actual page/press/demo deliverables, claims match final evidence and remaining approvals are named. A moodboard, mockup or strategy document alone is not completion. Final film is not a prerequisite for recruitment.

### L6 — Run beta, rehearse launch and manage the first customers

**Owner:** Woods for overall readiness/tester operations; Bob for fixes and release operation; Andrew recruits and approves launch. **Tickets:** BK-70, BK-71, BK-72, BK-80, BK-81, BK-82.

**Can start:** beta brief, recruitment kit, feedback/support intake and launch/rollback checklist immediately. Recruitment follows the L4/L5 showable milestone. Formal beta requires the qualified frozen package and actual participants.

**Deliver:**

- Support Andrew's existing five testers with invitation material and a clear brief; recruit toward ten plus two backups. Capture platform/host coverage, install/use/modification tasks and simple outcome reporting without collecting unnecessary private files.
- A seven-full-day beta on a named frozen package: target at least 8/10 successful installs, 6/10 self-chosen modifications and three permissioned customer stories; record support demand and every material failure. These are observed outcomes, not boxes agents can declare completed. If missed, fix/retest or bring a concrete launch tradeoff; do not silently lower the gate.
- Fix beta blockers through Bob and requalify affected surfaces. Material tester-facing changes require a documented retest/freeze decision so launch does not rely on evidence for a different package.
- Rehearse download/checkout/email/install/update/help and publication rollback. Separate code rollback, previous-download restoration, customer communication and protection of purchase/consent records. Provide one launch manifest and go/no-go summary with actual remaining gaps.
- Following Andrew's explicit go: publish the reviewed versions/site/approved messages through the authorized owners, verify the live customer paths, then execute the approved launch follow-up plan. Watch activation and support outcomes, not download count alone.
- First-week response and a sixty-day improvement/release plan using actual customer evidence. Later price/paid-acquisition decisions remain separate approvals; do not switch automatically to $49 or ads.

**Done when:** beta and rehearsal evidence support a go/no-go decision; public launch and subsequent follow-up are separately marked complete only when they happen. Recruitment, a calendar duration or an unapproved campaign cannot be fabricated to finish the queue.

## 5. Sequence and human checkpoints

| Milestone | Required result | What can continue while waiting |
|---|---|---|
| Dispatch | Approved handoff adopted deliberately; Bob verifies current master and actual Astra/effort/standard-speed/Full-Access settings, one no-op child, then real owner launches; shared queue updated. | Andrew has authorized execution. Count only verified real tasks as in flight; dependent work remains explicitly queued. |
| **First delivery: recruitment-ready** | Showable current product, presentable page, real screenshots, short honest demo, compact press sheet and tester brief. | Automation, release qualification, commerce, modification example, final video and email drafts. Andrew can recruit without waiting for the final film. |
| **Beta-ready** | Retained format/platform decision, qualified candidate and kit/tools, functioning customer flows/instructions, frozen manifest and tester roster. | Final media polish/outreach preparation and independent low-risk work. No unverified release claims. |
| **Launch-ready review** | Actual seven-day beta results, reviewed fixes/requalification, finished page/store/assets, rehearsed delivery/recovery and explicit unresolved gaps. | Only affected deliverables wait for creative choice, recordings, account access or listening; unrelated tasks keep moving. |
| **Public launch** | Andrew approves exact publication/claims and actual sends; authorized owners promote and verify the named artifacts. | Post-launch support and approved follow-up begin; spending and individual refunds remain separate decisions. |

The necessary human inputs are creative selection/claims, musical acceptance, recordings if used, recruitment and actual tester participation, personal account authentication/terms, and launch/financial/send approval. Do not add approval chores for minor implementation choices. Do not promise that a fully autonomous run can supply external beta participants, their seven days of use, Andrew's performance or personal account actions.

If an actual account, OS environment or compatibility problem appears, exhaust safe in-scope checks and present the smallest concrete decision with evidence. Do not expand into paid infrastructure or architecture work merely to avoid reporting it. AU has the explicit defer option above; macOS 15/26 does not.

## 6. Coverage and stale-requirement reconciliation

Every historical ticket is either represented above or explicitly retained as completed/deferred:

| Tickets | Disposition |
|---|---|
| BK-00 | This consolidated scope and readiness handoff; execution now authorized, actual dispatch/commit/integration evidence recorded as it occurs. |
| BK-01, BK-02, BK-06 | Settled rights/vendor decisions retained; not new reply/lawyer launch blockers. |
| BK-03, BK-04 | Existing inventory/terms foundation retained; final actual-artifact/notices review in L3. |
| BK-05, BK-07, BK-10, BK-12 | L1: selected name application/checks, product separation/freeze, automation/state. |
| BK-11, BK-20 | Sanitized export and shared toolchain foundation complete; use them, qualify final release in L3. |
| BK-13, BK-13A, BK-13B | Permanent identity/preset isolation/readable-name fixes landed; L1 applies new presentation, preserves behavior. |
| BK-14 | L2 modification reference; feeds L5 demonstration. |
| BK-15 | Feed/tooling foundation complete; exact next release and publication remain L3/L6. |
| BK-21, BK-21A, BK-21B | Setup/JUCE continuation/short installer delivered; L2/L3 validate final composition, no long command rewrite. |
| BK-22, BK-22A, BK-22B, BK-22C | Build/install, Space, safe replacement and optional real preview delivered; L2/L3 retain regression proof. |
| BK-23 | Existing update machinery retained; final successful update and failed-update/recovery proof in L2. |
| BK-24, BK-24A, BK-24B, BK-24C, BK-24D, BK-24E | Build-loop/framework/guidance cleanup delivered; generated width hack dropped. No revived hack, JUCE fork or hosted-Mac pipeline. |
| BK-30 | Conditional AU/free-host proof or explicit defer in L1/L3; Logic is not a blocker. |
| BK-31, BK-32, BK-33, BK-34 | Our finished release signing, exact-artifact qualification, host/audio acceptance and clean supported Macs in L3. Customer publishing tools deferred. |
| BK-40, BK-40A, BK-41, BK-42 | L2 final customer workflow, practical guidance and bounded support. No mandatory copying or auto-opening onboarding page. |
| BK-50, BK-51, BK-52 | L4 real account/product/store/site/email work; connected services are not finished delivery. |
| BK-52A, BK-60, BK-61 | L5 complete creative options, actual demo/assets and researched outreach drafts, not only final copy. |
| BK-70, BK-71, BK-72 | L6 recruitment, real beta and fixes; five testers currently, assets first, no fictitious elapsed beta. |
| BK-80, BK-81, BK-82 | L6 rehearsal/approved launch, first-customer follow-up and evidence-led later price/scale decision. |

Old automatic onboarding pages, customer publishing tools, mandatory Logic, unconditional AU, fixed refund/support deadlines, custom signed-bundle delivery, unresolved-rights calendar stops and paid/hosted release infrastructure are not hidden extra work. Where a retained requirement is not proven, keep it open rather than converting “planned,” “built,” “tested locally” or “privately staged” into “launched.”
