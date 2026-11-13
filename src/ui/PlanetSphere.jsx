// PlanetSphere.jsx — esfera planetaria ligera, sin three.js.
// Recorta en círculo una textura equirectangular (2:1) y la sombrea con
// gradientes (limbo + terminador). La textura se desliza con `transform`
// (compuesto por GPU) para sugerir la rotación; respeta prefers-reduced-motion
// desde CSS. Si la textura no existe o no carga, queda una esfera de color con
// gradiente (así Marte y Venus se ven bien hoy y mejor cuando lleguen sus .jpg).
import { useEffect, useState } from "react";

// Texturas que ya están en public/textures/. Las demás se intentan igual, con
// un sello diario en la URL: el service worker es cache-first y guardaría para
// siempre la respuesta "no existe" (el rewrite SPA devuelve index.html con 200).
const KNOWN = new Set(["sun", "mercury", "venus", "earth", "moon", "mars", "jupiter", "saturn", "uranus", "neptune"]);
const DAY_STAMP = Math.floor(Date.now() / 86400000);
const texUrl = id => `/textures/${id}.jpg${KNOWN.has(id) ? "" : `?v=${DAY_STAMP}`}`;

// Esfera de respaldo: color propio de cada mundo
const FALLBACK = {
  sun:     ["#FFF3B0", "#FDBA3B", "#E8590C"],
  mercury: ["#C9C5BF", "#8F8A84", "#4A4744"],
  venus:   ["#F6E3B4", "#DDB26A", "#8A5A24"],
  earth:   ["#7CC4FF", "#2F6FDB", "#12306B"],
  moon:    ["#E4E4E7", "#A1A1AA", "#52525B"],
  mars:    ["#F0A070", "#C1502B", "#6B2412"],
  jupiter: ["#F1D9B5", "#C99864", "#7A4E2A"],
  saturn:  ["#F3E2B8", "#D2B076", "#7D6238"],
  uranus:  ["#C9F3F5", "#7FD3DB", "#2E7F8C"],
  neptune: ["#8FB4FF", "#3F63E0", "#1B2A7A"],
};
// Detalle sutil para los dos mundos que aún no tienen textura
const FALLBACK_DETAIL = {
  mars:  "radial-gradient(ellipse 34% 20% at 62% 58%, rgba(90,30,14,.55), transparent 70%), radial-gradient(ellipse 26% 14% at 30% 40%, rgba(110,40,18,.45), transparent 70%), radial-gradient(ellipse 22% 9% at 50% 6%, rgba(255,245,235,.8), transparent 75%)",
  venus: "linear-gradient(168deg, transparent 22%, rgba(255,250,230,.35) 30%, transparent 40%, rgba(150,95,40,.28) 55%, transparent 66%, rgba(255,250,230,.25) 76%, transparent 86%)",
};

// Estado de carga compartido: cada textura se comprueba una sola vez
const cache = new Map();   // id -> "ok" | "fail" | Promise
function loadTexture(id) {
  const hit = cache.get(id);
  if (hit) return hit;
  const p = new Promise(resolve => {
    const img = new Image();
    img.onload = () => { const ok = img.naturalWidth > 1; cache.set(id, ok ? "ok" : "fail"); resolve(ok ? "ok" : "fail"); };
    img.onerror = () => { cache.set(id, "fail"); resolve("fail"); };
    img.src = texUrl(id);
  });
  cache.set(id, p);
  return p;
}

function useTexture(id) {
  const [status, setStatus] = useState(() => { const c = cache.get(id); return typeof c === "string" ? c : "loading"; });
  useEffect(() => {
    let alive = true;
    const c = loadTexture(id);
    if (typeof c === "string") setStatus(c);
    else { setStatus("loading"); c.then(s => { if (alive) setStatus(s); }); }
    return () => { alive = false; };
  }, [id]);
  return status;
}

/**
 * @param id       mercury…neptune | sun | moon
 * @param size     px (número) o cualquier longitud CSS; por defecto 100% del contenedor
 * @param light    ángulo (rad, antihorario, 0 = derecha) desde el que llega la luz
 * @param spin     false para dejarla quieta
 */
export default function PlanetSphere({ id, size = "100%", light = (3 * Math.PI) / 4, spin = true, className = "", style }) {
  const status = useTexture(id);
  const [c0, c1, c2] = FALLBACK[id] || FALLBACK.moon;
  const lx = 50 + Math.cos(light) * 32, ly = 50 - Math.sin(light) * 32;
  const isSun = id === "sun";
  const dim = typeof size === "number" ? `${size}px` : size;

  return (
    <span className={`sphere ${isSun ? "sphere--sun" : ""} ${id === "saturn" ? "sphere--ringed" : ""} ${className}`}
      style={{ width: dim, height: dim, ...style }} aria-hidden="true">
      {id === "saturn" && <span className="sphere__ring sphere__ring--back" />}
      <span className="sphere__disc"
        style={{ background: `radial-gradient(circle at ${lx}% ${ly}%, ${c0} 0%, ${c1} 48%, ${c2} 100%)` }}>
        {FALLBACK_DETAIL[id] && status !== "ok" && (
          <span className="sphere__detail" style={{ background: FALLBACK_DETAIL[id] }} />
        )}
        {status === "ok" && (
          <span className={`sphere__tex ${spin ? "sphere__tex--spin" : ""}`}
            style={{ backgroundImage: `url(${texUrl(id)})` }} />
        )}
        {!isSun && (
          <span className="sphere__shade" style={{
            background: `radial-gradient(circle at ${lx}% ${ly}%, rgba(255,255,255,.2) 0%, rgba(255,255,255,0) 30%, rgba(2,4,12,.5) 68%, rgba(2,4,12,.9) 100%), radial-gradient(circle at 50% 50%, transparent 58%, rgba(2,4,12,.45) 100%)`,
          }} />
        )}
      </span>
      {id === "saturn" && <span className="sphere__ring sphere__ring--front" />}
    </span>
  );
}
