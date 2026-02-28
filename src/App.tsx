import { useState } from "react";
import SectionLayer from "./layers/SectionLayer";
import BackgroundLayer from "./layers/BackgroundLayer";
import AvatarLayer from "./layers/AvatarLayer";

export type AppPhase =
  | "intro"
  | "landing"
  | "about"
  | "features"
  | "join"
  | "prejoin"
  | "classroom";

export default function App() {
  const [appPhase, setAppPhase] = useState<AppPhase>("intro");

  const landingLayoutMode: "centered" | "asymmetrical" = "centered";

  return (
    <>
      <BackgroundLayer />
      <AvatarLayer />
      <SectionLayer
        appPhase={appPhase}
        setAppPhase={setAppPhase}
        landingLayoutMode={landingLayoutMode}
      />
    </>
  );
}
