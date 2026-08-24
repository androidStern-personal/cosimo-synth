import type { TimedSection } from "../timeline";

export function CaptionPanel({ section, frame }: { readonly section: TimedSection | null; readonly frame: number }) {
    if (section === null) return null;
    const visible = new Set(section.captionEvents
        .filter((event) => frame >= event.atFrame)
        .map((event) => event.line));
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
