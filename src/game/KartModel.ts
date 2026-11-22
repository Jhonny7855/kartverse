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

  // Pick a trim that actually contrasts with the shell. A white helmet with white
  // trim reads as a blank ball, so fall back to a dark graphic in that case.
  const shellLum = luminance(shellColor);
  const contrastTrim = Math.abs(luminance(trimColor) - shellLum) > 0.25
    ? trimColor
    : shellLum > 0.55
      ? '#1a2030'
      : trimColor;

  // u = 0.25 is the front of the sphere when using a default sphere UV layout.
  const front = w * 0.25;

  // A thin fore-aft stripe converges at the sphere's pole and reads as a white nub on
  // top of the head, so the helmet uses broad side panels instead.
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

  // Visor: a wide, shallow lens band at eye height. A tall oval reads as a mouth.
  ctx.fillStyle = visorColorDark;
  ctx.beginPath();
  ctx.ellipse(front, h * 0.475, w * 0.135, h * 0.085, 0, 0, Math.PI * 2);
  ctx.fill();

  // Bright specular streak across the visor.
  const gloss = ctx.createLinearGradient(front - w * 0.1, h * 0.42, front + w * 0.09, h * 0.53);
  gloss.addColorStop(0, 'rgba(160,200,250,0.55)');
  gloss.addColorStop(0.55, 'rgba(70,120,190,0.14)');
  gloss.addColorStop(1, 'rgba(10,18,32,0.0)');
  ctx.fillStyle = gloss;
  ctx.beginPath();
  ctx.ellipse(front, h * 0.475, w * 0.128, h * 0.078, 0, 0, Math.PI * 2);
  ctx.fill();

  // Visor gasket outline.
  ctx.strokeStyle = '#05070c';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(front, h * 0.475, w * 0.138, h * 0.09, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Vent slots on the chin bar.
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
  // Getting this wrong paints the harness on the driver's back.
  const front = w * 0.25;

  // Shoulder yoke band, kept clear of the chest detail so it does not read as a
  // black stripe crossing the collarbone.
  ctx.fillStyle = trim;
  ctx.fillRect(0, h * 0.1, w, h * 0.03);

  // Centre chest stripe.
  ctx.fillStyle = trim;
  ctx.fillRect(front - w * 0.012, h * 0.3, w * 0.024, h * 0.46);

  // Harness straps running over the shoulders and down the chest.
  ctx.fillStyle = '#12161f';
  for (const dir of [-1, 1]) {
    ctx.save();
    ctx.translate(front + dir * w * 0.044, h * 0.52);
    ctx.rotate(dir * 0.1);
    ctx.fillRect(-w * 0.009, -h * 0.3, w * 0.018, h * 0.42);
    ctx.restore();
  }  // Buckle.
  ctx.fillStyle = '#8b95a8';
  ctx.fillRect(front - w * 0.02, h * 0.7, w * 0.04, h * 0.028);

  // Side seams.
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
  private darkMat: THREE.MeshStandardMaterial;
  private metalMat: THREE.MeshStandardMaterial;
  private tireMat: THREE.MeshStandardMaterial;
  private rimMat: THREE.MeshStandardMaterial;
  private helmetMat: THREE.MeshStandardMaterial;
  private helmetSkin: THREE.MeshStandardMaterial | null = null;
  private helmetTexture: THREE.CanvasTexture | null = null;
  private suitSkin: THREE.MeshStandardMaterial | null = null;
  private suitTexture: THREE.CanvasTexture | null = null;
  private glowMat: THREE.MeshBasicMaterial;
  private glowLight: THREE.PointLight | null = null;
  private glowPlane: THREE.Mesh;
  private brakeMat: THREE.MeshStandardMaterial;
  private brakeBar!: THREE.Mesh;
  private flames: THREE.Mesh[] = [];
  private spoilers: Record<string, THREE.Group> = {};
  private exhausts: Record<string, THREE.Group> = {};
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
  private visorMat: THREE.MeshStandardMaterial;
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
    this.darkMat = this.track(new THREE.MeshStandardMaterial({ color: 0x141821, metalness: 0.4, roughness: 0.62 }));
    this.metalMat = this.track(new THREE.MeshStandardMaterial({ color: 0x8b95a8, metalness: 0.92, roughness: 0.24 }));
    this.tireMat = this.track(new THREE.MeshStandardMaterial({ color: customization.wheelColor, roughness: 0.88, metalness: 0.06 }));
    this.rimMat = this.track(new THREE.MeshStandardMaterial({ color: customization.rimColor, metalness: 0.85, roughness: 0.22 }));
    this.helmetMat = this.track(new THREE.MeshStandardMaterial({ color: customization.helmetColor, metalness: 0.55, roughness: 0.2 }));
    this.visorMat = this.track(new THREE.MeshStandardMaterial({ color: 0x0a1220, metalness: 1, roughness: 0.05 }));
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
    void this.simple;
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

  private buildChassis(parent: THREE.Group, shadows: boolean) {
    const floor = this.box(1.46, 0.16, 2.36, this.darkMat, 0, 0.3, -0.05);
    parent.add(floor);

    const shell = new THREE.Mesh(this.geo(taperedBox(1.34, 0.52, 1.98, 0.42, 0.58)), this.bodyMat);
    shell.position.set(0, 0.58, -0.16);
    shell.castShadow = shadows;
    shell.receiveShadow = shadows;
    parent.add(shell);

    const nose = new THREE.Mesh(this.geo(taperedBox(1.16, 0.34, 1.08, 0.5, 0.52)), this.bodyMat);
    nose.position.set(0, 0.54, 1.14);
    nose.castShadow = shadows;
    parent.add(nose);

    const nosePlate = new THREE.Mesh(this.geo(new THREE.BoxGeometry(0.94, 0.12, 0.44)), this.accentMat);
    nosePlate.position.set(0, 0.66, 1.38);
    nosePlate.rotation.x = -0.18;
    parent.add(nosePlate);

    for (const side of [-1, 1]) {
      const pod = new THREE.Mesh(this.geo(new THREE.CapsuleGeometry(0.24, 0.76, 4, 10)), this.bodyMat);
      pod.rotation.x = Math.PI / 2;
      pod.scale.set(1.12, 1, 1);
      pod.position.set(side * 0.76, 0.5, -0.14);
      pod.castShadow = shadows;
      parent.add(pod);

      const stripe = new THREE.Mesh(this.geo(new THREE.BoxGeometry(0.07, 0.1, 0.94)), this.accentMat);
      stripe.position.set(side * 0.9, 0.6, -0.1);
      parent.add(stripe);
    }

    const cockpit = this.box(0.88, 0.3, 0.94, this.darkMat, 0, 0.74, -0.18);
    parent.add(cockpit);
    const seat = this.box(0.6, 0.18, 0.6, this.darkMat, 0, 0.82, -0.4);
    parent.add(seat);
    const seatBack = new THREE.Mesh(this.geo(new THREE.BoxGeometry(0.6, 0.4, 0.14)), this.darkMat);
    seatBack.position.set(0, 0.94, -0.72);
    seatBack.rotation.x = 0.2;
    seatBack.castShadow = true;
    parent.add(seatBack);

    const engine = this.box(0.58, 0.42, 0.48, this.metalMat, 0, 0.68, -0.9);
    parent.add(engine);
    for (let i = 0; i < 3; i++) {
      const fin = new THREE.Mesh(this.geo(new THREE.BoxGeometry(0.66, 0.035, 0.4)), this.darkMat);
      fin.position.set(0, 0.84 + i * 0.07, -0.9);
      parent.add(fin);
    }
    const intake = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.11, 0.11, 0.52, 10)), this.metalMat);
    intake.rotation.x = Math.PI / 2;
    intake.position.set(0.24, 0.96, -0.84);
    parent.add(intake);

    const bumperF = this.box(1.6, 0.18, 0.2, this.darkMat, 0, 0.32, 1.4);
    parent.add(bumperF);
    const bumperR = this.box(1.66, 0.22, 0.22, this.darkMat, 0, 0.34, -1.34);
    parent.add(bumperR);
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.05, 0.05, 1.24, 6)), this.metalMat);
      rail.rotation.x = Math.PI / 2;
      rail.position.set(side * 0.76, 0.3, 0.12);
      parent.add(rail);
      const bumperTip = this.box(0.26, 0.16, 0.22, this.accentMat, side * 0.8, 0.3, 1.45);
      parent.add(bumperTip);
    }

    // Steering column and wheel.
    const column = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.035, 0.04, 0.38, 10)), this.metalMat);
    column.rotation.x = 0.82;
    column.position.set(0, 1, 0.17);
    parent.add(column);
    this.steeringWheel = new THREE.Group();
    this.steeringWheel.position.set(0, 1.13, 0.03);
    this.steeringWheel.rotation.x = -0.6;
    const rim = new THREE.Mesh(this.geo(new THREE.TorusGeometry(0.16, 0.024, 8, 22)), this.darkMat);
    this.steeringWheel.add(rim);
    for (let i = 0; i < 3; i++) {
      const spoke = new THREE.Mesh(this.geo(new THREE.BoxGeometry(0.018, 0.3, 0.016)), this.darkMat);
      spoke.rotation.z = (i / 3) * Math.PI;
      this.steeringWheel.add(spoke);
    }
    const hub = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.045, 0.045, 0.038, 12)), this.metalMat);
    hub.rotation.x = Math.PI / 2;
    this.steeringWheel.add(hub);
    parent.add(this.steeringWheel);
  }
  private buildDriver(parent: THREE.Group) {
    // Team livery: the suit carries the kart's body colour so the driver reads
    // clearly against the dark cockpit and seat, with dark panels for structure.
    const accent = new THREE.Color(this.def.accentColor);
    const body = new THREE.Color(this.customization.bodyColor);
    const trimColor = accent.clone();
    const lum = trimColor.r * 0.299 + trimColor.g * 0.587 + trimColor.b * 0.114;
    if (lum > 0.72) trimColor.multiplyScalar(0.72 / lum);
    const suitMat = this.track(new THREE.MeshStandardMaterial({ color: body, roughness: 0.66, metalness: 0.08 }));
    const suitPanel = this.track(
      new THREE.MeshStandardMaterial({ color: body.clone().multiplyScalar(0.34).lerp(new THREE.Color(0x171b24), 0.62), roughness: 0.82, metalness: 0.06 }),
    );
    const trimMat = this.track(new THREE.MeshStandardMaterial({ color: trimColor, roughness: 0.45, metalness: 0.2 }));
    const bootMat = this.track(new THREE.MeshStandardMaterial({ color: 0x10131a, roughness: 0.55, metalness: 0.25 }));
    const gloveMat = this.track(new THREE.MeshStandardMaterial({ color: 0x171b24, roughness: 0.62, metalness: 0.1 }));
    const neckMat = this.track(new THREE.MeshStandardMaterial({ color: 0xa87b58, roughness: 0.74, metalness: 0.02 }));

    this.driverTorso = new THREE.Group();
    this.driverTorso.position.set(0, 0.84, -0.4);
    this.driverBaseY = this.driverTorso.position.y;
    // A driver is roughly 1.75 m against a kart ~1.2 m tall, so scale up a touch
    // to sit correctly in the seat.
    this.driverTorso.scale.setScalar(1.14);

    // Hips.
    const pelvis = new THREE.Mesh(this.geo(new THREE.SphereGeometry(0.15, 18, 14)), suitMat);
    pelvis.position.set(0, 0.03, 0);
    pelvis.scale.set(1.05, 0.82, 0.95);
    pelvis.castShadow = true;
    this.driverTorso.add(pelvis);

    // Torso: a lathed profile — narrow waist opening into a broad chest, which is
    // what separates a human silhouette from a stack of capsules.
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
    // Chest detail is painted onto the suit rather than modelled, so nothing
    // juts out of the torso silhouette.
    this.suitTexture = suitTexture(`#${body.getHexString()}`, `#${trimColor.getHexString()}`);
    this.suitSkin = this.track(
      new THREE.MeshStandardMaterial({ map: this.suitTexture, roughness: 0.66, metalness: 0.08 }),
    );
    const torso = new THREE.Mesh(torsoGeo, this.suitSkin);
    torso.position.set(0, 0.05, 0);
    torso.castShadow = true;
    this.driverTorso.add(torso);

    // Shoulder caps blended into the chest so there is no visible ball joint.
    for (const side of [-1, 1]) {
      const cap = new THREE.Mesh(this.geo(new THREE.SphereGeometry(0.066, 18, 14)), this.suitSkin);
      cap.position.set(side * 0.142, 0.334, 0.004);
      cap.scale.set(1.1, 0.92, 0.92);
      cap.castShadow = true;
      this.driverTorso.add(cap);
    }

    // Neck and helmet. A real head is about one-seventh of body height; the earlier
    // 0.155 radius read as a bobblehead at this scale.
    const neck = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.045, 0.056, 0.09, 14)), neckMat);
    neck.position.set(0, 0.435, 0.008);
    this.driverTorso.add(neck);

    this.driverHead = new THREE.Group();
    this.driverHead.position.set(0, 0.535, 0.012);
    this.driverTorso.add(this.driverHead);

    // The shell is a hero-quality sphere; visor, chin bar, stripe and vents are
    // painted into the texture so nothing sticks out of the silhouette.
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

    // Shallow rear spoiler lip.
    const spoiler = new THREE.Mesh(this.geo(new THREE.BoxGeometry(0.092, 0.011, 0.036)), this.helmetSkin);
    spoiler.position.set(0, 0.058, -0.106);
    spoiler.rotation.x = -0.44;
    spoiler.castShadow = true;
    this.driverHead.add(spoiler);

    // HANS-style collar sits on the torso, not the helmet.
    const collar = new THREE.Mesh(this.geo(new THREE.TorusGeometry(0.056, 0.016, 8, 18)), this.darkMat);
    collar.position.set(0, -0.045, -0.058);
    collar.rotation.x = Math.PI / 2 - 0.28;
    this.driverTorso.add(collar);

    // Arms: shoulder -> elbow -> forearm -> gloved hand on the rim.
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Vector3(side * 0.155, 0.335, 0.01);
      const elbow = new THREE.Vector3(side * 0.212, 0.165, 0.17);
      const grip = new THREE.Vector3(side * 0.132, 0.235, 0.355);
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

    // Legs run forward into the pedal box.
    for (const side of [-1, 1]) {
      const hip = new THREE.Vector3(side * 0.082, 0, 0.02);
      const knee = new THREE.Vector3(side * 0.105, -0.08, 0.26);
      const ankle = new THREE.Vector3(side * 0.115, -0.41, 0.42);
      this.driverTorso.add(this.limb(hip, knee, 0.071, suitMat));
      const kneeCap = new THREE.Mesh(this.geo(new THREE.SphereGeometry(0.059, 12, 10)), suitPanel);
      kneeCap.position.copy(knee);
      this.driverTorso.add(kneeCap);
      this.driverTorso.add(this.limb(knee, ankle, 0.056, suitMat, 1.12));
      const boot = new THREE.Mesh(this.geo(taperedBox(0.09, 0.074, 0.19, 0.12, 0.88)), bootMat);
      boot.position.set(side * 0.117, -0.438, 0.5);
      boot.rotation.x = -0.08;
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

  private buildWheels(parent: THREE.Group, shadows: boolean) {
    const r = this.def.wheelSize * 0.7;
    const w = this.def.wheelWidth * 0.9;
    const tireGeo = this.geo(new THREE.CylinderGeometry(r, r, w, 20));
    const rimGeo = this.geo(new THREE.CylinderGeometry(r * 0.62, r * 0.62, w * 1.04, 14));
    const hubGeo = this.geo(new THREE.CylinderGeometry(r * 0.18, r * 0.18, w * 1.12, 10));
    const spokeGeo = this.geo(new THREE.BoxGeometry(r * 1.28, r * 0.08, w * 0.16));
    const positions: [number, number, boolean][] = [
      [-0.86, 0.84, true],
      [0.86, 0.84, true],
      [-0.9, -0.82, false],
      [0.9, -0.82, false],
    ];
    for (const [x, z, front] of positions) {
      const pivot = new THREE.Group();
      pivot.position.set(x, r, z);
      const spin = new THREE.Group();
      const tire = new THREE.Mesh(tireGeo, this.tireMat);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = shadows;
      tire.receiveShadow = shadows;
      spin.add(tire);
      const rim = new THREE.Mesh(rimGeo, this.rimMat);
      rim.rotation.z = Math.PI / 2;
      spin.add(rim);
      const hub = new THREE.Mesh(hubGeo, this.metalMat);
      hub.rotation.z = Math.PI / 2;
      spin.add(hub);
      for (let s = 0; s < 4; s++) {
        const spoke = new THREE.Mesh(spokeGeo, this.rimMat);
        spoke.rotation.x = (s / 4) * Math.PI;
        spoke.position.x = x > 0 ? 0.02 : -0.02;
        spin.add(spoke);
      }
      const brakeDisc = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(r * 0.45, r * 0.45, 0.03, 14)), this.metalMat);
      brakeDisc.rotation.z = Math.PI / 2;
      brakeDisc.position.x = x > 0 ? -w * 0.35 : w * 0.35;
      spin.add(brakeDisc);
      pivot.add(spin);
      parent.add(pivot);
      this.wheels.push({ pivot, spin, front, baseY: r });
    }
  }

  private buildAero(parent: THREE.Group) {
    const makeSpoiler = (id: string, height: number, width: number, wing: boolean) => {
      const g = new THREE.Group();
      for (const side of [-1, 1]) {
        const strut = new THREE.Mesh(this.geo(new THREE.BoxGeometry(0.07, height, 0.08)), this.metalMat);
        strut.position.set(side * width * 0.32, height / 2 + 0.62, -1.32);
        g.add(strut);
      }
      const plane = new THREE.Mesh(this.geo(new THREE.BoxGeometry(width, 0.06, wing ? 0.36 : 0.28)), this.bodyMat);
      plane.position.set(0, height + 0.64, -1.34);
      plane.rotation.x = wing ? -0.14 : -0.06;
      plane.castShadow = true;
      g.add(plane);
      const lip = new THREE.Mesh(this.geo(new THREE.BoxGeometry(width * 1.04, 0.035, 0.08)), this.accentMat);
      lip.position.set(0, height + 0.64, -1.5);
      g.add(lip);
      for (const side of [-1, 1]) {
        const endplate = new THREE.Mesh(this.geo(new THREE.BoxGeometry(0.05, 0.24, 0.4)), this.accentMat);
        endplate.position.set(side * width * 0.5, height + 0.64, -1.36);
        g.add(endplate);
      }
      g.visible = false;
      parent.add(g);
      return g;
    };
    this.spoilers.low = makeSpoiler('low', 0.06, 1.4, false);
    this.spoilers.mid = makeSpoiler('mid', 0.2, 1.48, false);
    this.spoilers.high = makeSpoiler('high', 0.36, 1.56, false);
    this.spoilers.wing = makeSpoiler('wing', 0.42, 1.7, true);

    const makeExhaust = (id: string, count: number, radius: number, length: number, offset: number) => {
      const g = new THREE.Group();
      const tips: THREE.Object3D[] = [];
      for (let i = 0; i < count; i++) {
        const x = count === 1 ? 0 : (i - (count - 1) / 2) * offset;
        const pipe = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(radius, radius * 1.12, length, 10)), this.metalMat);
        pipe.rotation.x = Math.PI / 2;
        pipe.position.set(x, 0.62, -1.2 - length / 2);
        g.add(pipe);
        const tip = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(radius * 1.15, radius * 1.15, 0.08, 10)), this.darkMat);
        tip.rotation.x = Math.PI / 2;
        tip.position.set(x, 0.62, -1.2 - length);
        g.add(tip);
        const flame = new THREE.Mesh(
          this.geo(new THREE.ConeGeometry(radius * 1.4, 0.6, 8, 1, true)),
          this.track(new THREE.MeshBasicMaterial({ color: 0x62e8ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })),
        );
        flame.rotation.x = Math.PI / 2;
        flame.position.set(x, 0.62, -1.22 - length - 0.3);
        flame.visible = false;
        g.add(flame);
        this.flames.push(flame);
        const anchor = new THREE.Object3D();
        anchor.position.set(x, 0.62, -1.24 - length);
        g.add(anchor);
        tips.push(anchor);
      }
      g.visible = false;
      parent.add(g);
      return { group: g, tips };
    };
    this.exhausts.single = makeExhaust('single', 1, 0.08, 0.4, 0.2).group;
    this.exhaustTips.push(...makeExhaust('single', 1, 0.08, 0.4, 0.2).tips);
    const dual = makeExhaust('dual', 2, 0.065, 0.36, 0.24);
    this.exhausts.dual = dual.group;
    this.exhaustTips.push(...dual.tips);
    const jet = makeExhaust('jet', 2, 0.1, 0.3, 0.3);
    this.exhausts.jet = jet.group;
    this.exhaustTips.push(...jet.tips);

    this.numberMeshes = [];
    const frontPlate = new THREE.Mesh(
      this.geo(new THREE.PlaneGeometry(0.48, 0.3)),
      new THREE.MeshBasicMaterial({ transparent: true }),
    );
    frontPlate.position.set(0, 0.76, 1.3);
    frontPlate.rotation.x = -0.3;
    parent.add(frontPlate);
    this.numberMeshes.push(frontPlate);
    const rearPlate = new THREE.Mesh(
      this.geo(new THREE.PlaneGeometry(0.4, 0.26)),
      new THREE.MeshBasicMaterial({ transparent: true }),
    );
    rearPlate.position.set(0, 0.78, -1.36);
    rearPlate.rotation.y = Math.PI;
    parent.add(rearPlate);
    this.numberMeshes.push(rearPlate);
    for (const side of [-1, 1]) {
      const plate = new THREE.Mesh(
        this.geo(new THREE.PlaneGeometry(0.34, 0.24)),
        new THREE.MeshBasicMaterial({ transparent: true }),
      );
      plate.position.set(side * 0.98, 0.6, -0.2);
      plate.rotation.y = side * (Math.PI / 2);
      parent.add(plate);
      this.numberMeshes.push(plate);
    }

    const decalMat = this.track(new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }));
    this.decalMesh = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(1.02, 0.86)), decalMat);
    this.decalMesh.rotation.x = -Math.PI / 2;
    this.decalMesh.rotation.z = 0;
    this.decalMesh.position.set(0, 0.855, 0.36);
    parent.add(this.decalMesh);
  }

  private buildLights(parent: THREE.Group) {
    for (const side of [-1, 1]) {
      const lamp = new THREE.Mesh(this.geo(new THREE.SphereGeometry(0.075, 10, 8)), this.headlightMat);
      lamp.scale.set(1, 0.7, 0.55);
      lamp.position.set(side * 0.44, 0.62, 1.44);
      parent.add(lamp);
      const housing = new THREE.Mesh(this.geo(new THREE.BoxGeometry(0.21, 0.1, 0.08)), this.darkMat);
      housing.position.set(side * 0.44, 0.62, 1.41);
      parent.add(housing);
    }
    this.brakeBar = new THREE.Mesh(this.geo(new THREE.BoxGeometry(0.62, 0.1, 0.05)), this.brakeMat);
    this.brakeBar.position.set(0, 0.78, -1.36);
    parent.add(this.brakeBar);

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
    this.helmetMat.color.set(cust.helmetColor);
    this.glowMat.color.set(cust.glowColor);
    (this.glowPlane.material as THREE.MeshBasicMaterial).color.set(cust.glowColor);
    if (this.glowLight) this.glowLight.color.set(cust.glowColor);

    // Number plates.
    for (const t of this.numberTextures) t.dispose();
    this.numberTextures = [];
    for (const mesh of this.numberMeshes) {
      const tex = numberTexture(cust.number, this.def.bodyColor, this.def.accentColor);
      this.numberTextures.push(tex);
      (mesh.material as THREE.MeshBasicMaterial).map = tex;
      (mesh.material as THREE.MeshBasicMaterial).needsUpdate = true;
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
    this.brakeBar.visible = true;
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
      if (wheel.front) wheel.pivot.rotation.y = this.currentSteer * 0.42;
      wheel.pivot.position.y = wheel.baseY + this.suspension * (wheel.front ? -0.6 : 0.8);
    }
    this.steeringWheel.rotation.z = -this.currentSteer * 0.85;
    const steerAmt = Math.min(1, Math.abs(this.currentSteer));
    for (const [i, pivot] of this.armPivots.entries()) {
      const side = i === 0 ? -1 : 1;
      pivot.rotation.y = this.currentSteer * 0.26;
      pivot.rotation.x = steerAmt * side * this.currentSteer * 0.06;
    }
    this.driverHead.rotation.y = this.currentSteer * 0.26;
    this.driverHead.rotation.z = -this.currentSteer * 0.07;
    // Braking throws the driver forward, acceleration rocks them back.
    const gForce = clamp(state.braking ? 0.035 : -Math.min(1, state.throttle) * 0.012, -0.02, 0.04);
    this.driverTorso.rotation.x = this.currentSteer * 0.06 + gForce;
    this.driverTorso.position.y = this.driverBaseY + Math.sin(state.time * 9) * 0.005 + this.suspension * 0.4;

    const lean = -this.currentSteer * 0.09 * Math.min(1, Math.abs(state.speed) / 25);
    this.body.rotation.z += (lean - this.body.rotation.z) * Math.min(1, dt * 8);
    const pitch = clamp((state.braking ? 0.045 : 0) - Math.min(1, state.throttle) * 0.018, -0.03, 0.06);
    this.body.rotation.x += (pitch - this.body.rotation.x) * Math.min(1, dt * 8);
    this.body.position.y = Math.sin(state.time * 30) * 0.005 * (0.4 + Math.min(1, state.throttle)) + (state.airborne ? 0.04 : 0);

    this.brakeBar.scale.x = state.braking ? 1.1 : 1;
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
    for (const t of this.numberTextures) t.dispose();
  }
}
