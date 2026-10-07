import React, { useEffect, useRef, useState } from 'react';
import {
  Monitor,
  Mic,
  Upload,
  Play,
  Volume2,
  X,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Headphones,
  Sliders,
  Sparkles,
  ExternalLink,
  Info
} from 'lucide-react';
import { AudioSourceType } from '../audio/AudioEngine';

interface AudioSourceSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  sourceType: AudioSourceType;
  sourceName: string;
  onCaptureTab: () => Promise<void>;
  onCaptureMic: (deviceId?: string, label?: string) => Promise<void>;
  onUploadFile: (file: File) => Promise<void>;
  onPlayDemo: (type: 'synthwave' | 'ambient' | 'edm' | 'lofi' | 'techno') => Promise<void>;
  onStop: () => void;
  getAvailableDevices: () => Promise<MediaDeviceInfo[]>;
  inputSensitivity: number;
  onSetSensitivity: (val: number) => void;
  liveSignalLevel: number;
}

export const AudioSourceSelector: React.FC<AudioSourceSelectorProps> = ({
  isOpen,
  onClose,
  sourceType,
  sourceName,
  onCaptureTab,
  onCaptureMic,
  onUploadFile,
  onPlayDemo,
  onStop,
  getAvailableDevices,
  inputSensitivity,
  onSetSensitivity,
  liveSignalLevel,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'connect' | 'spotify_guide'>('connect');

  useEffect(() => {
    if (isOpen) {
      getAvailableDevices().then((devs) => {
        setDevices(devs);
        if (devs.length > 0 && !selectedDeviceId) {
          setSelectedDeviceId(devs[0].deviceId);
        }
      });
    }
  }, [isOpen, getAvailableDevices, selectedDeviceId]);

  if (!isOpen) return null;

  const handleTabCapture = async () => {
    try {
      setLoading('tab');
      setErrorMessage(null);
      await onCaptureTab();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al capturar audio de pestaña/sistema');
    } finally {
      setLoading(null);
    }
  };

  const handleMicCapture = async () => {
    try {
      setLoading('mic');
      setErrorMessage(null);
      const chosen = devices.find((d) => d.deviceId === selectedDeviceId);
      await onCaptureMic(selectedDeviceId || undefined, chosen?.label || 'Micrófono / Entrada');
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al acceder al micrófono o dispositivo');
    } finally {
      setLoading(null);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setLoading('file');
      setErrorMessage(null);
      await onUploadFile(file);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al reproducir archivo');
    } finally {
      setLoading(null);
    }
  };

  const handleDemoPlay = async (type: 'synthwave' | 'ambient' | 'edm' | 'lofi' | 'techno') => {
    try {
      setLoading(type);
      setErrorMessage(null);
      await onPlayDemo(type);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al generar sintetizador');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-neutral-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header with Navigation Tabs */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Headphones className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white font-display">Conectar Fuente de Música</h2>
              <div className="flex items-center gap-3 mt-0.5">
                <button
                  onClick={() => setActiveTab('connect')}
                  className={`text-xs transition-colors ${
                    activeTab === 'connect' ? 'text-cyan-400 font-semibold underline underline-offset-4' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Opciones de Captura
                </button>
                <span className="text-slate-600">·</span>
                <button
                  onClick={() => setActiveTab('spotify_guide')}
                  className={`text-xs flex items-center gap-1 transition-colors ${
                    activeTab === 'spotify_guide' ? 'text-emerald-400 font-semibold underline underline-offset-4' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Guía de Spotify & PC
                </button>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Scrollable */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {errorMessage && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-red-200">No se pudo recibir el audio:</p>
                <p>{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Active Live Signal Level Monitor */}
          {sourceType !== 'none' && (
            <div className="p-3.5 rounded-2xl bg-cyan-950/20 border border-cyan-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs text-slate-300">Fuente Activa: <strong className="text-white">{sourceName}</strong></span>
                </div>
                <button
                  onClick={onStop}
                  className="px-2.5 py-1 text-xs font-medium text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg transition-colors"
                >
                  Desconectar
                </button>
              </div>

              {/* Live Signal VU Meter */}
              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                  <span>Nivel de Señal Recibida:</span>
                  <span className={liveSignalLevel > 0.05 ? 'text-cyan-300' : 'text-slate-500'}>
                    {liveSignalLevel > 0.05 ? `${Math.round(liveSignalLevel * 100)}% (Señal Detectada)` : '0% (Sin Audio o Pausado)'}
                  </span>
                </div>
                <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden border border-white/10">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 via-emerald-400 to-pink-500 transition-all duration-75"
                    style={{ width: `${Math.min(100, Math.max(0, liveSignalLevel * 100))}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'spotify_guide' ? (
            /* SPOTIFY & PC SOUND CONFIGURATION GUIDE */
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 space-y-2">
                <div className="flex items-center gap-2 text-emerald-300 font-semibold text-sm">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  ¿Cómo hacer que el visualizador escuche Spotify en tu PC?
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Hay 2 formas 100% efectivas para capturar el sonido de Spotify en tu navegador:
                </p>
              </div>

              <div className="space-y-3 text-xs">
                {/* Method 1 */}
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-white">
                    <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center text-[11px] font-mono">1</span>
                    <span>Método A (Más Fácil & Calidad Digital Pura): Spotify Web</span>
                  </div>
                  <p className="text-slate-300 pl-7">
                    1. Abre <a href="https://open.spotify.com" target="_blank" rel="noreferrer" className="text-cyan-400 underline font-medium">open.spotify.com</a> en otra pestaña de tu navegador y pon tu música.<br/>
                    2. Vuelve a esta app y haz clic en el botón <strong className="text-white">"Pestaña / PC"</strong>.<br/>
                    3. Selecciona la pestaña de Spotify y <strong className="text-emerald-300">marca la casilla "Compartir audio de la pestaña"</strong>.
                  </p>
                </div>

                {/* Method 2 */}
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-white">
                    <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center text-[11px] font-mono">2</span>
                    <span>Método B: App de Escritorio de Spotify en Windows</span>
                  </div>
                  <p className="text-slate-300 pl-7">
                    1. Haz clic en <strong className="text-white">"Pestaña / PC"</strong>.<br/>
                    2. En la ventana del navegador, haz clic en la pestaña <strong className="text-purple-300">"Toda la pantalla"</strong> (no "Ventana").<br/>
                    3. En la esquina inferior izquierda, <strong className="text-emerald-300">activa la casilla "Compartir audio del sistema"</strong>.<br/>
                    4. ¡Listo! Todo lo que suene en tu PC (Spotify, juegos, Discord, navegador) alimentará el visualizador.
                  </p>
                </div>

                {/* Method 3 */}
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-white">
                    <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center text-[11px] font-mono">3</span>
                    <span>Método C: Mezcla Estéreo (Stereo Mix) en Windows</span>
                  </div>
                  <p className="text-slate-300 pl-7">
                    Si tienes activado "Mezcla estéreo" (Stereo Mix) en Windows Sound Settings, puedes seleccionarlo directamente en la pestaña de <strong className="text-white">"Micrófono / Entrada"</strong> para capturar el audio interno sin compartir pantalla.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setActiveTab('connect')}
                className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs transition-colors"
              >
                Volver a Conectar Audio
              </button>
            </div>
          ) : (
            /* REGULAR CONNECT OPTIONS */
            <>
              {/* Primary Capture Grid */}
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-3">
                  1. Capturar Audio de tu PC o Pestaña
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Option 1: Tab / Screen */}
                  <button
                    onClick={handleTabCapture}
                    disabled={loading !== null}
                    className="flex flex-col items-start p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 hover:border-cyan-500/50 transition-all text-left group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-3 group-hover:scale-105 transition-transform">
                      <Monitor className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-semibold text-white group-hover:text-cyan-300 transition-colors">
                      Pestaña / PC
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Spotify, YouTube, Google Flow o sonido del sistema.
                    </p>
                    <span className="mt-3 text-[11px] text-cyan-400 font-medium">
                      {loading === 'tab' ? 'Capturando...' : 'Conectar pestaña →'}
                    </span>
                  </button>

                  {/* Option 2: Mic / Stereo Mix */}
                  <div className="flex flex-col items-start p-4 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-purple-500/50 transition-all text-left">
                    <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-3">
                      <Mic className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-semibold text-white">
                      Entrada / Mezcla Estéreo
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Micrófono o salida directa Stereo Mix de Windows.
                    </p>

                    {devices.length > 0 && (
                      <select
                        value={selectedDeviceId}
                        onChange={(e) => setSelectedDeviceId(e.target.value)}
                        className="w-full mt-2 p-1.5 text-[11px] bg-black/60 border border-white/15 rounded-lg text-slate-200 truncate focus:outline-none focus:border-purple-400"
                      >
                        {devices.map((dev) => (
                          <option key={dev.deviceId} value={dev.deviceId}>
                            {dev.label || `Entrada de Audio (${dev.deviceId.slice(0, 6)}...)`}
                          </option>
                        ))}
                      </select>
                    )}

                    <button
                      onClick={handleMicCapture}
                      disabled={loading !== null}
                      className="mt-3 text-[11px] text-purple-400 font-medium hover:text-purple-300"
                    >
                      {loading === 'mic' ? 'Iniciando...' : 'Activar entrada →'}
                    </button>
                  </div>

                  {/* Option 3: Local File Upload */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading !== null}
                    className="flex flex-col items-start p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 hover:border-emerald-500/50 transition-all text-left group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3 group-hover:scale-105 transition-transform">
                      <Upload className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-semibold text-white group-hover:text-emerald-300 transition-colors">
                      Archivo de Audio
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      MP3, WAV, FLAC, OGG, AAC (o arrastra al visualizador).
                    </p>
                    <span className="mt-3 text-[11px] text-emerald-400 font-medium">
                      {loading === 'file' ? 'Cargando...' : 'Elegir archivo →'}
                    </span>
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              {/* Pre-Amp Gain / Sensitivity slider */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                    Sensibilidad de Entrada (Pre-Amplificador)
                  </span>
                  <span className="text-cyan-400 font-mono font-semibold">{inputSensitivity.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="3.5"
                  step="0.1"
                  value={inputSensitivity}
                  onChange={(e) => onSetSensitivity(parseFloat(e.target.value))}
                  className="w-full"
                />
                <span className="text-[11px] text-slate-500 block">
                  Aumenta este valor si tu música suena a volumen moderado o bajo para maximizar la respuesta visual.
                </span>
              </div>

              {/* Procedural Synths for Instant Testing */}
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-3">
                  2. Demos Sintetizadas Instantáneas
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { id: 'synthwave', name: 'Synthwave', bpm: '126 BPM' },
                    { id: 'edm', name: 'EDM Bass', bpm: '130 BPM' },
                    { id: 'lofi', name: 'Lo-Fi Chill', bpm: '82 BPM' },
                    { id: 'techno', name: 'Dark Techno', bpm: '135 BPM' },
                    { id: 'ambient', name: 'Cosmos Ambient', bpm: '70 BPM' },
                  ].map((demo) => (
                    <button
                      key={demo.id}
                      onClick={() => handleDemoPlay(demo.id as any)}
                      disabled={loading !== null}
                      className="flex flex-col items-center justify-center p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 hover:border-cyan-500/40 transition-all text-center group"
                    >
                      <Play className="w-3.5 h-3.5 text-white mb-1 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-medium text-white">{demo.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{demo.bpm}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
