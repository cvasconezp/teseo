// Diálogo de compartir: vista previa de la postal vertical (1080 × 1920, formato de historias)
// + Compartir (Web Share con el PNG; el texto menciona a Killa Ñan),
// Descargar y Copiar enlace. Es un diálogo modal: atrapa el foco, Esc lo cierra y al
// cerrarse devuelve el foco al botón que lo abrió.
//
// Genérico: `build()` es cualquier generador de lienzo que devuelva { canvas, report } (la postal del Cielo,
// src/sky/postcard.js, o las imágenes de «Ahora», src/share/card.js). Las props opcionales `shareText`,
// `shareUrl`, `fileName` y `metric` permiten otro texto, enlace, nombre de archivo y métrica; sin ellas,
// el comportamiento es el de siempre en el Cielo.
import { useEffect, useRef, useState } from "react";
import Icon from "./icons.jsx";
import { canvasBlob } from "./postcard.js";
import { track } from "../ui/track.js";

export const fileNameFor = (name) => `teseo-${String(name || "cielo").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w-]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase() || "cielo"}.png`;

/** ¿Puede este navegador compartir un archivo PNG con la Web Share API? */
export function canShareFile(file) {
  try { return !!(navigator.share && navigator.canShare && navigator.canShare({ files: [file] })); } catch { return false; }
}

export default function ShareDialog({ t, name, build, onClose, onCopyLink, linkState, shareText, shareUrl, fileName, metric, title, making, alt, hint }) {
  const m = metric || { event: "sky_postcard", params: {} };
  const [state, setState] = useState("making");        // making | ready | failed
  const [url, setUrl] = useState(null);
  const [msg, setMsg] = useState(null);                 // { tone: "ok" | "warn", text }
  const fileRef = useRef(null);
  const boxRef = useRef(null);
  const reportRef = useRef(null);
  const [shareable, setShareable] = useState(false);
  const [dims, setDims] = useState([1080, 1920]);       // tamaño de la vista previa (la foto 360° es 2:1)

  useEffect(() => {
    let dead = false, objectUrl = null;
    (async () => {
      try {
        // build() da un lienzo (postal, PNG) o ya un archivo hecho (foto 360°: { blob, type, width, height, fileName })
        const res = await build();
        const { canvas, report } = res;
        const blob = res.blob || await canvasBlob(canvas);
        if (dead) return;
        if (!blob) { setState("failed"); track(m.event, { ...m.params, state: "fail" }); return; }
        if (res.width && res.height) setDims([res.width, res.height]);
        const file = new File([blob], res.fileName || fileName || fileNameFor(name), { type: res.type || "image/png" });
        fileRef.current = file; reportRef.current = report;
        objectUrl = URL.createObjectURL(blob);
        setShareable(canShareFile(file));
        setUrl(objectUrl); setState("ready"); track(m.event, { ...m.params, state: "ok" });
      } catch { if (!dead) { setState("failed"); track(m.event, { ...m.params, state: "fail" }); } }
    })();
    return () => { dead = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  // foco: entra al diálogo, queda atrapado y vuelve a su origen al cerrar
  useEffect(() => {
    const prev = document.activeElement;
    const box = boxRef.current;
    if (box) box.focus({ preventScroll: true });
    return () => { if (prev && prev.isConnected && typeof prev.focus === "function") prev.focus({ preventScroll: true }); };
  }, []);
  // cuando la postal está lista, el foco pasa al botón principal (si sigue dentro del diálogo)
  useEffect(() => {
    const box = boxRef.current;
    if (state === "ready" && box && (document.activeElement === box || !box.contains(document.activeElement))) { const f = box.querySelector("[data-autofocus]"); if (f) f.focus({ preventScroll: true }); }
  }, [state]);
  const onKey = (e) => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); return; }
    if (e.key !== "Tab") return;
    const els = [...boxRef.current.querySelectorAll("button:not(:disabled), a[href], [tabindex]:not([tabindex='-1'])")];
    if (!els.length) return;
    const first = els[0], last = els[els.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === boxRef.current)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  const download = () => {
    const file = fileRef.current; if (!file || !url) return;
    const a = document.createElement("a");
    a.href = url; a.download = file.name;
    document.body.appendChild(a); a.click(); a.remove();
    setMsg({ tone: "ok", text: t.shareSaved });
  };
  const send = async () => {
    const file = fileRef.current; if (!file) return;
    if (!canShareFile(file)) { download(); setMsg({ tone: "warn", text: t.shareNoFiles }); return; }
    try {
      const text = shareText || (name ? t.shareText(name) : t.shareTextSky);
      await navigator.share({ files: [file], title: text, text: `${text} · ${shareUrl || window.location.href}` });
      setMsg({ tone: "ok", text: t.shareSent });
    } catch (e) {
      if (e && e.name === "AbortError") return;        // la persona cerró la hoja de compartir: no es un error
      setMsg({ tone: "warn", text: t.shareSendFailed });
    }
  };
  const report = reportRef.current;
  return (
    <div className="sk-modal" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sk-share" role="dialog" aria-modal="true" aria-labelledby="sk-share-title" ref={boxRef} tabIndex={-1} onKeyDown={onKey}>
        <header className="sk-share-head">
          <h2 id="sk-share-title">{title || t.shareTitle}</h2>
          <button type="button" className="sk-iconbtn" onClick={onClose} aria-label={t.close}><Icon name="close" size={18} /></button>
        </header>
        <div className={`sk-share-preview is-${state}${dims[0] > dims[1] ? " is-wide" : ""}`} data-hero={report ? report.hero : undefined} data-hero-source={report ? report.heroSource : undefined} data-overflow={report ? String(report.overflow) : undefined} data-truncated={report ? String(report.truncated) : undefined} data-safe={report && report.safeZoneOk != null ? String(report.safeZoneOk) : undefined}>
          {state === "making" && <p role="status"><i className="sk-spin" />{making || t.shareMaking}</p>}
          {state === "failed" && <p role="alert"><Icon name="warn" size={18} />{t.shareFailed}</p>}
          {state === "ready" && <img src={url} alt={alt || (name ? t.shareAlt(name) : t.shareAltSky)} width={dims[0]} height={dims[1]} />}
        </div>
        <div className="sk-share-actions">
          <button type="button" className="sk-btn primary" onClick={send} disabled={state !== "ready"} data-autofocus><Icon name="share" size={17} />{t.shareSend}</button>
          <button type="button" className="sk-btn" onClick={download} disabled={state !== "ready"}><Icon name="download" size={17} />{t.shareDownload}</button>
          <button type="button" className="sk-btn" onClick={onCopyLink}>
            <Icon name={linkState === "ok" ? "check" : linkState === "fail" ? "warn" : "link"} size={17} />
            {linkState === "ok" ? t.linkCopied : linkState === "fail" ? t.linkFailed : t.shareCopy}
          </button>
        </div>
        <p className={`sk-share-msg${msg ? " tone-" + msg.tone : ""}`} role="status" aria-live="polite">
          {msg ? msg.text : state === "ready" && !shareable ? t.shareNoFiles : state === "ready" && hint ? hint : ""}
          <span className="sk-sr">{linkState === "ok" ? t.linkCopied : linkState === "fail" ? t.linkFailed : ""}</span>
        </p>
      </div>
    </div>
  );
}
