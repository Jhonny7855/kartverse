import * as THREE from 'three';
import type { Difficulty, GameMode, RacerStanding, TrackDef } from '../data/types';
import { TrackSpline } from './TrackSpline';
import {
  collideKartWithTrack,
  collideKarts,
  createKartRuntime,
  onBoostPad,
  sampleSurface,
  stepKart,
  tickKartTimers,
  type KartInput,
  type KartRuntime,
  type StepContext,
} from './RacePhysics';
import { AIController, type AIProfile } from './AIController';
import { clamp, damp, formatGap, wrapAngle } from './utils';

export type RaceState = 'countdown' | 'racing' | 'paused' | 'finished';

export interface RaceManagerOptions {
  mode: GameMode;
  track: TrackDef;
  difficulty: Difficulty;
  laps: number;
  opponents: number;
  playerDef: import('../data/types').KartDef;
  playerId: string;
  aiDefs: import('../data/types').KartDef[];
  aiNames: string[];
  steeringSensitivity: number;
  quality: 'low' | 'medium' | 'high';
  onEvent: (event: RaceEvent) => void;
}

export type RaceEvent =
  | { type: 'countdown'; value: number }
  | { type: 'go' }
  | { type: 'lap'; lap: number; time: number; best: boolean }
  | { type: 'finish'; position: number }
  | { type: 'collision'; strength: number }
  | { type: 'boost' }
  | { type: 'pad' }
  | { type: 'item'; item: string }
  | { type: 'eliminate'; name: string; isPlayer: boolean }
  | { type: 'wrongway'; active: boolean };

export interface ItemPickup {
  id: number;
  position: THREE.Vector3;
  progress: number;
  cooldown: number;
}

const ITEM_NAMES = ['Turbo', 'Shield', 'Pulse'] as const;

export class RaceManager {
  readonly spline: TrackSpline;
  readonly track: TrackDef;
  readonly mode: GameMode;
  readonly difficulty: Difficulty;
  readonly totalLaps: number;
  readonly karts: KartRuntime[] = [];
  readonly player: KartRuntime;
  state: RaceState = 'countdown';
  paused = false;
  elapsed = 0;
  countdown = 3.999;
  finishCount = 0;
  private countdownSent = 4;
  private goSent = false;
  private ai = new Map<string, AIController>();
  private opts: RaceManagerOptions;
  private progressPrev = new Map<string, number>();
  private raceDistance = new Map<string, number>();
  private gateCount = new Map<string, number>();
  private lastLapAlerts = new Map<string, number>();
  private nextElimination = 48;
  private eliminationInterval: number;
  private lastStandings: RacerStanding[] = [];
  private playerWrongWay = false;
  private wrongWayTime = 0;
  private collisionCooldown = 0;
  private playerItemCooldown = 0;
  private itemTick = 0;
  items: ItemPickup[] = [];
  readonly playerStartProgress: number;
  private eventQueue: RaceEvent[] = [];
  finishTime: number | null = null;
  finishPosition = 0;

  constructor(spline: TrackSpline, opts: RaceManagerOptions) {
    this.spline = spline;
    this.track = opts.track;
    this.mode = opts.mode;
    this.difficulty = opts.difficulty;
    this.totalLaps = opts.laps;
    this.opts = opts;
    this.eliminationInterval = opts.mode === 'elimination' ? 48 : 0;

    const total = spline.totalLength;
    const gridCount = opts.opponents + 1;
    const startOffset = 14;
    const playerGrid = this.gridSlot(0, total, gridCount, startOffset);
    this.playerStartProgress = playerGrid.progress;
    this.player = this.addKart(opts.playerId, opts.playerDef, true, playerGrid, 0);

    const laneBias = [-0.28, 0.28, -0.12, 0.12, -0.36, 0.36, 0];
    for (let i = 0; i < opts.opponents; i++) {
      const slot = this.gridSlot(i + 1, total, gridCount, startOffset);
      const kart = this.addKart(opts.aiNames[i], opts.aiDefs[i % opts.aiDefs.length], false, slot, i + 1);
      const profile: AIProfile = {
        name: opts.aiNames[i],
        skill: clamp(
          0.46 + (i % 5) * 0.11 + (opts.difficulty === 'pro' ? 0.2 : opts.difficulty === 'easy' ? -0.1 : 0),
          0.2,
          1,
        ),
        aggression: 0.35 + ((i * 37) % 60) / 100,
        consistency: 0.55 + ((i * 23) % 40) / 100,
      };
      this.ai.set(kart.id, new AIController(profile, opts.difficulty, spline, laneBias[(i + 1) % laneBias.length] * 3));
    }

    // Item pickups distributed around the circuit.
    for (let i = 0; i < 8; i++) {
      const p = 0.09 + (i / 8) * 0.86;
      const s = spline.sampleAtDistance(p * total);
      this.items.push({
        id: i,
        position: s.position.clone().addScaledVector(s.right, Math.sin(i * 2.4) * s.width * 0.22),
        progress: s.distance,
        cooldown: 0,
      });
    }
  }

  private gridSlot(index: number, total: number, gridCount: number, startOffset: number) {
    const row = Math.floor(index / 2);
    const col = index % 2;
    const lateral = (col === 0 ? -1 : 1) * (2.2 + (row % 3) * 0.5);
    const back = startOffset + row * 5.4;
    let progress = (total - back) % total;
    if (progress < 0) progress += total;
    const s = this.spline.sampleAtDistance(progress);
    const position = s.position.clone().addScaledVector(s.right, lateral);
    return { progress, position, heading: Math.atan2(s.tangent.x, s.tangent.z) };
  }

  private addKart(id: string, def: import('../data/types').KartDef, isPlayer: boolean, slot: { progress: number; position: THREE.Vector3; heading: number }, order: number) {
    const kart = createKartRuntime(id, def, isPlayer, slot.position, slot.heading);
    kart.position.y = slot.position.y;
    kart.progressDistance = slot.progress;
    kart.lapStart = 0;
    kart.eliminationOrder = order;
    this.karts.push(kart);
    this.progressPrev.set(id, slot.progress);
    const initial = (slot.progress - this.spline.totalLength) % this.spline.totalLength;
    this.raceDistance.set(id, slot.progress > this.spline.totalLength * 0.5 ? slot.progress - this.spline.totalLength : initial);
    this.gateCount.set(id, 0);
    return kart;
  }

  setPaused(paused: boolean) {
    this.paused = paused;
  }

  drainEvents(): RaceEvent[] {
    const events = this.eventQueue;
    this.eventQueue = [];
    return events;
  }

  get totalRacers(): number {
    return this.karts.length;
  }

  get activeCount(): number {
    return this.karts.filter((k) => !k.eliminated).length;
  }

  positionOf(kart: KartRuntime): number {
    const list = this.sortedKarts();
    return list.findIndex((k) => k === kart) + 1;
  }

  private sortedKarts(): KartRuntime[] {
    return [...this.karts].sort((a, b) => {
      if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
      if (a.completed && b.completed) {
        return (a.finishTime ?? 0) - (b.finishTime ?? 0);
      }
      if (a.completed) return -1;
      if (b.completed) return 1;
      return (this.raceDistance.get(b.id) ?? 0) - (this.raceDistance.get(a.id) ?? 0);
    });
  }

  update(dt: number, playerInput: KartInput): void {
    if (this.state === 'paused' || this.state === 'finished') return;
    if (this.state === 'countdown') {
      this.countdown -= dt;
      const whole = Math.ceil(this.countdown);
      if (whole < this.countdownSent && whole <= 3) {
        this.countdownSent = whole;
        if (whole > 0) this.eventQueue.push({ type: 'countdown', value: whole });
      }
      if (this.countdown <= 0) {
        this.state = 'racing';
        this.elapsed = 0;
        for (const k of this.karts) k.lapStart = 0;
        if (!this.goSent) {
          this.goSent = true;
          this.eventQueue.push({ type: 'go' });
        }
      }
      return;
    }

    this.elapsed += dt;
    this.itemTick += dt;
    this.collisionCooldown = Math.max(0, this.collisionCooldown - dt);
    this.playerItemCooldown = Math.max(0, this.playerItemCooldown - dt);

    const isTimeTrial = this.mode === 'timetrial';
    const isPractice = this.mode === 'practice';
    const active = this.karts.filter((k) => !k.eliminated);

    for (const kart of this.karts) {
      if (kart.eliminated) continue;
      let input: KartInput = playerInput;
      if (!kart.isPlayer) {
        const controller = this.ai.get(kart.id);
        input = controller
          ? controller.decide(kart, active, dt, this.elapsed)
          : { throttle: 0.6, brake: 0, steer: 0, drift: false, boost: false };
      }
      if (kart.completed) {
        input = { throttle: 0, brake: 1, steer: 0, drift: false, boost: false };
      }
      const ctx: StepContext = {
        spline: this.spline,
        track: this.track,
        input,
        dt,
        elapsed: this.elapsed,
        isPlayer: kart.isPlayer,
        allowBoost: !kart.completed,
        steeringSensitivity: this.opts.steeringSensitivity,
        quality: this.opts.quality,
      };
      const wasBoosting = kart.boosting;
      if (isPractice) kart.boostAmount = 100;
      stepKart(kart, ctx);
      if (!wasBoosting && kart.boosting && kart.isPlayer) {
        this.eventQueue.push({ type: 'boost' });
      }
      collideKartWithTrack(kart, ctx);
      if (isPractice) {
        kart.lap = Math.min(kart.lap, 0);
      }
    }

    collideKarts(active);
    for (const kart of this.karts) tickKartTimers(kart, dt);
    this.updateRubberBand();
    this.updateProgress(dt);
    this.handleItems(dt);
    this.handleCollisionEvents();
    this.updateBoostPads();
    this.updateWrongWay(dt);
    this.updateElimination(dt);
    this.updateFinish();

    if (isTimeTrial || isPractice) {
      // No positions in solo modes.
      for (const k of this.karts) k.lap = Math.max(0, k.lap);
    }
  }

  private updateRubberBand() {
    const sorted = this.sortedKarts().filter((k) => !k.completed && !k.eliminated);
    const player = this.player;
    const playerDist = this.raceDistance.get(player.id) ?? 0;
    for (const kart of this.karts) {
      if (kart.isPlayer) {
        kart.rubberBand = 0;
        continue;
      }
      if (kart.completed) {
        kart.rubberBand = 0;
        continue;
      }
      const d = this.raceDistance.get(kart.id) ?? 0;
      const delta = (playerDist - d) / Math.max(120, this.spline.totalLength);
      const band = clamp(delta * 0.55, -0.075, 0.1);
      const difficultyScale = this.difficulty === 'easy' ? 0.35 : this.difficulty === 'normal' ? 0.7 : 1;
      kart.rubberBand = damp(kart.rubberBand, band * difficultyScale, 1.1, 1 / 60);
    }
    void sorted;
  }

  private updateProgress(dt: number) {
    const total = this.spline.totalLength;
    const checkpointCount = this.track.checkpointCount;
    for (const kart of this.karts) {
      if (kart.eliminated) continue;
      const prev = this.progressPrev.get(kart.id) ?? kart.progressDistance;
      let delta = kart.progressDistance - prev;
      if (delta > total / 2) delta -= total;
      if (delta < -total / 2) delta += total;
      // Reject implausible teleport-sized deltas.
      if (Math.abs(delta) > total * 0.22) delta = 0;
      this.progressPrev.set(kart.id, kart.progressDistance);
      let dist = (this.raceDistance.get(kart.id) ?? 0) + delta;
      if (delta > 0) {
        // Gate validation: do not allow skipped checkpoints to advance race distance.
        const gateProgress = ((dist % total) + total) % total;
        const expectedGate = ((this.gateCount.get(kart.id) ?? 0) + 1) % checkpointCount;
        const gateAt = (expectedGate / checkpointCount) * total;
        const curGate = Math.floor((gateProgress / total) * checkpointCount);
        const forwardGate = (curGate - expectedGate + checkpointCount) % checkpointCount;
        if (forwardGate > checkpointCount / 2 && Math.abs(delta) > 2) {
          // Large forward jump that skips gates: clamp movement.
          dist -= delta;
          delta = 0;
        }
      }
      this.raceDistance.set(kart.id, dist);
      if (delta > 0) {
        const gateProgress = ((dist % total) + total) % total;
        const gate = Math.floor((gateProgress / total) * checkpointCount);
        const current = this.gateCount.get(kart.id) ?? 0;
        if (gate === (current + 1) % checkpointCount || gate === current) {
          this.gateCount.set(kart.id, gate);
        }
      }
      const previousLap = kart.lap;
      const newLap = Math.max(0, Math.floor(dist / total) + 1);
      if (delta < -0.4) {
        kart.wrongWayTimer += dt;
      }
      if (newLap > previousLap && dist > 0) {
        kart.lap = newLap;
        const lapTime = this.elapsed - kart.lapStart;
        if (previousLap >= 1 && lapTime > 3) {
          kart.lastLap = lapTime;
          kart.lapTimes.push(lapTime);
          if (kart.bestLap === null || lapTime < kart.bestLap) kart.bestLap = lapTime;
          if (kart.isPlayer) {
            this.eventQueue.push({
              type: 'lap',
              lap: previousLap,
              time: lapTime,
              best: kart.bestLap === lapTime,
            });
          }
          if (this.totalLaps > 0 && previousLap >= this.totalLaps && !kart.completed) {
            kart.completed = true;
            kart.finishTime = this.elapsed;
            kart.finishedAt = this.elapsed;
            this.finishCount += 1;
            if (kart.isPlayer) {
              this.finishTime = this.elapsed;
              this.finishPosition = this.finishCount;
              this.eventQueue.push({ type: 'finish', position: this.finishCount });
            }
          }
        }
        kart.lapStart = this.elapsed;
      }
      if (kart.completed) {
        // Completed karts still get counted.
        kart.lap = Math.max(kart.lap, this.totalLaps + 1);
      }
    }
  }

  private handleCollisionEvents() {
    for (const kart of this.karts) {
      if (!kart.isPlayer) continue;
      if (kart.impactStrength > 0.18 && kart.timeSinceImpact < 0.05 && this.collisionCooldown <= 0) {
        this.collisionCooldown = 0.18;
        this.eventQueue.push({ type: 'collision', strength: kart.impactStrength });
      }
    }
  }

  private updateBoostPads() {
    for (const kart of this.karts) {
      if (kart.eliminated) continue;
      if (!onBoostPad(this.track, kart.progressDistance, this.spline.totalLength)) continue;
      if (kart.boostTime > 0 && kart.boostTime > 0.8) continue;
      kart.boostAmount = Math.min(100, kart.boostAmount + 34);
      if (kart.isPlayer) this.eventQueue.push({ type: 'pad' });
    }
  }

  private updateWrongWay(dt: number) {
    const player = this.player;
    if (player.completed) return;
    const surface = sampleSurface(this.spline, player.position);
    const forward = new THREE.Vector3(Math.sin(player.heading), 0, Math.cos(player.heading));
    const dot = forward.dot(surface.tangent);
    if (dot < -0.35 && player.speed > 3) {
      this.wrongWayTime += dt;
    } else {
      this.wrongWayTime = Math.max(0, this.wrongWayTime - dt * 2);
    }
    const active = this.wrongWayTime > 0.75;
    if (active !== this.playerWrongWay) {
      this.playerWrongWay = active;
      this.eventQueue.push({ type: 'wrongway', active });
    }
  }

  get isPlayerWrongWay(): boolean {
    return this.playerWrongWay;
  }

  private updateElimination(dt: number) {
    if (this.mode !== 'elimination') return;
    void dt;
    if (this.activeCount <= 1) return;
    if (this.elapsed < this.nextElimination) return;
    const active = this.karts.filter((k) => !k.eliminated && !k.completed);
    if (active.length <= 1) return;
    const sorted = this.sortedKarts().filter((k) => !k.eliminated);
    const last = sorted[sorted.length - 1];
    if (!last || last.completed) return;
    last.eliminated = true;
    last.finishedAt = this.elapsed;
    this.eventQueue.push({ type: 'eliminate', name: last.id, isPlayer: last.isPlayer });
    this.nextElimination += this.eliminationInterval;
    this.eliminationInterval = Math.max(26, this.eliminationInterval - 2);
    if (last.isPlayer) {
      this.finishTime = null;
      this.finishPosition = this.activeCount + 1;
    }
    if (this.activeCount <= 1) {
      const winner = this.karts.find((k) => !k.eliminated);
      if (winner && !winner.completed) {
        winner.completed = true;
        winner.finishTime = this.elapsed;
        winner.finishedAt = this.elapsed;
        if (winner.isPlayer) {
          this.finishTime = this.elapsed;
          this.finishPosition = 1;
          this.eventQueue.push({ type: 'finish', position: 1 });
        }
      }
    }
  }

  get eliminationCountdown(): number | null {
    if (this.mode !== 'elimination') return null;
    if (this.state !== 'racing') return null;
    return Math.max(0, this.nextElimination - this.elapsed);
  }

  private updateFinish() {
    const player = this.player;
    const modeSolo = this.mode === 'timetrial' || this.mode === 'practice';
    if (this.mode === 'practice') return;
    if (modeSolo) {
      if (player.completed) {
        this.state = 'finished';
      }
      return;
    }
    const allDone = this.karts.every((k) => k.completed || k.eliminated);
    if (player.completed || player.eliminated) {
      const othersActive = this.karts.filter((k) => !k.isPlayer && !k.completed && !k.eliminated);
      if (player.completed && othersActive.length === 0) {
        this.state = 'finished';
      }
      // Finish immediately for the player, AI can be simulated behind the results screen.
      if (this.mode !== 'elimination') this.state = 'finished';
    }
    if (allDone) this.state = 'finished';
  }

  private handleItems(dt: number) {
    for (const item of this.items) {
      item.cooldown = Math.max(0, item.cooldown - dt);
    }
    const player = this.player;
    if (this.itemTick < 0.1) return;
    this.itemTick = 0;
    if (!player.item && !player.completed && !player.eliminated) {
      for (const item of this.items) {
        if (item.cooldown > 0) continue;
        const dx = item.position.x - player.position.x;
        const dz = item.position.z - player.position.z;
        if (dx * dx + dz * dz < 9) {
          const name = ITEM_NAMES[Math.floor(Math.random() * ITEM_NAMES.length)];
          player.item = name;
          item.cooldown = 12;
          this.eventQueue.push({ type: 'item', item: name });
          break;
        }
      }
    }
  }

  usePlayerItem(): boolean {
    const player = this.player;
    if (!player.item || player.completed || player.eliminated || this.playerItemCooldown > 0) return false;
    const item = player.item;
    player.item = null;
    this.playerItemCooldown = 0.6;
    if (item === 'Turbo') {
      player.boostAmount = 100;
      player.boostTime = 1.4;
      player.boosting = true;
      player.boostCooldown = 0;
      this.eventQueue.push({ type: 'boost' });
    } else if (item === 'Shield') {
      player.shieldTime = 7;
    } else if (item === 'Pulse') {
      const forward = new THREE.Vector3(Math.sin(player.heading), 0, Math.cos(player.heading));
      for (const other of this.karts) {
        if (other === player || other.eliminated || other.completed) continue;
        const to = other.position.clone().sub(player.position);
        const dist = to.length();
        if (dist > 30) continue;
        const ahead = to.dot(forward) / Math.max(0.001, dist);
        if (ahead < -0.2) continue;
        other.velocity.addScaledVector(forward, 7);
        other.signedSpeed *= 0.72;
        other.impactStrength = 0.8;
        other.timeSinceImpact = 0;
        other.hitCount += 1;
      }
      this.eventQueue.push({ type: 'item', item: 'Pulse' });
    }
    return true;
  }

  respawnPlayer(): void {
    const kart = this.player;
    const total = this.spline.totalLength;
    // Respawn on the centre line at the last valid progress point.
    let progress = ((this.raceDistance.get(kart.id) ?? 0) % total + total) % total;
    const s = this.spline.sampleAtDistance(progress);
    kart.position.copy(s.position);
    kart.position.y = s.position.y + 0.05;
    kart.heading = Math.atan2(s.tangent.x, s.tangent.z);
    kart.velocity.set(0, 0, 0);
    kart.signedSpeed = 0;
    kart.speed = 0;
    kart.angularVelocity = 0;
    kart.driftAngle = 0;
    kart.drifting = false;
    kart.airborne = false;
    kart.verticalVelocity = 0;
    kart.respawnCooldown = 1.4;
    this.progressPrev.set(kart.id, s.distance);
  }

  standings(): RacerStanding[] {
    const sorted = this.sortedKarts();
    const total = this.spline.totalLength;
    const leaderDist = this.raceDistance.get(sorted[0]?.id ?? '') ?? 0;
    this.lastStandings = sorted.map((k, i) => {
      const dist = this.raceDistance.get(k.id) ?? 0;
      let gap = '—';
      if (k.completed && k.finishTime !== null) {
        const leader = sorted[0];
        if (leader?.completed && leader.finishTime !== null) {
          gap = i === 0 ? 'WINNER' : `+${(k.finishTime - leader.finishTime).toFixed(2)}s`;
        } else {
          gap = formatGap((k.finishTime ?? 0) * 0);
        }
      } else if (k.eliminated) {
        gap = 'OUT';
      } else {
        const speedEstimate = 22;
        gap = formatGap(Math.max(0, (leaderDist - dist) / speedEstimate));
      }
      return {
        name: k.isPlayer ? 'YOU' : k.id,
        isPlayer: k.isPlayer,
        kartId: k.def.id,
        position: i + 1,
        completed: k.completed,
        eliminated: k.eliminated,
        totalTime: k.finishTime,
        bestLap: k.bestLap,
        gap,
        progress: clamp(dist / (total * Math.max(1, this.totalLaps)), 0, 1),
      };
    });
    return this.lastStandings;
  }

  getStandings(): RacerStanding[] {
    return this.standings();
  }

  playerLap(): number {
    if (this.totalLaps <= 0) return Math.max(1, this.player.lap);
    return Math.min(this.totalLaps, Math.max(1, this.player.lap));
  }
}
