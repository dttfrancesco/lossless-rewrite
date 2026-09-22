import { registerRoot, Composition } from "remotion";
import { DemoFilm, ComparisonImage, SocialPreview } from "./scene";
import story from "./story.json";

const durationInFrames = story.reduce((frames, card) => frames + Math.round(card.seconds * 30), 0);

registerRoot(() => <>
  <Composition id="Lossless" component={DemoFilm} width={1280} height={720} fps={30} durationInFrames={durationInFrames} defaultProps={{ voiceover: false }} />
  <Composition id="LosslessSquare" component={DemoFilm} width={1080} height={1080} fps={30} durationInFrames={durationInFrames} defaultProps={{ voiceover: false }} />
  <Composition id="Comparison" component={ComparisonImage} width={1600} height={900} fps={30} durationInFrames={1} />
  <Composition id="Social" component={SocialPreview} width={1280} height={640} fps={30} durationInFrames={1} />
</>);
