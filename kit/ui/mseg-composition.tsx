import { forwardRef } from 'react'
import { MsegRoot, type MsegRootProps } from './mseg-context'
import { MsegSurface, type MsegSurfaceProps } from './mseg-surface'
import { MsegCurve, MsegFill, MsegGrid, MsegPoints, MsegSegmentHighlight, MsegTimeAxis } from './mseg-layers'
import type { MsegTimeAxisScale } from './mseg'
export { MsegRoot, useMsegEditor } from './mseg-context'
export type { MsegRootProps, MsegEditing, MsegSelection } from './mseg-context'
export { MsegSurface } from './mseg-surface'
export type { MsegSurfaceProps } from './mseg-surface'
export * from './mseg-layers'

export type MsegEditorProps = MsegRootProps & {
    readonly surfaceProps?: MsegSurfaceProps
    readonly timeAxisScale?: MsegTimeAxisScale
}
/** Useful default assembled entirely from the public parts. Customize with ordinary CSS or compose those parts. */
export const MsegEditor = forwardRef<HTMLDivElement, MsegEditorProps>(function MsegEditor(
    { surfaceProps, timeAxisScale, className, ...props },
    ref,
) {
    return (
        <MsegRoot {...props} ref={ref} className={['bk-mseg-editor', className].filter(Boolean).join(' ')}>
            <MsegSurface aria-label={props['aria-label'] ?? 'Envelope'} {...surfaceProps}>
                <MsegGrid />
                <MsegFill />
                <MsegCurve />
                <MsegSegmentHighlight />
                <MsegPoints />
                {timeAxisScale && <MsegTimeAxis scale={timeAxisScale} />}
            </MsegSurface>
        </MsegRoot>
    )
})
