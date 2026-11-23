// WxCard.jsx — la tarjeta que se abre al tocar la pastilla del tiempo («13 °C · 1 km/h») sobre el cielo.
// Arriba, el interruptor de las nubes y el estado del cielo; luego sensación y viento, la nubosidad total y por
// capas, la de las próximas 12 horas (con la mejor ventana para observar de noche; tocar una hora lleva el cielo a
// esa hora), lluvia, humedad, UV y visibilidad. Temperatura y viento no se repiten: ya están en la pastilla.
//
// Props:
//   lang · now: el tiempo de ahora (parseNow de nowWeather.js, con fetchedAt) · fc: { status, data } del pronóstico
//   sat: las nubes del satélite (satClouds.js) o null: si su barrido es reciente, la nubosidad de ahora es la suya
//   cloudsOn, canDraw (las nubes se dibujan con la Atmósfera), onToggleClouds
//   isNight(s) → bool · tz: zona horaria del lugar (para las horas) · skyT: hora del cielo (s) · skyIsNow: el cielo va en «ahora»
//   onPickHour(s): llevar el cielo a esa hora · anchorRef: la pastilla · stageRef: el contenedor · onClose()
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Icon from "./icons.jsx";
import { WX } from "./i18n-wx.js";
import { cloudsAt, hourlySeries, bestWindow, coverClass } from "./weather.js";
import { satWeight, mergeClouds, fuseSat } from "./satClouds.js";
import { wxKind, WX_NAMES, compass8, fmtWind, hourAt } from "./nowWeather.js";
import "./weather.css";

const pct = (f) => `${Math.round(f * 100)} %`;
const fmtT = (t) => `${Math.round(t) === 0 ? 0 : Math.round(t)}`.replace("-", "−") + " °C";

export function WxCard({ lang = "es", now, fc, sat, cloudsOn, canDraw, onToggleClouds, isNight, tz, skyT, skyIsNow, onPickHour, onNow, anchorRef, stageRef, onClose }) {
  const tw = (WX[lang] || WX.es).card;
  const cardRef = useRef(null);
  const [pos, setPos] = useState(null);
  const [nowS, setNowS] = useState(() => Date.now() / 1000);
  useEffect(() => { const id = setInterval(() => setNowS(Date.now() / 1000), 60000); return () => clearInterval(id); }, []);

  // debajo de la pastilla, con el borde derecho alineado a ella y sin salirse de la pantalla
  useLayoutEffect(() => {
    const place = () => {
      const a = anchorRef && anchorRef.current, st = stageRef && stageRef.current;
      if (!a || !st) return;
      const ra = a.getBoundingClientRect(), rs = st.getBoundingClientRect();
      const w = Math.min(360, rs.width - 24);
      const right = Math.max(12, Math.min(rs.right - ra.right, rs.width - w - 12));
      const top = ra.bottom - rs.top + 8;
      setPos({ top, right, w, maxH: Math.max(200, rs.height - top - 12) });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [anchorRef, stageRef]);

  // se cierra con Escape o tocando fuera (la pastilla abre y cierra por su cuenta)
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

  const data = fc && fc.status === "ok" ? fc.data : null;
  // ahora: el satélite si su barrido es reciente (dónde están de verdad las nubes); si no, el pronóstico
  const satW = satWeight(sat, nowS);
  const c = useMemo(() => { const f = data ? cloudsAt(data, nowS) : null; return satW > 0 ? mergeClouds(f, fuseSat(sat, f), 1) : f; }, [data, nowS, sat, satW]);
  const series = useMemo(() => (data ? hourlySeries(data, nowS, 12) : null), [data, nowS]);
  const win = useMemo(() => (series ? bestWindow(series, isNight) : null), [series, isNight]);
  const anyNight = !!(series && isNight && series.some((p) => isNight(p.t)));
  const hh = (s) => new Date(s * 1000).toLocaleTimeString(lang === "es" ? "es-EC" : "en-US", { hour: "numeric", minute: "2-digit", hourCycle: "h23", ...(tz ? { timeZone: tz } : {}) });
  // con el cielo en «ahora» no hay hora elegida: se ve la invitación a tocar una
  const selIdx = series && !skyIsNow && Number.isFinite(skyT) ? series.findIndex((p) => skyT >= p.t && skyT < p.t + 3600) : -1;
  const sel = selIdx >= 0 ? series[selIdx] : null;
  const selC = sel && data ? cloudsAt(data, sel.t) : null;

  if (!now) return null;
  // con otra hora en el cielo, la tarjeta entera pasa a esa hora (pronóstico del lugar); si no, ahora
  const hr = !skyIsNow && Number.isFinite(skyT) ? hourAt(now.hours, skyT) : null;
  const v = hr || now;
  const cc = hr ? (data ? cloudsAt(data, hr.t) : null) : c;
  const k = wxKind(v.code, v.day);
  // con el satélite reciente, cuántas nubes hay lo dice él (octas de la OMM); lluvia, niebla, nieve o tormenta, el código
  const name = !hr && satW > 0 && cc && ["sun", "moon", "partly", "cloud"].includes(k) ? (WX[lang] || WX.es).cover[coverClass(cc.total)] : (WX_NAMES[lang] || WX_NAMES.es)[k];
  const windTxt = v.windKmh == null ? "—" : v.windKmh < 1 || v.windFrom == null ? tw.calm : `${fmtWind(v.windKmh)} ${compass8(v.windFrom, lang)}`;
  const total = cc ? cc.total : v.cloud != null ? v.cloud / 100 : null;
  const dec = (x) => (lang === "es" ? String(x).replace(".", ",") : String(x));
  const vis = v.visKm == null ? "—" : v.visKm >= 10 ? `${Math.round(v.visKm)} km` : `${dec(Math.round(v.visKm * 10) / 10)} km`;
  const ago = now.fetchedAt ? tw.ago((Date.now() - now.fetchedAt) / 60000) : null;

  return (
    <div ref={cardRef} className="sk-wxc" role="dialog" aria-label={tw.aria}
      style={pos ? { top: pos.top, right: pos.right, width: pos.w, maxHeight: pos.maxH } : { visibility: "hidden" }}>
      <div className="sk-wxc-head">
        <button type="button" role="switch" aria-checked={!!cloudsOn && canDraw} disabled={!canDraw} className="sk-wxc-switch" onClick={onToggleClouds}
          title={canDraw ? undefined : tw.cloudsOff}>
          <i className="sk-switch" /><span>{tw.clouds}</span>
        </button>
        <b className="sk-wxc-state">{name}</b>
      </div>
      {hr && (
        <div className="sk-wxc-at">
          <span><Icon name="clock" size={14} />{tw.atHead(hh(hr.t))}</span>
          <button type="button" className="sk-wxc-now" onClick={onNow}>{tw.backNow}</button>
        </div>
      )}
      <p className="sk-wxc-src">{!hr && satW > 0 ? tw.srcSat(sat.sat, tw.ago((Date.now() / 1000 - sat.t) / 60)) : tw.srcFc}</p>

      <div className="sk-wxc-grid">
        <div className="sk-wxc-tile"><small><Icon name="thermo" size={14} />{tw.feels}</small><b>{v.feels != null ? fmtT(v.feels) : "—"}</b></div>
        <div className="sk-wxc-tile"><small><Icon name="wind" size={14} />{tw.wind}</small><b>{windTxt}</b></div>
      </div>

      <div className="sk-wxc-row"><small><Icon name="wx_cloud" size={14} />{tw.cover}</small><b>{total != null ? pct(total) : "—"}</b></div>
      {cc ? (
        <div className="sk-wxc-grid three">
          <div className="sk-wxc-tile"><small>{tw.high}</small><b>{cc.high != null ? pct(cc.high) : "—"}</b></div>
          <div className="sk-wxc-tile"><small>{tw.mid}</small><b>{cc.mid != null ? pct(cc.mid) : "—"}</b></div>
          <div className="sk-wxc-tile"><small>{tw.low}</small><b>{cc.low != null ? pct(cc.low) : "—"}</b></div>
        </div>
      ) : (
        <p className="sk-wxc-fine" role="status">{fc && fc.status === "error" ? "—" : tw.loading}</p>
      )}

      {series && (
        <div className="sk-wxc-next">
          <div className="sk-wxc-row">
            <small>{tw.next}</small>
            {win ? <em className="sk-wxc-best"><Icon name="sparkle" size={13} />{tw.best(hh(win.t0), hh(win.t1))}</em> : anyNight ? <em className="sk-wxc-nobest">{tw.noBest}</em> : null}
          </div>
          <div className="sk-wxc-bars">
            {series.map((p, i) => {
              const best = win && i >= win.i0 && i <= win.i1;
              return (
                <button key={p.t} type="button" disabled={p.total == null}
                  className={`sk-wxc-bar${best ? " is-best" : ""}${i === selIdx ? " is-on" : ""}${isNight && isNight(p.t) ? " is-night" : ""}`}
                  aria-label={tw.barAria(hh(p.t), p.total != null ? pct(p.total) : "—")} aria-pressed={i === selIdx}
                  onClick={() => onPickHour(p.t)}>
                  <i style={{ height: `${Math.max(4, (p.total || 0) * 100)}%` }} />
                </button>
              );
            })}
          </div>
          <div className="sk-wxc-ticks"><span>{hh(series[0].t)}</span><span>{hh(series[6].t)}</span><span>{hh(series[series.length - 1].t)}</span></div>
          <p className="sk-wxc-read" aria-live="polite">
            {sel && selC ? tw.at(hh(sel.t), pct(selC.total), selC.precip != null ? pct(selC.precip) : null) : <><Icon name="hand" size={13} />{tw.tap}</>}
          </p>
        </div>
      )}

      <div className="sk-wxc-grid">
        <div className="sk-wxc-tile"><small><Icon name="umbrella" size={14} />{tw.rain}</small><b>{v.pop != null ? `${Math.round(v.pop)} %` : "—"}</b></div>
        <div className="sk-wxc-tile"><small><Icon name="droplet" size={14} />{tw.rh}</small><b>{v.rh != null ? `${Math.round(v.rh)} %` : "—"}</b></div>
        <div className="sk-wxc-tile"><small><Icon name="sun" size={14} />{tw.uv}</small><b>{v.uv != null ? Math.round(v.uv) : "—"}{!v.day && <em>{tw.uvNight}</em>}</b></div>
        <div className="sk-wxc-tile"><small><Icon name="eye" size={14} />{tw.vis}</small><b>{vis}</b></div>
      </div>
      {hr ? <p className="sk-wxc-fine">{tw.sourceAt(hh(hr.t))}</p> : ago && <p className="sk-wxc-fine">{tw.source(ago)}</p>}
    </div>
  );
}
