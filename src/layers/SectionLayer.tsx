import LandingPage from "../components/LandingPage";
import PreJoinPage from "../components/PreJoinPage";
import Classroom from "../components/Classroom";
import IntroSection from "../sections/IntroSection";
import AboutSection from "../sections/AboutSection";
import FeaturesSection from "../sections/FeaturesSection";
import type { AppPhase } from "../App";

type Props = {
  appPhase: AppPhase;
  setAppPhase: (phase: AppPhase) => void;
  landingLayoutMode: "centered" | "asymmetrical";
};

export default function SectionLayer({
  appPhase,
  setAppPhase,
  landingLayoutMode,
}: Props) {
  return (
    <div className="section-layer">
      {/* Intro */}
      <div className={appPhase === "intro" ? "section active" : "section"}>
        <IntroSection
          isActive={appPhase === "intro"}
          onFinish={() => setAppPhase("landing")}
        />
      </div>
      {/* Landing */}
      <div className={appPhase === "landing" ? "section active" : "section"}>
        <LandingPage
          onStart={() => setAppPhase("prejoin")}
          onNavigate={setAppPhase}
          layoutMode={landingLayoutMode}
        />
      </div>
      {/* About */}
      <div className={appPhase === "about" ? "section active" : "section"}>
        <AboutSection
          isActive={appPhase === "about"}
          onBack={() => setAppPhase("landing")}
        />
      </div>
      {/* Features */}
      <div className={appPhase === "features" ? "section active" : "section"}>
        <FeaturesSection
          isActive={appPhase === "features"}
          onBack={() => setAppPhase("landing")}
        />
      </div>
      {/* PreJoin */}
      <div className={appPhase === "prejoin" ? "section active" : "section"}>
        <PreJoinPage
          isActive={appPhase === "prejoin"}
          onJoin={() => setAppPhase("classroom")}
          onBack={() => setAppPhase("landing")}
        />
      </div>
      {/* Classroom */}
      <div className={appPhase === "classroom" ? "section active" : "section"}>
        <Classroom
          isActive={appPhase === "classroom"}
          onEndSession={() => setAppPhase("landing")}
        />
      </div>
    </div>
  );
}
