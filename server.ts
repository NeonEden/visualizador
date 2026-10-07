import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json({ limit: '10mb' }));

// Initialize Google GenAI
const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

// AI Audio Director - Analyzes audio statistics snapshot and automatically adapts visual parameters
app.post('/api/ai/director', async (req: Request, res: Response) => {
  try {
    const {
      energy,
      bassLevel,
      midLevel,
      trebleLevel,
      tempoEstimate,
      spectralCentroid,
      currentStyle,
      userVibePreference,
    } = req.body;

    if (!ai) {
      // Fallback deterministic smart rule if API key is not ready
      return res.json({
        suggestedStyle: bassLevel > 0.7 ? 'cyber_grid' : energy > 0.6 ? 'cosmic_nebula' : 'kinetic_ribbons',
        paletteName: bassLevel > 0.65 ? 'Cyber Neon' : 'Sunset Gold',
        paletteColors: bassLevel > 0.65 ? ['#ff007f', '#00f0ff', '#7928ca', '#00ffcc'] : ['#ff4e50', '#f9d423', '#e14eca', '#43e97b'],
        speedMultiplier: Math.max(0.6, Math.min(2.0, (tempoEstimate || 120) / 110)),
        bloomIntensity: 1.0 + (energy || 0.5) * 0.8,
        particleDensity: bassLevel > 0.7 ? 1.4 : 1.0,
        moodLabel: bassLevel > 0.6 ? 'High-Energy Electro' : 'Harmonic Ambient Flow',
        aiInterpretation: 'Adaptive frequency analysis: boosted bass response and increased harmonic dispersion.',
      });
    }

    const prompt = `You are the AI Visual Director of an ultra-high performance music visualizer.
Analyze the current live audio profile and determine the best visual experience:
- Audio Energy (0-1): ${energy?.toFixed(2) ?? '0.50'}
- Bass / Sub-bass intensity (0-1): ${bassLevel?.toFixed(2) ?? '0.50'}
- Mid frequencies (0-1): ${midLevel?.toFixed(2) ?? '0.50'}
- Treble / Highs (0-1): ${trebleLevel?.toFixed(2) ?? '0.50'}
- Estimated Tempo (BPM): ${tempoEstimate ?? 120}
- Spectral Centroid / Brightness: ${spectralCentroid?.toFixed(0) ?? '2500'} Hz
- Current Active Style: ${currentStyle || 'cosmic_nebula'}
- User vibe preference: ${userVibePreference || 'auto dynamic'}

Available styles:
- "cyber_grid" (3D Synthwave perspective grid, hills, laser beams - great for electro, synth, 80s, heavy bass)
- "cosmic_nebula" (Radial gravitational particle vortex, stellar dust, shockwaves - great for EDM, epic, cosmic, trance)
- "kinetic_ribbons" (Fluid harmonic sine waves, chromatic silk - great for classical, jazz, vocal, chill)
- "sacred_mandala" (Kaleidoscopic sacred geometry, crystalline polyhedra - great for psychedelic, house, progressive)
- "aurora_liquid" (Fluid organic flow field, metaball waves - great for ambient, lo-fi, dream pop)
- "peak_spectrum" (Modern high-definition minimalist architectural equalizer bars - great for hip hop, pop, rock)
- "retro_oscilloscope" (Raw CRT vector beam, lissajous sound physics - great for acoustic, funk, rock, synth)
- "voxel_city" (3D isometric skyscraper cityscape reacting to frequencies - great for future bass, techno, club)

Choose a visually striking configuration that best compliments this sonic profile.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestedStyle: {
              type: Type.STRING,
              description: 'One of: cyber_grid, cosmic_nebula, kinetic_ribbons, sacred_mandala, aurora_liquid, peak_spectrum, retro_oscilloscope, voxel_city',
            },
            paletteName: {
              type: Type.STRING,
              description: 'Short evocative title for the generated palette, e.g. "Hyperion Neon", "Solar Flare", "Abyssal Pearl"',
            },
            paletteColors: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Array of 4 vibrant HEX color codes matching the mood',
            },
            speedMultiplier: {
              type: Type.NUMBER,
              description: 'Animation speed modifier between 0.5 and 2.5',
            },
            bloomIntensity: {
              type: Type.NUMBER,
              description: 'Glow/Bloom intensity multiplier between 0.6 and 2.0',
            },
            particleDensity: {
              type: Type.NUMBER,
              description: 'Particle count scale factor between 0.6 and 1.8',
            },
            moodLabel: {
              type: Type.STRING,
              description: 'Detected musical vibe/genre in Spanish, e.g. "Synthwave Electrizante", "Ambient Etereo", "Bass Drop Furioso", "Ritmo Lo-Fi Cálido"',
            },
            aiInterpretation: {
              type: Type.STRING,
              description: '1-sentence poetic explanation of why this visual style was chosen for this music (in Spanish)',
            },
          },
          required: [
            'suggestedStyle',
            'paletteName',
            'paletteColors',
            'speedMultiplier',
            'bloomIntensity',
            'particleDensity',
            'moodLabel',
            'aiInterpretation',
          ],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json(parsed);
  } catch (err: any) {
    console.warn('AI Director API fallback engaged (Quota/Rate Limit):', err?.message || err);
    
    // Return high-quality deterministic fallback tailored to audio snapshot without erroring
    const energy = req.body.energy || 0.5;
    const bassLevel = req.body.bassLevel || 0.5;
    const tempoEstimate = req.body.tempoEstimate || 120;

    res.json({
      suggestedStyle: bassLevel > 0.65 ? 'cyber_grid' : energy > 0.55 ? 'cosmic_nebula' : 'kinetic_ribbons',
      paletteName: bassLevel > 0.6 ? 'Neon Pulsar' : 'Cosmic Gold',
      paletteColors: bassLevel > 0.6 ? ['#ff007f', '#00f0ff', '#7928ca', '#00ffcc'] : ['#ff4e50', '#f9d423', '#e14eca', '#43e97b'],
      speedMultiplier: Math.max(0.7, Math.min(1.8, tempoEstimate / 115)),
      bloomIntensity: 1.0 + energy * 0.6,
      particleDensity: bassLevel > 0.6 ? 1.3 : 1.0,
      moodLabel: bassLevel > 0.6 ? 'High-Energy Electro (Adaptativo)' : 'Harmonic Flow (Adaptativo)',
      aiInterpretation: 'Adaptación acústica en tiempo real basada en la firma espectral de frecuencia.',
    });
  }
});

// Prompt-to-Visualizer Style Generator: Users can type ANY creative concept
app.post('/api/ai/generate-style', async (req: Request, res: Response) => {
  try {
    const { prompt: userPrompt } = req.body;

    if (!userPrompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    if (!ai) {
      return res.json({
        styleName: 'Custom Vibe',
        targetVisualizer: 'cosmic_nebula',
        palette: ['#ff0055', '#00e5ff', '#ffe600', '#7b2cbf'],
        effects: {
          intensity: 1.2,
          speed: 1.1,
          bassBoost: 1.3,
          glow: 1.4,
          trailDecay: 0.15,
          cameraShake: true,
        },
        description: `Estilo personalizado generado para "${userPrompt}"`,
      });
    }

    const systemPrompt = `You are a visionary Creative Technologist and Generative Visual Artist.
Generate a complete audio-reactive visual preset for our music visualizer based on the user's creative prompt: "${userPrompt}".

Choose the best visualizer base:
- "cyber_grid" (Retro 80s wireframe grid, mountains, synthwave lasers)
- "cosmic_nebula" (Deep space gravitational particles, accretion disk, stellar burst)
- "kinetic_ribbons" (Silky fluid harmonic sinusoidal ribbons, chromatic glow)
- "sacred_mandala" (Sacred geometry prism, radial fractal patterns, crystal facets)
- "aurora_liquid" (Fluid organic flow field, psychedelic fluid waves, bioluminescent)
- "peak_spectrum" (Architectural audio bars, reflective lake, gravity peaks)
- "retro_oscilloscope" (Raw CRT cathode phosphor beam, Lissajous physics, green/amber vectors)
- "voxel_city" (3D futuristic skyscraper skyline bouncing to music)

Output the color palette (4 harmonious HEX codes), precise parameters, and an artistic Spanish description.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: systemPrompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            styleName: {
              type: Type.STRING,
              description: 'Poetic name for the custom visual theme (e.g. "Bioluminiscencia Abisal", "Ciberpunk Shinjuku 2099")',
            },
            targetVisualizer: {
              type: Type.STRING,
              description: 'One of: cyber_grid, cosmic_nebula, kinetic_ribbons, sacred_mandala, aurora_liquid, peak_spectrum, retro_oscilloscope, voxel_city',
            },
            palette: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '4 HEX color strings',
            },
            effects: {
              type: Type.OBJECT,
              properties: {
                intensity: { type: Type.NUMBER, description: 'Overall effect intensity between 0.5 and 2.0' },
                speed: { type: Type.NUMBER, description: 'Animation flow speed between 0.5 and 2.5' },
                bassBoost: { type: Type.NUMBER, description: 'Bass reactivity multiplier between 0.8 and 2.2' },
                glow: { type: Type.NUMBER, description: 'Glow/Bloom multiplier between 0.5 and 2.0' },
                trailDecay: { type: Type.NUMBER, description: 'Canvas persistence/trail decay between 0.05 and 0.40' },
                cameraShake: { type: Type.BOOLEAN, description: 'Whether beat drops trigger subtle camera pulse' },
              },
              required: ['intensity', 'speed', 'bassBoost', 'glow', 'trailDecay', 'cameraShake'],
            },
            description: {
              type: Type.STRING,
              description: 'Atmospheric description of the generated visuals in Spanish',
            },
          },
          required: ['styleName', 'targetVisualizer', 'palette', 'effects', 'description'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json(parsed);
  } catch (err: any) {
    console.warn('Style Generation Fallback engaged (Quota/Rate Limit):', err?.message || err);
    res.json({
      styleName: `Atmósfera: ${req.body.prompt || 'Perspectiva Neón'}`,
      targetVisualizer: req.body.prompt?.toLowerCase().includes('grid') || req.body.prompt?.toLowerCase().includes('cyber') ? 'cyber_grid' : 'cosmic_nebula',
      palette: ['#ff007f', '#00f0ff', '#7928ca', '#00ffcc'],
      effects: {
        intensity: 1.1,
        speed: 1.0,
        bassBoost: 1.2,
        glow: 1.2,
        trailDecay: 0.18,
        cameraShake: true,
      },
      description: `Estilo adaptativo generado para "${req.body.prompt || 'Concepto Creativo'}"`,
    });
  }
});

// Setup Vite middleware in development or serve static files in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PulseWave AI Visualizer server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Error starting server:', err);
  process.exit(1);
});
