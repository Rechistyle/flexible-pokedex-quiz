// Efectos de sonido sintetizados con Web Audio (sin archivos externos).
let ctx = null;
export const sound = { enabled: true };

function tone(freq, start, dur, { type = 'square', gain = 0.06, slide = null } = {}) {
  ctx ??= new AudioContext();
  const t = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(slide, t + dur);
  amp.gain.setValueAtTime(gain, t);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(amp).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur);
}

const SOUNDS = {
  // acierto: "clic" corto
  correct: () => { tone(1046, 0, 0.05); tone(1568, 0.04, 0.07); },
  // nombre fuera de orden en Dex Order
  wrong: () => { tone(220, 0, 0.12, { type: 'sawtooth', gain: 0.05 }); tone(165, 0.1, 0.18, { type: 'sawtooth', gain: 0.05 }); },
  // quiz completado
  fanfare: () => {
    [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.13, 0.15));
    [523, 659, 784].forEach((f) => tone(f, 0.55, 0.6, { gain: 0.04 }));
  },
  // MissingNo.: ruido de fallo
  glitch: () => { for (let i = 0; i < 8; i++) tone(80 + Math.random() * 1500, i * 0.04, 0.05, { gain: 0.05 }); },
  // Duskull: quejido fantasmal
  spooky: () => { tone(330, 0, 1.2, { type: 'sine', gain: 0.08, slide: 110 }); tone(335, 0, 1.2, { type: 'sine', gain: 0.05, slide: 112 }); },
  // multijugador: alguien entra / sale
  join: () => { tone(660, 0, 0.08, { type: 'triangle', gain: 0.08 }); tone(990, 0.08, 0.12, { type: 'triangle', gain: 0.08 }); },
  leave: () => { tone(990, 0, 0.08, { type: 'triangle', gain: 0.08 }); tone(660, 0.08, 0.12, { type: 'triangle', gain: 0.08 }); },
};

export function play(name) {
  if (!sound.enabled) return;
  try { SOUNDS[name](); } catch { /* sin audio disponible */ }
}
