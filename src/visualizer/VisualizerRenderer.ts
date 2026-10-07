import { AudioBands } from '../audio/AudioEngine';
import { ColorPalette, RenderSettings, VisualizerStyleId } from './types';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  baseSize: number;
  alpha: number;
  colorIndex: number;
  life: number;
  maxLife: number;
  angle: number;
  dist: number;
  speed: number;
}

interface EdgeParticle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  color: string;
  life: number;
  maxLife: number;
  trailX: number;
  trailY: number;
  shape: 'comet' | 'plasma' | 'spark';
}

export class VisualizerRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  // Particle pool for zero-allocation 60-120 FPS performance
  private maxParticles = 600;
  private particles: Particle[] = [];

  // Edge particle pool for Sub-Bass bursts from canvas perimeter
  private maxEdgeParticles = 400;
  private edgeParticles: EdgeParticle[] = [];
  private lastSubBassBurstTime = 0;

  // Animation timing
  private lastFrameTime = 0;
  private animationId: number | null = null;
  private globalTime = 0;

  // Camera Shake & Pulse state
  private cameraShakeX = 0;
  private cameraShakeY = 0;
  private cameraShakeDecay = 0.88;
  private shockwaveRadius = 0;
  private shockwaveAlpha = 0;

  // Peak bars gravity state
  private peakHoldValues: Float32Array = new Float32Array(128);
  private peakHoldDropSpeed: Float32Array = new Float32Array(128);

  // Voxel city grid state
  private voxelHeights: Float32Array = new Float32Array(64);

  // FPS tracking
  private frameCount = 0;
  private fpsTimer = 0;
  private currentFps = 60;

  // Settings
  private settings: RenderSettings;

  constructor(canvas: HTMLCanvasElement, settings: RenderSettings) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', {
      alpha: false, // Opaque canvas for massive GPU fill-rate speedup
      desynchronized: true, // Low latency
    });
    if (!ctx) throw new Error('Could not get 2D context from canvas');
    this.ctx = ctx;
    this.settings = settings;

    this.initParticlePool();
  }

  private initParticlePool() {
    this.particles = [];
    for (let i = 0; i < this.maxParticles; i++) {
      this.particles.push({
        x: Math.random(),
        y: Math.random(),
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        size: Math.random() * 3 + 1.5,
        baseSize: Math.random() * 3 + 1.5,
        alpha: Math.random() * 0.7 + 0.3,
        colorIndex: Math.floor(Math.random() * 4),
        life: Math.random() * 100,
        maxLife: Math.random() * 100 + 50,
        angle: Math.random() * Math.PI * 2,
        dist: Math.random() * 300 + 40,
        speed: (Math.random() * 0.005 + 0.002),
      });
    }

    // Pre-allocate edge particles pool for 0-allocation GC-free performance
    this.edgeParticles = [];
    for (let i = 0; i < this.maxEdgeParticles; i++) {
      this.edgeParticles.push({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        size: 3,
        alpha: 0,
        color: '#00f0ff',
        life: 0,
        maxLife: 60,
        trailX: 0,
        trailY: 0,
        shape: 'comet',
      });
    }
  }

  private pickEdgeParticleColor(): string {
    const mode = this.settings.edgeParticlesColorMode || 'palette';
    const pal = this.settings.palette;

    switch (mode) {
      case 'palette':
        return pal.colors[Math.floor(Math.random() * pal.colors.length)] || '#00f0ff';
      case 'cyber':
        return Math.random() > 0.5 ? '#00f0ff' : '#ff007f';
      case 'solar':
        return Math.random() > 0.5 ? '#ffaa00' : '#ff3300';
      case 'plasma':
        return Math.random() > 0.5 ? '#a855f7' : '#6366f1';
      case 'emerald':
        return Math.random() > 0.5 ? '#00ff88' : '#10b981';
      case 'white':
        return Math.random() > 0.3 ? '#ffffff' : '#93c5fd';
      case 'rainbow':
        return `hsl(${Math.floor(Math.random() * 360)}, 100%, 65%)`;
      default:
        return pal.colors[0] || '#00f0ff';
    }
  }

  private spawnSubBassEdgeBurst(w: number, h: number, bands: AudioBands, now: number) {
    if (!this.settings.edgeParticlesEnabled) return;

    // Trigger burst on sub-bass kicks or strong sub-bass energy
    const isPeak = bands.beatDetected || (bands.subBass > 0.62 && now - this.lastSubBassBurstTime > 280);
    if (!isPeak) return;

    this.lastSubBassBurstTime = now;
    const burstCount = Math.min(
      this.maxEdgeParticles,
      Math.floor(this.settings.edgeParticlesDensity * (0.6 + bands.subBass * 0.5))
    );

    const cx = w * 0.5;
    const cy = h * 0.5;
    const speedMult = this.settings.edgeParticlesSpeed * (0.9 + bands.subBass * 0.8) * (w / 1200);
    const shape = this.settings.edgeParticlesShape || 'comet';

    let spawned = 0;
    for (let i = 0; i < this.edgeParticles.length && spawned < burstCount; i++) {
      const p = this.edgeParticles[i];
      if (p.active) continue; // Reuse inactive particle slot

      // Pick edge: 0 = Top, 1 = Bottom, 2 = Left, 3 = Right
      const edge = Math.floor(Math.random() * 4);
      let sx = 0, sy = 0;

      if (edge === 0) { // Top
        sx = Math.random() * w;
        sy = 0;
      } else if (edge === 1) { // Bottom
        sx = Math.random() * w;
        sy = h;
      } else if (edge === 2) { // Left
        sx = 0;
        sy = Math.random() * h;
      } else { // Right
        sx = w;
        sy = Math.random() * h;
      }

      // Vector toward center with slight spiral spread
      const dx = cx - sx;
      const dy = cy - sy;
      const baseVel = (Math.random() * 120 + 110) * speedMult;
      const angleVariance = (Math.random() - 0.5) * 0.45;
      const baseAngle = Math.atan2(dy, dx) + angleVariance;

      p.active = true;
      p.x = sx;
      p.y = sy;
      p.trailX = sx;
      p.trailY = sy;
      p.vx = Math.cos(baseAngle) * baseVel;
      p.vy = Math.sin(baseAngle) * baseVel;
      p.size = Math.random() * 2.5 + 1.8 + bands.subBass * 1.5;
      p.alpha = 1.0;
      p.color = this.pickEdgeParticleColor();
      p.maxLife = Math.random() * 0.7 + 0.6; // In seconds
      p.life = p.maxLife;
      p.shape = shape;

      spawned++;
    }
  }

  private renderEdgeParticles(ctx: CanvasRenderingContext2D, w: number, h: number, delta: number) {
    if (!this.settings.edgeParticlesEnabled) return;

    ctx.save();
    for (let i = 0; i < this.edgeParticles.length; i++) {
      const p = this.edgeParticles[i];
      if (!p.active) continue;

      p.life -= delta;
      if (p.life <= 0 || p.x < -50 || p.x > w + 50 || p.y < -50 || p.y > h + 50) {
        p.active = false;
        continue;
      }

      p.trailX = p.x;
      p.trailY = p.y;
      p.x += p.vx * delta;
      p.y += p.vy * delta;

      const progress = p.life / p.maxLife; // 1 -> 0
      const currentAlpha = Math.min(0.85, Math.pow(progress, 1.5) * 1.1);

      ctx.globalAlpha = currentAlpha;

      if (p.shape === 'comet') {
        // Glowing comet head with trail
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.trailX - p.vx * 0.05, p.trailY - p.vy * 0.05);
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.6, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'plasma') {
        // Glowing radial plasma orb
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2.5);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.4, p.color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 2.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Razor spark diamond
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - p.size * 1.5);
        ctx.lineTo(p.x + p.size, p.y);
        ctx.lineTo(p.x, p.y + p.size * 1.5);
        ctx.lineTo(p.x - p.size, p.y);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  public updateSettings(newSettings: RenderSettings) {
    this.settings = newSettings;
  }

  public resize(width: number, height: number) {
    const scale = this.settings.resolutionScale || 1.0;
    this.canvas.width = Math.floor(width * scale);
    this.canvas.height = Math.floor(height * scale);
  }

  public getFps(): number {
    return this.currentFps;
  }

  public render(
    bands: AudioBands,
    rawFrequencies: Uint8Array,
    rawWaveform: Uint8Array,
    now: number
  ) {
    const delta = this.lastFrameTime > 0 ? (now - this.lastFrameTime) / 1000 : 0.016;
    this.lastFrameTime = now;

    // FPS calculation
    this.frameCount++;
    if (now - this.fpsTimer >= 500) {
      this.currentFps = Math.round((this.frameCount * 1000) / (now - this.fpsTimer));
      this.frameCount = 0;
      this.fpsTimer = now;
    }

    const w = this.canvas.width;
    const h = this.canvas.height;
    if (w === 0 || h === 0) return;

    const ctx = this.ctx;
    const palette = this.settings.palette;
    const intensity = this.settings.intensity;
    const bassBoost = this.settings.bassBoost;
    const speed = this.settings.speed;

    this.globalTime += delta * speed * (1.0 + bands.overallEnergy * 0.6);

    // BPM Pulse rhythm multiplier (subtle 5% breathing in sync with tempo)
    const bpmPulse = 1.0 + Math.sin(bands.beatPhase * Math.PI * 2) * 0.05 * bassBoost;
    const fluxFlash = bands.spectralFlux * 0.2 * intensity;

    // Trigger subtle, tactile camera shake & shockwaves on heavy beat/kick
    if (bands.beatDetected && this.settings.cameraShake) {
      const punch = Math.min(5.0, bands.beatIntensity * bassBoost * 3.5);
      this.cameraShakeX = (Math.random() - 0.5) * punch;
      this.cameraShakeY = (Math.random() - 0.5) * punch;
      this.shockwaveRadius = 15;
      this.shockwaveAlpha = Math.min(0.45, bands.beatIntensity * 0.5);
    } else {
      this.cameraShakeX *= this.cameraShakeDecay;
      this.cameraShakeY *= this.cameraShakeDecay;
    }

    // Expand shockwave
    if (this.shockwaveAlpha > 0.01) {
      this.shockwaveRadius += (w * 0.8) * delta * 2.2;
      this.shockwaveAlpha *= 0.92;
    }

    ctx.save();

    // Subtle camera shake transform
    if (Math.abs(this.cameraShakeX) > 0.1 || Math.abs(this.cameraShakeY) > 0.1) {
      ctx.translate(this.cameraShakeX, this.cameraShakeY);
    }

    // Motion blur / trail persistence clearing
    const trail = Math.max(0.04, Math.min(0.45, this.settings.trailPersistence));
    ctx.fillStyle = palette.backgroundGradient[0];
    ctx.globalAlpha = trail;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1.0;

    // Draw active visualizer mode with BPM pulse and spectral flux
    switch (this.settings.activeStyle) {
      case 'cyber_grid':
        this.renderCyberGrid(ctx, w, h, bands, rawFrequencies, palette, intensity * bpmPulse, bassBoost);
        break;
      case 'cosmic_nebula':
        this.renderCosmicNebula(ctx, w, h, bands, rawFrequencies, palette, intensity * bpmPulse, bassBoost);
        break;
      case 'kinetic_ribbons':
        this.renderKineticRibbons(ctx, w, h, bands, rawFrequencies, palette, intensity * bpmPulse, bassBoost);
        break;
      case 'sacred_mandala':
        this.renderSacredMandala(ctx, w, h, bands, rawFrequencies, palette, intensity * bpmPulse, bassBoost);
        break;
      case 'aurora_liquid':
        this.renderAuroraLiquid(ctx, w, h, bands, rawFrequencies, palette, intensity * bpmPulse, bassBoost);
        break;
      case 'peak_spectrum':
        this.renderPeakSpectrum(ctx, w, h, bands, rawFrequencies, palette, intensity * bpmPulse, bassBoost);
        break;
      case 'retro_oscilloscope':
        this.renderRetroOscilloscope(ctx, w, h, bands, rawWaveform, palette, intensity * bpmPulse, bassBoost);
        break;
      case 'voxel_city':
        this.renderVoxelCity(ctx, w, h, bands, rawFrequencies, palette, intensity * bpmPulse, bassBoost);
        break;
    }

    // Spawn and render Sub-Bass Edge Particles surging inward from canvas borders
    this.spawnSubBassEdgeBurst(w, h, bands, now);
    this.renderEdgeParticles(ctx, w, h, delta);

    // Draw chromatic shockwave ring if active
    if (this.shockwaveAlpha > 0.02) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, this.shockwaveRadius, 0, Math.PI * 2);
      ctx.lineWidth = 5 * this.shockwaveAlpha;
      ctx.strokeStyle = palette.colors[0];
      ctx.globalAlpha = this.shockwaveAlpha;
      ctx.stroke();

      // Outer secondary harmonic ring
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, Math.max(0, this.shockwaveRadius - 18), 0, Math.PI * 2);
      ctx.lineWidth = 2 * this.shockwaveAlpha;
      ctx.strokeStyle = palette.colors[1];
      ctx.globalAlpha = this.shockwaveAlpha * 0.7;
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  // ==========================================
  // 1. CYBER GRID 3D (Synthwave Wireframe Hills)
  // ==========================================
  private renderCyberGrid(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    bands: AudioBands,
    rawFrequencies: Uint8Array,
    palette: ColorPalette,
    intensity: number,
    bassBoost: number
  ) {
    const horizonY = h * 0.48;
    const centerX = w * 0.5;

    // 1. Retro Sun on Horizon
    const sunRadius = Math.min(w, h) * 0.18 * (1.0 + bands.bass * 0.25 * bassBoost);
    const sunGrad = ctx.createLinearGradient(0, horizonY - sunRadius, 0, horizonY);
    sunGrad.addColorStop(0, palette.colors[1]);
    sunGrad.addColorStop(0.6, palette.colors[2]);
    sunGrad.addColorStop(1, palette.colors[0]);

    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, horizonY, sunRadius, Math.PI, 0, false);
    ctx.fillStyle = sunGrad;
    if (this.settings.enableBloom) {
      ctx.shadowColor = palette.colors[1];
      ctx.shadowBlur = 25 * this.settings.glowAmount * intensity;
    }
    ctx.fill();

    // Sun horizontal slice bands
    ctx.lineWidth = 3;
    ctx.strokeStyle = palette.backgroundGradient[0];
    const sliceCount = 8;
    for (let s = 1; s <= sliceCount; s++) {
      const sy = horizonY - (sunRadius / (sliceCount + 1)) * s;
      const sliceThickness = (sliceCount - s + 1) * 1.5;
      ctx.lineWidth = sliceThickness;
      ctx.beginPath();
      ctx.moveTo(centerX - sunRadius, sy);
      ctx.lineTo(centerX + sunRadius, sy);
      ctx.stroke();
    }
    ctx.restore();

    // 2. Mountain Peaks / Equalizer Silhouettes on Horizon
    const mountainSegments = 64;
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    for (let i = 0; i <= mountainSegments; i++) {
      const mx = (w / mountainSegments) * i;
      const freqIdx = Math.floor((Math.abs(i - mountainSegments / 2) / (mountainSegments / 2)) * 60);
      const freqVal = (rawFrequencies[freqIdx] || 0) / 255;
      const peakHeight = Math.sin(i * 0.4 + this.globalTime * 0.5) * 20 + freqVal * 120 * intensity;
      ctx.lineTo(mx, horizonY - peakHeight);
    }
    ctx.lineTo(w, horizonY);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = palette.colors[0];
    ctx.stroke();

    // 3. Perspective 3D Wireframe Grid Floor
    const gridRows = 18;
    const gridCols = 24;
    const gridSpeed = (this.globalTime * 1.2) % 1;

    ctx.save();
    ctx.lineWidth = 1.5;

    // Horizontal moving depth lines
    for (let r = 0; r < gridRows; r++) {
      const progress = Math.pow((r + gridSpeed) / gridRows, 2.4);
      const gy = horizonY + (h - horizonY) * progress;
      const alpha = progress * 0.9;
      ctx.strokeStyle = palette.colors[r % 2 === 0 ? 0 : 3];
      ctx.globalAlpha = Math.max(0.1, alpha);

      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(w, gy);
      ctx.stroke();
    }

    // Perspective perspective lines radiating from vanishing point
    for (let c = -gridCols / 2; c <= gridCols / 2; c++) {
      const bottomX = centerX + (c / (gridCols / 2)) * (w * 0.95);
      const freqIdx = Math.floor(Math.abs(c) * 4) % 60;
      const freqVal = (rawFrequencies[freqIdx] || 0) / 255;

      ctx.strokeStyle = palette.colors[Math.abs(c) % 4];
      ctx.globalAlpha = 0.75 + freqVal * 0.25;

      ctx.beginPath();
      ctx.moveTo(centerX + c * 2, horizonY);
      ctx.lineTo(bottomX, h);
      ctx.stroke();
    }
    ctx.restore();

    // 4. Laser Starfield Floating Notes
    const activeCount = Math.floor(this.maxParticles * 0.4 * this.settings.particleCountMultiplier);
    ctx.save();
    for (let i = 0; i < activeCount; i++) {
      const p = this.particles[i];
      p.y = (p.y - 0.003 * this.settings.speed - bands.treble * 0.005) % 1;
      if (p.y < 0) p.y += 1;

      const px = p.x * w;
      const py = p.y * (horizonY - 20);
      const pSize = p.baseSize * (1.0 + bands.highMid * 1.5);

      ctx.fillStyle = palette.colors[p.colorIndex];
      ctx.globalAlpha = p.alpha * (0.4 + bands.overallEnergy * 0.6);
      ctx.beginPath();
      ctx.arc(px, py, pSize, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ==========================================
  // 2. COSMIC NEBULA (Gravitational Vortex & Stars)
  // ==========================================
  private renderCosmicNebula(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    bands: AudioBands,
    rawFrequencies: Uint8Array,
    palette: ColorPalette,
    intensity: number,
    bassBoost: number
  ) {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const coreRadius = Math.min(w, h) * 0.08 * (1.0 + bands.bass * 0.7 * bassBoost);

    // 1. Accretion Disk Harmonic Rings
    const ringCount = 5;
    ctx.save();
    for (let r = 0; r < ringCount; r++) {
      const radius = coreRadius + (r + 1) * 45 + bands.subBass * 30 * intensity;
      const ringGrad = ctx.createRadialGradient(cx, cy, radius - 15, cx, cy, radius + 15);
      ringGrad.addColorStop(0, 'rgba(0,0,0,0)');
      ringGrad.addColorStop(0.5, palette.colors[r % 4]);
      ringGrad.addColorStop(1, 'rgba(0,0,0,0)');

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.lineWidth = 12 * (1.0 + bands.mid * 1.2);
      ctx.strokeStyle = ringGrad;
      ctx.globalAlpha = 0.5 + bands.overallEnergy * 0.5;
      ctx.stroke();
    }
    ctx.restore();

    // 2. Orbital Particles (Black Hole Gravitational Swarm)
    const particleCount = Math.floor(this.maxParticles * 0.85 * this.settings.particleCountMultiplier);
    ctx.save();
    for (let i = 0; i < particleCount; i++) {
      const p = this.particles[i];
      // Orbiting dynamics
      p.angle += p.speed * (1.5 + bands.bass * 2.0 * bassBoost);
      const warp = bands.beatDetected ? 35 : 0;
      const curDist = p.dist + Math.sin(this.globalTime * 2 + i) * 20 + warp;

      const px = cx + Math.cos(p.angle) * curDist;
      const py = cy + Math.sin(p.angle) * curDist * 0.75; // Isometric tilt
      const pSize = p.baseSize * (1.0 + bands.treble * 1.8 * intensity);

      ctx.fillStyle = palette.colors[p.colorIndex];
      ctx.globalAlpha = p.alpha * (0.6 + bands.highMid * 0.4);

      ctx.beginPath();
      ctx.arc(px, py, pSize, 0, Math.PI * 2);
      ctx.fill();

      // Velocity trail
      if (bands.overallEnergy > 0.4) {
        ctx.strokeStyle = palette.colors[p.colorIndex];
        ctx.lineWidth = 1;
        ctx.globalAlpha = p.alpha * 0.3;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px - Math.cos(p.angle) * 12, py - Math.sin(p.angle) * 8);
        ctx.stroke();
      }
    }
    ctx.restore();

    // 3. Glowing Pulsar Core
    const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreRadius * 1.8);
    coreGrad.addColorStop(0, '#ffffff');
    coreGrad.addColorStop(0.3, palette.colors[0]);
    coreGrad.addColorStop(0.7, palette.colors[1]);
    coreGrad.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, coreRadius * 1.5, 0, Math.PI * 2);
    ctx.fillStyle = coreGrad;
    if (this.settings.enableBloom) {
      ctx.shadowColor = palette.colors[0];
      ctx.shadowBlur = 35 * this.settings.glowAmount * intensity;
    }
    ctx.fill();
    ctx.restore();

    // 4. Frequency Ray Starlight Corona
    const rays = 32;
    ctx.save();
    for (let i = 0; i < rays; i++) {
      const angle = (i / rays) * Math.PI * 2 + this.globalTime * 0.2;
      const freqVal = (rawFrequencies[i * 4] || 0) / 255;
      const rayLen = coreRadius + 40 + freqVal * 160 * intensity;

      ctx.strokeStyle = palette.colors[i % 4];
      ctx.lineWidth = 2 + freqVal * 4;
      ctx.globalAlpha = 0.4 + freqVal * 0.6;

      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * coreRadius, cy + Math.sin(angle) * coreRadius);
      ctx.lineTo(cx + Math.cos(angle) * rayLen, cy + Math.sin(angle) * rayLen);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ==========================================
  // 3. KINETIC RIBBONS (Fluid Harmonic Silk Waves)
  // ==========================================
  private renderKineticRibbons(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    bands: AudioBands,
    rawFrequencies: Uint8Array,
    palette: ColorPalette,
    intensity: number,
    bassBoost: number
  ) {
    const waveCount = 5;
    const points = 60;
    const stepX = w / points;

    ctx.save();
    for (let wave = 0; wave < waveCount; wave++) {
      const phaseOffset = (wave / waveCount) * Math.PI * 2;
      const baseFreq = 0.003 + wave * 0.001;
      const waveColor = palette.colors[wave % 4];
      const centerY = h * (0.35 + wave * 0.08);

      ctx.beginPath();
      ctx.moveTo(0, centerY);

      for (let i = 0; i <= points; i++) {
        const x = i * stepX;
        const freqIdx = Math.floor((i / points) * 120);
        const freqAmp = (rawFrequencies[freqIdx] || 0) / 255;

        const harmonic1 = Math.sin(x * baseFreq + this.globalTime * 1.5 + phaseOffset) * (60 + bands.bass * 120 * bassBoost);
        const harmonic2 = Math.cos(x * 0.008 - this.globalTime * 0.8) * (30 + bands.mid * 60);
        const reactiveDisplacement = freqAmp * 140 * intensity;

        const y = centerY + harmonic1 + harmonic2 + reactiveDisplacement;
        ctx.lineTo(x, y);
      }

      ctx.lineWidth = 3.5 + wave * 0.5;
      ctx.strokeStyle = waveColor;
      ctx.globalAlpha = 0.75 + bands.overallEnergy * 0.25;

      if (this.settings.enableBloom) {
        ctx.shadowColor = waveColor;
        ctx.shadowBlur = 18 * this.settings.glowAmount * intensity;
      }
      ctx.stroke();
    }
    ctx.restore();

    // Chromatic Harmonic Nodes
    const nodeCount = 18;
    ctx.save();
    for (let i = 0; i < nodeCount; i++) {
      const nx = (w / (nodeCount + 1)) * (i + 1);
      const freqVal = (rawFrequencies[i * 6] || 0) / 255;
      const ny = h * 0.5 + Math.sin(nx * 0.005 + this.globalTime * 2) * 80;
      const nr = 4 + freqVal * 16 * intensity;

      ctx.fillStyle = palette.colors[i % 4];
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(nx, ny, nr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ==========================================
  // 4. SACRED MANDALA (Kaleidoscopic Prism)
  // ==========================================
  private renderSacredMandala(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    bands: AudioBands,
    rawFrequencies: Uint8Array,
    palette: ColorPalette,
    intensity: number,
    bassBoost: number
  ) {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const petals = 12;
    const maxRadius = Math.min(w, h) * 0.42 * (1.0 + bands.bass * 0.3 * bassBoost);

    ctx.save();
    ctx.translate(cx, cy);

    // 1. Concentric Flower of Life Circles
    const rings = 4;
    for (let r = 1; r <= rings; r++) {
      const ringRadius = (maxRadius / rings) * r;
      ctx.strokeStyle = palette.colors[(r - 1) % 4];
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.3 + bands.overallEnergy * 0.4;
      ctx.beginPath();
      ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 2. Kaleidoscopic Petals and Fractal Polygons
    for (let i = 0; i < petals; i++) {
      const angle = (i / petals) * Math.PI * 2 + this.globalTime * 0.25;
      const freqVal = (rawFrequencies[i * 8] || 0) / 255;
      const petalLen = maxRadius * (0.4 + freqVal * 0.7 * intensity);

      ctx.save();
      ctx.rotate(angle);

      // Diamond facet
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(petalLen * 0.5, -25 - freqVal * 40);
      ctx.lineTo(petalLen, 0);
      ctx.lineTo(petalLen * 0.5, 25 + freqVal * 40);
      ctx.closePath();

      ctx.fillStyle = palette.colors[i % 4];
      ctx.globalAlpha = 0.15 + freqVal * 0.35;
      ctx.fill();

      ctx.strokeStyle = palette.colors[(i + 1) % 4];
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.8;
      if (this.settings.enableBloom) {
        ctx.shadowColor = palette.colors[i % 4];
        ctx.shadowBlur = 15 * this.settings.glowAmount * intensity;
      }
      ctx.stroke();

      ctx.restore();
    }

    // 3. Central Pulsing Octahedron Core
    const coreSize = 30 + bands.subBass * 50 * bassBoost;
    ctx.rotate(-this.globalTime * 0.6);
    ctx.beginPath();
    for (let s = 0; s < 8; s++) {
      const a = (s / 8) * Math.PI * 2;
      const dist = s % 2 === 0 ? coreSize : coreSize * 0.5;
      const sx = Math.cos(a) * dist;
      const sy = Math.sin(a) * dist;
      if (s === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.9;
    ctx.fill();
    ctx.strokeStyle = palette.colors[0];
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.restore();
  }

  // ==========================================
  // 5. AURORA LIQUID (Generative Ethereal Waves)
  // ==========================================
  private renderAuroraLiquid(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    bands: AudioBands,
    rawFrequencies: Uint8Array,
    palette: ColorPalette,
    intensity: number,
    bassBoost: number
  ) {
    const layers = 4;
    const points = 40;
    const stepX = w / points;

    ctx.save();
    for (let layer = 0; layer < layers; layer++) {
      const baseHeight = h * (0.45 + layer * 0.12);
      const grad = ctx.createLinearGradient(0, baseHeight - 180, 0, h);
      grad.addColorStop(0, palette.colors[layer % 4]);
      grad.addColorStop(0.7, palette.colors[(layer + 1) % 4]);
      grad.addColorStop(1, 'rgba(0,0,0,0.85)');

      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(0, baseHeight);

      for (let i = 0; i <= points; i++) {
        const x = i * stepX;
        const freqIdx = (layer * 12 + i * 2) % 100;
        const freqVal = (rawFrequencies[freqIdx] || 0) / 255;

        const wave1 = Math.sin(x * 0.004 + this.globalTime * 0.8 + layer * 1.5) * (50 + bands.bass * 80 * bassBoost);
        const wave2 = Math.cos(x * 0.007 - this.globalTime * 0.5) * 30;
        const y = baseHeight + wave1 + wave2 - freqVal * 120 * intensity;

        ctx.lineTo(x, y);
      }

      ctx.lineTo(w, h);
      ctx.closePath();

      ctx.fillStyle = grad;
      ctx.globalAlpha = 0.45 + bands.overallEnergy * 0.35;
      ctx.fill();

      // Top luminescent edge
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = palette.colors[layer % 4];
      ctx.globalAlpha = 0.8;
      if (this.settings.enableBloom) {
        ctx.shadowColor = palette.colors[layer % 4];
        ctx.shadowBlur = 20 * this.settings.glowAmount * intensity;
      }
      ctx.stroke();
    }
    ctx.restore();

    // Bioluminescent Motes
    const motesCount = Math.floor(this.maxParticles * 0.35 * this.settings.particleCountMultiplier);
    ctx.save();
    for (let i = 0; i < motesCount; i++) {
      const p = this.particles[i];
      p.y = (p.y - 0.001 * this.settings.speed - bands.mid * 0.002) % 1;
      if (p.y < 0) p.y += 1;

      const px = p.x * w;
      const py = p.y * h;
      const size = p.baseSize * (1.2 + bands.treble * 1.5);

      ctx.fillStyle = palette.colors[p.colorIndex];
      ctx.globalAlpha = p.alpha * 0.7;
      ctx.beginPath();
      ctx.arc(px, py, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ==========================================
  // 6. PEAK SPECTRUM (Minimalist Architectural Equalizer)
  // ==========================================
  private renderPeakSpectrum(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    bands: AudioBands,
    rawFrequencies: Uint8Array,
    palette: ColorPalette,
    intensity: number,
    bassBoost: number
  ) {
    const barCount = 54;
    const spacing = 4;
    const totalSpacing = (barCount - 1) * spacing;
    const barWidth = Math.max(3, (w * 0.88 - totalSpacing) / barCount);
    const startX = (w - (barCount * barWidth + totalSpacing)) / 2;
    const baselineY = h * 0.65;
    const maxHeight = h * 0.45;

    ctx.save();

    for (let i = 0; i < barCount; i++) {
      const x = startX + i * (barWidth + spacing);
      // Logarithmic perceptual distribution across 512 bins
      const binIdx = Math.min(511, Math.floor(Math.pow(i / barCount, 1.6) * 320));
      const rawVal = (rawFrequencies[binIdx] || 0) / 255;

      // Ambient breathing baseline so bars are subtly alive even in pauses
      const ambientSway = Math.sin(this.globalTime * 2 + i * 0.25) * 3;
      const boost = i < 12 ? bassBoost * 1.3 : 1.0;
      const reactiveAmp = rawVal * maxHeight * intensity * boost;
      const barHeight = Math.max(4, reactiveAmp + (bands.overallEnergy < 0.05 ? ambientSway : 0));

      // 1. Gravity Peak Needle
      if (barHeight > this.peakHoldValues[i]) {
        this.peakHoldValues[i] = barHeight;
        this.peakHoldDropSpeed[i] = 0;
      } else {
        this.peakHoldDropSpeed[i] += 0.35;
        this.peakHoldValues[i] -= this.peakHoldDropSpeed[i];
        if (this.peakHoldValues[i] < 4) this.peakHoldValues[i] = 4;
      }

      // Bar gradient fill
      const grad = ctx.createLinearGradient(0, baselineY - barHeight, 0, baselineY);
      const colorIdx = Math.floor((i / barCount) * 4) % 4;
      grad.addColorStop(0, palette.colors[colorIdx]);
      grad.addColorStop(1, palette.colors[(colorIdx + 1) % 4]);

      // Main upper bar
      ctx.fillStyle = grad;
      ctx.beginPath();
      this.drawSafeRoundRect(ctx, x, baselineY - barHeight, barWidth, barHeight, 3);
      ctx.fill();

      // Mirror reflection underneath
      const reflectGrad = ctx.createLinearGradient(0, baselineY, 0, baselineY + barHeight * 0.45);
      reflectGrad.addColorStop(0, palette.colors[colorIdx]);
      reflectGrad.addColorStop(1, 'rgba(0,0,0,0)');

      ctx.fillStyle = reflectGrad;
      ctx.globalAlpha = 0.32;
      ctx.beginPath();
      this.drawSafeRoundRect(ctx, x, baselineY + 2, barWidth, barHeight * 0.45, 3);
      ctx.fill();
      ctx.globalAlpha = 1.0;

      // Peak hold dot
      const peakY = baselineY - this.peakHoldValues[i] - 5;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      this.drawSafeRoundRect(ctx, x, peakY, barWidth, 3, 1.5);
      ctx.fill();
    }

    // Ground hairline divider
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w * 0.04, baselineY);
    ctx.lineTo(w * 0.96, baselineY);
    ctx.stroke();

    ctx.restore();
  }

  // ==========================================
  // 7. RETRO OSCILLOSCOPE (Cathode CRT Vector Beam)
  // ==========================================
  private renderRetroOscilloscope(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    bands: AudioBands,
    rawWaveform: Uint8Array,
    palette: ColorPalette,
    intensity: number,
    bassBoost: number
  ) {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const radius = Math.min(w, h) * 0.32 * (1.0 + bands.bass * 0.4 * bassBoost);

    ctx.save();

    // 1. CRT Circular Reticle Grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let r = 1; r <= 4; r++) {
      ctx.beginPath();
      ctx.arc(cx, cy, (radius / 4) * r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(cx - radius * 1.2, cy);
    ctx.lineTo(cx + radius * 1.2, cy);
    ctx.moveTo(cx, cy - radius * 1.2);
    ctx.lineTo(cx, cy + radius * 1.2);
    ctx.stroke();

    // 2. Lissajous X/Y Vector Beam from time domain signal
    const sampleCount = rawWaveform.length; // 512
    ctx.beginPath();

    for (let i = 0; i < sampleCount; i++) {
      const v1 = (rawWaveform[i] - 128) / 128;
      const v2 = (rawWaveform[(i + 96) % sampleCount] - 128) / 128;

      const angle = (i / sampleCount) * Math.PI * 2;
      const modulatedDist = radius * (0.8 + v1 * 0.9 * intensity);
      const px = cx + Math.cos(angle + this.globalTime * 0.5) * modulatedDist + v2 * 60;
      const py = cy + Math.sin(angle + this.globalTime * 0.5) * modulatedDist + v1 * 60;

      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();

    ctx.strokeStyle = palette.colors[0];
    ctx.lineWidth = 3.0;
    if (this.settings.enableBloom) {
      ctx.shadowColor = palette.colors[0];
      ctx.shadowBlur = 24 * this.settings.glowAmount * intensity;
    }
    ctx.stroke();

    // Inner bright core trace
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.0;
    ctx.shadowBlur = 0;
    ctx.stroke();

    // 3. CRT Scanlines
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    for (let y = 0; y < h; y += 4) {
      ctx.fillRect(0, y, w, 1.5);
    }

    ctx.restore();
  }

  // ==========================================
  // 8. VOXEL CITY (3D Isometric Skyline)
  // ==========================================
  private renderVoxelCity(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    bands: AudioBands,
    rawFrequencies: Uint8Array,
    palette: ColorPalette,
    intensity: number,
    bassBoost: number
  ) {
    const cols = 8;
    const rows = 6;
    const tileW = Math.min(w, h) * 0.09;
    const tileH = tileW * 0.5;
    const originX = w * 0.5;
    const originY = h * 0.45;

    ctx.save();

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const freqVal = (rawFrequencies[idx * 2] || 0) / 255;
        const targetHeight = Math.max(10, freqVal * 160 * intensity * (idx < 12 ? bassBoost : 1.0));

        // Smooth height lerp
        this.voxelHeights[idx] = this.voxelHeights[idx] * 0.75 + targetHeight * 0.25;
        const towerH = this.voxelHeights[idx];

        // Isometric coordinates
        const isoX = originX + (c - r) * (tileW * 0.5);
        const isoY = originY + (c + r) * (tileH * 0.5);

        const colorIdx = (r + c) % 4;
        const baseColor = palette.colors[colorIdx];

        // Left Face
        ctx.fillStyle = 'rgba(10, 15, 30, 0.85)';
        ctx.beginPath();
        ctx.moveTo(isoX - tileW * 0.5, isoY);
        ctx.lineTo(isoX, isoY + tileH * 0.5);
        ctx.lineTo(isoX, isoY + tileH * 0.5 - towerH);
        ctx.lineTo(isoX - tileW * 0.5, isoY - towerH);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Right Face
        ctx.fillStyle = 'rgba(20, 25, 45, 0.9)';
        ctx.beginPath();
        ctx.moveTo(isoX, isoY + tileH * 0.5);
        ctx.lineTo(isoX + tileW * 0.5, isoY);
        ctx.lineTo(isoX + tileW * 0.5, isoY - towerH);
        ctx.lineTo(isoX, isoY + tileH * 0.5 - towerH);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.stroke();

        // Top Rooftop (Neon illuminated)
        ctx.fillStyle = baseColor;
        ctx.beginPath();
        ctx.moveTo(isoX, isoY - tileH * 0.5 - towerH);
        ctx.lineTo(isoX + tileW * 0.5, isoY - towerH);
        ctx.lineTo(isoX, isoY + tileH * 0.5 - towerH);
        ctx.lineTo(isoX - tileW * 0.5, isoY - towerH);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        if (this.settings.enableBloom && freqVal > 0.4) {
          ctx.shadowColor = baseColor;
          ctx.shadowBlur = 15 * this.settings.glowAmount * intensity;
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }

    ctx.restore();
  }

  private drawSafeRoundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) {
    if (typeof (ctx as any).roundRect === 'function') {
      (ctx as any).roundRect(x, y, w, h, r);
      return;
    }
    const radius = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
  }
}
