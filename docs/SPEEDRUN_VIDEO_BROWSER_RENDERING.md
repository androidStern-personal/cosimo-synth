# Speedrun video browser rendering

The browser video path is pinned to these exact versions:

- `remotion` 4.0.491
- `@remotion/media` 4.0.491
- `@remotion/web-renderer` 4.0.491
- `mediabunny` 1.50.8 (container verification and decoded-media tests)

The M2 experiment at `experiments/remotion-web-renderer-spike/` proves the
primary V1 path in headless Chromium: one pre-spliced WAV is supplied as a blob
URL to one Remotion `<Audio>`, and `renderMediaOnWeb` returns a verified MP4
with one H.264/AVC track and one AAC track. No server renderer participates.

The production composition must remain a pure function of the current frame
and use the capture-safe phone replica from the architecture plan. This spike
does not authorize mounting the live synth UI inside Remotion.

## Production studio status

The production browser-only pipeline now lives under `ui/speedrun/`. It keeps
the same single-WAV/frame-pure design and verifies the exact output blob before
exposing a download. The Chromium end-to-end gates cover:

- MP4/H.264/AAC as the preferred output;
- the labeled WebM/VP9/Opus fallback;
- exact container and one-video/one-audio track structure;
- duration within two frames/150 ms of the authoritative timeline;
- decoded non-silent audio within every audible section window;
- cancellation and five consecutive render/dispose cycles.

The five-render hardening run kept exactly two live product object URLs after
each settled render and zero after session disposal. Every checkpoint worker
was terminated after its job. The observed settled post-GC heap spread was
1.48 MB; the permanent test enforces a conservative 128 MiB bound to allow for
browser/encoder variation while catching unbounded retention.

Use `npm run speedrun:dev` for the standalone development surface, or
`npm run speedrun:build` followed by `npm run web:serve` and open
`http://127.0.0.1:8123/speedrun/`. The complete operating and verification
guide is in [`ui/speedrun/README.md`](../ui/speedrun/README.md).

## Human licensing decision required

Remotion's licensing and telemetry terms apply to client-side rendering. A
human must confirm Cosimo's applicable Remotion license and production
telemetry/key configuration before this feature is shipped publicly. Passing
the technical renderer gate is not a licensing decision. See the official
[Remotion license and pricing page](https://www.remotion.dev/license) and
[`renderMediaOnWeb` documentation](https://www.remotion.dev/docs/web-renderer/render-media-on-web).
