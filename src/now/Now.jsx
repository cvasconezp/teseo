// Now.jsx — "Ahora en el espacio": tres tarjetas con datos en vivo.
//   · Rumbo a Marte ahora      GET /api/missions/mars
//   · Próximos lanzamientos    GET /api/launches?limit=8
//   · Asteroides que pasan     GET /api/asteroids?days=30&dist_ld=10
// Se carga en su propio chunk (lazy desde App.jsx) y cada tarjeta es
// independiente: si un endpoint aún no existe (404) o falla, esa tarjeta lo
// dice y las demás siguen. Todo número derivado (tiempo de señal, tamaños,
// comparaciones) sale de math.js: determinista, sin IA.
import { useEffect, useMemo, useRef, useState, useId } from "react";
import { fetchJson, isAbort } from "../net.js";
import PlanetSphere from "../ui/PlanetSphere.jsx";
import { IconRetry, IconChevron } from "../ui/icons.jsx";
import { parseISO, daysUntil, countdownParts } from "../ui/time.js";
import { launchWindowsLocal } from "../ui/orbits.js";
import {
  AU_KM, signalSeconds, splitSeconds, spacecraftDistances, launchStatus, netPrecision, nextLaunch, sortByNet, orbitKey,
  asteroidSize, sizeReference, speedFacts, passDistance, niceMaxLd, asteroidLayout,
} from "./math.js";
import { TN } from "./i18n.jsx";
import { track, trackOnce, trackNetError } from "../ui/track.js";
import "./now.css";

const ASTEROID_DAYS = 30, ASTEROID_LD = 10;

// ─── Formato (depende del idioma) ────────────────────────────────────────────

const loc = lang => (lang === "es" ? "es-EC" : "en-US");
const nf = (x, lang, max = 0, min = 0) =>
  Number(x).toLocaleString(lang === "es" ? "es" : "en-US", { maximumFractionDigits: max, minimumFractionDigits: min });

function fmtKm(km, lang, t) {
  if (km >= 1e6) { const m = km / 1e6; return `${nf(m, lang, m < 100 ? 1 : 0)} ${t.millionKm}`; }
  const step = km >= 1e5 ? 1000 : km >= 1e4 ? 100 : 10;
  return `${nf(Math.round(km / step) * step, lang)} ${t.km}`;
}
function fmtMeters(m, lang) {
  if (m < 10) return nf(m, lang, 1);
  if (m < 100) return nf(Math.round(m), lang);
  if (m < 1000) return nf(Math.round(m / 10) * 10, lang);
  return nf(Math.round(m / 100) * 100, lang);
}
function fmtSignal(sec, lang, t) {
  if (sec < 60) return `${nf(sec, lang, 1)} ${t.unitS}`;
  const { h, m, s } = splitSeconds(sec);
  return h ? `${h} ${t.unitH} ${m} ${t.unitMin}` : `${m} ${t.unitMin} ${s} ${t.unitS}`;
}
// Fecha y hora en la zona horaria del dispositivo
function fmtLocal(d, lang, withTime = true) {
  const date = parseISO(d);
  if (!Number.isFinite(+date)) return "";
  const opts = { weekday: "short", day: "numeric", month: "short" };
  if (date.getFullYear() !== new Date().getFullYear()) opts.year = "numeric";
  if (withTime) Object.assign(opts, { hour: "2-digit", minute: "2-digit", timeZoneName: "short" });
  return date.toLocaleString(loc(lang), opts);
}
const fmtMonth = (d, lang) => parseISO(d).toLocaleDateString(loc(lang), { month: "long", year: "numeric" });
const fmtUtcDate = (d, lang) => parseISO(d).toLocaleDateString(loc(lang), { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
function fmtStamp(d, lang, t) {
  const date = parseISO(d);
  if (!Number.isFinite(+date)) return null;
  const time = date.toLocaleTimeString(loc(lang), { hour: "2-digit", minute: "2-digit" });
  const sameDay = date.toDateString() === new Date().toDateString();
  return sameDay ? `${t.today}, ${time}` : `${date.toLocaleDateString(loc(lang), { day: "numeric", month: "short" })}, ${time}`;
}
// Texto que puede llegar como cadena o como { es, en }
const pickText = (v, lang) => (v && typeof v === "object" ? (v[lang] || v.es || v.en || "") : (typeof v === "string" ? v : ""));
const safeUrl = u => (typeof u === "string" && /^https?:\/\//i.test(u) ? u : null);

// ─── Datos ───────────────────────────────────────────────────────────────────

// status: loading | ok | missing (el endpoint aún no existe) | error
//   · 503: el servidor aún está reuniendo el dato → se reintenta solo unas veces;
//   · `repoll(data)` devuelve true si la respuesta está incompleta (p. ej.
//     `pending` > 0): se vuelve a pedir en silencio, sin borrar lo ya mostrado.
const RETRY_MS = 5000, MAX_AUTO = 6;
function useEndpoint(url, repoll, name = "other") {
  const [state, setState] = useState({ status: "loading", data: null, at: null });
  const [attempt, setAttempt] = useState(0);
  const auto = useRef({ silent: false, count: 0 });
  useEffect(() => {
    const ctrl = new AbortController();
    let alive = true, timer = null;
    const silent = auto.current.silent;
    auto.current.silent = false;
    if (!silent) setState(s => (s.status === "loading" ? s : { ...s, status: "loading" }));
    const again = (quiet) => {
      if (auto.current.count >= MAX_AUTO) return false;
      auto.current.count += 1;
      timer = setTimeout(() => { if (alive) { auto.current.silent = quiet; setAttempt(n => n + 1); } }, RETRY_MS);
      return true;
    };
    fetchJson(url, { signal: ctrl.signal })
      .then(d => {
        if (!alive) return;
        if (!(d && typeof d === "object" && !Array.isArray(d))) { setState({ status: "error", data: null, at: null }); return; }
        const more = !!(repoll && repoll(d)) && again(true);
        setState({ status: "ok", data: d, at: Date.now(), more });
      })
      .catch(e => {
        if (!alive || isAbort(e)) return;
        const msg = String(e && e.message);
        if (/HTTP 503\b/.test(msg) && again(false)) return;          // sigue "consultando…"
        if (silent) { setState(s => (s.status === "ok" ? { ...s, more: false } : { status: "error", data: null, at: null })); return; }
        trackNetError(name, e);                                       // solo endpoint y tipo de fallo
        setState({ status: /HTTP (404|501)\b/.test(msg) ? "missing" : "error", data: null, at: null });
      });
    return () => { alive = false; ctrl.abort(); if (timer) clearTimeout(timer); };
  }, [url, attempt, repoll]);
  const retry = () => { auto.current = { silent: false, count: 0 }; setAttempt(n => n + 1); };
  return [state, retry];
}
const marsPending = d => Number(d.pending) > 0;

function useTick(ms, active = true) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms, active]);
  return now;
}

// ─── Piezas comunes ──────────────────────────────────────────────────────────

// Etiqueta de certeza: mismo lenguaje visual que la pestaña Preguntas
// (color + forma del icono + texto; nunca solo color).
function Cert({ level, t, note }) {
  return (
    <span className={`now-cert now-cert--${level}`}>
      <svg className="now-cert__icon" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        {level === "measured"
          ? (<><circle cx="8" cy="8" r="7" fill="currentColor" /><path d="m4.6 8.2 2.3 2.3 4.5-4.8" fill="none" stroke="#04080F" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></>)
          : (<><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M8 1.8a6.2 6.2 0 0 0 0 12.4z" fill="currentColor" /></>)}
      </svg>
      <span><strong>{t.cert[level]}</strong>{note ? <span className="now-cert__note">: {note}</span> : null}</span>
    </span>
  );
}

function ExtLink({ href, children, t, className = "now-link", onClick }) {
  return (
    <a className={className} href={href} target="_blank" rel="noopener noreferrer" onClick={onClick}>
      {children}<span className="now-sr"> ({t.opensNew})</span>
    </a>
  );
}

function Card({ title, cert, certNote, state, retry, t, lang, fallbackSource, area, children }) {
  const hid = useId();
  // Métrica anónima: la tarjeta se vio (≥ 40 % en pantalla), una vez por pestaña
  const boxRef = useRef(null);
  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(entries => {
      if (entries.some(en => en.isIntersecting)) { trackOnce(`now_card:${area}`, "now_card_view", { card: area }); io.disconnect(); }
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [area]);
  const { status, data, at } = state;
  const stamp = status === "ok" ? (data.updated ? t.updated(fmtStamp(data.updated, lang, t) || String(data.updated)) : t.fetched(fmtStamp(at, lang, t))) : null;
  return (
    <section ref={boxRef} className={`now-card now-card--${area} is-${status}`} aria-labelledby={hid} aria-busy={status === "loading"}>
      <header className="now-card__head">
        <h3 id={hid} className="now-card__title">{title}</h3>
        <Cert level={cert} t={t} note={certNote} />
        {status === "ok" && data.stale ? (
          <p className="now-stale"><span className="now-stale__dot" aria-hidden="true" /><span><strong>{t.stale}.</strong> {t.staleHint}</span></p>
        ) : null}
      </header>

      {status === "loading" && (
        <div className="now-state" role="status">
          <span className="now-skel" aria-hidden="true" /><span className="now-skel now-skel--short" aria-hidden="true" />
          <span className="now-sr">{t.loading}</span>
        </div>
      )}
      {(status === "missing" || status === "error") && (
        <div className="now-state now-state--off" role="status">
          <p className="now-state__title">{status === "missing" ? t.missingTitle : t.errorTitle}</p>
          <p className="now-state__body">{status === "missing" ? t.missingBody : t.errorBody}</p>
          <button type="button" className="btn btn--ghost now-state__btn" onClick={() => { track("now_retry", { card: area }); retry(); }}>
            <IconRetry width={16} height={16} />{t.retry}
          </button>
        </div>
      )}
      {status === "ok" && children(data, state)}

      {status === "ok" && (
        <footer className="now-card__foot">
          <p className="now-src">{t.source}: {pickText(data.source, lang) || fallbackSource}<br />{stamp}</p>
        </footer>
      )}
    </section>
  );
}

// ─── 1 · Rumbo a Marte ───────────────────────────────────────────────────────

// "launched" puede llegar como fecha ISO o solo como año
function fmtLaunched(v, lang, t) {
  if (v === null || v === undefined || v === "") return null;
  if (/^\d{4}$/.test(String(v))) return t.launchedYear(String(v));
  const d = parseISO(String(v));
  return Number.isFinite(+d) ? t.launched(fmtUtcDate(d, lang)) : null;
}

function Craft({ s, lang, t }) {
  const { earthKm, sunKm } = spacecraftDistances(s);
  const note = lang === "en"
    ? pickText(s.status_note_en ?? s.note_en ?? (typeof s.status_note === "object" ? s.status_note : ""), lang)
    : pickText(s.status_note ?? s.note_es, lang);
  const launched = fmtLaunched(s.launched, lang, t);
  const old = s.stale ? (s.data_date && Number.isFinite(+parseISO(String(s.data_date))) ? t.craftStaleDate(fmtUtcDate(s.data_date, lang)) : t.craftStale) : null;
  return (
    <li className="now-craft__item">
      <p className="now-craft__name">{s.name}</p>
      {(s.agency || launched) && <p className="now-craft__meta">{[pickText(s.agency, lang), launched].filter(Boolean).join(" · ")}</p>}
      {earthKm === null ? <p className="now-craft__none">{t.noDistance}</p> : (
        <dl className="now-facts">
          <div><dt>{t.fromEarth}</dt><dd>{fmtKm(earthKm, lang, t)}<span className="now-facts__sub">{nf(earthKm / AU_KM, lang, earthKm / AU_KM < 0.1 ? 4 : 3)} {t.au}</span></dd></div>
          {sunKm !== null && <div><dt>{t.fromSun}</dt><dd>{fmtKm(sunKm, lang, t)}<span className="now-facts__sub">{nf(sunKm / AU_KM, lang, 3)} {t.au}</span></dd></div>}
          <div><dt>{t.signal}</dt><dd>{fmtSignal(signalSeconds(earthKm), lang, t)}<span className="now-facts__sub">{t.signalOneWay}</span></dd></div>
        </dl>
      )}
      {old && <p className="now-craft__old"><span className="now-stale__dot" aria-hidden="true" />{old}</p>}
      {note && <p className="now-craft__note">{note}</p>}
    </li>
  );
}

function MarsBody({ data, more, lang, t }) {
  // La ventana llega del servidor; si no, mismo método con efemérides locales.
  const win = useMemo(() => {
    const w = data.window;
    if (w && w.departure_date && Number.isFinite(+parseISO(w.departure_date))) return { ...w, local: false };
    try { const l = launchWindowsLocal("earth", "mars", new Date(), 1).windows[0]; return l ? { ...l, local: true } : null; } catch { return null; }
  }, [data.window]);
  const craft = Array.isArray(data.spacecraft) ? data.spacecraft.filter(s => s && typeof s === "object" && s.name) : [];
  // "cruise" = en ruta · "orbit" = ya en órbita de Marte · sin fase: no se supone nada
  const cruise = craft.filter(s => s.phase === "cruise"), orbit = craft.filter(s => s.phase === "orbit");
  const other = craft.filter(s => s.phase !== "cruise" && s.phase !== "orbit");
  const left = win ? daysUntil(win.departure_date) : null;
  const anyDistance = craft.some(s => spacecraftDistances(s).earthKm !== null);

  return (
    <>
      <div className="now-mars">
        <span className="now-mars__sphere" aria-hidden="true"><PlanetSphere id="mars" size={54} /></span>
        {win && (
          <p className="now-lead">
            {left > 0 ? t.marsWindowOpens(fmtUtcDate(win.departure_date, lang), t.daysLeft(left)) : t.marsWindowToday(fmtUtcDate(win.departure_date, lang))}
            {Number.isFinite(+win.transfer_time_days) && Number.isFinite(+win.delta_v_km_s)
              ? <> {t.marsWindowTrip(nf(win.transfer_time_days, lang, 0), nf(win.delta_v_km_s, lang, 2))}</> : null}
            {win.local ? <> {t.marsWindowLocal}</> : null}
          </p>
        )}
      </div>

      <h4 className="now-sub">{t.marsCruise}</h4>
      {cruise.length === 0 ? (
        <div className="now-empty">
          <p className="now-empty__title">{t.marsEmpty}</p>
          <p className="now-empty__body">{t.marsEmptySub}</p>
        </div>
      ) : <ul className="now-craft">{cruise.map((s, i) => <Craft key={`${s.name}-${i}`} s={s} lang={lang} t={t} />)}</ul>}

      {orbit.length > 0 && (<>
        <h4 className="now-sub now-sub--rule">{t.marsOrbit}</h4>
        <ul className="now-craft">{orbit.map((s, i) => <Craft key={`${s.name}-${i}`} s={s} lang={lang} t={t} />)}</ul>
      </>)}
      {other.length > 0 && (<>
        <h4 className="now-sub now-sub--rule">{t.marsOther}</h4>
        <ul className="now-craft">{other.map((s, i) => <Craft key={`${s.name}-${i}`} s={s} lang={lang} t={t} />)}</ul>
      </>)}

      {more && <p className="now-fine now-pending" role="status">{t.marsPending}</p>}
      {anyDistance && <p className="now-fine">{t.signalNote}</p>}
    </>
  );
}

// ─── 2 · Próximos lanzamientos ───────────────────────────────────────────────

function Countdown({ launch, lang, t }) {
  const now = useTick(1000);
  const c = countdownParts(launch.net, now);
  if (!c) return null;
  if (c.past) return <p className="now-fine" role="status">{t.liftoffPassed}</p>;
  const two = n => String(n).padStart(2, "0");
  const cells = [
    c.d > 0 ? [nf(c.d, lang), c.d === 1 ? t.cdD1 : t.cdD] : null,
    [c.d > 0 ? two(c.h) : String(c.h), c.h === 1 ? t.cdH1 : t.cdH],
    [two(c.m), t.cdM],
    [two(c.s), t.cdS],
  ].filter(Boolean);
  // role="timer": los lectores no lo anuncian cada segundo, pero se puede consultar
  return (
    <p className="now-count" role="timer" aria-live="off" aria-label={t.countdownLabel(launch.name || "")}>
      {cells.map(([n, u]) => (
        <span key={u} className="now-count__cell"><span className="now-count__n">{n}</span><span className="now-count__u">{u}</span></span>
      ))}
    </p>
  );
}

function launchWhen(l, lang, t) {
  if (!Number.isFinite(Date.parse(l.net))) return t.whenVague;
  const p = netPrecision(l);
  if (p === "time") return fmtLocal(l.net, lang, true);
  if (p === "day") return t.whenDay(fmtLocal(l.net, lang, false));
  if (p === "month") return t.whenMonth(fmtMonth(l.net, lang));
  return t.whenVague;
}

function StatusBadge({ l, t }) {
  const key = launchStatus(l);
  const label = key ? t.status[key] : (l.status_name || (typeof l.status === "string" ? l.status : ""));
  if (!label) return null;
  return <span className={`now-status now-status--${key || "other"}`} title={(key && t.statusHelp[key]) || undefined}>{label}</span>;
}

function LaunchItem({ l, lang, t, featured }) {
  const ok = orbitKey(l.orbit);
  const orbit = ok ? t.orbits[ok] : pickText(typeof l.orbit === "object" && l.orbit ? l.orbit.name : l.orbit, lang);
  const mtype = l.mission_type ? (t.missionTypes[String(l.mission_type).toLowerCase()] || l.mission_type) : null;
  const ptype = l.provider_type ? t.providerTypes[String(l.provider_type).toLowerCase()] : null;
  const where = [l.pad, l.location].filter(Boolean).join(", ");
  const webcast = safeUrl(l.webcast_url), info = safeUrl(l.info_url), image = featured ? (safeUrl(l.image_thumbnail) || safeUrl(l.image)) : null;
  const [imgOk, setImgOk] = useState(true);
  // el nombre suele ser "Cohete | Misión": no se repite la misión debajo
  const mission = l.mission && !String(l.name || "").includes(l.mission) ? l.mission : null;
  return (
    <li className={`now-launch ${featured ? "is-next" : ""}`}>
      {featured && <p className="now-launch__flag">{t.nextUp}</p>}
      <p className="now-launch__name">{l.name || mission || "—"}</p>
      <p className="now-launch__when">
        <time dateTime={Number.isFinite(Date.parse(l.net)) ? new Date(l.net).toISOString() : undefined}>{launchWhen(l, lang, t)}</time>
        <StatusBadge l={l} t={t} />
      </p>
      {featured && <Countdown launch={l} lang={lang} t={t} />}
      {image && imgOk && (
        <figure className="now-launch__fig">
          <img src={image} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setImgOk(false)} />
          {l.image_credit && <figcaption>{t.imageCredit(l.image_credit)}</figcaption>}
        </figure>
      )}
      <dl className="now-rows">
        {l.rocket && <div><dt>{t.rocket}</dt><dd>{l.rocket}</dd></div>}
        {l.provider && <div><dt>{t.provider}</dt><dd>{l.provider}{ptype ? <span className="now-rows__sub"> ({ptype})</span> : null}</dd></div>}
        {where && <div><dt>{t.pad}</dt><dd>{where}</dd></div>}
        {orbit && <div><dt>{t.orbit}</dt><dd>{orbit}</dd></div>}
        {(mission || mtype) && <div><dt>{t.mission}</dt><dd>{[mission, mtype].filter(Boolean).join(" · ")}</dd></div>}
      </dl>
      {l.description && (
        <details className="now-desc" onToggle={e => { if (e.currentTarget.open) track("now_item", { card: "launches", kind: "details" }); }}>
          <summary><span>{t.description}</span><IconChevron className="now-desc__chev" width={16} height={16} /></summary>
          <p lang="en">{l.description}</p>
        </details>
      )}
      {(webcast || info) && (
        <p className="now-launch__links">
          {webcast && <ExtLink href={webcast} t={t} className="btn btn--ghost now-launch__btn" onClick={() => track("now_item", { card: "launches", kind: "webcast" })}>{t.webcast}</ExtLink>}
          {info && <ExtLink href={info} t={t} onClick={() => track("now_item", { card: "launches", kind: "info" })}>{t.moreInfo}</ExtLink>}
        </p>
      )}
    </li>
  );
}

function LaunchesBody({ data, lang, t }) {
  const [all, setAll] = useState(false);
  const list = useMemo(() => sortByNet(Array.isArray(data.launches) ? data.launches.filter(l => l && typeof l === "object" && (l.name || l.mission)) : []), [data.launches]);
  // se recalcula cada medio minuto por si el siguiente ya despegó
  const coarse = useTick(30000);
  const next = useMemo(() => nextLaunch(list, coarse), [list, coarse]);
  if (!list.length) return <div className="now-empty"><p className="now-empty__title">{t.launchesEmpty}</p></div>;
  // los que ya despegaron (la fuente los conserva 24 h) van al final, con su estado
  const flown = l => ["success", "failure", "partial", "flight"].includes(launchStatus(l));
  const rest = [...list.filter(l => l !== next && !flown(l)), ...list.filter(l => l !== next && flown(l))];
  const FOLD = next ? 3 : 4;
  const shown = all ? rest : rest.slice(0, FOLD);
  return (
    <>
      {!next && <p className="now-fine">{t.noCountdown}</p>}
      <ol className="now-launches">
        {next && <LaunchItem key={next.id || next.name} l={next} lang={lang} t={t} featured />}
        {shown.map((l, i) => <LaunchItem key={l.id || `${l.name}-${i}`} l={l} lang={lang} t={t} />)}
      </ol>
      {rest.length > FOLD && (
        <button type="button" className="btn btn--ghost now-more" aria-expanded={all} onClick={() => { if (!all) track("now_item", { card: "launches", kind: "show_all" }); setAll(a => !a); }}>
          {all ? t.showLess : t.showAll(list.length)}
        </button>
      )}
      <p className="now-fine">{lang === "es" ? "Fechas y horas en la " : "Dates and times in "}{t.localTime}.</p>
    </>
  );
}

// ─── 3 · Asteroides ──────────────────────────────────────────────────────────

function sizePhrase(size, t) {
  const a = sizeReference(size.min), b = sizeReference(size.max);
  if (!a || !b) return null;
  if (a.key !== b.key) return t.between(t.refs[a.key], t.refs[b.key]);
  const g = sizeReference(Math.sqrt(size.min * size.max));
  if (g.ratio < 0.6) return t.smaller(t.refs[g.key]);
  if (g.ratio > 1.7) return t.times(Math.round(g.ratio), t.refs[g.key]);
  return t.like(t.refs[g.key]);
}

// Gráfico a escala (distancias lineales). La Tierra y la Luna usan la textura
// real con PlanetSphere, superpuestas al SVG.
function AsteroidChart({ items, selected, onSelect, maxLd, lang, t }) {
  const R = 100;                                    // radio del gráfico en unidades del viewBox
  const k = R / maxLd;                              // unidades por distancia lunar
  const pts = useMemo(() => asteroidLayout(items.map(o => o.pass.ld), maxLd), [items, maxLd]);
  const rings = maxLd <= 2 ? [2] : [maxLd / 2, maxLd];
  const sel = selected >= 0 ? pts[selected] : null;
  const moonA = (-28 * Math.PI) / 180;
  const pct = v => `${50 + (v / 2.36)}%`;           // viewBox −118…118 → %
  return (
    <div className="now-chart">
      <svg viewBox="-118 -118 236 236" className="now-chart__svg" role="img" aria-label={t.chartLabel(items.length, nf(maxLd, lang))}>
        {rings.map(r => (
          <g key={r}>
            <circle cx="0" cy="0" r={r * k} className="now-chart__ring" />
            <text x="0" y={r * k + 9.5} className="now-chart__tick" textAnchor="middle">{t.chartLd(nf(r, lang, 1))}</text>
          </g>
        ))}
        <circle cx="0" cy="0" r={k} className="now-chart__moon" />
        {sel && <line x1="0" y1="0" x2={sel.x * R} y2={sel.y * R} className="now-chart__line" />}
        {pts.map((p, i) => (
          <circle key={i} cx={p.x * R} cy={p.y * R} r={i === selected ? 3.6 : 2.3}
            className={`now-chart__rock ${i === selected ? "is-on" : ""}`} />
        ))}
        {sel && <circle cx={sel.x * R} cy={sel.y * R} r="7" className="now-chart__halo" />}
        {sel && (() => {
          const right = sel.x < 0.25, x = sel.x * R + (right ? 10 : -10), y = sel.y * R + (sel.y > 0.8 ? -9 : 3);
          return (
            <text x={x} y={y} className="now-chart__label" textAnchor={right ? "start" : "end"}>
              {items[selected].name}
              <tspan x={x} dy="9.5" className="now-chart__labelsub">{nf(items[selected].pass.ld, lang, 1)} {lang === "es" ? "DL" : "LD"}</tspan>
            </text>
          );
        })()}
      </svg>
      <span className="now-chart__earth" aria-hidden="true"><PlanetSphere id="earth" size={k >= 20 ? 18 : 11} /></span>
      <span className="now-chart__moonball" aria-hidden="true"
        style={{ left: pct(Math.cos(moonA) * k), top: pct(Math.sin(moonA) * k) }}>
        <PlanetSphere id="moon" size={7} spin={false} />
      </span>
      {/* Puntos tocables encima del SVG (área amplia para el dedo) */}
      {pts.map((p, i) => (
        <button key={i} type="button" tabIndex={-1} aria-hidden="true"
          className="now-chart__hit" style={{ left: pct(p.x * R), top: pct(p.y * R) }}
          onClick={() => onSelect(i)} />
      ))}
    </div>
  );
}

function AsteroidsBody({ data, lang, t }) {
  const items = useMemo(() => (Array.isArray(data.objects) ? data.objects : [])
    .map(o => (o && typeof o === "object" ? { ...o, pass: passDistance(o) } : null))
    .filter(o => o && o.pass && o.name)
    .sort((a, b) => a.pass.km - b.pass.km), [data.objects]);
  const [selected, setSelected] = useState(0);
  const [all, setAll] = useState(false);
  const [ldOpen, setLdOpen] = useState(false);
  const ldId = useId();
  useEffect(() => { setSelected(0); }, [items]);
  const pick = i => { if (i !== selected) track("now_item", { card: "asteroids", kind: "select" }); setSelected(i); };

  const days = Number(data.days) > 0 ? Number(data.days) : ASTEROID_DAYS;
  const within = Number(data.dist_ld) > 0 ? Number(data.dist_ld) : ASTEROID_LD;
  if (!items.length) {
    return <div className="now-empty"><p className="now-empty__title">{t.astEmpty(nf(days, lang), nf(within, lang, 1))}</p></div>;
  }
  const maxLd = niceMaxLd(Math.max(2, ...items.map(o => o.pass.ld)));
  const closest = items[0];
  const FOLD = 4;
  // el seleccionado siempre queda a la vista aunque la lista esté plegada
  const shown = all ? items : items.slice(0, Math.max(FOLD, selected + 1));

  return (
    <>
      <p className="now-lead">
        {t.astLead(nf(items.length, lang), nf(days, lang), nf(within, lang, 1))}{" "}
        <button type="button" className="term" aria-expanded={ldOpen} aria-controls={ldId} onClick={() => { if (!ldOpen) track("now_item", { card: "asteroids", kind: "ld_help" }); setLdOpen(o => !o); }}>{t.ldTerm}</button>
        {ldOpen && <span id={ldId} role="note" className="term__note">{t.ldHelp}</span>}
      </p>

      <AsteroidChart items={items} selected={selected} onSelect={pick} maxLd={maxLd} lang={lang} t={t} />
      <p className="now-chart__legend">
        <span className="now-chart__key now-chart__key--moon" aria-hidden="true" />{t.chartMoon}: 1 {lang === "es" ? "DL" : "LD"} = 384{lang === "es" ? "." : ","}400 km
      </p>
      <p className="now-fine">{t.chartNote}</p>

      <ol className="now-rocks" aria-label={t.astTitle}>
        {shown.map((o, i) => {
          const size = asteroidSize(o), sp = speedFacts(Number(o.v_rel_km_s));
          const phrase = size ? sizePhrase(size, t) : null;
          const when = o.date && Number.isFinite(+parseISO(o.date)) ? fmtLocal(o.date, lang, true) : null;
          const on = i === selected;
          return (
            <li key={`${o.name}-${o.date || i}`} className={`now-rock ${on ? "is-on" : ""}`}>
              <button type="button" className="now-rock__pick" aria-pressed={on} aria-label={t.showInChart(o.name)} onClick={() => pick(i)}>
                <span className="now-rock__dot" aria-hidden="true" />
              </button>
              <div className="now-rock__body">
                <p className="now-rock__name">{o.name}{i === 0 && <span className="now-rock__flag">{t.closest}</span>}</p>
                {when && <p className="now-rock__when">{t.passes(when)}</p>}
                <p className="now-rock__dist">
                  <strong>{t.distLd(nf(o.pass.ld, lang, o.pass.ld < 10 ? 1 : 0))}</strong> · {fmtKm(o.pass.km, lang, t)}
                </p>
                <p className="now-rock__line">
                  <span className="now-rock__k">{t.size}</span>{" "}
                  {size ? (<>
                    {size.min === size.max ? t.sizeOne(fmtMeters(size.min, lang)) : t.sizeRange(fmtMeters(size.min, lang), fmtMeters(size.max, lang))}
                    {phrase ? ` (${phrase})` : ""}.{" "}
                    <Cert level={size.estimated ? "estimated" : "measured"} t={t}
                      note={size.basis === "h" ? t.sizeBasis.h(nf(Number(o.h), lang, 1)) : t.sizeBasis[size.basis]} />
                  </>) : t.sizeUnknown}
                </p>
                {sp && (
                  <p className="now-rock__line">
                    <span className="now-rock__k">{t.speed}</span>{" "}
                    {t.speedLine(nf(o.v_rel_km_s, lang, 1), nf(sp.airliners, lang))}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {items.length > FOLD && (
        <button type="button" className="btn btn--ghost now-more" aria-expanded={all} onClick={() => { if (!all) track("now_item", { card: "asteroids", kind: "show_all" }); setAll(a => !a); }}>
          {all ? t.showLess : t.showAll(items.length)}
        </button>
      )}

      <aside className="now-calm">
        <p className="now-calm__title">{t.calmTitle}</p>
        <p>{t.calm(closest.name, nf(Math.round(closest.pass.km / 1000) * 1000, lang),
          t.distLd(nf(closest.pass.ld, lang, 1)), t.earths(nf(closest.pass.earths, lang, closest.pass.earths < 10 ? 1 : 0)))}</p>
        <p><ExtLink href="https://cneos.jpl.nasa.gov/ca/" t={t} onClick={() => track("now_item", { card: "asteroids", kind: "cneos" })}>{t.calmLink}</ExtLink></p>
      </aside>
    </>
  );
}

// ─── Módulo ──────────────────────────────────────────────────────────────────

export default function Now({ lang = "es", api = "" }) {
  const t = TN[lang] || TN.es;
  const [mars, retryMars] = useEndpoint(`${api}/api/missions/mars`, marsPending, "missions_mars");
  const [launches, retryLaunches] = useEndpoint(`${api}/api/launches?limit=8`, undefined, "launches");
  const [rocks, retryRocks] = useEndpoint(`${api}/api/asteroids?days=${ASTEROID_DAYS}&dist_ld=${ASTEROID_LD}`, undefined, "asteroids");
  return (
    <div className="now-grid">
      <Card title={t.marsTitle} cert="measured" certNote={t.marsCert} state={mars} retry={retryMars} t={t} lang={lang}
        area="mars" fallbackSource="NASA JPL Horizons">
        {(d, st) => <MarsBody data={d} more={st.more} lang={lang} t={t} />}
      </Card>
      <Card title={t.launchesTitle} cert="estimated" certNote={t.launchesCert} state={launches} retry={retryLaunches} t={t} lang={lang}
        area="launches" fallbackSource="Launch Library 2 (The Space Devs)">
        {d => <LaunchesBody data={d} lang={lang} t={t} />}
      </Card>
      <Card title={t.astTitle} cert="measured" certNote={t.astCert} state={rocks} retry={retryRocks} t={t} lang={lang}
        area="asteroids" fallbackSource="NASA/JPL CNEOS">
        {d => <AsteroidsBody data={d} lang={lang} t={t} />}
      </Card>
    </div>
  );
}
