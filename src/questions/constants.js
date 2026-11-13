// constants.js — TODAS las constantes físicas y astronómicas de los recorridos
// de "Preguntas" viven aquí (una sola fuente; verificadas el 13-nov-2026).
//
//  · G: CODATA 2018 y 2022 (mismo valor), NIST:
//      https://physics.nist.gov/cgi-bin/cuu/Value?bg   → 6.674 30(15) × 10⁻¹¹ m³ kg⁻¹ s⁻²
//  · c: exacta por definición del SI (2019): 299 792 458 m/s
//      https://physics.nist.gov/cgi-bin/cuu/Value?c
//  · (GM)☉, (GM)⊕, R☉, R⊕: constantes nominales IAU 2015, Resolución B3
//      https://arxiv.org/abs/1510.07674
//      (GM)☉ = 1.327 124 4 × 10²⁰ m³ s⁻² · (GM)⊕ = 3.986 004 × 10¹⁴ m³ s⁻²
//      R☉ = 6.957 × 10⁸ m · R⊕ (ecuatorial) = 6.3781 × 10⁶ m
//    El producto GM se conoce con ~5 cifras más que G o M por separado: por eso
//    los radios de Schwarzschild se calculan con GM y solo la densidad usa G.
//  · ua: exacta, IAU 2012 Resolución B2: 149 597 870 700 m
//  · pársec: exacto por definición (IAU 2015 B2): 648000/π ua
//  · año juliano: 365,25 días de 86 400 s (convención IAU); año luz = c × año juliano
//  · g₀: gravedad estándar, exacta por convención (CGPM 1901): 9,806 65 m/s²

export const G = 6.67430e-11;              // m³ kg⁻¹ s⁻²
export const C = 299792458;                // m/s
export const GM_SUN = 1.3271244e20;        // m³ s⁻²
export const GM_EARTH = 3.986004e14;       // m³ s⁻²
export const R_SUN = 6.957e8;              // m
export const R_EARTH = 6.3781e6;           // m
export const AU = 149597870700;            // m
export const PC = (648000 / Math.PI) * AU; // m  (3,0857 × 10¹⁶)
export const KPC = 1e3 * PC;
export const MPC = 1e6 * PC;
export const YEAR = 365.25 * 86400;        // s
export const LY = C * YEAR;                // m  (9,4607 × 10¹⁵)
export const G0 = 9.80665;                 // m/s²

// Derivadas (no son datos nuevos: salen de las de arriba)
export const M_SUN_KG = GM_SUN / G;                    // 1,98841 × 10³⁰ kg
export const EARTH_IN_SUNS = GM_EARTH / GM_SUN;        // 3,0035 × 10⁻⁶
export const MPC_IN_LY = MPC / LY;                     // 3,2616 × 10⁶
// G en unidades de galaxias: kpc · (km/s)² / M☉  →  4,3009 × 10⁻⁶
export const G_GALACTIC = GM_SUN / KPC / 1e6;
export const RAD_TO_MUAS = (180 / Math.PI) * 3600 * 1e6;   // radianes → microsegundos de arco
