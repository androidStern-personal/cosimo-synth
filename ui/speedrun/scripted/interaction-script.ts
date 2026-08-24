import type { NavTarget, UIOp } from "../recipe";
import type { SpeedrunTimeline, TimedOp } from "../timeline";

type IndexedSpan = TimedOp & { readonly key: string };

type ActivePointer = {
    readonly key: string;
    readonly pointerId: number;
    readonly target: Element;
    readonly moveTarget: EventTarget;
    readonly upTarget: EventTarget;
    readonly startX: number;
    readonly startY: number;
    x: number;
    y: number;
};

export type ScriptedInteractionSnapshot = {
    readonly activeOpKind: UIOp["kind"] | null;
    readonly activeOpSurface: string | null;
    readonly dragging: ReadonlyArray<{ readonly role: string; readonly mode: string }>;
    readonly hud: {
        readonly visible: boolean;
        readonly axis: string | null;
        readonly baseText: string;
    } | null;
    readonly ghost: {
        readonly present: boolean;
        readonly targetCaptured: boolean;
    };
    readonly hoverTargetRole: string | null;
    readonly confirmedTargetRole: string | null;
    readonly selectedModSource: string | null;
    readonly wavetableText: string | null;
    readonly selectedMsegPointCount: number;
    readonly animationCount: number;
    readonly pointerActive: boolean;
    readonly pointerTargetRole: string | null;
    readonly activeEffect: {
        readonly deviceId: string;
        readonly enabled: boolean;
    } | null;
};

const OSCILLATOR_CONTROL_IDS: Readonly<Record<string, string>> = Object.freeze({
    WavetablePosition: "framePosition",
    WarpMode: "warpMode",
    WarpAmount: "warpAmount",
    UnisonDetune: "unisonDetune",
    UnisonDetuneMode: "unisonDetuneMode",
    UnisonVoices: "unisonVoices",
    VolumeDb: "volumeDb",
    Pan: "pan",
    Octave: "octave",
    Semitone: "semitone",
    FineCents: "fineCents",
    UnisonBlend: "unisonBlend",
    UnisonWidth: "unisonWidth",
    UnisonStackMode: "unisonStackMode",
    UnisonPositionSpread: "unisonPositionSpread",
    UnisonWarpSpread: "unisonWarpSpread",
    Phase: "phase",
    PhaseRandom: "phaseRandom",
    Retrigger: "retrigger",
});

function clamp01(value: number) {
    return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

function spanProgress(span: TimedOp, frame: number) {
    return clamp01((frame - span.startFrame) / Math.max(1, span.endFrame - span.startFrame));
}

function elementRole(element: Element | null) {
    return element?.getAttribute("data-role") ?? null;
}

function visibleElements(root: ParentNode, selector: string) {
    return [...root.querySelectorAll<HTMLElement>(selector)].filter((element) => {
        const bounds = element.getBoundingClientRect();
        return bounds.width > 0 && bounds.height > 0 && element.getClientRects().length > 0;
    });
}

function centerOf(element: Element) {
    const bounds = element.getBoundingClientRect();
    return {
        x: bounds.left + (bounds.width / 2),
        y: bounds.top + (bounds.height / 2),
    };
}

function authorTimestamp(event: Event, timeStamp: number) {
    Object.defineProperty(event, "timeStamp", {
        configurable: true,
        value: timeStamp,
    });
    return event;
}

function eventWindow(root: Element): Window & typeof globalThis {
    const view = root.ownerDocument.defaultView;
    if (!view) throw new Error("The scripted interaction document has no window.");
    return view as Window & typeof globalThis;
}

function dispatchPointer(
    view: Window & typeof globalThis,
    target: EventTarget,
    type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel",
    {
        pointerId,
        x,
        y,
        timeStamp,
        buttons = type === "pointerup" || type === "pointercancel" ? 0 : 1,
    }: {
        readonly pointerId: number;
        readonly x: number;
        readonly y: number;
        readonly timeStamp: number;
        readonly buttons?: number;
    },
) {
    const event = authorTimestamp(new view.PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        composed: true,
        pointerId,
        pointerType: "mouse",
        isPrimary: true,
        button: 0,
        buttons,
        clientX: x,
        clientY: y,
    }), timeStamp);
    target.dispatchEvent(event);
}

function dispatchClick(view: Window & typeof globalThis, target: Element, x: number, y: number, timeStamp: number) {
    target.dispatchEvent(authorTimestamp(new view.MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        composed: true,
        button: 0,
        buttons: 0,
        clientX: x,
        clientY: y,
    }), timeStamp));
}

function dispatchValueEvent(view: Window & typeof globalThis, target: Element, type: "input" | "change", timeStamp: number) {
    target.dispatchEvent(authorTimestamp(new view.Event(type, {
        bubbles: true,
        cancelable: true,
        composed: true,
    }), timeStamp));
}

function setNativeSelectValue(select: HTMLSelectElement, value: string, timeStamp: number) {
    const setter = Object.getOwnPropertyDescriptor(
        eventWindow(select).HTMLSelectElement.prototype,
        "value",
    )?.set;
    setter?.call(select, value);
    dispatchValueEvent(eventWindow(select), select, "input", timeStamp);
    dispatchValueEvent(eventWindow(select), select, "change", timeStamp + 0.1);
}

function setNativeRangeValue(input: HTMLInputElement, value: number, timeStamp: number) {
    const setter = Object.getOwnPropertyDescriptor(
        eventWindow(input).HTMLInputElement.prototype,
        "value",
    )?.set;
    setter?.call(input, String(value));
    dispatchValueEvent(eventWindow(input), input, "input", timeStamp);
    dispatchValueEvent(eventWindow(input), input, "change", timeStamp + 0.1);
}

function opSurface(op: UIOp) {
    switch (op.kind) {
        case "setParam":
        case "setLaneParam":
        case "mapRoute": return op.surface;
        case "navigate": return op.to.tab;
        case "selectWavetable": return `osc${op.osc}WavetableSelect`;
        case "toggleEffect": return op.deviceId;
        case "configureMseg": return `mseg-${op.slot}`;
        case "setEnvelope": return `env-${op.slot}`;
        case "setMacro": return `macro-${op.slot}`;
        case "installLaneBaseline":
        case "installModulationBaseline": return null;
    }
}

function parseSourceId(sourceId: string) {
    const match = /^(mseg|env|macro)-(\d+)$/u.exec(sourceId);
    if (!match) return null;
    return {
        kind: match[1] as "mseg" | "env" | "macro",
        slot: Number(match[2]),
    };
}

function sourceFromRoute(op: Extract<UIOp, { kind: "mapRoute" }>) {
    if (op.route.sourceSlot === null) {
        throw new Error(`Scripted mapRoute requires a slotted source (${op.route.sourceKind}).`);
    }
    return { kind: op.route.sourceKind, slot: op.route.sourceSlot };
}

function sameSourceLabel(label: string | null, source: { readonly kind: string; readonly slot: number }) {
    if (!label) return false;
    const normalized = label.toLowerCase();
    return normalized.includes(source.kind === "env" ? "env" : source.kind)
        && normalized.includes(String(source.slot));
}

function findByDataValue(
    root: ParentNode,
    selector: string,
    attribute: string,
    value: string,
) {
    return visibleElements(root, selector).find((element) => element.getAttribute(attribute) === value) ?? null;
}

function targetForRoute(root: HTMLElement, op: Extract<UIOp, { kind: "mapRoute" }>) {
    if (op.surface === "filter-graph-drop-surface") {
        return root.querySelector<HTMLElement>('[data-role="filter-graph-drop-surface"]');
    }
    return visibleElements(root, "[data-modulation-target-kind]").find((element) => (
        element.dataset.modulationTargetKind === op.route.targetKind
    )) ?? null;
}

function scrollTargetIntoPanel(root: HTMLElement, target: HTMLElement) {
    const panel = target.closest<HTMLElement>('[data-role^="mobile-workspace-panel-"]');
    if (!panel) return;
    const panelBounds = panel.getBoundingClientRect();
    const targetBounds = target.getBoundingClientRect();
    if (targetBounds.top >= panelBounds.top + 8 && targetBounds.bottom <= panelBounds.bottom - 8) return;
    panel.scrollTop += targetBounds.top - panelBounds.top - ((panelBounds.height - targetBounds.height) / 2);
}

/**
 * External frame driver for the real DesktopPatchView. It only uses the
 * existing connection and DOM event seams; transient product state remains
 * owned by the production gesture handlers.
 */
export class ScriptedInteractionDirector {
    private readonly spans: ReadonlyArray<IndexedSpan>;
    private readonly animationStarts = new WeakMap<Animation, number>();
    private readonly completed = new Set<string>();
    private readonly voicePageAttempts = new Map<string, number>();
    private activePointer: ActivePointer | null = null;
    private lastFrame = -1;
    private pointerSerial = 40;
    private activeSpan: IndexedSpan | null = null;
    private animationCount = 0;

    constructor(private readonly timeline: SpeedrunTimeline) {
        this.spans = timeline.sections.flatMap((section, sectionIndex) => (
            section.opSpans.map((span, opIndex) => ({
                ...span,
                key: `${sectionIndex}:${opIndex}:${span.startFrame}:${span.endFrame}`,
            }))
        ));
    }

    advance(root: HTMLElement, fingerOverlay: SVGSVGElement | null, requestedFrame: number, fps: number) {
        const frame = Math.max(0, Math.floor(requestedFrame));
        if (frame === this.lastFrame) return;
        if (frame < this.lastFrame) {
            throw new Error(`ScriptedInteractionDirector requires forward frames (${frame} after ${this.lastFrame}).`);
        }
        this.lastFrame = frame;
        const mediaTime = (frame * 1_000) / fps;
        this.hideFinger(fingerOverlay);

        const navigation = [...this.spans].reverse().find((span) => (
            span.op.kind === "navigate" && span.startFrame <= frame
        ));
        if (navigation?.op.kind === "navigate" && this.ensureNavigation(root, fingerOverlay, navigation.op.to, mediaTime)) {
            this.activeSpan = navigation;
            return;
        }

        if (this.activePointer !== null) {
            const owningSpan = this.spans.find(({ key }) => (
                this.activePointer?.key === key || this.activePointer?.key.startsWith(`${key}:`)
            ));
            if (!owningSpan || frame >= owningSpan.endFrame) {
                this.finishPointer(root, fingerOverlay, mediaTime);
            }
        }

        const active = this.spans
            .filter((span) => frame >= span.startFrame && frame < span.endFrame)
            .find((span) => !this.completed.has(span.key) && (
                span.op.kind !== "installLaneBaseline" && span.op.kind !== "installModulationBaseline"
            )) ?? null;
        this.activeSpan = active;
        if (!active) return;

        const progress = spanProgress(active, frame);
        switch (active.op.kind) {
            case "navigate":
                this.ensureNavigation(root, fingerOverlay, active.op.to, mediaTime);
                return;
            case "setParam":
                this.driveParameter(root, fingerOverlay, active, active.op, progress, mediaTime);
                return;
            case "setLaneParam":
                this.driveLaneParameter(root, fingerOverlay, active, active.op, progress, mediaTime);
                return;
            case "selectWavetable":
                this.driveWavetable(root, fingerOverlay, active, active.op, progress, mediaTime);
                return;
            case "toggleEffect":
                this.driveEffectToggle(root, fingerOverlay, active, active.op, progress, mediaTime);
                return;
            case "mapRoute":
                this.driveMapRoute(root, fingerOverlay, active, active.op, progress, mediaTime);
                return;
            case "configureMseg":
                this.driveMseg(root, fingerOverlay, active, progress, mediaTime);
                return;
            case "setEnvelope":
                this.driveEnvelope(root, fingerOverlay, active, active.op, progress, mediaTime);
                return;
            case "setMacro":
                this.driveMacro(root, fingerOverlay, active, active.op, progress, mediaTime);
                return;
            case "installLaneBaseline":
            case "installModulationBaseline":
                return;
        }
    }

    async scrubAnimations(root: Element, frame: number, fps: number) {
        const animations = root.getAnimations({ subtree: true });
        const mediaTimes = new Map<Animation, number>();
        for (const animation of animations) {
            let firstSeen = this.animationStarts.get(animation);
            if (firstSeen === undefined) {
                firstSeen = frame;
                this.animationStarts.set(animation, firstSeen);
            }
            animation.pause();
            const mediaTime = Math.max(0, ((frame - firstSeen) * 1_000) / fps);
            mediaTimes.set(animation, mediaTime);
            animation.currentTime = mediaTime;
        }
        // pause() enters a pending state on a newly-created CSS transition.
        // Await its ready promise, then re-assert media time so capture never
        // races the compositor's first sampled value.
        await Promise.all(animations.map(async (animation) => {
            try {
                await animation.ready;
            } catch {
                // A component may remove its animation while React settles.
            }
            if (mediaTimes.has(animation)) animation.currentTime = mediaTimes.get(animation) ?? 0;
        }));
        this.animationCount = animations.length;
    }

    inspect(root: HTMLElement): ScriptedInteractionSnapshot {
        const hud = root.querySelector<HTMLElement>('[data-role="mobile-voice-hud"]');
        const ghost = root.querySelector<HTMLElement>('[data-role="mobile-global-mod-source-ghost"]');
        const hover = root.querySelector<HTMLElement>("[data-modulation-target-kind].is-mod-hover");
        const confirmed = root.querySelector<HTMLElement>('[data-creation-confirmed="true"]');
        const selectedSource = root.querySelector<HTMLElement>('[data-role="mobile-global-mod-rail-selected"]');
        const activeEffect = visibleElements(root, '[data-role^="rack-editor-"][data-device-id]')[0] ?? null;
        return {
            activeOpKind: this.activeSpan?.op.kind ?? null,
            activeOpSurface: this.activeSpan ? opSurface(this.activeSpan.op) : null,
            dragging: [...root.querySelectorAll<HTMLElement>("[data-dragging]")].map((element) => ({
                role: elementRole(element) ?? "",
                mode: element.dataset.dragging ?? "",
            })),
            hud: hud === null ? null : {
                visible: hud.classList.contains("is-visible"),
                axis: hud.dataset.hudAxis ?? null,
                baseText: hud.querySelector('[data-role="mobile-voice-hud-base"]')?.textContent?.trim() ?? "",
            },
            ghost: {
                present: ghost !== null,
                targetCaptured: ghost?.dataset.targetCaptured === "true",
            },
            hoverTargetRole: elementRole(hover),
            confirmedTargetRole: elementRole(confirmed),
            selectedModSource: selectedSource?.getAttribute("aria-label") ?? null,
            wavetableText: root.querySelector('[data-role="mobile-voice-table-name"]')?.textContent?.trim() ?? null,
            selectedMsegPointCount: root.querySelectorAll('[data-role="mseg-point"][data-point-state="selected"]').length,
            animationCount: this.animationCount,
            pointerActive: this.activePointer !== null,
            pointerTargetRole: elementRole(this.activePointer?.target ?? null),
            activeEffect: activeEffect === null ? null : {
                deviceId: activeEffect.dataset.deviceId ?? "",
                enabled: activeEffect.dataset.effectEnabled === "true",
            },
        };
    }

    private ensureNavigation(
        root: HTMLElement,
        fingerOverlay: SVGSVGElement | null,
        target: NavTarget,
        timeStamp: number,
    ) {
        const workspace = root.querySelector<HTMLElement>(`[data-role="mobile-workspace-tab-${target.tab}"]`);
        if (workspace && workspace.getAttribute("aria-selected") !== "true") {
            this.tap(root, fingerOverlay, workspace, timeStamp);
            return true;
        }

        if (target.tab === "voice") {
            if (target.oscillatorId) {
                const oscillator = root.querySelector<HTMLElement>(
                    `[data-role="mobile-voice-tab-${target.oscillatorId.toLowerCase()}"]`,
                );
                const selected = root.querySelector('[data-role="mobile-voice-editor"]')
                    ?.getAttribute("data-selected-oscillator-id");
                if (oscillator && selected !== target.oscillatorId) {
                    this.tap(root, fingerOverlay, oscillator, timeStamp);
                    return true;
                }
            }
            if (target.focus === "filter") {
                const filter = root.querySelector<HTMLElement>('[data-role="filter-card"]');
                if (filter) scrollTargetIntoPanel(root, filter);
            }
            return false;
        }

        if (target.tab === "fx") {
            const selected = visibleElements(root, '[data-role^="rack-editor-"][data-device-id]')
                .find((editor) => editor.dataset.deviceId === target.deviceId);
            if (!selected) {
                const station = visibleElements(root, '[data-role^="rack-station-"]')
                    .find((candidate) => candidate.closest<HTMLElement>("[data-device-id]")?.dataset.deviceId === target.deviceId);
                if (station) {
                    this.tap(root, fingerOverlay, station, timeStamp);
                    return true;
                }
            }
            return false;
        }

        const source = parseSourceId(target.sourceId);
        if (!source) return false;
        const sourcePanelTab = root.querySelector<HTMLElement>('[data-role="mobile-mod-panel-tab-source"]');
        if (sourcePanelTab && sourcePanelTab.getAttribute("aria-selected") !== "true") {
            this.tap(root, fingerOverlay, sourcePanelTab, timeStamp);
            return true;
        }
        const typeSelect = root.querySelector<HTMLSelectElement>('[data-role="mobile-mod-source-type"]');
        const typeValue = source.kind === "env" ? "envelope" : source.kind;
        if (typeSelect && typeSelect.value !== typeValue) {
            this.tap(root, fingerOverlay, typeSelect, timeStamp, false);
            setNativeSelectValue(typeSelect, typeValue, timeStamp + 0.2);
            return true;
        }
        const numberSelect = root.querySelector<HTMLSelectElement>('[data-role="mobile-mod-source-number"]');
        if (numberSelect && numberSelect.value !== String(source.slot)) {
            this.tap(root, fingerOverlay, numberSelect, timeStamp, false);
            setNativeSelectValue(numberSelect, String(source.slot), timeStamp + 0.2);
            return true;
        }
        return false;
    }

    private resolveParameterControl(root: HTMLElement, span: IndexedSpan, endpointID: string) {
        const oscillator = /^osc[ABC](.+)$/u.exec(endpointID);
        if (oscillator) {
            const controlID = OSCILLATOR_CONTROL_IDS[oscillator[1]];
            if (!controlID) return null;
            const control = root.querySelector<HTMLElement>(
                `[data-role="mobile-voice-cell-${controlID}"], [data-role="mobile-voice-chip-${controlID}"]`,
            );
            if (control) return control;
            const attempts = this.voicePageAttempts.get(span.key) ?? 0;
            if (attempts < 4) {
                const next = root.querySelector<HTMLElement>('[data-role="mobile-voice-page-next"]');
                if (next) {
                    this.voicePageAttempts.set(span.key, attempts + 1);
                    this.tap(root, null, next, (this.lastFrame * 1_000) / this.timeline.fps);
                }
            }
            return null;
        }
        if (endpointID.startsWith("filter")) {
            return root.querySelector<HTMLElement>(`[data-role="voice-filter-knob-${endpointID}"]`);
        }
        return root.querySelector<HTMLElement>(`[data-role="${endpointID}"]`);
    }

    private driveParameter(
        root: HTMLElement,
        fingerOverlay: SVGSVGElement | null,
        span: IndexedSpan,
        op: Extract<UIOp, { kind: "setParam" }>,
        progress: number,
        timeStamp: number,
    ) {
        const control = this.resolveParameterControl(root, span, op.endpointID);
        if (!control) return;
        scrollTargetIntoPanel(root, control);
        if (control instanceof HTMLButtonElement) {
            if (progress >= 0.45 && !this.completed.has(span.key)) {
                this.tap(root, fingerOverlay, control, timeStamp);
                this.completed.add(span.key);
            }
            return;
        }
        this.driveHorizontalGesture(
            root,
            fingerOverlay,
            span.key,
            control,
            progress,
            op.to >= op.from ? 1 : -1,
            op.weight === "rapid" ? 42 : 68,
            timeStamp,
        );
        if (progress >= 0.84) this.completed.add(span.key);
    }

    private driveLaneParameter(
        root: HTMLElement,
        fingerOverlay: SVGSVGElement | null,
        span: IndexedSpan,
        op: Extract<UIOp, { kind: "setLaneParam" }>,
        progress: number,
        timeStamp: number,
    ) {
        const editor = findByDataValue(root, '[data-role^="rack-editor-"][data-device-id]', "data-device-id", op.deviceId);
        const control = editor?.querySelector<HTMLElement>(`[data-role="rack-parameter-${op.endpointID}"]`) ?? null;
        if (!control) return;
        scrollTargetIntoPanel(root, control);
        this.driveHorizontalGesture(
            root,
            fingerOverlay,
            span.key,
            control,
            progress,
            op.to >= op.from ? 1 : -1,
            op.weight === "rapid" ? 42 : 68,
            timeStamp,
        );
        if (progress >= 0.84) this.completed.add(span.key);
    }

    private driveHorizontalGesture(
        root: HTMLElement,
        fingerOverlay: SVGSVGElement | null,
        key: string,
        control: Element,
        progress: number,
        direction: 1 | -1,
        distance: number,
        timeStamp: number,
    ) {
        if (progress < 0.12) return;
        if (!this.activePointer || this.activePointer.key !== key) {
            this.startPointer(root, fingerOverlay, key, control, eventWindow(root), eventWindow(root), timeStamp);
            if (!this.activePointer) return;
            this.movePointer(root, fingerOverlay, this.activePointer.startX + (direction * 9), this.activePointer.startY, timeStamp + 0.2);
            this.movePointer(root, fingerOverlay, this.activePointer.startX + (direction * 12), this.activePointer.startY, timeStamp + 0.4);
        }
        if (!this.activePointer) return;
        const travel = clamp01((progress - 0.12) / 0.66) * distance;
        this.movePointer(
            root,
            fingerOverlay,
            this.activePointer.startX + (direction * Math.max(12, travel)),
            this.activePointer.startY,
            timeStamp + 0.6,
        );
        if (progress >= 0.82) this.finishPointer(root, fingerOverlay, timeStamp + 0.8);
    }

    private driveWavetable(
        root: HTMLElement,
        fingerOverlay: SVGSVGElement | null,
        span: IndexedSpan,
        op: Extract<UIOp, { kind: "selectWavetable" }>,
        progress: number,
        timeStamp: number,
    ) {
        if (progress < 0.22 || this.completed.has(span.key)) return;
        const select = root.querySelector<HTMLSelectElement>('select[aria-label="Select wavetable"]');
        if (!select) return;
        this.tap(root, fingerOverlay, select, timeStamp, false);
        setNativeSelectValue(select, String(op.tableIndex), timeStamp + 0.2);
        this.completed.add(span.key);
    }

    private driveEffectToggle(
        root: HTMLElement,
        fingerOverlay: SVGSVGElement | null,
        span: IndexedSpan,
        op: Extract<UIOp, { kind: "toggleEffect" }>,
        progress: number,
        timeStamp: number,
    ) {
        if (progress < 0.42 || this.completed.has(span.key)) return;
        const editor = findByDataValue(root, '[data-role^="rack-editor-"][data-device-id]', "data-device-id", op.deviceId);
        const button = editor?.querySelector<HTMLElement>('[data-role="rack-editor-power"]');
        if (!button) return;
        this.tap(root, fingerOverlay, button, timeStamp);
        this.completed.add(span.key);
    }

    private ensureMapSource(
        root: HTMLElement,
        fingerOverlay: SVGSVGElement | null,
        source: { readonly kind: string; readonly slot: number },
        timeStamp: number,
    ) {
        const selected = root.querySelector<HTMLElement>('[data-role="mobile-global-mod-rail-selected"]');
        if (sameSourceLabel(selected?.getAttribute("aria-label") ?? null, source)) return false;
        const grip = root.querySelector<HTMLElement>('[data-role="mobile-global-mod-rail-grip"]');
        if (grip?.getAttribute("aria-expanded") !== "true") {
            if (grip) this.tap(root, fingerOverlay, grip, timeStamp, false);
            return true;
        }
        const desired = root.querySelector<HTMLElement>(`[data-role="rack-mod-source-${source.kind}-${source.slot}"]`);
        const page = desired?.closest<HTMLElement>(".rack-mod-page");
        if (desired && page?.getAttribute("aria-hidden") === "true") {
            const next = root.querySelector<HTMLElement>('button[aria-label="Next modulation-source group"]');
            if (next) this.tap(root, fingerOverlay, next, timeStamp);
            return true;
        }
        if (desired) {
            this.tap(root, fingerOverlay, desired, timeStamp, false);
            return true;
        }
        return false;
    }

    private driveMapRoute(
        root: HTMLElement,
        fingerOverlay: SVGSVGElement | null,
        span: IndexedSpan,
        op: Extract<UIOp, { kind: "mapRoute" }>,
        progress: number,
        timeStamp: number,
    ) {
        const source = sourceFromRoute(op);
        if (this.ensureMapSource(root, fingerOverlay, source, timeStamp)) return;
        const target = targetForRoute(root, op);
        const sourceButton = root.querySelector<HTMLElement>('[data-role="mobile-global-mod-rail-selected"]');
        if (!target || !sourceButton) return;
        scrollTargetIntoPanel(root, target);
        const targetCenter = centerOf(target);
        if (progress < 0.16) return;
        if (!this.activePointer || this.activePointer.key !== span.key) {
            this.startPointer(root, fingerOverlay, span.key, sourceButton, sourceButton, eventWindow(root), timeStamp);
            if (!this.activePointer) return;
            const dx = targetCenter.x - this.activePointer.startX;
            const dy = targetCenter.y - this.activePointer.startY;
            const length = Math.max(1, Math.hypot(dx, dy));
            this.movePointer(
                root,
                fingerOverlay,
                this.activePointer.startX + ((dx / length) * 10),
                this.activePointer.startY + ((dy / length) * 10),
                timeStamp + 0.2,
            );
        }
        if (!this.activePointer) return;
        const travel = clamp01((progress - 0.16) / 0.58);
        const x = this.activePointer.startX + ((targetCenter.x - this.activePointer.startX) * travel);
        const y = this.activePointer.startY + ((targetCenter.y - this.activePointer.startY) * travel);
        this.movePointer(root, fingerOverlay, x, y, timeStamp + 0.4);
        if (progress >= 0.84) {
            this.finishPointer(root, fingerOverlay, timeStamp + 0.6);
            this.completed.add(span.key);
        }
    }

    private driveMseg(
        root: HTMLElement,
        fingerOverlay: SVGSVGElement | null,
        span: IndexedSpan,
        progress: number,
        timeStamp: number,
    ) {
        const surface = root.querySelector<SVGSVGElement>('[data-role="mod-source-mseg-surface"]');
        if (!surface || progress < 0.14) return;
        const points = [...surface.querySelectorAll<SVGCircleElement>('[data-role="mseg-point"]')];
        const point = points[Math.min(1, Math.max(0, points.length - 1))];
        if (!point) return;
        const pointCenter = centerOf(point);
        if (!this.activePointer || this.activePointer.key !== span.key) {
            this.startPointerAt(
                root,
                fingerOverlay,
                span.key,
                surface,
                surface,
                surface,
                pointCenter.x,
                pointCenter.y,
                timeStamp,
            );
        }
        if (!this.activePointer) return;
        const travel = clamp01((progress - 0.14) / 0.66);
        this.movePointer(root, fingerOverlay, pointCenter.x + (24 * travel), pointCenter.y - (24 * travel), timeStamp + 0.3);
        if (progress >= 0.84) {
            this.finishPointer(root, fingerOverlay, timeStamp + 0.5);
            this.completed.add(span.key);
        }
    }

    private driveEnvelope(
        root: HTMLElement,
        fingerOverlay: SVGSVGElement | null,
        span: IndexedSpan,
        op: Extract<UIOp, { kind: "setEnvelope" }>,
        progress: number,
        timeStamp: number,
    ) {
        const segment = Math.min(2, Math.floor(progress * 3));
        const localProgress = clamp01((progress * 3) - segment);
        const roles = [
            "adsr-attack-handle-hit-target",
            "adsr-decay-sustain-handle-hit-target",
            "adsr-release-handle-hit-target",
        ] as const;
        const handle = root.querySelector<SVGCircleElement>(`[data-role="${roles[segment]}"]`);
        if (!handle) return;
        const key = `${span.key}:${segment}`;
        if (this.activePointer && this.activePointer.key !== key) {
            this.finishPointer(root, fingerOverlay, timeStamp);
        }
        const start = centerOf(handle);
        const deltas = [
            { x: Math.max(34, op.attack * 34), y: 0 },
            { x: Math.max(34, op.decay * 28), y: (0.5 - op.sustain) * 70 },
            { x: Math.max(34, op.release * 28), y: 0 },
        ];
        if (!this.activePointer && localProgress >= 0.08) {
            this.startPointerAt(root, fingerOverlay, key, handle, eventWindow(root), eventWindow(root), start.x, start.y, timeStamp);
        }
        if (!this.activePointer || this.activePointer.key !== key) return;
        this.movePointer(
            root,
            fingerOverlay,
            start.x + (deltas[segment].x * localProgress),
            start.y + (deltas[segment].y * localProgress),
            timeStamp + 0.3,
        );
        if (localProgress >= 0.88 || progress >= 0.96) {
            this.finishPointer(root, fingerOverlay, timeStamp + 0.5);
            if (segment === 2) this.completed.add(span.key);
        }
    }

    private driveMacro(
        root: HTMLElement,
        fingerOverlay: SVGSVGElement | null,
        span: IndexedSpan,
        op: Extract<UIOp, { kind: "setMacro" }>,
        progress: number,
        timeStamp: number,
    ) {
        const input = root.querySelector<HTMLInputElement>(`[data-role="macro-source-value-${op.slot}"]`);
        if (!input || progress < 0.12) return;
        const bounds = input.getBoundingClientRect();
        const x = bounds.left + (bounds.width * clamp01(op.value * progress));
        const y = bounds.top + (bounds.height / 2);
        if (!this.activePointer || this.activePointer.key !== span.key) {
            this.startPointerAt(root, fingerOverlay, span.key, input, input, input, x, y, timeStamp);
        }
        setNativeRangeValue(input, op.value * progress, timeStamp + 0.2);
        this.movePointer(root, fingerOverlay, x, y, timeStamp + 0.3);
        if (progress >= 0.84) {
            this.finishPointer(root, fingerOverlay, timeStamp + 0.5);
            this.completed.add(span.key);
        }
    }

    private tap(
        root: HTMLElement,
        fingerOverlay: SVGSVGElement | null,
        target: Element,
        timeStamp: number,
        click = true,
    ) {
        const view = eventWindow(root);
        const point = centerOf(target);
        const pointerId = ++this.pointerSerial;
        this.showFinger(root, fingerOverlay, point.x, point.y, true);
        dispatchPointer(view, target, "pointerdown", { pointerId, x: point.x, y: point.y, timeStamp });
        dispatchPointer(view, target, "pointerup", { pointerId, x: point.x, y: point.y, timeStamp: timeStamp + 0.2 });
        if (click) dispatchClick(view, target, point.x, point.y, timeStamp + 0.3);
    }

    private startPointer(
        root: HTMLElement,
        fingerOverlay: SVGSVGElement | null,
        key: string,
        target: Element,
        moveTarget: EventTarget,
        upTarget: EventTarget,
        timeStamp: number,
    ) {
        const point = centerOf(target);
        this.startPointerAt(root, fingerOverlay, key, target, moveTarget, upTarget, point.x, point.y, timeStamp);
    }

    private startPointerAt(
        root: HTMLElement,
        fingerOverlay: SVGSVGElement | null,
        key: string,
        target: Element,
        moveTarget: EventTarget,
        upTarget: EventTarget,
        x: number,
        y: number,
        timeStamp: number,
    ) {
        if (this.activePointer) this.finishPointer(root, fingerOverlay, timeStamp);
        const pointerId = ++this.pointerSerial;
        dispatchPointer(eventWindow(root), target, "pointerdown", { pointerId, x, y, timeStamp });
        this.activePointer = {
            key,
            pointerId,
            target,
            moveTarget,
            upTarget,
            startX: x,
            startY: y,
            x,
            y,
        };
        this.showFinger(root, fingerOverlay, x, y, false);
    }

    private movePointer(
        root: HTMLElement,
        fingerOverlay: SVGSVGElement | null,
        x: number,
        y: number,
        timeStamp: number,
    ) {
        const pointer = this.activePointer;
        if (!pointer) return;
        dispatchPointer(eventWindow(root), pointer.moveTarget, "pointermove", {
            pointerId: pointer.pointerId,
            x,
            y,
            timeStamp,
        });
        pointer.x = x;
        pointer.y = y;
        this.showFinger(root, fingerOverlay, x, y, false);
    }

    private finishPointer(
        root: HTMLElement,
        fingerOverlay: SVGSVGElement | null,
        timeStamp: number,
    ) {
        const pointer = this.activePointer;
        if (!pointer) return;
        dispatchPointer(eventWindow(root), pointer.upTarget, "pointerup", {
            pointerId: pointer.pointerId,
            x: pointer.x,
            y: pointer.y,
            timeStamp,
        });
        this.activePointer = null;
        this.showFinger(root, fingerOverlay, pointer.x, pointer.y, true);
    }

    private showFinger(
        root: HTMLElement,
        overlay: SVGSVGElement | null,
        clientX: number,
        clientY: number,
        ripple: boolean,
    ) {
        if (!overlay) return;
        const bounds = root.getBoundingClientRect();
        if (bounds.width <= 0 || bounds.height <= 0) return;
        const x = ((clientX - bounds.left) / bounds.width) * 393;
        const y = ((clientY - bounds.top) / bounds.height) * 852;
        overlay.style.display = "block";
        overlay.dataset.ripple = ripple ? "true" : "false";
        for (const circle of overlay.querySelectorAll<SVGCircleElement>("circle")) {
            circle.setAttribute("cx", String(x));
            circle.setAttribute("cy", String(y));
        }
        const ring = overlay.querySelector<SVGCircleElement>('[data-role="scripted-finger-ring"]');
        if (ring) ring.style.opacity = ripple ? "0.8" : "0.25";
    }

    private hideFinger(overlay: SVGSVGElement | null) {
        if (overlay && this.activePointer === null) overlay.style.display = "none";
    }
}
