/**
 * Render puro e deterministico.
 *
 * Il contesto arriva GIA' trasformato in unita' di lavagna (vedi board.js):
 * queste funzioni non sanno nulla di pixel, DPR o dimensioni della finestra.
 * E' cosi' che la Definition of Done — "lo stesso Drawing a scale diverse da
 * la stessa immagine, scalata" — e' vera per costruzione invece che per
 * attenzione.
 *
 * Nessuno stato interno e nessun Math.random: l'irregolarita' del gesso viene
 * dal seed dello stroke, quindi due render dello stesso Drawing producono gli
 * stessi identici pixel.
 */

import { ERASER_ALPHA, CHALK_ALPHA } from './palette.js';
import { resample, count } from './geom.js';
import { timbra, passoTimbri } from './chalk.js';

/**
 * I punti dove verra' posata un'impronta. Deterministica.
 *
 * Il passo dipende dalla larghezza del tratto, non e' la costante usata per
 * la polilinea: le impronte sono larghe quanto il tratto, quindi distanziarle
 * di un terzo basta a non lasciare buchi, e un passo fisso di 2,5 unita'
 * moltiplicherebbe per nove il lavoro senza cambiare il risultato.
 */
export const strokeGeometry = (stroke) => resample(stroke.pts, passoTimbri(stroke.width));

/**
 * @param {number} da indice del primo timbro da disegnare. Serve alla gomma,
 *   che va applicata solo sul tratto nuovo (vedi chalk.js).
 * @returns {number} quanti timbri compongono il tratto, per sapere da dove
 *   riprendere alla chiamata successiva.
 */
export function renderStroke(ctx, stroke, da = 0) {
  const pts = strokeGeometry(stroke);
  if (count(pts) === 0) return 0;

  const cancella = stroke.tool === 'eraser';
  ctx.save();
  if (cancella) {
    // Il cancellino toglie invece di aggiungere, ma resta granuloso: un
    // rettangolo netto sarebbe l'unica cosa, in tutta la lavagna, a non
    // sembrare gesso. Il fondo non e' dipinto su questo canvas, quindi
    // cancellare scopre la lavagna anziche' aprire un buco nero.
    ctx.globalCompositeOperation = 'destination-out';
  }
  timbra(ctx, pts, {
    color: cancella ? '#000' : stroke.color,
    width: stroke.width,
    seed: stroke.seed,
    alpha: cancella ? ERASER_ALPHA : CHALK_ALPHA,
    da,
  });
  ctx.restore();
  return count(pts);
}

/** Disegna l'intero Drawing sul contesto, che deve essere gia' vuoto. */
export function render(drawing, ctx) {
  for (const s of drawing.strokes) renderStroke(ctx, s);
}
