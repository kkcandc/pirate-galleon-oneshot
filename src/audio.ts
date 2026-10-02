export type SeaAudio = {
  muted: boolean;
  toggle: () => Promise<boolean>;
  boom: () => void;
};

export function createSeaAudio(): SeaAudio {
  let muted = true;
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;

  const build = () => {
    const audio = new AudioContext();
    const gain = audio.createGain();
    gain.gain.value = 0;
    gain.connect(audio.destination);

    const length = audio.sampleRate * 2;
    const buffer = audio.createBuffer(1, length, audio.sampleRate);
    const data = buffer.getChannelData(0);
    let brown = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      brown = (brown + 0.02 * white) / 1.02;
      data[i] = brown * 3.2;
    }
    const surf = audio.createBufferSource();
    surf.buffer = buffer;
    surf.loop = true;
    const low = audio.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 620;
    const surfGain = audio.createGain();
    surfGain.gain.value = 0.42;
    surf.connect(low).connect(surfGain).connect(gain);

    const windBuffer = audio.createBuffer(1, length, audio.sampleRate);
    const windData = windBuffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) windData[i] = Math.random() * 2 - 1;
    const wind = audio.createBufferSource();
    wind.buffer = windBuffer;
    wind.loop = true;
    const high = audio.createBiquadFilter();
    high.type = 'bandpass';
    high.frequency.value = 900;
    high.Q.value = 0.6;
    const windGain = audio.createGain();
    windGain.gain.value = 0.06;
    const lfo = audio.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = audio.createGain();
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain).connect(high.frequency);
    wind.connect(high).connect(windGain).connect(gain);

    const hull = audio.createOscillator();
    hull.type = 'sine';
    hull.frequency.value = 74;
    const hullGain = audio.createGain();
    hullGain.gain.value = 0.012;
    hull.connect(hullGain).connect(gain);

    surf.start();
    wind.start();
    lfo.start();
    hull.start();
    ctx = audio;
    master = gain;
  };

  return {
    get muted() {
      return muted;
    },
    async toggle() {
      if (!ctx || !master) build();
      if (!ctx || !master) return muted;
      if (ctx.state === 'suspended') await ctx.resume();
      muted = !muted;
      master.gain.setTargetAtTime(muted ? 0 : 0.85, ctx.currentTime, 0.06);
      return muted;
    },
    boom() {
      if (muted || !ctx || !master) return;
      const osc = ctx.createOscillator();
      const noiseLen = Math.floor(ctx.sampleRate * 0.25);
      const buffer = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < noiseLen; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / noiseLen);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 240;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.32);
      src.connect(filter).connect(gain).connect(master);
      osc.frequency.setValueAtTime(90, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.2);
      const oscGain = ctx.createGain();
      oscGain.gain.setValueAtTime(0.08, ctx.currentTime);
      oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      osc.connect(oscGain).connect(master);
      src.start();
      osc.start();
      src.stop(ctx.currentTime + 0.34);
      osc.stop(ctx.currentTime + 0.24);
    },
  };
}
