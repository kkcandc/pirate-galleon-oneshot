import { MeshStandardMaterial } from 'three';

export const windTime = { value: 0 };
export const windAmp = { value: 1 };

const SAIL_SNIPPET = `
float freeSide = smoothstep(0.0, 0.12, uv.x) * smoothstep(1.0, 0.88, uv.x);
float foot = 1.0 - uv.y;
float flap = sin(uTime * 1.7 + position.y * 1.6 + position.x * 0.7);
float flap2 = sin(uTime * 2.6 + position.y * 3.0);
transformed.z += uAmp * (0.65 * flap + 0.35 * flap2) * 0.22 * (0.2 + 0.8 * foot) * (0.35 + 0.65 * freeSide);
transformed.y += uAmp * sin(uTime * 1.2 + position.x * 1.5) * 0.05 * foot;
`;

const FLAG_SNIPPET = `
float fly = clamp(-position.x / 2.5, 0.0, 1.0);
transformed.y += sin(uTime * 3.1 + position.x * 4.6) * 0.2 * fly * uAmp;
transformed.z += sin(uTime * 2.4 + position.y * 3.2 + position.x) * 0.32 * fly * uAmp;
`;

export function addWind(material: MeshStandardMaterial, mode: 'sail' | 'flag'): void {
  const snippet = mode === 'sail' ? SAIL_SNIPPET : FLAG_SNIPPET;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = windTime;
    shader.uniforms.uAmp = windAmp;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
uniform float uTime;
uniform float uAmp;`,
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
${snippet}`,
    );
  };
  material.customProgramCacheKey = () => `wind-${mode}`;
}
