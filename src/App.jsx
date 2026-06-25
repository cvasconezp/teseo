import { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react";
const Constellations = lazy(() => import("./Constellations.jsx"));

// ─── CONFIG ──────────────────────────────────────────────────────────────────

// En producción apunta al backend en Railway/Render.
// En desarrollo, Vite proxea /api → localhost:8000
const API = import.meta.env.VITE_API_URL || "";

const AU_KM = 149_597_870.7;

// ─── i18n ────────────────────────────────────────────────────────────────────

const T = {
  en: {
    tagline:        "Interplanetary Navigation",
    youAreHere:     "You are here.",
    whereToGo:      "Where do you want to go?",
    origin:         "Origin",
    destination:    "Destination",
    route:          "Route",
    windows:        "Windows",
    sky:            "Sky",
    vehicle:        "Vehicle",
    travelTime:     "Estimated travel time",
    hohmann:        "Hohmann transfer",
    arrives:        "Arrives",
    synodic:        "Synodic period",
    nextWindows:    "Next launch windows",
    departure:      "Departure",
    arrival:        "Arrival",
    duration:       "Duration",
    days:           "days",
    years:          "years",
    computing:      "Computing...",
    realPhysics:    "Computing real orbital mechanics...",
    disclaimer:     "Hohmann transfer · circular orbit approximation · NASA JPL data",
    windowNote:     "Windows repeat every synodic period. Exact date may vary ±days due to orbital eccentricity.",
    noBackend:      "Backend offline — showing approximate distances",
    realPositions:  "Real positions",
    today:          "today",
    fromEarth:      "from Earth",
    light:          "Speed of light",
    voyager:        "Voyager 1",
    rocket:         "Apollo rocket",
    plane:          "Airplane",
  },
  es: {
    tagline:        "Navegación Interplanetaria",
    youAreHere:     "Estás aquí.",
    whereToGo:      "¿A dónde quieres ir?",
    origin:         "Origen",
    destination:    "Destino",
    route:          "Ruta",
    windows:        "Ventanas",
    sky:            "Cielo",
    vehicle:        "Vehículo",
    travelTime:     "Tiempo de viaje estimado",
    hohmann:        "Transferencia de Hohmann",
    arrives:        "Llega el",
    synodic:        "Período sinódico",
    nextWindows:    "Próximas ventanas de lanzamiento",
    departure:      "Salida",
    arrival:        "Llegada",
    duration:       "Duración",
    days:           "días",
    years:          "años",
    computing:      "Calculando...",
    realPhysics:    "Calculando con física orbital real...",
    disclaimer:     "Trayectoria de Hohmann · aproximación circular · datos NASA JPL",
    windowNote:     "Las ventanas se repiten cada período sinódico. La fecha exacta puede variar ±días por la excentricidad orbital.",
    noBackend:      "Backend sin conexión — mostrando distancias aproximadas",
    realPositions:  "Posiciones reales",
    today:          "hoy",
    fromEarth:      "desde la Tierra",
    light:          "Velocidad de la luz",
    voyager:        "Voyager 1",
    rocket:         "Cohete Apollo",
    plane:          "Avión",
  },
};

// ─── DATA ────────────────────────────────────────────────────────────────────

const PLANETS = [
  { id:"mercury", en:"Mercury",  es:"Mercurio", emoji:"⚫", color:"#9CA3AF", au:0.387  },
  { id:"venus",   en:"Venus",    es:"Venus",    emoji:"🟡", color:"#F59E0B", au:0.723  },
  { id:"earth",   en:"Earth",    es:"Tierra",   emoji:"🌍", color:"#3B82F6", au:1.000  },
  { id:"mars",    en:"Mars",     es:"Marte",    emoji:"🔴", color:"#EF4444", au:1.524  },
  { id:"jupiter", en:"Jupiter",  es:"Júpiter",  emoji:"🟠", color:"#F97316", au:5.203  },
  { id:"saturn",  en:"Saturn",   es:"Saturno",  emoji:"🪐", color:"#D97706", au:9.537  },
  { id:"uranus",  en:"Uranus",   es:"Urano",    emoji:"🔵", color:"#06B6D4", au:19.191 },
  { id:"neptune", en:"Neptune",  es:"Neptuno",  emoji:"🟣", color:"#6366F1", au:30.069 },
];

const VEHICLES = [
  { id:"light",   km_s:299792  },
  { id:"voyager", km_s:17.06   },
  { id:"rocket",  km_s:11.2    },
  { id:"plane",   km_s:0.25    },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function fmt(sec, lang) {
  const s = lang === "es";
  if (sec < 60)          return `${Math.round(sec)} seg`;
  if (sec < 3600)        return `${Math.round(sec/60)} min`;
  if (sec < 86400)       return `${(sec/3600).toFixed(1)} h`;
  if (sec < 86400*365)   return `${Math.round(sec/86400)} ${s?"días":"days"}`;
  const y = sec/(86400*365.25);
  if (y < 1000)          return `${y.toFixed(1)} ${s?"años":"years"}`;
  return `${(y/1000).toFixed(1)}k ${s?"años":"years"}`;
}

function pname(p, lang) { return lang === "es" ? p.es : p.en; }

// ─── SPACE TRAVEL BACKGROUND ─────────────────────────────────────────────────

function SpaceTravel() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    let w, h, cx, cy, raf;
    const COUNT = 70;          // pocas estrellas, como en el espacio real
    const stars = [];
    const COLORS = ["#ffffff", "#cfe0ff", "#ffe9c7", "#e7d4ff", "#bcd4ff"];
    function resize() {
      w = canvas.width = canvas.offsetWidth;
      h = canvas.height = canvas.offsetHeight;
      cx = w / 2; cy = h / 2;
    }
    function reset(s, spread) {
      s.x = (Math.random() - 0.5) * w * 1.6;
      s.y = (Math.random() - 0.5) * h * 1.6;
      // mantenerlas lejanas: nunca se acercan demasiado (sin estelas de "warp")
      s.z = spread ? (0.35 + Math.random() * 0.65) * w : w;
      s.pz = s.z;
      s.c = COLORS[(Math.random() * COLORS.length) | 0];
      s.tw = Math.random() * Math.PI * 2;
    }
    resize();
    for (let i = 0; i < COUNT; i++) { const s = {}; reset(s, true); stars.push(s); }
    const SPEED = 0.32;        // muy lento: nos acercamos poco a poco
    const NEAR = 0.34;         // se reinician estando aún lejos -> sin rayas largas
    function frame() {
      raf = requestAnimationFrame(frame);
      ctx.fillStyle = "rgba(4,8,15,0.5)";
      ctx.fillRect(0, 0, w, h);
      for (const s of stars) {
        s.pz = s.z;
        s.z -= SPEED;
        if (s.z < NEAR * w) { reset(s, false); continue; }
        const k = 200;
        const sx = cx + (s.x / s.z) * k;
        const sy = cy + (s.y / s.z) * k;
        const px = cx + (s.x / s.pz) * k;
        const py = cy + (s.y / s.pz) * k;
        if (sx < -20 || sx > w + 20 || sy < -20 || sy > h + 20) { reset(s, false); continue; }
        const depth = 1 - s.z / w;           // 0 lejos -> ~0.66 cerca
        s.tw += 0.05;
        const r = Math.max(0.4, depth * 1.6);
        const o = Math.min(0.7, depth * 1.1) * (0.7 + 0.3 * Math.sin(s.tw));
        ctx.strokeStyle = s.c;
        ctx.globalAlpha = o;
        ctx.lineWidth = r;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(px, py); ctx.lineTo(sx, sy);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    frame();
    window.addEventListener("resize", resize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={ref} className="fixed inset-0 w-full h-full pointer-events-none z-0" style={{ display: "block" }} />;
}

// ─── STAR FIELD ──────────────────────────────────────────────────────────────

function StarField() {
  const stars = Array.from({length:180},(_,i)=>({
    x:(i*137.508)%100, y:(i*97.314)%100,
    s:0.3+(i%5)*0.22, d:2+(i%4), dl:(i%7)*0.4,
  }));
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {stars.map((s,i)=>(
        <div key={i} className="absolute rounded-full bg-white" style={{
          left:`${s.x}%`, top:`${s.y}%`,
          width:s.s, height:s.s, opacity:0.35,
          animation:`twinkle ${s.d}s ${s.dl}s ease-in-out infinite alternate`,
        }}/>
      ))}
    </div>
  );
}

// ─── INTRO ───────────────────────────────────────────────────────────────────

function Intro({ lang, onDone }) {
  const [phase, setPhase] = useState(0);
  const t = T[lang];

  useEffect(()=>{
    const delays = [700,2000,1800,1800,1600];
    let timer;
    const next = i => { timer=setTimeout(()=>{ setPhase(i+1); if(i+1<delays.length) next(i+1); else setTimeout(onDone,500); },delays[i]); };
    next(0);
    return ()=>clearTimeout(timer);
  },[onDone]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#04080F]"
      style={{opacity:phase>=5?0:1, transition:"opacity 0.7s"}}>
      <StarField/>

      {/* Phase 1 — You are here */}
      {phase>=1&&phase<3&&(
        <div className="text-center" style={{animation:"fadeIn 0.8s ease-out"}}>
          <div className="relative w-5 h-5 mx-auto mb-6">
            <div className="w-5 h-5 rounded-full bg-blue-400 mx-auto"
              style={{boxShadow:"0 0 20px #60A5FA,0 0 50px #3B82F660",animation:"pulse-glow 2s ease-in-out infinite"}}/>
            <div className="absolute inset-0 rounded-full bg-blue-300"
              style={{animation:"ping 2s ease-out infinite",opacity:0}}/>
          </div>
          <p className="text-white/50 text-xs tracking-[0.35em] uppercase"
            style={{fontFamily:"Inter,system-ui"}}>{t.youAreHere}</p>
        </div>
      )}

      {/* Phase 2 — Solar system */}
      {phase>=2&&phase<4&&(
        <div className="absolute inset-0 flex items-center justify-center"
          style={{animation:"fadeIn 0.6s ease-out",
            transform:phase>=3?"scale(0.35)":"scale(1)",
            transition:"transform 1.8s cubic-bezier(0.4,0,0.2,1)"}}>
          <svg viewBox="0 0 100 100" className="w-60 h-60 opacity-60">
            {PLANETS.map((p,i)=>{
              const r=Math.min((Math.log1p(p.au)/Math.log1p(32))*44,44);
              const a=((i*53)%360)*Math.PI/180;
              return (
                <g key={p.id}>
                  <circle cx={50} cy={50} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="0.3"/>
                  <circle cx={50+r*Math.cos(a)} cy={50+r*Math.sin(a)} r={0.9} fill={p.color} opacity={0.7}/>
                </g>
              );
            })}
            <circle cx={50} cy={50} r={2.2} fill="#FCD34D" style={{filter:"drop-shadow(0 0 4px #FCD34D)"}}/>
          </svg>
        </div>
      )}

      {/* Phase 3 — Galaxy */}
      {phase>=3&&phase<5&&(
        <div className="absolute inset-0 flex items-center justify-center"
          style={{animation:"fadeIn 0.7s ease-out",
            transform:phase>=4?"scale(0.25)":"scale(1)",
            transition:"transform 1.8s cubic-bezier(0.4,0,0.2,1)"}}>
          <svg viewBox="0 0 200 200" className="w-72 h-72 opacity-40">
            {[0,36,72,108,144].map(deg=>(
              <ellipse key={deg} cx={100} cy={100} rx={85} ry={16} fill="none"
                stroke="rgba(167,139,250,0.25)" strokeWidth="12"
                transform={`rotate(${deg},100,100)`}/>
            ))}
            <ellipse cx={100} cy={100} rx={20} ry={12} fill="rgba(253,224,71,0.12)"/>
            <circle cx={100} cy={100} r={4} fill="#FEF08A" opacity={0.7}/>
            <circle cx={128} cy={93} r={2} fill="#60A5FA" style={{filter:"drop-shadow(0 0 3px #60A5FA)"}}/>
          </svg>
        </div>
      )}

      {/* Phase 4 — Teseo title */}
      {phase>=4&&(
        <div className="absolute inset-0 flex flex-col items-center justify-center"
          style={{animation:"fadeInSlow 1.2s ease-out"}}>
          <h1 style={{
            fontFamily:"Cormorant Garamond,Georgia,serif", fontSize:52, fontWeight:700,
            background:"linear-gradient(135deg,#A78BFA,#60A5FA)",
            WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
            letterSpacing:"-0.02em",
          }}>Teseo</h1>
          <p className="text-white/35 text-xs tracking-[0.45em] uppercase mt-4"
            style={{fontFamily:"Inter,system-ui"}}>{t.whereToGo}</p>
        </div>
      )}
    </div>
  );
}

// ─── ORBIT MAP WITH REAL POSITIONS ───────────────────────────────────────────

function OrbitMap({ from, to, realPositions, threadProgress }) {
  const pathRef = useRef(null);
  const [pathLen, setPathLen] = useState(300);
  const cx=50, cy=50;
  const scale = au => Math.min((Math.log1p(au)/Math.log1p(32))*44,44);

  // Use real NASA angle if available, else approximate
  const angleOf = (planet) => {
    const real = realPositions[planet.id];
    if (real) {
      // Convert cartesian XY to angle
      return Math.atan2(real.y_au, real.x_au);
    }
    const idx = PLANETS.findIndex(p=>p.id===planet.id);
    return ((idx*53)%360)*Math.PI/180;
  };

  const posOf = p => {
    const r = scale(p.au);
    const a = angleOf(p);
    return { x: cx+r*Math.cos(a), y: cy+r*Math.sin(a) };
  };

  const pF = posOf(from), pT = posOf(to);
  const midX = (pF.x+pT.x)/2 + (pT.y-pF.y)*0.28;
  const midY = (pF.y+pT.y)/2 - (pT.x-pF.x)*0.28;
  const d = `M ${pF.x} ${pF.y} Q ${midX} ${midY} ${pT.x} ${pT.y}`;

  useEffect(()=>{ if(pathRef.current) setPathLen(pathRef.current.getTotalLength()); },[from,to,realPositions]);

  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      {/* Orbit rings */}
      {PLANETS.map(p=>{
        const r=scale(p.au);
        const sel=p.id===from.id||p.id===to.id;
        return <circle key={p.id} cx={cx} cy={cy} r={r} fill="none"
          stroke={sel?"rgba(255,255,255,0.12)":"rgba(255,255,255,0.04)"}
          strokeWidth={sel?0.35:0.18}/>;
      })}

      {/* Sun */}
      <circle cx={cx} cy={cy} r={2.5} fill="#FCD34D" opacity={0.95}
        style={{filter:"drop-shadow(0 0 4px #FCD34D)"}}/>

      {/* Ariadne's thread — the transfer trajectory */}
      <path ref={pathRef} d={d} fill="none"
        stroke="rgba(124,58,237,0.25)" strokeWidth="0.7"
        strokeDasharray={pathLen}
        strokeDashoffset={pathLen*(1-threadProgress)}
        style={{transition:"stroke-dashoffset 1.4s cubic-bezier(0.4,0,0.2,1)"}}/>
      <path d={d} fill="none"
        stroke="#8B5CF6" strokeWidth="0.3"
        strokeDasharray="0.6 1.8"
        strokeDashoffset={pathLen*(1-threadProgress)}
        style={{transition:"stroke-dashoffset 1.4s cubic-bezier(0.4,0,0.2,1)"}}/>

      {/* Planets */}
      {PLANETS.map(p=>{
        const pos=posOf(p);
        const isF=p.id===from.id, isT=p.id===to.id, active=isF||isT;
        return (
          <g key={p.id}>
            {active&&<circle cx={pos.x} cy={pos.y} r={isT?3.2:3}
              fill="none" stroke={p.color} strokeWidth="0.45" opacity="0.4"/>}
            <circle cx={pos.x} cy={pos.y} r={active?1.9:0.8} fill={p.color}
              opacity={active?1:0.4}
              style={{filter:active?`drop-shadow(0 0 2.5px ${p.color})`:"none"}}/>
            {active&&<text x={pos.x+2.5} y={pos.y-2.5} fontSize="3.8"
              fill={p.color} opacity="0.9">{p.emoji}</text>}
          </g>
        );
      })}
    </svg>
  );
}

// ─── PLANET SELECTOR ─────────────────────────────────────────────────────────

function PlanetSelector({ value, onChange, exclude, label, accentColor, lang }) {
  const [open, setOpen] = useState(false);
  const available = PLANETS.filter(p=>p.id!==exclude?.id);
  return (
    <div className="relative">
      <p className="text-xs mb-1.5 tracking-widest uppercase"
        style={{color:accentColor,fontFamily:"Inter,system-ui",opacity:0.65,fontSize:9}}>
        {label}
      </p>
      <button onClick={()=>setOpen(o=>!o)}
        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border transition-all text-left"
        style={{background:`${value.color}12`,border:`1px solid ${value.color}45`}}>
        <span style={{fontSize:20}}>{value.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white truncate"
            style={{fontFamily:"Cormorant Garamond,Georgia,serif",fontSize:17}}>
            {pname(value,lang)}
          </p>
          <p className="text-xs" style={{color:value.color,fontFamily:"JetBrains Mono,monospace",fontSize:10}}>
            {value.au} AU
          </p>
        </div>
        <span className="text-white/25 text-xs shrink-0">{open?"▲":"▼"}</span>
      </button>
      {open&&(
        <div className="absolute top-full left-0 right-0 mt-1 rounded-xl border border-white/10 overflow-hidden z-30"
          style={{background:"#090E1C",boxShadow:"0 24px 64px rgba(0,0,0,0.85)"}}>
          {available.map(p=>(
            <button key={p.id} onClick={()=>{onChange(p);setOpen(false);}}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/6 transition-all text-left border-b border-white/5 last:border-0">
              <span style={{fontSize:17}}>{p.emoji}</span>
              <span className="text-sm text-white/75 flex-1"
                style={{fontFamily:"Inter,system-ui"}}>{pname(p,lang)}</span>
              <span className="text-xs shrink-0"
                style={{color:p.color,fontFamily:"JetBrains Mono,monospace"}}>{p.au} AU</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── ROUTE RESULT ────────────────────────────────────────────────────────────

function RouteResult({ from, to, lang, backendData, loading, realDist }) {
  const [vehicle, setVehicle] = useState(VEHICLES[2]);
  const t = T[lang];

  const distKm = realDist ?? Math.abs(to.au-from.au)*AU_KM;
  const sec = distKm/vehicle.km_s;

  return (
    <div className="space-y-3">
      {/* Main card */}
      <div className="rounded-2xl p-5 text-center"
        style={{background:"linear-gradient(135deg,rgba(124,58,237,0.1),rgba(37,99,235,0.07))",
          border:"1px solid rgba(124,58,237,0.22)"}}>
        <p className="text-xs tracking-widest uppercase text-white/30 mb-2"
          style={{fontFamily:"Inter,system-ui",fontSize:9}}>{t.travelTime}</p>
        <p className="font-bold leading-none"
          style={{fontFamily:"Cormorant Garamond,Georgia,serif",fontSize:46,
            background:"linear-gradient(135deg,#A78BFA,#60A5FA)",
            WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
          {fmt(sec,lang)}
        </p>
        <p className="text-white/35 mt-2" style={{fontFamily:"JetBrains Mono,monospace",fontSize:10}}>
          {(distKm/1e6).toFixed(2)}M km · {Math.abs(to.au-from.au).toFixed(3)} AU
          {realDist&&<span className="text-green-400/60 ml-2">· NASA ✓</span>}
        </p>

        {/* Hohmann data from backend */}
        {backendData&&!loading&&(
          <div className="mt-3 pt-3 border-t border-white/8 space-y-1">
            <p style={{fontFamily:"JetBrains Mono,monospace",fontSize:10,color:"rgba(255,255,255,0.35)"}}>
              {t.hohmann}: {backendData.transfer_time_days}d · Δv {backendData.delta_v_total_km_s} km/s
            </p>
            <p style={{fontFamily:"Inter,system-ui",fontSize:11,color:"rgba(255,255,255,0.25)"}}>
              {t.arrives}: {new Date(backendData.arrival_date).toLocaleDateString(
                lang==="es"?"es-EC":"en-US",{year:"numeric",month:"long",day:"numeric"})}
            </p>
          </div>
        )}
        {loading&&(
          <p className="text-purple-400/50 mt-2 animate-pulse"
            style={{fontFamily:"Inter,system-ui",fontSize:11}}>{t.realPhysics}</p>
        )}
        {!backendData&&!loading&&(
          <p className="text-white/20 mt-2" style={{fontFamily:"Inter,system-ui",fontSize:10}}>
            {t.noBackend}
          </p>
        )}
      </div>

      {/* Vehicle selector */}
      <div>
        <p className="text-xs tracking-widest uppercase text-white/25 mb-2"
          style={{fontFamily:"Inter,system-ui",fontSize:9}}>{t.vehicle}</p>
        <div className="grid grid-cols-2 gap-1.5">
          {VEHICLES.map(v=>(
            <button key={v.id} onClick={()=>setVehicle(v)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border text-xs transition-all"
              style={{
                background:vehicle.id===v.id?"rgba(124,58,237,0.18)":"rgba(255,255,255,0.03)",
                border:vehicle.id===v.id?"1px solid rgba(124,58,237,0.45)":"1px solid rgba(255,255,255,0.07)",
                color:vehicle.id===v.id?"#A78BFA":"rgba(255,255,255,0.35)",
                fontFamily:"Inter,system-ui",
              }}>
              <span>{v.id==="light"?"⚡":v.id==="voyager"?"🛸":v.id==="rocket"?"🚀":"✈️"}</span>
              <span className="truncate">{t[v.id]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Groq narrative */}
      {backendData?.narrative&&(
        <div className="rounded-xl p-4 border border-white/6"
          style={{background:"rgba(255,255,255,0.02)"}}>
          <p className="text-white/45 leading-relaxed italic"
            style={{fontFamily:"Cormorant Garamond,Georgia,serif",fontSize:14}}>
            "{backendData.narrative}"
          </p>
        </div>
      )}

      <p className="text-center text-white/15" style={{fontFamily:"Inter,system-ui",fontSize:10}}>
        {t.disclaimer}
      </p>
    </div>
  );
}

// ─── LAUNCH WINDOWS ──────────────────────────────────────────────────────────

function LaunchWindows({ from, to, lang }) {
  const [data, setData] = useState(null);
  const t = T[lang];

  useEffect(()=>{
    setData(null);
    fetch(`${API}/api/launch-windows/${from.id}/${to.id}?count=4`)
      .then(r=>r.json()).then(setData).catch(()=>{});
  },[from,to]);

  if(!data) return (
    <p className="text-center text-white/20 py-8 animate-pulse"
      style={{fontFamily:"Inter,system-ui",fontSize:12}}>{t.computing}</p>
  );

  return (
    <div className="space-y-3">
      <div className="rounded-xl px-4 py-2.5 border border-white/8 bg-white/3">
        <p style={{fontFamily:"JetBrains Mono,monospace",fontSize:10,color:"rgba(255,255,255,0.35)"}}>
          {t.synodic}: <span style={{color:"#A78BFA"}}>{data.synodic_period_days}d</span>
          {" "}({data.synodic_period_years} {t.years})
        </p>
      </div>
      {data.windows?.map(w=>(
        <div key={w.window_number} className="rounded-xl p-4 border border-white/8 bg-white/3">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-purple-400 tracking-wider uppercase"
              style={{fontFamily:"Inter,system-ui",fontSize:10,fontWeight:500}}>
              Window {w.window_number}
            </span>
            <span style={{fontFamily:"JetBrains Mono,monospace",fontSize:10,color:"rgba(255,255,255,0.25)"}}>
              Δv {w.delta_v_km_s} km/s
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              [t.departure, w.departure_date],
              [t.arrival,   w.arrival_date],
            ].map(([label,date])=>(
              <div key={label}>
                <p className="text-white/25 mb-0.5" style={{fontFamily:"Inter,system-ui",fontSize:9}}>{label}</p>
                <p className="text-white/75" style={{fontFamily:"JetBrains Mono,monospace",fontSize:10}}>
                  {new Date(date).toLocaleDateString(lang==="es"?"es-EC":"en-US",
                    {year:"numeric",month:"short",day:"numeric"})}
                </p>
              </div>
            ))}
          </div>
          <p className="text-white/20 mt-2" style={{fontFamily:"Inter,system-ui",fontSize:9}}>
            {t.duration}: {w.transfer_time_days} {t.days}
          </p>
        </div>
      ))}
      <p className="text-white/12 text-center" style={{fontFamily:"Inter,system-ui",fontSize:9}}>
        {t.windowNote}
      </p>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

export default function Teseo() {
  const [intro,    setIntro]    = useState(true);
  const [lang,     setLang]     = useState("en");
  const [from,     setFrom]     = useState(PLANETS[2]); // Earth
  const [to,       setTo]       = useState(PLANETS[3]); // Mars
  const [tab,      setTab]      = useState("route");
  const [thread,   setThread]   = useState(0);
  const [backend,  setBackend]  = useState(null);
  const [loadingB, setLoadingB] = useState(false);
  const [realPos,  setRealPos]  = useState({});    // NASA real positions {id: {x_au,y_au,...}}
  const [realDist, setRealDist] = useState(null);  // km between from and to, real NASA data

  const t = T[lang];
  const onDone = useCallback(()=>setIntro(false),[]);

  // Animate thread on selection change
  useEffect(()=>{
    setThread(0); setBackend(null); setRealDist(null);
    const tid = setTimeout(()=>setThread(1),80);
    return ()=>clearTimeout(tid);
  },[from,to]);

  // Fetch real planet positions from NASA Horizons via backend
  useEffect(()=>{
    if(!API) return;
    const today = new Date().toISOString().split("T")[0];
    Promise.all(PLANETS.map(p=>
      fetch(`${API}/api/position/${p.id}?date=${today}`)
        .then(r=>r.json()).catch(()=>null)
    )).then(results=>{
      const pos = {};
      results.forEach((r,i)=>{ if(r&&r.x_au!==undefined) pos[PLANETS[i].id]=r; });
      setRealPos(pos);
    });
  },[]);

  // Fetch real distance between selected bodies
  useEffect(()=>{
    if(!API||from.id===to.id) return;
    const today = new Date().toISOString().split("T")[0];
    fetch(`${API}/api/distance/${from.id}/${to.id}?date=${today}`)
      .then(r=>r.json())
      .then(d=>{ if(d.distance_km) setRealDist(d.distance_km); })
      .catch(()=>{});
  },[from,to]);

  // Fetch Hohmann route from backend
  useEffect(()=>{
    if(!API||from.id===to.id) return;
    setLoadingB(true);
    fetch(`${API}/api/route`,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({origin:from.id,destination:to.id,lang,include_narrative:true}),
    }).then(r=>r.json()).then(d=>{setBackend(d);setLoadingB(false);})
      .catch(()=>setLoadingB(false));
  },[from,to,lang]);

  const hasRealPos = Object.keys(realPos).length > 0;

  return (
    <>
      {intro && <Intro lang={lang} onDone={onDone}/>}

      <div className="min-h-screen bg-[#04080F] text-white relative">
        <SpaceTravel/>

        <div className="relative z-10 px-5 pt-5 max-w-lg mx-auto">

          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 style={{
                fontFamily:"Cormorant Garamond,Georgia,serif", fontSize:26, fontWeight:700,
                background:"linear-gradient(135deg,#A78BFA,#60A5FA)",
                WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
                letterSpacing:"-0.02em",
              }}>Teseo</h1>
              <p className="text-white/25 tracking-widest uppercase"
                style={{fontFamily:"Inter,system-ui",fontSize:8}}>{t.tagline}</p>
            </div>
            <div className="flex items-center gap-2">
              {hasRealPos&&(
                <span className="text-green-400/50 tracking-widest uppercase"
                  style={{fontFamily:"Inter,system-ui",fontSize:8}}>
                  ● {t.realPositions}
                </span>
              )}
              <button onClick={()=>setLang(l=>l==="en"?"es":"en")}
                className="text-xs px-3 py-1.5 rounded-full border border-white/10 text-white/40 hover:text-white/70 hover:border-white/20 transition-all"
                style={{fontFamily:"Inter,system-ui"}}>
                {lang==="en"?"ES":"EN"}
              </button>
            </div>
          </div>

          {tab!=="sky" && (<>
          {/* Orbit map */}
          <div className="rounded-2xl overflow-hidden border border-white/6 mb-3"
            style={{height:215,background:"rgba(255,255,255,0.015)"}}>
            <OrbitMap from={from} to={to} realPositions={realPos} threadProgress={thread}/>
          </div>

          {/* Planet selectors */}
          <div className="grid grid-cols-2 gap-2.5 mb-3">
            <PlanetSelector value={from} onChange={setFrom} exclude={to}
              label={t.origin} accentColor="#60A5FA" lang={lang}/>
            <PlanetSelector value={to} onChange={setTo} exclude={from}
              label={t.destination} accentColor="#A78BFA" lang={lang}/>
          </div>

          </>)}

          {/* Tabs */}
          <div className="flex gap-1 mb-4 bg-white/4 rounded-xl p-1">
            {[["route",t.route],["windows",t.windows],["sky",t.sky]].map(([id,label])=>(
              <button key={id} onClick={()=>setTab(id)}
                className="flex-1 py-2 rounded-lg text-xs font-medium transition-all"
                style={{
                  background:tab===id?"linear-gradient(135deg,#7C3AED,#2563EB)":"transparent",
                  color:tab===id?"white":"rgba(255,255,255,0.28)",
                  fontFamily:"Inter,system-ui",
                }}>
                {label}
              </button>
            ))}
          </div>

          {tab==="route"&&(
            <RouteResult from={from} to={to} lang={lang}
              backendData={backend} loading={loadingB} realDist={realDist}/>
          )}

          {tab==="windows"&&(
            <LaunchWindows from={from} to={to} lang={lang}/>
          )}

          {tab==="sky"&&(
            <Suspense fallback={<div className="text-center text-white/30 py-12" style={{fontFamily:"Inter,system-ui",fontSize:12}}>...</div>}>
              <Constellations lang={lang}/>
            </Suspense>
          )}

          {/* Footer */}
          <footer className="mt-8 mb-10 text-center">
            <a href="https://yachaydeep.com" target="_blank" rel="noopener noreferrer"
              className="inline-block text-white/30 hover:text-white/60 transition-all tracking-widest uppercase"
              style={{fontFamily:"Inter,system-ui",fontSize:9}}>
              desarrollado por Yachay Deep Labs
            </a>
          </footer>
        </div>
      </div>
    </>
  );
}
