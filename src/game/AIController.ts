import * as THREE from 'three';
import type { Difficulty } from '../data/types';
import type { KartInput, KartRuntime } from './RacePhysics';
import { maxSpeedOf, sampleSurface } from './RacePhysics';
import type { TrackSpline } from './TrackSpline';
import { clamp, damp, wrapAngle } from './utils';

export interface AIProfile {
  skill: number;
  aggression: number;
  consistency: number;
  name: string;
}

export interface AIDifficultyConfig {
  speedScale: number;
  cornerSkill: number;
  mistakeRate: number;
  aggression: number;
  boostSkill: number;
  reaction: number;
}

export const AI_DIFFICULTY: Record<Difficulty, AIDifficultyConfig> = {
  easy: { speedScale: 0.8, cornerSkill: 0.45, mistakeRate: 0.09, aggression: 0.2, boostSkill: 0.18, reaction: 0.5 },
  normal: { speedScale: 0.88, cornerSkill: 0.66, mistakeRate: 0.035, aggression: 0.45, boostSkill: 0.45, reaction: 0.3 },
  hard: { speedScale: 0.945, cornerSkill: 0.84, mistakeRate: 0.012, aggression: 0.7, boostSkill: 0.7, reaction: 0.18 },
  pro: { speedScale: 1.0, cornerSkill: 0.97, mistakeRate: 0.003, aggression: 0.9, boostSkill: 0.92, reaction: 0.1 },
};

export class AIController {
  readonly profile: AIProfile;
  private config: AIDifficultyConfig;
  private spline: TrackSpline;
  private lineOffset: number;
  private targetOffset: number;
  private mistakeTimer = 0;
  private mistakeSteer = 0;
  private boostTimer = 0;
  private lookAheadError = 0;
  private stuckRecovery = 0;
  private phase: number;

  constructor(profile: AIProfile, difficulty: Difficulty, spline: TrackSpline, laneBias: number) {
    this.profile = profile;
    this.config = AI_DIFFICULTY[difficulty];
    this.spline = spline;
    this.lineOffset = laneBias;
    this.targetOffset = laneBias;
    this.phase = (profile.skill * 7.31 + profile.aggression * 3.7) % (Math.PI * 2);
  }

  setDifficulty(difficulty: Difficulty) {
    this.config = AI_DIFFICULTY[difficulty];
  }

  decide(kart: KartRuntime, karts: KartRuntime[], dt: number, elapsed: number): KartInput {
    const input: KartInput = { throttle: 0, brake: 0, steer: 0, drift: false, boost: false };
    if (kart.completed || kart.eliminated) {
      input.brake = 1;
      return input;
    }
    const cfg = this.config;
    const speed = Math.abs(kart.signedSpeed);
    const surface = sampleSurface(this.spline, kart.position);
    const progress = surface.progressDistance / this.spline.totalLength;

    // Choose a smooth racing line: apex inside of upcoming corners.
    const cornerAhead = this.spline.sampleAtDistance(
      surface.progressDistance + clamp(speed * 0.55, 14, 40),
    );
    const cornerFar = this.spline.sampleAtDistance(
      surface.progressDistance + clamp(speed * 1.15, 30, 78),
    );
    const curveDir = Math.sign(cornerFar.curvature * Math.sin(
      Math.atan2(cornerFar.tangent.x, cornerFar.tangent.z) - Math.atan2(cornerAhead.tangent.x, cornerAhead.tangent.z),
    )) || 1;
    const insideBias = -curveDir * clamp(cornerFar.curvature * 400, 0, 1) * cornerFar.width * 0.24;
    this.targetOffset = this.lineOffset + insideBias;
    // Weave slightly to avoid feeling robotic.
    const weave = Math.sin(elapsed * 0.7 + this.phase) * 2.1 * (1 - cfg.cornerSkill);
    this.targetOffset += weave;

    // Avoid other karts directly ahead.
    let avoid = 0;
    for (const other of karts) {
      if (other === kart || other.eliminated) continue;
      const dx = other.position.x - kart.position.x;
      const dz = other.position.z - kart.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > 11 || dist < 0.001) continue;
      const forward = new THREE.Vector3(Math.sin(kart.heading), 0, Math.cos(kart.heading));
      const dot = (dx * forward.x + dz * forward.z) / dist;
      if (dot < 0.35) continue;
      const sideSign = Math.sign(dx * forward.z - dz * forward.x) || 1;
      avoid -= sideSign * (1 - dist / 11) * (1.4 + cfg.aggression * 2.1);
    }
    this.targetOffset = clamp(this.targetOffset + avoid, -surface.width * 0.36, surface.width * 0.36);
    this.lineOffset = damp(this.lineOffset, this.targetOffset, 1.6 + cfg.cornerSkill * 2, dt);
    this.lineOffset = clamp(this.lineOffset, -surface.width * 0.38, surface.width * 0.38);

    const target = this.spline.sampleAtDistance(
      surface.progressDistance + clamp(6 + speed * 0.42, 8, 26),
    );
    const targetPoint = target.position.clone().addScaledVector(target.right, this.lineOffset);
    const toTarget = targetPoint.clone().sub(kart.position);
    const desiredHeading = Math.atan2(toTarget.x, toTarget.z);
    let headingError = wrapAngle(desiredHeading - kart.heading);

    // Deliberate mistakes scale with difficulty and drop off at higher skill.
    this.mistakeTimer -= dt;
    if (this.mistakeTimer <= 0) {
      this.mistakeTimer = 1.4 + Math.random() * 4.5;
      if (Math.random() < cfg.mistakeRate * 14) {
        this.mistakeSteer = (Math.random() - 0.5) * 0.75;
        this.lookAheadError = (Math.random() - 0.5) * 0.4;
      } else {
        this.mistakeSteer *= 0.15;
        this.lookAheadError *= 0.4;
      }
    }
    headingError += this.mistakeSteer + this.lookAheadError * (1 - cfg.cornerSkill);

    const steerSensitivity = 1.35 + cfg.cornerSkill * 0.7;
    input.steer = clamp(headingError * steerSensitivity, -1, 1);

    // Speed target from corner curvature and kart stats.
    const upcoming = this.spline.sampleAtDistance(surface.progressDistance + clamp(speed * 0.85, 18, 62));
    const curvature = Math.max(upcoming.curvature, surface.curvature * 0.5);
    const lateralGrip = 20 + cfg.cornerSkill * 16;
    const cornerSpeed = curvature > 1e-5 ? Math.sqrt(lateralGrip / curvature) : Infinity;
    const targetSpeed =
      Math.min(maxSpeedOf(kart, false), cornerSpeed) * cfg.speedScale * (1 + kart.rubberBand);
    const brakeThreshold = targetSpeed * (1.02 + (1 - cfg.cornerSkill) * 0.14);

    if (speed < targetSpeed * 0.94) {
      input.throttle = 1;
    } else if (speed < brakeThreshold) {
      input.throttle = 0.45;
    } else {
      input.brake = clamp((speed - targetSpeed) / 10, 0.25, 1);
    }

    // Drift on strong corners when confident.
    const cornerStrength = Math.abs(headingError);
    if (
      cfg.cornerSkill > 0.55 &&
      speed > maxSpeedOf(kart, false) * 0.5 &&
      Math.abs(curvature) > 0.008 &&
      cornerStrength > 0.16 &&
      !kart.offRoad
    ) {
      input.drift = Math.random() < 0.55 + cfg.cornerSkill * 0.4;
    }

    // Strategic boosting on straights and when behind.
    this.boostTimer -= dt;
    if (this.boostTimer <= 0) {
      this.boostTimer = 0.7;
      const aheadStraight = this.spline.sampleAtDistance(surface.progressDistance + 32).curvature < 0.006;
      const canBoost = kart.boostAmount > 34 && !kart.offRoad;
      if (canBoost && aheadStraight && Math.random() < cfg.boostSkill) input.boost = true;
      if (canBoost && kart.rubberBand > 0.06 && Math.random() < cfg.boostSkill * 0.6) input.boost = true;
    }

    // Recovery: if stuck, reverse briefly and steer opposite.
    if (speed < 1.4 && !kart.completed) {
      this.stuckRecovery += dt;
    } else {
      this.stuckRecovery = Math.max(0, this.stuckRecovery - dt * 2);
    }
    if (this.stuckRecovery > 0.7) {
      input.throttle = 0;
      input.brake = 1;
      input.steer = -Math.sign(headingError || 1);
      input.drift = false;
    }

    // Keep karts on track when they wander wide.
    if (Math.abs(surface.lateral) > surface.width * 0.42) {
      input.steer = clamp(input.steer - Math.sign(surface.lateral) * 0.4, -1, 1);
      input.throttle = Math.min(input.throttle, 0.8);
    }
    void progress;
    return input;
  }
}
