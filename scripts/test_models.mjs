// Pruebas de src/sky/models.js: mediana y rango de siete modelos del tiempo (node scripts/test_models.mjs)
import { MODELS, modelsUrl, median, stats, parseModels, tempAt, dayAt, disagreement, fetchModels, skyVote } from "../src/sky/models.js";
import { voteIcon } from "../src/sky/nowWeather.js";

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) { pass++; console.log("  ✓ " + msg); } else { fail++; console.log("  ✗ " + msg); } };
const near = (a, b, e = 1e-9) => a != null && Math.abs(a - b) <= e;

const u = new URL(modelsUrl(0.0412, -78.1449, 2830.4));
ok(u.searchParams.get("latitude") === "0.04" && u.searchParams.get("longitude") === "-78.14" && u.searchParams.get("elevation") === "2830", "el lugar con 2 decimales y su altitud");
ok(u.searchParams.get("models").split(",").length === 7 && u.searchParams.get("timezone") === "auto" && u.searchParams.get("forecast_days") === "7" && u.searchParams.get("forecast_hours") === "168", "siete modelos, 7 días hora a hora y por día, en hora local");
ok(!new URL(modelsUrl(0, 0, null)).searchParams.has("elevation"), "sin altitud conocida no la manda");

ok(median([3, 1, 2]) === 2 && median([4, 1, 3, 2]) === 2.5 && median([null, 5]) === 5 && median([]) === null && median([null]) === null, "mediana impar, par, con nulos y vacía");
const st = stats([14.8, 13.4, null, 16.1]);
ok(st.n === 3 && st.med === 14.8 && st.lo === 13.4 && st.hi === 16.1 && stats([null]) === null, "mediana, mínimo y máximo sin contar los nulos");

// respuesta como la de Open-Meteo (cada variable con el sufijo del modelo)
const T0 = 1795611600;   // 25-nov-2026 08:00 en Cayambe
const hourly = { time: [T0, T0 + 3600] }, daily = { time: [1795582800, 1795669200] };
const tt = [[14.8, 17.2], [13.4, 15.8], [13.4, 14.9], [14.5, 16.6], [16.1, 17.7], [13.6, 15.7], [14.7, 15.5]];
const mm = [[8.1, 18.4], [6.5, 9], [22.9, 20], [12.5, 11], [15.1, 10.4], [2.4, 3], [null, 5]];
MODELS.forEach((m, k) => {
  hourly[`temperature_2m_${m}`] = tt[k];
  daily[`temperature_2m_max_${m}`] = [17 + k * 0.1, 18]; daily[`temperature_2m_min_${m}`] = [9 + k * 0.1, 10]; daily[`precipitation_sum_${m}`] = mm[k];
});
const mod = parseModels({ hourly, daily });
ok(mod && mod.hours.length === 2 && mod.hours[0].temps.length === 7 && mod.days.length === 2 && mod.days[0].mm[6] === null, "lee horas y días de los siete modelos");
ok(parseModels({ hourly: { time: [T0] } }) === null && parseModels(null) === null, "sin temperaturas no hay modelos");

const a = tempAt(mod, T0);
ok(a.n === 7 && a.med === 14.5 && a.lo === 13.4 && a.hi === 16.1, "a las 8:00: mediana 14,5 °C, de 13,4 a 16,1");
const b = tempAt(mod, T0 + 1800);
ok(near(b.med, 15.1, 1e-9) && near(b.lo, 14.15, 1e-9) && near(b.hi, 16.9, 1e-9), "a las 8:30 interpola cada modelo entre las dos horas");
ok(tempAt(mod, T0 - 1700) !== null && tempAt(mod, T0 - 4000) === null && tempAt(mod, T0 + 3600 + 4000) === null && tempAt(null, T0) === null, "fuera de las horas no inventa");

const d = dayAt(mod, T0);
ok(d && d.t === 1795582800 && d.mm.n === 6 && d.mm.lo === 2.4 && d.mm.hi === 22.9 && d.mm.med === 10.3, "el día de hoy: lluvia de 2,4 a 22,9 mm, mediana 10,3");
ok(dayAt(mod, 1795669200 + 100).t === 1795669200 && dayAt(mod, 1795582800 - 10) === null, "el día que contiene un instante, o ninguno");

const dis = disagreement(a, d.mm);
ok(dis && dis.t[0] === 13.4 && dis.t[1] === 16.1 && dis.mm[0] === 2.4 && dis.mm[1] === 22.9, "hoy no coinciden: avisa con los dos rangos");
ok(disagreement({ n: 7, lo: 14, hi: 15.5 }, { n: 7, lo: 3, hi: 9 }) === null, "si coinciden, no avisa");
ok(disagreement({ n: 2, lo: 10, hi: 20 }, null) === null, "con menos de 3 modelos no opina");
ok(disagreement({ n: 5, lo: 10, hi: 11 }, { n: 5, lo: 0, hi: 12 }).t[0] === 10, "solo la lluvia basta para avisar");

// red: caché y errores
{
  let calls = 0;
  const f = async () => { calls++; return { ok: true, json: async () => ({ hourly, daily }) }; };
  const r1 = await fetchModels(1, 2, 100, { fetchImpl: f, now: 1000 });
  await fetchModels(1, 2, 100, { fetchImpl: f, now: 2000 });
  ok(r1.hours.length === 2 && calls === 1, "guarda la respuesta 30 minutos");
  let err = null;
  try { await fetchModels(3, 4, null, { fetchImpl: async () => ({ ok: false, status: 429, json: async () => ({ reason: "límite" }) }), now: 0 }); } catch (e) { err = e.message; }
  ok(err === "límite", "si Open-Meteo falla, rechaza con su motivo");
}

// el cielo por votación: qué dan los modelos a esa hora (lluvia, tormenta, nieve, aguanieve o seco)
{
  const T = 1800000000, j = { hourly: { time: [T] }, daily: { time: [] } };
  const codes = [61, 95, 63, 61, 96, 80, 3], temps = [16, 16, 16, 16, 16, 16, 16];
  MODELS.forEach((m, k) => { j.hourly[`temperature_2m_${m}`] = [temps[k]]; j.hourly[`weather_code_${m}`] = [codes[k]]; });
  const mod = parseModels(j), v = skyVote(mod, T + 600);
  ok(/weather_code/.test(modelsUrl(0, 0)) && v && v.n === 7 && v.counts.rain === 4 && v.counts.storm === 2 && v.counts.dry === 1 && skyVote(mod, T + 4000) === null,
    "skyVote cuenta lo que da cada modelo a la hora más cercana (±30 min)");
  const base = { kind: "cloud", maybe: null };
  ok(JSON.stringify(voteIcon(v, base)) === JSON.stringify({ kind: "rain", maybe: "storm" }), "mayoría de lluvia, con 2 que dan tormenta: lluvia y «posible tormenta»");
  ok(JSON.stringify(voteIcon({ n: 7, counts: { rain: 2, sleet: 0, snow: 0, storm: 1, dry: 4 } }, { kind: "rain", maybe: null }, true, 80)) === JSON.stringify({ kind: "cloud", maybe: "rain" }),
    "si solo 3 de 7 dan algo que cae: las nubes, con «posible lluvia» (aunque el pronóstico del lugar diga lluvia)");
  ok(voteIcon({ n: 7, counts: { rain: 0, sleet: 0, snow: 0, storm: 4, dry: 3 } }, base).kind === "storm" && voteIcon({ n: 7, counts: { rain: 1, sleet: 0, snow: 0, storm: 0, dry: 6 } }, { kind: "sun", maybe: null }).kind === "sun"
    && voteIcon(null, base) === base, "4 de 7 con tormenta: tormenta; casi todos secos: el sol del lugar; sin votos, el pronóstico del lugar");
  const cold = { hourly: { time: [T] }, daily: { time: [] } };
  MODELS.forEach((m) => { cold.hourly[`temperature_2m_${m}`] = [-3]; cold.hourly[`weather_code_${m}`] = [63]; });
  ok(skyVote(parseModels(cold), T).counts.snow === 7, "cada modelo, con su temperatura: en frío, la lluvia cuenta como nieve");
  ok(disagreement(null, null, { n: 7, counts: { rain: 4, sleet: 0, snow: 0, storm: 0, dry: 3 } }).sky === true && disagreement(null, null, v) === null,
    "4 contra 3: no coinciden en si llueve; 6 de 7 con algo que cae, sí");
}

console.log(`\n${pass} pruebas correctas, ${fail} fallidas`);
process.exit(fail ? 1 : 0);
