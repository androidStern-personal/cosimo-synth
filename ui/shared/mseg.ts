/** Cosimo owns its persisted identifiers; curve math and geometry belong to the kit. */
import * as mseg from "../../kit/ui/mseg";
export * from "../../kit/ui/mseg";
export type MsegShape = Omit<mseg.MsegShape, "format"> & { format: "cosimo.mseg.shape" };
export type MsegPlayback = Omit<mseg.MsegPlayback, "format"> & { format: "cosimo.mseg.playback" };
export type MsegState = {
    shape: MsegShape;
    shapeA?: MsegShape;
    shapeB?: MsegShape;
    referenceShape?: MsegShape;
    editShapeIndex?: 0 | 1;
    morph?: number;
    playback: MsegPlayback;
    depth: number;
};


export function createDefaultMsegShape(...args: Parameters<typeof mseg.createDefaultMsegShape>): MsegShape {
    return { ...mseg.createDefaultMsegShape(...args), format: "cosimo.mseg.shape" };
}

export function normalizeMsegShape(...args: Parameters<typeof mseg.normalizeMsegShape>): MsegShape {
    return { ...mseg.normalizeMsegShape(...args), format: "cosimo.mseg.shape" };
}

export function deserializeMsegShape(...args: Parameters<typeof mseg.deserializeMsegShape>): MsegShape {
    return { ...mseg.deserializeMsegShape(...args), format: "cosimo.mseg.shape" };
}

export function addMsegPoint(...args: Parameters<typeof mseg.addMsegPoint>): MsegShape {
    return { ...mseg.addMsegPoint(...args), format: "cosimo.mseg.shape" };
}

export function moveMsegPoint(...args: Parameters<typeof mseg.moveMsegPoint>): MsegShape {
    return { ...mseg.moveMsegPoint(...args), format: "cosimo.mseg.shape" };
}

export function deleteMsegPoint(...args: Parameters<typeof mseg.deleteMsegPoint>): MsegShape {
    return { ...mseg.deleteMsegPoint(...args), format: "cosimo.mseg.shape" };
}

export function setMsegSegmentCurvePower(...args: Parameters<typeof mseg.setMsegSegmentCurvePower>): MsegShape {
    return { ...mseg.setMsegSegmentCurvePower(...args), format: "cosimo.mseg.shape" };
}

export function createDefaultMsegPlayback(...args: Parameters<typeof mseg.createDefaultMsegPlayback>): MsegPlayback {
    return { ...mseg.createDefaultMsegPlayback(...args), format: "cosimo.mseg.playback" };
}

export function normalizeMsegPlayback(...args: Parameters<typeof mseg.normalizeMsegPlayback>): MsegPlayback {
    return { ...mseg.normalizeMsegPlayback(...args), format: "cosimo.mseg.playback" };
}

export function deserializeMsegPlayback(...args: Parameters<typeof mseg.deserializeMsegPlayback>): MsegPlayback {
    return { ...mseg.deserializeMsegPlayback(...args), format: "cosimo.mseg.playback" };
}

export function serializeMsegShape(shape: unknown): string {
    return JSON.stringify(normalizeMsegShape(shape));
}
export function serializeMsegPlayback(playback: unknown): string {
    return JSON.stringify(normalizeMsegPlayback(playback));
}
