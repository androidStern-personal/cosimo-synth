import type { SVGProps } from "react";

export function EditorCurveFill({ className, ...pathProps }: SVGProps<SVGPathElement>) {
    return <path {...pathProps} className={["editor-curve-fill", className].filter(Boolean).join(" ")} />;
}
