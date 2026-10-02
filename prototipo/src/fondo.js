/**
 * Il fondo della lavagna (dal 30/09/2026, branch gesso-realistico).
 *
 * Fino alla -26 era un colore pieno. Una lavagna vera non lo e' mai: ha la
 * polvere del gesso cancellato, le passate di spugna, la grana della superficie
 * (foto di riferimento di Daniele, dreamstime 189200205).
 *
 * Tre livelli, dal piu' grande al piu' piccolo:
 *
 *   NUVOLE    velature larghe di gesso cancellato, centinaia di unita'.
 *   SPUGNATE  passate ad arco, con le righe parallele lasciate dal panno.
 *   GRANA     la superficie, un'unita' per granello.
 *
 * Il vincolo di Daniele: non deve sembrare un motivo che si ripete. Per questo
 * nuvole e spugnate NON sono una piastrella: coprono l'intera lavagna e sono
 * funzioni della posizione, quindi nessun punto e' uguale a un altro. Si
 * ripete solo la grana, dove una ripetizione non si puo' vedere perche' non
 * c'e' nessuna forma da riconoscere; e le piastrelle sono due, di lati primi
 * fra loro (241 e 256 unita'), cosi' la loro somma torna uguale solo ogni
 * ~62.000 unita'.
 *
 * Tutto in unita' di lavagna e deterministico da FONDO.seme: lo schermo e
 * l'immagine salvata hanno lo stesso fondo, a qualunque risoluzione. Una
 * lavagna piu' alta non rimescola la parte in alto, la allunga (le spugnate si
 * decidono per celle fisse, non in proporzione all'altezza).
 *
 * Il fondo NON sta sul canvas dei tratti: il cancellino lavora in
 * destination-out e lo bucherebbe. A schermo sta su un canvas sotto
 * (#fondo), nell'export si compone in destination-over (export.js).
 */

import { hash } from './gesso.js';
import { mulberry32 } from './chalk.js';
import { BOARD_W, BOARD_BG } from './palette.js';

/**
 * `?fondo=pieno` rimette il colore pieno della -26, per confrontarli sullo
 * stesso device. Come `?gesso=vecchio`: uno stato del modulo, cosi' schermo e
 * immagine salvata non possono divergere.
 */
let modoFondo = 'lavagna';
export const impostaFondo = (m) => { modoFondo = m === 'pieno' ? 'pieno' : 'lavagna'; };
export const fondoAttuale = () => modoFondo;

/**
 * I numeri del fondo. Tarati il 30/09/2026 contro la foto e contro un vincolo:
 * la luminosita' media deve restare quella del #1F2225 di prima (Daniele, lo
 * stesso giorno), perche' i dieci gessetti sono tarati su quel fondo. Per
 * questo `base` e' piu' scura: nuvole, spugnate e grana la schiariscono.
 *
 *   base      il colore sotto tutto.
 *   nuvole    opacita' massima delle velature (bianco).
 *   spugnate  opacita' massima di una riga di spugnata (bianco).
 *   strisciate  lo stesso, per i segni corti di mano e panno.
 *   polvere   quanto della velatura resta nel granello piu' vuoto: 1 = liscia
 *             come fumo, 0 = solo puntini.
 *   granaChiara, granaScura  opacita' massima dei granelli chiari e scuri.
 */
export const FONDO = {
  seme: 20260930,
  base: '#15181B',
  nuvole: 0.17,
  spugnate: 0.22,
  strisciate: 0.26,
  polvere: 0.35,
  granaChiara: 0.11,
  granaScura: 0.16,
};

/*
 * Misure del 30/09/2026, lavagna 1600 x 1200 all'export, in scala di grigi e
 * ridotta alla larghezza della foto (992 px), a blocchi di 24 px senza gesso:
 *
 *                             media   fra zone (std)   grana (std dentro)
 *   foto di riferimento        58,9        6,8               6,2
 *   la foto portata a 34       34          ~3,9              ~3,6
 *   questo fondo               33,4        3,6               3,2
 *
 * La foto e' piu' chiara della nostra lavagna: il confronto giusto e' in
 * proporzione alla luminosita', non in assoluto. Colore medio 31,4 / 34,1 /
 * 36,8 contro il 31 / 34 / 37 del #1F2225.
 *
 * Strade scartate, in ordine:
 *  - nuvole lisce senza polvere: sembravano fumo;
 *  - strisciate larghe e corte: rettangolini tutti uguali, un motivo;
 *  - strisciate di righe rade e sottili: un pettine, o graffi.
 */

const liscia = (t) => t * t * (3 - 2 * t);
const tra = (a, b, x) => liscia(Math.min(1, Math.max(0, (x - a) / (b - a))));

/* --- Le nuvole ------------------------------------------------------------- */

/** Rumore di valore a due dimensioni, non periodico, in [0, 1). */
function rumore2(u, v, cella, o) {
  const gx = u / cella, gy = v / cella;
  const x0 = Math.floor(gx), y0 = Math.floor(gy);
  const fx = liscia(gx - x0), fy = liscia(gy - y0);
  const a = hash(x0, y0, o), b = hash(x0 + 1, y0, o);
  const c = hash(x0, y0 + 1, o), d = hash(x0 + 1, y0 + 1, o);
  const top = a + (b - a) * fx, bot = c + (d - c) * fx;
  return top + (bot - top) * fy;
}

/**
 * Le ottave delle nuvole: la piu' larga fa le zone, le piu' strette le
 * sfrangiano. Pesi che sommano a 1.
 */
const OTTAVE_NUVOLE = [
  { cella: 420, peso: 0.42 },
  { cella: 210, peso: 0.26 },
  { cella: 100, peso: 0.16 },
  { cella: 48, peso: 0.10 },
  { cella: 22, peso: 0.06 },
];

/**
 * Quanto e' velato il punto (u, v): 0 lavagna pulita, 1 velatura piena.
 *
 * Lo spazio e' STIRATO da un secondo rumore largo prima di campionare le
 * ottave: senza, le nuvole di un rumore di valore sono macchie tonde
 * allineate a una griglia, e la griglia si legge. Stirate diventano le
 * strisciate di una mano che ha pulito in fretta.
 */
export function nuvola(u, v) {
  const o = FONDO.seme;
  const su = u + 160 * (rumore2(u, v, 520, o + 11) - 0.5);
  const sv = v + 160 * (rumore2(u, v, 520, o + 12) - 0.5);
  let f = 0;
  for (let i = 0; i < OTTAVE_NUVOLE.length; i++) {
    const { cella, peso } = OTTAVE_NUVOLE[i];
    f += peso * rumore2(su, sv, cella, o + i);
  }
  return tra(0.44, 0.74, f);
}

/** Lato di un campione delle nuvole, in unita': sono larghe, bastano radi. */
const PASSO_NUVOLE = 8;

/**
 * Le nuvole come immagine, un pixel ogni PASSO_NUVOLE unita', bianco con
 * l'opacita' nell'alfa. Si genera una volta per altezza di lavagna: sono
 * ~200 x 150 pixel per una lavagna 4:3, qualche millisecondo.
 */
const nuvoleInCache = new Map();
function immagineNuvole(h) {
  const chiave = `${h}:${FONDO.seme}:${FONDO.nuvole}`;
  let cv = nuvoleInCache.get(chiave);
  if (cv) return cv;
  const nx = Math.ceil(BOARD_W / PASSO_NUVOLE) + 2;
  const ny = Math.ceil(h / PASSO_NUVOLE) + 2;
  cv = document.createElement('canvas');
  cv.width = nx; cv.height = ny;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(nx, ny);
  const d = img.data;
  for (let y = 0; y < ny; y++) {
    for (let x = 0; x < nx; x++) {
      const i = (y * nx + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = 255;
      d[i + 3] = Math.round(FONDO.nuvole * nuvola((x - 1) * PASSO_NUVOLE, (y - 1) * PASSO_NUVOLE) * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  if (nuvoleInCache.size >= 3) nuvoleInCache.delete(nuvoleInCache.keys().next().value);
  nuvoleInCache.set(chiave, cv);
  return cv;
}

/* --- Le spugnate ----------------------------------------------------------- */

/** Lato della cella che decide dove passa la spugna, in unita'. */
const CELLA_SPUGNATE = 640;

/**
 * Le passate di spugna che toccano la fascia verticale [y0, y1]: archi di
 * cerchio con centro, raggio, apertura, larghezza e forza. Si decidono per
 * celle fisse, ciascuna col suo seme: la stessa cella da' la stessa passata
 * qualunque sia l'altezza della lavagna.
 */
export function spugnate(y0, y1) {
  const out = [];
  const cx0 = -1, cx1 = Math.ceil(BOARD_W / CELLA_SPUGNATE);
  const cy0 = Math.floor(y0 / CELLA_SPUGNATE) - 1, cy1 = Math.ceil(y1 / CELLA_SPUGNATE);
  for (let cy = cy0; cy <= cy1; cy++) {
    for (let cx = cx0; cx <= cx1; cx++) {
      const rnd = mulberry32((hash(cx, cy, FONDO.seme) * 4294967296) >>> 0);
      const quante = rnd() < 0.55 ? 1 : 2;
      for (let q = 0; q < quante; q++) {
        const r = 220 + rnd() * 420;
        out.push({
          x: (cx + rnd()) * CELLA_SPUGNATE,
          y: (cy + rnd()) * CELLA_SPUGNATE,
          r,
          da: rnd() * Math.PI * 2,
          apertura: 0.5 + rnd() * 1.1,
          meta: 28 + rnd() * 60,
          forza: 0.35 + 0.65 * rnd(),
          seme: (rnd() * 4294967296) >>> 0,
        });
      }
    }
  }
  return out;
}

/**
 * Una passata di spugna: righe concentriche sottili, ciascuna con la sua
 * opacita' e il suo spessore — il panno lascia righe, non una fascia
 * uniforme. Ogni riga e' spezzata in archi corti, cosi' l'opacita' puo'
 * sfumare ai due capi e variare lungo il gesto.
 *
 * Disegnata direttamente con arc(), in unita' di lavagna: nitida a qualunque
 * risoluzione, senza un'immagine intermedia da ingrandire.
 */
function dipingiSpugnata(ctx, s, massimo = FONDO.spugnate, morbida = false) {
  const rnd = mulberry32(s.seme);
  // Le strisciate sono piu' fitte e con righe piu' larghe: rade, un fascio di
  // righe sottili leggeva come un pettine, non come una mano passata.
  const passoRiga = morbida ? 2.2 : 3.2;
  const riga0 = morbida ? 1.6 : 0.9, rigaVar = morbida ? 2.8 : 2.2;
  const passoArco = Math.min(0.1, 36 / s.r);
  const n = Math.max(2, Math.ceil(s.apertura / passoArco));
  const da = s.apertura / n;
  const dose = (t, o) => 0.55 + 0.45 * rumore2(t * 9, 0, 1, o);
  ctx.lineCap = 'butt';
  for (let k = -s.meta; k <= s.meta; k += passoRiga) {
    const riga = rnd();
    // Le righe al centro della passata sono le piu' cariche; fra una e
    // l'altra l'opacita' salta, come i fili di un panno.
    const peso = s.forza * (1 - tra(0.55, 1, Math.abs(k) / s.meta)) * (0.25 + 0.75 * riga * riga);
    if (peso < 0.04) continue;
    ctx.lineWidth = riga0 + rnd() * rigaVar;
    const o = (s.seme ^ Math.round(k * 7)) >>> 0;
    // La riga non comincia e non finisce dove le altre: il panno non e' dritto.
    const t0 = rnd() * 0.18, t1 = 1 - rnd() * 0.18;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      if (t < t0 || t > t1) continue;
      const capi = Math.sin(Math.PI * (t - t0) / (t1 - t0));
      const a = massimo * peso * capi * dose(t, o);
      if (a < 0.002) continue;
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r + k, s.da + i * da, s.da + (i + 1) * da + 0.004);
      ctx.stroke();
    }
  }
}

/* --- Le strisciate --------------------------------------------------------- */

/** Lato della cella delle strisciate, in unita'. */
const CELLA_STRISCIATE = 150;

/**
 * Le strisciate che toccano la fascia [y0, y1]: segni corti di mano e di
 * panno, lunghi 40-160 unita'. Sono spugnate in piccolo — un arco di raggio
 * grande e apertura breve, quasi dritto — e si disegnano allo stesso modo.
 *
 * La direzione non e' a caso punto per punto: segue un rumore largo, perche'
 * chi pulisce una zona la pulisce con lo stesso gesto. A caso del tutto, la
 * lavagna sembrava graffiata.
 */
export function strisciate(y0, y1) {
  const out = [];
  const cx1 = Math.ceil(BOARD_W / CELLA_STRISCIATE);
  const cy0 = Math.floor(y0 / CELLA_STRISCIATE) - 1, cy1 = Math.ceil(y1 / CELLA_STRISCIATE);
  const o = FONDO.seme + 77;
  for (let cy = cy0; cy <= cy1; cy++) {
    for (let cx = -1; cx <= cx1; cx++) {
      const rnd = mulberry32((hash(cx, cy, o) * 4294967296) >>> 0);
      const quante = Math.floor(rnd() * 2.6);
      for (let q = 0; q < quante; q++) {
        const x = (cx + rnd()) * CELLA_STRISCIATE;
        const y = (cy + rnd()) * CELLA_STRISCIATE;
        const dir = rumore2(x, y, 700, o + 1) * Math.PI * 2 + (rnd() - 0.5) * 0.9;
        const r = 250 + rnd() * 500;
        const meta = 6 + rnd() * 14;
        // Sempre almeno tre volte piu' lunghe che larghe: corte e larghe
        // diventavano rettangolini tutti uguali, e si leggevano come un
        // motivo ripetuto (provato il 30/09/2026).
        const lungo = Math.max(6 * meta, 60 + rnd() * 170);
        const apertura = lungo / r;
        // Il centro dell'arco sta di lato alla strisciata, a distanza r: cosi'
        // l'arco passa per (x, y) nella direzione `dir`.
        const lato = rnd() < 0.5 ? 1 : -1;
        const cxA = x - lato * r * Math.sin(dir), cyA = y + lato * r * Math.cos(dir);
        const aMedio = Math.atan2(y - cyA, x - cxA);
        out.push({
          x: cxA, y: cyA, r,
          da: aMedio - apertura / 2,
          apertura,
          meta,
          // Molte deboli e poche forti: con la forza distribuita uniforme si
          // somigliavano tutte.
          forza: 0.15 + 0.85 * rnd() ** 2,
          seme: (rnd() * 4294967296) >>> 0,
        });
      }
    }
  }
  return out;
}

/* --- La grana -------------------------------------------------------------- */

/** I lati delle due piastrelle: primi fra loro, vedi l'intestazione. */
const LATI_GRANA = [241, 256];

/**
 * Una piastrella di grana: un granello per unita', bianco o nero, con
 * l'opacita' nell'alfa. Senza ottave larghe: una piastrella con una forma
 * dentro si riconoscerebbe ripetuta, un rumore bianco no.
 */
const granaInCache = new Map();
function piastrella(lato, colore, massimo, o, minimo = 0) {
  const chiave = `${lato}:${colore}:${massimo}:${o}:${minimo}`;
  let cv = granaInCache.get(chiave);
  if (cv) return cv;
  cv = document.createElement('canvas');
  cv.width = cv.height = lato;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(lato, lato);
  const d = img.data;
  const c = colore === 'scuro' ? 0 : 255;
  for (let y = 0; y < lato; y++) {
    for (let x = 0; x < lato; x++) {
      const i = (y * lato + x) * 4;
      const g = hash(x, y, o);
      d[i] = d[i + 1] = d[i + 2] = c;
      // Al quadrato: tanti granelli deboli e pochi forti, come una superficie
      // opaca, invece di un grigio televisivo uniforme.
      d[i + 3] = Math.round((minimo + (massimo - minimo) * g * g) * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  granaInCache.set(chiave, cv);
  return cv;
}

/* --- Tutto insieme --------------------------------------------------------- */

/**
 * Dipinge il fondo su `ctx`, che e' gia' in unita' di lavagna, per una
 * lavagna alta `h` unita'. Copre tutto il rettangolo [0, BOARD_W] x [0, h].
 */
export function dipingiFondo(ctx, h) {
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  if (modoFondo === 'pieno') {
    ctx.fillStyle = BOARD_BG;
    ctx.fillRect(0, 0, BOARD_W, h);
    ctx.restore();
    return;
  }
  ctx.fillStyle = FONDO.base;
  ctx.fillRect(0, 0, BOARD_W, h);

  // 1. La velatura — nuvole, spugnate, strisciate — su un canvas a parte,
  //    in bianco: prima di posarla va bucherellata dalla polvere (2).
  const vc = document.createElement('canvas');
  vc.width = ctx.canvas.width; vc.height = ctx.canvas.height;
  const v = vc.getContext('2d');
  v.setTransform(ctx.getTransform());

  // Le nuvole: l'immagine rada, ingrandita con lo smoothing. Un pixel ogni
  // 8 unita', centrato sul suo campione.
  v.imageSmoothingEnabled = true;
  v.imageSmoothingQuality = 'high';
  const nuv = immagineNuvole(h);
  v.drawImage(nuv, -1.5 * PASSO_NUVOLE, -1.5 * PASSO_NUVOLE,
    nuv.width * PASSO_NUVOLE, nuv.height * PASSO_NUVOLE);

  v.strokeStyle = '#ffffff';
  for (const s of spugnate(0, h)) dipingiSpugnata(v, s);
  for (const s of strisciate(0, h)) dipingiSpugnata(v, s, FONDO.strisciate, true);
  v.globalAlpha = 1;

  // 2. La polvere: la velatura si tiene solo in parte, granello per
  //    granello (destination-in). Il gesso cancellato non e' un grigio
  //    liscio, e' un pulviscolo: dove ce n'e' di piu' i puntini sono piu'
  //    fitti. Senza, le nuvole sembravano fumo.
  const o = FONDO.seme;
  v.globalCompositeOperation = 'destination-in';
  for (let i = 0; i < LATI_GRANA.length; i++) {
    const p = v.createPattern(piastrella(LATI_GRANA[i], 'maschera', 1, o + 41 + i, FONDO.polvere), 'repeat');
    p.setTransform(new DOMMatrix([1, 0, 0, 1, 131 * i, 71 * i]));
    v.fillStyle = p;
    v.fillRect(0, 0, BOARD_W, h);
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(vc, 0, 0);
  ctx.setTransform(v.getTransform());

  // 3. La grana della superficie: due piastrelle per colore, di lati diversi.
  for (const [colore, massimo] of [['chiaro', FONDO.granaChiara], ['scuro', FONDO.granaScura]]) {
    for (let i = 0; i < LATI_GRANA.length; i++) {
      const p = ctx.createPattern(piastrella(LATI_GRANA[i], colore, massimo, o + 31 + i * 2 + (colore === 'scuro')), 'repeat');
      // Ciascuna col suo spostamento, cosi' le due non partono dallo stesso
      // angolo.
      p.setTransform(new DOMMatrix([1, 0, 0, 1, 97 * i, 53 * i]));
      ctx.fillStyle = p;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(0, 0, BOARD_W, h);
    }
  }
  ctx.restore();
}

/**
 * Mette il fondo SOTTO quel che `ctx` ha gia' disegnato, come faceva il
 * fillRect in destination-over dell'export. Serve un canvas d'appoggio: il
 * fondo e' fatto di piu' passate, e in destination-over ciascuna finirebbe
 * sotto la precedente.
 *
 * `ctx` e' in unita' di lavagna; la sua trasformazione si riusa tale e quale.
 */
/**
 * L'ultimo fondo composto per l'export, riusato se la misura e' la stessa.
 * SALVA E INVIA fa due export identici nello stesso tocco (il download e
 * l'invio), e il tocco e' sincrono (export.js, nota 3): il secondo non deve
 * rigenerare. Uno solo: ~8 MB a 1600 x 1200.
 */
let fondoInCache = { chiave: '', cv: null };
function fondoPer(ctx, h) {
  const { width, height } = ctx.canvas;
  const m = ctx.getTransform();
  const chiave = `${width}x${height}:${h}:${m.a}:${m.e}:${m.f}:${JSON.stringify(FONDO)}`;
  if (fondoInCache.chiave === chiave) return fondoInCache.cv;
  const cv = document.createElement('canvas');
  cv.width = width; cv.height = height;
  const f = cv.getContext('2d');
  f.setTransform(m);
  dipingiFondo(f, h);
  fondoInCache = { chiave, cv };
  return cv;
}

export function componiSotto(ctx, h) {
  if (modoFondo === 'pieno') {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'destination-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = BOARD_BG;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
    return;
  }
  const cv = fondoPer(ctx, h);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'destination-over';
  ctx.globalAlpha = 1;
  ctx.drawImage(cv, 0, 0);
  ctx.restore();
}
