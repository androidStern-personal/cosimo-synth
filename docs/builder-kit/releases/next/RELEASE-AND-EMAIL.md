# Publishing the next Builder Kit update

Recommended version: **0.2.0**. This is a proposal, not a version bump or a published release. Clear [the release blockers](AUDIT.md) first.

## The shortest complete release path

1. Resolve the historical personal-identifier issue without breaking customer Git updates. Keep the current clean export boundary; inspect history and final archives too.
2. Stamp one version and one published Cmajor pin. Use the existing release command to construct a staged candidate with verified tools; do not assemble ad hoc downloads.
3. Install that candidate as a customer, build its unchanged example, and verify its packaged browser/audio path. Identify which download/update URLs were actually given to customers, then update from those installations with a local plugin edit present. Older live URLs alone do not prove customer impact. The existing release guards remain enabled.
4. Publish the release and make it discoverable to existing owners. Publish the changelog at a stable public URL, then send its factual delivery notice and make the social announcement.

## Changelog

`kit/CHANGELOG.md` is the customer changelog; it ships through the existing kit export. The exported README now links it. Keep new entries under **Unreleased** while work is in progress. When the release is qualified, move those entries under the actual version/date.

Use the same reviewed entries for the public release page. [WRITEUP.md](WRITEUP.md) supplies the full launch narrative and code examples. [SOCIAL.md](SOCIAL.md) is the shorter public copy. Do not maintain conflicting independent accounts of what shipped.

## Email: reuse the store's existing sender

The store already records purchases and email deliveries, and sends customer access mail through **Resend**. A new email provider, newsletter system, or always-running worker is unnecessary for the first release notice.

What already exists:

- Paid/entitled order records, purchase email addresses, and access recovery.
- A durable email delivery record, stable provider idempotency key, and a Resend sender.
- A separate optional marketing topic and draft template. Its mixed customer/subscriber segment is not a release-delivery recipient list.

What must be added before sending:

1. A `release-update` email type and one reviewed release payload containing the version, subject, HTML, plain text, and stable public links. The existing Resend adapter currently sends text only; extend it to send both `html` and `text` so the styled template actually reaches the recipient.
2. A small operator-run enqueue/send command using the existing sender. First show a dry-run recipient count and exclusions; then queue one message per **product + version + normalized recipient email**. Use the purchase email when a guest customer record has no email. Existing entitlement policy, including supported gifted/refunded access, determines eligibility.
3. Durable sent/failed records and an explicit retry command. Resend's idempotency keys expire after 24 hours; our ledger must prevent duplicate sends across later retries, and ambiguous older delivery outcomes need reconciliation rather than blind resending.
4. Delivery-failure/complaint handling for these customer emails. The existing Resend webhook code handles marketing deliveries; connect the customer provider IDs too and register the store endpoint. Suppress known undeliverable or complained-about recipients without removing their product access.

No automatic release polling is needed. Sending should follow a verified publication, using its frozen changelog and links. A later release job can invoke the same operation.

## What kind of email this is

Keep this first email a factual notice delivering an update the recipient already owns: what is included, where its notes are, how to update, and how to get support. Keep upsells, invitations to buy, and the social sales pitch out of it.

The US rule expressly includes entitled product updates/upgrades in transactional/relationship delivery. The subject and primary content still matter; an existing purchase alone does not make every email transactional. UK guidance likewise distinguishes routine service communications from promotion. [16 CFR 316.3](https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-316/section-316.3), [FTC guidance](https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business), [ICO guidance](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/direct-marketing-and-regulatory-communications/).

This proposal does not build a new preference center for the factual delivery notice. If the email becomes an optional promotional newsletter, use the existing marketing consent/topic and unsubscribe handling. Do not treat the word “product update” as a blanket exemption across jurisdictions.

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
