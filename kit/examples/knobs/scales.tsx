import { useMemo, useState } from "react";
import { Knob, type KnobScale } from "../../index";
import "./examples.css";

const db = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(1)} dB`;
const choices = ["Low-pass", "High-pass", "Band-pass", "Notch"];

export function ScalesExample() {
    const [trim, setTrim] = useState(-6);
    const [mode, setMode] = useState(1);
    const [response, setResponse] = useState(25);
    // A custom curve still uses canonical values at the public interface.
    const scale = useMemo<KnobScale>(() => ({
        toPosition: value => Math.sqrt(value / 100),
        fromPosition: position => position ** 2 * 100,
    }), []);
    return <div className="knob-row">
        <Knob label="Bipolar trim" min={-24} max={24} step={0.5} value={trim} onValueChange={setTrim} formatValue={db} />
        <Knob label="Filter mode" min={0} max={3} step={1} value={mode} onValueChange={setMode}
            formatValue={value => choices[value] ?? ""} className="cyan" />
        <Knob label="Custom response" min={0} max={100} scale={scale} value={response}
            onValueChange={setResponse} formatValue={value => value.toFixed(1)} className="lavender" />
    </div>;
}
