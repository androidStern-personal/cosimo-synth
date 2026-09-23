import { useEffect, useRef, useState } from 'react'
import { Mseg } from '../../index'
import { createPlayback } from './playback-runtime'
import './examples.css'
export function PlaybackExample() {
    const [value, setValue] = useState(() => Mseg.addPoint(Mseg.defaultCurve(), 0.3, 0.9))
    const [engine, setEngine] = useState<Awaited<ReturnType<typeof createPlayback>> | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [loop, setLoop] = useState(true)
    const latest = useRef(value)
    latest.current = value
    useEffect(() => {
        let cancelled = false,
            dispose = () => {}
        if (!crossOriginIsolated) {
            setError('This example needs localhost or HTTPS with cross-origin isolation')
            return
        }
        createPlayback(latest.current)
            .then((next) => {
                if (cancelled) {
                    next.dispose()
                    return
                }
                dispose = next.dispose
                next.setCurve(latest.current)
                setEngine(next)
            })
            .catch((error) => {
                if (!cancelled) setError(String(error))
            })
        return () => {
            cancelled = true
            dispose()
        }
    }, [])
    useEffect(() => {
        engine?.setCurve(value)
    }, [engine, value])
    return (
        <div className="mseg-example">
            <Mseg.Root value={value} onValueChange={setValue}>
                <Mseg.Surface className="envelope" style={{ height: 230 }} aria-label="Engine envelope">
                    <Mseg.Grid />
                    <Mseg.Fill />
                    <Mseg.Curve />
                    <Mseg.Points />
                    <Mseg.Playhead position={engine?.position ?? null} stroke="#f9cf8c" strokeWidth={3} />
                </Mseg.Surface>
            </Mseg.Root>
            <div className="mseg-toolbar">
                <button disabled={!engine} onClick={() => engine?.trigger()}>
                    Trigger
                </button>
                <button disabled={!engine} onClick={() => engine?.retrigger()}>
                    Retrigger
                </button>
                <button disabled={!engine} onClick={() => engine?.release()}>
                    Release
                </button>
                <label>
                    <input
                        type="checkbox"
                        checked={loop}
                        onChange={(event) => {
                            const next = event.currentTarget.checked
                            setLoop(next)
                            engine?.setLoop(next)
                        }}
                    />{' '}
                    Loop 20–70%
                </label>
            </div>
            <p className="mseg-log">Real Cmajor Reader · offline control signal · no speaker output</p>
            {error && <p role="alert">{error}</p>}
        </div>
    )
}
