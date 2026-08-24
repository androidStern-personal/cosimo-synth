type PianoKeyboardElement = HTMLElement & {
    root: ShadowRoot | HTMLElement;
    notes: Array<{ note: number; element: HTMLElement | null }>;
    getCSS(): string;
    getNoteElements(): string;
    refreshActiveNoteElements(): void;
};

type PianoKeyboardConstructor = new (
    options?: Record<string, unknown>,
) => PianoKeyboardElement;

/**
 * The web renderer fallback walks light-DOM children only. This capture-only
 * variant keeps Cmajor's keyboard implementation and Cosimo's subclassed
 * CSS, but projects the generated notes through an otherwise empty shadow
 * root so the same note nodes are visible to both Chromium and the walker.
 */
export function createCapturePianoKeyboardClass(
    BaseKeyboard: CustomElementConstructor,
): CustomElementConstructor {
    const TypedBase = BaseKeyboard as unknown as PianoKeyboardConstructor;

    class CapturePianoKeyboard extends TypedBase {
        private captureConnected = false;

        constructor(options?: Record<string, unknown>) {
            super(options);
            const shadow = this.shadowRoot;

            if (!shadow) {
                throw new Error("The Cmajor piano keyboard did not create its expected shadow root.");
            }

            shadow.replaceChildren(document.createElement("slot"));
            this.root = this;
        }

        connectedCallback() {
            if (this.captureConnected) {
                return;
            }

            this.captureConnected = true;
            this.refreshHTML();
        }

        refreshHTML() {
            // Cmajor calls this virtually from its base constructor, before
            // this class can redirect `root`, and the adapter also calls it
            // before insertion. Rendering on connection avoids custom-element
            // constructor child restrictions while preserving its API.
            if (!this.isConnected || this.root !== this) {
                return;
            }

            const hostSelector = this.localName || "cosimo-react-desktop-keyboard";
            const scopedCss = this.getCSS().replaceAll(":host", ":scope");
            const css = `@scope (${hostSelector}) { ${scopedCss} }`;
            this.innerHTML = `<style>${css}</style>${this.getNoteElements()}`;
            this.notes = [];

            for (let note = 0; note < 128; note += 1) {
                this.notes.push({
                    note,
                    element: this.querySelector<HTMLElement>(`#note${note}`),
                });
            }

            this.style.maxWidth = "100%";
            this.style.minWidth = "0";
            this.refreshActiveNoteElements();
        }
    }

    return CapturePianoKeyboard as unknown as CustomElementConstructor;
}
