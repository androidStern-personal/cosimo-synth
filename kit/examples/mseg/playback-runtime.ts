// Demo host for the real, frozen Cmajor processor. No sound is sent to speakers.
// A plugin uses its existing patch connection instead of this offline runner.
import Program from './playback-program.js'
import readerData from './playback-reader.json?raw'
import { Mseg } from '../../index'
export async function createPlayback(curve: Mseg.Curve) {
    const program = new Program(),
        requirements = program.getMemoryRequirements()
    const memory = new WebAssembly.Memory({ initial: requirements.minimumPages + 2, maximum: 256, shared: true })
    const base = requirements.minimumBytes,
        address = base + 8
    new Uint32Array(memory.buffer, base, 2).set([address, Mseg.sampleCount])
    const samples = new Float32Array(memory.buffer, address, Mseg.sampleCount)
    Mseg.renderInto(curve, samples)
    const bytes = Uint8Array.from(atob(JSON.parse(readerData).wasm), (character) => character.charCodeAt(0))
    const reader = new WebAssembly.Instance(await WebAssembly.compile(bytes), {
        env: {
            memory,
            descriptorBase: new WebAssembly.Global({ value: 'i32', mutable: true }, base),
            inputCount: new WebAssembly.Global({ value: 'i32', mutable: true }, 1),
        },
    }).exports
    await program.initialise(17, 48_000, {
        memory,
        externalFunctions: { cmaj__data__read: reader.read, cmaj__data__size: reader.size },
    })
    const listeners = new Set<(message: unknown) => void>()
    const connection = {
        addEndpointListener: (_endpoint: string, listener: (message: unknown) => void) => {
            listeners.add(listener)
        },
        removeEndpointListener: (_endpoint: string, listener: (message: unknown) => void) => {
            listeners.delete(listener)
        },
    }
    const position = Mseg.positionSource(connection, 'position')
    const policy = {
        holdFinalValue: true,
        loopEnabled: true,
        loopStart: 0.2,
        loopEnd: 0.7,
        ignoreNoteOff: false,
        legatoRestarts: true,
    }
    program.setInputValue_duration(1.6, 0)
    program.sendInputEvent_playback(policy)
    let previous = performance.now(),
        pending = 0,
        frame = 0,
        disposed = false
    function advance(now: number) {
        if (disposed) return
        // Wall time schedules DSP blocks; only the DSP's output supplies position.
        // Returning from a hidden tab pauses playback instead of processing an unbounded backlog.
        pending += Math.min(100, now - previous) * 48
        previous = now
        while (pending >= 128) {
            program.resetOutputEventCount_position()
            program.advance(128)
            pending -= 128
            for (let index = 0; index < program.getOutputEventCount_position(); ++index)
                for (const listener of listeners) listener(program.getOutputEvent_position(index))
        }
        frame = requestAnimationFrame(advance)
    }
    frame = requestAnimationFrame(advance)
    return {
        position,
        setCurve: (value: Mseg.Curve) => Mseg.renderInto(value, samples),
        trigger: () => program.sendInputEvent_trigger(1),
        retrigger: () => program.sendInputEvent_legatoTrigger(1),
        release: () => program.sendInputEvent_noteOff(1),
        setLoop: (loopEnabled: boolean) => {
            policy.loopEnabled = loopEnabled
            program.sendInputEvent_playback(policy)
        },
        dispose: () => {
            disposed = true
            cancelAnimationFrame(frame)
            listeners.clear()
        },
    }
}
