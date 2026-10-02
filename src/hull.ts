import {
  BufferGeometry,
  Float32BufferAttribute,
  Vector3,
} from 'three';

export const STERN_X = -11.4;
export const BOW_X = 10.4;
export const MAX_BEAM = 3.35;

const _hint = new Vector3();
const _a = new Vector3();
const _b = new Vector3();
const _c = new Vector3();
const _n = new Vector3();

export type Station = { x: number; beam: number; deckY: number; keelY: number };

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function tFromX(x: number): number {
  return (x - STERN_X) / (BOW_X - STERN_X);
}

export function stationAt(t: number): Station {
  const tt = Math.min(1, Math.max(0, t));
  const x = STERN_X + (BOW_X - STERN_X) * tt;
  const nose = smoothstep(0.58, 1, tt);
  const entrance = Math.sin(Math.pow(tt, 0.7) * Math.PI);
  let beam = MAX_BEAM * Math.pow(Math.max(0, entrance), 0.62);
  beam *= 1 - nose * 0.99;
  if (tt < 0.16) {
    beam = STERN_BEAM() * (1 - smoothstep(0, 0.16, tt)) + beam * smoothstep(0, 0.16, tt);
  }
  beam = Math.max(beam, 0.05);
  const deckY = 1.82 + Math.pow(1 - tt, 1.38) * 1.72 + Math.pow(smoothstep(0.76, 1, tt), 1.1) * 0.78;
  const keelY = -1.58 + nose * 1.2 + (1 - smoothstep(0, 0.18, tt)) * 0.22;
  return { x, beam, deckY, keelY };
}

function STERN_BEAM(): number {
  return MAX_BEAM * 0.8;
}

export function sectionPoint(t: number, s: number): [number, number, number] {
  const station = stationAt(t);
  const ss = Math.min(1, Math.max(0, s));
  const side = ss < 0.5 ? 1 : -1;
  const u = ss < 0.5 ? ss * 2 : (1 - ss) * 2;
  const drop = Math.pow(u, 0.78);
  const y = station.keelY + (station.deckY - station.keelY) * (1 - drop);
  const yn = 1 - drop;
  const wl = Math.min(1, Math.max(0, (0.1 - station.keelY) / (station.deckY - station.keelY)));
  const bulge = 1 + 0.16 * Math.exp(-((yn - wl) * (yn - wl)) / 0.03);
  let z = side * station.beam * Math.pow(Math.max(yn, 0), 0.72) * bulge;
  if (y > 0.1) {
    const above = (y - 0.1) / Math.max(0.35, station.deckY - 0.1);
    z *= 1 - 0.2 * above * above;
  }
  return [station.x, y, z];
}

export function surfaceNearY(t: number, yTarget: number, port: boolean): [number, number, number] {
  let best = sectionPoint(t, port ? 0 : 1);
  let bestD = Infinity;
  for (let i = 0; i <= 28; i += 1) {
    const s = port ? (i / 28) * 0.49 : 0.51 + (i / 28) * 0.49;
    const p = sectionPoint(t, s);
    const d = Math.abs(p[1] - yTarget);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

function assertFinite(geo: BufferGeometry, name: string): void {
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      throw new Error(`Non-finite vertex in ${name}`);
    }
  }
}

function buildRibbon(
  stations: number,
  sample: (t: number) => { a: [number, number, number]; b: [number, number, number] },
  outwardFor: (t: number) => Vector3,
): BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= stations; i += 1) {
    const t = i / stations;
    const { a, b } = sample(t);
    positions.push(a[0], a[1], a[2], b[0], b[1], b[2]);
    uvs.push(t * 6, 0, t * 6, 1);
  }
  for (let i = 0; i < stations; i += 1) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    const hint = outwardFor(i / stations);
    addTri(positions, indices, a, c, b, hint);
    addTri(positions, indices, b, c, d, hint);
  }
  return geometryFrom(positions, uvs, indices, null);
}

function addTri(
  positions: number[],
  indices: number[],
  i0: number,
  i1: number,
  i2: number,
  outward: Vector3,
): void {
  _a.set(positions[i0 * 3], positions[i0 * 3 + 1], positions[i0 * 3 + 2]);
  _b.set(positions[i1 * 3], positions[i1 * 3 + 1], positions[i1 * 3 + 2]);
  _c.set(positions[i2 * 3], positions[i2 * 3 + 1], positions[i2 * 3 + 2]);
  _n.copy(_b).sub(_a).cross(_c.clone().sub(_a));
  if (_n.dot(outward) < 0) indices.push(i0, i2, i1);
  else indices.push(i0, i1, i2);
}

function geometryFrom(
  positions: number[],
  uvs: number[],
  indices: number[],
  colors: number[] | null,
): BufferGeometry {
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  if (colors) geo.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function buildHullGeometry(): BufferGeometry {
  const stations = 72;
  const rings = 30;
  const seg = rings + 1;
  const positions: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const tint = (y: number, out: number[]) => {
    let r = 0.62;
    let g = 0.36;
    let b = 0.24;
    if (y < 0.2) {
      const k = smoothstep(0.2, -1.05, y);
      r = r * (1 - k) + 0.12 * k;
      g = g * (1 - k) + 0.07 * k;
      b = b * (1 - k) + 0.05 * k;
    }
    const wale = Math.exp(-((y - 1.02) ** 2) / 0.01);
    r = r * (1 - wale) + 0.07 * wale;
    g = g * (1 - wale) + 0.05 * wale;
    b = b * (1 - wale) + 0.04 * wale;
    out.push(r, g, b);
  };

  for (let i = 0; i <= stations; i += 1) {
    const t = i / stations;
    for (let r = 0; r <= rings; r += 1) {
      const [x, y, z] = sectionPoint(t, r / rings);
      positions.push(x, y, z);
      uvs.push(t * 9, (r / rings) * 3);
      tint(y, colors);
    }
  }

  for (let i = 0; i < stations; i += 1) {
    for (let r = 0; r < rings; r += 1) {
      const a = i * seg + r;
      const b = a + 1;
      const c = a + seg;
      const d = c + 1;
      const y = (positions[a * 3 + 1] + positions[d * 3 + 1]) * 0.5;
      const z = (positions[a * 3 + 2] + positions[d * 3 + 2]) * 0.5;
      _hint.set(0, y * 0.2, z);
      if (_hint.lengthSq() < 1e-6) _hint.set(0, -1, 0);
      addTri(positions, indices, a, c, b, _hint);
      addTri(positions, indices, b, c, d, _hint);
    }
  }

  const addCap = (station: number, outwardX: number) => {
    const base = station * seg;
    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (let r = 0; r <= rings; r += 1) {
      cx += positions[(base + r) * 3];
      cy += positions[(base + r) * 3 + 1];
      cz += positions[(base + r) * 3 + 2];
    }
    const count = rings + 1;
    const center = positions.length / 3;
    positions.push(cx / count, cy / count, cz / count);
    uvs.push(station === 0 ? 0 : 9, 1.5);
    colors.push(0.35, 0.2, 0.13);
    _hint.set(outwardX, 0, 0);
    for (let r = 0; r < rings; r += 1) {
      addTri(positions, indices, center, base + r, base + r + 1, _hint);
    }
  };

  addCap(0, -1);
  addCap(stations, 1);

  const geo = geometryFrom(positions, uvs, indices, colors);
  assertFinite(geo, 'hull');
  return geo;
}

export function buildDeckGeometry(): BufferGeometry {
  const stations = 70;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= stations; i += 1) {
    const t = i / stations;
    const port = sectionPoint(t, 0);
    const stbd = sectionPoint(t, 1);
    const y = port[1] - 0.04;
    positions.push(port[0], y, port[2] - 0.22, stbd[0], y, stbd[2] + 0.22);
    uvs.push(t * 12, 0, t * 12, 1);
  }
  for (let i = 0; i < stations; i += 1) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    _hint.set(0, 1, 0);
    addTri(positions, indices, a, c, b, _hint);
    addTri(positions, indices, b, c, d, _hint);
  }
  const geo = geometryFrom(positions, uvs, indices, null);
  assertFinite(geo, 'deck');
  return geo;
}

export function buildBulwarkGeometry(): BufferGeometry {
  const stations = 64;
  const geo = buildRibbon(
    stations,
    (t) => {
      const port = sectionPoint(t, 0);
      const h = 0.58 + (1 - t) * 0.28;
      return {
        a: [port[0], port[1] + h, port[2] - 0.1],
        b: [port[0], port[1], port[2]],
      };
    },
    () => _hint.set(0, 0.2, 1),
  );
  const stbd = buildRibbon(
    stations,
    (t) => {
      const p = sectionPoint(t, 1);
      const h = 0.58 + (1 - t) * 0.28;
      return {
        a: [p[0], p[1], p[2]],
        b: [p[0], p[1] + h, p[2] + 0.1],
      };
    },
    () => _hint.set(0, 0.2, -1),
  );
  // Merge manually to keep this file free of the utils import cycle.
  const geoPos = geo.getAttribute('position');
  const stPos = stbd.getAttribute('position');
  const positions = Array.from(geoPos.array as ArrayLike<number>);
  const uvs = Array.from(geo.getAttribute('uv').array as ArrayLike<number>);
  const index = Array.from(geo.getIndex()?.array ?? []);
  const offset = geoPos.count;
  for (let i = 0; i < stPos.count; i += 1) {
    positions.push(stPos.getX(i), stPos.getY(i), stPos.getZ(i));
  }
  const stUv = stbd.getAttribute('uv');
  for (let i = 0; i < stUv.count; i += 1) uvs.push(stUv.getX(i), stUv.getY(i));
  const stIndex = stbd.getIndex();
  if (stIndex) {
    for (let i = 0; i < stIndex.count; i += 1) index.push(stIndex.getX(i) + offset);
  }
  const merged = geometryFrom(positions, uvs, index, null);
  assertFinite(merged, 'bulwark');
  return merged;
}

export function railPoints(sidePort: boolean, samples = 18): Vector3[] {
  const pts: Vector3[] = [];
  for (let i = 0; i <= samples; i += 1) {
    const t = 0.04 + (i / samples) * 0.9;
    const p = sectionPoint(t, sidePort ? 0 : 1);
    const h = 0.62 + (1 - t) * 0.28;
    const z = sidePort ? p[2] - 0.1 : p[2] + 0.1;
    pts.push(new Vector3(p[0], p[1] + h, z));
  }
  return pts;
}
