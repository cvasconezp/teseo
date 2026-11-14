// gwData.js — física pura, datos y fuentes del recorrido «¿Qué son las ondas
// gravitacionales?». Sin React ni red. Los textos viven en gwText.js; las
// constantes generales, en constants.js (G, c, M☉ de CODATA 2018 / IAU 2015).
// Cifras verificadas el 14-nov-2026.
//
//  · GW150914 — Abbott et al. (2016), PRL 116, 061102 (resumen): 14-sep-2015,
//    09:50:45 UTC; masas iniciales 36 (+5/−4) y 29 (+4/−4) M☉; masa final 62 (±4) M☉;
//    energía radiada 3,0 (±0,5) M☉c²; distancia de luminosidad 410 (+160/−180) Mpc
//    (z = 0,09); deformación máxima 1,0 × 10⁻²¹; la señal sube de 35 a 250 Hz y dura
//    unos 0,2 s. 410 Mpc = 1.337 millones de años luz («unos 1.300 millones»).
//  · GW170817 — Abbott et al. (2017), PRL 119, 161101 (resumen): 17-ago-2017, 12:41:04
//    UTC; masa total 2,74 (+0,04/−0,01) M☉; masas individuales 1,17–1,60 M☉ (con espines
//    bajos: 1,36–1,60 y 1,17–1,36); distancia 40 (+8/−14) Mpc = 130 millones de años luz;
//    el estallido GRB 170817A llegó 1,7 s después. Aquí se usan 1,46 y 1,27 M☉, valores
//    centrales de esos intervalos, que reproducen la masa de chirp publicada (1,188 M☉).
//  · Velocidad de la gravedad — Abbott et al. (2017), ApJL 848, L13: retraso +1,74 ± 0,05 s
//    entre GW170817 y GRB 170817A ⇒ (v_g − c)/c entre −3 × 10⁻¹⁵ y +7 × 10⁻¹⁶.
//  · Kilonova (AT 2017gfo) — Abbott et al. (2017), ApJL 848, L12; origen de los elementos
//    pesados — Kasen et al. (2017), Nature 551, 80.
//  · Catálogo — GWTC-4.0 (LIGO-Virgo-KAGRA, 2025): 128 candidatos nuevos y un total de 218
//    en todo el catálogo GWTC (probabilidad astrofísica > 50 %), hasta la primera parte
//    de la cuarta campaña de observación (O4a).
//  · LISA — ESA la adoptó en enero de 2024; lanzamiento previsto hacia 2035 (ficha de ESA).
//  · Nobel de Física 2017: Rainer Weiss, Barry Barish y Kip Thorne «por contribuciones
//    decisivas al detector LIGO y a la observación de ondas gravitacionales».
//  · Brazos de LIGO: 4 km (Aasi et al. 2015, Class. Quantum Grav. 32, 074001).
//  · Protón: radio de carga cuadrático medio 0,8414 fm (CODATA 2018, NIST) ⇒ diámetro ≈ 1,68 fm.
//  · Masa típica de una estrella de neutrones en binarias: 1,33 M☉ (Özel y Freire 2016).
//
// Fórmulas (Maggiore, «Gravitational Waves», vol. 1, cap. 4; Abbott et al. 2017, Ann. Phys.
// 529, 1600209), con Θ = G M☉ / c³ = 4,925 × 10⁻⁶ s:
//   ℳ = (m₁ m₂)^(3/5) / (m₁ + m₂)^(1/5)                     masa de chirp
//   f_ISCO = c³ / (6^(3/2) π G M)                            frecuencia de la onda (2 × la orbital)
//   τ(f) = (5/256) (π f)^(−8/3) (G ℳ / c³)^(−5/3)            tiempo hasta la fusión
//   f(τ) = (1/π) (5 / (256 τ))^(3/8) (G ℳ / c³)^(−5/8)      su inversa
//   h ≈ (4 / r) (G ℳ / c²)^(5/3) (π f / c)^(2/3)            amplitud, orientación óptima
//   Φ(τ) = 2 (5 G ℳ / c³)^(−5/8) τ^(5/8)                     fase que queda por recorrer
import { C, GM_SUN, M_SUN_KG, MPC, LY, MPC_IN_LY } from "./constants.js";
import { clamp } from "./physics.js";

// ═══ Constantes propias de este recorrido ════════════════════════════════════
export const THETA_SUN = GM_SUN / (C * C * C);          // G M☉ / c³ en s (4,925 × 10⁻⁶)
export const LIGO_ARM_M = 4000;                         // m
export const PROTON_RADIUS_M = 0.8414e-15;              // m (CODATA 2018)
export const PROTON_DIAMETER_M = 2 * PROTON_RADIUS_M;
export const F_LIGO_REF = 35;                           // Hz: donde GW150914 entra en la banda (Abbott 2016)
export const GW150914_H = 1.0e-21;                      // deformación máxima publicada

// ═══ Fórmulas ════════════════════════════════════════════════════════════════
export const totalMass = (m1, m2) => m1 + m2;
export const chirpMass = (m1, m2) => Math.pow(m1 * m2, 3 / 5) / Math.pow(m1 + m2, 1 / 5);
// Frecuencia de la onda en la última órbita estable (ISCO), en Hz, con M en M☉.
export const fIsco = (M) => (C * C * C) / (Math.pow(6, 1.5) * Math.PI * GM_SUN * M);
// Tiempo (s) hasta la fusión newtoniana desde la frecuencia f (Hz); ℳ en M☉.
export const timeToMerger = (f, chirp) => (5 / 256) * Math.pow(Math.PI * f, -8 / 3) * Math.pow(THETA_SUN * chirp, -5 / 3);
// Frecuencia (Hz) a τ segundos de la fusión.
export const freqAtTime = (tau, chirp) => (1 / Math.PI) * Math.pow(5 / (256 * tau), 3 / 8) * Math.pow(THETA_SUN * chirp, -5 / 8);
// Ciclos de la onda que quedan hasta la fusión a τ segundos de ella.
export const cyclesLeft = (tau, chirp) => (2 * Math.pow(5 * THETA_SUN * chirp, -5 / 8) * Math.pow(tau, 5 / 8)) / (2 * Math.PI);
export const tauFromCycles = (n, chirp) => Math.pow((n * 2 * Math.PI) / (2 * Math.pow(5 * THETA_SUN * chirp, -5 / 8)), 8 / 5);
// Deformación (orden de magnitud, orientación óptima, sin corrimiento al rojo). d en metros.
export function strain(chirp, f, dMeters) {
  const gm = chirp * GM_SUN / (C * C);                   // G ℳ / c²  (m)
  return (4 / dMeters) * Math.pow(gm, 5 / 3) * Math.pow((Math.PI * f) / C, 2 / 3);
}
export const mlyToMeters = (mly) => mly * 1e6 * LY;
export const mpcToMly = (mpc) => (mpc * MPC_IN_LY) / 1e6;   // Mpc → millones de años luz
// Diferencia de longitud entre los dos brazos: ΔL = h · L. Cada brazo cambia h·L/2.
export const armDifference = (h, L = LIGO_ARM_M) => h * L;
// Energía en julios de una masa m (M☉) convertida en energía: E = m M☉ c².
export const energyJ = (mSun) => mSun * M_SUN_KG * C * C;

// ═══ Escalas de los deslizadores ═════════════════════════════════════════════
// Masas: 1–100 M☉ en escala logarítmica (200 pasos: 10^(s/100)); redondeadas a
// 3 cifras para que el valor mostrado sea el valor usado.
export const MASS_SLIDER = { min: 0, max: 200, step: 1 };
export const MASS_MIN = 1, MASS_MAX = 100;
const round3 = (x) => Number(x.toPrecision(3));
export const massFromSlider = (s) => clamp(round3(Math.pow(10, clamp(s, 0, 200) / 100)), MASS_MIN, MASS_MAX);
export const sliderFromMass = (m) => clamp(Math.round(100 * Math.log10(clamp(m, MASS_MIN, MASS_MAX))), 0, 200);
// Distancia: de 10 a 10.000 millones de años luz (Mly), en escala logarítmica (10^(1 + s/100)).
export const DIST_SLIDER = { min: 0, max: 300, step: 1 };
export const DIST_MIN = 10, DIST_MAX = 10000;           // millones de años luz
export const distFromSlider = (s) => clamp(round3(Math.pow(10, 1 + clamp(s, 0, 300) / 100)), DIST_MIN, DIST_MAX);
export const sliderFromDist = (d) => clamp(Math.round(100 * (Math.log10(clamp(d, DIST_MIN, DIST_MAX)) - 1)), 0, 300);
// Exageración del anillo: deformación dibujada h_vis = 10^e × 10⁻²¹, con e entre 19,5 y 20,75.
export const EXAG_SLIDER = { min: 0, max: 25, step: 1, start: 16 };
export const exagExponent = (s) => Number((19.5 + 0.05 * clamp(s, 0, 25)).toFixed(2));
export const sliderFromExagExponent = (e) => clamp(Math.round((e - 19.5) / 0.05), 0, 25);
export const exagFactor = (s) => Math.pow(10, exagExponent(s));
export const visibleStrain = (s) => GW150914_H * exagFactor(s);   // 10⁻²¹ × 10^e

// ═══ Anillo de partículas (polarización +) ═══════════════════════════════════
// Una onda + que llega de frente estira x y aplasta y (y al revés medio ciclo después):
//   x' = x (1 + ½ h cos φ),   y' = y (1 − ½ h cos φ).   Devuelve coordenadas en radios.
export function ringPoint(theta, hVis, phase) {
  const c = Math.cos(phase) * hVis * 0.5;
  return [Math.cos(theta) * (1 + c), Math.sin(theta) * (1 - c)];
}

// ═══ Forma de onda esquemática ═══════════════════════════════════════════════
// Los últimos `cycles` ciclos antes de la última órbita estable. Muestras
// uniformes en fase. Amplitud ∝ f^(2/3), normalizada a 1 en el ISCO.
export function waveform(m1, m2, cycles = 14, perCycle = 24) {
  const chirp = chirpMass(m1, m2), fEnd = fIsco(m1 + m2);
  const tauEnd = timeToMerger(fEnd, chirp), nEnd = cyclesLeft(tauEnd, chirp);
  const tauStart = tauFromCycles(nEnd + cycles, chirp);
  const fStart = freqAtTime(tauStart, chirp);
  const n = Math.round(cycles * perCycle);
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const p = (i / n) * cycles;                          // ciclos recorridos desde el inicio
    const tau = tauFromCycles(nEnd + cycles - p, chirp);
    const f = freqAtTime(tau, chirp);
    const a = Math.pow(f / fEnd, 2 / 3);
    pts.push({ t: tauStart - tau, y: a * Math.cos(2 * Math.PI * p) });
  }
  return { pts, chirp, fStart, fEnd, duration: tauStart - tauEnd };
}

// ═══ Sonido ══════════════════════════════════════════════════════════════════
// Se oye el tramo final del chirrido: de f_ISCO/r a f_ISCO, con r = f_ISCO/35 Hz
// acotado entre 1,5 y 8 (35 Hz es donde GW150914 entra en la banda de LIGO).
// Así una binaria pesada suena a barrido corto y grave, y una ligera, a barrido
// largo y agudo. Para que se oiga: (a) el tono se multiplica por k, de modo que
// el centro geométrico del barrido caiga en 600 Hz si queda fuera de la banda
// cómoda de un altavoz de teléfono, y (b) el tiempo se estira (o encoge) hasta
// que dure `seconds`.
export const AUDIO = { target: 600, seconds: 3, ratioMin: 1.5, ratioMax: 8 };
export function audioPlan(m1, m2) {
  const chirp = chirpMass(m1, m2), fEnd = fIsco(m1 + m2);
  const r = clamp(fEnd / F_LIGO_REF, AUDIO.ratioMin, AUDIO.ratioMax), fStart = fEnd / r;
  const tauStart = timeToMerger(fStart, chirp), tauEnd = timeToMerger(fEnd, chirp);
  const k0 = AUDIO.target / Math.sqrt(fStart * fEnd);
  const k = k0 > 0.9 && k0 < 1.1 ? 1 : k0;
  const real = tauStart - tauEnd;
  return { chirp, fStart, fEnd, k, real, stretch: AUDIO.seconds / real, audioStart: k * fStart, audioEnd: k * fEnd };
}
// Muestras mono en [−1, 1]. La fase se integra muestra a muestra.
export function audioSamples(m1, m2, sampleRate = 22050) {
  const plan = audioPlan(m1, m2);
  const N = Math.round(AUDIO.seconds * sampleRate), out = new Float32Array(N);
  const tauStart = timeToMerger(plan.fStart, plan.chirp), tauEnd = timeToMerger(plan.fEnd, plan.chirp);
  const fade = Math.round(0.05 * sampleRate);
  let phase = 0;
  for (let i = 0; i < N; i++) {
    const u = i / (N - 1);
    const tau = tauStart - (tauStart - tauEnd) * u;
    const f = freqAtTime(tau, plan.chirp);
    phase += (2 * Math.PI * plan.k * f) / sampleRate;
    const a = Math.pow(f / plan.fEnd, 2 / 3);
    const env = Math.min(1, i / fade, (N - 1 - i) / fade);
    out[i] = a * env * Math.sin(phase);
  }
  return { samples: out, plan };
}

// ═══ Atajos ══════════════════════════════════════════════════════════════════
export const PRESETS = [
  { id: "gw150914", m1: 36, m2: 29, d: Number(mpcToMly(410).toPrecision(3)), real: true },
  { id: "gw170817", m1: 1.46, m2: 1.27, d: Number(mpcToMly(40).toPrecision(3)), real: true },
  { id: "ns", m1: 1.33, m2: 1.33, d: 300, real: false },
];
export const START_PRESET = PRESETS[0];

// ═══ Fuentes ═════════════════════════════════════════════════════════════════
export const GW_REFS = {
  einstein1916: { url: "https://ui.adsabs.harvard.edu/abs/1916SPAW.......688E/abstract", cite: "Einstein, A. (1916). «Näherungsweise Integration der Feldgleichungen der Gravitation». Sitzungsberichte der Preussischen Akademie der Wissenschaften, 688–696.", citeEn: "Einstein, A. (1916). “Näherungsweise Integration der Feldgleichungen der Gravitation” (Approximate integration of the field equations of gravitation). Sitzungsberichte der Preussischen Akademie der Wissenschaften, 688–696." },
  abbott2016: { url: "https://doi.org/10.1103/PhysRevLett.116.061102", cite: "Abbott et al. (LIGO y Virgo, 2016). «Observation of Gravitational Waves from a Binary Black Hole Merger». Phys. Rev. Lett. 116, 061102 (GW150914).", citeEn: "Abbott et al. (LIGO and Virgo, 2016). “Observation of Gravitational Waves from a Binary Black Hole Merger”. Phys. Rev. Lett. 116, 061102 (GW150914)." },
  abbott2017basic: { url: "https://doi.org/10.1002/andp.201600209", cite: "Abbott et al. (2017). «The basic physics of the binary black hole merger GW150914». Annalen der Physik 529, 1600209.", citeEn: "Abbott et al. (2017). “The basic physics of the binary black hole merger GW150914”. Annalen der Physik 529, 1600209." },
  maggiore: { url: "https://global.oup.com/academic/product/gravitational-waves-9780198570745", cite: "Maggiore, M. (2008). «Gravitational Waves, vol. 1: Theory and Experiments». Oxford University Press, cap. 4.", citeEn: "Maggiore, M. (2008). “Gravitational Waves, vol. 1: Theory and Experiments”. Oxford University Press, ch. 4." },
  aasi2015: { url: "https://arxiv.org/abs/1411.4547", cite: "Aasi et al. (LIGO, 2015). «Advanced LIGO». Class. Quantum Grav. 32, 074001 (brazos de 4 km).", citeEn: "Aasi et al. (LIGO, 2015). “Advanced LIGO”. Class. Quantum Grav. 32, 074001 (4 km arms)." },
  nobel2017: { url: "https://www.nobelprize.org/prizes/physics/2017/summary/", cite: "Nobel Prize in Physics 2017: Weiss, Barish y Thorne. NobelPrize.org.", citeEn: "The Nobel Prize in Physics 2017: Weiss, Barish and Thorne. NobelPrize.org." },
  codataProton: { url: "https://physics.nist.gov/cgi-bin/cuu/Value?rp", cite: "NIST/CODATA 2018: radio de carga del protón, 0,8414(19) fm.", citeEn: "NIST/CODATA 2018: proton rms charge radius, 0.8414(19) fm." },
  abbott2017bns: { url: "https://doi.org/10.1103/PhysRevLett.119.161101", cite: "Abbott et al. (LIGO y Virgo, 2017). «GW170817: Observation of Gravitational Waves from a Binary Neutron Star Inspiral». Phys. Rev. Lett. 119, 161101.", citeEn: "Abbott et al. (LIGO and Virgo, 2017). “GW170817: Observation of Gravitational Waves from a Binary Neutron Star Inspiral”. Phys. Rev. Lett. 119, 161101." },
  abbott2017mm: { url: "https://doi.org/10.3847/2041-8213/aa91c9", cite: "Abbott et al. (2017). «Multi-messenger Observations of a Binary Neutron Star Merger». Astrophys. J. Lett. 848, L12.", citeEn: "Abbott et al. (2017). “Multi-messenger Observations of a Binary Neutron Star Merger”. Astrophys. J. Lett. 848, L12." },
  abbott2017grb: { url: "https://doi.org/10.3847/2041-8213/aa920c", cite: "Abbott et al. (2017). «Gravitational Waves and Gamma-Rays from a Binary Neutron Star Merger: GW170817 and GRB 170817A». Astrophys. J. Lett. 848, L13.", citeEn: "Abbott et al. (2017). “Gravitational Waves and Gamma-Rays from a Binary Neutron Star Merger: GW170817 and GRB 170817A”. Astrophys. J. Lett. 848, L13." },
  kasen2017: { url: "https://doi.org/10.1038/nature24453", cite: "Kasen et al. (2017). «Origin of the heavy elements in binary neutron-star mergers from a gravitational-wave event». Nature 551, 80.", citeEn: "Kasen et al. (2017). “Origin of the heavy elements in binary neutron-star mergers from a gravitational-wave event”. Nature 551, 80." },
  ozel2016: { url: "https://arxiv.org/abs/1603.02698", cite: "Özel, F. y Freire, P. (2016). «Masses, Radii, and the Equation of State of Neutron Stars». Ann. Rev. Astron. Astrophys. 54, 401.", citeEn: "Özel, F. and Freire, P. (2016). “Masses, Radii, and the Equation of State of Neutron Stars”. Ann. Rev. Astron. Astrophys. 54, 401." },
  gwtc4: { url: "https://arxiv.org/abs/2508.18082", cite: "LIGO-Virgo-KAGRA (2025). «GWTC-4.0: Updating the Gravitational-Wave Transient Catalog with Observations from the First Part of the Fourth Observing Run».", citeEn: "LIGO-Virgo-KAGRA (2025). “GWTC-4.0: Updating the Gravitational-Wave Transient Catalog with Observations from the First Part of the Fourth Observing Run”." },
  gwtc4ligo: { url: "https://ligo.org/science-summaries/O4a_catalog_omnibus/", cite: "LIGO (2025). Resumen científico de GWTC-4.0: 128 candidatos nuevos y 218 en total.", citeEn: "LIGO (2025). GWTC-4.0 science summary: 128 new candidates and 218 in total." },
  lisa: { url: "https://www.esa.int/Science_Exploration/Space_Science/LISA/LISA_factsheet", cite: "ESA. Ficha de LISA (lanzamiento previsto hacia 2035).", citeEn: "ESA. LISA factsheet (launch planned around 2035)." },
  lisaAdopt: { url: "https://esa.int/Newsroom/Press_Releases/Venus_voyager_and_gravitational_wave_surfer_get_green_light", cite: "ESA (25-ene-2024). «Venus voyager and gravitational wave surfer get green light» (adopción de LISA).", citeEn: "ESA (25 Jan 2024). “Venus voyager and gravitational wave surfer get green light” (LISA adoption)." },
  constants: { url: "https://physics.nist.gov/cgi-bin/cuu/Value?bg", cite: "NIST/CODATA 2018: G = 6,674 30 × 10⁻¹¹ m³ kg⁻¹ s⁻²; c exacta (SI). (GM)☉: IAU 2015, Resolución B3.", citeEn: "NIST/CODATA 2018: G = 6.674 30 × 10⁻¹¹ m³ kg⁻¹ s⁻²; c exact (SI). (GM)☉: IAU 2015, Resolution B3." },
};

// Enlaces de «Para seguir» (externos)
export const GW_NEXT = [
  { url: "https://www.ligo.caltech.edu/page/gravitational-waves", label: { es: "¿Qué son las ondas gravitacionales? (LIGO/Caltech)", en: "What are gravitational waves? (LIGO/Caltech)" }, note: { es: "la explicación del propio laboratorio", en: "the laboratory's own explanation" } },
  { url: "https://www.esa.int/Science_Exploration/Space_Science/LISA/LISA_factsheet", label: { es: "LISA, el detector en el espacio (ESA)", en: "LISA, the detector in space (ESA)" }, note: { es: "tres satélites a 2,5 millones de km unos de otros", en: "three spacecraft 2.5 million km apart" } },
];
