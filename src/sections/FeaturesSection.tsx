import { useEffect, useRef, useState } from "react";
import { ArrowLeft, PenLine, Terminal, MessageSquare, ChevronRight } from "lucide-react";

type Props = {
  isActive: boolean;
  onBack: () => void;
};

const features = [
  {
    id: 0,
    icon: PenLine,
    label: "01",
    title: "Whiteboard Rendering",
    desc: "Diagrams, equations, and structured explanations drawn in real-time, animated stroke by stroke as the AI speaks.",
    img: "/images/whiteboard.png",
    accent: "#60a5fa",
  },
  {
    id: 1,
    icon: Terminal,
    label: "02",
    title: "Live Code Explaining",
    desc: "AI writes and explains the code step-by-step. Every line explained before it's typed.",
    img: "/images/code-editor.png",
    accent: "#34d399",
  },
  {
    id: 2,
    icon: MessageSquare,
    label: "03",
    title: "AI Chat Interface",
    desc: "Conversational interaction with full context awareness. Interrupt, redirect, or dive deeper at any moment.",
    img: "/images/chat-interface.png",
    accent: "#a78bfa",
  },
  {
    id: 3,
    icon: MessageSquare,
    label: "04",
    title: "Visual Learning",
    desc: "Visual learning through diagrams and animations that help reinforce concepts.",
    img: "/images/daigram.png",
    accent: "#a78bfa",
  },
  {
    id: 4,
    icon: MessageSquare,
    label: "05",
    title: "Download PDF Notes",
    desc: "Download a PDF of the session notes and diagrams for offline reference.",
    img: "/images/pdf.png",
    accent: "#a78bfa",
  },
];

export default function FeaturesSection({ isActive, onBack }: Props) {
  const [visible, setVisible] = useState(false);
  const [active, setActive] = useState(0);
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

  const current = features[active];

  return (
    <div className="feat-container">
      <div className="feat-wrap">
        {/* LEFT */}
        <div className="feat-left">
          <div className={`feat-eyebrow ${visible ? "show" : ""}`}>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#60a5fa",
                display: "inline-block",
              }}
            />
            meet2ai · Features
          </div>

          <h2 className={`feat-headline ${visible ? "show" : ""}`}>
            Built to <em>teach</em>,<br />
            not just answer.
          </h2>

          <div className={`feat-list ${visible ? "show" : ""}`}>
            {features.map((f) => {
              const Icon = f.icon;
              const isAct = active === f.id;
              return (
                <div
                  key={f.id}
                  className={`feat-item ${isAct ? "is-active" : ""}`}
                  style={{ "--accent": f.accent } as React.CSSProperties}
                  onClick={() => setActive(f.id)}
                >
                  <div className="feat-item-indicator" />
                  <div className="feat-item-icon">
                    <Icon size={15} strokeWidth={1.75} />
                  </div>
                  <div className="feat-item-body">
                    <div className="feat-item-title">{f.title}</div>
                    <div className="feat-item-desc">{f.desc}</div>
                  </div>
                  <ChevronRight size={12} className="feat-item-chevron" />
                </div>
              );
            })}
          </div>

          <button className={`feat-back ${visible ? "show" : ""}`} onClick={onBack}>
            <ArrowLeft size={14} strokeWidth={2} />
            Back
          </button>
        </div>

        {/* RIGHT */}
        <div className={`feat-right ${visible ? "show" : ""}`}>
          <div className="feat-preview">
            <div className="feat-preview-label">Preview</div>
            <div className="feat-preview-window">
              <div className="feat-preview-bar">
                <div className="feat-preview-dot" style={{ background: "#ff5f57" }} />
                <div className="feat-preview-dot" style={{ background: "#febc2e" }} />
                <div className="feat-preview-dot" style={{ background: "#28c840" }} />
              </div>
              {current.img ? (
                <img
                  key={current.id}
                  src={current.img}
                  alt={current.title}
                  className="feat-preview-img"
                  style={{ opacity: 1 }}
                />
              ) : (
                <div className="feat-preview-placeholder">
                  <div className="feat-preview-placeholder-icon">
                    {<current.icon size={48} strokeWidth={1} color={current.accent} />}
                  </div>
                  <span className="feat-preview-placeholder-text">{current.title}</span>
                </div>
              )}
            </div>
            <div className="feat-num">{current.label}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
