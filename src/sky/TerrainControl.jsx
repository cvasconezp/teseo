// TerrainControl.jsx — interruptor «Montañas» (horizonte real del lugar) en el panel de capas de la vista Cielo,
// con lo más alto de tu horizonte y la fuente. El estado vive en Constellations.jsx.
//   lang, available (hay lugar en Mi cielo), on, onToggle, hz: { status, data, error }, onRetry,
//   peaksOn, onTogglePeaks, peaks: { status, data } (nombres de las montañas, OpenStreetMap)
//   monOn, onToggleMon, monNear: monumentos cercanos (src/sky/monuments.js), monStatus: "loading" | "ok" | "error"
//   andOn, onToggleAnd, andean: { sun, sites } de andeanLabels() (src/sky/andean.js): «Astronomía andina»
import { highestPoint } from "./horizon.js";
import { compassPoint8 } from "./deviceOrientation.js";
import Icon from "./icons.jsx";
import { TX_AND } from "./andean.js";

const DIRS = {
  es: ["norte", "noreste", "este", "sureste", "sur", "suroeste", "oeste", "noroeste"],
  en: ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"],
};
const n1 = (v, lang) => Number(v).toLocaleString(lang === "es" ? "es" : "en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const n0 = (v, lang) => Math.round(v).toLocaleString(lang === "es" ? "es" : "en-US", { useGrouping: "always" });

export const TX_HZ = {
  es: {
    layer: "Montañas",
    sat: "Colores del satélite",
    satDesc: "Las laderas con su color real (pajonal, bosque, desierto, roca), con textura y la luz del momento.",
    satLoading: "Leyendo los colores del satélite…",
    satError: "No se pudieron leer los colores del satélite: el relieve va con sus colores de siempre.",
    satSource: "Colores: Sentinel-2 cloudless – https://s2maps.eu, de EOX IT Services GmbH (contiene datos modificados de Copernicus Sentinel de 2016 y 2017), CC BY 4.0.",
    desc: "El horizonte real de tu lugar, calculado con el relieve: estrellas, Sol y planetas salen y se esconden tras las montañas de verdad.",
    needPlace: "Necesita un lugar en Mi cielo.",
    loading: "Calculando tu horizonte…",
    error: "No se pudo calcular el horizonte ahora.",
    retry: "Reintentar",
    flat: "Tu horizonte es casi llano: las montañas no tapan más de 1°.",
    high: (alt, dir, top, from, to) => `Lo más alto de tu horizonte: ${alt}° hacia el ${dir}, una cumbre de ${top} m a entre ${from} y ${to} km.`,
    ground: (m) => `Altura de tu lugar en el modelo: ${m} m (más 1,7 m de los ojos).`,
    source: "Relieve: AWS Terrain Tiles (SRTM de la NASA, GMTED2010 del USGS y otros), hasta 150 km, con la curvatura de la Tierra y la refracción. Solo el relieve: no incluye árboles ni edificios.",
    peaks: "Nombres de las montañas",
    peaksDesc: "Nombre y altura de cada cumbre que ves.",
    peaksLoading: "Buscando los nombres (la primera vez puede tardar un poco)…",
    peaksError: "No se pudieron leer los nombres ahora.",
    peaksNone: "Ninguna cumbre con nombre forma tu horizonte.",
    peaksCount: (n) => `${n} ${n === 1 ? "cumbre con nombre" : "cumbres con nombre"} en tu horizonte.`,
    peaksSource: "Nombres: Wikidata (CC0) y © colaboradores de OpenStreetMap (ODbL). Solo se nombra la cumbre que forma la silueta.",
    mon: "Monumentos",
    monDesc: "Pirámides, Stonehenge… con sus medidas reales, en su sitio exacto.",
    monHere: (names) => `Desde aquí: ${names}. Forma simplificada; lo que queda detrás no se ve.`,
    monNone: "Hay monumentos en Teotihuacan, Chichén Itzá, Guiza, Stonehenge y Newgrange: búscalos en Mi cielo.",
    monLoading: "Asentando los monumentos sobre el terreno…",
    monError: "No se pudo leer el terreno bajo los monumentos.",
  },
  en: {
    layer: "Mountains",
    sat: "Satellite colours",
    satDesc: "Slopes in their real colour (grassland, forest, desert, rock), with texture and the light of the moment.",
    satLoading: "Reading the satellite colours…",
    satError: "Could not read the satellite colours: the relief keeps its usual colours.",
    satSource: "Colours: Sentinel-2 cloudless – https://s2maps.eu by EOX IT Services GmbH (contains modified Copernicus Sentinel data 2016 & 2017), CC BY 4.0.",
    desc: "Your place's real horizon, computed from the terrain: stars, the Sun and planets rise and set behind the actual mountains.",
    needPlace: "Needs a place in My sky.",
    loading: "Computing your horizon…",
    error: "Couldn't compute the horizon right now.",
    retry: "Retry",
    flat: "Your horizon is almost flat: mountains block no more than 1°.",
    high: (alt, dir, top, from, to) => `The highest point of your horizon: ${alt}° to the ${dir}, a ${top} m summit between ${from} and ${to} km away.`,
    ground: (m) => `Your place's height in the model: ${m} m (plus 1.7 m for your eyes).`,
    source: "Terrain: AWS Terrain Tiles (NASA SRTM, USGS GMTED2010 and others), out to 150 km, with Earth's curvature and refraction. Terrain only: no trees or buildings.",
    peaks: "Mountain names",
    peaksDesc: "Name and height of every summit you can see.",
    peaksLoading: "Looking up the names (the first time can take a while)…",
    peaksError: "Couldn't load the names right now.",
    peaksNone: "No named summit shapes your horizon.",
    peaksCount: (n) => `${n} named ${n === 1 ? "summit" : "summits"} on your horizon.`,
    peaksSource: "Names: Wikidata (CC0) and © OpenStreetMap contributors (ODbL). Only summits that shape the skyline are named.",
    mon: "Monuments",
    monDesc: "Pyramids, Stonehenge… at their real size and exact place.",
    monHere: (names) => `From here: ${names}. Simplified shapes; whatever is behind them is hidden.`,
    monNone: "There are monuments at Teotihuacan, Chichen Itza, Giza, Stonehenge and Newgrange: find them in My sky.",
    monLoading: "Placing the monuments on the terrain…",
    monError: "Couldn't read the terrain under the monuments.",
  },
};

// la banda anterior a la de `km` marca desde dónde (1,5 → «1,5»)
const bandFrom = (data, km, lang) => {
  const bs = (data.bands || []).map((b) => b.max_km), i = bs.indexOf(km);
  return i > 0 ? Number(bs[i - 1]).toLocaleString(lang === "es" ? "es" : "en-US") : "0";
};

export function TerrainControl({ lang = "es", available = true, on, onToggle, hz, onRetry, sat = null, peaksOn = false, onTogglePeaks, peaks, monOn = true, onToggleMon, monNear = [], monStatus = null, andOn = false, onToggleAnd, andean = null, lift = 0 }) {
  const ta = TX_AND[lang] || TX_AND.es;
  const tx = TX_HZ[lang] || TX_HZ.es;
  const data = hz && hz.status === "ok" ? hz.data : null;
  const hp = data ? highestPoint(data) : null;
  return (
    <div className="sk-hz">
      <div className="sk-layer">
        <button type="button" role="switch" aria-checked={!!on && available} disabled={!available} className="sk-layer-main" onClick={onToggle}>
          <i className="sk-dot sk-hz-dot" />
          <span className="sk-layer-txt"><b>{tx.layer}</b><small>{available ? tx.desc : tx.needPlace}</small></span>
          <span className="sk-count">{on && available && hp ? `${n1(hp.alt, lang)}°` : ""}</span>
          <i className="sk-switch" />
        </button>
      </div>
      {on && available && (
        <div className="sk-hz-box">
          {hz && hz.status === "loading" && <p className="sk-atm-fine" role="status">{tx.loading}</p>}
          {hz && hz.status === "error" && (
            <p className="sk-atm-fine" role="status">{tx.error}{" "}
              {onRetry && <button type="button" className="sk-wx-link" onClick={onRetry}><Icon name="retry" size={14} />{tx.retry}</button>}</p>
          )}
          {hp && (
            <>
              <p className="sk-hz-line">{hp.alt < 1 ? tx.flat
                : tx.high(n1(hp.alt, lang), (DIRS[lang] || DIRS.es)[compassPoint8(hp.az)], n0(hp.top_m, lang), bandFrom(data, hp.km, lang), n0(hp.km, lang))}</p>
              <p className="sk-atm-fine">{tx.ground(n0(data.ground_m, lang))}{lift > 0 ? ` ${lang === "en" ? `On summits the landscape is drawn from ${lift} m higher, as from a low tower, so the summit itself does not hide the view below.` : `En las cumbres el paisaje se dibuja desde ${lift} m más arriba, como desde una torre baja, para que la propia cima no tape la vista de abajo.`}` : ""}</p>
            </>
          )}
          <p className="sk-atm-fine">{tx.source}</p>
          {sat === "loading" && <p className="sk-atm-fine" role="status">{tx.satLoading}</p>}
          {sat === "error" && <p className="sk-atm-fine" role="status">{tx.satError}</p>}
          {sat === "ok" && <p className="sk-atm-fine">{tx.satSource}</p>}
          {onTogglePeaks && (
            <div className="sk-layer sk-hz-peaks">
              <button type="button" role="switch" aria-checked={!!peaksOn} className="sk-layer-main" onClick={onTogglePeaks}>
                <span className="sk-layer-txt"><b>{tx.peaks}</b><small>{tx.peaksDesc}</small></span>
                <i className="sk-switch" />
              </button>
            </div>
          )}
          {peaksOn && peaks && peaks.status === "loading" && <p className="sk-atm-fine" role="status">{tx.peaksLoading}</p>}
          {peaksOn && peaks && peaks.status === "error" && (
            <p className="sk-atm-fine" role="status">{tx.peaksError}{" "}
              {onRetry && <button type="button" className="sk-wx-link" onClick={onRetry}><Icon name="retry" size={14} />{tx.retry}</button>}</p>
          )}
          {peaksOn && peaks && peaks.status === "ok" && (
            <>
              <p className="sk-atm-fine">{peaks.data.peaks.length ? tx.peaksCount(peaks.data.peaks.length) : tx.peaksNone}</p>
              <p className="sk-atm-fine">{tx.peaksSource}</p>
            </>
          )}
          {onToggleMon && (
            <div className="sk-layer sk-hz-peaks">
              <button type="button" role="switch" aria-checked={!!monOn} className="sk-layer-main" onClick={onToggleMon}>
                <span className="sk-layer-txt"><b>{tx.mon}</b><small>{tx.monDesc}</small></span>
                <i className="sk-switch" />
              </button>
            </div>
          )}
          {onToggleMon && monOn && (!monNear.length ? <p className="sk-atm-fine">{tx.monNone}</p>
            : monStatus === "loading" ? <p className="sk-atm-fine" role="status">{tx.monLoading}</p>
            : monStatus === "error" ? <p className="sk-atm-fine" role="status">{tx.monError}{" "}
                {onRetry && <button type="button" className="sk-wx-link" onClick={onRetry}><Icon name="retry" size={14} />{tx.retry}</button>}</p>
            : <p className="sk-atm-fine">{tx.monHere(monNear.map((m) => m.name[lang] || m.name.es).join(", "))}</p>)}
          {onToggleAnd && (
            <div className="sk-layer sk-hz-peaks">
              <button type="button" role="switch" aria-checked={!!andOn} className="sk-layer-main" onClick={onToggleAnd}>
                <span className="sk-layer-txt"><b>{ta.layer}</b><small>{ta.desc}</small></span>
                <i className="sk-switch" />
              </button>
            </div>
          )}
          {onToggleAnd && andOn && andean && (
            <>
              <p className="sk-atm-fine">{andean.sites.length ? ta.near(andean.sites.length) : ta.none}</p>
              <p className="sk-atm-fine">{ta.caveat}</p>
              <p className="sk-atm-fine">{ta.source}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default TerrainControl;
