// Riassume una traccia di misura-telefono.mjs: per thread, tempo occupato ed
// eventi piu' costosi negli ultimi N secondi (il gesto del cancellino).
//   node .lavoro/riassumi-traccia.mjs <traccia.json> [secondi]
// Il thread da guardare e' CrGpuMain: al 100% e' la GPU di Chrome che non
// regge, e RasterDecoderImpl::DoEndRasterCHROMIUM conta le consegne.
import fs from 'fs';
const [file, secArg] = process.argv.slice(2);
const sec = Number(secArg || 4);
const j = JSON.parse(fs.readFileSync(file, 'utf8'));
const ev = j.traceEvents || j;
const nomi = new Map();
for (const e of ev) if (e.ph === 'M' && e.name === 'thread_name') nomi.set(`${e.pid}:${e.tid}`, e.args.name);
let fine = 0; for (const e of ev) if (e.ts > fine && e.ph === "X") fine = e.ts;
const da = fine - sec * 1e6;
const perThread = new Map();
for (const e of ev) {
  if (e.ph !== 'X' || e.ts < da || !e.dur) continue;
  const k = `${e.pid}:${e.tid}`;
  let t = perThread.get(k);
  if (!t) perThread.set(k, t = { nome: nomi.get(k) || k, eventi: [], perNome: new Map() });
  t.eventi.push(e);
}
const righe = [];
for (const t of perThread.values()) {
  // tempo occupato: unione degli intervalli di primo livello
  t.eventi.sort((a, b) => a.ts - b.ts);
  let occ = 0, fineCorr = -1;
  for (const e of t.eventi) {
    const f = e.ts + e.dur;
    if (e.ts >= fineCorr) { occ += e.dur; fineCorr = f; }
    else if (f > fineCorr) { occ += f - fineCorr; fineCorr = f; }
    t.perNome.set(e.name, (t.perNome.get(e.name) || 0) + e.dur);
  }
  righe.push([occ, t]);
}
righe.sort((a, b) => b[0] - a[0]);
for (const [occ, t] of righe.slice(0, 6)) {
  console.log(`${t.nome.padEnd(28)} occupato ${(100 * occ / (sec * 1e6)).toFixed(0)}%`);
  [...t.perNome.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
    .forEach(([n, d]) => console.log(`    ${(d / 1000 / sec).toFixed(1).padStart(7)} ms/s  ${n}`));
}
