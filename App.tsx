
import React, { useState, useRef, useEffect } from 'react';
import { Track, PlayerState, AIAnalysisResult } from './types';
import { Icons } from './components/Icons';
import { analyzeAudioVibe } from './services/gemini';
import VinylPlayer from './components/VinylPlayer';
import Controls from './components/Controls';
import { motion, AnimatePresence } from 'framer-motion';

const DefaultAnalysis: AIAnalysisResult = {
  mood: "",
  genre: "",
  description: "",
  meaning: "",
  colors: {
    bg_gradient: ["#FFFFFF", "#FFFFFF"], 
    vinyl_gradient: ["#111111", "#1a1a1a", "#111111"], // Default black vinyl
    accent: "#a8a29e", // Stone-400
    text: "#1c1917", // Stone-900
    label_text: "#1c1917"
  }
};

const App: React.FC = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(-1);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement>(new Audio());
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const [playerState, setPlayerState] = useState<PlayerState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 1
  });

  const currentTrack = currentTrackIndex >= 0 ? tracks[currentTrackIndex] : null;
  const analysis = currentTrack?.analysis || DefaultAnalysis;
  const colors = analysis.colors;

  const initAudioContext = () => {
    if (!audioContextRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      audioContextRef.current = ctx;
      
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048; // Higher resolution for better viz
      analyser.smoothingTimeConstant = 0.8; // Smooth out the jitter
      analyserRef.current = analyser;

      try {
          const source = ctx.createMediaElementSource(audioRef.current);
          source.connect(analyser);
          analyser.connect(ctx.destination);
      } catch (e) {
          console.warn("Audio source connection", e);
      }
    } else if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const newTracks: Track[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      newTracks.push({
        id: crypto.randomUUID(),
        file,
        url: URL.createObjectURL(file),
        name: file.name.replace(/\.[^/.]+$/, "")
      });
    }

    setTracks(prev => [...prev, ...newTracks]);
    if (currentTrackIndex === -1) {
      setCurrentTrackIndex(tracks.length);
    }
  };

  useEffect(() => {
    if (currentTrackIndex >= 0 && tracks[currentTrackIndex]) {
      const track = tracks[currentTrackIndex];
      const audio = audioRef.current;
      
      const playTrack = async () => {
        initAudioContext();
        audio.src = track.url;
        audio.load();
        try {
          await audio.play();
          setPlayerState(prev => ({ ...prev, isPlaying: true }));
        } catch (e) { console.error(e); }

        if (!track.analysis) {
          setIsAnalyzing(true);
          const result = await analyzeAudioVibe(track.file);
          setTracks(prev => {
            const newTracks = [...prev];
            newTracks[currentTrackIndex] = { ...track, analysis: result };
            return newTracks;
          });
          setIsAnalyzing(false);
        }
      };
      playTrack();
    }
  }, [currentTrackIndex]);

  useEffect(() => {
    const audio = audioRef.current;
    const updateTime = () => setPlayerState(p => ({ ...p, currentTime: audio.currentTime }));
    const updateDuration = () => setPlayerState(p => ({ ...p, duration: audio.duration }));
    const handleEnded = () => {
       if (currentTrackIndex < tracks.length - 1) setCurrentTrackIndex(prev => prev + 1);
       else setPlayerState(p => ({ ...p, isPlaying: false }));
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);
    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [tracks.length, currentTrackIndex]);

  const togglePlay = () => {
    initAudioContext();
    if (playerState.isPlaying) audioRef.current.pause();
    else audioRef.current.play();
    setPlayerState(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
  };

  // ZERO STATE
  if (tracks.length === 0) {
    return (
      <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center bg-white overflow-hidden relative selection:bg-stone-200 p-4">
        
        <div className="z-10 flex flex-col items-center gap-12 md:gap-16 animate-in fade-in duration-1000 w-full max-w-lg">
           <div className="opacity-90 transition-all duration-1000 ease-out scale-90 md:scale-100">
              <VinylPlayer 
                isPlaying={false} 
                analyserRef={analyserRef} 
                gradients={DefaultAnalysis.colors}
                isDefault={true}
              />
           </div>

           <div className="text-center space-y-4">
               <label className="cursor-pointer group inline-block pt-4">
                  <input type="file" accept="audio/*" className="hidden" onChange={handleFileUpload} />
                  <span className="text-xs font-bold tracking-[0.25em] uppercase text-stone-800 border-b-2 border-transparent group-hover:border-stone-800 transition-all duration-300 py-1">
                      Upload Record
                  </span>
               </label>
           </div>
        </div>
      </div>
    );
  }

  // PLAYING STATE
  return (
    <div 
      className="min-h-[100dvh] w-full flex items-center justify-center relative bg-white py-6 md:py-0"
    >
      <div className="relative z-10 w-full max-w-[1400px] px-6 md:px-12 lg:px-16 grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 items-center h-full">
        
        {/* Left: Metadata & Meaning (5 cols) */}
        {/* Order 2 on mobile (bottom), Order 1 on desktop (left) */}
        <div className="col-span-1 md:col-span-5 flex flex-col justify-center gap-8 md:gap-12 order-2 md:order-1 pb-10 md:pb-0">
           <AnimatePresence mode="wait">
             <motion.div
               key={currentTrack?.id}
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: -20 }}
               transition={{ duration: 1, ease: "easeOut" }}
             >
                <div className="flex flex-col gap-4 md:gap-6 text-center md:text-left">
                   <div className="flex items-center justify-center md:justify-start gap-3 text-[10px] md:text-[11px] font-bold tracking-[0.25em] uppercase text-stone-500">
                      {isAnalyzing ? (
                        <span className="bg-stone-50 px-3 py-1 rounded-sm border border-stone-100 animate-pulse text-stone-400">
                          Listening...
                        </span>
                      ) : (
                        <>
                          <span className="bg-stone-50 px-3 py-1 rounded-sm border border-stone-200">
                            {analysis.genre || "Genre Undefined"}
                          </span>
                          {analysis.mood && <span>{analysis.mood}</span>}
                        </>
                      )}
                   </div>
                   <h1 className="text-4xl md:text-6xl lg:text-7xl font-medium tracking-tight text-[#1c1917] font-serif leading-[1.1] break-words">
                     {currentTrack?.name}
                   </h1>
                </div>
             </motion.div>
           </AnimatePresence>

           <div className="space-y-8 md:space-y-10">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentTrack?.id + '-meaning'}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2, duration: 1 }}
                  className="min-h-[40px] md:min-h-[60px] text-center md:text-left"
                >
                  {isAnalyzing ? (
                    <div className="flex items-center justify-center md:justify-start gap-3 text-xs uppercase tracking-widest text-stone-300 animate-pulse">
                        <Icons.Sparkles size={14} />
                        <span>Curating Vibe...</span>
                    </div>
                  ) : (
                    <p className="text-lg md:text-xl lg:text-2xl font-serif italic leading-relaxed text-stone-600 px-4 md:px-0">
                       &ldquo;{analysis.meaning}&rdquo;
                    </p>
                  )}
                </motion.div>
              </AnimatePresence>
              
              <div className="pt-2 border-t border-stone-100 w-full">
                 <div className="pt-6 md:pt-8 flex justify-center md:justify-start">
                    <Controls 
                        playerState={playerState}
                        onTogglePlay={togglePlay}
                        onNext={() => currentTrackIndex < tracks.length - 1 && setCurrentTrackIndex(i => i + 1)}
                        onPrev={() => currentTrackIndex > 0 && setCurrentTrackIndex(i => i - 1)}
                        onSeek={(t) => { audioRef.current.currentTime = t; setPlayerState(p => ({...p, currentTime: t})); }}
                        colors={{ secondary: '#1c1917', text: '#44403c' }}
                    />
                 </div>
              </div>
           </div>
        </div>

        {/* Right: Vinyl (7 cols) */}
        {/* Order 1 on mobile (top), Order 2 on desktop (right) */}
        <div className="col-span-1 md:col-span-7 flex items-center justify-center md:justify-end order-1 md:order-2 h-auto md:h-full pt-8 md:pt-0">
           <div className="w-full flex justify-center md:justify-end">
             <VinylPlayer 
               isPlaying={playerState.isPlaying}
               analyserRef={analyserRef}
               gradients={colors}
               artwork={currentTrack?.name}
               isDefault={isAnalyzing || !currentTrack?.analysis}
             />
           </div>
        </div>

      </div>

      {/* Floating Upload Button */}
      <div className="absolute top-4 right-4 md:top-8 md:right-8 z-50">
        <label className="cursor-pointer group flex items-center gap-4">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400 group-hover:text-stone-800 transition-colors duration-300 hidden md:block">
            Import Audio
          </span>
          <input type="file" accept="audio/*" className="hidden" onChange={handleFileUpload} />
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full border border-stone-200 bg-white flex items-center justify-center text-stone-600 group-hover:border-stone-800 group-hover:text-stone-800 group-hover:shadow-lg transition-all duration-300">
             <Icons.Upload size={16} strokeWidth={1.5} />
          </div>
        </label>
      </div>

    </div>
  );
};

export default App;
