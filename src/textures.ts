import { CanvasTexture, RepeatWrapping, SRGBColorSpace, Texture } from 'three';

function canvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const el = document.createElement('canvas');
  el.width = width;
  el.height = height;
  const ctx = el.getContext('2d');
  if (!ctx) throw new Error('Could not create a canvas for procedural textures.');
  return [el, ctx];
}

function finish(el: HTMLCanvasElement, repeat = false): CanvasTexture {
  const tex = new CanvasTexture(el);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  if (repeat) {
    tex.wrapS = RepeatWrapping;
    tex.wrapT = RepeatWrapping;
  }
  tex.needsUpdate = true;
  return tex;
}

export function makeWoodTexture(): Texture {
  const [el, g] = canvas(512, 512);
  g.fillStyle = '#d2ae86';
  g.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 32) {
    const shade = 168 + Math.floor(Math.random() * 36);
    g.fillStyle = `rgb(${shade}, ${shade - 30}, ${shade - 58})`;
    g.fillRect(0, y, 512, 30);
    g.fillStyle = 'rgba(48, 26, 14, 0.38)';
    g.fillRect(0, y + 29, 512, 3);
    g.strokeStyle = 'rgba(90, 48, 24, 0.16)';
    g.beginPath();
    g.moveTo(0, y + 10);
    for (let x = 0; x <= 512; x += 12) {
      g.lineTo(x, y + 10 + Math.sin(x * 0.04 + y * 0.2) * 2.4);
    }
    g.stroke();
  }
  for (let i = 0; i < 48; i += 1) {
    const x = Math.random() * 512;
    const y = Math.floor(Math.random() * 16) * 32;
    g.fillStyle = 'rgba(42, 22, 12, 0.32)';
    g.fillRect(x, y, 2, 30);
  }
  return finish(el, true);
}

export function makeSailTexture(): Texture {
  const [el, g] = canvas(512, 512);
  g.fillStyle = '#f6efe2';
  g.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 4) {
    const n = 228 + Math.floor(Math.random() * 18);
    g.fillStyle = `rgba(${n}, ${n - 12}, ${n - 28}, 0.18)`;
    g.fillRect(0, y, 512, 1);
  }
  for (let x = 0; x <= 512; x += 64) {
    g.fillStyle = 'rgba(92, 62, 32, 0.16)';
    g.fillRect(x, 0, 3, 512);
  }
  for (let y = 40; y < 512; y += 56) {
    g.fillStyle = 'rgba(70, 48, 28, 0.2)';
    g.fillRect(0, y, 512, 3);
  }
  const vignette = g.createRadialGradient(256, 240, 40, 256, 256, 380);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(92, 58, 28, 0.28)');
  g.fillStyle = vignette;
  g.fillRect(0, 0, 512, 512);
  return finish(el);
}

export function makeRogerTexture(): Texture {
  const [el, g] = canvas(512, 360);
  g.fillStyle = '#120d0b';
  g.fillRect(0, 0, 512, 360);
  g.fillStyle = '#f4ecdf';
  g.beginPath();
  g.arc(256, 124, 64, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.ellipse(256, 178, 40, 30, 0, 0, Math.PI);
  g.fill();
  g.fillStyle = '#120d0b';
  g.beginPath();
  g.ellipse(230, 114, 13, 16, -0.2, 0, Math.PI * 2);
  g.ellipse(282, 114, 13, 16, 0.2, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(256, 128);
  g.lineTo(244, 156);
  g.lineTo(268, 156);
  g.fill();
  g.fillStyle = '#f4ecdf';
  g.fillRect(228, 168, 56, 16);
  g.fillStyle = '#120d0b';
  for (let i = 0; i < 5; i += 1) g.fillRect(232 + i * 11, 168, 4, 16);
  const bone = (angle: number) => {
    g.save();
    g.translate(256, 270);
    g.rotate(angle);
    g.fillStyle = '#f4ecdf';
    g.fillRect(-96, -8, 192, 16);
    g.beginPath();
    g.arc(-96, 0, 16, 0, Math.PI * 2);
    g.arc(96, 0, 16, 0, Math.PI * 2);
    g.fill();
    g.restore();
  };
  bone(0.62);
  bone(-0.62);
  return finish(el);
}

export function makeNameTexture(): Texture {
  const [el, g] = canvas(1024, 256);
  g.fillStyle = '#2a160f';
  g.fillRect(0, 0, 1024, 256);
  g.strokeStyle = '#e8c78a';
  g.lineWidth = 12;
  g.strokeRect(18, 18, 988, 220);
  g.strokeStyle = '#a56b38';
  g.lineWidth = 3;
  g.strokeRect(32, 32, 960, 192);
  g.fillStyle = '#f2d7a2';
  g.font = '600 148px Georgia, "Times New Roman", serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('KLINE', 512, 132);
  return finish(el);
}

export function makeGlowTexture(): Texture {
  const [el, g] = canvas(128, 128);
  const glow = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  glow.addColorStop(0, 'rgba(255,255,255,1)');
  glow.addColorStop(0.18, 'rgba(255,214,150,0.95)');
  glow.addColorStop(0.45, 'rgba(255,150,60,0.35)');
  glow.addColorStop(1, 'rgba(255,120,40,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, 128, 128);
  return finish(el);
}

export function makeCloudTexture(): Texture {
  const [el, g] = canvas(512, 256);
  g.clearRect(0, 0, 512, 256);
  for (let i = 0; i < 18; i += 1) {
    const x = 40 + Math.random() * 430;
    const y = 40 + Math.random() * 160;
    const r = 30 + Math.random() * 70;
    const puff = g.createRadialGradient(x, y, 0, x, y, r);
    puff.addColorStop(0, 'rgba(255,255,255,0.55)');
    puff.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = puff;
    g.beginPath();
    g.ellipse(x, y, r * 1.4, r * 0.7, 0, 0, Math.PI * 2);
    g.fill();
  }
  return finish(el);
}
