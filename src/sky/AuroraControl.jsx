// AuroraControl.jsx — «Auroras» en el panel de capas de la vista Cielo: el interruptor de la capa (auroraLayer.js),
// qué pasa ahora sobre el lugar (o a la hora del cielo) con su fuente, y el planificador de las mejores noches
// (auroraPlan.js). El estado y los datos de NOAA viven en Constellations.jsx; aquí se presentan.
//
// Props:
//   lang, available (hay lugar en Mi cielo), on, onToggle
//   info  { status: "idle"|"loading"|"ok"|"error", mode: "live"|"kp"|"typical", here, look, kp, kpKind, nearest,
//           vis, observed } · onRetry
//   lat, lon, when (Date: hora del cielo), dp (aurora.dipole), kpSeries · onPickNight(Date): lleva el cielo a esa hora
import { useEffect, useMemo, useState } from "react";
import Icon from "./icons.jsx";
import { AU } from "./i18n-aurora.js";
import { compassName, activityKey } from "./aurora.js";
import { planNights, scoreLevel } from "./auroraPlan.js";
import { ephemeris } from "../ephemeris.js";
import "./aurora.css";
import { altAz } from "./guide.js";

// horas y fechas en la zona horaria del lugar (tz), como el resto del Cielo
const tzOpt = (tz) => { if (!tz) return {}; try { new Intl.DateTimeFormat("en", { timeZone: tz }); return { timeZone: tz }; } catch { return {}; } };
const hhmm = (d, lang, tz) => d.toLocaleTimeString(lang === "es" ? "es-EC" : "en-US", { hour: "2-digit", minute: "2-digit", hour12: false, ...tzOpt(tz) });
const dayName = (d, lang, tz) => d.toLocaleDateString(lang === "es" ? "es-EC" : "en-US", { weekday: "short", day: "numeric", month: "short", ...tzOpt(tz) });

// nubes horarias de Open-Meteo para el planificador (16 días; desde el navegador, como el resto del tiempo)
async function fetchCloudHours(lat, lon, signal) {
  const q = new URLSearchParams({ latitude: lat.toFixed(1), longitude: lon.toFixed(1), hourly: "cloud_cover", forecast_days: "16", timezone: "GMT", timeformat: "unixtime" });
  const r = await fetch(`https://api.open-meteo.com/v1/forecast?${q}`, { signal });
  if (!r.ok) throw new Error(`Open-Meteo ${r.status}`);
  const j = await r.json();
  const t = j && j.hourly && j.hourly.time, c = j && j.hourly && j.hourly.cloud_cover;
  if (!Array.isArray(t) || !Array.isArray(c)) throw new Error("sin nubes");
  return { t, c };
}

export function AuroraControl({ lang = "es", available = true, on, onToggle, info, onRetry, lat, lon, when, dp, kpSeries, onPickNight, tz = null }) {
  const ta = AU[lang] || AU.es;
  const [planOpen, setPlanOpen] = useState(false);
  const [clouds, setClouds] = useState({ key: null, data: null, status: "idle" });
  const cKey = lat != null && lon != null ? `${lat.toFixed(1)},${lon.toFixed(1)}` : null;
  useEffect(() => {
    if (!planOpen || !cKey || clouds.key === cKey) return;
    const ac = new AbortController();
    setClouds({ key: cKey, data: null, status: "loading" });
    fetchCloudHours(lat, lon, ac.signal).then((data) => setClouds({ key: cKey, data, status: "ok" }), () => setClouds({ key: cKey, data: null, status: "error" }));
    return () => ac.abort();
  }, [planOpen, cKey]);   // eslint-disable-line react-hooks/exhaustive-deps

  const dayKey = when ? Math.floor(when.getTime() / 3600e3) : 0;
  const plan = useMemo(() => {
    if (!planOpen || lat == null || lon == null || !dp || !when) return null;
    const cd = clouds.key === cKey ? clouds.data : null;
    const cloud = cd ? (d) => {
      const s = d.getTime() / 1000;
      if (s < cd.t[0] || s > cd.t[cd.t.length - 1] + 3600) return null;
      const i = Math.min(cd.t.length - 1, Math.max(0, Math.round((s - cd.t[0]) / 3600)));
      return cd.c[i] == null ? null : cd.c[i] / 100;
    } : null;
    const bodyAt = (d, nm) => { const b = ephemeris(d).find((x) => x.name === nm); return b ? { ...altAz(b.nx, b.ny, b.nz, lat, lon, d), illum: b.illum } : null; };
    try {
      return planNights({ lat, lon, start: when, nights: 7, dp, kpSeries,
        sun: (d) => { const s = bodyAt(d, "Sol"); return s ? s.alt : -90; },
        moon: (d) => { const m = bodyAt(d, "Luna"); return m ? { alt: m.alt, illum: m.illum || 0 } : null; },
        cloud });
    } catch { return null; }
  }, [planOpen, lat, lon, dayKey, dp, kpSeries, clouds, cKey]);   // eslint-disable-line react-hooks/exhaustive-deps

  const st = info || { status: "idle" };
  const ok = st.status === "ok";
  const act = ok && st.kp != null ? activityKey(st.kp) : null;
  let line = null;
  if (ok) {
    if (st.vis < 0.05) line = ta.daylight;
    else if (st.look && st.look.visible && st.look.altMax < 4) line = ta.weak;
    else if (st.look && st.look.visible) line = st.look.overhead ? ta.overhead(compassName(st.look.az, lang)) : ta.look(compassName(st.look.az, lang), st.look.altMin, st.look.altMax);
    else if (st.nearest && st.mode === "live") line = ta.none(st.nearest.km, compassName(st.nearest.bearing, lang));
    else line = ta.noneFar;
  }

  return (
    <section className="sk-wx sk-au" aria-labelledby="sk-au-title">
      <h3 id="sk-au-title" className="sk-wx-title">{ta.title}</h3>
      <div className="sk-layer">
        <button type="button" role="switch" aria-checked={!!on && available} disabled={!available} className="sk-layer-main" onClick={onToggle}>
          <i className="sk-dot sk-au-dot" />
          <span className="sk-layer-txt"><b>{ta.layer}</b><small>{available ? ta.layerDesc : ta.needPlace}</small></span>
          <span className="sk-count">{on && available && ok && st.mode === "live" && st.here != null ? `${Math.round(st.here)} %` : ""}</span>
          <i className="sk-switch" />
        </button>
      </div>

      {available && on && (
        <div className="sk-wx-box">
          {(st.status === "loading" || st.status === "idle") && <p className="sk-atm-fine" role="status">{ta.loading}</p>}
          {st.status === "error" && (
            <p className="sk-atm-fine sk-wx-err" role="status">{ta.error}{" "}
              {onRetry && <button type="button" className="sk-wx-link" onClick={onRetry}><Icon name="retry" size={14} />{ta.retry}</button>}</p>
          )}
          {ok && (
            <>
              <div className="sk-wx-now">
                <span className={`sk-au-tag is-${st.mode}`}>{ta.tag[st.mode]}</span>
                {st.mode === "live" && st.here != null && <b>{ta.here(st.here)}</b>}
              </div>
              {line && <p className="sk-au-line">{line}</p>}
              {act && <p className="sk-atm-fine">{ta.kp(st.kp, ta.act[act])}</p>}
              <p className="sk-atm-fine">{st.mode === "live" ? ta.modeLive(st.observed ? hhmm(new Date(st.observed), lang, tz) : "—") : st.mode === "kp" ? ta.modeKp(st.kpKind) : ta.modeTypical}</p>
              <p className="sk-atm-fine">{ta.shapes}</p>
            </>
          )}
          <button type="button" className="sk-btn wide sk-wx-satbtn" aria-expanded={planOpen} onClick={() => setPlanOpen((v) => !v)}>
            <Icon name="moon" size={17} />{planOpen ? ta.planHide : ta.plan}
          </button>
          {planOpen && plan && (
            <div className="sk-au-plan">
              <p className="sk-atm-fine">{ta.planFrom(dayName(plan[0].day, lang, tz))}{clouds.status === "loading" ? ` · ${ta.planLoadingClouds}` : ""}</p>
              <ul className="sk-au-nights">
                {plan.map((n) => {
                  const lv = n.best ? scoreLevel(n.best.score) : 0;
                  const b = n.best;
                  return (
                    <li key={n.day.getTime()}>
                      <button type="button" className="sk-au-night" disabled={!b} onClick={() => b && onPickNight && onPickNight(b.t)}>
                        <span className="sk-au-nd">{dayName(n.day, lang, tz)}</span>
                        <span className="sk-au-bars" aria-label={ta.planLevel[lv]}>{[1, 2, 3, 4].map((k) => <i key={k} className={k <= lv ? "on" : ""} />)}</span>
                        <span className="sk-au-nk">{ta.planKind[n.kind]}</span>
                        <small>{!n.dark ? ta.planNoDark : !b ? ta.planNone
                          : lv === 0 ? (n.hours.some((h) => h.p >= 5 && h.cloud != null && h.cloud > 0.9) ? ta.planCloudy : ta.planNone)
                          : `${ta.planBest(hhmm(b.t, lang, tz))} · ${ta.planDetail(b.p, b.cloud, b.moonAlt > 0 ? ta.moonUp(b.moonIllum) : ta.moonDown)}`}</small>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="sk-atm-fine">{ta.planTap}</p>
              <p className="sk-atm-fine">{ta.planSources}</p>
            </div>
          )}
          <p className="sk-atm-fine">{ta.source}</p>
        </div>
      )}
    </section>
  );
}
