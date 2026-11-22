import * as THREE from 'three';

interface Particle {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
  velocity: THREE.Vector3;
  spin: THREE.Vector3;
  startScale: number;
  growth: number;
  fade: number;
}

interface SparkParticle {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
  velocity: THREE.Vector3;
  gravity: number;
}

export class EffectsManager {
  private scene: THREE.Scene;
  private group = new THREE.Group();
  private smoke: Particle[] = [];
  private sparks: SparkParticle[] = [];
  private pool: THREE.Mesh[] = [];
  private sparkPool: THREE.Mesh[] = [];
  private smokeMat: THREE.MeshBasicMaterial;
  private sparkMat: THREE.MeshBasicMaterial;
  private smokeGeo = new THREE.SphereGeometry(0.3, 7, 6);
  private sparkGeo = new THREE.BoxGeometry(0.05, 0.05, 0.22);
  private enabled = true;
  private particleEnabled = true;
  private emitAccumulator = 0;
  private boostAccumulator = 0;
  private quality: 'low' | 'medium' | 'high' = 'high';
  private burstRings: { mesh: THREE.Mesh; life: number; maxLife: number }[] = [];
  private ringGeo = new THREE.RingGeometry(0.6, 0.86, 26);
  private maxParticles = 120;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    scene.add(this.group);
    this.smokeMat = new THREE.MeshBasicMaterial({
      color: 0xcfd6e4,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
    });
    this.sparkMat = new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.9, depthWrite: false });
  }

  configure(opts: { effects: boolean; particles: boolean; quality: 'low' | 'medium' | 'high' }) {
    this.enabled = opts.effects;
    this.particleEnabled = opts.particles;
    this.quality = opts.quality;
    this.maxParticles = opts.quality === 'low' ? 40 : opts.quality === 'medium' ? 80 : 140;
    this.group.visible = this.enabled;
  }

  private getSmoke(): THREE.Mesh {
    let mesh = this.pool.pop();
    if (!mesh) {
      mesh = new THREE.Mesh(this.smokeGeo, this.smokeMat.clone());
      mesh.renderOrder = 3;
    }
    (mesh.material as THREE.MeshBasicMaterial).opacity = 0.34;
    (mesh.material as THREE.MeshBasicMaterial).color.set(0xcfd6e4);
    mesh.visible = true;
    this.group.add(mesh);
    return mesh;
  }

  private getSpark(): THREE.Mesh {
    let mesh = this.sparkPool.pop();
    if (!mesh) {
      mesh = new THREE.Mesh(this.sparkGeo, this.sparkMat.clone());
      mesh.renderOrder = 4;
    }
    mesh.visible = true;
    this.group.add(mesh);
    return mesh;
  }

  emitDriftSmoke(pos: THREE.Vector3, heading: number, intensity: number, color = 0xcfd6e4) {
    if (!this.particleEnabled || !this.enabled) return;
    if (this.smoke.length > this.maxParticles) return;
    const side = new THREE.Vector3(Math.cos(heading), 0, -Math.sin(heading));
    for (const s of [-1, 1]) {
      const mesh = this.getSmoke();
      mesh.position.copy(pos).addScaledVector(side, s * 0.72);
      mesh.position.y = pos.y + 0.12;
      const scale = 0.4 + Math.random() * 0.4;
      mesh.scale.setScalar(scale);
      (mesh.material as THREE.MeshBasicMaterial).color.set(color);
      this.smoke.push({
        mesh,
        life: 0.9 + Math.random() * 0.4,
        maxLife: 1.3,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 1.4 - Math.sin(heading) * 1.4,
          0.5 + Math.random() * 0.7,
          (Math.random() - 0.5) * 1.4 - Math.cos(heading) * 1.4,
        ),
        spin: new THREE.Vector3(Math.random() * 2, Math.random() * 2, Math.random() * 2),
        startScale: scale,
        growth: 1.5 + intensity * 0.9,
        fade: 0.34,
      });
    }
  }

  emitSparks(pos: THREE.Vector3, heading: number, count: number, color = 0xffd166) {
    if (!this.particleEnabled || !this.enabled) return;
    const n = Math.min(count, this.quality === 'low' ? 4 : 12);
    for (let i = 0; i < n; i++) {
      if (this.sparks.length > this.maxParticles) break;
      const mesh = this.getSpark();
      mesh.position.copy(pos);
      mesh.position.y += 0.12;
      (mesh.material as THREE.MeshBasicMaterial).color.set(color);
      const angle = heading + Math.PI + (Math.random() - 0.5) * 1.5;
      const speed = 3 + Math.random() * 7;
      this.sparks.push({
        mesh,
        life: 0.35 + Math.random() * 0.4,
        maxLife: 0.75,
        velocity: new THREE.Vector3(Math.sin(angle) * speed, 1 + Math.random() * 3.4, Math.cos(angle) * speed),
        gravity: 14,
      });
    }
  }

  emitBoostTrail(pos: THREE.Vector3, heading: number, color = 0x62e8ff) {
    if (!this.particleEnabled || !this.enabled) return;
    this.boostAccumulator += 1;
    if (this.boostAccumulator < (this.quality === 'low' ? 4 : 2)) return;
    this.boostAccumulator = 0;
    if (this.smoke.length > this.maxParticles) return;
    const mesh = this.getSmoke();
    const back = new THREE.Vector3(-Math.sin(heading), 0.1, -Math.cos(heading));
    mesh.position.copy(pos).addScaledVector(back, 1.6);
    mesh.scale.setScalar(0.3);
    (mesh.material as THREE.MeshBasicMaterial).color.set(color);
    this.smoke.push({
      mesh,
      life: 0.5,
      maxLife: 0.5,
      velocity: back.clone().multiplyScalar(6).add(new THREE.Vector3((Math.random() - 0.5) * 1.2, 0.6, (Math.random() - 0.5) * 1.2)),
      spin: new THREE.Vector3(1, 1, 1),
      startScale: 0.3,
      growth: 2.4,
      fade: 0.5,
    });
  }

  emitImpact(pos: THREE.Vector3, color = 0xffffff, strength = 1) {
    if (!this.enabled) return;
    const ring = new THREE.Mesh(
      this.ringGeo,
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide }),
    );
    ring.position.copy(pos);
    ring.position.y += 0.5;
    ring.rotation.x = -Math.PI / 2;
    this.group.add(ring);
    this.burstRings.push({ mesh: ring, life: 0.4 + strength * 0.2, maxLife: 0.4 + strength * 0.2 });
    this.emitSparks(pos, 0, Math.round(6 + strength * 10), color);
  }

  emitDust(pos: THREE.Vector3, color: number) {
    if (!this.particleEnabled || !this.enabled) return;
    this.emitAccumulator += 1;
    if (this.emitAccumulator < 5) return;
    this.emitAccumulator = 0;
    if (this.smoke.length > this.maxParticles) return;
    const mesh = this.getSmoke();
    mesh.position.copy(pos);
    mesh.position.y += 0.1;
    mesh.scale.setScalar(0.5);
    (mesh.material as THREE.MeshBasicMaterial).color.set(color);
    this.smoke.push({
      mesh,
      life: 0.7,
      maxLife: 0.7,
      velocity: new THREE.Vector3((Math.random() - 0.5) * 2, 0.8 + Math.random(), (Math.random() - 0.5) * 2),
      spin: new THREE.Vector3(1, 1, 1),
      startScale: 0.5,
      growth: 1.6,
      fade: 0.28,
    });
  }

  update(dt: number) {
    for (let i = this.smoke.length - 1; i >= 0; i--) {
      const p = this.smoke[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.mesh.visible = false;
        this.group.remove(p.mesh);
        this.pool.push(p.mesh);
        this.smoke.splice(i, 1);
        continue;
      }
      p.mesh.position.addScaledVector(p.velocity, dt);
      p.velocity.multiplyScalar(1 - dt * 1.1);
      p.velocity.y += dt * 0.35;
      p.mesh.rotation.x += p.spin.x * dt;
      p.mesh.rotation.y += p.spin.y * dt;
      const t = 1 - p.life / p.maxLife;
      p.mesh.scale.setScalar(p.startScale * (1 + t * p.growth));
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = p.fade * (1 - t);
    }
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.life -= dt;
      if (s.life <= 0) {
        s.mesh.visible = false;
        this.group.remove(s.mesh);
        this.sparkPool.push(s.mesh);
        this.sparks.splice(i, 1);
        continue;
      }
      s.mesh.position.addScaledVector(s.velocity, dt);
      s.velocity.y -= s.gravity * dt;
      s.mesh.rotation.x += dt * 12;
      s.mesh.rotation.z += dt * 9;
      const t = 1 - s.life / s.maxLife;
      s.mesh.scale.setScalar(1 - t * 0.7);
      (s.mesh.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - t);
    }
    for (let i = this.burstRings.length - 1; i >= 0; i--) {
      const r = this.burstRings[i];
      r.life -= dt;
      if (r.life <= 0) {
        this.group.remove(r.mesh);
        (r.mesh.material as THREE.Material).dispose();
        this.burstRings.splice(i, 1);
        continue;
      }
      const t = 1 - r.life / r.maxLife;
      r.mesh.scale.setScalar(1 + t * 3.2);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = 0.75 * (1 - t);
    }
  }

  clear() {
    for (const p of this.smoke) {
      this.group.remove(p.mesh);
      this.pool.push(p.mesh);
    }
    for (const s of this.sparks) {
      this.group.remove(s.mesh);
      this.sparkPool.push(s.mesh);
    }
    for (const r of this.burstRings) {
      this.group.remove(r.mesh);
      (r.mesh.material as THREE.Material).dispose();
    }
    this.smoke = [];
    this.sparks = [];
    this.burstRings = [];
  }

  dispose() {
    this.clear();
    for (const m of this.pool) (m.material as THREE.Material).dispose();
    for (const m of this.sparkPool) (m.material as THREE.Material).dispose();
    this.smokeGeo.dispose();
    this.sparkGeo.dispose();
    this.ringGeo.dispose();
    this.smokeMat.dispose();
    this.sparkMat.dispose();
    this.scene.remove(this.group);
  }
}
