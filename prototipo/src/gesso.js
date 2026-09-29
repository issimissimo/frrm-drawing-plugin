/**
 * Il gesso che attacca alla lavagna.
 *
 * chalk.js timbra il tratto con impronte che hanno la grana DENTRO. Funziona
 * finche' le impronte non si sovrappongono troppo — ma si sovrappongono una
 * decina per punto, e ogni grana fine si media via: per questo le macchie di
 * chalk.js sono larghe e il risultato legge come pastello morbido. Nei
 * riempimenti la grana sparisce del tutto.
 *
 * Nel gesso vero la grana e' della SUPERFICIE: il gesso resta sulle creste
 * della lavagna e salta le valli, e le valli sono sempre nello stesso posto.
 * Per questo resta fine e contrastata anche dopo dieci passate.
 *
 * Qui si fa lo stesso, in tre passi e tutto in GPU (niente getImageData, che
 * su Safari costringerebbe a riportare i pixel dalla GPU a ogni frame):
 *
 *   1. DEPOSITO   il tratto si timbra come prima, in bianco, su un canvas
 *                 d'appoggio: e' "quanto gesso e' arrivato" in ogni punto.
 *   2. CRESTE     destination-in con la trama della lavagna: deposito x cresta.
 *   3. SOGLIA     il risultato si somma a se stesso in 'lighter', cioe'
 *                 min(1, g * deposito * cresta). Dove il prodotto supera 1/g
 *                 il gesso e' pieno, sotto resta un velo. Canvas 2D non ha una
 *                 soglia vera: questa ne e' l'approssimazione che si puo' fare
 *                 senza leggere i pixel.
 *
 * Poi si colora (source-in) e si compone sul livello di destinazione.
 *
 * Ne vengono il bordo rosicchiato invece che sfumato, i puntini ad alto
 * contrasto invece del grigio, i riempimenti che restano porosi. E, gratis:
 * la grana dominante non dipende piu' dalla sequenza dei timbri, quindi dopo
 * annulla o resize il tratto ridisegnato cambia molto meno di prima.
 *
 * La trama e' in UNITA' DI LAVAGNA e ancorata all'origine: stesso punto della
 * lavagna, stessa cresta, a qualunque risoluzione. E' la condizione perche'
 * resti vero D1 — lo stesso Drawing da' la stessa immagine a scale diverse.
 */

import { timbra, mulberry32 } from './chalk.js';
import { count } from './geom.js';
import { GESSO, PRESSURE_MIN } from './palette.js';

/** Come timbra(): la pressione stringe la banda fino a PRESSURE_MIN. */
const PRESSIONE_BANDA = (p) => PRESSURE_MIN + (1 - PRESSURE_MIN) * p;

/* --- La trama della lavagna ------------------------------------------------ */

/**
 * Lato della tessera che si ripete, in unita' di lavagna. Sulla lavagna larga
 * 1600 si ripete poco piu' di tre volte: abbastanza grande perche' la
 * ripetizione non si legga dentro un riempimento, abbastanza piccola da
 * generarla in qualche decina di millisecondi anche a DPR 2.
 */
export const TRAMA = 512;

/**
 * Le ottave della trama: lato della cella in unita' di lavagna e peso.
 * Ogni lato divide TRAMA, cosi' la tessera si ripete senza cucitura.
 *
 *   1   il pulviscolo: a DPR 1 e' un pixel, sul telefono si media in velo
 *   2   la grana vera, il puntinato che si vede nelle foto
 *   4   la tiene insieme in grumi, altrimenti e' rumore televisivo
 *  16   zone dove la lavagna "prende" meglio o peggio
 *  64   usura: un velo appena percettibile
 */
export const OTTAVE = [
  { cella: 1, peso: 0.22 },
  { cella: 2, peso: 0.30 },
  { cella: 4, peso: 0.24 },
  { cella: 16, peso: 0.15 },
  { cella: 64, peso: 0.09 },
];

/** Hash intero -> [0, 1). Deterministico, senza stato. */
function hash(x, y, o) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(o + 1, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Il reticolo di un'ottava, calcolato una volta sola. */
const reticoli = OTTAVE.map(({ cella }, o) => {
  const n = TRAMA / cella;
  const r = new Float32Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) r[y * n + x] = hash(x, y, o);
  return { n, cella, r };
});

const liscia = (t) => t * t * (3 - 2 * t);

/**
 * Altezza grezza della lavagna nel punto (u, v), in unita' di lavagna.
 * Periodica su TRAMA in entrambe le direzioni. Media ~0,5, poco dispersa:
 * e' una somma di ottave, quindi il contrasto lo da' `cresta()`.
 */
export function altezza(u, v) {
  let h = 0;
  for (let o = 0; o < reticoli.length; o++) {
    const { n, cella, r } = reticoli[o];
    const gx = u / cella, gy = v / cella;
    const x0 = Math.floor(gx), y0 = Math.floor(gy);
    const fx = liscia(gx - x0), fy = liscia(gy - y0);
    const xa = ((x0 % n) + n) % n, ya = ((y0 % n) + n) % n;
    const xb = (xa + 1) % n, yb = (ya + 1) % n;
    const a = r[ya * n + xa], b = r[ya * n + xb];
    const c = r[yb * n + xa], d = r[yb * n + xb];
    const top = a + (b - a) * fx, bot = c + (d - c) * fx;
    h += OTTAVE[o].peso * (top + (bot - top) * fy);
  }
  return h;
}

/**
 * Quanto il punto (u, v) trattiene il gesso: 0 valle, 1 cresta.
 *
 * Il contrasto e' la leva principale dell'effetto. Una trama morbida da'
 * l'aspetto del pastello su carta; il gesso su lavagna e' quasi binario —
 * gesso pieno o lavagna nuda, con pochi toni in mezzo.
 */
export function cresta(u, v) {
  const t = (altezza(u, v) - GESSO.valle) / (GESSO.picco - GESSO.valle);
  return liscia(Math.min(1, Math.max(0, t)));
}

/**
 * Le tessere gia' generate, per lato in pixel e taratura. Condivise fra tutti
 * i canvas d'appoggio: la stessa scala sullo schermo e nell'export e' la
 * stessa tessera, e generarla costa (a DPR 2 qualche decina di ms).
 */
const tessere = new Map();

const chiaveTessera = (k) =>
  `${Math.max(1, Math.round(TRAMA * k))}:${GESSO.valle}:${GESSO.picco}`;

function tesseraPer(k) {
  const chiave = chiaveTessera(k);
  let t = tessere.get(chiave);
  if (!t) {
    // Poche voci — schermo ed export — ma senza tetto crescerebbe a ogni
    // resize della finestra.
    if (tessere.size >= 4) tessere.delete(tessere.keys().next().value);
    t = tessera(k);
    tessere.set(chiave, t);
  }
  return t;
}

/**
 * La tessera renderizzata a `k` pixel per unita' di lavagna. Si campiona al
 * centro di ogni pixel, quindi a risoluzioni diverse la trama e' la stessa,
 * campionata piu' o meno fitta.
 */
function tessera(k) {
  const lato = Math.max(1, Math.round(TRAMA * k));
  const cv = document.createElement('canvas');
  cv.width = cv.height = lato;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(lato, lato);
  const d = img.data;
  const passo = TRAMA / lato;
  for (let y = 0; y < lato; y++) {
    const v = (y + 0.5) * passo;
    for (let x = 0; x < lato; x++) {
      const i = (y * lato + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = 255;
      d[i + 3] = Math.round(cresta((x + 0.5) * passo, v) * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

/* --- Il canvas d'appoggio -------------------------------------------------- */

/**
 * Tre canvas d'appoggio per ogni misura di destinazione: lo schermo ne ha
 * una, l'export un'altra. Poche voci, ma una mappa senza tetto crescerebbe a
 * ogni resize della finestra.
 *
 * Pesano: tre canvas grandi quanto la lavagna, cioe' ~14 MB su un telefono a
 * DPR 2 e ~60 MB su un desktop a DPR 2. E' il prezzo delle passate in GPU.
 */
const appoggi = new Map();
const MAX_APPOGGI = 3;

function appoggio(w, h) {
  const chiave = `${w}x${h}`;
  let a = appoggi.get(chiave);
  if (a) return a;
  const nuovo = () => {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    return cv.getContext('2d');
  };
  a = { dep: nuovo(), aux: nuovo(), fin: nuovo(), pattern: new Map() };
  if (appoggi.size >= MAX_APPOGGI) appoggi.delete(appoggi.keys().next().value);
  appoggi.set(chiave, a);
  return a;
}

/**
 * Il pattern della trama per il contesto `ctx`, a `k` pixel per unita'.
 * Il pattern si disegna nello spazio utente — gia' in unita' di lavagna — e
 * la sua trasformazione riporta la tessera da pixel a unita': cosi' e'
 * ancorato alla lavagna, non allo schermo.
 */
function patternTrama(a, ctx, k) {
  // Valle e picco nella chiave: la pagina di confronto li muove dal vivo.
  const chiave = chiaveTessera(k);
  let p = a.pattern.get(chiave);
  if (p) return p;
  const t = tesseraPer(k);
  p = ctx.createPattern(t, 'repeat');
  const s = TRAMA / t.width;
  p.setTransform(new DOMMatrix([s, 0, 0, s, 0, 0]));
  if (a.pattern.size >= 4) a.pattern.delete(a.pattern.keys().next().value);
  a.pattern.set(chiave, p);
  return p;
}

/**
 * Genera in anticipo la tessera per la scala `k`. La chiama main.js a ogni
 * layout: senza, la prima tessera si genererebbe al primo tocco, e a DPR 2
 * sono qualche decina di millisecondi proprio sul primo tratto.
 */
export const precaricaTrama = (k) => { tesseraPer(k); };

/* --- Il tratto ------------------------------------------------------------- */

/**
 * Le striature: linee sottili parallele al gesto, dove la punta del gessetto
 * deposita di piu'. Fra una e l'altra il deposito resta piu' basso, ed e'
 * quello che si legge come solco.
 *
 * Nel gesso largo sono la cosa che si nota per prima (vedi la barra del "%"
 * nella foto di riferimento), e le impronte affiancate di chalk.js non
 * riescono a farle: ogni impronta e' larga il doppio della distanza fra le
 * corsie e le corsie si fondono. Provato il 29/09/2026 a stringerle (punta 8,
 * sei corsie): il doppio dei timbri, e le striature non si vedevano comunque.
 *
 * Una linea tracciata e' coerente per tutta la lunghezza del tratto come un
 * solco vero, e costa uno stroke() invece di centinaia di drawImage. Il
 * tratteggio a lunghezze casuali le fa nascere e morire lungo il gesto: una
 * riga continua da un capo all'altro sembrerebbe tirata col righello.
 *
 * Solo in aggiunta, mai in sottrazione. Provati il 29/09/2026 anche i solchi
 * in destination-out: toglievano il gesso lasciato dallo STESSO tratto alle
 * passate precedenti, e nei riempimenti a scarabocchio diventavano graffi.
 *
 * Deterministiche dal seme dello stroke, come tutto il resto (D1).
 */
function striature(ctx, pts, width, seed) {
  const n = pts.length / 3;
  if (n < 2 || GESSO.strie <= 0) return;
  const r = mulberry32((seed ^ 0x51A7E) >>> 0);

  // Le normali una volta sola, per tutte le linee.
  const nx = new Float32Array(n), ny = new Float32Array(n), sc = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = i === 0 ? 0 : i - 1, b = i === n - 1 ? i : i + 1;
    const tx = pts[b * 3] - pts[a * 3], ty = pts[b * 3 + 1] - pts[a * 3 + 1];
    const len = Math.hypot(tx, ty) || 1;
    nx[i] = -ty / len; ny[i] = tx / len;
    // Le linee seguono la banda, che la pressione stringe: vedi timbra().
    sc[i] = PRESSIONE_BANDA(pts[i * 3 + 2]);
  }

  // Dove il gesto gira stretto — le inversioni dello scarabocchio — la linea
  // spostata di lato farebbe un uncino fuori dal tratto: li' si interrompe.
  const spezza = new Uint8Array(n);
  for (let i = 1; i < n; i++) spezza[i] = nx[i] * nx[i - 1] + ny[i] * ny[i - 1] < 0.8 ? 1 : 0;

  // Una linea ogni ~2,5 unita' di larghezza: il gessetto ha solchi fitti.
  const quante = Math.min(24, Math.max(3, Math.round(width / 2.5)));
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalCompositeOperation = 'lighter';
  for (let j = 0; j < quante; j++) {
    // Lontane dai bordi: una striscia sul filo del tratto si legge come un
    // contorno, e il tratto sembra fatto con un pennino a piu' punte.
    const off = (r() - 0.5) * 0.7 * width;
    ctx.globalAlpha = Math.min(1, GESSO.strie * (0.12 + 0.3 * r()));
    ctx.lineWidth = 0.5 + 1.0 * r();
    // Tratti brevi e interruzioni frequenti: lunghe, sembrano fili.
    const tratti = [];
    for (let k = 0; k < 6; k++) tratti.push(12 + 80 * r(), 8 + 70 * r());
    ctx.setLineDash(tratti);
    ctx.lineDashOffset = r() * 300;
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const o = off * sc[i];
      const x = pts[i * 3] + nx[i] * o, y = pts[i * 3 + 1] + ny[i] * o;
      if (i === 0 || spezza[i]) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Il rettangolo del tratto in unita' di lavagna, con il margine che copre
 * impronte, jitter e polvere. Largo di proposito: fuori dal tratto le
 * passate costano solo pixel vuoti, mentre un margine stretto taglierebbe i
 * granelli piu' lontani.
 */
export function rettangoloTratto(pts, width) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < pts.length; i += 3) {
    const x = pts[i], y = pts[i + 1];
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  const m = width * 1.4 + 4;
  return { x: x0 - m, y: y0 - m, w: x1 - x0 + 2 * m, h: y1 - y0 + 2 * m };
}

/**
 * Disegna un tratto di gesso su `ctx`, che e' gia' in unita' di lavagna.
 *
 * @param {number[]} pts il tratto gia' ricampionato (strokeGeometry in
 *   render.js): la geometria e' la stessa del gesso vecchio.
 * @returns {number} quanti punti ha il tratto ricampionato
 */
export function disegnaGesso(ctx, stroke, pts) {
  const { color, width, seed } = stroke;
  const n = count(pts);
  if (n === 0) return 0;
  const m = ctx.getTransform();
  const k = m.a;
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const a = appoggio(W, H);
  const dep = a.dep, aux = a.aux, fin = a.fin;

  // Il rettangolo in pixel, intero e dentro il canvas: tutte le passate
  // successive lavorano solo li'.
  const r = rettangoloTratto(pts, width);
  const px0 = Math.max(0, Math.floor(r.x * k + m.e));
  const py0 = Math.max(0, Math.floor(r.y * k + m.f));
  const px1 = Math.min(W, Math.ceil((r.x + r.w) * k + m.e));
  const py1 = Math.min(H, Math.ceil((r.y + r.h) * k + m.f));
  const pw = px1 - px0, ph = py1 - py0;
  if (pw <= 0 || ph <= 0) return n;

  // 1. Deposito: il timbro di sempre, in bianco. Il colore arriva alla fine,
  //    cosi' le somme della soglia lavorano su una maschera e non alterano la
  //    tinta.
  dep.setTransform(1, 0, 0, 1, 0, 0);
  dep.globalCompositeOperation = 'source-over';
  dep.globalAlpha = 1;
  dep.clearRect(0, 0, W, H);
  dep.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
  timbra(dep, pts, {
    color: '#ffffff', width, seed, alpha: GESSO.deposito,
    alphaMinPressione: GESSO.pressioneAlfa,
  });

  // 1a. Le striature.
  striature(dep, pts, width, seed);

  // 1b. Il velo: il gesso lascia polvere anche nelle valli, poca. Si prende
  //     dal deposito prima che la trama lo buchi. Senza, fra un granello e
  //     l'altro c'e' lavagna nuda e il tratto sembra stampato a retino.
  fin.setTransform(1, 0, 0, 1, 0, 0);
  fin.globalCompositeOperation = 'source-over';
  fin.globalAlpha = 1;
  fin.clearRect(0, 0, W, H);
  fin.globalCompositeOperation = 'lighter';
  fin.globalAlpha = GESSO.velo;
  fin.drawImage(dep.canvas, px0, py0, pw, ph, px0, py0, pw, ph);

  // 2. Creste: deposito x trama. destination-in azzera anche fuori dal
  //    rettangolo, ed e' giusto: sul canvas d'appoggio c'e' solo questo tratto.
  dep.globalCompositeOperation = 'destination-in';
  dep.fillStyle = patternTrama(a, dep, k);
  dep.fillRect(r.x, r.y, r.w, r.h);
  dep.globalCompositeOperation = 'source-over';

  // 3. Soglia: max(0, X - c). Canvas 2D non sottrae, ma sa invertire
  //    (destination-out sopra un pieno da' 1 - a) e sommare con tetto a 1
  //    (lighter). Quindi: 1 - min(1, (1 - X) + c) = max(0, X - c).
  //
  //    Senza, i valori bassi restavano pixel fiochi invece di sparire, e
  //    attorno a ogni tratto c'era un alone morbido: l'aerografo di prima,
  //    solo piu' granuloso. Col gesso vero il bordo e' netto e rosicchiato.
  const pieno = (c) => {
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    c.fillStyle = '#ffffff';
    c.fillRect(px0, py0, pw, ph);
  };
  dep.setTransform(1, 0, 0, 1, 0, 0);
  aux.setTransform(1, 0, 0, 1, 0, 0);
  pieno(aux);
  aux.globalCompositeOperation = 'destination-out';
  aux.drawImage(dep.canvas, px0, py0, pw, ph, px0, py0, pw, ph);     // 1 - X
  aux.globalCompositeOperation = 'lighter';
  aux.globalAlpha = GESSO.soglia;
  aux.fillRect(px0, py0, pw, ph);                                     // + c
  pieno(dep);
  dep.globalCompositeOperation = 'destination-out';
  dep.drawImage(aux.canvas, px0, py0, pw, ph, px0, py0, pw, ph);     // 1 - (...)
  dep.globalCompositeOperation = 'source-over';

  // 4. Guadagno: g copie sommate, sopra il velo. La parte frazionaria entra
  //    come opacita' dell'ultima copia.
  for (let g = GESSO.guadagno; g > 0; g -= 1) {
    fin.globalAlpha = Math.min(1, g);
    fin.drawImage(dep.canvas, px0, py0, pw, ph, px0, py0, pw, ph);
  }

  // Colore e opacita' finale. Il gesso vero non copre del tutto nemmeno sulle
  // creste: un filo di lavagna in trasparenza e' parte di cio' che lo fa
  // leggere come gesso e non come pittura.
  fin.globalCompositeOperation = 'source-in';
  fin.globalAlpha = GESSO.opacita;
  fin.fillStyle = color;
  fin.fillRect(px0, py0, pw, ph);
  fin.globalCompositeOperation = 'source-over';
  fin.globalAlpha = 1;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(fin.canvas, px0, py0, pw, ph, px0, py0, pw, ph);
  ctx.restore();
  return n;
}
