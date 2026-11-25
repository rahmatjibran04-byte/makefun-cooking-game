// Kuali Emas — sound: every effect is synthesized with WebAudio, no files.
// The module never throws when audio is unavailable (headless screenshots).
export function createAudio() {
  let ctx = null;
  let muted = false;

  function ensure() {
    if (ctx || muted) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { muted = true; return null; }
      ctx = new AC();
    } catch { muted = true; return null; }
    return ctx;
  }

  function tone(freq, dur, type, vol, when = 0, slideTo = 0) {
    const ac = ensure();
    if (!ac) return;
    try {
      const t0 = ac.currentTime + when;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain).connect(ac.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    } catch { /* sound is garnish, never a crash */ }
  }

  function noise(dur, vol, when = 0) {
    const ac = ensure();
    if (!ac) return;
    try {
      const t0 = ac.currentTime + when;
      const len = Math.max(1, Math.floor(ac.sampleRate * dur));
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ac.createBufferSource();
      const gain = ac.createGain();
      const filter = ac.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 1800;
      gain.gain.value = vol;
      src.buffer = buf;
      src.connect(filter).connect(gain).connect(ac.destination);
      src.start(t0);
    } catch { /* ignore */ }
  }

  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); },
    toggleMute() { muted = !muted; return muted; },
    isMuted() { return muted; },
    pickup() { tone(520, 0.09, 'triangle', 0.12); },
    chop() { noise(0.07, 0.22); tone(180, 0.06, 'square', 0.08); },
    chopDone() { tone(660, 0.1, 'triangle', 0.14); tone(880, 0.12, 'triangle', 0.12, 0.08); },
    sizzle() { noise(0.35, 0.1); },
    cookDone() { tone(740, 0.12, 'sine', 0.15); tone(988, 0.16, 'sine', 0.13, 0.1); },
    burn() { tone(220, 0.3, 'sawtooth', 0.12, 0, 110); },
    plate() { tone(440, 0.08, 'triangle', 0.12); tone(660, 0.1, 'triangle', 0.1, 0.06); },
    ding() { tone(1046, 0.25, 'sine', 0.18); tone(1568, 0.35, 'sine', 0.12, 0.05); },
    coin() { tone(988, 0.08, 'square', 0.08); tone(1318, 0.14, 'square', 0.08, 0.07); },
    error() { tone(160, 0.16, 'square', 0.1); },
    tick() { tone(1200, 0.04, 'square', 0.06); },
    order() { tone(392, 0.1, 'triangle', 0.12); tone(523, 0.12, 'triangle', 0.12, 0.09); },
    gameOver() { [523, 440, 392, 330].forEach((f, i) => tone(f, 0.22, 'triangle', 0.14, i * 0.2)); },
  };
}
