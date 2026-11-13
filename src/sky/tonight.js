// tonight.js — "Esta noche en tu cielo": qué hay sobre el horizonte, calculado de
// forma determinista con lo que Teseo ya tiene (efemérides de Schlyter, catálogo
// de lluvias, Messier y centroides de constelaciones). Sin DOM: solo datos; el
// texto lo pone la interfaz. Lo que no se puede calcular, no se devuelve.
import { altAz, nextRise } from "./guide.js";

const NAKED = ["Venus", "Júpiter", "Marte", "Saturno", "Mercurio"];   // orden habitual de brillo
const SCOPE = ["Urano", "Neptuno"];                                    // necesitan binoculares o telescopio
// constelaciones fáciles de reconocer, de más a menos populares
const FAMOUS = ["Ori", "Sco", "Cru", "UMa", "CMa", "Leo", "Tau", "Cyg", "Cas", "Sgr", "Gem", "Cen", "Peg", "And", "Lyr", "Aql",
  "Car", "Per", "Aur", "Vir", "PsA", "Aqr", "Psc", "Cet", "Gru", "Boo", "Her", "Cap", "Ari", "Eri"];
export const NIGHT_SUN_ALT = -6;      // crepúsculo civil: por debajo ya se ven los astros brillantes
const DARK_SUN_ALT = -12;             // crepúsculo náutico: referencia para "cuando oscurezca"

/** ¿Lluvia activa en la fecha (MM-DD dentro de [start, end], con cruce de año)? */
export function showerActive(o, date) {
  const md = String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
  return o.start <= o.end ? (md >= o.start && md <= o.end) : (md >= o.start || md <= o.end);
}
/** Días que faltan para el máximo (negativo = ya pasó), eligiendo el máximo más cercano. */
export function daysToPeak(o, date) {
  const [m, d] = o.peak.split("-").map(Number);
  const base = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  let best = null;
  for (const y of [date.getFullYear() - 1, date.getFullYear(), date.getFullYear() + 1]) {
    const diff = Math.round((new Date(y, m - 1, d) - base) / 86400000);
    if (best === null || Math.abs(diff) < Math.abs(best)) best = diff;
  }
  return best;
}
/** Fase de la Luna en 8 nombres a partir de la fracción iluminada y si crece. */
export function moonPhaseKey(illum, waxing) {
  if (illum < 0.03) return "new";
  if (illum > 0.97) return "full";
  if (illum < 0.4) return waxing ? "waxCrescent" : "wanCrescent";
  if (illum <= 0.6) return waxing ? "firstQuarter" : "lastQuarter";
  return waxing ? "waxGibbous" : "wanGibbous";
}

/**
 * @param {object} p
 *   date, lat, lon            instante y lugar
 *   ephemeris(date)           efemérides de Teseo (src/ephemeris.js)
 *   showers, messier          arrays de objetos de public/*.json (pueden faltar)
 *   constellations            [{ ab, name, dir: [nx, ny, nz] }] (puede faltar)
 */
export function computeTonight({ date, lat, lon, ephemeris, showers, messier, constellations }) {
  const sunAltAt = (d) => { const s = ephemeris(d).find((b) => b.name === "Sol"); return altAz(s.nx, s.ny, s.nz, lat, lon, d).alt; };
  const sunAlt = sunAltAt(date);
  // de día: se calcula para cuando oscurezca (primer paso de 10 min con el Sol bajo −12°)
  let evalDate = date, shifted = false;
  if (sunAlt > NIGHT_SUN_ALT) {
    for (let k = 1; k <= 144; k++) {
      const d = new Date(date.getTime() + k * 600000);
      if (sunAltAt(d) < DARK_SUN_ALT) { evalDate = d; shifted = true; break; }
    }
    if (!shifted) return { evalDate: date, shifted: false, sunAlt, noNight: true, items: [] };   // p. ej. verano polar
  }
  const bodies = ephemeris(evalDate);
  const pos = (o) => altAz(o.nx, o.ny, o.nz, lat, lon, evalDate);
  // una salida solo cuenta si ocurre todavía de noche
  const riseOf = (dirAt) => {
    const r = nextRise(dirAt, lat, lon, evalDate, 12, 10, 0);
    return r && sunAltAt(r.date) < NIGHT_SUN_ALT ? r : null;
  };
  const bodyDirAt = (name) => (d) => { const b = ephemeris(d).find((x) => x.name === name); return [b.nx, b.ny, b.nz]; };
  const items = [];

  // Luna
  const moon = bodies.find((b) => b.name === "Luna");
  if (moon) {
    const p = pos(moon), up = p.alt > 0;
    const rise = up ? null : riseOf(bodyDirAt("Luna"));
    // si ni está arriba ni sale durante la noche, también se dice: cielo sin Luna
    items.push({ id: "moon", kind: "moon", key: "Luna", alt: p.alt, az: p.az, up, rise, illum: moon.illum, waxing: moon.waxing, phase: moonPhaseKey(moon.illum, moon.waxing) });
  }
  // planetas: primero los que se ven a simple vista
  const planets = [];
  for (const name of [...NAKED, ...SCOPE]) {
    const b = bodies.find((x) => x.name === name); if (!b) continue;
    const p = pos(b), scope = SCOPE.includes(name);
    if (p.alt > 5) planets.push({ id: "p-" + name, kind: "planet", key: name, alt: p.alt, az: p.az, up: true, rise: null, scope, low: p.alt < 15 });
    else if (!scope) { const rise = riseOf(bodyDirAt(name)); if (rise) planets.push({ id: "p-" + name, kind: "planet", key: name, alt: p.alt, az: p.az, up: false, rise, scope: false }); }
  }
  items.push(...planets.filter((x) => !x.scope));
  const scopePlanets = planets.filter((x) => x.scope && x.alt >= 15);

  // lluvias de meteoros activas
  const act = (showers || []).filter((o) => showerActive(o, evalDate)).map((o) => {
    const p = pos(o), up = p.alt > 0;
    return { id: "s-" + o.name, kind: "shower", key: o.name, obj: o, alt: p.alt, az: p.az, up, rise: up ? null : riseOf(() => [o.nx, o.ny, o.nz]), zhr: o.zhr, toPeak: daysToPeak(o, evalDate) };
  });
  act.sort((a, b) => Math.abs(a.toPeak) - Math.abs(b.toPeak) || b.zhr - a.zhr);
  items.push(...act.slice(0, 2));

  // constelaciones destacadas: las más conocidas que estén bien altas
  const cons = [];
  for (const ab of FAMOUS) {
    const c = (constellations || []).find((x) => x.ab === ab); if (!c) continue;
    const p = altAz(c.dir[0], c.dir[1], c.dir[2], lat, lon, evalDate);
    if (p.alt >= 30) cons.push({ id: "c-" + ab, kind: "con", key: ab, name: c.name, dir: c.dir, alt: p.alt, az: p.az, up: true, rise: null });
    if (cons.length === 3) break;
  }
  items.push(...cons);

  // cielo profundo: Messier brillantes y altos
  const deep = (messier || []).filter((o) => o.mag != null && o.mag <= 6.5).map((o) => ({ o, p: pos(o) }))
    .filter((x) => x.p.alt >= 25).sort((a, b) => a.o.mag - b.o.mag).slice(0, 2)
    .map(({ o, p }) => ({ id: "m-" + o.name, kind: "deep", key: o.name, obj: o, alt: p.alt, az: p.az, up: true, rise: null, naked: o.mag <= 4.5 }));
  items.push(...deep);
  items.push(...scopePlanets);      // los que piden telescopio, al final

  return { evalDate, shifted, sunAlt, noNight: false, items };
}
