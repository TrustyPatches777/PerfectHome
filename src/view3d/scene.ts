/**
 * The Three.js side of the 3D view: turns the pure parts (build.ts) into meshes, lights them with the sun and the lamps,
 * and runs the camera (orbit around the house, or walking through it). No React in here; View3D.tsx drives it.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { patternFor, type PatternKind } from '../patterns';
import type { Design, Weather } from '../model';
import { moodOf, type Mood } from '../sky';
import { darkness, goldenHour, type SunPosition } from '../sun';
import { faceNormal } from '../roofs';
import { buildWalkWorld, type WalkWorld } from '../walk';
import { floorElevations, sceneChunks, sceneExtent, type BuildOptions } from './build';
import { roofImage } from './roofTex';
import type { Anim, Part } from './parts';

const MAX_LAMPS = 6;
const EYE = 1.6;

/** A moving part of a door: the pivot it hangs from and how it moves when the door is open. */
interface Leaf {
  pivot: THREE.Group;
  anim: Anim;
}

interface Built {
  deps: unknown[];
  group: THREE.Group;
  leaves: Leaf[];
  lamps: { x: number; y: number; z: number; intensity: number; dist: number; color: string }[];
}

export interface SunSettings {
  sun: SunPosition;
  /** The weather (absent = clear): the sky, the light, clouds and what falls. */
  weather?: Weather;
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
  /** Doors by opening id: how far open (0..1) and where they are heading. Survives rebuilds of the walls. */
  private doors = new Map<string, { t: number; target: 0 | 1 }>();
  private raf = 0;
  private extent = { cx: 0, cz: 0, radius: 8, top: 3 };
  private dark = 0;
  /** Clouds in the sky (more or fewer of them show), and rain or snow falling round the camera. */
  private clouds = new THREE.Group();
  private cloudMaterial = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.93, fog: false, depthWrite: false });
  private precip: { kind: 'rain' | 'snow'; object: THREE.LineSegments | THREE.Points; pos: Float32Array; seed: Float32Array } | null = null;
  /** The materials of the horizon (unlit): darkened and tinted with the light of the day. */
  private skyMats = new Map<string, { m: THREE.MeshBasicMaterial; base: THREE.Color }>();
  private haze = { sky: new THREE.Color('#cfe3f3'), foggy: false };
  private floorY = 0;
  /** What stops you and where the ground is, built when you start walking and after the design or a door changes. */
  private design: Design | null = null;
  private walkWorld: WalkWorld | null = null;
  /** Height of your feet; you climb stairs and drop into holes. */
  private feetY = 0;
  private fall = 0;

  // walking
  mode: 'orbit' | 'walk' = 'orbit';
  private yaw = 0;
  private pitch = 0;
  private keys = new Set<string>();
  /** Dragging up looks down (flight-stick style) instead of up. */
  invertY = false;
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

    this.scene.add(this.world, this.sky, this.sunLight, this.sunLight.target, this.clouds);
    this.buildClouds();
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
    el.addEventListener('pointerdown', this.onClickDown);
    el.addEventListener('pointerup', this.onClickUp);
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
    this.stepDoors(dt);
    this.stepPrecip(dt);
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
    this.renderer.domElement.removeEventListener('pointerdown', this.onClickDown);
    this.renderer.domElement.removeEventListener('pointerup', this.onClickUp);
    this.controls.dispose();
    this.setPrecip(null);
    this.clouds.children.forEach((c) => c.traverse((o) => (o as THREE.Mesh).geometry?.dispose?.()));
    this.cloudMaterial.dispose();
    this.skyMats.forEach((e) => e.m.dispose());
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
    this.design = d;
    this.walkWorld = null;
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
    const leaves: Leaf[] = [];
    for (const p of parts) {
      if (p.t === 'light') {
        lamps.push({ x: p.x, y: p.y, z: p.z, intensity: p.intensity, dist: p.dist, color: p.color });
        continue;
      }
      const mesh = this.makeMesh(p);
      if (!mesh) continue;
      if (p.anim) {
        // a leaf of a door hangs from a pivot (the hinge) so it can swing
        const pivot = new THREE.Group();
        if (p.anim.kind === 'swing') {
          pivot.position.set(...p.anim.origin);
          mesh.position.sub(pivot.position);
        }
        pivot.add(mesh);
        pivot.userData.door = p.anim.door;
        mesh.userData.door = p.anim.door;
        leaves.push({ pivot, anim: p.anim });
        group.add(pivot);
        this.poseLeaf(leaves[leaves.length - 1], this.doors.get(p.anim.door)?.t ?? 0);
      } else group.add(mesh);
    }
    this.world.add(group);
    return { deps, group, lamps, leaves };
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

  private roofTexture(kind: string, color: string) {
    const key = `roof|${kind}|${color}`;
    let t = this.textures.get(key);
    if (!t) {
      const img = roofImage(kind, color);
      if (!img) return null;
      t = new THREE.CanvasTexture(img);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      this.textures.set(key, t);
    }
    return t;
  }

  /** A flat polygon in space, thickened away from the side it faces. */
  private panelGeometry(pts: [number, number, number][], thick: number, facing: [number, number, number], holes: [number, number, number][][] = []) {
    let n = new THREE.Vector3(...faceNormal(pts));
    if (n.dot(new THREE.Vector3(...facing)) < 0) n = n.negate();
    const o = new THREE.Vector3(...pts[0]);
    const u = new THREE.Vector3(...pts[1]).sub(o).normalize();
    const v = new THREE.Vector3().crossVectors(n, u);
    const flat = (p: [number, number, number]) => new THREE.Vector2(new THREE.Vector3(...p).sub(o).dot(u), new THREE.Vector3(...p).sub(o).dot(v));
    const shape = new THREE.Shape(pts.map(flat));
    for (const h of holes) if (h.length >= 3) shape.holes.push(new THREE.Path(h.map(flat)));
    const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.005, thick), bevelEnabled: false });
    g.translate(0, 0, -Math.max(0.005, thick));
    g.applyMatrix4(new THREE.Matrix4().makeBasis(u, v, n).setPosition(o));
    return g;
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

  /** An unlit, fog-free material for the far-away horizon. */
  private skyMaterial(color: string): THREE.MeshBasicMaterial {
    let e = this.skyMats.get(color);
    if (!e) {
      e = { m: new THREE.MeshBasicMaterial({ color, fog: false }), base: new THREE.Color(color) };
      this.skyMats.set(color, e);
      this.tintHorizon();
    }
    return e.m;
  }

  private makeMesh(p: Exclude<Part, { t: 'light' }>): THREE.Mesh | null {
    const mat = p.sky ? this.skyMaterial(p.color) : this.material(p.color, p);
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
      case 'panel': {
        if (p.pts.length < 3) return null;
        const tex = p.tex ? this.roofTexture(p.tex.kind, p.tex.color) : null;
        const top = tex ? new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }) : mat;
        mesh = new THREE.Mesh(this.panelGeometry(p.pts, p.thick, p.facing, p.holes), tex ? [top, mat] : mat);
        break;
      }
      case 'beam': {
        const a = new THREE.Vector3(...p.a);
        const b = new THREE.Vector3(...p.b);
        const dir = b.clone().sub(a);
        const len = dir.length();
        if (len < 1e-6) return null;
        dir.normalize();
        // the bar's own up stays as vertical as it can
        let up = new THREE.Vector3(0, 1, 0).sub(dir.clone().multiplyScalar(dir.y));
        if (up.lengthSq() < 1e-6) up = new THREE.Vector3(1, 0, 0);
        up.normalize();
        const side = new THREE.Vector3().crossVectors(dir, up);
        mesh = new THREE.Mesh(this.geo.box, mat);
        mesh.scale.set(len, p.h, p.w);
        mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(dir, up, side));
        mesh.position.copy(a.add(b).multiplyScalar(0.5));
        break;
      }
      case 'prism': {
        if (p.pts.length < 3) return null;
        const shape = new THREE.Shape(p.pts.map((q) => new THREE.Vector2(q.x, -q.y)));
        for (const h of p.holes ?? []) if (h.length >= 3) shape.holes.push(new THREE.Path(h.map((q) => new THREE.Vector2(q.x, -q.y))));
        const geometry = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.001, p.y1 - p.y0), bevelEnabled: false });
        geometry.rotateX(-Math.PI / 2);
        const tex = p.tex ? this.floorTexture(p.tex.kind, p.tex.color) : null;
        const top = tex ? new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }) : mat;
        mesh = new THREE.Mesh(geometry, tex ? [top, mat] : mat);
        mesh.position.y = p.y0;
        break;
      }
    }
    mesh.castShadow = !p.glass && !p.sky;
    mesh.receiveShadow = !p.sky;
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
    const mood = moodOf(s.weather);
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
    this.sunLight.intensity = up ? 2.6 * Math.min(1, 0.25 + sun.elevation / 25) * (1 - this.dark * 0.9) * mood.sun : 0.25;
    this.sunLight.castShadow = s.shadows && up && mood.shadows; // an overcast sky casts no shadows
    this.sky.intensity = (0.25 + 0.75 * (1 - this.dark)) * mood.hemi;
    const day = new THREE.Color(mood.sky);
    const dusk = new THREE.Color('#f1c9a0');
    const night = new THREE.Color('#0b1220');
    const sky = day.clone().lerp(dusk, golden * 0.8).lerp(night, this.dark);
    this.scene.background = sky;
    // the ground fades into the sky at the horizon
    this.scene.fog = mood.fog ? new THREE.Fog(sky, mood.fog * 0.08, mood.fog) : new THREE.Fog(sky, this.extent.radius * 6 + 40, this.extent.radius * 20 + 200);
    this.applyAtmosphere(mood, golden, sky);
    this.sky.color.set(this.dark > 0.5 ? '#5b6b9a' : '#dbeafe');
    this.glowMaterials.forEach((m) => (m.emissiveIntensity = this.glowStrength()));
    this.updateLamps();
    this.updateShadowCamera();
    this.dirty = true;
  }

  /** Clouds, the horizon's light and the rain or snow that go with the weather and the time of day. */
  private applyAtmosphere(mood: Mood, golden: number, sky: THREE.Color) {
    const cloud = new THREE.Color(mood.cloudColor).lerp(new THREE.Color('#f7c9a0'), golden * 0.5).lerp(new THREE.Color('#161d30'), this.dark * 0.9);
    this.cloudMaterial.color.copy(cloud);
    const n = Math.round(mood.clouds * this.clouds.children.length);
    this.clouds.children.forEach((c, i) => (c.visible = i < n));
    // the far horizon is in the haze of the day: toward the color of the sky, and dark at night
    this.haze = { sky: sky.clone(), foggy: !!mood.fog };
    this.tintHorizon();
    this.setPrecip(mood.precip);
    this.dirty = true;
  }

  /** The far horizon in the haze of the day: toward the color of the sky, and dark at night. */
  private tintHorizon() {
    this.skyMats.forEach((e) => e.m.color.copy(e.base).lerp(this.haze.sky, 0.3 + (this.haze.foggy ? 0.2 : 0)).multiplyScalar(1 - this.dark * 0.85));
  }

  /** The clouds: clusters of flattened spheres high in the sky, always the same ones (more of them show in bad weather). */
  private buildClouds() {
    let a = 12345;
    const rand = () => {
      a = (a * 1664525 + 1013904223) >>> 0;
      return a / 4294967296;
    };
    for (let i = 0; i < 46; i++) {
      const g = new THREE.Group();
      const ang = rand() * Math.PI * 2;
      const dist = 120 + rand() * 640;
      g.position.set(Math.cos(ang) * dist, 170 + rand() * 120, Math.sin(ang) * dist);
      const puffs = 3 + Math.floor(rand() * 3);
      for (let k = 0; k < puffs; k++) {
        const m = new THREE.Mesh(this.geo.sphere, this.cloudMaterial);
        const r = 30 + rand() * 38;
        m.scale.set(r, r * 0.38, r * 0.8);
        m.position.set((k - puffs / 2) * r * 0.9 + rand() * 10, rand() * 8, rand() * 18 - 9);
        g.add(m);
      }
      this.clouds.add(g);
    }
  }

  /** Rain (thin falling streaks) or snow (drifting flakes) in a box round the camera; nothing for fine weather. */
  private setPrecip(kind: 'rain' | 'snow' | null) {
    if ((this.precip?.kind ?? null) === kind) return;
    if (this.precip) {
      this.scene.remove(this.precip.object);
      this.precip.object.geometry.dispose();
      (this.precip.object.material as THREE.Material).dispose();
      this.precip = null;
    }
    if (!kind) return;
    const N = kind === 'rain' ? 2600 : 2200;
    const seed = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      seed[i * 3] = (Math.random() - 0.5) * 80;
      seed[i * 3 + 1] = Math.random() * 44 - 14;
      seed[i * 3 + 2] = (Math.random() - 0.5) * 80;
    }
    const geo = new THREE.BufferGeometry();
    let object: THREE.LineSegments | THREE.Points;
    let pos: Float32Array;
    if (kind === 'rain') {
      pos = new Float32Array(N * 6);
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      object = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: '#b7c4d6', transparent: true, opacity: 0.55, fog: false }));
    } else {
      pos = new Float32Array(N * 3);
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      object = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#ffffff', size: 0.16, sizeAttenuation: true, transparent: true, opacity: 0.9, fog: false }));
    }
    object.frustumCulled = false;
    this.precip = { kind, object, pos, seed };
    this.scene.add(object);
    this.stepPrecip(0);
  }

  private stepPrecip(dt: number) {
    const p = this.precip;
    if (!p) return;
    const N = p.seed.length / 3;
    const fall = p.kind === 'rain' ? 17 : 1.6;
    for (let i = 0; i < N; i++) {
      let y = p.seed[i * 3 + 1] - fall * dt;
      if (y < -14) y += 44;
      p.seed[i * 3 + 1] = y;
      const x = p.seed[i * 3] + (p.kind === 'snow' ? Math.sin(y * 0.8 + i) * 0.004 : 0);
      const z = p.seed[i * 3 + 2];
      if (p.kind === 'rain') {
        p.pos.set([x, y, z, x + 0.05, y - 0.7, z + 0.02], i * 6);
      } else {
        p.pos[i * 3] = x;
        p.pos[i * 3 + 1] = y;
        p.pos[i * 3 + 2] = z;
      }
    }
    (p.object.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    p.object.position.set(this.camera.position.x, this.camera.position.y, this.camera.position.z);
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

  /** Stand somewhere on the floor and look in a direction (tests): `yaw` 0 looks towards +z, pi towards -z (the top of the plan). */
  walkTo(x: number, z: number, yaw: number, pitch = 0) {
    this.setMode('walk', { x, z });
    this.stand(x, z);
    this.yaw = yaw;
    this.pitch = pitch;
    this.applyLook();
    this.dirty = true;
  }

  /** Where a point of the scene appears on the canvas, in CSS pixels (tests). */
  screenOf(x: number, y: number, z: number): { x: number; y: number } {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    const r = this.renderer.domElement.getBoundingClientRect();
    return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
  }

  /** Put the camera somewhere exact (tests, screenshots). */
  setView(pos: [number, number, number], target: [number, number, number]) {
    this.setMode('orbit');
    this.camera.position.set(...pos);
    this.controls.target.set(...target);
    this.controls.update();
    this.dirty = true;
  }

  /** Where the camera is and what it looks at: an exact copy for a saved view (while walking: the eye and a point two meters ahead). */
  getView(): { pos: [number, number, number]; target: [number, number, number] } {
    const p = this.camera.position;
    const mm = (v: number) => Math.round(v * 1000) / 1000; // a millimeter is exact enough, and keeps links short
    if (this.mode === 'walk') {
      const dir = this.camera.getWorldDirection(new THREE.Vector3());
      return { pos: [mm(p.x), mm(p.y), mm(p.z)], target: [mm(p.x + dir.x * 2), mm(p.y + dir.y * 2), mm(p.z + dir.z * 2)] };
    }
    const t = this.controls.target;
    return { pos: [mm(p.x), mm(p.y), mm(p.z)], target: [mm(t.x), mm(t.y), mm(t.z)] };
  }

  /** Look at a ball of the scene (middle `c`, `radius`) from the south-east and well above, so it fills the picture: the dollhouse and exploded shots. */
  frameBall(c: [number, number, number], radius: number) {
    this.setMode('orbit');
    const dir = new THREE.Vector3(0.5, 0.8, 0.7).normalize();
    const dist = radius * 2.3 + 2;
    this.controls.target.set(...c);
    this.camera.position.set(c[0] + dir.x * dist, c[1] + dir.y * dist, c[2] + dir.z * dist);
    this.controls.update();
    this.dirty = true;
  }

  /** Step back far enough to see the whole house when its floors are pulled apart into a stack `rise` meters tall. */
  frameStack(rise: number) {
    const { cx, cz, radius } = this.extent;
    this.frameBall([cx, rise / 2 + 1, cz], Math.max(radius, rise / 2 + 2));
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
      if (mode === 'walk' && at) this.stand(at.x, at.z, true);
      return;
    }
    this.mode = mode;
    this.keys.clear();
    if (mode === 'walk') {
      this.saved = { pos: this.camera.position.clone(), target: this.controls.target.clone() };
      this.controls.enabled = false;
      const p = at ?? { x: this.extent.cx, z: this.extent.cz };
      this.stand(p.x, p.z, true); // a free place near it: the middle of a room can be under a table
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

  private getWorld(): WalkWorld | null {
    if (!this.walkWorld && this.design) this.walkWorld = buildWalkWorld(this.design, new Set(this.openDoors()), floorElevations(this.design));
    return this.walkWorld;
  }

  /** Climb or fall to the ground under your feet. */
  private settleFeet(dt: number) {
    const p = this.camera.position;
    const target = this.getWorld()?.heightAt(p.x, p.z, this.feetY) ?? this.floorY;
    if (target > this.feetY + 1e-4) {
      this.feetY = Math.min(target, this.feetY + 7 * dt);
      this.fall = 0;
      this.dirty = true;
    } else if (target < this.feetY - 1e-4) {
      this.fall += 14 * dt;
      this.feetY = Math.max(target, this.feetY - this.fall * dt);
      if (this.feetY === target) this.fall = 0;
      this.dirty = true;
    } else this.fall = 0;
  }

  /** Stand at a place on the floor you are looking at. */
  private stand(x: number, z: number, anywhere = false) {
    if (anywhere) {
      const spot = this.getWorld()?.freeSpot(x, z, this.floorY + 0.01);
      if (spot) {
        x = spot.x;
        z = spot.z;
      }
    }
    this.camera.position.set(x, 0, z);
    this.feetY = this.getWorld()?.heightAt(x, z, this.floorY + 0.01) ?? this.floorY;
    this.fall = 0;
    this.camera.position.y = this.feetY + EYE;
  }

  private walk(dt: number) {
    const k = this.keys;
    const fwd = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0);
    const side = (k.has('d') ? 1 : 0) - (k.has('a') ? 1 : 0);
    const turn = (k.has('arrowright') ? 1 : 0) - (k.has('arrowleft') ? 1 : 0);
    if (turn) {
      this.yaw += turn * dt * 1.6;
      this.dirty = true;
    }
    if (fwd || side) {
      const speed = (k.has('shift') ? 5 : 2) * dt;
      const fx = -Math.sin(this.yaw);
      const fz = Math.cos(this.yaw);
      const dx = (fx * fwd + -fz * side) * speed;
      const dz = (fz * fwd + fx * side) * speed;
      const world = this.getWorld();
      if (world) {
        const r = world.move(this.camera.position.x, this.camera.position.z, this.feetY, dx, dz);
        this.camera.position.x = r.x;
        this.camera.position.z = r.z;
      } else {
        this.camera.position.x += dx;
        this.camera.position.z += dz;
      }
      this.dirty = true;
    }
    this.settleFeet(dt);
    if (this.dirty) {
      this.camera.position.y = this.feetY + EYE;
      this.applyLook();
      this.updateLamps();
    }
  }

  private ease = (t: number) => t * t * (3 - 2 * t);

  private poseLeaf(leaf: Leaf, t: number) {
    const e = this.ease(t);
    if (leaf.anim.kind === 'swing') leaf.pivot.rotation.y = leaf.anim.angle * e;
    else leaf.pivot.position.set(leaf.anim.move[0] * e, leaf.anim.move[1] * e, leaf.anim.move[2] * e);
  }

  /** Open a closed door, close an open one. */
  toggleDoor(id: string) {
    const s = this.doors.get(id) ?? { t: 0, target: 0 as 0 | 1 };
    s.target = s.target === 1 ? 0 : 1;
    this.doors.set(id, s);
    this.walkWorld = null; // an open door can be walked through
    this.dirty = true;
  }

  /** Ids of the doors that are open or opening. */
  openDoors(): string[] {
    return [...this.doors].filter(([, s]) => s.target === 1).map(([id]) => id);
  }

  private stepDoors(dt: number) {
    let moving = false;
    for (const s of this.doors.values()) {
      if (s.t === s.target) continue;
      s.t = s.target === 1 ? Math.min(1, s.t + dt / 0.7) : Math.max(0, s.t - dt / 0.7);
      moving = true;
    }
    if (!moving) return;
    for (const b of this.built.values()) for (const leaf of b.leaves) this.poseLeaf(leaf, this.doors.get(leaf.anim.door)?.t ?? 0);
    this.dirty = true;
  }

  /** What is under a point of the canvas: the nearest thing the ray meets (tests and clicking). */
  hitAt(clientX: number, clientY: number) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1), this.camera);
    return ray.intersectObjects(this.world.children, true).find((h) => (h.object.userData as { door?: string }).door || !((h.object as THREE.Mesh).material as THREE.Material).transparent) ?? null;
  }

  /** A click (not a drag) on a door opens or closes it. */
  private pick(e: PointerEvent) {
    const hit = this.hitAt(e.clientX, e.clientY);
    if (!hit) return;
    const id = (hit.object.userData as { door?: string }).door;
    if (id && (this.mode === 'orbit' || hit.distance < 4.5)) this.toggleDoor(id);
    else if (id) this.onFar?.();
  }

  /** Called when a door was clicked from too far away to reach it. */
  onFar: (() => void) | null = null;

  private onKey = (e: KeyboardEvent) => {
    if (this.mode !== 'walk') return;
    const t = e.target as HTMLElement | null;
    if (t && (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable)) return;
    const key = e.key.toLowerCase();
    if (e.type === 'keydown') this.keys.add(key);
    else this.keys.delete(key);
    if (key.startsWith('arrow')) e.preventDefault();
  };

  private downAt: { x: number; y: number; t: number } | null = null;
  private onClickDown = (e: PointerEvent) => {
    this.downAt = { x: e.clientX, y: e.clientY, t: performance.now() };
  };
  private onClickUp = (e: PointerEvent) => {
    const d = this.downAt;
    this.downAt = null;
    if (e.button !== 0 || !d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4 || performance.now() - d.t > 500) return;
    this.pick(e);
  };

  private onDown = (e: PointerEvent) => {
    if (this.mode !== 'walk') return;
    const el = this.renderer.domElement;
    el.focus();
    el.setPointerCapture(e.pointerId);
    let x = e.clientX;
    let y = e.clientY;
    const move = (m: PointerEvent) => {
      this.yaw += (m.clientX - x) * 0.004;
      this.pitch = Math.max(-1.3, Math.min(1.3, this.pitch + (this.invertY ? 1 : -1) * (m.clientY - y) * 0.004));
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
      look: this.camera.getWorldDirection(new THREE.Vector3()).toArray(),
      camera: this.camera.position.toArray(),
      target: this.controls.target.toArray(),
      shadows: this.sunLight.castShadow,
      doorsOpen: this.openDoors().length,
      feet: this.feetY,
      dark: this.dark,
      filled: content / (80 * 50),
    };
  }
}
