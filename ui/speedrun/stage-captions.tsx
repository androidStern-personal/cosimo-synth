import type { TimedSection } from "./timeline";

/**
 * The frame each caption line ticks: when the op it narrates has actually
 * finished — never on a schedule. Lines with no owning op (section intro
 * notes) reveal on the section's caption schedule instead.
 */
export function captionRevealFrames(section: TimedSection): ReadonlyMap<number, number> {
    const completionByLine = new Map<number, number>();
    section.opSpans.forEach((span, opIndex) => {
        const line = section.section.opCaptionLines[opIndex];
        if (line === null || line === undefined) return;
        const existing = completionByLine.get(line);
        completionByLine.set(line, existing === undefined ? span.endFrame : Math.min(existing, span.endFrame));
    });
    return new Map(section.captionEvents.map((event) => [event.line, completionByLine.get(event.line) ?? event.atFrame]));
}

export function CaptionPanel({ section, frame }: { readonly section: TimedSection | null; readonly frame: number }) {
    if (section === null) return null;
    const revealFrames = captionRevealFrames(section);
    return (
        <section className="speedrun-caption-panel" data-section={section.section.id}>
            <header><span>{String(section.checkpointIndex + 1).padStart(2, "0")}</span><strong>{section.section.title}</strong></header>
            <ol>
                {section.section.captions.map((line, index) => {
                    const shown = frame >= (revealFrames.get(index) ?? Number.POSITIVE_INFINITY);
                    return (
                        <li key={`${index}-${line}`} data-line={index} data-visible={shown ? "true" : "false"} className={shown ? "is-visible" : ""}>
                            <i>{shown ? "✓" : "·"}</i><span>{line}</span>
                        </li>
                    );
                })}
            </ol>
        </section>
    );
}
