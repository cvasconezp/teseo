// Ficha de objeto: hoja inferior deslizable en móvil, panel lateral en escritorio.
// Jerarquía: nombre + tipo → visual (3D / imagen / representación) → 3 datos en
// lenguaje humano → descripción → detalles técnicos plegables → acciones.
import { useEffect, useMemo, useRef, useState } from "react";
import Planet3D from "./Planet3D.jsx";
import Icon from "./icons.jsx";
import { BODIES, bodyName } from "./bodies.js";
import { fmtDist, fmtYears, fmtDuration, fmtKm, fmtMassSun, fmtSuns, num, AU_KM, LIGHT_KM_S, VOYAGER_KM_S, LY_KM, SEC_PER_YEAR } from "./format.js";
import { starTemperature, parseSpect } from "./starColor.js";
import { exoClass, tempBand, methodKey, starClass, schwarzschildKm, bhSizeBand, pulsarSpin, hubbleFamily, magReach, JUPITER_RE, JUPITER_ME } from "./explain.js";
import { NoteArt, ExoCompare } from "./NoteArt.jsx";
import CompositionBlock from "./CompositionBlock.jsx";
import StarLifeBlock from "./StarLifeBlock.jsx";
import { drawArt, artKind, artOptions } from "./art.js";
import { riseTransitSet, bestTonight, signalDelay, horizonFor } from "./riseset.js";
import { altAz } from "./guide.js";
import { compassPoint8 } from "./deviceOrientation.js";
import { citizenFor, CITIZEN_VERIFIED } from "./citizen.js";
import { ephemeris } from "../ephemeris.js";
import { useDialogFocus } from "./focus.js";
import { nasaImageFor, nasaKindKey, imageOrder, nasaStatus, setNasaStatus } from "./nasaImages.js";

// describeObject (función pura) vive en describe.js; se reexporta aquí para quien ya lo importaba.
import { describeObject, starHue } from "./describe.js";
export { describeObject, starHue };

// Visual principal: modelo 3D (sistema solar), imagen de Wikipedia (si existe) o
// una representación esquemática claramente etiquetada. Nunca se inventan fotos.
function Visual({ obj, info, t, lang, wiki, wikiState, credit }) {
  const [texStatus, setTexStatus] = useState("loading");
  const [imgOk, setImgOk] = useState(false);
  const [imgFail, setImgFail] = useState(false);
  // imagen curada de la NASA (src/sky/nasaImages.js): si falla al cargar se pasa a la siguiente fuente
  const nasa = nasaImageFor(obj);
  const [nasaState, setNasaState] = useState(null);     // null | "ok" | "fail"
  useEffect(() => { setNasaState(nasa ? nasaStatus(nasa.id) : null); }, [nasa && nasa.id]);   // eslint-disable-line react-hooks/exhaustive-deps
  const nasaUsable = !!nasa && nasaState !== "fail" && nasaStatus(nasa.id) !== "fail";
  const nasaFigure = (extra = "") => {
    const kind = t.nasaKind[nasaKindKey(nasa)], loaded = nasaState === "ok";
    return (
      <figure className={`sk-visual is-photo is-nasa${extra}`} data-source="nasa" data-kind={nasa.kind}>
        <div className={`sk-visual-stage${loaded ? " is-loaded" : ""}`}>
          {!loaded && <i className="sk-skeleton" aria-hidden="true" />}
          <img key={nasa.id} src={nasa.src} alt={t.nasaAlt(kind, info.name)} decoding="async"
            onLoad={() => { setNasaStatus(nasa.id, "ok"); setNasaState("ok"); }}
            onError={() => { setNasaStatus(nasa.id, "fail"); setNasaState("fail"); }} />
        </div>
        <figcaption>
          <b>{kind}</b>
          <span>{nasa[lang] || nasa.es}</span>
          <span>{t.nasaCap(nasa.credit, t.nasaLib)}</span>
          <a href={nasa.page} target="_blank" rel="noopener noreferrer">{t.nasaOpen}</a>
        </figcaption>
      </figure>
    );
  };
  useEffect(() => { setTexStatus("loading"); setImgOk(false); setImgFail(false); }, [obj.name, obj.layer]);
  useEffect(() => { setImgOk(false); setImgFail(false); }, [wiki && wiki.thumb]);

  if (info.visual === "3d") {
    const b = BODIES[obj.name] || {};
    const real = texStatus === "real";
    return (<>
      <figure className="sk-visual is-3d">
        <div className="sk-visual-stage">
          <i className="sk-orbit" aria-hidden="true" />
          <Planet3D bodyKey={obj.name} onStatus={setTexStatus}
            phase={obj.name === "Luna" && obj.illum != null ? { illum: obj.illum, waxing: obj.waxing } : null}
            ariaLabel={t.model3dAria(info.name)} />
          <span className="sk-drag-hint" aria-hidden="true"><Icon name="hand" size={14} />{t.dragToSpin}</span>
        </div>
        <figcaption>
          <b>{texStatus === "fallback" || texStatus === "nowebgl" ? t.cap3dFallback : t.cap3dReal}</b>
          {real && <span>{t.texCredit[b.credit] || t.texCredit.sss}</span>}
          {obj.name === "Luna" && obj.illum != null && <span className="sk-cap-extra">{t.capMoonPhase}</span>}
        </figcaption>
      </figure>
      {nasaUsable && nasaFigure(" is-second")}
    </>);
  }
  if (info.visual === "exoplanet") {
    const sized = obj.rade > 0;
    return (
      <figure className="sk-visual is-exo" role="img" aria-label={t.exoFigAria(obj.name)}>
        <div className="sk-visual-stage"><ExoCompare obj={obj} t={t} /></div>
        <figcaption><b>{sized ? t.exoCap : t.exoCapNoSize}</b>{sized && <span>{obj.eqt_k > 0 ? t.exoCapTone : t.exoCapNoTone}</span>}</figcaption>
      </figure>
    );
  }
  if (info.visual === "note") {
    return (
      <figure className="sk-visual is-illus">
        <div className="sk-visual-stage"><NoteArt id={obj.note} /></div>
        <figcaption><b>{obj.note === "kepler" ? t.capKepler : t.capNote}</b></figcaption>
      </figure>
    );
  }
  const hasPhoto = wiki && wiki.thumb && !imgFail;
  // orden de fuentes (imageOrder): naves y cometas → NASA curada primero; cielo profundo → Wikipedia primero
  const nasaFirst = imageOrder(obj)[0] === "nasa";
  if (nasaUsable && (nasaFirst || (!hasPhoto && wikiState !== "loading"))) return nasaFigure();
  if (hasPhoto) {
    const mixed = obj.layer === "star" || obj.layer === "pulsars" || obj.layer === "blackholes" || obj.layer === "exoplanets";
    const who = credit && [credit.artist, credit.license].filter(Boolean).join(" · ");
    return (
      <figure className="sk-visual is-photo">
        <div className={`sk-visual-stage${imgOk ? " is-loaded" : ""}`}>
          {!imgOk && <i className="sk-skeleton" aria-hidden="true" />}
          <img src={wiki.thumb} alt={t.imgAlt(info.name)} onLoad={() => setImgOk(true)} onError={() => setImgFail(true)} />
        </div>
        <figcaption>
          <b>{who ? `${t.capImgBy(who)} · ${t.capImgCommons}` : mixed ? t.capWikiMixed : t.capWiki}</b>
          {who && mixed && <span>{t.capWikiMixed}</span>}
          {wiki.imgLang && wiki.imgLang !== lang && <span>{t.capImgOtherLang}</span>}
          <a href={(credit && credit.page) || wiki.imgUrl || wiki.url} target="_blank" rel="noopener noreferrer">{t.capLicense}</a>
        </figcaption>
      </figure>
    );
  }
  if (wikiState === "loading" && info.visual !== "star") {
    return (
      <figure className="sk-visual is-photo">
        <div className="sk-visual-stage"><i className="sk-skeleton" aria-hidden="true" /></div>
        <figcaption><span role="status">{t.capLoading}</span></figcaption>
      </figure>
    );
  }
  // sin imagen: representación propia del tipo de objeto, siempre rotulada
  const kind = artKind(obj);
  return (
    <figure className="sk-visual is-illus">
      <div className="sk-visual-stage"><ArtCanvas kind={kind} obj={obj} label={t.artAria(info.name)} /></div>
      <figcaption>
        <b>{t.capRep[kind] || t.capSchematic}</b>
        {kind !== "star" && wikiState === "done" && <span>{nasa ? t.capNoPhotoAny : t.capNoPhoto}</span>}
      </figcaption>
    </figure>
  );
}

// Representación esquemática en <canvas> (src/sky/art.js), nítida a la densidad de la pantalla.
export function ArtCanvas({ kind, obj, label }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c) return undefined;
    const paint = () => {
      const w = c.clientWidth, h = c.clientHeight; if (!w || !h) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
      const x = c.getContext("2d"); x.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawArt(x, kind, 0, 0, w, h, artOptions(obj));
    };
    paint();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(paint) : null;
    if (ro) ro.observe(c);
    return () => { if (ro) ro.disconnect(); };
  }, [kind, obj.name, obj.hex, obj.hubble, obj.rade, obj.eqt_k]);   // eslint-disable-line react-hooks/exhaustive-deps
  return <canvas ref={ref} className="sk-art" role="img" aria-label={label} />;
}

// ── salida, culminación y puesta desde "Mi cielo" ───────────────────────────
const bodyDirAt = (name) => (d) => { const b = ephemeris(d).find((x) => x.name === name); return [b.nx, b.ny, b.nz]; };
const sunDirAt = bodyDirAt("Sol");
/** Cálculo para la ficha: { rts, best, now } o null si el objeto no tiene dirección. */
export function visibilityOf(obj, local, when) {
  if (!obj || obj.nx == null || !local) return null;
  const solar = obj.layer === "solar";
  const dirAt = solar ? bodyDirAt(obj.name) : () => [obj.nx, obj.ny, obj.nz];
  const minAlt = horizonFor(solar && obj.name === "Sol" ? "sun" : solar && obj.name === "Luna" ? "moon" : "star");
  const rts = riseTransitSet(dirAt, local.lat, local.lon, when, { minAlt });
  const d0 = dirAt(when), now = altAz(d0[0], d0[1], d0[2], local.lat, local.lon, when);
  const isSun = solar && obj.name === "Sol";
  // estrellas débiles y cielo profundo piden cielo oscuro (−12°); la Luna y los planetas ya se ven con −6°
  const best = isSun ? null : bestTonight(dirAt, sunDirAt, local.lat, local.lon, when, { sunLimit: solar ? -6 : -12 });
  return { rts, best, now, isSun };
}
export function RiseSet({ obj, t, lang, local, when, onNeedPlace }) {
  // el cálculo se rehace por minuto, no por render
  const minute = Math.floor(when.getTime() / 60000);
  const vis = useMemo(() => (local ? visibilityOf(obj, local, new Date(minute * 60000)) : null),
    [obj.name, obj.layer, obj.nx, obj.ny, obj.nz, local && local.lat, local && local.lon, minute]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (obj.nx == null || obj.layer === "note") return null;
  if (!local) {
    return (
      <div className="sk-rs is-off">
        <p>{t.rsNeedPlace}</p>
        <button type="button" className="sk-btn" onClick={onNeedPlace}><Icon name="pin" size={16} />{t.rsActivate}</button>
      </div>
    );
  }
  if (!vis) return null;
  const loc = lang === "es" ? "es-EC" : "en-US";
  const hm = (d) => d.toLocaleTimeString(loc, lang === "es" ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" } : { hour: "numeric", minute: "2-digit" });
  // si el instante cae en otro día que el de referencia, se dice cuál
  const dayOf = (d) => (d.toDateString() === when.toDateString() ? "" : t.rsDay(d.toLocaleDateString(loc, { weekday: "short", day: "numeric" })));
  const { rts, best, now, isSun } = vis;
  // si los tres instantes caen en el mismo día (distinto de hoy), el día se dice una sola vez
  const evs = [rts.rise, rts.transit, rts.set].filter(Boolean).map((x) => dayOf(x.date));
  const oneDay = evs.length > 0 && evs.every((d) => d === evs[0]) ? evs[0] : null;
  const at = (x) => (x ? hm(x.date) + (oneDay != null ? "" : dayOf(x.date)) : null);
  const tDay = rts.transit && oneDay == null ? dayOf(rts.transit.date) : "";
  const main = rts.state === "never" ? t.rsNever
    : rts.state === "always" ? t.rsAlways(hm(rts.transit.date), Math.round(rts.transit.alt), dayOf(rts.transit.date))
    : t.rsLine(at(rts.rise), rts.transit ? hm(rts.transit.date) : null, rts.transit ? Math.round(rts.transit.alt) : null, at(rts.set), tDay) + (oneDay || "");
  let bestLine = null;
  if (isSun) bestLine = t.rsSun;
  else if (best) {
    if (best.ok) bestLine = Math.abs(best.date.getTime() - when.getTime()) < 6 * 60000 ? t.rsBestNow(Math.round(best.alt)) : t.rsBest(hm(best.date) + dayOf(best.date), Math.round(best.alt));
    else if (best.reason === "daylight") bestLine = rts.state === "never" ? null : t.rsDaylight;
    else if (best.reason === "gone") bestLine = t.rsGone;
    else if (best.reason === "low") bestLine = t.rsLow(Math.ceil(best.alt));
    else if (best.reason === "nonight") bestLine = t.rsNoNight;
  }
  return (
    <section className="sk-rs" aria-label={t.rsTitle(local.place)}>
      <h3><Icon name="pin" size={15} />{t.rsTitle(local.place)}</h3>
      <p className="sk-rs-main">{main}</p>
      <p>{now.alt > 0 ? t.rsUp(Math.round(now.alt), compassPoint8(now.az)) : t.rsDown}{bestLine ? " " + bestLine : ""}</p>
      <small>{t.rsHint}</small>
    </section>
  );
}

// ── "Participa": ciencia ciudadana relacionada (src/sky/citizen.js) ─────────
export function Citizen({ obj, t, lang, local }) {
  const list = citizenFor(obj, local);
  if (!list.length) return null;
  return (
    <section className="sk-join" aria-label={t.joinTitle}>
      <h3>{t.joinTitle}</h3>
      <ul>
        {list.map((p) => (
          <li key={p.id}>
            <a href={p.url} target="_blank" rel="noopener noreferrer" aria-label={t.joinOpen(p.name)}><b>{p.name}</b> <span>{p.org}</span></a>
            <p>{p[lang] || p.es}</p>
            <small>{t.joinNeeds[p.needs]}</small>
          </li>
        ))}
      </ul>
      <small className="sk-join-foot">{t.joinVerified(CITIZEN_VERIFIED)}</small>
    </section>
  );
}

// ── armazón de la ficha (hoja inferior deslizable en móvil, panel lateral en escritorio) ──
// Es un diálogo no modal: el cielo sigue usable detrás. Al abrirse lleva el foco a su
// título (los lectores de pantalla lo anuncian) y al cerrarse lo devuelve a donde estaba.
export function SheetShell({ t, title, subtitle, badge, resetKey, onClose, children, className = "" }) {
  const [mode, setMode] = useState("peek");           // móvil: "peek" (media altura) | "full"
  const [dragY, setDragY] = useState(0);
  const startRef = useRef(null);
  const bodyRef = useRef(null);
  const boxRef = useRef(null);
  useEffect(() => { setMode("peek"); if (bodyRef.current) bodyRef.current.scrollTop = 0; }, [resetKey]);
  useDialogFocus(boxRef, { trap: false });
  // asa: arrastrar arriba expande, abajo reduce / cierra; un toque alterna
  const onDown = (e) => { startRef.current = { y: e.clientY, moved: false }; try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* no-op */ } };
  const onMove = (e) => { const s = startRef.current; if (!s) return; const dy = e.clientY - s.y; if (Math.abs(dy) > 6) s.moved = true; setDragY(mode === "full" ? Math.max(0, dy) : dy); };
  const onUp = () => {
    const s = startRef.current; startRef.current = null;
    const dy = dragY; setDragY(0);
    if (!s) return;
    if (!s.moved) { setMode((m) => (m === "peek" ? "full" : "peek")); return; }
    if (dy < -40) setMode("full");
    else if (dy > 40) { if (mode === "full") setMode("peek"); else onClose(); }
  };
  return (
    <section ref={boxRef} className={`sk-sheet is-${mode}${dragY ? " is-dragging" : ""} ${className}`} role="dialog" aria-labelledby="sk-sheet-title"
      style={dragY ? { "--drag": `${dragY}px` } : undefined}>
      <button type="button" className="sk-grab" aria-label={mode === "peek" ? t.sheetExpand : t.sheetCollapse} aria-expanded={mode === "full"}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setMode((m) => (m === "peek" ? "full" : "peek")); } }}>
        <i />
      </button>
      <header className="sk-sheet-head">
        <div>
          <h2 id="sk-sheet-title" tabIndex={-1}>{title}</h2>
          <p className="sk-type">{subtitle}{badge && <em>{badge}</em>}</p>
        </div>
        <button type="button" className="sk-iconbtn" onClick={onClose} aria-label={t.closeSheet}><Icon name="close" size={18} /></button>
      </header>
      <div className="sk-sheet-body" ref={bodyRef}>{children}</div>
    </section>
  );
}

export default function ObjectSheet({ obj, lang, t, wiki, wikiState, credit, meteorActive, onClose, onShare, onViewFrom, onCenter, canViewFrom, onFind, findAria, local, when, onNeedPlace }) {
  const info = describeObject(obj, lang, t, meteorActive);
  // exoplanetas: si Wikipedia solo tiene la página de la estrella, su texto no describe al planeta
  const wikiFits = obj.layer !== "exoplanets" || (wiki && wiki.title && wiki.title.toLowerCase().includes(String(obj.name).toLowerCase()));
  const isNote = obj.layer === "note";
  const nasaInfo = nasaImageFor(obj);
  const extract = wiki && wiki.extract && wikiFits ? (wiki.extract.length > 340 ? wiki.extract.slice(0, 340).replace(/\s+\S*$/, "") + "…" : wiki.extract) : "";

  return (
    <SheetShell t={t} title={info.name} subtitle={info.type} badge={info.badge} resetKey={`${obj.layer}|${obj.name}|${obj.note || ""}`} onClose={onClose}>
        <Visual obj={obj} info={info} t={t} lang={lang} wiki={wiki} wikiState={wikiState} credit={credit} />
        {info.facts.length > 0 && (
          <dl className="sk-facts">
            {info.facts.map((f) => (
              <div key={f.label}><dt>{f.label}</dt><dd>{f.value}{f.hint && <small>{f.hint}</small>}</dd></div>
            ))}
          </dl>
        )}
        {info.note && <p className="sk-note">{info.note}</p>}
        {!isNote && <RiseSet obj={obj} t={t} lang={lang} local={local} when={when} onNeedPlace={onNeedPlace} />}
        {info.explain.length > 0 && (
          <ul className="sk-explain">
            {info.explain.map((e, i) => (
              <li key={i}>{e.title && <b>{e.title}</b>}<span>{e.text}</span>{e.hint && <small>{e.hint}</small>}</li>
            ))}
          </ul>
        )}
        {/* «¿De qué está hecho?» y «Su vida y su final»: solo Sol, Luna, planetas y estrellas (los bloques devuelven null en el resto) */}
        {!isNote && <CompositionBlock obj={obj} lang={lang} />}
        {!isNote && <StarLifeBlock obj={obj} lang={lang} />}
        {extract && (
          <p className="sk-desc">{extract} <a href={wiki.url} target="_blank" rel="noopener noreferrer">{t.readMore}</a></p>
        )}
        {(info.details.length > 0 || info.distNote) && (
          <details className="sk-details">
            <summary>{t.techDetails}<Icon name="down" size={16} /></summary>
            <dl>
              {info.details.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
              {nasaInfo && <div><dt>{t.dImgNasa}</dt><dd>{nasaInfo.title} · {nasaInfo.credit} · {t.nasaLib} ({nasaInfo.id})</dd></div>}
            </dl>
            {info.distNote && <p>{info.distNote}</p>}
          </details>
        )}
        <div className="sk-actions">
          {canViewFrom && (
            <button type="button" className="sk-btn primary wide" onClick={onViewFrom}><Icon name="eye" size={18} />{t.viewFromHere}</button>
          )}
          {onFind && (
            <button type="button" className="sk-btn wide sk-find-btn" onClick={onFind} aria-label={findAria}><Icon name="point" size={18} />{t.findIt}</button>
          )}
          {!isNote && <button type="button" className="sk-btn" onClick={onShare}><Icon name="share" size={17} />{t.share}</button>}
          <button type="button" className="sk-btn" onClick={onCenter}><Icon name="target" size={17} />{t.center}</button>
        </div>
        {!isNote && <Citizen obj={obj} t={t} lang={lang} local={!!local} />}
    </SheetShell>
  );
}
