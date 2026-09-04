/**
 * L'effetto gessetto.
 *
 * Il gesso e' tre cose insieme: bordi sfrangiati, grana, opacita' irregolare.
 * Nessuna si ottiene con una linea, quindi il tratto non viene disegnato:
 * viene TIMBRATO, ripetendo lungo la curva una piccola impronta irregolare.
 *
 * Le impronte sono pre-renderizzate una volta sola all'avvio, in scala di
 * grigi, e poi colorate su richiesta. Generarle a ogni tratto costerebbe
 * qualche millisecondo di troppo proprio nel momento sbagliato.
 *
 * Due semplificazioni rispetto al brief (§5.2), entrambe a parita' di resa:
 *
 *  - la "polvere" ai bordi e' dentro l'impronta, non uno scatter disegnato a
 *    parte: sono granelli isolati oltre il disco centrale, e cosi' costano
 *    zero invece di raddoppiare le operazioni di disegno;
 *  - niente rotazione per timbro, che imporrebbe un save/rotate/restore ogni
 *    volta. La varieta' viene da otto impronte diverse scelte a rotazione.
 */

import { BOARD_W } from './palette.js';

/** Quante impronte diverse. Poche si notano ripetute, molte non aggiungono. */
const VARIANTI = 8;

/**
 * Lato dell'impronta in pixel sorgente. Deve reggere il render hi-res: a
 * 3200 px un tratto grosso occupa ~146 pixel, e partire da 64 lo sfocherebbe.
 * Il costo e' in memoria (una impronta colorata pesa ~37 KB) e si paga solo
 * per i colori effettivamente usati.
 */
const LATO = 96;

/**
 * Quanto del raggio e' disco pieno: il resto e' sfrangiatura e polvere.
 * Serve a sapere di quanto ingrandire l'impronta perche' il tratto risulti
 * largo quanto richiesto.
 */
const NUCLEO = 0.60;

/** PRNG di Marsaglia via mulberry32: piccolo, veloce, riproducibile. */
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Una impronta: disco morbido, bucato da una grana irregolare, con qualche
 * granello sparso oltre il bordo. Restituisce una maschera di sola opacita'.
 */
function creaImpronta(rnd) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = LATO;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(LATO, LATO);
  const d = img.data;
  const c = (LATO - 1) / 2;

  // Grana a macchie molto larghe. L'impronta viene disegnata a una frazione
  // della sua dimensione sorgente — da 96 px a una ventina — quindi una grana
  // fine si media via e restituisce un grigio uniforme: sullo schermo si
  // vedrebbe una matita, non un gesso. Poche celle grandi sopravvivono.
  const CELLE = 5;
  const macchie = new Float32Array(CELLE * CELLE);
  for (let i = 0; i < macchie.length; i++) macchie[i] = rnd();

  const macchiaA = (x, y) => {
    const gx = (x / LATO) * (CELLE - 1);
    const gy = (y / LATO) * (CELLE - 1);
    const x0 = Math.floor(gx), y0 = Math.floor(gy);
    const fx = gx - x0, fy = gy - y0;
    const x1 = Math.min(x0 + 1, CELLE - 1), y1 = Math.min(y0 + 1, CELLE - 1);
    const a = macchie[y0 * CELLE + x0], b = macchie[y0 * CELLE + x1];
    const e = macchie[y1 * CELLE + x0], f = macchie[y1 * CELLE + x1];
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    return (a + (b - a) * sx) + ((e + (f - e) * sx) - (a + (b - a) * sx)) * sy;
  };

  // Bordo irregolare: il raggio utile varia con l'angolo, cosi' l'impronta
  // non e' un cerchio ma una macchia.
  const ONDE = 5;
  const fase = [];
  for (let k = 0; k < ONDE; k++) fase.push(rnd() * Math.PI * 2);

  for (let y = 0; y < LATO; y++) {
    for (let x = 0; x < LATO; x++) {
      const dx = (x - c) / c, dy = (y - c) / c;
      const dist = Math.hypot(dx, dy);
      const ang = Math.atan2(dy, dx);

      let bordo = 1;
      for (let k = 0; k < ONDE; k++) bordo += 0.075 * Math.sin(ang * (k + 2) + fase[k]);

      const grana = macchiaA(x, y);

      let a;
      if (dist <= NUCLEO * bordo) {
        // Interno denso, ma con VUOTI veri: sotto soglia l'opacita' va a zero
        // e la lavagna traspare. E' il buco a fare il gesso; un interno solo
        // piu' chiaro o piu' scuro leggerebbe come inchiostro diluito.
        a = grana < 0.30 ? 0 : 0.72 + 0.28 * grana;
      } else if (dist <= bordo) {
        // Sfrangiatura: si dissolve, e la grana la rende irregolare.
        const t = 1 - smoothstep(NUCLEO * bordo, bordo, dist);
        a = grana < 0.38 ? 0 : t * (0.5 + 0.5 * grana);
      } else {
        // Polvere: granelli radi, sempre piu' improbabili allontanandosi.
        const p = 1 - smoothstep(bordo, 1.0, dist);
        a = rnd() < p * 0.16 ? 0.35 + 0.4 * rnd() : 0;
      }

      const i = (y * LATO + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = 255;
      d[i + 3] = Math.round(Math.min(1, Math.max(0, a)) * 255);
    }
  }

  ctx.putImageData(img, 0, 0);
  return cv;
}

/* Le maschere sono un asset condiviso e non dipendono dal seed dello stroke:
   il seme fisso serve solo a renderle identiche a ogni avvio. */
let maschere = null;
function impronte() {
  if (!maschere) {
    const rnd = mulberry32(0x5EED);
    maschere = [];
    for (let i = 0; i < VARIANTI; i++) maschere.push(creaImpronta(rnd));
  }
  return maschere;
}

/** Impronte colorate, generate alla prima richiesta e poi riusate. */
const cache = new Map();

function colorate(hex) {
  let set = cache.get(hex);
  if (set) return set;
  set = impronte().map((m) => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = LATO;
    const ctx = cv.getContext('2d');
    ctx.drawImage(m, 0, 0);
    ctx.globalCompositeOperation = 'source-in';   // tinge, conserva l'opacita'
    ctx.fillStyle = hex;
    ctx.fillRect(0, 0, LATO, LATO);
    return cv;
  });
  cache.set(hex, set);
  return set;
}

/**
 * Distanza fra un timbro e il successivo.
 *
 * Legata alla larghezza, non fissa: le impronte sono larghe quanto il tratto,
 * quindi a un terzo della larghezza si sovrappongono a sufficienza. Con il
 * passo di 2,5 unita' usato per la polilinea servirebbero ottocento timbri
 * per tratto invece di novanta.
 */
export const passoTimbri = (larghezza) => Math.max(2, larghezza * 0.34);

/**
 * Timbra un tratto gia' ricampionato.
 *
 * `pts` e' l'array piatto [x, y, p, ...]; `seed` rende la texture riproducibile
 * (D1): stesso stroke, stessa identica grana, a qualsiasi risoluzione.
 *
 * `da` salta i primi timbri, per aggiungere solo il tratto nuovo. Serve alla
 * gomma, che lavora in destination-out: ridisegnare tutto a ogni frame
 * cancellerebbe sessanta volte lo stesso punto.
 *
 * Il generatore e' sequenziale, non legato alla posizione del timbro. Legarlo
 * alla posizione era stato provato per rendere la texture insensibile ai
 * ritocchi della curva, e peggiorava: uno spostamento di due unita' cambiava
 * il 16% dei pixel invece del 3%, perche' ogni micro-movimento ricalcolava
 * l'aspetto di tutte le impronte.
 */
export function timbra(ctx, pts, { color, width, seed, alpha = 0.42, da = 0 }) {
  const n = pts.length / 3;
  if (n === 0) return;

  const set = colorate(color);
  const rnd = mulberry32(seed);

  // Il jitter e' in unita' di lavagna, quindi il tratto e' identico a ogni
  // scala: spostare di "un pixel" lo renderebbe dipendente dalla risoluzione.
  const jitter = Math.max(0.8, width * 0.09);

  for (let i = 0; i < n; i++) {
    // I timbri saltati consumano comunque la loro parte di sequenza: il
    // disegno incrementale deve dare lo stesso risultato di quello intero.
    if (i < da) { rnd(); rnd(); rnd(); rnd(); continue; }

    const x = pts[i * 3], y = pts[i * 3 + 1], p = pts[i * 3 + 2];
    const larghezza = width * (0.35 + 0.65 * p);
    const lato = larghezza / NUCLEO;

    const jx = (rnd() - 0.5) * 2 * jitter;
    const jy = (rnd() - 0.5) * 2 * jitter;

    // L'opacita' varia da timbro a timbro: e' l'irregolarita' che il gesso ha
    // quando la mano preme in modo non uniforme.
    ctx.globalAlpha = alpha * (0.7 + 0.3 * rnd()) * (0.55 + 0.45 * p);
    ctx.drawImage(set[(rnd() * VARIANTI) | 0], x + jx - lato / 2, y + jy - lato / 2, lato, lato);
  }
  ctx.globalAlpha = 1;
}

/** Usato dal pannello di diagnostica. */
export const infoStamp = () => ({ varianti: VARIANTI, lato: LATO, colori: cache.size });
