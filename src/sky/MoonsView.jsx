// MoonsView.jsx — «Así se ve hoy»: el planeta y sus lunas en el instante elegido, con el norte arriba y
// el este a la izquierda (como a simple vista o con prismáticos). Posiciones: src/sky/moons.js.
// Se muestra en la ficha de una luna (resaltada) y en la de un planeta con lunas.
import { useMemo } from "react";
import { ephemeris } from "../ephemeris.js";
import { planetView, moonName, moonVectorKm, skyAxes, daysSinceT0, moonOrbit, seeWith } from "./moons.js";
import { bodyName } from "./bodies.js";
import { num } from "./format.js";

const PLANET_EN = { "Marte": "Mars", "Júpiter": "Jupiter", "Saturno": "Saturn", "Urano": "Uranus", "Neptuno": "Neptune" };
const AU_KM = 149597870.7, ARCSEC = 206264.806, C_KMS = 299792.458;

/** 125.4 → «2′ 05″»; 17.3 → «17″»; 0.4 → «0,4″». */
export function fmtArc(s, lang) {
  if (s >= 60) { const m = Math.floor(s / 60), r = Math.round(s - 60 * m); return r === 60 ? `${m + 1}′ 00″` : `${m}′ ${String(r).padStart(2, "0")}″`; }
  return `${num(s, lang, s < 10 ? 1 : 0)}″`;
}

/** Datos de la vista para un planeta en una fecha (también lo usa la ficha para sus datos). */
export function viewFor(parent, when) {
  const eb = ephemeris(when).find((b) => b.planet === PLANET_EN[parent]);
  if (!eb) return null;
  const planet = { name: parent, nx: eb.nx, ny: eb.ny, nz: eb.nz, dist_au: eb.dist_au, r_au: eb.r_au };
  return { planet, view: planetView(planet, when) };
}

export default function MoonsView({ parent, focus, lang, t, when }) {
  const minute = Math.floor(when.getTime() / 60000);
  const data = useMemo(() => viewFor(parent, new Date(minute * 60000)), [parent, minute]);
  if (!data) return null;
  const { planet, view } = data;
  const pName = bodyName(parent, lang);
  // escala: que quepa la luna elegida (o, en la ficha del planeta, todas menos Jápeto, muy lejana)
  const fit = focus ? view.moons.filter((m) => m.key === focus) : view.moons.filter((m) => m.key !== "Iapetus");
  const extent = Math.max(view.radius * 5, ...fit.map((m) => m.aArcsec)) * 1.12;
  const S = 150, k = (S - 14) / extent;                       // px por segundo de arco
  const sx = (x) => S - x * k, sy = (y) => S - y * k;        // este a la izquierda, norte arriba
  const rP = Math.max(3, view.radius * k);
  // órbitas (proyectadas): 72 puntos a lo largo de una vuelta, en el mismo instante de luz
  const D = planet.dist_au * AU_KM, { east, north } = skyAxes([planet.nx, planet.ny, planet.nz].map((v) => v / Math.hypot(planet.nx, planet.ny, planet.nz)));
  const t0 = daysSinceT0(new Date(minute * 60000)) - D / C_KMS / 86400;
  const orbitPath = (key) => {
    const o = moonOrbit(key), P = 2 * Math.PI / Math.abs(o.n), pts = [];
    for (let i = 0; i <= 72; i++) {
      const v = moonVectorKm(key, t0 + (P * i) / 72);
      const x = (v[0] * east[0] + v[1] * east[1] + v[2] * east[2]) / D * ARCSEC, y = (v[0] * north[0] + v[1] * north[1] + v[2] * north[2]) / D * ARCSEC;
      pts.push(`${i ? "L" : "M"}${sx(x).toFixed(1)} ${sy(y).toFixed(1)}`);
    }
    return pts.join("");
  };
  const inView = (m) => Math.abs(m.x * k) < S - 4 && Math.abs(m.y * k) < S - 4;
  const out = view.moons.filter((m) => !inView(m));
  const dirOf = (m) => (Math.abs(m.x) >= Math.abs(m.y) ? (m.x > 0 ? t.dirE : t.dirW) : (m.y > 0 ? t.dirN : t.dirS));
  const magTxt = (m) => num(m.mag, lang, 1);
  const rowText = (m) => (m.state === "hidden" ? t.moonHidden(pName) : m.state === "transit" ? t.moonTransit(pName) : t.moonRow(fmtArc(m.sep, lang), dirOf(m), magTxt(m)));
  // rótulos sin pisarse: primero la luna elegida y luego las más brillantes; si un rótulo choca con otro
  // o con el planeta se prueba debajo/encima y, si no cabe, la luna queda sin nombre (está en la lista)
  const labels = {};
  const boxes = [[S - rP - 2, S - rP - 2, S + rP + 2, S + rP + 2]];
  const hit = (b) => boxes.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]);
  [...view.moons].filter(inView).sort((a, b) => (b.key === focus) - (a.key === focus) || a.mag - b.mag).forEach((m) => {
    const w = moonName(m.key, lang).length * (m.key === focus ? 7.4 : 6.4) + 4, x = sx(m.x), y = sy(m.y);
    for (const dy of m.y >= 0 ? [-9, 15] : [15, -9]) {
      const b = [x - w / 2, y + dy - 11, x + w / 2, y + dy + 2];
      if (!hit(b)) { boxes.push(b); labels[m.key] = dy; return; }
    }
  });
  const ring = view.ring;
  // anillo: eje mayor perpendicular al polo proyectado (pa: desde el norte hacia el este)
  const ringRot = ring ? (Math.atan2(-Math.cos(ring.pa * Math.PI / 180), -Math.sin(ring.pa * Math.PI / 180)) * 180 / Math.PI) + 90 : 0;
  const sel = focus ? view.moons.find((m) => m.key === focus) : null;
  const list = view.moons.map((m) => `${moonName(m.key, lang)}: ${rowText(m)}`).join(". ");
  const loc = lang === "es" ? "es-EC" : "en-US";
  const stamp = new Date(minute * 60000).toLocaleString(loc, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  return (
    <section className="sk-moons" aria-label={focus ? t.moonsTitle : t.moonsTitlePlanet}>
      <h3>{focus ? t.moonsTitle : t.moonsTitlePlanet} <small>{stamp}</small></h3>
      <svg viewBox={`0 0 ${2 * S} ${2 * S}`} className="sk-moons-svg" role="img" aria-label={t.moonsAria(pName, list)}>
        <rect x="1" y="1" width={2 * S - 2} height={2 * S - 2} rx="18" className="sk-moons-bg" />
        <g aria-hidden="true">
          {view.moons.filter((m) => m.aArcsec * k < 2.2 * S).map((m) => <path key={m.key} d={orbitPath(m.key)} className={`sk-moons-orbit${m.key === focus ? " is-on" : ""}`} fill="none" />)}
          {ring && <ellipse cx={S} cy={S} rx={ring.a * k} ry={Math.max(0.8, ring.b * k)} transform={`rotate(${ringRot.toFixed(1)} ${S} ${S})`} className="sk-moons-ring" />}
          <circle cx={S} cy={S} r={rP} className={`sk-moons-planet is-${PLANET_EN[parent].toLowerCase()}`} />
          {view.moons.filter(inView).map((m) => {
            const on = m.key === focus, hidden = m.state === "hidden";
            return (
              <g key={m.key} className={`sk-moons-moon${on ? " is-on" : ""}${hidden ? " is-hidden" : ""}`}>
                <circle cx={sx(m.x)} cy={sy(m.y)} r={on ? 5 : 3.2} />
                {labels[m.key] != null && <text x={sx(m.x)} y={sy(m.y) + labels[m.key]} textAnchor="middle">{moonName(m.key, lang)}</text>}
              </g>
            );
          })}
          <text x={S} y="16" textAnchor="middle" className="sk-moons-compass">{t.compassN}</text>
          <text x="12" y={S + 4} textAnchor="middle" className="sk-moons-compass">{t.compassE}</text>
          <text x={2 * S - 12} y={S + 4} textAnchor="middle" className="sk-moons-compass">{t.compassW}</text>
        </g>
      </svg>
      {sel && sel.state !== "free" && <p className="sk-moons-state">{sel.state === "hidden" ? t.moonStateHidden(moonName(sel.key, lang), pName) : t.moonStateTransit(moonName(sel.key, lang), pName)}</p>}
      {sel && (
        <dl className="sk-facts sk-moons-facts">
          <div><dt>{t.sepNow}</dt><dd>{t.sepVal(fmtArc(sel.sep, lang))}</dd></div>
          <div><dt>{t.seeTitle}</dt><dd>{t.see[seeWith(sel.mag, sel.sep, parent)]}<small>{t.seeHint}</small></dd></div>
        </dl>
      )}
      {!focus && (
        <ul className="sk-moons-list">
          {view.moons.map((m) => <li key={m.key}><b>{moonName(m.key, lang)}</b> {rowText(m)}</li>)}
        </ul>
      )}
      {ring && <p className="sk-moons-note">{t.ringLine(num(Math.abs(ring.tilt), lang, 1))}</p>}
      {out.length > 0 && <p className="sk-moons-note">{t.moonsOut(out.map((m) => `${moonName(m.key, lang)} (${fmtArc(m.sep, lang)} ${lang === "es" ? "al " : ""}${dirOf(m)})`).join(", "))}</p>}
      <small className="sk-moons-src">{t.moonsOrient} {t.moonsSrc}</small>
    </section>
  );
}
