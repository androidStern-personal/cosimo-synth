# Bounce Video M4: real-UI integration and acceptance artifact

Date: 2026-08-24  
Branch: `claude/video-bounce-ui-animation-7trtmw`

## Outcome

The existing preset-menu `Bounce Video` flow now renders the production
`DesktopPatchView` through the approved scripted session. The launcher,
current-patch-only contract, fixed flow shell, and lazy bundle boundary are
unchanged.

The shipped video-bundle default is `compositionMode: "scripted"`. Building
that bundle with `VITE_COSIMO_VIDEO_BOUNCE_REPLICA=1` selects the untouched
replica as the temporary fallback required by the plan. No replica source was
deleted, refactored, or used by the default path.

No product prop forces a transient UI state. The real connection events,
synthetic pointers, HUDs, drags, panels, playback graphics, media-time UI
callbacks, and WAAPI animations remain the sources of captured state. Reduced
motion is not enabled.

## MP4 failure and fix

The first integrated scripted render completed all frames, then the parent
pipeline verifier reported `blob must be a Blob`. The renderer's result was a
real Blob, but it had been constructed in the child iframe. JavaScript built-in
identity is realm-specific, so Mediabunny's parent-window `instanceof Blob`
guard rejected the child-window object.

`renderScriptedVideoInIframe` now reads the completed bytes and creates an
equivalent Blob in the parent realm before removing the iframe. This is a
boundary/ownership correction after rendering; it does not change pixels,
audio, format selection, or architecture. With that fix, both WebM and MP4
complete the existing pipeline verification.

## Integrated visual gate

`tests/test_video_bounce_integration_browser.mjs` now samples the live capture
iframe during the real integrated flow. Every sample must find the production
Cosimo surface and must not find the replica surface.

| Render frame | Stage | Iframe viewport | Canvases | SVGs | Keys | Selected workspace | Real / replica |
| ---: | --- | --- | ---: | ---: | ---: | --- | --- |
| 0 | 1080×1920 | 393×852 | 2 | 23 | 18 | Voice | yes / no |
| 30 | 1080×1920 | 393×852 | 2 | 29 | 18 | Voice | yes / no |
| 60 | 1080×1920 | 393×852 | 2 | 29 | 18 | Voice | yes / no |

The same test decodes the downloadable video at the beginning, midpoint, and
end. It asserts 1080×1920 metadata, three distinct pixel hashes, richly
nonblank/colorful synth frames at the first two samples, the intentionally
sparse but nonblank end card, and visible change between samples. The threshold
is expressed in decoded-pixel space and works for both high-quality MP4 and
low-quality WebM; it is not tied to one codec's quantization noise.

## Acceptance MP4

Path: `build/video-bounce/cosimo-real-ui-bounce.mp4`

| Property | Verified value |
| --- | --- |
| Bytes | 803,439 |
| SHA-256 | `4cb84e0c236af278d7e0b59ca9beb02782c49589d0e0a027f38977daa0cc8991` |
| Container | ISO BMFF / MP4 (`ftyp` signature) |
| Video | H.264, 1080×1920 |
| Audio | AAC, stereo, 48 kHz |
| Duration | 4.821333 s |
| Product verification | one video track, one audio track, expected codecs, duration tolerance, decoded non-silent audio window per timeline section |
| Independent audio probe | 462,848 decoded samples; mean -58.5 dB, peak -38.2 dB |

Decoded-frame evidence from this exact MP4:

| Time | RGBA SHA-256 | Luma stddev | Center stddev | Color ratio | Mean delta |
| ---: | --- | ---: | ---: | ---: | ---: |
| 0.100000 s | `436e3dbf81e305dd9e1aef4a909b58d44b03c40a6b5cf712ff8c44522ca5eab5` | 32.2593 | 43.0812 | 0.15861 | — |
| 2.410667 s | `3e326bbf13bc055064cac4014d644e9257e2c2a6eb9d4b11b64270f606e250df` | 32.4431 | 43.1809 | 0.16556 | 1.2993 |
| 4.621333 s | `1986aaa605c4de5aa57da72375905e4213a0505f9bc2b79b05fa234780adb7e8` | 4.2424 | 5.8201 | 0.00025 | 17.0544 |

The MP4 integration gate passed 1/1 in 64.9 seconds on the small Linux VM.
That wall time is full-resolution export throughput and is not interpreted as
a hard product rejection; Mac and iOS hardware are expected to be faster.

## Lazy-bundle assessment

Both build variants pass in production mode. The default scripted build is:

| Asset | Raw | gzip |
| --- | ---: | ---: |
| `video-bounce/index.js` | 5,110,546 B | ~1,392,070 B |
| `video-bounce/style.css` | 1,242,570 B | ~813,820 B |

These assets are requested only after the user chooses `Bounce Video`; synth
startup remains outside this bundle. The size increase is the expected cost of
shipping the real production view and its styles in the already-approved lazy
boundary. Gzip values are Vite's production-build estimates. No second eager
React/product bundle was added to startup.

## Gate status

- Default scripted production build: pass.
- `VITE_COSIMO_VIDEO_BOUNCE_REPLICA=1` fallback production build: pass.
- Integrated current-patch WebM flow with sampled real-UI and decoded-frame
  assertions: pass.
- Integrated current-patch high-quality MP4 flow, saved acceptance artifact,
  internal container/codec/duration/audio verification, and independent
  `ffprobe`/`ffmpeg` inspection: pass.
- M0–M3 product, pipeline, determinism, gesture, and Bounce Audio evidence
  remains recorded in the preceding milestone documents and commits.
- The replica's pre-existing Chromium-147 exact-PNG mismatch remains confined
  to its untouched browser-version golden; its behavioral/frame-purity gates
  were green at M3.

M4's technical work is complete. The final gate is the user's visual
acceptance of the MP4. The replica stays behind the build flag until that
decision. Separately, the recorded Remotion licensing hold still requires a
human decision before public shipment.
