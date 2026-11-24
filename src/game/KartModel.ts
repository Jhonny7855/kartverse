import * as THREE from 'three';
import type { Customization, DecalId, KartDef } from '../data/types';
import { clamp } from './utils';

export interface KartVisualState {
  speed: number;
  steer: number;
  drift: number;
  throttle: number;
  braking: boolean;
  boosting: boolean;
  airborne: boolean;
  time: number;
}

interface WheelAssembly {
  pivot: THREE.Group;
  spin: THREE.Group;
  front: boolean;
  baseY: number;
}

const decalTextures = new Map<DecalId, THREE.CanvasTexture>();

function stripeTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 256);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.beginPath();
  ctx.moveTo(96, 0);
  ctx.lineTo(160, 0);
  ctx.lineTo(160, 256);
  ctx.lineTo(96, 256);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillRect(170, 0, 18, 256);
  ctx.fillRect(66, 0, 10, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function flameTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 256, 0, 0);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.95)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    const x = 80 + i * 50;
    ctx.moveTo(x, 256);
    ctx.quadraticCurveTo(x - 34, 160, x, 40 + i * 24);
    ctx.quadraticCurveTo(x + 34, 160, x, 256);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function circuitTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 256);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 7;
  ctx.strokeRect(38, 64, 180, 128);
  ctx.beginPath();
  ctx.moveTo(38, 128);
  ctx.lineTo(128, 128);
  ctx.lineTo(128, 192);
  ctx.stroke();
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(52 + i * 26, 74, 10, 10);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function starTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 256);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.translate(128, 128);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 92 : 38;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function radialTexture(inner: string, outer: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 128, 4, 128, 128, 128);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.28, outer);
  grad.addColorStop(0.62, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function getDecalTexture(decal: DecalId): THREE.CanvasTexture | null {
  if (decal === 'none') return null;
  if (decalTextures.has(decal)) return decalTextures.get(decal)!;
  let tex: THREE.CanvasTexture;
  switch (decal) {
    case 'flames':
      tex = flameTexture();
      break;
    case 'circuit':
      tex = circuitTexture();
      break;
    case 'star':
      tex = starTexture();
      break;
    default:
      tex = stripeTexture();
  }
  decalTextures.set(decal, tex);
  return tex;
}

function luminance(color: string): number {
  const hex = color.replace('#', '');
  const full = hex.length === 3 ? hex.split('').map((ch) => ch + ch).join('') : hex;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function shade(color: string, factor: number): string {
  const hex = color.replace('#', '');
  const full = hex.length === 3 ? hex.split('').map((ch) => ch + ch).join('') : hex;
  const parts = [0, 2, 4].map((i) => Math.round(parseInt(full.slice(i, i + 2), 16) * factor));
  return `rgb(${parts[0]}, ${parts[1]}, ${parts[2]})`;
}

function helmetTexture(shellColor: string, trimColor: string, visorColorDark: string): THREE.CanvasTexture {
  const w = 512;
  const h = 256;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = shellColor;
  ctx.fillRect(0, 0, w, h);

  const shellLum = luminance(shellColor);
  const contrastTrim = Math.abs(luminance(trimColor) - shellLum) > 0.25
    ? trimColor
    : shellLum > 0.55
      ? '#1a2030'
      : trimColor;

  // u = 0.25 is the front of the sphere when using a default sphere UV layout.
  const front = w * 0.25;

  for (const dir of [-1, 1]) {
    ctx.save();
    ctx.translate(front + dir * w * 0.075, h * 0.5);
    ctx.rotate(dir * 0.05);
    ctx.fillStyle = contrastTrim;
    ctx.fillRect(-w * 0.03, -h * 0.3, w * 0.06, h * 0.6);
    ctx.restore();
  }

  // Rear spoiler lip is drawn as a dark band at the back of the shell.
  ctx.fillStyle = shade(shellColor, 0.55);
  ctx.fillRect(w * 0.46, h * 0.62, w * 0.08, h * 0.16);

  // Chin bar: a narrow dark band wrapping the lower jaw only.
  ctx.fillStyle = shade(shellColor, 0.25);
  ctx.beginPath();
  ctx.ellipse(front, h * 0.81, w * 0.086, h * 0.095, 0, 0, Math.PI * 2);
  ctx.fill();

  // Visor: a wide, shallow lens band at eye height.
  ctx.fillStyle = visorColorDark;
  ctx.beginPath();
  ctx.ellipse(front, h * 0.475, w * 0.135, h * 0.085, 0, 0, Math.PI * 2);
  ctx.fill();

  const gloss = ctx.createLinearGradient(front - w * 0.1, h * 0.42, front + w * 0.09, h * 0.53);
  gloss.addColorStop(0, 'rgba(160,200,250,0.55)');
  gloss.addColorStop(0.55, 'rgba(70,120,190,0.14)');
  gloss.addColorStop(1, 'rgba(10,18,32,0.0)');
  ctx.fillStyle = gloss;
  ctx.beginPath();
  ctx.ellipse(front, h * 0.475, w * 0.128, h * 0.078, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#05070c';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(front, h * 0.475, w * 0.138, h * 0.09, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = shade(shellColor, 0.5);
  for (const dir of [-1, 1]) {
    for (let i = 0; i < 2; i++) {
      ctx.fillRect(front + dir * w * 0.026 + i * w * 0.015, h * 0.785, w * 0.009, h * 0.032);
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function suitTexture(base: string, trim: string): THREE.CanvasTexture {
  const w = 256;
  const h = 256;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  // Lathe UVs wrap clockwise from +X, so the driver's chest (facing +Z) lands at u = 0.25.
  const front = w * 0.25;

  ctx.fillStyle = trim;
  ctx.fillRect(0, h * 0.1, w, h * 0.03);
  ctx.fillRect(front - w * 0.012, h * 0.3, w * 0.024, h * 0.46);

  ctx.fillStyle = '#12161f';
  for (const dir of [-1, 1]) {
    ctx.save();
    ctx.translate(front + dir * w * 0.044, h * 0.52);
    ctx.rotate(dir * 0.1);
    ctx.fillRect(-w * 0.009, -h * 0.3, w * 0.018, h * 0.42);
    ctx.restore();
  }
  ctx.fillStyle = '#8b95a8';
  ctx.fillRect(front - w * 0.02, h * 0.7, w * 0.04, h * 0.028);

  ctx.strokeStyle = 'rgba(0,0,0,0.28)';
  ctx.lineWidth = 3;
  for (const u of [0.25, 0.5, 0.0]) {
    ctx.beginPath();
    ctx.moveTo(u * w, 0);
    ctx.lineTo(u * w, h);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function numberTexture(number: string, bodyColor: string, accent: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#10131b';
  ctx.beginPath();
  ctx.roundRect(10, 28, 236, 200, 26);
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 7;
  ctx.stroke();
  ctx.fillStyle = bodyColor;
  ctx.fillRect(26, 46, 18, 164);
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 132px "Arial Narrow", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(number || '07', 128, 132);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

const rimFaceTextures = new Map<string, THREE.CanvasTexture>();

// Spoked wheel face painted onto one transparent disc. Four wheels, one draw call
// each instead of five separate spoke meshes.
function rimFaceTexture(rimColor: string, accent: string): THREE.CanvasTexture {
  const key = `${rimColor}|${accent}`;
  const cached = rimFaceTextures.get(key);
  if (cached) return cached;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 256);
  ctx.translate(128, 128);
  ctx.strokeStyle = rimColor;
  ctx.fillStyle = rimColor;
  ctx.lineWidth = 22;
  ctx.beginPath();
  ctx.arc(0, 0, 104, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 15;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    ctx.save();
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -100);
    ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(0, 0, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0d1016';
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  rimFaceTextures.set(key, tex);
  return tex;
}

function taperedBox(width: number, height: number, length: number, taper: number, tipScale: number): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(width, height, length, 2, 1, 4);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    const front = clamp((z / length + 0.5) * 1.4 - 0.2, 0, 1);
    const scale = 1 - front * taper;
    pos.setX(i, pos.getX(i) * scale);
    pos.setY(i, pos.getY(i) * (1 - front * (1 - tipScale)));
    if (z > length * 0.28) pos.setY(i, pos.getY(i) + front * 0.03);
  }
  geo.computeVertexNormals();
  return geo;
}

interface LoftSection {
  z: number;
  cx?: number;
  hw: number;
  y0: number;
  y1: number;
}

// A closed loft: a stack of squircle rings along Z with optional end caps.
// The winding is fixed up from the signed volume so no shell can end up inside-out.
function loftGeometry(sections: LoftSection[], ring = 10, caps = true): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  for (const s of sections) {
    const yc = (s.y0 + s.y1) * 0.5;
    const hh = Math.max(0.004, (s.y1 - s.y0) * 0.5);
    const cx = s.cx ?? 0;
    for (let i = 0; i < ring; i++) {
      const a = (i / ring) * Math.PI * 2;
      const c = Math.cos(a);
      const sn = Math.sin(a);
      const nx = Math.sign(c) * Math.pow(Math.abs(c), 0.7);
      const ny = Math.sign(sn) * Math.pow(Math.abs(sn), 0.7);
      positions.push(cx + nx * s.hw, yc + ny * hh, s.z);
    }
  }
  for (let k = 0; k < sections.length - 1; k++) {
    const a = k * ring;
    const b = (k + 1) * ring;
    for (let i = 0; i < ring; i++) {
      const i1 = (i + 1) % ring;
      indices.push(a + i, a + i1, b + i1, a + i, b + i1, b + i);
    }
  }
  if (caps) {
    const first = 0;
    const last = (sections.length - 1) * ring;
    const firstCenter = positions.length / 3;
    positions.push(sections[0].cx ?? 0, (sections[0].y0 + sections[0].y1) * 0.5, sections[0].z);
    for (let i = 0; i < ring; i++) {
      const i1 = (i + 1) % ring;
      indices.push(firstCenter, first + i1, first + i);
    }
    const lastCenter = positions.length / 3;
    const s = sections[sections.length - 1];
    positions.push(s.cx ?? 0, (s.y0 + s.y1) * 0.5, s.z);
    for (let i = 0; i < ring; i++) {
      const i1 = (i + 1) % ring;
      indices.push(lastCenter, last + i, last + i1);
    }
  }
  return buildSolid(positions, indices);
}

// Extrudes a closed (z, y) profile across the X span. Used for wing elements,
// endplate-style vanes and the flat aero surfaces.
function extrudeProfile(profile: Array<[number, number]>, span: number, tipScale = 1): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const n = profile.length;
  const half = span * 0.5;
  const sides = [
    { x: -half, s: 1 },
    { x: half, s: tipScale },
  ];
  for (const side of sides) {
    for (const [z, y] of profile) {
      positions.push(side.x, y * side.s, z * (side.s < 1 ? 1 : 1));
    }
  }
  for (let i = 0; i < n; i++) {
    const i1 = (i + 1) % n;
    indices.push(i, i1, n + i1, i, n + i1, n + i);
  }
  // Side caps.
  const cz = profile.reduce((acc, p) => acc + p[0], 0) / n;
  const cy = profile.reduce((acc, p) => acc + p[1], 0) / n;
  for (let side = 0; side < 2; side++) {
    const base = side * n;
    const center = positions.length / 3;
    positions.push(side === 0 ? -half : half, cy, cz);
    for (let i = 0; i < n; i++) {
      const i1 = (i + 1) % n;
      if (side === 0) indices.push(center, base + i1, base + i);
      else indices.push(center, base + i, base + i1);
    }
  }
  return buildSolid(positions, indices);
}

function buildSolid(positions: number[], indices: number[]): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  // Signed volume tells us which way the winding faces; flip once if it is inside-out.
  let volume = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3;
    const b = indices[i + 1] * 3;
    const c = indices[i + 2] * 3;
    const ax = positions[a];
    const ay = positions[a + 1];
    const az = positions[a + 2];
    const bx = positions[b];
    const by = positions[b + 1];
    const bz = positions[b + 2];
    const cx = positions[c];
    const cy = positions[c + 1];
    const cz = positions[c + 2];
    volume += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
  }
  if (volume < 0) {
    for (let i = 0; i < indices.length; i += 3) {
      const t = indices[i + 1];
      indices[i + 1] = indices[i + 2];
      indices[i + 2] = t;
    }
    geo.setIndex(indices);
  }
  geo.computeVertexNormals();
  return geo;
}

// A cambered aerofoil cross-section, expressed as a closed (z, y) loop.
function aerofoil(chord: number, thickness: number, camber: number, angle: number, samples = 7): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const place = (cz: number, cy: number): [number, number] => [cz * cosA - cy * sinA, cz * sinA + cy * cosA];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const z = (t - 0.5) * chord;
    const upper = camber * Math.sin(Math.PI * t) + thickness * 0.5 * Math.sin(Math.PI * t);
    pts.push(place(z, upper));
  }
  for (let i = samples; i >= 0; i--) {
    const t = i / samples;
    const z = (t - 0.5) * chord;
    const lower = camber * Math.sin(Math.PI * t) - thickness * 0.5 * Math.sin(Math.PI * t);
    pts.push(place(z, lower));
  }
  return pts;
}

export class KartModel {
  readonly root = new THREE.Group();
  readonly body = new THREE.Group();
  readonly def: KartDef;
  customization: Customization;
  readonly wheelRadius: number;
  readonly exhaustTips: THREE.Object3D[] = [];
  readonly isGhost: boolean;
  private wheels: WheelAssembly[] = [];
  private bodyMat: THREE.MeshStandardMaterial;
  private accentMat: THREE.MeshStandardMaterial;
  private carbonMat: THREE.MeshStandardMaterial;
  private darkMat: THREE.MeshStandardMaterial;
  private metalMat: THREE.MeshStandardMaterial;
  private tireMat: THREE.MeshStandardMaterial;
  private rimMat: THREE.MeshStandardMaterial;
  private helmetSkin: THREE.MeshStandardMaterial | null = null;
  private helmetTexture: THREE.CanvasTexture | null = null;
  private suitSkin: THREE.MeshStandardMaterial | null = null;
  private suitTexture: THREE.CanvasTexture | null = null;
  private glowMat: THREE.MeshBasicMaterial;
  private glowLight: THREE.PointLight | null = null;
  private glowPlane: THREE.Mesh;
  private brakeMat: THREE.MeshStandardMaterial;
  private brakeBars: THREE.Mesh[] = [];
  private flames: THREE.Mesh[] = [];
  private spoilers: Record<string, THREE.Group> = {};
  private exhausts: Record<string, THREE.Group> = {};
  private drsFlaps: Record<string, THREE.Object3D> = {};
  private frontFlaps: THREE.Object3D[] = [];
  private decalMesh!: THREE.Mesh;
  private numberTextures: THREE.CanvasTexture[] = [];
  private numberMeshes: THREE.Mesh[] = [];
  private steeringWheel!: THREE.Group;
  private armPivots: THREE.Group[] = [];
  private allMaterials = new Set<THREE.Material>();
  private allGeometries = new Set<THREE.BufferGeometry>();
  private ghostMaterial: THREE.MeshBasicMaterial | null = null;
  private ghostTrailMaterial: THREE.MeshBasicMaterial | null = null;
  private time = 0;
  private simple: boolean;
  private underglowTexture: THREE.CanvasTexture;
  private headlightMat: THREE.MeshStandardMaterial;
  private driverTorso!: THREE.Group;
  private driverHead!: THREE.Group;
  private suspension = 0;
  private currentSteer = 0;
  private currentSpeed = 0;
  private driverBaseY = 0.86;
  private fade = 1;
  private fadeMaterials: THREE.Material[] = [];

  constructor(def: KartDef, customization: Customization, opts: { ghost?: boolean; simple?: boolean; shadows?: boolean } = {}) {
    this.def = def;
    this.customization = { ...customization };
    this.isGhost = Boolean(opts.ghost);
    this.simple = Boolean(opts.simple);
    this.wheelRadius = def.wheelSize;

    const shadows = opts.shadows ?? true;
    this.bodyMat = this.track(new THREE.MeshStandardMaterial({ color: customization.bodyColor, metalness: 0.62, roughness: 0.26 }));
    this.accentMat = this.track(new THREE.MeshStandardMaterial({ color: def.accentColor, metalness: 0.5, roughness: 0.34 }));
    this.carbonMat = this.track(new THREE.MeshStandardMaterial({ color: 0x1b1f28, metalness: 0.35, roughness: 0.55 }));
    this.darkMat = this.track(new THREE.MeshStandardMaterial({ color: 0x141821, metalness: 0.4, roughness: 0.62 }));
    this.metalMat = this.track(new THREE.MeshStandardMaterial({ color: 0x8b95a8, metalness: 0.92, roughness: 0.24 }));
    this.tireMat = this.track(new THREE.MeshStandardMaterial({ color: customization.wheelColor, roughness: 0.88, metalness: 0.06 }));
    this.rimMat = this.track(new THREE.MeshStandardMaterial({ color: customization.rimColor, metalness: 0.85, roughness: 0.22 }));
    this.glowMat = this.track(
      new THREE.MeshBasicMaterial({
        color: customization.glowColor,
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.brakeMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0x3a0c0c, emissive: 0xff1a1a, emissiveIntensity: 0.7, roughness: 0.4 }),
    );
    this.headlightMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff3d6, emissiveIntensity: 2.4, roughness: 0.2 }),
    );

    this.root.name = `kart-${def.id}`;
    this.root.add(this.body);
    if (this.isGhost) {
      this.ghostMaterial = new THREE.MeshBasicMaterial({
        color: 0x7ef9ff,
        transparent: true,
        opacity: 0.26,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      this.ghostTrailMaterial = new THREE.MeshBasicMaterial({
        color: 0x7ef9ff,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      });
      this.allMaterials.add(this.ghostMaterial);
      this.allMaterials.add(this.ghostTrailMaterial);
    }

    const s = def.chassisScale;
    const build = new THREE.Group();
    build.scale.set(s[0], s[1], s[2]);
    this.body.add(build);

    this.buildChassis(build, shadows);
    this.buildDriver(build);
    this.buildWheels(build, shadows);
    this.buildAero(build);
    this.buildLights(build);
    this.underglowTexture = radialTexture('rgba(255,255,255,0.85)', 'rgba(255,255,255,0.24)');
    this.allMaterials.add(this.glowMat);
    this.glowPlane = new THREE.Mesh(
      this.geo(new THREE.PlaneGeometry(2.5, 3.4)),
      this.track(
        new THREE.MeshBasicMaterial({
          map: this.underglowTexture,
          color: customization.glowColor,
          transparent: true,
          opacity: 0.42,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      ),
    );
    this.glowPlane.rotation.x = -Math.PI / 2;
    this.glowPlane.position.y = 0.02;
    this.root.add(this.glowPlane);

    this.applyCustomization(this.customization);
    this.applyGhostLook();
  }

  private track<T extends THREE.Material>(m: T): T {
    this.allMaterials.add(m);
    return m;
  }

  private geo<T extends THREE.BufferGeometry>(g: T): T {
    this.allGeometries.add(g);
    return g;
  }

  private box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, shadow = true) {
    const mesh = new THREE.Mesh(this.geo(new THREE.BoxGeometry(w, h, d)), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = shadow;
    mesh.receiveShadow = shadow;
    return mesh;
  }

  private loft(sections: LoftSection[], mat: THREE.Material, ring = 10, caps = true) {
    const mesh = new THREE.Mesh(this.geo(loftGeometry(sections, ring, caps)), mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  private blade(profile: Array<[number, number]>, span: number, mat: THREE.Material) {
    const mesh = new THREE.Mesh(this.geo(extrudeProfile(profile, span)), mat);
    mesh.castShadow = true;
    return mesh;
  }

  // The tub, nose, sidepods, engine cover and halo: a single-seater monocoque
  // shape. Everything is built from lofts so the shell reads as one continuous
  // carbon form rather than assembled boxes.
  private buildChassis(parent: THREE.Group, shadows: boolean) {
    // Floor with a raised leading edge and a step under the sidepods.
    const floor = this.loft(
      [
        { z: 1.64, hw: 0.32, y0: 0.1, y1: 0.15 },
        { z: 1.36, hw: 0.5, y0: 0.085, y1: 0.16 },
        { z: 0.72, hw: 0.64, y0: 0.08, y1: 0.165 },
        { z: 0.1, hw: 0.7, y0: 0.08, y1: 0.17 },
        { z: -0.66, hw: 0.68, y0: 0.09, y1: 0.2 },
        { z: -1.24, hw: 0.5, y0: 0.13, y1: 0.24 },
      ],
      this.carbonMat,
      12,
    );
    floor.castShadow = shadows;
    parent.add(floor);

    // Venturi tunnel mouths, visible as dark inlets either side of the nose.
    for (const side of [-1, 1]) {
      const mouth = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.1, 0.14, 0.5, 8, 1, false)), this.darkMat);
      mouth.rotation.x = Math.PI / 2;
      mouth.rotation.z = 0.1 * side;
      mouth.scale.set(1.5, 1, 1);
      mouth.position.set(side * 0.42, 0.15, 0.86);
      parent.add(mouth);
      const fence = new THREE.Mesh(this.geo(new THREE.BoxGeometry(0.02, 0.12, 0.72)), this.carbonMat);
      fence.position.set(side * 0.62, 0.15, 0.5);
      fence.castShadow = shadows;
      parent.add(fence);
    }

    // Nose cone: a narrow tapered loft that drops as it reaches the front wing.
    const nose = this.loft(
      [
        { z: 2.16, hw: 0.09, y0: 0.24, y1: 0.32 },
        { z: 1.8, hw: 0.14, y0: 0.24, y1: 0.37 },
        { z: 1.3, hw: 0.2, y0: 0.25, y1: 0.43 },
        { z: 0.86, hw: 0.24, y0: 0.26, y1: 0.47 },
        { z: 0.5, hw: 0.3, y0: 0.27, y1: 0.5 },
      ],
      this.bodyMat,
      10,
    );
    nose.castShadow = shadows;
    parent.add(nose);

    // Tub: open-topped cockpit surround with raised side walls.
    const tub = this.loft(
      [
        { z: 0.62, hw: 0.3, y0: 0.24, y1: 0.52 },
        { z: 0.34, hw: 0.36, y0: 0.22, y1: 0.66 },
        { z: 0.02, hw: 0.38, y0: 0.22, y1: 0.72 },
        { z: -0.34, hw: 0.36, y0: 0.22, y1: 0.75 },
        { z: -0.6, hw: 0.3, y0: 0.23, y1: 0.76 },
      ],
      this.bodyMat,
      10,
    );
    tub.castShadow = shadows;
    parent.add(tub);

    // Cut the cockpit back out: a dark insert reads as an open tub at this scale.
    const well = this.loft(
      [
        { z: 0.4, hw: 0.25, y0: 0.36, y1: 0.6 },
        { z: 0.08, hw: 0.27, y0: 0.34, y1: 0.72 },
        { z: -0.28, hw: 0.26, y0: 0.34, y1: 0.74 },
        { z: -0.52, hw: 0.2, y0: 0.36, y1: 0.7 },
      ],
      this.darkMat,
      10,
    );
    parent.add(well);

    // Bulkhead behind the driver and the seat shell.
    this.box(0.56, 0.36, 0.07, this.carbonMat, 0, 0.6, -0.62);
    const seat = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.24, 0.28, 0.09, 14, 1, false, 0, Math.PI)), this.darkMat);
    seat.rotation.set(Math.PI / 2, 0, 0);
    seat.position.set(0, 0.38, -0.24);
    seat.scale.set(1, 1, 0.7);
    parent.add(seat);
    const seatBack = new THREE.Mesh(this.geo(new THREE.BoxGeometry(0.42, 0.46, 0.06)), this.darkMat);
    seatBack.position.set(0, 0.52, -0.48);
    seatBack.rotation.x = 0.24;
    parent.add(seatBack);
    for (const side of [-1, 1]) {
      const bolster = new THREE.Mesh(this.geo(new THREE.SphereGeometry(0.1, 12, 10)), this.darkMat);
      bolster.scale.set(0.7, 1.5, 0.9);
      bolster.position.set(side * 0.2, 0.5, -0.34);
      parent.add(bolster);
    }

    // Front bulkhead face and driver leg padding.
    this.box(0.5, 0.28, 0.05, this.carbonMat, 0, 0.46, 0.36);
    this.box(0.44, 0.1, 0.34, this.darkMat, 0, 0.32, 0.16);

    // Steering column, wheel and a quick-release boss.
    const column = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.022, 0.026, 0.5, 10)), this.metalMat);
    column.rotation.x = 0.9;
    column.position.set(0, 0.66, 0.24);
    parent.add(column);
    this.steeringWheel = new THREE.Group();
    this.steeringWheel.position.set(0, 0.82, 0.06);
    this.steeringWheel.rotation.x = -0.55;
    const rim = new THREE.Mesh(this.geo(new THREE.TorusGeometry(0.135, 0.019, 8, 22)), this.darkMat);
    this.steeringWheel.add(rim);
    const screen = new THREE.Mesh(this.geo(new THREE.BoxGeometry(0.16, 0.09, 0.012)), this.carbonMat);
    screen.position.set(0, 0.012, -0.02);
    this.steeringWheel.add(screen);
    for (const side of [-1, 1]) {
      const grip = new THREE.Mesh(this.geo(new THREE.CapsuleGeometry(0.022, 0.06, 3, 8)), this.carbonMat);
      grip.rotation.z = side * 0.2;
      grip.position.set(side * 0.13, 0, 0);
      this.steeringWheel.add(grip);
    }
    const hub = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.028, 0.028, 0.03, 12)), this.metalMat);
    hub.rotation.x = Math.PI / 2;
    this.steeringWheel.add(hub);
    parent.add(this.steeringWheel);

    // Cockpit padding, mirrors and the halo are added by buildAero.
    for (const side of [-1, 1]) {
      const pad = new THREE.Mesh(this.geo(new THREE.CapsuleGeometry(0.035, 0.42, 3, 8)), this.darkMat);
      pad.rotation.x = Math.PI / 2;
      pad.position.set(side * 0.36, 0.66, -0.1);
      parent.add(pad);
      // Mirror pod on a short stalk off the cockpit.
      const stalk = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.012, 0.014, 0.12, 8)), this.carbonMat);
      stalk.rotation.z = side * 1.1;
      stalk.position.set(side * 0.33, 0.73, 0.19);
      parent.add(stalk);
      const pod = new THREE.Mesh(this.geo(new THREE.BoxGeometry(0.075, 0.05, 0.04)), this.bodyMat);
      pod.position.set(side * 0.39, 0.76, 0.19);
      parent.add(pod);
      const glass = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(0.06, 0.04)), this.headlightMat);
      glass.position.set(side * 0.39, 0.76, 0.168);
      glass.rotation.y = Math.PI;
      glass.material = this.track(new THREE.MeshStandardMaterial({ color: 0xaecbe8, metalness: 1, roughness: 0.08 }));
      parent.add(glass);

      // Sidepod: a coke-bottle loft with an undercut toward the rear.
      const sidepod = this.loft(
        [
          { z: 0.52, cx: side * 0.42, hw: 0.1, y0: 0.2, y1: 0.42 },
          { z: 0.26, cx: side * 0.5, hw: 0.2, y0: 0.16, y1: 0.52 },
          { z: -0.12, cx: side * 0.52, hw: 0.23, y0: 0.15, y1: 0.55 },
          { z: -0.5, cx: side * 0.48, hw: 0.19, y0: 0.16, y1: 0.49 },
          { z: -0.82, cx: side * 0.38, hw: 0.12, y0: 0.18, y1: 0.42 },
          { z: -1.04, cx: side * 0.3, hw: 0.06, y0: 0.2, y1: 0.38 },
        ],
        this.bodyMat,
        10,
      );
      sidepod.castShadow = shadows;
      parent.add(sidepod);

      // Inlet lip at the pod mouth.
      const inlet = new THREE.Mesh(this.geo(new THREE.BoxGeometry(0.16, 0.2, 0.04)), this.darkMat);
      inlet.position.set(side * 0.44, 0.33, 0.53);
      inlet.rotation.y = side * 0.06;
      parent.add(inlet);
      const lip = new THREE.Mesh(this.geo(new THREE.BoxGeometry(0.17, 0.022, 0.05)), this.accentMat);
      lip.position.set(side * 0.44, 0.43, 0.53);
      parent.add(lip);

      // Cooling louvres along the pod shoulder.
      for (let i = 0; i < 4; i++) {
        const louvre = new THREE.Mesh(this.geo(new THREE.BoxGeometry(0.1, 0.012, 0.05)), this.darkMat);
        louvre.position.set(side * 0.5, 0.56 - i * 0.004, -0.16 - i * 0.1);
        louvre.rotation.z = side * 0.28;
        parent.add(louvre);
      }

      // Floor edge wing and its turning vane.
      const edge = new THREE.Mesh(this.geo(new THREE.BoxGeometry(0.05, 0.016, 0.62)), this.carbonMat);
      edge.position.set(side * 0.7, 0.14, -0.16);
      edge.rotation.z = side * 0.16;
      parent.add(edge);
    }

    // Engine cover and spine.
    const cover = this.loft(
      [
        { z: -0.5, hw: 0.3, y0: 0.24, y1: 0.62 },
        { z: -0.86, hw: 0.35, y0: 0.24, y1: 0.72 },
        { z: -1.2, hw: 0.28, y0: 0.24, y1: 0.64 },
        { z: -1.46, hw: 0.18, y0: 0.26, y1: 0.5 },
      ],
      this.bodyMat,
      10,
    );
    cover.castShadow = shadows;
    parent.add(cover);

    // Shark fin running into the rear wing.
    const fin = this.blade(
      [
        [-0.6, 0.68],
        [-1.38, 0.62],
        [-1.4, 0.86],
        [-0.64, 0.84],
      ],
      0.022,
      this.bodyMat,
    );
    fin.castShadow = shadows;
    parent.add(fin);
    const finTip = this.blade(
      [
        [-1.16, 0.72],
        [-1.39, 0.66],
        [-1.4, 0.86],
        [-1.18, 0.85],
      ],
      0.026,
      this.accentMat,
    );
    parent.add(finTip);

    // Airbox above and behind the driver's head.
    const box = this.loft(
      [
        { z: -0.58, hw: 0.11, y0: 0.86, y1: 1.02 },
        { z: -0.72, hw: 0.13, y0: 0.84, y1: 1.06 },
        { z: -0.9, hw: 0.1, y0: 0.84, y1: 0.98 },
      ],
      this.bodyMat,
      8,
    );
    parent.add(box);
    const intake = new THREE.Mesh(this.geo(new THREE.BoxGeometry(0.15, 0.11, 0.03)), this.darkMat);
    intake.position.set(0, 0.95, -0.565);
    parent.add(intake);

    // Roll hoop: a real hoop behind the helmet, not a painted hazard.
    const hoop = new THREE.Mesh(this.geo(new THREE.TorusGeometry(0.15, 0.028, 8, 16, Math.PI)), this.carbonMat);
    hoop.position.set(0, 0.86, -0.52);
    hoop.rotation.set(0, 0, 0);
    hoop.castShadow = shadows;
    parent.add(hoop);

    // Rear crash structure and gearbox casing.
    const crash = this.loft(
      [
        { z: -1.16, hw: 0.16, y0: 0.3, y1: 0.44 },
        { z: -1.44, hw: 0.13, y0: 0.3, y1: 0.42 },
        { z: -1.6, hw: 0.08, y0: 0.31, y1: 0.4 },
      ],
      this.carbonMat,
      8,
    );
    parent.add(crash);
    this.box(0.34, 0.26, 0.4, this.metalMat, 0, 0.34, -1.02);
  }

  // Front wing, halo, rear wing, diffuser and the suspension arms.
  private buildAero(parent: THREE.Group) {
    // --- Front wing: three cambered elements with rising angle of attack.
    const fw = new THREE.Group();
    fw.position.set(0, 0.15, 2.06);
    const elements: Array<[number, number, number, number, number]> = [
      [0.42, 0.032, 0.05, 1.98, -0.02],
      [0.36, 0.03, 0.055, 1.9, 0.03],
      [0.3, 0.026, 0.055, 1.82, 0.1],
    ];
    elements.forEach(([chord, thickness, camber, span, height], i) => {
      const blade = this.blade(aerofoil(chord, thickness, camber, 0.16 + i * 0.06), span, i === 0 ? this.carbonMat : this.bodyMat);
      blade.position.set(0, height, -i * 0.1);
      fw.add(blade);
      if (i > 0) this.frontFlaps.push(blade);
    });
    for (const side of [-1, 1]) {
      const plate = this.blade(
        [
          [0.3, -0.03],
          [-0.36, 0.01],
          [-0.38, 0.14],
          [0.26, 0.19],
        ],
        0.018,
        this.carbonMat,
      );
      plate.position.set(side * 0.98, 0.12, -0.02);
      fw.add(plate);
      const stripe = new THREE.Mesh(this.geo(new THREE.BoxGeometry(0.006, 0.022, 0.56)), this.accentMat);
      stripe.position.set(side * 0.989, 0.29, -0.05);
      fw.add(stripe);
      const footplate = this.blade(
        [
          [0.34, 0],
          [-0.2, 0],
          [-0.2, 0.06],
          [0.34, 0.03],
        ],
        0.06,
        this.carbonMat,
      );
      footplate.position.set(side * 1.01, -0.03, 0);
      fw.add(footplate);
      // DRL strip on the endplate.
      const drl = new THREE.Mesh(this.geo(new THREE.BoxGeometry(0.008, 0.018, 0.42)), this.headlightMat);
      drl.position.set(side * 1.005, 0.23, 0.02);
      fw.add(drl);
    }
    // Nose pylons holding the wing to the tub.
    for (const side of [-1, 1]) {
      const pylon = this.blade(
        [
          [0.28, 0.2],
          [-0.02, 0.2],
          [-0.02, 0.06],
          [0.24, 0.06],
        ],
        0.026,
        this.carbonMat,
      );
      pylon.position.set(side * 0.16, 0.14, -0.16);
      fw.add(pylon);
    }
    parent.add(fw);

    // --- Halo: hoop plus centre pillar.
    const haloMat = this.carbonMat;
    const hoop = new THREE.Mesh(this.geo(new THREE.TorusGeometry(0.42, 0.028, 8, 26, Math.PI)), haloMat);
    hoop.rotation.set(-Math.PI / 2, 0, 0);
    hoop.position.set(0, 0.84, -0.02);
    hoop.scale.set(1, 0.86, 1);
    hoop.castShadow = true;
    parent.add(hoop);
    const pillar = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.024, 0.032, 0.4, 10)), haloMat);
    pillar.rotation.x = 0.32;
    pillar.position.set(0, 0.9, 0.36);
    parent.add(pillar);
    for (const side of [-1, 1]) {
      const foot = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.03, 0.034, 0.12, 8)), haloMat);
      foot.position.set(side * 0.4, 0.8, -0.02);
      parent.add(foot);
    }

    // --- Rear wing on swan-neck pylons.
    const makeSpoiler = (id: string, height: number, width: number, chordScale: number) => {
      const g = new THREE.Group();
      g.position.set(0, 0, 0);
      for (const side of [-1, 1]) {
        const neck = new THREE.Mesh(this.geo(new THREE.BoxGeometry(0.045, height + 0.2, 0.05)), this.carbonMat);
        neck.position.set(side * width * 0.24, 0.58 + (height + 0.2) * 0.5, -1.5);
        neck.rotation.x = -0.12;
        g.add(neck);
      }
      const main = this.blade(aerofoil(0.34 * chordScale, 0.03, 0.05, 0.2), width, this.bodyMat);
      main.position.set(0, height + 0.78, -1.58);
      g.add(main);
      const flap = this.blade(aerofoil(0.2 * chordScale, 0.024, 0.05, 0.42), width * 0.96, this.carbonMat);
      flap.position.set(0, height + 0.86, -1.72);
      g.add(flap);
      this.drsFlaps[id] = flap;
      for (const side of [-1, 1]) {
        const endplate = this.blade(
          [
            [0.18, 0],
            [-0.2, 0],
            [-0.2, 0.28],
            [0.12, 0.3],
          ],
          0.016,
          this.carbonMat,
        );
        endplate.position.set(side * width * 0.49, height + 0.72, -1.6);
        g.add(endplate);
        const trim = new THREE.Mesh(this.geo(new THREE.BoxGeometry(0.006, 0.02, 0.34)), this.accentMat);
        trim.position.set(side * width * 0.499, height + 1.0, -1.62);
        g.add(trim);
        const beam = this.blade(aerofoil(0.16 * chordScale, 0.026, 0.02, 0.1), width * 0.8, this.carbonMat);
        beam.position.set(0, height + 0.56, -1.44);
        g.add(beam);
      }
      g.visible = false;
      parent.add(g);
      return g;
    };
    this.spoilers.low = makeSpoiler('low', 0.02, 1.1, 0.9);
    this.spoilers.mid = makeSpoiler('mid', 0.1, 1.18, 1);
    this.spoilers.high = makeSpoiler('high', 0.18, 1.24, 1.1);
    this.spoilers.wing = makeSpoiler('wing', 0.24, 1.32, 1.2);

    // --- Diffuser: a rising ramp with strakes and the beam wing.
    const ramp = this.blade(
      [
        [0.34, 0.08],
        [-0.42, 0.34],
        [-0.42, 0.14],
        [0.34, 0.02],
      ],
      1.1,
      this.carbonMat,
    );
    ramp.position.set(0, 0, -1.24);
    ramp.castShadow = true;
    parent.add(ramp);
    for (let i = -2; i <= 2; i++) {
      const strake = this.blade(
        [
          [0.36, 0.03],
          [-0.4, 0.32],
          [-0.4, 0.2],
          [0.36, 0.05],
        ],
        0.018,
        this.darkMat,
      );
      strake.position.set(i * 0.22, 0.04, -1.24);
      parent.add(strake);
    }

    // --- Suspension: exposed wishbones, pushrods and track rods.
    this.buildSuspension(parent);

    // --- Exhausts sit under the rear wing, in the diffuser wake.
    const makeExhaust = (id: string, count: number, radius: number, length: number, offset: number) => {
      const g = new THREE.Group();
      const tips: THREE.Object3D[] = [];
      for (let i = 0; i < count; i++) {
        const x = count === 1 ? 0 : (i - (count - 1) / 2) * offset;
        const pipe = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(radius, radius * 1.12, length, 10, 1, true)), this.metalMat);
        pipe.rotation.x = Math.PI / 2;
        pipe.position.set(x, 0.44, -1.32 - length / 2);
        g.add(pipe);
        const tip = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(radius * 1.16, radius * 1.16, 0.07, 10, 1, true)), this.darkMat);
        tip.rotation.x = Math.PI / 2;
        tip.position.set(x, 0.44, -1.32 - length);
        g.add(tip);
        const flame = new THREE.Mesh(
          this.geo(new THREE.ConeGeometry(radius * 1.4, 0.62, 8, 1, true)),
          this.track(new THREE.MeshBasicMaterial({ color: 0x62e8ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })),
        );
        flame.rotation.x = Math.PI / 2;
        flame.position.set(x, 0.44, -1.34 - length - 0.31);
        flame.visible = false;
        g.add(flame);
        this.flames.push(flame);
        const anchor = new THREE.Object3D();
        anchor.position.set(x, 0.44, -1.36 - length);
        g.add(anchor);
        tips.push(anchor);
      }
      g.visible = false;
      parent.add(g);
      return { group: g, tips };
    };
    const single = makeExhaust('single', 1, 0.075, 0.36, 0.2);
    this.exhausts.single = single.group;
    this.exhaustTips.push(...single.tips);
    const dual = makeExhaust('dual', 2, 0.062, 0.34, 0.22);
    this.exhausts.dual = dual.group;
    this.exhaustTips.push(...dual.tips);
    const jet = makeExhaust('jet', 2, 0.098, 0.3, 0.28);
    this.exhausts.jet = jet.group;
    this.exhaustTips.push(...jet.tips);

    // --- Number plates: nose spine, rear panel and both sidepod flanks.
    const plate = (w: number, h: number) => {
      const mesh = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(w, h)), new THREE.MeshBasicMaterial({ transparent: true }));
      this.numberMeshes.push(mesh);
      parent.add(mesh);
      return mesh;
    };
    // Raked onto the nose spine so it follows the bodywork rather than
    // standing off it like a floating card.
    const frontPlate = plate(0.3, 0.19);
    frontPlate.position.set(0, 0.428, 1.56);
    frontPlate.rotation.x = -Math.PI / 2 + 0.3;
    const rearPlate = plate(0.24, 0.15);
    rearPlate.position.set(0, 0.4, -1.475);
    rearPlate.rotation.y = Math.PI;
    for (const side of [-1, 1]) {
      const flank = plate(0.3, 0.19);
      flank.position.set(side * 0.757, 0.35, -0.18);
      flank.rotation.y = side * (Math.PI / 2);
    }

    // Decal lies on the engine cover spine where it stays visible over the halo.
    const decalMat = this.track(new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }));
    this.decalMesh = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(0.62, 0.72)), decalMat);
    this.decalMesh.rotation.x = -Math.PI / 2 + 0.24;
    this.decalMesh.position.set(0, 0.71, -0.92);
    parent.add(this.decalMesh);
  }

  private buildSuspension(parent: THREE.Group) {
    const r = this.def.wheelSize * 0.7;
    const stations: Array<{ z: number; sx: number; upper: number; lower: number }> = [
      { z: 1.02, sx: 0.28, upper: 0.5, lower: 0.26 },
      { z: -0.98, sx: 0.26, upper: 0.54, lower: 0.28 },
    ];
    for (const station of stations) {
      for (const side of [-1, 1]) {
        const hub = new THREE.Vector3(side * 0.76, r, station.z);
        const upperIn = new THREE.Vector3(side * station.sx, station.upper, station.z - 0.16);
        const upperOut = new THREE.Vector3(side * 0.72, station.upper - 0.02, station.z + 0.1);
        const lowerIn = new THREE.Vector3(side * station.sx, station.lower, station.z - 0.2);
        const lowerOut = new THREE.Vector3(side * 0.74, station.lower - 0.02, station.z + 0.14);
        for (const [from, to] of [
          [upperIn, upperOut],
          [lowerIn, lowerOut],
        ] as Array<[THREE.Vector3, THREE.Vector3]>) {
          parent.add(this.limb(from, to, 0.017, this.carbonMat, 1));
        }
        // Upright casting and the wheel bearing.
        const upright = new THREE.Mesh(this.geo(new THREE.BoxGeometry(0.05, 0.16, 0.09)), this.metalMat);
        upright.position.copy(hub).add(new THREE.Vector3(side * 0.02, 0, 0));
        parent.add(upright);
        // Pushrod up into the tub.
        parent.add(this.limb(hub.clone().add(new THREE.Vector3(0, 0.03, 0)), new THREE.Vector3(side * 0.24, 0.62, station.z - 0.06), 0.013, this.metalMat));
        // Track rod.
        parent.add(this.limb(hub.clone().add(new THREE.Vector3(0, -0.02, 0)), new THREE.Vector3(side * 0.3, 0.3, station.z + 0.26), 0.012, this.carbonMat));
      }
    }
  }

  private buildDriver(parent: THREE.Group) {
    const accent = new THREE.Color(this.def.accentColor);
    const body = new THREE.Color(this.customization.bodyColor);
    const trimColor = accent.clone();
    const lum = trimColor.r * 0.299 + trimColor.g * 0.587 + trimColor.b * 0.114;
    if (lum > 0.72) trimColor.multiplyScalar(0.72 / lum);
    const suitMat = this.track(new THREE.MeshStandardMaterial({ color: body, roughness: 0.66, metalness: 0.08 }));
    const suitPanel = this.track(
      new THREE.MeshStandardMaterial({ color: body.clone().multiplyScalar(0.34).lerp(new THREE.Color(0x171b24), 0.62), roughness: 0.82, metalness: 0.06 }),
    );
    const bootMat = this.track(new THREE.MeshStandardMaterial({ color: 0x10131a, roughness: 0.55, metalness: 0.25 }));
    const gloveMat = this.track(new THREE.MeshStandardMaterial({ color: 0x171b24, roughness: 0.62, metalness: 0.1 }));
    const neckMat = this.track(new THREE.MeshStandardMaterial({ color: 0xa87b58, roughness: 0.74, metalness: 0.02 }));

    this.driverTorso = new THREE.Group();
    // Reclined single-seater posture: the driver lies back in the tub, so the
    // whole body is pitched rearward rather than sitting upright.
    this.driverTorso.position.set(0, 0.46, -0.28);
    this.driverBaseY = this.driverTorso.position.y;
    this.driverTorso.rotation.x = -0.34;
    this.driverTorso.scale.setScalar(0.98);

    const pelvis = new THREE.Mesh(this.geo(new THREE.SphereGeometry(0.15, 18, 14)), suitMat);
    pelvis.position.set(0, 0.03, 0);
    pelvis.scale.set(1.05, 0.82, 0.95);
    pelvis.castShadow = true;
    this.driverTorso.add(pelvis);

    // Lathed torso: narrow waist opening into a broad chest.
    const profile: THREE.Vector2[] = [
      new THREE.Vector2(0.001, 0),
      new THREE.Vector2(0.118, 0.015),
      new THREE.Vector2(0.132, 0.07),
      new THREE.Vector2(0.148, 0.15),
      new THREE.Vector2(0.172, 0.24),
      new THREE.Vector2(0.188, 0.31),
      new THREE.Vector2(0.182, 0.365),
      new THREE.Vector2(0.14, 0.405),
      new THREE.Vector2(0.07, 0.425),
      new THREE.Vector2(0.001, 0.43),
    ];
    const torsoGeo = this.geo(new THREE.LatheGeometry(profile, 22));
    torsoGeo.scale(1, 1, 0.8);
    this.suitTexture = suitTexture(`#${body.getHexString()}`, `#${trimColor.getHexString()}`);
    this.suitSkin = this.track(
      new THREE.MeshStandardMaterial({ map: this.suitTexture, roughness: 0.66, metalness: 0.08 }),
    );
    const torso = new THREE.Mesh(torsoGeo, this.suitSkin);
    torso.position.set(0, 0.05, 0);
    torso.castShadow = true;
    this.driverTorso.add(torso);

    for (const side of [-1, 1]) {
      const cap = new THREE.Mesh(this.geo(new THREE.SphereGeometry(0.066, 18, 14)), this.suitSkin);
      cap.position.set(side * 0.142, 0.334, 0.004);
      cap.scale.set(1.1, 0.92, 0.92);
      cap.castShadow = true;
      this.driverTorso.add(cap);
    }

    const neck = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.045, 0.056, 0.09, 14)), neckMat);
    neck.position.set(0, 0.435, 0.008);
    this.driverTorso.add(neck);

    this.driverHead = new THREE.Group();
    this.driverHead.position.set(0, 0.535, 0.012);
    this.driverTorso.add(this.driverHead);

    this.helmetTexture = helmetTexture(
      `#${this.customization.helmetColor.replace('#', '')}`,
      `#${trimColor.getHexString()}`,
      '#0a1220',
    );
    this.helmetSkin = this.track(
      new THREE.MeshStandardMaterial({ map: this.helmetTexture, metalness: 0.42, roughness: 0.24 }),
    );
    const shell = new THREE.Mesh(this.geo(new THREE.SphereGeometry(0.108, 32, 24)), this.helmetSkin);
    shell.scale.set(1, 1.12, 1.06);
    shell.castShadow = true;
    this.driverHead.add(shell);

    const spoiler = new THREE.Mesh(this.geo(new THREE.BoxGeometry(0.092, 0.011, 0.036)), this.helmetSkin);
    spoiler.position.set(0, 0.058, -0.106);
    spoiler.rotation.x = -0.44;
    spoiler.castShadow = true;
    this.driverHead.add(spoiler);

    const collar = new THREE.Mesh(this.geo(new THREE.TorusGeometry(0.056, 0.016, 8, 18)), this.darkMat);
    collar.position.set(0, -0.045, -0.058);
    collar.rotation.x = Math.PI / 2 - 0.28;
    this.driverTorso.add(collar);

    // Arms reach forward to the wheel; in a reclined tub the elbows stay low.
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Vector3(side * 0.155, 0.335, 0.01);
      const elbow = new THREE.Vector3(side * 0.205, 0.16, 0.2);
      const grip = new THREE.Vector3(side * 0.118, 0.29, 0.4);
      const pivot = new THREE.Group();
      pivot.position.copy(shoulder);
      pivot.add(this.limb(new THREE.Vector3(0, 0, 0), elbow.clone().sub(shoulder), 0.048, suitMat));
      const joint = new THREE.Mesh(this.geo(new THREE.SphereGeometry(0.047, 14, 10)), suitPanel);
      joint.position.copy(elbow.clone().sub(shoulder));
      pivot.add(joint);
      pivot.add(this.limb(elbow.clone().sub(shoulder), grip.clone().sub(shoulder), 0.04, suitMat, 0.92));
      const cuff = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.043, 0.04, 0.034, 14)), suitPanel);
      const cuffDir = grip.clone().sub(elbow).normalize();
      cuff.position.copy(grip.clone().sub(shoulder)).addScaledVector(cuffDir, -0.022);
      cuff.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), cuffDir);
      pivot.add(cuff);
      const glove = new THREE.Mesh(this.geo(new THREE.SphereGeometry(0.045, 14, 10)), gloveMat);
      glove.position.copy(grip.clone().sub(shoulder));
      glove.scale.set(1, 0.88, 1.15);
      glove.castShadow = true;
      pivot.add(glove);
      this.driverTorso.add(pivot);
      this.armPivots.push(pivot);
    }

    // Legs run forward and down into the pedal box; knees are slightly bent.
    for (const side of [-1, 1]) {
      const hip = new THREE.Vector3(side * 0.082, 0, 0.02);
      const knee = new THREE.Vector3(side * 0.1, -0.02, 0.4);
      const ankle = new THREE.Vector3(side * 0.105, -0.13, 0.76);
      this.driverTorso.add(this.limb(hip, knee, 0.071, suitMat));
      const kneeCap = new THREE.Mesh(this.geo(new THREE.SphereGeometry(0.059, 12, 10)), suitPanel);
      kneeCap.position.copy(knee);
      this.driverTorso.add(kneeCap);
      this.driverTorso.add(this.limb(knee, ankle, 0.056, suitMat, 1.12));
      const boot = new THREE.Mesh(this.geo(taperedBox(0.09, 0.074, 0.19, 0.12, 0.88)), bootMat);
      boot.position.set(side * 0.107, -0.15, 0.85);
      boot.rotation.x = -0.1;
      boot.castShadow = true;
      this.driverTorso.add(boot);
    }

    parent.add(this.driverTorso);
  }

  private limb(from: THREE.Vector3, to: THREE.Vector3, radius: number, mat: THREE.Material, taper = 1) {
    const dir = to.clone().sub(from);
    const len = Math.max(0.001, dir.length());
    const mesh = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(radius * taper, radius, len, 12)), mat);
    mesh.position.copy(from).addScaledVector(dir, 0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    mesh.castShadow = true;
    return mesh;
  }

  private rimFaceMats: THREE.MeshBasicMaterial[] = [];

  // One shared spoked-face material per wheel so a rim-colour change updates
  // all four faces without rebuilding geometry.
  private rimFaceMat(): THREE.MeshBasicMaterial {
    const mat = this.track(
      new THREE.MeshBasicMaterial({
        map: rimFaceTexture(this.customization.rimColor, this.def.accentColor),
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    mat.userData.rimFace = true;
    this.rimFaceMats.push(mat);
    return mat;
  }

  private buildWheels(parent: THREE.Group, shadows: boolean) {
    // Open-wheel proportions: a wide, low rear tyre and a narrower front one.
    const positions: Array<{ x: number; z: number; front: boolean }> = [
      { x: -0.78, z: 1.12, front: true },
      { x: 0.78, z: 1.12, front: true },
      { x: -0.8, z: -1.06, front: false },
      { x: 0.8, z: -1.06, front: false },
    ];
    for (const spot of positions) {
      const r = this.def.wheelSize * (spot.front ? 0.58 : 0.64);
      const w = this.def.wheelWidth * (spot.front ? 0.72 : 1.02);
      const pivot = new THREE.Group();
      pivot.position.set(spot.x, r, spot.z);
      const spin = new THREE.Group();

      const tire = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(r, r, w, 22)), this.tireMat);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = shadows;
      tire.receiveShadow = shadows;
      spin.add(tire);

      // Rounded shoulders instead of a hard cylinder edge.
      for (const dir of [-1, 1]) {
        const shoulder = new THREE.Mesh(this.geo(new THREE.TorusGeometry(r * 0.985, w * 0.11, 6, 22)), this.tireMat);
        shoulder.rotation.y = Math.PI / 2;
        shoulder.position.x = dir * w * 0.5;
        spin.add(shoulder);
      }

      // Rim barrel, and the spoked face on the outboard side.
      const barrel = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(r * 0.6, r * 0.6, w * 0.94, 16)), this.rimMat);
      barrel.rotation.z = Math.PI / 2;
      spin.add(barrel);
      const face = new THREE.Mesh(
        this.geo(new THREE.CircleGeometry(r * 0.62, 24)),
        this.rimFaceMat(),
      );
      face.rotation.y = spot.x > 0 ? Math.PI / 2 : -Math.PI / 2;
      face.position.x = spot.x > 0 ? w * 0.502 : -w * 0.502;
      spin.add(face);

      // Brake disc and caliper, visible through the spokes.
      const disc = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(r * 0.42, r * 0.42, 0.024, 16)), this.metalMat);
      disc.rotation.z = Math.PI / 2;
      disc.position.x = spot.x > 0 ? -w * 0.24 : w * 0.24;
      spin.add(disc);
      const caliper = new THREE.Mesh(this.geo(new THREE.BoxGeometry(0.045, 0.1, 0.15)), this.accentMat);
      caliper.position.set(spot.x > 0 ? -w * 0.24 : w * 0.24, r * 0.34, -0.04);
      spin.add(caliper);

      pivot.add(spin);
      parent.add(pivot);
      this.wheels.push({ pivot, spin, front: spot.front, baseY: r });
    }
  }

  private buildLights(parent: THREE.Group) {
    // Front wing endplate DRLs are added with the wing. Nose lamp sits low centre.
    const noseLamp = new THREE.Mesh(this.geo(new THREE.BoxGeometry(0.14, 0.03, 0.02)), this.headlightMat);
    noseLamp.position.set(0, 0.35, 2.16);
    parent.add(noseLamp);

    // Rear rain light on the crash structure, plus one on each endplate.
    const rain = new THREE.Mesh(this.geo(new THREE.BoxGeometry(0.1, 0.08, 0.03)), this.brakeMat);
    rain.position.set(0, 0.44, -1.6);
    parent.add(rain);
    this.brakeBars.push(rain);
    for (const side of [-1, 1]) {
      const bar = new THREE.Mesh(this.geo(new THREE.BoxGeometry(0.02, 0.09, 0.05)), this.brakeMat);
      bar.position.set(side * 0.64, 0.26, -1.56);
      parent.add(bar);
      this.brakeBars.push(bar);
    }

    if (!this.simple) {
      this.glowLight = new THREE.PointLight(this.customization.glowColor, 1.4, 3.2, 2);
      this.glowLight.position.set(0, 0.3, 0);
      this.root.add(this.glowLight);
    }
  }

  applyCustomization(cust: Customization) {
    this.customization = { ...cust };
    this.bodyMat.color.set(cust.bodyColor);
    this.accentMat.color.set(this.def.accentColor);
    this.tireMat.color.set(cust.wheelColor);
    this.rimMat.color.set(cust.rimColor);
    this.glowMat.color.set(cust.glowColor);
    (this.glowPlane.material as THREE.MeshBasicMaterial).color.set(cust.glowColor);
    if (this.glowLight) this.glowLight.color.set(cust.glowColor);

    // Helmet and suit carry the team colours, so repaint them too.
    if (this.helmetTexture) this.helmetTexture.dispose();
    const trim = new THREE.Color(this.def.accentColor);
    const lum = trim.r * 0.299 + trim.g * 0.587 + trim.b * 0.114;
    if (lum > 0.72) trim.multiplyScalar(0.72 / lum);
    this.helmetTexture = helmetTexture(`#${cust.helmetColor.replace('#', '')}`, `#${trim.getHexString()}`, '#0a1220');
    if (this.helmetSkin) {
      this.helmetSkin.map = this.helmetTexture;
      this.helmetSkin.needsUpdate = true;
    }
    if (this.suitTexture) this.suitTexture.dispose();
    this.suitTexture = suitTexture(`#${cust.bodyColor.replace('#', '')}`, `#${trim.getHexString()}`);
    if (this.suitSkin) {
      this.suitSkin.map = this.suitTexture;
      this.suitSkin.needsUpdate = true;
    }

    // Number plates.
    for (const t of this.numberTextures) t.dispose();
    this.numberTextures = [];
    for (const mesh of this.numberMeshes) {
      const tex = numberTexture(cust.number, this.def.bodyColor, this.def.accentColor);
      this.numberTextures.push(tex);
      (mesh.material as THREE.MeshBasicMaterial).map = tex;
      (mesh.material as THREE.MeshBasicMaterial).needsUpdate = true;
    }

    // Wheel faces are baked textures, so refresh the maps with the new rim colour.
    const faceMap = rimFaceTexture(cust.rimColor, this.def.accentColor);
    for (const mat of this.rimFaceMats) {
      mat.map = faceMap;
      mat.needsUpdate = true;
    }

    // Decal.
    const decal = getDecalTexture(cust.decal);
    const decalMat = this.decalMesh.material as THREE.MeshBasicMaterial;
    decalMat.map = decal;
    decalMat.color.set(cust.decal === 'none' ? 0xffffff : this.def.accentColor);
    decalMat.needsUpdate = true;
    this.decalMesh.visible = cust.decal !== 'none';

    for (const [id, group] of Object.entries(this.spoilers)) group.visible = id === cust.spoiler;
    for (const [id, group] of Object.entries(this.exhausts)) group.visible = id === cust.exhaust;

    for (const flame of this.flames) {
      (flame.material as THREE.MeshBasicMaterial).color.set(cust.glowColor);
    }
    this.applyGhostLook();
  }

  private applyGhostLook() {
    if (!this.ghostMaterial) return;
    this.root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.material = this.ghostMaterial!;
        mesh.castShadow = false;
        mesh.receiveShadow = false;
      }
    });
    this.glowPlane.material = this.ghostTrailMaterial!;
  }

  setBrakeLights(on: boolean) {
    this.brakeMat.emissiveIntensity = on ? 3.4 : 0.6;
  }

  get opacityNow() {
    return this.fade;
  }

  private collectFadeMaterials(): THREE.Material[] {
    const list: THREE.Material[] = [];
    this.root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of mats) {
        if (mat === this.ghostMaterial || mat === this.ghostTrailMaterial) continue;
        if (mat.userData.baseOpacity === undefined) mat.userData.baseOpacity = mat.opacity;
        list.push(mat);
      }
    });
    return list;
  }

  setFade(amount: number, dt: number) {
    const target = Math.min(1, Math.max(0, amount));
    if (Math.abs(target - this.fade) < 0.002 && this.fadeMaterials.length > 0) return;
    this.fade += (target - this.fade) * Math.min(1, dt * 10);
    if (Math.abs(target - this.fade) < 0.01) this.fade = target;
    if (this.fadeMaterials.length === 0) this.fadeMaterials = this.collectFadeMaterials();
    const transparent = this.fade < 0.995;
    for (const mat of this.fadeMaterials) {
      const base = (mat.userData.baseOpacity as number | undefined) ?? 1;
      if (transparent && !mat.transparent) {
        mat.transparent = true;
        mat.needsUpdate = true;
      }
      mat.opacity = base * this.fade;
      if (!transparent && mat.transparent && base >= 1) {
        mat.transparent = false;
        mat.opacity = 1;
        mat.needsUpdate = true;
      }
    }
  }

  resetFade() {
    this.fade = 1;
    this.fadeMaterials = [];
  }

  update(dt: number, state: KartVisualState) {
    this.time = state.time;
    this.currentSteer += (state.steer - this.currentSteer) * Math.min(1, dt * 12);
    this.currentSpeed = state.speed;
    this.suspension += (Math.sin(state.time * 17) * 0.012 * Math.min(1, Math.abs(state.speed) / 14) - this.suspension) * Math.min(1, dt * 10);

    for (const wheel of this.wheels) {
      wheel.spin.rotation.x -= (state.speed / this.wheelRadius) * dt;
      if (wheel.front) wheel.pivot.rotation.y = this.currentSteer * 0.32;
      wheel.pivot.position.y = wheel.baseY + this.suspension * (wheel.front ? -0.6 : 0.8);
    }
    this.steeringWheel.rotation.z = -this.currentSteer * 0.8;
    for (const [i, pivot] of this.armPivots.entries()) {
      const side = i === 0 ? -1 : 1;
      pivot.rotation.y = this.currentSteer * 0.2;
      pivot.rotation.x = Math.min(1, Math.abs(this.currentSteer)) * side * this.currentSteer * 0.05;
    }
    this.driverHead.rotation.y = this.currentSteer * 0.24;
    this.driverHead.rotation.z = -this.currentSteer * 0.06;
    // Braking throws the driver forward, acceleration pushes them back into the seat.
    const gForce = clamp(state.braking ? 0.03 : -Math.min(1, state.throttle) * 0.01, -0.02, 0.035);
    this.driverTorso.rotation.x = -0.34 + this.currentSteer * 0.04 + gForce;
    this.driverTorso.position.y = this.driverBaseY + Math.sin(state.time * 9) * 0.004 + this.suspension * 0.4;

    const lean = -this.currentSteer * 0.06 * Math.min(1, Math.abs(state.speed) / 25);
    this.body.rotation.z += (lean - this.body.rotation.z) * Math.min(1, dt * 8);
    const pitch = clamp((state.braking ? 0.035 : 0) - Math.min(1, state.throttle) * 0.014, -0.025, 0.05);
    this.body.rotation.x += (pitch - this.body.rotation.x) * Math.min(1, dt * 8);
    this.body.position.y = Math.sin(state.time * 30) * 0.004 * (0.4 + Math.min(1, state.throttle)) + (state.airborne ? 0.04 : 0);

    // DRS-style flap opens under boost; the front flaps trim with steering.
    const drsFlap = this.drsFlaps[this.customization.spoiler];
    if (drsFlap) {
      const target = state.boosting ? -0.34 : 0;
      drsFlap.rotation.x += (target - drsFlap.rotation.x) * Math.min(1, dt * 6);
    }
    for (const [i, flap] of this.frontFlaps.entries()) {
      flap.rotation.x = this.currentSteer * (0.06 + i * 0.02);
    }
    for (const bar of this.brakeBars) bar.scale.x = state.braking ? 1.0 : 0.86;

    for (const flame of this.flames) {
      flame.visible = state.boosting;
      if (state.boosting) {
        const pulse = 0.75 + Math.abs(Math.sin(state.time * 40)) * 0.8;
        flame.scale.set(pulse, 0.5 + Math.sin(state.time * 33) * 0.2 + 0.9, pulse);
      }
    }
    this.glowMat.opacity = 0.5 + Math.sin(state.time * 3) * 0.12 + (state.boosting ? 0.2 : 0);
    if (this.glowLight) this.glowLight.intensity = 1.1 + Math.sin(state.time * 3) * 0.3 + (state.boosting ? 1.3 : 0);
    this.decalMesh.visible = this.customization.decal !== 'none';
  }

  setRootPose(x: number, y: number, z: number, heading: number, extraYaw = 0) {
    this.root.position.set(x, y, z);
    this.root.rotation.y = heading + extraYaw;
  }

  dispose() {
    for (const g of this.allGeometries) g.dispose();
    for (const m of this.allMaterials) m.dispose();
    this.underglowTexture.dispose();
    this.helmetTexture?.dispose();
    this.suitTexture?.dispose();
    for (const t of this.numberTextures) t.dispose();
  }
}


