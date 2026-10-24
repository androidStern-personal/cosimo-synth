/**
 * Save, in the open synth page, a sound already bounced to one 5 second root
 * of a 220 Hz tone at middle C: its bank in the browser bank store and the
 * sound itself where the web synth restores it on the next load. `defaults`
 * is the current synth's saved sound from createCurrentSpeedrunContext().
 */
export function persistOneRootBounce(page, defaults) {
    return page.evaluate(async (sound) => {
        const [{ buildBounceBank, encodeBounceBank }, { createBrowserBounceBankStore }, { digestBounceBank }, documentModule] = await Promise.all([
            import("./bounce/bank-format.mjs"),
            import("./bounce/browser-bank-store.mjs"),
            import("./bounce/digest.mjs"),
            import("./bounce/document.mjs"),
        ]);
        const frameCount = 240_000;
        const samples = new Int16Array(frameCount * 2);
        for (let frame = 0; frame < frameCount; frame += 1) {
            const sample = Math.round(Math.sin((frame * Math.PI * 2 * 220) / 48_000) * 1_500);
            samples[frame * 2] = sample;
            samples[(frame * 2) + 1] = sample;
        }
        const bytes = encodeBounceBank(buildBounceBank({ sampleRate: 48_000, roots: [{ note: 60, samples }] }));
        const digest = await digestBounceBank(bytes);
        const persistence = await createBrowserBounceBankStore().put(digest, bytes);
        const bounce = documentModule.parseBounceDocument({
            format: "cosimo.bounce",
            version: 1,
            digest,
            bankByteLength: bytes.byteLength,
            roots: [60],
            segments: [{ rootNote: 60, frameOffset: 0, frameCount, noteOffFrameOffset: 120_000 }],
            capture: { sampleRate: 48_000, tempoBpm: 120, velocity: 100, holdFrames: 120_000, tailCapFrames: 120_000 },
            generation: 1,
            revertRef: {
                bankDigest: null,
                patchDocument: documentModule.createBouncePatchDocument({
                    parameters: { filterMode: 0, sourceMode: 0 },
                    storedState: { [documentModule.BOUNCE_STATE_KEY]: null },
                }),
            },
        });
        localStorage.setItem("cosimo.web.patch-state.v2", JSON.stringify({
            format: "cosimo.browserPatchState",
            version: 5,
            sound: {
                parameters: { ...sound.parameters, ampRelease: 0.2, filterMode: 0, sourceMode: 1 },
                storedState: {
                    "modulation.v6": sound.modulation,
                    "articulations.v4": sound.articulations,
                    "lane.v1": sound.lane,
                    [documentModule.BOUNCE_STATE_KEY]: documentModule.serializeBounceDocument(bounce),
                },
            },
        }));
        return { digest, persistence };
    }, defaults);
}
