// WebAudio blips. Lazily creates the AudioContext; every failure is swallowed.
let ctx = null;

function getCtx() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended' && ctx.resume) ctx.resume().catch(() => {});
    return ctx;
  } catch (e) {
    return null;
  }
}

function blip(freq, startOffset, dur, type = 'square', vol = 0.06, slideTo = null) {
  try {
    const c = getCtx();
    if (!c) return;
    const t0 = c.currentTime + startOffset;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  } catch (e) { /* ignore */ }
}

export function playSpawn() { blip(660, 0, 0.07, 'square', 0.04, 990); }
export function playClose() { blip(440, 0, 0.08, 'triangle', 0.07, 220); }
export function playError() { blip(180, 0, 0.12, 'sawtooth', 0.07); blip(140, 0.12, 0.18, 'sawtooth', 0.07); }
export function playWin() {
  [523, 659, 784, 1047].forEach((f, i) => blip(f, i * 0.1, 0.16, 'triangle', 0.08));
}
export function playLose() {
  [392, 330, 262, 196].forEach((f, i) => blip(f, i * 0.16, 0.22, 'sawtooth', 0.07));
}
