// constellations.js — nombre en español y origen de cada una de las 88 constelaciones
// de la Unión Astronómica Internacional, y los cálculos de su ficha.
//
// Origen: columna "Origin" de la tabla de Wikipedia «IAU designated constellations»
// (https://en.wikipedia.org/wiki/IAU_designated_constellations), consultada el
// 13-nov-2026. Solo se dice quién la catalogó y cuándo; la ficha no cuenta mitos.
//   P = antigua, en el Almagesto de Ptolomeo (siglo II)
//   A = parte de la antigua Argo Navis de Ptolomeo, separada por Lacaille (1756)
//   V = antigua; separada como constelación propia por Caspar Vopel (1536)
//   K = 1598, Plancius a partir de las observaciones de Keyser y de Houtman
//   C = 1589, Plancius · F = 1592, Plancius · M = 1613, Plancius
//   H = 1690, Hevelius · L = 1756, Lacaille
export const CON_SOURCE = "https://en.wikipedia.org/wiki/IAU_designated_constellations";
export const CON_INFO = {
  And: ["Andrómeda", "P"], Ant: ["Máquina Neumática", "L"], Aps: ["Ave del Paraíso", "K"], Aqr: ["Acuario", "P"], Aql: ["Águila", "P"],
  Ara: ["Altar", "P"], Ari: ["Aries", "P"], Aur: ["Cochero", "P"], Boo: ["Boyero", "P"], Cae: ["Cincel", "L"],
  Cam: ["Jirafa", "M"], Cnc: ["Cáncer", "P"], CVn: ["Perros de Caza", "H"], CMa: ["Can Mayor", "P"], CMi: ["Can Menor", "P"],
  Cap: ["Capricornio", "P"], Car: ["Quilla", "A"], Cas: ["Casiopea", "P"], Cen: ["Centauro", "P"], Cep: ["Cefeo", "P"],
  Cet: ["Ballena", "P"], Cha: ["Camaleón", "K"], Cir: ["Compás", "L"], Col: ["Paloma", "F"], Com: ["Cabellera de Berenice", "V"],
  CrA: ["Corona Austral", "P"], CrB: ["Corona Boreal", "P"], Crv: ["Cuervo", "P"], Crt: ["Copa", "P"], Cru: ["Cruz del Sur", "C"],
  Cyg: ["Cisne", "P"], Del: ["Delfín", "P"], Dor: ["Dorado", "K"], Dra: ["Dragón", "P"], Equ: ["Caballito", "P"],
  Eri: ["Erídano", "P"], For: ["Horno", "L"], Gem: ["Géminis", "P"], Gru: ["Grulla", "K"], Her: ["Hércules", "P"],
  Hor: ["Reloj", "L"], Hya: ["Hidra", "P"], Hyi: ["Hidra Macho", "K"], Ind: ["Indio", "K"], Lac: ["Lagarto", "H"],
  Leo: ["Leo", "P"], LMi: ["León Menor", "H"], Lep: ["Liebre", "P"], Lib: ["Libra", "P"], Lup: ["Lobo", "P"],
  Lyn: ["Lince", "H"], Lyr: ["Lira", "P"], Men: ["Mesa", "L"], Mic: ["Microscopio", "L"], Mon: ["Unicornio", "M"],
  Mus: ["Mosca", "K"], Nor: ["Escuadra", "L"], Oct: ["Octante", "L"], Oph: ["Ofiuco", "P"], Ori: ["Orión", "P"],
  Pav: ["Pavo", "K"], Peg: ["Pegaso", "P"], Per: ["Perseo", "P"], Phe: ["Fénix", "K"], Pic: ["Pintor", "L"],
  Psc: ["Piscis", "P"], PsA: ["Pez Austral", "P"], Pup: ["Popa", "A"], Pyx: ["Brújula", "L"], Ret: ["Retículo", "L"],
  Sge: ["Flecha", "P"], Sgr: ["Sagitario", "P"], Sco: ["Escorpio", "P"], Scl: ["Escultor", "L"], Sct: ["Escudo", "H"],
  Ser: ["Serpiente", "P"], Sex: ["Sextante", "H"], Tau: ["Tauro", "P"], Tel: ["Telescopio", "L"], Tri: ["Triángulo", "P"],
  TrA: ["Triángulo Austral", "K"], Tuc: ["Tucán", "K"], UMa: ["Osa Mayor", "P"], UMi: ["Osa Menor", "P"], Vel: ["Vela", "A"],
  Vir: ["Virgo", "P"], Vol: ["Pez Volador", "K"], Vul: ["Zorra", "H"],
};
export const conNameEs = (ab) => (CON_INFO[ab] ? CON_INFO[ab][0] : null);
export const conOrigin = (ab) => (CON_INFO[ab] ? CON_INFO[ab][1] : null);

/**
 * Datos de la ficha de una constelación a partir del catálogo (función pura).
 * `c` = { ab, la, en, lines: [[hip…]…] }; `stars` = filas [hip, nx, ny, nz, mag, color, dist_ly, nombre].
 * Devuelve { dir, radius, stars:[{hip, name, mag, dist, dir}], near, far, ratio, hips:Set }.
 *   dir = centroide unitario; radius = separación angular máxima al centroide (rad).
 */
export function constellationData(c, stars, byHipIn) {
  const byHip = byHipIn || new Map(stars.map((s) => [s[0], s]));
  const seen = new Set(), list = [];
  let x = 0, y = 0, z = 0;
  for (const poly of c.lines) for (const h of poly) {
    if (seen.has(h)) continue; seen.add(h);
    const s = byHip.get(h); if (!s) continue;
    x += s[1]; y += s[2]; z += s[3];
    list.push({ hip: h, name: s[7] || "", mag: s[4], dist: s[6] > 0 ? s[6] : null, dir: [s[1], s[2], s[3]], hex: s[5] });
  }
  const L = Math.hypot(x, y, z);
  if (!list.length || L === 0) return null;
  const dir = [x / L, y / L, z / L];
  let radius = 0;
  for (const s of list) radius = Math.max(radius, Math.acos(Math.max(-1, Math.min(1, s.dir[0] * dir[0] + s.dir[1] * dir[1] + s.dir[2] * dir[2]))));
  const withD = list.filter((s) => s.dist != null);
  const near = withD.reduce((a, s) => (!a || s.dist < a.dist ? s : a), null), far = withD.reduce((a, s) => (!a || s.dist > a.dist ? s : a), null);
  list.sort((a, b) => a.mag - b.mag);
  return { dir, radius, stars: list, near, far, ratio: near && far && near.dist > 0 ? far.dist / near.dist : null, hips: seen };
}
