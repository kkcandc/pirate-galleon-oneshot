import { Color, Mesh, PlaneGeometry, ShaderMaterial, Vector2, GLSL3 } from 'three';
import { palette } from './palette';
import { SAIL_SPEED, gerstnerGlsl } from './waves';

const vertexShader = /* glsl */ `
uniform float uTime;
out vec3 vWorld;
out vec3 vNormal;
out float vHeight;

void main() {
  vec2 phase = position.xz;
  phase.x += uTime * ${SAIL_SPEED.toFixed(4)};
  vec3 p = vec3(position.x, 0.0, position.z);
  vec3 tx = vec3(1.0, 0.0, 0.0);
  vec3 tz = vec3(0.0, 0.0, 1.0);
  ${gerstnerGlsl()}
  vec3 n = normalize(cross(tz, tx));
  vec4 world = modelMatrix * vec4(p, 1.0);
  vWorld = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * n);
  vHeight = p.y;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const fragmentShader = /* glsl */ `
uniform float uTime;
uniform vec3 uSun;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uHorizon;
uniform vec3 uFoam;
uniform vec2 uShip;
in vec3 vWorld;
in vec3 vNormal;
in float vHeight;
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

void main() {
  vec3 n = normalize(vNormal);
  vec3 viewDir = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - max(dot(n, viewDir), 0.0), 3.4);
  vec3 deep = uDeep;
  vec3 shallow = uShallow;
  vec3 water = mix(deep, shallow, smoothstep(-0.05, 0.32, vHeight));
  water = mix(water, uHorizon * 0.55, fres * 0.35);

  vec3 sparkleDir = reflect(-viewDir, n);
  float align = max(dot(sparkleDir, uSun), 0.0);
  float glint = noise(vWorld.xz * 1.8 + vec2(uTime * 0.35, -uTime * 0.22));
  float spec = pow(align, mix(28.0, 220.0, glint));
  float sheen = pow(align, 8.0);

  vec2 rel = vWorld.xz - uShip;
  float along = rel.x;
  float side = abs(rel.y);
  float behind = -along;
  float wake = smoothstep(1.2, 5.0, behind) * smoothstep(52.0, 10.0, behind);
  wake *= exp(-side * side / (0.55 + behind * 0.11));
  float bow = exp(-pow((along - 10.6) / 2.4, 2.0)) * exp(-side * side / 2.2);
  float crest = smoothstep(0.16, 0.4, vHeight);
  crest *= smoothstep(0.25, 0.75, noise(vWorld.xz * 2.6 + uTime * 0.12));

  vec3 col = mix(water, uHorizon, fres);
  col += uSun * spec * 1.35;
  col += uSun * sheen * 0.18;
  float foam = clamp(crest * 0.55 + wake * 0.95 + bow * 0.75, 0.0, 1.0);
  col = mix(col, uFoam, foam);

  float dist = distance(vWorld.xz, cameraPosition.xz);
  col = mix(col, uHorizon, smoothstep(70.0, 210.0, dist));
  fragColor = vec4(col, 1.0);
}
`;

export type WaterHandle = {
  mesh: Mesh;
  update: (time: number, shipX: number, shipZ: number) => void;
};

export function createWater(quality: 'high' | 'low'): WaterHandle {
  const segs = quality === 'high' ? 160 : 88;
  const geo = new PlaneGeometry(460, 460, segs, segs);
  geo.rotateX(-Math.PI / 2);
  const uniforms = {
    uTime: { value: 0 },
    uSun: { value: new Color(palette.sun) },
    uDeep: { value: new Color(palette.deep) },
    uShallow: { value: new Color(palette.shallow) },
    uHorizon: { value: new Color(palette.horizon) },
    uFoam: { value: new Color(palette.foam) },
    uShip: { value: new Vector2(0, 0) },
  };
  const material = new ShaderMaterial({
    glslVersion: GLSL3,
    uniforms,
    vertexShader,
    fragmentShader,
  });
  const mesh = new Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.receiveShadow = false;
  return {
    mesh,
    update(time, shipX, shipZ) {
      uniforms.uTime.value = time;
      uniforms.uShip.value.set(shipX, shipZ);
    },
  };
}
