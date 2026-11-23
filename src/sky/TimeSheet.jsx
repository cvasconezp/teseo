// TimeSheet.jsx — control de tiempo «tipo Stellarium» para el modo apuntar (y la columna de la derecha):
// la fecha y la hora con flechas para subir o bajar cada campo (manteniendo pulsado, sigue), la velocidad del
// tiempo (de −1 día a +1 día por segundo, pausa y tiempo real), «Ahora», noche anterior y siguiente, y una
// barra de 24 horas con el día, los crepúsculos y la noche del lugar para arrastrar la hora. Todo en la hora
// del lugar que se mira (zona `tz`, placeTime.js), con un rótulo «Hora de Nagarkot · UTC+5:45» bajo el reloj.
// La lógica pura está en timeDial.js; el estado (whenStr, velocidad) vive en Constellations.jsx.
import { useEffect, useMemo, useRef } from "react";
import Icon from "./icons.jsx";
import { RATES, REAL, rateLabel, dayProfile, dayGradient, phaseName } from "./timeDial.js";
import { tzParts, minuteOfDay, tzCaption } from "./placeTime.js";

const TX = {
  es: { title: "Tiempo", up: (f) => `Subir ${f}`, down: (f) => `Bajar ${f}`, fields: { year: "el año", month: "el mes", day: "el día", hour: "la hora", minute: "los minutos" },
    speed: "Velocidad del tiempo", pause: "Pausa", play: "Reanudar", now: "Ahora", prevNight: "Noche anterior", nextNight: "Noche siguiente", close: "Cerrar", dayBar: "Hora del día (arrastra)" },
  en: { title: "Time", up: (f) => `Increase ${f}`, down: (f) => `Decrease ${f}`, fields: { year: "year", month: "month", day: "day", hour: "hour", minute: "minutes" },
    speed: "Time speed", pause: "Pause", play: "Resume", now: "Now", prevNight: "Previous night", nextNight: "Next night", close: "Close", dayBar: "Time of day (drag)" },
};

/** Flecha que repite mientras se mantiene pulsada (primero a los 380 ms, luego cada 90 ms). */
function HoldArrow({ dir, label, onStep }) {
  const tm = useRef(null), iv = useRef(null);
  const stop = () => { clearTimeout(tm.current); clearInterval(iv.current); tm.current = iv.current = null; };
  useEffect(() => stop, []);
  return (
    <button type="button" className="sk-ts-arrow" aria-label={label}
      onPointerDown={(e) => { e.preventDefault(); onStep(dir); tm.current = setTimeout(() => { iv.current = setInterval(() => onStep(dir), 90); }, 380); }}
      onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onStep(dir); } }}>
      <span className={dir > 0 ? "up" : "down"} aria-hidden="true" />
    </button>
  );
}

export default function TimeSheet({ lang = "es", date, lat, lon, tz = null, place = null, isNow, rateIdx = REAL, onRate, onStep, onNow, onNight, onSetMinute, onClose, docked = false, extra = null }) {
  const tx = TX[lang] || TX.es;
  const z = (n, w = 2) => String(n).padStart(w, "0");
  // la hora «de pared» del lugar que se mira (tz); sin zona del lugar, la del teléfono
  const p = tzParts(date, tz);
  const fields = [["year", z(p.y, 4)], ["month", z(p.m)], ["day", z(p.d)], ["hour", z(p.h)], ["minute", z(p.mi)]];
  const dayKey = `${p.y}-${p.m}-${p.d}`;
  const profile = useMemo(() => dayProfile(lat, lon, date, 48, tz), [lat, lon, dayKey, tz]);   // eslint-disable-line react-hooks/exhaustive-deps
  const minOfDay = minuteOfDay(date, tz);
  const caption = tzCaption(date, tz, place, lang);
  const paused = RATES[rateIdx] === 0;
  return (
    <section className={`sk-ts${docked ? " is-docked" : ""}`} role="dialog" aria-label={tx.title}>
      <div className="sk-ts-head">
        <i className="sk-ts-grip" aria-hidden="true" />
        <button type="button" className="sk-ts-close" onClick={onClose} aria-label={tx.close}><Icon name="close" size={18} /></button>
      </div>
      <div className="sk-ts-clock">
        {fields.map(([f, v], i) => (
          <div key={f} className={`sk-ts-field is-${f}`}>
            <HoldArrow dir={1} label={tx.up(tx.fields[f])} onStep={(d) => onStep(f, d)} />
            <strong>{v}</strong>
            <HoldArrow dir={-1} label={tx.down(tx.fields[f])} onStep={(d) => onStep(f, d)} />
            {i < 2 && <em aria-hidden="true">/</em>}
            {i === 3 && <em aria-hidden="true">:</em>}
          </div>
        ))}
      </div>
      <p className="sk-ts-tz">{caption}</p>
      <div className="sk-ts-speed">
        <span className="sk-ts-rate" aria-live="polite">{isNow && rateIdx === REAL ? `${rateLabel(RATES[REAL], lang)} · ${tx.now}` : rateLabel(RATES[rateIdx], lang)}</span>
        <div className="sk-ts-row">
          <button type="button" className="sk-ts-btn" onClick={() => onRate(paused ? REAL : RATES.indexOf(0))} aria-label={paused ? tx.play : tx.pause}>
            <Icon name={paused ? "play" : "pause"} size={22} />
          </button>
          <input type="range" min={0} max={RATES.length - 1} step={1} value={rateIdx} aria-label={tx.speed}
            onChange={(e) => onRate(Number(e.target.value))} className="sk-ts-slider" />
          <button type="button" className="sk-ts-btn" onClick={onNow} aria-label={tx.now} title={tx.now}><Icon name="retry" size={20} /></button>
        </div>
      </div>
      <div className="sk-ts-jumps">
        <button type="button" onClick={() => onNight(-1)}><Icon name="prev" size={20} /><span>{tx.prevNight}</span></button>
        <button type="button" onClick={onNow}><Icon name="clock" size={20} /><span>{tx.now}</span></button>
        <button type="button" onClick={() => onNight(1)}><Icon name="next" size={20} /><span>{tx.nextNight}</span></button>
      </div>
      {extra}
      <div className="sk-ts-day">
        <input type="range" min={0} max={1439} step={1} value={minOfDay} aria-label={tx.dayBar} className="sk-ts-dayrange"
          style={{ background: dayGradient(profile) }} onChange={(e) => onSetMinute(Number(e.target.value))} />
        <span className="sk-ts-phase" style={{ left: `${(minOfDay / 1440) * 100}%` }}>{phaseName(profile, minOfDay, lang)}</span>
      </div>
    </section>
  );
}

const RAIL = {
  es: { aria: "Accesos del cielo", time: "Tiempo", place: "Lugar", layers: "Capas", search: "Buscar", tour: "Tour" },
  en: { aria: "Sky shortcuts", time: "Time", place: "Place", layers: "Layers", search: "Search", tour: "Tour" },
};

/**
 * Columna de accesos a la derecha: tiempo, lugar, capas, buscar (al apuntar) y tour (al mirar arrastrando).
 * `timeMoved`: la hora no es «ahora» (el botón se tiñe de dorado); `placeOn`: hay un lugar en Mi cielo;
 * `layersOn`: cuántas capas hay encendidas (insignia).
 */
export function ArRail({ lang = "es", timeOpen, onTime, onPlace, onLayers, onSearch, onTour, tourReady = true, timeMoved = false, placeOn = false, layersOn = 0 }) {
  const tx = RAIL[lang] || RAIL.es;
  return (
    <nav className="sk-arrail" aria-label={tx.aria}>
      <button type="button" data-tour="time" onClick={onTime} aria-pressed={!!timeOpen} className={timeMoved ? "tone-gold" : undefined}><Icon name="clock" size={22} /><span>{tx.time}</span></button>
      <button type="button" data-tour="place" onClick={onPlace} className={placeOn ? "tone-blue" : undefined}><Icon name="pin" size={22} /><span>{tx.place}</span></button>
      <button type="button" data-tour="layers" onClick={onLayers}><Icon name="layers" size={22} /><span>{tx.layers}</span>{layersOn > 0 && <i className="sk-arrail-badge">{layersOn}</i>}</button>
      {onTour && <button type="button" onClick={onTour} disabled={!tourReady}><Icon name="tour" size={22} /><span>{tx.tour}</span></button>}
      {onSearch && <button type="button" onClick={onSearch}><Icon name="search" size={22} /><span>{tx.search}</span></button>}
    </nav>
  );
}
