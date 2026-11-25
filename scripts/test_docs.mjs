// Coherencia entre documentos: versión, licencia, marca y cuentas de los catálogos.
// Evita que un cambio de licencia o de versión quede a medias en algún archivo.
import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok    " + m); } else { fail++; console.log("  FALLA " + m); } };
const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

console.log("versión");
const pkg = JSON.parse(read("package.json"));
const lock = JSON.parse(read("package-lock.json"));
ok(lock.version === pkg.version && lock.packages[""].version === pkg.version, "package-lock.json = package.json");
ok(read("CHANGELOG.md").match(/^## (\d+\.\d+\.\d+)/m)?.[1] === pkg.version, "la primera entrada del CHANGELOG es la versión de package.json");
const backendVersion = ["backend/app/main.py", "backend/app/version.py", "backend/app/__init__.py"]
  .map((p) => { try { return read(p).match(/^VERSION\s*=\s*"([^"]+)"/m)?.[1]; } catch { return null; } })
  .find(Boolean);
ok(backendVersion === pkg.version, "el backend declara la misma versión (" + backendVersion + ")");

console.log("licencia");
ok(pkg.license === "PolyForm-Noncommercial-1.0.0", "package.json: PolyForm Noncommercial");
const publicos = ["public/llms.txt", "index.html", "public/acerca/index.html", "public/about/index.html", "README.md"];
for (const p of publicos) {
  // el README puede contar que las versiones hasta la 1.79.0 fueron AGPL: esa frase no cuenta
  const t = read(p).replace(/Las versiones hasta la [^\n]*\n[^\n]*/, "");
  ok(!/AGPL|licencia MIT|MIT license/i.test(t), p + ": no anuncia una licencia anterior (AGPL, MIT)");
  ok(!/c[oó]digo abierto|open[- ]source/i.test(t), p + ": no se presenta como «código abierto» (la licencia es no comercial)");
}

console.log("marca");
for (const p of [...publicos, "src/App.jsx"]) {
  ok(!/en cooperaci[oó]n con|in cooperation with/i.test(read(p)), p + ": usa «con Killa Ñan», no «en cooperación con»");
  ok(!/killanan\.org/i.test(read(p)), p + ": no enlaza a killanan.org (ya no existe)");
}

console.log("catálogos");
for (const f of ["galaxies", "pulsars", "ngc", "deepsky", "caldwell", "blackholes"]) {
  const j = JSON.parse(read("public/" + f + ".json"));
  const n = Array.isArray(j) ? null : (j.objects || j.items || []).length;
  if (j.meta && typeof j.meta.count === "number" && n != null) ok(j.meta.count === n, f + ".json: meta.count (" + j.meta.count + ") = objetos (" + n + ")");
}

console.log(`\n${pass} pruebas correctas, ${fail} fallidas`);
process.exit(fail ? 1 : 0);
