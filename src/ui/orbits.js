// orbits.js — física local y determinista (sin red, sin IA).
// Sirve de respaldo cuando el backend no responde y para dibujar el mapa:
//   · posiciones heliocéntricas aproximadas (elementos medios de P. Schlyter,
//     precisión de minutos de arco para los planetas interiores y ~1° para los
//     gigantes: suficiente para un mapa esquemático);
//   · transferencia de Hohmann entre órbitas circulares y coplanares (la misma
//     fórmula que usa el backend con hapsira);
//   · ventanas de lanzamiento por ángulo de fase (mismo método del backend,
//     con efemérides aproximadas).
// Las constantes replican backend/app/orbital.py para que los números coincidan.

const RAD = Math.PI / 180;
const TAU = Math.PI * 2;
const DAY_MS = 86400000;
export const AU_KM = 149_597_870.7;

export const SEMI_MAJOR_AXIS_AU = {
  mercury: 0.387, venus: 0.723, earth: 1.0, mars: 1.524,
  jupiter: 5.203, saturn: 9.537, uranus: 19.191, neptune: 30.069,
};
export const ORBITAL_PERIOD_DAYS = {
  mercury: 87.97, venus: 224.7, earth: 365.25, mars: 686.98,
  jupiter: 4332.59, saturn: 10759.22, uranus: 30688.5, neptune: 60182.0,
};

// Elementos orbitales medios (d = días desde 2000-01-00 0h TT)
const ELEMENTS = {
  mercury: d => ({ N: 48.3313 + 3.24587e-5 * d, i: 7.0047 + 5.0e-8 * d, w: 29.1241 + 1.01444e-5 * d, a: 0.387098, e: 0.205635 + 5.59e-10 * d, M: 168.6562 + 4.0923344368 * d }),
  venus:   d => ({ N: 76.6799 + 2.4659e-5 * d, i: 3.3946 + 2.75e-8 * d, w: 54.891 + 1.38374e-5 * d, a: 0.72333, e: 0.006773 - 1.302e-9 * d, M: 48.0052 + 1.6021302244 * d }),
  mars:    d => ({ N: 49.5574 + 2.11081e-5 * d, i: 1.8497 - 1.78e-8 * d, w: 286.5016 + 2.92961e-5 * d, a: 1.523688, e: 0.093405 + 2.516e-9 * d, M: 18.6021 + 0.5240207766 * d }),
  jupiter: d => ({ N: 100.4542 + 2.76854e-5 * d, i: 1.303 - 1.557e-7 * d, w: 273.8777 + 1.64505e-5 * d, a: 5.20256, e: 0.048498 + 4.469e-9 * d, M: 19.895 + 0.0830853001 * d }),
  saturn:  d => ({ N: 113.6634 + 2.3898e-5 * d, i: 2.4886 - 1.081e-7 * d, w: 339.3939 + 2.97661e-5 * d, a: 9.55475, e: 0.055546 - 9.499e-9 * d, M: 316.967 + 0.0334442282 * d }),
  uranus:  d => ({ N: 74.0005 + 1.3978e-5 * d, i: 0.7733 + 1.9e-8 * d, w: 96.6612 + 3.0565e-5 * d, a: 19.18171 - 1.55e-8 * d, e: 0.047318 + 7.45e-9 * d, M: 142.5905 + 0.011725806 * d }),
  neptune: d => ({ N: 131.7806 + 3.0173e-5 * d, i: 1.77 - 2.55e-7 * d, w: 272.8461 - 6.027e-6 * d, a: 30.05826 + 3.313e-8 * d, e: 0.008606 + 2.15e-9 * d, M: 260.2471 + 0.005995147 * d }),
};

const dayNum = ms => ms / DAY_MS + 2440587.5 - 2451543.5;

function kepler(Mdeg, e) {
  const M = (((Mdeg % 360) + 360) % 360) * RAD;
  let E = M + e * Math.sin(M) * (1 + e * Math.cos(M));
  for (let k = 0; k < 10; k++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-9) break;
  }
  return E;
}

/** Posición heliocéntrica eclíptica aproximada {x_au, y_au, z_au} de un planeta. */
export function helioPosition(id, date = new Date()) {
  const d = dayNum(+date);
  if (id === "earth") {
    // Sol geocéntrico cambiado de signo
    const w = 282.9404 + 4.70935e-5 * d, e = 0.016709 - 1.151e-9 * d, M = 356.047 + 0.9856002585 * d;
    const E = kepler(M, e);
    const xv = Math.cos(E) - e, yv = Math.sqrt(1 - e * e) * Math.sin(E);
    const lon = Math.atan2(yv, xv) + w * RAD, r = Math.hypot(xv, yv);
    return { x_au: -r * Math.cos(lon), y_au: -r * Math.sin(lon), z_au: 0 };
  }
  const p = ELEMENTS[id](d);
  const E = kepler(p.M, p.e);
  const xv = p.a * (Math.cos(E) - p.e), yv = p.a * Math.sqrt(1 - p.e * p.e) * Math.sin(E);
  const lon = Math.atan2(yv, xv) + p.w * RAD, r = Math.hypot(xv, yv);
  const N = p.N * RAD, i = p.i * RAD;
  return {
    x_au: r * (Math.cos(N) * Math.cos(lon) - Math.sin(N) * Math.sin(lon) * Math.cos(i)),
    y_au: r * (Math.sin(N) * Math.cos(lon) + Math.cos(N) * Math.sin(lon) * Math.cos(i)),
    z_au: r * Math.sin(lon) * Math.sin(i),
  };
}

const helioLon = (id, ms) => { const p = helioPosition(id, ms); return Math.atan2(p.y_au, p.x_au); };

/** Distancia aproximada (km) entre dos planetas en una fecha. */
export function approxDistanceKm(a, b, date = new Date()) {
  const pa = helioPosition(a, date), pb = helioPosition(b, date);
  return Math.hypot(pa.x_au - pb.x_au, pa.y_au - pb.y_au, pa.z_au - pb.z_au) * AU_KM;
}

/** Transferencia de Hohmann entre órbitas circulares coplanares (mismos campos que el backend). */
export function hohmannLocal(origin, destination, departure = new Date()) {
  const r1 = SEMI_MAJOR_AXIS_AU[origin], r2 = SEMI_MAJOR_AXIS_AU[destination];
  const a = (r1 + r2) / 2;
  const days = 0.5 * Math.pow(a, 1.5) * 365.2568983;          // medio período de la elipse
  const V0 = 29.7847;                                          // km/s, velocidad circular a 1 UA
  const v1 = V0 / Math.sqrt(r1), v2 = V0 / Math.sqrt(r2);
  const dv1 = Math.abs(v1 * (Math.sqrt((2 * r2) / (r1 + r2)) - 1));
  const dv2 = Math.abs(v2 * (1 - Math.sqrt((2 * r1) / (r1 + r2))));
  const dep = new Date(+departure);
  return {
    origin, destination,
    departure_date: dep.toISOString(),
    arrival_date: new Date(+dep + days * DAY_MS).toISOString(),
    transfer_time_days: +days.toFixed(2),
    delta_v_total_km_s: +(dv1 + dv2).toFixed(3),
    delta_v_departure_km_s: +dv1.toFixed(3),
    delta_v_arrival_km_s: +dv2.toFixed(3),
    origin_orbit_radius_au: r1,
    destination_orbit_radius_au: r2,
    transfer_semi_major_axis_au: +a.toFixed(4),
    is_outbound: r2 > r1,
    local: true,
  };
}

const wrapPi = a => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;

/** Ventanas de lanzamiento por ángulo de fase (respaldo local del endpoint del backend). */
export function launchWindowsLocal(origin, destination, start = new Date(), count = 4) {
  const ref = hohmannLocal(origin, destination, start);
  const t1 = ORBITAL_PERIOD_DAYS[origin], t2 = ORBITAL_PERIOD_DAYS[destination];
  const synodic = 1 / Math.abs(1 / t1 - 1 / t2);
  const required = wrapPi(Math.PI - (TAU / t2) * ref.transfer_time_days);
  const t0 = +start;
  const f = days => wrapPi(helioLon(destination, t0 + days * DAY_MS) - helioLon(origin, t0 + days * DAY_MS) - required);
  const step = Math.max(synodic / 400, 0.25), span = synodic * (count + 1.2);
  const windows = [];
  let prevT = 0, prev = f(0);
  for (let t = step; t <= span + step && windows.length < count; t += step) {
    const cur = f(t);
    if (prev === 0 || (prev * cur < 0 && Math.abs(prev - cur) < Math.PI)) {
      let lo = prevT, hi = t, flo = prev;
      for (let k = 0; k < 30; k++) {
        const mid = 0.5 * (lo + hi), fm = f(mid);
        if (flo * fm <= 0) hi = mid; else { lo = mid; flo = fm; }
      }
      const tw = 0.5 * (lo + hi);
      const dep = new Date(t0 + tw * DAY_MS);
      windows.push({
        window_number: windows.length + 1,
        departure_date: dep.toISOString(),
        arrival_date: new Date(+dep + ref.transfer_time_days * DAY_MS).toISOString(),
        transfer_time_days: +ref.transfer_time_days.toFixed(1),
        delta_v_km_s: ref.delta_v_total_km_s,
        days_from_start: +tw.toFixed(1),
      });
    }
    prevT = t; prev = cur;
  }
  return {
    origin, destination,
    synodic_period_days: +synodic.toFixed(1),
    synodic_period_years: +(synodic / 365.25).toFixed(2),
    required_phase_angle_deg: +(required / RAD).toFixed(1),
    windows,
    local: true,
  };
}
