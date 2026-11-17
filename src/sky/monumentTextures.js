// monumentTextures.js — texturas de piedra para los monumentos, generadas en el navegador (sin descargar
// imágenes): sillares de caliza, piedra volcánica con mortero, arenisca sarsen con líquenes, hierba, cuarzo y
// escalones. Cada una da color (map) y relieve (bumpMap) y cubre `tile` metros: las caras usan coordenadas en
// metros, así que una hilada de Keops mide lo que mide de verdad.
//
//   makeMonumentTexture(kind, THREE) → { map, bump, tile }
//
// Deterministas (semilla fija por tipo): la misma piedra siempre se ve igual.

let SIZE = 512;

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function canvas() {
  const c = document.createElement("canvas"); c.width = SIZE; c.height = SIZE;
  return c;
}

/** Ruido suave (varias escalas) sobre el lienzo, en gris, con la opacidad dada. */
function noise(ctx, r, alpha, scales = [8, 32, 128]) {
  for (const n of scales) {
    const s = document.createElement("canvas"); s.width = n; s.height = n;
    const g = s.getContext("2d"), img = g.createImageData(n, n);
    for (let i = 0; i < n * n; i++) { const v = Math.floor(r() * 255); img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
    g.putImageData(img, 0, 0);
    ctx.save(); ctx.globalAlpha = alpha; ctx.globalCompositeOperation = "overlay"; ctx.imageSmoothingEnabled = true;
    ctx.drawImage(s, 0, 0, SIZE, SIZE);
    ctx.restore();
  }
}

/** Grano fino (píxel a píxel). */
function grain(ctx, r, amount) {
  const img = ctx.getImageData(0, 0, SIZE, SIZE), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const k = (r() - 0.5) * amount; d[i] += k; d[i + 1] += k; d[i + 2] += k; }
  ctx.putImageData(img, 0, 0);
}

const rgb = (c, f = 1) => `rgb(${Math.round(Math.min(255, c[0] * 255 * f))},${Math.round(Math.min(255, c[1] * 255 * f))},${Math.round(Math.min(255, c[2] * 255 * f))})`;

/** Hiladas de sillares: filas de bloques de largo variable, juntas oscuras y sombra bajo cada hilada. */
function courses(cv, bv, r, { base, rows, minW, maxW, joint, var: vr, step }) {
  const c = cv.getContext("2d"), b = bv.getContext("2d");
  c.fillStyle = rgb(base); c.fillRect(0, 0, SIZE, SIZE);
  b.fillStyle = "#808080"; b.fillRect(0, 0, SIZE, SIZE);
  const rh = SIZE / rows;
  for (let row = 0; row < rows; row++) {
    const y = row * rh;
    let x = -r() * maxW;
    while (x < SIZE) {
      const w = minW + r() * (maxW - minW), f = 1 + (r() - 0.5) * vr;
      c.fillStyle = rgb(base, f); c.fillRect(x, y, w, rh);
      // el bloque: más claro arriba (le da el sol), más oscuro abajo
      const g = c.createLinearGradient(0, y, 0, y + rh);
      g.addColorStop(0, "rgba(255,255,255,0.10)"); g.addColorStop(1, "rgba(0,0,0,0.16)");
      c.fillStyle = g; c.fillRect(x, y, w, rh);
      const gv = 150 + Math.floor(r() * 40); b.fillStyle = `rgb(${gv},${gv},${gv})`; b.fillRect(x, y, w, rh);
      // juntas
      c.fillStyle = "rgba(20,16,12,0.55)"; c.fillRect(x, y, joint, rh); b.fillStyle = "#202020"; b.fillRect(x, y, joint, rh);
      if (x + w > SIZE) { c.fillStyle = rgb(base, f); c.fillRect(x - SIZE, y, w, rh); }
      x += w;
    }
    // la hilada sobresale: sombra en su base (escalón)
    c.fillStyle = `rgba(15,12,8,${step})`; c.fillRect(0, y + rh - joint * 1.5, SIZE, joint * 1.5);
    b.fillStyle = "#101010"; b.fillRect(0, y + rh - joint, SIZE, joint);
  }
}

/** Piedras irregulares en mortero (Teotihuacan, cuarzo de Newgrange). */
function cobbles(cv, bv, r, { mortar, stones, n, rMin, rMax, dark }) {
  const c = cv.getContext("2d"), b = bv.getContext("2d");
  c.fillStyle = rgb(mortar); c.fillRect(0, 0, SIZE, SIZE);
  b.fillStyle = "#505050"; b.fillRect(0, 0, SIZE, SIZE);
  for (let i = 0; i < n; i++) {
    const x = r() * SIZE, y = r() * SIZE, rad = rMin + r() * (rMax - rMin), k = 5 + Math.floor(r() * 4);
    const col = stones[Math.floor(r() * stones.length)], f = 0.85 + r() * 0.3;
    for (const [ox, oy] of [[0, 0], [SIZE, 0], [-SIZE, 0], [0, SIZE], [0, -SIZE]]) {
      if (x + ox < -rMax || x + ox > SIZE + rMax || y + oy < -rMax || y + oy > SIZE + rMax) continue;
      c.beginPath(); b.beginPath();
      for (let j = 0; j < k; j++) {
        const a = (j / k) * 2 * Math.PI + r() * 0.4, rr = rad * (0.7 + r() * 0.45);
        const px = x + ox + Math.cos(a) * rr, py = y + oy + Math.sin(a) * rr * 0.8;
        if (j) { c.lineTo(px, py); b.lineTo(px, py); } else { c.moveTo(px, py); b.moveTo(px, py); }
      }
      c.closePath(); b.closePath();
      c.fillStyle = rgb(col, f); c.fill();
      c.strokeStyle = `rgba(0,0,0,${dark})`; c.lineWidth = 2; c.stroke();
      const gv = 170 + Math.floor(r() * 60); b.fillStyle = `rgb(${gv},${gv},${gv})`; b.fill();
    }
  }
}

/** Una textura: { map, bump, tile } (tile: metros que cubre). */
export function makeMonumentTexture(kind, THREE) {
  const r = rng({ blocks: 11, casing: 12, basalt: 21, yucatan: 31, sarsen: 41, grass: 51, quartz: 61, steps: 71, sand: 81, dirt: 91, door: 99 }[kind] || 7);
  SIZE = kind === "basalt" ? 1024 : 512;           // la piedra de Teotihuacan, más grande: se repite menos
  const cv = canvas(), bv = canvas(), c = cv.getContext("2d"), b = bv.getContext("2d");
  let tile = 4;
  if (kind === "blocks") {             // Guiza: hiladas de caliza sin el revestimiento (~0,7–1 m)
    courses(cv, bv, r, { base: [0.78, 0.68, 0.5], rows: 6, minW: 70, maxW: 190, joint: 3, var: 0.22, step: 0.4 });
    noise(c, r, 0.35); grain(c, r, 26); tile = 5.5;
  } else if (kind === "casing") {      // Kefrén arriba: el revestimiento liso que queda
    c.fillStyle = rgb([0.86, 0.79, 0.64]); c.fillRect(0, 0, SIZE, SIZE); b.fillStyle = "#909090"; b.fillRect(0, 0, SIZE, SIZE);
    noise(c, r, 0.4, [4, 16, 64]); grain(c, r, 14);
    for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(90,70,40,${0.05 + r() * 0.08})`; c.fillRect(r() * SIZE, 0, 2 + r() * 10, SIZE); }
    tile = 12;
  } else if (kind === "basalt") {      // Teotihuacan: piedra volcánica en mortero
    cobbles(cv, bv, r, { mortar: [0.6, 0.56, 0.5], stones: [[0.47, 0.43, 0.39], [0.53, 0.47, 0.41], [0.43, 0.4, 0.37], [0.57, 0.52, 0.46], [0.5, 0.47, 0.44]], n: 2600, rMin: 7, rMax: 17, dark: 0.2 });
    // restos de estuco y manchas grandes: rompen la repetición de la tesela
    for (let i = 0; i < 18; i++) { const x = r() * SIZE, y = r() * SIZE, rad = 40 + r() * 120, g = c.createRadialGradient(x, y, 0, x, y, rad); const lt = r() < 0.5; g.addColorStop(0, lt ? "rgba(225,215,195,0.22)" : "rgba(30,25,20,0.18)"); g.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = g; c.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
    noise(c, r, 0.45, [4, 16, 64]); grain(c, r, 30); tile = 12;
  } else if (kind === "yucatan") {     // Chichén Itzá: sillares finos de caliza clara con manchas de humedad
    courses(cv, bv, r, { base: [0.82, 0.79, 0.7], rows: 10, minW: 40, maxW: 110, joint: 2, var: 0.14, step: 0.25 });
    for (let i = 0; i < 26; i++) { const x = r() * SIZE, w = 6 + r() * 30, g = c.createLinearGradient(0, 0, 0, SIZE); g.addColorStop(0, "rgba(40,40,30,0.0)"); g.addColorStop(1, `rgba(40,40,30,${0.08 + r() * 0.14})`); c.fillStyle = g; c.fillRect(x, 0, w, SIZE); }
    noise(c, r, 0.3); grain(c, r, 20); tile = 3;
  } else if (kind === "sarsen") {      // Stonehenge: arenisca gris con líquenes
    c.fillStyle = rgb([0.6, 0.6, 0.56]); c.fillRect(0, 0, SIZE, SIZE); b.fillStyle = "#808080"; b.fillRect(0, 0, SIZE, SIZE);
    noise(c, r, 0.55, [6, 24, 96]);
    for (let i = 0; i < 160; i++) {
      const x = r() * SIZE, y = r() * SIZE, rad = 3 + r() * r() * 26, lich = r() < 0.6;
      c.fillStyle = lich ? `rgba(${180 + r() * 40},${190 + r() * 30},${120 + r() * 40},${0.25 + r() * 0.35})` : `rgba(40,42,40,${0.15 + r() * 0.2})`;
      c.beginPath(); c.arc(x, y, rad, 0, 2 * Math.PI); c.fill();
    }
    for (let i = 0; i < 10; i++) { c.strokeStyle = "rgba(25,25,22,0.45)"; c.lineWidth = 1 + r() * 2; c.beginPath(); let x = r() * SIZE, y = 0; c.moveTo(x, y); while (y < SIZE) { x += (r() - 0.5) * 18; y += 10 + r() * 20; c.lineTo(x, y); } c.stroke(); }
    grain(c, r, 30); tile = 2.2;
  } else if (kind === "grass") {
    c.fillStyle = rgb([0.36, 0.48, 0.24]); c.fillRect(0, 0, SIZE, SIZE); b.fillStyle = "#808080"; b.fillRect(0, 0, SIZE, SIZE);
    noise(c, r, 0.5, [8, 32, 128]);
    for (let i = 0; i < 4000; i++) { c.fillStyle = `rgba(${40 + r() * 60},${80 + r() * 70},${20 + r() * 30},0.5)`; c.fillRect(r() * SIZE, r() * SIZE, 1.5, 3 + r() * 5); }
    tile = 6;
  } else if (kind === "quartz") {      // Newgrange: muro de cuarzo blanco con cantos de granito
    cobbles(cv, bv, r, { mortar: [0.88, 0.87, 0.84], stones: [[0.93, 0.93, 0.91], [0.86, 0.86, 0.84], [0.35, 0.35, 0.36], [0.95, 0.94, 0.92]], n: 340, rMin: 8, rMax: 18, dark: 0.2 });
    grain(c, r, 16); tile = 2.5;
  } else if (kind === "steps") {       // escalinata: huella clara y contrahuella en sombra (una textura = 8 escalones)
    const n = 8, h = SIZE / n;
    for (let i = 0; i < n; i++) {
      c.fillStyle = rgb([0.7, 0.66, 0.58], 1.05); c.fillRect(0, i * h, SIZE, h * 0.45);
      c.fillStyle = rgb([0.7, 0.66, 0.58], 0.62); c.fillRect(0, i * h + h * 0.45, SIZE, h * 0.55);
      b.fillStyle = "#c0c0c0"; b.fillRect(0, i * h, SIZE, h * 0.45); b.fillStyle = "#404040"; b.fillRect(0, i * h + h * 0.45, SIZE, h * 0.55);
    }
    noise(c, r, 0.35); grain(c, r, 22); tile = 8 * 0.3;   // 8 escalones de ~30 cm (en la pendiente)
  } else if (kind === "sand" || kind === "dirt") {
    c.fillStyle = rgb(kind === "sand" ? [0.8, 0.68, 0.5] : [0.52, 0.47, 0.38]); c.fillRect(0, 0, SIZE, SIZE); b.fillStyle = "#808080"; b.fillRect(0, 0, SIZE, SIZE);
    noise(c, r, 0.45, [6, 24, 96]); grain(c, r, 26); tile = 10;
  } else if (kind === "door") {
    c.fillStyle = "#0b0a09"; c.fillRect(0, 0, SIZE, SIZE); b.fillStyle = "#000"; b.fillRect(0, 0, SIZE, SIZE); tile = 10;
  }
  const mk = (cnv, color) => {
    const t = new THREE.CanvasTexture(cnv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    if (color) t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  };
  return { map: mk(cv, true), bump: mk(bv, false), tile };
}
