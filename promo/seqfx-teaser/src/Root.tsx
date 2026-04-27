import { Composition } from "remotion";
import { DURATION_FRAMES, FPS } from "./design";
import { SeqFxTeaser } from "./SeqFxTeaser";

export const RemotionRoot = () => {
  return (
    <Composition
      id="SeqFxTeaser20"
      component={SeqFxTeaser}
      durationInFrames={DURATION_FRAMES}
      fps={FPS}
      width={1920}
      height={1080}
    />
  );
};
