// ─── RED ─────────────────────────────────────────────────────────────────────
// fetch + JSON con tres garantías que el fetch "pelado" no da:
//   1. timeout (AbortController): una petición colgada termina en error;
//   2. comprueba r.ok: un 500/502 del backend es un error, no un JSON raro;
//   3. un JSON inválido (p. ej. HTML devuelto por un rewrite) rechaza la promesa.
// `signal` (opcional) permite cancelar desde fuera, p. ej. al desmontar el
// componente o cuando cambia la selección: en ese caso rechaza con AbortError
// y quien llama debe ignorarlo (ver isAbort).

export const TIMEOUT_MS = 20000;        // datos (backend / NASA / JSON estáticos)
export const TIMEOUT_AI_MS = 25000;     // narración IA: opcional, nunca bloquea

export async function fetchJson(url, { timeout = TIMEOUT_MS, signal, ...init } = {}) {
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, timeout);
  const onAbort = () => ctrl.abort();
  if (signal) {
    if (signal.aborted) ctrl.abort();
    else signal.addEventListener("abort", onAbort, { once: true });
  }
  try {
    const r = await fetch(url, { ...init, signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();   // el timeout sigue activo mientras se lee el cuerpo
  } catch (e) {
    if (timedOut) {
      const err = new Error(`Timeout after ${timeout} ms: ${url}`);
      err.name = "TimeoutError";
      throw err;
    }
    throw e;
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", onAbort);
  }
}

// true si el error es una cancelación deliberada (no un fallo que mostrar)
export const isAbort = (e) => !!e && e.name === "AbortError";
