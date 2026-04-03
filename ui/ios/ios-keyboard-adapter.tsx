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

const MIDI_INPUT_ENDPOINT_ID = "midiIn";

export type IOSPianoKeyboardElement = HTMLElement & {
    root: ShadowRoot;
    notes: unknown[];
    naturalWidth: number;
    accidentalWidth: number;
    handleKey?: (event: KeyboardEvent, isDown: boolean) => void;
    allNotesOff?: () => void;
    touchStart?: (event: TouchEvent) => void;
    touchEnd?: (event: TouchEvent) => void;
    refreshHTML: () => void;
    refreshActiveNoteElements: () => void;
    bindRenderedTouchHandlers?: () => void;
    attributeChangedCallback?: (name: string, oldValue: string | null, newValue: string | null) => void;
    attachToPatchConnection?: (connection: PatchConnectionLike, endpointID: string) => void;
    detachPatchConnection?: (connection: PatchConnectionLike) => void;
};

function getPitchClass(noteNumber: number) {
    const safeNoteNumber = Math.round(Number(noteNumber) || 0);
    return ((safeNoteNumber % 12) + 12) % 12;
}

function isNaturalNoteNumber(noteNumber: number) {
    const pitchClass = getPitchClass(noteNumber);

    return pitchClass === 0 ||
        pitchClass === 2 ||
        pitchClass === 4 ||
        pitchClass === 5 ||
        pitchClass === 7 ||
        pitchClass === 9 ||
        pitchClass === 11;
}

function countNaturalNotesInRange(rootNote: number, noteCount: number) {
    const safeRootNote = Math.round(Number(rootNote) || 0);
    const safeNoteCount = Math.max(1, Math.round(Number(noteCount) || 0));
    let naturalCount = 0;

    for (let noteOffset = 0; noteOffset < safeNoteCount; noteOffset += 1) {
        if (isNaturalNoteNumber(safeRootNote + noteOffset)) {
            naturalCount += 1;
        }
    }

    return Math.max(1, naturalCount);
}

function computeKeyboardDimensions({
    rootNote,
    noteCount,
    availableWidth,
    minNaturalWidth,
}: {
    rootNote: number;
    noteCount: number;
    availableWidth: number;
    minNaturalWidth: number;
}) {
    const naturalCount = countNaturalNotesInRange(rootNote, noteCount);
    const safeAvailableWidth = Math.max(0, Number(availableWidth) || 0);
    const unclampedNaturalWidth = Math.max(1, (safeAvailableWidth - 1) / naturalCount);
    const naturalWidth = Math.max(Number(minNaturalWidth) || 0, unclampedNaturalWidth);
    const accidentalWidth = Math.max(8, naturalWidth * 0.58);

    return {
        naturalWidth,
        accidentalWidth,
    };
}

function useResizeObserver<TElement extends Element>(ref: RefObject<TElement | null>) {
    const [size, setSize] = useState({ width: 1, height: 1 });

    useLayoutEffect(() => {
        const element = ref.current;

        if (!element) {
            return;
        }

        const update = () => {
            const bounds = element.getBoundingClientRect();
            const host = element as unknown as HTMLElement;
            setSize({
                width: Math.max(1, bounds.width || host.clientWidth || 1),
                height: Math.max(1, bounds.height || host.clientHeight || 1),
            });
        };

        const observer = new ResizeObserver(update);
        observer.observe(element);
        update();

        return () => observer.disconnect();
    }, [ref]);

    return size;
}

function getKeyboardTagName(styleName: string) {
    return `cosimo-react-ios-keyboard-${styleName}`;
}

export function ensureIOSKeyboardElement(
    patchConnection: PatchConnectionLike,
    styleName: string,
    keyboardOptions: {
        naturalNoteWidth: number;
        accidentalWidth: number;
    },
) {
    if (!patchConnection.utilities?.PianoKeyboard) {
        return null;
    }

    const tagName = getKeyboardTagName(styleName);

    if (!window.customElements.get(tagName)) {
        const BaseKeyboard = patchConnection.utilities.PianoKeyboard as unknown as {
            new (options: {
                naturalNoteWidth: number;
                accidentalWidth: number;
                accidentalPercentageHeight: number;
                pressedNoteColour: string;
            }): HTMLElement;
        };

        class CosimoIOSKeyboard extends BaseKeyboard {
            constructor() {
                super({
                    naturalNoteWidth: keyboardOptions.naturalNoteWidth,
                    accidentalWidth: keyboardOptions.accidentalWidth,
                    accidentalPercentageHeight: 64,
                    pressedNoteColour: "#f56cb6",
                });
            }

            bindRenderedTouchHandlers() {
                const keyboard = this as unknown as IOSPianoKeyboardElement;

                for (const child of Array.from(keyboard.root.children)) {
                    const touchTarget = child as EventTarget & {
                        addEventListener: (
                            type: string,
                            listener: (event: Event) => void,
                            options?: AddEventListenerOptions,
                        ) => void;
                    };
                    touchTarget.addEventListener("touchstart", (event) => keyboard.touchStart?.(event as TouchEvent), { passive: false });
                    touchTarget.addEventListener("touchend", (event) => keyboard.touchEnd?.(event as TouchEvent));
                }
            }

            attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
                const keyboard = this as unknown as IOSPianoKeyboardElement;
                const baseAttributeChanged = (BaseKeyboard.prototype as {
                    attributeChangedCallback?: (name: string, oldValue: string | null, newValue: string | null) => void;
                }).attributeChangedCallback;

                baseAttributeChanged?.call(this, name, oldValue, newValue);

                if (oldValue === newValue) {
                    return;
                }

                keyboard.notes = [];
                keyboard.refreshHTML();
                this.bindRenderedTouchHandlers();
                keyboard.refreshActiveNoteElements();
            }
        }

        window.customElements.define(tagName, CosimoIOSKeyboard);
    }

    return tagName;
}

export function IOSKeyboardDock({
    rootNote,
    noteCount,
    naturalNoteWidth,
    accidentalWidth,
    keyboardRef,
}: {
    rootNote: number;
    noteCount: number;
    naturalNoteWidth: number;
    accidentalWidth: number;
    keyboardRef: RefObject<IOSPianoKeyboardElement | null>;
}) {
    const patchConnection = usePatchConnection();
    const hostRef = useRef<HTMLDivElement | null>(null);
    const hostSize = useResizeObserver(hostRef);

    useEffect(() => {
        const tagName = ensureIOSKeyboardElement(
            patchConnection,
            `ios-${noteCount}-${naturalNoteWidth}-${accidentalWidth}`,
            {
                naturalNoteWidth,
                accidentalWidth,
            },
        );
        const host = hostRef.current;

        if (!tagName || !host) {
            return;
        }

        const KeyboardElement = window.customElements.get(tagName);

        if (!KeyboardElement) {
            return;
        }

        const keyboard = new KeyboardElement() as IOSPianoKeyboardElement;
        keyboard.classList.add("keyboard");
        keyboard.style.display = "block";
        keyboard.style.width = "100%";
        keyboard.style.height = "100%";
        keyboard.setAttribute("root-note", String(rootNote));
        keyboard.setAttribute("note-count", String(noteCount));
        keyboard.refreshHTML();
        keyboard.bindRenderedTouchHandlers?.();
        keyboard.attachToPatchConnection?.(patchConnection, MIDI_INPUT_ENDPOINT_ID);
        keyboard.refreshActiveNoteElements?.();
        keyboardRef.current = keyboard;
        host.replaceChildren(keyboard);

        return () => {
            keyboard.detachPatchConnection?.(patchConnection);
            keyboardRef.current = null;
            host.replaceChildren();
        };
    }, [accidentalWidth, naturalNoteWidth, noteCount, patchConnection, rootNote, keyboardRef]);

    useEffect(() => {
        const keyboard = keyboardRef.current;

        if (!keyboard) {
            return;
        }

        keyboard.setAttribute("root-note", String(rootNote));
        keyboard.setAttribute("note-count", String(noteCount));
    }, [noteCount, rootNote, keyboardRef]);

    useEffect(() => {
        const keyboard = keyboardRef.current;
        const host = hostRef.current;

        if (!keyboard || !host || hostSize.width <= 0) {
            return;
        }

        const nextDimensions = computeKeyboardDimensions({
            rootNote,
            noteCount,
            availableWidth: hostSize.width,
            minNaturalWidth: naturalNoteWidth,
        });
        const currentNaturalWidth = Number(keyboard.naturalWidth) || 0;
        const currentAccidentalWidth = Number(keyboard.accidentalWidth) || 0;

        if (
            Math.abs(currentNaturalWidth - nextDimensions.naturalWidth) < 0.01 &&
            Math.abs(currentAccidentalWidth - nextDimensions.accidentalWidth) < 0.01
        ) {
            return;
        }

        keyboard.naturalWidth = nextDimensions.naturalWidth;
        keyboard.accidentalWidth = nextDimensions.accidentalWidth;
        keyboard.notes = [];
        keyboard.refreshHTML();
        keyboard.bindRenderedTouchHandlers?.();
        keyboard.refreshActiveNoteElements?.();
    }, [hostSize.width, naturalNoteWidth, noteCount, rootNote, keyboardRef]);

    return <div ref={hostRef} className="keyboard-host" />;
}
