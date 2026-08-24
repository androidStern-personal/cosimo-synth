import type { TimedSection } from "./timeline";

/**
 * A caption line ticks when the op it narrates has actually finished — never
 * on a schedule. Lines with no owning op (section intro notes) reveal on the
 * section's caption schedule instead.
 */
function visibleLines(section: TimedSection, frame: number): ReadonlySet<number> {
    const completionByLine = new Map<number, number>();
    section.opSpans.forEach((span, opIndex) => {
        const line = section.section.opCaptionLines[opIndex];
        if (line === null || line === undefined) return;
        const existing = completionByLine.get(line);
        completionByLine.set(line, existing === undefined ? span.endFrame : Math.min(existing, span.endFrame));
    });
    const visible = new Set<number>();
    for (const event of section.captionEvents) {
        const completion = completionByLine.get(event.line);
        if (completion === undefined ? frame >= event.atFrame : frame >= completion) {
            visible.add(event.line);
        }
    }
    return visible;
}

export function CaptionPanel({ section, frame }: { readonly section: TimedSection | null; readonly frame: number }) {
    if (section === null) return null;
    const visible = visibleLines(section, frame);
    return (
        <section className="speedrun-caption-panel" data-section={section.section.id}>
            <header><span>{String(section.checkpointIndex + 1).padStart(2, "0")}</span><strong>{section.section.title}</strong></header>
            <ol>
                {section.section.captions.map((line, index) => {
                    const shown = visible.has(index);
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
