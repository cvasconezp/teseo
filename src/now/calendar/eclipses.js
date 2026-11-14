// eclipses.js — eclipses de Sol y de Luna, 2026–2028.
//
// FUENTE de la lista: NASA GSFC, Fred Espenak, «Solar Eclipses: 2021–2030» y «Lunar Eclipses:
// 2021–2030» (https://eclipse.gsfc.nasa.gov/SEdecade/SEdecade2021.html y
// https://eclipse.gsfc.nasa.gov/LEdecade/LEdecade2021.html), consultadas el 14-nov-2026.
// Esas tablas dan el máximo en TD (tiempo dinámico); aquí se pasa a UT restando el ΔT que NASA usa
// en la página de cada eclipse solar (p. ej. ΔT = 71,4 s para el 12-ago-2026; los lunares, el ΔT
// del eclipse solar más cercano). Contraste: timeanddate.com da 11:33 UTC para el eclipse lunar del
// 3-mar-2026 y 17:46 UTC para el solar del 12-ago-2026 (coincide al minuto).
//
// Visibilidad:
//  · Luna: se CALCULA (Luna sobre el horizonte en el máximo; efemérides de Teseo, altitud del limbo
//    como en src/sky/riseset.js). La Luna es visible desde donde es de noche; no hace falta más.
//  · Sol: sin elementos besselianos no se puede calcular la circunstancia local con rigor. Se cita la
//    región de la NASA y solo se marca «sí/no/parcial» cuando esa región nombra Ecuador o Sudamérica
//    (o, al revés, deja fuera a todo el continente); en los demás casos, «consulta el mapa».
import { stateAt, altAzOf, MIN } from "./astro.js";
import { H0_MOON } from "../../sky/riseset.js";

const SE = "https://eclipse.gsfc.nasa.gov/SEdecade/SEdecade2021.html";
const LE = "https://eclipse.gsfc.nasa.gov/LEdecade/LEdecade2021.html";
const SEMAP = (p) => `https://eclipse.gsfc.nasa.gov/SEgoogle/SEgoogle2001/SE${p}google.html`;

const td = (iso) => Date.parse(iso + "Z");

/** type: annular | total | partial. ecuador: "yes" | "no" | "partial" | "map" según lo que dice la NASA (ver arriba);
 *  continentOnly: la NASA solo dice «S. America», sin nombrar Ecuador. */
export const SOLAR_ECLIPSES = [
  { id: "se-2026-02-17", td: td("2026-02-17T12:13:05"), dT: 71.2, type: "annular", mag: 0.963, region: "s Argentina & Chile, s Africa, Antarctica", central: "Annular: Antarctica", ecuador: "no", map: SEMAP("2026Feb17A") },
  { id: "se-2026-08-12", td: td("2026-08-12T17:47:05"), dT: 71.4, type: "total", mag: 1.039, region: "n N. America, w Africa, Europe", central: "Total: Arctic, Greenland, Iceland, Spain", ecuador: "no", map: SEMAP("2026Aug12T") },
  { id: "se-2027-02-06", td: td("2027-02-06T16:00:47"), dT: 71.6, type: "annular", mag: 0.928, region: "S. America, Antarctica, w & s Africa", central: "Annular: Chile, Argentina, Atlantic", ecuador: "partial", continentOnly: true, map: SEMAP("2027Feb06A") },
  { id: "se-2027-08-02", td: td("2027-08-02T10:07:49"), dT: 71.7, type: "total", mag: 1.079, region: "Africa, Europe, Mid East, w & s Asia", central: "Total: Morocco, Spain, Algeria, Libya, Egypt, Saudi Arabia, Yemen, Somalia", ecuador: "no", map: SEMAP("2027Aug02T") },
  { id: "se-2028-01-26", td: td("2028-01-26T15:08:58"), dT: 71.9, type: "annular", mag: 0.921, region: "e N. America, C. & S. America, w Europe, nw Africa", central: "Annular: Ecuador, Peru, Brazil, Suriname, Spain, Portugal", ecuador: "yes", map: SEMAP("2028Jan26A") },
  { id: "se-2028-07-22", td: td("2028-07-22T02:56:39"), dT: 72.1, type: "total", mag: 1.056, region: "SE Asia, E. Indies, Australia, N.Z.", central: "Total: Australia, N. Z.", ecuador: "no", map: SEMAP("2028Jul22T") },
].map(e => ({ ...e, source: SE, t: e.td - e.dT * 1000 }));

/** umbDur / totDur: minutos de la fase parcial y de la total (NASA); null en los penumbrales. */
export const LUNAR_ECLIPSES = [
  { id: "le-2026-03-03", td: td("2026-03-03T11:34:52"), dT: 71.2, type: "total", mag: 1.151, umbMin: 207, totMin: 58, region: "e Asia, Australia, Pacific, Americas" },
  { id: "le-2026-08-28", td: td("2026-08-28T04:14:04"), dT: 71.4, type: "partial", mag: 0.930, umbMin: 198, totMin: 0, region: "e Pacific, Americas, Europe, Africa" },
  { id: "le-2027-02-20", td: td("2027-02-20T23:14:06"), dT: 71.6, type: "penumbral", mag: -0.057, umbMin: 0, totMin: 0, region: "Americas, Europe, Africa, Asia" },
  { id: "le-2027-07-18", td: td("2027-07-18T16:04:09"), dT: 71.7, type: "penumbral", mag: -1.068, umbMin: 0, totMin: 0, region: "e Africa, Asia, Australia, Pacific" },
  { id: "le-2027-08-17", td: td("2027-08-17T07:14:59"), dT: 71.7, type: "penumbral", mag: -0.525, umbMin: 0, totMin: 0, region: "Pacific, Americas" },
  { id: "le-2028-01-12", td: td("2028-01-12T04:14:13"), dT: 71.9, type: "partial", mag: 0.066, umbMin: 56, totMin: 0, region: "Americas, Europe, Africa" },
  { id: "le-2028-07-06", td: td("2028-07-06T18:20:57"), dT: 72.1, type: "partial", mag: 0.389, umbMin: 141, totMin: 0, region: "Europe, Africa, Asia, Australia" },
  { id: "le-2028-12-31", td: td("2028-12-31T16:53:15"), dT: 72.3, type: "total", mag: 1.246, umbMin: 209, totMin: 71, region: "Europe, Africa, Asia, Australia, Pacific" },
].map(e => ({ ...e, source: LE, t: e.td - e.dT * 1000 }));

/**
 * Visibilidad de un eclipse lunar desde un lugar.
 *  state: "yes" (Luna sobre el horizonte en el máximo), "partial" (bajo el horizonte en el máximo pero
 *  sobre él al empezar o al terminar la fase parcial/penumbral conocida) o "no".
 *  Devuelve también las alturas (°) de la Luna en el máximo y en los extremos de la fase parcial.
 */
export function lunarEclipseVisibility(ecl, lat, lon) {
  const alt = (ms) => altAzOf(stateAt(ms).Luna.v, lat, lon, ms).alt;
  const altMax = alt(ecl.t);
  const half = (ecl.umbMin || 0) * MIN / 2;
  const altStart = half ? alt(ecl.t - half) : null, altEnd = half ? alt(ecl.t + half) : null;
  let state = "no";
  if (altMax > H0_MOON) state = "yes";
  else if ((altStart != null && altStart > H0_MOON) || (altEnd != null && altEnd > H0_MOON)) state = "partial";
  return { state, altMax, altStart, altEnd };
}

/** Eclipses (de ambos tipos) entre from y to, ordenados. Para el lunar se calcula la visibilidad. */
export function findEclipses(from, to, lat, lon) {
  const out = [];
  for (const e of SOLAR_ECLIPSES) if (e.t >= from && e.t <= to) out.push({ ...e, body: "sun" });
  for (const e of LUNAR_ECLIPSES) if (e.t >= from && e.t <= to) out.push({ ...e, body: "moon", vis: lunarEclipseVisibility(e, lat, lon) });
  return out.sort((a, b) => a.t - b.t);
}

