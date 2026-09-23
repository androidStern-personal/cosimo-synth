type Report = { generation: number; active: boolean; position: number }
export default class MsegPlayback {
    getMemoryRequirements(): { minimumPages: number; minimumBytes: number }
    initialise(
        session: number,
        sampleRate: number,
        options: { memory: WebAssembly.Memory; externalFunctions: Record<string, WebAssembly.ExportValue> },
    ): Promise<void>
    setInputValue_duration(seconds: number, rampFrames: number): void
    sendInputEvent_trigger(value: number): void
    sendInputEvent_legatoTrigger(value: number): void
    sendInputEvent_noteOff(value: number): void
    sendInputEvent_playback(value: {
        holdFinalValue: boolean
        loopEnabled: boolean
        loopStart: number
        loopEnd: number
        ignoreNoteOff: boolean
        legatoRestarts: boolean
    }): void
    resetOutputEventCount_position(): void
    getOutputEventCount_position(): number
    getOutputEvent_position(index: number): { event: Report }
    advance(frames: number): void
}
