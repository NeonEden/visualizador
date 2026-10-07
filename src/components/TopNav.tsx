import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Maximize2,
  Minimize2,
  Sliders,
  Music,
  Monitor,
  Mic,
  Upload,
  Play,
  Volume2,
  VolumeX,
  ChevronDown,
  Check,
  Zap,
  Activity,
  X
} from 'lucide-react';
import { AudioSourceType } from '../audio/AudioEngine';

interface TopNavProps {
  sourceType: AudioSourceType;
  sourceName: string;
  onOpenSourceModal: () => void;
  onOpenControls: () => void;
  onOpenAIDirector: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  aiDirectorActive: boolean;
  fps: number;
  liveEnergy: number;
  availableDevices: MediaDeviceInfo[];
  onSelectCaptureTab: () => Promise<void>;
  onSelectCaptureMic: (deviceId?: string, label?: string) => Promise<void>;
  onSelectPlayDemo: (type: 'synthwave' | 'ambient' | 'edm' | 'lofi' | 'techno') => Promise<void>;
  onSelectUploadFile: (file: File) => Promise<void>;
  onStopSource: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  sourceType,
  sourceName,
  onOpenSourceModal,
  onOpenControls,
  onOpenAIDirector,
  isFullscreen,
  onToggleFullscreen,
  aiDirectorActive,
  fps,
  liveEnergy,
  availableDevices,
  onSelectCaptureTab,
  onSelectCaptureMic,
  onSelectPlayDemo,
  onSelectUploadFile,
  onStopSource,
}) => {
  const [isInputMenuOpen, setIsInputMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsInputMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hasSignal = liveEnergy > 0.02;

  const handleTabClick = async () => {
    setIsInputMenuOpen(false);
    try {
      await onSelectCaptureTab();
    } catch (err: any) {
      console.error(err);
      onOpenSourceModal();
    }
  };

  const handleMicClick = async (deviceId?: string, label?: string) => {
    setIsInputMenuOpen(false);
    try {
      await onSelectCaptureMic(deviceId, label);
    } catch (err: any) {
      console.error(err);
      onOpenSourceModal();
    }
  };

  const handleDemoClick = async (type: 'synthwave' | 'edm' | 'ambient' | 'lofi' | 'techno') => {
    setIsInputMenuOpen(false);
    await onSelectPlayDemo(type);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsInputMenuOpen(false);
    const file = e.target.files?.[0];
    if (file) {
      await onSelectUploadFile(file);
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-6 py-4 bg-gradient-to-b from-black/85 via-black/45 to-transparent backdrop-blur-xs transition-opacity duration-300">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Zone 1: Logo & Version */}
      <div className="flex items-center gap-3">
        <a href="/" className="text-lg font-bold tracking-tight text-white font-display flex items-center gap-2 hover:opacity-90 transition-opacity">
          <span className={`w-2.5 h-2.5 rounded-full ${hasSignal ? 'bg-cyan-400 animate-pulse' : 'bg-slate-500'}`} />
          PulseWave AI
        </a>
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 hidden sm:inline-flex items-center gap-1 font-mono">
          <Sparkles className="w-2.5 h-2.5" />
          v2.5
        </span>
        <span className="text-xs text-slate-400 hidden sm:inline-block font-mono">
          {fps} FPS
        </span>
      </div>

      {/* Zone 2: DIRECT EXTERNAL INPUT SELECTOR DROPDOWN */}
      <div className="relative flex items-center gap-2" ref={menuRef}>
        {/* Main Direct Input Button */}
        <button
          onClick={() => setIsInputMenuOpen((prev) => !prev)}
          className={`flex items-center gap-2 px-3.5 py-1.5 text-xs rounded-xl border font-medium shadow-md transition-all ${
            sourceType !== 'none'
              ? 'bg-cyan-950/40 border-cyan-500/40 text-white hover:bg-cyan-950/60'
              : 'bg-white/10 hover:bg-white/15 border-white/20 text-slate-200'
          }`}
          title="Cambiar fuente de audio directamente"
        >
          {sourceType === 'tab_screen' && <Monitor className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
          {sourceType === 'microphone' && <Mic className="w-3.5 h-3.5 text-purple-400 shrink-0" />}
          {sourceType === 'file' && <Upload className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
          {sourceType === 'demo' && <Play className="w-3.5 h-3.5 text-pink-400 shrink-0" />}
          {sourceType === 'none' && <Music className="w-3.5 h-3.5 text-slate-400 shrink-0" />}

          <span className="max-w-[140px] sm:max-w-[200px] truncate font-semibold">
            {sourceType === 'none' ? 'Elegir Entrada de Audio' : sourceName}
          </span>

          {/* Live Signal Pulse Dot */}
          {sourceType !== 'none' && (
            <span className="flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-black/40 border border-white/10">
              <span className={`w-1.5 h-1.5 rounded-full ${hasSignal ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
              <span className={hasSignal ? 'text-emerald-300' : 'text-amber-300'}>
                {hasSignal ? `${Math.round(liveEnergy * 100)}%` : '0%'}
              </span>
            </span>
          )}

          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isInputMenuOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown Menu for Immediate External Input Switching */}
        {isInputMenuOpen && (
          <div className="absolute top-full left-0 mt-2 w-72 sm:w-80 bg-neutral-900 border border-white/15 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-xl">
            <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Seleccionar Entrada Directa
              </span>
              <button
                onClick={() => setIsInputMenuOpen(false)}
                className="text-slate-400 hover:text-white p-0.5 rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="py-1 space-y-1 max-h-[380px] overflow-y-auto">
              {/* Option 1: Chrome Tab / Spotify Web */}
              <button
                onClick={handleTabClick}
                className="w-full flex items-center gap-3 px-3 py-2 text-left rounded-xl hover:bg-white/10 transition-colors group"
              >
                <div className="w-7 h-7 rounded-lg bg-cyan-500/15 text-cyan-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Monitor className="w-4 h-4" />
                </div>
                <div className="truncate">
                  <div className="text-xs font-semibold text-white">Pestaña / Spotify / PC</div>
                  <div className="text-[10px] text-slate-400">Audio digital directo de pestaña o pantalla</div>
                </div>
              </button>

              {/* Option 2: Default Microphone / Stereo Mix */}
              <button
                onClick={() => handleMicClick()}
                className="w-full flex items-center gap-3 px-3 py-2 text-left rounded-xl hover:bg-white/10 transition-colors group"
              >
                <div className="w-7 h-7 rounded-lg bg-purple-500/15 text-purple-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Mic className="w-4 h-4" />
                </div>
                <div className="truncate">
                  <div className="text-xs font-semibold text-white">Micrófono / Entrada Predeterminada</div>
                  <div className="text-[10px] text-slate-400">Captura en vivo sin compartir pantalla</div>
                </div>
              </button>

              {/* Sub-list of detected audio hardware devices (Mezcla estéreo, USB Interfaces, etc.) */}
              {availableDevices.length > 0 && (
                <div className="pt-1 pb-1 border-t border-b border-white/5 space-y-0.5">
                  <div className="px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    Dispositivos de Hardware Detectados:
                  </div>
                  {availableDevices.map((dev) => (
                    <button
                      key={dev.deviceId}
                      onClick={() => handleMicClick(dev.deviceId, dev.label || 'Dispositivo de Entrada')}
                      className="w-full flex items-center justify-between px-3 py-1.5 text-left rounded-lg hover:bg-purple-500/15 text-xs text-slate-300 hover:text-white transition-colors"
                    >
                      <span className="truncate pr-2 font-mono text-[11px]">{dev.label || `Entrada (${dev.deviceId.slice(0, 8)})`}</span>
                      <Zap className="w-3 h-3 text-purple-400 shrink-0" />
                    </button>
                  ))}
                </div>
              )}

              {/* Option 3: Instant Synthwave Demo (1-Click Test) */}
              <button
                onClick={() => handleDemoClick('synthwave')}
                className="w-full flex items-center gap-3 px-3 py-2 text-left rounded-xl hover:bg-white/10 transition-colors group"
              >
                <div className="w-7 h-7 rounded-lg bg-pink-500/15 text-pink-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Play className="w-4 h-4" />
                </div>
                <div className="truncate">
                  <div className="text-xs font-semibold text-white">Probar con Demo Synthwave</div>
                  <div className="text-[10px] text-slate-400">126 BPM · Batería y bajos instantáneos</div>
                </div>
              </button>

              {/* Option 4: Local Audio File */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center gap-3 px-3 py-2 text-left rounded-xl hover:bg-white/10 transition-colors group"
              >
                <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Upload className="w-4 h-4" />
                </div>
                <div className="truncate">
                  <div className="text-xs font-semibold text-white">Cargar Archivo MP3 / WAV</div>
                  <div className="text-[10px] text-slate-400">Reproducir tu archivo de audio local</div>
                </div>
              </button>

              {/* Stop Current Source */}
              {sourceType !== 'none' && (
                <button
                  onClick={() => {
                    setIsInputMenuOpen(false);
                    onStopSource();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left rounded-xl text-red-300 hover:bg-red-500/15 transition-colors text-xs font-medium"
                >
                  <VolumeX className="w-4 h-4 text-red-400 shrink-0" />
                  <span>Desconectar / Silenciar Fuente</span>
                </button>
              )}
            </div>

            {/* Modal Guide Opener */}
            <div className="p-2 border-t border-white/10 bg-white/[0.02] rounded-b-xl flex items-center justify-between text-[11px]">
              <span className="text-slate-400">¿Dudas con Spotify en PC?</span>
              <button
                onClick={() => {
                  setIsInputMenuOpen(false);
                  onOpenSourceModal();
                }}
                className="text-cyan-400 hover:underline font-semibold"
              >
                Abrir Guía Completa →
              </button>
            </div>
          </div>
        )}

        {/* AI Director Toggle */}
        <button
          onClick={onOpenAIDirector}
          className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl border transition-all whitespace-nowrap ${
            aiDirectorActive
              ? 'bg-purple-500/20 text-purple-200 border-purple-500/40 shadow-[0_0_12px_rgba(168,85,247,0.25)]'
              : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
          }`}
        >
          <Sparkles className={`w-3.5 h-3.5 ${aiDirectorActive ? 'text-purple-400 animate-spin' : 'text-slate-400'}`} style={{ animationDuration: '6s' }} />
          <span>Director IA {aiDirectorActive ? '(Activo)' : ''}</span>
        </button>

        {/* Customization Drawer Trigger */}
        <button
          onClick={onOpenControls}
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-colors whitespace-nowrap"
        >
          <Sliders className="w-3.5 h-3.5 text-slate-400" />
          <span>Personalizar</span>
        </button>
      </div>

      {/* Zone 3: Fullscreen and Quick Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenControls}
          className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
          title="Personalizar"
        >
          <Sliders className="w-4 h-4 text-slate-300" />
        </button>

        <button
          onClick={onToggleFullscreen}
          className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
          title={isFullscreen ? 'Salir de pantalla completa (F)' : 'Pantalla completa (F)'}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};
