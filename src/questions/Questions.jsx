// Questions.jsx — pestaña "Preguntas": índice de recorridos + enrutado por hash.
//   #preguntas                      → índice
//   #preguntas?q=<id>&…             → recorrido <id> con su estado
//   #preguntas?drake=…  (antiguo)   → "¿Estamos solos?" (compatibilidad)
// Se carga con React.lazy desde App.jsx; cada recorrido va en su propio chunk
// diferido, así el índice pesa poco y solo se descarga lo que se abre.
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { parseRoute } from "./physics.js";
import { track, trackOnce } from "../ui/track.js";
import { Certainty } from "./shared.jsx";
import { TQ } from "./i18n.js";
import "./questions.css";

const TOURS = {
  mass: lazy(() => import("./MassTour.jsx")),
  bh: lazy(() => import("./BlackHoleTour.jsx")),
  expansion: lazy(() => import("./ExpansionTour.jsx")),
  dm: lazy(() => import("./DarkMatterTour.jsx")),
  drake: lazy(() => import("./DrakeTour.jsx")),
};
// Orden del índice
export const TOUR_IDS = ["mass", "bh", "expansion", "dm", "drake"];

// Último lugar visitado: al cambiar de pestaña el panel se desmonta y, al
// volver sin enlace, se retoma donde se dejó.
const store = { id: null };

const prefix = (lang) => (lang === "es" ? "preguntas" : "questions");

function currentRoute() {
  try {
    const r = parseRoute(window.location.hash || "", TOUR_IDS);
    if (r.match) return r.id;
  } catch { /* no-op */ }
  return store.id;
}

// Emblema de cada recorrido: un dibujo pequeño de su pieza central.
function Emblem({ id }) {
  if (id === "mass") return (
    <svg viewBox="0 0 120 80" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="q-em-mass-s" cx="40%" cy="35%" r="70%"><stop offset="0" stopColor="#FFF4D6" /><stop offset="1" stopColor="#FFB84D" /></radialGradient>
        <radialGradient id="q-em-mass-p" cx="38%" cy="32%" r="80%"><stop offset="0" stopColor="#E7D3B2" /><stop offset="1" stopColor="#A87656" /></radialGradient>
      </defs>
      <circle cx="16" cy="52" r="5" fill="#9A9088" />
      <circle cx="38" cy="48" r="11" fill="url(#q-em-mass-p)" />
      <circle cx="82" cy="40" r="30" fill="url(#q-em-mass-s)" />
    </svg>
  );
  if (id === "bh") return (
    <svg viewBox="0 0 120 80" aria-hidden="true" focusable="false">
      <defs><radialGradient id="q-em-bh" cx="50%" cy="62%" r="60%"><stop offset="0.42" stopColor="#FFB067" stopOpacity="0" /><stop offset="0.6" stopColor="#FFB067" /><stop offset="0.78" stopColor="#FF7A3C" stopOpacity="0.55" /><stop offset="1" stopColor="#FF7A3C" stopOpacity="0" /></radialGradient></defs>
      <circle cx="60" cy="40" r="36" fill="url(#q-em-bh)" />
      <circle cx="60" cy="40" r="15.5" fill="#04080F" />
    </svg>
  );
  if (id === "expansion") return (
    <svg viewBox="0 0 120 80" aria-hidden="true" focusable="false">
      <path d="M10 70H112M10 70V8" stroke="rgba(255,255,255,.4)" fill="none" />
      <path d="M10 70 108 14" stroke="#FDA4AF" strokeWidth="2" strokeLinecap="round" />
      {[[22, 64], [30, 57], [37, 56], [45, 48], [52, 47], [60, 40], [66, 39], [75, 30], [83, 31], [92, 22], [101, 20]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="2.6" fill="#fff" />)}
    </svg>
  );
  if (id === "dm") return (
    <svg viewBox="0 0 120 80" aria-hidden="true" focusable="false">
      <path d="M10 70H112M10 70V8" stroke="rgba(255,255,255,.4)" fill="none" />
      <path d="M10 70C22 30 34 24 46 30 70 42 92 52 110 58" stroke="#7DB9FF" strokeWidth="2" strokeDasharray="5 4" fill="none" strokeLinecap="round" />
      <path d="M10 70C20 34 30 22 46 20 70 18 92 19 110 19" stroke="#5EEAD4" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      {[[24, 37], [38, 23], [54, 20], [70, 19], [86, 20], [102, 18]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="2.6" fill="#fff" />)}
    </svg>
  );
  return (
    <svg viewBox="0 0 120 80" aria-hidden="true" focusable="false">
      <text x="60" y="52" textAnchor="middle" className="q-idx__eq">N = R<tspan dy="-9" fontSize="15">∗</tspan><tspan dy="9"> · f</tspan><tspan dy="6" fontSize="15">p</tspan><tspan dy="-6"> …</tspan></text>
    </svg>
  );
}

function Index({ lang, t }) {
  return (
    <section className="q q-idx" aria-labelledby="q-idx-title">
      <header className="q-head">
        <h2 id="q-idx-title" className="q-title">{t.indexTitle}</h2>
        <p className="q-lead">{t.indexLead}</p>
      </header>
      <ul className="q-idx__list">
        {TOUR_IDS.map(id => (
          <li key={id}>
            <a className={`q-idx__card q-idx__card--${id}`} href={`#${prefix(lang)}?q=${id}`}>
              <span className="q-idx__art"><Emblem id={id} /></span>
              <span className="q-idx__body">
                <span className="q-idx__title">{t.tours[id].title}</span>
                <span className="q-idx__teaser">{t.tours[id].teaser}</span>
                <span className="q-idx__tag">{t.tours[id].tag}</span>
              </span>
              <svg className="q-idx__go" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="m9 6 6 6-6 6" /></svg>
            </a>
          </li>
        ))}
      </ul>
      <div className="q-idx__legend">
        <p>{t.indexLegend}</p>
        <ul className="q-legend">
          {["measured", "estimated", "unknown"].map(l => <li key={l}><Certainty level={l} t={t} short /></li>)}
        </ul>
      </div>
    </section>
  );
}

export default function Questions({ lang = "es", onSeeSky }) {
  const t = TQ[lang] || TQ.es;
  const [id, setId] = useState(currentRoute);

  useEffect(() => {
    const onHash = () => {
      let r;
      try { r = parseRoute(window.location.hash || "", TOUR_IDS); } catch { return; }
      if (!r.match) return;                       // otra pestaña: no es asunto nuestro
      setId(prev => {
        if (prev !== r.id) { try { window.scrollTo({ top: 0, behavior: "auto" }); } catch { /* no-op */ } }
        return r.id;
      });
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => { store.id = id; }, [id]);

  // ── Métricas anónimas (ver src/ui/track.js) ──────────────────────────────
  // Abrir el índice o un recorrido; y, por delegación (sin tocar cada
  // recorrido): preajustes (data-preset), deslizadores (una vez por recorrido
  // y pestaña), compartir, "Para seguir" y tarjetas desplegables. Nunca viaja
  // un valor elegido ni texto: solo qué control se usó.
  const idRef = useRef(id);
  idRef.current = id;
  useEffect(() => {
    if (id) track("q_open", { q: id }); else track("q_index");
  }, [id]);
  useEffect(() => {
    const inTour = (el) => !!idRef.current && !!el && typeof el.closest === "function" && !!el.closest("section.q");
    const onClick = (e) => {
      const el = e.target;
      if (!inTour(el)) return;
      const q = idRef.current;
      const preset = el.closest(".q-preset");
      if (preset) { track("q_preset", { q, preset: preset.getAttribute("data-preset") || undefined }); return; }
      if (el.closest(".q-share button")) { track("q_share", { q }); return; }
      if (el.closest(".q-next a")) track("q_next", { q });
    };
    const onInput = (e) => {
      const el = e.target;
      if (el && el.type === "range" && inTour(el)) trackOnce(`q_slider:${idRef.current}`, "q_slider", { q: idRef.current });
    };
    const onToggle = (e) => {
      const el = e.target;
      if (el && el.open && el.classList && el.classList.contains("q-card") && el.id && inTour(el)) track("q_card", { q: idRef.current, card: el.id });
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("input", onInput, true);
    document.addEventListener("toggle", onToggle, true);   // toggle no burbujea: fase de captura
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("toggle", onToggle, true);
    };
  }, []);
  const seeSky = useCallback(() => {
    track("q_see_sky", { q: idRef.current || undefined });
    if (onSeeSky) onSeeSky();
  }, [onSeeSky]);

  // En el índice el hash es el de la pestaña a secas (cada recorrido escribe el suyo).
  const indexHash = `#${prefix(lang)}`;
  useEffect(() => {
    if (id) return;
    try { if (window.location.hash !== indexHash) window.history.replaceState(null, "", indexHash); } catch { /* no-op */ }
  }, [id, indexHash]);

  if (!id) return <Index lang={lang} t={t} />;
  const Tour = TOURS[id];
  return (
    <Suspense fallback={<p role="status" className="loading">{t.tourLoading}</p>}>
      <Tour lang={lang} onSeeSky={seeSky} indexHref={indexHash} />
    </Suspense>
  );
}
