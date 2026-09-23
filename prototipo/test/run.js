/**
 * Test della pipeline geometrica. Niente browser, niente dipendenze:
 *   node test/run.js
 *
 * Coprono le funzioni pure. Cio' che resta soggettivo — "un cerchio sembra un
 * cerchio" — si verifica a mano nel prototipo, ed e' scritto nel README.
 */

import { createOneEuro2D } from '../src/filter.js';
import { ONE_EURO, SMOOTHING, WIDTHS, PRESSURE_MIN,
         PRESSURE_ALPHA_MIN, BOARD_W, boardHeight, freezeBoardHeight,
         unfreezeBoardHeight } from '../src/palette.js';
import { resample, simplify, count, length, STRIDE } from '../src/geom.js';
import { mulberry32, passoTimbri, bandaEffettiva, puntaBase, affiancate } from '../src/chalk.js';
import { nomeFile, haDisegno, dimensioni, EXPORT_W,
         larghezzaLogo, rettangoloLogo, LOGO_W_STRETTA, LOGO_W_LARGA,
         LOGO_MARGINE } from '../src/export.js';
import { clientId, CHIAVE_CLIENT, endpointInvio, payloadDisegno, firma,
         motivoDaStatus, inviaVoce, createCoda, MAX_TENTATIVI, MAX_CODA } from '../src/invio.js';
import { createDrawing, adattaLavagna } from '../src/model.js';
import { STEPS, testoStep, areaUnione, posizionaFinestra,
         giaVisto, segnaVisto, chiaveVisto, CHIAVE_VISTO } from '../src/tutorial.js';

let passed = 0, failed = 0;
const results = [];

// I test sincroni girano subito, nell'ordine in cui sono scritti: alcuni
// condividono lo stato del modulo palette.js e contano su quell'ordine. Quelli
// asincroni (l'invio) partono subito anche loro, e si aspettano alla fine.
const inSospeso = [];
function test(nome, fn) {
  const i = results.push(null) - 1;
  const ok = () => { passed++; results[i] = ['ok  ', nome, '']; };
  const ko = (e) => { failed++; results[i] = ['FAIL', nome, e.message]; };
  try {
    const r = fn();
    if (r && typeof r.then === 'function') inSospeso.push(r.then(ok, ko));
    else ok();
  } catch (e) { ko(e); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function close(a, b, tol, msg) {
  if (Math.abs(a - b) > tol) {
    throw new Error(`${msg}: ${a.toFixed(4)} vs ${b.toFixed(4)} (tol ${tol})`);
  }
}

/* ---------------- One Euro ---------------- */

test('One Euro: un segnale costante non deriva', () => {
  const f = createOneEuro2D();
  let out;
  for (let i = 0; i < 200; i++) out = f.filter(500, 300, i * 16.7);
  close(out.x, 500, 0.01, 'x deve restare 500');
  close(out.y, 300, 0.01, 'y deve restare 300');
  close(out.speed, 0, 0.5, 'la velocita deve essere nulla');
});

test('One Euro: attenua il tremolio a mano ferma', () => {
  const f = createOneEuro2D();
  let rng = 12345;
  const rnd = () => ((rng = (rng * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff - 0.5);
  let devIn = 0, devOut = 0, n = 0;
  for (let i = 0; i < 300; i++) {
    const x = 500 + rnd() * 6;                    // +-3 unita di tremolio
    const o = f.filter(x, 300, i * 16.7);
    if (i > 50) { devIn += Math.abs(x - 500); devOut += Math.abs(o.x - 500); n++; }
  }
  const ratio = (devOut / n) / (devIn / n);
  assert(ratio < 0.5, `il rumore deve almeno dimezzarsi, rapporto ${ratio.toFixed(3)}`);
});

test('One Euro: segue un gesto veloce senza restare indietro', () => {
  const f = createOneEuro2D();
  let out;
  // 1500 unita/s: il gesto rapido di un bambino
  for (let i = 0; i < 60; i++) out = f.filter(i * 25, 300, i * 16.7);
  const lag = 59 * 25 - out.x;
  assert(lag < 25, `lag di ${lag.toFixed(1)} unita, deve stare sotto un campione`);
  assert(out.speed > 800, `velocita stimata ${out.speed.toFixed(0)}, troppo bassa`);
});

test('One Euro: un gradino non produce oscillazione', () => {
  const f = createOneEuro2D();
  for (let i = 0; i < 30; i++) f.filter(100, 300, i * 16.7);
  let max = -Infinity;
  for (let i = 30; i < 120; i++) max = Math.max(max, f.filter(900, 300, i * 16.7).x);
  assert(max <= 900.001, `overshoot fino a ${max.toFixed(2)}, non deve superare il target`);
});

/*
 * I due test qui sotto sono nati da un difetto sfuggito ai precedenti: quelli
 * usavano solo moti rettilinei, dove la distorsione del filtro non si vede.
 * Su una curva il passa-basso agisce su x e y separatamente e deforma il
 * tracciato, ed e' proprio il caso della Definition of Done ("un cerchio
 * disegnato a mano libera sembra un cerchio").
 */

const cerchioFiltrato = (durataMs, params) => {
  const f = createOneEuro2D(params);
  const N = Math.round(durataMs / 18), R = 400, raggi = [];
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    const o = f.filter(800 + Math.cos(a) * R, 600 + Math.sin(a) * R, i * 18);
    raggi.push(Math.hypot(o.x - 800, o.y - 600));
  }
  const coda = raggi.slice(Math.floor(N * 0.3));    // esclusa la convergenza iniziale
  const m = coda.reduce((a, b) => a + b, 0) / coda.length;
  return {
    raggioMedio: m,
    deviazione: Math.sqrt(coda.reduce((a, v) => a + (v - m) ** 2, 0) / coda.length),
  };
};

test('One Euro: un cerchio veloce resta un cerchio', () => {
  const r = cerchioFiltrato(1000, ONE_EURO);          // ~2500 unita/s
  assert(r.deviazione < 3,
    `deviazione del raggio ${r.deviazione.toFixed(2)} unita, il cerchio si deforma`);
  close(r.raggioMedio, 400, 400 * 0.04, 'raggio medio');
});

test('One Euro: un cerchio lento resta un cerchio', () => {
  const r = cerchioFiltrato(3000, ONE_EURO);
  assert(r.deviazione < 1.5,
    `deviazione del raggio ${r.deviazione.toFixed(2)} unita`);
  close(r.raggioMedio, 400, 400 * 0.02, 'raggio medio');
});

test('One Euro: il lag su gesto veloce resta impercettibile', () => {
  const f = createOneEuro2D(ONE_EURO);
  let o;
  for (let i = 0; i < 60; i++) o = f.filter(i * 40, 600, i * 18);   // 2200 unita/s
  const lag = 59 * 40 - o.x;
  // Sopra ~2 unita il tratto comincia a staccarsi dal dito. Con beta 0.2
  // siamo abbondantemente sotto, e non costa nulla: a parita' di epsilon la
  // levigatezza del tratto non dipende da beta.
  assert(lag < 2, `lag di ${lag.toFixed(1)} unita`);
});

/* ---------------- resample ---------------- */

const linea = (n, passo) => {
  const p = [];
  for (let i = 0; i < n; i++) p.push(i * passo, 300, 1);
  return p;
};

test('resample: spaziatura costante su una retta', () => {
  const out = resample(linea(10, 29), 2.5);       // campioni radi come sul device
  assert(count(out) > 100, `attesi molti punti, ottenuti ${count(out)}`);
  for (let i = 1; i < count(out) - 1; i++) {
    const d = Math.hypot(
      out[i * STRIDE] - out[(i - 1) * STRIDE],
      out[i * STRIDE + 1] - out[(i - 1) * STRIDE + 1],
    );
    close(d, 2.5, 2.5 * 0.05, `spaziatura al punto ${i}`);
  }
});

test('resample: interpola, non decima', () => {
  const grezzo = linea(8, 29);                    // 8 punti distanti 29 unita
  const out = resample(grezzo, 2.5);
  assert(count(out) > count(grezzo) * 8,
    `da ${count(grezzo)} punti radi devono nascerne molti di piu, ottenuti ${count(out)}`);
});

test('resample: la curva passa per i punti originali', () => {
  const src = [0, 0, 1, 100, 80, 1, 200, 0, 1, 300, 80, 1];
  const out = resample(src, 1);
  for (let i = 0; i < count(src); i++) {
    const sx = src[i * STRIDE], sy = src[i * STRIDE + 1];
    let best = Infinity;
    for (let j = 0; j < count(out); j++) {
      best = Math.min(best, Math.hypot(out[j * STRIDE] - sx, out[j * STRIDE + 1] - sy));
    }
    assert(best < 1.5, `il punto ${i} dista ${best.toFixed(2)} dalla curva`);
  }
});

test('resample: conserva la lunghezza del tratto', () => {
  const src = linea(6, 40);
  const out = resample(src, 2.5);
  close(length(out), length(src), length(src) * 0.02, 'lunghezza');
});

test('resample: campioni duplicati non rompono la curva', () => {
  const src = [0, 0, 1, 50, 0, 1, 50, 0, 1, 50, 0, 1, 100, 0, 1];   // dito fermo
  const out = resample(src, 2.5);
  for (let i = 0; i < out.length; i++) {
    assert(Number.isFinite(out[i]), `valore non finito in posizione ${i}`);
  }
});

test('resample: un solo punto resta un solo punto', () => {
  assert(count(resample([10, 20, 1], 2.5)) === 1, 'un punto solo');
  assert(count(resample([], 2.5)) === 0, 'nessun punto');
});

test('resample: deterministico', () => {
  const src = [0, 0, 1, 37, 91, .8, 155, 20, .6, 210, 140, 1];
  const a = resample(src, 2.5), b = resample(src, 2.5);
  assert(a.length === b.length && a.every((v, i) => v === b[i]),
    'due chiamate devono dare lo stesso identico risultato');
});

/* ---------------- simplify (RDP) ---------------- */

test('RDP: una retta si riduce a due punti', () => {
  const out = simplify(linea(50, 10), 1.2);
  assert(count(out) === 2, `attesi 2 punti, ottenuti ${count(out)}`);
});

test('RDP: riduce molto un tratto resamplato', () => {
  const src = resample(linea(10, 29), 2.5);
  const out = simplify(src, 1.2);
  const taglio = 1 - count(out) / count(src);
  assert(taglio >= 0.6, `riduzione solo del ${(taglio * 100).toFixed(0)}%`);
});

test('RDP: errore massimo entro epsilon', () => {
  const eps = 1.2;
  const src = [];
  for (let i = 0; i <= 200; i++) src.push(i * 3, 300 + Math.sin(i / 12) * 60, 1);
  const out = simplify(src, eps);

  let peggio = 0;
  for (let i = 0; i < count(src); i++) {
    const px = src[i * STRIDE], py = src[i * STRIDE + 1];
    let best = Infinity;
    for (let j = 1; j < count(out); j++) {
      const ax = out[(j - 1) * STRIDE], ay = out[(j - 1) * STRIDE + 1];
      const bx = out[j * STRIDE], by = out[j * STRIDE + 1];
      const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
      let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
      t = Math.min(1, Math.max(0, t));
      best = Math.min(best, Math.hypot(px - (ax + t * dx), py - (ay + t * dy)));
    }
    peggio = Math.max(peggio, best);
  }
  assert(peggio <= eps + 1e-9, `errore massimo ${peggio.toFixed(3)} oltre epsilon ${eps}`);
});

test('RDP: conserva primo e ultimo punto', () => {
  const src = [];
  for (let i = 0; i <= 40; i++) src.push(i * 7, 300 + Math.sin(i / 5) * 40, 1);
  const out = simplify(src, 1.2);
  const n = count(out) - 1, m = count(src) - 1;
  close(out[0], src[0], 1e-9, 'primo x');
  close(out[n * STRIDE], src[m * STRIDE], 1e-9, 'ultimo x');
});

test('RDP: un tratto che torna su se stesso non collassa', () => {
  // andata e ritorno sulla stessa retta: gli estremi coincidono
  const src = [0, 0, 1, 50, 0, 1, 100, 0, 1, 50, 0, 1, 0, 0, 1];
  const out = simplify(src, 1.2);
  assert(count(out) >= 3, `il vertice va conservato, ottenuti ${count(out)} punti`);
});

/* ---------------- livelli di smoothing ---------------- */

/**
 * Nato da un difetto trovato provando il prototipo: i tre livelli davano lo
 * stesso risultato. Agivano solo su beta, che interviene sopra una certa
 * velocita' e a mano lenta non cambia nulla — cioe' proprio dove si guarda.
 * La leva vera e' l'epsilon della semplificazione.
 *
 * Rugosita': variazione angolare media fra segmenti consecutivi, in gradi.
 * E' cio' che l'occhio legge come "tremolante".
 */
function rugosita(pts) {
  const n = count(pts);
  let somma = 0, k = 0;
  for (let i = 1; i < n - 1; i++) {
    const a = (i - 1) * STRIDE, b = i * STRIDE, c = (i + 1) * STRIDE;
    const v1x = pts[b] - pts[a], v1y = pts[b + 1] - pts[a + 1];
    const v2x = pts[c] - pts[b], v2y = pts[c + 1] - pts[b + 1];
    const l1 = Math.hypot(v1x, v1y), l2 = Math.hypot(v2x, v2y);
    if (l1 < 1e-9 || l2 < 1e-9) continue;
    let cos = (v1x * v2x + v1y * v2y) / (l1 * l2);
    somma += Math.acos(Math.min(1, Math.max(-1, cos))) * 180 / Math.PI;
    k++;
  }
  return k ? somma / k : 0;
}

/** Un gesto ampio con sopra un tremolio di +-5 unita. */
function trattoTremolante(livello) {
  const cfg = SMOOTHING[livello];
  const f = createOneEuro2D(ONE_EURO);
  let g = 2024;
  const rnd = () => ((g = (g * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff - 0.5);
  const grezzi = [];
  for (let i = 0; i <= 100; i++) {
    const t = i / 100;
    const x = 150 + t * 1300, y = 600 + Math.sin(t * Math.PI * 2) * 250;
    const o = f.filter(x + rnd() * 10, y + rnd() * 10, i * 18);
    grezzi.push(o.x, o.y, 1);
  }
  return resample(simplify(grezzi, cfg.eps), 2.5);
}

test('smoothing: i tre livelli danno risultati nettamente diversi', () => {
  const r = {
    molto: rugosita(trattoTremolante('molto')),
    medio: rugosita(trattoTremolante('medio')),
    poco: rugosita(trattoTremolante('poco')),
  };
  assert(r.molto < r.medio && r.medio < r.poco,
    `la progressione non e' monotona: ${JSON.stringify(r)}`);
  // Senza un rapporto netto il selettore e' inutile: e' il difetto originale.
  assert(r.poco / r.molto > 4,
    `livelli troppo simili, rapporto poco/molto = ${(r.poco / r.molto).toFixed(1)}`);
});

test('smoothing: "molto" produce un tratto liscio quanto una curva pulita', () => {
  const r = rugosita(trattoTremolante('molto'));
  assert(r < 0.6, `rugosita ${r.toFixed(2)} gradi, il tremolio si vede ancora`);
});

test('smoothing: "poco" resta fedele al gesto', () => {
  // Non deve semplificare al punto da perdere la forma.
  assert(count(trattoTremolante('poco')) > count(trattoTremolante('molto')),
    'poco deve conservare piu dettaglio di molto');
});

/* ---------------- gessetto ---------------- */

/*
 * chalk.js disegna su canvas, che qui non esiste: si testa cio' che e' pura
 * aritmetica. Il resto — "sembra gesso", 60 fps — si verifica nel browser e
 * sul telefono, ed e' scritto nel README.
 */

test('gessetto: il PRNG e ripetibile dallo stesso seme', () => {
  const a = mulberry32(12345), b = mulberry32(12345);
  for (let i = 0; i < 500; i++) {
    assert(a() === b(), `divergono al passo ${i}`);
  }
});

test('gessetto: semi diversi danno sequenze diverse', () => {
  const a = mulberry32(1), b = mulberry32(2);
  let uguali = 0;
  for (let i = 0; i < 100; i++) if (a() === b()) uguali++;
  assert(uguali === 0, `${uguali} valori coincidenti su 100`);
});

test('gessetto: il PRNG resta dentro [0, 1)', () => {
  const r = mulberry32(777);
  for (let i = 0; i < 10000; i++) {
    const v = r();
    assert(v >= 0 && v < 1, `valore fuori intervallo: ${v}`);
  }
});

test('gessetto: la punta NON scala con la larghezza del tratto', () => {
  // E' l'invariante dell'effetto: se la punta seguisse la larghezza, la grana
  // e i lobi del bordo la seguirebbero con lei e il tratto grosso tornerebbe
  // a essere l'ingrandimento fotografico di quello sottile.
  assert(puntaBase(44) < puntaBase(10) * 1.6, `punta ${puntaBase(44)}: torna a scalare`);
  assert(passoTimbri(44) < passoTimbri(10) * 1.6, 'anche il passo deve restare fermo');
});

test('gessetto: il tratto sottile resta quello tarato il 31/08', () => {
  // Sotto la punta di riferimento non si affianca nulla: una impronta sola,
  // larga quanto il tratto. E' il caso su cui l'effetto e' stato tarato e non
  // deve cambiare di un pixel.
  assert(affiancate(10) === 1, `${affiancate(10)} impronte invece di una`);
  assert(puntaBase(10) === 10, `punta ${puntaBase(10)} invece di 10`);
  assert(passoTimbri(10) === 10 * 0.34, 'il passo del sottile e cambiato');
});

test('gessetto: le impronte affiancate coprono la banda senza buchi', () => {
  for (const w of [22, 44, 90]) {
    const k = affiancate(w);
    assert(k > 1, `larghezza ${w}: una impronta sola non copre la banda`);
    const lato = puntaBase(w);
    const passo = (w - lato) / (k - 1);
    assert(passo <= lato * 0.61, `larghezza ${w}: strisce distanti ${passo.toFixed(1)} su lato ${lato.toFixed(1)}`);
  }
});

test('gessetto: il passo non degenera sui tratti sottilissimi', () => {
  assert(passoTimbri(0.1) >= 2, 'un passo microscopico moltiplicherebbe i timbri');
});

test('gessetto: un tratto tipico non genera troppe impronte', () => {
  // Un tratto che attraversa la lavagna. Il costo e' il PRODOTTO fra punti
  // lungo la curva e impronte affiancate: e' quello che va tenuto a bada.
  const pts = [];
  for (let i = 0; i <= 6; i++) pts.push(100 + i * 230, 600, 1);
  for (const [w, tetto] of [[16, 900], [28, 1300], [44, 1700], [90, 900]]) {
    const punti = count(resample(pts, passoTimbri(w)));
    const impronte = punti * affiancate(w);
    assert(impronte < tetto, `larghezza ${w}: ${impronte} impronte, oltre il tetto di ${tetto}`);
    assert(punti > 80, `larghezza ${w}: ${punti} punti, troppo pochi: comparirebbero buchi`);
  }
});

/*
 * La compensazione della frangia e l'attenuazione a radice degli strati sono
 * state tolte il 15/09/2026: alzavano l'opacita' ovunque e il tratto smetteva
 * di sembrare gesso. Resta sotto test cio' che deve valere comunque.
 */

test('larghezza: la banda segue la larghezza nominale', () => {
  for (const { w } of WIDTHS) {
    close(bandaEffettiva(w), w, 1e-9, `spessore ${w} a pressione piena`);
  }
});

test('larghezza: la pressione modula il tratto senza stravolgerlo', () => {
  // Il cliente ha chiesto una variazione DEL 20% sulla larghezza vista, non
  // un tetto: a 13% il tratto sembra uniforme e la pressione non si legge.
  // Le leve sono due, geometria e opacita, e si sommano in modo non ovvio:
  // vanno mosse insieme. Qui si controlla solo che restino nella finestra
  // tarata misurando — il valore reso si verifica nel browser.
  assert(PRESSURE_MIN >= 0.80 && PRESSURE_MIN <= 0.90,
    `PRESSURE_MIN ${PRESSURE_MIN} fuori dalla finestra tarata`);
  assert(PRESSURE_ALPHA_MIN >= 0.78 && PRESSURE_ALPHA_MIN <= 0.92,
    `PRESSURE_ALPHA_MIN ${PRESSURE_ALPHA_MIN} fuori dalla finestra tarata`);

  for (const { w, id } of WIDTHS) {
    const rapporto = bandaEffettiva(w, 0) / bandaEffettiva(w, 1);
    assert(rapporto <= 0.97, `${id}: la pressione non si vede piu'`);
  }
});

test('larghezza: i tre spessori restano distinguibili', () => {
  // Le bande RESE misurate sono 24 / 34 / 58, con rapporti 1,42x e 1,71x:
  // la frangia aggiunge una quota quasi fissa, quindi i nominali stanno piu'
  // vicini fra loro di quanto appaiano. Sotto 1,25x due pulsanti diversi
  // darebbero pero' lo stesso tratto.
  const b = WIDTHS.map(({ w }) => bandaEffettiva(w));
  for (let i = 1; i < b.length; i++) {
    const passo = b[i] / b[i - 1];
    assert(passo > 1.25,
      `passo ${passo.toFixed(2)}x fra ${WIDTHS[i - 1].id} e ${WIDTHS[i].id}: troppo vicini`);
  }
});

/* ---------------- pipeline ---------------- */

test('pipeline: dopo filtro, RDP e resample il tratto resta fedele', () => {
  const f = createOneEuro2D();
  const grezzo = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const o = f.filter(200 + t * 1000, 300 + Math.sin(t * Math.PI * 2) * 200, i * 18);
    grezzo.push(o.x, o.y, 1);
  }
  const finale = resample(simplify(grezzo, 1.2), 2.5);
  close(length(finale), length(grezzo), length(grezzo) * 0.05, 'lunghezza dopo la pipeline');
});

/* ---------------- export ---------------- */

test('export: il nome del file porta data e ora, e finisce in .jpg', () => {
  const n = nomeFile(new Date(2026, 8, 16, 7, 5));
  assert(n === 'lavagna-20260916-0705.jpg', `nome inatteso: ${n}`);
});

test('export: una lavagna di sole gommate non e un disegno', () => {
  const gomma = { tool: 'eraser' };
  assert(haDisegno({ strokes: [] }) === false, 'vuota');
  assert(haDisegno({ strokes: [gomma, gomma] }) === false, 'solo gommate');
  assert(haDisegno({ strokes: [gomma, { tool: 'chalk' }] }) === true, 'un gessetto basta');
});

test('export: l immagine e larga 1600 e tiene il rapporto della lavagna', () => {
  // 4:3 e il caso nominale, ma la lavagna prende il rapporto dello schermo
  // (Fase 4): l'export deve seguirlo, non imporre il 4:3.
  const quattroTerzi = dimensioni({ board: { w: 1600, h: 1200 } });
  assert(quattroTerzi.w === EXPORT_W && quattroTerzi.h === 1200, `4:3 -> ${quattroTerzi.w}x${quattroTerzi.h}`);

  const telefono = dimensioni({ board: { w: 1600, h: 3462 } });
  assert(telefono.w === EXPORT_W && telefono.h === 3462, `telefono -> ${telefono.w}x${telefono.h}`);

  // E qualunque larghezza si chieda, il rapporto non cambia.
  const meta = dimensioni({ board: { w: 1600, h: 1200 } }, 800);
  close(meta.w / meta.h, 4 / 3, 0.002, 'rapporto a meta risoluzione');
});

test('export: il logo ha due misure, e la soglia e quella degli strumenti', () => {
  // La soglia e' la stessa che raddoppia gli strumenti (SOGLIA_STRETTA = 700):
  // se qualcuno la spostasse per un motivo solo, i due comportamenti
  // divergerebbero senza che nulla lo segnali.
  assert(larghezzaLogo(390) === LOGO_W_STRETTA, 'telefono in verticale');
  assert(larghezzaLogo(699) === LOGO_W_STRETTA, 'appena sotto la soglia');
  assert(larghezzaLogo(700) === LOGO_W_LARGA, 'sulla soglia e gia largo');
  assert(larghezzaLogo(1440) === LOGO_W_LARGA, 'desktop');

  // "1/3 vw": su telefono la lavagna e' larga quanto il viewport.
  assert(LOGO_W_STRETTA === 533, `un terzo di 1600 -> ${LOGO_W_STRETTA}`);
  assert(LOGO_W_LARGA === 220, `desktop -> ${LOGO_W_LARGA}`);
});

test('export: il logo sta nell angolo e non si deforma', () => {
  // 512x451, il file reale.
  const r = rettangoloLogo(LOGO_W_LARGA, 512 / 451);
  assert(r.x === LOGO_MARGINE && r.y === LOGO_MARGINE, `angolo -> ${r.x},${r.y}`);
  assert(r.w === LOGO_W_LARGA, `larghezza -> ${r.w}`);
  close(r.w / r.h, 512 / 451, 0.001, 'rapporto del logo');

  // Il rettangolo sta dentro la lavagna anche nel caso piu' largo.
  const m = rettangoloLogo(LOGO_W_STRETTA, 512 / 451);
  assert(m.x + m.w < 1600, `sfora a destra: ${m.x + m.w}`);
});

/* ---------------- tutorial ---------------- */

const rect = (left, top, w, h) => ({ left, top, right: left + w, bottom: top + h });

test('tutorial: i sette passi puntano a elementi che esistono nella mensola', () => {
  // Non c'e' DOM qui: si controlla che i selettori siano quelli scritti in
  // index.html. Se qualcuno rinomina un id, il tutorial punterebbe al vuoto.
  const attesi = ['#layers', '#chalks', '#widths .wbtn i', '#tool-eraser',
                  '#btn-undo', '#btn-clear', '#btn-save'];
  assert(STEPS.length === 7, `${STEPS.length} passi invece di 7`);
  STEPS.forEach((s, i) => assert(s.sel === attesi[i], `passo ${i + 1}: ${s.sel}`));
  for (const s of STEPS) assert(s.testo.trim().length > 0, 'un passo senza testo');
});

test('tutorial: il primo passo dice "dito" sul dito e "mouse" col mouse', () => {
  // Il segnaposto ha gia' cambiato posto due volte nella frase: si controlla
  // che la parola ci sia, non dove sta.
  assert(testoStep(0, true).includes('dito'), testoStep(0, true));
  assert(testoStep(0, false).includes('mouse'), testoStep(0, false));
  assert(!testoStep(0, true).includes('mouse'), 'sul dito non deve comparire il mouse');
  assert(!testoStep(0, false).includes('dito'), 'col mouse non deve comparire il dito');
  // Nessun altro passo cambia col device: un {cosa} dimenticato resterebbe
  // in chiaro nel testo mostrato al bambino.
  for (let i = 1; i < STEPS.length; i++) {
    assert(!testoStep(i, true).includes('{'), `passo ${i + 1}: segnaposto non sostituito`);
  }
});

test('tutorial: il riquadro racchiude tutti gli elementi del passo', () => {
  // Annulla e rifai sono due pulsanti ma un concetto: il riquadro e' uno.
  const a = areaUnione([rect(100, 700, 40, 40), rect(160, 700, 40, 40)], 8);
  assert(a.left === 92 && a.top === 692, `angolo ${a.left},${a.top}`);
  assert(a.width === 116 && a.height === 56, `misure ${a.width}x${a.height}`);

  // pad negativo stringe: serve alla lavagna, il cui bordo e' lo schermo.
  const b = areaUnione([rect(0, 0, 390, 600)], -10);
  assert(b.left === 10 && b.width === 370, `pad negativo: ${b.left}, ${b.width}`);

  assert(areaUnione([]) === null, 'lista vuota deve dare null, non un crash');
  assert(areaUnione(null) === null, 'null deve dare null');
});

test('tutorial: la finestra non copre mai l area in luce', () => {
  const H = 844, ph = 180;
  const sovrappone = (area, top) => !(top + ph <= area.top || top >= area.top + area.height);

  // I sette casi veri, misurati sulla prova di design a 390x844.
  const aree = [
    { left: 10, top: 10, width: 370, height: 592 },   // lavagna
    { left: 4, top: 610, width: 314, height: 98 },    // gessetti
    { left: 4, top: 698, width: 166, height: 80 },    // spessori
    { left: 312, top: 610, width: 73, height: 98 },   // cancellino
    { left: 222, top: 708, width: 104, height: 60 },  // annulla/rifai
    { left: 326, top: 708, width: 60, height: 60 },   // cestino
    { left: 4, top: 772, width: 382, height: 64 },    // salva
  ];
  aree.forEach((area, i) => {
    const top = posizionaFinestra(area, H, ph);
    assert(!sovrappone(area, top), `passo ${i + 1}: la finestra copre l area (top ${top})`);
    assert(top >= 0 && top + ph <= H, `passo ${i + 1}: finestra fuori schermo (top ${top})`);
  });
});

test('tutorial: con poco spazio la finestra resta comunque a vista', () => {
  // Telefono corto e area che occupa quasi tutto: la finestra non puo' stare
  // fuori dall'area, ma deve almeno restare dentro lo schermo.
  const top = posizionaFinestra({ left: 0, top: 20, width: 390, height: 500 }, 560, 200);
  assert(top >= 0 && top + 200 <= 560, `top ${top} fuori da uno schermo di 560`);
});

test('tutorial: il "gia visto" sopravvive, e un localStorage rotto non lo ferma', () => {
  const finto = new Map();
  const store = { getItem: (k) => (finto.has(k) ? finto.get(k) : null), setItem: (k, v) => finto.set(k, v) };
  const p = '/temp/frmm-drawing-plugin-04/';
  assert(giaVisto(store, p) === false, 'al primo avvio non e visto');
  assert(segnaVisto(store, p) === true, 'la scrittura deve riuscire');
  assert(giaVisto(store, p) === true, 'dopo la scrittura e visto');
  assert(finto.get(chiaveVisto(p)) === '1', 'la chiave scritta non e quella attesa');

  // In Safari privato il solo accesso lancia: senza la guardia il modulo
  // morirebbe all'avvio e la lavagna non si aprirebbe affatto.
  const rotto = { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('SecurityError'); } };
  assert(giaVisto(rotto, p) === false, 'con lo storage rotto deve dire "non visto"');
  assert(segnaVisto(rotto, p) === false, 'e dire che non ha potuto scrivere');
});

test('tutorial: due versioni pubblicate non si rubano il "gia visto"', () => {
  // localStorage e' per ORIGINE, non per cartella: tutte le versioni sotto
  // issimissimo.com/temp/ condividono l'archivio. Con una chiave fissa,
  // chiudere il tutorial sulla -03 lo faceva sparire dalla -04, cioe' proprio
  // dalla versione da provare. Succeduto il 17/09/2026.
  const finto = new Map();
  const store = { getItem: (k) => (finto.has(k) ? finto.get(k) : null), setItem: (k, v) => finto.set(k, v) };
  const v3 = '/temp/frmm-drawing-plugin-03/';
  const v4 = '/temp/frmm-drawing-plugin-04/';

  segnaVisto(store, v3);
  assert(giaVisto(store, v3) === true, 'la -03 deve restare "vista"');
  assert(giaVisto(store, v4) === false, 'la -04 non deve ereditare il flag della -03');

  assert(chiaveVisto(v3) !== chiaveVisto(v4), 'due percorsi, due chiavi');
  assert(chiaveVisto(v3).startsWith(CHIAVE_VISTO), 'il prefisso deve restare riconoscibile');
});


/* ---------------- il rapporto della lavagna ---------------- */

test('lavagna: il rapporto si congela al primo layout e non cambia piu', () => {
  freezeBoardHeight(BOARD_W / 1200);     // riporta a 4:3 se qualcuno l'ha mosso
  unfreezeBoardHeight();
  freezeBoardHeight(16 / 10);
  const primo = boardHeight();
  freezeBoardHeight(1 / 1);              // un secondo tentativo non deve passare
  assert(boardHeight() === primo, 'il rapporto congelato non si tocca: deformerebbe i tratti');
});

test('lavagna: a lavagna vuota il rapporto si puo ricongelare', () => {
  // E' il caso di WordPress: il contenitore prende l'altezza definitiva un
  // istante dopo l'avvio, e il primo layout rischia di congelare un rapporto
  // sbagliato. Finche' non c'e' un tratto, non c'e' niente da proteggere.
  unfreezeBoardHeight();
  freezeBoardHeight(390 / 608);          // l'altezza sbagliata, coi 65px di troppo
  const storto = boardHeight();
  unfreezeBoardHeight();
  freezeBoardHeight(390 / 501);          // quella vera
  assert(boardHeight() !== storto, 'dopo unfreeze il rapporto deve poter cambiare');

  const atteso = Math.round(BOARD_W / (390 / 501));
  assert(boardHeight() === atteso, `atteso ${atteso}, trovato ${boardHeight()}`);

  unfreezeBoardHeight();
  freezeBoardHeight(BOARD_W / 1200);     // gli altri test ripartono dal 4:3
});

test('lavagna: un rapporto assurdo non viene accettato', () => {
  unfreezeBoardHeight();
  freezeBoardHeight(BOARD_W / 1200);
  const buono = boardHeight();
  unfreezeBoardHeight();
  freezeBoardHeight(0);                  // capita: contenitore ad altezza zero
  assert(boardHeight() === buono, 'un aspect non positivo si ignora, non azzera la lavagna');
  unfreezeBoardHeight();
  freezeBoardHeight(BOARD_W / 1200);
});

/* ---------------- invio ---------------- */

const finto = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), m }; };
const UUID4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test('invio: il client_id e un UUID v4 e resta lo stesso', () => {
  const st = finto();
  const a = clientId(st);
  assert(UUID4.test(a), `non e un UUID v4: ${a}`);
  assert(clientId(st) === a, 'la seconda chiamata deve restituire lo stesso id');
  assert(st.m.get(CHIAVE_CLIENT) === a, 'va salvato sotto la chiave dichiarata');
});

test('invio: il client_id e un UUID v4 anche senza randomUUID', () => {
  const c = { getRandomValues: (b) => globalThis.crypto.getRandomValues(b) };
  assert(UUID4.test(clientId(finto(), c)), 'il ripiego su getRandomValues deve dare un v4');
});

test('invio: la chiave del client_id non contiene il percorso', () => {
  // Al contrario del tutorial: identifica il dispositivo, non la pagina.
  assert(!CHIAVE_CLIENT.includes('/'), CHIAVE_CLIENT);
});

test('invio: senza storage il client_id vive in memoria', () => {
  const rotto = { getItem() { throw new Error('privato'); }, setItem() { throw new Error('privato'); } };
  const a = clientId(rotto);
  assert(UUID4.test(a) && clientId(rotto) === a, 'stesso id per tutta la sessione');
});

test("invio: l'endpoint si accetta solo dalla stessa origine", () => {
  const o = 'https://sito.org';
  const u = encodeURIComponent('https://sito.org/wp-json/frmm-lavagna/v1/invio');
  assert(endpointInvio(`?v=1&invio=${u}`, o) === 'https://sito.org/wp-json/frmm-lavagna/v1/invio', 'stessa origine');
  const warn = console.warn; console.warn = () => {};
  try {
    assert(endpointInvio(`?invio=${encodeURIComponent('https://altro.org/x')}`, o) === null, 'altra origine');
    assert(endpointInvio(`?invio=${encodeURIComponent('http://sito.org/x')}`, o) === null, 'altro schema');
  } finally { console.warn = warn; }
  assert(endpointInvio('?invio=non-un-url', o) === null, 'non URL');
  assert(endpointInvio('?v=1', o) === null, 'assente');
});

test('invio: il payload arrotonda i punti e non tocca il disegno', () => {
  const d = { version: 1, board: { w: 1600, h: 1200 },
    strokes: [{ id: 3, tool: 'chalk', color: '#FAF8F3', width: 27, seed: 5, pts: [1.23456, 2.98765, 0.8412345] }] };
  const p = payloadDisegno(d);
  assert(JSON.stringify(p.strokes[0].pts) === '[1.23,2.99,0.84]', JSON.stringify(p.strokes[0].pts));
  assert(d.strokes[0].pts[0] === 1.23456, 'il Drawing originale non va arrotondato');
  assert(p.board.h === 1200 && p.strokes[0].seed === 5, "il resto passa com'e");
});

test('invio: la firma cambia con un tratto nuovo anche dopo un annulla', () => {
  const d = { strokes: [{ id: 1 }, { id: 2 }] };
  const a = firma(d);
  d.strokes.pop(); d.strokes.push({ id: 3 });
  assert(firma(d) !== a, 'stesso numero di tratti, ultimo diverso');
  assert(firma({ strokes: [] }) === '0:0', 'lavagna vuota');
});

test('invio: gli status dicono se riprovare', () => {
  const m = [[201, 'fatto'], [200, 'fatto'], [413, 'grande'], [429, 'troppi'], [0, 'rete'],
             [400, 'rifiutato'], [415, 'rifiutato'], [500, 'server'], [503, 'server']];
  for (const [st, atteso] of m) assert(motivoDaStatus(st) === atteso, `${st} -> ${motivoDaStatus(st)}`);
});

const disegnoProva = () => ({ version: 1, board: { w: 1600, h: 1200 },
  strokes: [{ id: 1, tool: 'chalk', color: '#FAF8F3', width: 27, seed: 1, pts: [1, 2, 1] }] });
const voceProva = { cid: 'c', invioId: 'i', tentativo: 2, disegno: '{}', jpeg: new Blob(['jpg'], { type: 'image/jpeg' }) };

test('invio: una voce parte con i cinque campi, anonima', async () => {
  let visto = null;
  const esito = await inviaVoce('https://sito.org/x', voceProva, {
    fetchImpl: async (url, o) => { visto = o; return { status: 201 }; },
  });
  assert(esito === 'fatto', esito);
  assert(visto.method === 'POST' && visto.credentials === 'omit', 'POST senza cookie');
  const b = visto.body;
  assert(b.get('client_id') === 'c' && b.get('invio_id') === 'i' && b.get('tentativo') === '2', 'campi');
  assert(b.get('immagine').name === 'disegno.jpg', 'immagine');
});

test('invio: una fetch che fallisce e "rete", non una eccezione', async () => {
  const esito = await inviaVoce('x', voceProva, { fetchImpl: async () => { throw new TypeError('offline'); } });
  assert(esito === 'rete', esito);
});

test('invio: una risposta che non arriva scade', async () => {
  const esito = await inviaVoce('x', voceProva, {
    attesa: 20,
    fetchImpl: (u, o) => new Promise((_, no) => o.signal.addEventListener('abort', () => no(new Error('abort')))),
  });
  assert(esito === 'rete', esito);
});

/** Una coda con rete, timer ed eventi finti: si comanda tutto a mano. */
function codaProva(esiti) {
  const inviati = [];
  const timer = [];
  const doc = new EventTarget(); doc.visibilityState = 'hidden';
  const win = new EventTarget();
  const coda = createCoda({
    url: 'x',
    cid: () => 'c',
    invia: async (u, v) => { inviati.push({ ...v }); return esiti.shift() ?? 'fatto'; },
    pianifica: (fn, ms) => { const t = { fn, ms, vivo: true }; timer.push(t); return () => { t.vivo = false; }; },
    documento: doc, finestra: win,
  });
  const torna = async () => { doc.visibilityState = 'visible'; doc.dispatchEvent(new Event('visibilitychange')); await tick(); };
  return { coda, inviati, timer, doc, win, torna };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

// La coda avvisa in console quando lascia perdere un invio: nei test e' il
// comportamento atteso, non rumore da leggere. I test asincroni girano in
// parallelo, quindi la console si zittisce una volta per tutti e torna alla
// fine (vedi in fondo), non test per test.
const warnOriginale = console.warn;
console.warn = () => {};

test('coda: un invio riuscito esce dalla coda', async () => {
  const c = codaProva(['fatto']);
  await c.coda.aggiungi(disegnoProva(), () => new Blob(['j']));
  assert(c.inviati.length === 1 && c.coda.lunghezza === 0, `${c.inviati.length} / ${c.coda.lunghezza}`);
  assert(c.inviati[0].tentativo === 1, 'primo tentativo = 1');
});

test('coda: se la rete manca si riprova al ritorno nel browser, con lo stesso invio_id', async () => {
  const c = codaProva(['rete', 'fatto']);
  await c.coda.aggiungi(disegnoProva(), () => new Blob(['j']));
  assert(c.coda.lunghezza === 1, 'resta in coda');
  assert(c.timer.length === 1 && c.timer[0].vivo, 'e c\'e\' una ripresa a tempo');
  await c.torna();
  assert(c.inviati.length === 2 && c.coda.lunghezza === 0, `${c.inviati.length} / ${c.coda.lunghezza}`);
  assert(c.inviati[1].invioId === c.inviati[0].invioId, 'stesso invio_id: il server riconosce il doppione');
  assert(c.inviati[1].tentativo === 2, 'tentativo 2');
  assert(!c.timer[0].vivo, 'la ripresa a tempo si annulla');
});

test('coda: si riprova anche quando torna la rete, e a tempo', async () => {
  const c = codaProva(['rete', 'server', 'fatto']);
  await c.coda.aggiungi(disegnoProva(), () => new Blob(['j']));
  c.win.dispatchEvent(new Event('online')); await tick();
  assert(c.inviati.length === 2, 'online');
  c.timer[c.timer.length - 1].fn(); await tick();
  assert(c.inviati.length === 3 && c.coda.lunghezza === 0, 'a tempo');
  assert(c.timer[1].ms > c.timer[0].ms, 'attese crescenti');
});

test('coda: 413 e 429 non si riprovano', async () => {
  const c = codaProva(['troppi', 'grande']);
  await c.coda.aggiungi(disegnoProva(), () => new Blob(['j']));
  await c.coda.aggiungi(disegnoProva(), () => new Blob(['j']));
  assert(c.inviati.length === 2 && c.coda.lunghezza === 0 && c.timer.length === 0, 'lasciati perdere');
});

test('coda: dopo MAX_TENTATIVI si lascia perdere', async () => {
  const c = codaProva(Array(20).fill('rete'));
  await c.coda.aggiungi(disegnoProva(), () => new Blob(['j']));
  for (let i = 0; i < 10; i++) { c.doc.visibilityState = 'hidden'; await c.torna(); }
  assert(c.inviati.length === MAX_TENTATIVI && c.coda.lunghezza === 0, `${c.inviati.length} tentativi`);
});

test('coda: la fotografia del disegno si fa al tocco', async () => {
  const c = codaProva(['rete', 'fatto']);
  const d = disegnoProva();
  await c.coda.aggiungi(d, () => new Blob(['j']));
  d.strokes.push({ id: 2, tool: 'chalk', color: '#FAF8F3', width: 27, seed: 2, pts: [5, 5, 1] });
  await c.torna();
  assert(JSON.parse(c.inviati[1].disegno).strokes.length === 1, 'parte quel che si era scelto, non il dopo');
});

test('coda: oltre il tetto il piu vecchio si lascia andare', async () => {
  const c = codaProva(Array(20).fill('rete'));
  for (let i = 0; i < MAX_CODA + 2; i++) await c.coda.aggiungi(disegnoProva(), () => new Blob(['j']));
  assert(c.coda.lunghezza === MAX_CODA, `${c.coda.lunghezza}`);
});

test('lavagna: il Drawing vuoto segue il rapporto nuovo, quello pieno no', () => {
  unfreezeBoardHeight(); freezeBoardHeight(BOARD_W / 1200);
  const d = createDrawing();
  unfreezeBoardHeight(); freezeBoardHeight(390 / 501);
  assert(adattaLavagna(d) && d.board.h === boardHeight(), `vuoto: ${d.board.h} vs ${boardHeight()}`);
  d.strokes.push({ id: 1 });
  const h = d.board.h;
  unfreezeBoardHeight(); freezeBoardHeight(BOARD_W / 1200);
  assert(!adattaLavagna(d) && d.board.h === h, 'con un tratto non si tocca');
  unfreezeBoardHeight(); freezeBoardHeight(BOARD_W / 1200);
});

/* ---------------- esito ---------------- */

await Promise.all(inSospeso);
console.warn = warnOriginale;

const w = Math.max(...results.map((r) => r[1].length));
for (const [esito, nome, msg] of results) {
  console.log(`  ${esito}  ${nome.padEnd(w)}  ${msg}`);
}
console.log(`\n  ${passed} passati, ${failed} falliti\n`);
process.exit(failed ? 1 : 0);
