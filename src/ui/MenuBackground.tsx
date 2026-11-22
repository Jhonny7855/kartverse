import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { Customization, KartDef } from '../data/types';
import { KartModel } from '../game/KartModel';

interface MenuBackgroundProps {
  def: KartDef;
  customization: Customization;
  accent: string;
  reducedMotion: boolean;
  quality: 'low' | 'medium' | 'high';
}

export function MenuBackground({ def, customization, accent, reducedMotion, quality }: MenuBackgroundProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: quality !== 'low', alpha: true, powerPreference: 'high-performance' });
    } catch {
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === 'high' ? 2 : 1.3));
    const w = host.clientWidth || window.innerWidth;
    const h = host.clientHeight || window.innerHeight;
    renderer.setSize(w, h);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = quality === 'high';
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.className = 'menu-bg-canvas';
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 240);
    const target = new THREE.Vector3(0, 0.6, 0);

    const hemi = new THREE.HemisphereLight(0xc9d8ff, 0x0a0d12, 1.1);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(5, 9, 6);
    key.castShadow = quality === 'high';
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -8;
    key.shadow.camera.right = 8;
    key.shadow.camera.top = 8;
    key.shadow.camera.bottom = -8;
    scene.add(key);
    const rim = new THREE.DirectionalLight(new THREE.Color(accent), 2.8);
    rim.position.set(-6, 4, -7);
    scene.add(rim);
    const fill = new THREE.DirectionalLight(0x2fd6ff, 1.4);
    fill.position.set(6, 2, -4);
    scene.add(fill);
    const spot = new THREE.PointLight(new THREE.Color(accent), 16, 16, 2);
    spot.position.set(0, 2.4, -2.5);
    scene.add(spot);

    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(2.9, 3.1, 0.14, 72),
      new THREE.MeshStandardMaterial({ color: 0x0e1219, metalness: 0.9, roughness: 0.2 }),
    );
    platform.position.y = -0.08;
    platform.receiveShadow = true;
    scene.add(platform);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.94, 0.022, 8, 100),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(accent) }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.005;
    scene.add(ring);
    const ring2 = new THREE.Mesh(
      new THREE.TorusGeometry(2.2, 0.008, 6, 90),
      new THREE.MeshBasicMaterial({ color: 0x2fd6ff, transparent: true, opacity: 0.5 }),
    );
    ring2.rotation.x = Math.PI / 2;
    ring2.position.y = 0.008;
    scene.add(ring2);

    const grid = new THREE.GridHelper(70, 40, 0x161e2a, 0x0e141d);
    grid.position.y = -0.16;
    scene.add(grid);

    // Neon pylons for depth.
    const pylonMat = new THREE.MeshStandardMaterial({ color: 0x0b0f16, metalness: 0.8, roughness: 0.3 });
    const pylonGlow = new THREE.MeshBasicMaterial({ color: new THREE.Color(accent), transparent: true, opacity: 0.85 });
    const pylons: THREE.Mesh[] = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const r = 9 + (i % 3) * 3.4;
      const hgt = 2.4 + (i % 4) * 1.5;
      const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.24, hgt, 0.24), pylonMat);
      pylon.position.set(Math.cos(a) * r, hgt / 2 - 0.1, Math.sin(a) * r);
      scene.add(pylon);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.05, hgt * 0.86, 0.05), pylonGlow);
      strip.position.copy(pylon.position);
      strip.position.y += 0.1;
      strip.position.x += Math.cos(a) * 0.14;
      strip.position.z += Math.sin(a) * 0.14;
      scene.add(strip);
      pylons.push(strip);
    }

    // Floating dust motes.
    const moteCount = quality === 'low' ? 60 : 180;
    const moteGeo = new THREE.BufferGeometry();
    const motePos = new Float32Array(moteCount * 3);
    for (let i = 0; i < moteCount; i++) {
      motePos[i * 3] = (Math.random() - 0.5) * 26;
      motePos[i * 3 + 1] = Math.random() * 8;
      motePos[i * 3 + 2] = (Math.random() - 0.5) * 26;
    }
    moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
    const moteMat = new THREE.PointsMaterial({
      color: new THREE.Color(accent),
      size: 0.045,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const motes = new THREE.Points(moteGeo, moteMat);
    scene.add(motes);

    let model: KartModel | null = null;
    try {
      model = new KartModel(def, customization, { shadows: quality === 'high', simple: quality === 'low' });
      model.root.position.y = 0.02;
      scene.add(model.root);
    } catch {
      model = null;
    }

    let angle = 0.6;
    let raf = 0;
    let disposed = false;
    const clock = new THREE.Clock();
    const baseAngle = Math.atan2(-1, -1);
    const onResize = () => {
      const cw = host.clientWidth || window.innerWidth;
      const ch = host.clientHeight || window.innerHeight;
      renderer.setSize(cw, ch);
      camera.aspect = cw / ch;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);
    const observer = new ResizeObserver(onResize);
    observer.observe(host);

    const loop = () => {
      if (disposed) return;
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, clock.getDelta());
      if (!reducedMotion) angle += dt * 0.18;
      const dist = 7.4;
      const camAngle = baseAngle + Math.sin(angle * 0.5) * 0.34;
      camera.position.set(Math.cos(camAngle) * dist, 2.35 + Math.sin(angle * 0.7) * 0.16, Math.sin(camAngle) * dist);
      camera.lookAt(target);
      if (model) {
        model.root.rotation.y = angle * 0.55;
        model.update(dt, {
          speed: 0,
          steer: Math.sin(angle * 0.8) * 0.12,
          drift: 0,
          throttle: 0,
          braking: false,
          boosting: false,
          airborne: false,
          time: performance.now() * 0.001,
        });
      }
      spot.intensity = 12 + Math.sin(performance.now() * 0.0013) * 5;
      for (let i = 0; i < pylons.length; i++) {
        const m = pylons[i].material as THREE.MeshBasicMaterial;
        m.opacity = 0.5 + Math.sin(performance.now() * 0.001 + i) * 0.35;
      }
      const pos = motes.geometry.attributes.position as THREE.BufferAttribute;
      if (!reducedMotion) {
        for (let i = 0; i < moteCount; i++) {
          let y = pos.getY(i) + dt * 0.16;
          if (y > 8) y = 0;
          pos.setY(i, y);
        }
        pos.needsUpdate = true;
      }
      motes.rotation.y += dt * 0.02;
      renderer.render(scene, camera);
    };
    loop();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      observer.disconnect();
      if (model) {
        scene.remove(model.root);
        model.dispose();
      }
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = mesh.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else if (mat && (mat as THREE.Material).dispose) (mat as THREE.Material).dispose();
      });
      renderer.dispose();
      if (renderer.domElement.parentElement) renderer.domElement.parentElement.removeChild(renderer.domElement);
    };
  }, [def, customization, accent, reducedMotion, quality]);

  if (failed) {
    return <div className="menu-bg" aria-hidden="true" />;
  }
  return <div className="menu-bg" ref={hostRef} aria-hidden="true" />;
}
