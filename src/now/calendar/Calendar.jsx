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
import {
  detectPush, browserEnv, permission, loadPublicKey, localReminders, leadOptions, reminderTimes, canRemind,
  addReminder, removeReminder, sendTest, PUSH_EVENT, STORE_KEY,
} from "./push.js";
import "./calendar.css";

const DAY = 86400000;
const loc = lang => (lang === "es" ? "es-EC" : "en-US");

// ─── «Recordarme» (avisos push; ver push.js) ─────────────────────────────────
/**
 * Estado compartido por todos los eventos: clave VAPID del servidor (sin ella no se muestra nada), soporte del
 * navegador, permiso y qué eventos tienen recordatorio (localStorage). NO pide permiso: eso solo pasa al tocar
 * «Activar aviso» o «Probar notificación».
 */
function usePush(api) {
  const [key, setKey] = useState(null);
  const env = useMemo(() => { try { return detectPush(browserEnv()); } catch { return { state: "unsupported", reason: "no_api" }; } }, []);
  const [reminders, setReminders] = useState(() => { try { return localReminders(); } catch { return {}; } });
  const [perm, setPerm] = useState(() => permission());
  useEffect(() => {
    let alive = true;
    loadPublicKey(api).then(k => { if (alive) setKey(k); }).catch(() => { if (alive) setKey(null); });
    return () => { alive = false; };
  }, [api]);
  useEffect(() => {
    const refresh = () => { try { setReminders(localReminders()); } catch { /* no-op */ } setPerm(permission()); };
    const onStorage = (e) => { if (!e || !e.key || e.key === STORE_KEY) refresh(); };
    window.addEventListener(PUSH_EVENT, refresh); window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.removeEventListener(PUSH_EVENT, refresh); window.removeEventListener("storage", onStorage); document.removeEventListener("visibilitychange", refresh); };
  }, []);
  return useMemo(() => ({ key, available: !!key, env, reminders, perm, refreshPerm: () => setPerm(permission()) }), [key, env, reminders, perm]);
}

/** Por qué no se puede activar aquí (o null): "ios_install" | "unsupported" | "denied". */
const pushBlock = (push) => (push.env.state === "ios_install" ? "ios_install" : push.env.state !== "ok" ? "unsupported" : push.perm === "denied" ? "denied" : null);
const blockText = (block, push, P) => (block === "ios_install" ? P.iosInstall : block === "denied" ? P.denied : push.env.reason === "ios_old" ? P.iosOld : P.unsupported);
const FALLBACK_CODES = new Set(["denied", "dismissed", "subscribe_failed", "sw", "unsupported", "ios_install"]);
function pushErrorText(e, P) {
  const code = e && e.code;
  if (code === "denied") return P.denied;
  if (code === "dismissed") return P.dismissed;
  if (code === "subscribe_failed" || code === "sw") return P.subscribeFailed;
  if (code === "ios_install") return P.iosInstall;
  if (code === "unsupported") return P.unsupported;
  return P.err[code] || P.err.generic;
}
const fmtWhen = (ms, lang) => new Date(ms).toLocaleString(loc(lang), { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

const BellIcon = ({ off = false }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z" /><path d="M10 21h4" />
    {off ? <path d="M3.5 3.5l17 17" /> : null}
  </svg>
);
const CalIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4M12 13v4M10 15h4" /></svg>
);

/** Botón «Recordarme» / «Quitar recordatorio», su panel (explicación previa + antelación) y la línea de estado. */
function useReminder({ ev, title, lang, api, push, t, onIcs }) {
  const P = t.push;
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);           // { text, tone: "on" | "info" | "warn", ics? }
  const btnRef = useRef(null), panelRef = useRef(null);
  // el panel va después de la fila de botones: al abrirlo, el foco pasa a él; al cerrarlo, vuelve al botón
  useEffect(() => { if (open && panelRef.current) panelRef.current.focus(); }, [open]);
  const close = () => { setOpen(false); setTimeout(() => { if (btnRef.current) btnRef.current.focus(); }, 0); };
  const opts = leadOptions(ev);
  // antelaciones cuyo aviso aún no ha pasado; si ninguna, la primera (avisa enseguida)
  const natural = (l) => { const r = reminderTimes(ev, l); return !!r && r.eventAt - r.leadMin * 60000 > Date.now(); };
  const enabled = opts.filter(natural);
  const okOpts = enabled.length ? enabled : opts.slice(0, 1);
  const [lead, setLead] = useState(okOpts[0]);
  const choice = okOpts.includes(lead) ? lead : okOpts[0];

  if (!push || !push.available) return { button: null, panel: null };
  const active = !!push.reminders[ev.id];
  if (!active && !canRemind(ev)) return { button: null, panel: null };
  const block = pushBlock(push);

  const onButton = async () => {
    setMsg(null);
    if (active) {
      setBusy(true);
      try { await removeReminder({ api, eventId: ev.id }); track("push_remind", { kind: "off" }); setMsg({ text: P.removed, tone: "info" }); }
      catch (e) { setMsg({ text: pushErrorText(e, P), tone: "warn" }); }
      finally { setBusy(false); }
      return;
    }
    if (!open && block) track("push_remind", { kind: block });
    setOpen(o => !o);
  };
  const onActivate = async () => {
    setBusy(true); setMsg(null);
    try {
      const { notifyAt } = await addReminder({ api, publicKey: push.key, ev, title, lead: choice, lang });
      track("push_remind", { kind: "on" });
      close();
      setMsg({ text: P.on(fmtWhen(notifyAt, lang)), tone: "on" });
    } catch (e) {
      if (e && e.code === "denied") track("push_remind", { kind: "denied" });
      setMsg({ text: pushErrorText(e, P), tone: "warn", ics: !!(e && FALLBACK_CODES.has(e.code)) });
      if (e && FALLBACK_CODES.has(e.code)) close();
    } finally { setBusy(false); push.refreshPerm(); }
  };

  const button = (
    <button ref={btnRef} type="button" className={`btn btn--ghost cal-btn cal-remind-btn${active ? " is-on" : ""}`} onClick={onButton} disabled={busy}
      aria-expanded={active ? undefined : open} aria-controls={active ? undefined : panelId}
      aria-label={active ? P.removeFor(title) : P.remindFor(title)}>
      <BellIcon off={active} />{active ? P.remove : P.remind}
    </button>
  );
  const statusText = msg ? msg.text : active ? P.on(fmtWhen(push.reminders[ev.id], lang)) : "";
  const panel = (
    <>
      {open && !active && (
        <div id={panelId} ref={panelRef} tabIndex={-1} className="cal-remind" role="group" aria-labelledby={`${panelId}-h`}>
          <p id={`${panelId}-h`} className="cal-remind__h"><BellIcon />{P.panelTitle}</p>
          {block ? (
            <>
              <p className="cal-remind__p cal-remind__p--warn">{blockText(block, push, P)}</p>
              <p className="cal-remind__p">{P.fallback}</p>
              <div className="cal-remind__actions">
                <button type="button" className="btn btn--primary cal-btn" onClick={onIcs}><CalIcon />{t.addCal}</button>
                <button type="button" className="btn btn--ghost cal-btn" onClick={close}>{P.close}</button>
              </div>
            </>
          ) : (
            <>
              {push.perm !== "granted" && <p className="cal-remind__p">{P.explain}</p>}
              {opts.length > 1 ? (
                <fieldset className="cal-remind__leads">
                  <legend>{P.when}</legend>
                  {opts.map(l => (
                    <label key={l} className={`cal-remind__lead${okOpts.includes(l) ? "" : " is-off"}`}>
                      <input type="radio" name={`${panelId}-lead`} value={l} checked={choice === l} disabled={!okOpts.includes(l) || busy} onChange={() => setLead(l)} />
                      <span>{P.lead[l]}</span>
                    </label>
                  ))}
                </fieldset>
              ) : <p className="cal-remind__p">{P.eveOnly}</p>}
              <p className="cal-remind__fine">{P.privacy}</p>
              <div className="cal-remind__actions">
                <button type="button" className="btn btn--primary cal-btn" onClick={onActivate} disabled={busy} aria-busy={busy}><BellIcon />{busy ? P.working : P.activate}</button>
                <button type="button" className="btn btn--ghost cal-btn" onClick={close} disabled={busy}>{P.cancel}</button>
              </div>
            </>
          )}
        </div>
      )}
      <p className={`cal-remind__status${(msg ? msg.tone === "on" : active) ? " is-on" : msg && msg.tone === "warn" ? " is-warn" : ""}`} role="status" aria-live="polite">
        {statusText && <><BellIcon off={!!msg && msg.tone !== "on"} />{statusText}</>}
      </p>
      {msg && msg.ics && (
        <div className="cal-remind__actions cal-remind__actions--fallback">
          <span className="cal-remind__p">{P.fallback}</span>
          <button type="button" className="btn btn--ghost cal-btn" onClick={onIcs}><CalIcon />{t.addCal}</button>
        </div>
      )}
    </>
  );
  return { button, panel };
}

/** Enlace pequeño «Probar notificación» de la cabecera. El servidor no guarda nada de la prueba. */
function PushTest({ api, lang, t, push }) {
  const P = t.push;
  const id = useId();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);            // { text, tone }
  const linkRef = useRef(null);
  const cancel = () => { setConfirm(false); setTimeout(() => { if (linkRef.current) linkRef.current.focus(); }, 0); };
  if (!push.available) return null;
  const block = pushBlock(push);
  const run = async () => {
    setBusy(true); setMsg(null);
    try { await sendTest({ api, publicKey: push.key, lang }); track("push_remind", { kind: "test" }); setConfirm(false); setMsg({ text: P.testSent, tone: "on" }); }
    catch (e) { if (e && e.code === "denied") track("push_remind", { kind: "denied" }); setConfirm(false); setMsg({ text: pushErrorText(e, P), tone: "warn" }); }
    finally { setBusy(false); push.refreshPerm(); }
  };
  const onClick = () => {
    setMsg(null);
    if (block) { track("push_remind", { kind: block }); setMsg({ text: `${blockText(block, push, P)} ${P.fallback}`, tone: "warn" }); return; }
    if (push.perm !== "granted") { setConfirm(c => !c); return; }
    run();
  };
  const needsConfirm = !block && push.perm !== "granted";
  return (
    <div className="cal-test">
      <button ref={linkRef} type="button" className="cal-test__link" onClick={onClick} disabled={busy}
        aria-expanded={needsConfirm ? confirm : undefined} aria-controls={needsConfirm ? id : undefined}>
        <BellIcon />{busy ? P.working : P.test}
      </button>
      {confirm && needsConfirm && (
        <div id={id} className="cal-remind cal-remind--test">
          <p className="cal-remind__p">{P.testExplain}</p>
          <div className="cal-remind__actions">
            <button type="button" className="btn btn--primary cal-btn" onClick={run} disabled={busy}><BellIcon />{P.testGo}</button>
            <button type="button" className="btn btn--ghost cal-btn" onClick={cancel} disabled={busy}>{P.cancel}</button>
          </div>
        </div>
      )}
      <p className={`cal-remind__status${msg ? ` is-${msg.tone}` : ""}`} role="status" aria-live="polite">{msg && <><BellIcon off={msg.tone === "warn"} />{msg.text}</>}</p>
    </div>
  );
}

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
function EventItem({ ev, lang, fmt, t, api, push }) {
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
  const remind = useReminder({ ev, title: info.title, lang, api, push, t, onIcs });
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
          {remind.button}
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
        {remind.panel}
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
  const push = usePush(api);
  const [from] = useState(() => Math.floor(Date.now() / 60000) * 60000);
  const [more, setMore] = useState(false);
  const [filter, setFilter] = useState("all");
  const days = more ? 365 : 30;

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
  // Primero solo los más próximos (la lista completa mide miles de píxeles en el teléfono)
  const STEP = 8;
  const [limit, setLimit] = useState(STEP);
  useEffect(() => { setLimit(STEP); }, [filter, more]);
  const visible = useMemo(() => shown.slice(0, limit), [shown, limit]);
  const groups = useMemo(() => groupByMonth(visible), [visible]);
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
        <PushTest api={api} lang={lang} t={t} push={push} />
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
        {ready ? <>{more ? t.range365 : t.range30} · {t.count(shown.length)}</> : t.computing}
      </p>

      {!ready && <div className="now-state" aria-hidden="true"><span className="now-skel" /><span className="now-skel now-skel--short" /></div>}
      {ready && shown.length === 0 && <div className="now-empty"><p className="now-empty__title">{t.empty}</p></div>}
      <div id={listId}>
        {ready && groups.map(g => (
          <div key={g.key} className="cal-month">
            <h4 className="now-sub cal-month__h">{monthLabel(g.key, lang)}</h4>
            <ol className="cal-list">{g.items.map(ev => <EventItem key={ev.id} ev={ev} lang={lang} fmt={fmt} t={t} api={api} push={push} />)}</ol>
          </div>
        ))}
      </div>

      {ready && shown.length > limit && (
        <button type="button" className="btn btn--ghost now-more cal-next" aria-controls={listId}
          onClick={() => setLimit(l => l + 10)}>
          {t.moreEvents(Math.min(10, shown.length - limit), shown.length - limit)}
        </button>
      )}
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
