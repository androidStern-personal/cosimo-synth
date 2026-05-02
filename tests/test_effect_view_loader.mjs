import test, { afterEach } from "node:test";
import assert from "node:assert/strict";

import {
    canLoadEffectDevServer,
    EFFECT_DEV_STATUS_PATH,
} from "../ui/shared/effects/effect-view-loader.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
    globalThis.fetch = originalFetch;
});

function installStatusResponse(status) {
    globalThis.fetch = async (url) => {
        assert.equal(url, `http://effect-dev.test${EFFECT_DEV_STATUS_PATH}`);

        return {
            ok: true,
            async json() {
                return status;
            },
        };
    };
}

test("effect dev loader accepts a server that serves the requested module", async () => {
    installStatusResponse({
        kind: "fx-vite-dev-server",
        plugins: [
            {
                name: "spectral_chord_resonator",
                sourceModule: "/fx/spectral_chord_resonator/view/source.js",
            },
        ],
    });

    assert.equal(
        await canLoadEffectDevServer(
            "http://effect-dev.test/",
            25,
            "/fx/spectral_chord_resonator/view/source.js",
        ),
        true,
    );
});

test("effect dev loader rejects a stale server from another worktree", async () => {
    installStatusResponse({
        kind: "fx-vite-dev-server",
        plugins: [
            {
                name: "ott_lab",
                sourceModule: "/fx/ott_lab/view/source.js",
            },
        ],
    });

    assert.equal(
        await canLoadEffectDevServer(
            "http://effect-dev.test/",
            25,
            "/fx/spectral_chord_resonator/view/source.js",
        ),
        false,
    );
});

test("effect dev loader rejects malformed status even when port is reachable", async () => {
    installStatusResponse({
        kind: "not-the-fx-dev-server",
        plugins: [
            {
                name: "spectral_chord_resonator",
                sourceModule: "/fx/spectral_chord_resonator/view/source.js",
            },
        ],
    });

    assert.equal(
        await canLoadEffectDevServer(
            "http://effect-dev.test/",
            25,
            "/fx/spectral_chord_resonator/view/source.js",
        ),
        false,
    );
});
