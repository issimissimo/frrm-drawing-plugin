/**
 * Scarica il disegno come JPEG (fase-0-specifiche.md §7).
 *
 * Fetta anticipata della Fase 6: tutto avviene sul device, nessun server e
 * nessun dato in uscita. Manca il logo della Fondazione (§7.1), che e' una
 * dipendenza esterna: quando arrivera' si compone qui dentro, in
 * disegnaSuCanvas(), dopo i tratti.
 *
 * Tre scelte non ovvie, in ordine di importanza:
 *
 *  1. L'immagine si ri-renderizza DAL MODELLO, non si copia dal canvas a
 *     schermo. Il canvas a schermo e' grande quanto il viewport — su un
 *     telefono 780 px — mentre l'export deve stare a 1600 (§7.4). Il prezzo e'
 *     quello gia' noto: la grana del gesso cambia (~30% dei pixel), la forma
 *     no. Chi confronta il file scaricato con lo schermo trovera' lo stesso
 *     disegno, non gli stessi pixel.
 *
 *  2. Il fondo si dipinge DOPO i tratti, in destination-over. Dipingerlo prima
 *     sarebbe piu' naturale, ma il cancellino lavora in destination-out e se
 *     lo trovasse sotto lo bucherebbe: l'utente ritroverebbe le gommate come
 *     macchie nere (il JPEG non ha alpha e appiattisce il trasparente su nero).
 *     E' lo stesso motivo per cui a schermo il fondo sta nel CSS.
 *
 *  3. Il Blob si costruisce in modo SINCRONO, via toDataURL + atob, non con
 *     canvas.toBlob. Non e' pignoleria: navigator.share() esige di essere
 *     chiamato mentre l'attivazione dell'utente e' ancora valida, e su Safari
 *     iOS una callback asincrona la perde — il foglio di condivisione non si
 *     apre piu' e non c'e' modo di accorgersene senza un iPhone in mano.
 */

import { BOARD_BG } from './palette.js';
import { render } from './render.js';

/** 0.92 sta sotto i 400 KB su un disegno pieno e non mostra artefatti sul nero. */
export const JPEG_QUALITY = 0.92;

/** §7.4: basta per uno sfondo di telefono e per una stampa A5. */
export const EXPORT_W = 1600;

/** lavagna-20260916-1843.jpg */
export function nomeFile(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `lavagna-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`
       + `-${p(d.getHours())}${p(d.getMinutes())}.jpg`;
}

/**
 * Un disegno di sole gommate e' una lavagna vuota: il pulsante non deve
 * offrirsi. history.count non basta, perche' conta anche i tratti del
 * cancellino.
 */
export const haDisegno = (drawing) => drawing.strokes.some((s) => s.tool !== 'eraser');

/** Le dimensioni in pixel dell'export: il rapporto e' quello della lavagna. */
export function dimensioni(drawing, larghezza = EXPORT_W) {
  return { w: larghezza, h: Math.round((larghezza * drawing.board.h) / drawing.board.w) };
}

/** Il disegno su un canvas nuovo, opaco, pronto per il JPEG. */
export function disegnaSuCanvas(drawing, larghezza = EXPORT_W) {
  const { w, h } = dimensioni(drawing, larghezza);
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d');

  // Come board.js: il contesto passa in unita' di lavagna una volta sola, e
  // il render non sa nulla della risoluzione a cui sta lavorando.
  const k = w / drawing.board.w;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  render(drawing, ctx);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'destination-over';
  ctx.fillStyle = BOARD_BG;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';

  return cv;
}

/** Sincrono di proposito: vedi la nota 3 in testa al file. */
export function esportaJpeg(drawing, larghezza = EXPORT_W) {
  const url = disegnaSuCanvas(drawing, larghezza).toDataURL('image/jpeg', JPEG_QUALITY);
  const bin = atob(url.slice(url.indexOf(',') + 1));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: 'image/jpeg' });
}

/**
 * Su telefono il foglio di condivisione e' l'unico modo di finire in Foto: un
 * <a download> su iOS Safari mette il file nei Download del browser, dove
 * nessuno lo ritrova (§7.3).
 *
 * Ma vale solo su telefono. Chrome su Windows dichiara navigator.canShare, e
 * seguirlo aprirebbe il pannello di condivisione di Windows a chi ha premuto
 * "Scarica" aspettandosi un file in Download. Il puntatore grosso e' il
 * discrimine giusto: non e' il sistema operativo, e' il dito.
 */
const daCondividere = (file) => {
  const dito = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  return Boolean(dito && navigator.canShare && navigator.canShare({ files: [file] }));
};

function salvaComeFile(blob, nome) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revocare subito taglia il download a meta' su qualche browser: il click
  // ha solo avviato la lettura del blob.
  setTimeout(() => URL.revokeObjectURL(url), 20000);
}

/**
 * @returns {Promise<'condiviso'|'scaricato'|'annullato'>} come e' finita.
 *   Va chiamata direttamente dal gestore del click, senza await prima.
 */
export function scarica(drawing, larghezza = EXPORT_W) {
  const nome = nomeFile();
  const blob = esportaJpeg(drawing, larghezza);
  const file = new File([blob], nome, { type: 'image/jpeg' });

  // Solo files: aggiungere title o text fa scartare il file a piu' di un
  // target di condivisione.
  if (daCondividere(file)) {
    return navigator.share({ files: [file] })
      .then(() => 'condiviso')
      .catch((e) => {
        // L'annullamento e' una scelta dell'utente e si rispetta. Tutto il
        // resto — attivazione scaduta, target che rifiuta il file — e' un
        // guasto: meglio un download nei Download che niente.
        if (e && e.name === 'AbortError') return 'annullato';
        salvaComeFile(blob, nome);
        return 'scaricato';
      });
  }

  salvaComeFile(blob, nome);
  return Promise.resolve('scaricato');
}
