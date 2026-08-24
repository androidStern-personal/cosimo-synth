/**
 * DEPRECATED (rasterizer compensation layer): superseded by the live-performance render path in
 * ui/speedrun/live/ (see VIDEO_BOUNCE_LIVE_RENDER_PLAN.md). Kept only as the
 * VITE_COSIMO_VIDEO_BOUNCE_SCRIPTED=1 escape hatch until the live render is
 * accepted; scheduled for deletion with its suites afterwards.
 */
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
    "stop-color",
    "stop-opacity",
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

const emulatedMaskState = new WeakMap<HTMLElement, string>();
const recoloredMaskCache = new Map<string, Promise<string>>();

const CAPTURE_COLOR_PROPERTIES = [
    "background-color",
    "border-top-color",
    "border-right-color",
    "border-bottom-color",
    "border-left-color",
    "outline-color",
    "color",
] as const;

const inlinedCaptureColors = new WeakMap<HTMLElement, Map<string, string>>();
const normalizedColorCache = new Map<string, string>();
let colorNormalizerContext: CanvasRenderingContext2D | null = null;

/** Serialize any computed color through canvas fillStyle, which collapses
    modern forms (`color(srgb …)`) to the plain rgb()/#hex the fallback
    rasterizer's parser understands. */
function normalizedColor(value: string): string {
    let normalized = normalizedColorCache.get(value);
    if (normalized === undefined) {
        if (colorNormalizerContext === null) {
            colorNormalizerContext = document.createElement("canvas").getContext("2d");
        }
        if (colorNormalizerContext === null) {
            return value;
        }
        colorNormalizerContext.fillStyle = "#000";
        colorNormalizerContext.fillStyle = value;
        normalized = String(colorNormalizerContext.fillStyle);
        normalizedColorCache.set(value, normalized);
    }
    return normalized;
}

/**
 * The fallback rasterizer cannot evaluate modern color functions such as
 * `color-mix()` and degrades them to a wrong flat color (observed: a 14%
 * source tint painted as the fully saturated source color). Inline every
 * element's already-resolved computed colors so it only ever parses plain
 * rgb values. Same discipline as the SVG pass: remove exactly what this
 * pass wrote before re-reading, and never touch product-owned inline values.
 */
export function inlineCaptureColors(root: ParentNode) {
    for (const element of root.querySelectorAll<HTMLElement>("*")) {
        if (emulatedMaskState.has(element)) {
            continue;
        }
        const inlined = inlinedCaptureColors.get(element);
        if (inlined) {
            for (const [property, value] of inlined) {
                if (element.style.getPropertyValue(property) === value) {
                    element.style.removeProperty(property);
                }
            }
            inlined.clear();
        }
        const computed = getComputedStyle(element);
        const record = inlined ?? new Map<string, string>();
        inlinedCaptureColors.set(element, record);
        for (const property of CAPTURE_COLOR_PROPERTIES) {
            if (element.style.getPropertyValue(property)) {
                continue;
            }
            const value = computed.getPropertyValue(property).trim();
            if (!value || value === "rgba(0, 0, 0, 0)") {
                continue;
            }
            const concrete = normalizedColor(value);
            element.style.setProperty(property, concrete);
            record.set(property, concrete);
        }
    }
}

function recoloredMaskDataUri(url: string, color: string): Promise<string> {
    const key = `${url}|${color}`;
    let cached = recoloredMaskCache.get(key);
    if (!cached) {
        cached = (async () => {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Capture mask asset failed to load: ${url}`);
            }
            // Mask semantics paint the background color wherever the mask
            // image is opaque, whatever the image's own colors are. Force
            // every shape to the masked element's paint color so the glyph
            // silhouette survives as a plain background image.
            const svg = (await response.text()).replace(
                /<svg([^>]*)>/u,
                `<svg$1><style>* { fill: ${color} !important; stroke: none !important; }</style>`,
            );
            const image = new Image();
            image.src = `data:image/svg+xml;base64,${btoa(svg)}`;
            await image.decode();
            // The rasterizer reads background images from raster sources;
            // hand it a decoded PNG rather than a fresh SVG document.
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, image.naturalWidth);
            canvas.height = Math.max(1, image.naturalHeight);
            const context = canvas.getContext("2d");
            if (!context) {
                throw new Error("Capture mask emulation needs a 2D canvas.");
            }
            context.drawImage(image, 0, 0);
            return canvas.toDataURL("image/png");
        })();
        recoloredMaskCache.set(key, cached);
    }
    return cached;
}

function firstMaskUrl(maskImage: string): string | null {
    const match = /^url\("([^"]+)"\)$/u.exec(maskImage);
    return match?.[1] ?? null;
}

const CAPTURE_MASK_IMG = "data-capture-mask-emulated";

/**
 * The fallback rasterizer paints neither CSS masks nor background images
 * (verified empirically: an element with any mask paints nothing at all,
 * and background-image never draws, while `<img>` elements do). Emulate a
 * single-url mask by injecting a child `<img>` carrying the mask silhouette
 * recolored to the element's paint color.
 */
export async function emulateCaptureMasks(root: ParentNode) {
    const tasks: Array<Promise<void>> = [];
    for (const element of root.querySelectorAll<HTMLElement>("*")) {
        const computed = getComputedStyle(element);
        if (computed.maskImage === "none") {
            continue;
        }
        const url = firstMaskUrl(computed.maskImage);
        if (url === null) {
            continue;
        }
        const color = computed.backgroundColor;
        const key = `${url}|${color}`;
        const existing = element.querySelector<HTMLImageElement>(`:scope > img[${CAPTURE_MASK_IMG}]`);
        if (emulatedMaskState.get(element) === key && existing !== null) {
            continue;
        }
        const fit = computed.maskSize.includes("cover") ? "cover" : "contain";
        tasks.push(recoloredMaskDataUri(url, color).then((dataUri) => {
            // The rasterizer ignores the mask but would paint the raw
            // background color as a solid block behind the glyph image.
            element.style.backgroundColor = "transparent";
            const image = existing ?? document.createElement("img");
            image.setAttribute(CAPTURE_MASK_IMG, "true");
            image.alt = "";
            image.src = dataUri;
            image.style.cssText = `position:absolute;inset:0;width:100%;height:100%;object-fit:${fit};pointer-events:none;`;
            if (getComputedStyle(element).position === "static") {
                element.style.position = "relative";
            }
            if (image.parentElement !== element) {
                element.append(image);
            }
            emulatedMaskState.set(element, key);
        }));
    }
    await Promise.all(tasks);
}

const opacityMaskedHidden = new WeakSet<HTMLElement>();

/**
 * The fallback rasterizer paints `visibility: hidden` content (it honors
 * opacity, not visibility — the scaffold's own hiding fallback relies on the
 * same fact). Mirror hidden state into opacity so hidden UI stays hidden in
 * the capture, and lift the mirror the moment the product shows the element.
 */
export function maskCaptureHiddenLeaves(root: ParentNode) {
    // The render scaffold hides the whole tree with `visibility: hidden`,
    // which inherits into every element and would read as product state.
    // Force the root visible for the sweep so only visibility declared
    // inside the capture tree registers, then put the scaffold state back.
    const rootElement = root instanceof HTMLElement ? root : null;
    const scaffoldVisibility = rootElement?.style.getPropertyValue("visibility") ?? "";
    const scaffoldPriority = rootElement?.style.getPropertyPriority("visibility") ?? "";
    rootElement?.style.setProperty("visibility", "visible", "important");
    try {
        for (const element of root.querySelectorAll<HTMLElement>("*")) {
            const hidden = getComputedStyle(element).visibility !== "visible";
            if (opacityMaskedHidden.has(element)) {
                if (element.style.opacity !== "0") {
                    opacityMaskedHidden.delete(element);
                } else if (!hidden) {
                    element.style.removeProperty("opacity");
                    opacityMaskedHidden.delete(element);
                }
                continue;
            }
            if (!hidden || element.style.opacity !== "") {
                continue;
            }
            // `visibility` un-inherits: a visible descendant inside this
            // hidden element must keep painting, and opacity would erase it.
            const descendants = element.querySelectorAll<HTMLElement>("*");
            let hasVisibleDescendant = false;
            for (const descendant of descendants) {
                if (getComputedStyle(descendant).visibility === "visible") {
                    hasVisibleDescendant = true;
                    break;
                }
            }
            if (hasVisibleDescendant) {
                continue;
            }
            element.style.opacity = "0";
            opacityMaskedHidden.add(element);
        }
    } finally {
        if (rootElement) {
            if (scaffoldVisibility === "") {
                rootElement.style.removeProperty("visibility");
            } else {
                rootElement.style.setProperty("visibility", scaffoldVisibility, scaffoldPriority);
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
        rasterizerWorkarounds = true,
        animationTimeMilliseconds,
        scrubAnimations,
    }: {
        readonly flattenShadowRoots?: boolean;
        /** Off for live-reference settles: SVG inlining/pinning, mask
            emulation, and hidden-leaf masking are capture-rasterizer
            workarounds; applying them to the live tree would mask
            capture-only regressions in the fidelity compare. */
        readonly rasterizerWorkarounds?: boolean;
        readonly animationTimeMilliseconds?: number;
        readonly scrubAnimations?: () => void | Promise<void>;
    } = {},
) {
    if (rasterizerWorkarounds) {
        restoreCaptureSvgSizes(root);
    }
    await document.fonts.ready;
    if (flattenShadowRoots) {
        flattenCaptureShadowRoots(root);
    }
    await Promise.all([...root.querySelectorAll<HTMLImageElement>("img")].map(decodeImage));
    await Promise.resolve();
    await nextAnimationFrame();
    await nextAnimationFrame();
    if (rasterizerWorkarounds) {
        inlineCaptureSvgPresentation(root);
        inlineCaptureColors(root);
        await emulateCaptureMasks(root);
    }
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
    // Last, so it reads each element's final visibility for this frame — a
    // reveal in the closing scrub must not serialize with a stale mask.
    if (rasterizerWorkarounds) {
        maskCaptureHiddenLeaves(root);
        await nextAnimationFrame();
    }
}
