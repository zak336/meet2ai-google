import { Sparkles, BookOpen, Code2, Zap } from "lucide-react";
import type { AppPhase } from "../App";

interface LandingPageProps {
  onStart: () => void;
  onNavigate: (phase: AppPhase) => void;
  layoutMode: "centered" | "asymmetrical";
}

export default function LandingPage({
  onStart,
  onNavigate,
  layoutMode,
}: LandingPageProps) {
  return (
    <div className="lp-root">
      {/* Logo at top */}
      <div className="lp-logo-header">
        <h1 className="lp-logo-top">
          meet<span className="lp-logo-accent">2ai</span>
        </h1>
      </div>

      {/* Hero Section */}
      <section className="lp-hero">
        <div className="lp-hero-content">
          <h2 className="lp-headline">
            Interactive AI Teaching Assistant
          </h2>
          <p className="lp-subheadline">
            Real-time whiteboard explanations synchronized with voice. 
            Learn physics, math, coding, or anything with step-by-step visual guidance.
          </p>

          {/* Key Features */}
          {/* <div className="lp-features-grid">
            <div className="lp-feature">
              <Sparkles className="lp-feature-icon" />
              <span className="lp-feature-text">Dynamic Whiteboard</span>
            </div>
            <div className="lp-feature">
              <Zap className="lp-feature-icon" />
              <span className="lp-feature-text">Voice Sync</span>
            </div>
            <div className="lp-feature">
              <Code2 className="lp-feature-icon" />
              <span className="lp-feature-text">Live Coding</span>
            </div>
            <div className="lp-feature">
              <BookOpen className="lp-feature-icon" />
              <span className="lp-feature-text">PDF Notes</span>
            </div>
          </div> */}

          <button className="lp-cta-btn" onClick={onStart}>
            Start Learning
            <span className="lp-cta-arrow">→</span>
          </button>
        </div>
      </section>

      {/* Bottom Navigation */}
      <div className="lp-bottom-nav">
        <button className="lp-nav-btn" onClick={() => onNavigate("about")}>
          [ About ]
        </button>
        <button className="lp-nav-btn" onClick={() => onNavigate("features")}>
          [ Features ]
        </button>
        <button className="lp-nav-btn" onClick={onStart}>
          [ Join ]
        </button>
      </div>
    </div>
  );
}
