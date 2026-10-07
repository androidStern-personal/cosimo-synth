/** Why an H.264 render cannot run in this page's browser, or null when it can. */
export async function missingH264Encoder(page) {
    const supported = await page.evaluate(async () => (await VideoEncoder.isConfigSupported({
        codec: "avc1.640028", width: 1080, height: 1920, bitrate: 1_800_000,
    })).supported === true);
    return supported
        ? null
        : "This browser has no H.264 encoder (Playwright's open-source Chromium ships none), and the MP4 must carry H.264.";
}
