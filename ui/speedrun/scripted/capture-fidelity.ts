const SVG_PRESENTATION_PROPERTIES = [
    "color",
    "fill",
    "fill-opacity",
    "fill-rule",
    "filter",
    "opacity",
    "paint-order",
    "stroke",
    "stroke-dasharray",
    "stroke-dashoffset",
    "stroke-linecap",
    "stroke-linejoin",
    "stroke-miterlimit",
    "stroke-opacity",
    "stroke-width",
    "vector-effect",
] as const;

function nextAnimationFrame() {
    return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

async function decodeImage(image: HTMLImageElement) {
    if (!image.complete) {
        await new Promise<void>((resolve, reject) => {
            image.addEventListener("load", () => resolve(), { once: true });
            image.addEventListener("error", () => reject(new Error(`Capture image failed to load: ${image.currentSrc || image.src}`)), { once: true });
        });
    }

    if (typeof image.decode === "function") {
        await image.decode();
    }
}

function lightDomShadowStyle(css: string, hostSelector: string) {
    const scopedCss = css
        .replace(/:host\(([^)]+)\)/g, ":scope$1")
        .replaceAll(":host", ":scope");
    return `@scope (${hostSelector}) { ${scopedCss} }`;
}

const CAPTURE_SHADOW_CLONE = "data-capture-shadow-clone";
const CAPTURE_SHADOW_ORIGINAL = "data-capture-shadow-original";
const CAPTURE_SHADOW_HIDE = "data-capture-shadow-hide";
const CAPTURE_SHADOW_SLOT = "data-capture-shadow-slot";

/**
 * Capture-only fallback for open shadow roots such as the preset-name bar.
 * Clone the rendered leaf into its light DOM and project it through a slot;
 * product components and their normal shadow-root path remain untouched.
 */
export function flattenCaptureShadowRoots(root: ParentNode) {
    const hosts = [...root.querySelectorAll<HTMLElement>("*")]
        .filter((element) => element.shadowRoot !== null);

    for (const host of hosts) {
        const shadow = host.shadowRoot;
        if (!shadow || (
            shadow.childElementCount === 1
            && shadow.firstElementChild instanceof HTMLSlotElement
        )) {
            continue;
        }

        host.querySelector(`:scope > [${CAPTURE_SHADOW_CLONE}]`)?.remove();
        shadow.querySelectorAll(`slot[${CAPTURE_SHADOW_SLOT}], style[${CAPTURE_SHADOW_HIDE}]`)
            .forEach((element) => element.remove());
        const originals = [...shadow.childNodes];
        const cloneContainer = document.createElement("div");
        cloneContainer.setAttribute(CAPTURE_SHADOW_CLONE, "true");
        cloneContainer.style.display = "contents";
        const clones = originals.map((node) => {
            const clone = node.cloneNode(true);
            if (clone instanceof HTMLStyleElement) {
                clone.textContent = lightDomShadowStyle(clone.textContent ?? "", host.localName);
            }
            if (clone instanceof Element) {
                clone.removeAttribute(CAPTURE_SHADOW_ORIGINAL);
                clone.querySelectorAll(`[${CAPTURE_SHADOW_ORIGINAL}]`)
                    .forEach((element) => element.removeAttribute(CAPTURE_SHADOW_ORIGINAL));
            }
            return clone;
        });
        cloneContainer.append(...clones);
        host.append(cloneContainer);

        for (const element of originals) {
            if (element instanceof Element && !(element instanceof HTMLStyleElement)) {
                element.setAttribute(CAPTURE_SHADOW_ORIGINAL, "true");
            }
        }
        const hideOriginals = document.createElement("style");
        hideOriginals.setAttribute(CAPTURE_SHADOW_HIDE, "true");
        hideOriginals.textContent = `[${CAPTURE_SHADOW_ORIGINAL}] { display: none !important; }`;
        const slot = document.createElement("slot");
        slot.setAttribute(CAPTURE_SHADOW_SLOT, "true");
        shadow.append(hideOriginals, slot);
    }
}

/** Resolve external CSS/variables before Remotion serializes SVGs in isolation. */
export function inlineCaptureSvgPresentation(root: ParentNode) {
    for (const svg of root.querySelectorAll<SVGSVGElement>("svg")) {
        const bounds = svg.getBoundingClientRect();
        // The fallback serializes each SVG to a standalone data URL. A
        // percentage-only width/height has no containing block there and
        // decodes as a 0px intrinsic bitmap, so pin its already-computed box.
        if (bounds.width > 0 && bounds.height > 0) {
            svg.setAttribute("width", String(bounds.width));
            svg.setAttribute("height", String(bounds.height));
        }
        for (const element of [svg, ...svg.querySelectorAll<SVGElement>("*")]) {
            const computed = getComputedStyle(element);

            for (const property of SVG_PRESENTATION_PROPERTIES) {
                const value = computed.getPropertyValue(property).trim();
                if (value && value !== "normal") {
                    element.style.setProperty(property, value);
                }
            }
        }
    }
}

export function pauseCaptureAnimations(root: Element, currentTimeMilliseconds?: number) {
    for (const animation of root.getAnimations({ subtree: true })) {
        animation.pause();
        if (currentTimeMilliseconds !== undefined) {
            animation.currentTime = currentTimeMilliseconds;
        }
    }
}

export async function settleCaptureSubtree(
    root: Element,
    {
        flattenShadowRoots = true,
        animationTimeMilliseconds,
    }: {
        readonly flattenShadowRoots?: boolean;
        readonly animationTimeMilliseconds?: number;
    } = {},
) {
    await document.fonts.ready;
    if (flattenShadowRoots) {
        flattenCaptureShadowRoots(root);
    }
    await Promise.all([...root.querySelectorAll<HTMLImageElement>("img")].map(decodeImage));
    await Promise.resolve();
    await nextAnimationFrame();
    await nextAnimationFrame();
    inlineCaptureSvgPresentation(root);
    pauseCaptureAnimations(root, animationTimeMilliseconds);
    await nextAnimationFrame();
    await nextAnimationFrame();
    await nextAnimationFrame();
}
