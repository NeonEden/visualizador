import React from 'react';
import {
  Sliders,
  Sparkles,
  Zap,
  Gauge,
  Palette,
  Eye,
  Activity,
  Layers,
  Check,
  RotateCcw,
  X
} from 'lucide-react';
import {
  ColorPalette,
  PRESET_PALETTES,
  RenderSettings,
  VISUALIZER_STYLES,
  VisualizerStyleId
} from '../visualizer/types';

interface VisualizerControlsProps {
  isOpen: boolean;
  onClose: () => void;
  settings: RenderSettings;
  onUpdateSettings: (updater: (prev: RenderSettings) => RenderSettings) => void;
  onResetDefaults: () => void;
}

export const VisualizerControls: React.FC<VisualizerControlsProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onResetDefaults,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-neutral-950/95 border-l border-white/10 shadow-2xl backdrop-blur-xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
        <div className="flex items-center gap-2.5">
          <Sliders className="w-4 h-4 text-cyan-400" />
          <h2 className="text-base font-semibold text-white font-display">Personalizar Visuales</h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onResetDefaults}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors text-xs flex items-center gap-1"
            title="Restablecer valores predeterminados"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[11px]">Restablecer</span>
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Settings Scrollable Content */}
      <div className="p-6 overflow-y-auto space-y-7 flex-1">
        {/* 1. Visualizer Style Selector */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              Estilo Visual Activo
            </label>
            <span className="text-[11px] text-cyan-400 font-mono">
              {VISUALIZER_STYLES.find((s) => s.id === settings.activeStyle)?.gpuLoad} GPU
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {VISUALIZER_STYLES.map((style) => {
              const isActive = settings.activeStyle === style.id;
              return (
                <button
                  key={style.id}
                  onClick={() =>
                    onUpdateSettings((prev) => ({
                      ...prev,
                      activeStyle: style.id,
                    }))
                  }
                  className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                    isActive
                      ? 'bg-cyan-500/15 border-cyan-400 text-white shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                      : 'bg-white/[0.03] border-white/10 text-slate-300 hover:bg-white/[0.07] hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-semibold">{style.name}</span>
                    {isActive && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 line-clamp-1">{style.category}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Color Palettes */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-3">
            <Palette className="w-3.5 h-3.5 text-purple-400" />
            Paleta de Colores
          </label>
          <div className="grid grid-cols-2 gap-2">
            {PRESET_PALETTES.map((pal) => {
              const isSelected = settings.palette.id === pal.id;
              return (
                <button
                  key={pal.id}
                  onClick={() =>
                    onUpdateSettings((prev) => ({
                      ...prev,
                      palette: pal,
                    }))
                  }
                  className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-purple-500/15 border-purple-400 text-white shadow-[0_0_15px_rgba(168,85,247,0.2)]'
                      : 'bg-white/[0.03] border-white/10 text-slate-300 hover:bg-white/[0.07]'
                  }`}
                >
                  <span className="text-xs font-medium truncate">{pal.name}</span>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    {pal.colors.map((c, i) => (
                      <span
                        key={i}
                        className="w-2.5 h-2.5 rounded-full border border-black/30"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Dynamics & Intensity Sliders */}
        <div className="space-y-4">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            Dinámica y Sensibilidad
          </label>

          {/* Intensity Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300">Intensidad General</span>
              <span className="text-cyan-400 font-mono font-medium">{Math.round(settings.intensity * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.2"
              step="0.05"
              value={settings.intensity}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                onUpdateSettings((prev) => ({ ...prev, intensity: val }));
              }}
              className="w-full"
            />
          </div>

          {/* Bass Reactivity / Kick Punch */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300">Refuerzo de Graves (Sub-Bass)</span>
              <span className="text-emerald-400 font-mono font-medium">{settings.bassBoost.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.5"
              step="0.1"
              value={settings.bassBoost}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                onUpdateSettings((prev) => ({ ...prev, bassBoost: val }));
              }}
              className="w-full"
            />
          </div>

          {/* Animation Flow Speed */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300">Velocidad de Flujo</span>
              <span className="text-purple-400 font-mono font-medium">{settings.speed.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.2"
              step="0.1"
              value={settings.speed}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                onUpdateSettings((prev) => ({ ...prev, speed: val }));
              }}
              className="w-full"
            />
          </div>

          {/* Glow / Bloom Amount */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300">Brillo / Resplandor Neón</span>
              <span className="text-amber-400 font-mono font-medium">{Math.round(settings.glowAmount * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="2.0"
              step="0.1"
              value={settings.glowAmount}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                onUpdateSettings((prev) => ({ ...prev, glowAmount: val }));
              }}
              className="w-full"
            />
          </div>

          {/* Trail Persistence */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300">Persistencia de Estela (Motion Blur)</span>
              <span className="text-slate-400 font-mono font-medium">{Math.round(settings.trailPersistence * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.05"
              max="0.40"
              step="0.02"
              value={settings.trailPersistence}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                onUpdateSettings((prev) => ({ ...prev, trailPersistence: val }));
              }}
              className="w-full"
            />
          </div>

          {/* Camera Shake on Bass Kick */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-slate-300">Pulso / Sacudida en Golpes de Graves</span>
            <button
              onClick={() =>
                onUpdateSettings((prev) => ({
                  ...prev,
                  cameraShake: !prev.cameraShake,
                }))
              }
              className={`w-11 h-6 rounded-full transition-colors relative ${
                settings.cameraShake ? 'bg-cyan-500' : 'bg-white/10'
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  settings.cameraShake ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* 4. Sub-Bass Edge Particles System (Bordes Reactivos) */}
        <div className="p-4 rounded-2xl bg-cyan-950/20 border border-cyan-500/30 space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              Partículas de Sub-Bajos (Bordes)
            </label>
            <button
              onClick={() =>
                onUpdateSettings((prev) => ({
                  ...prev,
                  edgeParticlesEnabled: !prev.edgeParticlesEnabled,
                }))
              }
              className={`w-11 h-6 rounded-full transition-colors relative ${
                settings.edgeParticlesEnabled ? 'bg-cyan-500' : 'bg-white/10'
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  settings.edgeParticlesEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          <p className="text-xs text-cyan-200/70">
            Ráfagas de partículas reactivas que surgen velozmente desde los 4 bordes del canvas hacia el centro en cada golpe de sub-graves.
          </p>

          {settings.edgeParticlesEnabled && (
            <div className="space-y-4 pt-1">
              {/* Density Slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300">Densidad por Golpe (Partículas)</span>
                  <span className="text-cyan-400 font-mono font-medium">{settings.edgeParticlesDensity}</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="70"
                  step="5"
                  value={settings.edgeParticlesDensity}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    onUpdateSettings((prev) => ({ ...prev, edgeParticlesDensity: val }));
                  }}
                  className="w-full"
                />
              </div>

              {/* Color Mode Selector */}
              <div className="space-y-1.5">
                <span className="text-xs text-slate-300 block">Esquema de Color de Partículas</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { id: 'palette', name: 'Paleta Activa', desc: 'Auto-sincronizado' },
                    { id: 'cyber', name: 'Neón Cyber', desc: 'Cyan y Magenta' },
                    { id: 'solar', name: 'Fuego Solar', desc: 'Dorado y Lava' },
                    { id: 'plasma', name: 'Plasma UV', desc: 'Violeta e Índigo' },
                    { id: 'emerald', name: 'Esmeralda', desc: 'Verde Eléctrico' },
                    { id: 'white', name: 'Blanco Estelar', desc: 'Puro y Brillante' },
                    { id: 'rainbow', name: 'Arcoíris', desc: 'Espectro Completo' },
                  ].map((cm) => (
                    <button
                      key={cm.id}
                      onClick={() =>
                        onUpdateSettings((prev) => ({
                          ...prev,
                          edgeParticlesColorMode: cm.id as any,
                        }))
                      }
                      className={`p-2 rounded-xl text-left border transition-all ${
                        settings.edgeParticlesColorMode === cm.id
                          ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-sm'
                          : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      <div className="text-xs font-semibold">{cm.name}</div>
                      <div className="text-[10px] text-slate-400">{cm.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Particle Shape / Style */}
              <div className="space-y-1.5">
                <span className="text-xs text-slate-300 block">Estilo de Partícula</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'comet', label: 'Cometas' },
                    { id: 'plasma', label: 'Orbes Plasma' },
                    { id: 'spark', label: 'Chispas' },
                  ].map((sh) => (
                    <button
                      key={sh.id}
                      onClick={() =>
                        onUpdateSettings((prev) => ({
                          ...prev,
                          edgeParticlesShape: sh.id as any,
                        }))
                      }
                      className={`py-1.5 text-xs font-medium rounded-xl border text-center transition-colors ${
                        settings.edgeParticlesShape === sh.id
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                          : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'
                      }`}
                    >
                      {sh.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Speed Slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300">Velocidad de Incursión</span>
                  <span className="text-cyan-400 font-mono font-medium">{settings.edgeParticlesSpeed.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.6"
                  max="2.5"
                  step="0.1"
                  value={settings.edgeParticlesSpeed}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    onUpdateSettings((prev) => ({ ...prev, edgeParticlesSpeed: val }));
                  }}
                  className="w-full"
                />
              </div>
            </div>
          )}
        </div>

        {/* 5. GPU Optimization & Eco Mode (Low-End Friendly) */}
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-4">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-cyan-400" />
              Optimización de Rendimiento GPU
            </span>
            <span className="text-[10px] text-emerald-400 font-medium">Bajo Consumo</span>
          </label>

          {/* Resolution Scale */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300">Escala de Renderizado</span>
              <span className="text-slate-400 font-mono">
                {settings.resolutionScale === 0.5
                  ? '50% (Modo Eco / Batería)'
                  : settings.resolutionScale === 0.75
                  ? '75% (Equilibrado)'
                  : settings.resolutionScale === 1.0
                  ? '100% (Nativo)'
                  : '150% (Ultra Alta Definición)'}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { val: 0.5, label: '0.5x' },
                { val: 0.75, label: '0.75x' },
                { val: 1.0, label: '1.0x' },
                { val: 1.5, label: '1.5x' },
              ].map((item) => (
                <button
                  key={item.val}
                  onClick={() =>
                    onUpdateSettings((prev) => ({
                      ...prev,
                      resolutionScale: item.val,
                    }))
                  }
                  className={`py-1 text-xs font-medium rounded-lg border transition-colors ${
                    settings.resolutionScale === item.val
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400'
                      : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Particle Density */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300">Densidad de Partículas</span>
              <span className="text-slate-400 font-mono">{Math.round(settings.particleCountMultiplier * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.3"
              max="1.5"
              step="0.1"
              value={settings.particleCountMultiplier}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                onUpdateSettings((prev) => ({ ...prev, particleCountMultiplier: val }));
              }}
              className="w-full"
            />
          </div>

          {/* Bloom Shader toggle */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-slate-300">Resplandor por Sombreador (Bloom)</span>
            <button
              onClick={() =>
                onUpdateSettings((prev) => ({
                  ...prev,
                  enableBloom: !prev.enableBloom,
                }))
              }
              className={`w-11 h-6 rounded-full transition-colors relative ${
                settings.enableBloom ? 'bg-cyan-500' : 'bg-white/10'
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  settings.enableBloom ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
