import type {
    CSSProperties,
    PointerEventHandler,
    ReactNode,
} from "react";

import type { RackModulationSourceKind } from "../shared/rack-modulation-sources";

type MsegEditorShellStyle = CSSProperties & {
    readonly "--quick-sheet-accent": string;
};

/** The two product presentations of the same MSEG editor composition. */
export type MsegEditorShellVariant = "drawer" | "full";

/** Observable shell inputs shared by the drawer and its full-screen expansion. */
export type MsegEditorShellProps = {
    readonly variant: MsegEditorShellVariant;
    readonly label: string;
    readonly accent: string;
    readonly dataRole: string;
    readonly controls: ReactNode;
    readonly graphic: ReactNode;
    readonly graphicDataRole: string;
    readonly headerActions: ReactNode;
    readonly rootClassName?: string;
    readonly graphicClassName?: string;
    readonly style?: CSSProperties;
    readonly role?: "dialog";
    readonly ariaModal?: boolean;
    readonly ariaLabel?: string;
    readonly headerAriaLabel?: string;
    readonly showGrip?: boolean;
    readonly useMsegVisualLanguage?: boolean;
    readonly dataSourceKind?: RackModulationSourceKind;
    readonly dataSourceSlot?: number;
    readonly dataDetent?: string;
    readonly dataSectionAccent?: string;
    readonly onHeaderPointerDown?: PointerEventHandler<HTMLElement>;
    readonly overlay?: ReactNode;
};

/**
 * Owns the MSEG editor's title, compact controls, and dominant graph rows.
 * Full screen expands the graph without swapping in a separate modal layout.
 */
export function MsegEditorShell({
    variant,
    label,
    accent,
    dataRole,
    controls,
    graphic,
    graphicDataRole,
    headerActions,
    rootClassName,
    graphicClassName,
    style,
    role,
    ariaModal,
    ariaLabel,
    headerAriaLabel,
    showGrip = false,
    useMsegVisualLanguage = true,
    dataSourceKind,
    dataSourceSlot,
    dataDetent,
    dataSectionAccent,
    onHeaderPointerDown,
    overlay,
}: MsegEditorShellProps) {
    const shellStyle: MsegEditorShellStyle = {
        ...style,
        "--quick-sheet-accent": accent,
    };
    const msegVariantClass = variant === "drawer"
        ? "quick-source-sheet mseg-editor-shell-drawer"
        : "mseg-editor-frame mseg-editor-shell-full";
    const shellClassName = useMsegVisualLanguage
        ? `mseg-editor-shell ${msegVariantClass}`
        : "quick-source-sheet";
    const headerClassName = useMsegVisualLanguage
        ? `mseg-editor-shell-top${variant === "drawer" ? " quick-source-sheet-top" : ""}`
        : "quick-source-sheet-top";
    const graphicShellClassName = useMsegVisualLanguage
        ? `mseg-editor-shell-graphic${variant === "drawer" ? " quick-source-sheet-graphic" : " mseg-editor-graph"}`
        : "quick-source-sheet-graphic";
    const graphicRow = (
        <div
            data-role={graphicDataRole}
            className={`${graphicShellClassName}${graphicClassName === undefined ? "" : ` ${graphicClassName}`}`}
        >
            {graphic}
        </div>
    );

    return (
        <section
            role={role}
            aria-modal={ariaModal}
            aria-label={ariaLabel}
            data-role={dataRole}
            data-mseg-shell-variant={variant}
            data-source-kind={dataSourceKind}
            data-source-slot={dataSourceSlot}
            data-detent={dataDetent}
            data-section-accent={dataSectionAccent}
            className={`${shellClassName}${rootClassName === undefined ? "" : ` ${rootClassName}`}`}
            style={shellStyle}
        >
            <header
                data-role={variant === "drawer" ? "quick-source-sheet-grip" : "mseg-editor-header"}
                className={headerClassName}
                aria-label={headerAriaLabel}
                onPointerDown={onHeaderPointerDown}
            >
                <strong>{label}</strong>
                {showGrip ? <span className="quick-source-sheet-grip-pill" aria-hidden="true" /> : null}
                {headerActions}
            </header>
            {variant === "full" ? graphicRow : controls}
            {variant === "full" ? controls : graphicRow}
            {overlay}
        </section>
    );
}
