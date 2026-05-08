import { useCallback, useEffect, useMemo, useRef, type FocusEventHandler, type PointerEventHandler, type RefObject } from "react";

export type ArrowStepDirection = -1 | 1;
export type SynthKeyboardInputMode = "hosted" | "standalone-preview";

export type SynthArrowTarget = {
    id: string;
    onArrowStep: (direction: ArrowStepDirection) => void;
};

export type SynthKeyboardLike = {
    handleKey?: (event: KeyboardEvent, isDown: boolean) => void;
    handleExternalMIDI?: (message: number) => void;
    allNotesOff?: () => void;
};

export type SynthFocusBindings = {
    onPointerDownCapture: PointerEventHandler<HTMLElement>;
    onFocusCapture: FocusEventHandler<HTMLElement>;
};

export type SynthTextEntryBindings = SynthFocusBindings & {
    onBlurCapture: FocusEventHandler<HTMLElement>;
};

export type SynthInputRouterOptions = {
    handleKeyboardOctaveDown?: () => boolean;
    handleKeyboardOctaveUp?: () => boolean;
    keyboardInputMode?: SynthKeyboardInputMode;
    midiInputEndpointID?: string;
    sendMIDIInputEvent?: (endpointID: string, shortMIDICode: number) => void;
};

const DEFAULT_MIDI_INPUT_ENDPOINT_ID = "midiIn";
const KEYBOARD_ROOT_NOTE_DEFAULT = 36;
const NOTE_ON_VELOCITY = 100;
const STANDALONE_KEYBOARD_RELAY_SOURCE = "cosimo-standalone-keyboard";
const previewKeyOffsetsByCode = new Map([
    ["KeyA", 0],
    ["KeyW", 1],
    ["KeyS", 2],
    ["KeyE", 3],
    ["KeyD", 4],
    ["KeyF", 5],
    ["KeyT", 6],
    ["KeyG", 7],
    ["KeyY", 8],
    ["KeyH", 9],
    ["KeyU", 10],
    ["KeyJ", 11],
    ["KeyK", 12],
    ["KeyO", 13],
    ["KeyL", 14],
    ["KeyP", 15],
    ["Semicolon", 16],
    ["Quote", 17],
]);

function hasCommandModifier(event: KeyboardEvent) {
    return event.metaKey || event.ctrlKey || event.altKey;
}

function buildShortMidi(status: number, noteNumber: number, velocity = 0) {
    return ((status & 0xff) << 16) | ((noteNumber & 0x7f) << 8) | (velocity & 0x7f);
}

function readKeyboardRootNote(keyboard: SynthKeyboardLike | null) {
    const keyboardElement = keyboard as (SynthKeyboardLike & { getAttribute?: (name: string) => string | null }) | null;
    const rootNote = Number(keyboardElement?.getAttribute?.("root-note"));

    return Number.isFinite(rootNote)
        ? Math.max(0, Math.min(127, Math.round(rootNote)))
        : KEYBOARD_ROOT_NOTE_DEFAULT;
}

function resolveStandalonePreviewNoteFromCode(code: string, keyboard: SynthKeyboardLike | null) {
    const offset = previewKeyOffsetsByCode.get(code);

    if (offset === undefined) {
        return null;
    }

    return Math.max(0, Math.min(127, readKeyboardRootNote(keyboard) + offset));
}

function isTextEntryElement(element: EventTarget | null) {
    if (!(element instanceof Element)) {
        return false;
    }

    if (element instanceof HTMLElement && element.isContentEditable) {
        return true;
    }

    const tagName = element.tagName.toLowerCase();

    if (tagName === "textarea" || tagName === "select") {
        return true;
    }

    if (element instanceof HTMLInputElement) {
        return !["button", "checkbox", "radio", "range", "reset", "submit"].includes(element.type.toLowerCase());
    }

    if (element.getAttribute("role") === "textbox") {
        return true;
    }

    return Boolean(element.closest('textarea, select, input:not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="reset"]):not([type="submit"]), [contenteditable="true"], [role="textbox"]'));
}

function eventIsInsideTextEntry(event: KeyboardEvent) {
    const path = typeof event.composedPath === "function" ? event.composedPath() : [];
    return path.some(isTextEntryElement) || isTextEntryElement(document.activeElement);
}

function documentHasTextEntryActive() {
    return isTextEntryElement(document.activeElement);
}

function isStandaloneKeyboardRelayMessage(data: unknown): data is {
    source: typeof STANDALONE_KEYBOARD_RELAY_SOURCE;
    eventType: "keydown" | "keyup";
    code: string;
    repeat: boolean;
    shiftKey: boolean;
    metaKey: boolean;
    ctrlKey: boolean;
    altKey: boolean;
} {
    if (!data || typeof data !== "object") {
        return false;
    }

    const message = data as Record<string, unknown>;
    return message.source === STANDALONE_KEYBOARD_RELAY_SOURCE
        && (message.eventType === "keydown" || message.eventType === "keyup")
        && typeof message.code === "string"
        && typeof message.repeat === "boolean"
        && typeof message.shiftKey === "boolean"
        && typeof message.metaKey === "boolean"
        && typeof message.ctrlKey === "boolean"
        && typeof message.altKey === "boolean";
}

export function useSynthInputRouter(
    keyboardRef: RefObject<SynthKeyboardLike | null>,
    {
        handleKeyboardOctaveDown,
        handleKeyboardOctaveUp,
        keyboardInputMode = "hosted",
        midiInputEndpointID = DEFAULT_MIDI_INPUT_ENDPOINT_ID,
        sendMIDIInputEvent,
    }: SynthInputRouterOptions = {},
) {
    const activeArrowTargetRef = useRef<SynthArrowTarget | null>(null);
    const textEntryDepthRef = useRef(0);
    const heldPreviewNotesRef = useRef(new Map<string, number>());
    const handleKeyboardOctaveDownRef = useRef(handleKeyboardOctaveDown);
    const handleKeyboardOctaveUpRef = useRef(handleKeyboardOctaveUp);
    const keyboardInputModeRef = useRef(keyboardInputMode);
    const midiInputEndpointIDRef = useRef(midiInputEndpointID);
    const sendMIDIInputEventRef = useRef(sendMIDIInputEvent);

    useEffect(() => {
        handleKeyboardOctaveDownRef.current = handleKeyboardOctaveDown;
    }, [handleKeyboardOctaveDown]);

    useEffect(() => {
        handleKeyboardOctaveUpRef.current = handleKeyboardOctaveUp;
    }, [handleKeyboardOctaveUp]);

    useEffect(() => {
        keyboardInputModeRef.current = keyboardInputMode;
    }, [keyboardInputMode]);

    useEffect(() => {
        midiInputEndpointIDRef.current = midiInputEndpointID;
    }, [midiInputEndpointID]);

    useEffect(() => {
        sendMIDIInputEventRef.current = sendMIDIInputEvent;
    }, [sendMIDIInputEvent]);

    const sendStandalonePreviewMIDI = useCallback((status: number, noteNumber: number, velocity = 0) => {
        const message = buildShortMidi(status, noteNumber, velocity);

        sendMIDIInputEventRef.current?.(midiInputEndpointIDRef.current, message);
        keyboardRef.current?.handleExternalMIDI?.(message);
    }, [keyboardRef]);

    const releaseStandalonePreviewNotes = useCallback(() => {
        if (heldPreviewNotesRef.current.size === 0) {
            return;
        }

        for (const noteNumber of heldPreviewNotesRef.current.values()) {
            sendStandalonePreviewMIDI(0x80, noteNumber);
        }

        heldPreviewNotesRef.current.clear();
    }, [sendStandalonePreviewMIDI]);

    const activateArrowTarget = useCallback((target: SynthArrowTarget) => {
        activeArrowTargetRef.current = target;
    }, []);

    const beginTextEntry = useCallback((target: SynthArrowTarget) => {
        activeArrowTargetRef.current = target;
        textEntryDepthRef.current += 1;
        releaseStandalonePreviewNotes();
        keyboardRef.current?.allNotesOff?.();
    }, [keyboardRef, releaseStandalonePreviewNotes]);

    const endTextEntry = useCallback(() => {
        textEntryDepthRef.current = Math.max(0, textEntryDepthRef.current - 1);
    }, []);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.defaultPrevented || hasCommandModifier(event)) {
                return;
            }

            const activeArrowTarget = activeArrowTargetRef.current;

            if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && activeArrowTarget) {
                activeArrowTarget.onArrowStep(event.key === "ArrowRight" ? 1 : -1);
                event.preventDefault();
                return;
            }

            if (textEntryDepthRef.current > 0) {
                return;
            }

            if (eventIsInsideTextEntry(event)) {
                return;
            }

            if (keyboardInputModeRef.current === "standalone-preview") {
                if (event.code === "KeyZ" && handleKeyboardOctaveDownRef.current) {
                    if (!event.repeat) {
                        releaseStandalonePreviewNotes();
                        const didShiftKeyboardOctave = handleKeyboardOctaveDownRef.current();

                        if (didShiftKeyboardOctave) {
                            keyboardRef.current?.allNotesOff?.();
                        }
                    }

                    event.preventDefault();
                    return;
                }

                if (event.code === "KeyX" && handleKeyboardOctaveUpRef.current) {
                    if (!event.repeat) {
                        releaseStandalonePreviewNotes();
                        const didShiftKeyboardOctave = handleKeyboardOctaveUpRef.current();

                        if (didShiftKeyboardOctave) {
                            keyboardRef.current?.allNotesOff?.();
                        }
                    }

                    event.preventDefault();
                    return;
                }

                const noteNumber = resolveStandalonePreviewNoteFromCode(event.code, keyboardRef.current);

                if (noteNumber !== null) {
                    event.preventDefault();

                    if (!event.repeat && !heldPreviewNotesRef.current.has(event.code)) {
                        heldPreviewNotesRef.current.set(event.code, noteNumber);
                        sendStandalonePreviewMIDI(0x90, noteNumber, NOTE_ON_VELOCITY);
                    }

                    return;
                }

                return;
            }

            // Hosted plug-ins leave musical typing keys unclaimed so the host can
            // decide whether they belong to DAW musical typing or transport.
        };

        const handleKeyUp = (event: KeyboardEvent) => {
            if (hasCommandModifier(event)) {
                return;
            }

            if (keyboardInputModeRef.current === "standalone-preview") {
                const heldNoteNumber = heldPreviewNotesRef.current.get(event.code);

                if (heldNoteNumber !== undefined) {
                    event.preventDefault();
                    heldPreviewNotesRef.current.delete(event.code);
                    sendStandalonePreviewMIDI(0x80, heldNoteNumber);
                    return;
                }
            }

            if (textEntryDepthRef.current > 0 || eventIsInsideTextEntry(event)) {
                return;
            }

            if (keyboardInputModeRef.current === "standalone-preview") {
                if (
                    (event.code === "KeyZ" && handleKeyboardOctaveDownRef.current)
                    || (event.code === "KeyX" && handleKeyboardOctaveUpRef.current)
                ) {
                    event.preventDefault();
                    return;
                }

                if (resolveStandalonePreviewNoteFromCode(event.code, keyboardRef.current) !== null) {
                    event.preventDefault();
                    return;
                }

                return;
            }

            // Hosted plug-ins leave musical typing key-up events unclaimed too.
        };

        const handleWindowBlur = () => {
            releaseStandalonePreviewNotes();
            keyboardRef.current?.allNotesOff?.();
        };

        const handleRelayedKeyboardMessage = (messageEvent: MessageEvent) => {
            if (keyboardInputModeRef.current !== "standalone-preview" || !isStandaloneKeyboardRelayMessage(messageEvent.data)) {
                return;
            }

            const message = messageEvent.data;

            if (message.metaKey || message.ctrlKey || message.altKey || textEntryDepthRef.current > 0 || documentHasTextEntryActive()) {
                return;
            }

            if (message.eventType === "keydown") {
                if (message.code === "KeyZ" && handleKeyboardOctaveDownRef.current) {
                    if (!message.repeat) {
                        releaseStandalonePreviewNotes();
                        const didShiftKeyboardOctave = handleKeyboardOctaveDownRef.current();

                        if (didShiftKeyboardOctave) {
                            keyboardRef.current?.allNotesOff?.();
                        }
                    }

                    return;
                }

                if (message.code === "KeyX" && handleKeyboardOctaveUpRef.current) {
                    if (!message.repeat) {
                        releaseStandalonePreviewNotes();
                        const didShiftKeyboardOctave = handleKeyboardOctaveUpRef.current();

                        if (didShiftKeyboardOctave) {
                            keyboardRef.current?.allNotesOff?.();
                        }
                    }

                    return;
                }

                const noteNumber = resolveStandalonePreviewNoteFromCode(message.code, keyboardRef.current);

                if (noteNumber !== null && !message.repeat && !heldPreviewNotesRef.current.has(message.code)) {
                    heldPreviewNotesRef.current.set(message.code, noteNumber);
                    sendStandalonePreviewMIDI(0x90, noteNumber, NOTE_ON_VELOCITY);
                }

                return;
            }

            if (
                (message.code === "KeyZ" && handleKeyboardOctaveDownRef.current)
                || (message.code === "KeyX" && handleKeyboardOctaveUpRef.current)
            ) {
                return;
            }

            if (resolveStandalonePreviewNoteFromCode(message.code, keyboardRef.current) !== null) {
                const noteNumber = heldPreviewNotesRef.current.get(message.code);

                if (noteNumber !== undefined) {
                    heldPreviewNotesRef.current.delete(message.code);
                    sendStandalonePreviewMIDI(0x80, noteNumber);
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown, true);
        window.addEventListener("keyup", handleKeyUp, true);
        window.addEventListener("message", handleRelayedKeyboardMessage);
        window.addEventListener("blur", handleWindowBlur);

        return () => {
            window.removeEventListener("keydown", handleKeyDown, true);
            window.removeEventListener("keyup", handleKeyUp, true);
            window.removeEventListener("message", handleRelayedKeyboardMessage);
            window.removeEventListener("blur", handleWindowBlur);
        };
    }, [keyboardRef, releaseStandalonePreviewNotes, sendStandalonePreviewMIDI]);

    const bindArrowTarget = useCallback((target: SynthArrowTarget): SynthFocusBindings => ({
        onPointerDownCapture: () => activateArrowTarget(target),
        onFocusCapture: () => activateArrowTarget(target),
    }), [activateArrowTarget]);

    const bindTextEntryTarget = useCallback((target: SynthArrowTarget): SynthTextEntryBindings => ({
        onPointerDownCapture: () => activateArrowTarget(target),
        onFocusCapture: () => beginTextEntry(target),
        onBlurCapture: () => endTextEntry(),
    }), [activateArrowTarget, beginTextEntry, endTextEntry]);

    return useMemo(() => ({
        activateArrowTarget,
        beginTextEntry,
        endTextEntry,
        bindArrowTarget,
        bindTextEntryTarget,
    }), [activateArrowTarget, beginTextEntry, endTextEntry, bindArrowTarget, bindTextEntryTarget]);
}
