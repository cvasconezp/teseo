// ambient.js — música ambiental generada en el propio navegador (Web Audio API).
//
// Por qué generada y no una pista grabada: no hay licencias que cuidar, no pesa nada
// (ni un archivo de audio que descargar) y nunca se repite igual. Es un paisaje sonoro
// tranquilo: un bordón grave que respira (tres osciladores levemente desafinados con un
// filtro que se abre y se cierra muy despacio) y, de vez en cuando, una campana suave de
// la escala pentatónica de la menor, con una reverberación larga como de espacio abierto.
//
// Empieza siempre apagada y solo suena después de un toque de la persona (los navegadores
// lo exigen). Se silencia sola al cambiar de pestaña o bloquear el teléfono.

/** Notas de las campanas: la menor pentatónica (A4–A5), en Hz. */
export const BELL_NOTES = [440, 523.25, 587.33, 659.25, 783.99, 880];
/** Bordón: la (A2), mi (E3) y la (A3). */
export const DRONE_NOTES = [110, 164.81, 220];
export const MASTER_GAIN = 0.16;      // volumen final (bajo a propósito: es fondo)
export const STORAGE_KEY = "teseo-ambient";

/** Siguiente campana: nota y espera (s), con un generador aleatorio inyectable para las pruebas. */
export function nextBell(rnd = Math.random) {
  return { freq: BELL_NOTES[Math.floor(rnd() * BELL_NOTES.length)], wait: 3 + rnd() * 5, gain: 0.05 + rnd() * 0.05 };
}

/** Respuesta al impulso de la reverberación: ruido estéreo que decae (dur s). */
function impulse(ctx, dur = 4.5, decay = 2.6) {
  const n = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
  }
  return buf;
}

export function createAmbient() {
  let ctx = null, master = null, timer = null, on = false;
  const nodes = [];

  function build() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    const reverb = ctx.createConvolver(); reverb.buffer = impulse(ctx);
    const wet = ctx.createGain(); wet.gain.value = 0.55; reverb.connect(wet); wet.connect(master);

    // bordón: filtro paso bajo que «respira» con un LFO muy lento
    const filter = ctx.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = 520; filter.Q.value = 0.7;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.045;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 260;
    lfo.connect(lfoGain); lfoGain.connect(filter.frequency); lfo.start();
    const droneGain = ctx.createGain(); droneGain.gain.value = 0.5;
    filter.connect(droneGain); droneGain.connect(master); droneGain.connect(reverb);
    DRONE_NOTES.forEach((f, i) => {
      for (const det of [-5, 5]) {
        const o = ctx.createOscillator(); o.type = i === 0 ? "sine" : "triangle";
        o.frequency.value = f; o.detune.value = det;
        const g = ctx.createGain(); g.gain.value = i === 0 ? 0.22 : 0.08;
        o.connect(g); g.connect(filter); o.start();
        nodes.push(o);
      }
    });
    nodes.push(lfo);
    master._reverb = reverb;
    return true;
  }

  function bell() {
    if (!on || !ctx) return;
    const { freq, wait, gain } = nextBell();
    const t = ctx.currentTime;
    const env = ctx.createGain(); env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(gain, t + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 4.5);
    for (const [mult, type, g] of [[1, "sine", 1], [2.01, "sine", 0.25], [3, "triangle", 0.08]]) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq * mult;
      const og = ctx.createGain(); og.gain.value = g;
      o.connect(og); og.connect(env); o.start(t); o.stop(t + 4.6);
    }
    env.connect(master); env.connect(master._reverb);
    timer = setTimeout(bell, wait * 1000);
  }

  async function start() {
    if (!ctx && !build()) return false;
    try { await ctx.resume(); } catch { return false; }
    on = true;
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(MASTER_GAIN, t + 3);        // entra despacio
    clearTimeout(timer); timer = setTimeout(bell, 1800);
    return true;
  }

  function stop() {
    on = false; clearTimeout(timer);
    if (!ctx) return;
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(0, t + 0.8);                // sale despacio
    setTimeout(() => { if (!on && ctx) ctx.suspend().catch(() => {}); }, 900);
  }

  // al ocultar la pestaña (o bloquear el teléfono) se pausa; al volver, sigue si estaba encendida
  const onVis = () => {
    if (!ctx) return;
    if (document.hidden) { clearTimeout(timer); ctx.suspend().catch(() => {}); }
    else if (on) { ctx.resume().catch(() => {}); clearTimeout(timer); timer = setTimeout(bell, 1500); }
  };
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVis);

  return { start, stop, isOn: () => on, supported: () => typeof window !== "undefined" && !!(window.AudioContext || window.webkitAudioContext) };
}
