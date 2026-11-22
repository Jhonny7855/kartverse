import * as THREE from 'three';
import type { KartRuntime } from './RacePhysics';
import { clamp, damp, lerp } from './utils';

export type CameraMode = 'chase' | 'close' | 'wide' | 'cinematic' | 'firstperson' | 'trackside';

export const CAMERA_LABELS: Record<CameraMode, string> = {
  chase: 'Chase',
  close: 'Close Chase',
  wide: 'Wide',
  cinematic: 'Cinematic',
  firstperson: 'Driver',
  trackside: 'Trackside',
};

const MODE_ORDER: CameraMode[] = ['chase', 'close', 'wide', 'cinematic', 'firstperson', 'trackside'];

export class CameraController {
  mode: CameraMode = 'chase';
  private camera: THREE.PerspectiveCamera;
  private targetPos = new THREE.Vector3();
  private lookAt = new THREE.Vector3();
  private shake = 0;
  private shakeTime = 0;
  private currentFov = 62;
  private orbitAngle = 0;
  private tracksidePoint = new THREE.Vector3();
  private tracksideTimer = 0;
  private sensitivity = 1;
  private shakeAmount = 0.5;
  private lastMode: CameraMode = 'chase';

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
  }

  setSensitivity(v: number) {
    this.sensitivity = v;
  }

  setShakeAmount(v: number) {
    this.shakeAmount = v;
  }

  cycle(): CameraMode {
    const idx = MODE_ORDER.indexOf(this.mode);
    this.mode = MODE_ORDER[(idx + 1) % MODE_ORDER.length];
    this.tracksideTimer = 0;
    return this.mode;
  }

  setMode(mode: CameraMode) {
    this.mode = mode;
    this.tracksideTimer = 0;
  }

  addShake(amount: number) {
    this.shake = Math.min(1.4, this.shake + amount * this.shakeAmount);
  }

  snap(kart: KartRuntime) {
    this.lastMode = this.mode === 'chase' ? 'close' : 'chase';
    this.update(kart, 1, true);
  }

  update(kart: KartRuntime, dt: number, immediate = false) {
    if (this.mode !== this.lastMode) {
      this.lastMode = this.mode;
      if (this.mode === 'trackside') {
        this.pickTracksidePoint(kart);
      }
    }
    const forward = new THREE.Vector3(Math.sin(kart.heading), 0, Math.cos(kart.heading));
    const speedNorm = clamp(kart.speed / 34, 0, 1);
    const boostKick = kart.boosting ? 1 : 0;
    const pos = kart.position;

    switch (this.mode) {
      case 'firstperson': {
        const offset = forward.clone().multiplyScalar(0.1).add(new THREE.Vector3(0, 1.06, 0));
        const side = new THREE.Vector3(forward.z, 0, -forward.x).multiplyScalar(0);
        this.targetPos.copy(pos).add(offset).add(side);
        this.lookAt.copy(pos).addScaledVector(forward, 12).add(new THREE.Vector3(0, 0.85, 0));
        this.currentFov = lerp(this.currentFov, 74 + speedNorm * 10, immediate ? 1 : dt * 4);
        break;
      }
      case 'close': {
        const dist = 5.4 + speedNorm * 0.9 + boostKick * 0.6;
        const height = 1.75;
        const desired = pos
          .clone()
          .addScaledVector(forward, -dist)
          .add(new THREE.Vector3(0, height, 0));
        this.targetPos.lerp(desired, immediate ? 1 : 1 - Math.exp(-9 * dt));
        this.lookAt.lerp(pos.clone().addScaledVector(forward, 5).add(new THREE.Vector3(0, 0.9, 0)), immediate ? 1 : 1 - Math.exp(-11 * dt));
        this.currentFov = lerp(this.currentFov, 64 + speedNorm * 8, immediate ? 1 : dt * 3);
        break;
      }
      case 'wide': {
        const dist = 11 + speedNorm * 2.4;
        const height = 4.4;
        const desired = pos
          .clone()
          .addScaledVector(forward, -dist)
          .add(new THREE.Vector3(0, height, 0));
        this.targetPos.lerp(desired, immediate ? 1 : 1 - Math.exp(-6 * dt));
        this.lookAt.lerp(pos.clone().addScaledVector(forward, 7).add(new THREE.Vector3(0, 1, 0)), immediate ? 1 : 1 - Math.exp(-8 * dt));
        this.currentFov = lerp(this.currentFov, 58 + speedNorm * 6, immediate ? 1 : dt * 3);
        break;
      }
      case 'cinematic': {
        this.orbitAngle += dt * 0.55;
        const dist = 9.5 + Math.sin(this.orbitAngle * 0.7) * 2.2;
        const height = 2.6 + Math.sin(this.orbitAngle * 0.9) * 1.2;
        const dir = new THREE.Vector3(Math.cos(this.orbitAngle), 0, Math.sin(this.orbitAngle));
        const desired = pos.clone().addScaledVector(dir, dist).add(new THREE.Vector3(0, height, 0));
        this.targetPos.lerp(desired, immediate ? 1 : 1 - Math.exp(-3.4 * dt));
        this.lookAt.lerp(pos.clone().add(new THREE.Vector3(0, 0.8, 0)), immediate ? 1 : 1 - Math.exp(-6 * dt));
        this.currentFov = lerp(this.currentFov, 50 + speedNorm * 4, immediate ? 1 : dt * 2);
        break;
      }
      case 'trackside': {
        this.tracksideTimer -= dt;
        const dist = this.camera.position.distanceTo(pos);
        if (this.tracksideTimer <= 0 || dist > 62) {
          this.pickTracksidePoint(kart);
        }
        this.targetPos.copy(this.tracksidePoint);
        this.lookAt.lerp(pos.clone().add(new THREE.Vector3(0, 0.7, 0)), immediate ? 1 : 1 - Math.exp(-14 * dt));
        this.currentFov = lerp(this.currentFov, 44 + speedNorm * 22, immediate ? 1 : dt * 3);
        break;
      }
      default: {
        const dist = 8.8 + speedNorm * 2.1 + boostKick * 1.1;
        const height = 3.55 + speedNorm * 0.45;
        const driftSwing = kart.driftAngle * 1.4;
        const desired = pos
          .clone()
          .addScaledVector(forward, -dist)
          .add(new THREE.Vector3(0, height, 0))
          .addScaledVector(new THREE.Vector3(forward.z, 0, -forward.x), driftSwing * 0.6);
        const lambda = immediate ? 100 : 7.2 * this.sensitivity;
        this.targetPos.lerp(desired, 1 - Math.exp(-lambda * dt));
        const lookTarget = pos.clone().addScaledVector(forward, 9.5).add(new THREE.Vector3(0, 1.55, 0));
        this.lookAt.lerp(lookTarget, immediate ? 1 : 1 - Math.exp(-9 * dt));
        this.currentFov = lerp(this.currentFov, 62 + speedNorm * 11 + boostKick * 3, immediate ? 1 : dt * 3.4);
      }
    }

    // Shake decays and offsets the camera in a deterministic jitter pattern.
    this.shake = Math.max(0, this.shake - dt * 2.6);
    this.shakeTime += dt;
    const camera = this.camera;
    camera.position.copy(this.targetPos);
    if (this.mode !== 'trackside') {
      const wobble = this.shake * 0.22;
      camera.position.x += Math.sin(this.shakeTime * 62) * wobble;
      camera.position.y += Math.sin(this.shakeTime * 47 + 1.3) * wobble * 0.7;
      camera.position.z += Math.cos(this.shakeTime * 55) * wobble;
    }
    if (this.mode === 'firstperson') {
      camera.position.y += Math.sin(this.shakeTime * 34) * 0.006;
    }

    camera.lookAt(this.lookAt);
    if (this.mode === 'firstperson' || this.mode === 'chase') {
      camera.rotateZ(-kart.driftAngle * 0.09 * (this.mode === 'firstperson' ? 1 : 0.55));
    }
    if (Math.abs(camera.fov - this.currentFov) > 0.01) {
      camera.fov = damp(camera.fov, this.currentFov, 6, dt);
      camera.updateProjectionMatrix();
    }
  }

  private pickTracksidePoint(kart: KartRuntime) {
    const angle = kart.heading + Math.PI * 0.5 + (Math.random() > 0.5 ? 0 : Math.PI);
    const dist = 15 + Math.random() * 8;
    this.tracksidePoint.set(
      kart.position.x + Math.cos(angle) * dist,
      kart.position.y + 3.4 + Math.random() * 2.2,
      kart.position.z + Math.sin(angle) * dist,
    );
    this.tracksideTimer = 4.5;
    this.lookAt.copy(kart.position);
    this.camera.position.copy(this.tracksidePoint);
  }
}
