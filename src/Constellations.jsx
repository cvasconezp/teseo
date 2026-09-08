import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { ephemeris } from "./ephemeris.js";

const API = import.meta.env.VITE_API_URL || "";
const LAYERS = [
  { key: "messier",    file: "/deepsky.json",    es: "Messier",          en: "Messier",      color: 0x67e8c8, size: 8 },
  { key: "pulsars",    file: "/pulsars.json",    es: "Púlsares",         en: "Pulsars",      color: 0xff5dc8, size: 6, lazy: true },
  { key: "blackholes", file: "/blackholes.json", es: "Agujeros negros",  en: "Black holes",  color: 0xff7a3c, size: 11 },
  { key: "galaxies",   file: "/galaxies.json",   es: "Galaxias",         en: "Galaxies",     color: 0x9db4ff, size: 5, lazy: true },
  { key: "meteors",    file: "/meteorshowers.json", es: "Lluvias de meteoros", en: "Meteor showers", color: 0xffd27a, size: 9 },
  { key: "comets",     api: true, endpoint: "/api/comets", es: "Cometas", en: "Comets", color: 0x8be0ff, size: 9 },
  { key: "probes",     api: true, endpoint: "/api/probes", es: "Sondas y telescopios", en: "Probes & telescopes", color: 0xe6ebff, size: 10 },
  { key: "exoplanets", api: true, endpoint: "/api/exoplanets", es: "Exoplanetas", en: "Exoplanets", color: 0x4dd866, size: 6 },
];
const LABEL_COLOR = { con:"#c9b8ff", star:"#ffffff", obj_messier:"#67e8c8", obj_pulsars:"#ff5dc8", obj_blackholes:"#ff7a3c", obj_galaxies:"#9db4ff", obj_meteors:"#ffd27a", obj_comets:"#8be0ff", obj_probes:"#e6ebff", solar:"#ffe9a8" };

// Términos genéricos de categoría: al buscar "pulsar" o "agujero negro" se
// lista la capa entera en vez de exigir el nombre exacto de cada objeto.
const CATEGORY_TERMS = [
  { key: "pulsars",    terms: ["pulsar", "pulsares", "pulsars"] },
  { key: "blackholes", terms: ["agujero negro", "agujeros negros", "agujero", "hoyo negro", "black hole", "blackhole", "black holes"] },
  { key: "galaxies",   terms: ["galaxia", "galaxias", "galaxy", "galaxies"] },
  { key: "comets",     terms: ["cometa", "cometas", "comet", "comets"] },
  { key: "meteors",    terms: ["meteoro", "meteoros", "lluvia de meteoros", "lluvias", "meteor", "meteor shower"] },
  { key: "messier",    terms: ["messier", "nebulosa", "nebulosas", "cúmulo", "cumulo", "cúmulos", "nebula", "cluster"] },
  { key: "exoplanets", terms: ["exoplaneta", "exoplanetas", "exoplanet", "exoplanets"] },
  { key: "probes",     terms: ["sonda", "sondas", "telescopio", "telescopios", "nave", "probe", "probes", "spacecraft", "telescope", "voyager"] },
];
function labelForObj(key, o) {
  if (key === "messier") return `${o.name}${o.cn ? " · " + o.cn : ""}`;
  if (key === "galaxies") return o.name + (o.cat && o.cat !== o.name ? " · " + o.cat : "");
  return o.name;
}

// Una lluvia está activa si hoy (MM-DD) cae en [start, end]; la ventana puede
// cruzar el fin de año (p. ej. Cuadrántidas 12-28 -> 01-12).
function meteorActive(o, now = new Date()) {
  const md = String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
  return o.start <= o.end ? (md >= o.start && md <= o.end) : (md >= o.start || md <= o.end);
}
const MONTHS_ES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
const MONTHS_EN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function fmtMD(md, lang) {
  const [m, d] = md.split("-").map(Number);
  const mon = (lang === "es" ? MONTHS_ES : MONTHS_EN)[m - 1];
  return lang === "es" ? `${d} ${mon}` : `${mon} ${d}`;
}

const TOUR = [
  { type: "con", ab: "Ori", title: { es: "Orión, el cazador", en: "Orion the Hunter" } },
  { type: "star", name: "Betelgeuse", title: { es: "Betelgeuse", en: "Betelgeuse" } },
  { type: "star", name: "Rigel", title: { es: "Rigel", en: "Rigel" } },
  { type: "messier", m: 42, title: { es: "Nebulosa de Orión", en: "Orion Nebula" } },
  { type: "star", name: "Sirius", title: { es: "Sirio, la estrella más brillante", en: "Sirius, the brightest star" } },
  { type: "messier", m: 45, title: { es: "Las Pléyades", en: "The Pleiades" } },
  { type: "bh", name: "Sgr A*", title: { es: "El centro de la Vía Láctea", en: "The Galactic Center" } },
  { type: "messier", m: 31, title: { es: "Galaxia de Andrómeda", en: "Andromeda Galaxy" } },
];
function resolveStop(stop, ref, sky, datasets) {
  if (!ref || !sky) return null;
  if (stop.type === "con") {
    const c = ref.conCentroid && ref.conCentroid[stop.ab]; if (!c || !c.idxs.length) return null;
    let x = 0, y = 0, z = 0; for (const i of c.idxs) { x += ref.posFlat[i*3]; y += ref.posFlat[i*3+1]; z += ref.posFlat[i*3+2]; }
    const L = Math.hypot(x, y, z) || 1;
    return { dir: [x/L, y/L, z/L], dist: null, type: "con" };
  }
  if (stop.type === "star") {
    const st = sky.stars.find(s => s[7] === stop.name); if (!st) return null;
    return { dir: [st[1], st[2], st[3]], dist: st[6], type: "star" };
  }
  if (stop.type === "messier") {
    const o = datasets.messier && datasets.messier.objects.find(o => o.m === stop.m); if (!o) return null;
    return { dir: [o.nx, o.ny, o.nz], dist: o.dist_ly, type: "messier" };
  }
  if (stop.type === "bh") {
    const o = datasets.blackholes && datasets.blackholes.objects.find(o => o.name === stop.name); if (!o) return null;
    return { dir: [o.nx, o.ny, o.nz], dist: o.dist_ly, type: "bh" };
  }
  return null;
}
function gmstRad(date) {
  const JD = date.getTime() / 86400000 + 2440587.5;
  const T = JD - 2451545.0;
  let g = 280.46061837 + 360.98564736629 * T;
  g = ((g % 360) + 360) % 360;
  return g * Math.PI / 180;
}
// Cuaternión que mapea coordenadas ecuatoriales -> mundo local
// (Y = cenit, -Z = Norte, +X = Este) para una latitud/longitud y momento dados.
function localSkyQuat(latDeg, lonDeg, date) {
  const phi = latDeg * Math.PI / 180;
  const lst = gmstRad(date) + lonDeg * Math.PI / 180;
  const up = new THREE.Vector3(Math.cos(phi) * Math.cos(lst), Math.cos(phi) * Math.sin(lst), Math.sin(phi)).normalize();
  const ncp = new THREE.Vector3(0, 0, 1);
  const north = ncp.clone().sub(up.clone().multiplyScalar(ncp.dot(up)));
  if (north.lengthSq() < 1e-6) north.set(1, 0, 0); else north.normalize();
  const east = new THREE.Vector3().crossVectors(up, north).normalize();
  const B = new THREE.Matrix4().makeBasis(east, up, north.clone().multiplyScalar(-1));
  B.transpose();
  return new THREE.Quaternion().setFromRotationMatrix(B);
}
function makeTextSprite(text) {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "rgba(96,165,250,0.95)"; ctx.font = "bold 34px Inter, system-ui, sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, 32, 32);
  const tex = new THREE.CanvasTexture(c);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sp.scale.set(46, 46, 1); return sp;
}
const BODY_STYLE = { "Sol":["#ffd23f",24], "Luna":["#d8dde8",17], "Mercurio":["#b0a080",9], "Venus":["#ffe6b0",13], "Marte":["#ff6b4a",11], "Júpiter":["#e8c08a",16], "Saturno":["#e8d8a0",14], "Urano":["#a8e8e8",11], "Neptuno":["#6a8cff",11] };
function fmtInput(d) { const z = n => String(n).padStart(2, "0"); return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`; }
const wikiCache = {};
const SOLAR_WIKI = { "Sol":{es:"Sol",en:"Sun"}, "Luna":{es:"Luna",en:"Moon"}, "Mercurio":{es:"Mercurio (planeta)",en:"Mercury (planet)"}, "Venus":{es:"Venus (planeta)",en:"Venus"}, "Marte":{es:"Marte",en:"Mars"}, "Júpiter":{es:"Júpiter (planeta)",en:"Jupiter"}, "Saturno":{es:"Saturno (planeta)",en:"Saturn"}, "Urano":{es:"Urano (planeta)",en:"Uranus"}, "Neptuno":{es:"Neptuno (planeta)",en:"Neptune"} };
const BH_WIKI = { "Sgr A*":"Sagittarius A*", "M87*":"Messier 87", "M31* (Andrómeda)":"Andromeda Galaxy", "Gaia BH1":"Gaia BH1", "Gaia BH3":"Gaia BH3" };
function wikiTitle(obj, lang) {
  if (!obj) return null;
  if (obj.layer === "solar") { const m = SOLAR_WIKI[obj.name]; return m ? (m[lang] || m.en) : obj.name; }
  if (obj.layer === "messier") return `Messier ${obj.m}`;
  if (obj.layer === "star") return obj.name;
  if (obj.layer === "blackholes") return BH_WIKI[obj.name] || obj.name.split("(")[0].trim();
  if (obj.layer === "pulsars") return obj.name.split("(")[0].trim();
  if (obj.layer === "galaxies") {
    // nombre común si lo hay; si no, formatear el catálogo "NGC0055" -> "NGC 55"
    const cat = (obj.cat || obj.name || "").replace(/^(NGC|IC)0*(\d+)/i, "$1 $2");
    return obj.cat && obj.name !== obj.cat ? obj.name : cat;
  }
  if (obj.layer === "meteors") return lang === "es" ? (obj.wiki_es || obj.name) : (obj.name_en || obj.name);
  if (obj.layer === "comets") return obj.name.split("(").pop().replace(")", "").trim() || obj.name.split("/").pop();
  if (obj.layer === "probes") return obj.name.split("(")[0].trim();
  return obj.name;
}
async function fetchWiki(title, lang) {
  const key = lang + ":" + title;
  if (wikiCache[key]) return wikiCache[key];
  const host = lang === "es" ? "es.wikipedia.org" : "en.wikipedia.org";
  const url = `https://${host}/w/api.php?action=query&prop=pageimages%7Cextracts&exintro&explaintext&redirects=1&piprop=thumbnail&pithumbsize=360&format=json&origin=*&titles=${encodeURIComponent(title)}`;
  try {
    const r = await fetch(url); const d = await r.json();
    const pg = Object.values(d.query.pages)[0];
    const res = { title: pg.title, thumb: (pg.thumbnail || {}).source || null, extract: pg.extract || "", url: `https://${host}/wiki/${encodeURIComponent(pg.title)}`, missing: pg.missing !== undefined };
    wikiCache[key] = res; return res;
  } catch { return null; }
}
function nowLocalInput() {
  const d = new Date(); const z = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;
}
function fmtYears(y, lang) {
  const es = lang === "es";
  const u = es ? "años" : "yr";
  if (!y || y <= 0) return "—";
  if (y < 1000) return `${Math.round(y)} ${u}`;
  if (y < 1e6) return `${(y / 1000).toFixed(1)} mil ${u}`;
  if (y < 1e9) return `${(y / 1e6).toFixed(2)} M ${u}`;
  return `${(y / 1e9).toFixed(2)} G ${u}`;
}
function fmtMass(m) {
  if (m >= 1e9) return `${(m / 1e9).toFixed(1)} mil M`;
  if (m >= 1e6) return `${(m / 1e6).toFixed(1)} M`;
  if (m >= 1e3) return `${(m / 1e3).toFixed(0)} mil`;
  return `${m}`;
}
const TYPE_ES = { galaxy:"Galaxia", globular:"Cúmulo globular", open:"Cúmulo abierto", nebula:"Nebulosa", snr:"Remanente de supernova", cluster:"Cúmulo/asociación", other:"Objeto" };
function fmtDist(ly, lang) {
  const es = lang === "es";
  if (!ly || ly <= 0) return es ? "distancia n/d" : "distance n/a";
  const u = es ? "años luz" : "ly";
  if (ly < 1000) return `${Math.round(ly)} ${u}`;
  if (ly < 1e6) return `${(ly / 1000).toFixed(1)} mil ${u}`;
  if (ly < 1e9) return `${(ly / 1e6).toFixed(2)} M ${u}`;
  return `${(ly / 1e9).toFixed(2)} G ${u}`;
}

// ─── i18n ──────────────────────────────────────────────────────────────
const TC = {
  en: {
    title: "Constellations in real depth",
    intro: "The stars of a constellation look like a flat drawing — but they sit at wildly different distances. Pick one and pull the slider to see its true 3D shape.",
    pick: "Constellation",
    all: "Whole sky",
    flat: "As seen from Earth",
    depth: "Real depth",
    lightyears: "light-years",
    away: "away",
    from: "Distance from Earth",
    dragHint: "Drag to orbit · scroll to zoom",
    note: "Star positions & distances: real (HYG / Hipparcos). 3D depth uses a logarithmic scale of the real distance so it stays viewable — the distances shown are the real ones.",
    loading: "Loading the real sky…",
    nearest: "Nearest", farthest: "Farthest", spread: "Depth spread",
  },
  es: {
    title: "Constelaciones en profundidad real",
    intro: "Las estrellas de una constelación parecen un dibujo plano — pero están a distancias muy distintas. Elige una y mueve el control para ver su forma 3D real.",
    pick: "Constelación",
    all: "Todo el cielo",
    flat: "Como se ve desde la Tierra",
    depth: "Profundidad real",
    lightyears: "años luz",
    away: "de distancia",
    from: "Distancia desde la Tierra",
    dragHint: "Arrastra para girar · rueda para acercar",
    note: "Posiciones y distancias estelares: reales (HYG / Hipparcos). La profundidad 3D usa una escala logarítmica de la distancia real para que sea visualizable — las distancias mostradas son las reales.",
    loading: "Cargando el cielo real…",
    nearest: "Más cercana", farthest: "Más lejana", spread: "Rango de profundidad",
  },
};

const FLAT_R = 900;
const BG_R = 1000;
function depthRadius(d) {
  if (!d || d <= 0) return FLAT_R;
  const dd = Math.min(d, 4000);
  const r = 50 + 13 * Math.sqrt(dd);   // raíz cuadrada: más cerca = más cerca, spread visible
  return Math.max(60, Math.min(1000, r));
}
function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export default function Constellations({ lang = "es" }) {
  const t = TC[lang];
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const [sky, setSky] = useState(null);
  const [sel, setSel] = useState(null);      // abbr or null
  const [depth, setDepth] = useState(0);     // 0..1
  const [labels, setLabels] = useState([]);  // projected labels
  const [ready, setReady] = useState(false);
  const [datasets, setDatasets] = useState({}); // key -> {objects}
  const [enabled, setEnabled] = useState({});   // key -> bool
  const [selObj, setSelObj] = useState(null);
  const [viewFrom, setViewFrom] = useState(null); // null = Tierra; {name,pos:[x,y,z]} = otra estrella
  const [wiki, setWiki] = useState(null);
  const [localMode, setLocalMode] = useState(false);
  const [lat, setLat] = useState(null);
  const [lon, setLon] = useState(null);
  const [whenStr, setWhenStr] = useState(nowLocalInput());
  const [playing, setPlaying] = useState(false);
  const [showSolar, setShowSolar] = useState(true);
  const bodies = useMemo(() => ephemeris(new Date(whenStr)), [whenStr]);
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [showHint, setShowHint] = useState(() => { try { return !localStorage.getItem("teseo_hint_v1"); } catch { return true; } });
  const dismissHint = useCallback(() => { setShowHint(false); try { localStorage.setItem("teseo_hint_v1", "1"); } catch { /* no-op */ } }, []);
  const pendingObjRef = useRef(null);   // objeto a restaurar desde la URL
  const hydratedRef = useRef(false);     // no escribir el hash antes de leerlo
  const [labelDensity, setLabelDensity] = useState("normal");
  const [tourActive, setTourActive] = useState(false);
  const [tourIndex, setTourIndex] = useState(0);
  const [tourAuto, setTourAuto] = useState(true);
  const [tourTitle, setTourTitle] = useState("");
  const [tourText, setTourText] = useState(null);
  // abreviatura IAU (p.ej. "Sgr") -> nombre de constelación, para que buscar
  // "sagit(tarius)" encuentre objetos cuyo nombre usa la abreviatura ("Sgr A*").
  const abbrevExpand = useMemo(() => {
    const m = {};
    if (sky) for (const c of sky.constellations) m[c.ab.toLowerCase()] = (c.la + " " + c.en).toLowerCase();
    return m;
  }, [sky]);

  // término de categoría detectado (para listar la capa entera)
  const catMatch = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 3) return null;
    return CATEGORY_TERMS.find(c => c.terms.some(t => t.startsWith(q) || t === q || t.includes(q))) || null;
  }, [query]);

  // si se busca una categoría cuya capa aún no está cargada (diferida/backend),
  // se activa para poder listarla en los resultados.
  useEffect(() => {
    if (catMatch && !datasets[catMatch.key]) {
      setEnabled(e => e[catMatch.key] ? e : ({ ...e, [catMatch.key]: true }));
    }
  }, [catMatch, datasets]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2 || !sky) return [];
    // búsqueda por categoría: lista los objetos de esa capa
    if (catMatch) {
      const ds = datasets[catMatch.key];
      const layerName = LAYERS.find(l => l.key === catMatch.key)?.[lang] || catMatch.key;
      if (!ds || !ds.objects) {
        return [{ type: "loading", label: (lang === "es" ? "Cargando " : "Loading ") + layerName + "…" }];
      }
      return ds.objects.slice(0, 14).map(o => ({ type: "layer", layer: catMatch.key, obj: o, label: labelForObj(catMatch.key, o) }));
    }
    // texto extra de la constelación asociada (por campo `const` o por la
    // primera palabra del nombre si es una abreviatura IAU de 3 letras)
    const conExp = (name, constAb) => {
      let extra = "";
      if (constAb && abbrevExpand[constAb.toLowerCase()]) extra += " " + abbrevExpand[constAb.toLowerCase()];
      const first = (name || "").split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g, "");
      if (first.length === 3 && abbrevExpand[first]) extra += " " + abbrevExpand[first];
      return extra;
    };
    const score = (label) => {
      const l = label.toLowerCase();
      return l.startsWith(q) ? 0 : (" " + l).includes(" " + q) ? 1 : 2;
    };
    const r = [];
    for (const c of sky.constellations) if ((c.la + " " + c.en).toLowerCase().includes(q)) r.push({ type: "con", ab: c.ab, label: `${c.la} · ${c.en}` });
    for (const st of sky.stars) if (st[7] && st[7].toLowerCase().includes(q)) r.push({ type: "star", nx: st[1], ny: st[2], nz: st[3], dist: st[6], label: st[7] });
    for (const b of bodies) if (b.name.toLowerCase().includes(q)) r.push({ type: "solar", body: b, label: b.name });
    // capas de objetos: Messier / agujeros negros / meteoros siempre están
    // cargadas; púlsares y galaxias solo si el usuario activó su capa.
    const objLayers = [
      ["messier",    (o) => `${o.name}${o.cn ? " · " + o.cn : ""}`],
      ["blackholes", (o) => o.name],
      ["meteors",    (o) => o.name],
      ["galaxies",   (o) => o.name + (o.cat && o.cat !== o.name ? " · " + o.cat : "")],
      ["pulsars",    (o) => o.name],
      ["comets",     (o) => o.name],
      ["probes",     (o) => o.name],
    ];
    for (const [key, labelFn] of objLayers) {
      const ds = datasets[key];
      if (!ds || !ds.objects) continue;
      for (const o of ds.objects) {
        const hay = (o.name + " " + (o.cn || "") + " " + (o.cat || "") + " " + (o.name_en || "") + conExp(o.name, o.const)).toLowerCase();
        if (hay.includes(q)) r.push({ type: "layer", layer: key, obj: o, label: labelFn(o) });
      }
      if (r.length > 60) break;
    }
    r.sort((a, b) => score(a.label) - score(b.label));
    return r.slice(0, 8);
  }, [query, sky, datasets, bodies, abbrevExpand, catMatch, lang]);
  const depthRef = useRef(0);
  const selRef = useRef(null);

  useEffect(() => { depthRef.current = depth; }, [depth]);
  useEffect(() => { selRef.current = sel; }, [sel]);

  const [loadingLayer, setLoadingLayer] = useState({});
  // Carga inicial: solo la base + catálogos pequeños (Messier/agujeros negros, ~20 KB).
  // Los catálogos grandes (púlsares ~500KB, galaxias ~320KB) y los del backend
  // (exoplanetas ~780KB) se cargan solo al activar su capa.
  useEffect(() => {
    fetch("/sky.json").then(r => r.json()).then(setSky).catch(() => {});
    LAYERS.filter(c => !c.api && !c.lazy).forEach((cfg) => {
      fetch(cfg.file).then(r => r.json())
        .then(d => setDatasets(prev => ({ ...prev, [cfg.key]: d })))
        .catch(() => {});
    });
  }, []);
  // Capas pesadas: bajo demanda. Fichero estático (lazy) o backend (api).
  useEffect(() => {
    LAYERS.filter(c => c.api || c.lazy).forEach((cfg) => {
      if (enabled[cfg.key] && !datasets[cfg.key] && !loadingLayer[cfg.key]) {
        if (cfg.api && !API) return;
        setLoadingLayer(p => ({ ...p, [cfg.key]: true }));
        const url = cfg.api ? `${API}${cfg.endpoint}` : cfg.file;
        fetch(url).then(r => r.json())
          .then(d => setDatasets(prev => ({ ...prev, [cfg.key]: d })))
          .catch(() => {})
          .finally(() => setLoadingLayer(p => ({ ...p, [cfg.key]: false })));
      }
    });
  }, [enabled, datasets, loadingLayer]);

  // ── deep-links: leer el estado del hash al montar ──
  useEffect(() => {
    try {
      const h = window.location.hash || "";
      const qi = h.indexOf("?");
      if (qi >= 0) {
        const p = new URLSearchParams(h.slice(qi + 1));
        const L = p.get("L"); if (L) setEnabled(e => { const n = { ...e }; L.split(",").forEach(k => { if (k) n[k] = true; }); return n; });
        const c = p.get("c"); if (c) setSel(c);
        const v = p.get("v"); if (v) { const q = v.split("~"); const pos = [+q[1], +q[2], +q[3]]; if (pos.every(Number.isFinite)) setViewFrom({ name: decodeURIComponent(q[0]), pos }); }
        const o = p.get("o"); if (o) pendingObjRef.current = o;
      }
    } catch { /* hash inválido: se ignora */ }
    hydratedRef.current = true;
  }, []);

  // restaurar el objeto seleccionado del hash cuando lleguen los datos
  useEffect(() => {
    const o = pendingObjRef.current; if (!o || !sky) return;
    const sep = o.indexOf("~"); if (sep < 0) { pendingObjRef.current = null; return; }
    const layer = o.slice(0, sep), name = decodeURIComponent(o.slice(sep + 1));
    if (layer === "star") {
      const st = sky.stars.find(s => s[7] === name);
      if (st) { setSelObj({ name: st[7], nx: st[1], ny: st[2], nz: st[3], dist_ly: st[6], layer: "star" }); pendingObjRef.current = null; }
      return;
    }
    if (!enabled[layer]) { setEnabled(e => ({ ...e, [layer]: true })); return; } // esperar a que cargue
    const ds = datasets[layer];
    if (ds && ds.objects) {
      const ob = ds.objects.find(x => x.name === name);
      if (ob) setSelObj({ ...ob, layer });
      pendingObjRef.current = null;
    }
  }, [sky, datasets, enabled]);

  // escribir el estado al hash (para compartir el enlace)
  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      const p = new URLSearchParams();
      const on = Object.keys(enabled).filter(k => enabled[k]);
      if (on.length) p.set("L", on.join(","));
      if (sel) p.set("c", sel);
      if (viewFrom) p.set("v", encodeURIComponent(viewFrom.name) + "~" + viewFrom.pos.map(n => n.toFixed(3)).join("~"));
      if (selObj && selObj.name && selObj.layer !== "solar") p.set("o", selObj.layer + "~" + encodeURIComponent(selObj.name));
      const qs = p.toString();
      const nh = "#sky" + (qs ? "?" + qs : "");
      if (window.location.hash !== nh) window.history.replaceState(null, "", nh);
    } catch { /* no-op */ }
  }, [enabled, sel, viewFrom, selObj]);

  const shareLink = useCallback(() => {
    try {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true); setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard no disponible */ }
  }, []);

  // Build scene once data is ready
  useEffect(() => {
    if (!sky || !mountRef.current) return;
    const mount = mountRef.current;
    const W = mount.clientWidth, H = mount.clientHeight;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x04080f, 0.00018);
    const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 6000);
    camera.position.set(0, 0, 1700);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.5;
    controls.minDistance = 50;
    controls.maxDistance = 3000;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.15;

    // index stars by hip
    const byHip = new Map();
    sky.stars.forEach(s => byHip.set(s[0], s));
    const asterHips = new Set();
    sky.constellations.forEach(c => c.lines.forEach(p => p.forEach(h => asterHips.add(h))));

    // ── background + asterism star points ──
    const N = sky.stars.length;
    const posFlat = new Float32Array(N * 3);
    const posDeep = new Float32Array(N * 3);
    const colors = new Float32Array(N * 3);
    const sizes = new Float32Array(N);
    const hipIndex = new Map();
    sky.stars.forEach((s, i) => {
      const [hip, nx, ny, nz, mag, hex, dist] = s;
      hipIndex.set(hip, i);
      const rf = FLAT_R, rd = depthRadius(dist);
      posFlat[i*3] = nx*rf; posFlat[i*3+1] = ny*rf; posFlat[i*3+2] = nz*rf;
      posDeep[i*3] = nx*rd; posDeep[i*3+1] = ny*rd; posDeep[i*3+2] = nz*rd;
      let [r,g,b] = hexToRgb(hex);
      const isAster = asterHips.has(hip);
      let bright = Math.max(0.16, Math.min(1, 1.5 - mag * 0.16));
      if (isAster) bright = Math.max(bright, 0.85);
      colors[i*3]=r*bright; colors[i*3+1]=g*bright; colors[i*3+2]=b*bright;
      sizes[i] = isAster ? Math.max(3.0, 9.5 - mag * 0.8) : Math.max(0.8, 5.2 - mag * 0.62);
    });
    // precálculo para etiquetas LOD
    const namedStars = [];
    sky.stars.forEach((st, i) => { if (st[7]) namedStars.push({ i, mag: st[4], name: st[7] }); });
    const conCentroid = {};
    sky.constellations.forEach(c => {
      const idxs = []; const seen = new Set();
      c.lines.forEach(pl => pl.forEach(h => { if (!seen.has(h)) { seen.add(h); const ii = hipIndex.get(h); if (ii != null) idxs.push(ii); } }));
      conCentroid[c.ab] = { idxs, name: c.la };
    });

    const sGeo = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(posFlat.slice(), 3);
    sGeo.setAttribute("position", posAttr);
    sGeo.setAttribute("scolor", new THREE.BufferAttribute(colors, 3));
    sGeo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
    const starTex = makeStarTexture();
    const sMat = new THREE.ShaderMaterial({
      uniforms: { map: { value: starTex } },
      vertexShader: [
        "attribute float size;",
        "attribute vec3 scolor;",
        "varying vec3 vColor;",
        "void main(){",
        "  vColor = scolor;",
        "  vec4 mv = modelViewMatrix * vec4(position,1.0);",
        "  gl_PointSize = clamp(size * (520.0 / -mv.z), 0.6, 16.0);",
        "  gl_Position = projectionMatrix * mv;",
        "}",
      ].join("\n"),
      fragmentShader: [
        "uniform sampler2D map;",
        "varying vec3 vColor;",
        "void main(){",
        "  vec4 t = texture2D(map, gl_PointCoord);",
        "  if (t.a < 0.02) discard;",
        "  gl_FragColor = vec4(vColor, 1.0) * t;",
        "}",
      ].join("\n"),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(sGeo, sMat);
    scene.add(points);

    // ── constellation lines ──
    const segHips = []; // pairs of hip
    const conMeta = {};
    sky.constellations.forEach(c => {
      conMeta[c.ab] = c;
      c.lines.forEach(poly => {
        for (let k = 0; k < poly.length - 1; k++) {
          if (hipIndex.has(poly[k]) && hipIndex.has(poly[k+1]))
            segHips.push([poly[k], poly[k+1], c.ab]);
        }
      });
    });
    const L = segHips.length;
    const lPos = new Float32Array(L * 6);
    const lCol = new Float32Array(L * 6);
    const lGeo = new THREE.BufferGeometry();
    lGeo.setAttribute("position", new THREE.BufferAttribute(lPos, 3));
    lGeo.setAttribute("color", new THREE.BufferAttribute(lCol, 3));
    const lMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55 });
    const lines = new THREE.LineSegments(lGeo, lMat);
    scene.add(lines);

    // Tierra real (NASA Blue Marble) en el centro = el observador
    const earthTex = new THREE.TextureLoader().load("/earth.jpg");
    earthTex.colorSpace = THREE.SRGBColorSpace;
    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(7, 48, 48),
      new THREE.MeshBasicMaterial({ map: earthTex })
    );
    earth.rotation.z = 0.41;
    scene.add(earth);

    // grupo de horizonte (modo cielo local)
    const horizon = new THREE.Group();
    const harr = [];
    for (let i = 0; i <= 128; i++) { const a = i / 128 * Math.PI * 2; harr.push(Math.cos(a) * 905, 0, Math.sin(a) * 905); }
    const ringGeo = new THREE.BufferGeometry();
    ringGeo.setAttribute("position", new THREE.Float32BufferAttribute(harr, 3));
    horizon.add(new THREE.Line(ringGeo, new THREE.LineBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.5 })));
    const ground = new THREE.Mesh(new THREE.CircleGeometry(905, 96),
      new THREE.MeshBasicMaterial({ color: 0x05070e, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -1.5; horizon.add(ground);
    [["N", 0, -905], ["E", 905, 0], ["S", 0, 905], ["O", -905, 0]].forEach(([tt, x, z]) => {
      const sp = makeTextSprite(tt); sp.position.set(x, 20, z); horizon.add(sp);
    });
    horizon.visible = false; scene.add(horizon);

    // Sol, Luna y planetas (efemérides reales)
    const solarGroup = new THREE.Group(); scene.add(solarGroup);
    const solarSprites = {};
    Object.keys(BODY_STYLE).forEach(nm => {
      const [col, sz] = BODY_STYLE[nm];
      const c = document.createElement("canvas"); c.width = c.height = 64; const cx2 = c.getContext("2d");
      const g = cx2.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, "#ffffff"); g.addColorStop(0.3, col); g.addColorStop(0.75, col); g.addColorStop(1, "rgba(0,0,0,0)");
      cx2.fillStyle = g; cx2.beginPath(); cx2.arc(32, 32, 30, 0, Math.PI * 2); cx2.fill();
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false }));
      sp.scale.set(sz * 2.2, sz * 2.2, 1);
      solarGroup.add(sp); solarSprites[nm] = sp;
    });

    // ── el Sol visto desde otro punto (oculto salvo en "ver desde otra estrella") ──
    const sunSprite = (() => {
      const c = document.createElement("canvas"); c.width = c.height = 64;
      const cx2 = c.getContext("2d");
      const g = cx2.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, "#ffffff"); g.addColorStop(0.3, "#fff2b0");
      g.addColorStop(0.8, "#ffcf5a"); g.addColorStop(1, "rgba(0,0,0,0)");
      cx2.fillStyle = g; cx2.beginPath(); cx2.arc(32, 32, 30, 0, Math.PI * 2); cx2.fill();
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false }));
      sp.scale.set(24, 24, 1); sp.visible = false; scene.add(sp);
      return sp;
    })();

    // Reproyecta TODO el cielo desde un nuevo punto de observación, por paralaje
    // real: cada estrella tiene posición 3D = dirección × distancia_ly, así que
    // desde el nuevo origen su dirección y distancia se recalculan de verdad.
    // origin = [x,y,z] en años luz, o null para volver a la Tierra/Sol.
    const applyViewpoint = (origin) => {
      const stars = sky.stars;
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        let dirx = s[1], diry = s[2], dirz = s[3], dd = s[6];
        if (origin && s[6] > 0) {
          const dx = s[1] * s[6] - origin[0], dy = s[2] * s[6] - origin[1], dz = s[3] * s[6] - origin[2];
          const len = Math.hypot(dx, dy, dz);
          if (len > 1e-6) { dirx = dx / len; diry = dy / len; dirz = dz / len; dd = len; }
        }
        const rd = depthRadius(dd);
        posFlat[i*3] = dirx*FLAT_R; posFlat[i*3+1] = diry*FLAT_R; posFlat[i*3+2] = dirz*FLAT_R;
        posDeep[i*3] = dirx*rd; posDeep[i*3+1] = diry*rd; posDeep[i*3+2] = dirz*rd;
      }
      // El Sol: desde otra estrella es una estrella más, en dirección -origin, a |origin| ly.
      if (origin) {
        const len = Math.hypot(origin[0], origin[1], origin[2]) || 1;
        sunSprite.position.set(-origin[0]/len*FLAT_R, -origin[1]/len*FLAT_R, -origin[2]/len*FLAT_R);
        sunSprite.visible = true; if (earth) earth.visible = false;
      } else {
        sunSprite.visible = false; if (earth) earth.visible = true;
      }
      posAttr.needsUpdate = true;
    };

    sceneRef.current = { scene, camera, renderer, controls, points, lines,
      posFlat, posDeep, posAttr, segHips, hipIndex, conMeta, lPos, lCol, byHip, sizes, N,
      markerTex: starTex, layerObjs: [], namedStars, conCentroid, horizon, localQuat: new THREE.Quaternion(), localModeOn: false, earth, solarGroup, solarSprites, bodies: [], showSolar: true,
      sunSprite, applyViewpoint };
    setReady(true);

    // resize
    const onResize = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      camera.aspect = w / h; camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    // animation
    let raf;
    const tmp = new THREE.Vector3();
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const ref = sceneRef.current; if (!ref) return;
      if (ref.earth) ref.earth.rotation.y += 0.0006;
      const dpt = depthRef.current;
      const selAb = selRef.current;
      // Rendimiento: las posiciones de estrellas/líneas solo cambian con la
      // profundidad, la selección o el punto de observación. Si nada de eso
      // cambió, no reescribimos ~15k floats por frame (la cámara igual gira).
      const pa = ref.posAttr.array;
      const rebuild = dpt !== ref._lastDpt || selAb !== ref._lastSel || ref._dirty;
      if (rebuild) {
        for (let i = 0; i < ref.N * 3; i++) pa[i] = ref.posFlat[i] + (ref.posDeep[i] - ref.posFlat[i]) * dpt;
        ref.posAttr.needsUpdate = true;
        const selSet = selAb;
        for (let s = 0; s < ref.segHips.length; s++) {
          const [ha, hb, ab] = ref.segHips[s];
          const ia = ref.hipIndex.get(ha), ib = ref.hipIndex.get(hb);
          const hidden = selSet && ab !== selSet;
          if (hidden) {
            for (let q=0;q<6;q++) ref.lPos[s*6+q]=0;   // colapsar -> invisible
          } else {
            ref.lPos[s*6+0]=pa[ia*3]; ref.lPos[s*6+1]=pa[ia*3+1]; ref.lPos[s*6+2]=pa[ia*3+2];
            ref.lPos[s*6+3]=pa[ib*3]; ref.lPos[s*6+4]=pa[ib*3+1]; ref.lPos[s*6+5]=pa[ib*3+2];
          }
          let r,g,b;
          if (!selSet) { r=0.42;g=0.45;b=0.78; }
          else { r=0.70;g=0.58;b=1.0; }
          ref.lCol[s*6+0]=r; ref.lCol[s*6+1]=g; ref.lCol[s*6+2]=b;
          ref.lCol[s*6+3]=r; ref.lCol[s*6+4]=g; ref.lCol[s*6+5]=b;
        }
        ref.lines.geometry.attributes.position.needsUpdate = true;
        ref.lines.geometry.attributes.color.needsUpdate = true;
        ref._lastDpt = dpt; ref._lastSel = selAb; ref._dirty = false;
      }
      ref.controls.update();
      ref.renderer.render(ref.scene, ref.camera);
      // ── etiquetas con nivel de detalle (LOD) ──
      ref._lf = (ref._lf || 0) + 1;
      if (ref._lf < 4 || ref._lf % 5 === 0) {
        const W = mount.clientWidth, H = mount.clientHeight;
        const camDist = ref.camera.position.length();
        const out = [];
        const push = (x, y, z, name, cls, sub) => {
          tmp.set(x, y, z);
          if (ref.localQuat) tmp.applyQuaternion(ref.localQuat);
          tmp.project(ref.camera);
          if (tmp.z >= 1 || tmp.x < -1.05 || tmp.x > 1.05 || tmp.y < -1.05 || tmp.y > 1.05) return;
          const sx = (tmp.x * 0.5 + 0.5) * W, sy = (-tmp.y * 0.5 + 0.5) * H;
          for (const e of out) { if (Math.abs(e.x - sx) < 56 && Math.abs(e.y - sy) < 15) return; } // anti-solape
          out.push({ key: cls + ":" + name, name, cls, sub: sub == null ? null : sub, x: sx, y: sy });
        };
        if (selAb && ref.conMeta[selAb]) {
          collectNamed(ref.conMeta[selAb], ref.byHip).forEach(st => {
            const i = ref.hipIndex.get(st[0]);
            push(pa[i*3], pa[i*3+1], pa[i*3+2], st[7], "star", st[6]);
          });
        } else if (camDist > 820) {
          for (const ab in ref.conCentroid) {
            const c = ref.conCentroid[ab]; if (!c.idxs.length) continue;
            let cx=0, cy=0, cz=0;
            for (const i of c.idxs) { cx += pa[i*3]; cy += pa[i*3+1]; cz += pa[i*3+2]; }
            const n = c.idxs.length; push(cx/n, cy/n, cz/n, c.name, "con");
          }
        } else {
          const dens = ref.labelDensity || "normal";
          const magBoost = dens === "pocas" ? -1.2 : dens === "muchas" ? 1.3 : 0;
          const magT = 1.0 + (820 - camDist) / 770 * 5.2 + magBoost;
          const cand = ref.namedStars.filter(s => s.mag <= magT).sort((a, b) => a.mag - b.mag).slice(0, dens === "muchas" ? 70 : 38);
          for (const s of cand) push(pa[s.i*3], pa[s.i*3+1], pa[s.i*3+2], s.name, "star");
        }
        if (ref.showSolar) for (const b of (ref.bodies || [])) push(b.nx*860, b.ny*860, b.nz*860, b.name, "solar");
        if (camDist < 1050) {
          for (const o of (ref.layerObjs || [])) {
            if (!o.points.visible || o.key === "exoplanets") continue;
            const objs = o.points.userData.objs;
            for (let q = 0; q < objs.length && q < 200; q++) {
              const ob = objs[q];
              push(ob.nx*870, ob.ny*870, ob.nz*870, ob.name, "obj_" + o.key);
            }
          }
        }
        const dens2 = ref.labelDensity || "normal";
        setLabels(out.slice(0, dens2 === "pocas" ? 26 : dens2 === "muchas" ? 110 : 64));
      }
    };
    const labelsNonEmpty = { current: false };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
      setReady(false);
      sceneRef.current = null;
    };
  }, [sky]);

  // aplicar/quitar el punto de observación (paralaje real desde otra estrella)
  useEffect(() => {
    const ref = sceneRef.current;
    if (!ref || !ref.applyViewpoint) return;
    ref.applyViewpoint(viewFrom ? viewFrom.pos : null);
    ref._dirty = true;   // fuerza reconstruir posiciones/líneas en el próximo frame
  }, [viewFrom, ready]);

  // posiciona la cámara según la profundidad: 0 = vista desde la Tierra (plano),
  // 1 = vista lateral que REVELA la profundidad real en distancia.
  const positionCamera = useCallback((dpt) => {
    const ref = sceneRef.current;
    if (!ref || !ref.selCentroidDir || ref.localModeOn) return;
    const v = ref.selCentroidDir;
    const targetR = FLAT_R + (ref.selAvgR - FLAT_R) * dpt;
    const target = v.clone().multiplyScalar(targetR);
    const up = Math.abs(v.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const side = new THREE.Vector3().crossVectors(v, up).normalize();
    const angle = dpt * Math.PI * 0.42;            // hasta ~75° de giro lateral
    const dist = 520 + 200 * dpt;
    const dir = v.clone().multiplyScalar(-Math.cos(angle))
      .add(side.multiplyScalar(Math.sin(angle))).normalize();
    ref.camera.position.copy(target.clone().add(dir.multiplyScalar(dist)));
    ref.controls.target.copy(target);
    ref.controls.update();
  }, []);

  // al cambiar de constelación
  useEffect(() => {
    const ref = sceneRef.current;
    if (!ref) return;
    if (!sel) {
      ref.selCentroidDir = null;
      ref.controls.autoRotate = true;
      ref.controls.target.set(0, 0, 0);
      ref.camera.position.set(0, 0, 1700);
      ref.controls.update();
      return;
    }
    const c = ref.conMeta[sel]; if (!c) return;
    let cx=0,cy=0,cz=0,n=0,sumR=0,cnt=0;
    const seen=new Set();
    c.lines.forEach(p=>p.forEach(h=>{ if(!seen.has(h)){seen.add(h); const st=ref.byHip.get(h); if(st){cx+=st[1];cy+=st[2];cz+=st[3];n++; sumR+=depthRadius(st[6]); cnt++;}}}));
    if(n===0) return;
    ref.selCentroidDir = new THREE.Vector3(cx/n,cy/n,cz/n).normalize();
    ref.selAvgR = cnt ? sumR/cnt : FLAT_R;
    ref.controls.autoRotate = false;
    positionCamera(depthRef.current);
  }, [sel, positionCamera]);

  // al mover el slider de profundidad, gira la cámara para revelarla
  useEffect(() => {
    if (sel) positionCamera(depth);
  }, [depth, sel, positionCamera]);

  // construir los puntos de cada capa (marcadores en la esfera del cielo)
  useEffect(() => {
    const ref = sceneRef.current;
    if (!ref || !ref.scene) return;
    (ref.layerObjs || []).forEach(o => {
      ref.scene.remove(o.points); o.points.geometry.dispose(); o.points.material.dispose();
    });
    ref.layerObjs = [];
    const R = 870;
    LAYERS.forEach(cfg => {
      const data = datasets[cfg.key];
      if (!data || !data.objects) return;
      const groups = cfg.key === "exoplanets"
        ? [["exoplanets", data.objects.filter(o => !o.hab), cfg.color, 5],
           ["exoplanets", data.objects.filter(o => o.hab), 0xaaff7a, 12]]
        : [[cfg.key, data.objects, cfg.color, cfg.size]];
      groups.forEach(([gkey, list, color, size]) => {
        if (!list.length) return;
        const pos = new Float32Array(list.length * 3);
        list.forEach((o, i) => { pos[i*3]=o.nx*R; pos[i*3+1]=o.ny*R; pos[i*3+2]=o.nz*R; });
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        const m = new THREE.PointsMaterial({
          size, map: ref.markerTex, color, transparent: true, depthWrite: false,
          blending: THREE.AdditiveBlending, sizeAttenuation: true,
        });
        const pts = new THREE.Points(g, m);
        pts.visible = !!enabled[cfg.key];
        if (ref.localQuat) pts.quaternion.copy(ref.localQuat);
        pts.userData = { layer: cfg.key, objs: list };
        ref.scene.add(pts);
        ref.layerObjs.push({ key: cfg.key, points: pts });
      });
    });
  }, [datasets, ready]);

  // alternar visibilidad de capas
  useEffect(() => {
    const ref = sceneRef.current;
    if (!ref || !ref.layerObjs) return;
    ref.layerObjs.forEach(o => { o.points.visible = !!enabled[o.key]; });
  }, [enabled]);

  // acercar la cámara al objeto seleccionado (zoom) + traer ficha de Wikipedia
  useEffect(() => {
    const ref = sceneRef.current;
    if (!ref || !selObj) return;
    const v = new THREE.Vector3(selObj.nx, selObj.ny, selObj.nz);
    if (ref.localQuat) v.applyQuaternion(ref.localQuat);
    v.normalize();
    ref.controls.autoRotate = false;
    ref.controls.target.copy(v.clone().multiplyScalar(870));
    ref.camera.position.copy(v.clone().multiplyScalar(540));
    ref.controls.update();
  }, [selObj]);
  useEffect(() => {
    setWiki(null);
    if (!selObj) return;
    const title = wikiTitle(selObj, lang);
    if (!title) return;
    let cancel = false;
    (async () => {
      let w = await fetchWiki(title, lang);
      // exoplaneta sin página/imagen: intentar la estrella anfitriona
      if (!cancel && selObj.layer === "exoplanets" && (!w || w.missing || !w.thumb) && selObj.host) {
        const w2 = await fetchWiki(selObj.host, lang);
        if (w2 && (w2.thumb || !w2.missing)) w = w2;
      }
      if (!cancel) setWiki(w);
    })();
    return () => { cancel = true; };
  }, [selObj, lang]);

  // modo cielo local: rota todo a coordenadas alt/azimut y muestra el horizonte
  useEffect(() => {
    const ref = sceneRef.current;
    if (!ref || !ref.points) return;
    const active = localMode && lat != null && lon != null;
    const q = active ? localSkyQuat(lat, lon, new Date(whenStr)) : new THREE.Quaternion();
    ref.localQuat = q; ref.localModeOn = active;
    ref.points.quaternion.copy(q);
    ref.lines.quaternion.copy(q);
    (ref.layerObjs || []).forEach(o => o.points.quaternion.copy(q));
    if (ref.solarGroup) ref.solarGroup.quaternion.copy(q);
    if (ref.horizon) ref.horizon.visible = active;
    if (active) {
      ref.controls.autoRotate = false;
      ref.controls.target.set(0, 120, 0);
      ref.camera.position.set(0, 560, 1500);
      ref.controls.update();
    } else if (!sel) {
      ref.controls.autoRotate = true;
      ref.controls.target.set(0, 0, 0);
      ref.camera.position.set(0, 0, 1700);
      ref.controls.update();
    }
  }, [localMode, lat, lon, whenStr, ready, datasets, sel]);

  useEffect(() => {
    const ref = sceneRef.current;
    if (!ref || !ref.solarSprites) return;
    ref.bodies = bodies; ref.showSolar = showSolar;
    ref.solarGroup.visible = showSolar;
    bodies.forEach(b => { const sp = ref.solarSprites[b.name]; if (sp) sp.position.set(b.nx*860, b.ny*860, b.nz*860); });
    ref.solarGroup.quaternion.copy(ref.localQuat || new THREE.Quaternion());
  }, [bodies, showSolar, ready]);

  // animar el tiempo (play)
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setWhenStr(w => fmtInput(new Date(new Date(w).getTime() + 10 * 60000))), 120);
    return () => clearInterval(id);
  }, [playing]);
  const shiftMin = useCallback((m) => setWhenStr(w => fmtInput(new Date(new Date(w).getTime() + m * 60000))), []);
  useEffect(() => { if (sceneRef.current) sceneRef.current.labelDensity = labelDensity; }, [labelDensity]);
  const focusDir = useCallback((nx, ny, nz) => {
    const ref = sceneRef.current; if (!ref) return;
    const v = new THREE.Vector3(nx, ny, nz);
    if (ref.localQuat) v.applyQuaternion(ref.localQuat);
    v.normalize();
    ref.controls.autoRotate = false;
    ref.controls.target.copy(v.clone().multiplyScalar(870));
    ref.camera.position.copy(v.clone().multiplyScalar(390));
    ref.controls.update();
  }, []);
  const startTour = useCallback(() => { setSel(null); setSelObj(null); setTourAuto(true); setTourIndex(0); setTourActive(true); }, []);
  useEffect(() => {
    if (!tourActive) return;
    const ref = sceneRef.current; const stop = TOUR[tourIndex];
    const r = resolveStop(stop, ref, sky, datasets);
    if (!r) return;
    focusDir(r.dir[0], r.dir[1], r.dir[2]);
    const title = stop.title ? (stop.title[lang] || stop.title.es) : "";
    setTourTitle(title); setTourText(null);
    const tw = r.type === "con" ? (lang === "es" ? "la constelación de" : "the constellation") : r.type === "star" ? (lang === "es" ? "la estrella" : "the star") : "";
    const concept = `${tw} ${title}${r.dist ? `, ${lang === "es" ? "a" : "at"} ${fmtDist(r.dist, lang)} ${lang === "es" ? "de la Tierra" : "from Earth"}` : ""}`.trim();
    let cancel = false;
    fetch(`${API}/api/explain`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ concept, lang }) })
      .then(r => r.json()).then(d => { if (!cancel) setTourText(d.explanation || ""); }).catch(() => { if (!cancel) setTourText(""); });
    return () => { cancel = true; };
  }, [tourActive, tourIndex, sky, datasets, lang, focusDir]);
  useEffect(() => {
    if (!tourActive || !tourAuto) return;
    const id = setTimeout(() => setTourIndex(i => (i + 1) % TOUR.length), 15000);
    return () => clearTimeout(id);
  }, [tourActive, tourAuto, tourIndex]);

  const onResult = useCallback((res) => {
    if (res.type === "loading") return;   // fila informativa, no navegable
    setQuery("");
    if (res.type === "con") setSel(res.ab);
    else if (res.type === "star") setSelObj({ name: res.label, nx: res.nx, ny: res.ny, nz: res.nz, dist_ly: res.dist, layer: "star" });
    else if (res.type === "solar") { const b = res.body; setSelObj({ name: b.name, nx: b.nx, ny: b.ny, nz: b.nz, layer: "solar", dist_au: b.dist_au, illum: b.illum, waxing: b.waxing }); }
    else if (res.type === "messier") { setEnabled(e => ({ ...e, messier: true })); setSelObj({ ...res.obj, layer: "messier" }); }
    else if (res.type === "layer") { setEnabled(e => ({ ...e, [res.layer]: true })); setSelObj({ ...res.obj, layer: res.layer }); }
  }, []);

  // zoom con botones (dolly hacia/desde el objetivo actual; mantiene centrado
  // lo que esté en controls.target, p.ej. el objeto seleccionado)
  const zoomBy = useCallback((f) => {
    const ref = sceneRef.current; if (!ref) return;
    const { camera, controls } = ref;
    controls.autoRotate = false;
    const dir = camera.position.clone().sub(controls.target);
    let len = dir.length() * f;
    len = Math.max(controls.minDistance, Math.min(controls.maxDistance, len));
    camera.position.copy(controls.target.clone().add(dir.normalize().multiplyScalar(len)));
    controls.update();
  }, []);
  // centrar en el objeto seleccionado (o volver al centro si no hay ninguno)
  const recenter = useCallback(() => {
    const ref = sceneRef.current; if (!ref) return;
    if (selObj && selObj.nx != null) {
      const v = new THREE.Vector3(selObj.nx, selObj.ny, selObj.nz);
      if (ref.localQuat) v.applyQuaternion(ref.localQuat);
      v.normalize().multiplyScalar(870);
      ref.controls.target.copy(v);
    } else {
      ref.controls.target.set(0, 0, 0);
    }
    ref.controls.autoRotate = false;
    ref.controls.update();
  }, [selObj]);

  // rotar la vista con el teclado (accesibilidad)
  const orbitBy = useCallback((dAz, dPol) => {
    const ref = sceneRef.current; if (!ref) return;
    const { camera, controls } = ref; controls.autoRotate = false;
    const off = camera.position.clone().sub(controls.target);
    const sph = new THREE.Spherical().setFromVector3(off);
    sph.theta += dAz; sph.phi = Math.max(0.05, Math.min(Math.PI - 0.05, sph.phi + dPol));
    off.setFromSpherical(sph);
    camera.position.copy(controls.target.clone().add(off));
    controls.update();
  }, []);
  const onCanvasKey = useCallback((e) => {
    if (e.key === "Escape") { setSelObj(null); return; }
    if (e.key === "+" || e.key === "=") { e.preventDefault(); zoomBy(0.85); return; }
    if (e.key === "-" || e.key === "_") { e.preventDefault(); zoomBy(1.18); return; }
    const az = e.key === "ArrowLeft" ? -0.12 : e.key === "ArrowRight" ? 0.12 : 0;
    const pol = e.key === "ArrowUp" ? -0.09 : e.key === "ArrowDown" ? 0.09 : 0;
    if (az || pol) { e.preventDefault(); orbitBy(az, pol); }
  }, [orbitBy, zoomBy]);

  // postal del cielo: captura el lienzo en PNG con marca de Teseo y, si hay un
  // objeto seleccionado, sus datos (nombre, tipo, distancia, descripción).
  const savePostcard = useCallback(() => {
    const ref = sceneRef.current; if (!ref) return;
    ref.renderer.render(ref.scene, ref.camera);           // buffer fresco
    const src = ref.renderer.domElement;
    const W = src.width, H = src.height;
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#04080f"; ctx.fillRect(0, 0, W, H);
    ctx.drawImage(src, 0, 0);                              // el cielo (mismo origen)
    const es = lang === "es";
    const pad = Math.round(H * 0.045);
    const wrap = (text, maxW, font) => {
      ctx.font = font; const words = text.split(/\s+/); const lines = []; let cur = "";
      for (const w of words) { const t = cur ? cur + " " + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
      if (cur) lines.push(cur); return lines;
    };

    // franja inferior para legibilidad
    const grad = ctx.createLinearGradient(0, H * 0.52, 0, H);
    grad.addColorStop(0, "rgba(4,8,15,0)"); grad.addColorStop(1, "rgba(4,8,15,0.94)");
    ctx.fillStyle = grad; ctx.fillRect(0, Math.round(H * 0.52), W, H);
    ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";

    if (selObj && selObj.name) {
      const TYPE = {
        star: es ? "Estrella" : "Star", galaxies: es ? "Galaxia" : "Galaxy",
        blackholes: es ? "Agujero negro" : "Black hole", pulsars: es ? "Púlsar" : "Pulsar",
        messier: es ? "Objeto Messier" : "Messier object", meteors: es ? "Lluvia de meteoros" : "Meteor shower",
        comets: es ? "Cometa" : "Comet", probes: es ? "Sonda / telescopio" : "Probe / telescope",
        exoplanets: es ? "Exoplaneta" : "Exoplanet", solar: es ? "Sistema solar" : "Solar system",
      }[selObj.layer] || "";
      let distStr = "";
      if (selObj.dist_ly != null && selObj.dist_ly > 0) distStr = fmtDist(selObj.dist_ly, lang);
      else if (selObj.dist_au != null) distStr = selObj.dist_au >= 1 ? `${selObj.dist_au} UA` : `${(selObj.dist_au * 149597870.7 / 1e6).toFixed(2)} M km`;
      const descFont = `${Math.round(H * 0.026)}px Georgia, serif`;
      const desc = (wiki && wiki.extract) ? wiki.extract : "";
      const descLines = desc ? wrap(desc, W - pad * 2, descFont).slice(0, 3) : [];
      const lightLine = (selObj.dist_ly > 0)
        ? (es ? `Su luz tardó ${fmtYears(selObj.dist_ly, lang)} en llegar.` : `Its light took ${fmtYears(selObj.dist_ly, lang)} to arrive.`)
        : "";

      // dibujar de abajo hacia arriba
      let y = H - pad;
      ctx.fillStyle = "rgba(201,184,255,0.9)"; ctx.font = `${Math.round(H * 0.022)}px Georgia, serif`;
      ctx.fillText("Teseo · teseo.yachaydeep.com", pad, y); y -= Math.round(H * 0.042);
      if (lightLine) { ctx.fillStyle = "rgba(120,170,255,0.95)"; ctx.font = `italic ${Math.round(H * 0.024)}px Georgia, serif`; ctx.fillText(lightLine, pad, y); y -= Math.round(H * 0.040); }
      ctx.fillStyle = "rgba(255,255,255,0.82)"; ctx.font = descFont;
      for (let i = descLines.length - 1; i >= 0; i--) { ctx.fillText(descLines[i], pad, y); y -= Math.round(H * 0.034); }
      if (distStr || TYPE) { ctx.fillStyle = "#c9b8ff"; ctx.font = `${Math.round(H * 0.028)}px 'JetBrains Mono', monospace`; ctx.fillText([TYPE, distStr].filter(Boolean).join("  ·  "), pad, y); y -= Math.round(H * 0.050); }
      ctx.fillStyle = "#ffffff"; ctx.font = `${Math.round(H * 0.055)}px Georgia, 'Times New Roman', serif`;
      ctx.fillText(selObj.name, pad, y);
    } else {
      let y = H - pad;
      ctx.fillStyle = "rgba(201,184,255,0.85)"; ctx.font = `${Math.round(H * 0.024)}px Georgia, serif`;
      ctx.fillText("teseo.yachaydeep.com", pad, y); y -= Math.round(H * 0.045);
      ctx.fillStyle = "#ffffff"; ctx.font = `${Math.round(H * 0.05)}px Georgia, serif`;
      ctx.fillText("Teseo", pad, y);
    }

    try {
      const a = document.createElement("a");
      a.href = c.toDataURL("image/png");
      a.download = selObj && selObj.name ? `teseo-${selObj.name.replace(/[^\w-]+/g, "_")}.png` : "teseo-cielo.png";
      a.click();
    } catch { /* toDataURL bloqueado */ }
  }, [selObj, lang, wiki]);

  const useMyLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLat(+pos.coords.latitude.toFixed(4)); setLon(+pos.coords.longitude.toFixed(4)); setLocalMode(true); },
      () => {}, { enableHighAccuracy: false, timeout: 8000 }
    );
  }, []);

  // click para identificar un objeto (raycast)
  useEffect(() => {
    const ref = sceneRef.current;
    if (!ref || !ref.renderer) return;
    const el = ref.renderer.domElement;
    const rc = new THREE.Raycaster(); rc.params.Points.threshold = 14;
    const v = new THREE.Vector2();
    const vtmp = new THREE.Vector3();
    let downX = 0, downY = 0;
    const onDown = (e) => { downX = e.clientX; downY = e.clientY; };
    const onUp = (e) => {
      if (Math.abs(e.clientX - downX) > 5 || Math.abs(e.clientY - downY) > 5) return; // fue arrastre
      const r = el.getBoundingClientRect();
      const px = e.clientX - r.left, py = e.clientY - r.top;
      v.x = (px / r.width) * 2 - 1;
      v.y = -(py / r.height) * 2 + 1;
      rc.setFromCamera(v, ref.camera);
      const layers = (ref.layerObjs || []).filter(o => o.points.visible);
      const hits = layers.length ? rc.intersectObjects(layers.map(o => o.points), false) : [];
      if (hits.length) {
        // el más cercano al rayo (selección precisa)
        hits.sort((a, b) => (a.distanceToRay ?? 1e9) - (b.distanceToRay ?? 1e9));
        const h = hits[0];
        setSelObj({ ...h.object.userData.objs[h.index], layer: h.object.userData.layer });
        return;
      }
      // respaldo: el objeto visible más cercano al clic en pantalla (más fácil de atinar)
      let best = null, bestD = 26; // px
      for (const o of layers) {
        const objs = o.points.userData.objs || [];
        for (let i = 0; i < objs.length; i++) {
          const ob = objs[i];
          vtmp.set(ob.nx * 870, ob.ny * 870, ob.nz * 870);
          o.points.localToWorld(vtmp);
          vtmp.project(ref.camera);
          if (vtmp.z > 1) continue; // detrás de la cámara
          const sx = (vtmp.x * 0.5 + 0.5) * r.width, sy = (-vtmp.y * 0.5 + 0.5) * r.height;
          const d = Math.hypot(sx - px, sy - py);
          if (d < bestD) { bestD = d; best = { obj: ob, layer: o.key }; }
        }
      }
      if (best) setSelObj({ ...best.obj, layer: best.layer });
      else setSelObj(null);
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    return () => { el.removeEventListener("pointerdown", onDown); el.removeEventListener("pointerup", onUp); };
  }, [ready]);

  const onPick = useCallback((e) => {
    const v = e.target.value;
    setSel(v === "__all__" ? null : v);
    setDepth(0);   // siempre arranca en 'plano' y el usuario revela la profundidad
  }, []);

  const selMeta = sky && sel ? sky.constellations.find(c => c.ab === sel) : null;
  const stats = selMeta ? constellationStats(selMeta, sky) : null;

  const timeBtn = { fontFamily: "Inter,system-ui", fontSize: 10, padding: "3px 7px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)", cursor: "pointer", background: "transparent" };

  return (
    <div className="relative w-full h-[460px] md:h-[600px]">
      <div ref={mountRef} className="absolute inset-0 rounded-2xl overflow-hidden"
        role="application" tabIndex={0} onKeyDown={onCanvasKey}
        aria-label={lang === "es"
          ? "Mapa del cielo en 3D: estrellas, constelaciones y objetos a su distancia real. Flechas para girar, + y − para acercar, Escape para cerrar la ficha."
          : "3D sky map: stars, constellations and objects at their real distance. Arrows to rotate, + and − to zoom, Escape to close the panel."}
        style={{ background: "radial-gradient(ellipse at center, #0a1020 0%, #04080f 80%)", border: "1px solid rgba(124,58,237,0.18)", outline: "none" }} />

      {/* punto de observación distinto de la Tierra */}
      {viewFrom && (
        <div className="absolute left-1/2 -translate-x-1/2 pointer-events-auto z-20 flex items-center gap-2 rounded-full px-3 py-1.5"
          style={{ top: 10, background: "rgba(124,58,237,0.22)", border: "1px solid rgba(124,58,237,0.6)", backdropFilter: "blur(4px)" }}>
          <span style={{ fontFamily: "Inter,system-ui", fontSize: 11, color: "#e6ddff" }}>
            {lang === "es" ? "Cielo desde " : "Sky from "}<strong>{viewFrom.name}</strong>
          </span>
          <button onClick={() => setViewFrom(null)}
            style={{ fontFamily: "Inter,system-ui", fontSize: 10.5, cursor: "pointer", color: "#c9b8ff",
              background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 999, padding: "2px 8px" }}>
            {lang === "es" ? "↩ volver a la Tierra" : "↩ back to Earth"}
          </button>
        </div>
      )}

      {/* controles de zoom / centrado */}
      <div className="absolute right-3 pointer-events-auto z-20 flex flex-col gap-1.5" style={{ top: "50%", transform: "translateY(-50%)" }}>
        {[
          { t: "+", f: () => zoomBy(0.8), lbl: lang === "es" ? "Acercar" : "Zoom in" },
          { t: "−", f: () => zoomBy(1.25), lbl: lang === "es" ? "Alejar" : "Zoom out" },
          { t: "◎", f: recenter, lbl: selObj ? (lang === "es" ? "Centrar en el objeto" : "Center on object") : (lang === "es" ? "Centrar vista" : "Center view") },
          { t: "📷", f: savePostcard, lbl: lang === "es" ? "Guardar postal del cielo (PNG)" : "Save sky postcard (PNG)" },
        ].map((b) => (
          <button key={b.t} onClick={b.f} aria-label={b.lbl} title={b.lbl}
            style={{ width: 40, height: 40, borderRadius: 10, cursor: "pointer",
              fontFamily: "Inter,system-ui", fontSize: b.t === "◎" ? 16 : b.t === "📷" ? 15 : 20, lineHeight: 1,
              color: b.t === "◎" && selObj ? "#A78BFA" : "rgba(255,255,255,0.75)",
              background: "rgba(9,14,28,0.85)", border: "1px solid rgba(124,58,237,0.35)" }}>
            {b.t}
          </button>
        ))}
      </div>

      {/* pista de bienvenida (una sola vez) */}
      {showHint && sky && (
        <div className="absolute left-1/2 -translate-x-1/2 pointer-events-auto z-20 rounded-xl px-3.5 py-2.5"
          style={{ bottom: 96, maxWidth: 340, background: "rgba(9,14,28,0.94)", border: "1px solid rgba(124,58,237,0.5)", boxShadow: "0 12px 40px rgba(0,0,0,0.6)" }}>
          <div style={{ fontFamily: "Inter,system-ui", fontSize: 11.5, color: "rgba(255,255,255,0.82)", lineHeight: 1.5 }}>
            {lang === "es"
              ? "Mueve el control de abajo para revelar la profundidad real del cielo. Busca cualquier objeto (Marte, Sgr A*, pulsar) y, al tocar una estrella, mira el cielo desde allí."
              : "Drag the control below to reveal the sky's real depth. Search any object (Mars, Sgr A*, pulsar) and, tapping a star, view the sky from there."}
          </div>
          <button onClick={dismissHint}
            className="mt-1.5"
            style={{ fontFamily: "Inter,system-ui", fontSize: 10.5, cursor: "pointer", color: "#c9b8ff", background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.5)", borderRadius: 999, padding: "3px 12px" }}>
            {lang === "es" ? "Entendido" : "Got it"}
          </button>
        </div>
      )}

      {!sky && (
        <div className="absolute inset-0 flex items-center justify-center text-white/40"
          style={{ fontFamily: "Inter,system-ui", fontSize: 13 }}>{t.loading}</div>
      )}

      {/* labels LOD */}
      {labels.map(l => (
        <div key={l.key} className="absolute pointer-events-none"
          style={{ left: l.x, top: l.y, transform: "translate(6px,-50%)", whiteSpace: "nowrap" }}>
          <div style={{
            fontFamily: "Cormorant Garamond,Georgia,serif",
            color: LABEL_COLOR[l.cls] || "#fff",
            fontSize: l.cls === "con" ? 12 : 10.5,
            letterSpacing: l.cls === "con" ? "0.1em" : "0",
            textTransform: l.cls === "con" ? "uppercase" : "none",
            lineHeight: 1, textShadow: "0 1px 6px #000",
          }}>{l.name}</div>
          {l.sub != null && (
            <div style={{ fontFamily: "JetBrains Mono,monospace", color: "#A78BFA", fontSize: 9, textShadow: "0 1px 6px #000" }}>
              {l.sub.toLocaleString()} {t.lightyears.split("-").join(" ")}
            </div>
          )}
        </div>
      ))}

      {/* top controls */}
      {sky && (
        <div className="absolute top-3 left-3 right-3 flex items-start justify-between gap-2 pointer-events-none">
          <div className="pointer-events-auto">
            <select value={sel || "__all__"} onChange={onPick}
              aria-label={lang === "es" ? "Elegir constelación" : "Choose constellation"}
              className="px-3 py-2 rounded-xl text-white text-sm outline-none"
              style={{ background: "rgba(9,14,28,0.9)", border: "1px solid rgba(124,58,237,0.4)", fontFamily: "Inter,system-ui", maxWidth: 200 }}>
              <option value="__all__">✦ {t.all}</option>
              {[...sky.constellations].sort((a,b)=>a.la.localeCompare(b.la)).map(c => (
                <option key={c.ab} value={c.ab}>{c.la} · {c.en}</option>
              ))}
            </select>
          </div>
          <div className="pointer-events-auto" style={{ width: 172, position: "relative", zIndex: 40 }}>
            <input value={query} onChange={e => setQuery(e.target.value)}
              aria-label={lang === "es" ? "Buscar objeto" : "Search object"}
              placeholder={lang === "es" ? "Buscar: Marte, Sgr A*, pulsar…" : "Search: Mars, Sgr A*, pulsar…"}
              style={{ width: "100%", background: "rgba(9,14,28,0.92)", border: "1px solid rgba(124,58,237,0.4)", borderRadius: 10, color: "#fff", padding: "6px 10px", fontFamily: "Inter,system-ui", fontSize: 11, outline: "none" }} />
            {results.length > 0 && (
              <div style={{ marginTop: 4, background: "#090e1c", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, overflow: "hidden", boxShadow: "0 16px 40px rgba(0,0,0,0.7)" }}>
                {results.map((r, i) => (
                  <button key={i} onClick={() => onResult(r)}
                    style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 10px", color: "rgba(255,255,255,0.78)", fontFamily: "Inter,system-ui", fontSize: 11, borderBottom: "1px solid rgba(255,255,255,0.05)", background: "transparent", cursor: "pointer" }}>
                    {r.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* toggles de capas de objetos */}
      {sky && (
        <div className="absolute left-3 right-3 flex flex-wrap gap-1.5" style={{ top: 56 }}>
          <button
            onClick={() => { setLocalMode(v => { const nv = !v; if (nv && lat == null) { setLat(-0.18); setLon(-78.47); } return nv; }); }}
            className="px-2.5 py-1 rounded-full transition-all"
            style={{ fontFamily: "Inter,system-ui", fontSize: 10, cursor: "pointer",
              background: localMode ? "rgba(96,165,250,0.18)" : "rgba(9,14,28,0.82)",
              border: `1px solid ${localMode ? "#60A5FA" : "rgba(255,255,255,0.12)"}`,
              color: localMode ? "#60A5FA" : "rgba(255,255,255,0.5)" }}>
            🌍 {lang === "es" ? "Mi cielo" : "My sky"}
          </button>
          <button
            onClick={() => setShowSolar(v => !v)}
            aria-pressed={showSolar} aria-label={lang === "es" ? "Sistema solar" : "Solar system"}
            className="px-2.5 py-1 rounded-full transition-all"
            style={{ fontFamily: "Inter,system-ui", fontSize: 10, cursor: "pointer",
              background: showSolar ? "rgba(255,210,63,0.16)" : "rgba(9,14,28,0.82)",
              border: `1px solid ${showSolar ? "#ffd23f" : "rgba(255,255,255,0.12)"}`,
              color: showSolar ? "#ffd23f" : "rgba(255,255,255,0.5)" }}>
            ☉ {lang === "es" ? "Sistema solar" : "Solar system"}
          </button>
          <button
            onClick={startTour}
            disabled={!datasets.messier || !datasets.blackholes}
            className="px-2.5 py-1 rounded-full transition-all"
            style={{ fontFamily: "Inter,system-ui", fontSize: 10, cursor: (datasets.messier && datasets.blackholes) ? "pointer" : "default",
              background: tourActive ? "rgba(167,139,250,0.2)" : "rgba(9,14,28,0.82)",
              border: `1px solid ${tourActive ? "#A78BFA" : "rgba(255,255,255,0.12)"}`,
              color: tourActive ? "#A78BFA" : "rgba(255,255,255,0.5)", opacity: (datasets.messier && datasets.blackholes) ? 1 : 0.4 }}>
            🎬 {lang === "es" ? "Tour" : "Tour"}
          </button>
          {LAYERS.map(cfg => {
            const on = !!enabled[cfg.key];
            const hex = "#" + cfg.color.toString(16).padStart(6, "0");
            const has = (cfg.api || cfg.lazy) ? true : !!datasets[cfg.key];
            return (
              <button key={cfg.key} disabled={!has}
                onClick={() => setEnabled(e => ({ ...e, [cfg.key]: !e[cfg.key] }))}
                aria-pressed={on} aria-label={`${on ? (lang === "es" ? "Ocultar" : "Hide") : (lang === "es" ? "Mostrar" : "Show")} ${cfg[lang] || cfg.es}`}
                className="px-2.5 py-1 rounded-full transition-all"
                style={{
                  fontFamily: "Inter,system-ui", fontSize: 10,
                  background: on ? hex + "22" : "rgba(9,14,28,0.82)",
                  border: `1px solid ${on ? hex : "rgba(255,255,255,0.12)"}`,
                  color: on ? hex : "rgba(255,255,255,0.45)",
                  cursor: has ? "pointer" : "default", opacity: has ? 1 : 0.4,
                }}>
                ● {cfg[lang] || cfg.es}
                {(cfg.api || cfg.lazy)
                  ? (datasets[cfg.key]
                      ? ` (${datasets[cfg.key].count ?? (datasets[cfg.key].objects || []).length})`
                      : loadingLayer[cfg.key] ? " …" : "")
                  : ""}
              </button>
            );
          })}
        </div>
      )}

      {/* depth slider */}
      {sky && sel && !localMode && (
        <div className="absolute left-3 right-3 pointer-events-auto" style={{ bottom: 56 }}>
          <div className="rounded-xl px-4 py-3" style={{ background: "rgba(9,14,28,0.92)", border: "1px solid rgba(124,58,237,0.3)" }}>
            <div className="flex items-center justify-between mb-1.5">
              <span style={{ color: depth < 0.5 ? "#60A5FA" : "rgba(255,255,255,0.4)", fontFamily: "Inter,system-ui", fontSize: 10 }}>{t.flat}</span>
              <span style={{ color: depth >= 0.5 ? "#A78BFA" : "rgba(255,255,255,0.4)", fontFamily: "Inter,system-ui", fontSize: 10 }}>{t.depth}</span>
            </div>
            <input type="range" min="0" max="1" step="0.01" value={depth}
              onChange={e => setDepth(parseFloat(e.target.value))}
              aria-label={lang === "es" ? "Profundidad: de vista plana a profundidad real" : "Depth: from flat view to real depth"}
              aria-valuetext={depth < 0.5 ? t.flat : t.depth}
              className="w-full" style={{ accentColor: "#7C3AED" }} />
            {stats && (
              <div className="flex items-center justify-between mt-1.5" style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 9, color: "rgba(255,255,255,0.4)" }}>
                <span>{t.nearest}: {stats.near.name||"—"} {stats.near.d.toLocaleString()} {t.lightyears}</span>
                <span>{t.farthest}: {stats.far.name||"—"} {stats.far.d.toLocaleString()} {t.lightyears}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {sky && !tourActive && (
        <div className="absolute left-3 right-3 pointer-events-auto flex items-center gap-1 rounded-xl px-2 py-1.5"
          style={{ bottom: 12, background: "rgba(9,14,28,0.92)", border: "1px solid rgba(124,58,237,0.25)" }}>
          <button onClick={() => setLabelDensity(d => d === "pocas" ? "normal" : d === "normal" ? "muchas" : "pocas")} style={timeBtn} title="densidad de nombres" aria-label={lang === "es" ? "Densidad de nombres" : "Label density"}>
            {labelDensity === "pocas" ? "Aa·" : labelDensity === "muchas" ? "Aa···" : "Aa··"}
          </button>
          <button onClick={() => shiftMin(-1440)} style={timeBtn}>−1d</button>
          <button onClick={() => shiftMin(-60)} style={timeBtn}>−1h</button>
          <button onClick={() => setPlaying(pl => !pl)} aria-pressed={playing} aria-label={lang === "es" ? (playing ? "Pausar animación del tiempo" : "Animar el tiempo") : (playing ? "Pause time animation" : "Animate time")} style={{ ...timeBtn, color: playing ? "#A78BFA" : "rgba(255,255,255,0.6)", borderColor: playing ? "#7C3AED" : "rgba(255,255,255,0.12)" }}>{playing ? "⏸" : "▶"}</button>
          <span style={{ flex: 1, textAlign: "center", fontFamily: "JetBrains Mono,monospace", fontSize: 10, color: "rgba(255,255,255,0.62)" }}>
            {new Date(whenStr).toLocaleString(lang === "es" ? "es-EC" : "en-US", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
          </span>
          <button onClick={() => shiftMin(60)} style={timeBtn}>+1h</button>
          <button onClick={() => shiftMin(1440)} style={timeBtn}>+1d</button>
          <button onClick={() => { setPlaying(false); setWhenStr(nowLocalInput()); }} style={timeBtn}>{lang === "es" ? "ahora" : "now"}</button>
        </div>
      )}

      {sky && localMode && (
        <div className="absolute left-3 right-3 pointer-events-auto rounded-xl px-4 py-2.5"
          style={{ bottom: 56, background: "rgba(9,14,28,0.93)", border: "1px solid rgba(96,165,250,0.3)" }}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span style={{ fontFamily: "Inter,system-ui", fontSize: 10, color: "#60A5FA" }}>
              {lat != null ? `${lat}°, ${lon}°` : (lang === "es" ? "sin ubicación" : "no location")}
            </span>
            <button onClick={useMyLocation}
              className="px-2.5 py-1 rounded-full"
              style={{ fontFamily: "Inter,system-ui", fontSize: 9, cursor: "pointer",
                background: "rgba(96,165,250,0.15)", border: "1px solid rgba(96,165,250,0.4)", color: "#60A5FA" }}>
              {lang === "es" ? "Usar mi ubicación" : "Use my location"}
            </button>
          </div>
          <p style={{ fontFamily: "Inter,system-ui", fontSize: 9, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>
            {lang === "es" ? "Horizonte y brújula N-E-S-O según tu lugar y hora." : "Horizon & N-E-S-W compass for your place and time."}
          </p>
        </div>
      )}

      {sky && tourActive && (
        <div className="absolute left-3 right-3 pointer-events-auto rounded-xl px-4 py-3"
          style={{ bottom: 12, background: "rgba(9,14,28,0.96)", border: "1px solid rgba(124,58,237,0.4)", boxShadow: "0 16px 48px rgba(0,0,0,0.7)" }}>
          <div className="flex items-center justify-between mb-1.5">
            <span style={{ fontFamily: "Cormorant Garamond,Georgia,serif", color: "#fff", fontSize: 16 }}>{tourTitle}</span>
            <span style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 9, color: "rgba(255,255,255,0.4)" }}>{tourIndex + 1}/{TOUR.length}</span>
          </div>
          <p style={{ fontFamily: "Cormorant Garamond,Georgia,serif", fontStyle: "italic", color: "rgba(255,255,255,0.72)", fontSize: 13, lineHeight: 1.45, minHeight: 42, margin: 0 }}>
            {tourText === null ? (lang === "es" ? "narrando…" : "narrating…") : (tourText ? `"${tourText}"` : "—")}
          </p>
          <div className="flex items-center justify-between mt-2">
            <div className="flex gap-1.5">
              <button onClick={() => setTourIndex(i => (i - 1 + TOUR.length) % TOUR.length)} style={timeBtn}>‹ {lang === "es" ? "ant." : "prev"}</button>
              <button onClick={() => setTourAuto(a => !a)} style={{ ...timeBtn, color: tourAuto ? "#A78BFA" : "rgba(255,255,255,0.6)", borderColor: tourAuto ? "#7C3AED" : "rgba(255,255,255,0.12)" }}>{tourAuto ? "⏸ auto" : "▶ auto"}</button>
              <button onClick={() => setTourIndex(i => (i + 1) % TOUR.length)} style={timeBtn}>{lang === "es" ? "sig." : "next"} ›</button>
            </div>
            <button onClick={() => setTourActive(false)} style={{ ...timeBtn, color: "rgba(255,140,140,0.85)" }}>{lang === "es" ? "salir" : "exit"}</button>
          </div>
        </div>
      )}

      {selObj && (
        <div className="absolute pointer-events-auto rounded-xl p-3.5"
          style={{ top: 60, right: 12, width: 252, maxHeight: 388, overflowY: "auto", background: "rgba(9,14,28,0.96)", border: "1px solid rgba(124,58,237,0.4)", boxShadow: "0 16px 48px rgba(0,0,0,0.7)" }}>
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div style={{ fontFamily: "Cormorant Garamond,Georgia,serif", color: "#fff", fontSize: 18, lineHeight: 1.1 }}>{selObj.name}</div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button onClick={shareLink} aria-label={lang === "es" ? "Copiar enlace a este objeto" : "Copy link to this object"} title={lang === "es" ? "Copiar enlace" : "Copy link"}
                className="text-white/45 hover:text-white/90" style={{ fontSize: 13 }}>
                {copied ? (lang === "es" ? "✓ copiado" : "✓ copied") : "🔗"}
              </button>
              <button onClick={() => setSelObj(null)} aria-label={lang === "es" ? "Cerrar ficha" : "Close panel"} className="text-white/35 hover:text-white/80" style={{ fontSize: 13 }}>✕</button>
            </div>
          </div>
          {wiki && wiki.thumb && (
            <div style={{ marginBottom: 8 }}>
              <img src={wiki.thumb} alt={selObj.name} loading="lazy"
                style={{ width: "100%", borderRadius: 8, marginBottom: 2, display: "block" }} />
              <div style={{ fontFamily: "Inter,system-ui", fontSize: 9, color: "rgba(255,255,255,0.4)" }}>
                {selObj.layer === "exoplanets"
                  ? (lang === "es" ? "Ilustración — concepto artístico · Wikipedia" : "Illustration — artist's concept · Wikipedia")
                  : (lang === "es" ? "Imagen · Wikipedia (CC)" : "Image · Wikipedia (CC)")}
              </div>
            </div>
          )}
          {selObj.dist_ly != null && (
            <div style={{ fontFamily: "JetBrains Mono,monospace", color: "#A78BFA", fontSize: 11 }}>{fmtDist(selObj.dist_ly, lang)}</div>
          )}
          {selObj.layer === "star" && (
            <div style={{ fontFamily: "Inter,system-ui", color: "rgba(255,255,255,0.55)", fontSize: 11, marginTop: 6 }}>
              {lang === "es" ? "Estrella" : "Star"}
              {selObj.dist_ly > 0 && (
                <button
                  onClick={() => {
                    const d = selObj.dist_ly;
                    setViewFrom({ name: selObj.name, pos: [selObj.nx * d, selObj.ny * d, selObj.nz * d] });
                    setSel(null); setSelObj(null);
                  }}
                  className="mt-2 w-full rounded-lg px-2 py-1.5 transition-all"
                  style={{ display: "block", fontFamily: "Inter,system-ui", fontSize: 11, cursor: "pointer",
                    background: "rgba(124,58,237,0.18)", border: "1px solid rgba(124,58,237,0.5)", color: "#c9b8ff" }}>
                  {lang === "es" ? "🪐 Ver el cielo desde aquí" : "🪐 View the sky from here"}
                </button>
              )}
            </div>
          )}
          {selObj.layer === "solar" && (
            <div style={{ fontFamily: "Inter,system-ui", color: "rgba(255,255,255,0.55)", fontSize: 11, marginTop: 6 }}>
              {selObj.name === "Sol" ? (lang === "es" ? "El Sol — estrella" : "The Sun — star")
                : selObj.name === "Luna" ? (lang === "es" ? "La Luna — satélite" : "The Moon — satellite")
                : (lang === "es" ? "Planeta" : "Planet")}
              {selObj.dist_au != null ? ` · ${selObj.dist_au.toFixed(3)} UA` : ""}
              {selObj.illum != null ? ` · ${lang === "es" ? "fase" : "phase"} ${Math.round(selObj.illum * 100)}% ${selObj.waxing ? (lang === "es" ? "crec." : "wax") : (lang === "es" ? "meng." : "wan")}` : ""}
            </div>
          )}

          {selObj.layer === "messier" && (
            <div style={{ fontFamily: "Inter,system-ui", color: "rgba(255,255,255,0.55)", fontSize: 11, marginTop: 6 }}>
              {TYPE_ES[selObj.type] || "Objeto"}{selObj.cn ? ` · ${selObj.cn}` : ""}{selObj.ngc ? ` · ${selObj.ngc}` : ""}
              {selObj.const_es ? <><br/><span style={{ color: "rgba(255,255,255,0.4)" }}>{lang === "es" ? "en " : "in "}{lang === "es" ? selObj.const_es : selObj.const}</span></> : null}
            </div>
          )}
          {selObj.layer === "pulsars" && (
            <div style={{ fontFamily: "Inter,system-ui", color: "rgba(255,255,255,0.55)", fontSize: 11, marginTop: 6 }}>
              {lang === "es" ? "Púlsar" : "Pulsar"}{selObj.period_ms != null ? ` · ${lang === "es" ? "período" : "period"} ${selObj.period_ms} ms` : ""}
              {selObj.note ? <><br/><span style={{ color: "rgba(255,255,255,0.4)" }}>{selObj.note}</span></> : null}
            </div>
          )}
          {selObj.layer === "galaxies" && (
            <div style={{ fontFamily: "Inter,system-ui", color: "rgba(255,255,255,0.55)", fontSize: 11, marginTop: 6 }}>
              {lang === "es" ? "Galaxia" : "Galaxy"}{selObj.hubble ? ` · ${selObj.hubble}` : ""}{selObj.cat && selObj.cat !== selObj.name ? ` · ${selObj.cat}` : ""}
              {selObj.const_es ? <><br/><span style={{ color: "rgba(255,255,255,0.4)" }}>{lang === "es" ? "en " : "in "}{lang === "es" ? selObj.const_es : selObj.const} · {lang === "es" ? "distancia por redshift (aprox.)" : "redshift distance (approx.)"}</span></> : <><br/><span style={{ color: "rgba(255,255,255,0.4)" }}>{lang === "es" ? "distancia por redshift (aprox.)" : "redshift distance (approx.)"}</span></>}
            </div>
          )}
          {selObj.layer === "blackholes" && (
            <div style={{ fontFamily: "Inter,system-ui", color: "rgba(255,255,255,0.55)", fontSize: 11, marginTop: 6 }}>
              {lang === "es" ? "Agujero negro" : "Black hole"} {selObj.kind} · {fmtMass(selObj.mass_sun)} M☉<br/>
              <span style={{ color: "rgba(255,255,255,0.4)" }}>{selObj.note}</span>
            </div>
          )}
          {selObj.layer === "meteors" && (
            <div style={{ fontFamily: "Inter,system-ui", color: "rgba(255,255,255,0.55)", fontSize: 11, marginTop: 6 }}>
              {(() => { const active = meteorActive(selObj); return (
                <>
                  <span style={{ color: active ? "#ffd27a" : "rgba(255,255,255,0.5)", fontWeight: active ? 600 : 400 }}>
                    {active ? (lang === "es" ? "● activa ahora" : "● active now") : (lang === "es" ? "lluvia de meteoros" : "meteor shower")}
                  </span>
                  <div style={{ color: "rgba(255,255,255,0.45)", marginTop: 2 }}>
                    {lang === "es" ? "máximo" : "peak"} {fmtMD(selObj.peak, lang)} · {lang === "es" ? "activa" : "active"} {fmtMD(selObj.start, lang)}–{fmtMD(selObj.end, lang)} · ZHR ~{selObj.zhr}
                  </div>
                  <div style={{ color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                    {lang === "es" ? "origen" : "parent"}: {selObj.parent}
                  </div>
                  <div style={{ color: "rgba(255,255,255,0.35)", marginTop: 4, fontSize: 10 }}>
                    {lang === "es"
                      ? "El radiante es la dirección de donde parecen venir; no es un objeto lejano."
                      : "The radiant is the direction they appear to come from; not a distant object."}
                  </div>
                </>
              ); })()}
            </div>
          )}
          {selObj.layer === "comets" && (
            <div style={{ fontFamily: "Inter,system-ui", color: "rgba(255,255,255,0.55)", fontSize: 11, marginTop: 6 }}>
              <span style={{ color: "#8be0ff" }}>{lang === "es" ? "Cometa" : "Comet"}</span>
              {selObj.dist_au != null ? ` · ${selObj.dist_au} ${lang === "es" ? "UA de la Tierra" : "AU from Earth"}` : ""}
              {selObj.light_min != null ? ` · ${lang === "es" ? "luz" : "light"} ${selObj.light_min < 60 ? `${selObj.light_min} min` : `${(selObj.light_min/60).toFixed(1)} h`}` : ""}
              <div style={{ color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                {selObj.approaching ? (lang === "es" ? "acercándose a la Tierra" : "approaching Earth") : (lang === "es" ? "alejándose de la Tierra" : "receding from Earth")}
                {" · "}{lang === "es" ? "posición real de hoy (NASA Horizons)" : "today's real position (NASA Horizons)"}
              </div>
            </div>
          )}
          {selObj.layer === "probes" && (
            <div style={{ fontFamily: "Inter,system-ui", color: "rgba(255,255,255,0.55)", fontSize: 11, marginTop: 6 }}>
              <span style={{ color: "#e6ebff" }}>{lang === "es" ? "Sonda / telescopio" : "Probe / telescope"}</span>
              {selObj.dist_au != null ? ` · ${selObj.dist_au >= 1 ? selObj.dist_au + " UA" : (selObj.dist_au * 149597870.7 / 1e6).toFixed(2) + " M km"}` : ""}
              {selObj.light_min != null ? ` · ${lang === "es" ? "luz" : "light"} ${selObj.light_min < 120 ? selObj.light_min + " min" : (selObj.light_min / 60).toFixed(1) + " h"}` : ""}
              {(selObj.note_es || selObj.note_en) && (
                <div style={{ color: "rgba(255,255,255,0.42)", marginTop: 2 }}>{lang === "es" ? selObj.note_es : selObj.note_en}</div>
              )}
              <div style={{ color: "rgba(255,255,255,0.35)", marginTop: 2, fontSize: 10 }}>
                {lang === "es" ? "posición real de hoy (NASA Horizons)" : "today's real position (NASA Horizons)"}
              </div>
            </div>
          )}
          {selObj.layer === "exoplanets" && (
            <div style={{ fontFamily: "Inter,system-ui", fontSize: 11, marginTop: 6 }}>
              <span style={{ color: selObj.hab ? "#aaff7a" : "rgba(255,255,255,0.5)" }}>
                {selObj.hab ? (lang === "es" ? "● potencialmente habitable" : "● potentially habitable") : (lang === "es" ? "no habitable" : "not habitable")}
              </span>
              <div style={{ color: "rgba(255,255,255,0.5)", marginTop: 3, lineHeight: 1.5 }}>
                {(() => {
                  const bits = [];
                  if (selObj.rade) bits.push(`${lang === "es" ? "radio" : "radius"} ${selObj.rade} R⊕`);
                  if (selObj.mass_e) bits.push(`${lang === "es" ? "masa" : "mass"} ${selObj.mass_e} M⊕`);
                  if (selObj.period_d) bits.push(`${lang === "es" ? "año" : "year"} ${selObj.period_d < 1 ? (selObj.period_d * 24).toFixed(1) + " h" : selObj.period_d.toFixed(selObj.period_d < 10 ? 1 : 0) + " d"}`);
                  if (selObj.eqt_k) bits.push(`${selObj.eqt_k} K (${Math.round(selObj.eqt_k - 273)} °C)`);
                  return bits.join(" · ");
                })()}
              </div>
              <div style={{ color: "rgba(255,255,255,0.42)", marginTop: 2 }}>
                {lang === "es" ? "estrella" : "host"} {selObj.host}{selObj.spectype ? ` (${selObj.spectype})` : ""}
                {selObj.disc_year ? ` · ${lang === "es" ? "descubierto" : "found"} ${selObj.disc_year}${selObj.method ? " · " + selObj.method : ""}` : ""}
              </div>
            </div>
          )}

          {selObj.dist_ly > 0 && (
            <div style={{ fontFamily: "Inter,system-ui", color: "rgba(96,165,250,0.85)", fontSize: 10.5, marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.08)", lineHeight: 1.4 }}>
              {lang === "es"
                ? `Su luz tardó ${fmtYears(selObj.dist_ly, lang)} en llegar: lo ves como era entonces.`
                : `Its light took ${fmtYears(selObj.dist_ly, lang)} to arrive: you see it as it was then.`}
            </div>
          )}
          {selObj.dist_ly > 0 && (
            <div style={{ fontFamily: "Inter,system-ui", color: "rgba(255,255,255,0.4)", fontSize: 10, marginTop: 5 }}>
              {lang === "es"
                ? `En la Voyager 1 tardarías ${fmtYears(selObj.dist_ly * 17575, lang)}.`
                : `In Voyager 1 you'd take ${fmtYears(selObj.dist_ly * 17575, lang)}.`}
            </div>
          )}
          {wiki && wiki.extract && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              <p style={{ fontFamily: "Inter,system-ui", color: "rgba(255,255,255,0.55)", fontSize: 10.5, lineHeight: 1.45, margin: 0 }}>
                {wiki.extract.length > 240 ? wiki.extract.slice(0, 240) + "…" : wiki.extract}
              </p>
              <a href={wiki.url} target="_blank" rel="noopener noreferrer"
                style={{ fontFamily: "Inter,system-ui", color: "#60A5FA", fontSize: 9.5, display: "inline-block", marginTop: 5 }}>
                Wikipedia ↗
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function collectNamed(c, byHip) {
  const seen = new Set(); const out = [];
  c.lines.forEach(p => p.forEach(h => {
    if (seen.has(h)) return; seen.add(h);
    const s = byHip.get(h);
    if (s && s[7]) out.push(s);
  }));
  out.sort((a, b) => a[4] - b[4]);
  return out.slice(0, 7);
}
function constellationStats(c, sky) {
  const byHip = new Map(); sky.stars.forEach(s => byHip.set(s[0], s));
  let near = { d: Infinity, name: "" }, far = { d: -1, name: "" };
  const seen = new Set();
  c.lines.forEach(p => p.forEach(h => {
    if (seen.has(h)) return; seen.add(h);
    const s = byHip.get(h); if (!s || !s[6]) return;
    if (s[6] < near.d) near = { d: s[6], name: s[7] };
    if (s[6] > far.d) far = { d: s[6], name: s[7] };
  }));
  return { near, far };
}
function makeStarTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,255,255,0.85)");
  g.addColorStop(0.5, "rgba(255,255,255,0.25)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.Texture(c); tex.needsUpdate = true;
  return tex;
}
