// whenClock.js — avanzar la hora del cielo sin perder el instante en el cambio de horario.
// La hora del cielo se guarda como hora local sin desfase («2026-11-01T01:50», la del <input datetime-local>). En la
// hora que se repite al volver del horario de verano esa cadena es ambigua y `new Date(cadena)` toma siempre la
// primera: avanzar 10 min desde «01:50» (segunda vez) volvía a «01:00» y el play quedaba en bucle. Aquí cada cadena
// producida recuerda su instante (ms UTC), así los avances siguen desde el instante real.
// Pendiente (cambio mayor): que el estado sea el instante y la cadena solo se formatee para el <input>; mientras
// tanto, durante esa hora repetida el resto de la vista (que relee la cadena) muestra el cielo de la primera pasada.

/** Fecha -> «AAAA-MM-DDTHH:MM» en la hora local del dispositivo (formato de <input type="datetime-local">). */
export function fmtLocalInput(d) {
  const z = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;
}

/**
 * Devuelve advance(w, dms): la cadena local de (instante de `w`) + dms milisegundos. El instante de `w` es el que
 * se recordó al producirla (si salió de aquí) o, si no, el de `new Date(w)`. Idempotente para una misma `w` (se
 * puede usar dentro de un actualizador de estado de React, que en modo estricto corre dos veces).
 */
export function createWhenAdvance(fmt = fmtLocalInput, cap = 32) {
  const seen = new Map();   // cadena -> ms del instante con que se produjo (las últimas `cap`)
  return (w, dms) => {
    const base = seen.has(w) ? seen.get(w) : new Date(w).getTime();
    const t = base + dms, s = fmt(new Date(t));
    seen.delete(s); seen.set(s, t);
    if (seen.size > cap) seen.delete(seen.keys().next().value);
    return s;
  };
}
