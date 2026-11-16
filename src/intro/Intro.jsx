// Intro.jsx — animación de entrada: «Estás aquí» → tu sistema solar (hoy) → la Vía
// Láctea → el laberinto del universo y el hilo de Ariadna que llega al centro →
// «Teseo». Todo con CSS (intro.css) y SVG; sin bucles de JavaScript. Se salta tocando
// cualquier parte, con «Saltar» o con Esc. Con «reducir movimiento» la app ni la monta.
import { useEffect, useMemo } from "react";
import { helioPosition } from "../ui/orbits.js";
import { orbitRadius, labyrinth, threadPath, galaxyPoints, SUN_IN_GALAXY } from "./geometry.js";
import "./intro.css";

export const INTRO_MS = 9000;   // duración total (la última fase funde a la app)

const TX = {
  es: { here: "Estás aquí.", solar: "Tu sistema solar, hoy", galaxy: "La Vía Láctea · tú estás aquí",
        line1: "El universo es un laberinto.", line2: "Teseo es tu hilo.", tagline: "Navegación interplanetaria" },
  en: { here: "You are here.", solar: "Your solar system, today", galaxy: "The Milky Way · you are here",
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
  const maze = useMemo(() => labyrinth(), []);
  const thread = useMemo(() => threadPath(), []);
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
              <circle r="9" fill="rgba(255,236,190,.35)"/>
            </svg>
          </div>
          <svg viewBox="-100 -100 200 200" className="intro__over">
            <circle cx={SUN_IN_GALAXY[0]} cy={SUN_IN_GALAXY[1]} r="3" fill="none" stroke="#F2C46D" strokeWidth="1" className="intro__mark"/>
            <circle cx={SUN_IN_GALAXY[0]} cy={SUN_IN_GALAXY[1]} r="1.2" fill="#F2C46D"/>
          </svg>
        </div>

        {/* 4 · El laberinto y el hilo de Ariadna */}
        <div className="intro__scene intro__scene--maze">
          <svg viewBox="-100 -100 200 200">
            <g className="intro__walls" fill="none" stroke="rgba(201,184,255,.55)" strokeWidth="2.2" strokeLinecap="round">
              {maze.walls.map((d, i) => <path key={i} d={d}/>)}
              {maze.spokes.map((d, i) => <path key={`s${i}`} d={d}/>)}
            </g>
            {/* brillo del hilo: un trazo ancho y translúcido debajo (sin filtros: no repinta cada cuadro) */}
            <path d={thread} pathLength="1" fill="none" stroke="rgba(242,196,109,.28)" strokeWidth="7" strokeLinecap="round"
              strokeLinejoin="round" className="intro__thread"/>
            <path d={thread} pathLength="1" fill="none" stroke="#F2C46D" strokeWidth="2.4" strokeLinecap="round"
              strokeLinejoin="round" className="intro__thread"/>
            <circle r="3.4" fill="#F2C46D" className="intro__goal"/>
          </svg>
          <p className="intro__word"><span className="wordmark">Teseo</span></p>
        </div>
      </div>

      <div className="intro__captions">
        <p className="intro__cap intro__cap--here">{tx.here}</p>
        <p className="intro__cap intro__cap--solar">{tx.solar}</p>
        <p className="intro__cap intro__cap--galaxy">{tx.galaxy}</p>
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
