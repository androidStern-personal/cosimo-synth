import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { build } from 'esbuild';
import { parseEnhanceThatArgs } from '../scripts/build_enhance_that_release.mjs';

test('variant selection is explicit, full by default, with independent numeric version', () => {
    assert.equal(parseEnhanceThatArgs([]).variant, 'full');
    assert.equal(parseEnhanceThatArgs(['--variant', 'trial', '--version', '0.1.7']).version, '0.1.7');
    assert.throws(() => parseEnhanceThatArgs(['--variant', 'trail']));
    assert.throws(() => parseEnhanceThatArgs(['--version', '../x']));
});

test('trial dialog dismisses, reopens, stays local until purchase and uses the native checkout bridge', async () => {
    const result = await build({ entryPoints: ['fx/enhancer_lite/view/trial.ts'], bundle: true, write: false, format: 'iife', globalName: 'Trial', target: 'es2022' });
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage();
        await page.setContent('<main></main>');
        await page.addScriptTag({ content: result.outputFiles[0].text });
        await page.evaluate(() => {
            window.opened = 0;
            window.enhance_openCheckout = async () => { window.opened++; return true; };
            window.dialog = Trial.createTrialReminder();
            document.querySelector('main').append(window.dialog);
            window.dialog.showModal();
        });
        assert.equal(await page.getByRole('dialog').count(), 1);
        assert.equal(await page.evaluate(() => window.opened), 0);
        await page.getByRole('button', { name: 'Continue trial' }).click();
        assert.equal(await page.getByRole('dialog').count(), 0);
        await page.evaluate(() => window.dialog.showModal());
        await page.getByRole('link', { name: 'Buy Builder Kit' }).click();
        assert.equal(await page.evaluate(() => window.opened), 1);
        await page.keyboard.press('Escape');
        assert.equal(await page.getByRole('dialog').count(), 0);
    } finally { await browser.close(); }
});

for (const variant of ['trial', 'full']) {
    test(`${variant} editor build contains the reminder only when selected`, async () => {
        const result = await build({ entryPoints: ['fx/enhancer_lite/view/source.ts'], bundle: true, write: false, format: 'esm',
            define: { 'import.meta.env.VITE_ENHANCE_THAT_TRIAL': JSON.stringify(variant === 'trial' ? '1' : '0') }, minify: true });
        assert.equal(result.outputFiles[0].text.includes("You're using the trial version."), variant === 'trial');
    });
}
