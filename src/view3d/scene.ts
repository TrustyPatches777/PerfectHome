/**
 * The Three.js side of the 3D view: turns the pure parts (build.ts) into meshes, lights them with the sun and the lamps,
 * and runs the camera (orbit around the house, or walking through it). No React in here; View3D.tsx drives it.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { patternFor, type PatternKind } from '../patterns';
import type { Design } from '../model';
import { darkness, goldenHour, type SunPosition } from '../sun';
import { sceneChunks, sceneExtent, type BuildOptions } from './build';
import type { Part } from './parts';

const MAX_LAMPS = 6;
const EYE = 1.6;

interface Built {
  deps: unknown[];
  group: THREE.Group;
  lamps: { x: number; y: number; z: number; intensity: number; dist: number; color: string }[];
}

export interface SunSettings {
  sun: SunPosition;
  /** Degrees clockwise from "up" on the plan to true north. */
  north: number;
  shadows: boolean;
}

export class Scene3D {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
  private controls: OrbitControls;
  private world = new THREE.Group();
  private built = new Map<string, Built>();
  private sunLight = new THREE.DirectionalLight('#ffffff', 2);
  private sky = new THREE.HemisphereLight('#dbeafe', '#cfd8c4', 0.8);
  private lampLights: THREE.PointLight[] = [];
  private materials = new Map<string, THREE.MeshStandardMaterial>();
  private glowMaterials: THREE.MeshStandardMaterial[] = [];
  private textures = new Map<string, THREE.Texture>();
  private geo = { box: new THREE.BoxGeometry(1, 1, 1), sphere: new THREE.SphereGeometry(1, 20, 14), cyl: new Map<string, THREE.CylinderGeometry>() };
  private dirty = true;
  private raf = 0;
  private extent = { cx: 0, cz: 0, radius: 8, top: 3 };
  private dark = 0;
  private floorY = 0;

  // walking
  mode: 'orbit' | 'walk' = 'orbit';
  private yaw = 0;
  private pitch = 0;
  private keys = new Set<string>();
  private lastTime = 0;
  private saved: { pos: THREE.Vector3; target: THREE.Vector3 } | null = null;

  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.tabIndex = 0;
    this.renderer.domElement.dataset.testid = 'view3d-canvas';
    host.appendChild(this.renderer.domElement);

    this.scene.add(this.world, this.sky, this.sunLight, this.sunLight.target);
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.bias = -0.0004;
    this.sunLight.shadow.normalBias = 0.03;
    for (let i = 0; i < MAX_LAMPS; i++) {
      const l = new THREE.PointLight('#ffd98a', 0, 6, 1.6);
      l.visible = false;
      this.lampLights.push(l);
      this.scene.add(l);
    }

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.02;
    this.controls.addEventListener('change', () => (this.dirty = true));

    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', this.onDown);
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKey);
    this.resize();
    this.loop(0);
  }

  // ---- size, loop -------------------------------------------------------------------------------------------------

  resize() {
    const w = Math.max(1, this.host.clientWidth);
    const h = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.dirty = true;
  }

  private loop = (t: number) => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.1, (t - this.lastTime) / 1000);
    this.lastTime = t;
    if (this.mode === 'walk') this.walk(dt);
    else if (this.controls.update()) this.dirty = true;
    if (this.dirty) {
      this.dirty = false;
      this.renderer.render(this.scene, this.camera);
    }
  };

  /** Draw right now (tests and image export). */
  renderNow() {
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKey);
    this.renderer.domElement.removeEventListener('pointerdown', this.onDown);
    this.controls.dispose();
    for (const b of this.built.values()) this.disposeGroup(b.group);
    this.geo.box.dispose();
    this.geo.sphere.dispose();
    this.geo.cyl.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
    this.textures.forEach((t) => t.dispose());
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  // ---- content -------------------------------------------------------------------------------------------------------

  /** Bring the meshes in line with the design: only chunks whose inputs changed are rebuilt. */
  setDesign(d: Design, opts: BuildOptions & { floorElevation?: number }) {
    const specs = sceneChunks(d, opts);
    const keep = new Set(specs.map((s) => s.key));
    for (const [key, b] of this.built) {
      if (keep.has(key)) continue;
      this.world.remove(b.group);
      this.disposeGroup(b.group);
      this.built.delete(key);
    }
    for (const s of specs) {
      const old = this.built.get(s.key);
      if (old && old.deps.length === s.deps.length && old.deps.every((v, i) => v === s.deps[i])) continue;
      if (old) {
        this.world.remove(old.group);
        this.disposeGroup(old.group);
      }
      this.built.set(s.key, this.makeChunk(s.deps, s.make()));
    }
    this.extent = sceneExtent(d);
    this.floorY = opts.floorElevation ?? 0;
    this.updateLamps();
    this.updateShadowCamera();
    this.dirty = true;
  }

  private makeChunk(deps: unknown[], parts: Part[]): Built {
    const group = new THREE.Group();
    const lamps: Built['lamps'] = [];
    for (const p of parts) {
      if (p.t === 'light') {
        lamps.push({ x: p.x, y: p.y, z: p.z, intensity: p.intensity, dist: p.dist, color: p.color });
        continue;
      }
      const mesh = this.makeMesh(p);
      if (mesh) group.add(mesh);
    }
    this.world.add(group);
    return { deps, group, lamps };
  }

  private material(color: string, o: { glass?: boolean; glow?: boolean }) {
    const key = `${color}|${o.glass ? 'g' : ''}${o.glow ? 'e' : ''}`;
    let m = this.materials.get(key);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color, roughness: o.glass ? 0.1 : 0.85, metalness: o.glass ? 0.1 : 0.02 });
      if (o.glass) Object.assign(m, { transparent: true, opacity: 0.32, depthWrite: false });
      if (o.glow) {
        m.emissive = new THREE.Color(color);
        m.emissiveIntensity = this.glowStrength();
        this.glowMaterials.push(m);
      }
      this.materials.set(key, m);
    }
    return m;
  }

  private glowStrength() {
    return 0.35 + 1.6 * this.dark;
  }

  private floorTexture(kind: string, color: string) {
    const key = `${kind}|${color}`;
    let t = this.textures.get(key);
    if (!t) {
      const pat = patternFor(kind as PatternKind, color);
      if (!pat) return null;
      t = new THREE.CanvasTexture(pat.image);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(1 / pat.meters, 1 / pat.meters);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      this.textures.set(key, t);
    }
    return t;
  }

  private cylGeometry(ratio: number) {
    const key = ratio.toFixed(3);
    let g = this.geo.cyl.get(key);
    if (!g) {
      g = new THREE.CylinderGeometry(ratio, 1, 1, 28);
      this.geo.cyl.set(key, g);
    }
    return g;
  }

  private makeMesh(p: Exclude<Part, { t: 'light' }>): THREE.Mesh | null {
    const mat = this.material(p.color, p);
    let mesh: THREE.Mesh;
    switch (p.t) {
      case 'box':
        mesh = new THREE.Mesh(this.geo.box, mat);
        mesh.scale.set(p.sx, p.sy, p.sz);
        mesh.rotation.order = 'YXZ';
        mesh.rotation.set(0, p.ry, p.rz ?? 0);
        mesh.position.set(p.x, p.y, p.z);
        break;
      case 'cyl': {
        mesh = new THREE.Mesh(this.cylGeometry(p.rt === undefined ? 1 : p.rt / p.r), mat);
        mesh.scale.set(p.r, p.h, p.rz ?? p.r);
        mesh.rotation.order = 'YXZ';
        mesh.rotation.set(p.ax === 'z' ? Math.PI / 2 : 0, p.ry, p.ax === 'x' ? Math.PI / 2 : 0);
        mesh.position.set(p.x, p.y, p.z);
        break;
      }
      case 'ball':
        mesh = new THREE.Mesh(this.geo.sphere, mat);
        mesh.scale.set(p.sx, p.sy, p.sz);
        mesh.rotation.y = p.ry;
        mesh.position.set(p.x, p.y, p.z);
        break;
      case 'ring': {
        mesh = new THREE.Mesh(new THREE.TorusGeometry(p.R, p.tube, 8, 28), mat);
        mesh.rotation.order = 'YXZ';
        mesh.rotation.set(p.ax === 'y' ? Math.PI / 2 : 0, p.ry + (p.ax === 'x' ? Math.PI / 2 : 0), 0);
        mesh.position.set(p.x, p.y, p.z);
        break;
      }
      case 'prism': {
        if (p.pts.length < 3) return null;
        const shape = new THREE.Shape(p.pts.map((q) => new THREE.Vector2(q.x, -q.y)));
        const geometry = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.001, p.y1 - p.y0), bevelEnabled: false });
        geometry.rotateX(-Math.PI / 2);
        const tex = p.tex ? this.floorTexture(p.tex.kind, p.tex.color) : null;
        const top = tex ? new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }) : mat;
        mesh = new THREE.Mesh(geometry, tex ? [top, mat] : mat);
        mesh.position.y = p.y0;
        break;
      }
    }
    mesh.castShadow = !p.glass;
    mesh.receiveShadow = true;
    return mesh;
  }

  private disposeGroup(g: THREE.Group) {
    g.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      // shared geometries and materials stay; one-off ones go
      if (m.geometry !== this.geo.box && m.geometry !== this.geo.sphere && ![...this.geo.cyl.values()].includes(m.geometry as THREE.CylinderGeometry)) m.geometry.dispose();
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const x of mats) if (![...this.materials.values()].includes(x as THREE.MeshStandardMaterial)) x.dispose();
    });
    this.world.remove(g);
  }

  // ---- light -------------------------------------------------------------------------------------------------------

  setSun(s: SunSettings) {
    const { sun } = s;
    this.dark = darkness(sun.elevation);
    const golden = goldenHour(sun.elevation);
    const up = sun.elevation > 1.5;
    const bearing = ((s.north + sun.azimuth) * Math.PI) / 180;
    const el = (Math.max(sun.elevation, 8) * Math.PI) / 180;
    const dir = new THREE.Vector3(Math.sin(bearing) * Math.cos(el), Math.sin(el), -Math.cos(bearing) * Math.cos(el));
    if (!up) dir.set(0.3, 0.9, 0.3).normalize(); // moonlight from above
    this.sunLight.position.copy(dir.clone().multiplyScalar(this.extent.radius * 3 + 20).add(new THREE.Vector3(this.extent.cx, 0, this.extent.cz)));
    this.sunLight.target.position.set(this.extent.cx, 0, this.extent.cz);
    this.sunLight.color.set(up ? new THREE.Color('#ffffff').lerp(new THREE.Color('#ffb673'), golden) : new THREE.Color('#9db4ff'));
    this.sunLight.intensity = up ? 2.6 * Math.min(1, 0.25 + sun.elevation / 25) * (1 - this.dark * 0.9) : 0.25;
    this.sunLight.castShadow = s.shadows && up;
    this.sky.intensity = 0.25 + 0.75 * (1 - this.dark);
    const day = new THREE.Color('#cfe3f3');
    const dusk = new THREE.Color('#f1c9a0');
    const night = new THREE.Color('#0b1220');
    const sky = day.clone().lerp(dusk, golden * 0.8).lerp(night, this.dark);
    this.scene.background = sky;
    // the ground fades into the sky at the horizon
    this.scene.fog = new THREE.Fog(sky, this.extent.radius * 6 + 40, this.extent.radius * 20 + 200);
    this.sky.color.set(this.dark > 0.5 ? '#5b6b9a' : '#dbeafe');
    this.glowMaterials.forEach((m) => (m.emissiveIntensity = this.glowStrength()));
    this.updateLamps();
    this.updateShadowCamera();
    this.dirty = true;
  }

  private updateShadowCamera() {
    const r = this.extent.radius * 1.3 + 4;
    const cam = this.sunLight.shadow.camera;
    cam.left = -r;
    cam.right = r;
    cam.top = r;
    cam.bottom = -r;
    cam.near = 1;
    cam.far = this.extent.radius * 8 + 60;
    cam.updateProjectionMatrix();
  }

  private updateLamps() {
    const all = [...this.built.values()].flatMap((b) => b.lamps);
    const from = this.mode === 'walk' ? this.camera.position : this.controls.target;
    all.sort((a, b) => Math.hypot(a.x - from.x, a.z - from.z) - Math.hypot(b.x - from.x, b.z - from.z));
    this.lampLights.forEach((l, i) => {
      const lamp = all[i];
      l.visible = !!lamp && this.dark > 0.05;
      if (!lamp) return;
      l.position.set(lamp.x, lamp.y, lamp.z);
      l.color.set(lamp.color);
      l.distance = lamp.dist + 2;
      l.intensity = lamp.intensity * 9 * this.dark;
    });
  }

  // ---- camera ---------------------------------------------------------------------------------------------------------

  /** Frame the whole house from the south-east, a bit above. */
  resetView() {
    this.setMode('orbit');
    const { cx, cz, radius, top } = this.extent;
    const dist = radius * 1.9 + 5;
    this.controls.target.set(cx, Math.min(top / 3, 2), cz);
    this.camera.position.set(cx + dist * 0.55, dist * 0.62, cz + dist * 0.8);
    this.controls.update();
    this.dirty = true;
  }

  /** Put the camera somewhere exact (tests, screenshots). */
  setView(pos: [number, number, number], target: [number, number, number]) {
    this.setMode('orbit');
    this.camera.position.set(...pos);
    this.controls.target.set(...target);
    this.controls.update();
    this.dirty = true;
  }

  /** Straight down, with the plan's "up" at the top of the screen. */
  topView() {
    this.setMode('orbit');
    const { cx, cz, radius } = this.extent;
    const dist = radius * 2.6 + 8;
    this.controls.target.set(cx, 0, cz);
    this.camera.position.set(cx, dist, cz + dist * 0.002);
    this.controls.update();
    this.dirty = true;
  }

  setMode(mode: 'orbit' | 'walk', at?: { x: number; z: number }) {
    if (mode === this.mode) {
      if (mode === 'walk' && at) this.camera.position.set(at.x, this.floorY + EYE, at.z);
      return;
    }
    this.mode = mode;
    this.keys.clear();
    if (mode === 'walk') {
      this.saved = { pos: this.camera.position.clone(), target: this.controls.target.clone() };
      this.controls.enabled = false;
      const p = at ?? { x: this.extent.cx, z: this.extent.cz };
      this.camera.position.set(p.x, this.floorY + EYE, p.z);
      this.yaw = Math.PI; // looking towards -z, the top of the plan
      this.pitch = 0;
      this.applyLook();
    } else {
      this.controls.enabled = true;
      if (this.saved) {
        this.camera.position.copy(this.saved.pos);
        this.controls.target.copy(this.saved.target);
      }
      this.camera.up.set(0, 1, 0);
      this.controls.update();
    }
    this.updateLamps();
    this.dirty = true;
  }

  private applyLook() {
    const cp = Math.cos(this.pitch);
    const look = new THREE.Vector3(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp);
    this.camera.lookAt(this.camera.position.clone().add(look));
  }

  private walk(dt: number) {
    const k = this.keys;
    const fwd = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0);
    const side = (k.has('d') ? 1 : 0) - (k.has('a') ? 1 : 0);
    const turn = (k.has('arrowright') ? 1 : 0) - (k.has('arrowleft') ? 1 : 0);
    if (turn) {
      this.yaw -= turn * dt * 1.6;
      this.dirty = true;
    }
    if (fwd || side) {
      const speed = (k.has('shift') ? 5 : 2) * dt;
      const fx = -Math.sin(this.yaw);
      const fz = Math.cos(this.yaw);
      this.camera.position.x += (fx * fwd + -fz * side) * speed;
      this.camera.position.z += (fz * fwd + fx * side) * speed;
      this.dirty = true;
    }
    if (this.dirty) {
      this.camera.position.y = this.floorY + EYE;
      this.applyLook();
      this.updateLamps();
    }
  }

  private onKey = (e: KeyboardEvent) => {
    if (this.mode !== 'walk') return;
    const t = e.target as HTMLElement | null;
    if (t && (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable)) return;
    const key = e.key.toLowerCase();
    if (e.type === 'keydown') this.keys.add(key);
    else this.keys.delete(key);
    if (key.startsWith('arrow')) e.preventDefault();
  };

  private onDown = (e: PointerEvent) => {
    if (this.mode !== 'walk') return;
    const el = this.renderer.domElement;
    el.focus();
    el.setPointerCapture(e.pointerId);
    let x = e.clientX;
    let y = e.clientY;
    const move = (m: PointerEvent) => {
      this.yaw -= (m.clientX - x) * 0.004;
      this.pitch = Math.max(-1.3, Math.min(1.3, this.pitch - (m.clientY - y) * 0.004));
      x = m.clientX;
      y = m.clientY;
      this.applyLook();
      this.dirty = true;
    };
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  };

  // ---- output & checks ---------------------------------------------------------------------------------------------------

  toBlob(): Promise<Blob | null> {
    this.renderNow();
    return new Promise((resolve) => this.renderer.domElement.toBlob(resolve, 'image/png'));
  }

  /** For tests: how much is built, where the camera is, how much of the picture is not sky. */
  stats() {
    let meshes = 0;
    this.world.traverse((o) => (o as THREE.Mesh).isMesh && meshes++);
    const bg = this.scene.background as THREE.Color;
    const small = document.createElement('canvas');
    small.width = 80;
    small.height = 50;
    const ctx = small.getContext('2d')!;
    this.renderNow();
    ctx.drawImage(this.renderer.domElement, 0, 0, 80, 50);
    const px = ctx.getImageData(0, 0, 80, 50).data;
    const target = [Math.round(bg.r * 255), Math.round(bg.g * 255), Math.round(bg.b * 255)];
    let content = 0;
    for (let i = 0; i < px.length; i += 4) if (Math.abs(px[i] - target[0]) + Math.abs(px[i + 1] - target[1]) + Math.abs(px[i + 2] - target[2]) > 40) content++;
    return {
      meshes,
      chunks: this.built.size,
      lamps: this.lampLights.filter((l) => l.visible).length,
      mode: this.mode,
      camera: this.camera.position.toArray(),
      target: this.controls.target.toArray(),
      shadows: this.sunLight.castShadow,
      dark: this.dark,
      filled: content / (80 * 50),
    };
  }
}
