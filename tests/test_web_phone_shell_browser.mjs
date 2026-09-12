import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { chromium } from 'playwright';
import { createWebServer } from '../web/server.mjs';

test('web shell keeps the actual phone UI and playable audio through desktop, tablet and phone resizing', async () => {
    const remote = process.env.COSIMO_WEB_BASE_URL || undefined;
    const server = remote ? undefined : createWebServer(process.env.COSIMO_WEB_ROOT ?? 'build/web');
    if (server) await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const url = remote ?? `http://127.0.0.1:${server.address().port}/`;
    const browser = await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
    try {
        const page = await browser.newPage({viewport:{width:1440,height:1000}});
        const errors=[];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(`${url}?test=1`);
        const iframe = page.locator('#cosimo-phone');
        await iframe.waitFor();
        const frame = await (await iframe.elementHandle()).contentFrame();
        await frame.waitForFunction(() => globalThis.__COSIMO_WEB_POC__?.getSnapshot().phase === 'ready');
        assert.equal(await frame.evaluate(() => crossOriginIsolated), true);
        assert.equal(await frame.evaluate(() => new URLSearchParams(location.search).has('test')), true);
        await frame.locator('#cosimo-start-overlay').click();
        await frame.waitForFunction(() => globalThis.__COSIMO_WEB_POC__?.getSnapshot().hasActiveTable);
        await frame.locator('cosimo-react-desktop-keyboard #note48').hover();
        await page.mouse.down();
        try {
            await frame.waitForFunction(() => globalThis.__COSIMO_WEB_POC__?.getSnapshot().audioPeak > 0.00001);
        } finally { await page.mouse.up(); }
        for (const viewport of [{width:1440,height:1000},{width:768,height:1024},{width:390,height:844}]) {
            await page.setViewportSize(viewport);
            await frame.waitForFunction(() => Boolean(document.querySelector('cosimo-desktop-react-view')?.shadowRoot?.querySelector('.is-mobile-shell')));
            const box=await iframe.boundingBox();
            assert.ok(box.width <= 430 && box.width > 0);
            assert.ok(Math.abs(box.x + box.width/2 - viewport.width/2) < 1);
            assert.ok(box.y >= 0 && box.y + box.height <= viewport.height + 1);
            assert.equal(await page.locator('.phone-note').isVisible(), viewport.width >= 640);
            assert.equal(await frame.evaluate(() => matchMedia('(max-width: 639px)').matches), true);
            assert.equal(await frame.evaluate(() => globalThis.__COSIMO_WEB_POC__.getSnapshot().phase), 'running', 'resizing must not restart the instrument');
            await page.screenshot({path:path.resolve(`build/cosimo-phone-${viewport.width}.png`)});
        }
        // Shared sound links must still target the public page, and a consumed
        // link must clear from both documents rather than replay on refresh.
        const preset = frame.locator('cosimo-preset-bar');
        await preset.locator('[data-el="shell-more"]').click();
        await preset.locator('[data-el="menu-share"]').click();
        await preset.locator('[data-el="share-dialog"]').waitFor({state:'visible'});
        const link = await preset.locator('[data-el="share-link"]').inputValue();
        assert.equal(new URL(link).pathname, new URL(url).pathname);
        assert.ok(new URL(link).hash.startsWith('#p='));
        await page.goto(link);
        await page.reload();
        const restored = await (await page.locator('#cosimo-phone').elementHandle()).contentFrame();
        await restored.waitForFunction(() => globalThis.__COSIMO_WEB_POC__?.getSnapshot().phase === 'ready');
        await restored.locator('#cosimo-start-overlay').click();
        await restored.locator('cosimo-preset-bar [data-action="shared-load-confirm"]').click();
        await restored.waitForFunction(() => location.hash === '');
        assert.equal(new URL(page.url()).hash, '');
        assert.deepEqual(errors, []);
    } finally {
        await browser.close();
        if(server) await new Promise(resolve => server.close(resolve));
    }
});
