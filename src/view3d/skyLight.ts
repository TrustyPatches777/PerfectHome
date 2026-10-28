/**
 * The light that comes from the whole sky, not just the sun: a small image of the sky (blue overhead, pale at the horizon, warm ground
 * below, a bright sun spot) that every lit material reflects and is lit by. Shaded walls get the cool skylight from above and the warm
 * bounce from the ground, glass and water show the sky in them. Regenerated when the colors of the sky change.
 */
import * as THREE from 'three';

export interface SkyLook {
  /** Colors of the sky overhead, at the horizon, and of the ground that bounces light back up. */
  zenith: THREE.Color;
  horizon: THREE.Color;
  ground: THREE.Color;
  /** Where the sun is (unit vector, y up) and how bright its spot is (0 = hidden). */
  sunDir: THREE.Vector3;
  sunColor: THREE.Color;
  sunStrength: number;
}

const VERTEX = `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAGMENT = `
uniform vec3 zenith;
uniform vec3 horizon;
uniform vec3 ground;
uniform vec3 sunDir;
uniform vec3 sunColor;
uniform float sunStrength;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 c = h < 0.0
    ? mix(horizon, ground, smoothstep(0.0, 0.35, -h))
    : mix(horizon, zenith, pow(h, 0.55));
  float s = max(dot(d, sunDir), 0.0);
  // a small hard spot (seen in glass and water) and a faint halo; little energy, the sun itself is lit by the directional light
  c += sunColor * sunStrength * (pow(s, 2000.0) * 30.0 + pow(s, 40.0) * 0.12);
  gl_FragColor = vec4(c, 1.0);
}`;

/** The color of the sky (no sun) in a direction; the same picture as the shader below. */
function skyColorAt(look: SkyLook, y: number, out: THREE.Color): THREE.Color {
  if (y < 0) return out.copy(look.horizon).lerp(look.ground, THREE.MathUtils.smoothstep(-y, 0, 0.35));
  return out.copy(look.horizon).lerp(look.zenith, Math.pow(y, 0.55));
}

/**
 * The soft light of the sky as nine numbers per color (spherical harmonics): every surface gets its share from the sky above it and
 * the ground below it, at no cost per pixel. (Looking the sky up in an image for every pixel of every material made the 3D view
 * several times slower on weak graphics.)
 */
export function setSkyProbe(probe: THREE.LightProbe, look: SkyLook, intensity: number) {
  const bands = 24;
  const around = 32;
  const basis: number[] = new Array(9).fill(0);
  const c = new THREE.Color();
  const d = new THREE.Vector3();
  const sum = Array.from({ length: 9 }, () => new THREE.Vector3());
  let total = 0;
  for (let i = 0; i < bands; i++) {
    const lat = ((i + 0.5) / bands) * Math.PI - Math.PI / 2;
    const weight = Math.cos(lat); // the share of the sphere that this band covers
    skyColorAt(look, Math.sin(lat), c);
    for (let j = 0; j < around; j++) {
      const lon = ((j + 0.5) / around) * Math.PI * 2;
      d.set(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon));
      THREE.SphericalHarmonics3.getBasisAt(d, basis);
      for (let k = 0; k < 9; k++) {
        sum[k].x += basis[k] * c.r * weight;
        sum[k].y += basis[k] * c.g * weight;
        sum[k].z += basis[k] * c.b * weight;
      }
      total += weight;
    }
  }
  const norm = (4 * Math.PI) / total;
  for (let k = 0; k < 9; k++) probe.sh.coefficients[k].copy(sum[k]).multiplyScalar(norm);
  probe.intensity = intensity;
}

/** The sky as an image, for the things that show reflections (glass); it costs nothing until a material uses it. */
export class SkyEnvironment {
  private pmrem: THREE.PMREMGenerator;
  private world = new THREE.Scene();
  private material: THREE.ShaderMaterial;
  private target: THREE.WebGLRenderTarget | null = null;
  private key = '';

  constructor(renderer: THREE.WebGLRenderer) {
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.material = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        zenith: { value: new THREE.Color() },
        horizon: { value: new THREE.Color() },
        ground: { value: new THREE.Color() },
        sunDir: { value: new THREE.Vector3(0, 1, 0) },
        sunColor: { value: new THREE.Color() },
        sunStrength: { value: 0 },
      },
    });
    this.world.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), this.material));
  }

  /** The image for this sky; the same one again while nothing visible has changed. */
  update(look: SkyLook): THREE.Texture {
    const key = [
      look.zenith.getHexString(),
      look.horizon.getHexString(),
      look.ground.getHexString(),
      look.sunColor.getHexString(),
      look.sunDir.toArray().map((v) => v.toFixed(2)).join(','),
      look.sunStrength.toFixed(2),
    ].join('|');
    if (this.target && key === this.key) return this.target.texture;
    const u = this.material.uniforms;
    u.zenith.value.copy(look.zenith);
    u.horizon.value.copy(look.horizon);
    u.ground.value.copy(look.ground);
    u.sunDir.value.copy(look.sunDir);
    u.sunColor.value.copy(look.sunColor);
    u.sunStrength.value = look.sunStrength;
    this.target?.dispose();
    this.target = this.pmrem.fromScene(this.world, 0.02);
    this.key = key;
    return this.target.texture;
  }

  dispose() {
    this.target?.dispose();
    this.pmrem.dispose();
    this.material.dispose();
  }
}
