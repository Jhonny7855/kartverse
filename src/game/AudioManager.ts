type AudioSettings = {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  musicEnabled: boolean;
};

type SfxName =
  | 'click'
  | 'hover'
  | 'countdown'
  | 'go'
  | 'boost'
  | 'collision'
  | 'lap'
  | 'finish'
  | 'victory'
  | 'pickup'
  | 'shift'
  | 'error';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private engine: {
    osc: OscillatorNode;
    osc2: OscillatorNode;
    gain: GainNode;
    filter: BiquadFilterNode;
    noise: AudioBufferSourceNode;
    noiseGain: GainNode;
  } | null = null;
  private drift: { noise: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode } | null = null;
  private musicTimer: number | null = null;
  private musicStep = 0;
  private settings: AudioSettings = {
    masterVolume: 0.75,
    musicVolume: 0.32,
    sfxVolume: 0.8,
    muted: false,
    musicEnabled: true,
  };
  private started = false;
  private engineActive = false;
  private noiseBuffer: AudioBuffer | null = null;
  private unlocked = false;

  init() {
    if (this.ctx) return;
    try {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.musicGain.connect(this.master);
      this.sfxGain.connect(this.master);
      this.applyVolumes();
      this.noiseBuffer = this.createNoiseBuffer(2);
    } catch {
      this.ctx = null;
    }
  }

  private createNoiseBuffer(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  async unlock() {
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch {
        return;
      }
    }
    this.unlocked = true;
  }

  applySettings(settings: AudioSettings) {
    this.settings = settings;
    this.applyVolumes();
  }

  private applyVolumes() {
    if (!this.master || !this.musicGain || !this.sfxGain) return;
    const master = this.settings.muted ? 0 : this.settings.masterVolume;
    this.master.gain.value = master;
    this.musicGain.gain.value = this.settings.musicEnabled ? this.settings.musicVolume : 0;
    this.sfxGain.gain.value = this.settings.sfxVolume;
  }

  startEngine() {
    this.init();
    if (!this.ctx || !this.sfxGain || this.engineActive || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const noise = ctx.createBufferSource();
    const noiseGain = ctx.createGain();
    const noiseFilter = ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.value = 62;
    osc2.type = 'square';
    osc2.frequency.value = 31;
    filter.type = 'lowpass';
    filter.frequency.value = 520;
    filter.Q.value = 3;
    gain.gain.value = 0;

    noise.buffer = this.noiseBuffer;
    noise.loop = true;
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 260;
    noiseFilter.Q.value = 0.8;
    noiseGain.gain.value = 0.0;

    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.sfxGain);

    osc.start();
    osc2.start();
    noise.start();
    gain.gain.setTargetAtTime(0.06, ctx.currentTime, 0.2);
    this.engine = { osc, osc2, gain, filter, noise, noiseGain };
    this.engineActive = true;
    this.started = true;
  }

  updateEngine(speed: number, throttle: number, boosting: boolean, drifting: boolean, offRoad: boolean) {
    if (!this.ctx || !this.engine) return;
    const t = this.ctx.currentTime;
    const norm = Math.min(1, speed / 34);
    const rev = norm * 0.85 + throttle * 0.25;
    const baseFreq = 52 + rev * 132 + (boosting ? 34 : 0);
    this.engine.osc.frequency.setTargetAtTime(baseFreq, t, 0.06);
    this.engine.osc2.frequency.setTargetAtTime(baseFreq * 0.5, t, 0.08);
    this.engine.filter.frequency.setTargetAtTime(320 + rev * 1500 + (boosting ? 500 : 0), t, 0.08);
    this.engine.gain.gain.setTargetAtTime(0.035 + rev * 0.05 + throttle * 0.02, t, 0.1);
    this.engine.noiseGain.gain.setTargetAtTime(offRoad ? 0.045 : drifting ? 0.012 : 0.004, t, 0.08);

    if (drifting && !this.drift && this.noiseBuffer) {
      const ctx = this.ctx;
      const noise = ctx.createBufferSource();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      noise.buffer = this.noiseBuffer;
      noise.loop = true;
      filter.type = 'bandpass';
      filter.frequency.value = 1400;
      filter.Q.value = 2.4;
      gain.gain.value = 0;
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain!);
      noise.start();
      gain.gain.setTargetAtTime(0.05, ctx.currentTime, 0.1);
      this.drift = { noise, gain, filter };
    } else if (!drifting && this.drift && this.ctx) {
      const d = this.drift;
      d.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
      setTimeout(() => {
        try {
          d.noise.stop();
        } catch {
          /* already stopped */
        }
      }, 260);
      this.drift = null;
    } else if (drifting && this.drift && this.ctx) {
      this.drift.filter.frequency.setTargetAtTime(1100 + norm * 1500, this.ctx.currentTime, 0.1);
      this.drift.gain.gain.setTargetAtTime(0.03 + norm * 0.045, this.ctx.currentTime, 0.1);
    }
  }

  stopEngine() {
    if (!this.engine || !this.ctx) return;
    const e = this.engine;
    e.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.12);
    e.noiseGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
    setTimeout(() => {
      try {
        e.osc.stop();
        e.osc2.stop();
        e.noise.stop();
      } catch {
        /* already stopped */
      }
    }, 400);
    this.engine = null;
    this.engineActive = false;
  }

  play(name: SfxName, opts: { pitch?: number; volume?: number } = {}) {
    this.init();
    if (!this.ctx || !this.sfxGain || this.settings.muted) return;
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vol = (opts.volume ?? 1) * this.settings.sfxVolume;
    if (vol <= 0) return;
    const pitch = opts.pitch ?? 1;

    const tone = (freq: number, dur: number, type: OscillatorType, gain: number, slideTo?: number) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + dur);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(gain * vol, now + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      osc.connect(g);
      g.connect(this.sfxGain!);
      osc.start(now);
      osc.stop(now + dur + 0.03);
    };

    const noiseHit = (dur: number, freq: number, gain: number, q = 1) => {
      if (!this.noiseBuffer) return;
      const src = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const g = ctx.createGain();
      src.buffer = this.noiseBuffer;
      filter.type = 'bandpass';
      filter.frequency.value = freq;
      filter.Q.value = q;
      g.gain.setValueAtTime(gain * vol, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      src.connect(filter);
      filter.connect(g);
      g.connect(this.sfxGain!);
      src.start(now);
      src.stop(now + dur + 0.02);
    };

    switch (name) {
      case 'click':
        tone(520 * pitch, 0.07, 'triangle', 0.12, 380);
        break;
      case 'hover':
        tone(880 * pitch, 0.045, 'sine', 0.045, 1040);
        break;
      case 'countdown':
        tone(440, 0.16, 'square', 0.1);
        tone(660, 0.16, 'sine', 0.06);
        break;
      case 'go':
        tone(880, 0.35, 'square', 0.13, 1320);
        tone(1320, 0.32, 'sine', 0.07);
        break;
      case 'boost':
        noiseHit(0.5, 900, 0.24, 0.7);
        tone(180, 0.45, 'sawtooth', 0.1, 520);
        break;
      case 'collision':
        noiseHit(0.22, 240, 0.34, 1.2);
        tone(110, 0.22, 'square', 0.14, 60);
        break;
      case 'lap':
        tone(660, 0.12, 'triangle', 0.1);
        tone(990, 0.18, 'triangle', 0.07);
        break;
      case 'finish':
        tone(523, 0.16, 'triangle', 0.11);
        setTimeout(() => tone(659, 0.16, 'triangle', 0.11), 130);
        setTimeout(() => tone(784, 0.3, 'triangle', 0.12), 260);
        break;
      case 'victory':
        [523, 659, 784, 1047].forEach((f, i) =>
          setTimeout(() => tone(f, 0.32, 'triangle', 0.12), i * 130),
        );
        break;
      case 'pickup':
        tone(740, 0.1, 'sine', 0.11, 1180);
        break;
      case 'shift':
        noiseHit(0.12, 420, 0.16, 1.6);
        break;
      case 'error':
        tone(200, 0.18, 'square', 0.1, 140);
        break;
    }
  }

  startMusic() {
    this.init();
    if (!this.ctx || this.musicTimer !== null) return;
    const ctx = this.ctx;
    const bpm = 112;
    const stepTime = 60 / bpm / 2;
    const bassNotes = [55, 55, 82.4, 55, 65.4, 65.4, 98, 73.4];
    const leadNotes = [220, 261.6, 329.6, 261.6, 293.7, 349.2, 293.7, 246.9];
    const schedule = () => {
      if (!this.ctx || !this.musicGain) return;
      const now = ctx.currentTime;
      const step = this.musicStep % 16;
      const bass = bassNotes[Math.floor(step / 2) % bassNotes.length];
      const lead = leadNotes[step % leadNotes.length];

      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      osc.type = 'sawtooth';
      osc.frequency.value = bass;
      filter.type = 'lowpass';
      filter.frequency.value = 320;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.16, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + stepTime * 0.9);
      osc.connect(filter);
      filter.connect(g);
      g.connect(this.musicGain);
      osc.start(now);
      osc.stop(now + stepTime);

      if (step % 2 === 0) {
        const hat = ctx.createOscillator();
        const hg = ctx.createGain();
        hat.type = 'square';
        hat.frequency.value = 6400;
        hg.gain.setValueAtTime(0.0001, now);
        hg.gain.exponentialRampToValueAtTime(0.028, now + 0.005);
        hg.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
        hat.connect(hg);
        hg.connect(this.musicGain);
        hat.start(now);
        hat.stop(now + 0.06);
      }
      if (step % 4 === 0) {
        const leadOsc = ctx.createOscillator();
        const lg = ctx.createGain();
        leadOsc.type = 'triangle';
        leadOsc.frequency.value = lead;
        lg.gain.setValueAtTime(0.0001, now);
        lg.gain.exponentialRampToValueAtTime(0.035, now + 0.03);
        lg.gain.exponentialRampToValueAtTime(0.0001, now + stepTime * 1.6);
        leadOsc.connect(lg);
        lg.connect(this.musicGain);
        leadOsc.start(now);
        leadOsc.stop(now + stepTime * 1.8);
      }
      this.musicStep++;
    };
    schedule();
    this.musicTimer = window.setInterval(schedule, stepTime * 1000);
  }

  stopMusic() {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  isStarted(): boolean {
    return this.started;
  }

  isUnlocked(): boolean {
    return this.unlocked;
  }

  dispose() {
    this.stopMusic();
    this.stopEngine();
    if (this.drift && this.ctx) {
      try {
        this.drift.noise.stop();
      } catch {
        /* ignore */
      }
    }
    this.drift = null;
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}
