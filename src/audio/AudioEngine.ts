/**
 * PulseWave High-Performance Audio Engine
 * Real-time frequency analysis, source capture (Screen/Tab Audio, Mic, File, Procedural Synth),
 * Beat/Kick detection, Spectral analysis, and GPU-friendly metrics extraction.
 */

export interface AudioBands {
  subBass: number; // 20 - 60 Hz
  bass: number;    // 60 - 250 Hz
  lowMid: number;  // 250 - 500 Hz
  mid: number;     // 500 - 2000 Hz
  highMid: number; // 2000 - 6000 Hz
  treble: number;  // 6000 - 20000 Hz
  overallEnergy: number; // 0 - 1
  beatDetected: boolean;
  beatIntensity: number; // 0 - 1
  bpmEstimate: number;
  beatPhase: number;     // 0 - 1 cyclic pulse synced with BPM
  spectralFlux: number;  // Transient onset attack
  vocalPresence: number; // Mid-range vocal / lead instrument index
  spectralCentroid: number; // Brightness in Hz
}

export interface AudioStatsSnapshot {
  energy: number;
  bassLevel: number;
  midLevel: number;
  trebleLevel: number;
  tempoEstimate: number;
  spectralCentroid: number;
  dynamicRange: number;
}

export type AudioSourceType = 'none' | 'tab_screen' | 'microphone' | 'file' | 'demo' | 'stream';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private silentSinkNode: GainNode | null = null;
  private audibleSinkNode: GainNode | null = null;

  // Active audio elements & stream nodes
  private currentStream: MediaStream | null = null;
  private currentSourceNode: MediaStreamAudioSourceNode | MediaElementAudioSourceNode | null = null;
  private audioElement: HTMLAudioElement | null = null;

  // Synth state for demo generator
  private synthInterval: number | null = null;
  private synthMasterGain: GainNode | null = null;
  private activeSynthType: string | null = null;

  // Frequency buffers
  private frequencyData: Uint8Array = new Uint8Array(512);
  private timeDomainData: Uint8Array = new Uint8Array(1024);
  private normalizedFrequencies: Float32Array = new Float32Array(512);
  private prevFrequencies: Float32Array = new Float32Array(512);
  private currentObjectUrl: string | null = null;

  // Analysis state
  private isRunning = false;
  private sourceType: AudioSourceType = 'none';
  private sourceName = 'Ninguna fuente conectada';
  private inputSensitivity = 1.8; // Multiplier for line-in / tab capture

  // Beat & Phase detection state
  private beatCutoff = 0.55;
  private beatDecayRate = 0.95;
  private beatHold = 0;
  private lastBeatTime = 0;
  private beatIntervals: number[] = [];
  private estimatedBpm = 120;
  private beatPhase = 0; // 0 to 1 accumulator locked to BPM
  private lastAnalysisTime = 0;
  private dynamicPeakEnvelope = 0.35; // Auto-gain normalization tracker

  // Audio stats smoothing
  private smoothEnergy = 0;
  private smoothBass = 0;
  private smoothMid = 0;
  private smoothTreble = 0;

  constructor() {
    // Lazy AudioContext initialization on first user interaction
  }

  public async initContext(): Promise<AudioContext> {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx({ latencyHint: 'interactive' });

      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.75;
      this.analyser.minDecibels = -90;
      this.analyser.maxDecibels = -10;

      // Silent sink connected to destination so Chromium Web Audio pump never sleeps or drops audio frames
      this.silentSinkNode = this.ctx.createGain();
      this.silentSinkNode.gain.value = 0.0;
      this.analyser.connect(this.silentSinkNode);
      this.silentSinkNode.connect(this.ctx.destination);

      // Audible sink for local MP3 and Procedural Synth demos
      this.audibleSinkNode = this.ctx.createGain();
      this.audibleSinkNode.gain.value = 1.0;
      this.audibleSinkNode.connect(this.ctx.destination);
    }

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    return this.ctx;
  }

  /**
   * Obtiene la lista de dispositivos de entrada de audio disponibles (Mezcla estéreo, Micrófonos, Cables virtuales)
   */
  public async getAudioInputDevices(): Promise<MediaDeviceInfo[]> {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        return [];
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter((d) => d.kind === 'audioinput');
    } catch (err) {
      console.error('Error al enumerar dispositivos de audio:', err);
      return [];
    }
  }

  /**
   * Captura el audio de una pestaña del navegador o del sistema (Google Flow Music, Spotify Web, YouTube, etc.)
   */
  public async captureTabAudio(): Promise<boolean> {
    try {
      this.stopCurrentSource();
      const ctx = await this.initContext();

      // Request display media with audio enabled
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        // User didn't check "Compartir audio / Share audio"
        stream.getTracks().forEach((track) => track.stop());
        throw new Error('No se detectó pista de audio. Recuerda seleccionar la pestaña o pantalla y marcar la casilla "Compartir audio del sistema / pestaña" en la ventana emergente.');
      }

      // Immediately stop video tracks to save 100% video decoding CPU/GPU resources
      stream.getVideoTracks().forEach((track) => track.stop());

      this.currentStream = stream;
      this.currentSourceNode = ctx.createMediaStreamSource(stream);
      this.currentSourceNode.connect(this.analyser!);

      // Listen for stream end (user clicks stop sharing in browser bar)
      audioTracks[0].onended = () => {
        this.stopCurrentSource();
      };

      this.sourceType = 'tab_screen';
      this.sourceName = 'Audio de Pestaña / Sistema (Spotify / PC)';
      this.isRunning = true;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      return true;
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        throw new Error('Permiso denegado. Para capturar Spotify o sonido del PC, haz clic en "Pestaña / PC", elige la pestaña de Spotify o "Toda la pantalla" y marca "Compartir audio".');
      }
      if (err.name === 'SecurityError') {
        throw new Error('La política de seguridad de este marco bloquea la captura de pantalla. Prueba usando "Spotify Web" en una pestaña de Chrome o seleccionando "Mezcla Estéreo / Micrófono".');
      }
      if (err.name === 'AbortError') {
        throw new Error('Selección de audio cancelada.');
      }
      console.error('Error al capturar audio de pestaña:', err);
      throw err;
    }
  }

  /**
   * Captura el micrófono, entrada de línea o Mezcla Estéreo (Stereo Mix)
   */
  public async captureMicrophone(deviceId?: string, customLabel?: string): Promise<boolean> {
    try {
      this.stopCurrentSource();
      const ctx = await this.initContext();

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Tu navegador no soporta captura de audio mediante getUserMedia.');
      }

      const constraints: MediaStreamConstraints = {
        audio: deviceId ? { deviceId: { exact: deviceId } } : {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
        video: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.currentStream = stream;
      this.currentSourceNode = ctx.createMediaStreamSource(stream);
      this.currentSourceNode.connect(this.analyser!);

      this.sourceType = 'microphone';
      this.sourceName = customLabel || 'Micrófono / Mezcla Estéreo';
      this.isRunning = true;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      return true;
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        throw new Error('Permiso de micrófono o dispositivo de entrada bloqueado. Permite el acceso desde el icono de candado en la barra del navegador.');
      }
      if (err.name === 'SecurityError') {
        throw new Error('Acceso restringido por la seguridad del navegador.');
      }
      if (err.name === 'AbortError') {
        throw new Error('Permiso cancelado.');
      }
      console.error('Error al capturar micrófono:', err);
      throw err;
    }
  }

  /**
   * Carga y reproduce un archivo de audio local (MP3, WAV, FLAC, AAC, etc.)
   */
  public async loadAudioFile(file: File): Promise<boolean> {
    try {
      this.stopCurrentSource();
      const ctx = await this.initContext();

      const objUrl = URL.createObjectURL(file);
      this.currentObjectUrl = objUrl;

      const audio = new Audio();
      audio.src = objUrl;
      audio.crossOrigin = 'anonymous';
      audio.loop = true;

      await audio.play();

      this.audioElement = audio;
      this.currentSourceNode = ctx.createMediaElementSource(audio);
      this.currentSourceNode.connect(this.analyser!);
      if (this.audibleSinkNode) {
        this.currentSourceNode.connect(this.audibleSinkNode);
      }

      this.sourceType = 'file';
      this.sourceName = file.name;
      this.isRunning = true;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      return true;
    } catch (err: any) {
      console.error('Error al cargar archivo de audio:', err);
      throw err;
    }
  }

  /**
   * Generador de música procedural por síntesis Web Audio de alta fidelidad.
   * Permite probar el visualizador instantáneamente con 5 estilos ricos sin necesidad de archivos externos.
   */
  public async playDemoSynth(type: 'synthwave' | 'ambient' | 'edm' | 'lofi' | 'techno'): Promise<boolean> {
    try {
      this.stopCurrentSource();
      const ctx = await this.initContext();

      this.synthMasterGain = ctx.createGain();
      this.synthMasterGain.gain.value = 0.55;
      this.synthMasterGain.connect(this.analyser!);
      if (this.audibleSinkNode) {
        this.synthMasterGain.connect(this.audibleSinkNode);
      }

      this.activeSynthType = type;
      this.sourceType = 'demo';
      this.isRunning = true;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      let step = 0;
      let bpm = 124;
      let chords: number[][] = [];
      let bassNotes: number[] = [];

      if (type === 'synthwave') {
        this.sourceName = 'Demo Synthwave: Neon Horizon (126 BPM)';
        bpm = 126;
        // Synthwave progression: Am - F - C - G
        chords = [
          [220, 261.63, 329.63, 440], // A minor
          [174.61, 220, 261.63, 349.23], // F major
          [261.63, 329.63, 392, 523.25], // C major
          [196, 246.94, 293.66, 392], // G major
        ];
        bassNotes = [55, 43.65, 65.41, 49]; // A1, F1, C2, G1
      } else if (type === 'edm') {
        this.sourceName = 'Demo EDM Bassdrop: Cyber Rave (130 BPM)';
        bpm = 130;
        chords = [
          [130.81, 164.81, 196.0, 261.63], // C minor
          [116.54, 146.83, 174.61, 233.08], // Bb
          [103.83, 130.81, 155.56, 207.65], // Ab
          [146.83, 185.0, 220.0, 293.66], // D
        ];
        bassNotes = [65.41, 58.27, 51.91, 73.42];
      } else if (type === 'lofi') {
        this.sourceName = 'Demo Lo-Fi Chill: Midnight Reverie (82 BPM)';
        bpm = 82;
        chords = [
          [293.66, 349.23, 440.0, 523.25], // Dm7
          [261.63, 329.63, 392.0, 493.88], // Cmaj7
          [220.0, 261.63, 329.63, 392.0], // Am7
          [246.94, 293.66, 369.99, 440.0], // Bm7b5
        ];
        bassNotes = [73.42, 65.41, 55.0, 61.74];
      } else if (type === 'ambient') {
        this.sourceName = 'Demo Ambient Ethereal: Deep Cosmos (70 BPM)';
        bpm = 70;
        chords = [
          [130.81, 196.0, 261.63, 329.63, 392.0], // C maj9
          [146.83, 220.0, 293.66, 369.99, 440.0], // D add9
          [164.81, 246.94, 329.63, 392.0, 493.88], // Em9
          [174.61, 261.63, 349.23, 440.0, 523.25], // F maj7#11
        ];
        bassNotes = [32.7, 36.71, 41.2, 43.65];
      } else {
        // Techno
        this.sourceName = 'Demo Techno Modular: Dark Pulse (135 BPM)';
        bpm = 135;
        chords = [
          [110.0, 164.81, 220.0, 329.63],
          [103.83, 155.56, 207.65, 311.13],
          [98.0, 146.83, 196.0, 293.66],
          [123.47, 185.0, 246.94, 369.99],
        ];
        bassNotes = [55.0, 51.91, 49.0, 61.74];
      }

      const stepTimeMs = (60 / bpm / 4) * 1000;

      this.synthInterval = window.setInterval(() => {
        if (!this.ctx || !this.synthMasterGain) return;
        const now = this.ctx.currentTime;
        const barStep = step % 16;
        const chordIndex = Math.floor((step / 16) % chords.length);
        const currentChord = chords[chordIndex];
        const currentBass = bassNotes[chordIndex];

        // 1. Kick Drum (on beats 0, 4, 8, 12 in 4/4)
        if (type !== 'ambient' && (barStep === 0 || barStep === 4 || barStep === 8 || barStep === 12 || (type === 'edm' && (barStep === 6 || barStep === 14)))) {
          this.triggerKick(now, type === 'edm' ? 1.4 : 1.0);
        }

        // 2. Snare / Claps (on beats 4, 12)
        if (type !== 'ambient' && (barStep === 4 || barStep === 12)) {
          this.triggerSnare(now, type === 'lofi' ? 0.6 : 0.9);
        }

        // 3. Hi-Hats (every 2 steps or 16th notes)
        if (type !== 'ambient' && (barStep % 2 === 0 || type === 'techno' || type === 'edm')) {
          this.triggerHiHat(now, barStep % 4 === 2 ? 0.35 : 0.18, type === 'lofi');
        }

        // 4. Bass synth (sub bass pulses)
        if (barStep % 2 === 0) {
          this.triggerBass(now, currentBass, stepTimeMs / 1000 * 1.8, type);
        }

        // 5. Chord Pad / Arpeggio
        if (type === 'ambient') {
          if (barStep === 0) {
            this.triggerPadChord(now, currentChord, (stepTimeMs * 16) / 1000);
          }
        } else if (type === 'synthwave' || type === 'techno' || type === 'edm') {
          // Arpeggio note
          const arpNote = currentChord[step % currentChord.length];
          this.triggerArpLead(now, arpNote, stepTimeMs / 1000 * 1.5, type);
          if (barStep === 0) {
            this.triggerPadChord(now, currentChord, (stepTimeMs * 8) / 1000);
          }
        } else if (type === 'lofi') {
          if (barStep === 0 || barStep === 8) {
            this.triggerLoFiKey(now, currentChord, (stepTimeMs * 7) / 1000);
          }
        }

        step++;
      }, stepTimeMs);

      this.isRunning = true;
      return true;
    } catch (err: any) {
      console.error('Error al iniciar sintetizador demo:', err);
      throw err;
    }
  }

  // --- Procedural Sound Synthesis Routines ---
  private triggerKick(time: number, power = 1.0) {
    if (!this.ctx || !this.synthMasterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, time);
    osc.frequency.exponentialRampToValueAtTime(36, time + 0.12);

    gain.gain.setValueAtTime(0.85 * power, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.28);

    osc.connect(gain);
    gain.connect(this.synthMasterGain);

    osc.start(time);
    osc.stop(time + 0.28);
  }

  private triggerSnare(time: number, volume = 0.8) {
    if (!this.ctx || !this.synthMasterGain) return;
    // Tone
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, time);
    osc.frequency.exponentialRampToValueAtTime(70, time + 0.1);
    oscGain.gain.setValueAtTime(0.4 * volume, time);
    oscGain.gain.exponentialRampToValueAtTime(0.01, time + 0.12);
    osc.connect(oscGain);
    oscGain.connect(this.synthMasterGain);

    // Noise burst
    const bufferSize = this.ctx.sampleRate * 0.15;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 1000;
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.6 * volume, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.synthMasterGain);

    osc.start(time);
    osc.stop(time + 0.12);
    noise.start(time);
    noise.stop(time + 0.15);
  }

  private triggerHiHat(time: number, volume = 0.2, isLoFi = false) {
    if (!this.ctx || !this.synthMasterGain) return;
    const bufferSize = this.ctx.sampleRate * (isLoFi ? 0.08 : 0.04);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = isLoFi ? 'bandpass' : 'highpass';
    filter.frequency.value = isLoFi ? 4500 : 7500;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + (isLoFi ? 0.07 : 0.04));

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.synthMasterGain);

    noise.start(time);
    noise.stop(time + (isLoFi ? 0.08 : 0.05));
  }

  private triggerBass(time: number, freq: number, duration: number, style: string) {
    if (!this.ctx || !this.synthMasterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = style === 'synthwave' || style === 'techno' ? 'sawtooth' : 'sine';
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(style === 'synthwave' ? 450 : 220, time);
    filter.frequency.exponentialRampToValueAtTime(100, time + duration);

    gain.gain.setValueAtTime(0.65, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.synthMasterGain);

    osc.start(time);
    osc.stop(time + duration);
  }

  private triggerArpLead(time: number, freq: number, duration: number, style: string) {
    if (!this.ctx || !this.synthMasterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = style === 'edm' ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(freq * (style === 'synthwave' ? 2 : 1), time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1800, time);
    filter.frequency.exponentialRampToValueAtTime(600, time + duration);

    gain.gain.setValueAtTime(0.25, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.synthMasterGain);

    osc.start(time);
    osc.stop(time + duration);
  }

  private triggerPadChord(time: number, chord: number[], duration: number) {
    if (!this.ctx || !this.synthMasterGain) return;
    chord.forEach((freq) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const filter = this.ctx!.createBiquadFilter();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);

      filter.type = 'lowpass';
      filter.frequency.value = 1200;

      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(0.08, time + duration * 0.3);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.synthMasterGain!);

      osc.start(time);
      osc.stop(time + duration);
    });
  }

  private triggerLoFiKey(time: number, chord: number[], duration: number) {
    if (!this.ctx || !this.synthMasterGain) return;
    chord.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'triangle';
      // Slight detune for warm vintage lo-fi chorus
      osc.frequency.setValueAtTime(freq + (Math.random() - 0.5) * 1.5, time);

      gain.gain.setValueAtTime(0.12 / (idx + 1), time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc.connect(gain);
      gain.connect(this.synthMasterGain!);

      osc.start(time);
      osc.stop(time + duration);
    });
  }

  /**
   * Detiene la fuente de audio actual y limpia streams
   */
  public stopCurrentSource() {
    if (this.synthInterval) {
      clearInterval(this.synthInterval);
      this.synthInterval = null;
    }
    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = null;
    }
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.src = '';
      this.audioElement = null;
    }
    if (this.currentStream) {
      this.currentStream.getTracks().forEach((t) => t.stop());
      this.currentStream = null;
    }
    if (this.currentSourceNode) {
      this.currentSourceNode.disconnect();
      this.currentSourceNode = null;
    }
    this.sourceType = 'none';
    this.sourceName = 'Ninguna fuente conectada';
    this.isRunning = false;
  }

  /**
   * Extrae métricas acústicas en tiempo real optimizadas para renderizado a 60-120 FPS
   */
  public getAnalysis(): AudioBands {
    const now = performance.now();
    const dt = this.lastAnalysisTime > 0 ? (now - this.lastAnalysisTime) / 1000 : 0.016;
    this.lastAnalysisTime = now;

    if (!this.analyser || !this.isRunning) {
      return {
        subBass: 0,
        bass: 0,
        lowMid: 0,
        mid: 0,
        highMid: 0,
        treble: 0,
        overallEnergy: 0,
        beatDetected: false,
        beatIntensity: 0,
        bpmEstimate: this.estimatedBpm,
        beatPhase: (now / 500) % 1,
        spectralFlux: 0,
        vocalPresence: 0,
        spectralCentroid: 1000,
      };
    }

    this.analyser.getByteFrequencyData(this.frequencyData as any);
    this.analyser.getByteTimeDomainData(this.timeDomainData as any);

    const binCount = this.analyser.frequencyBinCount; // 512
    const sampleRate = this.ctx?.sampleRate || 44100;
    const nyquist = sampleRate / 2;
    const binHz = nyquist / binCount;

    // Calculate energy in frequency bands & Spectral Flux (Onset attacks)
    let subBassSum = 0, subBassCount = 0;
    let bassSum = 0, bassCount = 0;
    let lowMidSum = 0, lowMidCount = 0;
    let midSum = 0, midCount = 0;
    let highMidSum = 0, highMidCount = 0;
    let trebleSum = 0, trebleCount = 0;

    let totalEnergySum = 0;
    let weightedFrequencySum = 0;
    let spectralFluxSum = 0;
    let maxBinVal = 0;

    for (let i = 0; i < binCount; i++) {
      const rawVal = this.frequencyData[i] / 255;
      this.normalizedFrequencies[i] = rawVal;
      if (rawVal > maxBinVal) maxBinVal = rawVal;

      // Positive difference in frequency energy (transient note onset)
      const diff = rawVal - this.prevFrequencies[i];
      if (diff > 0) {
        spectralFluxSum += diff;
      }
      this.prevFrequencies[i] = rawVal;

      const hz = i * binHz;
      totalEnergySum += rawVal;
      weightedFrequencySum += rawVal * hz;

      if (hz >= 20 && hz < 60) {
        subBassSum += rawVal;
        subBassCount++;
      } else if (hz >= 60 && hz < 250) {
        bassSum += rawVal;
        bassCount++;
      } else if (hz >= 250 && hz < 500) {
        lowMidSum += rawVal;
        lowMidCount++;
      } else if (hz >= 500 && hz < 2000) {
        midSum += rawVal;
        midCount++;
      } else if (hz >= 2000 && hz < 6000) {
        highMidSum += rawVal;
        highMidCount++;
      } else if (hz >= 6000) {
        trebleSum += rawVal;
        trebleCount++;
      }
    }

    // Auto-Gain Control (AGC) Envelope tracker: adapts smoothly to track master volume
    if (maxBinVal > this.dynamicPeakEnvelope) {
      this.dynamicPeakEnvelope = this.dynamicPeakEnvelope * 0.9 + maxBinVal * 0.1;
    } else {
      this.dynamicPeakEnvelope = Math.max(0.3, this.dynamicPeakEnvelope * 0.997);
    }
    const agcMultiplier = Math.min(1.8, Math.max(0.9, 1.0 / (this.dynamicPeakEnvelope + 0.1)));

    const rawSubBass = (subBassCount ? subBassSum / subBassCount : 0) * agcMultiplier;
    const rawBass = (bassCount ? bassSum / bassCount : 0) * agcMultiplier;
    const rawLowMid = (lowMidCount ? lowMidSum / lowMidCount : 0) * agcMultiplier;
    const rawMid = (midCount ? midSum / midCount : 0) * agcMultiplier;
    const rawHighMid = (highMidCount ? highMidSum / highMidCount : 0) * agcMultiplier;
    const rawTreble = (trebleCount ? trebleSum / trebleCount : 0) * agcMultiplier;
    const rawEnergy = (totalEnergySum / binCount) * agcMultiplier;
    const spectralFlux = (spectralFluxSum / (binCount * 0.5)) * agcMultiplier;

    // Smooth values for buttery liquid continuous motion
    this.smoothBass = this.smoothBass * 0.82 + rawBass * 0.18;
    this.smoothMid = this.smoothMid * 0.82 + rawMid * 0.18;
    this.smoothTreble = this.smoothTreble * 0.82 + rawTreble * 0.18;
    this.smoothEnergy = this.smoothEnergy * 0.82 + rawEnergy * 0.18;

    // Spectral centroid (acoustic brightness)
    const spectralCentroid = totalEnergySum > 0.01 ? weightedFrequencySum / totalEnergySum : 1000;

    // Vocal presence index (voice / lead instrument dominant frequency band 400Hz - 2500Hz)
    const vocalPresence = Math.min(1.0, (rawMid * 1.3) / (rawBass * 0.7 + rawTreble * 0.7 + 0.15));

    // Beat / Kick onset detector with 280ms hysteresis
    const instantBass = rawSubBass * 0.6 + rawBass * 0.4 + spectralFlux * 0.2;
    let beatDetected = false;
    let beatIntensity = 0;

    if (instantBass > this.beatCutoff && instantBass > 0.38 && now - this.lastBeatTime > 280) {
      beatDetected = true;
      beatIntensity = Math.min(1.0, (instantBass - this.beatCutoff) * 2.2 + 0.3);
      this.beatCutoff = instantBass * 1.12;
      this.beatHold = 8;

      // Estimate tempo interval
      if (this.lastBeatTime > 0) {
        const interval = now - this.lastBeatTime;
        if (interval > 280 && interval < 1400) {
          this.beatIntervals.push(interval);
          if (this.beatIntervals.length > 8) this.beatIntervals.shift();
          const avgInterval = this.beatIntervals.reduce((a, b) => a + b, 0) / this.beatIntervals.length;
          this.estimatedBpm = Math.round(60000 / avgInterval);
        }
      }
      this.lastBeatTime = now;
      // Resynchronize beat phase on strong downbeat
      this.beatPhase = 0;
    } else {
      if (this.beatHold <= 0) {
        this.beatCutoff *= this.beatDecayRate;
        this.beatCutoff = Math.max(0.32, this.beatCutoff);
      } else {
        this.beatHold--;
      }
    }

    // Progress continuous beat phase based on detected BPM
    const bps = (this.estimatedBpm || 120) / 60;
    this.beatPhase = (this.beatPhase + dt * bps) % 1.0;

    return {
      subBass: Math.min(1.0, rawSubBass),
      bass: Math.min(1.0, this.smoothBass),
      lowMid: Math.min(1.0, rawLowMid),
      mid: Math.min(1.0, this.smoothMid),
      highMid: Math.min(1.0, rawHighMid),
      treble: Math.min(1.0, this.smoothTreble),
      overallEnergy: Math.min(1.0, this.smoothEnergy),
      beatDetected,
      beatIntensity,
      bpmEstimate: this.estimatedBpm,
      beatPhase: this.beatPhase,
      spectralFlux: Math.min(1.0, spectralFlux),
      vocalPresence: Math.min(1.0, vocalPresence),
      spectralCentroid,
    };
  }

  public getRawFrequencies(): Uint8Array {
    return this.frequencyData;
  }

  public getRawWaveform(): Uint8Array {
    return this.timeDomainData;
  }

  public getSourceInfo() {
    return {
      type: this.sourceType,
      name: this.sourceName,
      isRunning: this.isRunning,
    };
  }

  public setVolume(vol: number) {
    if (this.audibleSinkNode) {
      this.audibleSinkNode.gain.value = Math.max(0, Math.min(2, vol));
    }
  }

  public setInputSensitivity(sens: number) {
    this.inputSensitivity = Math.max(0.5, Math.min(4.0, sens));
  }

  public getInputSensitivity(): number {
    return this.inputSensitivity;
  }

  public getInputLevel(): number {
    return this.smoothEnergy;
  }

  public getSnapshotForAI(): AudioStatsSnapshot {
    const safeEnergy = Number.isFinite(this.smoothEnergy) ? Number(this.smoothEnergy.toFixed(3)) : 0.5;
    const safeBass = Number.isFinite(this.smoothBass) ? Number(this.smoothBass.toFixed(3)) : 0.5;
    const safeMid = Number.isFinite(this.smoothMid) ? Number(this.smoothMid.toFixed(3)) : 0.5;
    const safeTreble = Number.isFinite(this.smoothTreble) ? Number(this.smoothTreble.toFixed(3)) : 0.5;
    const safeDynRange = Number.isFinite(safeBass / (safeTreble + 0.01))
      ? Number((safeBass / (safeTreble + 0.01)).toFixed(2))
      : 1.0;

    return {
      energy: safeEnergy,
      bassLevel: safeBass,
      midLevel: safeMid,
      trebleLevel: safeTreble,
      tempoEstimate: this.estimatedBpm || 120,
      spectralCentroid: Math.round(safeMid * 2000 + safeTreble * 6000) || 1500,
      dynamicRange: safeDynRange,
    };
  }
}
