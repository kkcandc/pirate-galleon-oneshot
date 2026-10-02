import {
  BoxGeometry,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  Quaternion,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  TubeGeometry,
  Vector3,
  type Texture,
} from 'three';
import {
  BOW_X,
  STERN_X,
  buildBulwarkGeometry,
  buildDeckGeometry,
  buildHullGeometry,
  railPoints,
  stationAt,
  surfaceNearY,
  tFromX,
} from './hull';
import { palette } from './palette';
import { sampleOcean } from './waves';
import { addWind } from './wind';

export type ShipHandle = {
  group: Group;
  muzzles: Vector3[];
  update: (time: number) => void;
};

const UP = new Vector3(0, 1, 0);

function cylinderBetween(a: Vector3, b: Vector3, radiusA: number, radiusB: number, segs = 8): BufferGeometry {
  const length = Math.max(0.02, a.distanceTo(b));
  const geo = new CylinderGeometry(radiusB, radiusA, length, segs, 1);
  const mid = a.clone().lerp(b, 0.5);
  const dir = b.clone().sub(a).normalize();
  const q = new Quaternion().setFromUnitVectors(UP, dir);
  geo.applyMatrix4(new Matrix4().compose(mid, q, new Vector3(1, 1, 1)));
  return geo;
}

function place(geo: BufferGeometry, position: Vector3, rotY = 0): BufferGeometry {
  const q = new Quaternion().setFromAxisAngle(UP, rotY);
  geo.applyMatrix4(new Matrix4().compose(position, q, new Vector3(1, 1, 1)));
  return geo;
}

function makeSquareSail(width: number, height: number, belly: number): BufferGeometry {
  const geo = new PlaneGeometry(width, height, 16, 12);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const u = x / width + 0.5;
    const v = y / height + 0.5;
    pos.setZ(i, belly * Math.sin(u * Math.PI) * Math.sin(Math.max(0.001, v) * Math.PI));
    pos.setY(i, y - Math.sin(u * Math.PI) * 0.16 * (1 - v));
  }
  geo.computeVertexNormals();
  return geo;
}

function makeTriangleSail(width: number, height: number, belly: number): BufferGeometry {
  const n = 8;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const map: number[][] = [];
  let count = 0;
  for (let j = 0; j <= n; j += 1) {
    map[j] = [];
    const v = j / n;
    const half = width * 0.5 * v;
    for (let i = 0; i <= j; i += 1) {
      const u = j === 0 ? 0.5 : i / j;
      const x = (u - 0.5) * 2 * half;
      const y = height * (1 - v);
      positions.push(x, y, belly * Math.sin(v * Math.PI) * Math.sin(u * Math.PI));
      uvs.push(u, 1 - v);
      map[j][i] = count;
      count += 1;
    }
  }
  for (let j = 0; j < n; j += 1) {
    for (let i = 0; i <= j; i += 1) {
      indices.push(map[j][i], map[j + 1][i], map[j + 1][i + 1]);
      if (i < j) indices.push(map[j][i], map[j + 1][i + 1], map[j][i + 1]);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const normal = geo.attributes.normal;
  let nz = 0;
  for (let i = 0; i < normal.count; i += 1) nz += normal.getZ(i);
  if (nz < 0 && geo.index) {
    for (let i = 0; i < geo.index.count; i += 3) {
      const b = geo.index.getX(i + 1);
      const c = geo.index.getX(i + 2);
      geo.index.setX(i + 1, c);
      geo.index.setX(i + 2, b);
    }
    geo.computeVertexNormals();
  }
  return geo;
}

function makeFlag(width: number, height: number, taper: boolean): BufferGeometry {
  const geo = new PlaneGeometry(width, height, 18, 6);
  geo.translate(-width / 2, 0, 0);
  if (taper) {
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      const fly = Math.min(1, Math.max(0, -pos.getX(i) / width));
      pos.setY(i, pos.getY(i) * (1 - 0.88 * fly));
    }
  }
  geo.computeVertexNormals();
  return geo;
}

function solid(geo: BufferGeometry, material: MeshStandardMaterial, shadows = true): Mesh {
  const mesh = new Mesh(geo, material);
  mesh.castShadow = shadows;
  mesh.receiveShadow = shadows;
  return mesh;
}

export function createShip(textures: {
  wood: Texture;
  sail: Texture;
  roger: Texture;
  name: Texture;
  glow: Texture;
}): ShipHandle {
  const group = new Group();
  group.rotation.order = 'YXZ';

  const hullMat = new MeshStandardMaterial({
    map: textures.wood,
    color: '#ffffff',
    vertexColors: true,
    roughness: 0.78,
    metalness: 0.08,
    envMapIntensity: 0.4,
  });
  const woodMat = new MeshStandardMaterial({
    map: textures.wood,
    color: palette.hull,
    roughness: 0.74,
    metalness: 0.05,
    envMapIntensity: 0.35,
  });
  const deckMat = new MeshStandardMaterial({
    map: textures.wood,
    color: palette.deck,
    roughness: 0.84,
    metalness: 0.03,
  });
  const copperMat = new MeshStandardMaterial({
    color: palette.copper,
    metalness: 1,
    roughness: 0.28,
    envMapIntensity: 1.15,
  });
  const goldMat = new MeshStandardMaterial({
    color: palette.gold,
    metalness: 1,
    roughness: 0.22,
    envMapIntensity: 1.2,
  });
  const metalMat = new MeshStandardMaterial({
    color: palette.metal,
    metalness: 0.86,
    roughness: 0.38,
    envMapIntensity: 0.9,
  });
  const darkMat = new MeshStandardMaterial({ color: '#0c0908', roughness: 0.95, metalness: 0.05 });
  const sailMat = new MeshStandardMaterial({
    map: textures.sail,
    color: palette.sail,
    roughness: 0.84,
    metalness: 0,
    side: DoubleSide,
    emissive: '#ffb07a',
    emissiveIntensity: 0.18,
    envMapIntensity: 0.15,
  });
  addWind(sailMat, 'sail');
  const rogerMat = new MeshStandardMaterial({
    map: textures.roger,
    roughness: 0.7,
    metalness: 0,
    side: DoubleSide,
  });
  addWind(rogerMat, 'flag');
  const pennantMat = new MeshStandardMaterial({
    color: palette.crimson,
    roughness: 0.55,
    metalness: 0.05,
    side: DoubleSide,
    emissive: '#4a1018',
    emissiveIntensity: 0.2,
  });
  addWind(pennantMat, 'flag');
  const glowMat = new MeshStandardMaterial({
    color: '#ffc27a',
    emissive: new Color(palette.lantern),
    emissiveIntensity: 2.4,
    roughness: 0.2,
  });
  const spriteMat = new SpriteMaterial({
    map: textures.glow,
    color: palette.lantern,
    transparent: true,
    depthWrite: false,
    opacity: 0.9,
  });

  group.add(solid(buildHullGeometry(), hullMat));
  group.add(solid(buildDeckGeometry(), deckMat));
  group.add(solid(buildBulwarkGeometry(), woodMat));

  const tube = (pts: Vector3[], radius: number) =>
    new TubeGeometry(new CatmullRomCurve3(pts), Math.max(8, pts.length * 2), radius, 5, false);

  for (const port of [true, false]) {
    group.add(solid(tube(railPoints(port, 22), 0.035), woodMat));
    const copper: Vector3[] = [];
    const gold: Vector3[] = [];
    for (let i = 0; i <= 30; i += 1) {
      const t = 0.03 + (i / 30) * 0.9;
      const low = surfaceNearY(t, 0.28, port);
      const high = surfaceNearY(t, 1.42, port);
      copper.push(new Vector3(low[0], low[1], low[2]));
      gold.push(new Vector3(high[0], high[1], high[2]));
    }
    group.add(solid(tube(copper, 0.055), copperMat));
    group.add(solid(tube(gold, 0.04), goldMat));
  }

  const keel: Vector3[] = [];
  for (let i = 0; i <= 26; i += 1) {
    const station = stationAt(0.05 + (i / 26) * 0.86);
    keel.push(new Vector3(station.x, station.keelY - 0.08, 0));
  }
  group.add(solid(tube(keel, 0.07), darkMat));
  group.add(solid(place(new BoxGeometry(0.16, 1.8, 0.62), new Vector3(STERN_X - 0.22, -0.05, 0)), darkMat));

  const masts = [
    {
      x: 4.55,
      top: 14.6,
      radius: 0.15,
      yaw: 0.46,
      sails: [
        { y: 6.15, w: 6.3, h: 4.2, belly: 0.55 },
        { y: 9.9, w: 4.7, h: 3.15, belly: 0.32 },
        { y: 12.7, w: 3.2, h: 2.25, belly: 0.18 },
      ],
    },
    {
      x: -0.45,
      top: 16.5,
      radius: 0.18,
      yaw: 0.5,
      sails: [
        { y: 6.5, w: 7.5, h: 4.7, belly: 0.68 },
        { y: 10.6, w: 5.6, h: 3.45, belly: 0.4 },
        { y: 13.85, w: 3.8, h: 2.45, belly: 0.22 },
      ],
    },
    {
      x: -6.35,
      top: 11.6,
      radius: 0.12,
      yaw: 0.42,
      sails: [{ y: 8.3, w: 4.3, h: 2.9, belly: 0.26 }],
    },
  ];

  const mastTops: Vector3[] = [];
  const lines: number[] = [];
  const rope = (a: Vector3, b: Vector3) => {
    lines.push(a.x, a.y, a.z, b.x, b.y, b.z);
  };

  for (const mast of masts) {
    const deckY = stationAt(tFromX(mast.x)).deckY;
    const base = new Vector3(mast.x, deckY - 0.2, 0);
    const top = new Vector3(mast.x, mast.top, 0);
    mastTops.push(top);
    group.add(solid(cylinderBetween(base, top, mast.radius, mast.radius * 0.45, 8), woodMat));
    for (const sail of mast.sails) {
      const rig = new Group();
      rig.position.set(mast.x, sail.y, 0);
      rig.rotation.y = mast.yaw;
      const cloth = new Mesh(makeSquareSail(sail.w, sail.h, sail.belly), sailMat);
      cloth.castShadow = true;
      cloth.receiveShadow = true;
      const yard = new Mesh(new CylinderGeometry(0.045, 0.05, sail.w + 0.55, 6), woodMat);
      yard.rotation.z = Math.PI / 2;
      yard.position.y = sail.h / 2 - 0.05;
      yard.castShadow = true;
      rig.add(cloth, yard);
      group.add(rig);
    }
    const spread = Math.min(2.5, stationAt(tFromX(mast.x)).beam * 0.82);
    for (const side of [-1, 1]) {
      const anchors = [0.15, 1.05, 1.9].map(
        (aft) => new Vector3(mast.x - aft, deckY + 0.15, side * spread),
      );
      for (const anchor of anchors) rope(top.clone().lerp(new Vector3(mast.x, mast.top * 0.72, 0), 0.15), anchor);
      for (let k = 1; k <= 7; k += 1) {
        const t = k / 11;
        rope(top.clone().lerp(anchors[0], t), top.clone().lerp(anchors[2], t));
      }
    }
  }

  const bowspritTip = new Vector3(BOW_X + 5.6, 1.55, 0);
  const bowspritRoot = new Vector3(BOW_X - 1.4, stationAt(0.92).deckY + 0.35, 0);
  group.add(solid(cylinderBetween(bowspritRoot, bowspritTip, 0.14, 0.05, 7), woodMat));
  rope(mastTops[0], bowspritTip);
  rope(mastTops[1], mastTops[0]);
  rope(mastTops[2], mastTops[1]);
  rope(mastTops[1], new Vector3(STERN_X + 1.2, stationAt(0.08).deckY + 1.4, 0));

  const jibA = new Mesh(makeTriangleSail(5.8, 6.4, 0.35), sailMat);
  jibA.position.set(9.4, 5.6, 0.05);
  jibA.rotation.set(0, 0.25, -0.72);
  jibA.castShadow = true;
  const jibB = new Mesh(makeTriangleSail(4.2, 4.6, 0.22), sailMat);
  jibB.position.set(12.2, 4.3, -0.05);
  jibB.rotation.set(0.05, -0.2, -0.95);
  jibB.castShadow = true;
  const lateen = new Mesh(makeTriangleSail(7.4, 5.2, 0.4), sailMat);
  lateen.position.set(-6.5, 6.8, 0);
  lateen.rotation.set(0, 0.62, 0.42);
  lateen.castShadow = true;
  group.add(jibA, jibB, lateen);

  const nestY = 10.4;
  group.add(solid(place(new CylinderGeometry(0.72, 0.78, 0.12, 10), new Vector3(-0.45, nestY, 0)), woodMat));
  const nestRail = new TorusGeometry(0.74, 0.03, 6, 16);
  nestRail.rotateX(Math.PI / 2);
  nestRail.translate(-0.45, nestY + 0.28, 0);
  group.add(solid(nestRail, woodMat));

  const roger = new Mesh(makeFlag(2.15, 1.4, false), rogerMat);
  roger.position.set(-0.45, 16.55, 0);
  roger.castShadow = true;
  group.add(roger);
  const pennantSpots = [
    { x: 4.55, y: 14.7, w: 2.8 },
    { x: -0.45, y: 16.15, w: 3.6 },
    { x: -6.35, y: 11.7, w: 2.4 },
  ];
  for (const spot of pennantSpots) {
    const pennant = new Mesh(makeFlag(spot.w, 0.38, true), pennantMat);
    pennant.position.set(spot.x, spot.y, 0);
    pennant.castShadow = true;
    group.add(pennant);
  }

  const lineGeo = new BufferGeometry();
  lineGeo.setAttribute('position', new Float32BufferAttribute(lines, 3));
  const ropes = new LineSegments(lineGeo, new LineBasicMaterial({ color: palette.rope }));
  group.add(ropes);

  const muzzles: Vector3[] = [];
  for (const x of [-4.4, -2.0, 0.5, 2.9, 5.15]) {
    for (const port of [true, false]) {
      const surf = surfaceNearY(tFromX(x), 1.02, port);
      const outward = new Vector3(0, 0, Math.sign(surf[2]) || 1);
      const surface = new Vector3(surf[0], surf[1], surf[2]);
      const inner = surface.clone().addScaledVector(outward, -0.7);
      const outer = surface.clone().addScaledVector(outward, 0.95);
      group.add(solid(cylinderBetween(inner, outer, 0.16, 0.1, 8), metalMat));
      const hole = new BoxGeometry(0.55, 0.62, 0.18);
      const aim = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), outward);
      hole.applyMatrix4(
        new Matrix4().compose(surface.clone().addScaledVector(outward, -0.08), aim, new Vector3(1, 1, 1)),
      );
      group.add(solid(hole, darkMat, false));
      muzzles.push(outer);
    }
  }

  const sternDeck = stationAt(0.1).deckY;
  const cabin = solid(place(new BoxGeometry(2.5, 1.28, 2.5), new Vector3(-9.55, sternDeck + 0.58, 0)), woodMat);
  group.add(cabin);
  for (let i = -2; i <= 2; i += 1) {
    const win = new Mesh(new BoxGeometry(0.06, 0.42, 0.32), glowMat);
    win.position.set(-10.82, sternDeck + 0.62, i * 0.4);
    group.add(win);
    const lower = new Mesh(new BoxGeometry(0.05, 0.48, 0.34), glowMat);
    lower.position.set(STERN_X - 0.06, 2.35, i * 0.48);
    group.add(lower);
  }
  const plate = new Mesh(new PlaneGeometry(2.5, 0.62), new MeshStandardMaterial({ map: textures.name, roughness: 0.45 }));
  plate.position.set(STERN_X - 0.16, 1.55, 0);
  plate.rotation.y = -Math.PI / 2;
  group.add(plate);

  for (const side of [-1, 1]) {
    const gallery = solid(place(new BoxGeometry(2.3, 1.05, 0.42), new Vector3(-9.3, 2.35, side * 3.05)), woodMat);
    group.add(gallery);
    const pane = new Mesh(new BoxGeometry(0.7, 0.36, 0.06), glowMat);
    pane.position.set(-9.3, 2.4, side * 3.28);
    group.add(pane);
  }

  const beak = solid(place(new BoxGeometry(3.4, 0.12, 1.35), new Vector3(BOW_X + 1.7, 2.05, 0)), deckMat);
  group.add(beak);
  const head = new Group();
  const body = new Mesh(new SphereGeometry(0.26, 12, 10), goldMat);
  body.scale.set(1.35, 0.72, 0.5);
  const beakCone = new Mesh(new ConeGeometry(0.09, 0.5, 8), goldMat);
  beakCone.rotation.z = -Math.PI / 2;
  beakCone.position.x = 0.42;
  const wingL = new Mesh(new BoxGeometry(0.08, 0.42, 0.7), goldMat);
  wingL.position.set(-0.05, 0.05, 0.28);
  wingL.rotation.x = -0.5;
  const wingR = wingL.clone();
  wingR.position.z = -0.28;
  wingR.rotation.x = 0.5;
  head.add(body, beakCone, wingL, wingR);
  head.position.set(BOW_X + 2.5, 2.45, 0);
  head.traverse((obj) => {
    if (obj instanceof Mesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });
  group.add(head);

  const anchorShank = solid(cylinderBetween(new Vector3(8.2, 2.5, 2.35), new Vector3(8.2, 0.7, 2.55), 0.045, 0.045, 6), metalMat);
  group.add(anchorShank);
  const ring = new TorusGeometry(0.22, 0.035, 6, 12);
  ring.translate(8.2, 0.55, 2.6);
  group.add(solid(ring, metalMat));

  const capY = stationAt(tFromX(1.2)).deckY;
  group.add(solid(place(new CylinderGeometry(0.28, 0.34, 0.7, 10), new Vector3(1.2, capY + 0.35, 0)), woodMat));
  const wheel = new Group();
  const rim = new Mesh(new TorusGeometry(0.48, 0.035, 6, 18), woodMat);
  wheel.add(rim);
  for (let i = 0; i < 8; i += 1) {
    const spoke = new Mesh(new CylinderGeometry(0.02, 0.02, 0.92, 4), woodMat);
    spoke.rotation.z = (i / 8) * Math.PI;
    wheel.add(spoke);
  }
  wheel.position.set(-8.7, sternDeck + 0.85, 0);
  wheel.rotation.x = -0.55;
  wheel.traverse((obj) => {
    if (obj instanceof Mesh) obj.castShadow = true;
  });
  group.add(wheel);

  const barrelMat = woodMat;
  for (const [x, z] of [
    [2.4, 1.15],
    [3.1, 1.25],
    [2.7, -1.2],
    [-1.4, 1.05],
    [-2.1, -1.15],
  ] as const) {
    const y = stationAt(tFromX(x)).deckY + 0.34;
    const barrel = new Mesh(new CylinderGeometry(0.28, 0.3, 0.66, 8), barrelMat);
    barrel.position.set(x, y, z);
    barrel.castShadow = true;
    const band = new Mesh(new CylinderGeometry(0.31, 0.31, 0.05, 8), metalMat);
    band.position.set(x, y + 0.16, z);
    group.add(barrel, band);
  }

  const lights: PointLight[] = [];
  const lantern = (x: number, y: number, z: number, withLight: boolean) => {
    const bulb = new Mesh(new SphereGeometry(0.1, 8, 6), glowMat);
    bulb.position.set(x, y, z);
    const glow = new Sprite(spriteMat.clone());
    glow.position.set(x, y, z);
    glow.scale.set(1.5, 1.5, 1);
    group.add(bulb, glow);
    if (withLight) {
      const light = new PointLight(palette.lantern, 14, 12, 2);
      light.position.set(x, y, z);
      light.userData.base = 14;
      light.userData.phase = x * 2 + z;
      group.add(light);
      lights.push(light);
    }
  };
  lantern(-10.7, sternDeck + 1.35, 1.15, true);
  lantern(-10.7, sternDeck + 1.35, -1.15, true);
  lantern(BOW_X - 0.4, stationAt(0.9).deckY + 1.3, 0, true);
  lantern(3.4, stationAt(tFromX(3.4)).deckY + 1.15, 1.6, false);
  lantern(-2.2, stationAt(tFromX(-2.2)).deckY + 1.15, -1.55, true);

  return {
    group,
    muzzles,
    update(time) {
      const sea = sampleOcean(0, 0, time);
      group.position.y = sea.y * 0.65;
      group.rotation.x = Math.min(0.08, Math.max(-0.08, -sea.dx * 0.045));
      group.rotation.z = Math.min(0.12, Math.max(-0.08, 0.04 + sea.dz * 0.06));
      for (const light of lights) {
        const base = light.userData.base as number;
        const phase = light.userData.phase as number;
        light.intensity = base + Math.sin(time * 7.5 + phase) * 1.1 + Math.sin(time * 19 + phase) * 0.35;
      }
    },
  };
}
