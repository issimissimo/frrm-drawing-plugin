/**
 * Il cancellino che lascia l'alone (dal 30/09/2026, branch gesso-realistico).
 *
 * Fino alla -27 la gomma toglieva e basta: sotto restava la lavagna pulita.
 * Un cancellino vero non pulisce, spalma: del gesso che toglie ne rimette
 * un po', trascinato nel verso del gesto. Sul rosso resta un velo rosato,
 * sul bianco uno grigio, sulla lavagna pulita niente (scelte di Daniele,
 * 30/09/2026).
 *
 * Per ogni timbro della gomma, sul livello dei tratti:
 *
 *   1. FOTO     si copia quel che c'e' sotto il timbro, alone compreso;
 *   2. GOMMA    si cancella come prima, in destination-out;
 *   3. MASCHERA gli stessi timbri in bianco su un canvas vuoto: e' la
 *               frazione tolta, pixel per pixel;
 *   4. TOLTO    la foto ritagliata dalla maschera (destination-in): e'
 *               esattamente il gesso appena rimosso, col suo colore;
 *   5. ALONE    lo si rimette, a una frazione, in piu' copie spostate
 *               ALL'INDIETRO lungo il gesto: il velo resta sulla scia gia'
 *               pulita, strisciato. In avanti lo ricancellerebbe il timbro
 *               successivo, e si ammucchierebbe in fondo alla passata.
 *
 * Ripassare pulisce di piu' da solo: ogni passata rimette una frazione della
 * frazione.
 *
 * UN TIMBRO ALLA VOLTA, e non a caso: dal vivo la gomma incide per sempre i
 * timbri man mano che diventano definitivi (resample() con `info`), dal
 * modello li incide tutti di fila. Con la stessa unita' di lavoro le due
 * strade fanno le stesse operazioni sugli stessi pixel, e lo schermo coincide
 * con quel che danno annulla, rotazione e immagine salvata.
 *
 * La coda ancora provvisoria si incide lo stesso, per non restare indietro
 * sotto il dito, e al frame dopo si rimette com'era da una foto (main.js).
 * Su un canvas in GPU quella foto non e' esatta al bit: premoltiplicare e
 * tornare indietro sbaglia di un'unita' sui pixel semitrasparenti. Misurato
 * il 30/09/2026 su un gesto pilotato: 13-134 pixel su ~900.000 diversi dal
 * render dal modello, di 1-2 livelli su 255 nel colore pesato per
 * l'opacita'. Invisibile. L'identita' al bit chiederebbe la lavagna in CPU
 * (willReadFrequently), e il gesso nuovo vive di passate in GPU.
 */

import { timbra } from './chalk.js';
import { count } from './geom.js';
import { ERASER_ALPHA } from './palette.js';

/**
 * Quanto del gesso tolto torna come alone, in totale fra le copie.
 * `?alone=` lo cambia per il confronto sul device (main.js).
 *
 * La -28 aveva 0,2 e le copie fra 0,12 e 0,5 larghezze dietro: sul telefono
 * «non si nota minimamente» (Daniele, 30/09/2026). Misurato alla geometria
 * del telefono, luminosita' della scia sopra la gomma pulita: 0,2 -> +4,
 * 0,4 -> +12, 0,6 -> +16. Spostare le copie piu' indietro non cambiava
 * quasi nulla; e' l'intensita' che conta.
 */
let alone = 0.5;
export const impostaAlone = (v) => {
  const x = Number(v);
  if (v !== null && v !== undefined && v !== '' && Number.isFinite(x)) alone = Math.min(1, Math.max(0, x));
};
export const aloneAttuale = () => alone;

/**
 * Le copie dell'alone: quanto indietro, come frazione della larghezza della
 * gomma, e con che peso. Pesano di piu' le vicine: la striscia sfuma
 * allontanandosi da dove il gesso e' stato preso.
 */
export const COPIE = [
  { dietro: 0.45, peso: 0.4 },
  { dietro: 0.6, peso: 0.3 },
  { dietro: 0.75, peso: 0.2 },
  { dietro: 0.9, peso: 0.1 },
];

/**
 * Il rettangolo in pixel che incidere i timbri [da, a) puo' toccare: i timbri
 * e la scia dietro di loro. Intero e dentro il canvas; null se vuoto.
 * Serve alla coda provvisoria dal vivo (main.js), che si fotografa prima di
 * inciderla e si rimette al frame dopo.
 */
export function ingombro(ctx, stroke, pts, da, a) {
  const n = count(pts);
  const fine = Math.min(a, n);
  if (fine <= da) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = da; i < fine; i++) {
    const x = pts[i * 3], y = pts[i * 3 + 1];
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  // Largo di proposito: il raggio del timbro piu' la copia piu' lontana, in
  // qualunque direzione, piu' un quarto di larghezza e 3 pixel. Un pixel
  // toccato fuori da qui non tornerebbe indietro: col margine stretto (2
  // unita') restavano ~20 pixel diversi dal render dal modello su un gesto,
  // sfiorati dai bordi sfumati dei timbri e dalle copie a mezzo pixel.
  const r = stroke.width * (1 + COPIE[COPIE.length - 1].dietro);
  const m = ctx.getTransform();
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const px0 = Math.max(0, Math.floor((x0 - r) * m.a + m.e) - 3), py0 = Math.max(0, Math.floor((y0 - r) * m.a + m.f) - 3);
  const px1 = Math.min(W, Math.ceil((x1 + r) * m.a + m.e) + 3), py1 = Math.min(H, Math.ceil((y1 + r) * m.a + m.f) + 3);
  if (px1 <= px0 || py1 <= py0) return null;
  return { x: px0, y: py0, w: px1 - px0, h: py1 - py0 };
}

/** Due canvas d'appoggio per misura di destinazione (schermo, export). */
const appoggi = new Map();
function appoggio(w, h) {
  const chiave = `${w}x${h}`;
  let a = appoggi.get(chiave);
  if (a) return a;
  const nuovo = () => {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    return cv.getContext('2d');
  };
  a = { foto: nuovo(), masc: nuovo() };
  if (appoggi.size >= 2) appoggi.delete(appoggi.keys().next().value);
  appoggi.set(chiave, a);
  return a;
}

/**
 * Incide i timbri [da, a) della gomma `stroke` su `ctx` (gia' in unita' di
 * lavagna), un timbro alla volta, lasciando l'alone.
 *
 * @param {number[]} pts i timbri, cioe' il tratto gia' ricampionato
 * @returns {number} l'indice del primo timbro non ancora inciso
 */
export function cancella(ctx, stroke, pts, da = 0, a = Infinity) {
  const n = count(pts);
  const fine = Math.min(a, n);
  const opzioni = { color: '#000', width: stroke.width, seed: stroke.seed, alpha: ERASER_ALPHA };

  // Senza alone e' la gomma di prima, tutta in una chiamata.
  if (!(alone > 0)) {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    timbra(ctx, pts, { ...opzioni, da, a: fine });
    ctx.restore();
    return Math.max(da, fine);
  }

  const m = ctx.getTransform();
  const k = m.a;
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const { foto, masc } = appoggio(W, H);
  const w = stroke.width;
  // Il timbro piu' largo sporge di poco oltre la larghezza nominale (jitter,
  // impronte affiancate): un quarto in piu' basta.
  const raggio = w * 0.75;
  const indietro = w * COPIE[COPIE.length - 1].dietro;

  for (let i = da; i < fine; i++) {
    const x = pts[i * 3], y = pts[i * 3 + 1];
    // Il verso del gesto: centrato come la normale di timbra(), che usa gli
    // stessi vicini. Il vicino dopo esiste gia' ed e' definitivo: dal vivo
    // si incide solo fino a stabili - 1.
    const p = Math.max(0, i - 1), q = Math.min(n - 1, i + 1);
    let dx = pts[q * 3] - pts[p * 3], dy = pts[q * 3 + 1] - pts[p * 3 + 1];
    const len = Math.hypot(dx, dy);
    if (len > 0) { dx /= len; dy /= len; } else { dx = 0; dy = 0; }

    // Il rettangolo in pixel: il timbro e la scia dietro, interi e dentro il
    // canvas. Tutte le passate lavorano solo li'.
    const ux0 = Math.min(x, x - dx * indietro) - raggio, ux1 = Math.max(x, x - dx * indietro) + raggio;
    const uy0 = Math.min(y, y - dy * indietro) - raggio, uy1 = Math.max(y, y - dy * indietro) + raggio;
    const px0 = Math.max(0, Math.floor(ux0 * k + m.e)), py0 = Math.max(0, Math.floor(uy0 * k + m.f));
    const px1 = Math.min(W, Math.ceil(ux1 * k + m.e)), py1 = Math.min(H, Math.ceil(uy1 * k + m.f));
    const pw = px1 - px0, ph = py1 - py0;

    if (pw <= 0 || ph <= 0) {
      // Fuori dal canvas: non c'e' niente da fotografare, basta cancellare
      // (che fuori non fa nulla, ma consuma la stessa sequenza).
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      timbra(ctx, pts, { ...opzioni, da: i, a: i + 1 });
      ctx.restore();
      continue;
    }

    // 1. La foto di quel che c'e'.
    //    Non con 'copy', che svuoterebbe tutto il canvas fuori dalla sorgente:
    //    a ogni timbro, un canvas grande quanto la lavagna.
    foto.setTransform(1, 0, 0, 1, 0, 0);
    foto.globalCompositeOperation = 'source-over';
    foto.globalAlpha = 1;
    foto.clearRect(px0, py0, pw, ph);
    foto.drawImage(ctx.canvas, px0, py0, pw, ph, px0, py0, pw, ph);

    // 2. La gomma.
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    timbra(ctx, pts, { ...opzioni, da: i, a: i + 1 });
    ctx.restore();

    // 3. La maschera: gli stessi timbri, in bianco, sul vuoto.
    masc.setTransform(1, 0, 0, 1, 0, 0);
    masc.clearRect(px0, py0, pw, ph);
    masc.setTransform(m);
    timbra(masc, pts, { ...opzioni, color: '#ffffff', da: i, a: i + 1 });
    masc.setTransform(1, 0, 0, 1, 0, 0);

    // 4. Il gesso tolto. destination-in svuota tutto quel che la sorgente
    //    non copre: il clip lo tiene dentro il rettangolo.
    foto.save();
    foto.beginPath();
    foto.rect(px0, py0, pw, ph);
    foto.clip();
    foto.globalCompositeOperation = 'destination-in';
    foto.drawImage(masc.canvas, px0, py0, pw, ph, px0, py0, pw, ph);
    foto.restore();

    // 5. L'alone, all'indietro lungo il gesto.
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    for (const { dietro, peso } of COPIE) {
      ctx.globalAlpha = alone * peso;
      const ox = -dx * dietro * w * k, oy = -dy * dietro * w * k;
      ctx.drawImage(foto.canvas, px0, py0, pw, ph, px0 + ox, py0 + oy, pw, ph);
    }
    ctx.restore();
  }
  return Math.max(da, fine);
}
