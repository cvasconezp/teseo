// ambient.js — música ambiental generada en el propio navegador (Web Audio API).
//
// Por qué generada y no una pista grabada: no hay licencias que cuidar, no pesa nada
// (ni un archivo de audio que descargar) y nunca se corta ni se repite con un salto.
//
// Es la misma música de los videos de Teseo: un colchón de acordes que respira
// (la menor con novena, fa mayor con séptima, do mayor, sol mayor; un acorde cada
// 8 segundos, que entra y sale despacio y se funde con el siguiente), un bajo una
// octava por debajo y un arpegio suave en corcheas a 72 pulsos por minuto. Cada voz
// lleva dos osciladores levemente desafinados, abiertos a izquierda y derecha.
//
// Empieza siempre apagada y solo suena después de un toque de la persona (los navegadores
// lo exigen). Se silencia sola al cambiar de pestaña o bloquear el teléfono.

/** Acordes en notas MIDI: la m9, fa maj7, do, sol (la primera nota de cada uno es su raíz). */
export const PROGRESSION = [[57, 64, 69, 71, 72], [53, 60, 65, 69, 72], [48, 55, 64, 67, 72], [55, 62, 67, 71, 74]];
export const BAR_SECONDS = 8;          // un acorde cada 8 s
export const OVERLAP = 2.5;            // cada acorde se funde 2,5 s con el siguiente
export const BPM = 72;                 // pulso del arpegio (corcheas)
export const ARP_ORDER = [0, 2, 1, 3, 4, 3, 1, 2];
export const MASTER_GAIN = 0.16;       // volumen final (bajo a propósito: es fondo)
export const STORAGE_KEY = "teseo-ambient";

export const midiToHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

/** Notas del arpegio de un compás: [segundo dentro del compás, nota MIDI, volumen, paneo −1…1]. */
export function arpeggio(chord, bpm = BPM, bar = BAR_SECONDS) {
  const step = 60 / bpm / 2, out = [];
  for (let j = 0; j < Math.floor(bar / step); j++) {
    const pan = 0.35 + 0.3 * ((j % 4) / 3);
    out.push([j * step, chord[ARP_ORDER[j % 8]] + 12, j % 2 === 0 ? 0.8 : 0.5, 2 * pan - 1]);
  }
  return out;
}

/**
 * Arma el grafo de sonido sobre un contexto (en vivo u «offline» para las pruebas) y
 * devuelve `until(t)`, que programa los compases necesarios hasta el segundo t.
 */
export function buildMusic(ctx, out) {
  // salida: filtro de banda suave (60 Hz – 6,5 kHz) para que no retumbe ni chille
  const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 60;
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 6500;
  const bus = ctx.createGain(); bus.gain.value = 1;
  bus.connect(hp); hp.connect(lp); lp.connect(out);
  // timbre del colchón: fundamental + octava al 25 %
  const padWave = ctx.createPeriodicWave(new Float32Array([0, 0, 0]), new Float32Array([0, 1, 0.25]));
  // paneos compartidos (pocos valores distintos): no se crea un nodo nuevo por cada nota
  const panners = new Map();
  const pan = (v) => {
    if (!ctx.createStereoPanner) return bus;
    const k = v.toFixed(2);
    if (!panners.has(k)) { const p = ctx.createStereoPanner(); p.pan.value = v; p.connect(bus); panners.set(k, p); }
    return panners.get(k);
  };
  const PAD = 0.08, ARP = 0.056;                                      // mismo balance que en los videos
  let bar = 0, next = null;

  function scheduleBar(t0, chord) {
    const len = BAR_SECONDS + OVERLAP, end = t0 + len;
    // una envolvente por lado (izquierda, centro, derecha): entra en 2,2 s y sale en 3 s
    const envelope = (p) => {
      const env = ctx.createGain(); env.connect(pan(p));
      env.gain.setValueAtTime(0, t0);
      env.gain.linearRampToValueAtTime(PAD, t0 + 2.2);
      env.gain.setValueAtTime(PAD, end - 3);
      env.gain.linearRampToValueAtTime(0, end);
      return env;
    };
    const left = envelope(-0.4), right = envelope(0.4), center = envelope(0);
    const voices = [];
    chord.forEach((m) => {
      for (const [cents, env] of [[-1, left], [1.2, right]]) {          // dos voces desafinadas, abiertas
        const o = ctx.createOscillator(); o.setPeriodicWave(padWave);
        o.frequency.value = midiToHz(m); o.detune.value = cents;
        o.connect(env); voices.push(o);
      }
    });
    const bass = ctx.createOscillator(); bass.frequency.value = midiToHz(chord[0] - 12);
    const bg = ctx.createGain(); bg.gain.value = 1.6; bass.connect(bg); bg.connect(center); voices.push(bass);
    voices.forEach((o) => { o.start(t0); o.stop(end + 0.05); });
    for (const [dt, m, vol, p] of arpeggio(chord)) {
      const t = t0 + dt, o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = midiToHz(m);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(ARP * vol, t + 0.008);
      g.gain.setTargetAtTime(0, t + 0.008, 1 / 3.2);                  // se apaga como una campana
      o.connect(g); g.connect(pan(p));
      o.start(t); o.stop(t + 1.6);
    }
  }

  return {
    until(t) {
      if (next === null || next < ctx.currentTime - 0.5) next = ctx.currentTime + 0.05;
      while (next < t) { scheduleBar(next, PROGRESSION[bar % PROGRESSION.length]); bar++; next += BAR_SECONDS; }
    },
  };
}

export function createAmbient() {
  let ctx = null, master = null, music = null, timer = null, on = false;

  function build() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    music = buildMusic(ctx, master);
    return true;
  }

  // programa siempre unos segundos por delante; así no hay cortes aunque el teléfono vaya lento
  function tick() {
    if (!on || !ctx) return;
    music.until(ctx.currentTime + BAR_SECONDS + 1);
    timer = setTimeout(tick, 2000);
  }

  async function start() {
    if (!ctx && !build()) return false;
    try { await ctx.resume(); } catch { return false; }
    on = true;
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(MASTER_GAIN, t + 3);        // entra despacio
    clearTimeout(timer); tick();
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
    else if (on) { ctx.resume().catch(() => {}); clearTimeout(timer); tick(); }
  };
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVis);

  return { start, stop, isOn: () => on, supported: () => typeof window !== "undefined" && !!(window.AudioContext || window.webkitAudioContext) };
}
