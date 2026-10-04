import { useRef, useState, type ComponentType } from "react";
import "./reference.css";

export type SourceFile = { name: string; text: string };
export type DocsExample = {
    id: string;
    title: string;
    description: string;
    component: ComponentType;
    files: readonly SourceFile[];
};

function Copy({ text }: { text: string }) {
    const [label, setLabel] = useState("Copy");
    return <button className="copy" type="button" onClick={async () => {
        try {
            await navigator.clipboard.writeText(text);
            setLabel("Copied");
        } catch {
            setLabel("Select code to copy");
        }
    }}>{label}</button>;
}

export function Code({ file }: { file: SourceFile }) {
    const tokens = file.text.split(/("[^"\n]*"|'[^'\n]*'|\/\/[^\n]*|\b(?:export|function|return|const|let|if|else|type|import|from|true|false|null|undefined)\b|\b\d+(?:\.\d+)?\b)/g);
    return <div className="code-file">
        <div className="code-heading"><span>{file.name}</span><Copy text={file.text} /></div>
        <pre data-source-file={file.name}><code>{tokens.map((token, index) =>
            <span key={index} className={token.startsWith("//") ? "code-comment" : /^["']/.test(token) ? "code-string"
                : /^(export|function|return|const|let|if|else|type|import|from|true|false|null|undefined)$/.test(token) ? "code-keyword"
                    : /^\d/.test(token) ? "code-number" : undefined}>{token}</span>)}</code></pre>
    </div>;
}

function Example({ example, hero = false }: { example: DocsExample; hero?: boolean }) {
    const [tab, setTab] = useState<"preview" | "code">("preview");
    const tabs = useRef<(HTMLButtonElement | null)[]>([]);
    const Demo = example.component;
    return <section id={example.id} className={`example${hero ? " hero-example" : ""}`}>
        <h2 className={hero ? "sr-only" : undefined}>{example.title}</h2>
        {!hero && <p>{example.description}</p>}
        <div className="example-card">
            <div className="tabs" role="tablist" aria-label={`${example.title} view`}>
                {(["preview", "code"] as const).map((name, index) => <button key={name}
                    ref={node => { tabs.current[index] = node; }} type="button" role="tab"
                    id={`${example.id}-${name}`} aria-controls={`${example.id}-panel`}
                    aria-selected={tab === name} tabIndex={tab === name ? 0 : -1}
                    onClick={() => setTab(name)} onKeyDown={event => {
                        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                        const next = event.key === "Home" ? 0 : event.key === "End" ? 1 : 1 - index;
                        setTab(next === 0 ? "preview" : "code");
                        tabs.current[next]?.focus();
                        event.preventDefault();
                    }}>{name === "preview" ? "Preview" : "Code"}</button>)}
            </div>
            <div role="tabpanel" id={`${example.id}-panel`} aria-labelledby={`${example.id}-${tab}`}
                className={tab === "preview" ? "preview" : "source"}>
                {tab === "preview" ? <Demo /> : example.files.map((file, index) => index === 0
                    ? <Code key={file.name} file={file} />
                    : <details key={file.name} className="support-file"><summary>{file.name}</summary><Code file={file} /></details>)}
            </div>
        </div>
    </section>;
}

export function ReferencePage({ title, description, usage, examples, api }: {
    title: string;
    description: string;
    usage: string;
    examples: readonly DocsExample[];
    api: readonly { name: string; description: string }[];
}) {
    const [light, setLight] = useState(false);
    const [hero, ...rest] = examples;
    if (!hero) throw new Error("A component reference needs a default example.");
    const contents = [{ id: "usage", title: "Usage" }, ...rest, { id: "api", title: "API reference" }];
    return <div className="docs" data-theme={light ? "light" : "dark"}>
        <header className="topbar"><a className="brand" href="../knobs/">Builder Kit</a>
            <span className="topbar-label">Components</span>
            <button type="button" onClick={() => setLight(!light)} aria-label="Toggle color theme">{light ? "Dark" : "Light"}</button></header>
        <div className="page-layout">
            <nav className="sidebar" aria-label="Components"><div className="sidebar-label">Components</div>
                {[["Knob", "knobs"], ["MSEG", "mseg"], ["Filter", "filters"], ["Slider", "sliders"]].map(([name, path]) =>
                    <a key={path} href={`../${path}/`} aria-current={title === name ? "page" : undefined}>{name}</a>)}
            </nav>
            <main><div className="breadcrumb">Components / {title}</div><h1>{title}</h1><p className="lead">{description}</p>
                <Example example={hero} hero />
                <section id="usage" className="reference-section"><h2>Usage</h2><Code file={{ name: "Example.tsx", text: usage }} />
                    <p className="usage-note">Import from the public kit entry. Adjust the relative path for your project.</p></section>
                {rest.map(example => <Example key={example.id} example={example} />)}
                <section id="api" className="reference-section"><h2>API reference</h2>
                    <div className="table-wrap"><table><thead><tr><th>Part / option</th><th>Usage</th></tr></thead>
                        <tbody>{api.map(row => <tr key={row.name}><td><code>{row.name}</code></td><td>{row.description}</td></tr>)}</tbody></table></div>
                </section>
                <footer>Builder Kit · Editable source</footer>
            </main>
            <nav className="on-this-page" aria-label="On this page"><div className="sidebar-label">On this page</div>
                {contents.map(item => <a key={item.id} href={`#${item.id}`}>{item.title}</a>)}
            </nav>
        </div>
    </div>;
}
