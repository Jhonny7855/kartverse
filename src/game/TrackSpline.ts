import * as THREE from 'three';
import type { TrackDef } from '../data/types';

export interface SplineSample {
  position: THREE.Vector3;
  tangent: THREE.Vector3;
  right: THREE.Vector3;
  distance: number;
  curvature: number;
  width: number;
}

export class TrackSpline {
  readonly curve: THREE.CatmullRomCurve3;
  readonly samples: SplineSample[];
  readonly totalLength: number;
  readonly width: number;
  readonly def: TrackDef;

  constructor(def: TrackDef) {
    this.def = def;
    this.width = def.width;
    this.curve = new THREE.CatmullRomCurve3(
      def.points.map((p) => new THREE.Vector3(p.x, p.y, p.z)),
      true,
      'catmullrom',
      0.5,
    );
    this.curve.arcLengthDivisions = 2400;
    const raw = this.curve.getSpacedPoints(900);
    const total = this.curve.getLength();
    this.totalLength = total;

    const samples: SplineSample[] = [];
    let acc = 0;
    for (let i = 0; i < raw.length - 1; i++) {
      const a = raw[i];
      const b = raw[i + 1];
      const segment = a.distanceTo(b);
      const t = this.curve.getTangentAt((i + 1) / raw.length).normalize();
      const right = new THREE.Vector3(-t.z, 0, t.x).normalize();
      // Width variation keeps long sweepers generous and technical sections tighter.
      const widthFactor = 1 + Math.sin((i / raw.length) * Math.PI * 6) * 0.07;
      samples.push({ position: a.clone(), tangent: t, right, distance: acc, curvature: 0, width: def.width * widthFactor });
      acc += segment;
    }
    // Curvature from heading change per metre.
    for (let i = 0; i < samples.length; i++) {
      const prev = samples[(i - 3 + samples.length) % samples.length];
      const next = samples[(i + 3) % samples.length];
      const pT = prev.tangent;
      const nT = next.tangent;
      const delta = Math.acos(Math.min(1, Math.max(-1, pT.dot(nT))));
      const arc = Math.max(0.001, (next.distance - prev.distance + this.totalLength) % this.totalLength);
      samples[i].curvature = delta / arc;
    }
    this.samples = samples;
  }

  sampleAtDistance(distance: number, out?: SplineSample): SplineSample {
    const total = this.totalLength;
    let d = distance % total;
    if (d < 0) d += total;
    const idx = (d / total) * this.samples.length;
    const i0 = Math.floor(idx) % this.samples.length;
    const i1 = (i0 + 1) % this.samples.length;
    const f = idx - Math.floor(idx);
    const a = this.samples[i0];
    const b = this.samples[i1];
    const result: SplineSample = out ?? {
      position: new THREE.Vector3(),
      tangent: new THREE.Vector3(),
      right: new THREE.Vector3(),
      distance: 0,
      curvature: 0,
      width: 0,
    };
    result.position.lerpVectors(a.position, b.position, f);
    result.tangent.lerpVectors(a.tangent, b.tangent, f).normalize();
    result.right.set(-result.tangent.z, 0, result.tangent.x).normalize();
    result.width = a.width + (b.width - a.width) * f;
    result.curvature = a.curvature + (b.curvature - a.curvature) * f;
    result.distance = a.distance + (b.distance - a.distance) * f;
    return result;
  }

  progressToPosition(progress: number): THREE.Vector3 {
    return this.sampleAtDistance(progress * this.totalLength).position;
  }

  nearestDistance(point: THREE.Vector3, hint = -1): number {
    let best = Infinity;
    let bestIdx = 0;
    const n = this.samples.length;
    if (hint >= 0) {
      for (let k = -36; k <= 36; k++) {
        const i = (Math.round(hint) + k + n * 2) % n;
        const d = this.samples[i].position.distanceToSquared(point);
        if (d < best) {
          best = d;
          bestIdx = i;
        }
      }
      if (best < 3600) return this.samples[bestIdx].distance;
    }
    best = Infinity;
    for (let i = 0; i < n; i += 2) {
      const d = this.samples[i].position.distanceToSquared(point);
      if (d < best) {
        best = d;
        bestIdx = i;
      }
    }
    return this.samples[bestIdx].distance;
  }

  nearestSampleIndex(point: THREE.Vector3, hint = -1): number {
    let best = Infinity;
    let bestIdx = 0;
    const n = this.samples.length;
    if (hint >= 0) {
      for (let k = -24; k <= 24; k++) {
        const i = (Math.round(hint) + k + n * 2) % n;
        const d = this.samples[i].position.distanceToSquared(point);
        if (d < best) {
          best = d;
          bestIdx = i;
        }
      }
      if (best < 900) return bestIdx;
    }
    best = Infinity;
    for (let i = 0; i < n; i += 2) {
      const d = this.samples[i].position.distanceToSquared(point);
      if (d < best) {
        best = d;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  offsetPoint(progress: number, lateral: number): THREE.Vector3 {
    const s = this.sampleAtDistance(progress * this.totalLength);
    return s.position.clone().addScaledVector(s.right, lateral);
  }
}
