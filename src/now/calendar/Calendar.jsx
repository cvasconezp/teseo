// Calendar.jsx — «Calendario del cielo»: próximos eventos astronómicos y espaciales para el lugar
// elegido en el Cielo (localStorage teseo_place_v1; sin dato, Quito). Se monta en Now.jsx como una
// tarjeta más de «Ahora en el espacio». Todo se calcula en el dispositivo (events.js) salvo los
// lanzamientos (/api/launches) y las pasadas de la ISS (/api/iss/passes), que son opcionales:
// si fallan, simplemente no aparecen.
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { fetchJson, isAbort } from "../../net.js";
import { IconRocket } from "../../ui/icons.jsx";
import { track, trackOnce } from "../../ui/track.js";
import { buildSkyEvents, buildFeedEvents, sortEvents, groupByMonth, readPlace, TYPES } from "./events.js";
import { TC, describeEvent } from "./i18n.js";
import { downloadIcs } from "./ics.js";
import { loadIssPasses } from "./issLoader.js";
import "./calendar.css";

const DAY = 86400000;
const loc = lang => (lang === "es" ? "es-EC" : "en-US");

// ─── Iconos (SVG en línea, trazo currentColor) ───────────────────────────────
const Svg = ({ children }) => (
  <svg className="cal-ico" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{children}</svg>
);
const ICONS = {
  moon: () => <Svg><path d="M20 14.2A8 8 0 0 1 9.8 4a8 8 0 1 0 10.2 10.2z" /></Svg>,
  eclipse: () => <Svg><circle cx="12" cy="12" r="8" /><path d="M12 4a8 8 0 0 1 0 16 5.5 8 0 0 0 0-16z" fill="currentColor" stroke="none" opacity="0.8" /></Svg>,
  meteor: () => <Svg><path d="M20 4 6 14" /><path d="M20 4 9 18" opacity="0.55" /><path d="M20 4 4 10" opacity="0.55" /><circle cx="19" cy="5" r="1.4" fill="currentColor" stroke="none" /></Svg>,
  planet: () => <Svg><circle cx="12" cy="12" r="4.2" /><path d="M3.2 15.5c-.9-2 3.6-5.4 9.2-7.6s10.6-2.2 11.4-.2" transform="translate(-1.2 1.6)" /></Svg>,
  season: () => <Svg><circle cx="12" cy="14" r="4" /><path d="M12 4v2.5M4.5 7.5 6.3 9.3M19.5 7.5 17.7 9.3M3 20h18" /></Svg>,
  iss: () => <Svg><rect x="9.5" y="9.5" width="5" height="5" rx="1" /><path d="M2.5 10v4M6.5 10v4M17.5 10v4M21.5 10v4M6.5 12h3M14.5 12h3" /></Svg>,
  launch: () => <IconRocket className="cal-ico" width={24} height={24} />,
};
const VisIcon = ({ state }) => (
  <svg className="cal-vis__icon" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    {state === true
      ? (<><circle cx="8" cy="8" r="7" fill="currentColor" /><path d="m4.6 8.2 2.3 2.3 4.5-4.8" fill="none" stroke="#04080F" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></>)
      : state === "partial"
        ? (<><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M8 1.8a6.2 6.2 0 0 0 0 12.4z" fill="currentColor" /></>)
        : (<><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="m5.4 5.4 5.2 5.2M10.6 5.4l-5.2 5.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></>)}
  </svg>
);

// ─── Formato ─────────────────────────────────────────────────────────────────
function makeFmt(lang) {
  const l = loc(lang), nl = lang === "es" ? "es" : "en-US";
  const time = new Intl.DateTimeFormat(l, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return {
    time: ms => time.format(new Date(ms)),
    n: (x, dec = 0) => Number(x).toLocaleString(nl, { maximumFractionDigits: dec, minimumFractionDigits: dec }),
    pct: x => `${Math.round(x * 100)} %`,
    mag: lang === "es" ? "magnitud" : "magnitude",
  };
}
function whenText(ev, lang) {
  const d = new Date(ev.t), l = loc(lang);
  if (ev.allDay) {
    const base = d.toLocaleDateString(l, { weekday: "short", day: "numeric", month: "short", year: d.getUTCFullYear() !== new Date().getFullYear() ? "numeric" : undefined, timeZone: "UTC" });
    return base;
  }
  return d.toLocaleString(l, { weekday: "short", day: "numeric", month: "short", year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined, hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZoneName: "short" });
}
const monthLabel = (key, lang) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString(loc(lang), { month: "long", year: "numeric", timeZone: "UTC" });
};
const isoOf = ev => (ev.allDay ? new Date(ev.t).toISOString().slice(0, 10) : new Date(ev.t).toISOString());

// ─── Un evento ───────────────────────────────────────────────────────────────
function EventItem({ ev, lang, fmt, t }) {
  const info = useMemo(() => describeEvent(ev, lang, fmt), [ev, lang, fmt]);
  const vis = info.vis;
  const visLabel = vis ? (vis.state === true ? t.visYes : vis.state === "partial" ? t.visPartial : t.visNo) : null;
  const onIcs = () => {
    track("now_item", { card: "calendar", kind: "ics" });
    downloadIcs({
      uid: `${ev.id}@teseo.yachaydeep.com`, start: ev.t, allDay: !!ev.allDay, durationMin: ev.durationMin,
      title: info.title, description: info.icsDesc, url: info.links[0] && info.links[0].href,
    });
  };
  const extra = info.region || info.desc;
  return (
    <li className={`cal-ev cal-ev--${ev.type}${vis && vis.state === false ? " is-off" : ""}`}>
      <span className="cal-ev__icon" aria-hidden="true">{ICONS[ev.type] ? ICONS[ev.type]() : null}</span>
      <div className="cal-ev__body">
        <p className="cal-ev__when"><time dateTime={isoOf(ev)}>{whenText(ev, lang)}</time>{ev.approx && !ev.allDay ? null : null}</p>
        <h5 className="cal-ev__title">{info.title}</h5>
        {info.reasons && info.reasons.length > 0 && (
          <ul className="cal-tags">{info.reasons.map(r => <li key={r} className="cal-tag">{r}</li>)}</ul>
        )}
        {vis && (
          <p className={`cal-vis cal-vis--${vis.state === true ? "yes" : vis.state === "partial" ? "partial" : "no"}`}>
            <VisIcon state={vis.state} /><span><strong>{visLabel}.</strong> {vis.text}</span>
          </p>
        )}
        <p className="cal-ev__what">{info.what}</p>
        {info.note && <p className="cal-ev__note">{info.note}</p>}
        {extra && (
          <details className="now-desc cal-more">
            <summary><span>{info.region ? (lang === "es" ? "Región de visibilidad (NASA)" : "Visibility region (NASA)") : t.description}</span></summary>
            <p lang="en">{info.region || info.desc}</p>
          </details>
        )}
        <div className="cal-ev__actions">
          <button type="button" className="btn btn--ghost cal-btn" onClick={onIcs} aria-label={t.addCalFor(info.title)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4M12 13v4M10 15h4" /></svg>
            {t.addCal}
          </button>
          {info.sky && (
            <a className="btn btn--ghost cal-btn" href={info.sky} aria-label={t.seeSkyFor(info.title)} title={t.seeSkyNote}
              onClick={() => track("now_item", { card: "calendar", kind: "sky" })}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M12 3.5l1.6 4.6 4.9.3-3.8 3 1.3 4.7-4-2.7-4 2.7 1.3-4.7-3.8-3 4.9-.3z" /></svg>
              {t.seeSky}
            </a>
          )}
          {info.links.map(k => (
            <a key={k.href} className="now-link cal-link" href={k.href} target="_blank" rel="noopener noreferrer">{k.label}<span className="now-sr"> ({t.opensNew})</span></a>
          ))}
        </div>
      </div>
    </li>
  );
}

// ─── Datos ───────────────────────────────────────────────────────────────────
function usePlace() {
  const [place, setPlace] = useState(() => readPlace(typeof localStorage !== "undefined" ? localStorage : null));
  useEffect(() => {
    const refresh = () => setPlace(p => {
      const n = readPlace(localStorage);
      return n.lat === p.lat && n.lon === p.lon && n.name === p.name && n.kind === p.kind && n.isDefault === p.isDefault ? p : n;
    });
    // el lugar se cambia en la pestaña Cielo: se relee al volver aquí
    window.addEventListener("hashchange", refresh); window.addEventListener("storage", refresh); window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.removeEventListener("hashchange", refresh); window.removeEventListener("storage", refresh); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, []);
  return place;
}

/** Fetch tolerante: nunca muestra error; devuelve el dato o el valor de reserva. */
function useQuiet(load, deps, fallback) {
  const [v, setV] = useState(fallback);
  useEffect(() => {
    const ctrl = new AbortController(); let alive = true;
    load(ctrl.signal).then(d => { if (alive) setV(d); }).catch(e => { if (alive && !isAbort(e)) setV(fallback); });
    return () => { alive = false; ctrl.abort(); };
  }, deps);   // eslint-disable-line react-hooks/exhaustive-deps
  return v;
}

export default function Calendar({ lang = "es", api = "" }) {
  const t = TC[lang] || TC.es;
  const hid = useId(), listId = useId();
  const fmt = useMemo(() => makeFmt(lang), [lang]);
  const place = usePlace();
  const [from] = useState(() => Math.floor(Date.now() / 60000) * 60000);
  const [more, setMore] = useState(false);
  const [filter, setFilter] = useState("all");
  const days = more ? 365 : 90;

  // vista de la tarjeta (anónima, una vez por pestaña)
  const boxRef = useRef(null);
  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { trackOnce("now_card:calendar", "now_card_view", { card: "calendar" }); io.disconnect(); } }, { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const showers = useQuiet(async (signal) => { const d = await fetchJson("/meteorshowers.json", { signal }); return Array.isArray(d && d.objects) ? d.objects : []; }, [], []);
  const launches = useQuiet(async (signal) => { const d = await fetchJson(`${api}/api/launches?limit=20`, { signal }); return Array.isArray(d && d.launches) ? d.launches : []; }, [api], []);
  const issPasses = useQuiet((signal) => loadIssPasses({ api, lat: place.lat, lon: place.lon, elev: place.elev, signal }), [api, place.lat, place.lon, place.elev], []);

  // lo calculado (pesado) se hace tras pintar la tarjeta, para no bloquear la página
  const [calc, setCalc] = useState({ key: "", list: [] });
  const calcKey = `${place.lat}|${place.lon}|${days}|${showers.length}`;
  useEffect(() => {
    let alive = true;
    const id = setTimeout(() => {
      if (!alive) return;
      let list = [];
      try { list = buildSkyEvents({ from, days, lat: place.lat, lon: place.lon, showers }); } catch { list = []; }
      setCalc({ key: calcKey, list });
    }, 30);
    return () => { alive = false; clearTimeout(id); };
  }, [calcKey, from]);   // eslint-disable-line react-hooks/exhaustive-deps
  const ready = calc.key === calcKey;

  const events = useMemo(() => {
    let feed = [];
    try { feed = buildFeedEvents({ from, days, launches, issPasses }); } catch { feed = []; }
    return sortEvents([...calc.list, ...feed]);
  }, [calc.list, from, days, launches, issPasses]);

  const shown = useMemo(() => (filter === "all" ? events : events.filter(e => e.type === filter)), [events, filter]);
  const groups = useMemo(() => groupByMonth(shown), [shown]);
  const present = useMemo(() => new Set(events.map(e => e.type)), [events]);

  const placeName = place.name || (place.kind === "me" ? t.placeMe : t.placeCustom(fmt.n(place.lat, 2), fmt.n(place.lon, 2)));
  const pick = (k) => { if (k !== filter) track("now_item", { card: "calendar", kind: "filter" }); setFilter(k); };

  return (
    <section ref={boxRef} className="now-card now-card--cal" aria-labelledby={hid} aria-busy={!ready}>
      <header className="now-card__head">
        <h3 id={hid} className="now-card__title">{t.title}</h3>
        <span className="now-cert now-cert--estimated">
          <svg className="now-cert__icon" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M8 1.8a6.2 6.2 0 0 0 0 12.4z" fill="currentColor" /></svg>
          <span><strong>{t.cert}</strong><span className="now-cert__note">: {t.sub}</span></span>
        </span>
        <p className="cal-place">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.4" /></svg>
          <span><strong>{t.forPlace(placeName)}</strong> · <a className="now-link" href="#sky">{t.changeInSky}</a></span>
        </p>
      </header>

      <div className="cal-filters" role="group" aria-label={t.filters}>
        <button type="button" className="cal-chip" aria-pressed={filter === "all"} onClick={() => pick("all")}>{t.all}</button>
        {TYPES.filter(k => k !== "season" || present.has("season")).map(k => (
          <button key={k} type="button" className="cal-chip" aria-pressed={filter === k} onClick={() => pick(k)}>
            <span className="cal-chip__ico" aria-hidden="true">{ICONS[k]()}</span>{t.types[k]}
          </button>
        ))}
      </div>

      <p className="cal-count" role="status" aria-live="polite">
        {ready ? <>{more ? t.range365 : t.range90} · {t.count(shown.length)}</> : t.computing}
      </p>

      {!ready && <div className="now-state" aria-hidden="true"><span className="now-skel" /><span className="now-skel now-skel--short" /></div>}
      {ready && shown.length === 0 && <div className="now-empty"><p className="now-empty__title">{t.empty}</p></div>}
      <div id={listId}>
        {ready && groups.map(g => (
          <div key={g.key} className="cal-month">
            <h4 className="now-sub cal-month__h">{monthLabel(g.key, lang)}</h4>
            <ol className="cal-list">{g.items.map(ev => <EventItem key={ev.id} ev={ev} lang={lang} fmt={fmt} t={t} />)}</ol>
          </div>
        ))}
      </div>

      <button type="button" className="btn btn--ghost now-more" aria-expanded={more} aria-controls={listId}
        onClick={() => { if (!more) track("now_item", { card: "calendar", kind: "show_all" }); setMore(m => !m); }}>
        {more ? t.showLess : t.showMore}
      </button>

      <p className="now-fine">{t.localTime} {t.placeNote}</p>
      {(filter === "all" || filter === "iss") && <p className="now-fine">{t.issNote}</p>}
      {(filter === "all" || filter === "launch") && <p className="now-fine">{t.launchNote}</p>}
      <footer className="now-card__foot"><p className="now-src"><strong>{t.sources}:</strong> {t.srcText}</p></footer>
    </section>
  );
}
