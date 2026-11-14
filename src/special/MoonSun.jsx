// MoonSun.jsx — "¿Y la Luna? ¿Y el Sol?" (pestaña Ventanas) y su enlace desde
// Ruta. Todo se calcula en el dispositivo con src/special/math.js: sin red,
// sin IA. Ruta y Ventanas siguen haciendo solo Hohmann heliocéntricas entre
// planetas; esto es una sección aparte y no toca esa lógica.
import { useEffect, useMemo, useRef, useState } from "react";
import PlanetSphere from "../ui/PlanetSphere.jsx";
import { IconArrow, IconWindows } from "../ui/icons.jsx";
import { trackOnce } from "../ui/track.js";
import { TS } from "./i18n.js";
import {
  moonTrip, sunTrip, fastMoonTli, moonToday,
  LEO_ALT_KM, LLO_ALT_KM, MOON_A_KM, MOON_NEAR_KM, MOON_FAR_KM, R_SUN, SIDEREAL_MONTH_D,
} from "./math.js";
import "./moonsun.css";

/** id del ancla: el enlace de Ruta lleva aquí. */
export const MOONSUN_ID = "luna-sol";

// Apolo 11 (NASA, "Apollo 11 Mission Overview"): inyección translunar 2 h 44 min
// tras el despegue; entrada en órbita lunar a unas 75 h 50 min de vuelo.
export const APOLLO11_COAST_H = (75 + 50 / 60) - (2 + 44 / 60);   // ≈ 73,1 h

const nf = (x, lang, max = 0, min = 0) =>
  Number(x).toLocaleString(lang === "es" ? "es" : "en-US", { maximumFractionDigits: max, minimumFractionDigits: min });
const loc = lang => (lang === "es" ? "es-EC" : "en-US");
const kms = (x, lang) => `${nf(x, lang, 2, 2)} km/s`;
// Fecha (cifra grande) y hora aproximada (línea secundaria), en la hora del dispositivo
const fmtDay = (d, lang) => (d ? d.toLocaleDateString(loc(lang), { day: "numeric", month: "long" }) : "—");
const fmtHour = (d, lang) => (d ? d.toLocaleDateString(loc(lang), { weekday: "long" }) + " · " + d.toLocaleTimeString(loc(lang), { hour: "2-digit", minute: "2-digit" }) : "");

// Cuenta una vista por tarjeta y pestaña del navegador cuando entra en pantalla
function useViewOnce(ref, dest) {
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) {
        trackOnce(`special_view_${dest}`, "special_dest", { destination: dest, kind: "view" });
        io.disconnect();
      }
    }, { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, dest]);
}

function Fact({ label, value, sub }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}{sub && <span className="ms-facts__sub">{sub}</span>}</dd>
    </div>
  );
}

function MoonCard({ lang, now }) {
  const t = TS[lang];
  const ref = useRef(null);
  useViewOnce(ref, "moon");
  const m = useMemo(() => moonTrip(), []);
  const fast = useMemo(() => fastMoonTli(APOLLO11_COAST_H), []);
  const today = useMemo(() => moonToday(now), [now]);
  return (
    <article ref={ref} className="ms-card ms-card--moon" aria-labelledby="ms-moon-h">
      <header className="ms-card__head">
        <span className="ms-card__sphere" aria-hidden="true"><PlanetSphere id="moon" size={52}/></span>
        <div>
          <h3 id="ms-moon-h" className="ms-card__title">{t.moonTitle}</h3>
          <p className="ms-card__tag">{t.model} · {t.computed}</p>
        </div>
      </header>

      <p className="ms-big">
        <span className="ms-big__pre">{t.moonPre}</span>
        <span className="ms-big__val">{t.moonBig(nf(Math.round(m.tofDays), lang))}</span>
      </p>
      <p className="ms-lead">{t.moonSub}</p>

      <dl className="ms-facts">
        <Fact label={t.moonTli} value={kms(m.tliDv, lang)} sub={t.moonTliSub(nf(LEO_ALT_KM, lang))}/>
        <Fact label={t.moonLoi} value={kms(m.loiDv, lang)} sub={t.moonLoiSub(nf(LLO_ALT_KM, lang))}/>
        <Fact label={t.moonTof} value={t.moonTofVal(nf(m.tofDays, lang, 2, 2), nf(m.tofDays * 24, lang))}/>
        <Fact label={t.moonLight} value={`${nf(m.lightS, lang, 2, 2)} s`} sub={t.moonLightSub(nf(MOON_A_KM, lang))}/>
      </dl>

      <div className="ms-note">
        <h4 className="ms-note__h">{t.apolloTitle}</h4>
        <p>{t.apolloBody(nf(APOLLO11_COAST_H, lang), nf(fast, lang, 2, 2), nf(fast - m.tliDv, lang, 2, 2))}</p>
      </div>

      <h4 className="ms-sub">{t.moonWhenTitle}</h4>
      <p className="ms-p">{t.moonWhen1(nf(SIDEREAL_MONTH_D, lang, 1))}</p>
      <p className="ms-p">{t.moonWhen2}</p>
      <p className="ms-p">{t.moonWhen3}</p>

      <section className="ms-today" aria-labelledby="ms-today-h">
        <h4 id="ms-today-h" className="ms-today__h">{t.todayTitle}</h4>
        <dl className="ms-facts ms-facts--today">
          <Fact label={t.todayDist} value={t.todayDistVal(nf(Math.round(today.distKm / 1000) * 1000, lang))}
            sub={t.todayDistSub(nf(MOON_NEAR_KM, lang), nf(MOON_FAR_KM, lang), nf(today.lightS, lang, 2, 2))}/>
          <Fact label={t.todayPhase} value={t.todayPhaseVal(t.phases[today.phase], nf(today.illum * 100, lang))}/>
          <Fact label={t.nextFull} value={<time dateTime={today.nextFull?.toISOString()}>{fmtDay(today.nextFull, lang)}</time>}
            sub={t.around(fmtHour(today.nextFull, lang))}/>
          <Fact label={t.nextNew} value={<time dateTime={today.nextNew?.toISOString()}>{fmtDay(today.nextNew, lang)}</time>}
            sub={t.around(fmtHour(today.nextNew, lang))}/>
        </dl>
        <p className="ms-fine">{t.todayNote}</p>
      </section>

      <footer className="ms-card__foot">
        <p className="ms-fine">{t.moonAssume(nf(LEO_ALT_KM, lang), nf(MOON_A_KM, lang), nf(LLO_ALT_KM, lang))}</p>
        <p className="ms-fine">{t.moonSources}</p>
      </footer>
    </article>
  );
}

function SunCard({ lang, onVenus }) {
  const t = TS[lang];
  const ref = useRef(null);
  useViewOnce(ref, "sun");
  const s = useMemo(() => sunTrip(), []);
  const bars = [
    { id: "mars", label: t.barMars, dv: s.dvMarsLeo },
    { id: "escape", label: t.barEscape, dv: s.dvEscapeLeo },
    { id: "sun", label: t.barSun, dv: s.dvLeo },
  ];
  const max = s.dvLeo;
  return (
    <article ref={ref} className="ms-card ms-card--sun" aria-labelledby="ms-sun-h">
      <header className="ms-card__head">
        <span className="ms-card__sphere" aria-hidden="true"><PlanetSphere id="sun" size={52}/></span>
        <div>
          <h3 id="ms-sun-h" className="ms-card__title">{t.sunTitle}</h3>
          <p className="ms-card__tag">{t.model} · {t.computed}</p>
        </div>
      </header>

      <p className="ms-big">
        <span className="ms-big__pre">{t.sunPre}</span>
        <span className="ms-big__val">{t.sunBig(nf(Math.round(s.tofDays), lang))}</span>
      </p>
      <p className="ms-lead">{t.sunSub}</p>
      <p className="ms-p">{t.sunWhy(nf(s.vEarth, lang, 1), nf(s.vInf, lang, 1))}</p>

      <figure className="ms-bars">
        <figcaption className="ms-bars__title">{t.barsTitle(nf(LEO_ALT_KM, lang))}</figcaption>
        <ul aria-label={t.barsCaption}>
          {bars.map(b => (
            <li key={b.id} className={`ms-bar ms-bar--${b.id}`}>
              <span className="ms-bar__label">{b.label}</span>
              <span className="ms-bar__val">{kms(b.dv, lang)}</span>
              <span className="ms-bar__track" aria-hidden="true"><span style={{ width: `${Math.max(4, (b.dv / max) * 100)}%` }}/></span>
            </li>
          ))}
        </ul>
      </figure>
      <p className="ms-p ms-p--fact">{t.escapeFact(nf(s.vEscSun, lang, 1), nf(s.vInfEscape, lang, 1))}</p>

      <dl className="ms-facts">
        <Fact label={t.sunTof} value={t.sunTofVal(nf(s.tofDays, lang, 1, 1))}/>
      </dl>

      <h4 className="ms-sub">{t.sunWhenTitle}</h4>
      <p className="ms-p">{t.sunWhen1}</p>
      <p className="ms-p">{t.sunWhen2}</p>
      <div className="ms-note">
        <p>{t.parker}</p>
      </div>
      {onVenus && (
        <div className="ms-venus">
          <button type="button" className="btn btn--ghost ms-venus__btn" onClick={onVenus}>
            <IconWindows width={18} height={18}/>{t.venusBtn}
          </button>
          <p className="ms-fine ms-venus__hint">{t.venusHint}</p>
        </div>
      )}

      <footer className="ms-card__foot">
        <p className="ms-fine">{t.sunAssume(nf(LEO_ALT_KM, lang), nf(R_SUN, lang))}</p>
        <p className="ms-fine">{t.sunSources}</p>
      </footer>
    </article>
  );
}

/** Tarjeta de la Luna o del Sol cuando se eligen como destino (only = "moon" | "sun"). */
export default function MoonSun({ lang, onVenus, only }) {
  const t = TS[lang];
  // "hoy": se fija al montar y se refresca cada 10 minutos si la pestaña sigue abierta
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 10 * 60 * 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <section id={MOONSUN_ID} className={`ms ${only ? "ms--only" : ""}`} aria-label={only ? (only === "moon" ? t.moonTitle : t.sunTitle) : undefined} aria-labelledby={only ? undefined : "ms-h"}>
      {!only && <h2 id="ms-h" tabIndex={-1} className="ms__title">{t.title}</h2>}
      <p className="ms__intro">{t.intro}</p>
      <p className="ms__dv"><strong>{t.dvTitle}</strong> {t.dvExplain}</p>
      <div className="ms-grid">
        {only !== "sun" && <MoonCard lang={lang} now={now}/>}
        {only !== "moon" && <SunCard lang={lang} onVenus={onVenus}/>}
      </div>
    </section>
  );
}

/** Enlace corto desde Ruta. */
export function MoonSunLink({ lang, onOpen }) {
  const t = TS[lang];
  return (
    <a href={`#${MOONSUN_ID}`} className="ms-link" onClick={e => { e.preventDefault(); onOpen(); }}>
      <span className="ms-link__spheres" aria-hidden="true">
        <PlanetSphere id="moon" size={26}/>
        <PlanetSphere id="sun" size={30}/>
      </span>
      <span className="ms-link__text">
        <span className="ms-link__title">{t.linkTitle}</span>
        <span className="ms-link__sub">{t.linkSub}</span>
      </span>
      <IconArrow className="ms-link__arrow" width={20} height={20}/>
    </a>
  );
}

/**
 * Lleva la vista hasta la sección bajo las pestañas fijas y mueve el foco a su
 * título. Mientras llegan las ventanas la página cambia de alto: se realinea
 * unos 2,5 s salvo que la persona ya esté desplazándose. Devuelve la limpieza.
 */
export function followSection(getEl, smoothOk = true) {
  let live = true;
  const align = smooth => {
    const el = getEl();
    if (!live || !el) return;
    try {
      const y = Math.max(0, el.getBoundingClientRect().top + window.scrollY - 70);
      if (Math.abs(y - window.scrollY) > 2) window.scrollTo({ top: y, behavior: smooth && smoothOk ? "smooth" : "auto" });
    } catch { /* no-op */ }
  };
  const raf = requestAnimationFrame(() => {
    align(true);
    try { getEl()?.querySelector("h2")?.focus({ preventScroll: true }); } catch { /* no-op */ }
  });
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => align(false)) : null;
  if (ro) ro.observe(document.body);
  const stop = () => { live = false; if (ro) ro.disconnect(); };
  const timer = setTimeout(stop, 2500);
  const opts = { passive: true };
  window.addEventListener("wheel", stop, opts); window.addEventListener("touchstart", stop, opts); window.addEventListener("keydown", stop);
  return () => {
    cancelAnimationFrame(raf); clearTimeout(timer); stop();
    window.removeEventListener("wheel", stop, opts); window.removeEventListener("touchstart", stop, opts); window.removeEventListener("keydown", stop);
  };
}
