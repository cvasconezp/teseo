// Ficha de una constelación: nombres, las estrellas de su figura con su distancia real
// (el sello de Teseo: "no están juntas, solo alineadas desde aquí"), cuándo se ve desde
// tu ubicación, los objetos de los catálogos que caen dentro y el paso a la vista 3D.
// No cuenta mitología: solo quién la catalogó y cuándo (dato comprobable) y el enlace
// a Wikipedia para quien quiera leer más.
import { useMemo, useState } from "react";
import Icon from "./icons.jsx";
import { SheetShell, RiseSet, Citizen } from "./ObjectSheet.jsx";
import { conNameEs, conOrigin, CON_SOURCE } from "./constellations.js";
import { fmtDist, num } from "./format.js";

// barra de distancias en escala logarítmica: de la más cercana a la más lejana
function DepthBar({ stars, near, far, lang }) {
  if (!near || !far || far.dist <= near.dist) return null;
  const a = Math.log10(near.dist), b = Math.log10(far.dist);
  return (
    <div className="sk-con-bar" aria-hidden="true">
      <i className="sk-con-earth" />
      {stars.filter((s) => s.dist != null).map((s) => (
        <span key={s.hip} style={{ left: `${6 + 90 * (Math.log10(s.dist) - a) / (b - a || 1)}%`, background: s.hex || "#fff" }} />
      ))}
      <em className="is-a">{fmtDist(near.dist, lang)}</em><em className="is-b">{fmtDist(far.dist, lang)}</em>
    </div>
  );
}

export default function ConstellationSheet({ con, data, lang, t, wiki, local, when, inside, onNeedPlace, onClose, onDepth, onShare, onCenter, onFind, findAria, onPickStar, onPickObject }) {
  const [all, setAll] = useState(false);
  const es = conNameEs(con.ab);
  const other = lang === "es" ? (es || con.en) : con.en;
  const origin = conOrigin(con.ab);
  const obj = useMemo(() => ({ layer: "con", name: con.la, ab: con.ab, nx: data.dir[0], ny: data.dir[1], nz: data.dir[2] }), [con.la, con.ab, data.dir]);
  const shown = all ? data.stars : data.stars.slice(0, 6);
  const extract = wiki && wiki.extract ? (wiki.extract.length > 300 ? wiki.extract.slice(0, 300).replace(/\s+\S*$/, "") + "…" : wiki.extract) : "";
  const dist = (s) => (s.dist != null ? fmtDist(s.dist, lang) : t.conNoDist);
  return (
    <SheetShell t={t} title={con.la} subtitle={`${t.conType} · ${other}${lang === "es" && es && con.en !== es ? ` (${con.en})` : ""}`} resetKey={con.ab} onClose={onClose} className="is-con">
      <section className="sk-con-stars">
        <h3>{t.conStarsTitle}</h3>
        <p>{t.conStarsLead(data.stars.length)}</p>
        {data.near && data.far && data.far.dist > data.near.dist && (
          <>
            <dl className="sk-facts is-two">
              <div><dt>{t.conNear}</dt><dd>{dist(data.near)}<small>{data.near.name || t.conStarUnnamed}</small></dd></div>
              <div><dt>{t.conFar}</dt><dd>{dist(data.far)}<small>{data.far.name || t.conStarUnnamed}</small></dd></div>
            </dl>
            <DepthBar stars={data.stars} near={data.near} far={data.far} lang={lang} />
            {data.ratio >= 1.5 && <p className="sk-note">{t.conRatio(num(data.ratio, lang, data.ratio < 10 ? 1 : 0))}</p>}
          </>
        )}
        <ul className="sk-con-list">
          {shown.map((s) => (
            <li key={s.hip}>
              <i style={{ background: s.hex || "#fff" }} aria-hidden="true" />
              {s.name ? <button type="button" onClick={() => onPickStar(s.hip)}>{s.name}</button> : <span className="is-mute">HIP {s.hip}</span>}
              <span>{dist(s)}</span>
            </li>
          ))}
        </ul>
        {data.stars.length > 6 && !all && <button type="button" className="sk-btn ghost" onClick={() => setAll(true)}>{t.conAllStars(data.stars.length)}</button>}
        {all && <small>{t.conMagHint}</small>}
      </section>
      <button type="button" className="sk-btn primary wide" onClick={onDepth}><Icon name="layers" size={18} />{t.conDepth}</button>
      <RiseSet obj={obj} t={t} lang={lang} local={local} when={when} onNeedPlace={onNeedPlace} />
      <section className="sk-con-inside">
        <h3>{t.conInside}</h3>
        {inside.length === 0 ? <p>{t.conInsideNone}</p> : (
          <>
            <p>{t.conInsideLead}</p>
            <div className="sk-quick">
              {inside.slice(0, 14).map((x) => <button key={x.layer + x.obj.name} type="button" onClick={() => onPickObject(x.layer, x.obj)}>{x.label}</button>)}
            </div>
          </>
        )}
      </section>
      {origin && (
        <section className="sk-con-origin">
          <h3>{t.conOriginTitle}</h3>
          <p>{t.conOrigin[origin]} <a href={CON_SOURCE} target="_blank" rel="noopener noreferrer">{t.conOriginSrc}</a></p>
          <small>{t.conFigureNote}</small>
        </section>
      )}
      {extract && <p className="sk-desc">{extract} <a href={wiki.url} target="_blank" rel="noopener noreferrer">{t.readMore}</a></p>}
      {!extract && wiki && wiki.url && <p className="sk-desc"><a href={wiki.url} target="_blank" rel="noopener noreferrer">{t.readMore}</a></p>}
      <div className="sk-actions">
        {onFind && <button type="button" className="sk-btn wide sk-find-btn" onClick={onFind} aria-label={findAria}><Icon name="point" size={18} />{t.findIt}</button>}
        <button type="button" className="sk-btn" onClick={onShare}><Icon name="share" size={17} />{t.share}</button>
        <button type="button" className="sk-btn" onClick={onCenter}><Icon name="target" size={17} />{t.center}</button>
      </div>
      <Citizen obj={obj} t={t} lang={lang} local={!!local} />
      <small className="sk-con-src">{t.srcCon}</small>
    </SheetShell>
  );
}
