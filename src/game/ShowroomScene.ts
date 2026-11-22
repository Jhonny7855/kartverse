import * as THREE from 'three';
import type { Customization, KartDef, TrackDef } from '../data/types';
import { KartModel } from './KartModel';
import { buildTrack } from './TrackBuilder';

export class ShowroomScene {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private model: KartModel | null = null;
  private raf = 0;
  private clock = new THREE.Clock();
  private disposed = false;
  private yaw = 0.7;
  private targetYaw = 0.7;
  private pitch = 0.36;
  private distance = 7.4;
  private autoRotate = true;
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private floor: THREE.Mesh;
  private grid: THREE.GridHelper;
  private lights: THREE.Light[] = [];
  private accentLight: THREE.PointLight;
  private resizeObserver: ResizeObserver;
  private quality: 'low' | 'medium' | 'high';
  private trackPreview: THREE.Group | null = null;
  private def: KartDef | null = null;
  private handlers: {
    down: (e: PointerEvent) => void;
    move: (e: PointerEvent) => void;
    up: () => void;
    wheel: (e: WheelEvent) => void;
    enter: () => void;
    leave: () => void;
  };

  constructor(container: HTMLElement, quality: 'low' | 'medium' | 'high' = 'high') {
    this.container = container;
    this.quality = quality;
    this.renderer = new THREE.WebGLRenderer({ antialias: quality !== 'low', alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === 'high' ? 2 : 1.35));
    this.renderer.setSize(container.clientWidth || 600, container.clientHeight || 500);
    this.renderer.shadowMap.enabled = quality !== 'low';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.domElement.className = 'showroom-canvas';
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(38, (container.clientWidth || 1) / (container.clientHeight || 1), 0.1, 200);
    this.scene.background = null;

    const hemi = new THREE.HemisphereLight(0xdfe9ff, 0x1a1d26, 1.2);
    this.scene.add(hemi);
    this.lights.push(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 2.6);
    key.position.set(4, 8, 5);
    key.castShadow = quality !== 'low';
    key.shadow.mapSize.set(quality === 'high' ? 1024 : 512, quality === 'high' ? 1024 : 512);
    key.shadow.camera.left = -6;
    key.shadow.camera.right = 6;
    key.shadow.camera.top = 6;
    key.shadow.camera.bottom = -6;
    this.scene.add(key);
    this.lights.push(key);
    const rim = new THREE.DirectionalLight(0x47e6ff, 2.1);
    rim.position.set(-5, 3, -6);
    this.scene.add(rim);
    this.lights.push(rim);
    const fill = new THREE.DirectionalLight(0xff7a3d, 1.1);
    fill.position.set(-2, 2, 6);
    this.scene.add(fill);
    this.lights.push(fill);
    this.accentLight = new THREE.PointLight(0xff5a2e, 12, 12, 2);
    this.accentLight.position.set(0, 1.4, -3);
    this.scene.add(this.accentLight);

    this.floor = new THREE.Mesh(
      new THREE.CylinderGeometry(3.4, 3.6, 0.16, 64),
      new THREE.MeshStandardMaterial({ color: 0x14171f, metalness: 0.82, roughness: 0.24 }),
    );
    this.floor.position.y = -0.1;
    this.floor.receiveShadow = true;
    this.scene.add(this.floor);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(3.42, 0.035, 8, 90),
      new THREE.MeshBasicMaterial({ color: 0xff5a2e }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.02;
    this.scene.add(ring);
    const ring2 = new THREE.Mesh(
      new THREE.TorusGeometry(2.6, 0.012, 6, 80),
      new THREE.MeshBasicMaterial({ color: 0x47e6ff, transparent: true, opacity: 0.6 }),
    );
    ring2.rotation.x = Math.PI / 2;
    ring2.position.y = 0;
    this.scene.add(ring2);
    this.grid = new THREE.GridHelper(30, 30, 0x1d2431, 0x141a24);
    this.grid.position.y = -0.19;
    this.scene.add(this.grid);

    this.handlers = {
      down: (e: PointerEvent) => {
        this.dragging = true;
        this.autoRotate = false;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        this.renderer.domElement.setPointerCapture(e.pointerId);
      },
      move: (e: PointerEvent) => {
        if (!this.dragging) return;
        const dx = e.clientX - this.lastX;
        const dy = e.clientY - this.lastY;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        this.targetYaw -= dx * 0.008;
        this.pitch = Math.min(0.7, Math.max(-0.05, this.pitch + dy * 0.004));
      },
      up: () => {
        this.dragging = false;
      },
      wheel: (e: WheelEvent) => {
        e.preventDefault();
        this.distance = Math.min(12, Math.max(4.2, this.distance + e.deltaY * 0.0035));
      },
      enter: () => {
        this.autoRotate = true;
      },
      leave: () => {
        this.dragging = false;
      },
    };
    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', this.handlers.down);
    el.addEventListener('pointermove', this.handlers.move);
    el.addEventListener('pointerup', this.handlers.up);
    el.addEventListener('pointercancel', this.handlers.up);
    el.addEventListener('wheel', this.handlers.wheel, { passive: false });
    el.addEventListener('pointerleave', this.handlers.leave);
    el.addEventListener('pointerenter', this.handlers.enter);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.clock.start();
    this.loop();
  }

  setKart(def: KartDef, customization: Customization) {
    if (this.model) {
      this.scene.remove(this.model.root);
      this.model.dispose();
      this.model = null;
    }
    this.def = def;
    this.model = new KartModel(def, customization, { shadows: this.quality !== 'low' });
    this.model.root.position.y = 0.02;
    this.scene.add(this.model.root);
  }

  setColor(customization: Customization) {
    this.model?.applyCustomization(customization);
  }

  setTrackPreview(def: TrackDef | null) {
    if (this.trackPreview) {
      this.scene.remove(this.trackPreview);
      this.trackPreview.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
      });
      this.trackPreview = null;
    }
    if (!def) return;
    const built = buildTrack(def);
    const group = new THREE.Group();
    // Road-only preview: hide scenery for performance and clarity.
    built.group.children.forEach((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.InstancedMesh) {
        const clone = child.clone();
        clone.position.y -= 0.0;
        group.add(clone);
      }
    });
    const box = new THREE.Box3().setFromObject(group);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const scale = 4.6 / Math.max(size.x, size.z);
    group.scale.setScalar(scale);
    group.position.sub(center.multiplyScalar(scale));
    group.position.y = 0.02;
    group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        const mat = mesh.material as THREE.Material;
        if (mat) {
          const m = mat.clone() as THREE.MeshStandardMaterial;
          m.transparent = true;
          m.opacity = 0.9;
          mesh.material = m;
        }
      }
    });
    this.trackPreview = group;
    this.scene.add(group);
    this.floor.visible = false;
    this.grid.visible = true;
  }

  clearTrackPreview() {
    this.setTrackPreview(null);
    this.floor.visible = true;
  }

  resetView() {
    this.targetYaw = 0.7;
    this.pitch = 0.36;
    this.distance = 7.4;
    this.autoRotate = true;
  }

  setQuality(quality: 'low' | 'medium' | 'high') {
    this.quality = quality;
    this.renderer.shadowMap.enabled = quality !== 'low';
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === 'high' ? 2 : 1.35));
  }

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    if (this.autoRotate) this.targetYaw += dt * 0.26;
    this.yaw += (this.targetYaw - this.yaw) * Math.min(1, dt * 6);
    const camX = Math.sin(this.yaw) * Math.cos(this.pitch) * this.distance;
    const camZ = Math.cos(this.yaw) * Math.cos(this.pitch) * this.distance;
    const camY = Math.sin(this.pitch) * this.distance + 1.05;
    this.camera.position.set(camX, camY, camZ);
    this.camera.lookAt(0, 0.72, 0);
    if (this.model) {
      this.model.update(dt, {
        speed: 0,
        steer: 0,
        drift: 0,
        throttle: 0,
        braking: false,
        boosting: false,
        airborne: false,
        time: performance.now() * 0.001,
      });
      this.model.root.rotation.y = Math.sin(performance.now() * 0.0002) * 0.02;
    }
    this.accentLight.intensity = 9 + Math.sin(performance.now() * 0.0012) * 3;
    this.renderer.render(this.scene, this.camera);
  };

  private resize() {
    const w = this.container.clientWidth || 600;
    const h = this.container.clientHeight || 500;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    const el = this.renderer.domElement;
    el.removeEventListener('pointerdown', this.handlers.down);
    el.removeEventListener('pointermove', this.handlers.move);
    el.removeEventListener('pointerup', this.handlers.up);
    el.removeEventListener('pointercancel', this.handlers.up);
    el.removeEventListener('wheel', this.handlers.wheel);
    el.removeEventListener('pointerleave', this.handlers.leave);
    el.removeEventListener('pointerenter', this.handlers.enter);
    this.resizeObserver.disconnect();
    if (this.model) {
      this.scene.remove(this.model.root);
      this.model.dispose();
      this.model = null;
    }
    this.renderer.dispose();
    if (el.parentElement) el.parentElement.removeChild(el);
    void this.def;
  }
}
