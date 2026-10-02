import './style.css';
import {
  ACESFilmicToneMapping,
  Color,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  PerspectiveCamera,
  PMREMGenerator,
  PointLight,
  Scene,
  SRGBColorSpace,
  Timer,
  Vector2,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { createSeaAudio } from './audio';
import { createDirector } from './director';
import { createLife } from './life';
import { palette, SUN_DIR } from './palette';
import { createShip } from './ship';
import { createSky } from './sky';
import {
  makeCloudTexture,
  makeGlowTexture,
  makeNameTexture,
  makeRogerTexture,
  makeSailTexture,
  makeWoodTexture,
} from './textures';
import { createWater } from './water';
import { windAmp, windTime } from './wind';
import { createDebris, createIsland } from './world';
import { sampleOcean } from './waves';

const canvas = document.querySelector<HTMLCanvasElement>('#view');
const fallback = document.querySelector<HTMLElement>('#fallback');
const muteBtn = document.querySelector<HTMLButtonElement>('#mute');
const modeBtn = document.querySelector<HTMLButtonElement>('#mode');

if (!canvas || !muteBtn || !modeBtn) {
  throw new Error('Missing page structure.');
}

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const narrow = Math.min(window.innerWidth, window.innerHeight) < 760;
const quality = narrow ? 'low' : 'high';
const motion = reduceMotion ? 0.15 : 1;
windAmp.value = reduceMotion ? 0.22 : 1;

let renderer: WebGLRenderer;
try {
  renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
} catch {
  fallback?.removeAttribute('hidden');
  throw new Error('WebGL unavailable');
}

renderer.outputColorSpace = SRGBColorSpace;
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === 'high' ? 1.6 : 1.15));
renderer.shadowMap.enabled = true;

const scene = new Scene();
scene.background = new Color(palette.horizon);
scene.fog = new Fog(palette.horizon, 90, 250);

const camera = new PerspectiveCamera(36, 1, 0.25, 900);
const wood = makeWoodTexture();
const sail = makeSailTexture();
const roger = makeRogerTexture();
const name = makeNameTexture();
const glow = makeGlowTexture();
const clouds = makeCloudTexture();
for (const tex of [wood, sail, roger, name, glow, clouds]) {
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
}

const sky = createSky(clouds, glow);
const water = createWater(quality);
const ship = createShip({ wood, sail, roger, name, glow });
const island = createIsland();
const debris = createDebris();
const life = createLife(glow, motion);

const distant = ship.group.clone(true) as Group;
distant.position.set(72, 0, -38);
distant.scale.setScalar(0.68);
distant.rotation.order = 'YXZ';
distant.rotation.y = -0.9;
const strayLights: PointLight[] = [];
distant.traverse((obj) => {
  if (obj instanceof PointLight) strayLights.push(obj);
});
for (const light of strayLights) light.removeFromParent();
distant.traverse((obj) => {
  if (obj instanceof Mesh) {
    obj.castShadow = false;
    obj.receiveShadow = false;
  }
});

scene.add(sky.group, water.mesh, ship.group, distant, island, debris.group, life.group);

const sun = new DirectionalLight(palette.sun, 4.8);
sun.position.set(SUN_DIR.x, SUN_DIR.y, SUN_DIR.z).multiplyScalar(90);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 12;
sun.shadow.camera.far = 160;
sun.shadow.camera.left = -32;
sun.shadow.camera.right = 32;
sun.shadow.camera.top = 32;
sun.shadow.camera.bottom = -32;
sun.shadow.bias = -0.00035;
sun.shadow.normalBias = 0.045;
const fill = new DirectionalLight('#d5e2ea', 0.95);
fill.position.set(22, 14, 30);
const bounce = new DirectionalLight('#e39a6c', 0.5);
bounce.position.set(12, 4, 18);
const hemi = new HemisphereLight('#ffd7b0', '#0b333c', 0.62);
scene.add(sun, sun.target, fill, bounce, hemi);

const pmrem = new PMREMGenerator(renderer);
const envScene = new Scene();
envScene.add(sky.dome.clone());
scene.environment = pmrem.fromScene(envScene, 0.05).texture;
pmrem.dispose();

const composer = new EffectComposer(
  renderer,
  new WebGLRenderTarget(1, 1, { samples: quality === 'high' ? 4 : 0 }),
);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new Vector2(window.innerWidth, window.innerHeight), 0.28, 0.4, 0.86);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const director = createDirector(camera, motion);
const params = new URLSearchParams(location.search);
if (params.get('orbit') === '1') {
  director.setOrbit(
    Number(params.get('theta') ?? '0.85'),
    Number(params.get('phi') ?? '1.05'),
    Number(params.get('radius') ?? '34'),
  );
}

const syncMode = () => {
  const orbiting = director.mode === 'orbit';
  modeBtn.textContent = orbiting ? 'Cinematic' : 'Orbit';
  modeBtn.setAttribute('aria-pressed', orbiting ? 'true' : 'false');
};
syncMode();
director.onPointer(canvas, syncMode);
modeBtn.addEventListener('click', () => {
  director.setMode(director.mode === 'cinematic' ? 'orbit' : 'cinematic');
  syncMode();
});

const audio = createSeaAudio();
muteBtn.addEventListener('click', async () => {
  const muted = await audio.toggle();
  muteBtn.textContent = muted ? 'Sound off' : 'Sound on';
  muteBtn.setAttribute('aria-pressed', muted ? 'true' : 'false');
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'm' || event.key === 'M') muteBtn.click();
  if (event.key === 'c' || event.key === 'C') modeBtn.click();
});

const resize = () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / Math.max(1, height);
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  composer.setSize(width, height);
  composer.setPixelRatio(renderer.getPixelRatio());
  bloom.resolution.set(width, height);
};
resize();
window.addEventListener('resize', resize);

const timer = new Timer();
let time = Number(params.get('t') ?? '0') || 0;
let shown = false;

const frame = () => {
  requestAnimationFrame(frame);
  if (document.hidden) return;
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.05);
  time += dt * (reduceMotion ? 0.35 : 1);
  windTime.value = time;
  ship.update(time);
  const farSea = sampleOcean(distant.position.x, distant.position.z, time);
  distant.position.y = farSea.y * 0.65;
  water.update(time, ship.group.position.x, ship.group.position.z);
  sky.update(time);
  debris.update(time);
  life.update(time, dt, ship.group, ship.muzzles, () => audio.boom());
  director.update(dt, ship.group.position.y);
  composer.render();
  if (!shown) {
    shown = true;
    canvas.classList.add('ready');
  }
};

frame();
