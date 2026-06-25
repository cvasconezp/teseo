// CosmicScale.jsx — regla logarítmica del universo.
// La distancia (en años luz) ES el tiempo que tardó la luz en llegar.
const SEC_PER_YR = 31557600;

const OBJ = (es, en, ly, cat, note) => ({ es, en, ly, cat, note });
const DATA = [
  OBJ("Luna", "Moon", 1.282 / SEC_PER_YR, "near", { es: "la ves con 1.3 s de retraso", en: "1.3 s in the past" }),
  OBJ("Sol", "Sun", (8.317 * 60) / SEC_PER_YR, "near", { es: "luz de hace 8 minutos", en: "8-minute-old light" }),
  OBJ("Voyager 1", "Voyager 1", (22.6 * 3600) / SEC_PER_YR, "human", { es: "el objeto humano más lejano", en: "farthest human-made object" }),
  OBJ("Próxima Centauri", "Proxima Centauri", 4.2465, "star", { es: "la estrella más cercana", en: "nearest star" }),
  OBJ("Sirio", "Sirius", 8.6, "star", { es: "la estrella más brillante", en: "brightest star" }),
  OBJ("Pléyades", "Pleiades", 444, "star", { es: "cúmulo de las 'siete hermanas'", en: "the 'seven sisters'" }),
  OBJ("Betelgeuse", "Betelgeuse", 548, "star", { es: "supergigante roja en Orión", en: "red supergiant in Orion" }),
  OBJ("Nebulosa de Orión", "Orion Nebula", 1344, "neb", { es: "guardería de estrellas", en: "stellar nursery" }),
  OBJ("Centro de la Vía Láctea", "Galactic Center", 26000, "neb", { es: "el agujero negro Sgr A*", en: "the Sgr A* black hole" }),
  OBJ("Gran Nube de Magallanes", "Large Magellanic Cloud", 160000, "gal", { es: "galaxia satélite", en: "satellite galaxy" }),
  OBJ("Galaxia de Andrómeda", "Andromeda Galaxy", 2.5e6, "gal", { es: "la ves antes de que existiéramos", en: "older than humankind" }),
  OBJ("Cúmulo de Virgo", "Virgo Cluster", 5.4e7, "gal", { es: "miles de galaxias", en: "thousands of galaxies" }),
  OBJ("GN-z11", "GN-z11", 1.34e10, "cosmos", { es: "de las galaxias más lejanas", en: "one of the most distant galaxies" }),
  OBJ("Fondo cósmico de microondas", "Cosmic Microwave Background", 1.38e10, "cosmos", { es: "el límite observable: el origen", en: "the observable edge: the origin" }),
];
const CAT_COLOR = { near: "#9fd0ff", human: "#ffd23f", star: "#ffffff", neb: "#67e8c8", gal: "#ff9d5c", cosmos: "#c9b8ff" };

const LOGMIN = Math.log10(DATA[0].ly) - 0.4;
const LOGMAX = Math.log10(DATA[DATA.length - 1].ly) + 0.25;

function fmtScale(ly, lang) {
  const es = lang === "es";
  const sec = ly * SEC_PER_YR;
  if (ly < 1) {
    if (sec < 60) return `${sec.toFixed(1)} ${es ? "s-luz" : "light-s"}`;
    if (sec < 3600) return `${(sec / 60).toFixed(1)} ${es ? "min-luz" : "light-min"}`;
    if (sec < 86400) return `${(sec / 3600).toFixed(1)} ${es ? "h-luz" : "light-h"}`;
    return `${(sec / 86400).toFixed(1)} ${es ? "días-luz" : "light-days"}`;
  }
  const u = es ? "años luz" : "ly";
  if (ly < 1e3) return `${Math.round(ly)} ${u}`;
  if (ly < 1e6) return `${(ly / 1e3).toFixed(1)} ${es ? "mil al" : "kly"}`;
  if (ly < 1e9) return `${(ly / 1e6).toFixed(1)} ${es ? "M al" : "Mly"}`;
  return `${(ly / 1e9).toFixed(2)} ${es ? "mil M al" : "Gly"}`;
}

export default function CosmicScale({ lang = "es" }) {
  const H = 640, pad = 26;
  const y = (ly) => pad + (1 - (Math.log10(ly) - LOGMIN) / (LOGMAX - LOGMIN)) * (H - 2 * pad);
  return (
    <div>
      <p style={{ fontFamily: "Inter,system-ui", fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 4, lineHeight: 1.5 }}>
        {lang === "es"
          ? "El universo a escala. La distancia es también el tiempo que tardó su luz en llegar: mirar lejos es mirar al pasado."
          : "The universe to scale. Distance is also how long its light took to reach us: to look far is to look into the past."}
      </p>
      <div style={{ position: "relative", height: H, marginTop: 6 }}>
        {/* línea central con gradiente */}
        <div style={{ position: "absolute", left: "50%", top: pad, bottom: pad, width: 2, transform: "translateX(-50%)",
          background: "linear-gradient(to top, #9fd0ff, #ffffff, #67e8c8, #ff9d5c, #c9b8ff)" , opacity: 0.5 }} />
        {/* "estás aquí" abajo */}
        <div style={{ position: "absolute", left: "50%", bottom: 4, transform: "translateX(-50%)", textAlign: "center" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#60A5FA", margin: "0 auto", boxShadow: "0 0 10px #60A5FA" }} />
          <span style={{ fontFamily: "Inter,system-ui", fontSize: 9, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            {lang === "es" ? "estás aquí" : "you are here"}
          </span>
        </div>
        {DATA.map((o, i) => {
          const top = y(o.ly);
          const left = i % 2 === 0;
          const col = CAT_COLOR[o.cat];
          return (
            <div key={o.es} style={{ position: "absolute", top, left: 0, right: 0, height: 0 }}>
              {/* tick + punto en la línea */}
              <div style={{ position: "absolute", left: "50%", transform: "translate(-50%,-50%)", width: 9, height: 9, borderRadius: "50%", background: col, boxShadow: `0 0 8px ${col}` }} />
              <div style={{ position: "absolute", top: -0.5, left: left ? "calc(15% )" : "50%", width: "35%", height: 1, background: "rgba(255,255,255,0.12)" }} />
              {/* etiqueta */}
              <div style={{ position: "absolute", top: "50%", transform: "translateY(-50%)",
                [left ? "right" : "left"]: "53%", width: "44%", textAlign: left ? "right" : "left" }}>
                <div style={{ fontFamily: "Cormorant Garamond,Georgia,serif", fontSize: 14, color: "#fff", lineHeight: 1.05 }}>{lang === "es" ? o.es : o.en}</div>
                <div style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 10, color: col }}>{fmtScale(o.ly, lang)}</div>
                <div style={{ fontFamily: "Inter,system-ui", fontSize: 9, color: "rgba(255,255,255,0.4)" }}>{o.note[lang] || o.note.es}</div>
              </div>
            </div>
          );
        })}
      </div>
      <p style={{ fontFamily: "Inter,system-ui", fontSize: 9, color: "rgba(255,255,255,0.3)", textAlign: "center", marginTop: 8, lineHeight: 1.5 }}>
        {lang === "es"
          ? "Escala logarítmica. Distancias de luz-viaje (lookback) reales. La luz del fondo cósmico salió hace ~13.800 millones de años."
          : "Logarithmic scale. Real light-travel (lookback) distances. CMB light left ~13.8 billion years ago."}
      </p>
    </div>
  );
}
