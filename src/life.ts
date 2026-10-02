import {
  AdditiveBlending,
  BufferGeometry,
  DoubleSide,
  DynamicDrawUsage,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
  Points,
  PointsMaterial,
  Sprite,
  SpriteMaterial,
  Vector3,
  type Texture,
} from 'three';
import { sampleOcean } from './waves';

type Gull = {
  group: Group;
  left: Mesh;
  right: Mesh;
  phase: number;
  speed: number;
  ax: number;
  az: number;
  height: number;
};

type Puff = { sprite: Sprite; life: number; max: number; velocity: Vector3 };

export type LifeHandle = {
  group: Group;
  update: (time: number, dt: number, ship: Group, muzzles: Vector3[], boom: () => void) => void;
};

export function createLife(glow: Texture, motion: number): LifeHandle {
  const group = new Group();
  const gullMat = new MeshStandardMaterial({
    color: '#f3efe6',
    roughness: 0.65,
    side: DoubleSide,
  });
  const wing = new BufferGeometry();
  wing.setAttribute(
    'position',
    new Float32BufferAttribute([0, 0, 0, 1.15, 0.02, 0.05, 0.2, 0, 0.32], 3),
  );
  wing.computeVertexNormals();
  const gulls: Gull[] = [];
  for (let i = 0; i < 8; i += 1) {
    const root = new Group();
    const left = new Mesh(wing, gullMat);
    const right = new Mesh(wing, gullMat);
    right.scale.x = -1;
    const body = new Mesh(wing, gullMat);
    body.scale.set(0.25, 0.25, 0.8);
    root.add(left, right, body);
    group.add(root);
    gulls.push({
      group: root,
      left,
      right,
      phase: i * 0.8,
      speed: 0.18 + (i % 3) * 0.04,
      ax: 16 + i * 2.1,
      az: 9 + (i % 4) * 1.6,
      height: 7.5 + (i % 5) * 1.3,
    });
  }

  const count = 48;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sprayGeo = new BufferGeometry();
  const sprayPos = new Float32BufferAttribute(positions, 3);
  sprayPos.setUsage(DynamicDrawUsage);
  const sprayCol = new Float32BufferAttribute(colors, 3);
  sprayCol.setUsage(DynamicDrawUsage);
  sprayGeo.setAttribute('position', sprayPos);
  sprayGeo.setAttribute('color', sprayCol);
  const spray = new Points(
    sprayGeo,
    new PointsMaterial({
      map: glow,
      color: '#d5f3f6',
      size: 0.55,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      vertexColors: true,
      opacity: 0.7,
    }),
  );
  group.add(spray);
  const lives = Array.from({ length: count }, () => 0);
  const vels: Vector3[] = Array.from({ length: count }, () => new Vector3());

  const puffs: Puff[] = [];
  for (let i = 0; i < 10; i += 1) {
    const sprite = new Sprite(
      new SpriteMaterial({
        map: glow,
        color: '#c9c3ba',
        transparent: true,
        depthWrite: false,
        opacity: 0,
      }),
    );
    sprite.visible = false;
    group.add(sprite);
    puffs.push({ sprite, life: 0, max: 1, velocity: new Vector3() });
  }
  const flash = new Sprite(
    new SpriteMaterial({
      map: glow,
      color: '#ffd2a0',
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      opacity: 0,
    }),
  );
  flash.visible = false;
  group.add(flash);
  let nextBoom = 4.5;
  let flashLife = 0;

  const bowLocal = new Vector3(11.2, 0.55, 0);
  const bow = new Vector3();
  const muzzle = new Vector3();

  return {
    group,
    update(time, dt, ship, muzzles, boom) {
      const flap = motion < 0.5 ? 2.2 : 8.5;
      for (const gull of gulls) {
        const a = time * gull.speed + gull.phase;
        const x = Math.cos(a) * gull.ax;
        const z = Math.sin(a * 0.92) * gull.az;
        const y = gull.height + Math.sin(time * 0.7 + gull.phase) * 1.1 + sampleOcean(x, z, time).y;
        const prevX = gull.group.position.x;
        const prevZ = gull.group.position.z;
        gull.group.position.set(x, y, z);
        gull.group.rotation.y = Math.atan2(x - prevX, z - prevZ);
        const wingBeat = Math.sin(time * flap + gull.phase) * (motion < 0.5 ? 0.2 : 0.5);
        gull.left.rotation.z = wingBeat;
        gull.right.rotation.z = -wingBeat;
      }

      bow.copy(bowLocal);
      ship.localToWorld(bow);
      const pos = spray.geometry.attributes.position;
      const col = spray.geometry.attributes.color;
      for (let i = 0; i < count; i += 1) {
        lives[i] -= dt;
        if (lives[i] <= 0) {
          lives[i] = 0.45 + Math.random() * 0.7;
          vels[i].set((Math.random() - 0.2) * 1.4, 1.2 + Math.random() * 1.6, (Math.random() - 0.5) * 1.6);
          pos.setXYZ(i, bow.x + (Math.random() - 0.5) * 0.4, bow.y, bow.z + (Math.random() - 0.5) * 0.8);
        } else {
          vels[i].y -= dt * 2.2;
          pos.setXYZ(
            i,
            pos.getX(i) + vels[i].x * dt,
            pos.getY(i) + vels[i].y * dt,
            pos.getZ(i) + vels[i].z * dt,
          );
        }
        const a = Math.max(0, lives[i]);
        col.setXYZ(i, a, a, a);
      }
      pos.needsUpdate = true;
      col.needsUpdate = true;

      if (motion > 0.5 && time > nextBoom && muzzles.length) {
        const pick = muzzles[Math.floor(Math.random() * muzzles.length)];
        muzzle.copy(pick);
        ship.localToWorld(muzzle);
        flash.position.copy(muzzle);
        flash.visible = true;
        flash.scale.set(2.2, 2.2, 1);
        flashLife = 0.18;
        const puff = puffs.find((item) => item.life <= 0);
        if (puff) {
          puff.life = 1.4;
          puff.max = 1.4;
          puff.sprite.visible = true;
          puff.sprite.position.copy(muzzle);
          puff.sprite.material.opacity = 0.45;
          puff.velocity.set((Math.random() - 0.5) * 0.4, 0.8, (Math.random() - 0.5) * 0.4);
        }
        boom();
        nextBoom = time + 5.5 + Math.random() * 3.5;
      }
      flashLife -= dt;
      flash.material.opacity = Math.max(0, flashLife / 0.18);
      if (flashLife <= 0) flash.visible = false;
      for (const puff of puffs) {
        if (puff.life <= 0) continue;
        puff.life -= dt;
        puff.sprite.position.addScaledVector(puff.velocity, dt);
        const k = Math.max(0, puff.life / puff.max);
        puff.sprite.material.opacity = k * 0.4;
        const size = 1.2 + (1 - k) * 4.5;
        puff.sprite.scale.set(size, size, 1);
        if (puff.life <= 0) puff.sprite.visible = false;
      }
    },
  };
}
