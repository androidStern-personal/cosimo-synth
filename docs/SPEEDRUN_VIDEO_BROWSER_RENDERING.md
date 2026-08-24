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

## Human licensing decision required

Remotion's licensing and telemetry terms apply to client-side rendering. A
human must confirm Cosimo's applicable Remotion license and production
telemetry/key configuration before this feature is shipped publicly. Passing
the technical renderer gate is not a licensing decision. See the official
[Remotion license and pricing page](https://www.remotion.dev/license) and
[`renderMediaOnWeb` documentation](https://www.remotion.dev/docs/web-renderer/render-media-on-web).
