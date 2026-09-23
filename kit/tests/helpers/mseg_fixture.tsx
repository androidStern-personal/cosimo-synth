import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Mseg } from '../../index'
export function mount(host: HTMLElement) {
    const listeners = new Set<(value: unknown) => void>()
    const connection = {
        addEndpointListener: (_endpoint: string, listener: (value: unknown) => void) => {
            listeners.add(listener)
        },
        removeEndpointListener: (_endpoint: string, listener: (value: unknown) => void) => {
            listeners.delete(listener)
        },
    }
    const source = Mseg.positionSource(connection, 'position')
    let renders = 0
    let latest = Mseg.addPoint(Mseg.defaultCurve(), 0.4, 0.7)
    const gestures: string[] = []
    let configure: (options: { disabled?: boolean; document?: number }) => void = () => {}
    function View() {
        ++renders
        const [value, setValue] = useState(latest)
        const [options, setOptions] = useState({ disabled: false, document: 0 })
        configure = (next) => setOptions((previous) => ({ ...previous, ...next }))
        latest = value
        return (
            <Mseg.Root
                key={options.document}
                value={value}
                onValueChange={setValue}
                disabled={options.disabled}
                onGestureStart={() => gestures.push('start')}
                onGestureEnd={(cancelled) => gestures.push(cancelled ? 'cancel' : 'end')}
                style={{ width: 400, height: 220, color: 'cyan' }}
            >
                <Mseg.Surface aria-label="Fixture envelope">
                    <Mseg.Curve />
                    <Mseg.Points />
                    <Mseg.Playhead position={source} />
                    <Mseg.Playhead position={source} stroke="orange" />
                </Mseg.Surface>
            </Mseg.Root>
        )
    }
    const root = createRoot(host)
    root.render(<View />)
    return {
        emit: (value: unknown) => {
            for (const listener of listeners) listener(value)
        },
        configure: (options: { disabled?: boolean; document?: number }) => configure(options),
        subscriberCount: () => listeners.size,
        renders: () => renders,
        value: () => latest,
        gestures,
        unmount: () => root.unmount(),
    }
}
