/**
 * Il cancellino che lascia l'alone (dal 30/09/2026, branch gesso-realistico).
 *
 * Fino alla -27 la gomma toglieva e basta: sotto restava la lavagna pulita.
 * Un cancellino vero non pulisce, spalma: del gesso che toglie ne rimette
 * un po', trascinato nel verso del gesto. Sul rosso resta un velo rosato,
 * sul bianco uno grigio, sulla lavagna pulita niente (scelte di Daniele,
 * 30/09/2026).
 *
 * Per ogni GRUPPO di timbri della gomma, sul livello dei tratti:
 *
 *   1. MASCHERA i timbri del gruppo in bianco su un canvas vuoto: e' la
 *               frazione che toglieranno, pixel per pixel;
 *   2. TOLTO    quel che c'e' sotto, ritagliato dalla maschera (source-in):
 *               e' esattamente il gesso che la gomma sta per rimuovere, col
 *               suo colore, alone compreso;
 *   3. GOMMA    si cancella come prima, in destination-out;
 *   4. ALONE    il tolto si rimette, a una frazione, in piu' copie spostate
 *               ALL'INDIETRO lungo il gesto: il velo resta sulla scia gia'
 *               pulita, strisciato. In avanti lo ricancellerebbe il gruppo
 *               successivo, e si ammucchierebbe in fondo alla passata.
 *
 * Ripassare pulisce di piu' da solo: ogni passata rimette una frazione della
 * frazione.
 *
 * PER GRUPPI, e non per timbro, dal 01/10/2026. Ogni volta che un canvas
 * legge un altro canvas, Chrome deve consegnare alla GPU tutto quel che
 * aveva in sospeso: misurato su un Galaxy S10, 2,2 ms a consegna sul thread
 * della GPU, di cui 1 ms di sola consegna a Vulkan. Timbro per timbro erano
 * tre consegne a timbro, 420 al secondo su uno zig-zag ampio: 5 fps, e il
 * ritardo si accumulava perche' ogni frame lento lasciava piu' timbri al
 * successivo. Per gruppi sono due consegne a gruppo.
 *
 * GRUPPI FISSI: [0, G), [G, 2G)... sempre gli stessi, dal vivo e dal modello.
 * Dal vivo un gruppo si incide quando tutti i suoi timbri sono definitivi
 * (resample() con `info`), dal modello tutti di fila: le due strade fanno le
 * stesse operazioni sugli stessi pixel, e lo schermo coincide con quel che
 * danno annulla, rotazione e immagine salvata.
 *
 * Quel che non e' ancora inciso — il gruppo in corso e la coda che la curva
 * sposta ancora — si vede lo stesso, sotto il dito, sul livello sopra: vedi
 * velaCoda().
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
 * Il rettangolo in pixel che i timbri [da, a) coprono. Intero e dentro il
 * canvas; null se vuoto. Serve a velaCoda(), che lavora solo li'.
 */
function ingombro(ctx, stroke, pts, da, a) {
  const n = count(pts);
  const fine = Math.min(a, n);
  if (fine <= da) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = da; i < fine; i++) {
    const x = pts[i * 3], y = pts[i * 3 + 1];
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  // Il timbro piu' largo sporge di poco oltre la larghezza nominale, come in
  // cancella(); 2 pixel per gli arrotondamenti.
  const r = stroke.width * 0.75;
  const m = ctx.getTransform();
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const px0 = Math.max(0, Math.floor((x0 - r) * m.a + m.e) - 2), py0 = Math.max(0, Math.floor((y0 - r) * m.a + m.f) - 2);
  const px1 = Math.min(W, Math.ceil((x1 + r) * m.a + m.e) + 2), py1 = Math.min(H, Math.ceil((y1 + r) * m.a + m.f) + 2);
  if (px1 <= px0 || py1 <= py0) return null;
  return { x: px0, y: py0, w: px1 - px0, h: py1 - py0 };
}

/**
 * Quanti timbri per gruppo. Il passo dei timbri della gomma e' un decimo
 * della sua larghezza: un gruppo da 6 ne copre sei decimi.
 *
 * Misurato su un Galaxy S10 il 01/10/2026, zig-zag ampio (velocita' doppia):
 * timbro per timbro 5 fps; gruppi da 2 -> 42; da 4 -> 56 (33); da 6 -> 59
 * (50); da 8 -> 59 (53). L'alone cambia poco e solo nella grana: rispetto
 * al timbro per timbro, coi gruppi da 6 cambia il 7,5% dei pixel, di 5
 * livelli su 255 in media (da 4: 6,1%; da 8: 8,9%). A occhio non si
 * distinguono. `?gruppo=` lo cambia per il confronto sul device (main.js).
 */
let gruppo = 6;
export const impostaGruppo = (v) => {
  const x = Math.round(Number(v));
  if (v !== null && v !== undefined && v !== '' && Number.isFinite(x)) gruppo = Math.min(32, Math.max(1, x));
};
export const gruppoAttuale = () => gruppo;

/**
 * Il canvas d'appoggio, grande quanto il rettangolo di un gruppo e non quanto
 * la lavagna. Cresce e non cala: schermo ed export hanno scale diverse.
 */
let appoggio = null;
function appoggiaFino(w, h) {
  if (!appoggio) appoggio = document.createElement('canvas').getContext('2d');
  const cv = appoggio.canvas;
  if (cv.width < w || cv.height < h) {
    cv.width = Math.max(cv.width, w);
    cv.height = Math.max(cv.height, h);
  }
  return appoggio;
}

/**
 * Incide i timbri [da, a) della gomma `stroke` su `ctx` (gia' in unita' di
 * lavagna), un gruppo alla volta, lasciando l'alone.
 *
 * `da` deve stare all'inizio di un gruppo: e' 0, o quel che ha restituito la
 * chiamata precedente. Un gruppo si incide solo intero, tranne l'ultimo del
 * tratto, che si incide quando `a` arriva alla fine (onEnd, render dal
 * modello).
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
  const w = stroke.width;
  // Il timbro piu' largo sporge di poco oltre la larghezza nominale (jitter,
  // impronte affiancate): un quarto in piu' basta.
  const raggio = w * 0.75;
  const indietro = w * COPIE[COPIE.length - 1].dietro;

  let g0 = da;
  for (;;) {
    const g1 = Math.min(g0 + gruppo, n);
    if (g1 <= g0 || g1 > fine) break;             // finito, o gruppo non ancora intero

    // Il verso del gruppo: la media dei versi dei suoi timbri, ciascuno
    // centrato come la normale di timbra(), che usa gli stessi vicini. Il
    // vicino dopo l'ultimo esiste gia' ed e' definitivo: dal vivo si incide
    // solo fino a stabili - 1.
    let dx = 0, dy = 0;
    let cx0 = Infinity, cy0 = Infinity, cx1 = -Infinity, cy1 = -Infinity;
    for (let i = g0; i < g1; i++) {
      const x = pts[i * 3], y = pts[i * 3 + 1];
      if (x < cx0) cx0 = x; if (x > cx1) cx1 = x;
      if (y < cy0) cy0 = y; if (y > cy1) cy1 = y;
      const p = Math.max(0, i - 1), q = Math.min(n - 1, i + 1);
      const tx = pts[q * 3] - pts[p * 3], ty = pts[q * 3 + 1] - pts[p * 3 + 1];
      const len = Math.hypot(tx, ty);
      if (len > 0) { dx += tx / len; dy += ty / len; }
    }
    const len = Math.hypot(dx, dy);
    if (len > 0) { dx /= len; dy /= len; } else { dx = 0; dy = 0; }

    // Il rettangolo in pixel: i timbri e la scia dietro, interi e dentro il
    // canvas. Tutte le passate lavorano solo li'.
    const ux0 = cx0 + Math.min(0, -dx * indietro) - raggio, ux1 = cx1 + Math.max(0, -dx * indietro) + raggio;
    const uy0 = cy0 + Math.min(0, -dy * indietro) - raggio, uy1 = cy1 + Math.max(0, -dy * indietro) + raggio;
    const px0 = Math.max(0, Math.floor(ux0 * k + m.e)), py0 = Math.max(0, Math.floor(uy0 * k + m.f));
    const px1 = Math.min(W, Math.ceil(ux1 * k + m.e)), py1 = Math.min(H, Math.ceil(uy1 * k + m.f));
    const pw = px1 - px0, ph = py1 - py0;

    if (pw > 0 && ph > 0) {
      // Nell'appoggio il rettangolo sta all'origine: (px0, py0) della
      // lavagna e' (0, 0) li'. Lo spostamento e' intero: stessi pixel.
      const tolto = appoggiaFino(pw, ph);

      // 1. La maschera: i timbri del gruppo, in bianco, sul vuoto.
      tolto.setTransform(1, 0, 0, 1, 0, 0);
      tolto.globalCompositeOperation = 'source-over';
      tolto.globalAlpha = 1;
      tolto.clearRect(0, 0, pw, ph);
      tolto.setTransform(m.a, m.b, m.c, m.d, m.e - px0, m.f - py0);
      timbra(tolto, pts, { ...opzioni, color: '#ffffff', da: g0, a: g1 });

      // 2. Il gesso che sta per andarsene: la lavagna dentro la maschera.
      //    source-in svuota anche quel che la sorgente non copre: fuori dal
      //    rettangolo, cioe' niente che serva.
      tolto.setTransform(1, 0, 0, 1, 0, 0);
      tolto.globalCompositeOperation = 'source-in';
      tolto.drawImage(ctx.canvas, px0, py0, pw, ph, 0, 0, pw, ph);
      tolto.globalCompositeOperation = 'source-over';
    }

    // 3. La gomma. Fuori dal canvas non fa nulla, ma timbra() salta da sola
    //    la sequenza dei timbri che precedono.
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    timbra(ctx, pts, { ...opzioni, da: g0, a: g1 });
    ctx.restore();

    // 4. L'alone, all'indietro lungo il gesto.
    if (pw > 0 && ph > 0) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      for (const { dietro, peso } of COPIE) {
        ctx.globalAlpha = alone * peso;
        const ox = -dx * dietro * w * k, oy = -dy * dietro * w * k;
        ctx.drawImage(appoggio.canvas, 0, 0, pw, ph, px0 + ox, py0 + oy, pw, ph);
      }
      ctx.restore();
    }
    g0 = g1;
  }
  return g0;
}

/**
 * La parte della gomma non ancora incisa, dal timbro `da` in poi, disegnata
 * sul livello SOPRA i tratti (`ov`, l'overlay, gia' vuoto e in unita' di
 * lavagna): il fondo della lavagna visto attraverso i timbri.
 *
 * A schermo e' la stessa cosa che cancellare: sopra un tratto di opacita'
 * `t`, un timbro di opacita' `g` lascia vedere fondo*g + (tratto su
 * fondo)*(1-g), che e' quel che lascia il destination-out, per qualunque
 * `t`. E costa zero consegne alla GPU: il fondo si dipinge una volta per
 * layout e poi non cambia.
 *
 * Fino alla -30 la coda si incideva sulla lavagna e al frame dopo si
 * rimetteva com'era da una foto: due letture di canvas a frame, piu' tre a
 * timbro per l'alone. L'alone qui non c'e': compare quando il gruppo si
 * incide, un frame o due dopo, sotto il dito.
 */
export function velaCoda(ov, fondo, stroke, pts, da) {
  const r = ingombro(ov, stroke, pts, da, Infinity);
  if (!r || !fondo) return;
  timbra(ov, pts, { color: '#ffffff', width: stroke.width, seed: stroke.seed, alpha: ERASER_ALPHA, da });
  ov.save();
  ov.setTransform(1, 0, 0, 1, 0, 0);
  ov.beginPath();
  ov.rect(r.x, r.y, r.w, r.h);
  ov.clip();
  ov.globalCompositeOperation = 'source-in';
  ov.drawImage(fondo, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
  ov.restore();
}
