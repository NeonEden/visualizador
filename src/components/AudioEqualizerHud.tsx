import React from 'react';
import { AudioBands } from '../audio/AudioEngine';
import { ColorPalette, VISUALIZER_STYLES, VisualizerStyleId } from '../visualizer/types';
import { Activity, Sparkles, Volume2, Zap } from 'lucide-react';

interface AudioEqualizerHudProps {
  bands: AudioBands;
  activeStyle: VisualizerStyleId;
  palette: ColorPalette;
  onSelectStyle: (styleId: VisualizerStyleId) => void;
  bpm: number;
}

export const AudioEqualizerHud: React.FC<AudioEqualizerHudProps> = ({
  bands,
  activeStyle,
  palette,
  onSelectStyle,
  bpm,
}) => {
  const freqBands = [
    { label: 'SUB', val: bands.subBass, color: palette.colors[0] },
    { label: 'BASS', val: bands.bass, color: palette.colors[1] },
    { label: 'L-MID', val: bands.lowMid, color: palette.colors[2] },
    { label: 'MID', val: bands.mid, color: palette.colors[3] },
    { label: 'H-MID', val: bands.highMid, color: palette.colors[0] },
    { label: 'TREBLE', val: bands.treble, color: palette.colors[1] },
  ];

  // Dynamic acoustic live interpretation
  let liveVibe = 'Flujo Armónico';
  let liveVibeColor = 'text-cyan-300';
  if (bands.subBass > 0.6) {
    liveVibe = 'Sub-Bass Drop';
    liveVibeColor = 'text-pink-400 font-bold';
  } else if (bands.vocalPresence > 0.65) {
    liveVibe = 'Voz / Melodía Líder';
    liveVibeColor = 'text-purple-300';
  } else if (bands.spectralFlux > 0.4) {
    liveVibe = 'Ataque Transitorio';
    liveVibeColor = 'text-amber-300';
  } else if (bands.treble > 0.55) {
    liveVibe = 'Brillo Cristalino';
    liveVibeColor = 'text-emerald-300';
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 p-5 pointer-events-none flex flex-col md:flex-row items-center justify-between gap-3 bg-gradient-to-t from-black/85 via-black/40 to-transparent">
      {/* Left: Frequency EQ Mini Meters, Dynamic Vibe & BPM Pulse */}
      <div className="flex items-center gap-3.5 pointer-events-auto bg-black/60 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 shadow-lg">
        {/* Dynamic BPM Pulse Ring */}
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center w-3 h-3">
            <div
              className="absolute inset-0 rounded-full bg-cyan-400 transition-transform duration-75"
              style={{
                transform: `scale(${1.0 + (bands.beatDetected ? 1.8 : bands.bass * 0.9)})`,
                opacity: bands.beatDetected ? 1 : 0.6 + bands.overallEnergy * 0.4,
              }}
            />
          </div>
          <span className="text-xs font-mono font-bold text-white tracking-tight">
            {bpm} <span className="text-[10px] text-slate-400 font-normal">BPM</span>
          </span>
        </div>

        <div className="h-4 w-px bg-white/15" />

        {/* 6-Band Graphic Mini Equalizer */}
        <div className="flex items-end gap-1.5 h-6">
          {freqBands.map((b, i) => {
            const hPercent = Math.min(100, Math.max(12, Math.round(b.val * 100)));
            return (
              <div key={i} className="flex flex-col items-center">
                <div className="w-1.5 h-6 bg-white/10 rounded-full overflow-hidden flex items-end">
                  <div
                    className="w-full rounded-full transition-all duration-75"
                    style={{
                      height: `${hPercent}%`,
                      backgroundColor: b.color,
                      boxShadow: b.val > 0.5 ? `0 0 6px ${b.color}` : 'none',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="h-4 w-px bg-white/15 hidden sm:block" />

        {/* Live Acoustic Stage Vibe */}
        <div className="hidden sm:flex items-center gap-1.5 text-xs">
          <Zap className="w-3 h-3 text-cyan-400" />
          <span className={`text-[11px] font-mono tracking-tight ${liveVibeColor}`}>
            {liveVibe}
          </span>
        </div>
      </div>

      {/* Center/Right: Quick 1-8 Visualizer Style Bar */}
      <div className="flex items-center gap-1 pointer-events-auto bg-black/60 backdrop-blur-md p-1 rounded-2xl border border-white/10 overflow-x-auto max-w-full shadow-lg">
        {VISUALIZER_STYLES.map((style, idx) => {
          const isActive = activeStyle === style.id;
          return (
            <button
              key={style.id}
              onClick={() => onSelectStyle(style.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
                isActive
                  ? 'bg-white/20 text-white shadow-sm border border-white/30 scale-105'
                  : 'text-slate-400 hover:text-white hover:bg-white/10 border border-transparent'
              }`}
              title={`Atajo de teclado: ${idx + 1}`}
            >
              <span className="text-[10px] font-mono opacity-50">{idx + 1}</span>
              <span>{style.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
