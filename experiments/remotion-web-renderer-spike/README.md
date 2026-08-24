# Remotion browser renderer spike (M2)

This throwaway composition answers the two design forks that had to be proven
before the real speedrun pipeline:

1. Can `@remotion/web-renderer` consume one blob-URL WAV through
   `@remotion/media`?
2. Can headless Chromium return a real MP4 containing H.264/AVC video and AAC
   audio while capturing the chosen replica primitives (SVG, canvas, text)?

Run the complete build/render/verification gate:

```sh
npm run test:spike:remotion:web
```

The test renders 300 frames (10 seconds at 30 fps, 640x360) wholly in the
browser via `renderMediaOnWeb`. It then uses Mediabunny against the returned
Blob to require:

- an MP4 duration between 9.9 and 10.1 seconds;
- exactly one AVC/H.264 video track and one AAC audio track;
- a non-silent decoded audio window around the five-second pulse;
- non-flat decoded video plus material pixel change between two frames.

Qualifying run on 2026-08-24:

- duration: 10.0693 seconds;
- MP4: 372,884 bytes;
- render call: 2,142 ms;
- audio window: 15,360 decoded frames, RMS 0.18532;
- decoded-frame minimum luma variance: 487.95;
- decoded-frame mean absolute difference: 5.00;
- tracks/codecs: one `avc`, one `aac`.

The encoded SHA-256 is logged by the test for artifact identity, not used as a
gate: browser encoders are not required to produce byte-identical output.

The first run reached MP4 verification but the verifier itself rejected its
downscaled `CanvasSink` options because Mediabunny requires an explicit `fit`
when both width and height are supplied. Adding `fit: "fill"` corrected the
strict verifier; no renderer fallback was needed. F2 remains blob-URL master
audio and F3 remains MP4/H.264/AAC.
