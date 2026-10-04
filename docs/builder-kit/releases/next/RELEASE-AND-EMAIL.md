# Publishing the next Builder Kit update

Candidate version: **0.2.0**, committed and qualified; not published. [Final preparation](FINAL-PREPARATION-2026-10-04.md) records the revised control docs, final customer/native checks, and frozen launch assets. The component branch is integrated into `codex/builder-kit-020-candidate`. [The October 4 qualification](QUALIFICATION-2026-10-04.md) records the exact source, customer installation/update/native results, and implemented email sender.

## The shortest complete release path

1. **Done:** integrate the component/state source into the isolated release candidate. Existing customer Git history is preserved.
2. **Done:** construct a staged 0.2.0 candidate through the existing release command with freshly rebuilt, hash-verified tools from the committed Cmajor pin. Current export/archive privacy scans passed.
3. **Done:** install over HTTP as an independent customer; qualify the example, browser controls, native build, and pluginval; update actual 0.1.5 with a real customer plug-in present. Customer work survived unchanged; a deliberate mixed edit stopped as a conflict.
4. **Remaining:** review and publish the qualified release at its production destination, publish its stable changelog, deploy the reviewed email callback integration, verify one authorized operator delivery, then send the approved owner notice and social announcement. Candidate staging URLs are temporary loopback URLs, not publication.

## Changelog

`kit/CHANGELOG.md` is the customer changelog; it ships through the existing kit export. The exported README now links it. Keep new entries under **Unreleased** while work is in progress. When the release is qualified, move those entries under the actual version/date.

Use the same reviewed entries for the public release page. [WRITEUP.md](WRITEUP.md) supplies the full launch narrative and code examples. [SOCIAL.md](SOCIAL.md) is the shorter public copy. Do not maintain conflicting independent accounts of what shipped.

Each version's entry also carries **Update instructions** and a copyable release-specific prompt. State required compatibility changes, optional adoption and relevant documentation there. The email supplies the target version and points to that section; `kit-update` reads the changelog from the fetched release before merging, including applicable skipped-release instructions. Keep the general update procedure in the skill instead of repeating it in every release entry.

## Email: reuse the store's existing sender

The store already records purchases and email deliveries, and sends customer access mail through **Resend**. A new email provider, newsletter system, or always-running worker is unnecessary for the first release notice.

What already exists:

- Paid/entitled order records, purchase email addresses, and access recovery.
- A durable email delivery record, stable provider idempotency key, and a Resend sender.
- A separate optional marketing topic and draft template. Its mixed customer/subscriber segment is not a release-delivery recipient list.

Implemented and tested on store branch `codex/builder-kit-release-email-318e`, commit `8aab1b5`:

1. A frozen release payload containing the version, sender, subject, HTML, plain text, and stable links. The Resend adapter sends both styled HTML and plain text.
2. `npm run email:release` with plan, enqueue, send, status, retry, and reconciliation actions over the existing SQLite/Blob purchase ledger. It deduplicates by **product + version + normalized recipient email**, includes guest purchase addresses and supported gifted/refunded lifetime access, and rechecks eligibility before sending.
3. Durable delivery records, persisted claims across operators, identical retry payloads/keys, and held reconciliation for unresolved attempts past the safe provider window. Accepted deliveries remain deduplicated after restart and beyond that window.
4. Verified signed customer delivery callbacks, including lost acknowledgements and bounce/complaint suppression without removing access. Register the existing endpoint's delivery events after the reviewed code is deployed; no registration was performed here.

The store's `docs/RELEASE-EMAIL.md` contains exact operator instructions. All **115 store tests**, including **16 release-email tests**, static validation, and the deployment build pass. No provider or inbox acceptance is claimed from fixtures.

No automatic release polling is needed. Sending should follow a verified publication, using its frozen changelog and links. A later release job can invoke the same operation.

## What kind of email this is

Keep this first email a factual notice delivering an update the recipient already owns: what is included, where its notes are, how to update, and how to get support. Keep upsells, invitations to buy, and the social sales pitch out of it.

The US rule expressly includes entitled product updates/upgrades in transactional/relationship delivery. The subject and primary content still matter; an existing purchase alone does not make every email transactional. UK guidance likewise distinguishes routine service communications from promotion. [16 CFR 316.3](https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-316/section-316.3), [FTC guidance](https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business), [ICO guidance](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/direct-marketing-and-regulatory-communications/).

This implementation does not build a new preference center for the factual delivery notice. If the email becomes an optional promotional newsletter, use the existing marketing consent/topic and unsubscribe handling. Do not treat the word “product update” as a blanket exemption across jurisdictions.

Provider retry behavior: [Resend idempotency documentation](https://resend.com/docs/dashboard/emails/idempotency-keys).

## Template and release-day review

[EMAIL.html](EMAIL.html) is the styled template; [EMAIL.txt](EMAIL.txt) is its text equivalent. They use the store's existing dark palette and lime accent. Variables:

| Variable | Supply at send time |
|---|---|
| `version` | Exact published Builder Kit version. |
| `release_notes_url` | Verified stable public page for that release. No page has been published by this audit. |
| `access_url` | Stable existing access-recovery page; no personal access token in the template. |

Escape substituted values and validate link destinations. Fail before enqueueing if placeholders remain. Review the rendered email and recipient count, then send a test to the operator before the approved customer batch.

The proposed update prompt uses the already bundled `kit-update` skill. Verify it against the oldest supported customer feed before telling all customers to use it. Updating kit files and migrating an existing plugin to the new API are different actions; the email states that plainly.

No recipients were exported, emails sent, contacts changed, or social posts published during this audit.
