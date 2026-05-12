import { Composition, registerRoot, useCurrentFrame } from "remotion";

import { CosimoCinematic3DComposition } from "./CosimoCinematic3DComposition";

const FPS = 30;
const DURATION_FRAMES = 240;
const WIDTH = 1280;
const HEIGHT = 1100;

function Cinematic3DCompositionInRemotion() {
    const frame = useCurrentFrame();

    return (
        <CosimoCinematic3DComposition
            frameOverride={frame}
            captureOnce
            suppressLiveCapture
        />
    );
}

function CosimoCinematic3dRoot() {
    return (
        <Composition
            id="CosimoCinematic3D"
            component={Cinematic3DCompositionInRemotion}
            durationInFrames={DURATION_FRAMES}
            fps={FPS}
            width={WIDTH}
            height={HEIGHT}
        />
    );
}

registerRoot(CosimoCinematic3dRoot);
