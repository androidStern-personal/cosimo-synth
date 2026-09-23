import assert from 'node:assert/strict'
import test, { before, after } from 'node:test'
import path from 'node:path'
import { createServer } from 'vite'
import { build } from 'esbuild'
import ts from 'typescript'
import { readFile } from 'node:fs/promises'
import { chromium } from 'playwright'
const root = path.resolve(import.meta.dirname, '../..')
let server, browser, base
before(async () => {
    server = await createServer({
        configFile: path.join(root, 'kit/examples/mseg/vite.config.mjs'),
        server: { host: '127.0.0.1', port: 0 },
        logLevel: 'error',
    })
    await server.listen()
    base = `http://127.0.0.1:${server.httpServer.address().port}`
    browser = await chromium.launch({ headless: true })
})
after(async () => {
    await browser?.close()
    await server?.close()
})
async function withPage(run, options = {}) {
    const page = await browser.newPage(options)
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    try {
        await page.goto(base)
        await page.locator('#default [data-slot=mseg-surface]').waitFor()
        await run(page)
        assert.deepEqual(errors, [])
    } finally {
        await page.close()
    }
}
const handles = (page) => page.locator('[data-slot=mseg-points] [role=button]')
async function drag(page, locator, dx, dy) {
    await locator.scrollIntoViewIfNeeded()
    const b = await locator.boundingBox()
    assert.ok(b)
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
    await page.mouse.down()
    await page.mouse.move(b.x + b.width / 2 + dx, b.y + b.height / 2 + dy, { steps: 5 })
    await page.mouse.up()
}
test('default and customized handles share insertion, pointer and keyboard editing', () =>
    withPage(async (page) => {
        const section = page.locator('#default'),
            svg = section.locator('svg')
        await svg.scrollIntoViewIfNeeded()
        const box = await svg.boundingBox()
        await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.7)
        assert.equal(await handles(section).count(), 3)
        const point = handles(section).nth(1)
        const before = await point.getAttribute('aria-label')
        await point.press('ArrowUp')
        assert.notEqual(await point.getAttribute('aria-label'), before)
        await drag(page, point, 35, -30)
        assert.notEqual(await point.getAttribute('aria-label'), before)
        await point.press('Delete')
        assert.equal(await handles(section).count(), 2)
        const custom = page.locator('#composed')
        await custom.getByRole('button', { name: 'Add midpoint' }).click()
        assert.equal(await handles(custom).count(), 4)
        const square = handles(custom).nth(1)
        await square.focus()
        await square.press('ArrowDown')
        const input = custom.getByRole('spinbutton', { name: 'Selected point value' })
        await input.fill('.4')
        await input.press('Tab')
        assert.match(await square.getAttribute('aria-label'), /value 0.40/)
        await custom.getByRole('button', { name: 'Delete selected' }).click()
        assert.equal(await handles(custom).count(), 3)
    }))
test('segment keyboard editing and reference layers remain independent', () =>
    withPage(async (page) => {
        const section = page.locator('#composed'),
            svg = section.locator('[data-slot=mseg-surface]')
        const curves = section.locator('[data-slot=mseg-curve]')
        const reference = await curves.first().getAttribute('d')
        const original = await curves.last().getAttribute('d')
        await svg.focus()
        await svg.press(']')
        await svg.press('ArrowUp')
        assert.notEqual(await curves.last().getAttribute('d'), original)
        assert.equal(await curves.first().getAttribute('d'), reference)
        await svg.click({ button: 'right' })
        await page.getByRole('menuitem', { name: 'Reset envelope' }).click()
        assert.equal(await handles(section).count(), 2)
    }))
test('unequal A/B curves morph as samples and retain independent editing', () =>
    withPage(async (page) => {
        const section = page.locator('#morph')
        const plot = section.locator('[data-slot=mseg-plot]')
        const original = await plot.getAttribute('d')
        assert.equal(await handles(section).count(), 3)
        await section.getByRole('button', { name: 'Edit B' }).click()
        assert.equal(await handles(section).count(), 4)
        await handles(section).nth(1).press('ArrowUp')
        assert.notEqual(await plot.getAttribute('d'), original)
        await section.getByRole('button', { name: 'Edit A' }).click()
        assert.equal(await handles(section).count(), 3)
        const range = section.getByRole('slider', { name: 'Morph' })
        await range.fill('1')
        assert.notEqual(await plot.getAttribute('d'), original)
    }))
test('vertical mapping, read-only and external replacement work on a phone', () =>
    withPage(
        async (page) => {
            const section = page.locator('#states')
            const point = handles(section).nth(1)
            const original = await point.getAttribute('aria-label')
            await drag(page, point, 20, 30)
            assert.notEqual(await point.getAttribute('aria-label'), original)
            await section.getByRole('checkbox').check()
            const locked = await point.getAttribute('aria-label')
            await point.press('ArrowUp')
            await drag(page, point, 20, -30)
            assert.equal(await point.getAttribute('aria-label'), locked)
            await section.getByRole('button', { name: 'External reset' }).click()
            assert.equal(await handles(section).count(), 2)
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
            for (const id of ['default', 'composed', 'morph', 'states']) {
                const example = page.locator('#' + id)
                await example.getByRole('tab', { name: 'Code', exact: true }).click()
                assert.match(await example.locator('pre').first().innerText(), /import \{ Mseg \} from ['"]..\/..\/index['"]/)
            }
        },
        { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    ))
async function fixture(page) {
    await page.evaluate(
        async (url) => {
            const { mount } = await import(url)
            const host = document.createElement('div')
            host.id = 'fixture'
            document.body.appendChild(host)
            window.fixture = mount(host)
        },
        `/@fs/${path.join(root, 'kit/tests/helpers/mseg_fixture.tsx')}`,
    )
    await page.locator('#fixture svg').waitFor()
    return page.locator('#fixture')
}
test('live positions share a subscription, reject stale voices, wrap immediately and clean up', () =>
    withPage(async (page) => {
        const host = await fixture(page)
        await page.waitForFunction(() => window.fixture.subscriberCount() === 1)
        const renders = await page.evaluate(() => window.fixture.renders())
        const markers = host.locator('[data-slot=mseg-playhead]')
        const emit = (report) => page.evaluate((value) => window.fixture.emit({ event: value }), report)
        await emit({ generation: 4, active: true, position: 0.8 })
        await page.waitForFunction(
            () => document.querySelector('#fixture [data-slot=mseg-playhead]')?.dataset.active === 'true',
        )
        const high = Number(await markers.first().getAttribute('x1'))
        await emit({ generation: 5, active: true, position: 0.1 })
        await page.waitForFunction(
            (x) => Number(document.querySelector('#fixture [data-slot=mseg-playhead]').getAttribute('x1')) < x,
            high,
        )
        const restarted = await markers.first().getAttribute('x1')
        assert.equal(restarted, await markers.last().getAttribute('x1'))
        await emit({ generation: 4, active: true, position: 0.9 })
        await emit({ generation: 6, active: true, position: 'poison' })
        await page.waitForTimeout(35)
        assert.equal(await markers.first().getAttribute('x1'), restarted)
        await emit({ generation: 5, active: false, position: 1 })
        await page.waitForFunction(
            () => document.querySelector('#fixture [data-slot=mseg-playhead]').dataset.active === 'false',
        )
        assert.equal(
            await page.evaluate(() => window.fixture.renders()),
            renders,
            'engine reports do not rerender the editor',
        )
        await page.evaluate(() => window.fixture.unmount())
        assert.equal(await page.evaluate(() => window.fixture.subscriberCount()), 0)
    }))
test('one pointer edit brackets once and cancellation, disabled and document replacement detach it', () =>
    withPage(async (page) => {
        const host = await fixture(page)
        for (const action of ['cancel', 'disabled', 'document']) {
            const point = handles(host).nth(1)
            await point.scrollIntoViewIfNeeded()
            const b = await point.boundingBox()
            const x = b.x + b.width / 2,
                y = b.y + b.height / 2
            const count = await page.evaluate(() => window.fixture.gestures.length)
            await page.mouse.move(x, y)
            await page.mouse.down()
            await page.mouse.move(x + 25, y - 20, { steps: 3 })
            await page.waitForFunction((n) => window.fixture.gestures.length === n + 1, count)
            const accepted = await page.evaluate(() => window.fixture.value())
            if (action === 'cancel') await host.locator('svg').dispatchEvent('pointercancel', { pointerId: 1 })
            else
                await page.evaluate(
                    (which) => window.fixture.configure(which === 'disabled' ? { disabled: true } : { document: 1 }),
                    action,
                )
            await page.mouse.up()
            await page.waitForFunction((n) => window.fixture.gestures.length === n + 2, count)
            assert.deepEqual(await page.evaluate(() => window.fixture.gestures.slice(-2)), ['start', 'cancel'])
            assert.deepEqual(await page.evaluate(() => window.fixture.value()), accepted)
            if (action === 'disabled') await page.evaluate(() => window.fixture.configure({ disabled: false }))
        }
    }))

test('the real compiled Reader drives the public playhead through trigger, loop, retrigger and release', () =>
    withPage(async (page) => {
        const section = page.locator('#playback'),
            marker = section.locator('[data-slot=mseg-playhead]')
        await section.getByRole('button', { name: 'Trigger', exact: true }).click()
        await page.waitForFunction(
            () => document.querySelector('#playback [data-slot=mseg-playhead]')?.dataset.active === 'true',
        )
        const first = Number(await marker.getAttribute('x1'))
        await page.waitForFunction(
            (x) => Number(document.querySelector('#playback [data-slot=mseg-playhead]').getAttribute('x1')) > x + 35,
            first,
        )
        await section.getByRole('button', { name: 'Retrigger', exact: true }).click()
        await page.waitForFunction(
            (x) => Number(document.querySelector('#playback [data-slot=mseg-playhead]').getAttribute('x1')) < x + 25,
            first,
        )
        const shape = await section.locator('[data-slot=mseg-curve]').getAttribute('d')
        await handles(section).nth(1).press('ArrowDown')
        assert.notEqual(await section.locator('[data-slot=mseg-curve]').getAttribute('d'), shape)
        await section.getByRole('button', { name: 'Release', exact: true }).click()
        await page.waitForFunction(
            () => document.querySelector('#playback [data-slot=mseg-playhead]')?.dataset.active === 'false',
        )
        assert.equal(await section.getByRole('alert').count(), 0)
    }))
test('keyboard gesture ends once when the page loses focus', () =>
    withPage(async (page) => {
        const host = await fixture(page)
        await handles(host).nth(1).focus()
        await page.keyboard.down('ArrowUp')
        assert.deepEqual(await page.evaluate(() => window.fixture.gestures), ['start'])
        await page.evaluate(() => window.dispatchEvent(new Event('blur')))
        await page.keyboard.up('ArrowUp')
        assert.deepEqual(await page.evaluate(() => window.fixture.gestures), ['start', 'cancel'])
    }))
test('displayed sources typecheck and run independently of the documentation app', () =>
    withPage(async (page) => {
        const copied = new Map()
        let css = ''
        for (const id of ['default', 'composed', 'morph', 'states', 'playback']) {
            const section = page.locator('#' + id)
            await section.getByRole('tab', { name: 'Code', exact: true }).click()
            copied.set(id + '.tsx', await section.locator(`[data-source-file="${id}.tsx"] code`).textContent())
            css = await section.locator('[data-source-file="examples.css"] code').textContent()
            if (id === 'playback')
                copied.set(
                    'playback-runtime.ts',
                    await section.locator('[data-source-file="playback-runtime.ts"] code').textContent(),
                )
        }
        const directory = path.join(root, 'kit/examples/mseg')
        const files = new Map([...copied].map(([file, source]) => [path.join(directory, file), source]))
        const options = {
            noEmit: true,
            skipLibCheck: true,
            strict: true,
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.ESNext,
            moduleResolution: ts.ModuleResolutionKind.Bundler,
            jsx: ts.JsxEmit.ReactJSX,
            allowSyntheticDefaultImports: true,
            types: ['vite/client'],
        }
        const host = ts.createCompilerHost(options),
            original = host.getSourceFile.bind(host)
        host.getSourceFile = (name, language, onError, create) =>
            files.has(name)
                ? ts.createSourceFile(
                      name,
                      files.get(name),
                      language,
                      true,
                      name.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
                  )
                : original(name, language, onError, create)
        const program = ts.createProgram([...files.keys()], options, host)
        for (const file of files.keys())
            assert.deepEqual(
                program
                    .getSemanticDiagnostics(program.getSourceFile(file))
                    .map((e) => ts.flattenDiagnosticMessageText(e.messageText, '\n')),
                [],
                file,
            )
        const examples = [...copied]
            .filter(([name]) => name.endsWith('.tsx'))
            .map(([file, source]) => ({
                file,
                name: source.match(/export function (\w+Example)/)[1],
                id: file.replace('.tsx', ''),
            }))
        const entry =
            examples.map(({ file, name }) => `import {${name}} from 'copy:${file}';`).join('\n') +
            "\nimport {createRoot} from 'react-dom/client';createRoot(document.getElementById('root')).render(<>" +
            examples.map(({ name, id }) => `<section id="${id}"><${name}/></section>`).join('') +
            '</>);'
        const bundle = await build({
            stdin: { contents: entry, loader: 'tsx', resolveDir: directory },
            bundle: true,
            write: false,
            outfile: 'copied.js',
            format: 'esm',
            jsx: 'automatic',
            plugins: [
                {
                    name: 'copy-proof',
                    setup(b) {
                        b.onResolve({ filter: /^copy:/ }, (args) => ({ path: args.path.slice(5), namespace: 'copy' }))
                        b.onResolve({ filter: /^\.\/playback-runtime$/ }, () => ({
                            path: 'playback-runtime.ts',
                            namespace: 'copy',
                        }))
                        b.onLoad({ filter: /.*/, namespace: 'copy' }, (args) => ({
                            contents: copied.get(args.path),
                            loader: args.path.endsWith('.tsx') ? 'tsx' : 'ts',
                            resolveDir: directory,
                        }))
                        b.onResolve({ filter: /^\.\/examples\.css$/ }, () => ({
                            path: 'styles',
                            namespace: 'copy-css',
                        }))
                        b.onLoad({ filter: /.*/, namespace: 'copy-css' }, () => ({ contents: css, loader: 'css' }))
                        b.onResolve({ filter: /\?(inline|raw)$/ }, (args) => ({
                            path: path.resolve(args.resolveDir, args.path.replace(/\?.*$/, '')),
                            namespace: 'raw',
                        }))
                        b.onLoad({ filter: /.*/, namespace: 'raw' }, async (args) => ({
                            contents: await readFile(args.path, 'utf8'),
                            loader: 'text',
                        }))
                    },
                },
            ],
        })
        const standalone = await browser.newPage()
        const errors = []
        standalone.on('pageerror', (e) => errors.push(e.message))
        try {
            await standalone.route('**/copy-proof', (route) =>
                route.fulfill({
                    status: 200,
                    headers: {
                        'Content-Type': 'text/html',
                        'Cross-Origin-Opener-Policy': 'same-origin',
                        'Cross-Origin-Embedder-Policy': 'require-corp',
                    },
                    body: '<!doctype html><div id="root"></div>',
                }),
            )
            await standalone.goto(base + '/copy-proof')
            await standalone.addStyleTag({ content: bundle.outputFiles.find((f) => f.path.endsWith('.css')).text })
            await standalone.addScriptTag({
                type: 'module',
                content: bundle.outputFiles.find((f) => f.path.endsWith('.js')).text,
            })
            const editor = standalone.locator('#default')
            await handles(editor).first().press('ArrowUp')
            assert.match(await handles(editor).first().getAttribute('aria-label'), /value 0.01/)
            const custom = standalone.locator('#composed')
            await custom.getByRole('button', { name: 'Add midpoint' }).click()
            assert.equal(await handles(custom).count(), 4)
            await standalone.locator('#morph').getByRole('button', { name: 'Edit B' }).click()
            assert.equal(await handles(standalone.locator('#morph')).count(), 4)
            await standalone.locator('#playback').getByRole('button', { name: 'Trigger', exact: true }).click()
            await standalone.waitForFunction(
                () => document.querySelector('#playback [data-slot=mseg-playhead]')?.dataset.active === 'true',
            )
            assert.equal(await standalone.getByRole('alert').count(), 0)
            assert.deepEqual(errors, [])
        } finally {
            await standalone.close()
        }
    }))
