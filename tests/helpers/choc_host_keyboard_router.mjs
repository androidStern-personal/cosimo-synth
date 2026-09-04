import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const ROUTER_START = 'R"CHOCKEYJS(\n';
const ROUTER_END = '\n)CHOCKEYJS"';

export async function readChocHostKeyboardRouter(chocSourceRoot) {
    assert.equal(
        typeof chocSourceRoot === "string" && path.isAbsolute(chocSourceRoot),
        true,
        "COSIMO_CHOC_SOURCE_ROOT must name an absolute CHOC source checkout.",
    );

    const headerPath = path.join(chocSourceRoot, "choc/gui/choc_WebView.h");
    const header = await readFile(headerPath, "utf8");
    const start = header.indexOf(ROUTER_START);

    assert.notEqual(start, -1, `${headerPath} does not contain the CHOC host-keyboard router.`);
    assert.equal(
        header.indexOf(ROUTER_START, start + ROUTER_START.length),
        -1,
        `${headerPath} contains more than one CHOCKEYJS block.`,
    );

    const scriptStart = start + ROUTER_START.length;
    const end = header.indexOf(ROUTER_END, scriptStart);
    assert.notEqual(end, -1, `${headerPath} has an unterminated CHOCKEYJS block.`);

    const router = header.slice(scriptStart, end);
    assert.match(router, /forwardBufferedEventToHost/);
    assert.match(router, /discardBufferedEvent/);
    assert.match(router, /matching-forwarded-keyup/);
    assert.match(router, /installSelectFocusReleaseForFutureShadowRoots/);

    return {
        headerPath,
        router,
    };
}
