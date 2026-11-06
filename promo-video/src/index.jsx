import { registerRoot, Composition } from 'remotion';
import { Promo, TOTAL_FRAMES, FPS } from './Promo';

const Root = () => (
  <Composition
    id="HyMotionPromo"
    component={Promo}
    durationInFrames={TOTAL_FRAMES}
    fps={FPS}
    width={1080}
    height={1920}
  />
);

registerRoot(Root);
