import {
  AdditiveBlending,
  BackSide,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
  GLSL3,
} from 'three';
import { palette, SUN_DIR } from './palette';
import type { Texture } from 'three';

const vertexShader = /* glsl */ `
out vec3 vDir;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vDir = normalize(world.xyz);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const fragmentShader = /* glsl */ `
uniform float uTime;
uniform vec3 uSun;
uniform vec3 uMoon;
uniform vec3 uHorizon;
uniform vec3 uZenith;
uniform vec3 uDusk;
uniform vec3 uSunColor;
in vec3 vDir;
out vec4 fragColor;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec3 dir = normalize(vDir);
  float h = dir.y;
  vec3 col = mix(uHorizon, uZenith, smoothstep(0.0, 0.62, h));
  vec3 low = mix(uHorizon, uDusk, 0.45);
  col = mix(low, col, smoothstep(-0.08, 0.16, h));

  float mu = max(dot(dir, uSun), 0.0);
  col += uSunColor * pow(mu, 4.0) * 0.55;
  col += uSunColor * pow(mu, 18.0) * 0.45;
  col += vec3(1.0, 0.96, 0.9) * pow(mu, 900.0);

  float moon = smoothstep(0.05, 0.028, distance(dir, uMoon));
  col = mix(col, vec3(0.95, 0.92, 0.84), moon * 0.9);
  float moonShade = smoothstep(0.03, 0.0, distance(dir - uMoon * 0.012, uMoon));
  col = mix(col, col * 0.82, moonShade);

  vec2 skyUv = dir.xz / max(dir.y, 0.05);
  float cloud = fbm(skyUv * 0.42 + vec2(uTime * 0.012, 0.2));
  cloud = smoothstep(0.48, 0.78, cloud);
  cloud *= smoothstep(0.02, 0.18, h) * smoothstep(0.82, 0.28, h);
  vec3 cloudCol = mix(vec3(0.72, 0.38, 0.28), vec3(1.0, 0.86, 0.72), cloud);
  col = mix(col, cloudCol, cloud * 0.5);

  float stars = step(0.992, hash12(floor(dir.xy * 240.0)));
  stars *= smoothstep(0.18, 0.45, h) * (1.0 - cloud);
  col += stars * 0.55;

  fragColor = vec4(col, 1.0);
}
`;

export type SkyHandle = {
  group: Group;
  dome: Mesh;
  sunDirection: Vector3;
  update: (time: number) => void;
};

export function createSky(cloudTex: Texture, glowTex: Texture): SkyHandle {
  const sunDirection = new Vector3(SUN_DIR.x, SUN_DIR.y, SUN_DIR.z).normalize();
  const moonDirection = new Vector3(-sunDirection.x, 0.55, sunDirection.z * 0.2).normalize();
  const uniforms = {
    uTime: { value: 0 },
    uSun: { value: sunDirection.clone() },
    uMoon: { value: moonDirection },
    uHorizon: { value: new Color(palette.horizon) },
    uZenith: { value: new Color(palette.zenith) },
    uDusk: { value: new Color(palette.dusk) },
    uSunColor: { value: new Color(palette.sun) },
  };
  const dome = new Mesh(
    new SphereGeometry(420, 48, 32),
    new ShaderMaterial({
      glslVersion: GLSL3,
      uniforms,
      vertexShader,
      fragmentShader,
      side: BackSide,
      depthWrite: false,
    }),
  );
  dome.frustumCulled = false;
  dome.renderOrder = -1;

  const sun = new Sprite(
    new SpriteMaterial({
      map: glowTex,
      color: '#ffd9ae',
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      opacity: 0.95,
    }),
  );
  sun.position.copy(sunDirection).multiplyScalar(300);
  sun.scale.set(78, 78, 1);
  const core = new Sprite(
    new SpriteMaterial({
      map: glowTex,
      color: '#fff6e8',
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    }),
  );
  core.position.copy(sun.position);
  core.scale.set(16, 16, 1);

  const clouds = new Group();
  const cloudMat = new MeshBasicMaterial({
    map: cloudTex,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    opacity: 0.38,
    color: '#ffd2b4',
  });
  const bases: { mesh: Mesh; x: number; z: number; y: number }[] = [];
  for (let i = 0; i < 7; i += 1) {
    const mesh = new Mesh(new PlaneGeometry(70 + (i % 3) * 18, 28 + (i % 2) * 10), cloudMat);
    mesh.position.set(-80 + i * 28, 28 + (i % 3) * 4, -40 + (i % 4) * 18);
    mesh.rotation.x = -0.15;
    mesh.renderOrder = -1;
    clouds.add(mesh);
    bases.push({ mesh, x: mesh.position.x, z: mesh.position.z, y: mesh.position.y });
  }

  const group = new Group();
  group.add(dome, sun, core, clouds);

  return {
    group,
    dome,
    sunDirection,
    update(time) {
      uniforms.uTime.value = time;
      for (const cloud of bases) {
        cloud.mesh.position.x = cloud.x + Math.sin(time * 0.02 + cloud.y) * 6;
      }
    },
  };
}
