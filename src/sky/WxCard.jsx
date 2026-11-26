// WxCard.jsx — la tarjeta que se abre al tocar la pastilla del tiempo («13 °C · 1 km/h») sobre el cielo.
// De arriba abajo: el interruptor de las nubes y el estado del cielo; la temperatura grande con la sensación y la
// lluvia del día; un aviso si los modelos no coinciden; la nubosidad total y por capas; la franja POR HORA (24 h, se
// desliza de lado: icono, temperatura, lluvia y nubes; la mejor ventana para observar de noche, en verde; tocar una
// hora lleva el cielo a esa hora); lluvia, humedad con punto de rocío, viento con flecha, UV con su escala,
// visibilidad, presión y el Sol del día; y la franja de los PRÓXIMOS 7 DÍAS (máxima, mínima, lluvia y nubes de la
// noche: bajo 30 %, noche para observar; tocar un día lleva el cielo a esa noche).
//
// Props:
//   lang · now: el tiempo del punto (parseNow de nowWeather.js, con fetchedAt: horas y días) · fc: { status, data } del pronóstico
//   mod: los siete modelos del punto (models.js) o null: la temperatura y la lluvia que se muestran son su mediana
//   sat: las nubes del satélite (satClouds.js) o null: si su barrido es reciente, la nubosidad de ahora es la suya
//   rainDrawn: el cielo dibuja ahora la lluvia prevista (rainLook.js)
//   cloudsOn, canDraw (las nubes se dibujan con la Atmósfera), onToggleClouds
// De dónde sale cada dato: nubosidad por capas y de cada hora y noche, del pronóstico de la zona (weather.js, ~11 km);
// temperatura y lluvia, de la mediana de los modelos en tu punto (models.js; si no llegan, el modelo por defecto);
// lo demás, del pronóstico de tu punto exacto (nowWeather.js), el mismo que dibuja la lluvia. El Sol lo calcula Teseo.
//   isNight(s) → bool · sunDay(s0) → { rise, set } del día que empieza en s0 (riseset.js) · tz: zona horaria del lugar
//   skyT: hora del cielo (s) · skyIsNow: el cielo va en «ahora»
//   onPickHour(s): llevar el cielo a esa hora · anchorRef: la pastilla · stageRef: el contenedor · onClose()
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Icon from "./icons.jsx";
import { WX } from "./i18n-wx.js";
import { cloudsAt, hourlySeries, bestWindow, coverClass } from "./weather.js";
import { tempAt, dayAt, disagreement, skyVote } from "./models.js";
import { satWeight, mergeClouds, fuseSat } from "./satClouds.js";
import { wxIcon, voteIcon, dayIcon, WX_NAMES, WX_MAYBE, compass8, fmtWind, hourAt } from "./nowWeather.js";
import "./weather.css";

const pct = (f) => `${Math.round(f * 100)} %`;
const BADGE = { rain: "droplet", sleet: "flake", snow: "flake", storm: "bolt" };
/** Icono del tiempo con su marca pequeña de «posible lluvia / nieve / tormenta» (wxIcon o dayIcon de nowWeather.js). */
export function WxIco({ ic, size = 22 }) {
  return (
    <span className="sk-ic">
      <Icon name={`wx_${ic.kind}`} size={size} />
      {ic.maybe && <i className={`sk-ic-b is-${ic.maybe}`}><Icon name={BADGE[ic.maybe]} size={Math.round(size * 0.45)} /></i>}
    </span>
  );
}
const fmtT = (t) => `${Math.round(t) === 0 ? 0 : Math.round(t)}`.replace("-", "−") + " °C";

export function WxCard({ lang = "es", now, fc, mod = null, sat, rainDrawn = false, cloudsOn, canDraw, onToggleClouds, isNight, sunDay, tz, skyT, skyIsNow, onPickHour, onNow, anchorRef, stageRef, onClose }) {
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
  const h0 = Math.floor(nowS / 3600) * 3600;
  // nubosidad de la zona hora a hora (24 h) y la mejor ventana de noche
  const series = useMemo(() => (data ? hourlySeries(data, h0, 24) : null), [data, h0]);
  const win = useMemo(() => (series ? bestWindow(series, isNight) : null), [series, isNight]);
  const anyNight = !!(series && isNight && series.some((p) => isNight(p.t)));
  const loc = lang === "es" ? "es-EC" : "en-US";
  const hh = (s) => new Date(s * 1000).toLocaleTimeString(loc, { hour: "numeric", minute: "2-digit", hourCycle: "h23", ...(tz ? { timeZone: tz } : {}) });
  const hours = useMemo(() => (now && now.hours ? now.hours.filter((x) => x.t >= h0 && x.t < h0 + 24 * 3600) : []), [now, h0]);
  const days = now && now.days ? now.days.slice(0, 7) : [];
  const stripRef = useRef(null);

  // con otra hora en el cielo, la tarjeta entera pasa a esa hora (pronóstico del lugar); si no, ahora
  const hr = now && !skyIsNow && Number.isFinite(skyT) ? hourAt(now.hours, skyT) : null;
  const shownT = hr ? hr.t : nowS;
  const selHour = hr ? Math.floor(hr.t / 3600) * 3600 : null;
  // la franja por hora se desliza hasta la hora elegida
  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const on = el.querySelector(".is-on");
    if (on) el.scrollLeft = Math.max(0, on.offsetLeft - el.clientWidth / 2 + on.offsetWidth / 2);
    else el.scrollLeft = 0;
  }, [selHour, hours.length]);
  const dayIdx = days.findIndex((d, i) => shownT >= d.t && shownT < (days[i + 1] ? days[i + 1].t : d.t + 86400));
  const day = dayIdx >= 0 ? days[dayIdx] : null;
  const sunT = useMemo(() => (day && sunDay ? sunDay(day.t) : null), [day && day.t, sunDay]);   // eslint-disable-line react-hooks/exhaustive-deps

  if (!now) return null;
  const v = hr || now;
  // ahora, con satélite: la nubosidad que se ve desde tu sitio (pesada por la bóveda del cielo), no la media de 300 km
  const cc = hr ? (data ? cloudsAt(data, hr.t) : null) : c && c.dome ? { ...c, ...c.dome } : c;
  // el icono: lo que dan la mayoría de los 7 modelos a esa hora (voteIcon); sin ellos, el código del pronóstico del
  // lugar, con poca probabilidad la lluvia o la tormenta solo como marca (wxIcon)
  const vote = skyVote(mod, hr ? hr.t : nowS);
  const ic = voteIcon(vote, wxIcon(v.code, v.day, v.pop, v.cloud), v.day, v.cloud), k = ic.kind;
  const maybeTxt = (m) => (m ? (WX_MAYBE[lang] || WX_MAYBE.es)[m] : null);
  // con el satélite reciente, cuántas nubes hay lo dice él (octas de la OMM); lluvia, niebla, nieve o tormenta, el código
  const name0 = !hr && satW > 0 && cc && ["sun", "moon", "partly", "partly_night", "cloud"].includes(k) ? (WX[lang] || WX.es).cover[coverClass(cc.total)] : (WX_NAMES[lang] || WX_NAMES.es)[k];
  const name = ic.maybe ? `${name0} · ${maybeTxt(ic.maybe)}` : name0;
  const dec = (x) => (lang === "es" ? String(x).replace(".", ",") : String(x));
  // temperatura y lluvia del día: la mediana de los modelos (si hay al menos 3); si no, la del modelo por defecto
  const mT = tempAt(mod, shownT), mDay = dayAt(mod, shownT);
  const temp = mT && mT.n >= 3 ? mT.med : v.temp;
  const dayMm = mDay && mDay.mm && mDay.mm.n >= 3 ? mDay.mm.med : day ? day.mm : null;
  const mmTxt = (x) => (x == null ? "—" : x < 0.05 ? "0 mm" : x < 10 ? `${dec(Math.round(x * 10) / 10)} mm` : `${Math.round(x)} mm`);
  const dis = disagreement(mT, mDay && mDay.mm, vote);
  // la barra de acuerdo: qué dan los modelos, solo lo que alguno da (sin ceros) y solo si alguno da algo que cae
  const VOTE_ORDER = ["rain", "storm", "sleet", "snow", "dry"];
  const voteParts = vote && VOTE_ORDER.some((q) => q !== "dry" && vote.counts[q] > 0) ? VOTE_ORDER.filter((q) => vote.counts[q] > 0).map((q) => ({ q, c: vote.counts[q] })) : null;
  const voteName = (q) => (q === "dry" ? tw.dry : (WX_NAMES[lang] || WX_NAMES.es)[q]);
  const isToday = !!(day && nowS >= day.t && nowS < day.t + 86400);
  const nModels = Math.max(mT ? mT.n : 0, mDay && mDay.mm ? mDay.mm.n : 0);
  const windTxt = v.windKmh == null ? "—" : v.windKmh < 1 || v.windFrom == null ? tw.calm : fmtWind(v.windKmh);
  const total = cc ? cc.total : v.cloud != null ? v.cloud / 100 : null;
  const vis = v.visKm == null ? "—" : v.visKm >= 10 ? `${Math.round(v.visKm)} km` : `${dec(Math.round(v.visKm * 10) / 10)} km`;
  const uvLv = v.uv == null ? null : v.uv < 3 ? 0 : v.uv < 6 ? 1 : v.uv < 8 ? 2 : v.uv < 11 ? 3 : 4;
  const ago = now.fetchedAt ? tw.ago((Date.now() - now.fetchedAt) / 60000) : null;
  const tempH = (x) => { const m = tempAt(mod, x.t); return m && m.n >= 3 ? m.med : x.temp; };
  // nubes de cada noche (19–24 h, hora local): media de la zona; bajo 30 %, noche para observar
  const nightCloud = (d) => {
    if (!data) return null;
    const vs = [];
    for (let k2 = 19; k2 < 24; k2++) { const q = cloudsAt(data, d.t + k2 * 3600); if (q && q.total != null) vs.push(q.total); }
    return vs.length ? vs.reduce((p, q) => p + q, 0) / vs.length : null;
  };
  const nights = days.map(nightCloud);
  const nClear = nights.filter((x) => x != null && x < 0.3).length;
  // «jue 26» / «Thu 26»: día de la semana y número, en ese orden en los dos idiomas (a mediodía, lejos del cambio de día)
  const dayName = (d, i) => {
    if (i === 0 && nowS >= d.t && nowS < d.t + 86400) return tw.today;
    const ps = new Intl.DateTimeFormat(loc, { weekday: "short", day: "numeric", ...(tz ? { timeZone: tz } : {}) }).formatToParts(new Date((d.t + 12 * 3600) * 1000));
    const get = (ty) => (ps.find((p) => p.type === ty) || {}).value || "";
    return `${get("weekday").replace(".", "")} ${get("day")}`;
  };
  const dayMed = (d) => { const m = dayAt(mod, d.t + 3600); const ok3 = (x) => x && x.n >= 3; return { hi: m && ok3(m.tmax) ? m.tmax.med : d.tmax, lo: m && ok3(m.tmin) ? m.tmin.med : d.tmin, mm: m && ok3(m.mm) ? m.mm.med : d.mm }; };
  const deg = (x) => (x == null ? "—" : `${Math.round(x) === 0 ? 0 : Math.round(x)}°`.replace("-", "−"));

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
          <span><Icon name="clock" size={14} />{tw.atHead(hh(hr.t), day && !isToday ? dayName(day, 1) : null)}</span>
          <button type="button" className="sk-wxc-now" onClick={onNow}>{tw.backNow}</button>
        </div>
      )}
      <p className="sk-wxc-src">{!hr && satW > 0 ? tw.srcSat(sat.sat, tw.ago((Date.now() / 1000 - sat.t) / 60)) : tw.srcFc}{rainDrawn && cloudsOn ? ` ${tw.srcRain}` : ""}</p>

      <div className="sk-wxc-hero">
        <div>
          <span className="sk-wxc-big"><WxIco ic={ic} size={26} />{fmtT(temp)}</span>
          <small>{tw.feels} {v.feels != null ? fmtT(v.feels) : "—"}</small>
        </div>
        <div className="sk-wxc-hero-r"><small>{tw.dayRain}</small><b>{mmTxt(dayMm)}</b></div>
      </div>
      {voteParts && (
        <div className="sk-wxc-vote" role="img" aria-label={tw.agreeAria(voteParts.map((p) => `${voteName(p.q)} ${p.c}`).join(", "), vote.n)}>
          <div className="sk-wxc-vote-bar">{voteParts.map((p) => <i key={p.q} className={`is-${p.q}`} style={{ flex: p.c }} />)}</div>
          <div className="sk-wxc-vote-key">{voteParts.map((p) => (
            <span key={p.q}><Icon name={p.q === "dry" ? "wx_cloud" : `wx_${p.q}`} size={13} className={`is-${p.q}`} />{voteName(p.q)} {p.c}</span>
          ))}</div>
        </div>
      )}
      {dis && (
        <p className="sk-wxc-unsure" role="note"><Icon name="warn" size={14} />
          {tw.unsure(dis.t ? dis.t.map((x) => Math.round(x)) : null, dis.mm ? dis.mm.map((x) => Math.round(x)) : null, dis.n, isToday, dis.sky, dis.skyN)}</p>
      )}

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

      {hours.length > 0 && (
        <div className="sk-wxc-sec">
          <div className="sk-wxc-row">
            <small>{tw.hourly}</small>
            {win ? <em className="sk-wxc-best"><Icon name="sparkle" size={13} />{tw.best(hh(win.t0), hh(win.t1))}</em> : anyNight ? <em className="sk-wxc-nobest">{tw.noBest}</em> : null}
          </div>
          <div className="sk-wxc-strip" ref={stripRef}>
            {hours.map((x, i) => {
              const sIdx = series ? series.findIndex((p) => p.t === x.t) : -1;
              const cl = sIdx >= 0 && series[sIdx].total != null ? series[sIdx].total : x.cloud != null ? x.cloud / 100 : null;
              const best = win && sIdx >= win.i0 && sIdx <= win.i1;
              const on = selHour === x.t;
              // (cada hora, como el icono grande: por mayoría de los modelos)
              const t = tempH(x), hic = voteIcon(skyVote(mod, x.t), wxIcon(x.code, x.day, x.pop, x.cloud), x.day, x.cloud);
              return (
                <button key={x.t} type="button" className={`sk-wxc-cell${on ? " is-on" : ""}${best ? " is-best" : ""}`} aria-pressed={on}
                  aria-label={`${tw.hourAria(hh(x.t), t != null ? fmtT(t) : "—", x.pop != null ? `${Math.round(x.pop)} %` : "—", cl != null ? pct(cl) : "—")}${hic.maybe ? ` (${maybeTxt(hic.maybe)})` : ""}`}
                  onClick={() => onPickHour(x.t)}>
                  <small>{i === 0 && x.t <= nowS ? tw.nowH : hh(x.t)}</small>
                  <WxIco ic={hic} size={22} />
                  <b>{deg(t)}</b>
                  <span><Icon name="umbrella" size={11} />{x.pop != null ? `${Math.round(x.pop)} %` : "—"}</span>
                  <span className="sk-wxc-cl"><Icon name="wx_cloud" size={11} />{cl != null ? pct(cl) : "—"}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="sk-wxc-grid">
        <div className="sk-wxc-tile"><small><Icon name="umbrella" size={14} />{tw.rain}</small><b>{v.pop != null ? `${Math.round(v.pop)} %` : "—"}</b>
          {v.mm != null && <em>{tw.rainHour(dec(Math.round(v.mm * 10) / 10))}</em>}</div>
        <div className="sk-wxc-tile"><small><Icon name="droplet" size={14} />{tw.rh}</small><b>{v.rh != null ? `${Math.round(v.rh)} %` : "—"}</b>
          {v.dew != null && <em>{tw.dew(deg(v.dew))}</em>}</div>
        <div className="sk-wxc-tile"><small><Icon name="wind" size={14} />{tw.wind}</small>
          <b>{v.windKmh != null && v.windKmh >= 1 && v.windFrom != null && <span className="sk-wxc-arrow" style={{ transform: `rotate(${Math.round(v.windFrom)}deg)` }}><Icon name="arrow_down" size={15} /></span>}{windTxt}</b>
          {v.windKmh != null && v.windKmh >= 1 && v.windFrom != null && <em>{tw.windFrom(compass8(v.windFrom, lang))}</em>}</div>
        <div className="sk-wxc-tile"><small><Icon name="sun" size={14} />{tw.uv}</small>
          <b>{v.uv != null ? Math.round(v.uv) : "—"}{uvLv != null && v.day ? <em>{tw.uvLevels[uvLv]}</em> : !v.day ? <em>{tw.uvNight}</em> : null}</b>
          {v.uv != null && <i className="sk-wxc-uv" aria-hidden="true"><i style={{ left: `${Math.min(100, (v.uv / 12) * 100)}%` }} /></i>}</div>
        <div className="sk-wxc-tile"><small><Icon name="eye" size={14} />{tw.vis}</small><b>{vis}</b></div>
        <div className="sk-wxc-tile"><small><Icon name="gauge" size={14} />{tw.pressure}</small><b>{v.hPa != null ? `${Math.round(v.hPa)} hPa` : "—"}</b><em>{tw.seaLevel}</em></div>
        {sunT && sunT.rise && sunT.set && (
          <div className="sk-wxc-tile wide"><small><Icon name="sunrise" size={14} />{tw.sun}</small>
            <b>{tw.sunTimes(hh(sunT.rise.date.getTime() / 1000), hh(sunT.set.date.getTime() / 1000))}</b><em>{tw.sunBy}</em></div>
        )}
      </div>

      {days.length > 0 && (
        <div className="sk-wxc-sec">
          <div className="sk-wxc-row"><small>{tw.days}</small>{data && <em className={nClear ? "sk-wxc-best" : "sk-wxc-nobest"}>{tw.clearNights(nClear)}</em>}</div>
          <div className="sk-wxc-strip days">
            {days.map((d, i) => {
              const m = dayMed(d), nc = nights[i], good = nc != null && nc < 0.3, on = i === dayIdx && !!hr, dic = dayIcon(d, now.hours);
              return (
                <button key={d.t} type="button" className={`sk-wxc-cell day${on ? " is-on" : ""}${good ? " is-best" : ""}`} aria-pressed={on}
                  aria-label={`${tw.dayAria(dayName(d, i), deg(m.hi), deg(m.lo), mmTxt(m.mm), nc != null ? pct(nc) : null)}${dic.maybe ? ` (${maybeTxt(dic.maybe)})` : ""}`}
                  title={good ? tw.nightGood : undefined}
                  onClick={() => onPickHour(d.t + 21 * 3600)}>
                  <small>{dayName(d, i)}</small>
                  <WxIco ic={dic} size={24} />
                  <b>{deg(m.hi)}</b>
                  <span>{deg(m.lo)}</span>
                  <span><Icon name="droplet" size={11} />{mmTxt(m.mm)}</span>
                  <span className="sk-wxc-cl"><Icon name="moon" size={11} />{nc != null ? pct(nc) : "—"}</span>
                </button>
              );
            })}
          </div>
          <p className="sk-wxc-fine tight"><Icon name="moon" size={11} /> {tw.nightLegend} · <span className="sk-wxc-good">{tw.nightGood}</span></p>
        </div>
      )}
      <p className="sk-wxc-fine">{hr ? tw.sourceAt(hh(hr.t)) : ago ? tw.source(ago) : null}{nModels >= 3 ? ` · ${tw.median(nModels)}` : ""}</p>
    </div>
  );
}
