import path from "node:path";

import { createWebServer } from "../../web/server.mjs";

/** The built web synth, `npm run web:build`. */
export const webRoot = path.resolve(import.meta.dirname, "../..", "build", "web");

/**
 * Serve a directory through the product web server, whose cross-origin
 * isolation headers the synth's shared-memory engine needs.
 */
export async function startProductWebServer(directory = webRoot) {
    const server = createWebServer(directory);
    await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
    });
    return {
        baseUrl: `http://127.0.0.1:${server.address().port}/`,
        close: () => new Promise((resolve) => server.close(resolve)),
    };
}
