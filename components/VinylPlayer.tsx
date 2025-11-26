
import React, { useEffect, useRef, useMemo } from 'react';

interface VinylPlayerProps {
  isPlaying: boolean;
  analyserRef: React.MutableRefObject<AnalyserNode | null>;
  gradients: {
    vinyl_gradient: string[];
    accent: string;
    label_text: string;
    text: string;
  };
  artwork?: string;
  isDefault?: boolean;
}

const hexToRgba = (hex: string, alpha: number) => {
  let r = 0, g = 0, b = 0;
  if (hex.startsWith('#')) hex = hex.slice(1);
  
  if (hex.length === 3) {
    r = parseInt(hex[0] + hex[0], 16);
    g = parseInt(hex[1] + hex[1], 16);
    b = parseInt(hex[2] + hex[2], 16);
  } else if (hex.length === 6) {
    r = parseInt(hex.slice(0, 2), 16);
    g = parseInt(hex.slice(2, 4), 16);
    b = parseInt(hex.slice(4, 6), 16);
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const VinylPlayer: React.FC<VinylPlayerProps> = ({ isPlaying, analyserRef, gradients, artwork, isDefault }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);

  // Audio Visualizer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const renderFrame = () => {
      // Clear with full transparency
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!analyserRef.current) {
         if (requestRef.current) cancelAnimationFrame(requestRef.current);
         return;
      }

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      // The visual vinyl is 400px wide (radius 200). We start rings slightly outside.
      const baseRadius = 205;

      // If paused, we still might want to draw a idle state or just clear
      if (!isPlaying) {
         // Draw a subtle idle ring
         ctx.beginPath();
         ctx.arc(centerX, centerY, baseRadius, 0, Math.PI * 2);
         ctx.strokeStyle = hexToRgba(gradients.accent, 0.1);
         ctx.lineWidth = 1;
         ctx.stroke();
         requestRef.current = requestAnimationFrame(renderFrame);
         return;
      }

      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyserRef.current.getByteFrequencyData(dataArray);

      // --- 1. ANALYSIS ---
      // Bass: Low end (approx 20Hz - 150Hz). indices 0-10 roughly.
      let bassSum = 0;
      for(let i = 0; i < 12; i++) bassSum += dataArray[i];
      const bassLevel = (bassSum / 12) / 255; // 0.0 - 1.0

      // --- 2. HARMONIC WAVE RINGS ---
      // We draw 2 rings. 
      // Ring A: Lower frequencies, smoother, closer to disc.
      // Ring B: Higher frequencies, spikier, further out.

      const drawRing = (
        radiusOffset: number, 
        freqStart: number, 
        freqEnd: number, 
        opacity: number, 
        smoothing: boolean,
        ampScale: number
      ) => {
        ctx.beginPath();
        const segments = 180;
        const angleStep = (Math.PI * 2) / segments;
        
        // We calculate points first to smooth them if needed
        const points: {x: number, y: number}[] = [];

        for (let i = 0; i <= segments; i++) {
           // Mirrored spectrum mapping
           // 0 -> 12 o'clock. 
           // 0 to PI (Right side): Map freqStart -> freqEnd
           // PI to 2PI (Left side): Map freqEnd -> freqStart
           
           let freqIndex: number;
           if (i <= segments / 2) {
             const t = i / (segments / 2);
             freqIndex = Math.floor(freqStart + t * (freqEnd - freqStart));
           } else {
             const t = (i - segments / 2) / (segments / 2);
             freqIndex = Math.floor(freqEnd - t * (freqEnd - freqStart));
           }
           
           const val = dataArray[freqIndex] || 0;
           const amp = (val / 255) * ampScale;
           
           const r = baseRadius + radiusOffset + amp;
           const angle = i * angleStep - (Math.PI / 2);
           
           const x = centerX + Math.cos(angle) * r;
           const y = centerY + Math.sin(angle) * r;
           points.push({x, y});
        }

        // Draw curved path
        if (smoothing) {
          ctx.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length - 2; i++) {
             const xc = (points[i].x + points[i + 1].x) / 2;
             const yc = (points[i].y + points[i + 1].y) / 2;
             ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
          }
          // Connect last few points
          ctx.quadraticCurveTo(
            points[points.length - 2].x, 
            points[points.length - 2].y, 
            points[points.length - 1].x, 
            points[points.length - 1].y
          );
        } else {
           // Sharp lines for high freq
           ctx.moveTo(points[0].x, points[0].y);
           for (let p of points) ctx.lineTo(p.x, p.y);
        }

        ctx.strokeStyle = hexToRgba(gradients.accent, opacity);
        ctx.lineWidth = 1.5;
        ctx.lineJoin = 'round';
        ctx.stroke();
      };

      // Draw Inner Ring (Mids) - Smooth
      drawRing(5 + (bassLevel * 15), 10, 150, 0.4, true, 30);
      
      // Draw Outer Ring (Highs) - Sharp
      drawRing(15 + (bassLevel * 5), 100, 400, 0.2, false, 20);

      requestRef.current = requestAnimationFrame(renderFrame);
    };

    renderFrame();

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPlaying, gradients.accent]);

  // Style for the new analyzed color
  const activeVinylStyle = useMemo(() => ({
    background: `conic-gradient(from 45deg, ${gradients.vinyl_gradient[0]}, ${gradients.vinyl_gradient[1]}, ${gradients.vinyl_gradient[2]}, ${gradients.vinyl_gradient[0]})`,
  }), [gradients.vinyl_gradient]);

  // Style for the default black vinyl (fallback)
  const defaultVinylStyle = {
    background: `conic-gradient(from 45deg, #111111, #1a1a1a, #000000, #111111)`,
  };

  return (
    // Responsive Wrapper
    // The internal components use fixed 500px logic for consistent drawing/positioning.
    // We scale the whole thing down on smaller screens.
    <div className="relative w-[320px] h-[320px] sm:w-[400px] sm:h-[400px] md:w-[500px] md:h-[500px] flex items-center justify-center select-none mx-auto">
      
      {/* Scaling Container */}
      <div className="w-[500px] h-[500px] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 scale-[0.64] sm:scale-[0.8] md:scale-100 origin-center transition-transform duration-500">
        
        {/* Visualizer Layer: 800x800 canvas centered on the 500x500 container.
            This prevents clipping when waves go beyond the vinyl radius. 
        */}
        <canvas 
          ref={canvasRef} 
          width={800} 
          height={800} 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-colors duration-1000" 
        />

        {/* Main Vinyl Disc Container */}
        <div 
          className="relative w-[400px] h-[400px] rounded-full z-10 m-auto top-[50px]"
          style={{ 
            boxShadow: `
              0 30px 60px -15px rgba(0,0,0,0.3), 
              0 0 0 1px rgba(0,0,0,0.05)
            ` 
          }}
        >
          
          {/* === SPINNING COMPONENT === */}
          <div 
            className={`absolute inset-0 rounded-full overflow-hidden ${isPlaying ? 'vinyl-spin-active' : 'vinyl-spin-paused'}`}
          >
            {/* Layer 1: The Default Black Wax (Always present at bottom) */}
            <div className="absolute inset-0" style={defaultVinylStyle} />

            {/* Layer 2: The Analyzed Colored Wax (Fades in on top) */}
            <div 
              className="absolute inset-0 transition-opacity duration-[2000ms] ease-in-out"
              style={{ 
                  ...activeVinylStyle,
                  opacity: isDefault ? 0 : 1
              }} 
            />

            {/* Texture: Noise Grain */}
            <div className="absolute inset-0 opacity-15 mix-blend-overlay" 
                style={{ 
                  backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` 
                }} 
            />

            {/* Texture: Grooves */}
            <div 
              className="absolute inset-0 opacity-40 mix-blend-multiply"
              style={{ 
                background: `repeating-radial-gradient(
                  #000 0, 
                  #000 1px, 
                  transparent 1.5px, 
                  transparent 3px
                )` 
              }}
            />

            {/* Center Label */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full shadow-lg flex items-center justify-center overflow-hidden border border-black/5 bg-white">
              {/* Paper grain */}
              <div className="absolute inset-0 opacity-5"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.5' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
              />
              {/* Accent tint on label (also transitions) */}
              <div 
                  className="absolute inset-0 opacity-10 transition-colors duration-1000" 
                  style={{ backgroundColor: gradients.accent }} 
              />
              
              {/* Typography on Label */}
              {artwork && (
                  <div className="relative z-10 w-full h-full flex items-center justify-center animate-[spin_12s_linear_infinite]">
                      <svg viewBox="0 0 100 100" className="w-24 h-24 opacity-80">
                          <path id="curve" d="M 50, 50 m -35, 0 a 35,35 0 1,1 70,0 a 35,35 0 1,1 -70,0" fill="transparent" />
                          <text width="500" fontSize="10.5" letterSpacing="1.5" fontWeight="600">
                          <textPath xlinkHref="#curve" fill={gradients.text || "#111"} textLength="200" startOffset="0">
                              • HIGH FIDELITY • STEREO SOUND •
                          </textPath>
                          </text>
                      </svg>
                      <div className="absolute w-2 h-2 rounded-full bg-black/10" />
                  </div>
              )}
            </div>
          </div>
          
          {/* === STATIC LIGHTING OVERLAY === */}
          {/* Specular highlights that stay fixed */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none z-20 mix-blend-screen" />
          <div className="absolute inset-0 rounded-full bg-gradient-to-tl from-white/5 via-transparent to-transparent pointer-events-none z-20 mix-blend-screen" />

          {/* Anisotropic Shine */}
          <div 
              className="absolute inset-0 rounded-full pointer-events-none z-20 opacity-20 mix-blend-overlay"
              style={{
                  background: `conic-gradient(
                      from 200deg, 
                      transparent 0deg, 
                      white 20deg, 
                      transparent 50deg, 
                      transparent 180deg, 
                      white 200deg, 
                      transparent 230deg
                  )`
              }}
          />

          {/* Spindle */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-neutral-300 rounded-full z-30 shadow-[inset_0_1px_2px_rgba(255,255,255,0.8),0_1px_2px_rgba(0,0,0,0.5)] border border-neutral-400" />

        </div>
        
        {/* === TONEARM === */}
        <div 
          className="absolute top-[20px] right-[40px] w-[100px] h-[350px] z-40 pointer-events-none"
        >
            {/* Pivot Base */}
            <div className="absolute top-0 right-10 w-24 h-24 rounded-full bg-white shadow-[0_10px_20px_rgba(0,0,0,0.05),inset_0_2px_4px_rgba(255,255,255,0.8)] border border-white flex items-center justify-center">
              <div className="w-20 h-20 rounded-full bg-stone-50 border border-white shadow-inner" />
            </div>

            {/* Arm */}
            <div 
              className="absolute top-12 right-[5.5rem] w-full h-full origin-top transition-transform duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{ transform: isPlaying ? 'rotate(25deg)' : 'rotate(0deg)' }}
            >
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-10 h-12 bg-neutral-800 rounded-sm shadow-md bg-gradient-to-b from-neutral-700 to-neutral-900" />
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2.5 h-[280px] bg-gradient-to-r from-neutral-200 via-white to-neutral-300 rounded-full shadow-lg" />
                <div className="absolute bottom-[60px] left-1/2 -translate-x-1/2 w-8 h-14 bg-neutral-800 rounded-sm rotate-[-5deg] origin-top shadow-xl flex items-end justify-center">
                    <div className="w-0.5 h-2 bg-neutral-400 translate-y-2" />
                </div>
            </div>
        </div>
      </div>

    </div>
  );
};

export default VinylPlayer;
