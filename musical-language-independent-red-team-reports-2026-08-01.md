# Independent Red-Team Review Reports

Assembled on 2026-08-01 from four blind, independent Codex tasks running `gpt-5.6-sol` at `max` reasoning.

The reports below are reproduced verbatim under Agent 1–4 labels. They have not been reconciled, deduplicated, summarized, or edited.

## Agent 1 Report

- Codex thread: `019fbfc2-5653-7123-946b-4e2b65e5db2b`
- Original report SHA-256: `eac5e1d93b05f5d562b078a6a09bf9b21fb11ee676d3a1f19146018bdb8794a2`

<!-- BEGIN AGENT 1 REPORT -->

# Independent Reviewer 1 — red-team audit of the musical-language sample

Audit date: 2026-08-01  
Assigned worktree: `/Users/winterfell/.codex/worktrees/f4fee81b-9405-4dfe-b357-35ae5f0049d6/future-daw`  
Read-only source root: `/Users/winterfell/src/future-daw/artifacts/musical-language-sample`  
Named prior-script root: `/private/tmp/claude-502/-Users-winterfell-src-future-daw/4733c949-576d-4b86-b794-96cd4a024683/scratchpad`

I completed the MIDI and language reimplementations before opening the named prior-review scripts. No source artifact or named prior script was modified. The audited spec/encoding SHA-256 values were:

- `core-spec-v0.md`: `3266b0ff6c4fad0ec98cf2f9952ef6c71887ee5b53ad9a0ce014323c3d259459`
- Fixture A `encoding.mus`: `4712a15f8bdea8281940d8fb969af4a7f511d9f5f418f8c97918fec29b6d3d65`
- Fixture B `encoding.mus`: `47da6f896bc34897b1203859ee47fb63859badc7a07838793b47294845e2690c`
- Fixture C `C_synthetic.mus`: `0f164e972fce755f084a88657add5b0846da0bd19c4ddac6ef45455cb7e7e101`
- Fixture C `C_expected.csv`: `c9216905878c28efa77de6e8898e0d438ce6c93079ccc0f99cd60a898a07fa17`

Supporting independent code and compact computed evidence are in `audit-review1/`. `interpretation-log.md` records every material choice that the spec did not determine.

## Confirmed defects

### 1. v0.2's register rule contradicts Fixture A's normative cadence

**Claim attacked:** C3 (internal consistency) and C4 (Fixture A evaluates to 531 under the written semantics).  
**Severity:** major  
**Confidence:** high

`core-spec-v0.md:55` makes a block `registerSpec` the default for row formulas. Amendment 9.1(4), at `core-spec-v0.md:309-312`, expressly says to voice a pitch-producing leaf, including a **literal**, through the governing register before arithmetic.

Fixture A's `BassCellV` declares `range G1..G2 voice highest floor repeat-root` at `fixtures/A_iwthyh_bars08-19/encoding.mus:20-25`. Its last per-occurrence patch then adds literal `G1` rows at lines 145-147. Under the written rule, the highest in-range representative of pitch class G in G1..G2 is G2, so all three literals become G2. The normative answer key requires G1 at `expected/03_Bass.csv:43-45`.

My evaluator produced:

- literal v0.2 rule: **528/531**, with three missing G1 and three extra G2 at fixture bar 12 beats 1, 2.5, and 3;
- undocumented “octave-bearing literals bypass register” rule: **531/531**.

The fixture can win by the precedence declaration at `core-spec-v0.md:4-5`, but then it silently changes a general amendment rather than exemplifying it. The prose and normative fixture are not internally consistent.

### 2. v0.2's omitted-`at` rule collapses Fixture C's order-only stream

**Claim attacked:** C3 and C4 (Fixture C evaluates to 12/12 under the written semantics).  
**Severity:** major  
**Confidence:** high

Amendment 9.1(7), `core-spec-v0.md:319-321`, states: “Omitted `at` = the parent's origin … order-index 1.” Fixture C's order-only `Prog` contains three rows with no `at` at `fixtures/C_synthetic.mus:6-7`: `play C   play F   play G`.

Applying the amendment puts C, F, and G at order-index 1. With `each 1 bar`, the three `Cell` copies therefore overlap at bar 1 instead of occupying bars 1, 2, and 3 as `C_expected.csv:2-9` requires. My literal-rule run still emitted 12 raw events, but only **7/12** matched: all four swung-key events and three of eight lead events. There were five missing and five extra lead events.

Assigning successive implicit indices by written row order gives **12/12**, but that is the opposite of the explicit v0.2 rule. The preserved parser makes exactly this repair by enumerating rows in `muslang.py:556-563` rather than honoring their parsed default position.

### 3. None of the fixture files is a complete `Document` under the normalized model

**Claim attacked:** C3 and C4; specifically, that an implementation can evaluate a fixture from the specified document/surface model alone.  
**Severity:** major  
**Confidence:** high

The normalized `Document` requires both `root` and `formatVersion` at `core-spec-v0.md:48-49`. The surface syntax supplies no spelling for either field, and A, B, and C contain neither. No root-selection or format-version default appears in the supposedly exhaustive defaults at `core-spec-v0.md:319-321`. L7 prohibits silent defaults at lines 36-39.

Both independent and preserved evaluators therefore need out-of-band entry points. My harness must be invoked with `FixtureA`, `FixtureB`, or `FixtureC`; preserved `run.py:102`, `:108`, and `:114` likewise passes those names manually. “Choose the block whose name resembles the filename” is plausible, but it is not specified and cannot satisfy the stated same-document determinism claim.

### 4. Several fixture-critical operations are absent or inconsistent in the model/grammar

**Claim attacked:** C3 and T1's requirement that semantics be implementable from the document alone.  
**Severity:** major  
**Confidence:** high

The following were material implementation choices, not editorial niceties:

1. The normalized `Def` at `core-spec-v0.md:90-93` has no `registerSpec`, while A defines one at `encoding.mus:18` and amendment 9.1(4) refers to “a def's own registerSpec” at `core-spec-v0.md:311-312`.
2. The Formula grammar at `core-spec-v0.md:95-108` does not include calling a def. A calls `compRoot(...)` throughout `encoding.mus:29-36`; C calls `color(H, K)` at `C_synthetic.mus:16`.
3. Chord construction, pitch spelling, key construction, and `.degree(K)` are named but not fully defined. I had to choose conventional 12-TET MIDI pitches, major bare triads, `m` minor triads, `7` dominant seventh, and a diatonic C-major scale. These choices determine A/C pitches.
4. A's driving chord spans depend on the omitted-event-duration default at `core-spec-v0.md:203-206`, but that default is explicitly marked `[O — under review]`. Without it, `per` truncation cannot be computed.
5. `each <span>` gets a spelling at `core-spec-v0.md:331-332` but no full mapping from order rows to realized positions/spans. Fixture C needs the unstated sequential mapping that conflicts with Finding 2.
6. Transforms are author-time operations whose stored results should be rows (`core-spec-v0.md:15-16`, `:120-125`), but C contains an unevaluated `block SwungRiff = swing(...)` expression. Because fixtures are called “authoring-form” at lines 197-201, I chose parse-time materialization; the conversion contract is not specified.
7. B's “events asserting at” the end does not define an algorithmic threshold. I used the README's stated consequence and the ±0.1 comparison: expected physical positions ≥47.9 beats can assert at the 48-beat edge.

These choices are logged in `audit-review1/interpretation-log.md`. Two alter results (Findings 1 and 2); the others happened to reproduce the keys but remain conformance gaps.

### 5. Billie Jean S7 describes six hiccups but counts nine

**Claim attacked:** C2 (the coverage tally is arithmetically true at the sentence-to-note level).  
**Severity:** major  
**Confidence:** high

`02_billie_jean_description.md:76-79` describes the three-note F#3–G#3–F#3 hiccup at beat 4 of one bar and beat 2 of the following bar, says the cell occurs “six times verbatim,” and claims 27 covered notes.

The cited CSV contains **three**, not two, hiccups per bar pair:

- bars 21–22: CSV lines 28-36 — bar 21 beat ~4, bar 22 beat ~2, and bar 22 beat ~4;
- bars 25–26: lines 43-51 — the same three positions;
- bars 33–34: lines 80-88 — the same three positions.

That is nine hiccups × three notes = 27. The stated six occurrences account for only 18 notes; nine notes at the second bar's beat-4 statements are not described. The track/window totals are correct, but assigning all 27 to S7 is false under the document's own “every sentence points at the notes it accounts for” method (`02_billie_jean_description.md:3-6`).

### 6. Billie Jean's 4.99 events are misclassified as and-of-4 anticipations

**Claim attacked:** C2 (musical statements match the data) and the language-design conclusions derived from them.  
**Severity:** major  
**Confidence:** high

The analysis says pervasive positions such as 4.99 are grid softness read at their intended grid position (`02_billie_jean_description.md:8-10`), but then calls 4.99 an anticipation “onto the previous and-of-4” in S1 at lines 45-48 and calls the polysynth's corresponding event an “and-of-4” hit in S4 at lines 58-64. In 4/4, the and-of-4 is beat 4.5. Beat 4.99 is 0.01 beat before the **next downbeat** and 0.49 beat after the and-of-4.

The fixture itself confirms the downbeat interpretation: `B_billiejean_bars05-16/encoding.mus:3-7` says GT bar-4 4.99 events supply fixture bar 1's downbeat, and its README lines 5-9 treats the analogous end events as window-edge assertions. Computed bars 3–56 contain beat ≥4.9 events in bass (20), polysynth (54), muted guitar (12), and drums (135).

The polysynth count gives a second contradiction. Its active ranges contain 216 notes clustered into 72 three-note chords across 36 bars: **2 unique chord hits per active bar**, not S4's “three staccato chord hits per bar.” The third described hit is the following bar's first hit shifted 0.01 beat early, not an additional and-of-4 chord. This error propagates into vocabulary claims about rhythmic displacement and systemic anticipation at `02_billie_jean_description.md:150-153`.

### 7. The preserved verification evidence does not establish the claimed two literal-semantic machine verifications

**Claim attacked:** C5 and the claims at `core-spec-v0.md:295-298` and `:397-404`.  
**Severity:** major  
**Confidence:** high about what the files do; medium about unpreserved historical activity

The scripts break down as follows:

| Script | Generation source | Answer-key access | What it actually establishes |
|---|---|---|---|
| `evalA.py` | Hand-coded constants; never opens A `encoding.mus` | `load()` at lines 280-285, after generation | Current run: 516 produced, only 456 or 457 of 531 matched. It is stale and not a current verifier. |
| `evalB.py` | Hand-coded constants; never opens B `encoding.mus` | `load()` at lines 43-48 | Explores older push/merge policies. Best displayed run matched 365 with three produced edge extras; not the v0.2 README scorer. |
| `gtr_detail.py` | Imports `evalA` at lines 3-6 | Calls its expected loader at lines 8-12 | Diagnostic only. |
| `simA.py` | Hand-coded constants despite being presented as a simulation of the encoding | Opens expected at lines 132-134 | Reports zero mismatches, but can drift or be tuned independently of the program. Its literal G1 cadence at lines 71-74 silently bypasses v0.2 register semantics. |
| `simB.py` | Hand-coded constants; comment “produce from encoding.mus” at line 11 is not true operationally | Opens expected at lines 37-43 | Exposes three entry extras and six exit misses; no v0.2 positional scorer. |
| `check.py` | No generation | Reads answer keys only | Counts/data diagnostic, not conformance. |
| `muslang.py` | Real parser/evaluator; `run.py:28-34` reads the `.mus` source | None in generator | Strongest non-circular generator, but `muslang.py:459` exempts literal pitches from register voicing and `:556-563` assigns sequential order-only positions—the two fixture-compatible repairs in Findings 1 and 2. |
| `run.py` | Uses `muslang.py` | Loads expected at lines 15-25, after generation | A reports 531/531. B reports 365 matched, 6 missing, 3 spurious before manually applying the new edge rule. C prints 12 events but never opens or compares `C_expected.csv`. |

There is no runtime path in which an answer key directly feeds `muslang.py` generation, so I did **not** confirm classic circular data leakage. The defect is evidentiary overstatement: the preserved files show one real encoding parser with fixture-friendly semantic exceptions, hard-coded simulations, and no machine comparison of C's answer key. They do not substantiate “both reviewers independently machine-verified … C 12/12” under literal v0.2 semantics.

### 8. IWTHYH's bridge form arithmetic is internally inconsistent

**Claim attacked:** C2.  
**Severity:** minor  
**Confidence:** high

The form map calls bars 32–42 an 11-bar unit made from an “8-bar bridge + elided 2-bar intro-recap” at `01_iwthyh_description.md:141-146`. Eight plus two is ten. The detailed account and data reveal the missing bar:

- B2 claims six rhythm-guitar onsets per bridge bar and covers 54 notes (`:158-160`), which is nine bars;
- the CSV has exactly 54 rhythm-guitar rows in bars 32–40;
- B6 identifies the final D as bars 39–40 and the recap as bars 41–42 (`:171-175`).

The data support a nine-bar 32–40 bridge plus a two-bar 41–42 recap = 11 bars. Calling the first component eight bars is the defect.

### 9. IWTHYH's Part 1 tally and its erratum disagree

**Claim attacked:** C2's complete-coverage claim.  
**Severity:** minor  
**Confidence:** high

The Part 1 table at `01_iwthyh_description.md:97-111` says 629 total, 628 covered, and one A1 leftover. The later erratum at lines 206-211 correctly observes that the F3 grace repeats at bars 16, 28, 51, 74, and 78 and says the unexplained count drops to zero.

The recurrence is real—I found exactly one F3 at beat 1 in each listed bar—but the document never adds it to a numbered sentence or updates S1/S2/table arithmetic. As a single final artifact it simultaneously claims one leftover and zero, and its numbered sentences still sum to 628.

### 10. The v0.2 amendments claim repairs that were not integrated into the file

**Claim attacked:** C3 and §9's changelog accuracy.  
**Severity:** minor  
**Confidence:** high

Examples:

- `core-spec-v0.md:357-358` says §7's Fixture-A key-port claim was corrected, but §7 still lists “routes, key port” for A at line 242. A declares no key port; C does.
- §7 says C's expected table is inline at line 247, while §9.6 correctly says it moved to `C_expected.csv` at lines 351-354.
- The file title remains “v0.1” at line 1 and the old verification status says wave-2 re-audit is pending at lines 249-250, while §9 and the changelog call it v0.2 and twice verified.
- Lines 320-321 say “§9 lists every default,” but §6 still supplies other defaults/conventions at lines 201-206, including bare metric positions and the open event-extent rule.

Amendment precedence lets a reader choose the later statement, but these false cross-references and stale status labels make the supposedly consolidated spec materially harder to audit.

### 11. Eight raw MIDI track names are silently normalized

**Claim attacked:** C1's exact track-metadata fidelity.  
**Severity:** cosmetic  
**Confidence:** high

The IWTHYH MIDI contains padded names such as `"Gesang  "`, `"Bass    "`, `"Gitarre "`, and five padded drum names. `summary.json` removes the trailing spaces. The author's parser does so explicitly with `.strip()` at `midiparse.py:52-53`.

No note data, routing, program, or human-visible name content changes. This is the only discrepancy in independently regenerated summary values, but “byte-faithful track metadata” would need to disclose the normalization.

## Attacks attempted that failed

### A. Ground-truth MIDI extraction survived a full independent byte-level reparse

I wrote `audit-review1/midi_audit.py` from raw SMF bytes without importing the author's parser. It handles MIDI chunks, VLQs, running status, meta events, programs, note-on velocity zero, FIFO overlapping note pairing, meter changes, and deterministic CSV rendering.

Across all five files it parsed **26,444 note-ons** and regenerated all **51 CSV files byte-for-byte**, including CRLF, row ordering, rounded bar/beat/duration values, pitch names, velocities, and channels:

| Song | Parsed notes | CSV rows |
|---|---:|---:|
| IWTHYH | 3,114 | 3,114 |
| Billie Jean | 6,183 | 6,183 |
| Smooth Operator | 7,586 | 7,586 |
| Smells Like Teen Spirit | 5,858 | 5,858 |
| Genie in a Bottle | 3,703 | 3,703 |

Tempo maps, time signatures (including Nirvana's 1/4 pickup then 4/4), key-signature events, programs, channels, pitch ranges, note counts, and bar spans also matched. There were 537 overlapping same-pitch note-ons; FIFO matched every row. A LIFO counterfactual caused 64+64 mismatches in Sade and 110+110 in Nirvana, strengthening the pairing result. All MIDI MD5s equal the README's Lakh MD5s. Finding 11 is the sole metadata exception.

### B. The fixture answer keys are genuine, unmodified extracts

`audit-review1/fixture_data_audit.py` reconstructed each expected file by retaining the ground-truth header and only rows in the declared inclusive bar range. Results:

- A: all 8 expected files byte-identical; 531 expected = all 531 ground-truth rows in bars 8–19. Crash and Toms have zero rows there.
- B: all 4 expected files byte-identical; 371 expected = all 371 ground-truth rows in bars 5–16. Every omitted track has zero rows there. The drum key contains exactly the four documented lanes and no hidden pitches.

This defeats the answer-key tampering and omitted-in-window-track attacks.

### C. The intended fixture behavior is reproducible without answer-key-fed generation

`audit-review1/muslang_independent.py` contains no CSV, ground-truth, or answer-key read. `score_independent.py` is a separate comparison layer. Under the two fixture-compatible interpretations identified in Findings 1 and 2, the results are:

- A: **531/531**;
- B: **364/364 asserted** after exactly the documented exemptions (368 produced, 371 expected; 4 produced and 7 expected exempt, including the deliberately sacrificed bass match);
- C: **12/12**.

Thus the encodings are not random or grossly fabricated. They form a coherent intended system. The failure is that two intentions contradict the published v0.2 rules.

### D. The prose window totals themselves are arithmetically correct

Independent CSV counts reproduce every headline/per-track window total:

- IWTHYH bars 3–19: 629;
- IWTHYH bars 32–42: 362;
- IWTHYH bars 74–82: 368;
- Billie Jean bars 3–56: 2,093.

The IWTHYH F3 grace recurrence is also exactly as its erratum claims. The confirmed C2 failures are sentence-to-note attribution and musical interpretation, not invented row totals.

### E. I found no direct answer-key leakage into event generation

In every named script that both generates and compares, answer keys are opened in a later comparison phase. `muslang.py` never opens them at all. The hard-coded simulators are easy to tune and do not prove faithful parsing, but they do not directly copy expected rows at runtime. A classic “load the answer key and emit it” attack failed.

### F. I found no compelling code-copy signature between the review rounds

After removing comments/whitespace, token-sequence similarity was 0.231 for `evalA.py`↔`simA.py`, 0.207 for `evalB.py`↔`simB.py`, and 0.079 for `evalA.py`↔`muslang.py`. The round-2 parser architecture is substantially different, and shared note/chord tables are compelled by the same fixtures. This does not prove blindness, but the code itself did not support an accusation of straightforward copying.

### G. B's boundary discrepancies are disclosed rather than hidden

Without edge exemptions, independent comparison gives 365 matches, six expected exit events missing, and three produced entry events extra. The v0.2 README names those six and three, and additionally sacrifices the genuine first-position bass match to keep the rule positional/symmetric. Applying the written consequence yields equal asserted sets of 364. I disagree with calling 4.99 an and-of-4 in the analysis (Finding 6), but the fixture's boundary accounting is honest and executable.

## Could not verify

### 1. Historical blindness and absence of tuning

Filesystem contents cannot prove that prior agents were blind, never saw one another's work, or did not revise hard-coded constants after inspecting mismatches. Low code similarity and separated runtime data flow are favorable evidence, not proof. Confidence in the claim “two blind reviewers” therefore remains limited.

### 2. Non-cherry-picking intent beyond the declared windows

The within-window completeness claims are true, but intent is not recoverable. A's adjacent bars 7 and 20 contain 37 and 40 events; B's adjacent bar 17 introduces melody (6), bass (8), polysynth (5), and drums (19). B ends immediately before the melody enters, so it is undeniably a simpler window. That is also consistent with its stated “groove build/layering” purpose. No whole-song conformance claim or selection protocol exists from which to decide whether the boundary is illegitimate cherry-picking.

### 3. Record/literature divergence claims

The local inputs contain no copies or precise bibliographic citations for the Pollack, Hein, Krerowicz, American Songwriter, Hooktheory, or recording claims. Under the isolation rules I audited the MIDI/CSV assertions, not the external audio and publications. D1–D7 and equivalent Billie Jean literature claims remain unverified.

### 4. Unexercised language areas

The fixtures do not falsify receipts, durable identities, serialization, velocity, asserted duration, articulation, feel (the ±0.1 tolerance is larger than C's 1/24-style feel example), container typing, key/note stream consumption, or most reach/error behavior. The spec itself acknowledges several of these gaps at `core-spec-v0.md:272-279` and `:360-378`. Nothing in the successful note comparisons verifies them.

### 5. Corpus provenance beyond hash identity

All five file MD5s match README values, but the on-disk material alone cannot establish the files' upstream Lakh history, licensing chain, or transcription authorship.

## Overall integrity verdict

The body of work is **not fully what its v0.2 verification claims say it is**. Its data foundation is excellent: all 26,444 MIDI notes re-derived cleanly, all 51 CSVs are byte-reproducible, and both song-derived answer-key sets are exact and complete in their declared windows. The intended fixture encodings are also substantive: with two fixture-friendly interpretations, an independent evaluator reproduces A, B, and C exactly under their scoring policies.

The language artifact itself fails the stronger claim. Literal v0.2 semantics make A 528/531 and C 7/12; the document lacks a self-contained root/version path and leaves other fixture-critical behavior undefined. The prose analyses have correct headline counts but at least two material Billie Jean interpretation/coverage errors and two smaller IWTHYH consistency errors. The preserved scripts show non-circular generation in the strongest harness, but they do not establish two blind, literal-semantic machine verifications.

| Claim | Verdict |
|---|---|
| C1 — ground-truth fidelity | **Pass**, with cosmetic trailing-space normalization only |
| C2 — analysis coverage/statements | **Fail** |
| C3 — spec internal consistency/completeness | **Fail** |
| C4 — fixtures under written v0.2 semantics | **Fail**; **pass only under two fixture-overrides** |
| C5 — prior verification non-circularity | **No direct leakage found**, but independence/tuning and “twice verified” are not established |
| C6 — answer-key extracts/completeness | **Pass** for exact extraction and in-window track completeness; selection intent unverified |

Overall: **high-integrity source data and fixture answer keys; credible intended language experiment; not yet an internally consistent or adequately substantiated v0.2 conformance specification.**

<!-- END AGENT 1 REPORT -->

## Agent 2 Report

- Codex thread: `019fbfc2-869a-75a0-b3d5-0edf73d770b1`
- Original report SHA-256: `135541af2c5e55a6252ef8d593b124b17a8abbe2546f6e44043e12936f7a6d51`

<!-- BEGIN AGENT 2 REPORT -->

# Independent Reviewer 2 — red-team audit

Date: 2026-08-01  
Assigned worktree (recorded before work): `/Users/winterfell/.codex/worktrees/25147e3b-4779-45fe-a0a3-7694bae199f5/future-daw`  
Source root, read-only: `/Users/winterfell/src/future-daw/artifacts/musical-language-sample` (`SRC` below)  
Prior-script root, read-only: `/private/tmp/claude-502/-Users-winterfell-src-future-daw/4733c949-576d-4b86-b794-96cd4a024683/scratchpad` (`PRIOR` below)

Path aliases used in citations: `SPEC = SRC/language-lab/spec`; `A = SPEC/fixtures/A_iwthyh_bars08-19`; `B = SPEC/fixtures/B_billiejean_bars05-16`; `AUDIT = <assigned-worktree>/audit-review2`. Bare analysis filenames are relative to `SRC/language-lab`; bare `core-spec-v0.md` is `SPEC/core-spec-v0.md`; bare C fixture filenames are relative to `SPEC/fixtures`; bare audit-output filenames are relative to `AUDIT` or the immediately named audit subdirectory.

I inspected only the source material and prior-review scripts authorized in the task. I wrote all new programs and outputs under `audit-review2/` in the assigned worktree. I did not inspect another Codex reviewer, task, transcript, report, or scratch area.

## Executive result

| Claim | Result |
|---|---|
| C1 — MIDI extraction fidelity | **Passed, with a duration-pairing qualification.** A fresh parser reproduced all 51 CSVs / 26,444 rows byte-for-byte and all five summaries semantically. Two later songs contain overlapping same-pitch notes whose duration pairing is not uniquely encoded in MIDI. |
| C2 — analysis coverage and musical accuracy | **Failed in substance.** The headline window totals are arithmetically correct, but several sentences are demonstrably false or do not describe all notes they claim to cover. |
| C3 — internal specification consistency | **Failed.** Required document facts and executable semantics are absent, and explicit normative rules conflict with fixtures A and C. |
| C4 — fixture conformance | **Failed under the written specification.** A scores 528/531 under the explicit register rule; C scores 7/12 under the explicit omitted-`at` rule; B scores 364/370 under the literal positional edge rule. Fixture-friendly exceptions produce A 531/531, B 364/364 asserted events, and C 12/12. |
| C5 — non-circular prior verification | **No direct answer-key leakage found, but the verification-status claim is false/unsupported.** Most early scripts hard-code a second transcription rather than parse `encoding.mus`; the actual parser passes A by violating a normative rule, reports B as failed, and never compares C to its answer key. |
| C6 — answer-key extraction and window completeness | **Extraction passed.** A's 531 and B's 371 rows are byte-identical ground-truth filters, and no omitted track has an event inside either window. Whether the favorable windows were intentionally cherry-picked cannot be proved from the artifacts. |

Severity means impact on the attacked claim, not on the underlying MIDI corpus. “Fatal” means the claimed independent conformance test is not defined by the document alone.

## Confirmed defects

### 1. The language document does not define a self-contained executable program

**Claim attacked:** C3 and C4; also Law L5's “same document → same events, bit-for-bit.”  
**Severity:** **fatal** to independent conformance under the written specification.  
**Confidence:** **high**.

The normalized `Document` requires `root`, and every `Block` requires `emit` (`SRC/language-lab/spec/core-spec-v0.md:48-56`). The surface syntax supplies no root declaration, no default root, and no meter/time-signature declaration (`core-spec-v0.md:195-216`). Nevertheless:

- A externally needs `FixtureA` as root and omits `emit` on `Verse`, `Refrain`, and `FixtureA` (`A/encoding.mus:100`, `:143`, `:175`).
- B externally needs `FixtureB` and omits its `emit` (`B/encoding.mus:56`).
- C externally needs `FixtureC` and omits its `emit` (`C_synthetic.mus:27`).
- All programs use bars and beats, but neither the model nor any program says how many beats a bar contains. Every available evaluator silently assumes 4/4; for example `PRIOR/muslang.py:215-230` multiplies bars by four.

These omissions are not legal implicit defaults: L7 prohibits silent defaults and says the list is exhaustive (`core-spec-v0.md:36-39`); §9 repeats that exhaustive-default claim (`:319-321`). §9.3 says event rows require an emit-declared block and containers contain only occurrences/bindings, but never makes omitted `emit` mean `none` (`:331-337`). The formula grammar also omits invocation/evaluation syntax for defs even though A calls `compRoot(...)` and C calls `color(...)` (`core-spec-v0.md:90-108`; A `encoding.mus:18,29`; C `C_synthetic.mus:9-17`). Chord spelling/quality realization is likewise presumed rather than specified.

My fresh evaluator therefore had to supply four load-bearing choices—select the root externally, assume 4/4, treat missing `emit` as container-none, and provide conventional chord/def-call semantics—plus an unasserted convention for simultaneous same-route rows whose duration is omitted. They are recorded before results in `audit-review2/evaluator-results/results.json:2-43`. The fixtures make the intended choices guessable, but that is not the claimed document-determined semantics.

### 2. Fixture A contradicts the normative literal-register rule

**Claim attacked:** C3, C4, and the claimed A 531/531 verification.  
**Severity:** **major**.  
**Confidence:** **high**.

§9.1 says the evaluator must voice a pitch-producing `literal` through the governing `registerSpec` before arithmetic/floor processing (`core-spec-v0.md:309-312`). `BassCellV` governs its rows with `range G1..G2 voice highest` (`A/encoding.mus:20-25`). Its last-copy vary inserts three literal `G1` rows (`:143-147`). The highest G in the inclusive G1..G2 range is G2, yet the normative answer contains G1 at GT bar 19 beats 1, 2.5, and 3 (`A/expected/03_Bass.csv:43-45`).

My evaluator generates 531 events but matches only 528: the three produced G2 events are opposed by three expected G1 events (`audit-review2/evaluator-results/results.json:46-110`). If literal pitches bypass register voicing—an exception the prose does not state—the same evaluator reaches 531/531 (`results.json:351-378`). “Fixture wins” identifies which output is desired, but it does not make the written register algorithm consistent.

The prior general evaluator contains exactly this pass-producing deviation: a literal pitch becomes a bare integer (`PRIOR/muslang.py:457-460`) and bare integers bypass register finalization (`:540-550`). Its A pass therefore does not verify §9.1.

### 3. Fixture C contradicts the exhaustive omitted-`at` default

**Claim attacked:** C3 and C4.  
**Severity:** **major**.  
**Confidence:** **high**.

§9.1 states that omitted `at` means the parent's origin, including “order-index 1,” and calls the defaults exhaustive (`core-spec-v0.md:319-321`). All three rows of the order-only `Prog` omit `at` (`C_synthetic.mus:6-7`), while `C_expected.csv:2-9` requires C, F, and G to drive successive bars 1, 2, and 3.

Applying the written origin default produces 12 events but only 7 match, with five generated and five expected events unmatched (`audit-review2/evaluator-results/results.json:600-627,826-850`). Treating written row sequence as implicit successive order positions—an unstated behavior—produces 12/12 (`results.json:330-348`). The prior parser does the latter by enumerating rows and ignoring their parsed default position (`PRIOR/muslang.py:336-349,556-564`).

There is a second unresolved boundary: a realized three-row `Prog each 1 bar` is three bars long, while the binding-owning `FixtureC` context is four bars. Binding a non-circular stream into a longer context is a static error (`core-spec-v0.md:114-118`), unless “context” means only the three-bar consuming occurrence rather than the binding-owning block. The document does not define which.

### 4. Fixture B's stated edge consequence does not follow from its positional rule

**Claim attacked:** C3 and C4.  
**Severity:** **major**.  
**Confidence:** **high**.

The v0.2 README retires push mapping, requires absolute-beat comparison, and exempts events at the first grid position or “at or past” the window end (`B/README.md:3-9`; mirrored in `core-spec-v0.md:351-357`). Six expected events occur at GT bar 16 beat 4.99 (`B/expected/03_POLYSYNTH.csv:26-28`; `B/expected/10_DRUMS.csv:239-241`). In a 12-bar 4/4 half-open window their absolute onset is 47.99 and the end is 48.0. They are inside, not at or past the end. The retired push mapping is the missing operation that would have put them at 48.0.

The encoding produces 368 events; the answer key has 371. A literal positional implementation removes four produced and one expected event at the first position, leaving 364 produced versus 370 expected and six misses (`audit-review2/evaluator-results/results.json:158-175`). Implementing the README's declared consequence directly—also exempting the six 4.99 events—gives 364/364 (`:143-156`). Thus the intended scoring result is reproducible, but its allegedly “machine-executable” rule is not.

### 5. “Independently machine-verified twice” is contradicted by the supplied verification artifacts

**Claim attacked:** C5 and the status assertions in §9.  
**Severity:** **major**.  
**Confidence:** **high** for what the supplied scripts do; no claim about absent private work.

The spec says both reviewers independently machine-verified A 531/531, B content-exact modulo edges, and C 12/12 (`core-spec-v0.md:293-298,397-404`). Running the supplied scripts shows:

- `simA.py` reports 531/531, but it hard-codes the event construction and never reads A's encoding (`PRIOR/simA.py:15-124`); it reads expected CSVs only at `:126-145`.
- `simB.py` reports three first-position produced extras and six end expected extras, rather than applying the claimed final exemption (`PRIOR/simB.py:11-49`).
- `run.py A` reports 531/531, but uses the literal-register bypass in Finding 2.
- `run.py B` reports `TOTAL match=365 missing=6 spurious=3`, with Poly and Drums marked `FAIL` (`PRIOR/run.py:108-112`).
- `run.py C` prints twelve generated events and a count; it never loads or compares `C_expected.csv` (`PRIOR/run.py:113-118`).
- The earlier `evalA.py` run produces 516 and matches 456/457 under its two policies; `evalB.py` reaches at best 365 matched after its own mapping. Those are useful diagnostic attacks, not successful conformance runs.

The strongest supplied harness therefore never establishes all three claimed results under the final written semantics. This is an overstatement of verification, even though I found no runtime answer-key leakage (Finding 15).

### 6. Three central Billie Jean coverage sentences are false against the note tables

**Claim attacked:** C2.  
**Severity:** **major**.  
**Confidence:** **high**.

The document explicitly says onsets and pitches are described (`02_billie_jean_description.md:3-10`). Against that promise:

1. S4 says there are **three staccato chord hits per bar** over 36 named bars and that this covers 216 notes (`:58-64`). Three triad hits × 36 bars would be 324 notes. The data contain 216 notes—72 triad-equivalents, an average of two triad hits per bar—and only 62 of 82 physical onset groups are even full three-note groups (`audit-review2/analysis-claim-audit.json:895-946`). Fixture B itself encodes two triads per bar (`B/encoding.mus:24-29`).
2. S7 says the three-note mordent occurs **six** times but claims 27 covered notes (`02_billie_jean_description.md:76-79`). The CSV contains **nine** occurrences, at starts 21:3.99, 22:1.99, 22:3.99, 25:3.99, 26:1.99, 26:3.99, 33:3.99, 34:1.99, and 34:4.0; nine × three is the stated 27 (`analysis-claim-audit.json:948-997`).
3. S15 names only kick C2, snare/rim E2, hat F#2, and tambourine A#4 while claiming all 1,094 drum notes (`02_billie_jean_description.md:107-109`). Those four pitches total 1,060 (109 + 109 + 425 + 417). The other 34 events are A#2×7, A2×1, C#3×1, D#2×24, and G2×1 (`analysis-claim-audit.json:999-1010`). “Essentially unvaried” can summarize a groove; it cannot satisfy the document's own complete onset/pitch-coverage claim for the omitted events.

The headline 2,093 total is nevertheless arithmetically correct (Finding 18).

### 7. The Beatles bridge's “exact intro recap” and bass description are false

**Claim attacked:** C2.  
**Severity:** **major**.  
**Confidence:** **high**.

B6 says bars 41-42 reproduce intro bars 6-7 “exactly,” specifically naming D-pedal eighth dyads in rhythm guitar **and bass**, with lead added (`01_iwthyh_description.md:171-175`). Normalized onset/pitch multisets show the rhythm guitar is exact and the added lead contributes 32 notes, but the bass is not: the intro has two held D2 onsets while the recap has sixteen D2 eighth-note onsets, i.e. 14 additional onset/pitch rows. Kick adds two; snare has one intro-only and three recap-only rows; hats change from eight open G#2 hits to sixteen closed F#2 hits (`audit-review2/analysis-claim-audit.json:352-786`).

B4 also says bass root taps at beats 1, 2.5, and 3 across the bridge and claims 43 notes (`01_iwthyh_description.md:164-165`). Bars 32-40 have three notes each, but bars 41 and 42 have eight each (`analysis-claim-audit.json:787-799`). The count 27 + 16 = 43 is right; the described uniform pattern is not.

### 8. The desugaring table contains a derivation the normative amendments say does not exist

**Claim attacked:** C3, specifically the desugaring-table claim.  
**Severity:** **minor** because §9 discloses and supersedes the error; **major** if §5 is consumed in isolation as advertised.  
**Confidence:** **high**.

§5 maps `± steps` to “key-read + offset” (`core-spec-v0.md:175-190`). Normative §9.7 says `± steps` “has no core form” and is an expressiveness hole (`:376-378`). The final amendment tells a careful reader which statement loses, but the desugaring table's derivation is still false and was not repaired in place.

### 9. Fixture C does not conformantly test the provenance feature it claims to exercise

**Claim attacked:** C3/§7's fixture-coverage statement.  
**Severity:** **minor**.  
**Confidence:** **high**.

§7 says Fixture C exercises “`swing` provenance” (`core-spec-v0.md:245-247`), but the global assertion scope is onset and pitch only (`:224-234`). `C_expected.csv:1-13` contains only bar, beat, pitch, and route; it has no provenance, row identity, receipt, or source mapping. §9.4 explicitly defers receipt conformance (`core-spec-v0.md:339-342`). C tests the swung onset, not provenance preservation.

### 10. Additional Beatles coverage prose is internally wrong or stale

**Claim attacked:** C2.  
**Severity:** **minor**.  
**Confidence:** **high**.

- B3 says there is one sustained triad per bar for nine listed chords, plus two connective notes and one remnant, while claiming 27 notes (`01_iwthyh_description.md:161-163`). The data have eight triads (24), the two connective notes, and only a lone A2 at bar 36—not a ninth triad—for the correct total 27 (`analysis-claim-audit.json:224-350`).
- S12 describes snare backbeats beginning with the groove at bar 6 (`01_iwthyh_description.md:71-79`), but bar 6 has zero snare notes (`analysis-claim-audit.json:48-94`).
- The Part 1 tally remains printed as 628/629 with one leftover (`01_iwthyh_description.md:97-111`). A later erratum correctly identifies the recurring F grace note and says the unexplained count is now zero (`:206-211`), but it neither repairs the table nor assigns the note to a numbered sentence. The final prose can be understood, but the claimed numbered-sentence tally is stale.

### 11. Ground-truth durations for overlapping same-pitch notes depend on an undocumented pairing convention

**Claim attacked:** the unqualified form of C1.  
**Severity:** **minor**.  
**Confidence:** **high** about the ambiguity and counts; this is not evidence that FIFO is musically wrong.

Standard note-off events identify channel and pitch, not which occurrence to close when the same channel/pitch has overlapping note-ons. The author parser chooses FIFO (`/Users/winterfell/.claude/jobs/4733c949/tmp/midiparse.py:75-81`) without documenting that policy in the artifact. The Beatles, Billie Jean, and Genie files have no such overlaps. Smooth Operator has 41; switching FIFO to LIFO replaces 64 FIFO rows with 64 differently ended rows in CLEAN GTR. Smells Like Teen Spirit has 496 overlaps; switching policy replaces 110 rows with 110 alternatives (`audit-review2/midi-overlap-policy.json:18-352,356-998`). Onsets, pitches, track counts, tempo, and meter are unchanged; duration and attached note-on velocity can differ. The supplied CSVs are an exact FIFO decode, but the MIDI bytes do not uniquely force those duration associations.

### 12. Version and ledger references are stale or undefined

**Claim attacked:** C3's defined-term/editorial consistency portion.  
**Severity:** **cosmetic**.  
**Confidence:** **high**.

The title still says v0.1 while normative v0.2 amendments and a v0.2 changelog follow (`core-spec-v0.md:1,293,397-404`). The opening says §8.6 lists every change (`:5`), but §8.6 is only a redirect added at `:380`. `E4` and “LLM interface” appear in the ledger without definitions (`:268-270`). These are not responsible for the event mismatches above, but they weaken the document's claim to a closed vocabulary.

## Attacks attempted that failed

### 13. Independent MIDI re-parsing did not find extraction corruption

**Claim attacked:** C1.  
**Disposition:** **attack failed**; no defect severity assigned.  
**Confidence:** **high**.

I wrote a standard-library SMF parser from scratch (`audit-review2/independent_midi_audit.py:18-424`) covering VLQs, running status, channel events, zero-velocity note-offs, tempo, meter, key signatures, track metadata, and bar/beat conversion. I parsed all five files, not merely one. The result was 51 nonempty tracks and 26,444 notes: 3,114 + 6,183 + 7,586 + 5,858 + 3,703. Every regenerated CSV was byte-identical to its supplied counterpart; every `summary.json` was semantically identical; there were no unmatched note-offs or dangling note-ons (`audit-review2/midi-rederived/midi-audit.json:5-194,197-404,407-682,685-1046,1049-1292`). All five independently calculated MIDI MD5s also equal the README values at `SRC/README.md:10-11,21-22,33-34,45-46,56-57`.

This passes timing, pitch, track, tempo, and meter extraction. Finding 11 is the only qualification.

### 14. The answer keys are exact, complete filters of the declared windows

**Claim attacked:** the extract-modification and hidden-inside-window parts of C6.  
**Disposition:** **attack failed**; no defect severity assigned.  
**Confidence:** **high**.

I independently filtered the ground-truth CSV bytes, preserving headers and row order. A contains exactly 531 rows—49 vocal, 61 lead, 44 bass, 193 guitar, 24 kick, 31 snare, 97 hats, 32 claps—and every expected file is byte-identical to its filter. Crash and toms have zero events inside the window (`audit-review2/window-extract-audit.json:3-105`). B contains exactly 371 rows—96 bass, 27 polysynth, 8 synvox, 240 drums—and every expected file is byte-identical. All seven omitted B tracks are empty inside (`window-extract-audit.json:197-302`). Thus the keys were not edited to improve a score, and no in-window track was silently omitted.

### 15. Direct runtime circularity was not found in any supplied script

**Claim attacked:** C5's strongest allegation: generation consuming answer-key rows.  
**Disposition:** **attack failed** for direct data leakage; verification quality still fails under Finding 5.  
**Confidence:** **high** for static data flow.

| Script | Generation source | Where answer keys enter | Audit result |
|---|---|---|---|
| `evalA.py` | Hard-coded chord/cell/event data, `:89-270`; does not read `encoding.mus` | Loader/comparison at `:275-305` | No runtime leakage; manually tuneable; run itself fails. |
| `evalB.py` | Hard-coded fixture data, `:17-40` | Loader begins `:42-48` | No runtime leakage; manually tuneable; diagnostic, not final pass. |
| `gtr_detail.py` | Imports and runs `evalA`, `:3-6` | Calls imported `load`, `:8` | Derivative diagnostic; not independent verification. |
| `simA.py` | Hard-coded encoding transcription, `:15-124` | Reads expected at `:126-145` | No runtime leakage; reports exact result. |
| `simB.py` | Hard-coded encoding transcription, `:11-29` | Reads expected at `:37-43` | No runtime leakage; reports edge mismatches. |
| `check.py` | None | Reads only answer keys, `:4-44` | A count/shape audit, incapable of conformance verification. |
| `muslang.py` | Parser/evaluator only; no answer-key path | None | Strong separation, but semantic deviations in Findings 2-3. |
| `run.py` | Reads and renders `encoding.mus` at `:28-34`, before A/B expected loads at `:102-110` | Generic loader `:15-26`; no C load | No generation leakage. A pass is semantically invalid; B fails; C is not compared. |

Hard-coding makes the first six artifacts easy to tune after looking at an answer key, but static inspection found no answer-key read feeding their generation logic.

### 16. Textual-copying attack against the two script rounds found no persuasive signature

**Claim attacked:** C5's concern that round 2 copied round 1.  
**Disposition:** **attack failed**; no defect severity assigned.  
**Confidence:** **medium-high** (absence of textual similarity cannot prove independent authorship).

After removing whitespace/comments, `evalA.py` versus `simA.py` shared one normalized line, no two-line contiguous block, and sequence similarity 0.0063. `evalB.py` versus `simB.py` shared zero normalized lines and sequence similarity 0.0. Comparisons with `muslang.py` shared only an import line (`audit-review2/prior-script-similarity.json:35-90`). The architectures and coding styles are materially different. Shared music constants are expected because both represent the same fixture.

### 17. The intended fixture outputs are substantive rather than fabricated random keys

**Claim attacked:** a stronger fabrication hypothesis under C4/C6.  
**Disposition:** **attack failed**, subject to the written-rule defects above.  
**Confidence:** **high**.

My evaluator's event generation completed and was persisted before any answer key was opened (`audit-review2/muslang_evaluator.py:1033-1065`). With the fixture-implied exceptions, it independently reaches A 531/531, B 364/364 after the README's declared exemptions, and C 12/12 (`audit-review2/evaluator-results/results.json:351-378,380-413,570-597`). That strongly supports genuine encoding work. The defects are in semantic closure and status claims, not a wholly invented event set.

### 18. The headline analysis-window arithmetic and selected claims survived attack

**Claim attacked:** C2.  
**Disposition:** **attack failed** for these subclaims; no defect severity assigned.  
**Confidence:** **high**.

Independent CSV counts reproduce Beatles Part 1 629, bridge 362, outro 368, and Billie Jean 2,093 exactly (`audit-review2/analysis-claim-audit.json:3-46,880-893`). The Beatles A1 erratum's short F occurs at every listed refrain opening (bars 16, 28, 51, 74, 78). The outro's bars 74-76 versus 78-80 match onset/pitch in every route except two lead onsets shifted by 0.042 beat, within the document's microtiming policy (`analysis-claim-audit.json:800-875`). These passes do not rescue the false sentences in Findings 6, 7, and 10.

## Could not verify

### 19. Reviewer blindness, chronology, and absence of offline tuning

**Claim attacked:** the process-level part of C5.  
**Disposition:** **could not verify**; no defect severity assigned.  
**Why:** source code proves runtime data flow, not what an author saw before writing hard-coded constants. There is no authorized provenance record establishing independent blindness or creation chronology. Finding 16 supplies negative copying evidence, not proof.

### 20. A unique per-note sentence assignment for the analyses

**Claim attacked:** the strongest reading of C2's “every note accounted for.”  
**Disposition:** **could not verify globally**; no defect severity assigned.  
**Why:** neither analysis contains a row-ID-to-sentence map. Arithmetic can total correctly while double-counting one row and omitting another. I could test window totals and falsify concrete patterns, but cannot prove a bijection between every CSV row and exactly one sentence from prose alone.

### 21. The external musicological divergence log

**Claim attacked:** C2's claims about published analyses and recordings.  
**Disposition:** **could not verify**; no defect severity assigned.  
**Why:** the authorized on-disk evidence contains MIDI transcriptions and links, but not the cited publications, audio masters, or quoted source passages. I verified claims against the MIDI only and did not import outside evidence into this blind artifact audit.

### 22. Whether the fixture windows were intentionally cherry-picked

**Claim attacked:** the intent portion of C6.  
**Disposition:** **could not verify**; no defect severity assigned.  
**Why:** no omitted track is active inside either declared window, so there is no hidden completeness failure. The selections are favorable: A's omitted crash/toms are active elsewhere, all seven omitted B tracks are active elsewhere, and B ends immediately before bar 17 introduces melody (six events) plus continuing bass/poly/drums. That demonstrates narrow coverage, not dishonest intent. Adjacent/outside counts are recorded in `audit-review2/window-extract-audit.json:103-196,300-384`.

### 23. Receipts, durable IDs, round-trip printing, duration, velocity, and provenance conformance

**Claim attacked:** portions of C3 beyond onset/pitch.  
**Disposition:** **could not verify as conformance claims**; no defect severity assigned.  
**Why:** §7 deliberately narrows answer keys to onset/pitch (`core-spec-v0.md:224-234`), C has no provenance oracle, and §9.4 defers receipts (`:339-342`). No supplied fixture asserts identities, receipts, canonical round trips, durations, velocities, or provenance. These mechanisms may be plausible, but the suite cannot falsify them.

## Reproduction artifacts

The independent programs and machine-readable evidence are:

- `audit-review2/independent_midi_audit.py` → `audit-review2/midi-rederived/midi-audit.json` and 51 regenerated CSVs.
- `audit-review2/midi_overlap_policy_audit.py` → `audit-review2/midi-overlap-policy.json`.
- `audit-review2/window_and_extract_audit.py` → `audit-review2/window-extract-audit.json`.
- `audit-review2/analysis_claim_audit.py` → `audit-review2/analysis-claim-audit.json`.
- `audit-review2/muslang_evaluator.py` → `audit-review2/evaluator-results/results.json` and generated-event CSVs for each semantic variant.
- `audit-review2/prior_script_similarity.py` → `audit-review2/prior-script-similarity.json`.
- `audit-review2/decision-log.md` records the consequential audit choices, especially strict-versus-fixture-friendly scoring.

## Overall integrity verdict

**The body of work has a strong, genuine data foundation, but it is not what its strongest conformance and verification claims say it is.** The source MIDIs are the documented files; the generated ground truth is an extraordinarily strong byte-for-byte extraction under the chosen FIFO pairing; and both fixture answer-key sets are unmodified, complete filters of their declared windows. The fixture encodings also contain substantive modeling work: a fresh evaluator can reproduce their intended outputs once the intended exceptions are supplied.

However, the language is not yet a self-contained deterministic specification. Required program facts are missing, A conflicts with the explicit register rule, C conflicts with the explicit omitted-position rule, B's edge result does not follow from its literal policy, and the supplied scripts do not support the assertion of two successful blind machine verifications. Both musical analyses have correct top-line arithmetic but contain material false descriptions. Accordingly, this is a **credible empirical prototype and honestly labeled draft**, not a valid conformance-tested language specification, and not a reliable “independently machine-verified twice” artifact.

<!-- END AGENT 2 REPORT -->

## Agent 3 Report

- Codex thread: `019fbfc2-8f15-7531-8872-8d70be3d429a`
- Original report SHA-256: `7980020ce4ecc0a66f91d4644096b7ef084a633d6227be1f57f1536055336274`

<!-- BEGIN AGENT 3 REPORT -->

# Independent red-team review 3 of 4

Worktree recorded at start:
`/Users/winterfell/.codex/worktrees/d2ecad3b-017e-41e7-ae37-096dad2f5f29/future-daw`

Audit date: 2026-08-01. I wrote all scratch code, generated evidence, and this report inside that worktree. I did not modify the source-artifact tree or prior-review directory.

Path shorthand used below:

- `SRC` = `/Users/winterfell/src/future-daw/artifacts/musical-language-sample`
- `SPEC` = `SRC/language-lab/spec/core-spec-v0.md`
- `PRIOR` = `/private/tmp/claude-502/-Users-winterfell-src-future-daw/4733c949-576d-4b86-b794-96cd4a024683/scratchpad`
- `AUDIT` = `/Users/winterfell/.codex/worktrees/d2ecad3b-017e-41e7-ae37-096dad2f5f29/future-daw/audit`

## Audit method and material reviewer choices

I wrote and ran the binary MIDI decoder and fixture interpreter before opening the disclosed author parser or any prior-review script. The independent programs are `AUDIT/scripts/independent_midi_audit.py` and `AUDIT/scripts/independent_muslang.py`; comparison-only code is separate in `AUDIT/scripts/audit_fixture_results.py` and `AUDIT/scripts/audit_analysis_claims.py`.

The written language did not determine several choices. For the intended-path run I supplied `FixtureA`/`FixtureB`/`FixtureC` as roots, supplied four beats per bar, treated emit-less blocks as containers, treated an order-only block's written row order as successive indices, treated finite decimals as exact rationals, cloned source block properties through `swing`, and treated scientific-pitch literals as absolute pitches. Those choices are logged in each `AUDIT/derived/fixture_*_generated*.json`. I then ran the consequential alternatives instead of hiding them: literal §9 omitted-`at` behavior for C, literal §9 register behavior for A, and both literal and tolerance-wide readings of B's edge exemption.

For MIDI, the baseline used FIFO pairing for overlapping same-channel/same-pitch notes and round-to-nearest/ties-to-even at three decimals. Both choices are reported below; LIFO was also tested.

## Confirmed defects

### 1. Fixture A contradicts the normative register-evaluation rule

**Claim attacked:** C3 and C4 — prose, model, and normative fixture agree, and A is 531/531 under the written semantics.

**Severity:** major. **Confidence:** very high.

**Evidence:** §9.1(4) says to voice a pitch-producing leaf, explicitly including a `literal`, under the governing register before arithmetic (`SPEC:309-312`). `BassCellV` governs its rows with `range G1..G2 voice highest floor repeat-root` (`SRC/language-lab/spec/fixtures/A_iwthyh_bars08-19/encoding.mus:20-25`). Its final vary then writes three literal `G1` notes to create an octave-drop cadence (`encoding.mus:145-147`). Under the stated rule, each G pitch class is voiced to the highest representative in G1..G2, which is G2 (MIDI 43), not G1 (MIDI 31). The answer key requires G1 three times (`expected/03_Bass.csv:43-45`).

My interpreter produces the fixture-intended 531/531 only when scientific-pitch literals bypass the block register (`AUDIT/derived/fixture_audit.json:123-133`). With §9.1(4) applied literally, it produces 531 events but matches only 528; the three G2 events replace the three required G1 events (`fixture_audit.json:135-183`). The header rule that “the fixture wins” can choose the answer key over the prose, but that proves C3's internal-consistency claim false and leaves the prose rule wrong.

### 2. Fixture C requires the opposite of §9's omitted-`at` rule

**Claim attacked:** C3 and C4 — C exercises order-only realization and is 12/12 under the written semantics.

**Severity:** major. **Confidence:** very high.

**Evidence:** §9.1(7) says omitted `at` means the parent's origin, explicitly “order-index 1” for an order-only block (`SPEC:319-321`). `Prog` contains three rows with no `at`: `play C   play F   play G` (`SRC/language-lab/spec/fixtures/C_synthetic.mus:6-7`). C's expected table requires those rows to become successive one-bar events, driving Cell copies in bars 1, 2, and 3 (`C_expected.csv:2-9`).

Applying §9.1(7) literally places all three order-only rows at index 1. That alternative matched only 7/12 expected events, with five produced and five expected events unmatched (`AUDIT/derived/fixture_audit.json:314-387`). Silently assigning successive indices by written order gives 12/12 (`fixture_audit.json:388-399`). The prior generic evaluator makes that same undocumented exception by enumerating rows with `i * realization` and ignoring their parsed positions (`PRIOR/muslang.py:556-564`). A one-line rule change can fix this, but the present normative text and fixture are contradictory.

### 3. Fixture B's “positional, machine-executable” edge rule does not exempt the six events it says it exempts

**Claim attacked:** C3 and C4 — B is content-exact modulo its v0.2 positional edge exemption.

**Severity:** major. **Confidence:** very high.

**Evidence:** §9.6 retires push mapping, specifies one ±0.1 absolute-beat tolerance, and restates the edge exemption as the first grid position and “at-or-past window end” (`SPEC:351-357`). B's README repeats that positional rule, then says its consequence is exemption of six expected events at GT bar 16 beat 4.99 (`SRC/language-lab/spec/fixtures/B_billiejean_bars05-16/README.md:3-9`). Those six rows are physically at local beat 47.99, before the 48-beat window end, not at or past it (`expected/03_POLYSYNTH.csv:26-28`, `expected/10_DRUMS.csv:239-241`).

After literal positional filtering, my comparison had 364 produced, 370 expected, and six expected events unmatched (`AUDIT/derived/fixture_audit.json:185-233`). Exempting an entire ±0.1-wide zone before the end—an unstated rule resembling the retired push behavior—gives 364/364 (`fixture_audit.json:302-312`). The README's enumerated consequence reveals intent, but the supposedly machine-executable general rule does not derive it.

### 4. The fixture documents are not self-contained normalized Documents

**Claim attacked:** C3 and C4 — the data model and surface syntax determine evaluation from the document alone.

**Severity:** major. **Confidence:** high.

**Evidence:** the normalized `Document` requires `root` and `formatVersion` (`SPEC:48-49`), but §6 gives no syntax or default for either (`SPEC:195-220`), and none of the three `.mus` files declares them. Every evaluator must receive or infer the root externally; the prior generic runner passes `FixtureA`, `FixtureB`, or `FixtureC` as a `top` argument (`PRIOR/run.py:28-34,101-115`).

Metric positions use bars and beats, yet neither the `Document`/`Block` model nor surface syntax has a meter or beats-per-bar field (`SPEC:48-56,195-208`). All fixtures therefore need an external four-beats-per-bar assumption. The prior generic parser hard-codes multiplication by four in positions, extents, and clocks (`PRIOR/muslang.py:213-231,307-313`). My evaluator had to do the same and logs it as extra-documentary (`AUDIT/derived/fixture_A_generated.json:5-13`). Different meter and root choices materially change every event address; these are not cosmetic parser details.

### 5. Required model fields and fixture syntax disagree about containers and def-level registers

**Claim attacked:** C3 — normalized model, static rules, and fixtures agree.

**Severity:** major. **Confidence:** high.

**Evidence:** `Block.emit` is presented as a field, with `none-for-containers` still marked open (`SPEC:51-56`); L7 forbids silent defaults (`SPEC:36-39`); and §9.1(7) says the §9 defaults list is exhaustive (`SPEC:319-321`). Nevertheless A's `Verse`, `Refrain`, and `FixtureA` containers omit `emit` (`encoding.mus:100,143,175`), as do B's and C's roots (`B.../encoding.mus:56`, `C_synthetic.mus:27`). §9.3 says containers hold occurrence rows/bindings (`SPEC:335-337`) but never supplies a surface spelling or a normalization rule that produces the required `emit = none` value. Both independent and prior evaluators infer it silently.

Separately, the normalized `Def` has no `registerSpec` field (`SPEC:90-93`), while A's `compRoot` def has a `range ... voice highest` suffix (`A.../encoding.mus:18`) and §9.1(4) refers to “a def's own registerSpec” (`SPEC:309-312`). The intended behavior is recoverable, but the claimed normalized model cannot represent a construct used by a normative fixture.

### 6. The Billie Jean “complete per-note” analysis has multiple sentence-level failures

**Claim attacked:** C2 — each sentence's coverage count is true and its musical statement accounts for the indicated rows.

**Severity:** major. **Confidence:** very high for the counts and repeated-cell error; high for the drum-coverage error.

**Evidence:**

- S3 claims 40 bass notes in bars 37–44 and the table assigns the other 341 to S1/S2 (`SRC/language-lab/02_billie_jean_description.md:53-56,111-125`). The CSV contains 39 onsets in bars 37–44 (`ground-truth/.../02_FRETLESS.csv:252-290`) and 342 elsewhere in bars 3–56. The recomputed partition is recorded at `AUDIT/derived/analysis_audit.json:224-229`. The headline 381 is right; the sentence allocation is not.
- S7 says the F#–G#–F# cell occurs “six times verbatim” while claiming 27 covered notes (`02_billie_jean_description.md:76-79`). The CSV shows three triplets in each named two-bar pair—at the first bar's beat 4 and the next bar's beats 2 and 4—so there are nine triplets, not six (`04_MELODY.csv:28-36,43-51,80-88`; computed at `analysis_audit.json:210-223`). Six triplets cover 18 notes; the claimed 27 only works because the data contains nine.
- The only drum sentence names kick, rim/snare, hi-hat, and tambourine and claims all 1,094 drum notes (`02_billie_jean_description.md:107-109`). Those four named pitches total 1,060. There are 34 additional events on five other pitches, including a systematic 24-hit D#2 chorus layer plus fills (`AUDIT/derived/analysis_audit.json:556-567`; examples in `ground-truth/.../10_DRUMS.csv:829-870`). Calling the groove “essentially unvaried” does not account per note for a section-scoped backbeat layer.
- The description repeatedly calls beat 4.99 the “and-of-4” (`02_billie_jean_description.md:45-48,59-64,150-153`). On its own 1-based four-beat coordinate, the and-of-4 is 4.5; 4.99 is about 0.01 beat before the next downbeat. The data distinguishes both within one bar (`02_FRETLESS.csv:9-10`), and Fixture B itself treats 4.99 as a pushed next-grid event. This changes the claimed device from an eighth-note anticipation to transcription-grid softness.

The document's top-level total of 2,093 is arithmetically correct; these defects show that the stated “every sentence points at the notes it accounts for” method is not actually satisfied.

### 7. The claimed two independent machine verifications are overstated by the surviving scripts

**Claim attacked:** C5 and the §9 verification claims.

**Severity:** major. **Confidence:** high about what the files establish; no claim of intentional fabrication.

**Evidence:** §9 says both wave-2 reviewers independently machine-verified A 531/531, B content-exact modulo edge, and C 12/12 (`SPEC:293-298,397-404`). The surviving code supports less:

- Round-2 `simA.py` never reads `encoding.mus`; it manually duplicates every fixture row and policy (`PRIOR/simA.py:15-124`) and reads the expected files for comparison at lines 127–145. It currently reports zero A mismatches, but the generated side can be tuned without any relationship to the actual encoding file being enforced.
- `simB.py` likewise hard-codes production (`PRIOR/simB.py:11-29`) and reads expected data afterward (`simB.py:31-49`). It reports the three start-boundary produced-only events and six end-boundary expected-only events; it does not implement the v0.2 exemption.
- `check.py` reads answer keys and counts them (`PRIOR/check.py:1-44`); it generates nothing.
- The other round-2 implementation genuinely parses the encodings before loading expected data (`PRIOR/run.py:28-34,101-112`; `muslang.py` is a distinct AST interpreter). It verifies A 531/531, but its B path reports six missing and three spurious because it does not implement the v0.2 positional exemption. Its C path only prints generated events and `count: 12`; it never loads or compares `C_expected.csv` (`PRIOR/run.py:113-118`).

Current-run totals are preserved in `AUDIT/evidence/prior-script-run-summary.txt`. Round-1 `evalA.py` and `evalB.py` are stale against the current artifacts and fail, which is not itself a v0.2 defect but means they cannot serve as current confirmation. The code establishes one genuine encoding parser for A, a manual second A re-derivation, diagnostic B edge mismatches, and a generated C count—not two machine comparisons of all three fixtures.

### 8. One advertised desugaring is admitted elsewhere to have no core form

**Claim attacked:** C3 — §5's derivations actually work.

**Severity:** minor. **Confidence:** very high.

**Evidence:** §5 says retired `± steps` desugars to “key-read + offset” (`SPEC:187-189`), but §9.7 explicitly lists diatonic transposition as an expressiveness hole because `± steps` has no core form (`SPEC:376-378`). No defined core operation computes that key-dependent semitone offset. Related unexercised gaps remain for `scaleToWindow` and `reverse`: they are named (`SPEC:120-125,182`) but §4 supplies no complete event-position/duration mapping. These do not affect A/B/C, but the desugaring/completeness claim is false.

### 9. The IWTHYH document contains a localized false musical statement and a stale coverage status

**Claim attacked:** C2.

**Severity:** minor. **Confidence:** very high.

**Evidence:** O3 says bass, rhythm guitar, and lead descend C–E–D–C–B–A in octaves in bar 81 and claims eight lead notes (`SRC/language-lab/01_iwthyh_description.md:193-198`). Bass and rhythm guitar do that, but lead starts with a B2–D3–G3 triad, then continues E3–D3–C3–B2–A2 (`ground-truth/01_iwthyh/02_Lead-Gui.csv:370-377`). The lead does not play the opening C, and the unexplained difference is exactly why its count is eight rather than six.

The Part 1 table correctly says 628 covered plus one leftover out of 629 (`01_iwthyh_description.md:97-111`). The later erratum correctly proves the F3 is a recurring refrain grace and says the leftover count drops to zero (`01_iwthyh_description.md:206-211`), but it does not add a numbered coverage sentence or revise the table. The data claim is solved; the promised numbered-sentence tally remains stale.

### 10. Version/status labels are internally stale

**Claim attacked:** C3's document-state accuracy.

**Severity:** cosmetic. **Confidence:** very high.

**Evidence:** the file title and opening status call it v0.1 and say wave-2 review is pending (`SPEC:1-5,249-250`), while §9 is a normative v0.2 amendment and the changelog declares wave-2 verification complete (`SPEC:293-298,397-404`). Fixture encoding comments still say v0.1 while their READMEs say v0.2. The amendment precedence rule makes most semantic conflicts resolvable, but the artifact does not accurately identify its own current version/status.

## Attacks attempted that failed

### 11. C1 survived independent binary re-parsing across all five MIDIs

**Claim attacked:** C1. **Severity:** none; attack failed. **Confidence:** very high under the disclosed rounding and FIFO note-pairing conventions.

I implemented SMF header/track parsing, VLQs, running status, channel events, tempo/time/key meta-events, meter-aware bar conversion, FIFO and LIFO note pairing, and pitch naming with the Python standard library. Across 51 note-bearing CSV tracks and 26,444 rows, every generated tuple `(bar, beat, tick, pitch, name, dur_beats, velocity, channel)` matched as a multiset. Every claimed summary field—format, division, tempo list, meter list, key signatures, track names/programs/channels/counts/ranges/first/last positions—also matched. There were no dangling note-ons or note-offs. Evidence is in `AUDIT/derived/midi_audit.json` and the implementation in `AUDIT/scripts/independent_midi_audit.py`.

All five MIDI MD5s also match `SRC/README.md:10-11,21-22,33-34,45-46,56-57`. After the independent pass, I ran the disclosed `midiparse.py` into `AUDIT/derived/author_reparse/`; all 56 generated files were byte-identical to the source ground-truth directories (`AUDIT/evidence/reparse-byte-check.txt`). I found no altered or hand-edited ground-truth row.

### 12. C6's answer-key extraction and absent-track claims survived byte comparison

**Claim attacked:** C6. **Severity:** none; attack failed. **Confidence:** very high.

For every A and B expected file, I selected the stated inclusive GT bar range while preserving the source header, row bytes, ordering, and line endings. All 12 expected files are byte-for-byte extracts (`AUDIT/derived/fixture_audit.json:1-120`). A's omitted Crash and Toms tracks have zero events in bars 8–19; every B track without an expected file has zero events in bars 5–16 (`fixture_audit.json:625-650`). Route totals also agree with the READMEs.

### 13. Fixture A's intended event expansion is real, complete, and uniquely matchable

**Claim attacked:** C4 for A. **Severity:** none for intended output content; specification defect remains in Finding 1. **Confidence:** very high.

My interpreter parses A's actual `encoding.mus`; generation has no code path to any answer key. It independently produced the exact route counts vox 49, lead 61, bass 44, gtr 193, kick 24, snare 31, hat 97, claps 32. All 531 matched within ±0.1; the maximum onset error was 0.083 beat (the documented 4.417/4.5 grace), and every produced event had at most one candidate, so the bijection is forced on this data (`AUDIT/derived/fixture_audit.json:123-133`). The failure in Finding 1 is a prose/fixture conflict, not fabricated answer content.

### 14. B and C's intended outputs also reproduce once their extra rules are supplied

**Claim attacked:** C4 for B and C. **Severity:** none for intended output content; specification defects remain in Findings 2 and 3. **Confidence:** very high.

B generation produced 368 raw events. Raw comparison found exactly the documented boundary shape: three produced-only start hits and six expected-only 47.99 events (`AUDIT/derived/fixture_audit.json:234-300`). Applying the README's enumerated consequence as a tolerance-wide edge exemption leaves 364/364 matches, maximum onset difference 0.062 (`fixture_audit.json:302-312`). No non-edge pitch/onset mismatch exists.

C produced and matched 12/12, including match/omit, end fallback, `first`, key-dependent F-chord ninth, and exact 2/3 swing, when written order supplies successive order indices (`fixture_audit.json:388-399`). Its maximum comparison error is 0.000333 beat, solely because the expected CSV rounds 1⅔ to 1.667.

### 15. The headline analysis window counts are genuine

**Claim attacked:** C2's headline arithmetic. **Severity:** none for the window totals; sentence-level defects remain in Findings 6 and 9. **Confidence:** very high.

Direct CSV counts reproduce IWTHYH Part 1 = 629, bridge = 362, outro = 368, and Billie Jean bars 3–56 = 2,093 (`AUDIT/derived/analysis_audit.json:646-660,670-764`). The Billie melody sentence partitions sum exactly to 185 with no unassigned bar (`analysis_audit.json:568-576`). IWTHYH's supposed stray F3 does recur with the same 0.135-beat duration at bars 16, 28, 51, 74, and 78 (`analysis_audit.json:765 onward`), so that erratum survived attack.

### 16. I found no persuasive code-copying signature between round 1 and the two round-2 implementations

**Claim attacked:** C5's independence. **Severity:** none for copying; attack failed, though reviewer blindness remains unverifiable. **Confidence:** moderate.

`simA.py`/`simB.py` use manually expanded event lists, while `muslang.py` builds a tokenizer, AST, and recursive renderer. Normalized textual comparisons found only one shared nontrivial line between `evalA.py` and `simA.py` (`def voice_highest(...)`), none between the B scripts, and no distinctive shared implementation with `muslang.py`. The inevitable shared chord/pattern constants come directly from the same fixture. `gtr_detail.py` explicitly imports `evalA.py`, but both are identified as round-1 companions, not independent rounds. This is not proof of blindness; it is a failed search for affirmative copying evidence.

## Could not verify

### 17. Unique note-duration identity for overlapping same-pitch MIDI notes

**Claim under test:** C1. **Severity:** undetermined; this is a representation ambiguity, not a confirmed extraction error. **Confidence in the limitation:** high.

**Why:** Sade contains 41 note-ons that overlap an already-active same-channel/same-pitch note; Nirvana contains 496. The ground truth consistently uses FIFO pairing, which my parser reproduced. LIFO produces different durations in one Sade track and three Nirvana tracks while preserving onsets, pitches, velocities, and note-off events. The MIDI rows carry no note IDs that make one pairing uniquely self-evident. CSV durations are also rounded to 0.001 beat and tempo BPM to 0.001. Thus C1 is strongly verified as a reproducible FIFO extraction, but “faithful” should not be read as lossless or uniquely paired for those overlaps.

### 18. Whether the fixture windows were intentionally cherry-picked to hide failures

**Claim under test:** C6. **Severity:** undetermined. **Confidence that scope is narrow:** very high; **confidence about intent:** none.

**Why:** intent is not recoverable from files. The completeness subclaims did pass: no active track inside either window was silently omitted. But the selection is favorable. A covers 531/3,114 song notes (17.1%). B covers 371/6,183 (6.0%), only four of eleven note-bearing full-song tracks, ends at bar 16 immediately before melody enters at bar 17, and precedes the harmonic excursions and most arrangement layers described at `SRC/language-lab/02_billie_jean_description.md:32-40`. This proves narrow coverage, not dishonest selection. B is accurately labeled a groove-build/timing-layering fixture, so I cannot convert the scope concern into a confirmed defect.

### 19. External musicological/provenance assertions

**Claims under test:** external portions of C2 and source provenance. **Severity:** undetermined. **Confidence in the limitation:** very high.

**Why:** the authorized local evidence does not contain the Hooktheory, Pollack, Hein, Krerowicz, or American Songwriter source texts. I verified the MIDI MD5s and claims against local CSVs, but not quotations, record-vs-transcription assertions, Lakh licensing, or historical attributions.

### 20. Receipts, durable identities, round trips, velocities/durations, and unexercised semantics

**Claims under test:** C3/C4 and Laws L3–L5. **Severity:** undetermined coverage gap. **Confidence in the limitation:** very high.

**Why:** conformance explicitly asserts only onset and pitch and leaves duration/velocity open (`SPEC:222-234`). Receipt conformance is deferred to a future reference evaluator (`SPEC:339-342`). No fixture answer key contains receipts, event identities, provenance links, canonical text, or round-trip output. `stretch`, `reverse`, feel behavior, articulation, value/key output consumption, most reach errors, and routing precedence are absent or non-falsifying. The fixture results cannot verify L3/L4 or the full bit-for-bit L5 claim over those dimensions.

## Overall integrity verdict

The body of work is **substantially genuine but not what it claims to be as a self-contained normative v0.2 language specification or as complete sentence-level musical analysis**.

The strongest integrity layers survived: the source MIDI hashes are right; the disclosed parser reproduces all ground-truth files byte-for-byte; an independent binary parser reproduced all 26,444 note rows and every summary field; all A/B answer keys are unmodified extracts; and the intended A/B/C onset-and-pitch outputs are independently reproducible. I found no evidence that notes or answer keys were fabricated.

The normative layer does not survive. Written §9 semantics directly conflict with A's cadence literals and C's order-only positions; B's edge rule cannot produce its stated exemptions; root, format version, meter, container normalization, and def-register representation are missing or contradictory; and the verification history overstates what the surviving scripts mechanically compare. The analyses' headline totals are real, but Billie Jean's advertised per-sentence coverage contains demonstrable miscounts and omitted repeated material, and IWTHYH has a localized false part statement.

No confirmed defect proves fraud, and I assign no fatal finding to the data corpus. The honest classification is: **high-integrity extracted data and useful gold fixtures; credible intended semantics; materially inconsistent draft spec; analyses that are insightful but not audit-grade per-note proofs.**

## Reproduction artifacts

- `AUDIT/PWD.txt`
- `AUDIT/scripts/independent_midi_audit.py`
- `AUDIT/scripts/independent_muslang.py`
- `AUDIT/scripts/audit_fixture_results.py`
- `AUDIT/scripts/audit_analysis_claims.py`
- `AUDIT/derived/midi_audit.json`
- `AUDIT/derived/fixture_A_generated.json`
- `AUDIT/derived/fixture_A_generated_spec_literal_register.json`
- `AUDIT/derived/fixture_B_generated.json`
- `AUDIT/derived/fixture_C_generated_sequential.json`
- `AUDIT/derived/fixture_C_generated_origin.json`
- `AUDIT/derived/fixture_audit.json`
- `AUDIT/derived/analysis_audit.json`
- `AUDIT/evidence/reparse-byte-check.txt`
- `AUDIT/evidence/prior-script-run-summary.txt`

<!-- END AGENT 3 REPORT -->

## Agent 4 Report

- Codex thread: `019fbff3-78f7-7123-a2e8-668b27a17f3b`
- Original report SHA-256: `fa11ac872b606f97dd474056efbd9320b37dccfb62bfae2b49aeb859ba3ae427`

<!-- BEGIN AGENT 4 REPORT -->

# Independent Reviewer 4 — red-team audit report

Audit date: 2026-08-01  
Assigned worktree (recorded before work):
`/Users/winterfell/.codex/worktrees/d17a8480-e31e-41bd-b145-d45af68fea39/future-daw`  
Source root, read-only:
`/Users/winterfell/src/future-daw/artifacts/musical-language-sample`  
Authorized prior-script root, read-only:
`/private/tmp/claude-502/-Users-winterfell-src-future-daw/4733c949-576d-4b86-b794-96cd4a024683/scratchpad`  
Author's parser, read-only:
`/Users/winterfell/.claude/jobs/4733c949/tmp/midiparse.py`

Unless an absolute path is shown, source-artifact paths below are relative to the
source root; prior-script names are relative to the authorized prior-script root.
For readability, `core-spec-v0.md` means
`language-lab/spec/core-spec-v0.md`, and the two analysis filenames mean files
under `language-lab/`. Within a fixture-specific finding, an unqualified
`encoding.mus`, `README.md`, or `expected/` path belongs to that named fixture.

I wrote an independent Standard MIDI File parser (`audit_midi.py`) and an
independent parser/evaluator for the fixture-used language subset
(`cleanroom_mus.py`, driven by `audit_fixtures.py`). Generation reads the `.mus`
encodings and spec-derived choices only; answer keys are opened afterward for
comparison. Material interpretation choices are recorded in
`semantic-choices.md`. I did not read another Codex review, task, transcript, or
workspace, and did not modify the source tree.

## Confirmed defects

### 1. Fixture A is not 531/531 under the v0.2 register semantics

**Claim attacked:** C3, C4, C5; the claims that both wave-2 reviewers reproduced
Fixture A 531/531 and that the amendments faithfully promote the fixture rulings
(`core-spec-v0.md`:295-298, 397-404).

**Severity:** **fatal** to the stated conformance/verification claim (not fatal to
the recoverability of the draft).  
**Confidence:** **very high**.

**Evidence:**

- A block register is the default for row formulas (`core-spec-v0.md`:54-56).
  Amendment 9.1.4 is explicit that a pitch-producing **literal** is voiced through
  the governing register before arithmetic (`core-spec-v0.md`:309-312).
- `BassCellV` governs its rows with `range G1..G2 voice highest`
  (`fixtures/A_iwthyh_bars08-19/encoding.mus`:20-25). Its last refrain occurrence
  removes the inherited rows and adds three literal `G1` rows
  (`encoding.mus`:145-147).
- In the inclusive octave range G1..G2, `voice highest` maps pitch class G to G2.
  The normative answer key instead requires G1 at GT bar 19 beats 1, 2.5, and 3
  (`expected/03_Bass.csv`:43-45).
- My primary evaluator therefore generated 531 events but matched **528/531**:
  three produced G2s versus three expected G1s. With a second, extra-spec policy
  that lets an octave-bearing literal bypass the register, the same parser and
  evaluator matched **531/531**, uniquely. This isolates the disagreement to one
  semantic rule rather than an implementation gap.
- Both green prior harnesses implement that extra exception. `simA.py`:72-73 emits
  `m('G1')` directly. `muslang.py`:457-460 evaluates a literal pitch to an integer,
  and `muslang.py`:541-550 returns integers without applying the block register.
  Their agreement therefore does not verify amendment 9.1.4; both agree on a
  different semantics.

The opening “fixture wins” rule (`core-spec-v0.md`:3-5) can be used to infer the
intended exception from the answer key, but that makes the answer key a semantic
input rather than an independent conformance oracle. It also does not cure the
false claim that §9 promoted the fixture ruling into consistent prose.

### 2. A document does not determine its root or metric time, and Fixture C's order stream needs another unstated rule

**Claim attacked:** C3 and L5 (“same document → same events, bit-for-bit,”
`core-spec-v0.md`:33); C4's premise that a clean evaluator can run the documents
from the written specification.

**Severity:** **fatal** to self-contained deterministic evaluation.  
**Confidence:** **high**.

**Evidence:**

- The normalized `Document` requires `root` (`core-spec-v0.md`:48), but §6 defines
  no root declaration or root-selection default. None of A, B, or C declares a
  root. Every evaluator inspected, including mine, receives `FixtureA`,
  `FixtureB`, or `FixtureC` from its harness rather than from the document (for
  example prior `run.py`:28-34, 101-114).
- Metric positions use bars and beats (`core-spec-v0.md`:71-74, 195-207), but the
  data model has no time-signature/meter field and no beats-per-bar default. All
  evaluators silently supply 4 beats per bar; my explicit external choice is
  `cleanroom_mus.py`:19. A different bar length changes every multi-bar onset.
- Amendment 9.1.7 says its defaults join a list “now exhaustive by construction”
  (`core-spec-v0.md`:319-321), so neither omission can be defended as an unstated
  future default.
- The order-only static model says row position is an order index
  (`core-spec-v0.md`:71-74, 138-145), and amendment 9.1.7 says omitted `at` means
  order-index 1 (`core-spec-v0.md`:319-321). Yet all three `Prog` rows omit `at`
  (`fixtures/C_synthetic.mus`:6-7), and C only works if written row order silently
  assigns indices 1, 2, 3. The prior evaluator likewise ignores the parsed row
  positions and enumerates the rows (`muslang.py`:556-564). The meaning of
  `each 1 bar`—onset spacing, event span, and resulting stream length—is never
  specified, although all three are load-bearing for C.

My fixture results necessarily use external root names, 4/4, sequential
written-order indices, and one-bar `each` spans. Those are plausible intended
choices, not consequences of the document alone.

### 3. Fixture B's “positional” end exemption contradicts its own arithmetic

**Claim attacked:** C3 and C4; the v0.2 claim that push-mapping was retired and
replaced by one machine-executable absolute-time rule (`core-spec-v0.md`:351-357;
Fixture B `README.md`:3-9).

**Severity:** **major**.  
**Confidence:** **very high**.

**Evidence:**

- Fixture bar 1 is GT bar 5 and the 12-bar half-open window ends at absolute beat
  48 (`README.md`:2, 5-9).
- Each GT bar-16 beat-4.99 event is at `(16-5)*4 + (4.99-1) = 47.99`, which is
  **before** the end. It does not satisfy “at or past the window end.” Nevertheless
  the README says six such events are the consequence of that positional rule and
  are exempt (`README.md`:5-9).
- Applying the v0.2 words literally (exempt time 0 and time >=48) left **six
  unmatched expected events** after 364 matches: three polysynth tones at
  `expected/03_POLYSYNTH.csv`:26-28 and kick/hat/tambourine at
  `expected/10_DRUMS.csv`:239-241. There were no unmatched produced events after
  the first-grid exclusions.
- Treating the README's enumerated consequence as an additional special case
  produces a unique **364/364** comparison (4 produced and 7 expected events
  exempt). That succeeds, but it silently restores a snap-to-the-next-grid idea
  after amendment 9.6 says push-mapping is retired.
- The strongest prior run exposes the same issue rather than machine-resolving it:
  `run.py B` reports 365 matches, 6 missing, and 3 spurious. `simB.py` reports the
  three produced time-0 drum events and six expected time-48 mapped events. Calling
  that “content-exact modulo window edge” requires a human, fixture-specific
  exception.

The named exceptions make the intended score recoverable, so this is not an
unrecoverable fixture. The claimed general positional policy is still false and
cannot be reused without deciding whether near-edge events are raw positions,
matched positions, or quantized assertions.

### 4. The desugaring table contains one direct contradiction and two non-derivations

**Claim attacked:** C3; specifically that §5's derivations “actually work.”

**Severity:** **major**.  
**Confidence:** **high**.

**Evidence:**

1. `stretch X for W` desugars to `times 1` with `fit = scaleToWindow`
   (`core-spec-v0.md`:182). Amendment 9.1.6 then says a written `for W` on any
   `times N` row is an error unless `W = N × target clock`
   (`core-spec-v0.md`:315-318). Thus the desugaring rejects exactly the different
   window for which `stretch` exists; no `scaleToWindow` exception is stated.
2. `deg(n)` is declared equivalent to `K.tone(n)` (`core-spec-v0.md`:99, 187),
   while `tone(n)` is defined only “on a chord value” (`core-spec-v0.md`:95-98).
   `K` is a key port, not a chord, so the core form is ill-typed unless a second,
   undefined key method is invented.
3. The table claims retired `± steps` has a “key-read + offset” core derivation
   (`core-spec-v0.md`:188), but the only arithmetic is semitone arithmetic. Section
   9.7 later admits diatonic transposition is an expressiveness hole
   (`core-spec-v0.md`:376-378). The changelog nevertheless says `±steps` was
   removed via derivation (`core-spec-v0.md`:384-388).

These operations are not used by A/B/C, so they do not change the computed fixture
counts. They do refute internal consistency of the stated core.

### 5. Several other load-bearing fixture semantics remain open or absent from the normalized model

**Claim attacked:** C3, L5, L7, and amendment 9.1.7's exhaustive-default claim.

**Severity:** **major**.  
**Confidence:** **high**.

**Evidence:**

- Omitted event duration is still `[O — under review]`, although §6 supplies “until
  next row or clock end” (`core-spec-v0.md`:203-206). Every chord row in A omits a
  duration (`encoding.mus`:9-16), and `per` truncation depends on those chord spans.
  In particular, the 15-note refrain-bass result depends on six half-bar spans and
  one four-beat final span. An open default is therefore normative fixture logic.
- A's `compRoot` def has its own range (`encoding.mus`:18), and amendment 9.1.4
  mentions “a def's own registerSpec” (`core-spec-v0.md`:309-312). But the normalized
  `Def` type has no `registerSpec` field (`core-spec-v0.md`:90-93), the row types have
  no row register field, and §6 gives no grammar for either. The fixture syntax is
  the only effective definition.
- All fixture roots and section blocks depend on transparent container merging,
  while container typing remains explicitly open (`core-spec-v0.md`:51-53,
  168-173, 272-279). Output can be inferred for these fixtures, but the normalized
  type of the root is not settled.
- `tone(9)` requires a key but does not say which key to use if more than one
  differently named key port is in scope (`core-spec-v0.md`:95-108). C happens to
  have one, so this ambiguity is outcome-inert there.

The complete fixture-specific choice log is in `semantic-choices.md`; it records
18 such forks and whether each affected current output.

### 6. The prior verification record is non-circular in its strongest form, but the claimed scope and results are overstated

**Claim attacked:** C5 and the “independently machine-verified twice” claims
(`core-spec-v0.md`:295-297, 397-404).

**Severity:** **major**.  
**Confidence:** **high** on code/data flow; **medium** on historical independence.

All eight named scripts were present. Audit by script:

| script | generation source | answer-key access | result / circularity assessment |
|---|---|---|---|
| `evalA.py` | Manually hard-coded chord streams, cells, and events (`evalA.py`:20-270); it does not read `encoding.mus`. | `expected/*.csv` first read at lines 280-286. | No direct answer-to-generator data flow, but manual constants could be tuned. It is stale against the current encoding and currently reaches only 456/531 or 457/531. |
| `evalB.py` | Manually hard-coded cells (`evalB.py`:17-40). | Expected rows read at lines 43-48, then transformed for scoring. | No direct generation circularity; it tests retired push/strum policies and does not establish v0.2 conformance. |
| `gtr_detail.py` | Imports `evalA` and its generated result (`gtr_detail.py`:3-8). | Uses `evalA.load`. | A derivative diagnostic, not an independent evaluator. |
| `simA.py` | Manually hard-coded expansion (`simA.py`:20-124). | Expected rows first read at lines 126-145. | No direct data-flow circularity; 531/531 is obtained with the literal-register exception described in Finding 1. |
| `simB.py` | Manually hard-coded expansion (`simB.py`:11-29). | Expected rows read at lines 31-43. | No direct generation circularity; its own output has the boundary discrepancies. |
| `check.py` | None. | Reads answer keys only (`check.py`:4-44). | Count/duplicate inspection, not a generator or conformance verifier. |
| `muslang.py` | A real tokenizer/parser/evaluator; it has no fixture file reads of its own. | None. | Strongest implementation, but it embeds 4 beats/bar, enumerates order-only rows, and bypasses registers for explicit pitch literals. |
| `run.py` | Reads and renders A/B/C encodings at lines 28-34 and 101-114. | A/B expected directories are loaded after rendering at lines 102-112. | A/B generation is demonstrably non-circular. For C, lines 113-118 only print generated events and count 12; no listed script contains `C_expected.csv` or compares against it. |

Thus I found **no executable path by which an answer key feeds the strongest A/B
generator**. I also found no machine 12/12 comparison for C, no executable v0.2
edge exemption for B, and two supposedly independent A verifiers sharing the same
wrong literal-register semantics. The verification record supports “the encodings
were expanded and inspected,” not the stronger §9.8 statement as written.

### 7. The Billie Jean “complete coverage” claim is arithmetically correct but semantically false

**Claim attacked:** C2 and the 2,093/2,093, zero-leftover claim
(`02_billie_jean_description.md`:111-125).

**Severity:** **major**.  
**Confidence:** **very high**.

**Evidence:**

- The per-track arithmetic is correct: the independently counted window totals
  exactly 2,093. But S7 says the three-note F#–G#–F# mordent occurs **six** times
  while claiming 27 covered notes (`02_billie_jean_description.md`:76-79).
  Twenty-seven notes are **nine** statements, and the CSV contains nine exact
  triples: three across bars 21-22, three across 25-26, and three across 33-34
  (`ground-truth/02_michael_jackson_billie_jean/04_MELODY.csv`:28-36, 43-51,
  80-88). The prose pattern only
  describes two per bar-pair and omits each following-bar tail statement.
- S15 claims all 1,094 drum notes with one essentially unvaried kick/snare/hat/
  tambourine sentence (`02_billie_jean_description.md`:107-109). The count is right,
  but 34 rows are outside those four named MIDI lanes: 24 handclaps (D#2), 7 open
  hats (A#2), one floor tom (G2), one low tom (A2), and one crash (C#3). The 7 open
  hats can generously be included in “hi-hat”; the **24 claps plus 3 crash/tom
  events are still undescribed**. They appear at
  `ground-truth/02_michael_jackson_billie_jean/10_DRUMS.csv`:829-1091.
- S4 says “three staccato chord hits per bar” over bars 13-36 and 45-56 and claims
  216 notes (`02_billie_jean_description.md`:58-64). Those are 36 bars; 216 notes
  are 72 complete triads, exactly **two** chord hits per bar. Three triads per bar
  would require 324 notes. Fixture B's own two-bar `PolyCell` also writes two hits
  in each bar (`fixtures/B_billiejean_bars05-16/encoding.mus`:24-29).

These are not disagreements about harmony or taste; they are countable conflicts
between the sentences and the verified note tables. The table total survives, but
“every sentence points at the notes it accounts for” and “0 leftover” do not.

### 8. The IWTHYH analysis totals are correct, but several asserted musical structures are false against its tables

**Claim attacked:** C2, including the 362/362 and 368/368 semantic-coverage claims.

**Severity:** **major** in aggregate.  
**Confidence:** **high**.

**Evidence:**

- B6 says bridge bars 41-42 reproduce intro bars 6-7 “exactly,” including the bass
  as D-pedal eighths (`01_iwthyh_description.md`:171-175). The intro bass has only
  two long notes—one at each downbeat
  (`ground-truth/01_iwthyh/03_Bass.csv`:4-5). The recap bass has 16 eighth-note
  onsets (`ground-truth/01_iwthyh/03_Bass.csv`:121-136). The reprise is related material, not
  an exact bass reproduction.
- O3 says bass, rhythm guitar, **and lead** descend C–E–D–C–B–A
  (`01_iwthyh_description.md`:193-198). Bass and rhythm guitar do. The lead instead
  begins bar 81 with a G-major triad B2-D3-G3, then plays E-D-C-B-A
  (`ground-truth/01_iwthyh/02_Lead-Gui.csv`:370-377). Its eight-note count acknowledges extra tones, but
  the stated shared six-note descent is false for that part.
- The bridge header calls bars 32-42 “11 bars: 8-bar bridge + ... 2-bar intro-recap”
  (`01_iwthyh_description.md`:142-146), and B6 repeats “8 + ... = 11”
  (`01_iwthyh_description.md`:171-175). The data contains an additional D bar; the
  written arithmetic omits it.
- Part 1's table still says 628/629 with one leftover
  (`01_iwthyh_description.md`:97-111), while the later erratum says the leftover
  count drops to zero (`01_iwthyh_description.md`:206-211). The grace flick is a
  valid explanation, but it was not added to a numbered sentence or the tally, so
  the document's formal coverage artifact remains internally stale.
- S12 says the groove block starts at bar 6 with kick and snare, with hats starting
  at 7 (`01_iwthyh_description.md`:71-79). There are no snare notes at all in bar 6;
  its claimed count of 22 only works because the actual non-fill backbeat begins at
  bar 8.

The raw window totals themselves all passed: Part 1 = 629, bridge = 362, outro =
368. The defect is semantic coverage, not summation.

### 9. “Ground truth” silently chooses FIFO note-off pairing where the MIDI bytes do not identify note instances

**Claim attacked:** C1's strongest reading that every duration/velocity association
is uniquely implied by the MIDI.

**Severity:** **minor** for this language work; A/B onset-pitch fixtures are
unaffected.  
**Confidence:** **high**.

**Evidence:**

- The author's parser pairs a note-off with the oldest open same-channel/same-pitch
  note (`midiparse.py`:75-81), but the artifact README does not record that policy.
- There are 41 overlapping same-key note-ons in Sade and 496 in Nirvana. My FIFO
  parse reproduces every CSV row. Re-running the same parser with LIFO pairing—also
  possible because MIDI note messages carry no instance identifier—changes 64 Sade
  rows and 110 Nirvana rows (174 table rows total), principally duration/velocity
  associations.
- Beatles, Billie Jean, and Genie in a Bottle have zero such overlaps; all onsets,
  pitches, event counts, tracks, tempo, and meter are unaffected in every file.

This is a missing provenance/convention note, not evidence that the chosen FIFO
rendering is unreasonable.

### 10. Smaller fixture/status claims are false or stale

**Claim attacked:** C3 and literal file-status claims.

**Severity:** **minor** (version labeling partly cosmetic).  
**Confidence:** **very high**.

**Evidence:**

- §7 calls Fixture B “371 events, **4 routes**” (`core-spec-v0.md`:243-244). Its
  encoding declares seven routes: bass, poly, synvox, kick, snare, hat, and tamb
  (`encoding.mus`:14, 25, 32, 38-54). There are four expected CSV files, not four
  routes.
- §7 says C exercises “swing provenance” (`core-spec-v0.md`:245-247), but assertion
  scope is onset/pitch only (`core-spec-v0.md`:222-234), and `C_expected.csv` has
  only bar, beat, pitch, and route. The authoring-form transform can exercise swing
  position expansion, but no normative artifact can falsify its provenance chain.
- The file title and opening status still identify “v0.1” and wave-2 review pending
  (`core-spec-v0.md`:1-5, 249-250), while §9 declares normative v0.2 amendments and
  completed two-reviewer verification (`core-spec-v0.md`:293-298, 397-404).
- A/B encoding comments still specify v0.1; B's comments retain retired push-mapping
  (`B.../encoding.mus`:1-8). Comments are explicitly non-normative
  (`core-spec-v0.md`:208), so this is confusion rather than an additional semantic
  failure.

## Attacks attempted that failed

### F1. Independent MIDI extraction attack failed

I parsed all five SMF files directly from bytes, including variable-length deltas,
running status, note-on-zero note-offs, program changes, tempo, time signature, key
signature, the Nirvana 1/4 pickup followed by 4/4, and note pairing. I compared
**26,444 notes** as multisets of `(bar, beat, tick, pitch, name, rounded duration,
velocity, channel)` and compared every `summary.json` field.

Result: every note and every musical/meta field matched. The five MIDI MD5s also
match README lines 11, 22, 34, 46, and 57. The only summary differences are eight
Beatles track-name strings containing trailing padding spaces in the MIDI; the
author deliberately strips them (`midiparse.py`:52-53). I do not regard that as a
musical-fidelity defect. No dangling note-on or unmatched note-off was found.

### F2. Answer-key modification/extraction attack failed

I reconstructed each expected file by preserving the original CSV bytes for the
declared bar windows. All **12/12 expected files are byte-for-byte identical** to
those extracts, including headers, row order, formatting, and line endings.

- A: 531 rows across 8 files. `08_Crash.csv` and `10_Toms.csv` each contain zero
  rows in bars 8-19, as its README claims.
- B: 371 rows across 4 files. All seven omitted note-bearing tracks contain zero
  rows in bars 5-16, as its README claims.

The answer keys are genuine extracts, not edited targets.

### F3. Analysis arithmetic attack mostly failed

Independent window counts exactly reproduced all printed totals:

- IWTHYH bars 3-19: 629.
- IWTHYH bars 32-42: 362.
- IWTHYH bars 74-82: 368.
- Billie Jean bars 3-56: 2,093.

Many targeted musical statements also passed, including IWTHYH's 30-note approach
set, 22 non-fill backbeat snares, recurring refrain grace F, all per-track window
counts, and Billie Jean's three bar-44 melody F4/E# events. Findings 7-8 are specific
semantic counterexamples, not a rejection of every analysis statement.

### F4. Intended-policy fixture expansion attack partly failed

Once I supplied the missing global choices and the fixture-intended exceptions:

- A matched 531/531 uniquely when explicit octave literals bypassed the block
  register.
- B matched 364/364 comparable events uniquely when the README's enumerated first/
  terminal exceptions were implemented.
- C matched 12/12 uniquely under sequential order indices and one-bar `each` spans.

No alternative matching ambiguity was hiding a mismatch: all successful comparisons
were unique bijections by route and pitch within tolerance. This shows the fixtures
are carefully tuned and close to executable; it does not erase the prose conflicts.

### F5. Direct answer-key circularity attack failed against the strongest harness

`run.py` renders A/B from `encoding.mus` before loading their expected directories,
and `muslang.py` has no answer-key reads. My clean-room evaluator has the same
separation (`audit_fixtures.py`:203-229). The manually hard-coded generators are
weaker evidence and could have been tuned, but their source also contains no runtime
answer-key access before generation. I found semantic drift and overclaiming, not a
runtime mechanism that copies expected rows into produced rows.

### F6. Obvious round-2 code-copy attack failed

The round-2 scripts use materially different structures from round 1: `simA/simB`
are short direct simulators, while `muslang.py` is a tokenizer/parser/evaluator.
Line-sequence similarity was low (`evalA`↔`simA` 0.025; `evalB`↔`simB` 0.086), and
round 2 fixes multiple round-1 omissions rather than preserving them. I found no
distinctive copied bug or copied code block. This does not prove blind authorship;
see U1.

## Could not verify

### U1. Historical blindness and reviewer independence

The files have timestamps and different implementations, but no admissible provenance
record establishes who could see which script when. All named files reside in one
scratch directory, and the isolation rules correctly barred me from reading any other
reviewer's transcript or workspace. I therefore cannot verify the word
“independently,” although I found no affirmative evidence of copying.

### U2. Whether the fixture windows were intentionally cherry-picked to hide failures

Intent is not recoverable from the files. The measurable selection bias is strong:
Fixture B is 371 of 6,183 Billie Jean notes (6.0%), ends at bar 16 immediately before
the melody starts at bar 17, and covers the repetitive instrumental build. The melody
alone adds 50 notes in bars 17-28; e.piano, trumpet, strings, and muted guitar enter
later. Fixture A is 531 of 3,114 Beatles notes (17.1%) and covers a verse/refrain, a
broader structural sample. The excluded-track-in-window claims are true, but these
fixtures cannot support a claim of song-scale or weak-clock generality; §8.3 itself
lists song-scale weak-clock fixtures as open (`core-spec-v0.md`:272-279).

### U3. External provenance and record/literature divergences

The supplied MIDI hashes match the README, but the files alone do not establish their
Lakh corpus provenance. Likewise, the Pollack/Hein/Krerowicz/Hooktheory and
record-versus-transcription claims were not pinned to supplied source editions or
audio. I verified claims about the MIDI tables, not those external authorities.

### U4. Full-language conformance beyond the fixture-used subset

There is no reference evaluator, formal grammar, normalized fixture document,
receipt oracle, identity oracle, provenance oracle, or duration/velocity oracle.
Receipts are explicitly deferred (`core-spec-v0.md`:339-342), and multiple major
areas remain `[O]`/`[X]`. I attacked the full prose for contradictions and implemented
the complete subset needed by A/B/C, but cannot verify unexercised behavior such as
`reverse`, `scaleToWindow`, non-4/4 metric time, nontrivial routing inheritance,
identity round-trip, or receipt determinism.

## Overall integrity verdict

**The body of work is not what its strongest claims say it is.** It is a genuine,
substantial **draft** with excellent source-data extraction and authentic answer-key
provenance. I found no evidence that MIDI rows or answer keys were fabricated, and
the strongest A/B generator is not runtime-circular.

It is **not**, however, an internally consistent v0.2 semantics with independently
machine-verified normative fixtures. Fixture A contradicts the promoted literal
register rule; Fixture B's general edge rule cannot produce its named consequence;
the documents omit root and meter; Fixture C depends on unstated order realization;
the desugaring table has broken derivations; and the prior scripts do not perform the
claimed C comparison. Both prose analyses have correct aggregate arithmetic but
confirmed semantic coverage failures.

My assessment is therefore: **high integrity in the extracted data, mixed integrity
in the analyses, and insufficient integrity in the specification/conformance claims.**
The likely failure mode is semantic drift and fixture-driven tuning, not falsified
source data or demonstrated fraud. The opening label “draft, unratified” is accurate;
the later “independently machine-verified” language is not.

Reproduction commands and headline outputs are in `REPRODUCE.md`.

<!-- END AGENT 4 REPORT -->


