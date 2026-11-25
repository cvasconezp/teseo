// WeatherPanel.jsx — «Nubes y clima» en el panel de capas de la vista Cielo: el interruptor de las nubes del
// pronóstico (cloudsLayer.js), un resumen (cuántas nubes a la hora del cielo, por capas, lluvia, cuándo
// despeja, la mejor hora de la noche), la nubosidad de las próximas 24 h y, a pedido, las nubes vistas desde el
// satélite (satellite.js). El estado del pronóstico vive en Constellations.jsx; aquí solo se presenta.
//
// Props:
//   lang, available (hay lugar en Mi cielo), atmOn (las nubes se dibujan con la atmósfera), on, onToggle
//   fc        { status: "idle"|"loading"|"ok"|"error", data, error }   · onRetry
//   when      Date: la hora del cielo · isNow: si es «ahora»
//   isNight   (s Unix) → bool: el Sol bajo −12° (para el gráfico y la mejor hora)
//   lat, lon, placeName · onSat(): métricas al abrir el satélite · onMount(): pide el pronóstico al abrir el panel
//   pointHours: las horas del pronóstico de tu punto exacto (nowWeather.js): la probabilidad de lluvia sale de ahí, como en la tarjeta
import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "./icons.jsx";
import { WX } from "./i18n-wx.js";
import { cloudsAt, coverClass, nextChange, bestNightHour, hourlySeries } from "./weather.js";
import { hourAt } from "./nowWeather.js";
import { validTz } from "./placeTime.js";
import { pickSource, globeBox, regionBox, wmsUrl, fetchLatestTime, paintGlobe, timeCandidates, dataFraction } from "./satellite.js";
import "./weather.css";

// las horas, en la zona del lugar (`tz`, como la tarjeta del tiempo); sin zona válida, la del dispositivo
const tzOpt = (tz) => (validTz(tz) ? { timeZone: tz } : {});
const hhmm = (s, lang, tz) => new Date(s * 1000).toLocaleTimeString(lang === "es" ? "es-EC" : "en-US", { hour: "2-digit", minute: "2-digit", ...tzOpt(tz) });

export function WeatherPanel({ lang = "es", available = true, atmOn = true, on, onToggle, fc, onRetry, when, isNow, isNight, lat, lon, placeName, onSat, onMount, pointHours = null, tz = null }) {
  const tw = WX[lang] || WX.es;
  useEffect(() => { if (onMount) onMount(); }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  const [satOpen, setSatOpen] = useState(false);
  const s = when ? when.getTime() / 1000 : Date.now() / 1000;
  const data = fc && fc.status === "ok" ? fc.data : null;
  const c = useMemo(() => (data ? cloudsAt(data, s) : null), [data, s]);
  const ph = pointHours ? hourAt(pointHours, s) : null;
  const pop = ph && ph.pop != null ? ph.pop / 100 : c ? c.precip : null;
  const change = useMemo(() => (data ? nextChange(data, s) : null), [data, s]);
  const best = useMemo(() => (data && isNight ? bestNightHour(data, s, isNight) : null), [data, s, isNight]);
  const series = useMemo(() => (data ? hourlySeries(data, s, 24) : null), [data, s]);
  const canDraw = available && atmOn;

  return (
    <section className="sk-wx" aria-labelledby="sk-wx-title">
      <h3 id="sk-wx-title" className="sk-wx-title">{tw.title}</h3>
      <div className="sk-layer">
        <button type="button" role="switch" aria-checked={!!on && canDraw} disabled={!canDraw} className="sk-layer-main" onClick={onToggle}>
          <i className="sk-dot sk-wx-dot" />
          <span className="sk-layer-txt"><b>{tw.layer}</b><small>{!available ? tw.needPlace : !atmOn ? tw.needAtm : tw.layerDesc}</small></span>
          <span className="sk-count">{on && canDraw && c ? `${Math.round(c.total * 100)} %` : ""}</span>
          <i className="sk-switch" />
        </button>
      </div>

      {available && (
        <div className="sk-wx-box">
          {(!fc || fc.status === "loading" || fc.status === "idle") && <p className="sk-atm-fine" role="status">{tw.loading}</p>}
          {fc && fc.status === "error" && (
            <p className="sk-atm-fine sk-wx-err" role="status">{tw.error}{" "}
              {onRetry && <button type="button" className="sk-wx-link" onClick={onRetry}><Icon name="retry" size={14} />{tw.retry}</button>}</p>
          )}
          {data && !c && <p className="sk-atm-fine">{tw.outOfRange}</p>}
          {c && (
            <>
              <div className="sk-wx-now">
                <span className="sk-wx-when">{tw.at(hhmm(s, lang, tz), isNow)}</span>
                <b>{tw.cover[coverClass(c.total)]} · {Math.round(c.total * 100)} %</b>
              </div>
              <dl className="sk-atm-stats">
                <div><dt>{tw.layers(c.low || 0, c.mid || 0, c.high || 0)}</dt>
                  {pop != null && <dd>{tw.rain(pop)}</dd>}
                  {change && <dd>{change.kind === "clears" ? tw.clears(hhmm(change.t, lang, tz)) : tw.clouds(hhmm(change.t, lang, tz))}</dd>}
                </div>
                {best && <div><dt>{tw.best(hhmm(best.t, lang, tz), best.total)}</dt></div>}
              </dl>
              {series && <CloudChart series={series} isNight={isNight} lang={lang} tz={tz} aria={tw.chartAria} />}
              <p className="sk-atm-fine">{tw.chartHint}</p>
            </>
          )}
          <button type="button" className="sk-btn wide sk-wx-satbtn" aria-expanded={satOpen}
            onClick={() => { setSatOpen((v) => !v); if (!satOpen && onSat) onSat(); }}>
            <Icon name="planet" size={17} />{satOpen ? tw.satHide : tw.sat}
          </button>
          {satOpen && lat != null && lon != null && <SatelliteView lang={lang} lat={lat} lon={lon} placeName={placeName} tz={tz} />}
          <p className="sk-atm-fine">{tw.source}</p>
        </div>
      )}
    </section>
  );
}

function CloudChart({ series, isNight, lang, tz, aria }) {
  const W = 240, H = 46, bw = W / series.length;
  return (
    <svg className="sk-wx-chart" viewBox={`0 0 ${W} ${H + 12}`} role="img" aria-label={aria} preserveAspectRatio="none">
      {series.map((p, i) => (isNight && isNight(p.t) ? <rect key={`n${i}`} x={i * bw} y="0" width={bw + 0.2} height={H} className="sk-wx-night" /> : null))}
      {series.map((p, i) => (p.total == null ? null : (
        <rect key={i} x={i * bw + 0.8} y={H - Math.max(1.5, p.total * H)} width={bw - 1.6} height={Math.max(1.5, p.total * H)} rx="1.2" className="sk-wx-bar" />
      )))}
      {series.map((p, i) => (i % 6 === 0 ? <text key={`t${i}`} x={i * bw + 1} y={H + 10} className="sk-wx-tick">{hhmm(p.t, lang, tz)}</text> : null))}
    </svg>
  );
}

// ── satélite ─────────────────────────────────────────────────────────────────────────────────────────────
function loadImageData(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const cv = document.createElement("canvas"); cv.width = img.naturalWidth; cv.height = img.naturalHeight;
        const x = cv.getContext("2d", { willReadFrequently: true }); x.drawImage(img, 0, 0);
        resolve(x.getImageData(0, 0, cv.width, cv.height));
      } catch (e) { reject(e); }
    };
    img.onerror = () => reject(new Error("imagen no disponible"));
    img.src = url;
  });
}
let baseEarth = null;
const earthBase = () => (baseEarth || (baseEarth = loadImageData("/earth.jpg").catch(() => null)));

export function SatelliteView({ lang = "es", lat, lon, placeName, tz = null }) {
  const tw = WX[lang] || WX.es;
  const [view, setView] = useState("globe");
  const [st, setSt] = useState({ status: "loading", time: null });
  const [zoneOk, setZoneOk] = useState(null);
  const canvasRef = useRef(null);
  const src = useMemo(() => pickSource(lon), [lon]);

  useEffect(() => {
    let alive = true;
    setSt({ status: "loading", time: null });
    (async () => {
      const latest = await fetchLatestTime(src);
      if (!alive) return;
      try {
        const box = globeBox(src, lon), base = await earthBase();
        // la hora anunciada a veces aún no tiene imagen: se prueba la anterior (y al final la de por defecto)
        let img = null, time = null;
        for (const cand of timeCandidates(latest, src)) {
          try { img = await loadImageData(wmsUrl(src, box, 1024, 1024, cand)); } catch { img = null; }
          if (!alive) return;
          if (img && dataFraction(img, !src.geo) > 0.15) { time = cand; break; }
        }
        if (!img) throw new Error("sin imagen");
        const cv = canvasRef.current; if (!cv) return;
        const S = Math.round(Math.min(2, window.devicePixelRatio || 1) * 300);
        cv.width = S; cv.height = S;
        const ctx = cv.getContext("2d"), out = ctx.createImageData(S, S);
        paintGlobe(out, img, box, base, lat, lon, { blackIsGap: !src.geo });
        ctx.putImageData(out, 0, 0);
        // el lugar: punto dorado en el centro
        ctx.lineWidth = Math.max(1.5, S / 260); ctx.strokeStyle = "rgba(242,196,109,.95)"; ctx.fillStyle = "#F2C46D";
        ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 70, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 28, 0, Math.PI * 2); ctx.stroke();
        setSt({ status: "ok", time });
      } catch { if (alive) setSt({ status: "error", time: null }); }
    })();
    return () => { alive = false; };
  }, [src, lat, lon]);

  const zoneUrl = useMemo(() => wmsUrl(src, regionBox(lat, lon, 4), 640, 640, st.time), [src, lat, lon, st.time]);
  const whenTxt = (() => {
    if (!st.time) return src.sat;
    if (!src.geo) return tw.satDay(src.sat, new Date(`${st.time}T12:00:00Z`).toLocaleDateString(lang === "es" ? "es-EC" : "en-US", { day: "numeric", month: "short" }));
    const d = new Date(st.time), min = (Date.now() - d.getTime()) / 60000;
    return tw.satWhen(src.sat, d.toLocaleTimeString(lang === "es" ? "es-EC" : "en-US", { hour: "2-digit", minute: "2-digit", ...tzOpt(tz) }), min > 0 ? tw.ago(min) : null);
  })();

  return (
    <div className="sk-wx-sat">
      <h4>{tw.satTitle}</h4>
      <div className="sk-seg sk-wx-seg" role="radiogroup">
        <button type="button" role="radio" aria-checked={view === "globe"} onClick={() => setView("globe")}>{tw.globe}</button>
        <button type="button" role="radio" aria-checked={view === "zone"} onClick={() => setView("zone")}>{tw.zone}</button>
      </div>
      <div className="sk-wx-stage">
        <canvas ref={canvasRef} className="sk-wx-globe" hidden={view !== "globe"} role="img" aria-label={tw.satAlt(placeName || tw.here)} />
        {view === "zone" && st.status !== "loading" && (
          <>
            <img className="sk-wx-zone" src={zoneUrl} alt={tw.satAlt(placeName || tw.here)} crossOrigin="anonymous"
              onLoad={() => setZoneOk(true)} onError={() => setZoneOk(false)} />
            <span className="sk-wx-pin" aria-hidden="true" />
            {placeName && <span className="sk-wx-pinlbl" aria-hidden="true">{placeName}</span>}
          </>
        )}
        {st.status === "loading" && <p className="sk-wx-msg" role="status">{tw.satLoading}</p>}
        {(st.status === "error" || (view === "zone" && zoneOk === false)) && <p className="sk-wx-msg" role="status">{tw.satError}</p>}
      </div>
      <p className="sk-wx-satwhen">{whenTxt}</p>
      <p className="sk-atm-fine">{src.geo ? tw.satGeo : tw.satViirs} {tw.satFill}</p>
      <p className="sk-atm-fine">{tw.satSource(src.by)}</p>
    </div>
  );
}

export default WeatherPanel;
