// Volver a "Apuntar al cielo" al levantar el teléfono.
//
// Al arrastrar con el dedo se sale de apuntar y se pasa al modo manual, pero los sensores siguen
// escuchando. Este detector decide cuándo volver solo:
//   1. "Armado": primero el teléfono tiene que bajar (la parte trasera mira por debajo de `armBelow`
//      grados; al usarlo a mano, en postura de lectura, la cámara mira al suelo). Así, si la persona
//      arrastra con el teléfono ya levantado, no se vuelve a apuntar en el acto contra su voluntad.
//   2. "Disparo": después, la cámara mira por encima de `fireAbove` grados de altura de forma
//      sostenida durante `holdMs`, sin ningún dedo en la pantalla.
// Histéresis: entre `armBelow` y `fireAbove` no cambia nada; si se baja a mitad del gesto, se reinicia.

export const RESUME_DEFAULTS = { armBelow: 20, fireAbove: 55, holdMs: 800 };

export function createResumeDetector(opts = {}) {
  const o = { ...RESUME_DEFAULTS, ...opts };
  let armed = false, since = 0;
  return {
    /** alt: altura (°) hacia la que mira la cámara trasera; now: ms; touching: hay dedos en pantalla.
     *  Devuelve true una sola vez, cuando hay que volver a apuntar. */
    update(alt, now, touching = false) {
      if (!Number.isFinite(alt)) { since = 0; return false; }
      if (alt < o.armBelow) { armed = true; since = 0; return false; }
      if (!armed || touching || alt < o.fireAbove) { since = 0; return false; }
      if (!since) { since = now; return false; }
      if (now - since >= o.holdMs) { armed = false; since = 0; return true; }
      return false;
    },
    reset() { armed = false; since = 0; },
    get armed() { return armed; },
  };
}

// Distancia mínima (px CSS) para que un arrastre mientras se apunta pase al modo manual.
// Por debajo, el toque sigue siendo un toque (abre la ficha del objeto).
export const DRAG_TO_MANUAL_PX = 12;
export function isDragToManual(dx, dy, px = DRAG_TO_MANUAL_PX) {
  return Math.hypot(dx, dy) > px;
}
