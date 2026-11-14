// launchFilter.js — qué lanzamientos merecen estar en el Calendario del cielo. Función PURA con
// pruebas (scripts/test_now_calendar.mjs). Entrada: un lanzamiento tal como lo da /api/launches
// (Launch Library 2: name, mission, mission_type, rocket, description, orbit, …).
//
// Reglas:
//  1. Se descartan los lanzamientos RUTINARIOS de megaconstelaciones (Starlink, Kuiper/Amazon Leo,
//     OneWeb, Qianfan/G60, Guowang, Lightspeed…).
//  2. EXCEPCIÓN: un vuelo de prueba de un vehículo nuevo se mantiene aunque lleve esos satélites
//     (el nombre o la descripción dicen «Flight N» / «test flight» / «maiden», o el cohete está en la
//     lista de vehículos aún en pruebas).
//  3. Entre los demás, solo se muestran los que tienen un motivo: «crew» (tripulado), «science»
//     (ciencia, exploración planetaria, telescopios, observación científica de la Tierra), «moon»
//     (Luna) o «test» (prueba/primer vuelo de un vehículo nuevo). Un lanzamiento puede tener varios.
// El resto (satélites comerciales, cargueros de rutina, militares…) no entra: es un calendario del
// cielo, no un manifiesto de lanzamientos.

/** Megaconstelaciones de despliegue continuo. */
export const MEGACONSTELLATION_RE = /\b(starlink|kuiper|amazon\s*leo|project\s*kuiper|oneweb|qianfan|g60|spacesail|thousand\s*sails|guowang|china\s*sat\s*net|satnet|sat\s*net|lightspeed|hulianwang)\b/i;
/** Vehículos que aún están en fase de pruebas (revisar cada tanto; a 2026-11). */
export const TEST_VEHICLES_RE = /\b(starship|super\s*heavy|neutron|terran\s*r|stoke\s*nova|zhuque-?3|tianlong-?3|long\s*march\s*10|hyperbola-?3|pallas-?1|vikram-?1|spectrum|rfa\s*one|miura)\b/i;

const FLIGHT_NAME_RE = /(\bflight\s*\d+\b|\btest\s*flight\b|\bmaiden\b|\binaugural\b|\bdemo(?:nstration)?\s*flight\b|\bprotoflight\b)/i;
const FLIGHT_DESC_RE = /\b(test\s*flight|maiden\s*(?:flight|launch)|inaugural\s*(?:flight|launch)|first\s*flight\s*of)\b/i;
const CREW_RE = /(?<!un)\bcrewed\b|\bcrew-\d+\b|\bax-\d+\b|\bastronauts?\b|\bcosmonauts?\b|\btaikonauts?\b|\bshenzhou\b|\bsoyuz\s*ms\b|\bgaganyaan\b|\bcrew\s*dragon\b|\bstarliner\b/i;
const SCIENCE_TYPE_RE = /(planetary|astrophysics|heliophysics|earth\s*science|science|scientific|observatory)/i;
const SCIENCE_TEXT_RE = /\b(telescope|observatory|probe|rover|lander|orbiter|asteroid|comet|sample\s*return|exoplanet)\b/i;
const MOON_HEAD_RE = /\b(artemis|moon|lunar|clps|chang'?e|chandrayaan|luna-\d+|intuitive\s*machines|ispace|blue\s*ghost|gateway|blue\s*moon|peregrine)\b/i;
const MOON_DESC_RE = /\b(artemis|clps|lunar\s*(?:lander|orbiter|flyby|surface|south\s*pole)|moon\s*landing)\b/i;

const txt = (l) => [l.name, l.mission, l.description, l.rocket].filter(Boolean).join(" \n ");

/**
 * Clasifica un lanzamiento.
 * @returns {{ show: boolean, routine: boolean, reasons: ("crew"|"science"|"moon"|"test")[] }}
 */
export function classifyLaunch(l) {
  if (!l || typeof l !== "object") return { show: false, routine: false, reasons: [] };
  const name = String(l.name || ""), desc = String(l.description || ""), mtype = String(l.mission_type || "");
  const head = [name, l.mission].filter(Boolean).join(" ");
  const rocketPart = `${l.rocket || ""} ${name.split("|")[0]}`;
  const mega = MEGACONSTELLATION_RE.test(txt(l));
  // prueba / primer vuelo de un vehículo nuevo
  const test = FLIGHT_NAME_RE.test(head) || FLIGHT_DESC_RE.test(desc) || /test\s*flight/i.test(mtype) || TEST_VEHICLES_RE.test(rocketPart);
  if (mega && !test) return { show: false, routine: true, reasons: [] };

  const reasons = [];
  if (CREW_RE.test(head) || (/human\s*exploration/i.test(mtype) && CREW_RE.test(txt(l)))) reasons.push("crew");
  if (SCIENCE_TYPE_RE.test(mtype) || SCIENCE_TEXT_RE.test(head)) reasons.push("science");
  if (MOON_HEAD_RE.test(head) || MOON_DESC_RE.test(desc)) reasons.push("moon");
  if (test) reasons.push("test");
  return { show: reasons.length > 0, routine: false, reasons };
}

/** Lanzamientos que se muestran, con su motivo: [{ launch, reasons }]. Conserva el orden de entrada. */
export function filterLaunches(list) {
  const out = [];
  for (const l of Array.isArray(list) ? list : []) { const c = classifyLaunch(l); if (c.show) out.push({ launch: l, reasons: c.reasons }); }
  return out;
}
