import { Composition } from "remotion";
import { Buildlapse } from "./Buildlapse";
import { DURATION_FRAMES, FPS, HEIGHT, WIDTH } from "./design";

export const RemotionRoot = () => {
  return (
    <Composition
      id="CosimoBuildlapse"
      component={Buildlapse}
      durationInFrames={DURATION_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
  );
};
