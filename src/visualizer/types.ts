export type VisualizerStyleId =
  | 'cyber_grid'
  | 'cosmic_nebula'
  | 'kinetic_ribbons'
  | 'sacred_mandala'
  | 'aurora_liquid'
  | 'peak_spectrum'
  | 'retro_oscilloscope'
  | 'voxel_city';

export interface VisualizerStyleMeta {
  id: VisualizerStyleId;
  name: string;
  tagline: string;
  category: '3D Geometry' | 'Cosmic Particles' | 'Fluid Dynamics' | 'Minimalist' | 'Vintage Vector';
  gpuLoad: 'Ultra-Bajo' | 'Bajo' | 'Moderado';
}

export interface ColorPalette {
  id: string;
  name: string;
  colors: [string, string, string, string]; // 4 accent hex colors
  backgroundGradient: [string, string];
}

export type EdgeParticleColorMode =
  | 'palette'
  | 'cyber'
  | 'solar'
  | 'plasma'
  | 'emerald'
  | 'white'
  | 'rainbow';

export type EdgeParticleShape = 'comet' | 'plasma' | 'spark';

export interface RenderSettings {
  // Core intensities
  intensity: number;       // 0.5 - 2.5
  bassBoost: number;       // 0.5 - 2.5
  speed: number;           // 0.5 - 2.5
  glowAmount: number;      // 0.0 - 2.0
  trailPersistence: number;// 0.05 - 0.40 (lower = sharper, higher = longer motion blur)
  cameraShake: boolean;    // Shake on big kick drops

  // Sub-Bass Edge Particles System (Bordes reactivos)
  edgeParticlesEnabled: boolean;
  edgeParticlesDensity: number;      // 10 - 80 partículas por pico de sub-bajo
  edgeParticlesColorMode: EdgeParticleColorMode;
  edgeParticlesSpeed: number;        // 0.5 - 3.0
  edgeParticlesShape: EdgeParticleShape;

  // Low-End GPU optimization switches
  resolutionScale: number; // 0.5 (Eco), 0.75 (Balanced), 1.0 (Native), 1.5 (High DPI)
  targetFps: number;       // 30, 60, 120
  particleCountMultiplier: number; // 0.3 - 1.5
  enableBloom: boolean;

  // Active theme
  activeStyle: VisualizerStyleId;
  palette: ColorPalette;

  // AI Dynamic Director
  aiDirectorEnabled: boolean;
  aiVibePreference: string;
}

export const VISUALIZER_STYLES: VisualizerStyleMeta[] = [
  {
    id: 'cyber_grid',
    name: 'Cyber Grid 3D',
    tagline: 'Terreno de neón wireframe en perspectiva con horizonte reactivo',
    category: '3D Geometry',
    gpuLoad: 'Ultra-Bajo',
  },
  {
    id: 'cosmic_nebula',
    name: 'Cosmic Nebula',
    tagline: 'Vórtice estelar con gravedad reactiva a graves y ondas de choque',
    category: 'Cosmic Particles',
    gpuLoad: 'Bajo',
  },
  {
    id: 'kinetic_ribbons',
    name: 'Kinetic Ribbons',
    tagline: 'Cintas sinusoidales fluidas con dispersión cromática armónica',
    category: 'Fluid Dynamics',
    gpuLoad: 'Ultra-Bajo',
  },
  {
    id: 'sacred_mandala',
    name: 'Sacred Mandala',
    tagline: 'Geometría sagrada caleidoscópica y poliedro cristalino',
    category: '3D Geometry',
    gpuLoad: 'Bajo',
  },
  {
    id: 'aurora_liquid',
    name: 'Aurora Liquid',
    tagline: 'Ondas metaball fluidas y etéreas con gradientes bioluminiscentes',
    category: 'Fluid Dynamics',
    gpuLoad: 'Bajo',
  },
  {
    id: 'peak_spectrum',
    name: 'Peak Spectrum',
    tagline: 'Barras arquitectónicas minimalistas con reflejo y agujas de pico',
    category: 'Minimalist',
    gpuLoad: 'Ultra-Bajo',
  },
  {
    id: 'retro_oscilloscope',
    name: 'Retro CRT Beam',
    tagline: 'Curvas de Lissajous vectoriales y fósforo catódico puro',
    category: 'Vintage Vector',
    gpuLoad: 'Ultra-Bajo',
  },
  {
    id: 'voxel_city',
    name: 'Voxel Skyline',
    tagline: 'Rascacielos isométricos que emergen con las columnas de frecuencia',
    category: '3D Geometry',
    gpuLoad: 'Bajo',
  },
];

export const PRESET_PALETTES: ColorPalette[] = [
  {
    id: 'cyber_neon',
    name: 'Cyber Neon',
    colors: ['#00f0ff', '#ff007f', '#7928ca', '#00ffcc'],
    backgroundGradient: ['#050510', '#020205'],
  },
  {
    id: 'deep_cosmic',
    name: 'Deep Cosmic',
    colors: ['#06b6d4', '#8b5cf6', '#4338ca', '#f43f5e'],
    backgroundGradient: ['#080518', '#020108'],
  },
  {
    id: 'sunset_gold',
    name: 'Sunset Gold',
    colors: ['#ff4e50', '#f9d423', '#e14eca', '#43e97b'],
    backgroundGradient: ['#120808', '#050204'],
  },
  {
    id: 'acid_emerald',
    name: 'Acid Emerald',
    colors: ['#00ff88', '#00e5ff', '#10b981', '#34d399'],
    backgroundGradient: ['#03120b', '#010503'],
  },
  {
    id: 'solar_flare',
    name: 'Solar Flare',
    colors: ['#ff3b00', '#ffaa00', '#ff0055', '#ffffff'],
    backgroundGradient: ['#170500', '#060100'],
  },
  {
    id: 'monochrome_studio',
    name: 'Monochrome Studio',
    colors: ['#ffffff', '#94a3b8', '#64748b', '#38bdf8'],
    backgroundGradient: ['#0b0f17', '#030712'],
  },
  {
    id: 'pastel_dream',
    name: 'Pastel Dream',
    colors: ['#c084fc', '#f472b6', '#38bdf8', '#a7f3d0'],
    backgroundGradient: ['#0e0717', '#040208'],
  },
];
