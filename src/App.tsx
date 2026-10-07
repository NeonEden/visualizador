import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AudioBands, AudioEngine, AudioSourceType, AudioStatsSnapshot } from './audio/AudioEngine';
import { VisualizerRenderer } from './visualizer/VisualizerRenderer';
import { PRESET_PALETTES, RenderSettings, VISUALIZER_STYLES, VisualizerStyleId } from './visualizer/types';
import { TopNav } from './components/TopNav';
import { AudioSourceSelector } from './components/AudioSourceSelector';
import { VisualizerControls } from './components/VisualizerControls';
import { AIDirectorPanel } from './components/AIDirectorPanel';
import { AudioEqualizerHud } from './components/AudioEqualizerHud';
import { requestAIDirectorDecision } from './services/aiService';
import { Sparkles, Music, Play, EyeOff, Eye } from 'lucide-react';

const DEFAULT_SETTINGS: RenderSettings = {
  intensity: 1.0,
  bassBoost: 1.1,
  speed: 1.0,
  glowAmount: 1.0,
  trailPersistence: 0.18,
  cameraShake: true,
  edgeParticlesEnabled: true,
  edgeParticlesDensity: 22,
  edgeParticlesColorMode: 'palette',
  edgeParticlesSpeed: 1.1,
  edgeParticlesShape: 'comet',
  resolutionScale: 1.0,
  targetFps: 60,
  particleCountMultiplier: 1.0,
  enableBloom: true,
  activeStyle: 'cyber_grid',
  palette: PRESET_PALETTES[0],
  aiDirectorEnabled: false,
  aiVibePreference: 'auto',
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioEngineRef = useRef<AudioEngine | null>(null);
  const rendererRef = useRef<VisualizerRenderer | null>(null);

  // Settings State
  const [settings, setSettings] = useState<RenderSettings>(DEFAULT_SETTINGS);

  // Modals / Panels
  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
  const [isControlsOpen, setIsControlsOpen] = useState(false);
  const [isAIDirectorOpen, setIsAIDirectorOpen] = useState(false);

  // Source & Audio State
  const [sourceType, setSourceType] = useState<AudioSourceType>('none');
  const [sourceName, setSourceName] = useState('Sin fuente');
  const [currentFps, setCurrentFps] = useState(60);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Live Bands for UI Meters
  const [liveBands, setLiveBands] = useState<AudioBands>({
    subBass: 0,
    bass: 0,
    lowMid: 0,
    mid: 0,
    highMid: 0,
    treble: 0,
    overallEnergy: 0,
    beatDetected: false,
    beatIntensity: 0,
    bpmEstimate: 120,
    beatPhase: 0,
    spectralFlux: 0,
    vocalPresence: 0,
    spectralCentroid: 1000,
  });

  // AI Auto-Pilot State
  const [audioSnapshot, setAudioSnapshot] = useState<AudioStatsSnapshot | null>(null);
  const [lastAIInterpretation, setLastAIInterpretation] = useState<string | null>(null);
  const [detectedMood, setDetectedMood] = useState<string | null>(null);
  const [isAIThinking, setIsAIThinking] = useState(false);
  const lastAIDecisionTimeRef = useRef<number>(0);

  // Minimal UI Auto-Hiding on Idle
  const [isUIHidden, setIsUIHidden] = useState(false);
  const [isIdleHidden, setIsIdleHidden] = useState(false);
  const idleTimeoutRef = useRef<number | null>(null);

  const resetIdleTimer = useCallback(() => {
    setIsIdleHidden(false);
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
    }
    // Auto-hide UI controls after 3.8 seconds of mouse inactivity
    idleTimeoutRef.current = window.setTimeout(() => {
      if (!isControlsOpen && !isSourceModalOpen && !isAIDirectorOpen) {
        setIsIdleHidden(true);
      }
    }, 3800);
  }, [isControlsOpen, isSourceModalOpen, isAIDirectorOpen]);

  // Initialize AudioEngine and VisualizerRenderer
  useEffect(() => {
    const audioEngine = new AudioEngine();
    audioEngineRef.current = audioEngine;

    if (canvasRef.current) {
      const renderer = new VisualizerRenderer(canvasRef.current, settings);
      rendererRef.current = renderer;

      const handleResize = () => {
        if (canvasRef.current && rendererRef.current) {
          rendererRef.current.resize(window.innerWidth, window.innerHeight);
        }
      };

      handleResize();
      window.addEventListener('resize', handleResize);

      // Main Render Loop
      let animationFrameId: number;
      let lastUiUpdateTime = 0;

      const loop = (time: number) => {
        const bands = audioEngine.getAnalysis();
        const rawFrequencies = audioEngine.getRawFrequencies();
        const rawWaveform = audioEngine.getRawWaveform();

        renderer.render(bands, rawFrequencies, rawWaveform, time);

        // Periodically update UI meters and FPS at ~10-12Hz (every 85ms) for ultra-low React CPU overhead
        if (time - lastUiUpdateTime > 85) {
          lastUiUpdateTime = time;
          setLiveBands(bands);
          setCurrentFps(renderer.getFps());
        }

        // Trigger AI Director auto-pilot periodically (every 45s when active to respect API quotas)
        if (settings.aiDirectorEnabled && audioEngine.getSourceInfo().isRunning) {
          const now = Date.now();
          if (now - lastAIDecisionTimeRef.current > 45000) {
            lastAIDecisionTimeRef.current = now;
            const snapshot = audioEngine.getSnapshotForAI();
            setAudioSnapshot(snapshot);
            setIsAIThinking(true);

            requestAIDirectorDecision(snapshot, settings.activeStyle, settings.aiVibePreference)
              .then((aiResult) => {
                setLastAIInterpretation(aiResult.aiInterpretation);
                setDetectedMood(aiResult.moodLabel);
                setSettings((prev) => {
                  const paletteColors: [string, string, string, string] = [
                    aiResult.paletteColors[0] || prev.palette.colors[0],
                    aiResult.paletteColors[1] || prev.palette.colors[1],
                    aiResult.paletteColors[2] || prev.palette.colors[2],
                    aiResult.paletteColors[3] || prev.palette.colors[3],
                  ];
                  return {
                    ...prev,
                    activeStyle: aiResult.suggestedStyle || prev.activeStyle,
                    speed: Math.max(0.7, Math.min(2.0, aiResult.speedMultiplier || prev.speed)),
                    glowAmount: Math.max(0.6, Math.min(1.8, aiResult.bloomIntensity || prev.glowAmount)),
                    palette: {
                      id: `ai_${Date.now()}`,
                      name: aiResult.paletteName || 'IA Adaptativa',
                      colors: paletteColors,
                      backgroundGradient: prev.palette.backgroundGradient,
                    },
                  };
                });
              })
              .catch((err) => console.error('Auto-director error:', err))
              .finally(() => setIsAIThinking(false));
          }
        }

        animationFrameId = requestAnimationFrame(loop);
      };

      animationFrameId = requestAnimationFrame(loop);

      return () => {
        window.removeEventListener('resize', handleResize);
        cancelAnimationFrame(animationFrameId);
        audioEngine.stopCurrentSource();
      };
    }
  }, []);

  // Sync settings with renderer
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.updateSettings(settings);
      if (canvasRef.current) {
        rendererRef.current.resize(window.innerWidth, window.innerHeight);
      }
    }
  }, [settings]);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in prompt textarea
      if ((e.target as HTMLElement)?.tagName === 'TEXTAREA' || (e.target as HTMLElement)?.tagName === 'INPUT') {
        return;
      }

      resetIdleTimer();

      switch (e.key.toLowerCase()) {
        case 'f':
          toggleFullscreen();
          break;
        case 'h':
          setIsUIHidden((prev) => !prev);
          break;
        case 'a':
          setSettings((prev) => ({ ...prev, aiDirectorEnabled: !prev.aiDirectorEnabled }));
          break;
        case ' ':
          e.preventDefault();
          // Toggle demo synth or prompt source
          if (sourceType === 'none') {
            setIsSourceModalOpen(true);
          }
          break;
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8': {
          const idx = parseInt(e.key, 10) - 1;
          if (VISUALIZER_STYLES[idx]) {
            setSettings((prev) => ({ ...prev, activeStyle: VISUALIZER_STYLES[idx].id }));
          }
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleFullscreen, resetIdleTimer, sourceType]);

  const [inputSensitivity, setInputSensitivity] = useState(1.6);
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);

  // Periodically refresh hardware input audio devices
  useEffect(() => {
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then((devs) => {
        setAvailableDevices(devs.filter((d) => d.kind === 'audioinput'));
      }).catch(() => {});
    }
  }, []);

  // Audio source handlers
  const handleCaptureTab = async () => {
    if (!audioEngineRef.current) return;
    await audioEngineRef.current.captureTabAudio();
    const info = audioEngineRef.current.getSourceInfo();
    setSourceType(info.type);
    setSourceName(info.name);
  };

  const handleCaptureMic = async (deviceId?: string, label?: string) => {
    if (!audioEngineRef.current) return;
    await audioEngineRef.current.captureMicrophone(deviceId, label);
    const info = audioEngineRef.current.getSourceInfo();
    setSourceType(info.type);
    setSourceName(info.name);
  };

  const handleGetAvailableDevices = useCallback(async () => {
    if (!audioEngineRef.current) return [];
    const devs = await audioEngineRef.current.getAudioInputDevices();
    setAvailableDevices(devs);
    return devs;
  }, []);

  const handleSetSensitivity = (val: number) => {
    setInputSensitivity(val);
    if (audioEngineRef.current) {
      audioEngineRef.current.setInputSensitivity(val);
    }
  };

  const handleUploadFile = async (file: File) => {
    if (!audioEngineRef.current) return;
    await audioEngineRef.current.loadAudioFile(file);
    const info = audioEngineRef.current.getSourceInfo();
    setSourceType(info.type);
    setSourceName(info.name);
  };

  const handlePlayDemo = async (type: 'synthwave' | 'ambient' | 'edm' | 'lofi' | 'techno') => {
    if (!audioEngineRef.current) return;
    await audioEngineRef.current.playDemoSynth(type);
    const info = audioEngineRef.current.getSourceInfo();
    setSourceType(info.type);
    setSourceName(info.name);
  };

  const handleStopSource = () => {
    if (!audioEngineRef.current) return;
    audioEngineRef.current.stopCurrentSource();
    setSourceType('none');
    setSourceName('Ninguna fuente conectada');
  };

  const handleSelectStyle = (styleId: VisualizerStyleId) => {
    setSettings((prev) => ({ ...prev, activeStyle: styleId }));
  };

  const handleTriggerAIDirectorNow = useCallback(async () => {
    if (!audioEngineRef.current) return;
    const snapshot = audioEngineRef.current.getSnapshotForAI();
    setAudioSnapshot(snapshot);
    setIsAIThinking(true);
    try {
      const aiResult = await requestAIDirectorDecision(snapshot, settings.activeStyle, settings.aiVibePreference);
      setLastAIInterpretation(aiResult.aiInterpretation);
      setDetectedMood(aiResult.moodLabel);
      setSettings((prev) => ({
        ...prev,
        activeStyle: aiResult.suggestedStyle || prev.activeStyle,
        speed: Math.max(0.7, Math.min(2.0, aiResult.speedMultiplier || prev.speed)),
        glowAmount: Math.max(0.6, Math.min(1.8, aiResult.bloomIntensity || prev.glowAmount)),
        palette: {
          id: `ai_${Date.now()}`,
          name: aiResult.paletteName || 'IA Adaptativa',
          colors: [
            aiResult.paletteColors[0] || prev.palette.colors[0],
            aiResult.paletteColors[1] || prev.palette.colors[1],
            aiResult.paletteColors[2] || prev.palette.colors[2],
            aiResult.paletteColors[3] || prev.palette.colors[3],
          ],
          backgroundGradient: prev.palette.backgroundGradient,
        },
      }));
    } catch (err) {
      console.error('AI Director manual trigger error:', err);
    } finally {
      setIsAIThinking(false);
    }
  }, [settings.activeStyle, settings.aiVibePreference]);

  const shouldShowUI = !isUIHidden && !isIdleHidden;

  const [isDraggingFile, setIsDraggingFile] = useState(false);

  // Drag and Drop Audio File onto Window
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type.startsWith('audio/') || file.name.match(/\.(mp3|wav|flac|ogg|aac|m4a)$/i))) {
      await handleUploadFile(file);
    }
  };

  return (
    <div
      className="relative w-screen h-screen overflow-hidden bg-black text-white"
      onMouseMove={resetIdleTimer}
      onClick={resetIdleTimer}
      onTouchStart={resetIdleTimer}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag & Drop Overlay */}
      {isDraggingFile && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md border-2 border-dashed border-cyan-400 p-6 pointer-events-none">
          <div className="text-center space-y-2">
            <Music className="w-12 h-12 text-cyan-400 mx-auto animate-bounce" />
            <h3 className="text-lg font-bold text-white font-display">Suelta tu archivo de audio aquí</h3>
            <p className="text-xs text-slate-400">MP3, WAV, FLAC, OGG, AAC para reproducir y visualizar al instante</p>
          </div>
        </div>
      )}
      {/* Visualizer Canvas (Hardware accelerated) */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block cursor-none"
      />

      {/* Welcome / Quick Start Overlay if no audio source is active */}
      {sourceType === 'none' && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-6 bg-black/60 backdrop-blur-xs pointer-events-none">
          <div className="max-w-md w-full text-center space-y-4 pointer-events-auto bg-neutral-900/90 border border-white/10 p-8 rounded-3xl shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mx-auto">
              <Music className="w-7 h-7 animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-display text-white">PulseWave AI</h1>
              <p className="text-xs text-slate-400 mt-1">
                Visualizador de música reactivo de alto rendimiento en tiempo real con inteligencia artificial.
              </p>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={() => setIsSourceModalOpen(true)}
                className="w-full py-3 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-sm transition-all shadow-lg hover:shadow-cyan-500/25 flex items-center justify-center gap-2"
              >
                <Music className="w-4 h-4" />
                <span>Conectar Música (Pestaña / Mic / Archivo)</span>
              </button>

              <button
                onClick={() => handlePlayDemo('synthwave')}
                className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 font-medium text-xs transition-colors flex items-center justify-center gap-2"
              >
                <Play className="w-3.5 h-3.5 text-pink-400" />
                <span>Probar con Demo Synthwave (126 BPM)</span>
              </button>
            </div>

            <div className="text-[11px] text-slate-500 flex items-center justify-center gap-2 pt-2 border-t border-white/5">
              <span>Atajos: [F] Pantalla Completa · [1-8] Estilos · [H] Ocultar UI</span>
            </div>
          </div>
        </div>
      )}

      {/* Floating UI Elements (Smoothly fade on idle or explicit hide) */}
      <div
        className={`transition-opacity duration-300 ${
          shouldShowUI ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <TopNav
          sourceType={sourceType}
          sourceName={sourceName}
          onOpenSourceModal={() => setIsSourceModalOpen(true)}
          onOpenControls={() => setIsControlsOpen(true)}
          onOpenAIDirector={() => setIsAIDirectorOpen(true)}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
          aiDirectorActive={settings.aiDirectorEnabled}
          fps={currentFps}
          liveEnergy={liveBands.overallEnergy}
          availableDevices={availableDevices}
          onSelectCaptureTab={handleCaptureTab}
          onSelectCaptureMic={handleCaptureMic}
          onSelectPlayDemo={handlePlayDemo}
          onSelectUploadFile={handleUploadFile}
          onStopSource={handleStopSource}
        />

        <AudioEqualizerHud
          bands={liveBands}
          activeStyle={settings.activeStyle}
          palette={settings.palette}
          onSelectStyle={handleSelectStyle}
          bpm={liveBands.bpmEstimate}
        />
      </div>

      {/* Manual UI Reveal Indicator when hidden */}
      {!shouldShowUI && (
        <button
          onClick={() => {
            setIsUIHidden(false);
            setIsIdleHidden(false);
          }}
          className="fixed bottom-4 right-4 z-40 p-2.5 rounded-full bg-black/60 hover:bg-black/80 text-white/60 hover:text-white border border-white/10 backdrop-blur-md transition-all"
          title="Mostrar interfaz (H)"
        >
          <Eye className="w-4 h-4" />
        </button>
      )}

      {/* Audio Source Connection Modal */}
      <AudioSourceSelector
        isOpen={isSourceModalOpen}
        onClose={() => setIsSourceModalOpen(false)}
        sourceType={sourceType}
        sourceName={sourceName}
        onCaptureTab={handleCaptureTab}
        onCaptureMic={handleCaptureMic}
        onUploadFile={handleUploadFile}
        onPlayDemo={handlePlayDemo}
        onStop={handleStopSource}
        getAvailableDevices={handleGetAvailableDevices}
        inputSensitivity={inputSensitivity}
        onSetSensitivity={handleSetSensitivity}
        liveSignalLevel={liveBands.overallEnergy}
      />

      {/* Customization Controls Sidebar Drawer */}
      <VisualizerControls
        isOpen={isControlsOpen}
        onClose={() => setIsControlsOpen(false)}
        settings={settings}
        onUpdateSettings={setSettings}
        onResetDefaults={() => setSettings(DEFAULT_SETTINGS)}
      />

      {/* Real-time AI Director & Prompt-to-Style Generator Drawer */}
      <AIDirectorPanel
        isOpen={isAIDirectorOpen}
        onClose={() => setIsAIDirectorOpen(false)}
        settings={settings}
        onUpdateSettings={setSettings}
        audioSnapshot={audioSnapshot}
        lastAIInterpretation={lastAIInterpretation}
        detectedMood={detectedMood}
        isAIThinking={isAIThinking}
        onTriggerAIDirectorNow={handleTriggerAIDirectorNow}
      />
    </div>
  );
}
