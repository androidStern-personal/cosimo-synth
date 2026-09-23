import { useState } from 'react'
import { Mseg } from '../../index'
import './examples.css'
export function DefaultExample() {
    const [value, setValue] = useState(Mseg.defaultCurve)
    return <Mseg.Editor value={value} onValueChange={setValue} aria-label="Amplitude envelope" className="envelope" />
}
