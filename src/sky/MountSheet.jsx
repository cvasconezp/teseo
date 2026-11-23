// MountSheet.jsx — la brújula junto a la pastilla del tiempo y «Estacionar montura» (los cálculos, en mountAlign.js).
//
//   CompassChip  aguja y rumbo de hacia dónde miras (el bucle del cielo lo actualiza por apiRef, sin re-render); con
//                «Apuntar al cielo», el estado de la brújula del celular. Al tocarla abre MountSheet.
//   MountSheet   tarjeta bajo la brújula: los métodos para hallar el norte verdadero ordenados para tu latitud y, en
//                cada uno, los pasos con las horas de hoy; al final, cómo colocar el trípode y cómo afinar.
//   FlatPhone    pantalla completa para el celular plano en el suelo: con un palillo y el Sol (las líneas quietas
//                en la pantalla: se gira el celular hasta que la sombra cae en su línea) o con la brújula (las
//                líneas giran para quedarse en su sitio).
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Icon from "./icons.jsx";
import { MT } from "./i18n-mount.js";
import { compassPoint8 } from "./deviceOrientation.js";
import {
  methodsFor, METHOD_ACC, accClass, poleStar, shadowPlan, noonShadow, groundShadow, groundLines, nextEquinox,
  equinoxToday, sunAltAz, compassStatus,
} from "./mountAlign.js";
import { loadPublicKey, addReminder } from "../now/calendar/push.js";
import "./mount.css";

const ROSE = { es: ["N", "NE", "E", "SE", "S", "SO", "O", "NO"], en: ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] };
const DAY = 86400000;

/** La brújula: aguja que apunta al norte verdadero y el rumbo de la vista. */
export function CompassChip({ lang = "es", apiRef, arOn = false, arSrc = null, open = false, onClick, chipRef }) {
  const T = MT[lang] || MT.es;
  const needle = useRef(null), dirEl = useRef(null), degEl = useRef(null), btn = useRef(null), last = useRef({ az: -999, st: "" });
  useEffect(() => {
    if (!apiRef) return undefined;
    apiRef.current = (az, info = {}) => {
      const a = Math.round(((az % 360) + 360) % 360);
      const st = info.ar ? compassStatus(arSrc, info.acc) : "view";
      if (Math.abs(a - last.current.az) < 1 && st === last.current.st) return;
      last.current = { az: a, st };
      if (needle.current) needle.current.style.transform = `rotate(${-a}deg)`;
      const k = compassPoint8(a);
      if (dirEl.current) dirEl.current.textContent = (ROSE[lang] || ROSE.es)[k];
      if (degEl.current) degEl.current.textContent = `${a === 360 ? 0 : a}°`;
      if (btn.current) {
        btn.current.dataset.state = st;
        btn.current.setAttribute("aria-label", T.chipAria(T.dirs[k], a) + (st !== "view" ? ` · ${T.chipStatus[st]}` : ""));
      }
    };
    return () => { apiRef.current = null; };
  }, [apiRef, lang, arSrc, T]);
  useEffect(() => { last.current = { az: -999, st: "" }; }, [arOn, arSrc]);
  return (
    <button ref={(el) => { btn.current = el; if (chipRef) chipRef.current = el; }} type="button" className="sk-chip sk-compass"
      data-state="view" aria-haspopup="dialog" aria-expanded={open} aria-label={T.chipAria(T.dirs[0], 0)} onClick={onClick}>
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" className="sk-compass-dial">
        <circle cx="12" cy="12" r="10.5" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1" />
        <g ref={needle} className="sk-compass-needle">
          <path d="M12 3.2 14.6 12H9.4Z" fill="#ff6b5e" />
          <path d="M12 20.8 14.6 12H9.4Z" fill="#e6e9f5" />
        </g>
        <circle cx="12" cy="12" r="1.3" fill="#141a33" />
      </svg>
      <span className="sk-compass-txt"><b ref={dirEl}>N</b><small ref={degEl}>0°</small></span>
      <i className="sk-compass-dot" aria-hidden="true" />
    </button>
  );
}

// ── utilidades ────────────────────────────────────────────────────────────────
const fmtTime = (ms, lang, tz) => new Date(ms).toLocaleTimeString(lang === "es" ? "es-EC" : "en-US", { hour: "numeric", minute: "2-digit", hourCycle: "h23", ...(tz ? { timeZone: tz } : {}) });
const fmtDate = (ms, lang, tz) => new Date(ms).toLocaleDateString(lang === "es" ? "es-EC" : "en-US", { day: "numeric", month: "long", year: "numeric", ...(tz ? { timeZone: tz } : {}) });
const fmtLen = (m, lang) => (m < 1 ? `${Math.round(m * 100)} cm` : `${Number(m).toLocaleString(lang === "es" ? "es" : "en-US", { maximumFractionDigits: 2 })} m`);

function Steps({ items }) {
  return <ol className="sk-mnt-steps">{items.map((s, i) => <li key={i}>{s}</li>)}</ol>;
}

/** Dibujo del suelo visto desde arriba: gnomon, círculo y marcas (círculo indio) o la recta del equinoccio. */
function ShadowDiagram({ mode, t1, t2, south, T }) {
  const N = south ? "S" : T.markN;
  return (
    <svg viewBox="0 0 300 200" className="sk-mnt-fig" role="img" aria-label={mode === "indian" ? T.tabIndian : T.tabEq}>
      <rect x="0" y="0" width="300" height="200" rx="12" fill="#232a1c" />
      <text x="150" y="16" textAnchor="middle" className="sk-mnt-figt">{N}</text>
      <line x1="150" y1="22" x2="150" y2="192" stroke="#fff" strokeWidth="2" />
      {mode === "indian" && <circle cx="150" cy="118" r="58" fill="none" stroke="#e6e9f5" strokeWidth="1.2" strokeDasharray="5 4" />}
      {mode === "indian" && <path d="M 92 108 Q 150 156 208 108" fill="none" stroke="#5a6390" strokeWidth="1" strokeDasharray="2 3" />}
      {mode === "eq" && [60, 90, 120, 180, 210, 240].map((x) => <circle key={x} cx={x} cy="86" r="3.5" fill="#E24B4A" />)}
      <line x1="40" y1={mode === "indian" ? 88 : 86} x2="260" y2={mode === "indian" ? 88 : 86} stroke="#EF9F27" strokeWidth="2.5" />
      {mode === "indian" && <><circle cx="100" cy="88" r="5" fill="#E24B4A" /><circle cx="200" cy="88" r="5" fill="#E24B4A" />
        <text x="100" y="76" textAnchor="middle" className="sk-mnt-figr">{t1}</text><text x="200" y="76" textAnchor="middle" className="sk-mnt-figr">{t2}</text></>}
      <circle cx="150" cy="118" r="4.5" fill="#fff" />
      <text x="28" y="104" className="sk-mnt-figa">{T.markW}</text><text x="266" y="104" className="sk-mnt-figa">{T.markE}</text>
    </svg>
  );
}

/** Reloj del polo: dónde está la estrella del polo (a simple vista). */
function PoleClock({ clock }) {
  const a = ((clock % 12) / 12) * 2 * Math.PI, x = 60 + 40 * Math.sin(a), y = 60 - 40 * Math.cos(a);
  return (
    <svg viewBox="0 0 120 120" className="sk-mnt-clock" role="img" aria-label={`${clock}`}>
      <circle cx="60" cy="60" r="52" fill="#0f1428" stroke="#3d4570" />
      {Array.from({ length: 12 }, (_, i) => { const b = (i / 12) * 2 * Math.PI; return <line key={i} x1={60 + 46 * Math.sin(b)} y1={60 - 46 * Math.cos(b)} x2={60 + 51 * Math.sin(b)} y2={60 - 51 * Math.cos(b)} stroke="#5a6390" strokeWidth={i % 3 ? 1 : 2} />; })}
      <circle cx="60" cy="60" r="40" fill="none" stroke="#3d4570" strokeDasharray="3 3" />
      <line x1="56" y1="60" x2="64" y2="60" stroke="#CECBF6" /><line x1="60" y1="56" x2="60" y2="64" stroke="#CECBF6" />
      <circle cx={x} cy={y} r="5" fill="#ffe9a8" />
    </svg>
  );
}

export function MountSheet({
  lang = "es", lat, lon, tz, marks = null, decl = null, arOn = false, onStartAr, onLook, onGround, anchorRef, stageRef, onClose, api = "",
}) {
  const T = MT[lang] || MT.es;
  const cardRef = useRef(null);
  const [pos, setPos] = useState(null);
  const [view, setView] = useState("home");
  const [now, setNow] = useState(() => Date.now());
  const [gnomon, setGnomon] = useState(1);
  const [tab, setTab] = useState(null);
  const [remind, setRemind] = useState(null);       // null | "busy" | { ok } | { err }
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(id); }, []);
  useEffect(() => { if (cardRef.current) cardRef.current.scrollTop = 0; }, [view]);

  useLayoutEffect(() => {
    const place = () => {
      const a = anchorRef && anchorRef.current, st = stageRef && stageRef.current;
      if (!a || !st) return;
      const ra = a.getBoundingClientRect(), rs = st.getBoundingClientRect();
      const w = Math.min(380, rs.width - 24);
      const right = Math.max(12, Math.min(rs.right - ra.right, rs.width - w - 12));
      const top = ra.bottom - rs.top + 8;
      setPos({ top, right, w, maxH: Math.max(220, rs.height - top - 12) });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [anchorRef, stageRef]);
  useEffect(() => {
    const key = (e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    const down = (e) => {
      const c = cardRef.current, a = anchorRef && anchorRef.current;
      if (c && !c.contains(e.target) && !(a && a.contains(e.target))) onClose();
    };
    document.addEventListener("keydown", key, true);
    document.addEventListener("pointerdown", down, true);
    return () => { document.removeEventListener("keydown", key, true); document.removeEventListener("pointerdown", down, true); };
  }, [onClose, anchorRef]);

  const south = lat < 0;
  const ps = useMemo(() => poleStar(lat, lon, now), [lat, lon, now]);
  const sunNow = useMemo(() => sunAltAz(lat, lon, now), [lat, lon, now]);
  const nm = marks && marks.north && marks.north.clear ? marks.north : null, sm = marks && marks.south && marks.south.clear ? marks.south : null;
  const methods = useMemo(() => methodsFor(lat, { hasLandmark: !!(nm || sm) }), [lat, nm, sm]);
  // la sombra: el plan de hoy y, si ya pasó la primera marca, el de mañana
  const plan = useMemo(() => {
    let p = shadowPlan(lat, lon, now, gnomon), day = "today";
    if (p && now > p.t1 - 5 * 60000) { p = shadowPlan(lat, lon, now + DAY, gnomon); day = "tomorrow"; }
    return p ? { ...p, day } : null;
  }, [lat, lon, now, gnomon]);
  const noon = useMemo(() => {
    let n = noonShadow(lat, lon, now), day = "today";
    if (now > n.noon + 2 * 60000) { n = noonShadow(lat, lon, now + DAY); day = "tomorrow"; }
    return { ...n, day };
  }, [lat, lon, now]);
  const gs = useMemo(() => groundShadow(lat, lon, now), [lat, lon, now]);
  const eqNext = useMemo(() => nextEquinox(now), [now]);
  const eqNow = equinoxToday(now);
  const mode = tab || (eqNow ? "eq" : "indian");
  const t = (ms) => fmtTime(ms, lang, tz);
  const unavailable = {
    landmark: !(nm || sm), shadow: !plan, ground: !gs.usable, polar: !!ps && sunNow.alt > -6,
  };
  const accTxt = (k) => (k === "compass" ? T.accCompass : T.acc(METHOD_ACC[k]));
  const declTxt = decl && decl.valid ? `${decl.decl >= 0 ? "+" : "−"}${Math.abs(decl.decl).toLocaleString(lang === "es" ? "es" : "en-US", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}°` : "—";

  const doRemind = async () => {
    if (!plan) return;
    setRemind("busy");
    try {
      const key = await loadPublicKey(api);
      if (!key) throw Object.assign(new Error("no key"), { code: "unsupported" });
      const dk = new Date(plan.t1).toISOString().slice(0, 10);
      for (const [i, tm] of [[1, plan.t1], [2, plan.t2]]) {
        await addReminder({ api, publicKey: key, ev: { id: `mount-shadow-${dk}-${i}`, t: tm, allDay: false },
          title: `${T.tabIndian} · ${T.markShadow(i, t(tm))}`, lead: "30", lang });
      }
      setRemind({ ok: true });
    } catch (e) {
      const c = e && e.code;
      setRemind({ err: c === "ios_install" || c === "denied" || c === "unsupported" ? c : "other" });
    }
  };

  const Back = () => (
    <button type="button" className="sk-mnt-back" onClick={() => setView("home")}><Icon name="prev" size={16} />{T.back}</button>
  );
  const ToTripod = () => <button type="button" className="sk-mnt-primary" onClick={() => setView("tripod")}>{T.toTripod}</button>;

  let body;
  if (view === "home") {
    body = (
      <>
        <p className="sk-mnt-axis">{T.axis(Math.abs(lat), south ? "south" : "north")}</p>
        <p className="sk-mnt-fine">{T.lines}</p>
        <p className="sk-mnt-pick">{T.pick}</p>
        <div className="sk-mnt-list">
          {methods.map(({ key, rec }) => {
            const m = T.methods[key], tt = typeof m.t === "function" ? m.t(south) : m.t, dd = typeof m.d === "function" ? m.d(south) : m.d;
            const off = unavailable[key];
            return (
              <button key={key} type="button" className={`sk-mnt-item${rec ? " is-rec" : ""}${off ? " is-off" : ""}`} onClick={() => setView(key)}>
                <span className="sk-mnt-itxt"><b>{tt}</b><small>{off ? T.unavailable[key] : dd}</small></span>
                <span className="sk-mnt-iside">
                  {rec && <em className="sk-mnt-rec">{T.rec}</em>}
                  <i className={`sk-mnt-acc acc-${key === "compass" ? "rough" : accClass(METHOD_ACC[key])}`}>{accTxt(key)}</i>
                </span>
              </button>
            );
          })}
        </div>
        <button type="button" className="sk-mnt-ghost" onClick={() => setView("tripod")}>{T.trHead}</button>
      </>
    );
  } else if (view === "polar") {
    body = (
      <>
        <Back /><h3>{T.polarHead(south)}</h3>
        {ps ? (
          <>
            <div className="sk-mnt-row"><PoleClock clock={ps.clock} />
              <div><p>{T.polarClock(ps.clock, ps.distDeg)}</p><p className="sk-mnt-fine">{T.polarView(south)}</p></div></div>
            <p>{T.polarAlt(ps.alt, ps.poleAlt)}</p>
            {south && <p className="sk-mnt-fine">{T.polarFaint}</p>}
            {sunNow.alt > -6 && <p className="sk-mnt-warn"><Icon name="sun" size={14} />{T.polarDay}</p>}
            <div className="sk-mnt-btns">
              <button type="button" className="sk-mnt-ghost" onClick={() => onLook && onLook(ps.poleAlt, south ? 180 : 0, 12)}><Icon name="target" size={15} />{T.seeSky}</button>
              <ToTripod />
            </div>
          </>
        ) : <p>{T.lmNone}</p>}
      </>
    );
  } else if (view === "landmark") {
    body = (
      <>
        <Back /><h3>{T.lmHead}</h3>
        {nm || sm ? (
          <>
            {nm && <p>{T.lmNorth(nm.name, nm.distKm, nm.alt)}</p>}
            {sm && <p>{T.lmSouth(sm.name, sm.distKm, sm.alt)}</p>}
            <p className="sk-mnt-fine">{T.lmHow}</p>
            <p className="sk-mnt-fine">{T.lmData}</p>
            <div className="sk-mnt-btns">
              <button type="button" className="sk-mnt-ghost" onClick={() => { const mk = nm || sm; if (onLook) onLook(mk.alt + 2, mk.az, 24); }}><Icon name="target" size={15} />{T.seeSky}</button>
              <ToTripod />
            </div>
          </>
        ) : <p>{T.lmNone}</p>}
      </>
    );
  } else if (view === "shadow") {
    const r = plan ? fmtLen(plan.radiusM, lang) : "";
    body = (
      <>
        <Back /><h3>{T.shHead}</h3>
        <div className="sk-mnt-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={mode === "eq"} onClick={() => setTab("eq")}>{T.tabEq}</button>
          <button type="button" role="tab" aria-selected={mode === "indian"} onClick={() => setTab("indian")}>{T.tabIndian}</button>
        </div>
        {mode === "eq" && <p className="sk-mnt-fine">{eqNow ? T.eqToday : eqNext ? T.eqNext(fmtDate(eqNext.t, lang, tz)) : ""}</p>}
        <div className="sk-mnt-gnomon"><small>{T.gnomon}</small>
          {[0.5, 1, 1.5].map((g) => <button key={g} type="button" aria-pressed={gnomon === g} onClick={() => setGnomon(g)}>{T.m(g)}</button>)}
        </div>
        {!plan ? <p>{T.noSun}</p> : (
          <>
            {plan.day === "tomorrow" && mode === "indian" && <p className="sk-mnt-warn"><Icon name="clock" size={14} />{T.tomorrow}</p>}
            <ShadowDiagram mode={mode} t1={t(plan.t1)} t2={t(plan.t2)} south={false} T={T} />
            <Steps items={mode === "eq" ? T.eqSteps(t(plan.t1), t(plan.t2)) : T.inSteps(r, t(plan.t1), t(plan.t2))} />
            {mode === "indian" && <p className="sk-mnt-fine">{T.shErr(plan.errDeg)}</p>}
            {mode === "indian" && (
              <div className="sk-mnt-remind">
                {remind && remind.ok ? <p className="sk-mnt-ok"><Icon name="check" size={14} />{T.reminded(t(plan.t1), t(plan.t2))}</p> : (
                  <button type="button" className="sk-mnt-ghost" disabled={remind === "busy"} onClick={doRemind}><Icon name="clock" size={15} />{T.remind}</button>
                )}
                {remind && remind.err && <p className="sk-mnt-warn">{T.remindErr[remind.err]}</p>}
              </div>
            )}
            <div className="sk-mnt-btns"><ToTripod /></div>
          </>
        )}
      </>
    );
  } else if (view === "noon") {
    body = (
      <>
        <Back /><h3>{T.noonHead}</h3>
        <p className="sk-mnt-big">{T.noonAt(t(noon.noon), noon.day)}</p>
        {noon.usable ? <p>{T.noonShadow(fmtLen(noon.lengthM, lang), noon.toward)}</p> : <p className="sk-mnt-warn">{T.noonZenith}</p>}
        <p className="sk-mnt-fine">{T.noonTip}</p>
        <div className="sk-mnt-btns"><ToTripod /></div>
      </>
    );
  } else if (view === "ground") {
    body = (
      <>
        <Back /><h3>{T.grHead}</h3>
        <h4>{T.grSun}</h4>
        <p className="sk-mnt-fine">{T.grSunHow}</p>
        {gs.usable ? <button type="button" className="sk-mnt-primary" onClick={() => onGround && onGround("sun")}>{T.grOpen}</button>
          : <p className="sk-mnt-warn">{T.grNoSun}</p>}
        <h4>{T.grCompass}</h4>
        <p className="sk-mnt-fine">{T.grCompassHow}</p>
        <button type="button" className="sk-mnt-ghost" onClick={() => onGround && onGround("compass")}>{T.grOpen}</button>
        <div className="sk-mnt-btns"><ToTripod /></div>
      </>
    );
  } else if (view === "compass") {
    body = (
      <>
        <Back /><h3>{T.cpHead}</h3>
        <p>{T.cpHow(declTxt)}</p>
        <Steps items={T.cpTips} />
        <div className="sk-mnt-btns">
          {!arOn && onStartAr && <button type="button" className="sk-mnt-ghost" onClick={onStartAr}><Icon name="point" size={15} />{T.cpStart}</button>}
          <ToTripod />
        </div>
      </>
    );
  } else {
    body = (
      <>
        <Back /><h3>{T.trHead}</h3>
        <svg viewBox="0 0 300 190" className="sk-mnt-fig" role="img" aria-label={T.trLegs(south)}>
          <rect x="0" y="0" width="300" height="190" rx="12" fill="#232a1c" />
          <line x1="30" y1="140" x2="270" y2="140" stroke="#EF9F27" strokeWidth="2.5" />
          <line x1="150" y1="14" x2="150" y2="182" stroke="#fff" strokeWidth="2" />
          <line x1="150" y1="108" x2="92" y2="140" stroke="#AFA9EC" strokeWidth="4" strokeLinecap="round" />
          <line x1="150" y1="108" x2="208" y2="140" stroke="#AFA9EC" strokeWidth="4" strokeLinecap="round" />
          <line x1="150" y1="108" x2="150" y2="42" stroke="#AFA9EC" strokeWidth="4" strokeLinecap="round" />
          <circle cx="150" cy="108" r="11" fill="#3C3489" stroke="#CECBF6" />
          <circle cx="92" cy="140" r="6" fill="#EF9F27" /><circle cx="208" cy="140" r="6" fill="#EF9F27" />
          <circle cx="150" cy="42" r="9" fill="#fff" /><text x="150" y="46" textAnchor="middle" className="sk-mnt-figk">N</text>
          <text x="150" y="26" textAnchor="middle" className="sk-mnt-figt">{south ? T.lineLabels.sn : T.lineLabels.ns}</text>
          <text x="26" y="158" className="sk-mnt-figa">{T.markW}</text><text x="266" y="158" className="sk-mnt-figa">{T.markE}</text>
        </svg>
        <p>{T.trLegs(south)}</p>
        <Steps items={T.trSteps(Math.abs(lat), south)} />
        <details className="sk-mnt-more"><summary>{T.trCheck}</summary><p className="sk-mnt-fine">{T.trDrift}</p></details>
      </>
    );
  }

  return (
    <div ref={cardRef} className="sk-wxc sk-mnt" role="dialog" aria-label={T.title}
      style={pos ? { top: pos.top, right: pos.right, width: pos.w, maxHeight: pos.maxH } : { visibility: "hidden" }}>
      <div className="sk-mnt-head">
        <div><b>{T.title}</b><small>{T.sub(lat)}</small></div>
        <button type="button" className="sk-mnt-x" aria-label={T.close} onClick={onClose}><Icon name="close" size={16} /></button>
      </div>
      {body}
      <p className="sk-mnt-src">{T.source}</p>
    </div>
  );
}

// ── el celular plano en el suelo ──────────────────────────────────────────────
/** Lee la brújula y la inclinación del celular (con permiso en iOS). heading: rumbo magnético del borde superior. */
function useFlatSensors(active) {
  const [s, setS] = useState({ heading: null, acc: null, beta: null, gamma: null, abs: false });
  useEffect(() => {
    if (!active) return undefined;
    const on = (e) => {
      let heading = null, abs = false;
      if (typeof e.webkitCompassHeading === "number" && e.webkitCompassHeading >= 0) { heading = e.webkitCompassHeading; abs = true; }
      else if ((e.type === "deviceorientationabsolute" || e.absolute) && Number.isFinite(e.alpha)) { heading = (360 - e.alpha) % 360; abs = true; }
      setS((p) => ({
        heading: heading != null ? heading : p.heading, abs: abs || p.abs,
        acc: typeof e.webkitCompassAccuracy === "number" ? e.webkitCompassAccuracy : p.acc,
        beta: Number.isFinite(e.beta) ? e.beta : p.beta, gamma: Number.isFinite(e.gamma) ? e.gamma : p.gamma,
      }));
    };
    window.addEventListener("deviceorientationabsolute", on);
    window.addEventListener("deviceorientation", on);
    return () => { window.removeEventListener("deviceorientationabsolute", on); window.removeEventListener("deviceorientation", on); };
  }, [active]);
  return s;
}

export function FlatPhone({ lang = "es", mode = "sun", lat, lon, tz, decl = 0, onClose }) {
  const T = MT[lang] || MT.es;
  const [now, setNow] = useState(() => Date.now());
  const [asked, setAsked] = useState(() => !(typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function"));
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(id); }, []);
  const sens = useFlatSensors(asked);
  const gs = groundShadow(lat, lon, now);
  const lines = groundLines(lat);
  const ask = async () => {
    try { if (DeviceOrientationEvent.requestPermission) await DeviceOrientationEvent.requestPermission(); } catch { /* sin permiso */ }
    setAsked(true);
  };
  // con el Sol: la pantalla está fija (arriba = norte verdadero cuando la sombra cae en su línea);
  // con la brújula: todo gira con el rumbo verdadero del celular
  const trueHeading = sens.heading != null ? (sens.heading + (decl || 0) + 360) % 360 : null;
  const rot = mode === "compass" ? (trueHeading != null ? -trueHeading : 0) : 0;
  const level = sens.beta == null ? "unknown" : Math.abs(sens.beta) < 3 && Math.abs(sens.gamma) < 3 ? "ok" : "tilt";
  const R = 180;
  const ray = (az, len = R) => [200 + len * Math.sin((az * Math.PI) / 180), 200 - len * Math.cos((az * Math.PI) / 180)];
  return (
    <div className="sk-flat" role="dialog" aria-label={T.grHead}>
      <div className="sk-flat-top">
        <b>{mode === "sun" ? T.grSun : T.grCompass}</b>
        <span className={`sk-flat-level lv-${level}`}>{T.flatLevel[level]}</span>
        <button type="button" className="sk-mnt-x" aria-label={T.close} onClick={onClose}><Icon name="close" size={18} /></button>
      </div>
      <svg viewBox="0 0 400 400" className="sk-flat-svg" role="img" aria-label={mode === "sun" ? T.flatTurn : T.flatCompassTip}>
        <g transform={`rotate(${rot} 200 200)`}>
          {lines.map((l) => {
            const [x, y] = ray(l.az);
            return <line key={l.key} x1="200" y1="200" x2={x} y2={y} stroke={l.kind === "ns" ? "#ffffff" : l.kind === "eq" ? "#EF9F27" : "#F0997B"}
              strokeWidth={l.kind === "ns" ? 4 : l.kind === "eq" ? 3 : 2} strokeDasharray={l.kind === "sol" ? "10 8" : undefined} />;
          })}
          {(() => { const [x, y] = ray(0, R + 8); return <text x={x} y={y} textAnchor="middle" className="sk-flat-n">{T.markN}</text>; })()}
          {mode === "sun" && gs.usable && (() => { const [x, y] = ray(gs.shadowAz, R - 10); return (
            <><line x1="200" y1="200" x2={x} y2={y} stroke="#ff8a3d" strokeWidth="7" strokeLinecap="round" opacity="0.9" />
              <text x={ray(gs.shadowAz, R - 40)[0]} y={ray(gs.shadowAz, R - 40)[1] - 10} textAnchor="middle" className="sk-flat-s">{T.flatShadow}</text></>
          ); })()}
        </g>
        <circle cx="200" cy="200" r="9" fill="#141a33" stroke="#fff" strokeWidth="2" />
        <circle cx="200" cy="200" r="2.5" fill="#fff" />
      </svg>
      <div className="sk-flat-bot">
        {mode === "sun" ? (
          gs.usable ? <><p><b>{T.flatSunTip}</b> · {T.flatTurn}</p><small>{T.flatUpdated(fmtTime(now, lang, tz))}</small></> : <p>{T.grNoSun}</p>
        ) : (
          trueHeading != null ? <p>{T.flatCompassTip}{sens.acc != null && sens.acc > 15 ? ` · ${T.chipStatus.calibrate}` : ""}</p> : <p>{asked ? T.flatNoCompass : ""}</p>
        )}
        {!asked && <button type="button" className="sk-mnt-primary" onClick={ask}>{T.flatSensors}</button>}
      </div>
    </div>
  );
}
