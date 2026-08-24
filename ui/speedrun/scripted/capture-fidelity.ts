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

        host.querySelector(":scope > [data-capture-shadow-clone]")?.remove();
        shadow.querySelectorAll('slot[data-capture-shadow-slot="true"]').forEach((slot) => slot.remove());
        const cloneContainer = document.createElement("div");
        cloneContainer.dataset.captureShadowClone = "true";
        cloneContainer.style.display = "contents";
        const clones = [...shadow.childNodes].map((node) => {
            const clone = node.cloneNode(true);
            if (clone instanceof HTMLStyleElement) {
                clone.textContent = lightDomShadowStyle(clone.textContent ?? "", host.localName);
            }
            return clone;
        });
        cloneContainer.append(...clones);
        host.append(cloneContainer);

        for (const element of shadow.children) {
            if (element instanceof HTMLElement && !(element instanceof HTMLStyleElement)) {
                element.style.setProperty("display", "none", "important");
            }
        }
        const slot = document.createElement("slot");
        slot.dataset.captureShadowSlot = "true";
        shadow.append(slot);
    }
}

/** Resolve external CSS/variables before Remotion serializes SVGs in isolation. */
export function inlineCaptureSvgPresentation(root: ParentNode) {
    for (const svg of root.querySelectorAll<SVGSVGElement>("svg")) {
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

export function pauseCaptureAnimations(root: Element) {
    for (const animation of root.getAnimations({ subtree: true })) {
        animation.pause();
    }
}

export async function settleCaptureSubtree(
    root: Element,
    { flattenShadowRoots = true }: { readonly flattenShadowRoots?: boolean } = {},
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
    pauseCaptureAnimations(root);
    await nextAnimationFrame();
}
