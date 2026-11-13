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
  const n = (x, d) => x.toLocaleString(es ? "es" : "en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
  const sec = ly * SEC_PER_YR;
  if (ly < 1) {
    if (sec < 60) return `${n(sec, 1)} ${es ? "segundos luz" : "light-seconds"}`;
    if (sec < 3600) return `${n(sec / 60, 1)} ${es ? "minutos luz" : "light-minutes"}`;
    if (sec < 86400) return `${n(sec / 3600, 1)} ${es ? "horas luz" : "light-hours"}`;
    return `${n(sec / 86400, 1)} ${es ? "días luz" : "light-days"}`;
  }
  const u = es ? "años luz" : "light-years";
  if (ly < 10) return `${n(ly, 1)} ${u}`;
  if (ly < 1e4) return `${n(ly, 0)} ${u}`;
  if (ly < 1e6) return `${n(ly, 0)} ${u}`;
  if (ly < 1e9) return `${n(ly / 1e6, 1)} ${es ? "millones de años luz" : "million light-years"}`;
  return `${n(ly / 1e6, 0)} ${es ? "millones de años luz" : "million light-years"}`;
}

// Marcas de la regla: potencias "redondas" para orientarse
const TICKS = [
  { ly: 1 / SEC_PER_YR, es: "1 segundo luz", en: "1 light-second" },
  { ly: 3600 / SEC_PER_YR, es: "1 hora luz", en: "1 light-hour" },
  { ly: 1, es: "1 año luz", en: "1 light-year" },
  { ly: 1e3, es: "mil años luz", en: "1,000 ly" },
  { ly: 1e6, es: "1 millón", en: "1 million ly" },
  { ly: 1e9, es: "mil millones", en: "1 billion ly" },
];

const ROW = 66;            // alto mínimo de cada ficha
const RAIL_X = 22;         // posición de la regla
const TEXT_X = 62;         // donde empiezan las fichas

export default function CosmicScale({ lang = "es" }) {
  const es = lang === "es";
  const items = [...DATA].reverse();                       // de lo más lejano (arriba) a lo más cercano
  const H = items.length * ROW + 20, pad = 30;
  const y = (ly) => pad + (1 - (Math.log10(ly) - LOGMIN) / (LOGMAX - LOGMIN)) * (H - 2 * pad);

  // Cada punto queda en su posición logarítmica real sobre la regla; las fichas
  // se separan lo justo para no pisarse y un hilo las une con su punto.
  const rows = [];
  items.forEach((o, i) => {
    const want = y(o.ly) - ROW / 2;
    rows.push(Math.max(want, i ? rows[i - 1] + ROW : 0));
  });
  for (let i = rows.length - 1; i >= 0; i--) {
    const max = i === rows.length - 1 ? H - ROW : rows[i + 1] - ROW;
    if (rows[i] > max) rows[i] = max;
  }

  return (
    <section className="scale" aria-labelledby="scale-title">
      <h2 id="scale-title" className="scale__title">
        {es ? "Mirar lejos es mirar al pasado" : "To look far is to look into the past"}
      </h2>
      <p className="scale__lead">
        {es
          ? "Cada distancia es también el tiempo que tardó esa luz en llegar a tus ojos. La regla es logarítmica: cada tramo multiplica la distancia."
          : "Each distance is also how long that light took to reach your eyes. The ruler is logarithmic: every stretch multiplies the distance."}
      </p>

      <div className="scale__chart" style={{ height: H }}>
        <svg className="scale__svg" width="100%" height={H} aria-hidden="true">
          <defs>
            <linearGradient id="scale-rail" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor="#9fd0ff" /><stop offset="0.35" stopColor="#ffffff" />
              <stop offset="0.55" stopColor="#67e8c8" /><stop offset="0.8" stopColor="#ff9d5c" />
              <stop offset="1" stopColor="#c9b8ff" />
            </linearGradient>
          </defs>
          <rect x={RAIL_X - 1} y={pad - 12} width="2" height={H - 2 * pad + 24} rx="1" fill="url(#scale-rail)" opacity="0.55" />
          {TICKS.map(tk => (
            <line key={tk.ly} x1={RAIL_X - 7} x2={RAIL_X + 7} y1={y(tk.ly)} y2={y(tk.ly)} stroke="rgba(255,255,255,0.45)" strokeWidth="1" />
          ))}
          {items.map((o, i) => {
            const cy = y(o.ly), ty = rows[i] + 14, col = CAT_COLOR[o.cat];
            return (
              <g key={o.es}>
                <path d={`M${RAIL_X} ${cy} C${RAIL_X + 22} ${cy}, ${TEXT_X - 26} ${ty}, ${TEXT_X - 8} ${ty}`}
                  fill="none" stroke={col} strokeOpacity="0.45" strokeWidth="1" />
                <circle cx={RAIL_X} cy={cy} r="4.5" fill={col} style={{ filter: `drop-shadow(0 0 5px ${col})` }} />
              </g>
            );
          })}
        </svg>

        <ol className="scale__list">
          {items.map((o, i) => (
            <li key={o.es} className="scale__item" style={{ top: rows[i], left: TEXT_X }}>
              <span className="scale__name">{es ? o.es : o.en}</span>
              <span className="scale__dist" style={{ color: CAT_COLOR[o.cat] }}>{fmtScale(o.ly, lang)}</span>
              <span className="scale__note">{o.note[lang] || o.note.es}</span>
            </li>
          ))}
        </ol>
      </div>

      <p className="scale__here">
        <span className="scale__here-dot" aria-hidden="true" />
        {es ? "Tú estás aquí" : "You are here"}
      </p>
      <p className="scale__fine">
        {es
          ? "Marcas de la regla: " + TICKS.map(tk => tk.es).join(", ") + " de años luz. Distancias de viaje de la luz reales; la luz del fondo cósmico salió hace unos 13.800 millones de años."
          : "Ruler marks: " + TICKS.map(tk => tk.en).join(", ") + ". Real light-travel distances; the light of the cosmic microwave background left about 13.8 billion years ago."}
      </p>
    </section>
  );
}
