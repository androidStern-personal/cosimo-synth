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
const CAPTURE_SVG_SIZE_PINNED = "data-capture-svg-size-pinned";
const CAPTURE_SVG_ORIGINAL_WIDTH = "data-capture-svg-original-width";
const CAPTURE_SVG_ORIGINAL_HEIGHT = "data-capture-svg-original-height";
const CAPTURE_SVG_ORIGINAL_STYLE_WIDTH = "data-capture-svg-original-style-width";
const CAPTURE_SVG_ORIGINAL_STYLE_HEIGHT = "data-capture-svg-original-style-height";
const CAPTURE_SVG_MISSING_SIZE = "__missing__";

function restoreCaptureSvgSizes(root: ParentNode) {
    for (const svg of root.querySelectorAll<SVGSVGElement>(`svg[${CAPTURE_SVG_SIZE_PINNED}]`)) {
        const width = svg.getAttribute(CAPTURE_SVG_ORIGINAL_WIDTH);
        const height = svg.getAttribute(CAPTURE_SVG_ORIGINAL_HEIGHT);
        if (width === CAPTURE_SVG_MISSING_SIZE) svg.removeAttribute("width");
        else if (width !== null) svg.setAttribute("width", width);
        if (height === CAPTURE_SVG_MISSING_SIZE) svg.removeAttribute("height");
        else if (height !== null) svg.setAttribute("height", height);
        const styleWidth = svg.getAttribute(CAPTURE_SVG_ORIGINAL_STYLE_WIDTH);
        const styleHeight = svg.getAttribute(CAPTURE_SVG_ORIGINAL_STYLE_HEIGHT);
        if (styleWidth === CAPTURE_SVG_MISSING_SIZE) svg.style.removeProperty("width");
        else if (styleWidth !== null) svg.style.width = styleWidth;
        if (styleHeight === CAPTURE_SVG_MISSING_SIZE) svg.style.removeProperty("height");
        else if (styleHeight !== null) svg.style.height = styleHeight;
        svg.removeAttribute(CAPTURE_SVG_SIZE_PINNED);
        svg.removeAttribute(CAPTURE_SVG_ORIGINAL_WIDTH);
        svg.removeAttribute(CAPTURE_SVG_ORIGINAL_HEIGHT);
        svg.removeAttribute(CAPTURE_SVG_ORIGINAL_STYLE_WIDTH);
        svg.removeAttribute(CAPTURE_SVG_ORIGINAL_STYLE_HEIGHT);
    }
}

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

const inlinedSvgPresentation = new WeakMap<SVGElement, Map<string, string>>();

/**
 * Inline style wins the cascade, so a value inlined on frame N would mask
 * every later stylesheet/attribute-driven change and freeze the SVG at its
 * first-seen colors. Remove exactly the values THIS pass wrote (a property the
 * product has since written inline is left alone) so each frame re-reads the
 * true computed presentation before re-inlining it.
 */
function clearOwnInlinedSvgPresentation(element: SVGElement) {
    const inlined = inlinedSvgPresentation.get(element);
    if (!inlined) return;
    for (const [property, value] of inlined) {
        if (element.style.getPropertyValue(property) === value) {
            element.style.removeProperty(property);
        }
    }
    inlined.clear();
}

/** Resolve external CSS/variables before Remotion serializes SVGs in isolation. */
export function inlineCaptureSvgPresentation(root: ParentNode) {
    for (const svg of root.querySelectorAll<SVGSVGElement>("svg")) {
        const bounds = svg.getBoundingClientRect();
        // The fallback serializes each SVG to a standalone data URL. A
        // percentage-only width/height has no containing block there and
        // decodes as a 0px intrinsic bitmap, so pin its already-computed
        // LOCAL box. getBoundingClientRect includes the phone-stage scale;
        // feeding that transformed size back into layout on every frame
        // recursively enlarges responsive SVGs and the surrounding flexbox.
        const localWidth = svg.clientWidth;
        const localHeight = svg.clientHeight;
        if (
            !svg.hasAttribute(CAPTURE_SVG_SIZE_PINNED)
            && bounds.width > 0
            && bounds.height > 0
            && localWidth > 0
            && localHeight > 0
        ) {
            svg.setAttribute(
                CAPTURE_SVG_ORIGINAL_WIDTH,
                svg.getAttribute("width") ?? CAPTURE_SVG_MISSING_SIZE,
            );
            svg.setAttribute(
                CAPTURE_SVG_ORIGINAL_HEIGHT,
                svg.getAttribute("height") ?? CAPTURE_SVG_MISSING_SIZE,
            );
            svg.setAttribute(
                CAPTURE_SVG_ORIGINAL_STYLE_WIDTH,
                svg.style.width || CAPTURE_SVG_MISSING_SIZE,
            );
            svg.setAttribute(
                CAPTURE_SVG_ORIGINAL_STYLE_HEIGHT,
                svg.style.height || CAPTURE_SVG_MISSING_SIZE,
            );
            svg.setAttribute(CAPTURE_SVG_SIZE_PINNED, "true");
            svg.style.width = `${localWidth}px`;
            svg.style.height = `${localHeight}px`;
            svg.setAttribute("width", String(localWidth));
            svg.setAttribute("height", String(localHeight));
        }
        for (const element of [svg, ...svg.querySelectorAll<SVGElement>("*")]) {
            clearOwnInlinedSvgPresentation(element);
            const computed = getComputedStyle(element);
            const inlined = inlinedSvgPresentation.get(element) ?? new Map<string, string>();
            inlinedSvgPresentation.set(element, inlined);

            for (const property of SVG_PRESENTATION_PROPERTIES) {
                if (element.style.getPropertyValue(property)) {
                    // The product (or React) owns this inline value; never
                    // overwrite or adopt it.
                    continue;
                }
                const value = computed.getPropertyValue(property).trim();
                if (value && value !== "normal") {
                    element.style.setProperty(property, value);
                    inlined.set(property, value);
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
        scrubAnimations,
    }: {
        readonly flattenShadowRoots?: boolean;
        readonly animationTimeMilliseconds?: number;
        readonly scrubAnimations?: () => void | Promise<void>;
    } = {},
) {
    restoreCaptureSvgSizes(root);
    await document.fonts.ready;
    if (flattenShadowRoots) {
        flattenCaptureShadowRoots(root);
    }
    await Promise.all([...root.querySelectorAll<HTMLImageElement>("img")].map(decodeImage));
    await Promise.resolve();
    await nextAnimationFrame();
    await nextAnimationFrame();
    inlineCaptureSvgPresentation(root);
    if (scrubAnimations) {
        await scrubAnimations();
    } else {
        pauseCaptureAnimations(root, animationTimeMilliseconds);
    }
    await nextAnimationFrame();
    await nextAnimationFrame();
    await nextAnimationFrame();
    // A visual-endpoint rAF or React transition may have created an
    // animation during the settle turns. Adopt it at this same media frame.
    if (scrubAnimations) {
        await scrubAnimations();
        // Setting Animation.currentTime invalidates style/paint. Give the
        // browser one paint turn before Remotion reads the frame bitmap.
        await nextAnimationFrame();
    }
}
