import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Zap, Eye, Mic, Code2 } from "lucide-react";

type Props = {
  isActive: boolean;
  onBack: () => void;
};

const highlights = [
  { icon: Eye, text: "Dynamic whiteboard execution" },
  { icon: Mic, text: "Voice-synchronized explanations" },
  { icon: Zap, text: "Step-by-step logical breakdown" },
  { icon: Code2, text: "Interactive coding environment" },
];

export default function AboutSection({ isActive, onBack }: Props) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isActive) {
      timerRef.current = setTimeout(() => setVisible(true), 60);
    } else {
      setVisible(false);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isActive]);

  return (
    <div className="ab-container">
      <div className="ab-wrap">
        <div className={`ab-eyebrow ${visible ? "show" : ""}`}>
          <span className="ab-eyebrow-dot" />
          meet2ai · About
        </div>

        <h2 className={`ab-headline ${visible ? "show" : ""}`}>
          Teaching that<br /><em>shows its work.</em>
        </h2>

        <p className={`ab-body ${visible ? "show" : ""}`}>
          meet2ai is an AI-powered classroom built for structured one-on-one
          tutoring. Unlike standard chat, it synchronizes voice, whiteboard
          rendering, and step-based problem solving — replicating the pace and
          clarity of a real teacher.
        </p>

        <div className={`ab-divider ${visible ? "show" : ""}`} />

        <div className={`ab-grid ${visible ? "show" : ""}`}>
          {highlights.map(({ icon: Icon, text }) => (
            <div className="ab-card" key={text}>
              <div className="ab-card-icon">
                <Icon size={14} strokeWidth={1.75} />
              </div>
              <span className="ab-card-text">{text}</span>
            </div>
          ))}
        </div>

        <button className={`ab-back ${visible ? "show" : ""}`} onClick={onBack}>
          <ArrowLeft size={14} strokeWidth={2} />
          Back
        </button>
      </div>
    </div>
  );
}
