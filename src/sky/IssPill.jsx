// IssPill.jsx — píldora de la ISS bajo el buscador del Cielo mientras hay una pasada elegida:
// «● ISS 19:36:12» (hora de la simulación, al segundo) · ▶/⏸ · velocidad (×1, ×10, ×60) · × quitar.
// La hora y el estado los escribe el bucle de animación directamente en el DOM a través de `apiRef`
// (una vez por segundo simulado): la vista no se vuelve a renderizar con React 60 veces por segundo.
import { memo, useEffect, useRef } from "react";
import Icon from "./icons.jsx";
import { ISS } from "./i18n-iss.js";
import { formatClock } from "./issPasses.js";
import { ISS_RATES, nextRate, pillState } from "./issLayer.js";

export { ISS_RATES, nextRate, pillState };

export default memo(function IssPill({ lang = "es", apiRef, pass, loading, playing, rate, onOpen, onTogglePlay, onRate, onRemove }) {
  const x = ISS[lang] || ISS.es;
  const timeRef = useRef(null), dotRef = useRef(null), mainRef = useRef(null);
  const last = useRef({ sec: null, st: null });
  useEffect(() => {
    apiRef.current = (tMs, pos) => {
      const sec = Math.floor(tMs / 1000), st = pillState(pos, tMs, pass);
      if (sec === last.current.sec && st === last.current.st) return;
      last.current = { sec, st };
      const txt = formatClock(tMs, { lang, seconds: true });
      if (timeRef.current && timeRef.current.textContent !== txt) timeRef.current.textContent = txt;
      if (dotRef.current) dotRef.current.className = st === "lit" ? "" : st === "shadow" ? "is-shadow" : "is-off";
      if (mainRef.current) mainRef.current.setAttribute("aria-label", x.issPillAria(txt, x.issState[st]));
    };
    last.current = { sec: null, st: null };
    return () => { apiRef.current = null; };
  }, [apiRef, lang, pass, x]);
  return (
    <div className="sk-chip sk-isspill" data-testid="iss-pill">
      <button type="button" className="chip-main" ref={mainRef} onClick={onOpen} aria-label={x.issSheetTitle}>
        <i ref={dotRef} className="is-off" aria-hidden="true" /><b>ISS</b><span ref={timeRef} aria-hidden="true">--:--:--</span>
      </button>
      {loading ? <span className="is-loading" role="status">{x.issLoadingTrack}</span> : (
        <>
          <button type="button" onClick={onTogglePlay} aria-pressed={playing} aria-label={playing ? x.issPause : x.issPlay} title={playing ? x.issPause : x.issPlay}>
            <Icon name={playing ? "pause" : "play"} size={16} />
          </button>
          <button type="button" className="iss-speed" onClick={onRate} aria-label={x.issSpeedAria(rate)} title={rate === 1 ? x.issRealTime : undefined}>{x.issSpeed(rate)}</button>
        </>
      )}
      <button type="button" onClick={onRemove} aria-label={x.issRemove} title={x.issRemove}><Icon name="close" size={15} /></button>
    </div>
  );
});
