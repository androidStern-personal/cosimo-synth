import {
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    type RefObject,
} from "react";

import {
    usePatchConnection,
    type PatchConnectionLike,
} from "../shared/cmajor-react";
import {
    BROWSER_AUDIO_LEAVE_EVENT,
    BROWSER_AUDIO_RETURN_EVENT,
} from "../shared/browser-audio-events";
import { computeKeyboardDimensions } from "../shared/keyboard-geometry";

const midiInputEndpointID = "midiIn";
// A non-mouse recovery may only be accepted on pointerup. Forwarding the
// matching note-up while Cmajor is still suspended queues on/off together and
// can yield no audible sample, so only that downstream release waits until the
// recovered graph has rendered for 60 ms. A newer note or panic flushes it;
// 1 s is the denied-recovery fail-safe, and touchcancel always releases now.
const RECOVERED_NOTE_MINIMUM_MS = 60;
const DEFERRED_NOTE_RELEASE_TIMEOUT_MS = 1000;
export const DEFAULT_KEYBOARD_NOTE_COUNT = 25;
export const DEFAULT_KEYBOARD_ROOT_NOTE = 36;

export type PianoKeyboardElement = HTMLElement & {
    root?: ShadowRoot;
    notes: unknown[];
    naturalWidth: number;
    accidentalWidth: number;
    accidentalPercentageHeight: number;
    handleKey: (event: KeyboardEvent, isDown: boolean) => void;
    allNotesOff: () => void;
    touchStart?: (event: TouchEvent) => void;
    touchEnd?: (event: TouchEvent) => void;
    refreshHTML: () => void;
    refreshActiveNoteElements: () => void;
    bindRenderedTouchHandlers?(): void;
    attachToPatchConnection?: (connection: PatchConnectionLike, endpointID: string) => void;
    detachPatchConnection?: (connection: PatchConnectionLike) => void;
};

function useResizeObserver<TElement extends Element>(ref: RefObject<TElement | null>) {
    const [size, setSize] = useState({ width: 1, height: 1 });

    useLayoutEffect(() => {
        const element = ref.current;

        if (!element) {
            return;
        }

        const update = () => {
            const host = element as unknown as HTMLElement;
            setSize({
                width: Math.max(1, host.clientWidth || 1),
                height: Math.max(1, host.clientHeight || 1),
            });
        };

        const observer = new ResizeObserver(update);
        observer.observe(element);
        update();

        return () => observer.disconnect();
    }, [ref]);

    return size;
}

export function createKeyboardTagName() {
    return "cosimo-react-desktop-keyboard";
}

function refreshKeyboardLayout(keyboard: PianoKeyboardElement) {
    keyboard.notes = [];
    keyboard.refreshHTML();
    keyboard.bindRenderedTouchHandlers?.();
    keyboard.style.maxWidth = "100%";
    keyboard.style.minWidth = "0";
    keyboard.refreshActiveNoteElements();
}

export function ensureKeyboardElement(patchConnection: PatchConnectionLike) {
    const tagName = createKeyboardTagName();

    if (!patchConnection.utilities?.PianoKeyboard) {
        return null;
    }

    if (!window.customElements.get(tagName)) {
        const BaseKeyboard = patchConnection.utilities.PianoKeyboard as unknown as {
            new (options: {
                naturalNoteWidth: number;
                accidentalWidth: number;
                accidentalPercentageHeight: number;
                pressedNoteColour: string;
            }): PianoKeyboardElement;
        };

        class CosimoDesktopKeyboard extends BaseKeyboard {
            constructor() {
                super({
                    naturalNoteWidth: 22,
                    accidentalWidth: 13,
                    accidentalPercentageHeight: 64,
                    pressedNoteColour: "#b9f45d",
                });
            }

            getCSS() {
                return `
                    * {
                        box-sizing: border-box;
                        margin: 0;
                        padding: 0;
                        user-select: none;
                        -webkit-user-select: none;
                    }

                    :host {
                        display: block;
                        min-width: 0;
                        max-width: 100%;
                        overflow: hidden;
                        position: relative;
                        touch-action: none;
                    }

                    .note-holder {
                        position: relative;
                        height: 100%;
                        overflow: hidden;
                        border-radius: 18px;
                        background: #252727;
                    }

                    .natural-note {
                        position: absolute;
                        display: flex;
                        width: ${this.naturalWidth}px;
                        height: 100%;
                        align-items: flex-end;
                        justify-content: center;
                        border: 1px solid #232525;
                        border-radius: 0 0 8px 8px;
                        background: linear-gradient(180deg, #f5f4ec 0%, #deddd5 100%);
                        box-shadow: inset 0 -10px 18px rgb(32 35 35 / 0.08);
                    }

                    .natural-note:first-of-type {
                        border-radius: 18px 0 8px 18px;
                    }

                    p {
                        pointer-events: none;
                        padding-bottom: 7px;
                        color: rgb(46 50 50 / 0.56);
                        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
                        font-size: 10px;
                        font-weight: 650;
                        letter-spacing: 0.08em;
                    }

                    .accidental-note {
                        position: absolute;
                        z-index: 2;
                        top: 0;
                        width: ${this.accidentalWidth}px;
                        height: ${this.accidentalPercentageHeight}%;
                        border: 1px solid #111313;
                        border-radius: 0 0 7px 7px;
                        background: linear-gradient(180deg, #252828 0%, #111313 100%);
                        box-shadow: 0 5px 9px rgb(0 0 0 / 0.38);
                    }

                    .note.active {
                        background: linear-gradient(180deg, #d8ff85 0%, #9bcf46 100%);
                        box-shadow: inset 0 0 0 1px rgb(245 255 216 / 0.5), 0 0 18px rgb(185 244 93 / 0.28);
                    }
                `;
            }

            bindRenderedTouchHandlers() {
                const keyboard = this as PianoKeyboardElement;

                for (const child of Array.from(keyboard.root?.children ?? [])) {
                    if (!(child instanceof HTMLElement)) {
                        continue;
                    }

                    child.addEventListener("touchstart", (event) => keyboard.touchStart?.(event), { passive: false });
                    child.addEventListener("touchend", (event) => keyboard.touchEnd?.(event));
                    child.addEventListener("touchcancel", (event) => keyboard.touchEnd?.(event));
                }
            }
        }

        window.customElements.define(tagName, CosimoDesktopKeyboard);
    }

    return tagName;
}

export function KeyboardDock({
    rootNote,
    noteCount = DEFAULT_KEYBOARD_NOTE_COUNT,
    keyboardRef,
    onIntentionalNote,
}: {
    rootNote: number;
    noteCount?: number;
    keyboardRef: RefObject<PianoKeyboardElement | null>;
    /**
     * Observes the user's own key presses (the element's note-down/note-up
     * events), which host/DAW playback never dispatches — the intentional-note
     * feed for last-played-pitch bookkeeping (T10B).
     */
    onIntentionalNote?: (status: number, noteNumber: number, velocity: number) => void;
}) {
    const patchConnection = usePatchConnection();
    const hostRef = useRef<HTMLDivElement | null>(null);
    const hostSize = useResizeObserver(hostRef);
    const onIntentionalNoteRef = useRef(onIntentionalNote);
    onIntentionalNoteRef.current = onIntentionalNote;

    useEffect(() => {
        const tagName = ensureKeyboardElement(patchConnection);
        const host = hostRef.current;

        if (!tagName || !host) {
            return;
        }

        const KeyboardElement = window.customElements.get(tagName);

        if (!KeyboardElement) {
            return;
        }

        const keyboard = new KeyboardElement() as PianoKeyboardElement;
        keyboard.classList.add("keyboard");
        keyboard.style.display = "block";
        keyboard.style.width = "100%";
        keyboard.style.height = "100%";
        keyboard.tabIndex = 0;
        keyboard.setAttribute("root-note", String(rootNote));
        keyboard.setAttribute("note-count", String(noteCount));
        refreshKeyboardLayout(keyboard);
        const readNoteNumber = (event: Event) => {
            const note = Number((event as CustomEvent<{ note?: unknown }>).detail?.note);
            return Number.isFinite(note) ? note : null;
        };
        const originalTouchEnd = keyboard.touchEnd?.bind(keyboard);
        const originalAllNotesOff = keyboard.allNotesOff.bind(keyboard);
        let browserAudioAway = false;
        let recoveredAt = 0;
        let releasingCancelledTouch = false;
        let replayingDeferredNoteUp = false;
        const recoveryOwnedNotes = new Set<number>();
        const deferredNoteReleases = new Map<number, number>();
        const finishDeferredNoteRelease = (note: number) => {
            const timeout = deferredNoteReleases.get(note);
            if (timeout === undefined) return;
            window.clearTimeout(timeout);
            deferredNoteReleases.delete(note);
            replayingDeferredNoteUp = true;
            try {
                keyboard.dispatchEvent(new CustomEvent("note-up", {
                    detail: { note },
                }));
            } finally {
                replayingDeferredNoteUp = false;
            }
        };
        const scheduleDeferredNoteRelease = (note: number, delayMs: number) => {
            const oldTimeout = deferredNoteReleases.get(note);
            if (oldTimeout !== undefined) window.clearTimeout(oldTimeout);
            deferredNoteReleases.set(note, window.setTimeout(
                () => finishDeferredNoteRelease(note),
                delayMs,
            ));
        };
        const finishAllDeferredNoteReleases = () => {
            for (const note of [...deferredNoteReleases.keys()]) finishDeferredNoteRelease(note);
        };
        const handleBrowserAudioLeave = () => {
            browserAudioAway = true;
            recoveredAt = 0;
            recoveryOwnedNotes.clear();
            finishAllDeferredNoteReleases();
        };
        const handleBrowserAudioReturn = () => {
            browserAudioAway = false;
            recoveredAt = performance.now();
            for (const [note, timeout] of deferredNoteReleases) {
                window.clearTimeout(timeout);
                deferredNoteReleases.set(note, window.setTimeout(
                    () => finishDeferredNoteRelease(note),
                    RECOVERED_NOTE_MINIMUM_MS,
                ));
            }
        };
        const handleDeferredNoteUp = (event: Event) => {
            if (replayingDeferredNoteUp) {
                return;
            }
            const note = readNoteNumber(event);
            if (note === null || !recoveryOwnedNotes.delete(note) || releasingCancelledTouch) {
                return;
            }
            const delayMs = browserAudioAway
                ? DEFERRED_NOTE_RELEASE_TIMEOUT_MS
                : Math.max(0, recoveredAt + RECOVERED_NOTE_MINIMUM_MS - performance.now());
            if (delayMs <= 0) {
                return;
            }
            event.stopImmediatePropagation();
            scheduleDeferredNoteRelease(note, delayMs);
        };
        const handlePendingNoteOwnership = (event: Event) => {
            const note = readNoteNumber(event);
            if (note === null) return;
            finishAllDeferredNoteReleases();
            if (browserAudioAway) recoveryOwnedNotes.add(note);
        };
        keyboard.allNotesOff = () => {
            recoveryOwnedNotes.clear();
            finishAllDeferredNoteReleases();
            originalAllNotesOff();
        };
        if (originalTouchEnd) {
            keyboard.touchEnd = (event) => {
                releasingCancelledTouch = event.type === "touchcancel";
                try {
                    originalTouchEnd(event);
                } finally {
                    releasingCancelledTouch = false;
                }
            };
        }
        keyboard.addEventListener("note-down", handlePendingNoteOwnership);
        keyboard.addEventListener("note-up", handleDeferredNoteUp);
        window.addEventListener(BROWSER_AUDIO_LEAVE_EVENT, handleBrowserAudioLeave);
        window.addEventListener(BROWSER_AUDIO_RETURN_EVENT, handleBrowserAudioReturn);
        const handleNoteDown = (event: Event) => {
            const note = readNoteNumber(event);
            if (note !== null) {
                onIntentionalNoteRef.current?.(0x90, note, 100);
            }
        };
        const handleNoteUp = (event: Event) => {
            const note = readNoteNumber(event);
            if (note !== null) {
                onIntentionalNoteRef.current?.(0x80, note, 0);
            }
        };
        // Preview ownership must clear before the keyboard sends a same-pitch
        // user note-on through its later-registered connection listener.
        keyboard.addEventListener("note-down", handleNoteDown);
        keyboard.addEventListener("note-up", handleNoteUp);
        keyboard.attachToPatchConnection?.(patchConnection, midiInputEndpointID);
        keyboardRef.current = keyboard;
        host.replaceChildren(keyboard);

        return () => {
            window.removeEventListener(BROWSER_AUDIO_LEAVE_EVENT, handleBrowserAudioLeave);
            window.removeEventListener(BROWSER_AUDIO_RETURN_EVENT, handleBrowserAudioReturn);
            recoveryOwnedNotes.clear();
            finishAllDeferredNoteReleases();
            keyboard.allNotesOff();
            keyboard.removeEventListener("note-down", handlePendingNoteOwnership);
            keyboard.removeEventListener("note-up", handleDeferredNoteUp);
            keyboard.removeEventListener("note-down", handleNoteDown);
            keyboard.removeEventListener("note-up", handleNoteUp);
            keyboard.detachPatchConnection?.(patchConnection);
            keyboardRef.current = null;
            host.replaceChildren();
        };
    }, [patchConnection, keyboardRef]);

    useEffect(() => {
        const keyboard = keyboardRef.current;

        if (!keyboard) {
            return;
        }

        const currentRootNote = Number(keyboard.getAttribute("root-note")) || DEFAULT_KEYBOARD_ROOT_NOTE;
        const currentNoteCount = Number(keyboard.getAttribute("note-count")) || DEFAULT_KEYBOARD_NOTE_COUNT;

        if (currentRootNote === rootNote && currentNoteCount === noteCount) {
            return;
        }

        keyboard.setAttribute("root-note", String(rootNote));
        keyboard.setAttribute("note-count", String(noteCount));
        refreshKeyboardLayout(keyboard);
    }, [noteCount, rootNote, keyboardRef]);

    useEffect(() => {
        const keyboard = keyboardRef.current;
        const host = hostRef.current;

        if (!keyboard || !host || hostSize.width <= 0) {
            return;
        }

        const { naturalWidth, accidentalWidth } = computeKeyboardDimensions({
            rootNote,
            noteCount,
            availableWidth: hostSize.width,
        });
        const currentNaturalWidth = Number(keyboard.naturalWidth) || 0;
        const currentAccidentalWidth = Number(keyboard.accidentalWidth) || 0;

        if (
            Math.abs(currentNaturalWidth - naturalWidth) < 0.01 &&
            Math.abs(currentAccidentalWidth - accidentalWidth) < 0.01
        ) {
            return;
        }

        keyboard.naturalWidth = naturalWidth;
        keyboard.accidentalWidth = accidentalWidth;
        refreshKeyboardLayout(keyboard);
    }, [hostSize.width, noteCount, rootNote, keyboardRef]);

    return (
        <div className="synth-grid-card-shell min-w-0 max-w-full rounded-[24px] border p-2" data-section-accent="lime" data-liquid-detail="edge-rail">
            <div ref={hostRef} className="synth-display-recess h-[112px] min-w-0 max-w-full overflow-hidden rounded-[18px]" />
        </div>
    );
}
