import { useState } from "react";
import { KnobRoot, KnobControl, KnobDial, KnobLabel, KnobValue, KnobInput, normalizeEntryText, parseNumericAndUnit, unitIs, formatFrequencyDisplay, type KnobParseResult } from "../../index";
import "./examples.css";

function parseFrequency(text: string): KnobParseResult {
    const parsed = parseNumericAndUnit(normalizeEntryText(text));
    if (!parsed || (parsed.unit !== undefined && !unitIs(parsed.unit, "hz", "khz", "k")))
        return { kind: "error", message: "Enter a frequency in Hz or kHz." };
    return { kind: "ok", value: Number(parsed.numericText) * (unitIs(parsed.unit, "khz", "k") ? 1000 : 1) };
}
export function EntryExample() {
    const [value, setValue] = useState(1200);
    return <KnobRoot value={value} onValueChange={setValue} min={20} max={20000} scale="log"
        formatValue={formatFrequencyDisplay} className="cyan">
        <KnobLabel>Frequency</KnobLabel>
        <KnobControl><KnobDial /></KnobControl>
        <KnobValue />
        <KnobInput parseValue={parseFrequency} aria-label="Exact frequency" />
    </KnobRoot>;
}
