import { AudioStatsSnapshot } from '../audio/AudioEngine';
import { VisualizerStyleId } from '../visualizer/types';

export interface AIDirectorResponse {
  suggestedStyle: VisualizerStyleId;
  paletteName: string;
  paletteColors: string[];
  speedMultiplier: number;
  bloomIntensity: number;
  particleDensity: number;
  moodLabel: string;
  aiInterpretation: string;
}

export interface AIPromptStyleResponse {
  styleName: string;
  targetVisualizer: VisualizerStyleId;
  palette: string[];
  effects: {
    intensity: number;
    speed: number;
    bassBoost: number;
    glow: number;
    trailDecay: number;
    cameraShake: boolean;
  };
  description: string;
}

export async function requestAIDirectorDecision(
  snapshot: AudioStatsSnapshot,
  currentStyle: VisualizerStyleId,
  userVibePreference = 'auto'
): Promise<AIDirectorResponse> {
  const response = await fetch('/api/ai/director', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...snapshot,
      currentStyle,
      userVibePreference,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI Director request failed with status ${response.status}`);
  }

  return response.json();
}

export async function generateStyleFromPrompt(prompt: string): Promise<AIPromptStyleResponse> {
  const response = await fetch('/api/ai/generate-style', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    throw new Error(`AI Style generation request failed with status ${response.status}`);
  }

  return response.json();
}
