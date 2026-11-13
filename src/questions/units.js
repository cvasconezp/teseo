// units.js — magnitudes legibles por idioma para los recorridos nuevos
// (puro; probado en scripts/test_questions_tours.mjs).
import { num, sig, sci, big } from "./format.js";
import { AU, LY, EARTH_IN_SUNS } from "./constants.js";

const esDe = (s) => (/(millón|millones|billón|billones)$/.test(s) ? `${s} de` : s);

// Longitud en la unidad que mejor se lee: mm → cm → m → km → ua → años luz.
export function length(m, lang) {
  const es = lang === "es";
  if (!(m >= 0)) return "—";
  if (m < 0.01) return `${sig(m * 1000, lang, 3)} mm`;
  if (m < 1) return `${sig(m * 100, lang, 3)} cm`;
  if (m < 1000) return `${sig(m, lang, 3)} m`;
  const km = m / 1000;
  if (km < 1e6) return `${km < 100 ? sig(km, lang, 3) : num(Number(km.toPrecision(3)), lang)} km`;
  if (m < 0.1 * AU) return es ? `${sig(km / 1e6, lang, 3)} millones de km` : `${sig(km / 1e6, lang, 3)} million km`;
  if (m < 0.05 * LY) { const au = m / AU; return `${au < 100 ? sig(au, lang, 3) : num(Number(au.toPrecision(3)), lang)} ${es ? "ua" : "au"}`; }
  const ly = m / LY;
  return es ? `${esDe(ly < 100 ? sig(ly, lang, 3) : big(ly, lang))} años luz` : `${ly < 100 ? sig(ly, lang, 3) : big(ly, lang)} light-years`;
}

// Duración: de segundos a años, con dos unidades como máximo.
export function duration(s, lang) {
  const es = lang === "es";
  if (!Number.isFinite(s) || s < 0) return "—";
  if (s < 60) return `${sig(s, lang, 3)} s`;
  if (s < 3600) { const t = Math.round(s); const m = Math.floor(t / 60), r = t % 60; return r ? `${m} min ${r} s` : `${m} min`; }
  if (s < 86400) { const t = Math.round(s / 60); const h = Math.floor(t / 60), r = t % 60; return r ? `${h} h ${r} min` : `${h} h`; }
  const yr = 365.25 * 86400;
  if (s < yr) {
    const t = Math.round(s / 3600); const d = Math.floor(t / 24), r = t % 24;
    const dd = es ? (d === 1 ? "día" : "días") : (d === 1 ? "day" : "days");
    return r ? `${d} ${dd} ${r} h` : `${d} ${dd}`;
  }
  const y = s / yr;
  const b = y < 100 ? sig(y, lang, 2) : big(y, lang);
  return es ? `${esDe(b)} años` : `${b} years`;
}

// Masa: en masas de la Tierra por debajo de una milésima de Sol; si no, en masas solares.
export function mass(mSun, lang) {
  const es = lang === "es";
  if (mSun < 1e-3) {
    const e = mSun / EARTH_IN_SUNS;
    const one = Math.abs(e - 1) < 0.005;
    const v = sig(e, lang, 2);
    return es ? `${v} ${one ? "masa de la Tierra" : "masas de la Tierra"}` : `${v} Earth ${one ? "mass" : "masses"}`;
  }
  const one = Math.abs(mSun - 1) < 0.005;
  const v = mSun < 100 ? sig(mSun, lang, 2) : big(mSun, lang);
  return es ? `${esDe(v)} ${one ? "masa solar" : "masas solares"}` : `${v} solar ${one ? "mass" : "masses"}`;
}

// Número con potencia de diez cuando hace falta (densidades, aceleraciones).
export function quantity(x, lang) {
  if (!(x > 0)) return "0";
  if (x >= 1e6 || x < 0.01) return sci(x, lang, 2);
  return x >= 100 ? num(Number(x.toPrecision(2)), lang) : sig(x, lang, 2);
}

// "Veces" legible: 1.300 → "1.300"; 2,4 → "2,4"; 3×10⁹ → "3.000 millones de"
export function times(k, lang) {
  if (k < 100) return sig(k, lang, 2);
  const b = big(k, lang);
  return lang === "es" ? esDe(b) : b;
}
