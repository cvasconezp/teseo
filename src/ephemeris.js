// ephemeris.js — posiciones reales de Sol, Luna y planetas (método de Paul Schlyter).
// Determinista; precisión ~1-2 minutos de arco. Devuelve dirección ecuatorial (nx,ny,nz).
const RAD = Math.PI / 180;
const sind = x => Math.sin(x * RAD), cosd = x => Math.cos(x * RAD);
const atan2d = (y, x) => Math.atan2(y, x) / RAD, asind = x => Math.asin(x) / RAD;
const rev = x => { x = x % 360; return x < 0 ? x + 360 : x; };

function dayNum(date) { return date.getTime() / 86400000 + 2440587.5 - 2451543.5; }

function kepler(M, e) {
  M = rev(M);
  let E = M + (180 / Math.PI) * e * sind(M) * (1 + e * cosd(M));
  for (let k = 0; k < 8; k++) {
    const dE = (E - (180 / Math.PI) * e * sind(E) - M) / (1 - e * cosd(E));
    E -= dE; if (Math.abs(dE) < 1e-6) break;
  }
  return E;
}
function eclToEq(xe, ye, ze, ecl) {
  return { x: xe, y: ye * cosd(ecl) - ze * sind(ecl), z: ye * sind(ecl) + ze * cosd(ecl) };
}
function toDir(eq) {
  const r = Math.sqrt(eq.x * eq.x + eq.y * eq.y + eq.z * eq.z);
  return [eq.x / r, eq.y / r, eq.z / r];
}

const PLANETS = {
  Mercury: d => ({ N: 48.3313 + 3.24587e-5 * d, i: 7.0047 + 5.00e-8 * d, w: 29.1241 + 1.01444e-5 * d, a: 0.387098, e: 0.205635 + 5.59e-10 * d, M: 168.6562 + 4.0923344368 * d }),
  Venus:   d => ({ N: 76.6799 + 2.46590e-5 * d, i: 3.3946 + 2.75e-8 * d, w: 54.8910 + 1.38374e-5 * d, a: 0.723330, e: 0.006773 - 1.302e-9 * d, M: 48.0052 + 1.6021302244 * d }),
  Mars:    d => ({ N: 49.5574 + 2.11081e-5 * d, i: 1.8497 - 1.78e-8 * d, w: 286.5016 + 2.92961e-5 * d, a: 1.523688, e: 0.093405 + 2.516e-9 * d, M: 18.6021 + 0.5240207766 * d }),
  Jupiter: d => ({ N: 100.4542 + 2.76854e-5 * d, i: 1.3030 - 1.557e-7 * d, w: 273.8777 + 1.64505e-5 * d, a: 5.20256, e: 0.048498 + 4.469e-9 * d, M: 19.8950 + 0.0830853001 * d }),
  Saturn:  d => ({ N: 113.6634 + 2.38980e-5 * d, i: 2.4886 - 1.081e-7 * d, w: 339.3939 + 2.97661e-5 * d, a: 9.55475, e: 0.055546 - 9.499e-9 * d, M: 316.9670 + 0.0334442282 * d }),
  Uranus:  d => ({ N: 74.0005 + 1.3978e-5 * d, i: 0.7733 + 1.9e-8 * d, w: 96.6612 + 3.0565e-5 * d, a: 19.18171 - 1.55e-8 * d, e: 0.047318 + 7.45e-9 * d, M: 142.5905 + 0.011725806 * d }),
  Neptune: d => ({ N: 131.7806 + 3.0173e-5 * d, i: 1.7700 - 2.55e-7 * d, w: 272.8461 - 6.027e-6 * d, a: 30.05826 + 3.313e-8 * d, e: 0.008606 + 2.15e-9 * d, M: 260.2471 + 0.005995147 * d }),
};

function sunRect(d) {
  const w = 282.9404 + 4.70935e-5 * d, e = 0.016709 - 1.151e-9 * d, M = 356.0470 + 0.9856002585 * d;
  const E = kepler(M, e);
  const xv = cosd(E) - e, yv = Math.sqrt(1 - e * e) * sind(E);
  const v = atan2d(yv, xv), r = Math.sqrt(xv * xv + yv * yv);
  const lon = rev(v + w);
  return { x: r * cosd(lon), y: r * sind(lon), r, lon, M, w };
}

export function ephemeris(date) {
  const d = dayNum(date);
  const ecl = 23.4393 - 3.563e-7 * d;
  const out = [];
  const sun = sunRect(d);
  // Sol
  out.push({ name: "Sol", body: "sun", ...dirObj(eclToEq(sun.x, sun.y, 0, ecl)), dist_au: sun.r });

  // Planetas (heliocéntrico -> geocéntrico sumando el Sol)
  for (const key in PLANETS) {
    const p = PLANETS[key](d);
    const E = kepler(p.M, p.e);
    const xv = p.a * (cosd(E) - p.e), yv = p.a * Math.sqrt(1 - p.e * p.e) * sind(E);
    const v = atan2d(yv, xv), r = Math.sqrt(xv * xv + yv * yv);
    const lon = v + p.w;
    const xh = r * (cosd(p.N) * cosd(lon) - sind(p.N) * sind(lon) * cosd(p.i));
    const yh = r * (sind(p.N) * cosd(lon) + cosd(p.N) * sind(lon) * cosd(p.i));
    const zh = r * (sind(lon) * sind(p.i));
    const xg = xh + sun.x, yg = yh + sun.y, zg = zh;
    out.push({ name: nameES(key), body: "planet", planet: key, ...dirObj(eclToEq(xg, yg, zg, ecl)), dist_au: Math.sqrt(xg*xg+yg*yg+zg*zg) });
  }

  // Luna (geocéntrica) + perturbaciones principales
  const N = 125.1228 - 0.0529538083 * d, i = 5.1454, w = 318.0634 + 0.1643573223 * d;
  const a = 60.2666, e = 0.054900, M = 115.3654 + 13.0649929509 * d;
  const E = kepler(M, e);
  const xv = a * (cosd(E) - e), yv = a * Math.sqrt(1 - e * e) * sind(E);
  const v = atan2d(yv, xv), r = Math.sqrt(xv * xv + yv * yv);
  const lon = v + w;
  let xh = r * (cosd(N) * cosd(lon) - sind(N) * sind(lon) * cosd(i));
  let yh = r * (sind(N) * cosd(lon) + cosd(N) * sind(lon) * cosd(i));
  let zh = r * (sind(lon) * sind(i));
  let mlon = atan2d(yh, xh), mlat = atan2d(zh, Math.sqrt(xh * xh + yh * yh));
  const Ms = sun.M, ws = sun.w, Mm = M, Ls = rev(Ms + ws), Lm = rev(Mm + w + N), D = rev(Lm - Ls), F = rev(Lm - N);
  mlon += -1.274 * sind(Mm - 2*D) + 0.658 * sind(2*D) - 0.186 * sind(Ms) - 0.059 * sind(2*Mm - 2*D)
        - 0.057 * sind(Mm - 2*D + Ms) + 0.053 * sind(Mm + 2*D) + 0.046 * sind(2*D - Ms) + 0.041 * sind(Mm - Ms)
        - 0.035 * sind(D) - 0.031 * sind(Mm + Ms) - 0.015 * sind(2*F - 2*D) + 0.011 * sind(Mm - 4*D);
  mlat += -0.173 * sind(F - 2*D) - 0.055 * sind(Mm - F - 2*D) - 0.046 * sind(Mm + F - 2*D)
        + 0.033 * sind(F + 2*D) + 0.017 * sind(2*Mm + F);
  const xe2 = cosd(mlat) * cosd(mlon), ye2 = cosd(mlat) * sind(mlon), ze2 = sind(mlat);
  const moonEq = eclToEq(xe2, ye2, ze2, ecl);
  // fase: elongación Sol-Luna
  const elong = Math.acos(Math.max(-1, Math.min(1, cosd(mlat) * cosd(mlon - sun.lon)))) / RAD;
  const illum = (1 - cosd(elong)) / 2;
  const waxing = rev(mlon - sun.lon) < 180;
  out.push({ name: "Luna", body: "moon", ...dirObj(moonEq), illum: +illum.toFixed(2), waxing, dist_km: Math.round(r * 6371) });
  return out;
}
function dirObj(eq) { const dr = toDir(eq); return { nx: +dr[0].toFixed(5), ny: +dr[1].toFixed(5), nz: +dr[2].toFixed(5), ra: rev(atan2d(eq.y, eq.x)), dec: asind(eq.z / Math.sqrt(eq.x*eq.x+eq.y*eq.y+eq.z*eq.z)) }; }
function nameES(k){ return { Mercury:"Mercurio", Venus:"Venus", Mars:"Marte", Jupiter:"Júpiter", Saturn:"Saturno", Uranus:"Urano", Neptune:"Neptuno" }[k]; }
