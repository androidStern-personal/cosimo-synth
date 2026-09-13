import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { KnobRoot, KnobLabel, KnobControl, KnobDial, KnobInput, KnobMarker, type LiveValue } from '../../index';

/** Independent store adapter used through the public LiveValue interface. */
function signal(): LiveValue<number | null> & { set(value: number | null): void; count(): number } {
    let value: number | null = 100;
    const listeners = new Set<() => void>();
    return {
        getSnapshot: () => value,
        subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
        set: next => { value = next; for (const listener of listeners) listener(); },
        count: () => listeners.size,
    };
}
/** Mount the public API in an isolated plugin-style shadow root. */
export function mount(host: HTMLElement) {
    const shadow = host.attachShadow({ mode: 'open' });
    const container = document.createElement('div'); shadow.appendChild(container);
    const first = signal(), second = signal();
    const changes: number[] = [], gestures: string[] = [], callbackBases: number[] = [];
    let renders = 0;
    let configure: (options: { disabled?: boolean; source?: 'first' | 'second' }) => void = () => {};
    function View() {
        renders += 1;
        const [value, setValue] = useState(100);
        const [options, setOptions] = useState<{ disabled?: boolean; source?: 'first' | 'second' }>({});
        configure = patch => setOptions(previous => ({ ...previous, ...patch }));
        return <KnobRoot value={value} min={10} max={1000} scale="log" disabled={options.disabled}
            onValueChange={next => { callbackBases.push(value); changes.push(next); setValue(next); }}
            onGestureStart={() => gestures.push('start')} onGestureEnd={cancelled => gestures.push(cancelled ? 'cancel' : 'end')}>
            <KnobLabel>Fixture frequency</KnobLabel>
            <KnobControl><KnobDial>
                <KnobMarker value={options.source === 'second' ? second : first} smoothingMs={0} />
                <KnobMarker value={10} radius={38} data-testid="static-marker" />
            </KnobDial></KnobControl>
            <KnobInput aria-label="Fixture exact value" />
        </KnobRoot>;
    }
    const root = createRoot(container); root.render(<View />);
    return { first, second, changes, gestures, callbackBases, configure: (options: Parameters<typeof configure>[0]) => configure(options),
        renders: () => renders, unmount: () => root.unmount() };
}
