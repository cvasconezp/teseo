// TopoPicker.jsx — mapa topográfico para elegir el lugar tocándolo (curvas de nivel, cumbres con su altura,
// sombreado del relieve). Teselas de OpenTopoMap (https://opentopomap.org; mapa CC-BY-SA, datos © colaboradores de
// OpenStreetMap y SRTM): servidor de voluntarios, así que solo se piden mientras este mapa está abierto.
// Visor propio y mínimo (sin bibliotecas): arrastrar mueve, la rueda o dos dedos acercan, un toque marca el punto.
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "./icons.jsx";

import { TOPO_TILE, TS, ZMIN, ZMAX, toPx, toLL } from "./topo.js";

const TT = {
  es: { title: "Elige un punto en el mapa", hint: "Toca el mapa para marcar dónde estar. Arrastra para moverte; acerca con dos dedos o la rueda.",
    here: "Situarme aquí", summit: "En la cumbre más cercana", close: "Cerrar el mapa", zin: "Acercar", zout: "Alejar",
    credit: "Mapa © OpenTopoMap (CC-BY-SA) · Datos © colaboradores de OpenStreetMap, SRTM", none: "Toca el mapa para marcar un punto" },
  en: { title: "Pick a point on the map", hint: "Tap the map to mark where to stand. Drag to move; zoom with two fingers or the wheel.",
    here: "Put me here", summit: "On the nearest summit", close: "Close the map", zin: "Zoom in", zout: "Zoom out",
    credit: "Map © OpenTopoMap (CC-BY-SA) · Data © OpenStreetMap contributors, SRTM", none: "Tap the map to mark a point" },
};

export default function TopoPicker({ lang = "es", lat = -0.2, lon = -78.5, onPick, onClose }) {
  const T = TT[lang] || TT.es;
  const boxRef = useRef(null);
  const [size, setSize] = useState({ w: 360, h: 480 });
  const [view, setView] = useState({ z: 11, x: toPx(lat, lon, 11)[0], y: toPx(lat, lon, 11)[1] });
  const [mark, setMark] = useState(null);
  const ptrs = useRef(new Map()), gest = useRef(null);

  useEffect(() => {
    const el = boxRef.current; if (!el) return undefined;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el); setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  // acercar o alejar un paso manteniendo quieto el punto (fx, fy) de la pantalla
  const zoomAt = useCallback((dz, fx, fy) => setView((v) => {
    const z = Math.max(ZMIN, Math.min(ZMAX, v.z + dz)); if (z === v.z) return v;
    const k = 2 ** (z - v.z), ox = fx - size.w / 2, oy = fy - size.h / 2;
    return { z, x: (v.x + ox) * k - ox, y: (v.y + oy) * k - oy };
  }), [size]);

  const local = (e) => { const r = boxRef.current.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const onDown = (e) => {
    boxRef.current.setPointerCapture(e.pointerId);
    ptrs.current.set(e.pointerId, local(e));
    if (ptrs.current.size === 1) gest.current = { moved: 0, start: local(e) };
    else if (ptrs.current.size === 2) { const [a, b] = [...ptrs.current.values()]; gest.current = { pinch: Math.hypot(a[0] - b[0], a[1] - b[1]), moved: 99 }; }
  };
  const onMove = (e) => {
    if (!ptrs.current.has(e.pointerId)) return;
    const prev = ptrs.current.get(e.pointerId), cur = local(e);
    ptrs.current.set(e.pointerId, cur);
    const g = gest.current; if (!g) return;
    if (ptrs.current.size === 2 && g.pinch) {
      const [a, b] = [...ptrs.current.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (d / g.pinch > 1.5) { zoomAt(1, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); g.pinch = d; }
      else if (d / g.pinch < 0.67) { zoomAt(-1, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); g.pinch = d; }
      return;
    }
    const dx = cur[0] - prev[0], dy = cur[1] - prev[1];
    g.moved += Math.abs(dx) + Math.abs(dy);
    if (g.moved > 6) setView((v) => ({ ...v, x: v.x - dx, y: v.y - dy }));
  };
  const onUp = (e) => {
    const g = gest.current, had = ptrs.current.delete(e.pointerId);
    if (had && g && ptrs.current.size === 0 && g.moved <= 6) {
      const [px, py] = local(e);
      const [la, lo] = toLL(view.x + px - size.w / 2, view.y + py - size.h / 2, view.z);
      setMark({ lat: +la.toFixed(5), lon: +lo.toFixed(5) });
    }
    if (ptrs.current.size === 0) gest.current = null;
  };
  const onWheel = (e) => { const [px, py] = local(e); zoomAt(e.deltaY < 0 ? 1 : -1, px, py); };

  // teselas que cubren la vista
  const n = 2 ** view.z, x0 = view.x - size.w / 2, y0 = view.y - size.h / 2, tiles = [];
  for (let ty = Math.floor(y0 / TS); ty <= Math.floor((y0 + size.h) / TS); ty++) {
    if (ty < 0 || ty >= n) continue;
    for (let tx = Math.floor(x0 / TS); tx <= Math.floor((x0 + size.w) / TS); tx++) {
      const wx = ((tx % n) + n) % n;
      tiles.push(<img key={`${view.z}/${tx}/${ty}`} src={TOPO_TILE(view.z, wx, ty)} alt="" draggable={false} decoding="async"
        style={{ left: Math.round(tx * TS - x0), top: Math.round(ty * TS - y0) }} />);
    }
  }
  const mp = mark && toPx(mark.lat, mark.lon, view.z);

  return createPortal(
    <div className="sk-topo" role="dialog" aria-modal="true" aria-labelledby="sk-topo-title">
      <header>
        <div><h2 id="sk-topo-title">{T.title}</h2><p>{T.hint}</p></div>
        <button type="button" className="sk-icon-btn" onClick={onClose} aria-label={T.close}><Icon name="close" size={20} /></button>
      </header>
      <div ref={boxRef} className="sk-topo-map" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onWheel={onWheel}>
        {tiles}
        {mp && <span className="sk-topo-mark" style={{ left: Math.round(mp[0] - x0), top: Math.round(mp[1] - y0) }}><Icon name="pin" size={30} /></span>}
        <div className="sk-topo-zoom">
          <button type="button" onClick={() => zoomAt(1, size.w / 2, size.h / 2)} aria-label={T.zin}><Icon name="plus" size={20} /></button>
          <button type="button" onClick={() => zoomAt(-1, size.w / 2, size.h / 2)} aria-label={T.zout}><Icon name="minus" size={20} /></button>
        </div>
        <small className="sk-topo-credit">{T.credit}</small>
      </div>
      <footer>
        <span>{mark ? `${mark.lat.toFixed(4)}°, ${mark.lon.toFixed(4)}°` : T.none}</span>
        <div>
          <button type="button" className="sk-btn" disabled={!mark} onClick={() => onPick({ ...mark, summit: true })}><Icon name="mountain" size={17} />{T.summit}</button>
          <button type="button" className="sk-btn primary" disabled={!mark} onClick={() => onPick({ ...mark, summit: false })}><Icon name="pin" size={17} />{T.here}</button>
        </div>
      </footer>
    </div>,
    document.body,
  );
}
