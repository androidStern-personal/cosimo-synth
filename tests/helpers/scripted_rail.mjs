/**
 * Whether a scripted render's Mod rail is off the phone at this frame: it
 * retreats past the phone's edge while a mod source is dragged onto a target,
 * and its slide back begins on the frame the drag ends.
 */
export function railRetreated(inspections, frame) {
    return inspections.some((inspection) => (
        inspection.railMappingActive && (inspection.frame === frame || inspection.frame === frame - 1)
    ));
}
