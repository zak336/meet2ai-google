import { useState, useRef, useEffect } from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";

interface PreJoinPageProps {
  isActive: boolean;
  onJoin: () => void;
  onBack: () => void;
}

export default function PreJoinPage({
  isActive,
  onJoin,
  onBack,
}: PreJoinPageProps) {
  const [micOn, setMicOn] = useState(false);
  const [videoOn, setVideoOn] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
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

  // Replace the initMedia effect with this:
  useEffect(() => {
    if (!isActive) return;

    let localStream: MediaStream | null = null;

    const initMedia = async () => {
      try {
        setError(null);
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        localStream = newStream;
        setStream(newStream);
        setMicOn(true);
        setVideoOn(true);
        // Don't set srcObject here — let the separate effect below handle it
      } catch (e: any) {
        // ... your existing error handling
      }
    };

    initMedia();

    return () => {
      localStream?.getTracks().forEach((track) => track.stop()); // ✅ uses local ref, not stale state
      setStream(null);
      setMicOn(false);
      setVideoOn(false);
    };
  }, [isActive]);

  // Add a dedicated effect to sync stream → video element
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, videoOn]); // re-runs when stream is set OR video is toggled back on

  const toggleMic = () => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !micOn;
        setMicOn(!micOn);
      }
    }
  };

  const toggleVideo = () => {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoOn;
        setVideoOn(!videoOn);
      }
    }
  };

  return (
    <div className="pj-container">
      <div className="pj-wrap">
        <div className={`pj-eyebrow ${visible ? "show" : ""}`}>
          <span className="pj-eyebrow-dot" />
          meet2ai · Join Class
        </div>

        <h2 className={`pj-headline ${visible ? "show" : ""}`}>
          Ready to <em>begin</em>?
        </h2>

        <p className={`pj-body ${visible ? "show" : ""}`}>
          You are about to enter the AI Classroom. Check your audio and video
          settings before joining.
        </p>

        <div className={`pj-divider ${visible ? "show" : ""}`} />

        {/* Preview Container */}
        <div className={`pj-preview ${visible ? "show" : ""}`}>
          <div className="pj-preview-label">Preview</div>
          <div className="pj-preview-window">
            <div className="pj-preview-bar">
              <div
                className="pj-preview-dot"
                style={{ background: "#ff5f57" }}
              />
              <div
                className="pj-preview-dot"
                style={{ background: "#febc2e" }}
              />
              <div
                className="pj-preview-dot"
                style={{ background: "#28c840" }}
              />
            </div>

            {error ? (
              <div className="pj-error">
                <VideoOff size={48} className="pj-error-icon" />
                <p className="pj-error-title">Media Access Error</p>
                <p className="pj-error-text">{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="pj-error-btn"
                >
                  Retry
                </button>
              </div>
            ) : videoOn ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="pj-video"
              />
            ) : (
              <div className="pj-video-off">
                <div className="pj-video-off-avatar">
                  <VideoOff size={40} className="pj-video-off-icon" />
                </div>
              </div>
            )}

            {!error && (
              <div className="pj-controls">
                <button
                  onClick={toggleMic}
                  className={`pj-control-btn ${micOn ? "" : "off"}`}
                  title={micOn ? "Mute microphone" : "Unmute microphone"}
                >
                  {micOn ? <Mic size={20} /> : <MicOff size={20} />}
                </button>
                <button
                  onClick={toggleVideo}
                  className={`pj-control-btn ${videoOn ? "" : "off"}`}
                  title={videoOn ? "Turn off camera" : "Turn on camera"}
                >
                  {videoOn ? <Video size={20} /> : <VideoOff size={20} />}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Join Button */}
        <button
          onClick={() => {
            // Stop local preview stream before joining so the main app can take over
            if (stream) {
              stream.getTracks().forEach((track) => track.stop());
            }
            onJoin();
          }}
          className={`pj-join-btn ${visible ? "show" : ""}`}
        >
          Join Class Now
          <ArrowRight size={16} strokeWidth={2} />
        </button>

        <button className={`pj-back ${visible ? "show" : ""}`} onClick={onBack}>
          <ArrowLeft size={14} strokeWidth={2} />
          Back
        </button>
      </div>
    </div>
  );
}
