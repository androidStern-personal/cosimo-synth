import { useLayoutEffect, useState, type RefObject } from "react";

export type ElementSize = { readonly width: number; readonly height: number };

/**
 * The element's rendered size in CSS pixels, at least 1×1. Editors draw SVG in
 * this pixel space instead of stretching a fixed viewBox, so text and strokes
 * keep their proportions at any size.
 */
export function useElementSize(ref: RefObject<Element | null>): ElementSize {
    const [size, setSize] = useState<ElementSize>({ width: 1, height: 1 });
    useLayoutEffect(() => {
        const element = ref.current;
        if (!element) return;
        const update = () => {
            const bounds = element.getBoundingClientRect();
            const next = { width: Math.max(1, bounds.width), height: Math.max(1, bounds.height) };
            setSize(previous => previous.width === next.width && previous.height === next.height ? previous : next);
        };
        const observer = new ResizeObserver(update);
        observer.observe(element);
        update();
        return () => observer.disconnect();
    }, [ref]);
    return size;
}
