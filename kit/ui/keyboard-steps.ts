/**
 * The keyboard policy shared by every kit control.
 *
 * Arrow keys move one step: Right and Up increase, Left and Down decrease.
 * Shift makes a step ten times finer, PageUp and PageDown ten times coarser,
 * and Home and End jump to the ends of the range. A control that edits two
 * quantities at once maps Left/Right to its horizontal quantity and Up/Down
 * and the Page keys to its vertical one; Home and End act on the horizontal one.
 * Holding a key is one gesture: it starts on the first keydown and ends on keyup.
 */
export type KeyboardStep =
    | { readonly kind: "step"; readonly axis: "horizontal" | "vertical"; readonly steps: number }
    | { readonly kind: "min" }
    | { readonly kind: "max" };

export function stepForKey(event: { readonly key: string; readonly shiftKey: boolean }): KeyboardStep | null {
    const size = event.shiftKey ? 0.1 : 1;
    switch (event.key) {
        case "ArrowRight": return { kind: "step", axis: "horizontal", steps: size };
        case "ArrowLeft": return { kind: "step", axis: "horizontal", steps: -size };
        case "ArrowUp": return { kind: "step", axis: "vertical", steps: size };
        case "ArrowDown": return { kind: "step", axis: "vertical", steps: -size };
        case "PageUp": return { kind: "step", axis: "vertical", steps: 10 * size };
        case "PageDown": return { kind: "step", axis: "vertical", steps: -10 * size };
        case "Home": return { kind: "min" };
        case "End": return { kind: "max" };
        default: return null;
    }
}

/** A keyup of one of these keys ends the gesture its keydowns started. */
export function isStepKey(key: string): boolean {
    return stepForKey({ key, shiftKey: false }) !== null;
}
