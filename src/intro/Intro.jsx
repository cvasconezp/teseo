// Intro.jsx — animación de entrada: «Estás aquí» → tu sistema solar (hoy) → la Vía
// Láctea → el viaje real de Cassini con sus cuatro catapultas (Venus, Venus, Tierra,
// Júpiter) hasta Saturno: el hilo dorado → «Teseo». Todo con CSS (intro.css) y SVG;
// sin bucles de JavaScript. Se salta tocando
// cualquier parte, con «Saltar» o con Esc. Con «reducir movimiento» la app ni la monta.
import { useEffect, useMemo } from "react";
import { helioPosition } from "../ui/orbits.js";
import { orbitRadius, galaxyPoints, SUN_IN_GALAXY } from "./geometry.js";
import { journey } from "./journey.js";
import "./intro.css";

export const INTRO_MS = 11200;  // duración total (la última fase funde a la app)
export const TRIP = { start: 5.9, dur: 2.7 };   // el hilo de Cassini: inicio y duración (s), a velocidad constante

const TX = {
  es: { here: "Estás aquí.", solar: "Tu sistema solar, hoy", galaxy: "La Vía Láctea · tú estás aquí",
        trip: "Cassini · 1997–2004 · cuatro catapultas hasta Saturno",
        bodies: { earth: "Tierra", venus: "Venus", jupiter: "Júpiter", saturn: "Saturno" },
        line1: "El universo es un laberinto.", line2: "Teseo es tu hilo.", tagline: "Navegación interplanetaria" },
  en: { here: "You are here.", solar: "Your solar system, today", galaxy: "The Milky Way · you are here",
        trip: "Cassini · 1997–2004 · four slingshots to Saturn",
        bodies: { earth: "Earth", venus: "Venus", jupiter: "Jupiter", saturn: "Saturn" },
        line1: "The universe is a labyrinth.", line2: "Teseo is your thread.", tagline: "Interplanetary navigation" },
};

/** planets: [{ id, color, au }] (los de App.jsx) */
export default function Intro({ lang, planets, credit, skipLabel, skipAria, onDone }) {
  const tx = TX[lang] || TX.es;

  useEffect(() => {
    const timer = setTimeout(onDone, INTRO_MS);
    const onKey = (e) => { if (e.key === "Escape") onDone(); };
    window.addEventListener("keydown", onKey);
    return () => { clearTimeout(timer); window.removeEventListener("keydown", onKey); };
  }, [onDone]);

  // planetas en su longitud heliocéntrica de hoy (el mismo cálculo que el mapa de Ruta)
  const solar = useMemo(() => {
    const now = new Date();
    return planets.map((p) => {
      let a = 0;
      try { const h = helioPosition(p.id, now); a = Math.atan2(h.y_au, h.x_au); } catch { /* ángulo 0 */ }
      return { ...p, r: orbitRadius(p.au), a: -a };            // −a: el norte de la eclíptica hacia el observador
    });
  }, [planets]);
  const trip = useMemo(() => journey(), []);
  const stars = useMemo(() => galaxyPoints(), []);
  const earth = solar.find((p) => p.id === "earth");

  return (
    <div className="intro" onClick={onDone}>
      <div className="intro__stage" aria-hidden="true">
        {/* 1 · Estás aquí: la Tierra, un punto azul */}
        <div className="intro__scene intro__scene--earth">
          <svg viewBox="-100 -100 200 200">
            <circle r="26" className="intro__halo"/>
            <circle r="9" fill="#5AA2F5" className="intro__earth"/>
          </svg>
        </div>

        {/* 2 · Tu sistema solar, con los planetas donde están hoy */}
        <div className="intro__scene intro__scene--solar">
          <svg viewBox="-100 -100 200 200">
            <circle r="5" fill="#FCD34D" className="intro__sun"/>
            {solar.map((p, i) => (
              <g key={p.id}>
                <circle r={p.r} fill="none" stroke="rgba(167,139,250,.32)" strokeWidth=".6" pathLength="1"
                  className="intro__orbit" style={{ animationDelay: `${1.9 + i * 0.07}s` }}/>
                <circle cx={p.r * Math.cos(p.a)} cy={p.r * Math.sin(p.a)} r={p.id === "earth" ? 2.6 : 2}
                  fill={p.color} className="intro__planet" style={{ animationDelay: `${2.2 + i * 0.07}s` }}/>
              </g>
            ))}
            {earth && <circle cx={earth.r * Math.cos(earth.a)} cy={earth.r * Math.sin(earth.a)} r="5.5" fill="none"
              stroke="#5AA2F5" strokeWidth=".8" className="intro__planet" style={{ animationDelay: "2.5s" }}/>}
          </svg>
        </div>

        {/* 3 · La Vía Láctea y dónde está el Sol */}
        <div className="intro__scene intro__scene--galaxy">
          {/* el giro va en una capa HTML propia (se compone en la GPU, sin repintar los puntos) */}
          <div className="intro__spin">
            <svg viewBox="-100 -100 200 200">
              {stars.map(([x, y, r, c, o], i) => <circle key={i} cx={x} cy={y} r={r} fill={c} opacity={o}/>)}
              {/* resplandor de la barra central (alargado, como la barra) */}
              <ellipse rx="20" ry="7" fill="rgba(255,236,190,.16)" transform="rotate(24)"/>
            </svg>
          </div>
          <svg viewBox="-100 -100 200 200" className="intro__over">
            <circle cx={SUN_IN_GALAXY[0]} cy={SUN_IN_GALAXY[1]} r="3" fill="none" stroke="#F2C46D" strokeWidth="1" className="intro__mark"/>
            <circle cx={SUN_IN_GALAXY[0]} cy={SUN_IN_GALAXY[1]} r="1.2" fill="#F2C46D"/>
          </svg>
        </div>

        {/* 4 · El viaje real de Cassini: cada catapulta se enciende cuando la sonda pasa junto al planeta */}
        <div className="intro__scene intro__scene--trip">
          <svg viewBox="-100 -100 200 200">
            <circle r="3.4" fill="#FCD34D" className="intro__sun"/>
            {trip.orbits.map((o, i) => (
              <circle key={o.id} r={o.r} fill="none" stroke="rgba(167,139,250,.34)" strokeWidth=".6" pathLength="1"
                className="intro__orbit" style={{ animationDelay: `${(5.3 + i * 0.08).toFixed(2)}s, 8.8s` }}/>
            ))}
            {/* brillo del hilo: un trazo ancho y translúcido debajo (sin filtros: no repinta cada cuadro) */}
            <path d={trip.d} pathLength="1" fill="none" stroke="rgba(242,196,109,.26)" strokeWidth="5" strokeLinecap="round"
              strokeLinejoin="round" className="intro__thread"/>
            <path d={trip.d} pathLength="1" fill="none" stroke="#F2C46D" strokeWidth="1.5" strokeLinecap="round"
              strokeLinejoin="round" className="intro__thread"/>
            {/* la sonda: un guion de longitud cero con extremo redondo que recorre el camino */}
            <path d={trip.d} pathLength="1" fill="none" stroke="#FFF4D6" strokeWidth="4.2" strokeLinecap="round"
              strokeDasharray="0 2" className="intro__probe"/>
            {trip.events.map((e, i) => {
              const at = `${(TRIP.start + e.frac * TRIP.dur).toFixed(2)}s`;
              const p = e.planet ? e.planet.xy : e.xy;
              const big = e.body === "jupiter" || e.body === "saturn";
              const side = p[0] >= 0 ? 1 : -1;
              return (
                <g key={i} className="intro__event" style={{ animationDelay: `${at}, 8.8s` }}>
                  {e.kind === "assist" && <circle cx={e.xy[0]} cy={e.xy[1]} r="7" fill="none" stroke="#F2C46D" strokeWidth="1"
                    className="intro__flash" style={{ animationDelay: at }}/>}
                  <circle cx={p[0]} cy={p[1]} r={big ? 3.4 : 2.4} fill={(trip.orbits.find((o) => o.id === e.body) || {}).color || "#fff"}/>
                  {e.body === "saturn" && <ellipse cx={p[0]} cy={p[1]} rx="6" ry="1.8" fill="none" stroke="#E6D3A3" strokeWidth=".7" transform={`rotate(-18 ${p[0]} ${p[1]})`}/>}
                  {e.kind !== "launch" && (
                    <text x={p[0] + side * 6} y={p[1] + (i % 2 ? 8 : -5)} textAnchor={side > 0 ? "start" : "end"} className="intro__label">
                      {tx.bodies[e.body]}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
          <p className="intro__word"><span className="wordmark">Teseo</span></p>
        </div>
      </div>

      <div className="intro__captions">
        <p className="intro__cap intro__cap--here">{tx.here}</p>
        <p className="intro__cap intro__cap--solar">{tx.solar}</p>
        <p className="intro__cap intro__cap--galaxy">{tx.galaxy}</p>
        <p className="intro__cap intro__cap--trip">{tx.trip}</p>
        <p className="intro__slogan">
          <span className="intro__s1">{tx.line1}</span>
          <span className="intro__s2">{tx.line2}</span>
        </p>
      </div>

      <p className="intro__credit">{String(credit || "").split(" · ").map((part, i) => <span key={i} style={{ display: "block", whiteSpace: "nowrap" }}>{part}</span>)}</p>
      <button type="button" className="intro__skip" aria-label={skipAria}
        onClick={(e) => { e.stopPropagation(); onDone(); }}>
        {skipLabel}
      </button>
    </div>
  );
}
