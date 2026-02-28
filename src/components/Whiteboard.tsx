import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

export interface Drawing {
  type?: 'rect' | 'circle' | 'ellipse' | 'line' | 'arrow' | 'text' | 'path';
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  x2?: number;
  y2?: number;
  text?: string;
  d?: string; // For raw paths
  stroke?: string;
  strokeWidth?: number;
  fill?: string;
  fontSize?: number;
}

interface WhiteboardProps {
  text: string;
  isWriting: boolean;
  onWritingComplete: () => void;
  typingSpeed: number;
  highlightText?: string;
  permanentHighlights?: string[];
  drawings?: Drawing[];
  diagrams?: Drawing[][];
  image?: string | null;
  immediateDraw?: boolean;
  syncProgress?: number;
  isPdfMode?: boolean;
}

interface ProcessedElement {
  d?: string;
  stroke?: string;
  strokeWidth?: number;
  fill?: string;
  length?: number;
  isText: boolean;
  text?: string;
  x?: number;
  y?: number;
  fontSize?: number;
}



export default function Whiteboard({ text, isWriting, onWritingComplete, typingSpeed, highlightText, permanentHighlights = [], drawings = [], diagrams = [], image, immediateDraw = false, syncProgress = 0, isPdfMode = false }: WhiteboardProps) {
  const [revealedChars, setRevealedChars] = useState(0);
  const cursorRef = useRef<HTMLSpanElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const highlightSpansRef = useRef<(HTMLSpanElement | null)[]>([]);
  const permanentHighlightSpansRef = useRef<(HTMLSpanElement | null)[]>([]);
  const [penPos, setPenPos] = useState({ x: 0, y: 0 });
  const prevTextRef = useRef(text);
  const [zoom, setZoom] = useState(1);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.1, 2));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.1, 0.5));
  const handleResetZoom = () => setZoom(1);
  
  const hiddenPathRef = useRef<SVGPathElement>(null);
  const [processedElements, setProcessedElements] = useState<ProcessedElement[]>([]);
  const [isDrawingCanvas, setIsDrawingCanvas] = useState(false);
  const [drawingProgress, setDrawingProgress] = useState(0);
  
  // Synchronization State
  const [completedDiagrams, setCompletedDiagrams] = useState<Set<number>>(new Set());
  const [activeDiagramIndex, setActiveDiagramIndex] = useState<number | null>(null);

  const [isPenMoving, setIsPenMoving] = useState(false);
  const lastRevealedCharsRef = useRef(0);

  useEffect(() => {
    if (revealedChars !== lastRevealedCharsRef.current) {
      setIsPenMoving(true);
      // Increased timeout to prevent pen from stopping animation during short pauses
      const timer = setTimeout(() => setIsPenMoving(false), 300);
      lastRevealedCharsRef.current = revealedChars;
      return () => clearTimeout(timer);
    }
  }, [revealedChars]);

  // Helper to process a set of drawings into SVG elements
  const processDrawings = (draws: Drawing[]) => {
    const elements: ProcessedElement[] = [];
    const tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    
    draws.forEach(d => {
      if (d.type === 'text') {
        elements.push({ isText: true, text: d.text, x: d.x, y: d.y, fontSize: d.fontSize, fill: d.fill || 'black' });
        return;
      }
      
      const processPath = (pathString: string, stroke: string, strokeWidth: number, fill: string) => {
        tempPath.setAttribute('d', pathString);
        let length = 0;
        try {
          length = tempPath.getTotalLength();
        } catch (e) {
          // Ignore errors if path is invalid
        }
        elements.push({ isText: false, d: pathString, stroke, strokeWidth, fill, length });
      };

      if (d.d) {
        processPath(d.d, d.stroke || 'black', d.strokeWidth || 2, d.fill || 'none');
        return;
      }

      const stroke = d.stroke || 'black';
      const strokeWidth = d.strokeWidth || 2;
      const fill = d.fill || 'none';

      try {
        switch (d.type) {
          case 'rect':
            processPath(`M${d.x || 0} ${d.y || 0} h${d.width || 100} v${d.height || 50} h-${d.width || 100} Z`, stroke, strokeWidth, fill);
            break;
          case 'circle':
            const r = (d.width || 50) / 2;
            processPath(`M ${d.x || 0} ${(d.y || 0) - r} a ${r} ${r} 0 1 0 0 ${r * 2} a ${r} ${r} 0 1 0 0 ${-r * 2}`, stroke, strokeWidth, fill);
            break;
          case 'ellipse':
            const rx = (d.width || 100) / 2;
            const ry = (d.height || 50) / 2;
            processPath(`M ${d.x || 0} ${(d.y || 0) - ry} a ${rx} ${ry} 0 1 0 0 ${ry * 2} a ${rx} ${ry} 0 1 0 0 ${-ry * 2}`, stroke, strokeWidth, fill);
            break;
          case 'line':
            processPath(`M${d.x || 0} ${d.y || 0} L${d.x2 || 100} ${d.y2 || 100}`, stroke, strokeWidth, fill);
            break;
          case 'arrow':
            const ax1 = d.x || 0; const ay1 = d.y || 0; const ax2 = d.x2 || 100; const ay2 = d.y2 || 100;
            const angle = Math.atan2(ay2 - ay1, ax2 - ax1);
            const headLen = 15;
            const p1x = ax2 - headLen * Math.cos(angle - Math.PI / 6);
            const p1y = ay2 - headLen * Math.sin(angle - Math.PI / 6);
            const p2x = ax2 - headLen * Math.cos(angle + Math.PI / 6);
            const p2y = ay2 - headLen * Math.sin(angle + Math.PI / 6);
            processPath(`M${ax1} ${ay1} L${ax2} ${ay2}`, stroke, strokeWidth, 'none');
            processPath(`M${ax2} ${ay2} L${p1x} ${p1y}`, stroke, strokeWidth, 'none');
            processPath(`M${ax2} ${ay2} L${p2x} ${p2y}`, stroke, strokeWidth, 'none');
            break;
        }
      } catch (e) {}
    });
    return elements;
  };

  // Memoize processed diagrams to avoid recalculating path lengths on every render frame
  const processedDiagrams = React.useMemo(() => {
    return diagrams.map(diagramDrawings => processDrawings(diagramDrawings));
  }, [diagrams]);

  // Process current drawings into SVG elements (Fallback for single diagram mode)
  useEffect(() => {
    if (!drawings || drawings.length === 0) {
      setProcessedElements([]);
      if (diagrams.length === 0) {
          setIsDrawingCanvas(false);
          setDrawingProgress(0);
      }
      return;
    }

    const newElements = processDrawings(drawings);
    setProcessedElements(newElements);
    // Only auto-start drawing if not using the new synchronization system
    if (diagrams.length === 0) {
        setIsDrawingCanvas(true);
        setDrawingProgress(0);
    }
  }, [drawings, diagrams.length]);

  const isWritingRef = useRef(isWriting);
  const revealedCharsRef = useRef(revealedChars);
  const isPenMovingRef = useRef(isPenMoving);

  useEffect(() => {
    isWritingRef.current = isWriting;
    revealedCharsRef.current = revealedChars;
  }, [isWriting, revealedChars]);

  useEffect(() => {
    isPenMovingRef.current = isPenMoving;
  }, [isPenMoving]);

  // SVG Animation Loop
  useEffect(() => {
    // Determine which elements to animate
    let elementsToAnimate: ProcessedElement[] = [];
    
    if (activeDiagramIndex !== null && processedDiagrams[activeDiagramIndex]) {
        elementsToAnimate = processedDiagrams[activeDiagramIndex];
    } else if (isDrawingCanvas && processedElements.length > 0) {
        elementsToAnimate = processedElements;
    } else {
        return;
    }

    if (elementsToAnimate.length === 0) {
        // Empty diagram, mark as complete immediately
        if (activeDiagramIndex !== null) {
            setCompletedDiagrams(prev => new Set(prev).add(activeDiagramIndex));
            setActiveDiagramIndex(null);
        }
        setIsDrawingCanvas(false);
        return;
    }
    
    if (immediateDraw) {
      setDrawingProgress(elementsToAnimate.length);
      if (activeDiagramIndex !== null) {
          setCompletedDiagrams(prev => new Set(prev).add(activeDiagramIndex));
          setActiveDiagramIndex(null);
      }
      setIsDrawingCanvas(false);
      return;
    }

    let animationFrameId: number;
    let startTimestamp: number | null = null;
    const DURATION = 500; // ms per element

    const render = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const elapsed = timestamp - startTimestamp;
      
      const currentElementIndex = Math.floor(elapsed / DURATION);
      const elementProgress = (elapsed % DURATION) / DURATION;
      
      const totalProgress = currentElementIndex + elementProgress;
      
      // Only update pen position from diagram animation if we are NOT currently writing text
      // We use refs to get the latest state inside the loop
      // If pen is moving (writing text), prioritize text. If pen stops moving (waiting for voice), allow diagram drawing.
      const isWritingText = isWritingRef.current && revealedCharsRef.current < text.length && isPenMovingRef.current;

      if (currentElementIndex < elementsToAnimate.length) {
        const currentEl = elementsToAnimate[currentElementIndex];
        // Update pen position
        if (!isWritingText && !currentEl.isText && currentEl.d && currentEl.length && hiddenPathRef.current) {
          if (hiddenPathRef.current.getAttribute('d') !== currentEl.d) {
            hiddenPathRef.current.setAttribute('d', currentEl.d);
          }
          try {
            const point = hiddenPathRef.current.getPointAtLength(currentEl.length * elementProgress);
            if (containerRef.current) {
              const svgId = activeDiagramIndex !== null ? `whiteboard-svg-${activeDiagramIndex}` : 'whiteboard-svg-0';
              const svgElement = document.getElementById(svgId);
              if (svgElement) {
                const svgRect = svgElement.getBoundingClientRect();
                const containerRect = containerRef.current.getBoundingClientRect();
                const scaleX = (svgRect.width / 800);
                const scaleY = (svgRect.height / 600);
                const screenX = ((point.x * scaleX) + (svgRect.left - containerRect.left)) / zoom;
                const screenY = ((point.y * scaleY) + (svgRect.top - containerRect.top)) / zoom;
                setPenPos({ x: screenX, y: screenY });
              }
            }
          } catch (e) {}
        } else if (!isWritingText && currentEl.isText && currentEl.x !== undefined && currentEl.y !== undefined) {
          if (containerRef.current) {
            const svgId = activeDiagramIndex !== null ? `whiteboard-svg-${activeDiagramIndex}` : 'whiteboard-svg-0';
            const svgElement = document.getElementById(svgId);
            if (svgElement) {
              const svgRect = svgElement.getBoundingClientRect();
              const containerRect = containerRef.current.getBoundingClientRect();
              const scaleX = (svgRect.width / 800);
              const scaleY = (svgRect.height / 600);
              const screenX = ((currentEl.x * scaleX) + (svgRect.left - containerRect.left)) / zoom;
              const screenY = ((currentEl.y * scaleY) + (svgRect.top - containerRect.top)) / zoom;
              setPenPos({ x: screenX, y: screenY });
            }
          }
        }
      }
      
      if (totalProgress >= elementsToAnimate.length) {
        setDrawingProgress(elementsToAnimate.length);
        if (activeDiagramIndex !== null) {
            setCompletedDiagrams(prev => new Set(prev).add(activeDiagramIndex));
            setActiveDiagramIndex(null);
        }
        setIsDrawingCanvas(false);
        return;
      }

      setDrawingProgress(totalProgress);
      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => cancelAnimationFrame(animationFrameId);
  }, [isDrawingCanvas, processedElements, immediateDraw, zoom, activeDiagramIndex, processedDiagrams, text.length]);

  useEffect(() => {
    if (text.length === 0) {
      setRevealedChars(0);
      setCompletedDiagrams(new Set());
      setActiveDiagramIndex(null);
    } else if (!isWriting) {
      setRevealedChars(text.length);
      // Mark all diagrams as complete if not writing
      const count = (text.match(/\[DIAGRAM\]/g) || []).length;
      setCompletedDiagrams(new Set(Array.from({length: count}, (_, i) => i)));
    } else if (isWriting) {
      if (!text.startsWith(prevTextRef.current)) {
        setRevealedChars(0);
        setCompletedDiagrams(new Set());
        setActiveDiagramIndex(null);
      }
    }
    prevTextRef.current = text;
  }, [text, isWriting]);

  useEffect(() => {
    if (!isWriting) {
      return;
    }
    
    // Note: We no longer pause text typing while a diagram is animating (activeDiagramIndex !== null).
    // This allows the text to flow naturally with the speech ("write while explaining") 
    // while the pen draws the diagram. The pen will prioritize the diagram drawing.

    // Check if we are about to reveal a diagram marker
    const remainingText = text.substring(revealedChars);
    if (remainingText.startsWith('[DIAGRAM]')) {
        // Find which diagram index this is
        const textBefore = text.substring(0, revealedChars);
        const diagramIndex = (textBefore.match(/\[DIAGRAM\]/g) || []).length;
        
        if (!completedDiagrams.has(diagramIndex)) {
            // Start animating this diagram
            setActiveDiagramIndex(diagramIndex);
            setDrawingProgress(0);
            // Instantly reveal the marker so the container renders
            setRevealedChars(prev => prev + 9); 
            return;
        }
    }

    // Determine the target character index we should be at
    let targetChar = text.length;
    
    // If syncProgress is provided (and valid), use it to limit/drive the text
    // Only use it if > 0 to avoid blocking start if speech is delayed
    if (syncProgress > 0 && syncProgress <= 1) {
        targetChar = Math.floor(syncProgress * text.length);
    }

    // Don't go past the next diagram marker until it's processed
    const nextDiagramIndex = text.indexOf('[DIAGRAM]', revealedChars);
    if (nextDiagramIndex !== -1 && targetChar > nextDiagramIndex) {
        targetChar = nextDiagramIndex;
    }

    // If we haven't reached the target yet, advance
    if (revealedChars < targetChar) {
        let delay = typingSpeed;
        
        // If syncProgress is active, we prioritize synchronization over the fixed typingSpeed
        if (syncProgress > 0) {
            const diff = targetChar - revealedChars;
            
            // Adaptive speed control to ensure "parallel" writing without lag
            // We use a smoother function: delay = Base / (diff + 1)
            // This ensures that as the gap grows, the speed increases proportionally
            if (diff > 0) {
                // Determine base speed factor. 
                // A factor of 100 means if diff is 1, delay is 50ms. If diff is 10, delay is 9ms.
                const speedFactor = 100; 
                delay = Math.max(1, Math.min(50, Math.floor(speedFactor / (diff + 1))));
            } else {
                delay = 50; // Default slow pace if caught up
            }
        } else {
            // Fallback to typingSpeed if sync isn't driving (e.g. no speech)
            // But still clamp it to avoid being too slow
             if (targetChar - revealedChars > 10) delay = Math.min(typingSpeed, 20);
        }
        
        const timer = setTimeout(() => {
            setRevealedChars(prev => prev + 1);
        }, delay);
        
        return () => clearTimeout(timer);
    } else if (revealedChars >= text.length) {
        // Finished
        const timer = setTimeout(onWritingComplete, 500);
        return () => clearTimeout(timer);
    }
  }, [isWriting, revealedChars, text, onWritingComplete, activeDiagramIndex, completedDiagrams, syncProgress, typingSpeed]);

  useEffect(() => {
    // Priority 0: Follow writing cursor (Highest priority if writing is active)
    if (isWriting && revealedChars < text.length && cursorRef.current && containerRef.current) {
      const cursorRect = cursorRef.current.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();
      
      setPenPos({
        x: (cursorRect.left - containerRect.left) / zoom,
        y: (cursorRect.top - containerRect.top) / zoom
      });
      
      // Smoothly scroll cursor into view if needed
      cursorRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }

    // Priority 1: Follow Canvas drawing
    if (isDrawingCanvas || activeDiagramIndex !== null) {
      return; // penPos is handled by animation loop
    }

    // Priority 2: Hover over highlighted text
    if (highlightText && highlightSpansRef.current.length > 0 && containerRef.current) {
      const span = highlightSpansRef.current[0];
      if (span) {
        const spanRect = span.getBoundingClientRect();
        const containerRect = containerRef.current.getBoundingClientRect();
        
        // Center of the highlighted word
        setPenPos({
          x: ((spanRect.left - containerRect.left) + (spanRect.width / 2)) / zoom,
          y: ((spanRect.top - containerRect.top) + (spanRect.height / 2)) / zoom
        });
        return;
      }
    }
  }, [revealedChars, isWriting, highlightText, text, isDrawingCanvas, activeDiagramIndex, zoom]);

  highlightSpansRef.current = [];
  permanentHighlightSpansRef.current = [];

  const revealedText = text.substring(0, revealedChars);

  const renderHighlightedText = (textPart: string) => {
    // First, split by math blocks to avoid highlighting inside math
    const mathRegex = /(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g;
    const mathParts = textPart.split(mathRegex);

    return mathParts.map((mathPart, idx) => {
      if (mathPart.startsWith('$$') && mathPart.endsWith('$$')) {
        return <BlockMath key={idx} math={mathPart.slice(2, -2)} />;
      } else if (mathPart.startsWith('$') && mathPart.endsWith('$')) {
        return <InlineMath key={idx} math={mathPart.slice(1, -1)} />;
      }

      // If it's not math, apply highlights and markdown bold
      const allHighlights = [...permanentHighlights, highlightText].filter(Boolean) as string[];
      
      const renderWithMarkdown = (str: string, keyPrefix: string) => {
        // Simple markdown bold parser **text**
        const boldRegex = /\*\*(.*?)\*\*/g;
        const boldParts = str.split(boldRegex);
        
        if (boldParts.length === 1) return str;
        
        return boldParts.map((part, i) => {
          if (i % 2 === 1) { // It's the bold part
            return <strong key={`${keyPrefix}-bold-${i}`} className="font-bold text-gray-900">{part}</strong>;
          }
          return part;
        });
      };
      
      if (allHighlights.length === 0) return <React.Fragment key={idx}>{renderWithMarkdown(mathPart, `math-${idx}`)}</React.Fragment>;
      
      try {
        const escapedHighlights = allHighlights
          .filter(h => h.trim().length > 0)
          .map(h => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        
        if (escapedHighlights.length === 0) return <React.Fragment key={idx}>{renderWithMarkdown(mathPart, `math-${idx}`)}</React.Fragment>;

        const regex = new RegExp(`(${escapedHighlights.join('|')})`, 'g');
        const parts = mathPart.split(regex);
        
        return (
          <React.Fragment key={idx}>
            {parts.map((part, i) => {
              if (part === highlightText) {
                return (
                  <span 
                    key={i} 
                    ref={el => { if (el) highlightSpansRef.current.push(el); }}
                    className="relative z-10 bg-yellow-200/50 rounded px-1"
                  >
                    {renderWithMarkdown(part, `hl-${i}`)}
                  </span>
                );
              } else if (permanentHighlights.includes(part)) {
                 return (
                  <span 
                    key={i} 
                    ref={el => { if (el) permanentHighlightSpansRef.current.push(el); }}
                    className="relative z-10 bg-yellow-200/50 rounded px-1 font-bold"
                  >
                    {renderWithMarkdown(part, `phl-${i}`)}
                  </span>
                );
              }
              return renderWithMarkdown(part, `txt-${i}`);
            })}
          </React.Fragment>
        );
      } catch (e) {
        return <React.Fragment key={idx}>{renderWithMarkdown(mathPart, `err-${idx}`)}</React.Fragment>;
      }
    });
  };

  return (
    <div className={`relative w-full ${isPdfMode ? 'h-auto' : 'h-full flex flex-col'} bg-white rounded-xl shadow-lg overflow-hidden group/whiteboard`}>
      {/* Zoom Controls */}
      {!isPdfMode && (
        <div className="absolute top-4 left-4 z-50 flex flex-col gap-2 opacity-0 group-hover/whiteboard:opacity-100 transition-opacity">
          <button 
            onClick={handleZoomIn}
            className="p-2 bg-white/80 hover:bg-white border border-gray-200 rounded-lg shadow-sm text-gray-600 hover:text-blue-600 transition-colors"
            title="Zoom In"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
          </button>
          <button 
            onClick={handleResetZoom}
            className="p-2 bg-white/80 hover:bg-white border border-gray-200 rounded-lg shadow-sm text-gray-600 hover:text-blue-600 transition-colors text-xs font-bold"
            title="Reset Zoom"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button 
            onClick={handleZoomOut}
            className="p-2 bg-white/80 hover:bg-white border border-gray-200 rounded-lg shadow-sm text-gray-600 hover:text-blue-600 transition-colors"
            title="Zoom Out"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="11" x2="14" y2="11"/><line x1="8" y1="11" x2="11" y2="11"/></svg>
          </button>
        </div>
      )}

      <div className={`${isPdfMode ? '' : 'flex-1 overflow-y-auto'} p-4 md:p-8`} ref={scrollRef}>
        <div 
          className="relative min-h-full transition-transform duration-200 origin-top" 
          ref={containerRef} 
          id={isPdfMode ? undefined : "whiteboard-content"}
          style={{ transform: `scale(${isPdfMode ? 1 : zoom})` }}
        >
          
          {/* Image Content */}
          {image && (
            <div className="mb-6 flex justify-center">
              <img 
                src={image} 
                alt="User uploaded content" 
                className="max-w-full max-h-[400px] object-contain rounded-lg shadow-sm border border-gray-200"
              />
            </div>
          )}

          {/* Text Content and Diagram Interleaving */}
          {(() => {
            const parts = revealedText.split('[DIAGRAM]');

            return (
              <>
                {parts.map((part, index) => (
                  <React.Fragment key={index}>
                    <div className="relative z-10 font-handwriting text-2xl md:text-3xl lg:text-4xl text-gray-800 whitespace-pre-wrap leading-relaxed">
                      {renderHighlightedText(part)}
                      {index === parts.length - 1 && <span ref={cursorRef} className="inline-block w-[1px] h-[1em] bg-transparent align-bottom"></span>}
                    </div>

                    {/* Render diagram if we have one for this position */}
                    {index < parts.length - 1 && (
                      <div className="relative z-10 w-full mt-4 h-[600px] md:h-[800px] flex items-center justify-center">
                        <svg 
                          id={isPdfMode ? undefined : `whiteboard-svg-${index}`}
                          viewBox="0 0 800 600"
                          className="w-full h-full object-contain"
                          style={{ maxWidth: '100%', maxHeight: '100%' }}
                        >
                          {(() => {
                            const currentDiagramDrawings = diagrams[index] || drawings;
                            const isCurrentDiagram = drawings && currentDiagramDrawings === drawings;
                            
                            // Use memoized processed elements if available, otherwise use the active processedElements
                            const elementsToRender = (diagrams[index] && processedDiagrams[index]) 
                                ? processedDiagrams[index] 
                                : processedElements;
                            
                            return elementsToRender.map((el, i) => {
                              if (isCurrentDiagram && i > Math.floor(drawingProgress)) return null;

                              const isPartial = isCurrentDiagram && i === Math.floor(drawingProgress);
                              const progress = drawingProgress % 1;
                              
                              if (el.isText) {
                                return (
                                  <text key={i} x={el.x} y={el.y} fill={el.fill} fontSize={el.fontSize || 20} fontFamily="Virgil, 'Comic Sans MS', sans-serif">
                                    {el.text}
                                  </text>
                                );
                              }
                              
                              return (
                                <path
                                  key={i}
                                  d={el.d}
                                  stroke={el.stroke !== 'none' ? el.stroke : 'transparent'}
                                  strokeWidth={el.strokeWidth || 2}
                                  fill={isPartial ? 'transparent' : (el.fill !== 'none' ? el.fill : 'transparent')}
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeDasharray={el.length}
                                  strokeDashoffset={isPartial && el.length ? el.length * (1 - progress) : 0}
                                />
                              );
                            });
                          })()}
                        </svg>
                      </div>
                    )}
                  </React.Fragment>
                ))}
                
                {/* Hidden SVG for path measurements */}
                <svg width="0" height="0" className="absolute pointer-events-none opacity-0">
                  <path ref={hiddenPathRef} />
                </svg>
              </>
            );
          })()}
          
          {/* Pen Cursor */}
          {((isWriting && revealedChars < text.length) || isDrawingCanvas || activeDiagramIndex !== null) && !isPdfMode && (
            <div 
              className="absolute pointer-events-none transition-all duration-100 ease-out"
              style={{ 
                left: penPos.x,
                top: penPos.y,
                transform: `translate(-2px, -44px)`, // Adjusted to align pen tip (bottom-left) with cursor
                zIndex: 50
              }}
            >
              <div className={isPenMoving || isDrawingCanvas || activeDiagramIndex !== null ? "animate-scribble" : ""}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-800 drop-shadow-md">
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                </svg>
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes draw {
          to { stroke-dashoffset: 0; }
        }
        @keyframes fillIn {
          from { fill-opacity: 0; }
          to { fill-opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scribble {
          0% { transform: rotate(0deg) translateY(0); }
          25% { transform: rotate(-5deg) translateY(-2px); }
          50% { transform: rotate(0deg) translateY(0); }
          75% { transform: rotate(5deg) translateY(-2px); }
          100% { transform: rotate(0deg) translateY(0); }
        }
        .animate-scribble {
          animation: scribble 0.2s infinite;
        }
      `}</style>
    </div>
  );
}
