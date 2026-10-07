import React, { useState } from 'react';
import {
  Sparkles,
  Bot,
  Wand2,
  Cpu,
  Radio,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  Compass,
  Zap
} from 'lucide-react';
import { RenderSettings } from '../visualizer/types';
import { generateStyleFromPrompt } from '../services/aiService';
import { AudioStatsSnapshot } from '../audio/AudioEngine';

interface AIDirectorPanelProps {
  isOpen: boolean;
  onClose: () => void;
  settings: RenderSettings;
  onUpdateSettings: (updater: (prev: RenderSettings) => RenderSettings) => void;
  audioSnapshot: AudioStatsSnapshot | null;
  lastAIInterpretation: string | null;
  detectedMood: string | null;
  isAIThinking: boolean;
  onTriggerAIDirectorNow?: () => void;
}

const QUICK_PROMPTS = [
  'Noche ciberpunk Neo-Tokyo bajo lluvia de neón',
  'Bioluminiscencia en el fondo abisal con medusas cósmicas',
  'Puesta de sol retro synthwave en Miami 1984',
  'Supernova cuántica y agujero negro de plasma',
  'Geometría sagrada psicodélica con prismas de cristal',
  'Estudio de arquitectura minimalista en blanco y azul nórdico',
];

export const AIDirectorPanel: React.FC<AIDirectorPanelProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  audioSnapshot,
  lastAIInterpretation,
  detectedMood,
  isAIThinking,
  onTriggerAIDirectorNow,
}) => {
  const [promptText, setPromptText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [customStyleName, setCustomStyleName] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGeneratePrompt = async (promptToUse?: string) => {
    const text = promptToUse || promptText;
    if (!text.trim()) return;

    try {
      setIsGenerating(true);
      setGenerationError(null);

      const result = await generateStyleFromPrompt(text);

      onUpdateSettings((prev) => ({
        ...prev,
        activeStyle: result.targetVisualizer,
        intensity: result.effects.intensity,
        speed: result.effects.speed,
        bassBoost: result.effects.bassBoost,
        glowAmount: result.effects.glow,
        trailPersistence: result.effects.trailDecay,
        cameraShake: result.effects.cameraShake,
        palette: {
          id: `custom_${Date.now()}`,
          name: result.styleName,
          colors: [
            result.palette[0] || '#00f0ff',
            result.palette[1] || '#ff007f',
            result.palette[2] || '#7928ca',
            result.palette[3] || '#00ffcc',
          ],
          backgroundGradient: ['#06040d', '#020106'],
        },
      }));

      setCustomStyleName(result.styleName);
    } catch (err: any) {
      setGenerationError(err.message || 'Error al generar el estilo con IA');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-neutral-950/95 border-l border-white/10 shadow-2xl backdrop-blur-xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white font-display">Director IA en Tiempo Real</h2>
            <p className="text-xs text-slate-400">Adaptación musical inteligente y generación generativa</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content scrollable */}
      <div className="p-6 overflow-y-auto space-y-6 flex-1">
        {/* 1. Real-time AI Auto-Director Switch */}
        <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/30 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-semibold text-white">Modo Director Automático (Auto-Pilot)</span>
            </div>
            <button
              onClick={() =>
                onUpdateSettings((prev) => ({
                  ...prev,
                  aiDirectorEnabled: !prev.aiDirectorEnabled,
                }))
              }
              className={`w-12 h-6 rounded-full transition-colors relative ${
                settings.aiDirectorEnabled ? 'bg-purple-600' : 'bg-white/10'
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  settings.aiDirectorEnabled ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          <p className="text-xs text-purple-200/70">
            Gemini analiza el flujo de graves, agudos, dinámica y ritmo cada pocos segundos para alternar automáticamente estilos, paletas y velocidades adaptadas al género que suena.
          </p>

          <button
            onClick={() => onTriggerAIDirectorNow?.()}
            disabled={isAIThinking}
            className="w-full py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md transition-all flex items-center justify-center gap-2"
          >
            {isAIThinking ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Analizando música con Gemini...</span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                <span>Ejecutar Análisis Director IA Ahora</span>
              </>
            )}
          </button>

          {settings.aiDirectorEnabled && (
            <div className="flex items-center gap-2 pt-2 border-t border-purple-500/20 text-xs text-purple-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>
                {isAIThinking ? 'Analizando frecuencias...' : `Vibe detectado: ${detectedMood || 'Armónico Electro'}`}
              </span>
            </div>
          )}
        </div>

        {/* 2. Music Diagnostics & Acoustic Profile */}
        <div className="space-y-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-cyan-400" />
            Diagnóstico Acústico en Vivo
          </label>
          <div className="grid grid-cols-3 gap-2">
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 text-center">
              <span className="text-[10px] text-slate-400 uppercase tracking-wide block">Tempo Estimado</span>
              <span className="text-base font-bold font-mono text-cyan-400">
                {audioSnapshot?.tempoEstimate || 120} <span className="text-xs text-slate-400 font-normal">BPM</span>
              </span>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 text-center">
              <span className="text-[10px] text-slate-400 uppercase tracking-wide block">Energía Global</span>
              <span className="text-base font-bold font-mono text-emerald-400">
                {Math.round((audioSnapshot?.energy || 0.5) * 100)}%
              </span>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 text-center">
              <span className="text-[10px] text-slate-400 uppercase tracking-wide block">Impacto Graves</span>
              <span className="text-base font-bold font-mono text-purple-400">
                {Math.round((audioSnapshot?.bassLevel || 0.5) * 100)}%
              </span>
            </div>
          </div>

          {lastAIInterpretation && (
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/10 text-xs text-slate-300 italic">
              "{lastAIInterpretation}"
            </div>
          )}
        </div>

        {/* 3. Prompt-to-Visualizer Style Generator */}
        <div className="space-y-3 pt-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Wand2 className="w-3.5 h-3.5 text-amber-400" />
            Crear Estilo con tu Imaginación (Prompt)
          </label>
          <p className="text-xs text-slate-400">
            Describe cualquier ambiente o estética visual y la IA configurará colores, geometría, dinámicas y física de partículas al instante.
          </p>

          {generationError && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{generationError}</span>
            </div>
          )}

          {customStyleName && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Estilo generado con éxito: <strong>{customStyleName}</strong></span>
            </div>
          )}

          <div className="relative">
            <textarea
              rows={3}
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="Ej: Tormenta de plasma cósmico con rayos dorados y violetas..."
              className="w-full p-3 pr-12 rounded-xl bg-white/[0.03] border border-white/15 focus:border-purple-400 focus:outline-none text-xs text-white placeholder-slate-500 resize-none transition-colors"
            />
            <button
              onClick={() => handleGeneratePrompt()}
              disabled={isGenerating || !promptText.trim()}
              className="absolute bottom-3 right-3 p-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white transition-all shadow-md"
              title="Generar estilo"
            >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>

          {/* Quick inspiration chips */}
          <div className="space-y-1.5 pt-1">
            <span className="text-[11px] text-slate-500 block">Sugerencias rápidas:</span>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_PROMPTS.map((qp, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setPromptText(qp);
                    handleGeneratePrompt(qp);
                  }}
                  disabled={isGenerating}
                  className="px-2.5 py-1 text-[11px] rounded-lg bg-white/[0.04] hover:bg-white/[0.09] border border-white/10 text-slate-300 transition-colors text-left"
                >
                  {qp}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
