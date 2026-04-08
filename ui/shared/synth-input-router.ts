import { useCallback, useEffect, useMemo, useRef, type FocusEventHandler, type PointerEventHandler, type RefObject } from "react";

export type ArrowStepDirection = -1 | 1;

export type SynthArrowTarget = {
    id: string;
    onArrowStep: (direction: ArrowStepDirection) => void;
};

export type SynthKeyboardLike = {
    handleKey?: (event: KeyboardEvent, isDown: boolean) => void;
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
};

function hasCommandModifier(event: KeyboardEvent) {
    return event.metaKey || event.ctrlKey || event.altKey;
}

export function useSynthInputRouter(
    keyboardRef: RefObject<SynthKeyboardLike | null>,
    {
        handleKeyboardOctaveDown,
        handleKeyboardOctaveUp,
    }: SynthInputRouterOptions = {},
) {
    const activeArrowTargetRef = useRef<SynthArrowTarget | null>(null);
    const textEntryDepthRef = useRef(0);
    const handleKeyboardOctaveDownRef = useRef(handleKeyboardOctaveDown);
    const handleKeyboardOctaveUpRef = useRef(handleKeyboardOctaveUp);

    useEffect(() => {
        handleKeyboardOctaveDownRef.current = handleKeyboardOctaveDown;
    }, [handleKeyboardOctaveDown]);

    useEffect(() => {
        handleKeyboardOctaveUpRef.current = handleKeyboardOctaveUp;
    }, [handleKeyboardOctaveUp]);

    const activateArrowTarget = useCallback((target: SynthArrowTarget) => {
        activeArrowTargetRef.current = target;
    }, []);

    const beginTextEntry = useCallback((target: SynthArrowTarget) => {
        activeArrowTargetRef.current = target;
        textEntryDepthRef.current += 1;
        keyboardRef.current?.allNotesOff?.();
    }, [keyboardRef]);

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

            const normalizedKey = event.key.toLowerCase();

            if (normalizedKey === "z" && handleKeyboardOctaveDownRef.current) {
                if (!event.repeat) {
                    const didShiftKeyboardOctave = handleKeyboardOctaveDownRef.current();

                    if (didShiftKeyboardOctave) {
                        keyboardRef.current?.allNotesOff?.();
                    }
                }

                event.preventDefault();
                return;
            }

            if (normalizedKey === "x" && handleKeyboardOctaveUpRef.current) {
                if (!event.repeat) {
                    const didShiftKeyboardOctave = handleKeyboardOctaveUpRef.current();

                    if (didShiftKeyboardOctave) {
                        keyboardRef.current?.allNotesOff?.();
                    }
                }

                event.preventDefault();
                return;
            }

            keyboardRef.current?.handleKey?.(event, true);
        };

        const handleKeyUp = (event: KeyboardEvent) => {
            if (hasCommandModifier(event) || textEntryDepthRef.current > 0) {
                return;
            }

            const normalizedKey = event.key.toLowerCase();

            if (
                (normalizedKey === "z" && handleKeyboardOctaveDownRef.current)
                || (normalizedKey === "x" && handleKeyboardOctaveUpRef.current)
            ) {
                event.preventDefault();
                return;
            }

            keyboardRef.current?.handleKey?.(event, false);
        };

        const handleWindowBlur = () => {
            keyboardRef.current?.allNotesOff?.();
        };

        window.addEventListener("keydown", handleKeyDown, true);
        window.addEventListener("keyup", handleKeyUp, true);
        window.addEventListener("blur", handleWindowBlur);

        return () => {
            window.removeEventListener("keydown", handleKeyDown, true);
            window.removeEventListener("keyup", handleKeyUp, true);
            window.removeEventListener("blur", handleWindowBlur);
        };
    }, [keyboardRef]);

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
