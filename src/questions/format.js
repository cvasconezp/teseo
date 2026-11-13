// format.js — números legibles por idioma (puro; probado en scripts/test_questions.mjs)
import { roundSig } from "./drakeMath.js";

const locale = (lang) => (lang === "es" ? "es" : "en-US");
const SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
const sup = (n) => String(n).split("").map(c => SUP[c] ?? c).join("");

// 1234.5 → "1.234,5" (es) / "1,234.5" (en). Agrupa también los millares de 4 cifras.
export function num(x, lang, maxDigits = 0) {
  const opts = { maximumFractionDigits: maxDigits, useGrouping: "always" };
  try { return Number(x).toLocaleString(locale(lang), opts); }
  catch { return Number(x).toLocaleString(locale(lang), { maximumFractionDigits: maxDigits }); }
}
// 2 cifras significativas, sin ceros de relleno: 0.4 → "0,4"; 12 → "12"; 0.0031 → "0,0031"
export function sig(x, lang, digits = 2) {
  const r = roundSig(x, digits);
  const dec = r >= 100 ? 0 : Math.max(0, digits - 1 - Math.floor(Math.log10(Math.abs(r))));
  return num(r, lang, Math.min(dec, 12));
}
// Notación científica tipográfica: 1.9e13 → "1,9 × 10¹³"
export function sci(x, lang, digits = 2) {
  if (!(x > 0)) return "0";
  let e = Math.floor(Math.log10(x));
  let m = roundSig(x / Math.pow(10, e), digits);
  if (m >= 10) { m /= 10; e += 1; }
  const ms = num(m, lang, digits - 1);
  return m === 1 ? `10${sup(e)}` : `${ms} × 10${sup(e)}`;
}
// Cantidades grandes en palabras: 3.2e6 → "3,2 millones"; 2e9 → "2.000 millones" / "2 billion"
export function big(x, lang) {
  const es = lang === "es";
  const r = roundSig(x, 2);
  if (r < 1e6) return r < 100 ? sig(r, lang) : num(r, lang);
  if (r < 1e9 || (es && r < 1e12)) {
    const m = r / 1e6;
    return es ? `${sig(m, lang)} ${m === 1 ? "millón" : "millones"}` : `${sig(m, lang)} million`;
  }
  if (r < 1e12) return `${sig(r / 1e9, lang)} billion`;                         // solo EN
  if (r < 1e15) { const b = r / 1e12; return es ? `${sig(b, lang)} ${b === 1 ? "billón" : "billones"}` : `${sig(b, lang)} trillion`; }
  return sci(r, lang);
}
// "de" partitivo del español: "2 millones de años"
const esDe = (s) => (/(millón|millones|billón|billones)$/.test(s) ? `${s} de` : s);

export function years(x, lang) {
  const b = big(x, lang);
  const one = roundSig(x, 2) === 1;
  return lang === "es" ? `${esDe(b)} ${one ? "año" : "años"}` : `${b} ${one ? "year" : "years"}`;
}
export function lightYears(x, lang) {
  const b = big(x, lang);
  return lang === "es" ? `${esDe(b)} años luz` : `${b} light-years`;
}

// Valor humano de cada factor (también es el aria-valuetext del deslizador)
export function factorValue(f, v, lang) {
  const es = lang === "es";
  if (f.kind === "rate") return es ? `${sig(v, lang)} por año` : `${sig(v, lang)} per year`;
  if (f.kind === "count") return sig(v, lang);
  if (f.kind === "years") return years(v, lang);
  // fracción
  if (v >= 0.995) return es ? "todas (100 %)" : "all (100%)";
  if (v >= 0.01) return es ? `${sig(v * 100, lang)} %` : `${sig(v * 100, lang)}%`;
  const inv = big(1 / v, lang);
  return es ? `1 de cada ${/^1 mill/.test(inv) ? inv.replace(/^1 /, "") : inv}` : `1 in ${inv}`;
}
// Valor corto para la ecuación en vivo: 0.5 → "0,5"; 1e-6 → "10⁻⁶"; 10000 → "10.000"
export function factorShort(v, lang) {
  if (v < 0.01) return sci(v, lang);
  if (v >= 1e6) return sci(v, lang);
  return v >= 100 ? num(roundSig(v, 2), lang) : sig(v, lang);
}

// Titular del resultado. kind: "none" (<1) | "one" | "some"
export function headline(N, lang) {
  const es = lang === "es";
  if (!(N >= 1)) return { kind: "none", big: es ? "Menos de una" : "Fewer than one" };
  if (N < 1.5) return { kind: "one", big: es ? "Más o menos una" : "About one" };
  const r = N < 100 ? Math.round(N) : roundSig(N, 2);
  const b = big(r, lang);
  // género: "unas 12 [civilizaciones]" pero "unos 3 millones [de civilizaciones]"
  const masc = /mill|bill|×/.test(b);
  return { kind: "some", big: es ? `${masc ? "Unos" : "Unas"} ${b}` : `About ${b}`, partitive: es && /(millón|millones|billón|billones)$/.test(b) };
}
