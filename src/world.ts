import {
  BufferAttribute,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Vector3,
} from 'three';
import { palette } from './palette';
import { sampleOcean } from './waves';

function hash(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function noise(x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash(x0, y0);
  const b = hash(x0 + 1, y0);
  const c = hash(x0, y0 + 1);
  const d = hash(x0 + 1, y0 + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

export function createIsland(): Group {
  const group = new Group();
  const geo = new IcosahedronGeometry(8.5, 4);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const rock = new Color(palette.island);
  const moss = new Color('#3d5344');
  const sand = new Color('#c4a27a');
  const tmp = new Color();
  for (let i = 0; i < pos.count; i += 1) {
    const v = new Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
    const n = v.clone().normalize();
    const bump = noise(n.x * 2.4 + 2, n.z * 2.4) * 1.6 + noise(n.x * 5, n.y * 5) * 0.45;
    v.addScaledVector(n, bump);
    if (n.y < 0.05) v.y = Math.min(v.y, -0.4);
    pos.setXYZ(i, v.x, v.y, v.z);
    tmp.copy(rock);
    if (n.y > 0.35) tmp.lerp(moss, Math.min(1, (n.y - 0.35) * 2));
    if (n.y < 0.18) tmp.lerp(sand, 0.65);
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new Mesh(
    geo,
    new MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0.02 }),
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);

  const trunkMat = new MeshStandardMaterial({ color: '#3a2a1c', roughness: 0.9 });
  const leafMat = new MeshStandardMaterial({ color: palette.foliage, roughness: 0.8 });
  const spots = [
    [1.2, 2.4, 0.4],
    [-2.2, 2.1, 1.5],
    [2.4, 1.6, -1.2],
    [-0.4, 2.8, -2.1],
    [3.1, 1.2, 1.8],
    [-3.2, 1.4, -0.6],
  ];
  for (const [x, y, z] of spots) {
    const trunk = new Mesh(new CylinderGeometry(0.12, 0.18, 1.1, 6), trunkMat);
    trunk.position.set(x, y, z);
    const crown = new Mesh(new ConeGeometry(0.7, 1.8, 7), leafMat);
    crown.position.set(x, y + 1.2, z);
    trunk.castShadow = crown.castShadow = true;
    group.add(trunk, crown);
  }

  const rockMat = new MeshStandardMaterial({ color: '#4a4038', roughness: 1 });
  for (let i = 0; i < 5; i += 1) {
    const rockMesh = new Mesh(new DodecahedronGeometry(0.7 + (i % 3) * 0.35, 0), rockMat);
    const a = (i / 5) * Math.PI * 2;
    rockMesh.position.set(Math.cos(a) * 9.2, -0.4, Math.sin(a) * 7.4);
    rockMesh.rotation.set(i, i * 0.4, 0);
    rockMesh.castShadow = true;
    group.add(rockMesh);
  }

  group.position.set(-62, -2.4, -46);
  return group;
}

type Drifter = { mesh: Object3D; x: number; z: number; phase: number };

export function createDebris(): { group: Group; update: (time: number) => void } {
  const group = new Group();
  const wood = new MeshStandardMaterial({ color: palette.wood, roughness: 0.8 });
  const hoop = new MeshStandardMaterial({ color: '#6a6258', metalness: 0.6, roughness: 0.4 });
  const items: Drifter[] = [];
  const spots = [
    [-16, 8],
    [-20, -6],
    [18, 14],
    [-8, -14],
  ];
  spots.forEach(([x, z], i) => {
    const barrel = new Mesh(new CylinderGeometry(0.32, 0.34, 0.72, 10), wood);
    const band = new Mesh(new CylinderGeometry(0.345, 0.345, 0.06, 10), hoop);
    band.position.y = 0.18;
    const band2 = band.clone();
    band2.position.y = -0.18;
    const root = new Group();
    root.add(barrel, band, band2);
    group.add(root);
    items.push({ mesh: root, x, z, phase: i * 1.3 });
  });
  return {
    group,
    update(time) {
      for (const item of items) {
        const sea = sampleOcean(item.x, item.z, time);
        item.mesh.position.set(item.x, sea.y + 0.15, item.z);
        item.mesh.rotation.z = Math.sin(time * 0.8 + item.phase) * 0.18;
        item.mesh.rotation.x = Math.cos(time * 0.6 + item.phase) * 0.12;
      }
    },
  };
}
