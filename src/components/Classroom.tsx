import { useState, useRef, useEffect } from "react";
import { GoogleGenAI } from "@google/genai";
import jsPDF from "jspdf";
import { toPng } from "html-to-image";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  ClosedCaption,
  Hand,
  MonitorUp,
  MoreVertical,
  PhoneOff,
  MessageSquare,
  Users,
  Shapes,
  Lock,
  Info,
  Download,
} from "lucide-react";
import Whiteboard, { Drawing } from "./Whiteboard";
import CodeBoard from "./CodeBoard";
import ChatPanel from "./ChatPanel";
import AudioVisualizer from "./AudioVisualizer";
import { i } from "motion/react-client";

// Speech Recognition Types
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

let globalUtterance: SpeechSynthesisUtterance | null = null;

interface ClassroomProps {
  isActive: boolean;
  onEndSession: () => void;
}

interface Slide {
  id: string;
  mode: "whiteboard" | "code" | "none";
  text: string;
  drawings: Drawing[];
  diagrams?: Drawing[][];
  image: string | null;
  language: string;
  permanentHighlights: string[];
}

export default function Classroom({ isActive, onEndSession }: ClassroomProps) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [presentationMode, setPresentationMode] = useState<
    "none" | "whiteboard" | "code"
  >("none");
  const [codeLanguage, setCodeLanguage] = useState("typescript");
  const [slideHistory, setSlideHistory] = useState<Slide[]>([]);
  const [micOn, setMicOn] = useState(false);
  const [videoOn, setVideoOn] = useState(false);
  const [screenShareOn, setScreenShareOn] = useState(false);
  const [ccOn, setCcOn] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [callEnded, setCallEnded] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);

  // Chat & Voice State
  const [messages, setMessages] = useState<
    { role: "user" | "ai"; text: string }[]
  >([]);
  const [sessionHistory, setSessionHistory] = useState<
    { timestamp: string; query: string; response: string }[]
  >([]);
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);

  // Use a ref to always access the latest handleSendMessage function
  const handleSendMessageRef = useRef<any>(null);

  useEffect(() => {
    if (!isActive) return;
    // Initialize Speech Recognition
    if ("SpeechRecognition" in window || "webkitSpeechRecognition" in window) {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = "en-US";

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        console.log("Voice command:", transcript);
        if (handleSendMessageRef.current) {
          handleSendMessageRef.current(transcript);
        }
      };

      recognitionRef.current.onend = () => {
        if (isListeningRef.current) {
          try {
            recognitionRef.current.start();
          } catch (e) {
            // Ignore error if already started
          }
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        if (event.error === "not-allowed") {
          setMicOn(false);
          isListeningRef.current = false;
        }
      };
    }

    if (window.innerWidth >= 768) {
      setIsChatOpen(true);
    }

    // Greet user on join
    if ("speechSynthesis" in window && !greetedRef.current) {
      greetedRef.current = true;
      setTimeout(() => {
        const utterance = new SpeechSynthesisUtterance(
          "Welcome to the AI Classroom! I'm your AI teacher. What would you like to learn today?",
        );
        const voices = window.speechSynthesis.getVoices();
        const englishVoice =
          voices.find((v) => v.lang.startsWith("en-") && !v.localService) ||
          voices.find((v) => v.lang.startsWith("en-")) ||
          voices[0];
        if (englishVoice) utterance.voice = englishVoice;
        window.speechSynthesis.speak(utterance);
      }, 1000);
    }
  }, [isActive]);

  useEffect(() => {
    if (!isActive) return;

    let stream;

    async function start() {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
    }

    start();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isActive]);

  const toggleMic = async () => {
    if (micOn) {
      stream?.getAudioTracks().forEach((track) => track.stop());
      setMicOn(false);
      isListeningRef.current = false;
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (stream && stream.getVideoTracks().length === 0) {
        setStream(null);
      }
    } else {
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: videoOn,
        });
        setStream(newStream);
        if (videoRef.current && videoOn) videoRef.current.srcObject = newStream;
        setMicOn(true);

        if (recognitionRef.current) {
          isListeningRef.current = true;
          try {
            recognitionRef.current.start();
          } catch (e) {
            console.error("Error starting speech recognition:", e);
          }
        } else {
          alert(
            "Voice control is not supported in this browser. Please use Chrome, Edge, or Safari.",
          );
        }
      } catch (e: any) {
        console.error("Mic error:", e);
        if (
          e.name === "NotAllowedError" ||
          e.name === "PermissionDeniedError" ||
          e.message.includes("Permission denied")
        ) {
          alert(
            "Microphone access was denied. Please allow microphone access in your browser settings to use this feature.",
          );
        } else {
          alert("Could not access microphone. Please check your device.");
        }
      }
    }
  };

  const toggleVideo = async () => {
    if (videoOn) {
      stream?.getVideoTracks().forEach((track) => track.stop());
      setVideoOn(false);
      if (stream && stream.getAudioTracks().length === 0) {
        setStream(null);
      }
    } else {
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: micOn,
        });
        setStream(newStream);
        if (videoRef.current) videoRef.current.srcObject = newStream;
        setVideoOn(true);
      } catch (e: any) {
        console.error("Video error:", e);
        if (
          e.name === "NotAllowedError" ||
          e.name === "PermissionDeniedError" ||
          e.message.includes("Permission denied")
        ) {
          alert(
            "Camera access was denied. Please allow camera access in your browser settings to use this feature.",
          );
        } else {
          alert("Could not access camera. Please check your device.");
        }
      }
    }
  };

  const toggleScreenShare = async () => {
    if (screenShareOn) {
      screenStream?.getTracks().forEach((track) => track.stop());
      setScreenShareOn(false);
      setScreenStream(null);
    } else {
      try {
        const newStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
        });
        setScreenStream(newStream);
        if (screenVideoRef.current)
          screenVideoRef.current.srcObject = newStream;
        setScreenShareOn(true);

        // Handle user stopping screen share from browser UI
        newStream.getVideoTracks()[0].onended = () => {
          setScreenShareOn(false);
          setScreenStream(null);
        };
      } catch (e: any) {
        console.error("Screen share error:", e);
        if (e.name !== "NotAllowedError") {
          alert(
            "Could not start screen sharing. Please check your browser permissions.",
          );
        }
      }
    }
  };

  const [whiteboardText, setWhiteboardText] = useState(
    "Welcome to the AI Classroom!\n\nAsk me anything in the chat, and I'll explain it here on the whiteboard.",
  );
  const [isWriting, setIsWriting] = useState(false);
  const [typingSpeed, setTypingSpeed] = useState(50);
  const [expectedDuration, setExpectedDuration] = useState(2000);

  const [isProcessing, setIsProcessing] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [steps, setSteps] = useState<
    {
      spokenText: string;
      whiteboardText: string;
      highlightText?: string;
      permanentHighlight?: string;
      drawings?: Drawing[];
      diagramPrompt?: string;
      isGeneratingDiagram?: boolean;
    }[]
  >([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [startedStepIndex, setStartedStepIndex] = useState(-1);
  const [stepWritingComplete, setStepWritingComplete] = useState(false);
  const [stepSpeakingComplete, setStepSpeakingComplete] = useState(false);
  const [speechProgress, setSpeechProgress] = useState(0);
  const [currentHighlight, setCurrentHighlight] = useState("");
  const [permanentHighlights, setPermanentHighlights] = useState<string[]>([]);
  const [currentDrawings, setCurrentDrawings] = useState<Drawing[]>([]);
  const [currentDiagrams, setCurrentDiagrams] = useState<Drawing[][]>([]);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [stepDrawings, setStepDrawings] = useState<Record<number, Drawing[]>>(
    {},
  );
  const [generatingDiagrams, setGeneratingDiagrams] = useState<
    Record<number, boolean>
  >({});
  const clearBoardRef = useRef(true);
  const keepImageRef = useRef(false);
  const executingStepRef = useRef(-1);
  const greetedRef = useRef(false);
  const sessionIdRef = useRef(0);

  useEffect(() => {
    if (steps.length > 0 && currentStepIndex === -1) {
      setCurrentStepIndex(0);
    }
  }, [steps.length, currentStepIndex]);

  useEffect(() => {
    if (currentStepIndex >= 0 && currentStepIndex < steps.length) {
      if (
        stepWritingComplete &&
        stepSpeakingComplete &&
        currentStepIndex === executingStepRef.current
      ) {
        if (currentStepIndex < steps.length - 1) {
          setStepWritingComplete(false);
          setStepSpeakingComplete(false);
          setCurrentStepIndex(currentStepIndex + 1);
        } else if (!isProcessing) {
          setIsWriting(false);
        }
      }
    }
  }, [
    stepWritingComplete,
    stepSpeakingComplete,
    currentStepIndex,
    steps.length,
    isProcessing,
  ]);

  useEffect(() => {
    if (
      currentStepIndex >= 0 &&
      currentStepIndex < steps.length &&
      currentStepIndex !== executingStepRef.current
    ) {
      if (generatingDiagrams[currentStepIndex]) {
        return; // Wait for diagram generation to finish
      }

      executingStepRef.current = currentStepIndex;
      setStartedStepIndex(currentStepIndex);
      const step = steps[currentStepIndex];
      const currentStepDrawings =
        stepDrawings[currentStepIndex] || step.drawings || [];

      setStepWritingComplete(false);
      setStepSpeakingComplete(false);
      setSpeechProgress(0);

      let stepText = step.whiteboardText || "";
      if (currentStepDrawings.length > 0 && !stepText.includes("[DIAGRAM]")) {
        stepText += (stepText ? "\n" : "") + "[DIAGRAM]";
      }

      if (stepText) {
        if (currentStepIndex === 0 && clearBoardRef.current) {
          setWhiteboardText(stepText);
          setPermanentHighlights([]);
          setCurrentDrawings(currentStepDrawings);
          setCurrentDiagrams(
            currentStepDrawings.length > 0
              ? [currentStepDrawings]
              : stepText.includes("[DIAGRAM]")
                ? [[]]
                : [],
          );

          if (!keepImageRef.current) {
            setCurrentImage(null);
          }
          keepImageRef.current = false;
        } else {
          setWhiteboardText(
            (prev) => prev + (prev && stepText ? "\n" : "") + stepText,
          );
          if (currentStepDrawings.length > 0) {
            setCurrentDrawings(currentStepDrawings);
            setCurrentDiagrams((prev) => [...prev, currentStepDrawings]);
          } else if (stepText.includes("[DIAGRAM]")) {
            setCurrentDrawings([]);
            setCurrentDiagrams((prev) => [...prev, []]);
          }
        }
        setIsWriting(true);
      } else {
        if (currentStepIndex === 0 && clearBoardRef.current) {
          setWhiteboardText("");
          setPermanentHighlights([]);
          setCurrentDrawings([]);
          setCurrentDiagrams([]);

          if (!keepImageRef.current) {
            setCurrentImage(null);
          }
          keepImageRef.current = false;
        }
        setIsWriting(false);
        setStepWritingComplete(true);
      }

      // setCurrentHighlight(step.highlightText || "");
      setCurrentHighlight("");

      if (step.highlightText) {
        setTimeout(() => {
          setCurrentHighlight("");
        }, 2000);
      }

      if (step.permanentHighlight) {
        const newHighlights = step.permanentHighlight
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        setPermanentHighlights((prev) => [...prev, ...newHighlights]);
      }

      if (currentStepDrawings.length > 0) {
        // REPLACE drawings instead of appending to prevent overlap bugs
        setCurrentDrawings(currentStepDrawings);
      }

      const cleanSpokenText = step.spokenText
        ? step.spokenText.replace(/^[\/\/#*]+\s*/, "").trim()
        : "";

      if ("speechSynthesis" in window && cleanSpokenText !== "") {
        const utterance = new SpeechSynthesisUtterance(cleanSpokenText);
        globalUtterance = utterance;
        const voices = window.speechSynthesis.getVoices();
        const englishVoice =
          voices.find((v) => v.lang.startsWith("en-") && !v.localService) ||
          voices.find((v) => v.lang.startsWith("en-")) ||
          voices[0];
        if (englishVoice) utterance.voice = englishVoice;

        utterance.onboundary = (event) => {
          if (event.name === "word") {
            const charIndex = event.charIndex;
            const textLength = cleanSpokenText.length;
            if (textLength > 0) {
              setSpeechProgress(charIndex / textLength);
            }
          }
        };

        const wordCount = cleanSpokenText.split(" ").length;
        const estimatedDurationMs = (wordCount / 2.5) * 1000;
        setExpectedDuration(estimatedDurationMs);

        // Safety timeout to prevent hanging if onend doesn't fire
        let safetyTimeout: any;
        let progressInterval: any;
        const startTime = Date.now();
        let lastBoundaryTime = Date.now();

        utterance.onstart = () => {
          progressInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const timeProgress = Math.min(0.99, elapsed / estimatedDurationMs);

            // If onboundary hasn't fired in the last 1 second, use time-based progress
            if (Date.now() - lastBoundaryTime > 1000) {
              setSpeechProgress((prev) => Math.max(prev, timeProgress));
            }
          }, 100);
        };

        utterance.onboundary = (event) => {
          lastBoundaryTime = Date.now();
          if (event.name === "word") {
            const charIndex = event.charIndex;
            const textLength = cleanSpokenText.length;
            if (textLength > 0) {
              setSpeechProgress(charIndex / textLength);
            }
          }
        };

        utterance.onend = () => {
          clearTimeout(safetyTimeout);
          clearInterval(progressInterval);
          setStepSpeakingComplete(true);
          setSpeechProgress(1);
        };
        utterance.onerror = () => {
          clearTimeout(safetyTimeout);
          clearInterval(progressInterval);
          setStepSpeakingComplete(true);
          setSpeechProgress(1);
        };

        // We still calculate a fallback speed, but the primary driver will be speechProgress
        const charsToWrite = Math.max(1, step.whiteboardText.length);
        const calculatedSpeed = (estimatedDurationMs * 0.95) / charsToWrite;
        const adjustedSpeed = calculatedSpeed * 0.8;
        const speed = Math.min(150, Math.max(30, adjustedSpeed));
        setTypingSpeed(speed);

        safetyTimeout = setTimeout(() => {
          console.warn("Speech safety timeout triggered");
          clearInterval(progressInterval);
          setStepSpeakingComplete(true);
          setSpeechProgress(1);
        }, estimatedDurationMs + 5000); // 5s buffer

        window.speechSynthesis.speak(utterance);
      } else {
        setStepSpeakingComplete(true);
        setSpeechProgress(1);
        setTypingSpeed(10);
        setExpectedDuration(100);
      }
    }
  }, [
    currentStepIndex,
    steps,
    startedStepIndex,
    stepDrawings,
    generatingDiagrams,
  ]);

  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  const speakFiller = () => {
    if ("speechSynthesis" in window) {
      const fillers = [
        "Hmm, let me think about that...",
        "Good question, let's see...",
        "One moment, I'm processing that...",
        "Let me analyze that for you...",
        "Interesting, let me work on that...",
      ];
      const randomFiller = fillers[Math.floor(Math.random() * fillers.length)];
      const utterance = new SpeechSynthesisUtterance(randomFiller);
      const voices = window.speechSynthesis.getVoices();
      const englishVoice =
        voices.find((v) => v.lang.startsWith("en-") && !v.localService) ||
        voices.find((v) => v.lang.startsWith("en-")) ||
        voices[0];
      if (englishVoice) utterance.voice = englishVoice;
      window.speechSynthesis.speak(utterance);
    }
  };

  const generateDiagramWithGemini3 = async (
    prompt: string,
    stepIndex: number,
    sessionId: number,
  ) => {
    try {
      setGeneratingDiagrams((prev) => ({ ...prev, [stepIndex]: true }));

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `You are an expert SVG diagram generator. Generate raw SVG code for the following diagram description:
        
        DESCRIPTION: ${prompt}
        
        CRITICAL: Output ONLY valid SVG code. Do not include markdown formatting like \`\`\`svg.
        CRITICAL: Do NOT use <g> elements or transform attributes. Apply all coordinates directly to the shapes.
        CRITICAL: Supported elements are <path>, <rect>, <circle>, <ellipse>, <line>, <text>.
        
        Coordinates are relative to a 800x600 canvas. Center the diagram at x:400, y:300.
        Make it simple, clear, and colorful. Use SVG paths for complex shapes.`,
      });

      let svgStr = response.text?.trim() || "";
      // Strip markdown if present
      svgStr = svgStr.replace(/^```(xml|svg)?\n?/, "").replace(/\n?```$/, "");

      if (svgStr) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgStr, "image/svg+xml");
        const drawings: Drawing[] = [];

        const getNum = (val: string | null, def: number) =>
          val ? parseFloat(val) : def;
        const getStr = (val: string | null, def: string) => val || def;

        doc
          .querySelectorAll(
            "path, rect, circle, ellipse, line, polyline, polygon, text",
          )
          .forEach((el) => {
            const stroke = getStr(el.getAttribute("stroke"), "black");
            const strokeWidth = getNum(el.getAttribute("stroke-width"), 2);
            const fill = getStr(el.getAttribute("fill"), "none");

            if (el.tagName === "path") {
              drawings.push({
                type: "path",
                d: getStr(el.getAttribute("d"), ""),
                stroke,
                strokeWidth,
                fill,
              });
            } else if (el.tagName === "polyline" || el.tagName === "polygon") {
              const points = el.getAttribute("points");
              if (points) {
                const d = `M ${points.trim().replace(/\s+/g, " L ")} ${el.tagName === "polygon" ? "Z" : ""}`;
                drawings.push({ type: "path", d, stroke, strokeWidth, fill });
              }
            } else if (el.tagName === "rect") {
              drawings.push({
                type: "rect",
                x: getNum(el.getAttribute("x"), 0),
                y: getNum(el.getAttribute("y"), 0),
                width: getNum(el.getAttribute("width"), 0),
                height: getNum(el.getAttribute("height"), 0),
                stroke,
                strokeWidth,
                fill,
              });
            } else if (el.tagName === "circle") {
              drawings.push({
                type: "circle",
                x: getNum(el.getAttribute("cx"), 0),
                y: getNum(el.getAttribute("cy"), 0),
                width: getNum(el.getAttribute("r"), 0) * 2,
                stroke,
                strokeWidth,
                fill,
              });
            } else if (el.tagName === "ellipse") {
              drawings.push({
                type: "ellipse",
                x: getNum(el.getAttribute("cx"), 0),
                y: getNum(el.getAttribute("cy"), 0),
                width: getNum(el.getAttribute("rx"), 0) * 2,
                height: getNum(el.getAttribute("ry"), 0) * 2,
                stroke,
                strokeWidth,
                fill,
              });
            } else if (el.tagName === "line") {
              drawings.push({
                type: "line",
                x: getNum(el.getAttribute("x1"), 0),
                y: getNum(el.getAttribute("y1"), 0),
                x2: getNum(el.getAttribute("x2"), 0),
                y2: getNum(el.getAttribute("y2"), 0),
                stroke,
                strokeWidth,
                fill,
              });
            } else if (el.tagName === "text") {
              drawings.push({
                type: "text",
                x: getNum(el.getAttribute("x"), 0),
                y: getNum(el.getAttribute("y"), 0),
                fontSize: getNum(el.getAttribute("font-size"), 20),
                fill: getStr(el.getAttribute("fill"), "black"),
                text: el.textContent || "",
              });
            }
          });

        if (sessionId === sessionIdRef.current) {
          setStepDrawings((prev) => ({ ...prev, [stepIndex]: drawings }));
        }
      }
    } catch (error) {
      console.error("Error generating diagram with Gemini 3:", error);
    } finally {
      if (sessionId === sessionIdRef.current) {
        setGeneratingDiagrams((prev) => ({ ...prev, [stepIndex]: false }));
      }
    }
  };

  useEffect(() => {
    steps.forEach((step, index) => {
      if (
        step.diagramPrompt &&
        !stepDrawings[index] &&
        !generatingDiagrams[index]
      ) {
        generateDiagramWithGemini3(
          step.diagramPrompt,
          index,
          sessionIdRef.current,
        );
      }
    });
  }, [steps, stepDrawings, generatingDiagrams]);

  const handleSendMessage = async (query: string, image?: string) => {
    if (!query.trim() && !image) return;

    sessionIdRef.current += 1;

    const lowerQuery = query.toLowerCase().trim();
    if (
      lowerQuery === "stop" ||
      lowerQuery === "cancel" ||
      lowerQuery === "stop talking"
    ) {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      setStepSpeakingComplete(true);
      setStepWritingComplete(true);
      setIsProcessing(false);
      setIsWriting(false);
      setSteps([]);
      return;
    }

    // Cancel any ongoing speech if user interrupts
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    // Fast Response for simple queries (Client-side only, no API call)
    const simpleResponses: Record<string, string> = {
      hello: "Hello! Ready to learn?",
      hi: "Hi there! What's on your mind?",
      hey: "Hey! How can I help?",
      goodbye: "Goodbye! See you next time.",
      bye: "Bye! Have a wonderful day.",
      "thank you": "You're very welcome!",
      thanks: "No problem at all!",
      "how are you": "I'm doing great and ready to teach!",
      "what is your name": "I'm your AI Teacher.",
      "good morning": "Good morning! Ready to start class?",
      "good afternoon": "Good afternoon! What shall we learn?",
      "good evening": "Good evening! It's never too late to learn.",
    };

    // Clean punctuation for matching
    const cleanQuery = lowerQuery.replace(/[.,!?]/g, "");

    if (simpleResponses[cleanQuery] && !image && !screenShareOn) {
      const response = simpleResponses[cleanQuery];
      setMessages((prev) => [
        ...prev,
        { role: "user", text: query },
        { role: "ai", text: response },
      ]);

      if ("speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(response);
        const voices = window.speechSynthesis.getVoices();
        // Use default Web TTS voice
        const englishVoice =
          voices.find((v) => v.lang.startsWith("en-") && !v.localService) ||
          voices.find((v) => v.lang.startsWith("en-")) ||
          voices[0];
        if (englishVoice) utterance.voice = englishVoice;
        window.speechSynthesis.speak(utterance);
      }
      return;
    }

    let capturedImage = image;
    if (!capturedImage && screenShareOn && screenVideoRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = screenVideoRef.current.videoWidth;
      canvas.height = screenVideoRef.current.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(
          screenVideoRef.current,
          0,
          0,
          canvas.width,
          canvas.height,
        );
        capturedImage = canvas.toDataURL("image/jpeg", 0.8);
      }
    }

    setMessages((prev) => [
      ...prev,
      { role: "user", text: query + (capturedImage ? " [Image]" : "") },
    ]);

    setIsProcessing(true);
    speakFiller(); // Speak filler instead of just showing loading spinner

    setIsWriting(false);
    setSteps([]);
    setStepDrawings({});
    setGeneratingDiagrams({});
    setCurrentStepIndex(-1);
    setStartedStepIndex(-1);
    executingStepRef.current = -1;
    setCurrentHighlight("");

    if (capturedImage) {
      setCurrentImage(capturedImage);
      keepImageRef.current = true;
    } else {
      keepImageRef.current = false;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      // Use gemini-2.5-flash for fast and high-quality diagram generation
      let selectedModel = "gemini-2.5-flash";

      console.log(`Using model: ${selectedModel}`);

      const parts: any[] = [
        {
          text: `You are an AI teacher. 
Current text on the board:
\`\`\`
${whiteboardText}
\`\`\`

Conversation History:
${messages
  .slice(-6)
  .map((m) => `${m.role.toUpperCase()}: ${m.text}`)
  .join("\n")}

The user asks: "${query}". 
${capturedImage ? (screenShareOn && !image ? "The user has shared their screen. The image provided is a screenshot of their current screen." : "The user has also uploaded an image which is now displayed on the whiteboard.") : ""}

First, analyze the user's input (text and/or image) in the context of the Conversation History.

DECISION LOGIC (CRITICAL):
0. CLASSIFY THE REQUEST: 
   - Is it a "TOPIC EXPLANATION" (e.g., "what is a black hole", "explain gravity")?
   - Or a "PROBLEM TO SOLVE" (e.g., "solve this equation", uploaded image of homework)?
   - Or an "INTERRUPTION / NEW TOPIC" (user asks something completely different while you were explaining)?
   If TOPIC EXPLANATION or NEW TOPIC: Do NOT write the user's question on the board. Start directly with a clean, formal Topic Heading (e.g., if the user asks "how a plant grow from seed", write "Growth of a Plant"). Do NOT write the question directly. CLEAR_BOARD must be true for new topics.
   If PROBLEM TO SOLVE: Write the problem statement or question at the top of the board first.
1. SIMPLICITY FIRST: Use simple wording. Do NOT go deep into any topic unless the user explicitly asks for details (e.g., "how does that work", "tell me more"). Keep explanations high-level, brief, and easy to understand.
   - CRITICAL: If the user asks about a component (e.g., "diodes"), explain WHAT it is and HOW it works simply. Do NOT explain advanced concepts like IV curves, band gaps, or quantum mechanics unless explicitly asked.
   - INTERRUPTIONS: If the user asks a completely new question that interrupts the current topic, immediately pivot to the new topic. Set CLEAR_BOARD: true and start fresh. Do not force them to finish the previous topic.
2. IF the user provided an IMAGE:
   - MODE: whiteboard
   - CLEAR_BOARD: true
   - The image is ALREADY displayed on the board.
   - Your task is to EXPLAIN the image or SOLVE the problem shown in it.
   - Write your explanation/solution step-by-step on the whiteboard (it will appear below the image).

2. IF the user asks about a "BIG TOPIC" (e.g., "Explain Quantum Physics", "How does a car engine work?", "Teach me Python", "What is history of Rome?", "Solve this math problem"):
   - MODE: whiteboard (or code if it's programming)
   - CLEAR_BOARD: true
   - You MUST write the explanation on the board. Do not just speak it.
   - Break it down into clear steps.

3. IF the user says a GREETING (e.g., "Hi", "Hello") or an INCOMPLETE/VAGUE QUESTION (e.g., "I have a question", "Can you help?", "Tell me about..."):
   - MODE: none
   - CLEAR_BOARD: false
   - Do NOT write anything on the board.
   - Reply ONLY with a spoken response.
   - Ask the user to provide the full question or topic.
   - Example: "Hello! I'm ready to help. What specific topic would you like to learn about today?"

4. IF the user explicitly asked to "write", "draw", "show me on the board", "code this":
   - MODE: whiteboard (or code)
   - CLEAR_BOARD: true

5. IF the user asks a simple factual question (e.g., "What is the capital of France?") AND did NOT ask to write/draw/explain in detail:
   - MODE: none
   - CLEAR_BOARD: false
   - Reply ONLY with a spoken explanation.

Next, generate a "CHAT_ACTION" to reply to the user in the chat.
- "CHAT_ACTION: <action text>"

Next, decide the MODE: "whiteboard", "code", or "none".
- "MODE: <mode>"

Next, determine the programming language if applicable.
- "LANGUAGE: <language>" (or none)

Next, decide CLEAR_BOARD.
- "CLEAR_BOARD: <true/false>"

Tone: Patient, clear, and direct.

If MODE is "none":
- Just provide a "SPOKEN" block.
- Example:
  ===STEP===
  SPOKEN: Hello there! I'm your AI teacher. What subject or topic would you like to explore today?
  WRITTEN: 
  ===STEP===

If MODE is "whiteboard" (and CLEAR_BOARD is true):
  1. Step 1: Write the topic heading. Use PERMANENT_HIGHLIGHT for the heading. Speak intro.
  2. Step 2: Write the content line-by-line. 
     - CRITICAL: DO NOT WRITE AND DRAW IN THE SAME STEP. 
     - CRITICAL: NEVER use emojis in the WRITTEN text. Emojis are strictly forbidden on the whiteboard.
     - If a step has WRITTEN text, the DIAGRAM_PROMPT MUST be empty "".
     - If a step has a DIAGRAM_PROMPT, the WRITTEN text MUST be empty "".
     - CRITICAL: You can write text ABOVE and BELOW the diagram. To do this, output the exact token [DIAGRAM] in your WRITTEN text where the diagram should be inserted. Any text written after [DIAGRAM] will appear below the drawing.
     - Example:
       WRITTEN: Here is the diagram: \n [DIAGRAM] \n As you can see above...
     - If "Whole Concept": Write the user's concept line-by-line, explaining each part.
     - If "Topic Question": Write the definition/explanation line-by-line.
     - CRITICAL: DIAGRAM STRATEGY (Dynamic vs Static):
       - CASE A: DYNAMIC PROCESSES (e.g., Sorting Algorithms, Mitosis, Engine Cycles, Physics motion):
         - You MUST use multiple steps to show the EVOLUTION of the diagram.
         - Step 1: Draw initial state (provide FULL DIAGRAM_PROMPT).
         - Step 2: Draw updated state (e.g., items swapped). Provide a NEW FULL DIAGRAM_PROMPT.
         - The diagram MUST change visually in each step to match the spoken explanation.
       - CASE B: STRUCTURAL/STATIC TOPICS (e.g., Photosynthesis, Anatomy, Maps, System Architecture, "What is X"):
         - Use a SINGLE, comprehensive diagram.
         - Draw it ONCE at the beginning or relevant step.
         - Do NOT generate a new diagram for subsequent steps unless the view completely changes.
         - For subsequent steps, keep the DIAGRAM_PROMPT empty ("") so the previous diagram remains visible while you write text about it.
     - CRITICAL: Do NOT write "Definition:".
     - CRITICAL: Break content into small, digestible lines.
     - SPOKEN TEXT RULE: The SPOKEN text must closely match the WRITTEN text. Say EXACTLY what you are writing, plus a very brief explanation. Do NOT write one thing and speak about something else. Sync is critical.
     - CRITICAL: Do NOT move to the next line until the writing AND speaking for the current line are finished.
     - CRITICAL FOR MATH EQUATIONS: You MUST use LaTeX syntax for mathematical equations. Enclose block equations in \`$$\` (e.g., \`$$ E = mc^2 $$\`) and inline equations in \`$\` (e.g., \`$x = 5$\`). The board will render them beautifully.
  
  CRITICAL FOR PHYSICS PROBLEMS:
  Follow "The Physics Structure":
  I. Setup (The Model)
     - Givens & Goal: List known variables (v, m, theta) and what you need to find.
     - Diagram: Draw a Free Body Diagram (FBD) or circuit schematic using DIAGRAM_PROMPT.
     - Assumptions: State constraints (e.g., "Vacuum," "Frictionless," "Point mass").
  II. The Law (The Weapon)
     - Principle: State the governing law (e.g., Newton's 2nd Law, Conservation of Energy).
     - Equation: Write down the base formula using LaTeX syntax (e.g., \`$$ F = ma $$\`).
  III. Execution (The Solve)
     - Symbolic First: Isolate the target variable using algebra before plugging in any numbers.
     - Substitute: Insert values only at the very end.
  IV. Sanity Check
     - Units: Do the dimensions match on both sides?
     - Limits: Does the result make sense if mass = 0 or time -> infinity?
  V. Result
     - Answer: State the value with correct significant figures and units.
     - Meaning: Interpret the physical sign (+/-) or magnitude.

  CRITICAL FOR MATH PROBLEMS:
  Follow "The Math Structure":
  I. Setup (The Premise)
     - Given & Goal: Define the starting conditions and what to prove or find.
     - Visual: Sketch the graph, geometric figure, or define the domain using DIAGRAM_PROMPT.
  II. The Strategy (The Tool)
     - Method: Select the specific Theorem or Technique (e.g., "Pythagorean Theorem," "Integration by Parts," "Induction").
  III. Execution (The Logic)
     - Step-by-Step: Apply logical operators ("Since," "Therefore," "Implies").
     - Calculation: Perform the algebraic or calculus operations clearly.
  IV. Verification
     - Constraints: Check for undefined values (e.g., division by zero, negative roots).
     - Edge Cases: Does the solution hold for x=0, x=1, or boundary conditions?
  V. Result
     - Conclusion: Box the final answer clearly.
     - Q.E.D.: Mark the proof complete.

  3. CODING TASKS (COMPLEXITY CLASSIFICATION):
     - If the user asks for code, you MUST classify whether the problem is COMPLEX or SIMPLE.
     - COMPLEX problems (e.g., algorithms, data structures, full components): 
       - FIRST, write the algorithm, approach, or architecture on the whiteboard.
       - THEN, switch to the code editor to write the actual code.
     - SIMPLE problems (e.g., basic syntax, simple functions, CSS tweaks):
       - Skip the whiteboard algorithm and directly provide the code in the code editor.
     - Use the MODE field to switch between 'whiteboard' and 'code'.
  4. Step 4: Ask if they have questions. ONLY speak this. DO NOT write anything.
  5. HIGHLIGHTING: 
     - CRITICAL: Do NOT use the HIGHLIGHT field for keywords, terms, or anything in the middle of the text.
     - ONLY use PERMANENT_HIGHLIGHT for the Main Topic Heading at the start.
     - Do NOT use the HIGHLIGHT field for anything else.
     - CRITICAL: DO NOT use XML or HTML tags like <PERMANENT_HIGHLIGHT> or <HIGHLIGHT> in the WRITTEN text. Just output the plain text in WRITTEN, and put the word you want to highlight in the PERMANENT_HIGHLIGHT field.
  6. DRAWING (D3.js SVG Generation):
     - You do NOT generate the SVG JSON directly.
     - Instead, use the DIAGRAM_PROMPT field to describe exactly what diagram should be drawn for this step.
     - Provide a highly detailed description of the shapes, layout, colors, and labels needed.
     - Example: 
       DIAGRAM_PROMPT: A simple diagram of a plant cell. A large green rectangle for the cell wall, a blue circle for the nucleus, and labels pointing to them.
     - If no diagram is needed, leave the DIAGRAM_PROMPT field empty or omit it.
     - NEVER use SVG for math equations. Use simple text (pen).
  
  Example:
  ===STEP===
  SPOKEN: Let's look at a triangle.
  WRITTEN: Triangle Properties
  DIAGRAM_PROMPT: A simple triangle with a label "Base" at the bottom.
  HIGHLIGHT: 
  PERMANENT_HIGHLIGHT: Triangle Properties
  ===STEP===

- If the user asks for code, follow this Methodology:
  
  CRITICAL FOR CODING:
  - You MUST classify whether the coding problem is COMPLEX or SIMPLE.
  
  - COMPLEX PROBLEMS (e.g., algorithms, data structures, full components, logic-heavy tasks):
    - Use a TWO-TURN approach.
    - TURN 1: SETUP & ALGORITHM
      - MODE: whiteboard
      - CLEAR_BOARD: true
      - Write the Question or Aim on the whiteboard.
      - Write the step-by-step Algorithm or Logic Flow.
      - Explain the logic step-by-step.
      - End by asking: "Shall I write the code now?"
    - TURN 2: IMPLEMENTATION (Wait for user to say "Yes" or "Ready")
      - MODE: code
      - LANGUAGE: <specify language>
      - CLEAR_BOARD: true
      - Follow the "Live Coding Flow" below.

  - SIMPLE PROBLEMS (e.g., basic syntax, simple functions, CSS tweaks, one-liners):
    - Skip the whiteboard algorithm.
    - Go DIRECTLY to the code editor in a SINGLE TURN.
    - MODE: code
    - LANGUAGE: <specify language>
    - CLEAR_BOARD: true
    - Follow the "Live Coding Flow" below.

  Live Coding Flow (for MODE: code):
  1. Keep it Simple: Do not over-explain simple concepts. Keep explanations brief and to the point.
  2. Objective First: Start with a step where you write the aim/question as a comment at the top of the board. Speak the aim clearly while writing it.
  3. Introduce code line-by-line.
     For EVERY SINGLE LINE or logical chunk, follow this sequence:
     - STEP A (Comment): Write the comment explaining the goal of the next line.
     - STEP B (Code): Write the actual code line.
     - STEP C... (Post-Line Explanations): IMMEDIATELY after writing the line, generate separate steps to highlight and explain specific parts of THAT line.
       - Leave WRITTEN empty for these steps (so the board doesn't change).
       - Use HIGHLIGHT to select specific functions, variables, or operators (e.g. "input", "print", "=", "a").
       - Speak a specific explanation for that highlighted part.
     
     Repeat this sequence for every line.
     CRITICAL: Do not move to the next line until the typing and speaking for the current step are finished. The system handles this, but you must provide the steps in the correct order.
  4. Sequential Logic: Always follow the Input -> Processing -> Output flow.
  5. The "Pitfall & Pivot": Identify common beginner mistakes briefly. Do this as a spoken-only step (leave WRITTEN empty) before writing the tricky code.
  6. Verification: Conclude the lesson by showing a dry run or example of the code in action with sample numbers. This should be a spoken-only step (leave WRITTEN empty).

If CLEAR_BOARD is false (follow-up question):
- Do NOT rewrite the existing code.
- Provide the explanation in spokenText.
- Leave whiteboardText EMPTY unless you are adding new code.
- Use the HIGHLIGHT field to select the exact existing text/code you are explaining. This is CRITICAL for follow-up questions.
- Use PERMANENT_HIGHLIGHT if the user asks to re-explain a point or emphasizes something.

Format your response EXACTLY like this example:
CHAT_ACTION: Good
MODE: code
LANGUAGE: python
CLEAR_BOARD: true
===STEP===
SPOKEN: Our aim is to add two numbers.
WRITTEN: # Aim: Add two numbers
DIAGRAM_PROMPT: 
HIGHLIGHT: 
PERMANENT_HIGHLIGHT: 
===STEP===
...
`,
        },
      ];

      if (capturedImage) {
        // Remove data URL prefix
        const base64Data = capturedImage.split(",")[1];
        parts.push({
          inlineData: {
            mimeType: "image/jpeg",
            data: base64Data,
          },
        });
      }

      const currentSessionId = sessionIdRef.current;

      const responseStream = await ai.models.generateContentStream({
        model: selectedModel,
        contents: [{ role: "user", parts: parts }],
      });

      let fullText = "";
      let chatActionParsed = false;
      let modeParsed = false;
      let languageParsed = false;
      let clearBoardParsed = false;

      setAwaitingConfirmation(false);

      const parseStep = (block: string) => {
        const spokenMatch = block.match(
          /SPOKEN:\s*(.*?)(?=WRITTEN:|DIAGRAM_PROMPT:|HIGHLIGHT:|PERMANENT_HIGHLIGHT:|$)/s,
        );
        const writtenMatch = block.match(
          /WRITTEN:\s*(.*?)(?=DIAGRAM_PROMPT:|HIGHLIGHT:|PERMANENT_HIGHLIGHT:|$)/s,
        );
        const diagramPromptMatch = block.match(
          /DIAGRAM_PROMPT:\s*(.*?)(?=HIGHLIGHT:|PERMANENT_HIGHLIGHT:|$)/s,
        );
        const highlightMatch = block.match(
          /HIGHLIGHT:\s*(.*?)(?=PERMANENT_HIGHLIGHT:|$)/s,
        );
        const permHighlightMatch = block.match(
          /PERMANENT_HIGHLIGHT:\s*(.*?)$/s,
        );

        if (!spokenMatch) return null;

        let diagramPrompt = diagramPromptMatch
          ? diagramPromptMatch[1].trim()
          : undefined;

        let drawings: Drawing[] = [];

        let whiteboardText = writtenMatch ? writtenMatch[1].trim() : "";
        // Strip any accidental XML tags the AI might hallucinate
        whiteboardText = whiteboardText.replace(
          /<\/?(PERMANENT_HIGHLIGHT|HIGHLIGHT)>/gi,
          "",
        );

        let permHighlight = permHighlightMatch
          ? permHighlightMatch[1].trim()
          : "";
        permHighlight = permHighlight.replace(
          /<\/?(PERMANENT_HIGHLIGHT|HIGHLIGHT)>/gi,
          "",
        );

        let highlight = highlightMatch ? highlightMatch[1].trim() : "";
        highlight = highlight.replace(
          /<\/?(PERMANENT_HIGHLIGHT|HIGHLIGHT)>/gi,
          "",
        );

        return {
          spokenText: spokenMatch[1].trim(),
          whiteboardText,
          highlightText: highlight,
          permanentHighlight: permHighlight,
          drawings,
          diagramPrompt,
        };
      };

      for await (const chunk of responseStream) {
        if (currentSessionId !== sessionIdRef.current) {
          console.log("Session changed, aborting stream processing.");
          return;
        }

        fullText += chunk.text;

        if (!chatActionParsed) {
          const actionMatch = fullText.match(/CHAT_ACTION:\s*(.*?)(?=\n|$)/i);
          if (actionMatch) {
            const action = actionMatch[1].trim();
            setMessages((prev) => [...prev, { role: "ai", text: action }]);
            chatActionParsed = true;
          }
        }

        if (!modeParsed) {
          const modeMatch = fullText.match(/MODE:\s*(whiteboard|code)/i);
          if (modeMatch) {
            setPresentationMode(
              modeMatch[1].toLowerCase() as "whiteboard" | "code",
            );
            modeParsed = true;
          }
        }

        if (!languageParsed) {
          const langMatch = fullText.match(/LANGUAGE:\s*([a-zA-Z0-9_-]+)/i);
          if (langMatch) {
            const lang = langMatch[1].toLowerCase();
            if (lang !== "none") {
              setCodeLanguage(lang);
            }
            languageParsed = true;
          }
        }

        if (!clearBoardParsed) {
          const clearMatch = fullText.match(/CLEAR_BOARD:\s*(true|false)/i);
          if (clearMatch) {
            const shouldClear = clearMatch[1].toLowerCase() === "true";
            if (
              shouldClear &&
              (whiteboardText.trim() || currentDrawings.length > 0)
            ) {
              setSlideHistory((prev) => [
                ...prev,
                {
                  id: Date.now().toString(),
                  mode: presentationMode,
                  text: whiteboardText,
                  drawings: currentDrawings,
                  diagrams: currentDiagrams,
                  image: currentImage,
                  language: codeLanguage,
                  permanentHighlights: permanentHighlights,
                },
              ]);
            }
            clearBoardRef.current = shouldClear;
            clearBoardParsed = true;
          }
        }

        const stepBlocks = fullText.split("===STEP===");
        if (stepBlocks.length > 1) {
          const completeSteps: any[] = [];
          for (let i = 1; i < stepBlocks.length - 1; i++) {
            const step = parseStep(stepBlocks[i].trim());
            if (step) {
              // Strictly separate writing and drawing if AI accidentally combines them
              if (
                step.whiteboardText &&
                step.drawings &&
                step.drawings.length > 0
              ) {
                completeSteps.push({ ...step, drawings: [] });
                completeSteps.push({
                  spokenText: "",
                  whiteboardText: "",
                  highlightText: "",
                  permanentHighlight: "",
                  drawings: step.drawings,
                });
              } else {
                completeSteps.push(step);
              }
            }
          }

          if (completeSteps.length > 0) {
            setSteps(completeSteps);
            setIsProcessing(false);
          }
        }
      }

      if (currentSessionId !== sessionIdRef.current) return;

      const finalStepBlocks = fullText.split("===STEP===");
      const finalSteps: any[] = [];
      for (let i = 1; i < finalStepBlocks.length; i++) {
        const step = parseStep(finalStepBlocks[i].trim());
        if (step) {
          if (
            step.whiteboardText &&
            step.drawings &&
            step.drawings.length > 0
          ) {
            finalSteps.push({ ...step, drawings: [] });
            finalSteps.push({
              spokenText: "",
              whiteboardText: "",
              highlightText: "",
              permanentHighlight: "",
              drawings: step.drawings,
            });
          } else {
            finalSteps.push(step);
          }
        }
      }

      if (finalSteps.length > 0) {
        setSteps(finalSteps);

        const lastStep = finalSteps[finalSteps.length - 1];
        if (
          lastStep.spokenText &&
          (lastStep.spokenText.toLowerCase().includes("shall i write") ||
            lastStep.spokenText.toLowerCase().includes("whiteboard"))
        ) {
          setAwaitingConfirmation(true);
        }

        const responseSummary = finalSteps.map((s) => s.spokenText).join(" ");
        setSessionHistory((prev) => [
          ...prev,
          {
            timestamp: new Date().toLocaleTimeString(),
            query: query,
            response:
              responseSummary.substring(0, 100) +
              (responseSummary.length > 100 ? "..." : ""),
          },
        ]);
      }

      setIsProcessing(false);
    } catch (error: any) {
      if (
        error?.type === "cancelation" ||
        error?.message?.includes("canceled")
      ) {
        console.log("AI request was canceled or aborted.");
        setIsProcessing(false);
        return;
      }
      console.error("Error generating response:", error);
      setSteps([
        {
          spokenText: "Sorry, an error occurred while processing your request.",
          whiteboardText: "Error.",
        },
      ]);
      setIsProcessing(false);
    }
  };

  handleSendMessageRef.current = handleSendMessage;

  const handleWritingComplete = () => {
    setStepWritingComplete(true);
  };

  const handleEndCall = async () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    const highestId = window.setTimeout(() => {}, 0);
    for (let i = 0; i < highestId; i++) {
      window.clearTimeout(i);
    }

    setStepSpeakingComplete(true);
    setStepWritingComplete(true);
    setIsProcessing(false);
    setIsWriting(false);
    setMicOn(false);

    setCallEnded(true);
    onEndSession();
  };

  const generatePDF = async () => {
    setIsGeneratingPDF(true);

    // Give React a tick to render the hidden container
    setTimeout(async () => {
      try {
        let pdf: jsPDF | null = null;
        let pageAdded = false;

        // Function to safely add an image to PDF
        const addElementToPdf = async (el: HTMLElement) => {
          try {
            // Get full scroll height to capture everything
            const elHeight = Math.max(el.scrollHeight, 600);
            const padding = 40; // Add padding to the PDF page
            const contentWidth = 800;
            const contentHeight = elHeight;
            const pdfWidth = contentWidth + padding * 2;
            const pdfHeight = contentHeight + padding * 2;

            // html-to-image can sometimes fail with complex CSS, so we use a safe approach
            const dataUrl = await toPng(el, {
              backgroundColor: "#ffffff",
              width: contentWidth,
              height: contentHeight,
              style: {
                // Force standard colors to avoid oklch issues in the capture process
                color: "#000000",
                transform: "scale(1)", // Reset zoom for capture
                transformOrigin: "top left",
                padding: "20px", // Add internal padding to the element capture
              },
            });

            if (!pdf) {
              // Initialize PDF with padding dimensions
              pdf = new jsPDF({
                orientation: pdfHeight > pdfWidth ? "portrait" : "landscape",
                unit: "px",
                format: [pdfWidth, pdfHeight],
                compress: true,
              });
            } else {
              pdf.addPage(
                [pdfWidth, pdfHeight],
                pdfHeight > pdfWidth ? "portrait" : "landscape",
              );
              pdf.setPage(pdf.getNumberOfPages());
            }

            // Add image with padding offset
            // Use 'PNG' and quality to reduce size and avoid some parsing issues
            pdf.addImage(
              dataUrl,
              "PNG",
              padding,
              padding,
              contentWidth,
              contentHeight,
              undefined,
              "FAST",
            );

            // Add page border/structure
            pdf.setDrawColor(200, 200, 200);
            pdf.rect(
              padding - 10,
              padding - 10,
              contentWidth + 20,
              contentHeight + 20,
            );

            // Add footer with page number
            const pageCount = pdf.getNumberOfPages();
            pdf.setFontSize(10);
            pdf.setTextColor(100, 100, 100);
            pdf.text(`Page ${pageCount}`, pdfWidth / 2, pdfHeight - 15, {
              align: "center",
            });

            pageAdded = true;
          } catch (err) {
            console.error("Error capturing element for PDF:", err);
          }
        };

        // First, capture all historical slides
        for (let i = 0; i < slideHistory.length; i++) {
          const element = document.getElementById(`pdf-slide-${i}`);
          if (element) {
            await addElementToPdf(element);
          }
        }

        // Then capture the current board
        const currentElement = document.getElementById(
          presentationMode === "code"
            ? "codeboard-content"
            : "whiteboard-content",
        );
        if (
          currentElement &&
          (whiteboardText.trim() || currentDrawings.length > 0)
        ) {
          const originalBg = currentElement.style.backgroundColor;
          currentElement.style.backgroundColor = "#ffffff";

          await addElementToPdf(currentElement);

          currentElement.style.backgroundColor = originalBg;
        }

        if (pdf && pageAdded) {
          pdf.save("class-notes.pdf");
        } else {
          alert("No content to save.");
        }
      } catch (error) {
        console.error("Error generating PDF:", error);
        alert("Failed to generate PDF notes. Please try again.");
      } finally {
        setIsGeneratingPDF(false);
      }
    }, 100);
  };

  if (callEnded) {
    return (
      <div className="h-screen w-full bg-[#202124] flex flex-col items-center justify-center font-sans">
        <h1 className="text-4xl text-white mb-8">You left the meeting</h1>
        <div className="flex flex-col gap-4 items-center">
          <div className="flex gap-4 mb-8">
            <button
              onClick={generatePDF}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-md font-medium transition-colors flex items-center gap-2"
            >
              <Download className="w-5 h-5" />
              Download Class Notes (PDF)
            </button>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors"
            >
              Rejoin
            </button>
            <button
              onClick={onEndSession}
              className="px-6 py-2 bg-transparent hover:bg-[#3c4043] text-blue-400 rounded-md font-medium transition-colors"
            >
              Return to home screen
            </button>
          </div>
        </div>

        <div className="absolute top-0 left-0 -z-50 opacity-0 pointer-events-none">
          {whiteboardText.length > 0 && (
            <Whiteboard
              text={whiteboardText}
              isWriting={false}
              onWritingComplete={() => {}}
              typingSpeed={0}
              highlightText=""
              permanentHighlights={permanentHighlights}
              drawings={currentDrawings}
              diagrams={currentDiagrams}
              image={currentImage}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-[#202124] flex flex-col font-sans overflow-hidden">
      <div className="flex-1 flex p-2 md:p-4 pb-0 overflow-hidden relative">
        <div className="flex-1 h-full relative flex flex-col md:flex-row gap-4">
          {presentationMode !== "none" && (
            <div className="flex-[3] h-full relative transition-all duration-500 ease-in-out group">
              {presentationMode === "whiteboard" ? (
                <Whiteboard
                  text={whiteboardText}
                  isWriting={isWriting}
                  onWritingComplete={handleWritingComplete}
                  typingSpeed={typingSpeed}
                  syncProgress={speechProgress}
                  highlightText={currentHighlight}
                  permanentHighlights={permanentHighlights}
                  drawings={currentDrawings}
                  diagrams={currentDiagrams}
                  image={currentImage}
                />
              ) : (
                <CodeBoard
                  text={whiteboardText}
                  isWriting={isWriting}
                  onWritingComplete={handleWritingComplete}
                  expectedDuration={expectedDuration}
                  syncProgress={speechProgress}
                  highlightText={currentHighlight}
                  language={codeLanguage}
                />
              )}

              {/* Floating Download Button */}
              <button
                onClick={generatePDF}
                disabled={isGeneratingPDF || !whiteboardText}
                className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-lg text-gray-800 hover:text-black transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 shadow-lg"
                title="Download as PDF"
              >
                <Download className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          )}

          <div
            className={`flex gap-4 transition-all duration-500 ease-in-out ${
              presentationMode !== "none"
                ? "flex-row md:flex-col h-auto md:h-full flex-1 md:max-w-[300px]"
                : "flex-col md:flex-row flex-1 justify-center items-center"
            }`}
          >
            <div
              className={`relative bg-[#3c4043] rounded-xl overflow-hidden shadow-lg aspect-video flex-1 border border-gray-700 flex items-center justify-center ${
                presentationMode !== "none"
                  ? "max-h-[150px] md:max-h-[50%]"
                  : "max-w-full md:max-w-2xl w-full"
              }`}
            >
              <div
                className={`w-24 h-24 rounded-full bg-blue-500 flex items-center justify-center ${isProcessing || currentStepIndex >= 0 ? "animate-pulse" : ""}`}
              >
                <MonitorUp size={40} className="text-white" />
              </div>
              <div className="absolute bottom-3 left-3 bg-black/50 px-2 py-1 rounded text-sm text-white">
                AI Teacher
              </div>
            </div>

            <div
              className={`relative bg-[#3c4043] rounded-xl overflow-hidden shadow-lg aspect-video flex-1 border border-gray-700 ${
                presentationMode !== "none"
                  ? "max-h-[150px] md:max-h-[50%]"
                  : "max-w-full md:max-w-2xl w-full"
              }`}
            >
              {videoOn ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover transform scale-x-[-1]"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="w-20 h-20 rounded-full bg-gray-600 flex items-center justify-center">
                    <VideoOff size={32} className="text-gray-400" />
                  </div>
                </div>
              )}
              <div className="absolute bottom-3 left-3 bg-black/50 px-2 py-1 rounded text-sm text-white">
                You
              </div>
            </div>

            {screenShareOn && (
              <div
                className={`relative bg-[#3c4043] rounded-xl overflow-hidden shadow-lg aspect-video flex-1 border border-gray-700 ${
                  presentationMode !== "none"
                    ? "max-h-[150px] md:max-h-[50%]"
                    : "max-w-full md:max-w-2xl w-full"
                }`}
              >
                <video
                  ref={screenVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-contain"
                />
                <div className="absolute bottom-3 left-3 bg-black/50 px-2 py-1 rounded text-sm text-white">
                  Your Screen
                </div>
              </div>
            )}
          </div>

          {ccOn && whiteboardText && (
            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-black/70 text-white px-6 py-3 rounded-lg max-w-2xl text-center z-20 backdrop-blur-sm">
              {whiteboardText}
            </div>
          )}

          {isGeneratingPDF && (
            <div className="absolute inset-0 bg-black/50 backdrop-blur-md rounded-xl flex items-center justify-center z-50">
              <div className="bg-[#202124] border border-gray-700 px-6 py-3 rounded-full shadow-lg flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-white font-medium">
                  Saving class notes...
                </span>
              </div>
            </div>
          )}
        </div>

        {isChatOpen && (
          <div className="absolute right-0 top-0 bottom-0 w-full sm:w-96 md:w-[400px] z-50 shadow-2xl transition-transform duration-300 ease-in-out">
            <ChatPanel
              onSendMessage={handleSendMessage}
              onClose={() => setIsChatOpen(false)}
              disabled={false}
              messages={messages}
            />
          </div>
        )}
      </div>

      <div className="h-auto min-h-20 w-full flex flex-wrap items-center justify-between px-4 py-3 gap-y-4">
        <div className="flex items-center gap-4 text-white w-full md:w-1/4 justify-center md:justify-start">
          <span className="text-lg font-medium">AI Classroom</span>
        </div>

        <div className="flex items-center gap-2 md:gap-3 w-full md:w-2/4 justify-center flex-wrap relative">
          <AudioVisualizer stream={stream} isListening={micOn} />
          <button
            onClick={toggleMic}
            className={`p-3 rounded-full ${micOn ? "bg-red-600 hover:bg-red-700 animate-pulse" : "bg-[#3c4043] hover:bg-[#4d5155]"} text-white transition-colors relative`}
            title={micOn ? "Stop Listening" : "Start Voice Control"}
          >
            {micOn ? (
              <Mic className="w-5 h-5" />
            ) : (
              <MicOff className="w-5 h-5" />
            )}
          </button>
          <button
            onClick={toggleVideo}
            className={`p-3 rounded-full ${videoOn ? "bg-[#3c4043] hover:bg-[#4d5155]" : "bg-[#ea4335] hover:bg-[#f25c50]"} text-white transition-colors`}
          >
            {videoOn ? (
              <Video className="w-5 h-5" />
            ) : (
              <VideoOff className="w-5 h-5" />
            )}
          </button>
          <button
            onClick={() => setCcOn(!ccOn)}
            className={`hidden sm:block p-3 rounded-full ${ccOn ? "bg-blue-100 text-blue-600" : "bg-[#3c4043] hover:bg-[#4d5155] text-white"} transition-colors`}
          >
            <ClosedCaption className="w-5 h-5" />
          </button>
          <button
            onClick={generatePDF}
            className={`p-3 rounded-full ${isGeneratingPDF ? "bg-green-600 animate-pulse" : "bg-[#3c4043] hover:bg-[#4d5155]"} text-white transition-colors`}
            title="Download Merged Notes"
            disabled={
              isGeneratingPDF || (!whiteboardText && slideHistory.length === 0)
            }
          >
            <Download className="w-5 h-5" />
          </button>
          <button
            onClick={() => setHandRaised(!handRaised)}
            className={`hidden sm:block p-3 rounded-full ${handRaised ? "bg-blue-100 text-blue-600" : "bg-[#3c4043] hover:bg-[#4d5155] text-white"} transition-colors`}
          >
            <Hand className="w-5 h-5" />
          </button>

          <button
            onClick={toggleScreenShare}
            className={`hidden md:block p-3 rounded-full ${screenShareOn ? "bg-blue-600 hover:bg-blue-700 animate-pulse" : "bg-[#3c4043] hover:bg-[#4d5155]"} text-white transition-colors`}
            title={screenShareOn ? "Stop Sharing Screen" : "Share Screen"}
          >
            <MonitorUp className="w-5 h-5" />
          </button>
          <button className="hidden sm:block p-3 rounded-full bg-[#3c4043] hover:bg-[#4d5155] text-white transition-colors">
            <MoreVertical className="w-5 h-5" />
          </button>
          <button
            onClick={handleEndCall}
            className="p-3 rounded-full bg-[#ea4335] hover:bg-[#f25c50] text-white transition-colors px-6"
          >
            <PhoneOff className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-3 w-full md:w-1/4 justify-center md:justify-end">
          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`p-2 rounded-full transition-colors ${isChatOpen ? "bg-blue-100 text-blue-600" : "hover:bg-[#3c4043] text-white"}`}
          >
            <MessageSquare className="w-5 h-5" />
          </button>

          <div className="relative group">
            <button className="p-2 rounded-full hover:bg-[#3c4043] text-white transition-colors">
              <Info className="w-5 h-5" />
            </button>
            <div className="absolute bottom-full right-0 mb-2 w-64 bg-white rounded-lg shadow-xl p-4 hidden group-hover:block z-50">
              <h3 className="font-bold text-gray-800 mb-2 border-b pb-1">
                Session History
              </h3>
              <div className="max-h-60 overflow-y-auto text-sm">
                {sessionHistory.length === 0 ? (
                  <p className="text-gray-500 italic">No interactions yet.</p>
                ) : (
                  sessionHistory.map((item, i) => (
                    <div
                      key={i}
                      className="mb-3 border-b border-gray-100 pb-2 last:border-0"
                    >
                      <div className="text-xs text-gray-400">
                        {item.timestamp}
                      </div>
                      <div className="font-medium text-blue-600 truncate">
                        {item.query}
                      </div>
                      <div className="text-gray-600 text-xs truncate">
                        {item.response}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          <button className="hidden lg:block p-2 rounded-full hover:bg-[#3c4043] text-white transition-colors">
            <Shapes className="w-5 h-5" />
          </button>
          <button className="hidden lg:block p-2 rounded-full hover:bg-[#3c4043] text-white transition-colors">
            <Lock className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Hidden container for rendering historical slides for PDF export */}
      {isGeneratingPDF && slideHistory.length > 0 && (
        <div className="absolute top-[-9999px] left-0 pointer-events-none z-[-100]">
          {slideHistory.map((slide, i) => (
            <div
              key={i}
              id={`pdf-slide-${i}`}
              className="w-[800px] h-auto min-h-[600px] bg-[#ffffff] p-8"
            >
              {slide.mode === "whiteboard" ? (
                <Whiteboard
                  text={slide.text}
                  isWriting={false}
                  onWritingComplete={() => {}}
                  typingSpeed={0}
                  permanentHighlights={slide.permanentHighlights}
                  drawings={slide.drawings}
                  diagrams={slide.diagrams}
                  image={slide.image}
                  immediateDraw={true}
                  isPdfMode={true}
                />
              ) : slide.mode === "code" ? (
                <CodeBoard
                  text={slide.text}
                  isWriting={false}
                  onWritingComplete={() => {}}
                  expectedDuration={0}
                  language={slide.language}
                  immediateDraw={true}
                  isPdfMode={true}
                />
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
