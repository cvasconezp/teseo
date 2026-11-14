// GravityAssists.jsx — tarjeta «Catapultas gravitatorias» en la pestaña Ruta.
// Explica en corto cómo funciona una asistencia gravitatoria y, según el destino
// elegido, muestra misiones reales que las usaron: secuencia de sobrevuelos como
// fichas (lista ordenada), fechas verificadas con su fuente y duración frente a
// Hohmann. Los datos viven en assists.js; los textos, en i18n-assists.js.
import { useEffect, useMemo } from "react";
import PlanetSphere from "../ui/PlanetSphere.jsx";
import { track } from "../ui/track.js";
import {
  missionsFor, missionYears, hohmannYears, orbitalSpeedKmS, nextMilestone, daysTo, dateMs, eventDate, BY_DEST,
} from "./assists.js";
import { GA, nameOf } from "./i18n-assists.js";
import "./route.css";

// ─── Formato ─────────────────────────────────────────────────────────────────

const nf = (x, lang, max = 1, min = 0) =>
  Number(x).toLocaleString(lang === "es" ? "es" : "en-US", { maximumFractionDigits: max, minimumFractionDigits: min });

const yearsText = (y, lang, t) => (y < 1 ? t.daysUnit(Math.round(y * 365.25)) : t.yearsUnit(y, (n) => nf(n, lang, 1)));

// ─── Secuencia de fichas ─────────────────────────────────────────────────────

function Sequence({ m, lang, t }) {
  const n = m.events.length;
  return (
    <ol className="ga-seq" aria-label={t.seqAria(m.name)}>
      {m.events.map((e, i) => {
        const name = nameOf(e.body, lang);
        const count = e.n || 1;
        const when = count > 1
          ? `${t.until} ${new Date(dateMs(e.date)).getUTCFullYear()}`
          : eventDate(e, lang);
        const spoken = t.chipAria(name, t.kind[e.kind], count > 1 ? `${t.last} ${eventDate(e, lang, true)}` : eventDate(e, lang, true), count)
          + (e.scheduled ? `, ${t.planned}` : "");
        const last = i === n - 1;
        return (
          <li key={i} className={`ga-chip ${last ? "is-target" : ""} ${e.scheduled ? "is-planned" : ""} ${e.kind === "launch" ? "is-launch" : ""}`}>
            <span className="rt-sr">{spoken}</span>
            <span className="ga-chip__vis" aria-hidden="true">
              <span className="ga-chip__sphere"><PlanetSphere id={e.body} size={30} spin={false} /></span>
              <span className="ga-chip__name">{name}{count > 1 && <b className="ga-chip__n">{t.times(count)}</b>}</span>
              <span className="ga-chip__date">{when}</span>
            </span>
            {!last && <span className="ga-arrow" aria-hidden="true">→</span>}
          </li>
        );
      })}
    </ol>
  );
}

// ─── Una misión ──────────────────────────────────────────────────────────────

function Mission({ m, lang, t, now }) {
  const real = missionYears(m);
  const hoh = m.target ? null : hohmannYears(m.dest);
  const ratio = hoh ? real / hoh : null;
  const verdict = ratio === null ? null : ratio < 0.9 ? t.faster : ratio > 1.1 ? (ratio > 5 ? t.muchSlower : t.slower(nf(ratio, lang, 1))) : t.similar;
  const next = nextMilestone(m, now);
  const days = next ? daysTo(next, now) : null;
  const soon = next && days <= 60;
  const note = m.note && (m.note[lang] || m.note.es);

  return (
    <article className="ga-mission" aria-label={m.name}>
      <header className="ga-mission__head">
        <h5 className="ga-mission__name">{m.name}</h5>
        <span className="ga-mission__agency">{m.agency}</span>
      </header>
      {soon && (
        <p className="ga-badge" role="note">
          <span className="ga-badge__dot" aria-hidden="true" />
          {t.next(t.nextKinds[next.kind](nameOf(next.body, lang, true)), `${eventDate(next, lang, true)} (${t.inDays(Math.max(0, days))})`)}
        </p>
      )}
      <Sequence m={m} lang={lang} t={t} />
      <dl className="ga-dur">
        <div><dt>{t.real}</dt><dd>{yearsText(real, lang, t)}</dd></div>
        {hoh !== null && <div><dt>{t.hohmann}</dt><dd>{yearsText(hoh, lang, t)}</dd></div>}
      </dl>
      {verdict && <p className="ga-verdict">{verdict}</p>}
      {note && <p className="rt-note">{note}</p>}
      <details className="rt-details">
        <summary>{t.dates}</summary>
        <table className="rt-table rt-table--top ga-table">
          <caption className="rt-sr">{t.datesCaption(m.name)}</caption>
          <thead><tr><th scope="col">{t.thEvent}</th><th scope="col">{t.thBody}</th><th scope="col">{t.thDate}</th></tr></thead>
          <tbody>
            {m.events.map((e, i) => (
              <tr key={i}>
                <td>{t.kindCap[e.kind]}</td>
                <td>{nameOf(e.body, lang)}{e.n > 1 ? ` ${t.times(e.n)}` : ""}</td>
                <td>{e.n > 1 ? `${t.last} ` : ""}{eventDate(e, lang, true)}{e.scheduled ? ` (${t.planned})` : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="rt-note">{t.sources}:</p>
        <ul className="ga-sources">
          {m.sources.map((s) => (
            <li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.label}</a></li>
          ))}
        </ul>
        <p className="rt-note">{t.sourcesNote}</p>
      </details>
    </article>
  );
}

// ─── Tarjeta ─────────────────────────────────────────────────────────────────

export default function GravityAssists({ from, to, lang }) {
  const t = GA[lang] || GA.es;
  const dest = to.id;
  const missions = useMemo(() => missionsFor(dest), [dest]);
  const now = Date.now();

  useEffect(() => { track("assists_card", { origin: from.id, destination: dest }); }, [from.id, dest]);

  const destName = nameOf(dest, lang, true);
  const jupiterV = nf(orbitalSpeedKmS("jupiter"), lang, 1, 1);
  const lead =
    dest === "earth" ? t.earthLead
    : dest === "mars" ? t.directMars
    : dest === "venus" ? t.venusLead
    : null;

  return (
    <section className="card rt ga" aria-labelledby="ga-title">
      <div className="card__head">
        <h3 id="ga-title" className="card__title">{t.title}</h3>
        <span className="tag">{t.tag}</span>
      </div>
      <p className="card__lead">{t.lead}</p>
      <p className="rt-why">{t.how}</p>
      <p className="rt-why">{t.uses}</p>
      <p className="rt-note">{t.limit(jupiterV)}</p>
      <p className="rt-note">
        {t.sourceHow}{" "}
        <a href="https://science.nasa.gov/learn/basics-of-space-flight/chapter4-1/" target="_blank" rel="noopener noreferrer">NASA, Basics of Space Flight</a>.
      </p>

      <h4 className="rt-h">
        {dest === "mars" ? t.directTitle(nameOf(dest, lang)) : dest === "venus" ? t.directTitle(nameOf(dest, lang)) : dest === "earth" ? t.title : t.missionsTitle(destName)}
      </h4>
      {lead && <p className="rt-note">{lead}</p>}
      {from.id !== "earth" && BY_DEST[dest] && BY_DEST[dest].length > 0 && <p className="rt-note">{t.originNote}</p>}

      <div className="ga-list">
        {missions.slice(0, 1).map((m) => <Mission key={m.id} m={m} lang={lang} t={t} now={now} />)}
      </div>
      {missions.length > 1 && (
        <details className="rt-details ga-more">
          <summary>{t.moreMissions(missions.length - 1)}</summary>
          <div className="ga-list">
            {missions.slice(1).map((m) => <Mission key={m.id} m={m} lang={lang} t={t} now={now} />)}
          </div>
        </details>
      )}
      <p className="rt-note">{t.durationNote}</p>
    </section>
  );
}
