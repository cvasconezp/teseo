// milestones.js — «Hitos del espacio»: lista breve hecha a mano, cada fecha con su fuente oficial.
// No se calcula nada: son momentos que anuncia la agencia que opera la nave. Para añadir uno, poner la
// fecha tal como la publica la fuente (en UTC), el enlace a esa fuente y sus textos en i18n.js (case
// "milestone"). Los aniversarios van como «todo el día» (t = mediodía UTC de la fecha, como los meteoros).
//
//   voyager1-lightday  NASA: «Nov. 18, 2026, at 2:16:07 a.m. PST» (= 10:16:07 UTC), 25 902 068 356 km.
//                      science.nasa.gov/mission/voyager/where-are-voyager-1-and-voyager-2-now/
//   voyager2-50y       Lanzamiento de la Voyager 2: 20 de agosto de 1977 (NASA, misión Voyager 2).
//   voyager1-50y       Lanzamiento de la Voyager 1: 5 de septiembre de 1977 (NASA, misión Voyager 1).

export const MILESTONES = [
  {
    id: "voyager1-lightday", kind: "lightday", craft: "Voyager 1", launched: "1977-09-05",
    t: Date.UTC(2026, 10, 18, 10, 16, 7), allDay: false,
    km: 25902068356,
    source: "https://science.nasa.gov/mission/voyager/where-are-voyager-1-and-voyager-2-now/",
  },
  {
    id: "voyager2-50y", kind: "anniversary", craft: "Voyager 2", years: 50, launched: "1977-08-20",
    t: Date.UTC(2027, 7, 20, 12), allDay: true,
    source: "https://science.nasa.gov/mission/voyager/voyager-2/",
  },
  {
    id: "voyager1-50y", kind: "anniversary", craft: "Voyager 1", years: 50, launched: "1977-09-05",
    t: Date.UTC(2027, 8, 5, 12), allDay: true,
    source: "https://science.nasa.gov/mission/voyager/voyager-1/",
  },
];

/** Hitos entre `from` y `to` (ms) como eventos del calendario. */
export function milestoneEvents(from, to, list = MILESTONES) {
  const out = [];
  for (const m of list) {
    const end = m.allDay ? m.t + 12 * 3600000 : m.t;     // un aniversario sigue «hoy» hasta que acaba el día
    if (end < from || m.t > to) continue;
    out.push({ id: `milestone-${m.id}`, type: "milestone", sub: m.kind, t: m.t, allDay: !!m.allDay, durationMin: m.allDay ? 24 * 60 : 30, visible: null, data: m });
  }
  return out;
}
