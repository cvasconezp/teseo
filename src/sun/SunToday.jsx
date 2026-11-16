// SunToday.jsx — «El Sol hoy». Un solo componente para dos sitios:
//   · la ficha del Sol en el Cielo (src/sky/ObjectSheet.jsx)      → <SunToday source="sheet" />
//   · la tarjeta de «Ahora en el espacio» (src/now/Now.jsx)       → <SunSummary /> + <SunContent />
// Datos: GET /api/sun/today (SILSO, NOAA SWPC, NASA SDO). Cada dato lleva su fuente enlazada y su hora;
// lo que no llega se dice (con su motivo) y no se rellena. Las frases las escribimos nosotros (i18n.js).
import { useEffect, useId, useState } from "react";
import { fetchJson, isAbort } from "../net.js";
import { trackOnce, trackNetError } from "../ui/track.js";
import { TS } from "./i18n.js";
import {
  API, SUN_PATH, LINKS, fmtEarths, flareInfo, flareLevel, flareSummary, kpInfo, parseLocation, splitRegions,
  maxFlareProb, cyclePeak, cycleGeometry, dateToYear, fmtUtc, fmtDay, fmtMonth, fmtNum, hasAnyData,
} from "./sun.js";
import "./sun.css";

// ─── Datos ───────────────────────────────────────────────────────────────────
// Caché de módulo de 5 min: abrir la ficha del Sol y la pestaña «Ahora» seguidas no repite la petición.
const SHARE_MS = 5 * 60 * 1000;
let shared = { url: null, at: 0, data: null };

export function useSunToday(api = API, enabled = true) {
  const url = `${api}${SUN_PATH}`;
  const [state, setState] = useState(() =>
    shared.url === url && Date.now() - shared.at < SHARE_MS ? { status: "ok", data: shared.data } : { status: "loading", data: null });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled) return undefined;
    if (attempt === 0 && shared.url === url && Date.now() - shared.at < SHARE_MS) { setState({ status: "ok", data: shared.data }); return undefined; }
    const ctrl = new AbortController();
    let alive = true;
    setState(s => (s.status === "loading" ? s : { status: "loading", data: null }));
    fetchJson(url, { signal: ctrl.signal })
      .then(d => {
        if (!alive) return;
        if (!hasAnyData(d)) { setState({ status: "empty", data: d && typeof d === "object" ? d : null }); return; }
        shared = { url, at: Date.now(), data: d };
        setState({ status: "ok", data: d });
      })
      .catch(e => {
        if (!alive || isAbort(e)) return;
        trackNetError("sun_today", e);
        setState({ status: /HTTP (404|501)\b/.test(String(e && e.message)) ? "missing" : "error", data: null });
      });
    return () => { alive = false; ctrl.abort(); };
  }, [url, attempt, enabled]);
  return [state, () => { shared = { url: null, at: 0, data: null }; setAttempt(n => n + 1); }];
}

// ─── Piezas ──────────────────────────────────────────────────────────────────
function Ext({ href, children, t, className = "sun-link" }) {
  return <a className={className} href={href} target="_blank" rel="noopener noreferrer">{children}<span className="sun-sr"> ({t.opensNew})</span></a>;
}

function Missing({ t, what, source, reason }) {
  return (
    <p className="sun-missing" role="status">
      <strong>{t.sectionMissing(source)}</strong> {what}
      {reason ? <small>{t.sectionMissingWhy}: {reason}</small> : null}
    </p>
  );
}

function Block({ title, children, className = "" }) {
  const id = useId();
  return (
    <section className={`sun-block ${className}`} aria-labelledby={id}>
      <h4 id={id} className="sun-h">{title}</h4>
      {children}
    </section>
  );
}

function SunImage({ image, t, lang }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { setFailed(false); setLoaded(false); }, [image && image.url]);
  if (!image || !image.url) return null;
  return (
    <figure className="sun-figure">
      <div className={`sun-img${loaded ? " is-loaded" : ""}`}>
        {failed ? (
          <p className="sun-img__fail">{t.imgFail}</p>
        ) : (
          <img src={image.url} alt={t.imgAlt} width="1024" height="1024" decoding="async" loading="lazy"
            onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />
        )}
      </div>
      <figcaption>
        <span>{t.imgCaption}</span>
        <span>{t.imgCredit(image.credit)} · {image.time ? t.imgTime(fmtUtc(image.time, lang)) : t.imgNoTime}</span>
        <Ext href={LINKS.sdo} t={t}>{t.imgOpen}</Ext>
      </figcaption>
    </figure>
  );
}

function Spots({ d, t, lang }) {
  const s = d.sunspot_number;
  const err = d.errors && d.errors.sunspot_number;
  const peak = d.cycle && cyclePeak(d.cycle.months);
  return (
    <Block title={t.spotsTitle} className="sun-block--spots">
      {!s ? <Missing t={t} source={t.spotsSource} reason={err} what="" /> : (
        <>
          <p className="sun-big">
            <span className="sun-big__n">{fmtNum(s.value, lang)}</span>
            <span className="sun-big__meta">
              <span>{t.spotsDay(fmtDay(s.date, lang))}</span>
              {Number.isFinite(s.stdev) ? <span>{t.spotsStdev(fmtNum(s.stdev, lang, 1))}</span> : null}
              {s.stations && s.stations.used != null && s.stations.available != null ? <span>{t.spotsStations(s.stations.used, s.stations.available)}</span> : null}
            </span>
          </p>
          <p>{t.spotsWhat}</p>
          <p>{t.spotsHow}</p>
          {peak ? <p>{t.spotsCompare(fmtNum(peak.ssn, lang), fmtMonth(peak.t, lang))}</p> : null}
          <p className="sun-small">{t.spotsProvisional}</p>
          <p className="sun-src"><Ext href={LINKS.silso} t={t}>{t.spotsSource}</Ext></p>
        </>
      )}
    </Block>
  );
}

function Regions({ d, t, lang }) {
  const err = d.errors && d.errors.regions;
  const sp = splitRegions(d.regions);
  const probs = maxFlareProb(d.regions);
  return (
    <Block title={t.regionsTitle}>
      {!sp ? <Missing t={t} source="NOAA SWPC" reason={err} what="" /> : (
        <>
          <p className="sun-small">{t.regionsDay(fmtDay(d.regions_date, lang))}</p>
          {sp.shown.length ? (
            <ul className="sun-regions">
              {sp.shown.map(r => {
                const loc = parseLocation(r.location);
                const earths = fmtEarths(r.area, lang);
                const p = r.flare_prob || {};
                return (
                  <li key={r.region}>
                    <div className="sun-reg__head">
                      <b>{t.regionAr(r.region)}</b>
                      <span className="sun-reg__loc">{r.location}</span>
                      {r.spots != null ? <span className="sun-reg__spots">{t.regionSpots(r.spots)}</span> : null}
                    </div>
                    <div className="sun-reg__size">
                      <span>{t.regionSize(fmtNum(r.area, lang))}</span>
                      {earths ? <b>{t.regionEarths(earths)}</b> : null}
                    </div>
                    {loc ? <p className="sun-small">{t.regionWhere(loc.ns, loc.lat, loc.ew, loc.lon)}{loc.limb ? ` · ${t.regionLimb}` : ""}</p> : null}
                    {Number.isFinite(p.m) && Number.isFinite(p.x) ? <p className="sun-small">{t.regionFlare(fmtNum(p.m, lang), fmtNum(p.x, lang))}</p> : null}
                  </li>
                );
              })}
            </ul>
          ) : <p>{t.regionsNone}</p>}
          {sp.hidden > 0 ? <p className="sun-small">{t.regionsHidden(sp.hidden)}</p> : null}
          <p>{t.regionsWhat}</p>
          <p className="sun-small">{t.regionsMapNote} {probs ? t.regionsFlareNote : ""}</p>
          <p className="sun-src"><Ext href={LINKS.regions} t={t}>NOAA SWPC</Ext></p>
        </>
      )}
    </Block>
  );
}

function Flares({ d, t, lang }) {
  const err = d.errors && d.errors.flares;
  const list = d.flares_7d;
  const top = d.strongest_flare_24h;
  const sum = flareSummary(list);
  const info = top && flareInfo(top.class);
  const level = top && flareLevel(top.class);
  return (
    <Block title={t.flareTitle}>
      {!Array.isArray(list) ? (
        <><Missing t={t} source="NOAA SWPC" reason={err} what={t.flaresErr} /></>
      ) : (
        <>
          {info ? (
            <p className={`sun-flare is-${level}`}>
              <span className="sun-flare__cls">{info.cls}</span>
              <span className="sun-flare__meta"><span>{t.flarePeak(fmtUtc(top.peak_time, lang))}</span></span>
            </p>
          ) : <p>{t.flareNone}</p>}
          {info ? <p>{t.flareLevel[level]}{info.r ? ` ${t.flareR(info.r)}` : ""}</p> : null}
          <p>{t.flareWhat}</p>
          <p className="sun-small">{t.flareScale}</p>
          {sum ? <p className="sun-small">{t.flares7(sum.total, sum.mx)} {t.flareNoRegion}</p> : null}
          <p className="sun-src"><Ext href={LINKS.flares} t={t}>NOAA SWPC · GOES</Ext></p>
        </>
      )}
    </Block>
  );
}

function Kp({ d, t, lang }) {
  const err = d.errors && d.errors.kp;
  const kp = d.kp;
  const info = kp && kpInfo(kp.value);
  return (
    <Block title={t.kpTitle}>
      {!info ? <Missing t={t} source="NOAA SWPC" reason={err} what="" /> : (
        <>
          <p className={`sun-kp is-${info.level}`}>
            <span className="sun-kp__v">{t.kpValue(fmtNum(kp.value, lang, 1))}</span>
            <span className="sun-kp__scale" aria-hidden="true">
              {Array.from({ length: 9 }, (_, i) => <i key={i} className={i < Math.round(kp.value) ? "on" : ""} />)}
            </span>
          </p>
          <p className="sun-small">{t.kpTime(fmtUtc(kp.time, lang))}</p>
          <p>{info.level === "storm" ? t.kpStorm(info.g) : t.kpLevel[info.level]}</p>
          <p>{t.kpWhat}</p>
          <p className="sun-src"><Ext href={LINKS.kp} t={t}>NOAA SWPC · Kp</Ext></p>
        </>
      )}
    </Block>
  );
}

export function CycleChart({ cycle, todayDate, todayValue, t, lang }) {
  const g = cycleGeometry(cycle, dateToYear(todayDate), todayValue);
  const titleId = useId();
  if (!g) return null;
  const months = cycle.months || [];
  const pred = cycle.predicted || [];
  const p24 = cyclePeak(months, "2008-12", "2019-11"), p25 = cyclePeak(months);
  const xOf = (peak) => {
    const yr = Number(peak.t.slice(0, 4)) + (Number(peak.t.slice(5, 7)) - 0.5) / 12;
    return g.left + ((yr - g.x0) / (g.x1 - g.x0)) * (g.w - g.left - g.right);
  };
  const lastSmoothMissing = months.length && months[months.length - 1].smoothed == null;
  const flip = g.today && g.today.x > g.w - 60;
  return (
    <>
      <svg className="sun-cycle" viewBox={`0 0 ${g.w} ${g.h}`} role="img" aria-labelledby={titleId}>
        <title id={titleId}>{t.cycleAlt(fmtMonth(months[0] && months[0].t, lang) || "", pred.length ? fmtMonth(pred[pred.length - 1].t, lang) : "")}</title>
        {g.yticks.map(y => (
          <g key={y.value}>
            <line className="sun-cycle__grid" x1={g.left} x2={g.w - g.right} y1={y.y} y2={y.y} />
            <text className="sun-cycle__tick" x={g.left - 4} y={y.y + 3} textAnchor="end">{y.value}</text>
          </g>
        ))}
        {g.xticks.map(x => (
          <text key={x.year} className="sun-cycle__tick" x={x.x} y={g.h - 6} textAnchor="middle">{x.year}</text>
        ))}
        {g.band ? <path className="sun-cycle__band" d={g.band} /> : null}
        {g.monthly ? <path className="sun-cycle__monthly" d={g.monthly} /> : null}
        {g.hasSmoothed ? <path className="sun-cycle__smooth" d={g.smoothed} /> : null}
        {g.hasPredicted ? <path className="sun-cycle__pred" d={g.predicted} /> : null}
        {p24 ? <text className="sun-cycle__lbl" x={xOf(p24)} y={g.top - 1} textAnchor="middle">{t.cycleC24}</text> : null}
        {p25 ? <text className="sun-cycle__lbl" x={xOf(p25)} y={g.top - 1} textAnchor="middle">{t.cycleC25}</text> : null}
        {g.today ? (
          <g>
            <line className="sun-cycle__today" x1={g.today.x} x2={g.today.x} y1={g.top + 8} y2={g.h - g.bottom} />
            {g.today.y != null ? <circle className="sun-cycle__dot" cx={g.today.x} cy={g.today.y} r="3.6" /> : null}
            <text className="sun-cycle__todaylbl" x={g.today.x + (flip ? -5 : 5)} y={g.top + 18} textAnchor={flip ? "end" : "start"}>{t.cycleToday(todayValue != null ? fmtNum(todayValue, lang) : null)}</text>
          </g>
        ) : null}
        <text className="sun-cycle__axis" x={g.left + 2} y={g.top - 1}>{t.cycleAxisY}</text>
      </svg>
      <ul className="sun-legend">
        <li><i className="k-monthly" aria-hidden="true" />{t.cycleMonthly}</li>
        {g.hasSmoothed ? <li><i className="k-smooth" aria-hidden="true" />{t.cycleSmoothed}</li> : null}
        {g.hasPredicted ? <li><i className="k-pred" aria-hidden="true" />{t.cycleForecast}</li> : null}
      </ul>
      {lastSmoothMissing && g.hasSmoothed ? <p className="sun-small">{t.cycleSmoothNote}</p> : null}
    </>
  );
}

function Cycle({ d, t, lang }) {
  const err = d.errors && d.errors.cycle;
  const c = d.cycle;
  return (
    <Block title={t.cycleTitle}>
      <p>{t.cycleWhat}</p>
      {!c ? <Missing t={t} source="NOAA SWPC" reason={err} what="" /> : (
        <>
          <CycleChart cycle={c} todayDate={(d.sunspot_number && d.sunspot_number.date) || d.updated}
            todayValue={d.sunspot_number ? d.sunspot_number.value : null} t={t} lang={lang} />
          {err ? <Missing t={t} source="NOAA SWPC" reason={err} what="" /> : null}
          <p className="sun-src"><Ext href={LINKS.cycle} t={t}>NOAA SWPC · {t.srcCycle}</Ext></p>
        </>
      )}
    </Block>
  );
}

function Sources({ d, t, lang }) {
  return (
    <Block title={t.sourcesTitle} className="sun-block--sources">
      <ul className="sun-sources">
        <li><Ext href={LINKS.silso} t={t}>SILSO</Ext> — {t.srcSpots}</li>
        <li><Ext href={LINKS.regions} t={t}>NOAA SWPC</Ext> — {t.srcRegions}, <Ext href={LINKS.flares} t={t}>{t.srcFlares}</Ext>, <Ext href={LINKS.kp} t={t}>{t.srcKp}</Ext>, <Ext href={LINKS.cycle} t={t}>{t.srcCycle}</Ext></li>
        <li><Ext href={LINKS.sdo} t={t}>NASA SDO</Ext> — {t.srcImage}: {t.srcNasa}</li>
      </ul>
      {d.updated ? <p className="sun-small">{t.srcUpdated(fmtUtc(d.updated, lang))}</p> : null}
    </Block>
  );
}

// ─── Contenido completo (ficha del Sol y detalle de la tarjeta) ──────────────
export function SunContent({ data: d, lang = "es" }) {
  const t = TS[lang] || TS.es;
  return (
    <div className="sun-content">
      <p className="sun-warn" role="note">
        <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M10 2 1.5 17h17z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M10 8v4M10 14.2v.1" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" /></svg>
        <span><strong>{t.warnTitle}.</strong> {t.warn}</span>
      </p>
      {d.stale === true ? <p className="sun-small sun-stale">{t.stale}</p> : null}
      <SunImage image={d.image} t={t} lang={lang} />
      <Spots d={d} t={t} lang={lang} />
      <Regions d={d} t={t} lang={lang} />
      <Flares d={d} t={t} lang={lang} />
      <Kp d={d} t={t} lang={lang} />
      <Cycle d={d} t={t} lang={lang} />
      <Sources d={d} t={t} lang={lang} />
    </div>
  );
}

function StateBox({ state, t, retry }) {
  const { status } = state;
  if (status === "loading") return <div className="sun-state" role="status"><span className="sun-skel" aria-hidden="true" /><span className="sun-skel sun-skel--short" aria-hidden="true" /><span className="sun-sr">{t.loading}</span></div>;
  const title = status === "missing" ? t.missingTitle : status === "empty" ? t.emptyTitle : t.errorTitle;
  const body = status === "missing" ? t.missingBody : status === "empty" ? t.emptyBody : t.errorBody;
  return (
    <div className="sun-state sun-state--off" role="status">
      <p className="sun-state__title">{title}</p>
      <p>{body}</p>
      <button type="button" className="sun-btn" onClick={retry}>{t.retry}</button>
    </div>
  );
}

// ─── Bloque «El Sol hoy» de la ficha del Sol ─────────────────────────────────
export default function SunToday({ lang = "es", api = API, source = "sheet" }) {
  const t = TS[lang] || TS.es;
  const [state, retry] = useSunToday(api);
  const hid = useId();
  useEffect(() => { if (state.status === "ok") trackOnce(`sun_today:${source}`, "sun_today", { source }); }, [state.status, source]);
  return (
    <section className="sun-today" aria-labelledby={hid} aria-busy={state.status === "loading"}>
      <h3 id={hid} className="sun-title">{t.title}</h3>
      <p className="sun-lead">{t.lead}</p>
      {state.status === "ok" ? <SunContent data={state.data} lang={lang} /> : <StateBox state={state} t={t} retry={retry} />}
    </section>
  );
}

// ─── Resumen compacto (tarjeta de «Ahora en el espacio») ─────────────────────
export function SunSummary({ data: d, lang = "es" }) {
  const t = TS[lang] || TS.es;
  const s = d.sunspot_number, kp = d.kp, top = d.strongest_flare_24h;
  const kpi = kp && kpInfo(kp.value);
  const info = top && flareInfo(top.class);
  const [imgFail, setImgFail] = useState(false);
  return (
    <div className="sun-summary">
      {d.image && d.image.url && !imgFail ? (
        <img className="sun-summary__img" src={d.image.url} alt={t.imgAlt} width="96" height="96" decoding="async" loading="lazy" onError={() => setImgFail(true)} />
      ) : null}
      <dl className="sun-summary__stats">
        <div><dt>{t.cardSpots}</dt><dd>{s ? fmtNum(s.value, lang) : <small>{t.cardUnknown}</small>}</dd></div>
        <div><dt>{t.cardKp}</dt><dd className={kpi ? `is-${kpi.level}` : ""}>{kpi ? fmtNum(kp.value, lang, 1) : <small>{t.cardUnknown}</small>}</dd></div>
        <div><dt>{t.cardFlare}</dt><dd className={info ? `is-${flareLevel(top.class)}` : ""}>{!Array.isArray(d.flares_7d) ? <small>{t.cardUnknown}</small> : info ? info.cls : <small>{t.cardNoFlare}</small>}</dd></div>
      </dl>
    </div>
  );
}
