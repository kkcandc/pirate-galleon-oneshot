import { MathUtils, PerspectiveCamera, Vector3 } from 'three';

type Pose = { pos: [number, number, number]; look: [number, number, number]; roll: number };

const POSES: Pose[] = [
  { pos: [24, 7.2, 20], look: [0, 3.2, 0], roll: 0.012 },
  { pos: [17, 6.1, 23], look: [1.2, 3.5, 0], roll: -0.012 },
  { pos: [7, 1.7, 13.5], look: [2, 2.2, 0], roll: 0.028 },
  { pos: [-7, 2.3, 13], look: [-1, 3.1, 0], roll: 0.01 },
  { pos: [21, 4.4, 7], look: [5, 3.2, 0], roll: -0.018 },
  { pos: [14, 6.2, 2.5], look: [1, 5.4, 0], roll: 0.016 },
  { pos: [5, 4.8, 14], look: [0, 4, 0], roll: 0 },
  { pos: [1.2, 15.2, 8.5], look: [-0.4, 11, 0], roll: 0.02 },
  { pos: [-21, 6.2, -11], look: [-2, 3.6, 0], roll: -0.018 },
  { pos: [-15, 4.1, 5], look: [-4, 3.3, 0], roll: 0.01 },
  { pos: [10, 18, -26], look: [0, 2.4, 0], roll: 0.02 },
  { pos: [28, 10.5, -16], look: [2, 3.2, 0], roll: -0.01 },
  { pos: [30, 8.4, 2], look: [0, 3, 0], roll: 0 },
  { pos: [26, 7.4, 16], look: [0, 3.2, 0], roll: 0.01 },
];

const DURATIONS = [10, 8, 9, 8, 8, 8, 9, 8, 9, 8, 10, 8, 8, 8];

function smoother(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

export type CameraMode = 'cinematic' | 'orbit';

export type Director = {
  mode: CameraMode;
  setMode: (mode: CameraMode) => void;
  setOrbit: (theta: number, phi: number, radius: number) => void;
  update: (dt: number, bob: number) => void;
  onPointer: (canvas: HTMLCanvasElement, onMode: (mode: CameraMode) => void) => void;
};

export function createDirector(camera: PerspectiveCamera, speed: number): Director {
  const rigPos = new Vector3();
  const look = new Vector3();
  const desiredPos = new Vector3();
  const desiredLook = new Vector3();
  let shot = 0;
  let along = 0;
  let roll = 0;
  let theta = 0.85;
  let phi = 1.05;
  let radius = 32;
  let mode: CameraMode = 'cinematic';
  let dragging = false;

  const poseTo = (pose: Pose, bob: number, outPos: Vector3, outLook: Vector3) => {
    outPos.set(pose.pos[0], pose.pos[1] + bob, pose.pos[2]);
    outLook.set(pose.look[0], pose.look[1] + bob, pose.look[2]);
  };

  const seedOrbit = () => {
    const offset = rigPos.clone().sub(look);
    radius = Math.max(10, offset.length());
    theta = Math.atan2(offset.x, offset.z);
    phi = Math.acos(MathUtils.clamp(offset.y / radius, -1, 1));
  };

  const director: Director = {
    mode,
    setMode(next) {
      if (next === 'orbit' && mode !== 'orbit') seedOrbit();
      mode = next;
      director.mode = next;
    },
    setOrbit(nextTheta, nextPhi, nextRadius) {
      theta = nextTheta;
      phi = nextPhi;
      radius = nextRadius;
      mode = 'orbit';
      director.mode = 'orbit';
    },
    update(dt, bob) {
      const scaled = dt * speed;
      if (mode === 'cinematic') {
        along += scaled / DURATIONS[shot];
        if (along >= 1) {
          along -= 1;
          shot = (shot + 1) % POSES.length;
        }
        const k = smoother(MathUtils.clamp(along, 0, 1));
        const a = POSES[shot];
        const b = POSES[(shot + 1) % POSES.length];
        poseTo(a, bob, desiredPos, desiredLook);
        const nextPos = new Vector3();
        const nextLook = new Vector3();
        poseTo(b, bob, nextPos, nextLook);
        desiredPos.lerp(nextPos, k);
        desiredLook.lerp(nextLook, k);
        roll = MathUtils.lerp(a.roll, b.roll, k);
      } else if (!dragging) {
        theta += scaled * 0.08;
        desiredPos.set(
          radius * Math.sin(phi) * Math.sin(theta),
          radius * Math.cos(phi) + bob,
          radius * Math.sin(phi) * Math.cos(theta),
        );
        desiredLook.set(0, 3.2 + bob, 0);
        roll = Math.sin(theta) * 0.01;
      } else {
        desiredPos.set(
          radius * Math.sin(phi) * Math.sin(theta),
          radius * Math.cos(phi) + bob,
          radius * Math.sin(phi) * Math.cos(theta),
        );
        desiredLook.set(0, 3.2 + bob, 0);
      }

      const damp = 1 - Math.exp(-dt * (mode === 'cinematic' ? 2.4 : 7));
      if (rigPos.lengthSq() === 0) {
        rigPos.copy(desiredPos);
        look.copy(desiredLook);
      } else {
        rigPos.lerp(desiredPos, damp);
        look.lerp(desiredLook, damp);
      }
      camera.position.copy(rigPos);
      camera.up.set(Math.sin(roll), Math.cos(roll), 0);
      camera.lookAt(look);
    },
    onPointer(canvas, onMode) {
      let lastX = 0;
      let lastY = 0;
      canvas.addEventListener('pointerdown', (event) => {
        dragging = true;
        lastX = event.clientX;
        lastY = event.clientY;
        canvas.setPointerCapture(event.pointerId);
      });
      canvas.addEventListener('pointermove', (event) => {
        if (!dragging) return;
        const dx = event.clientX - lastX;
        const dy = event.clientY - lastY;
        lastX = event.clientX;
        lastY = event.clientY;
        if (dx === 0 && dy === 0) return;
        if (mode !== 'orbit') {
          seedOrbit();
          mode = 'orbit';
          director.mode = 'orbit';
          onMode('orbit');
        }
        theta -= dx * 0.005;
        phi = MathUtils.clamp(phi - dy * 0.004, 0.28, 1.45);
        radius = MathUtils.clamp(radius, 12, 80);
      });
      const end = () => {
        dragging = false;
      };
      canvas.addEventListener('pointerup', end);
      canvas.addEventListener('pointercancel', end);
      canvas.addEventListener(
        'wheel',
        (event) => {
          event.preventDefault();
          if (mode !== 'orbit') {
            seedOrbit();
            mode = 'orbit';
            director.mode = 'orbit';
            onMode('orbit');
          }
          radius = MathUtils.clamp(radius * (1 + event.deltaY * 0.001), 12, 86);
        },
        { passive: false },
      );
    },
  };

  return director;
}
