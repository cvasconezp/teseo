// PlaceSearch.jsx — buscador de lugares del mundo para «Mi cielo» (Open-Meteo Geocoding) y sitios
// astronómicos y arqueológicos (places.js). Elegir un resultado llama a onPlace({ name, lat, lon, elev }).
import { useEffect, useRef, useState } from "react";
import Icon from "./icons.jsx";
import { SITES, TP, searchPlaces, searchSites, placeLine, siteUrl } from "./places.js";

export function PlaceSearch({ lang = "es", onPlace }) {
  const tp = TP[lang] || TP.es;
  const [q, setQ] = useState("");
  const [st, setSt] = useState({ status: "idle", list: [] });
  const tm = useRef(null), ab = useRef(null);
  useEffect(() => {
    clearTimeout(tm.current);
    if (q.trim().length < 2) { setSt({ status: "idle", list: [] }); return undefined; }
    tm.current = setTimeout(() => {
      if (ab.current) ab.current.abort();
      const ctl = typeof AbortController !== "undefined" ? new AbortController() : null; ab.current = ctl;
      setSt((s) => ({ status: "loading", list: s.list }));
      searchPlaces(q, lang, { signal: ctl && ctl.signal }).then(
        (list) => setSt({ status: "ok", list }),
        (e) => { if (!(e && e.name === "AbortError")) setSt({ status: "error", list: [] }); });
    }, 350);
    return () => clearTimeout(tm.current);
  }, [q, lang]);
  const sites = searchSites(q);
  const pick = (p) => { setQ(""); setSt({ status: "idle", list: [] }); onPlace(p); };
  const any = sites.length > 0 || st.list.length > 0;
  return (
    <div className="sk-group sk-psearch">
      <h3>{tp.searchTitle}</h3>
      <label className="sk-psearch-in">
        <Icon name="search" size={17} />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tp.placeholder} aria-label={tp.searchAria}
          autoComplete="off" enterKeyHint="search" />
      </label>
      {q.trim().length >= 2 && (
        <ul className="sk-psearch-list" role="listbox" aria-label={tp.searchTitle}>
          {sites.map((s) => (
            <li key={s.id}><button type="button" role="option" aria-selected="false" onClick={() => pick({ name: s.name[lang] || s.name.es, lat: s.lat, lon: s.lon, elev: s.elev })}>
              <b>{s.name[lang] || s.name.es}</b><small>{tp.site} · {s.note[lang] || s.note.es}</small></button></li>
          ))}
          {st.list.map((p) => (
            <li key={`${p.name}${p.lat}${p.lon}`}><button type="button" role="option" aria-selected="false" onClick={() => pick({ name: p.name, lat: p.lat, lon: p.lon, elev: p.elev })}>
              <b>{p.name}</b><small>{placeLine(p, lang)}</small></button></li>
          ))}
          {st.status === "loading" && !any && <li className="sk-psearch-msg" role="status">{tp.searching}</li>}
          {st.status === "ok" && !any && <li className="sk-psearch-msg" role="status">{tp.none}</li>}
          {st.status === "error" && <li className="sk-psearch-msg" role="status">{tp.error}</li>}
        </ul>
      )}
      <small className="sk-hint">{tp.source}</small>
    </div>
  );
}

export function SiteChips({ lang = "es", placeName, localMode, onPlace }) {
  const tp = TP[lang] || TP.es;
  const cur = SITES.find((s) => localMode && (s.name.es === placeName || s.name.en === placeName));
  return (
    <div className="sk-group">
      <h3>{tp.sitesTitle}</h3>
      <div className="sk-quick sk-sites">
        {SITES.map((s) => {
          const nm = s.name[lang] || s.name.es;
          return <button key={s.id} type="button" aria-pressed={cur === s} onClick={() => onPlace({ name: nm, lat: s.lat, lon: s.lon, elev: s.elev })}>{nm}</button>;
        })}
      </div>
      {cur && <p className="sk-site-note">{cur.note[lang] || cur.note.es}{siteUrl(cur, lang) && <> <a href={siteUrl(cur, lang)} target="_blank" rel="noopener noreferrer">{tp.siteMore}</a></>}</p>}
      <small className="sk-hint">{tp.sitesHint}</small>
    </div>
  );
}

export default PlaceSearch;
