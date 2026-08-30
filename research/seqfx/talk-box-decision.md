# SeqFX Talk Box decision and implementation evidence

Date: 2026-08-30

## Authority

Documented facts:

- Koala FX publicly names this effect a “Talkbox formant filter.” Its public
  contract does not describe a carrier input, sidechain, or vocoder topology.
  <https://www.elf-audio.com/koalafx/>
- Kilohearts Formant Filter describes the effect as two boosted frequencies
  used to mimic vowel sounds. Its public controls select the vowel pair, set Q,
  and let low and high source frequencies through.
  <https://kilohearts.com/products/formant_filter>
- Peterson and Barney's 1952 primary vowel study reports measured first and
  second formants. SeqFX uses its adult-male mean targets for five familiar
  English vowel categories: A=/ɑ/ at 730/1090 Hz, E=/ɛ/ at 530/1840 Hz,
  I=/i/ at 270/2290 Hz, O=/ɔ/ at 570/840 Hz, and U=/u/ at 300/870 Hz.
  <https://pure.mpg.de/pubman/item/item_2375480/component/file_2375479/Peterson_Barney_1952_Control.pdf>

The sources establish the effect identity, two-resonance vocabulary, vowel
targets, Q, and low/high passthrough. They do not establish Koala's private
coefficients, gain staging, crossover frequencies, saturation, or smoothing.

## SeqFX product decision

Talk Box is a block-sequenced gated formant filter at append-only ID 9. It is
not a physical talk-box model and not a carrier/modulator vocoder. That keeps it
honest with Koala's published name and with SeqFX's single stereo input.

Its public controls are:

- From and To: A, E, I, O, or U, trigger-latched;
- Morph: 0–100%, continuously moving both formants;
- Resonance: Q 1–20;
- Lows and Highs: 0–100% source passthrough outside the formant band;
- Drive: 0–12 dB of bounded pre-filter excitation;
- the common per-block Mix.

Formants interpolate geometrically, not linearly in hertz, so the Morph control
moves on a perceptual/log-frequency path. Two stable Simper band-pass filters
run in parallel per channel. Their state remains warm through normal gating;
triggering a new block latches only the two vowel choices and does not clear
filter history. Common 96-frame mix smoothing owns entry and exit.

The 180 Hz low crossover, 3 kHz high crossover, formant make-up rule, and soft
saturation curve are explicit engineering choices. They preserve useful body
and intelligibility around the two resonances while keeping Q 20 bounded. Drive
is a SeqFX character control rather than a claimed competitor match.

## Automated evidence

`tests/test_seqfx_probe.py` proves:

- each of the five vowel endpoints places both dominant response peaks within
  12 Hz of its frozen Peterson-Barney targets;
- the A-to-I midpoint follows geometric/log formant interpolation;
- Lows and Highs restore source energy below 180 Hz and above 3 kHz;
- extreme Q and Drive remain finite and bounded;
- retriggering does not reset warm formant-filter history.

`tests/test_seqfx_talk_box_contract.mjs` keeps the UI formant table and morph
math locked to the same public contract. `tests/test_seqfx_patch_view_browser.mjs`
proves that all seven controls sequence and persist, vowel selectors are absent
from live Aux modulation, continuous controls are available, and the block
renders a parameter-derived two-formant glyph. The packaged shadow-root browser
test repeats the inspector, modulation, glyph, and overflow checks against the
production bundle.

Source/build qualification completed for this slice:

- Cmajor compile at 48 kHz;
- focused Talk Box DSP tests: 10 passing;
- focused contract/state/browser tests: passing;
- SeqFX production source and worker bundle build;
- packaged shadow-root Talk Box inspector proof.

Subjective speech/saw listening, matched-level preset tuning, Ableton
save/reopen, installed VST3, pluginval, and release qualification remain later
roadmap gates and are not inferred from these tests.
