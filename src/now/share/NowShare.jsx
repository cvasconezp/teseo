// NowShare.jsx — «Compartir» cada cosa de la pestaña Ahora como imagen vertical (1080 × 1920).
//   · <NowShareProvider lang api> envuelve la pestaña y monta UN solo diálogo (src/sky/ShareDialog.jsx);
//   · <ShareButton spec title /> es el botón (icono, 44 px de área táctil, nombre accesible con el título).
// spec = { kind, ev? | launch? | sun? | rock? | craft? } (ver src/share/eventText.js). La imagen la dibuja
// src/share/card.js, que se carga en su propio chunk la primera vez que alguien comparte.
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import ShareDialog from "../../sky/ShareDialog.jsx";
import { fetchJson } from "../../net.js";
import { readPlace } from "../calendar/events.js";
import { TE, cardFileName } from "../../share/i18n.js";
import { NOW_SHARE_EVENT } from "../../ui/track.js";
import "../../share/share.css";

const Ctx = createContext(null);

// catálogo de estrellas para el fondo (el mismo /sky.json del Cielo); se pide una vez
let skyPromise = null;
const loadSky = () => {
  if (!skyPromise) skyPromise = fetchJson("/sky.json", { timeout: 15000 }).catch(() => { skyPromise = null; return null; });
  return skyPromise;
};
/** Enlace a la pestaña Ahora (sin el resto del hash), para el texto al compartir y «Copiar enlace». */
export const nowLink = () => { try { return `${window.location.origin}${window.location.pathname}#ahora`; } catch { return "https://teseo.yachaydeep.com/#ahora"; } };

export function NowShareProvider({ lang = "es", api = "", children }) {
  const [open, setOpen] = useState(null);           // { spec, title }
  const [linkState, setLinkState] = useState(null);
  const T = TE[lang] || TE.es;
  const show = useCallback((spec, title) => { setLinkState(null); setOpen({ spec, title }); }, []);
  const value = useMemo(() => ({ show, T }), [show, T]);
  const build = useCallback(async () => {
    const [{ buildEventCard }, sky] = await Promise.all([import("../../share/card.js"), loadSky()]);
    let place = null;
    try { place = readPlace(typeof localStorage !== "undefined" ? localStorage : null); } catch { place = null; }
    return buildEventCard({ spec: open.spec, lang, place, api, sky, now: Date.now() });
  }, [open, lang, api]);
  const copy = useCallback(async () => {
    try { await navigator.clipboard.writeText(nowLink()); setLinkState("ok"); } catch { setLinkState("fail"); }
  }, []);
  return (
    <Ctx.Provider value={value}>
      {children}
      {open && (
        <div className="share-host">
          <ShareDialog key={`${open.spec.kind}-${open.title}`} t={T} name={open.title} build={build} onClose={() => setOpen(null)}
            onCopyLink={copy} linkState={linkState} shareText={T.shareText(open.title)} shareUrl={nowLink()}
            fileName={cardFileName(open.spec.kind, open.title)} metric={{ event: NOW_SHARE_EVENT, params: { kind: open.spec.kind } }} />
        </div>
      )}
    </Ctx.Provider>
  );
}

const ShareIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M12 3.5v11" /><path d="M7.5 8 12 3.5 16.5 8" /><path d="M5 12.5v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
  </svg>
);

/** Botón «Compartir» de un elemento de Ahora. Sin proveedor (p. ej. en pruebas) no se dibuja. */
export function ShareButton({ spec, title, className = "", withText = false }) {
  const c = useContext(Ctx);
  if (!c || !spec || !title) return null;
  return (
    <button type="button" className={`now-share-btn${withText ? " has-text" : ""} ${className}`.trim()}
      aria-label={c.T.shareBtn(title)} title={c.T.shareBtn(title)} data-share-kind={spec.kind}
      onClick={() => c.show(spec, title)}>
      <ShareIcon />{withText ? <span>{c.T.shareBtnShort}</span> : null}
    </button>
  );
}
