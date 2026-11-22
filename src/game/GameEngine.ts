import * as THREE from 'three';
import type {
  Customization,
  GhostFrame,
  HudSnapshot,
  KartClassId,
  RaceConfig,
  RaceOutcome,
  Settings,
  TrackDef,
} from '../data/types';
import { getKart, KARTS } from '../data/karts';
import { getTrack } from '../data/tracks';
import { buildTrack } from './TrackBuilder';
import { KartModel } from './KartModel';
import { RaceManager, type RaceEvent } from './RaceManager';
import { EffectsManager } from './EffectsManager';
import { CameraController, CAMERA_LABELS } from './CameraController';
import { InputManager } from './InputManager';
import { AudioManager } from './AudioManager';
import { AIController } from './AIController';
import { clamp, seededRandom, RACER_NAMES, formatGap } from './utils';
import { sampleSurface } from './RacePhysics';

export interface EngineCallbacks {
  onHud: (hud: HudSnapshot) => void;
  onFinish: (outcome: RaceOutcome) => void;
  onLoading: (progress: number, label: string) => void;
  onReady: () => void;
  onPauseChange: (paused: boolean) => void;
  onToast: (text: string, kind?: 'info' | 'warn' | 'success') => void;
  onCameraChange: (label: string) => void;
  onDebug: (stats: { fps: number; frameMs: number; drawCalls: number; triangles: number; karts: number; bodies: number }) => void;
}

export interface EngineOptions {
  config: RaceConfig;
  settings: Settings;
  ghost?: {
    frames: { t: number; x: number; y: number; z: number; heading: number }[];
    kartId?: KartClassId;
  } | null;
  callbacks: EngineCallbacks;
}

const AI_COLORS = ['#ff5a2e', '#22e6ff', '#ff2f8d', '#8d63ff', '#2fffb4', '#ffd166', '#ff7a45'];

export class GameEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private raf = 0;
  private disposed = false;
  private opts: EngineOptions;
  private settings: Settings;
  private trackDef: TrackDef;
  private spline!: ReturnType<typeof buildTrack>['spline'];
  private trackGroup: THREE.Group | null = null;
  private scenery: ReturnType<typeof buildTrack>['scenery'] | null = null;
  private race!: RaceManager;
  private kartModels = new Map<string, KartModel>();
  private ghostModel: KartModel | null = null;
  private ghostFrames: EngineOptions['ghost'] extends infer T ? T : never = null;
  private effects: EffectsManager;
  private cameraCtl: CameraController;
  private input: InputManager;
  private audio: AudioManager;
  private sun: THREE.DirectionalLight | null = null;
  private hemi: THREE.HemisphereLight | null = null;
  private ambient: THREE.AmbientLight | null = null;
  private sky: THREE.Mesh | null = null;
  private physicsAccumulator = 0;
  private readonly fixedStep = 1 / 120;
  private hudTimer = 0;
  private debugTimer = 0;
  private frames = 0;
  private fpsTime = 0;
  private fps = 60;
  private frameMs = 16.7;
  private outcomeSent = false;
  private paused = false;
  private countdownGoTimer = 0;
  private ghostTime = 0;
  private ghostRecorder: GhostFrame[] = [];
  private ghostLaps: { time: number; frames: GhostFrame[] }[] = [];
  private ghostLapStart = 0;
  private ghostRecAccum = 0;
  private driftSoundTimer = 0;
  private lastLapAlert = 0;
  private keysHandled = false;
  private ready = false;
  private smokeAccum = 0;
  private raceStartProgress = 0;
  private eliminatedPlayer = false;
  private racerNameMap = new Map<string, string>();
  private totalRacers = 0;
  private trackName = '';
  private itemToastCooldown = 0;
  private resizeObserver: ResizeObserver | null = null;
  private contextLostHandler: ((e: Event) => void) | null = null;
  private contextRestoredHandler: (() => void) | null = null;

  constructor(container: HTMLElement, opts: EngineOptions) {
    this.container = container;
    this.opts = opts;
    this.settings = opts.settings;
    this.trackDef = getTrack(opts.config.trackId);
    this.trackName = this.trackDef.name;

    const pixelRatio = Math.min(window.devicePixelRatio || 1, this.settings.quality === 'high' ? 2 : 1.5) * this.settings.resolutionScale;
    this.renderer = new THREE.WebGLRenderer({
      antialias: this.settings.antiAliasing && this.settings.quality !== 'low',
      powerPreference: 'high-performance',
      alpha: false,
      stencil: false,
    });
    this.renderer.setPixelRatio(clamp(pixelRatio, 0.6, 2));
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    this.renderer.shadowMap.enabled = this.settings.shadows && this.settings.quality !== 'low';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.28;
    this.renderer.domElement.className = 'game-canvas';
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(62, (container.clientWidth || 1) / (container.clientHeight || 1), 0.3, 1600);
    this.camera.position.set(0, 6, -12);
    this.cameraCtl = new CameraController(this.camera);
    this.cameraCtl.setSensitivity(this.settings.cameraSensitivity);
    this.cameraCtl.setShakeAmount(this.settings.cameraShake);

    this.effects = new EffectsManager(this.scene);
    this.effects.configure({
      effects: this.settings.effects,
      particles: this.settings.particles,
      quality: this.settings.quality,
    });

    this.audio = new AudioManager();
    this.audio.applySettings({
      masterVolume: this.settings.masterVolume,
      musicVolume: this.settings.musicVolume,
      sfxVolume: this.settings.sfxVolume,
      muted: this.settings.muted,
      musicEnabled: this.settings.musicEnabled,
    });

    this.input = new InputManager(this.settings.bindings, (command) => this.handleCommand(command));

    this.buildLighting();
    this.setupContextHandlers();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
  }

  private handleCommand(command: 'pause' | 'camera' | 'reset' | 'item') {
    if (!this.ready) return;
    if (command === 'pause') {
      if (this.race.state === 'finished') return;
      this.togglePause();
    } else if (command === 'camera') {
      if (this.paused) return;
      const mode = this.cameraCtl.cycle();
      this.opts.callbacks.onCameraChange(CAMERA_LABELS[mode]);
      this.audio.play('click', { volume: 0.5 });
    } else if (command === 'reset') {
      if (this.paused || this.race.state === 'finished') return;
      this.race.respawnPlayer();
      this.audio.play('shift');
      this.opts.callbacks.onToast('Kart recovered', 'info');
    } else if (command === 'item') {
      if (this.paused || this.race.state !== 'racing') return;
      if (this.race.usePlayerItem()) {
        this.audio.play('pickup');
      } else if (this.race.player.item) {
        this.audio.play('error', { volume: 0.5 });
      }
    }
  }

  private buildLighting() {
    const p = this.trackDef.palette;
    this.scene.background = new THREE.Color(p.skyTop);
    this.scene.fog = new THREE.Fog(p.fog, 120, this.trackDef.theme === 'forest' ? 420 : 620);

    this.hemi = new THREE.HemisphereLight(new THREE.Color(p.ambient), new THREE.Color(p.ground), p.ambientIntensity);
    this.scene.add(this.hemi);
    this.ambient = new THREE.AmbientLight(new THREE.Color(p.ambient), p.ambientIntensity * 0.35);
    this.scene.add(this.ambient);

    this.sun = new THREE.DirectionalLight(new THREE.Color(p.sun), p.sunIntensity);
    this.sun.position.set(90, 150, 60);
    if (this.settings.shadows && this.settings.quality !== 'low') {
      this.sun.castShadow = true;
      const size = this.settings.quality === 'high' ? 2048 : 1024;
      this.sun.shadow.mapSize.set(size, size);
      this.sun.shadow.camera.near = 1;
      this.sun.shadow.camera.far = 420;
      const d = 110;
      this.sun.shadow.camera.left = -d;
      this.sun.shadow.camera.right = d;
      this.sun.shadow.camera.top = d;
      this.sun.shadow.camera.bottom = -d;
      this.sun.shadow.bias = -0.0012;
      this.sun.shadow.normalBias = 0.035;
    }
    this.scene.add(this.sun);

    // Gradient sky dome.
    const skyGeo = new THREE.SphereGeometry(900, 24, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(p.skyTop) },
        bottomColor: { value: new THREE.Color(p.skyBottom) },
        offset: { value: 120 },
        exponent: { value: 0.55 },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
          gl_FragColor = vec4(mix(bottomColor, topColor, pow(max(h, 0.0), exponent)), 1.0);
        }
      `,
    });
    this.sky = new THREE.Mesh(skyGeo, skyMat);
    this.sky.frustumCulled = false;
    this.scene.add(this.sky);

    if (this.trackDef.theme === 'city' || this.trackDef.theme === 'skyline' || this.trackDef.theme === 'volcano') {
      const accent = new THREE.PointLight(new THREE.Color(p.accent), 3.2, 180, 2);
      accent.position.set(0, 26, 0);
      this.scene.add(accent);
    }
  }

  private setupContextHandlers() {
    const canvas = this.renderer.domElement;
    this.contextLostHandler = (e: Event) => {
      e.preventDefault();
      this.paused = true;
      this.opts.callbacks.onToast('Graphics context lost — attempting recovery', 'warn');
    };
    this.contextRestoredHandler = () => {
      this.opts.callbacks.onToast('Graphics restored', 'success');
    };
    canvas.addEventListener('webglcontextlost', this.contextLostHandler);
    canvas.addEventListener('webglcontextrestored', this.contextRestoredHandler);
  }

  async load() {
    const steps = [
      'Building circuit spline',
      'Laying asphalt',
      'Raising skyline',
      'Installing barriers',
      'Spawning karts',
      'Warming physics',
    ];
    const wait = () => new Promise((r) => setTimeout(r, 18));
    for (let i = 0; i < steps.length; i++) {
      this.opts.callbacks.onLoading(i / steps.length, steps[i]);
      await wait();
      if (this.disposed) return;
    }

    const built = buildTrack(this.trackDef);
    this.spline = built.spline;
    this.trackGroup = built.group;
    this.scenery = built.scenery;
    this.scene.add(built.group);

    const config = this.opts.config;
    const playerDef = getKart(config.kartId);
    const opponents = config.mode === 'timetrial' || config.mode === 'practice' ? 0 : Math.max(1, config.opponents);
    const rand = seededRandom(this.trackDef.id.length * 977 + opponents * 31);
    const names = [...RACER_NAMES].sort(() => rand() - 0.5).slice(0, opponents);
    const aiDefs = KARTS.filter((k) => k.id !== playerDef.id);
    const aiNames = names.map((n) => n);
    this.racerNameMap = new Map(aiNames.map((n) => [n, n]));
    this.totalRacers = opponents + 1;

    this.opts.callbacks.onLoading(0.72, 'Calibrating race control');
    await wait();
    if (this.disposed) return;

    this.race = new RaceManager(this.spline, {
      mode: config.mode,
      track: this.trackDef,
      difficulty: config.difficulty,
      laps: config.mode === 'practice' ? 0 : config.laps,
      opponents,
      playerDef,
      playerId: 'YOU',
      aiDefs,
      aiNames,
      steeringSensitivity: this.settings.steeringSensitivity,
      quality: this.settings.quality,
      onEvent: () => {},
    });
    this.raceStartProgress = this.race.player.progressDistance;

    this.opts.callbacks.onLoading(0.86, 'Detailing kart bodies');
    await wait();
    if (this.disposed) return;

    // Player kart.
    const playerModel = new KartModel(playerDef, config.customization, { shadows: this.settings.shadows });
    this.kartModels.set('YOU', playerModel);
    this.scene.add(playerModel.root);

    // AI karts with distinct palettes.
    for (let i = 0; i < opponents; i++) {
      const def = aiDefs[i % aiDefs.length];
      const name = aiNames[i];
      const color = AI_COLORS[i % AI_COLORS.length];
      const cust: Customization = {
        bodyColor: color,
        wheelColor: '#14161c',
        rimColor: color,
        glowColor: color,
        decal: (['stripe', 'flames', 'circuit', 'star'] as const)[i % 4],
        number: String(10 + i),
        helmetColor: color,
        spoiler: def.spoiler,
        exhaust: def.exhaust,
      };
      const model = new KartModel(def, cust, { shadows: this.settings.shadows, simple: this.settings.quality === 'low' });
      this.kartModels.set(name, model);
      this.scene.add(model.root);
    }

    if (this.opts.ghost && this.opts.ghost.frames.length > 1) {
      this.ghostFrames = this.opts.ghost;
      const ghostDef = getKart(this.opts.ghost.kartId ?? this.opts.config.kartId);
      this.ghostModel = new KartModel(ghostDef, config.customization, { ghost: true, shadows: false });
      this.scene.add(this.ghostModel.root);
    }

    // Ground plane safety net for tracks without scenery ground.
    if (this.trackDef.theme === 'skyline') {
      const cloudFloor = new THREE.Mesh(
        new THREE.PlaneGeometry(1600, 1600),
        new THREE.MeshBasicMaterial({ color: 0xdcefff }),
      );
      cloudFloor.rotation.x = -Math.PI / 2;
      cloudFloor.position.y = -40;
      this.scene.add(cloudFloor);
    }

    this.cameraCtl.snap(this.race.player);

    this.opts.callbacks.onLoading(0.95, 'Grid cleared');
    await wait();
    if (this.disposed) return;

    this.ready = true;
    this.audio.unlock();
    this.audio.startEngine();
    this.audio.startMusic();
    this.opts.callbacks.onLoading(1, 'Ready');
    this.opts.callbacks.onReady();
    this.clock.start();
    this.loop();
  }

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dtRaw = this.clock.getDelta();
    const dt = Math.min(dtRaw, 0.05);
    this.frames += 1;
    this.fpsTime += dtRaw;
    if (this.fpsTime >= 0.5) {
      this.fps = this.frames / this.fpsTime;
      this.frameMs = (this.fpsTime / this.frames) * 1000;
      this.frames = 0;
      this.fpsTime = 0;
    }

    if (!this.ready) {
      this.renderer.render(this.scene, this.camera);
      return;
    }

    if (!this.paused && this.race.state !== 'finished') {
      this.physicsAccumulator += dt;
      let iterations = 0;
      const playerInput = this.input.getInput();
      while (this.physicsAccumulator >= this.fixedStep && iterations < 12) {
        this.race.update(this.fixedStep, playerInput);
        this.physicsAccumulator -= this.fixedStep;
        iterations += 1;
      }
      if (iterations >= 12) this.physicsAccumulator = 0;
    }

    this.drainRaceEvents();
    this.recordGhost(dt);
    this.updateVisuals(dt);
    this.effects.update(dt);
    if (this.scenery) this.scenery.animated(dt);

    this.cameraCtl.update(this.race.player, dt);
    this.hideCameraBlockers(dt);
    if (this.sun) {
      this.sun.position.set(
        this.race.player.position.x + 80,
        this.race.player.position.y + 150,
        this.race.player.position.z + 60,
      );
      this.sun.target.position.copy(this.race.player.position);
      this.sun.target.updateMatrixWorld();
    }
    if (this.sky) this.sky.position.copy(this.camera.position);

    this.audio.updateEngine(
      this.race.player.speed,
      this.input.getInput().throttle,
      this.race.player.boosting,
      this.race.player.drifting,
      this.race.player.offRoad,
    );

    this.hudTimer += dt;
    if (this.hudTimer > 1 / 20) {
      this.hudTimer = 0;
      this.publishHud();
    }
    this.debugTimer += dt;
    if (this.debugTimer > 0.5) {
      this.debugTimer = 0;
      const info = this.renderer.info;
      this.opts.callbacks.onDebug({
        fps: this.fps,
        frameMs: this.frameMs,
        drawCalls: info.render.calls,
        triangles: info.render.triangles,
        karts: this.race.karts.length,
        bodies: this.race.karts.length,
      });
    }

    this.renderer.render(this.scene, this.camera);
  };

  private recordGhost(dt: number) {
    if (this.opts.config.mode !== 'timetrial') return;
    if (this.race.state !== 'racing' || this.paused) return;
    this.ghostRecAccum += dt;
    if (this.ghostRecAccum < 1 / 20) return;
    this.ghostRecAccum = 0;
    const player = this.race.player;
    if (player.completed) return;
    const last = this.ghostRecorder[this.ghostRecorder.length - 1];
    const t = this.race.elapsed - this.ghostLapStart;
    if (last && Math.abs(last.t - t) < 1e-4) return;
    this.ghostRecorder.push({
      t,
      x: player.position.x,
      y: player.position.y,
      z: player.position.z,
      heading: player.heading,
    });
    if (this.ghostRecorder.length > 3000) this.ghostRecorder.shift();
  }

  private drainRaceEvents() {
    for (const event of this.race.drainEvents()) {
      this.handleRaceEvent(event);
    }
  }

  private handleRaceEvent(event: RaceEvent) {
    switch (event.type) {
      case 'countdown':
        this.audio.play('countdown');
        break;
      case 'go':
        this.audio.play('go');
        this.countdownGoTimer = 1.1;
        break;
      case 'lap':
        this.audio.play('lap');
        if (this.opts.config.mode === 'timetrial') {
          this.ghostLaps.push({ time: event.time, frames: this.ghostRecorder.slice() });
          this.ghostRecorder = [];
          this.ghostLapStart = this.race.elapsed;
        }
        if (event.lap >= this.race.totalLaps - 1) {
          this.opts.callbacks.onToast('FINAL LAP', 'warn');
        } else {
          this.opts.callbacks.onToast(`LAP ${event.lap} — ${event.time.toFixed(2)}s`, 'info');
        }
        this.lastLapAlert = event.lap;
        break;
      case 'finish':
        this.audio.play('finish');
        this.handleFinish();
        break;
      case 'collision':
        if (event.strength > 0.2) {
          this.audio.play('collision', { volume: clamp(event.strength, 0.3, 1) });
          this.cameraCtl.addShake(clamp(event.strength, 0.2, 1));
          this.effects.emitImpact(this.race.player.position.clone(), 0xffd166, event.strength);
        }
        break;
      case 'boost':
        this.audio.play('boost');
        break;
      case 'pad':
        this.audio.play('pickup', { pitch: 1.2, volume: 0.6 });
        break;
      case 'item':
        this.opts.callbacks.onToast(`${event.item.toUpperCase()} acquired — press F`, 'success');
        break;
      case 'eliminate':
        this.audio.play('error', { volume: 0.7 });
        if (event.isPlayer) {
          this.eliminatedPlayer = true;
          this.opts.callbacks.onToast('ELIMINATED', 'warn');
          this.handleFinish();
        } else {
          this.opts.callbacks.onToast(`${event.name} eliminated`, 'warn');
        }
        break;
      case 'wrongway':
        if (event.active) this.opts.callbacks.onToast('WRONG WAY', 'warn');
        break;
    }
  }

  private handleFinish() {
    if (this.outcomeSent) return;
    this.outcomeSent = true;
    this.audio.play(this.race.finishPosition === 1 ? 'victory' : 'finish');
    const player = this.race.player;
    const standings = this.race.standings();
    const outcome: RaceOutcome = {
      mode: this.opts.config.mode,
      trackId: this.trackDef.id,
      trackName: this.trackDef.name,
      difficulty: this.opts.config.difficulty,
      laps: this.race.totalLaps,
      position: this.eliminatedPlayer ? this.totalRacers : this.race.finishPosition || this.race.positionOf(player),
      totalRacers: this.totalRacers,
      totalTime: player.finishTime ?? this.race.elapsed,
      bestLap: player.bestLap,
      topSpeed: player.topSpeed,
      driftScore: Math.round(player.driftScore),
      cleanRace: player.offRoadTime < 2.4 && player.hitCount < 3,
      boostUses: player.boostUses,
      eliminated: this.eliminatedPlayer,
      standings,
      raceDate: Date.now(),
    };
    if (this.opts.config.mode === 'timetrial') {
      const best = this.ghostLaps.reduce<{ time: number; frames: GhostFrame[] } | null>(
        (acc, lap) => (!acc || lap.time < acc.time ? lap : acc),
        null,
      );
      if (best && best.frames.length > 1) {
        outcome.ghost = {
          time: best.time,
          frames: best.frames,
          kartId: this.opts.config.kartId,
          date: outcome.raceDate,
        };
      }
    }
    this.opts.callbacks.onFinish(outcome);
  }

  private hideCameraBlockers(dt: number) {
    if (this.cameraCtl.mode === 'firstperson' || this.cameraCtl.mode === 'trackside') return;
    const cam = this.camera.position;
    const player = this.race.player.position;
    // Segment from lens to the player's kart: only rivals inside that corridor
    // actually occlude the player, so only those fade.
    const segX = player.x - cam.x;
    const segY = player.y + 0.5 - cam.y;
    const segZ = player.z - cam.z;
    const segLenSq = segX * segX + segY * segY + segZ * segZ;
    for (const kart of this.race.karts) {
      if (kart.isPlayer) continue;
      const model = this.kartModels.get(kart.id);
      if (!model) continue;
      const dx = kart.position.x - cam.x;
      const dy = kart.position.y + 0.5 - cam.y;
      const dz = kart.position.z - cam.z;
      const camDist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const along = (dx * segX + dy * segY + dz * segZ) / segLenSq;
      // A rival closer to the lens than the player is a tailgater: its body
      // swallows the frame and covers the HUD, so it ramps out with proximity.
      // Karts level with or ahead of the player stay fully visible.
      const tailgating = along < 0.94 && camDist < 10.5;
      const target = tailgating ? clamp((camDist - 8) / 2.5, 0, 1) : 1;
      model.setFade(target, dt);
      model.root.visible = !kart.eliminated && (target > 0.02 || model.opacityNow > 0.02);
    }
  }

  private updateVisuals(dt: number) {
    const player = this.race.player;
    for (const kart of this.race.karts) {
      const model = this.kartModels.get(kart.id);
      if (!model) continue;
      const visual = {
        speed: kart.signedSpeed,
        steer: kart.steer,
        drift: kart.driftAngle,
        throttle: this.input.getInput().throttle,
        braking: kart.brakeLights,
        boosting: kart.boosting,
        airborne: kart.airborne,
        time: this.race.elapsed + kart.eliminationOrder,
      };
      model.setRootPose(kart.position.x, kart.position.y, kart.position.z, kart.heading);
      model.update(dt, visual);
      model.setBrakeLights(kart.brakeLights);
      model.root.visible = !kart.eliminated;
      if (kart.eliminated) {
        model.root.position.y = kart.position.y - 0.4;
        model.root.rotation.z = 0.4;
      } else {
        model.root.rotation.z = 0;
      }
    }

    if (this.ghostModel && this.ghostFrames && this.ghostFrames.frames.length > 1) {
      if (this.race.state === 'racing') this.ghostTime += dt;
      const frames = this.ghostFrames.frames;
      const t = this.ghostTime;
      let idx = 0;
      while (idx < frames.length - 2 && frames[idx + 1].t < t) idx++;
      const a = frames[idx];
      const b = frames[Math.min(idx + 1, frames.length - 1)];
      const span = Math.max(0.001, b.t - a.t);
      const f = clamp((t - a.t) / span, 0, 1);
      const x = a.x + (b.x - a.x) * f;
      const y = a.y + (b.y - a.y) * f;
      const z = a.z + (b.z - a.z) * f;
      const h = a.heading + (b.heading - a.heading) * f;
      this.ghostModel.setRootPose(x, y, z, h);
      this.ghostModel.update(dt, {
        speed: 0,
        steer: 0,
        drift: 0,
        throttle: 0,
        braking: false,
        boosting: false,
        airborne: false,
        time: t,
      });
      this.ghostModel.root.visible = t <= frames[frames.length - 1].t;
    }

    // Player particles.
    if (this.race.state === 'racing' && !this.paused) {
      if (player.drifting) {
        this.smokeAccum += dt;
        if (this.smokeAccum > 0.035) {
          this.smokeAccum = 0;
          this.effects.emitDriftSmoke(player.position, player.heading, Math.abs(player.driftAngle));
          this.effects.emitSparks(player.position, player.heading, 2, 0xffd166);
        }
      }
      if (player.boosting) {
        this.effects.emitBoostTrail(
          player.position,
          player.heading,
          new THREE.Color(this.opts.config.customization.glowColor).getHex(),
        );
      }
      if (player.offRoad && player.speed > 6) {
        const color = this.trackDef.theme === 'desert' ? 0xe8c98a : this.trackDef.theme === 'forest' ? 0x8f7a54 : 0x9aa3b2;
        this.effects.emitDust(player.position, color);
      }
      if (player.impactStrength > 0.5 && player.timeSinceImpact < 0.06) {
        this.effects.emitImpact(player.position.clone(), 0xffffff, player.impactStrength);
      }
      if (player.drifting) {
        this.driftSoundTimer += dt;
      }
    }

    // Camera shake on boosts.
    if (player.boosting) this.cameraCtl.addShake(0.045);
  }

  private publishHud() {
    const player = this.race.player;
    const standings = this.race.standings();
    const pos = this.race.positionOf(player);
    const total = this.spline.totalLength;
    const mapTrack: { x: number; z: number }[] = [];
    const step = Math.max(1, Math.floor(this.spline.samples.length / 120));
    for (let i = 0; i < this.spline.samples.length; i += step) {
      mapTrack.push({ x: this.spline.samples[i].position.x, z: this.spline.samples[i].position.z });
    }
    const mapRacers = this.race.karts.map((k) => ({
      x: k.position.x,
      z: k.position.z,
      isPlayer: k.isPlayer,
      eliminated: k.eliminated,
    }));
    const mapCheckpoints: { x: number; z: number }[] = [];
    for (let i = 0; i < this.trackDef.checkpointCount; i++) {
      const s = this.spline.sampleAtDistance((i / this.trackDef.checkpointCount) * total);
      mapCheckpoints.push({ x: s.position.x, z: s.position.z });
    }
    const start = this.spline.sampleAtDistance(0);
    const units = this.settings.units ?? this.opts.config.units;
    const speedDisplay = player.speed * 3.6 * (units === 'mph' ? 0.621371 : 1);
    const maxSpeed = 34 * 3.6 * (units === 'mph' ? 0.621371 : 1);
    const gear = player.speed < 0.5 ? 0 : clamp(Math.ceil((player.speed / 34) * 6), 1, 6);
    const hud: HudSnapshot = {
      mode: this.opts.config.mode,
      trackName: this.trackDef.name,
      state: this.paused ? 'paused' : this.race.state === 'countdown' ? 'countdown' : this.race.state === 'finished' ? 'finished' : 'racing',
      countdown: this.race.state === 'countdown' ? Math.max(0, this.race.countdown) : this.countdownGoTimer,
      speed: Math.round(speedDisplay),
      speedLimit: Math.round(maxSpeed),
      speedUnit: units,
      gear,
      rpm: clamp(player.speed / 34, 0, 1),
      position: pos,
      totalRacers: this.totalRacers,
      lap: this.race.playerLap(),
      totalLaps: this.race.totalLaps,
      raceTime: this.race.elapsed,
      currentLapTime: player.currentLapTime,
      bestLap: player.bestLap,
      lastLap: player.lastLap,
      boost: player.boostAmount,
      drift: clamp(Math.abs(player.driftAngle) / 0.8, 0, 1),
      drifting: player.drifting,
      boosting: player.boosting,
      offRoad: player.offRoad,
      wrongWay: this.race.isPlayerWrongWay,
      item: player.item,
      shieldTime: player.shieldTime,
      cameraMode: CAMERA_LABELS[this.cameraCtl.mode],
      eliminationIn: this.race.eliminationCountdown,
      playerProgress: clamp((this.race.player.progressDistance / total), 0, 1),
      mapTrack,
      mapRacers,
      mapCheckpoints,
      mapStart: { x: start.position.x, z: start.position.z },
      mapHeading: player.heading,
    };
    void standings;
    this.opts.callbacks.onHud(hud);
  }

  togglePause() {
    if (!this.ready) return;
    this.paused = !this.paused;
    this.race.setPaused(this.paused);
    this.input.setEnabled(!this.paused);
    this.opts.callbacks.onPauseChange(this.paused);
    this.audio.play('click');
  }

  setPaused(paused: boolean) {
    if (this.paused === paused) return;
    this.paused = paused;
    this.race.setPaused(paused);
    this.input.setEnabled(!paused);
    this.opts.callbacks.onPauseChange(paused);
  }

  restart() {
    this.audio.stopEngine();
    this.audio.stopMusic();
    this.dispose();
    this.opts.callbacks.onToast('Restarting race…', 'info');
  }

  setTouch(input: Partial<import('../data/types').TouchInput>) {
    this.input.setTouch(input);
  }

  debugAutopilot(steps: number) {
    if (!import.meta.env.DEV) return;
    const controller = new AIController(
      { skill: 0.94, aggression: 0.5, consistency: 0.9, name: 'AUTOPILOT' },
      'pro',
      this.spline,
      0,
    );
    const step = 1 / 120;
    for (let i = 0; i < steps; i++) {
      if (this.outcomeSent) break;
      const active = this.race.karts.filter((k) => !k.eliminated);
      const input = controller.decide(this.race.player, active, step, this.race.elapsed);
      this.race.update(step, input);
      this.recordGhost(step);
      this.drainRaceEvents();
    }
    this.publishHud();
  }

  debugState() {
    const p = this.race.player;
    return {
      state: this.race.state,
      elapsed: this.race.elapsed,
      lap: p.lap,
      progress: p.progressDistance,
      position: this.race.positionOf(p),
      speed: p.speed,
      finished: this.outcomeSent,
      laps: this.race.totalLaps,
    };
  }

  applySettings(settings: Settings) {
    this.settings = settings;
    this.audio.applySettings({
      masterVolume: settings.masterVolume,
      musicVolume: settings.musicVolume,
      sfxVolume: settings.sfxVolume,
      muted: settings.muted,
      musicEnabled: settings.musicEnabled,
    });
    this.input.setBindings(settings.bindings);
    this.cameraCtl.setSensitivity(settings.cameraSensitivity);
    this.cameraCtl.setShakeAmount(settings.cameraShake);
    this.effects.configure({
      effects: settings.effects,
      particles: settings.particles,
      quality: settings.quality,
    });
    const pr = clamp(
      Math.min(window.devicePixelRatio || 1, settings.quality === 'high' ? 2 : 1.5) * settings.resolutionScale,
      0.6,
      2,
    );
    this.renderer.setPixelRatio(pr);
    this.renderer.shadowMap.enabled = settings.shadows && settings.quality !== 'low';
    if (this.sun) this.sun.castShadow = settings.shadows && settings.quality !== 'low';
    this.resize();
  }

  private resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  get isPaused() {
    return this.paused;
  }

  get isReady() {
    return this.ready;
  }

  get standings() {
    return this.race ? this.race.standings() : [];
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.input.dispose();
    this.audio.stopEngine();
    this.audio.stopMusic();
    this.audio.dispose();
    this.effects.dispose();
    for (const model of this.kartModels.values()) {
      this.scene.remove(model.root);
      model.dispose();
    }
    this.kartModels.clear();
    if (this.ghostModel) {
      this.scene.remove(this.ghostModel.root);
      this.ghostModel.dispose();
      this.ghostModel = null;
    }
    if (this.trackGroup) {
      this.scene.remove(this.trackGroup);
      this.trackGroup.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = mesh.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else if (mat) mat.dispose();
      });
      this.trackGroup = null;
    }
    if (this.sky) {
      this.scene.remove(this.sky);
      this.sky.geometry.dispose();
      (this.sky.material as THREE.Material).dispose();
      this.sky = null;
    }
    if (this.sun) {
      this.sun.shadow.map?.dispose();
      this.sun = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    const canvas = this.renderer.domElement;
    if (this.contextLostHandler) canvas.removeEventListener('webglcontextlost', this.contextLostHandler);
    if (this.contextRestoredHandler) canvas.removeEventListener('webglcontextrestored', this.contextRestoredHandler);
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    if (canvas.parentElement) canvas.parentElement.removeChild(canvas);
    this.scene.clear();
    void this.keysHandled;
    void this.raceStartProgress;
    void this.itemToastCooldown;
    void this.driftSoundTimer;
    void this.lastLapAlert;
    void sampleSurface;
    void formatGap;
    void this.racerNameMap;
    void this.trackName;
    void this.raceStartProgress;
  }
}
