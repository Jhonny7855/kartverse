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
    const seatBack = new THREE.Mesh(this.geo(new THREE.BoxGeometry(0.62, 0.54, 0.15)), this.darkMat);
    seatBack.position.set(0, 1.02, -0.7);
    seatBack.rotation.x = 0.18;
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
    const column = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 8)), this.metalMat);
    column.rotation.x = -0.85;
    column.position.set(0, 0.94, 0.28);
    parent.add(column);
    this.steeringWheel = new THREE.Group();
    this.steeringWheel.position.set(0, 1.06, 0.14);
    this.steeringWheel.rotation.x = -0.62;
    const rim = new THREE.Mesh(this.geo(new THREE.TorusGeometry(0.17, 0.026, 6, 18)), this.darkMat);
    this.steeringWheel.add(rim);
    for (let i = 0; i < 3; i++) {
      const spoke = new THREE.Mesh(this.geo(new THREE.BoxGeometry(0.024, 0.32, 0.022)), this.metalMat);
      spoke.rotation.z = (i / 3) * Math.PI;
      this.steeringWheel.add(spoke);
    }
    const hub = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.055, 0.055, 0.045, 10)), this.accentMat);
    hub.rotation.x = Math.PI / 2;
    this.steeringWheel.add(hub);
    parent.add(this.steeringWheel);
  }

  private buildDriver(parent: THREE.Group) {
    this.driverTorso = new THREE.Group();
    this.driverTorso.position.set(0, 0.9, -0.32);
    const suit = this.track(new THREE.MeshStandardMaterial({ color: this.def.accentColor, roughness: 0.82, metalness: 0.05 }));
    const torso = new THREE.Mesh(this.geo(new THREE.CapsuleGeometry(0.21, 0.36, 4, 10)), suit);
    torso.position.y = 0.08;
    torso.rotation.x = 0.14;
    torso.castShadow = true;
    this.driverTorso.add(torso);
    const belt = new THREE.Mesh(this.geo(new THREE.BoxGeometry(0.46, 0.09, 0.36)), this.darkMat);
    belt.position.set(0, 0.1, 0.06);
    this.driverTorso.add(belt);
    this.driverHead = new THREE.Group();
    this.driverHead.position.set(0, 0.44, 0.03);
    const head = new THREE.Mesh(this.geo(new THREE.SphereGeometry(0.2, 16, 14)), this.helmetMat);
    head.scale.set(0.92, 1.02, 1);
    head.castShadow = true;
    this.driverHead.add(head);
    const visor = new THREE.Mesh(this.geo(new THREE.SphereGeometry(0.195, 14, 10, Math.PI * 0.9, Math.PI * 0.85, Math.PI * 0.28, Math.PI * 0.3)), this.visorMat);
    visor.rotation.y = Math.PI / 2;
    visor.position.set(0, 0.015, 0.01);
    this.driverHead.add(visor);
    const crest = new THREE.Mesh(this.geo(new THREE.BoxGeometry(0.035, 0.18, 0.3)), this.accentMat);
    crest.position.set(0, 0.2, -0.02);
    crest.rotation.x = -0.2;
    this.driverHead.add(crest);
    this.driverTorso.add(this.driverHead);
    parent.add(this.driverTorso);

    const gloveMat = this.track(new THREE.MeshStandardMaterial({ color: 0x1a1e28, roughness: 0.7 }));
    const armGeo = this.geo(new THREE.CapsuleGeometry(0.055, 0.36, 3, 8));
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.19, 0.24, 0.02);
      const arm = new THREE.Mesh(armGeo, suit);
      arm.position.set(side * 0.09, -0.13, 0.16);
      arm.rotation.x = 0.95;
      arm.rotation.z = side * 0.28;
      arm.castShadow = true;
      pivot.add(arm);
      const glove = new THREE.Mesh(this.geo(new THREE.SphereGeometry(0.07, 8, 6)), gloveMat);
      glove.position.set(side * 0.13, -0.27, 0.32);
      pivot.add(glove);
      this.driverTorso.add(pivot);
      this.armPivots.push(pivot);
    }
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
    for (const [i, pivot] of this.armPivots.entries()) {
      pivot.rotation.y = this.currentSteer * (i === 0 ? 0.3 : 0.24);
    }
    this.driverHead.rotation.y = this.currentSteer * 0.22;
    this.driverTorso.position.y = 0.78 + Math.sin(state.time * 9) * 0.006;

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
