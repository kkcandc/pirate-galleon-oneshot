# Copper Wake

A one-shot pirate galleon: a hull lofted in TypeScript, sails and flags cut from geometry, and a Gerstner sea written as a shader. Nothing is loaded from a 3D asset pack. Textures are painted into canvases when the page starts. Sound is optional and off until you turn it on.

Inspired by [Kunal Jain’s pure-code Three.js galleon](https://x.com/Kunal_Jain9/status/2100448992299794915). This scene is original.

Built for Kenny Kline. The GitHub repo is [kkcandc/pirate-galleon-oneshot](https://github.com/kkcandc/pirate-galleon-oneshot). The Vercel project belongs to Kenny Kline’s personal account only.

The stern nameplate reads **KLINE**.

## Run it

```bash
npm install
npm run dev
```

Open the local URL Vite prints. `npm run build` typechecks and writes `dist/`. `npm run preview` serves that build.

## What you can do

- Drag to orbit. Scroll (or pinch-wheel) to move closer.
- **Orbit** / **Cinematic** switches between a free camera and a looping set of shots.
- **Sound off** / **Sound on** toggles a procedural surf, wind, and hull tone. It starts muted. There is no audio file and nothing plays until you opt in.
- Keyboard: `C` toggles the camera, `M` toggles sound.

Reduced motion slows the camera, the sea, and the sail flutter, and skips the cannon flashes.

## How it is built

- **Hull** — stations along the length, a tumblehome section at each one, lofted into a mesh with a flat transom.
- **Sails and flags** — subdivided cloth. A vertex shader flaps the foot of each sail and the fly of each flag.
- **Sea** — four Gerstner waves, copper sun glitter, crest foam, and a wake locked to the hull. The same wave numbers drive the ship’s heave.
- **Sky** — a sunset dome, a low sun, a dusk moon, and drifting cloud cards.
- **Life** — gulls, bow spray, lantern flicker, and an occasional muzzle flash.

Vite bundles Three.js. The page does not call a paid API.

## Deploy

Vercel detects Vite from `vercel.json` (`npm run build` → `dist`). The project should stay on Kenny Kline’s personal team, connected to `kkcandc/pirate-galleon-oneshot` only.
