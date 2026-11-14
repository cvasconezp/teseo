// i18n-iss.js — textos de «La ISS sobre ti» (IssPassesCard.jsx). Mismas claves en ES y EN, mismo patrón
// que i18n-atm.js: pensado para fusionarse en TX (i18n.js) con Object.assign si se quiere; mientras tanto la
// tarjeta lo importa directamente.
// Las horas, los puntos cardinales y las cuentas atrás se formatean en issPasses.js y llegan ya hechos.
const plural = (n, one, many) => (n === 1 ? one : many);

export const ISS = {
  es: {
    issTitle: "La ISS sobre ti",
    issLead: "Cuándo pasa la Estación Espacial Internacional por tu cielo: una estrella muy brillante que cruza sin parpadear, en unos minutos.",
    issNeedPlace: "Elige un lugar en «Mi cielo» para saber cuándo pasa la ISS por encima de ti.",
    issLoading: "Calculando las pasadas…",
    issError: "No se pudieron calcular las pasadas de la ISS. Reintenta en un momento.",
    issRetry: "Reintentar",
    issNext: "Próxima pasada visible",
    issListLabel: "Próximas pasadas visibles de la ISS",
    issCount: (n) => `${n} ${plural(n, "pasada visible", "pasadas visibles")}`,
    issEmpty: (days) => `Ninguna pasada visible en los próximos ${days} días.`,
    issEmptyWhy: (total, sunUp, shadow) => {
      if (!total) return "En este periodo la ISS no sube más de 10° sobre tu horizonte.";
      const parts = [];
      if (sunUp) parts.push(`${sunUp} de día`);
      if (shadow) parts.push(`${shadow} con la ISS dentro de la sombra de la Tierra`);
      return `La ISS pasa ${total} ${plural(total, "vez", "veces")}, pero ${total === 1 ? "no se ve" : "ninguna se ve"}${parts.length ? `: ${parts.join(" y ")}` : ""}.`;
    },
    issEmptyHelp: "Para verla hacen falta dos cosas a la vez: que en tu lugar sea de noche o crepúsculo (Sol más de 6° bajo el horizonte) y que la ISS, a unos 420 km de altura, aún reciba la luz del Sol. Eso ocurre en rachas de varias semanas: vuelve a mirar en unos días.",
    issAppears: (a, peak, d) => `Aparece por el ${a}, sube a ${peak}°, se pierde por el ${d}`,
    issDuration: (d) => `Se ve ${d}`,
    issPartial: (from, to) => `Solo se ve de ${from} a ${to}: antes o después es de día o la ISS está en la sombra de la Tierra.`,
    issMag: (m) => `brillo ${m}`,
    issMagTitle: "Magnitud aproximada (±1): cuanto menor el número, más brillante. Sirio es −1,5 y Venus llega a −4,5.",
    issNowTag: "ahora",
    issShow: "Verla en el cielo",
    issShowAria: (day, time) => `Ver en el cielo la pasada de la ISS del ${day} a las ${time}`,
    issSource: "Elementos orbitales: CelesTrak · Propagación SGP4",
    issEpoch: (when, age) => `Elementos del ${when}${age ? ` (hace ${age})` : ""}.`,
    issAge: (h) => (h < 1 ? "menos de 1 h" : h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} días`),
    issOutdated: "Los elementos orbitales tienen más de 3 días: la precisión baja (las horas pueden errar varios segundos, más si la ISS corrigió su órbita).",
    issStale: "No se pudo actualizar la fuente: se usan los últimos elementos orbitales guardados.",
    issApprox: "Cálculo con física real (SGP4), precisión de ~1° con elementos recientes. No sabe de nubes ni de montañas; la magnitud es una estimación.",
    issTimeNote: (tz) => `Horas en la zona de tu dispositivo${tz ? ` (${tz})` : ""}.`,
  },
  en: {
    issTitle: "The ISS above you",
    issLead: "When the International Space Station crosses your sky: a very bright star gliding past without twinkling, over a few minutes.",
    issNeedPlace: "Pick a place in “My sky” to find out when the ISS passes over you.",
    issLoading: "Working out the passes…",
    issError: "Couldn’t work out the ISS passes. Try again in a moment.",
    issRetry: "Try again",
    issNext: "Next visible pass",
    issListLabel: "Upcoming visible ISS passes",
    issCount: (n) => `${n} ${plural(n, "visible pass", "visible passes")}`,
    issEmpty: (days) => `No visible passes in the next ${days} days.`,
    issEmptyWhy: (total, sunUp, shadow) => {
      if (!total) return "In this period the ISS never climbs above 10° over your horizon.";
      const parts = [];
      if (sunUp) parts.push(`${sunUp} in daylight`);
      if (shadow) parts.push(`${shadow} with the ISS inside Earth’s shadow`);
      return `The ISS passes ${total} ${plural(total, "time", "times")}, but ${total === 1 ? "it isn’t visible" : "none is visible"}${parts.length ? `: ${parts.join(" and ")}` : ""}.`;
    },
    issEmptyHelp: "Two things must happen at once: it must be night or twilight where you are (Sun more than 6° below the horizon), and the ISS, about 420 km up, must still catch sunlight. That happens in streaks of a few weeks: check again in a few days.",
    issAppears: (a, peak, d) => `Appears in the ${a}, climbs to ${peak}°, disappears in the ${d}`,
    issDuration: (d) => `Visible for ${d}`,
    issPartial: (from, to) => `Only visible from ${from} to ${to}: before or after that it is daylight or the ISS is in Earth’s shadow.`,
    issMag: (m) => `brightness ${m}`,
    issMagTitle: "Approximate magnitude (±1): the lower the number, the brighter. Sirius is −1.5 and Venus reaches −4.5.",
    issNowTag: "now",
    issShow: "See it in the sky",
    issShowAria: (day, time) => `See in the sky the ISS pass of ${day} at ${time}`,
    issSource: "Orbital elements: CelesTrak · SGP4 propagation",
    issEpoch: (when, age) => `Elements from ${when}${age ? ` (${age} old)` : ""}.`,
    issAge: (h) => (h < 1 ? "under 1 h" : h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} days`),
    issOutdated: "The orbital elements are more than 3 days old: accuracy drops (times can be off by several seconds, more if the ISS has boosted its orbit).",
    issStale: "The source couldn’t be refreshed: the last saved orbital elements are in use.",
    issApprox: "Computed with real physics (SGP4), ~1° accuracy with recent elements. It knows nothing about clouds or mountains; magnitude is an estimate.",
    issTimeNote: (tz) => `Times in your device’s time zone${tz ? ` (${tz})` : ""}.`,
  },
};
