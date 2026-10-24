import type { PatchConnectionLike } from './cmajor-react'
import type { LiveValue } from './live-value'

type PositionReport = { readonly generation: number; readonly active: boolean; readonly position: number }
function parseReport(message: unknown): PositionReport | null {
    if (!message || typeof message !== 'object') return null
    const payload = 'event' in message ? message.event : message
    if (
        !payload ||
        typeof payload !== 'object' ||
        !('generation' in payload) ||
        !('active' in payload) ||
        !('position' in payload)
    )
        return null
    if (
        typeof payload.generation !== 'number' ||
        !Number.isSafeInteger(payload.generation) ||
        payload.generation < 0 ||
        typeof payload.active !== 'boolean' ||
        typeof payload.position !== 'number' ||
        !Number.isFinite(payload.position)
    )
        return null
    return {
        generation: payload.generation,
        active: payload.active,
        position: Math.max(0, Math.min(1, payload.position)),
    }
}
/** Observe a kit::mseg::Reader positionOut endpoint. Shares one subscription among its consumers.
 * Create once per connection/endpoint (for example with useMemo). Final unsubscribe forgets the
 * old engine generation, so a reconnected engine can restart its sequence. No timers or guessed progress.
 */
export function msegPositionSource(
    connection: Pick<PatchConnectionLike, 'addEndpointListener' | 'removeEndpointListener'>,
    endpoint: string,
): LiveValue<number | null> {
    let position: number | null = null
    let generation = -1
    const listeners = new Set<() => void>()
    const receive = (message: unknown) => {
        const next = parseReport(message)
        if (!next || next.generation < generation) return
        generation = next.generation
        const value = next.active ? next.position : null
        if (value === position) return
        position = value
        for (const listener of listeners) listener()
    }
    return {
        getSnapshot: () => position,
        subscribe: (listener) => {
            if (!connection.addEndpointListener || !connection.removeEndpointListener)
                throw new Error('MSEG playback observation requires endpoint listeners.')
            if (!listeners.size) connection.addEndpointListener(endpoint, receive)
            // Each subscription owns its own token, even if the same callback is reused.
            const notify = () => listener()
            listeners.add(notify)
            return () => {
                if (!listeners.delete(notify)) return
                if (!listeners.size) {
                    connection.removeEndpointListener?.(endpoint, receive)
                    position = null
                    generation = -1
                }
            }
        },
    }
}
