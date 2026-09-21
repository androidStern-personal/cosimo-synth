import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';
import path from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const root = path.resolve(import.meta.dirname, '../..');
let server, browser, base;
before(async () => {
    server = await createServer({ configFile: path.join(root, 'kit/examples/knobs/vite.config.mjs'),
        server: { host: '127.0.0.1', port: 0, strictPort: false, open: false }, logLevel: 'error' });
    await server.listen();
    base = `http://127.0.0.1:${server.httpServer.address().port}`;
    browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); await server?.close(); });

async function withPage(run, options = {}) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 960 }, ...options });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    try { await page.goto(base); await page.locator('#default [role=slider]').first().waitFor(); await run(page); assert.deepEqual(errors, []); }
    finally { await page.close(); }
}
const value = async locator => Number(await locator.getAttribute('aria-valuenow'));
async function drag(page, locator, dx, dy, shift = false) {
    await locator.scrollIntoViewIfNeeded();
    const box = await locator.boundingBox(); assert.ok(box);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    if (shift) await page.keyboard.down('Shift');
    await page.mouse.down();
    await page.mouse.move(x + Math.sign(dx) * 10, y + Math.sign(dy) * 10);
    await page.mouse.move(x + dx, y + dy, { steps: 5 });
    await page.mouse.up();
    if (shift) await page.keyboard.up('Shift');
}

test('defaults are labelled sliders; pointer editing, fine adjustment and clamping work', async () => withPage(async page => {
    const gain = page.getByRole('slider', { name: 'Gain', exact: true });
    assert.equal(await value(gain), .62);
    await drag(page, gain, 0, -54); assert.ok(Math.abs(await value(gain) - .82) < .005);
    const before = await value(gain);
    await drag(page, gain, 0, 54, true); assert.ok(Math.abs(await value(gain) - (before - .02)) < .005);
    await gain.press('End'); assert.equal(await value(gain), 1);
    await gain.press('ArrowUp'); assert.equal(await value(gain), 1);
    await gain.press('Home'); assert.equal(await value(gain), 0);
}));

test('logarithmic, bipolar, stepped and custom scale controls preserve their domains', async () => withPage(async page => {
    const log = page.getByRole('slider', { name: 'Cutoff', exact: true });
    await log.press('Home'); await log.press('PageUp');
    assert.ok(Math.abs(await value(log) - 20 * 1000 ** .1) < .0001);
    const bipolar = page.getByRole('slider', { name: 'Bipolar trim' });
    await bipolar.press('ArrowUp'); assert.equal(await value(bipolar), -5.5);
    const choice = page.getByRole('slider', { name: 'Filter mode' });
    await choice.press('Shift+ArrowRight'); assert.equal(await value(choice), 2);
    assert.equal(await choice.getAttribute('aria-valuetext'), 'Band-pass');
    const custom = page.getByRole('slider', { name: 'Custom response' });
    await custom.press('PageUp'); assert.ok(Math.abs(await value(custom) - 36) < .0001);
}));

test('exact entry validates units and bounds and Escape discards only the draft', async () => withPage(async page => {
    const input = page.getByRole('textbox', { name: 'Exact frequency' });
    const knob = page.getByRole('slider', { name: 'Frequency', exact: true });
    await input.fill('2.5 kHz'); await input.press('Enter'); assert.equal(await value(knob), 2500);
    await input.fill('8 bananas'); await input.press('Enter');
    assert.equal(await input.getAttribute('aria-invalid'), 'true'); assert.equal(await value(knob), 2500);
    await input.fill('22000 Hz'); await input.press('Enter'); assert.equal(await value(knob), 2500);
    await input.press('Escape'); assert.equal(await input.inputValue(), '2500');
    assert.equal(await input.getAttribute('aria-invalid'), null);
    await input.fill('500'); await input.press('Tab'); assert.equal(await value(knob), 500);
}));

test('live marker moves without parent renders, uses the log scale, hides and remounts', async () => withPage(async page => {
    const section = page.locator('#live');
    await section.scrollIntoViewIfNeeded();
    const marker = section.locator('[data-slot=knob-marker]');
    await marker.waitFor();
    await page.waitForFunction(() => document.querySelector('#live [data-slot=knob-marker]')?.getAttribute('data-active') === 'true');
    const x = await marker.getAttribute('cx');
    const renders = await section.getByTestId('live-renders').textContent();
    await page.waitForFunction(old => document.querySelector('#live [data-slot=knob-marker]')?.getAttribute('cx') !== old, x);
    assert.equal(await section.getByTestId('live-renders').textContent(), renders);
    const knob = section.getByRole('slider', { name: 'Modulated cutoff' });
    assert.equal(await value(knob), 800);
    await drag(page, knob, 0, -40); assert.ok(await value(knob) > 800);
    await section.getByRole('button', { name: 'Stop signal' }).click();
    await page.waitForFunction(() => document.querySelector('#live [data-slot=knob-marker]')?.getAttribute('data-active') === 'false');
    await section.getByRole('button', { name: 'Detach knob' }).click(); assert.equal(await marker.count(), 0);
    await section.getByRole('button', { name: 'Attach knob' }).click();
    await section.getByRole('button', { name: 'Start signal' }).click();
    await page.waitForFunction(() => document.querySelector('#live [data-slot=knob-marker]')?.getAttribute('data-active') === 'true');
}));

test('two-axis dragging rolls ownership without a switching jump; disabled second axis is inert', async () => withPage(async page => {
    const section = page.locator('#two-axis'); const knob = section.getByRole('slider', { name: 'Value & depth' });
    await knob.scrollIntoViewIfNeeded(); const box = await knob.boundingBox();
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x,y); await page.mouse.down();
    await page.mouse.move(x+10,y); await page.mouse.move(x+54,y,{steps:4});
    const base = await value(knob); assert.ok(base > .6);
    await page.mouse.move(x+54,y-16); // classifies the new axis; consumes this sample
    assert.equal(await value(knob), base);
    const input = section.getByRole('slider', { name: 'Secondary depth' });
    assert.equal(Number(await input.inputValue()), .25);
    await page.mouse.move(x+54,y-48,{steps:3}); await page.mouse.up();
    assert.ok(Number(await input.inputValue()) > .25); assert.equal(await value(knob),base);
    await section.getByRole('checkbox').uncheck();
    const previous = Number(await input.inputValue()); await drag(page,knob,0,-45);
    assert.equal(Number(await input.inputValue()),previous); assert.equal(await value(knob),base);
}));

test('context menu composes pointer behavior, keyboard opening, selection and focus return', async () => withPage(async page => {
    const knob = page.locator('#menu').getByRole('slider', { name: 'Output' });
    await knob.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Reset' }).click(); assert.equal(await value(knob), .5);
    await knob.focus(); await knob.press('Shift+F10');
    await page.getByRole('menuitem', { name: 'Mute', exact: true }).click(); assert.equal(await value(knob), 0);
    await knob.press('ArrowUp'); assert.ok(await value(knob) > 0);
    await knob.press('Shift+F10'); await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('menu').count(),0);
}));

test('custom asChild artwork keeps shared value and keyboard/pointer behavior', async () => withPage(async page => {
    const first = page.getByRole('slider', { name: 'Custom dial' });
    const second = page.getByRole('slider', { name: 'Custom meter' });
    await first.press('ArrowUp'); assert.equal(await value(second), .51);
    await drag(page, second, 0, -54); assert.ok(Math.abs(await value(first) - .71)<.005);
    assert.equal(await second.evaluate(el=>el.tagName),'BUTTON');
}));

async function verifyCustomStyling(page) {
    const meter = page.getByRole('slider', { name: 'Custom meter' });
    const tile = page.locator('.custom-meter-tile');
    const styles = locator => locator.evaluate(el => {
        const s = getComputedStyle(el);
        return { radius: s.borderRadius, width: s.width, shadow: s.boxShadow, filter: s.filter, outline: s.outlineStyle };
    });
    // No radius reset on the custom input: the kit must not impose a circle.
    assert.equal((await styles(meter)).radius, '0px');
    assert.equal((await styles(meter)).width, '88px');
    await meter.click();
    assert.equal(await tile.getAttribute('data-selected'), 'true');
    assert.equal((await styles(tile)).filter, 'none');
    assert.equal((await styles(meter)).filter, 'none');
    await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
    assert.equal(await meter.evaluate(el => el.matches(':focus-visible')), true);
    assert.equal((await styles(tile)).outline, 'solid');
    assert.equal((await styles(meter)).outline, 'none');
    const source = page.getByRole('button', { name: 'Drag source', exact: true });
    await source.hover(); await page.mouse.down();
    await meter.hover(); await meter.hover();
    await page.waitForFunction(() => document.querySelector('.custom-meter-tile')?.dataset.hovered === 'true');
    assert.notEqual((await styles(tile)).shadow, 'none');
    assert.equal((await styles(meter)).shadow, 'none');
    assert.equal((await styles(meter)).radius, '0px');
    await page.mouse.up();
    assert.equal(await page.locator('#custom [role=status]').textContent(), 'Source assigned');
    await drag(page, meter, 0, -32);
    assert.ok(await value(meter) > .5);
    assert.equal((await styles(meter)).shadow, 'none');
}

test('custom control owns its shape; selection, drop highlight and keyboard focus have one visual owner', async () => withPage(async page => {
    const gain = page.getByRole('slider', { name: 'Gain', exact: true });
    assert.equal(await gain.evaluate(el => getComputedStyle(el).borderRadius), '50%');
    await gain.focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
    assert.equal(await gain.evaluate(el => getComputedStyle(el).outlineStyle), 'solid');
    await verifyCustomStyling(page);
}));

test('read-only and disabled cannot edit but both follow external updates', async () => withPage(async page => {
    const section=page.locator('#states');
    const locked=section.getByRole('slider',{name:'Read-only'}), disabled=section.getByRole('slider',{name:'Disabled'});
    await locked.press('ArrowUp'); await drag(page,locked,0,-54); assert.equal(await value(locked),.5);
    assert.equal(await disabled.getAttribute('tabindex'),'-1'); assert.equal(await disabled.isDisabled(),true);
    await section.getByRole('slider',{name:'External value'}).fill('0.8');
    assert.equal(await value(disabled),.8); assert.equal(await value(locked),.8);
}));

test('horizontal sensitivity and explicit keyboard increments are honored', async () => withPage(async page => {
    const knob=page.getByRole('slider',{name:'Horizontal drag'});
    await drag(page,knob,74,0); assert.ok(Math.abs(await value(knob)-70)<.005);
    await knob.press('ArrowRight'); assert.equal(await value(knob),75);
    await knob.press('Shift+ArrowRight'); assert.equal(await value(knob),75.5);
}));

test('one drag is one history entry and undo restores its initial value', async () => withPage(async page => {
    const section=page.locator('#gestures'), knob=section.getByRole('slider',{name:'Gesture grouping'});
    await drag(page,knob,0,-65); assert.ok(await value(knob)>.5);
    await section.getByRole('button',{name:'Undo (1)'}).click(); assert.equal(await value(knob),.5);
    await knob.focus(); await page.keyboard.down('ArrowUp'); await page.keyboard.down('ArrowUp'); await page.keyboard.down('ArrowUp');
    await page.keyboard.up('ArrowUp');
    assert.equal(await section.getByRole('button',{name:'Undo (1)'}).count(),1);
}));

test('lost capture and Escape each close a drag once while preserving accepted changes', async () => withPage(async page => {
    const section=page.locator('#gestures'), knob=section.getByRole('slider',{name:'Gesture grouping'});
    await knob.scrollIntoViewIfNeeded(); const b=await knob.boundingBox(); const x=b.x+b.width/2,y=b.y+b.height/2;
    await page.mouse.move(x,y); await page.mouse.down(); await page.mouse.move(x,y-10); await page.mouse.move(x,y-55,{steps:4});
    await page.waitForFunction(()=>Number(document.querySelector('#gestures [role=slider]').getAttribute('aria-valuenow'))>.5);
    const before=await value(knob);
    await knob.evaluate(el=>el.releasePointerCapture(1)); await page.mouse.move(x+1,y-55); await page.mouse.up();
    assert.equal(await value(knob),before); assert.equal(await section.getByRole('button',{name:'Undo (1)'}).count(),1);
    assert.match(await section.getByRole('log').textContent(),/cancelled/);
}));

test('actual touch drag edits; stationary touch opens the menu without editing', async () => withPage(async page => {
    const knob=page.locator('#menu').getByRole('slider',{name:'Output'});
    await knob.scrollIntoViewIfNeeded(); const box=await knob.boundingBox(); const x=box.x+box.width/2,y=box.y+box.height/2;
    const cdp=await page.context().newCDPSession(page);
    const touch=(type, points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});
    await touch('touchStart',[{x,y}]);
    await touch('touchMove',[{x,y:y-12}]); await touch('touchMove',[{x,y:y-55}]); await touch('touchEnd',[]);
    assert.ok(await value(knob)>.62);
    const previous=await value(knob);
    await touch('touchStart',[{x,y}]);
    await page.getByRole('menu').waitFor({timeout:1800}); await touch('touchEnd',[]);
    assert.equal(await value(page.locator('#menu [data-slot=knob-control]')),previous); await page.keyboard.press('Escape');
}, { viewport:{width:390,height:844}, isMobile:true, hasTouch:true }));

test('phone layout has no horizontal overflow and every example exposes source', async () => withPage(async page => {
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
    assert.equal(await page.locator('.example').count(),11);
    const card=page.locator('#live'); await card.getByRole('tab',{name:'Code',exact:true}).click();
    assert.match(await card.locator('[data-source-file="live.tsx"] code').textContent(),/KnobMarker value=\{source\}/);
    await card.getByRole('tab',{name:'Preview',exact:true}).click();
    await card.locator('[data-slot=knob-marker]').waitFor();
}, { viewport:{width:390,height:844}, isMobile:true, hasTouch:true }));

test('public controls style a plugin shadow root, replace live sources and release them on unmount', async () => withPage(async page => {
    await page.evaluate(async url => {
        const {mount}=await import(url); const host=document.createElement('div'); host.id='knob-fixture';document.body.appendChild(host);
        window.knobFixture=mount(host);
    }, `/@fs/${path.join(root,'kit/tests/helpers/knob_fixture.tsx')}`);
    const host=page.locator('#knob-fixture'), knob=host.getByRole('slider',{name:'Fixture frequency'});
    await knob.waitFor();
    assert.equal(await knob.evaluate(el=>getComputedStyle(el).width),'120px');
    assert.equal(await page.evaluate(()=>document.querySelector('#knob-fixture').shadowRoot.querySelectorAll('style[data-builder-kit-knob]').length),1);
    await page.waitForFunction(()=>window.knobFixture.first.count()===1);
    const renders=await page.evaluate(()=>window.knobFixture.renders());
    await page.evaluate(()=>window.knobFixture.first.set(1000));
    const marker=host.locator('[data-slot=knob-marker]').first();
    await page.waitForFunction(()=>Number(document.querySelector('#knob-fixture').shadowRoot.querySelector('[data-slot=knob-marker]').getAttribute('cx'))>80);
    assert.equal(await page.evaluate(()=>window.knobFixture.renders()),renders);
    assert.equal(await value(knob),100);
    await page.evaluate(()=>window.knobFixture.configure({source:'second'}));
    await page.waitForFunction(()=>window.knobFixture.first.count()===0&&window.knobFixture.second.count()===1);
    await page.evaluate(()=>window.knobFixture.first.set(null));
    assert.equal(await marker.getAttribute('data-active'),'true','replaced source cannot hide the new marker');
    await page.evaluate(()=>window.knobFixture.unmount());
    assert.equal(await page.evaluate(()=>window.knobFixture.second.count()),0);
    assert.equal(await page.evaluate(()=>document.querySelector('#knob-fixture').shadowRoot.querySelectorAll('style[data-builder-kit-knob]').length),0);
    assert.deepEqual(await page.evaluate(()=>window.knobFixture.changes),[],'live updates never edit base state');
}));

test('disabled reconfiguration and unmount each close an active bracket exactly once',async()=>withPage(async page=>{
    await page.evaluate(async url=>{const {mount}=await import(url);const host=document.createElement('div');host.id='knob-fixture';document.body.appendChild(host);window.knobFixture=mount(host);},`/@fs/${path.join(root,'kit/tests/helpers/knob_fixture.tsx')}`);
    const knob=page.locator('#knob-fixture').getByRole('slider',{name:'Fixture frequency'});await knob.waitFor();await knob.scrollIntoViewIfNeeded();
    const b=await knob.boundingBox(),x=b.x+b.width/2,y=b.y+b.height/2;
    await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x,y-10);await page.mouse.move(x,y-45,{steps:3});
    await page.waitForFunction(()=>window.knobFixture.changes.length>0);
    await page.evaluate(()=>window.knobFixture.configure({disabled:true}));
    await page.waitForFunction(()=>window.knobFixture.gestures.includes('cancel')); await page.mouse.up();
    assert.deepEqual(await page.evaluate(()=>window.knobFixture.gestures),['start','cancel']);
    await page.evaluate(()=>window.knobFixture.unmount());
    assert.deepEqual(await page.evaluate(()=>window.knobFixture.gestures),['start','cancel']);
}));

test('unmount during a drag and Escape release all editing ownership',async()=>withPage(async page=>{
    const section=page.locator('#gestures'),knob=section.getByRole('slider',{name:'Gesture grouping'});
    await knob.scrollIntoViewIfNeeded();let b=await knob.boundingBox();let x=b.x+b.width/2,y=b.y+b.height/2;
    await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x,y-10);await page.mouse.move(x,y-40,{steps:4});
    await page.waitForFunction(()=>Number(document.querySelector('#gestures [role=slider]').getAttribute('aria-valuenow'))>.5);
    await knob.press('Escape');await page.mouse.up();
    assert.equal(await section.getByRole('button',{name:'Undo (1)'}).count(),1);
    await knob.scrollIntoViewIfNeeded();b=await knob.boundingBox();x=b.x+b.width/2;y=b.y+b.height/2;
    await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x,y-10);await page.mouse.move(x,y-40,{steps:4});
    await section.getByRole('button',{name:'Unmount',exact:true}).evaluate(button=>button.click());
    await page.waitForFunction(()=>!document.querySelector('#gestures [role=slider]'));
    await page.mouse.up();assert.equal(await section.getByRole('button',{name:'Undo (2)'}).count(),1);
    assert.equal((await section.getByRole('log').textContent()).match(/cancelled/g)?.length,2);
}));

test('pointer frames use current controlled callbacks rather than the pointer-down closure',async()=>withPage(async page=>{
    await page.evaluate(async url=>{const {mount}=await import(url);const host=document.createElement('div');host.id='knob-fixture';document.body.appendChild(host);window.knobFixture=mount(host);},`/@fs/${path.join(root,'kit/tests/helpers/knob_fixture.tsx')}`);
    const knob=page.locator('#knob-fixture').getByRole('slider',{name:'Fixture frequency'});await knob.waitFor();await knob.scrollIntoViewIfNeeded();
    const b=await knob.boundingBox(),x=b.x+b.width/2,y=b.y+b.height/2;
    await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x,y-10);await page.mouse.move(x,y-30);
    await page.waitForFunction(()=>window.knobFixture.changes.length===1);
    const changed=await value(knob);
    await page.mouse.move(x,y-50);await page.mouse.up();
    assert.deepEqual(await page.evaluate(()=>window.knobFixture.callbackBases),[100,changed]);
    await page.evaluate(()=>window.knobFixture.unmount());
}));


test('every displayed example compiles and runs with only its copied source, stylesheet and public kit imports', async () => withPage(async page => {
    const copied = new Map();
    let css = '';
    for (const id of await page.locator('.example').evaluateAll(nodes => nodes.map(node => node.id))) {
        const card = page.locator(`#${id}`);
        await card.getByRole('tab', { name: 'Code', exact: true }).click();
        copied.set(id, await card.locator(`[data-source-file="${id}.tsx"] code`).textContent());
        const styles = await card.locator('[data-source-file="examples.css"] code').textContent();
        if (css) assert.equal(styles, css);
        css = styles;
    }
    const exampleDir = path.join(root, 'kit/examples/knobs');
    const files = new Map([...copied].map(([id, text]) => [path.join(exampleDir, `copied-${id}.tsx`), text]));
    const options = { noEmit: true, skipLibCheck: true, strict: true, target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
        jsx: ts.JsxEmit.ReactJSX, allowSyntheticDefaultImports: true, types: ["vite/client"] };
    const host = ts.createCompilerHost(options), original = host.getSourceFile.bind(host);
    host.getSourceFile = (name, language, onError, create) => files.has(name)
        ? ts.createSourceFile(name, files.get(name), language, true, ts.ScriptKind.TSX)
        : original(name, language, onError, create);
    const program = ts.createProgram([...files.keys()], options, host);
    for (const file of files.keys()) {
        const errors = program.getSemanticDiagnostics(program.getSourceFile(file));
        assert.deepEqual(errors.map(error => ts.flattenDiagnosticMessageText(error.messageText, '\n')), [], file);
    }
    const names = [...copied].map(([id, source]) => [id, source.match(/export function (\w+Example)/)[1]]);
    const entry = names.map(([id, name]) => `import { ${name} } from "copy:${id}";`).join('\n')
        + '\nimport { createRoot } from "react-dom/client";\ncreateRoot(document.getElementById("root")).render(<>'
        + names.map(([id, name]) => `<section id="${id}"><${name} /></section>`).join('') + '</>);';
    const bundle = await build({ stdin: { contents: entry, loader: 'tsx', resolveDir: exampleDir },
        bundle: true, write: false, outfile: 'copy-proof.js', format: 'esm', jsx: 'automatic',
        define: { 'process.env.NODE_ENV': '"test"' }, plugins: [{ name: 'copied-files-only', setup(builder) {
            builder.onResolve({ filter: /^copy:/ }, args => ({ path: args.path.slice(5), namespace: 'copied' }));
            builder.onLoad({ filter: /.*/, namespace: 'copied' }, args => ({ contents: copied.get(args.path), loader: 'tsx', resolveDir: exampleDir }));
            builder.onResolve({ filter: /^\.\/examples\.css$/ }, () => ({ path: 'examples.css', namespace: 'copied-css' }));
            builder.onLoad({ filter: /.*/, namespace: 'copied-css' }, () => ({ contents: css, loader: 'css' }));
            builder.onResolve({ filter: /\?(inline|raw)$/ }, args => ({ path: path.resolve(args.resolveDir, args.path.replace(/\?.*$/, '')), namespace: 'raw' }));
            builder.onLoad({ filter: /.*/, namespace: 'raw' }, async args => ({ contents: await readFile(args.path, 'utf8'), loader: 'text' }));
        } }] });
    const isolated = await browser.newPage();
    const errors = []; isolated.on('pageerror', error => errors.push(error.message));
    try {
        await isolated.setContent('<!doctype html><html><head></head><body><div id="root"></div></body></html>');
        await isolated.addStyleTag({ content: bundle.outputFiles.find(file => file.path.endsWith('.css')).text });
        await isolated.addScriptTag({ type: 'module', content: bundle.outputFiles.find(file => file.path.endsWith('.js')).text });
        const gain = isolated.getByRole('slider', { name: 'Gain', exact: true });
        await gain.press('ArrowUp'); assert.equal(await value(gain), .63);
        const input = isolated.getByRole('textbox', { name: 'Exact frequency' });
        await input.fill('2.5 kHz'); await input.press('Enter');
        assert.equal(await value(isolated.getByRole('slider', { name: 'Frequency', exact: true })), 2500);
        await isolated.getByRole('slider', { name: 'Custom dial' }).press('ArrowUp');
        assert.equal(await value(isolated.getByRole('slider', { name: 'Custom meter' })), .51);
        await verifyCustomStyling(isolated);
        const widths = await isolated.locator('#styles [data-slot=knob-control]').evaluateAll(nodes => nodes.map(node => getComputedStyle(node).width));
        assert.deepEqual(widths, ['78px', '120px', '158px']);
        const marker = isolated.locator('#live [data-slot=knob-marker]');
        await isolated.waitForFunction(() => document.querySelector('#live [data-slot=knob-marker]')?.getAttribute('data-active') === 'true');
        const x = await marker.getAttribute('cx');
        await isolated.waitForFunction(old => document.querySelector('#live [data-slot=knob-marker]')?.getAttribute('cx') !== old, x);
        assert.deepEqual(errors, []);
    } finally { await isolated.close(); }
}));


test('secondary drag sensitivity is independent of the base drag sensitivity', async () => withPage(async page => {
    const knob = page.getByRole('slider', { name: 'Value & depth' });
    const depth = page.getByRole('slider', { name: 'Secondary depth' });
    await drag(page, knob, 0, -46);
    assert.ok(Math.abs(Number(await depth.inputValue()) - .45) < .005, `secondary value: ${await depth.inputValue()}`);
    assert.equal(await value(knob), .5);
    await drag(page, knob, 54, 0);
    assert.ok(Math.abs(await value(knob) - .7) < .005);
    assert.ok(Math.abs(Number(await depth.inputValue()) - .45) < .005);
}));
