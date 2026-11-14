// issLoader.js — pasadas de la ISS, integración TOLERANTE con el trabajo de otro agente:
//   · si existe src/sky/issPasses.js, se usa su función de fetch (fetchIssPasses);
//   · si no existe (o no la exporta), fetch directo a GET /api/iss/passes;
//   · si responde 404, error o red caída, devuelve [] sin mensaje alguno.
// Este archivo usa import.meta.glob (Vite) y por eso NO lo importan las pruebas de Node;
// la lógica pura (normalizeIss) está en events.js.
import { fetchJson, isAbort } from "../../net.js";

const MODS = import.meta.glob("../../sky/issPasses.js");
const DAYS = 10;

export async function loadIssPasses({ api = "", lat, lon, elev = 0, signal } = {}) {
  try {
    const key = Object.keys(MODS)[0];
    if (key) {
      const mod = await MODS[key]();
      if (typeof mod.fetchIssPasses === "function") {
        const data = await mod.fetchIssPasses({ lat, lon, altM: elev, days: DAYS, signal, api });
        return Array.isArray(data && data.passes) ? data.passes : [];
      }
    }
    const q = new URLSearchParams({ lat: String(Math.round(lat * 1000) / 1000), lon: String(Math.round(lon * 1000) / 1000), alt_m: String(Math.round(elev || 0)), days: String(DAYS) });
    const data = await fetchJson(`${api}/api/iss/passes?${q}`, { signal });
    return Array.isArray(data && data.passes) ? data.passes : [];
  } catch (e) {
    if (isAbort(e)) throw e;
    return [];            // 404, 5xx, sin red… la ISS simplemente no aparece
  }
}
