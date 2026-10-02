export const SAIL_SPEED = 1.15;

export const WAVES = [
  { dir: [1, 0.16], amp: 0.28, len: 18, speed: 1.15, steep: 0.28 },
  { dir: [-0.28, 1], amp: 0.16, len: 9.5, speed: 1.35, steep: 0.34 },
  { dir: [0.72, -0.5], amp: 0.09, len: 5.4, speed: 1.65, steep: 0.36 },
  { dir: [-0.85, -0.25], amp: 0.045, len: 3.2, speed: 2.05, steep: 0.22 },
] as const;

export type OceanSample = { y: number; dx: number; dz: number };

export function sampleOcean(x: number, z: number, time: number): OceanSample {
  const sx = x + time * SAIL_SPEED;
  let y = 0;
  let dx = 0;
  let dz = 0;
  for (const wave of WAVES) {
    const mag = Math.hypot(wave.dir[0], wave.dir[1]) || 1;
    const dirx = wave.dir[0] / mag;
    const dirz = wave.dir[1] / mag;
    const k = (Math.PI * 2) / wave.len;
    const f = k * (dirx * sx + dirz * z) - wave.speed * k * time;
    const s = Math.sin(f);
    const c = Math.cos(f);
    y += wave.amp * s;
    dx += dirx * wave.amp * c * k;
    dz += dirz * wave.amp * c * k;
  }
  return { y, dx, dz };
}

/** Gerstner displacement + tangent basis. `phase` is the scrolled xz, `p/tx/tz` are accumulators. */
export function gerstnerGlsl(): string {
  return WAVES.map((wave) => {
    const mag = Math.hypot(wave.dir[0], wave.dir[1]) || 1;
    const dx = (wave.dir[0] / mag).toFixed(5);
    const dy = (wave.dir[1] / mag).toFixed(5);
    return `
    {
      vec2 d = vec2(${dx}, ${dy});
      float k = 6.28318530718 / ${wave.len.toFixed(4)};
      float a = ${wave.amp.toFixed(4)};
      float q = ${wave.steep.toFixed(4)};
      float f = k * dot(d, phase) - ${wave.speed.toFixed(4)} * k * uTime;
      float s = sin(f);
      float c = cos(f);
      p.x += d.x * (q * a) * c;
      p.y += a * s;
      p.z += d.y * (q * a) * c;
      tx.x += -d.x * d.x * (q * a) * s * k;
      tx.y += d.x * a * c * k;
      tx.z += -d.x * d.y * (q * a) * s * k;
      tz.x += -d.x * d.y * (q * a) * s * k;
      tz.y += d.y * a * c * k;
      tz.z += -d.y * d.y * (q * a) * s * k;
    }`;
  }).join('\n');
}
