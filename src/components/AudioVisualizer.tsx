import { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  stream: MediaStream | null;
  isListening: boolean;
}

export default function AudioVisualizer({ stream, isListening }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  
  useEffect(() => {
    if (!stream || !isListening || !canvasRef.current) return;

    let audioContext: AudioContext | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let analyser: AnalyserNode | null = null;

    try {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      source = audioContext.createMediaStreamSource(stream);
      analyser = audioContext.createAnalyser();
      
      analyser.fftSize = 32; // Low resolution for simple bars
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      const canvas = canvasRef.current;
      const canvasCtx = canvas.getContext('2d');
      if (!canvasCtx) return;

      const draw = () => {
        if (!isListening || !analyser) return;
        
        animationRef.current = requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);

        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw centered bars
        const barWidth = 4;
        const gap = 2;
        const totalWidth = bufferLength * (barWidth + gap);
        let x = (canvas.width - totalWidth) / 2;

        for (let i = 0; i < bufferLength; i++) {
          // Normalize value
          const value = dataArray[i];
          const percent = value / 255;
          const height = Math.max(4, percent * canvas.height); // Min height 4px
          
          // Color based on volume
          const hue = 0; // Red
          const saturation = 100;
          const lightness = 50 + (percent * 20); // Brighter when louder
          
          canvasCtx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
          
          // Draw rounded bar
          const y = (canvas.height - height) / 2;
          
          // Draw rounded rect manually or just rect
          canvasCtx.beginPath();
          if (canvasCtx.roundRect) {
            canvasCtx.roundRect(x, y, barWidth, height, 2);
          } else {
            canvasCtx.rect(x, y, barWidth, height);
          }
          canvasCtx.fill();

          x += barWidth + gap;
        }
      };

      draw();
    } catch (e) {
      console.error("Audio visualizer error:", e);
    }

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close();
      }
    };
  }, [stream, isListening]);

  if (!isListening) return null;

  return (
    <div className="absolute -top-16 left-1/2 transform -translate-x-1/2 bg-[#202124]/90 backdrop-blur-md px-4 py-2 rounded-full flex items-center gap-3 shadow-xl border border-white/10 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4">
      <div className="relative flex items-center justify-center w-3 h-3">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
      </div>
      <span className="text-white text-sm font-medium tracking-wide">Listening</span>
      <canvas ref={canvasRef} width={100} height={24} className="opacity-90" />
    </div>
  );
}
