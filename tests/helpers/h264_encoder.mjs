import { chromium } from "playwright";

/**
 * Launch Chromium for an H.264 suite. Set COSIMO_CHROMIUM_CHANNEL=chrome to run
 * the installed Google Chrome, which carries the H.264 encoder Playwright's own
 * Chromium lacks.
 */
export function launchChromium(options = {}) {
    const channel = process.env.COSIMO_CHROMIUM_CHANNEL?.trim() || undefined;
    return chromium.launch({ headless: true, ...options, channel });
}

/** Why an H.264 render cannot run in this page's browser, or null when it can. */
export async function missingH264Encoder(page) {
    const supported = await page.evaluate(async () => (await VideoEncoder.isConfigSupported({
        codec: "avc1.640028", width: 1080, height: 1920, bitrate: 1_800_000,
    })).supported === true);
    return supported
        ? null
        : "This browser has no H.264 encoder (Playwright's open-source Chromium ships none); set COSIMO_CHROMIUM_CHANNEL=chrome to run the installed Google Chrome.";
}
