// A real generated Reader feeds the public position adapter, including loop/retrigger discontinuities.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { loadUIModule } from '../kit/tests/helpers/load_ui_module.mjs'
import { cmajorExternalCodegen, cmajorSourceDirectory } from './helpers/cmajor_source.mjs'
const root = path.resolve(import.meta.dirname, '..')
const temp = await mkdtemp(path.join(tmpdir(), 'mseg-position-dsp-'))
try {
    const source = cmajorSourceDirectory()
    await writeFile(path.join(temp, 'mseg.cmajor'), await readFile(path.join(root, 'kit/cmajor/mseg.cmajor')))
    await writeFile(
        path.join(temp, 'Probe.cmajor'),
        `namespace cmaj::data { external float read(int inputIndex,int sampleIndex); external int size(int inputIndex); }
graph MsegProbe [[ main ]] {
 input event int32 trigger; input event int32 legatoTrigger; input event int32 noteOff;
 input event kit::mseg::Playback playback; input value float32 duration;
 output stream float32 out; output event kit::mseg::Position position;
 node reader=kit::mseg::Reader(0);
 connection trigger->reader.trigger; connection legatoTrigger->reader.legatoTrigger; connection noteOff->reader.noteOff;
 connection playback->reader.playback; connection duration->reader.durationSeconds; connection reader.out->out; connection reader.positionOut->position;
}`,
    )
    await writeFile(
        path.join(temp, 'Probe.cmajorpatch'),
        JSON.stringify({
            CmajorVersion: 1,
            ID: 'dev.builderkit.mseg.probe',
            version: '1',
            name: 'MSEG Probe',
            source: ['Probe.cmajor', 'mseg.cmajor'],
        }),
    )
    const generated = path.join(temp, 'Probe.mjs')
    execFileSync(cmajorExternalCodegen(), [
        path.join(temp, 'Probe.cmajorpatch'),
        generated,
        'MsegProbe',
        '--target',
        'javascript',
        '--max-frames-per-block',
        '128',
        '--shared-memory-maximum-pages',
        '256',
    ])
    await writeFile(generated, (await readFile(generated, 'utf8')) + '\nexport default MsegProbe;\n')
    const { default: Program } = await import(pathToFileURL(generated))
    const { compileSharedDataReader } = await import(
        pathToFileURL(path.join(source, 'javascript/cmaj_api/cmaj-shared-data-reader.js'))
    )
    const performer = new Program(),
        requirements = performer.getMemoryRequirements()
    const memory = new WebAssembly.Memory({ initial: requirements.minimumPages + 2, maximum: 256, shared: true })
    const descriptorBase = requirements.minimumBytes,
        data = descriptorBase + 8
    new Uint32Array(memory.buffer, descriptorBase, 2).set([data, 2051])
    const ramp = new Float32Array(memory.buffer, data, 2051)
    for (let i = 0; i < ramp.length; i++) ramp[i] = Math.min(1, Math.max(0, (i - 1) / 2047))
    const reader = new WebAssembly.Instance(await compileSharedDataReader(), {
        env: {
            memory,
            descriptorBase: new WebAssembly.Global({ value: 'i32', mutable: true }, descriptorBase),
            inputCount: new WebAssembly.Global({ value: 'i32', mutable: true }, 1),
        },
    }).exports
    await performer.initialise(17, 48000, {
        memory,
        externalFunctions: { cmaj__data__read: reader.read, cmaj__data__size: reader.size },
    })
    const { msegPositionSource } = await loadUIModule(root, 'kit/ui/mseg-position.ts')
    const listeners = new Set()
    const connection = {
        addEndpointListener: (_, listener) => listeners.add(listener),
        removeEndpointListener: (_, listener) => listeners.delete(listener),
    }
    const position = msegPositionSource(connection, 'position')
    const observed = []
    const detach = position.subscribe(() => observed.push(position.getSnapshot()))
    const reports = []
    const output = new Float32Array(128)
    function advance(blocks) {
        for (let block = 0; block < blocks; block++) {
            performer.resetOutputEventCount_position()
            performer.advance(128)
            performer.getOutputFrames_out([output], 128, 0)
            assert.ok(output.every(Number.isFinite))
            for (let i = 0; i < performer.getOutputEventCount_position(); i++) {
                const report = performer.getOutputEvent_position(i)
                reports.push(report.event)
                for (const listener of listeners) listener(report)
            }
        }
    }
    const playback = {
        holdFinalValue: true,
        loopEnabled: true,
        loopStart: 0.2,
        loopEnd: 0.6,
        ignoreNoteOff: false,
        legatoRestarts: true,
    }
    performer.setInputValue_duration(0.2, 0)
    performer.sendInputEvent_playback(playback)
    performer.sendInputEvent_trigger(1)
    advance(110)
    assert.equal(observed[0], 0)
    assert.ok(
        observed.some((v, i) => i > 0 && v < observed[i - 1]),
        'actual engine loop must wrap',
    )
    assert.ok(reports.every((r) => r.active && r.position <= 0.601))
    const prior = reports.at(-1)
    performer.sendInputEvent_legatoTrigger(1)
    advance(1)
    assert.equal(position.getSnapshot(), 0)
    assert.ok(reports.at(-1).generation > prior.generation)
    for (const listener of listeners) listener({ event: prior })
    assert.equal(position.getSnapshot(), 0, 'late old-voice report cannot undo a retrigger')
    performer.sendInputEvent_noteOff(1)
    advance(100)
    assert.equal(position.getSnapshot(), null, 'finished release hides the indicator')
    assert.ok(
        output.every((v) => v === 1),
        'holdFinalValue retains the final audio value while the UI becomes inactive',
    )
    detach()
    assert.equal(listeners.size, 0)
    console.log(
        'Real MSEG DSP -> public position source: loop, legato restart, stale generation, release, inactive and cleanup passed.',
    )
} finally {
    await rm(temp, { recursive: true, force: true })
}
