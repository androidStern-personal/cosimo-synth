import type { NotePerformance, NotePerformanceEvent } from "../audio/checkpoint-renderer";

export type JSONNote = {
    readonly note: number;
    readonly velocity: number;
    readonly onSec: number;
    readonly offSec: number;
    readonly channel?: number;
};

export class SpeedrunMIDIError extends Error {
    constructor(message: string, options: { readonly cause?: unknown } = {}) {
        super(message, options);
        this.name = "SpeedrunMIDIError";
    }
}

type TimedTrackEvent = {
    readonly tick: number;
    readonly track: number;
    readonly order: number;
    readonly kind: "midi" | "tempo";
    readonly code?: number;
    readonly microsecondsPerQuarter?: number;
};

function integer(value: unknown, label: string, minimum: number, maximum: number) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new SpeedrunMIDIError(`${label} must be a finite number.`);
    }
    return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

function finiteSeconds(value: unknown, label: string) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new SpeedrunMIDIError(`${label} must be a finite number.`);
    }
    return Math.max(0, value);
}

function packMIDI(status: number, data1: number, data2 = 0) {
    return ((status & 0xff) << 16) | ((data1 & 0x7f) << 8) | (data2 & 0x7f);
}

function readASCII(bytes: Uint8Array, offset: number, length: number) {
    return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

function readUint32(bytes: Uint8Array, offset: number) {
    return (((bytes[offset] << 24) >>> 0)
        | (bytes[offset + 1] << 16)
        | (bytes[offset + 2] << 8)
        | bytes[offset + 3]) >>> 0;
}

function readUint16(bytes: Uint8Array, offset: number) {
    return (bytes[offset] << 8) | bytes[offset + 1];
}

function requireBytes(bytes: Uint8Array, offset: number, length: number, label: string) {
    if (offset < 0 || length < 0 || offset + length > bytes.length) {
        throw new SpeedrunMIDIError(`Truncated MIDI ${label}.`);
    }
}

function readVariableLength(bytes: Uint8Array, cursor: { value: number }, end: number) {
    let result = 0;
    for (let index = 0; index < 4; index += 1) {
        if (cursor.value >= end) throw new SpeedrunMIDIError("Truncated MIDI variable-length value.");
        const byte = bytes[cursor.value++];
        result = (result << 7) | (byte & 0x7f);
        if ((byte & 0x80) === 0) return result;
    }
    throw new SpeedrunMIDIError("MIDI variable-length value exceeds four bytes.");
}

function parseTrack(bytes: Uint8Array, start: number, end: number, track: number) {
    const events: TimedTrackEvent[] = [];
    const channels = new Set<number>();
    const cursor = { value: start };
    let tick = 0;
    let runningStatus: number | null = null;
    let order = 0;

    while (cursor.value < end) {
        tick += readVariableLength(bytes, cursor, end);
        if (cursor.value >= end) throw new SpeedrunMIDIError("Truncated MIDI track event.");
        let status = bytes[cursor.value];
        if (status < 0x80) {
            if (runningStatus === null) throw new SpeedrunMIDIError("MIDI running status has no channel status.");
            status = runningStatus;
        } else {
            cursor.value += 1;
        }

        if (status === 0xff) {
            runningStatus = null;
            if (cursor.value >= end) throw new SpeedrunMIDIError("Truncated MIDI meta event.");
            const type = bytes[cursor.value++];
            const length = readVariableLength(bytes, cursor, end);
            requireBytes(bytes, cursor.value, length, "meta event");
            if (type === 0x51) {
                if (length !== 3) throw new SpeedrunMIDIError("MIDI tempo events must contain three bytes.");
                const microsecondsPerQuarter = (bytes[cursor.value] << 16)
                    | (bytes[cursor.value + 1] << 8)
                    | bytes[cursor.value + 2];
                if (microsecondsPerQuarter <= 0) throw new SpeedrunMIDIError("MIDI tempo must be positive.");
                events.push({ tick, track, order: order++, kind: "tempo", microsecondsPerQuarter });
            }
            cursor.value += length;
            if (type === 0x2f) break;
            continue;
        }

        if (status === 0xf0 || status === 0xf7) {
            runningStatus = null;
            const length = readVariableLength(bytes, cursor, end);
            requireBytes(bytes, cursor.value, length, "system-exclusive event");
            cursor.value += length;
            continue;
        }

        if (status < 0x80 || status > 0xef) {
            throw new SpeedrunMIDIError(`Unsupported MIDI status 0x${status.toString(16)}.`);
        }
        runningStatus = status;
        const kind = status & 0xf0;
        const dataLength = kind === 0xc0 || kind === 0xd0 ? 1 : 2;
        requireBytes(bytes, cursor.value, dataLength, "channel event");
        const data1 = bytes[cursor.value++];
        const data2 = dataLength === 2 ? bytes[cursor.value++] : 0;
        if (data1 > 0x7f || data2 > 0x7f) throw new SpeedrunMIDIError("MIDI channel data must be seven-bit.");
        channels.add(status & 0x0f);
        events.push({ tick, track, order: order++, kind: "midi", code: packMIDI(status, data1, data2) });
    }

    return { events, channels, endTick: tick };
}

function tickToSeconds(
    tick: number,
    tempoEvents: ReadonlyArray<TimedTrackEvent>,
    ticksPerQuarter: number,
) {
    let seconds = 0;
    let previousTick = 0;
    let tempo = 500_000;
    for (const event of tempoEvents) {
        if (event.tick > tick) break;
        seconds += ((event.tick - previousTick) * tempo) / (ticksPerQuarter * 1_000_000);
        previousTick = event.tick;
        tempo = event.microsecondsPerQuarter ?? tempo;
    }
    return seconds + ((tick - previousTick) * tempo) / (ticksPerQuarter * 1_000_000);
}

function appendAllNotesOff(
    events: NotePerformanceEvent[],
    channels: ReadonlySet<number>,
    durationSec: number,
) {
    for (const channel of [...channels].sort((left, right) => left - right)) {
        events.push({ atSec: durationSec, code: packMIDI(0xb0 | channel, 123, 0) });
    }
}

/** Parse SMF format 0/1 into the exact packed short-message performance contract. */
export function parseSMF(input: ArrayBuffer | Uint8Array): NotePerformance {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    requireBytes(bytes, 0, 14, "header");
    if (readASCII(bytes, 0, 4) !== "MThd") throw new SpeedrunMIDIError("MIDI file is missing its MThd header.");
    const headerLength = readUint32(bytes, 4);
    if (headerLength < 6) throw new SpeedrunMIDIError("MIDI header is shorter than six bytes.");
    requireBytes(bytes, 8, headerLength, "header");
    const format = readUint16(bytes, 8);
    const trackCount = readUint16(bytes, 10);
    const division = readUint16(bytes, 12);
    if (format !== 0 && format !== 1) throw new SpeedrunMIDIError(`MIDI format ${format} is not supported.`);
    if ((format === 0 && trackCount !== 1) || trackCount < 1) {
        throw new SpeedrunMIDIError("MIDI track count does not match its format.");
    }
    if ((division & 0x8000) !== 0 || division === 0) {
        throw new SpeedrunMIDIError("SMPTE-timed MIDI files are not supported; use PPQN timing.");
    }

    const allEvents: TimedTrackEvent[] = [];
    const channels = new Set<number>();
    let maximumTick = 0;
    let offset = 8 + headerLength;
    for (let track = 0; track < trackCount; track += 1) {
        requireBytes(bytes, offset, 8, `track ${track + 1} header`);
        if (readASCII(bytes, offset, 4) !== "MTrk") throw new SpeedrunMIDIError(`MIDI track ${track + 1} is missing MTrk.`);
        const length = readUint32(bytes, offset + 4);
        const start = offset + 8;
        const end = start + length;
        requireBytes(bytes, start, length, `track ${track + 1}`);
        const parsed = parseTrack(bytes, start, end, track);
        allEvents.push(...parsed.events);
        for (const channel of parsed.channels) channels.add(channel);
        maximumTick = Math.max(maximumTick, parsed.endTick);
        offset = end;
    }

    const ordered = allEvents.sort((left, right) => (
        left.tick - right.tick || left.track - right.track || left.order - right.order
    ));
    const tempoEvents = ordered.filter((event) => event.kind === "tempo");
    const events = ordered.flatMap((event): NotePerformanceEvent[] => event.kind === "midi" && event.code !== undefined
        ? [{ atSec: tickToSeconds(event.tick, tempoEvents, division), code: event.code }]
        : []);
    const lastEventSeconds = events.reduce((maximum, event) => Math.max(maximum, event.atSec), 0);
    const durationSec = Math.max(0.05, lastEventSeconds, tickToSeconds(maximumTick, tempoEvents, division));
    appendAllNotesOff(events, channels, durationSec);
    events.sort((left, right) => left.atSec - right.atSec || left.code - right.code);
    return { events, durationSec };
}

/** Parse the JSON note-list alternative accepted by the studio. */
export function parseJSONNoteList(input: unknown): NotePerformance {
    const requestedDuration = typeof input === "object" && input !== null && !Array.isArray(input)
        ? (input as { durationSec?: unknown }).durationSec
        : undefined;
    const rawNotes = Array.isArray(input)
        ? input
        : typeof input === "object" && input !== null && Array.isArray((input as { notes?: unknown }).notes)
            ? (input as { notes: unknown[] }).notes
            : null;
    if (rawNotes === null || rawNotes.length === 0) {
        throw new SpeedrunMIDIError("JSON performance must contain at least one note.");
    }
    const performanceWindow = requestedDuration === undefined
        ? null
        : finiteSeconds(requestedDuration, "JSON performance durationSec");
    if (performanceWindow !== null && performanceWindow <= 0) {
        throw new SpeedrunMIDIError("JSON performance durationSec must be greater than zero.");
    }
    const events: NotePerformanceEvent[] = [];
    const channels = new Set<number>();
    let durationSec = 0;
    rawNotes.forEach((raw, index) => {
        if (typeof raw !== "object" || raw === null) throw new SpeedrunMIDIError(`JSON note ${index + 1} must be an object.`);
        const note = raw as Partial<JSONNote>;
        const noteNumber = integer(note.note, `JSON note ${index + 1} pitch`, 0, 127);
        const velocity = integer(note.velocity, `JSON note ${index + 1} velocity`, 1, 127);
        const channel = integer(note.channel ?? 0, `JSON note ${index + 1} channel`, 0, 15);
        const rawOnSec = finiteSeconds(note.onSec, `JSON note ${index + 1} onSec`);
        const rawOffSec = finiteSeconds(note.offSec, `JSON note ${index + 1} offSec`);
        if (rawOffSec <= rawOnSec) throw new SpeedrunMIDIError(`JSON note ${index + 1} must end after it begins.`);
        const onSec = performanceWindow === null ? rawOnSec : Math.min(performanceWindow, rawOnSec);
        const offSec = performanceWindow === null ? rawOffSec : Math.min(performanceWindow, rawOffSec);
        if (offSec <= onSec) return;
        channels.add(channel);
        durationSec = Math.max(durationSec, offSec);
        events.push(
            { atSec: onSec, code: packMIDI(0x90 | channel, noteNumber, velocity) },
            { atSec: offSec, code: packMIDI(0x80 | channel, noteNumber, 0) },
        );
    });
    if (events.length === 0) {
        throw new SpeedrunMIDIError("JSON performance contains no notes inside its duration window.");
    }
    if (performanceWindow !== null) durationSec = performanceWindow;
    appendAllNotesOff(events, channels, durationSec);
    events.sort((left, right) => left.atSec - right.atSec || left.code - right.code);
    return { events, durationSec };
}

export async function parsePerformanceFile(file: File): Promise<NotePerformance> {
    if (file.name.toLowerCase().endsWith(".json") || file.type === "application/json") {
        try {
            return parseJSONNoteList(JSON.parse(await file.text()) as unknown);
        } catch (cause) {
            if (cause instanceof SpeedrunMIDIError) throw cause;
            throw new SpeedrunMIDIError("Performance JSON could not be parsed.", { cause });
        }
    }
    return parseSMF(await file.arrayBuffer());
}
