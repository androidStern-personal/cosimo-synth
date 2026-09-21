import { useState } from "react";
import * as ContextMenu from "@radix-ui/react-context-menu";
import { KnobRoot, KnobControl, KnobDial, KnobLabel, KnobValue } from "../../index";
import "./examples.css";

const percent = (value: number) => `${Math.round(value * 100)}%`;

export function MenuExample() {
    const [value, setValue] = useState(0.62);
    const [message, setMessage] = useState("Right-click or hold still. Shift+F10 works too.");
    return <div className="centered-demo">
        <KnobRoot value={value} onValueChange={setValue} formatValue={percent} className="lavender">
            <KnobLabel>Output</KnobLabel>
            <ContextMenu.Root>
                <ContextMenu.Trigger asChild>
                    <KnobControl className="bk-knob-default-control" onKeyDown={event => {
                        if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
                            event.preventDefault();
                            const rect = event.currentTarget.getBoundingClientRect();
                            event.currentTarget.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true,
                                cancelable: true, clientX: rect.x + rect.width / 2, clientY: rect.y + rect.height / 2 }));
                        }
                    }}><KnobDial /></KnobControl>
                </ContextMenu.Trigger>
                <ContextMenu.Portal><ContextMenu.Content className="demo-menu" aria-label="Output actions">
                    <ContextMenu.Item onSelect={() => { setValue(0.5); setMessage("Reset to 50%."); }}>Reset <span>50%</span></ContextMenu.Item>
                    <ContextMenu.Item onSelect={() => { setValue(0); setMessage("Output muted."); }}>Mute</ContextMenu.Item>
                    <ContextMenu.Separator />
                    <ContextMenu.Item onSelect={() => setMessage("Your application owns this command.")}>Custom action…</ContextMenu.Item>
                </ContextMenu.Content></ContextMenu.Portal>
            </ContextMenu.Root>
            <KnobValue />
        </KnobRoot><small role="status">{message}</small>
    </div>;
}
