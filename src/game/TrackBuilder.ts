import * as THREE from 'three';
import type { TrackDef } from '../data/types';
import { TrackSpline } from './TrackSpline';
import { seededRandom } from './utils';

export interface TrackScenery {
  group: THREE.Group;
  animated: (dt: number) => void;
  panes: THREE.Mesh[];
}

const ROAD_SAMPLES = 760;
const BARRIER_STEP = 7;

function paintVertexColors(geo: THREE.BufferGeometry, color: THREE.Color) {
  const count = geo.attributes.position.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

function buildRoad(spline: TrackSpline, def: TrackDef): THREE.Group {
  const group = new THREE.Group();
  const samples = ROAD_SAMPLES;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const shoulderPositions: number[] = [];
  const shoulderUvs: number[] = [];
  const shoulderIndices: number[] = [];

  const road = new THREE.Color(def.palette.road);
  const shoulder = new THREE.Color(def.palette.road).multiplyScalar(0.62);

  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const s = spline.sampleAtDistance(t * spline.totalLength);
    const half = s.width / 2;
    const p = s.position;
    const r = s.right;
    positions.push(
      p.x - r.x * half, p.y, p.z - r.z * half,
      p.x + r.x * half, p.y, p.z + r.z * half,
    );
    uvs.push(0, t * 42, 1, t * 42);

    const outer = half + 2.2;
    shoulderPositions.push(
      p.x - r.x * outer, p.y - 0.12, p.z - r.z * outer,
      p.x - r.x * half, p.y, p.z - r.z * half,
      p.x + r.x * half, p.y, p.z + r.z * half,
      p.x + r.x * outer, p.y - 0.12, p.z + r.z * outer,
    );
    shoulderUvs.push(0, t * 30, 1, t * 30, 0, t * 30, 1, t * 30);
  }
  for (let i = 0; i < samples; i++) {
    const a = i * 2;
    indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    const sa = i * 4;
    shoulderIndices.push(sa, sa + 4, sa + 1, sa + 1, sa + 4, sa + 5);
    shoulderIndices.push(sa + 2, sa + 6, sa + 7, sa + 2, sa + 7, sa + 3);
  }

  const roadGeo = new THREE.BufferGeometry();
  roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  roadGeo.setIndex(indices);
  roadGeo.computeVertexNormals();
  paintVertexColors(roadGeo, road);
  const roadMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: def.theme === 'city' || def.theme === 'skyline' ? 0.34 : 0.82,
    metalness: def.theme === 'city' || def.theme === 'skyline' ? 0.42 : 0.06,
    side: THREE.DoubleSide,
  });
  const roadMesh = new THREE.Mesh(roadGeo, roadMat);
  roadMesh.receiveShadow = true;
  group.add(roadMesh);

  const shoulderGeo = new THREE.BufferGeometry();
  shoulderGeo.setAttribute('position', new THREE.Float32BufferAttribute(shoulderPositions, 3));
  shoulderGeo.setAttribute('uv', new THREE.Float32BufferAttribute(shoulderUvs, 2));
  shoulderGeo.setIndex(shoulderIndices);
  shoulderGeo.computeVertexNormals();
  paintVertexColors(shoulderGeo, shoulder);
  const shoulderMesh = new THREE.Mesh(
    shoulderGeo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0.05, side: THREE.DoubleSide }),
  );
  shoulderMesh.receiveShadow = true;
  group.add(shoulderMesh);

  // Centre dashes and solid edge lines as thin ribbons slightly above the road.
  const dashGeoParts: THREE.BufferGeometry[] = [];
  const edgePositions: number[] = [];
  const edgeIndices: number[] = [];
  const edgeCount = 400;
  const lineWidth = 0.34;
  for (let i = 0; i < edgeCount; i++) {
    const t = i / edgeCount;
    const s = spline.sampleAtDistance(t * spline.totalLength);
    const outer = s.width / 2 - 0.3;
    const inner = outer - lineWidth;
    const y = s.position.y + 0.035;
    for (const side of [-1, 1]) {
      edgePositions.push(
        s.position.x + s.right.x * outer * side, y, s.position.z + s.right.z * outer * side,
        s.position.x + s.right.x * inner * side, y, s.position.z + s.right.z * inner * side,
      );
    }
  }
  for (let i = 0; i < edgeCount; i++) {
    const next = (i + 1) % edgeCount;
    for (let s = 0; s < 2; s++) {
      const a = i * 4 + s * 2;
      const b = next * 4 + s * 2;
      edgeIndices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const edgeGeo = new THREE.BufferGeometry();
  edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(edgePositions, 3));
  edgeGeo.setIndex(edgeIndices);
  edgeGeo.computeVertexNormals();
  const edgeMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(def.palette.accent).multiplyScalar(def.theme === 'city' ? 0.75 : 0.55),
    side: THREE.DoubleSide,
    transparent: true,
    opacity: def.theme === 'city' ? 0.8 : 0.45,
  });
  group.add(new THREE.Mesh(edgeGeo, edgeMat));

  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf4f4ee, transparent: true, opacity: 0.68, side: THREE.DoubleSide });
  for (let i = 0; i < 260; i++) {
    const t = (i / 260) * 1;
    const s = spline.sampleAtDistance(t * spline.totalLength);
    const segLen = 2.4;
    const a = spline.sampleAtDistance((t + segLen / spline.totalLength) * spline.totalLength);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        [
          s.position.x - s.right.x * 0.11, s.position.y + 0.045, s.position.z - s.right.z * 0.11,
          s.position.x + s.right.x * 0.11, s.position.y + 0.045, s.position.z + s.right.z * 0.11,
          a.position.x + a.right.x * 0.11, a.position.y + 0.045, a.position.z + a.right.z * 0.11,
          a.position.x - a.right.x * 0.11, a.position.y + 0.045, a.position.z - a.right.z * 0.11,
        ],
        3,
      ),
    );
    geo.setIndex([0, 2, 1, 0, 3, 2]);
    dashGeoParts.push(geo);
  }
  for (const g of dashGeoParts) group.add(new THREE.Mesh(g, dashMat));

  // Start line chequers.
  const start = spline.sampleAtDistance(0);
  const checkMat1 = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const checkMat2 = new THREE.MeshBasicMaterial({ color: 0x111111 });
  const cell = start.width / 12;
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 12; col++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(cell, cell), (row + col) % 2 ? checkMat1 : checkMat2);
      const offset = -start.width / 2 + cell * (col + 0.5);
      const p = start.position.clone().addScaledVector(start.right, offset).addScaledVector(start.tangent, row * cell * 0.9);
      m.position.copy(p);
      m.position.y += 0.055;
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = Math.atan2(start.tangent.z, start.tangent.x) + Math.PI / 2;
      group.add(m);
    }
  }

  // Curbs on the inside of tighter corners.
  const curbGeo = new THREE.BoxGeometry(0.9, 0.09, 1.4);
  const curbMatA = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, emissive: 0x202020 });
  const curbMatB = new THREE.MeshStandardMaterial({ color: new THREE.Color(def.palette.secondary), roughness: 0.55 });
  let curbCount = 0;
  for (let i = 0; i < 320; i++) {
    const t = i / 320;
    const s = spline.sampleAtDistance(t * spline.totalLength);
    if (s.curvature < 0.012) continue;
    for (const side of [-1, 1]) {
      const m = new THREE.Mesh(curbGeo, curbCount % 2 ? curbMatA : curbMatB);
      const p = s.position.clone().addScaledVector(s.right, side * (s.width / 2 + 0.35));
      m.position.copy(p);
      m.position.y += 0.03;
      m.rotation.y = Math.atan2(s.tangent.x, s.tangent.z);
      group.add(m);
      curbCount++;
    }
  }

  return group;
}

function buildBarriers(spline: TrackSpline, def: TrackDef): THREE.Group {
  const group = new THREE.Group();
  const rails: { matrix: THREE.Matrix4 }[] = [];
  const posts: { matrix: THREE.Matrix4 }[] = [];
  const railGeo = new THREE.BoxGeometry(0.34, 0.55, BARRIER_STEP + 0.1);
  const postGeo = new THREE.BoxGeometry(0.5, 1.25, 0.5);
  const railMat = new THREE.MeshStandardMaterial({
    color: 0x252b38,
    metalness: 0.65,
    roughness: 0.35,
    emissive: new THREE.Color(def.palette.accent).multiplyScalar(0.12),
  });
  const postMat = new THREE.MeshStandardMaterial({ color: 0x3a4150, metalness: 0.5, roughness: 0.5 });
  const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(def.palette.accent) });
  const glowGeo = new THREE.BoxGeometry(0.08, 0.13, BARRIER_STEP * 0.86);
  const glowMeshes: THREE.Mesh[] = [];

  const count = Math.floor(spline.totalLength / BARRIER_STEP);
  for (let i = 0; i < count; i++) {
    const t = i / count;
    const s = spline.sampleAtDistance(t * spline.totalLength);
    const angle = Math.atan2(s.tangent.x, s.tangent.z);
    for (const side of [-1, 1]) {
      const p = s.position.clone().addScaledVector(s.right, side * (s.width / 2 + 1.45));
      const m = new THREE.Matrix4();
      m.compose(p, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, angle, 0)), new THREE.Vector3(1, 1, 1));
      rails.push({ matrix: m });
      const pm = new THREE.Matrix4();
      pm.compose(
        new THREE.Vector3(p.x, p.y - 0.2, p.z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, angle, 0)),
        new THREE.Vector3(1, 1, 1),
      );
      posts.push({ matrix: pm });
      if (i % 2 === 0) {
        const glow = new THREE.Mesh(glowGeo, glowMat);
        const gp = p.clone().addScaledVector(s.right, side * -0.2);
        glow.position.copy(gp);
        glow.position.y += 0.52;
        glow.rotation.y = angle;
        glowMeshes.push(glow);
      }
    }
  }
  const railMesh = new THREE.InstancedMesh(railGeo, railMat, rails.length);
  rails.forEach((r, i) => railMesh.setMatrixAt(i, r.matrix));
  railMesh.castShadow = true;
  railMesh.receiveShadow = true;
  const postMesh = new THREE.InstancedMesh(postGeo, postMat, posts.length);
  posts.forEach((p, i) => postMesh.setMatrixAt(i, p.matrix));
  postMesh.castShadow = true;
  group.add(railMesh, postMesh);
  for (const g of glowMeshes) group.add(g);
  return group;
}

function buildStartGantry(spline: TrackSpline, def: TrackDef): THREE.Group {
  const group = new THREE.Group();
  const s = spline.sampleAtDistance(0);
  const angle = Math.atan2(s.tangent.x, s.tangent.z);
  const accent = new THREE.Color(def.palette.accent);
  const structMat = new THREE.MeshStandardMaterial({ color: 0x11151f, metalness: 0.8, roughness: 0.25 });
  const glowMat = new THREE.MeshStandardMaterial({
    color: accent,
    emissive: accent,
    emissiveIntensity: 2.2,
    roughness: 0.3,
  });
  for (const side of [-1, 1]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 8.2, 1.1), structMat);
    pillar.position.copy(s.position).addScaledVector(s.right, side * (s.width / 2 + 1.6));
    pillar.position.y += 4.1;
    group.add(pillar);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.18, 6.6, 0.18), glowMat);
    strip.position.copy(pillar.position);
    strip.position.addScaledVector(s.right, side * 0.58);
    strip.position.addScaledVector(s.tangent, 0.58);
    group.add(strip);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(s.width + 5.2, 1.5, 1.25), structMat);
  beam.position.copy(s.position);
  beam.position.y += 8.1;
  beam.rotation.y = angle;
  group.add(beam);

  const banner = new THREE.Mesh(new THREE.BoxGeometry(s.width + 1.6, 2.1, 0.14), glowMat);
  banner.position.copy(beam.position);
  banner.position.y -= 1.6;
  banner.rotation.y = angle;
  group.add(banner);

  const lightCount = 5;
  for (let i = 0; i < lightCount; i++) {
    const light = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0x2a0e0e }),
    );
    light.position.copy(s.position).addScaledVector(s.right, (i - 2) * 1.7);
    light.position.y += 5.9;
    group.add(light);
  }
  return group;
}

function buildCity(spline: TrackSpline, def: TrackDef, rand: () => number): TrackScenery {
  const group = new THREE.Group();
  const panes: THREE.Mesh[] = [];
  const buildingGeo = new THREE.BoxGeometry(1, 1, 1);
  const cityMat = new THREE.MeshStandardMaterial({ color: 0x27304a, metalness: 0.5, roughness: 0.5 });
  const neonMats = [0x22e6ff, 0xb14cff, 0xff2f8d, 0xffd166].map(
    (c) => new THREE.MeshBasicMaterial({ color: c }),
  );
  const count = 240;
  const windowGeo = new THREE.PlaneGeometry(1, 1);
  const footprint: { m: THREE.Matrix4; p: THREE.Vector3; w: number; h: number; side: number; right: THREE.Vector3 }[] = [];
  // A building may sit beside one stretch of track but still block another stretch
  // where the circuit loops back on itself, so every candidate is checked against
  // the whole spline before it is accepted.
  const isClear = (p: THREE.Vector3, radius: number) => {
    for (const sample of spline.samples) {
      const dx = p.x - sample.position.x;
      const dz = p.z - sample.position.z;
      const min = radius + sample.width * 0.5 + 5;
      if (dx * dx + dz * dz < min * min) return false;
    }
    return true;
  };
  for (let i = 0; i < count; i++) {
    const t = rand();
    const s = spline.sampleAtDistance(t * spline.totalLength);
    const side = rand() > 0.5 ? 1 : -1;
    const h = 12 + Math.pow(rand(), 1.7) * 110;
    const w = 6 + rand() * 20;
    const d = 6 + rand() * 20;
    const radius = Math.hypot(w, d) * 0.5;
    let p: THREE.Vector3 | null = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      const dist = s.width / 2 + 12 + attempt * 9 + rand() * 62;
      const candidate = s.position.clone().addScaledVector(s.right, side * dist);
      if (isClear(candidate, radius)) {
        p = candidate;
        break;
      }
    }
    if (!p) continue;
    p.y += h / 2 - 1;
    const m = new THREE.Matrix4().compose(
      p,
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rand() * Math.PI, 0)),
      new THREE.Vector3(w, h, d),
    );
    footprint.push({ m, p: p.clone(), w, h, side, right: s.right.clone() });
  }
  const mesh = new THREE.InstancedMesh(buildingGeo, cityMat, Math.max(1, footprint.length));
  for (let i = 0; i < footprint.length; i++) {
    mesh.setMatrixAt(i, footprint[i].m);
    const { p, w, h, side, right } = footprint[i];
    if (rand() > 0.35) {
      const pane = new THREE.Mesh(windowGeo, neonMats[Math.floor(rand() * neonMats.length)]);
      pane.position.copy(p).addScaledVector(right, side * -(w / 2 + 1.5));
      pane.position.y += h * 0.18;
      pane.rotation.y = Math.atan2(right.x * side, right.z * side) + Math.PI / 2;
      pane.scale.set(w * 0.7, h * 0.08, 1);
      group.add(pane);
      panes.push(pane);
    }
  }
  mesh.count = footprint.length;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  group.add(mesh);

  // Towering skyline silhouettes far out.
  const skyGeo = new THREE.BoxGeometry(1, 1, 1);
  const skyMat = new THREE.MeshBasicMaterial({ color: 0x1a2140 });
  const skyMesh = new THREE.InstancedMesh(skyGeo, skyMat, 90);
  for (let i = 0; i < 90; i++) {
    const a = (i / 90) * Math.PI * 2;
    const r = 320 + rand() * 180;
    const h = 40 + rand() * 160;
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(Math.cos(a) * r, h / 2, Math.sin(a) * r),
      new THREE.Quaternion(),
      new THREE.Vector3(14 + rand() * 22, h, 14 + rand() * 22),
    );
    skyMesh.setMatrixAt(i, m);
  }
  group.add(skyMesh);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1400, 1400),
    new THREE.MeshStandardMaterial({ color: def.palette.ground, roughness: 0.3, metalness: 0.5 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.6;
  ground.receiveShadow = true;
  group.add(ground);

  return {
    group,
    panes,
    animated: (dt) => {
      const time = performance.now() * 0.001;
      for (let i = 0; i < panes.length; i++) {
        const mat = panes[i].material as THREE.MeshBasicMaterial;
        mat.opacity = 0.7 + Math.sin(time * 1.4 + i) * 0.3;
        mat.transparent = true;
      }
      void dt;
    },
  };
}

function buildCoast(spline: TrackSpline, def: TrackDef, rand: () => number): TrackScenery {
  const group = new THREE.Group();
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(1800, 1800, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x1f6f9e, roughness: 0.18, metalness: 0.55 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = -3.4;
  group.add(water);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(1500, 1500),
    new THREE.MeshStandardMaterial({ color: def.palette.ground, roughness: 1 }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.y = -0.8;
  sand.receiveShadow = true;
  group.add(sand);

  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.48, 7, 7);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6d4b2f, roughness: 1 });
  const leafGeo = new THREE.ConeGeometry(2.1, 1.2, 7);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f7a4b, roughness: 0.9 });
  const palms = 90;
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palms);
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, palms * 3);
  let leafIdx = 0;
  for (let i = 0; i < palms; i++) {
    const t = rand();
    const s = spline.sampleAtDistance(t * spline.totalLength);
    const side = rand() > 0.5 ? 1 : -1;
    const dist = s.width / 2 + 5 + rand() * 26;
    const p = s.position.clone().addScaledVector(s.right, side * dist);
    p.y += 3.4;
    const m = new THREE.Matrix4().compose(p, new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
    trunks.setMatrixAt(i, m);
    for (let k = 0; k < 3; k++) {
      const lm = new THREE.Matrix4().compose(
        new THREE.Vector3(p.x + Math.cos(k * 2) * 0.9, p.y + 3.3, p.z + Math.sin(k * 2) * 0.9),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2, k * 2, 0.2)),
        new THREE.Vector3(1.2, 1, 1.2),
      );
      leaves.setMatrixAt(leafIdx++, lm);
    }
  }
  trunks.castShadow = true;
  leaves.castShadow = true;
  group.add(trunks, leaves);

  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(70, 40),
    new THREE.MeshBasicMaterial({ color: 0xffd39b, transparent: true, opacity: 0.9 }),
  );
  sun.position.set(-420, 120, -520);
  sun.lookAt(0, 60, 0);
  group.add(sun);

  return { group, panes: [], animated: () => {} };
}

function buildForest(spline: TrackSpline, def: TrackDef, rand: () => number): TrackScenery {
  const group = new THREE.Group();
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1400, 1400, 1, 1),
    new THREE.MeshStandardMaterial({ color: def.palette.ground, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.7;
  ground.receiveShadow = true;
  group.add(ground);

  const trunkGeo = new THREE.CylinderGeometry(0.32, 0.62, 7, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4c3a2a, roughness: 1 });
  const canopyGeo = new THREE.ConeGeometry(3.4, 8.5, 7);
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0x225638, roughness: 0.95 });
  const canopyMat2 = new THREE.MeshStandardMaterial({ color: 0x2d6b41, roughness: 0.95 });
  const count = 320;
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
  const canopyA = new THREE.InstancedMesh(canopyGeo, canopyMat, count);
  const canopyB = new THREE.InstancedMesh(canopyGeo, canopyMat2, count);
  let bIdx = 0;
  for (let i = 0; i < count; i++) {
    const t = rand();
    const s = spline.sampleAtDistance(t * spline.totalLength);
    const side = rand() > 0.5 ? 1 : -1;
    const dist = s.width / 2 + 4 + rand() * 62;
    const p = s.position.clone().addScaledVector(s.right, side * dist);
    const scale = 0.7 + rand() * 0.9;
    p.y += 3.2 * scale - 0.4;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rand() * 3, 0));
    trunks.setMatrixAt(i, new THREE.Matrix4().compose(p, q, new THREE.Vector3(scale, scale, scale)));
    const cp = p.clone();
    cp.y += 5.4 * scale;
    const m = new THREE.Matrix4().compose(cp, q, new THREE.Vector3(scale, scale, scale));
    if (i % 2 === 0) canopyA.setMatrixAt(i, m);
    else {
      canopyB.setMatrixAt(bIdx++, m);
    }
  }
  canopyB.count = bIdx;
  trunks.castShadow = true;
  canopyA.castShadow = true;
  canopyB.castShadow = true;
  group.add(trunks, canopyA, canopyB);

  const mountainGeo = new THREE.ConeGeometry(1, 1, 5);
  const mountainMat = new THREE.MeshStandardMaterial({ color: 0x4a5d68, roughness: 0.95, flatShading: true });
  const mountains = new THREE.InstancedMesh(mountainGeo, mountainMat, 28);
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2 + rand();
    const r = 360 + rand() * 220;
    const h = 90 + rand() * 170;
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(Math.cos(a) * r, h / 2 - 8, Math.sin(a) * r),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rand() * 3, 0)),
      new THREE.Vector3(110 + rand() * 80, h, 110 + rand() * 80),
    );
    mountains.setMatrixAt(i, m);
  }
  group.add(mountains);

  return { group, panes: [], animated: () => {} };
}

function buildVolcano(spline: TrackSpline, def: TrackDef, rand: () => number): TrackScenery {
  const group = new THREE.Group();
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1400, 1400),
    new THREE.MeshStandardMaterial({ color: def.palette.ground, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.7;
  group.add(ground);

  const lava = new THREE.Mesh(
    new THREE.PlaneGeometry(1400, 1400),
    new THREE.MeshBasicMaterial({ color: 0xff3d00 }),
  );
  lava.rotation.x = -Math.PI / 2;
  lava.position.y = -1.05;
  group.add(lava);

  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x231a1a, roughness: 0.95, flatShading: true });
  const count = 300;
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, count);
  const glowMats = [0xff5a1f, 0xffcf5a].map((c) => new THREE.MeshBasicMaterial({ color: c }));
  for (let i = 0; i < count; i++) {
    const t = rand();
    const s = spline.sampleAtDistance(t * spline.totalLength);
    const side = rand() > 0.5 ? 1 : -1;
    const dist = s.width / 2 + 3 + rand() * 55;
    const p = s.position.clone().addScaledVector(s.right, side * dist);
    const sc = 1 + rand() * 5;
    p.y += sc * 0.5 - 0.4;
    const m = new THREE.Matrix4().compose(
      p,
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rand(), rand() * 3, rand())),
      new THREE.Vector3(sc, sc * (0.6 + rand() * 0.8), sc),
    );
    rocks.setMatrixAt(i, m);
    if (i % 9 === 0) {
      const glow = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), glowMats[i % 2]);
      glow.position.copy(p);
      glow.position.y += 0.3;
      group.add(glow);
    }
  }
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  group.add(rocks);

  const volcano = new THREE.Mesh(
    new THREE.ConeGeometry(170, 190, 9, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x1b1212, roughness: 1, flatShading: true, side: THREE.DoubleSide }),
  );
  volcano.position.set(-340, 45, -380);
  group.add(volcano);
  const crater = new THREE.PointLight(0xff4d00, 220, 600, 2);
  crater.position.set(-340, 150, -380);
  group.add(crater);

  return { group, panes: [], animated: () => {} };
}

function buildSkyline(spline: TrackSpline, def: TrackDef, rand: () => number): TrackScenery {
  const group = new THREE.Group();
  const couldMat = new THREE.MeshBasicMaterial({ color: 0xf2f8ff, transparent: true, opacity: 0.85 });
  const cloudGeo = new THREE.SphereGeometry(1, 8, 6);
  const clouds = new THREE.InstancedMesh(cloudGeo, couldMat, 160);
  for (let i = 0; i < 160; i++) {
    const a = rand() * Math.PI * 2;
    const r = 160 + rand() * 520;
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(Math.cos(a) * r, -22 + rand() * 12, Math.sin(a) * r),
      new THREE.Quaternion(),
      new THREE.Vector3(24 + rand() * 60, 5 + rand() * 8, 24 + rand() * 60),
    );
    clouds.setMatrixAt(i, m);
  }
  group.add(clouds);

  const towerGeo = new THREE.BoxGeometry(1, 1, 1);
  const towerMat = new THREE.MeshStandardMaterial({ color: 0x1a2a44, metalness: 0.6, roughness: 0.35 });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x47e6ff });
  const count = 70;
  const towers = new THREE.InstancedMesh(towerGeo, towerMat, count);
  for (let i = 0; i < count; i++) {
    const a = rand() * Math.PI * 2;
    const r = 210 + rand() * 200;
    const h = 80 + rand() * 200;
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(Math.cos(a) * r, h / 2 - 30, Math.sin(a) * r),
      new THREE.Quaternion(),
      new THREE.Vector3(14 + rand() * 20, h, 14 + rand() * 20),
    );
    towers.setMatrixAt(i, m);
    if (i % 3 === 0) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.5, h * 0.5, 0.5), glowMat);
      line.position.set(Math.cos(a) * r, h / 2 - 20, Math.sin(a) * r + 8);
      group.add(line);
      void def;
    }
  }
  group.add(towers);

  const platformGeo = new THREE.CylinderGeometry(1, 1, 0.6, 8);
  const platformMat = new THREE.MeshStandardMaterial({ color: 0x33405c, metalness: 0.7, roughness: 0.4 });
  const floats = new THREE.InstancedMesh(platformGeo, platformMat, 24);
  for (let i = 0; i < 24; i++) {
    const t = rand();
    const s = spline.sampleAtDistance(t * spline.totalLength);
    const p = s.position.clone().addScaledVector(s.right, (rand() > 0.5 ? 1 : -1) * (s.width / 2 + 14 + rand() * 20));
    p.y -= 6;
    floats.setMatrixAt(
      i,
      new THREE.Matrix4().compose(p, new THREE.Quaternion(), new THREE.Vector3(8 + rand() * 12, 1, 8 + rand() * 12)),
    );
  }
  group.add(floats);

  // Support pillars anchoring the elevated circuit to the cloud deck.
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x2a3550, metalness: 0.55, roughness: 0.5 });
  const pillarCount = 34;
  const pillars = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1.4, 1, 8), pillarMat, pillarCount);
  for (let i = 0; i < pillarCount; i++) {
    const s = spline.sampleAtDistance((i / pillarCount) * spline.totalLength);
    const h = Math.max(12, s.position.y + 44);
    pillars.setMatrixAt(
      i,
      new THREE.Matrix4().compose(
        new THREE.Vector3(s.position.x, s.position.y - h / 2 - 0.4, s.position.z),
        new THREE.Quaternion(),
        new THREE.Vector3(2.4, h, 2.4),
      ),
    );
  }
  group.add(pillars);

  return { group, panes: [], animated: () => {} };
}

function buildDesert(spline: TrackSpline, def: TrackDef, rand: () => number): TrackScenery {
  const group = new THREE.Group();
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1500, 1500),
    new THREE.MeshStandardMaterial({ color: def.palette.ground, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.6;
  ground.receiveShadow = true;
  group.add(ground);

  const mesaGeo = new THREE.CylinderGeometry(1, 1.2, 1, 6);
  const mesaMat = new THREE.MeshStandardMaterial({ color: 0x9a5c3c, roughness: 0.95, flatShading: true });
  const mesas = new THREE.InstancedMesh(mesaGeo, mesaMat, 60);
  for (let i = 0; i < 60; i++) {
    const t = rand();
    const s = spline.sampleAtDistance(t * spline.totalLength);
    const side = rand() > 0.5 ? 1 : -1;
    const p = s.position.clone().addScaledVector(s.right, side * (s.width / 2 + 18 + rand() * 90));
    const h = 8 + rand() * 36;
    p.y += h / 2 - 1;
    mesas.setMatrixAt(
      i,
      new THREE.Matrix4().compose(
        p,
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rand() * 3, 0)),
        new THREE.Vector3(4 + rand() * 12, h, 4 + rand() * 12),
      ),
    );
  }
  group.add(mesas);

  const cactusGeo = new THREE.CapsuleGeometry(0.6, 3.4, 4, 7);
  const cactusMat = new THREE.MeshStandardMaterial({ color: 0x3e6b3a, roughness: 0.9 });
  const cacti = new THREE.InstancedMesh(cactusGeo, cactusMat, 120);
  for (let i = 0; i < 120; i++) {
    const t = rand();
    const s = spline.sampleAtDistance(t * spline.totalLength);
    const side = rand() > 0.5 ? 1 : -1;
    const p = s.position.clone().addScaledVector(s.right, side * (s.width / 2 + 5 + rand() * 40));
    const sc = 0.7 + rand() * 0.9;
    p.y += 2 * sc;
    cacti.setMatrixAt(i, new THREE.Matrix4().compose(p, new THREE.Quaternion(), new THREE.Vector3(sc, sc, sc)));
  }
  cacti.castShadow = true;
  group.add(cacti);
  return { group, panes: [], animated: () => {} };
}

export function buildTrack(def: TrackDef): { spline: TrackSpline; group: THREE.Group; scenery: TrackScenery } {
  const spline = new TrackSpline(def);
  const group = new THREE.Group();
  const rand = seededRandom(
    def.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 7),
  );
  group.add(buildRoad(spline, def));
  group.add(buildBarriers(spline, def));
  group.add(buildStartGantry(spline, def));

  let scenery: TrackScenery;
  switch (def.theme) {
    case 'city':
      scenery = buildCity(spline, def, rand);
      break;
    case 'coast':
      scenery = buildCoast(spline, def, rand);
      break;
    case 'forest':
      scenery = buildForest(spline, def, rand);
      break;
    case 'volcano':
      scenery = buildVolcano(spline, def, rand);
      break;
    case 'skyline':
      scenery = buildSkyline(spline, def, rand);
      break;
    default:
      scenery = buildDesert(spline, def, rand);
  }
  group.add(scenery.group);

  // Boost pads.
  for (const t of def.boostPads) {
    const s = spline.sampleAtDistance(t * spline.totalLength);
    const mat = new THREE.MeshBasicMaterial({ color: 0x35e6ff, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(s.width * 0.72, 4), mat);
    pad.position.copy(s.position);
    pad.position.y += 0.06;
    pad.rotation.x = -Math.PI / 2;
    pad.rotation.z = Math.atan2(s.tangent.z, s.tangent.x) - Math.PI / 2;
    group.add(pad);
    const arrowMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
    for (let k = -1; k <= 1; k++) {
      const arrow = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.6), arrowMat);
      arrow.position.copy(s.position).addScaledVector(s.tangent, k * 1.1);
      arrow.position.y += 0.08;
      arrow.rotation.x = -Math.PI / 2;
      arrow.rotation.z = Math.atan2(s.tangent.z, s.tangent.x) - Math.PI / 2;
      group.add(arrow);
    }
  }
  // Jump ramps.
  for (const t of def.jumpPads) {
    const s = spline.sampleAtDistance(t * spline.totalLength);
    const ramp = new THREE.Mesh(
      new THREE.BoxGeometry(s.width * 0.7, 0.18, 5),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(def.palette.secondary), emissive: new THREE.Color(def.palette.secondary).multiplyScalar(0.4) }),
    );
    ramp.position.copy(s.position);
    ramp.position.y += 0.1;
    ramp.rotation.y = Math.atan2(s.tangent.x, s.tangent.z);
    ramp.rotation.x = -0.12;
    group.add(ramp);
  }

  return { spline, group, scenery };
}
