import * as THREE from 'three';
import type { KartDef, TrackDef } from '../data/types';
import { TrackSpline } from './TrackSpline';
import { clamp, damp, wrapAngle } from './utils';

export interface KartInput {
  throttle: number;
  brake: number;
  steer: number;
  drift: boolean;
  boost: boolean;
}

export interface KartRuntime {
  id: string;
  isPlayer: boolean;
  def: KartDef;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  heading: number;
  angularVelocity: number;
  speed: number;
  signedSpeed: number;
  steer: number;
  driftAngle: number;
  drifting: boolean;
  boostAmount: number;
  boosting: boolean;
  boostTime: number;
  boostCooldown: number;
  shieldTime: number;
  item: string | null;
  airborne: boolean;
  airTime: number;
  verticalVelocity: number;
  offRoad: boolean;
  wheelSpin: number;
  brakeLights: boolean;
  timeSinceImpact: number;
  impactStrength: number;
  distanceTravelled: number;
  progressDistance: number;
  lastCheckpoint: number;
  lap: number;
  lapStart: number;
  currentLapTime: number;
  bestLap: number | null;
  lastLap: number | null;
  lapTimes: number[];
  completed: boolean;
  finishTime: number | null;
  eliminated: boolean;
  eliminationOrder: number;
  wrongWayTimer: number;
  driftScore: number;
  driftCombo: number;
  driftTime: number;
  totalDrift: number;
  topSpeed: number;
  offRoadTime: number;
  hitCount: number;
  boostUses: number;
  itemCooldown: number;
  coins: number;
  rubberBand: number;
  stuckTimer: number;
  respawnCooldown: number;
  finishedAt: number | null;
}

export interface PhysicsWorld {
  spline: TrackSpline;
  track: TrackDef;
  karts: KartRuntime[];
  elapsed: number;
}

export const GRAVITY = 22;
export const BOOST_CAPACITY = 100;

const BASE_TOP_SPEED = 27;
const BASE_ACCEL = 13;
const BASE_REVERSE = 8;
const BOOST_TOP_MULT = 1.32;
const BOOST_ACCEL_MULT = 2.4;

export function createKartRuntime(
  id: string,
  def: KartDef,
  isPlayer: boolean,
  startPosition: THREE.Vector3,
  heading: number,
): KartRuntime {
  return {
    id,
    isPlayer,
    def,
    position: startPosition.clone(),
    velocity: new THREE.Vector3(),
    heading,
    angularVelocity: 0,
    speed: 0,
    signedSpeed: 0,
    steer: 0,
    driftAngle: 0,
    drifting: false,
    boostAmount: BOOST_CAPACITY * 0.5,
    boosting: false,
    boostTime: 0,
    boostCooldown: 0,
    shieldTime: 0,
    item: null,
    airborne: false,
    airTime: 0,
    verticalVelocity: 0,
    offRoad: false,
    wheelSpin: 0,
    brakeLights: false,
    timeSinceImpact: 99,
    impactStrength: 0,
    distanceTravelled: 0,
    progressDistance: 0,
    lastCheckpoint: 0,
    lap: 0,
    lapStart: 0,
    currentLapTime: 0,
    bestLap: null,
    lastLap: null,
    lapTimes: [],
    completed: false,
    finishTime: null,
    eliminated: false,
    eliminationOrder: 0,
    wrongWayTimer: 0,
    driftScore: 0,
    driftCombo: 1,
    driftTime: 0,
    totalDrift: 0,
    topSpeed: 0,
    offRoadTime: 0,
    hitCount: 0,
    boostUses: 0,
    itemCooldown: 0,
    coins: 0,
    rubberBand: 0,
    stuckTimer: 0,
    respawnCooldown: 0,
    finishedAt: null,
  };
}

export function maxSpeedOf(kart: KartRuntime, boosting: boolean): number {
  const stat = kart.def.stats.topSpeed / 10;
  let top = BASE_TOP_SPEED * (0.78 + stat * 0.44);
  if (boosting) top *= BOOST_TOP_MULT;
  return top;
}

interface SurfaceInfo {
  onRoad: boolean;
  progressDistance: number;
  lateral: number;
  width: number;
  groundY: number;
  tangent: THREE.Vector3;
  curvature: number;
}

const SURFACE_SAMPLES = 220;
const surfaceCache = new Map<string, SurfaceInfo>();

export function sampleSurface(spline: TrackSpline, position: THREE.Vector3): SurfaceInfo {
  const key = spline.def.id;
  const cached = surfaceCache.get(key);
  void cached;
  let best = Infinity;
  let bestSample = spline.samples[0];
  for (let i = 0; i < SURFACE_SAMPLES; i++) {
    const s = spline.samples[Math.floor((i / SURFACE_SAMPLES) * spline.samples.length)];
    const dx = s.position.x - position.x;
    const dz = s.position.z - position.z;
    const d = dx * dx + dz * dz;
    if (d < best) {
      best = d;
      bestSample = s;
    }
  }
  // Refine around the coarse winner.
  const baseIdx = spline.samples.indexOf(bestSample);
  const span = Math.ceil(spline.samples.length / SURFACE_SAMPLES) + 2;
  for (let k = -span; k <= span; k++) {
    const s = spline.samples[(baseIdx + k + spline.samples.length) % spline.samples.length];
    const dx = s.position.x - position.x;
    const dz = s.position.z - position.z;
    const d = dx * dx + dz * dz;
    if (d < best) {
      best = d;
      bestSample = s;
    }
  }
  const rel = new THREE.Vector3(position.x - bestSample.position.x, 0, position.z - bestSample.position.z);
  const lateral = rel.dot(bestSample.right);
  const onRoad = Math.abs(lateral) < bestSample.width / 2 + 0.35;
  return {
    onRoad,
    progressDistance: bestSample.distance,
    lateral,
    width: bestSample.width,
    groundY: bestSample.position.y,
    tangent: bestSample.tangent,
    curvature: bestSample.curvature,
  };
}

export function resetKartToSpline(kart: KartRuntime, spline: TrackSpline, progressDistance: number, lateral = 0) {
  const s = spline.sampleAtDistance(progressDistance);
  kart.position.copy(s.position).addScaledVector(s.right, lateral);
  kart.position.y = s.position.y + 0.01;
  kart.heading = Math.atan2(s.tangent.x, s.tangent.z);
  kart.velocity.set(0, 0, 0);
  kart.speed = 0;
  kart.signedSpeed = 0;
  kart.angularVelocity = 0;
  kart.driftAngle = 0;
  kart.drifting = false;
  kart.airborne = false;
  kart.verticalVelocity = 0;
  kart.progressDistance = s.distance;
  kart.respawnCooldown = 1.2;
}

export interface StepContext {
  spline: TrackSpline;
  track: TrackDef;
  input: KartInput;
  dt: number;
  elapsed: number;
  isPlayer: boolean;
  allowBoost: boolean;
  steeringSensitivity: number;
  quality: 'low' | 'medium' | 'high';
}

export function stepKart(kart: KartRuntime, ctx: StepContext): void {
  if (kart.eliminated) {
    kart.speed = damp(kart.speed, 0, 4, ctx.dt);
    return;
  }
  const { dt, input } = ctx;
  const stats = kart.def.stats;
  const surface = sampleSurface(ctx.spline, kart.position);
  kart.offRoad = !surface.onRoad;
  kart.respawnCooldown = Math.max(0, kart.respawnCooldown - dt);
  kart.timeSinceImpact += dt;

  const speedStat = stats.topSpeed / 10;
  const accelStat = stats.acceleration / 10;
  const handlingStat = stats.handling / 10;
  const weightStat = stats.weight / 10;
  const driftStat = stats.drift / 10;

  // Boost management.
  kart.boostCooldown = Math.max(0, kart.boostCooldown - dt);
  if (kart.boosting) {
    kart.boostTime -= dt;
    kart.boostAmount = Math.max(0, kart.boostAmount - dt * 26);
    if (kart.boostTime <= 0 || kart.boostAmount <= 0 || !ctx.allowBoost) {
      kart.boosting = false;
      kart.boostTime = 0;
      kart.boostCooldown = 0.45;
    }
  } else if (input.boost && kart.boostAmount > 18 && kart.boostCooldown <= 0 && ctx.allowBoost && !kart.offRoad) {
    kart.boosting = true;
    kart.boostTime = 0.62 + stats.boost / 10 * 0.62;
    kart.boostUses += 1;
    kart.driftCombo = 1;
  }
  if (!kart.boosting && !kart.drifting) {
    kart.boostAmount = Math.min(BOOST_CAPACITY, kart.boostAmount + dt * 3.1);
  }
  kart.itemCooldown = Math.max(0, kart.itemCooldown - dt);
  kart.shieldTime = Math.max(0, kart.shieldTime - dt);

  // Steering: speed-sensitive, smoothed, inverted slightly at very low speed.
  const speedRatio = clamp(Math.abs(kart.signedSpeed) / (maxSpeedOf(kart, false) + 6), 0, 1);
  const steerAuthority = (0.52 + handlingStat * 0.62) * (1 - speedRatio * 0.34);
  const targetSteer = clamp(input.steer, -1, 1);
  const steerLambda = 8 + handlingStat * 7;
  kart.steer = damp(kart.steer, targetSteer, steerLambda, dt);
  const speedSign = kart.signedSpeed < -0.4 ? -1 : 1;

  const wantsDrift = input.drift && Math.abs(kart.signedSpeed) > 7 && Math.abs(input.steer) > 0.16 && !kart.offRoad;
  if (wantsDrift && !kart.airborne) {
    if (!kart.drifting) {
      kart.drifting = true;
      kart.driftTime = 0;
      kart.driftCombo = 1;
    }
    kart.driftTime += dt;
  } else if (kart.drifting && (!input.drift || Math.abs(kart.signedSpeed) < 4.5)) {
    if (kart.driftTime > 0.55) {
      const reward = clamp(kart.driftTime * 12 * kart.driftCombo, 0, 42);
      kart.boostAmount = Math.min(BOOST_CAPACITY, kart.boostAmount + reward);
      kart.driftScore += reward * 8;
      kart.driftCombo = Math.min(4, kart.driftCombo + 0.5);
    }
    kart.drifting = false;
    kart.driftTime = 0;
  }

  if (kart.drifting) {
    // Drift yaw is stronger, lateral grip lower, and the boost reward scales with angle.
    const driftYaw = (1.55 + driftStat * 1.05) * steerAuthority;
    kart.angularVelocity = damp(kart.angularVelocity, kart.steer * driftYaw * speedSign, 6.5, dt);
    kart.driftAngle = damp(kart.driftAngle, clamp(kart.steer * 0.62 + kart.angularVelocity * 0.16, -0.8, 0.8), 6, dt);
    kart.totalDrift += Math.abs(kart.driftAngle) * Math.abs(kart.signedSpeed) * dt;
    kart.driftScore += Math.abs(kart.driftAngle) * Math.abs(kart.signedSpeed) * dt * 1.7;
    kart.boostAmount = Math.min(BOOST_CAPACITY, kart.boostAmount + dt * 4.4 * (0.5 + driftStat));
  } else {
    const turnRate = (1.12 + handlingStat * 1.0) * steerAuthority;
    kart.angularVelocity = damp(kart.angularVelocity, kart.steer * turnRate * speedSign, 9, dt);
    kart.driftAngle = damp(kart.driftAngle, 0, 7, dt);
  }
  if (kart.airborne) kart.angularVelocity *= 0.55;
  kart.heading = wrapAngle(kart.heading + kart.angularVelocity * dt);

  // Longitudinal forces.
  const boosting = kart.boosting;
  const top = maxSpeedOf(kart, boosting);
  const throttle = clamp(input.throttle, 0, 1);
  const brake = clamp(input.brake, 0, 1);
  const accel = BASE_ACCEL * (0.55 + accelStat * 0.62) * (boosting ? BOOST_ACCEL_MULT : 1);
  const forward = new THREE.Vector3(Math.sin(kart.heading), 0, Math.cos(kart.heading));
  const right = new THREE.Vector3(forward.z, 0, -forward.x);

  const projected = kart.velocity.dot(forward);
  const lateralVelocity = kart.velocity.dot(right);
  let forwardSpeed = projected;

  if (!kart.airborne) {
    if (throttle > 0.01) {
      const curve = 1 - clamp(Math.abs(forwardSpeed) / (top * 1.02), 0, 1) * 0.82;
      forwardSpeed += accel * throttle * curve * dt;
    }
    if (brake > 0.01) {
      if (forwardSpeed > 0.6) {
        forwardSpeed -= (BASE_ACCEL * 1.5 + brake * 18) * dt;
      } else {
        forwardSpeed -= BASE_REVERSE * (0.6 + accelStat) * brake * dt;
      }
    }
    if (throttle < 0.01 && brake < 0.01) {
      const coast = 1.1 + weightStat * 1.5;
      forwardSpeed = damp(forwardSpeed, 0, coast, dt);
    }
    if (boosting) forwardSpeed += accel * 1.4 * dt;
    if (kart.drifting) forwardSpeed -= (1.2 + speedRatio * 2.2) * dt;

    // Off-road penalty, scaled by surface.
    if (kart.offRoad) {
      const over = Math.max(0, Math.abs(surface.lateral) - surface.width / 2);
      forwardSpeed *= 1 - clamp(0.55 + over * 0.16, 0, 2.1) * dt;
      kart.offRoadTime += dt;
    }
    forwardSpeed = clamp(forwardSpeed, -top * 0.42, top);

    // Lateral grip: drift reduces it, handling raises it.
    const gripBase = kart.drifting ? 1.9 - driftStat * 0.55 : 7.5 + handlingStat * 6.5;
    const grip = kart.offRoad ? gripBase * 0.35 : gripBase;
    const lateralDamped = lateralVelocity * Math.exp(-grip * dt);
    kart.velocity.copy(forward).multiplyScalar(forwardSpeed).addScaledVector(right, lateralDamped);

    // Slight gravity-driven slide on steep elevation.
    kart.velocity.y = 0;
    kart.signedSpeed = forwardSpeed;
    kart.speed = Math.abs(forwardSpeed);
  } else {
    kart.velocity.y -= GRAVITY * dt;
    kart.airTime += dt;
  }

  // Integrate position.
  kart.position.addScaledVector(kart.velocity, dt);
  if (kart.airborne) {
    kart.position.y += kart.verticalVelocity * dt;
    kart.verticalVelocity -= GRAVITY * dt;
    if (kart.position.y <= surface.groundY + 0.02) {
      kart.position.y = surface.groundY;
      kart.airborne = false;
      kart.verticalVelocity = 0;
      kart.airTime = 0;
      kart.velocity.y = 0;
      kart.impactStrength = Math.max(kart.impactStrength, 0.4);
    }
  } else {
    // Ramp detection: y jump pads trigger a vertical launch.
    const launch = shouldLaunch(ctx.track, surface.progressDistance, ctx.spline.totalLength);
    if (launch && kart.speed > 14) {
      kart.airborne = true;
      kart.verticalVelocity = 6.4 + speedRatio * 3.6;
      kart.position.y += 0.1;
    } else {
      kart.position.y = damp(kart.position.y, surface.groundY, 16, dt);
    }
  }

  kart.distanceTravelled += Math.abs(kart.signedSpeed) * dt;
  kart.topSpeed = Math.max(kart.topSpeed, kart.speed);

  // Checkpoint / lap progress tracking (validated in RaceManager).
  kart.progressDistance = surface.progressDistance;
  kart.currentLapTime = ctx.elapsed - kart.lapStart;

  // Stuck recovery.
  if (!kart.isPlayer) {
    if (kart.speed < 1.2 && !kart.completed) {
      kart.stuckTimer += dt;
    } else {
      kart.stuckTimer = Math.max(0, kart.stuckTimer - dt * 2);
    }
  }

  kart.brakeLights = brake > 0.05 || (kart.drifting && kart.speed > 8);
  kart.wheelSpin += kart.signedSpeed * dt / kart.def.wheelSize;
}

function shouldLaunch(track: TrackDef, distance: number, total: number): boolean {
  const p = distance / total;
  for (const t of track.jumpPads) {
    let d = Math.abs(p - t);
    if (d > 0.5) d = 1 - d;
    if (d < 0.006) return true;
  }
  return false;
}

export function onBoostPad(track: TrackDef, distance: number, total: number): boolean {
  const p = distance / total;
  for (const t of track.boostPads) {
    let d = Math.abs(p - t);
    if (d > 0.5) d = 1 - d;
    if (d < 0.014) return true;
  }
  return false;
}

export function collideKartWithTrack(kart: KartRuntime, ctx: StepContext): void {
  const surface = sampleSurface(ctx.spline, kart.position);
  const limit = surface.width / 2 + 0.1;
  if (Math.abs(surface.lateral) > limit) {
    const s = ctx.spline.sampleAtDistance(surface.progressDistance);
    const sign = Math.sign(surface.lateral);
    const correction = Math.abs(surface.lateral) - limit;
    kart.position.addScaledVector(s.right, -sign * correction);
    const lateralVelocity = kart.velocity.dot(s.right);
    if (Math.sign(lateralVelocity) === sign) {
      kart.velocity.addScaledVector(s.right, -lateralVelocity * 1.35);
    }
    const impact = Math.min(1, Math.abs(lateralVelocity) / 12);
    if (impact > 0.08) {
      kart.velocity.multiplyScalar(0.86);
      kart.signedSpeed *= 0.86;
      kart.impactStrength = Math.max(kart.impactStrength, impact);
      kart.timeSinceImpact = 0;
      kart.hitCount += impact > 0.3 ? 1 : 0;
    }
    // Align heading away from the wall to prevent sticking.
    const wallNormal = s.right.clone().multiplyScalar(-sign);
    const headingVec = new THREE.Vector3(Math.sin(kart.heading), 0, Math.cos(kart.heading));
    if (headingVec.dot(wallNormal) < 0.1) {
      const targetHeading = Math.atan2(s.tangent.x, s.tangent.z);
      kart.heading = wrapAngle(kart.heading + wrapAngle(targetHeading - kart.heading) * 0.16);
    }
  }
}

export function collideKarts(karts: KartRuntime[]): void {
  for (let i = 0; i < karts.length; i++) {
    const a = karts[i];
    if (a.eliminated) continue;
    for (let j = i + 1; j < karts.length; j++) {
      const b = karts[j];
      if (b.eliminated) continue;
      const dx = b.position.x - a.position.x;
      const dz = b.position.z - a.position.z;
      const distSq = dx * dx + dz * dz;
      const minDist = 1.85;
      if (distSq > minDist * minDist || distSq < 0.0001) continue;
      const dist = Math.sqrt(distSq);
      const nx = dx / dist;
      const nz = dz / dist;
      const overlap = minDist - dist;
      const weightA = 0.6 + a.def.stats.weight / 10;
      const weightB = 0.6 + b.def.stats.weight / 10;
      const totalW = weightA + weightB;
      const pushA = overlap * (weightB / totalW);
      const pushB = overlap * (weightA / totalW);
      a.position.x -= nx * pushA;
      a.position.z -= nz * pushA;
      b.position.x += nx * pushB;
      b.position.z += nz * pushB;
      const relVel = (b.velocity.x - a.velocity.x) * nx + (b.velocity.z - a.velocity.z) * nz;
      if (relVel < 0) {
        const impulse = -relVel * 0.72;
        const shieldA = a.shieldTime > 0 ? 0.4 : 1;
        const shieldB = b.shieldTime > 0 ? 0.4 : 1;
        a.velocity.x -= nx * impulse * (weightB / totalW) * shieldA;
        a.velocity.z -= nz * impulse * (weightB / totalW) * shieldA;
        b.velocity.x += nx * impulse * (weightA / totalW) * shieldB;
        b.velocity.z += nz * impulse * (weightA / totalW) * shieldB;
        const strength = Math.min(1, Math.abs(relVel) / 16);
        if (strength > 0.12) {
          a.impactStrength = Math.max(a.impactStrength, strength);
          b.impactStrength = Math.max(b.impactStrength, strength);
          a.timeSinceImpact = 0;
          b.timeSinceImpact = 0;
          a.signedSpeed *= 1 - strength * 0.14;
          b.signedSpeed *= 1 - strength * 0.14;
          a.hitCount += strength > 0.4 ? 1 : 0;
          b.hitCount += strength > 0.4 ? 1 : 0;
        }
      }
    }
  }
}

export function tickKartTimers(kart: KartRuntime, dt: number): void {
  kart.speed = Math.abs(kart.velocity.x * Math.sin(kart.heading) + kart.velocity.z * Math.cos(kart.heading));
  kart.impactStrength = Math.max(0, kart.impactStrength - dt * 2.4);
}
