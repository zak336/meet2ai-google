import { useEffect, useState } from "react";

type Props = {
  isActive: boolean;
  onFinish: () => void;
};

export default function IntroSection({ isActive, onFinish }: Props) {
  const [moveToTop, setMoveToTop] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [logoVisible, setLogoVisible] = useState(false);
  const [taglineVisible, setTaglineVisible] = useState(false);
  const [dotsVisible, setDotsVisible] = useState(false);

  // Logo fades in first
  useEffect(() => {
    if (!isActive) return;
    const t = setTimeout(() => setLogoVisible(true), 200);
    return () => clearTimeout(t);
  }, [isActive]);

  // Tagline fades in second
  useEffect(() => {
    if (!isActive) return;
    const t = setTimeout(() => setTaglineVisible(true), 550);
    return () => clearTimeout(t);
  }, [isActive]);

  // Dots fade in last
  useEffect(() => {
    if (!isActive) return;
    const t = setTimeout(() => setDotsVisible(true), 900);
    return () => clearTimeout(t);
  }, [isActive]);

  // Hold still → fade out text+dots → wait for fade to finish → move logo up → finish
  useEffect(() => {
    if (!isActive) return;

    // all three are visible by ~1100ms, hold until 2200ms then fade out
    const fadeTimer  = setTimeout(() => setFadeOut(true),   2200);
    // fade-out transition is 500ms, so move starts at 2700ms
    const moveTimer  = setTimeout(() => setMoveToTop(true), 2700);
    // logo move transition ~600ms, finish at 3400ms
    const finishTimer = setTimeout(() => onFinish(),        3400);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(moveTimer);
      clearTimeout(finishTimer);
    };
  }, [isActive, onFinish]);

  return (
    <div className={`intro-section ${moveToTop ? "intro-move-top" : ""}`}>
      <div className="intro-container">
        <div className="intro-logo-wrapper">
          <h1 className={`intro-logo ${logoVisible ? "visible" : ""}`}>
            meet<span className="intro-logo-ai">2ai</span>
          </h1>
          <p className={`intro-tagline ${taglineVisible ? "visible" : ""} ${fadeOut ? "fade-out" : ""}`}>
            AI Teaching Assistant
          </p>
        </div>
        <div className={`intro-dots ${dotsVisible ? "visible" : ""} ${fadeOut ? "fade-out" : ""}`}>
          <span className="intro-dot intro-dot-1"></span>
          <span className="intro-dot intro-dot-2"></span>
          <span className="intro-dot intro-dot-3"></span>
        </div>
      </div>
    </div>
  );
}