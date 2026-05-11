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
import { computeKeyboardDimensions } from "../shared/keyboard-geometry";

const midiInputEndpointID = "midiIn";
export const DEFAULT_KEYBOARD_NOTE_COUNT = 25;
export const DEFAULT_KEYBOARD_ROOT_NOTE = 36;

export type PianoKeyboardElement = HTMLElement & {
    root: ShadowRoot;
    notes: unknown[];
    naturalWidth: number;
    accidentalWidth: number;
    handleKey: (event: KeyboardEvent, isDown: boolean) => void;
    allNotesOff: () => void;
    refreshHTML: () => void;
    refreshActiveNoteElements: () => void;
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

export function createKeyboardTagName() {
    return "cosimo-react-desktop-keyboard";
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
                    pressedNoteColour: "#f56cb6",
                });
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
}: {
    rootNote: number;
    noteCount?: number;
    keyboardRef: RefObject<PianoKeyboardElement | null>;
}) {
    const patchConnection = usePatchConnection();
    const hostRef = useRef<HTMLDivElement | null>(null);
    const hostSize = useResizeObserver(hostRef);

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
        keyboard.refreshHTML();
        keyboard.attachToPatchConnection?.(patchConnection, midiInputEndpointID);
        keyboard.refreshActiveNoteElements?.();
        keyboardRef.current = keyboard;
        host.replaceChildren(keyboard);

        return () => {
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
        keyboard.notes = [];
        keyboard.refreshHTML();
        keyboard.refreshActiveNoteElements();
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
        keyboard.notes = [];
        keyboard.refreshHTML();
        keyboard.refreshActiveNoteElements();
    }, [hostSize.width, noteCount, rootNote, keyboardRef]);

    return (
        <div className="synth-grid-card-shell rounded-[28px] border p-3" data-section-accent="lime" data-liquid-detail="edge-rail">
            <div ref={hostRef} className="synth-display-recess h-[118px] w-full overflow-hidden rounded-[22px]" />
        </div>
    );
}
