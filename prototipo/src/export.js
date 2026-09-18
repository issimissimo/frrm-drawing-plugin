/**
 * Scarica il disegno come JPEG (fase-0-specifiche.md §7).
 *
 * Fetta anticipata della Fase 6: tutto avviene sul device, nessun server e
 * nessun dato in uscita.
 *
 * Quattro scelte non ovvie, in ordine di importanza:
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
 *
 *  4. Il logo si PRECARICA all'avvio e si compone in modo sincrono. Discende
 *     dal punto 3: al momento del click non c'e' tempo per un decode. Se il
 *     file non fosse pronto, l'immagine esce senza logo invece di non uscire.
 */

import { BOARD_W, BOARD_BG, SOGLIA_STRETTA } from './palette.js';
import { render } from './render.js';

/** 0.92 sta sotto i 400 KB su un disegno pieno e non mostra artefatti sul nero. */
export const JPEG_QUALITY = 0.92;

/** §7.4: basta per uno sfondo di telefono e per una stampa A5. */
export const EXPORT_W = 1600;

/* --- Il logo della Fondazione (§7.1) --------------------------------------

   Va SOLO sull'immagine che l'utente si porta via. Il PNG che in Fase 6
   partira' per la moderazione, e quello che finira' nella gallery, non lo
   hanno (§7.2): sul sito della Fondazione il logo sarebbe ridondante e
   ruberebbe spazio al disegno.

   Per questo il logo e' un PARAMETRO e vale zero se non lo si chiede: chi
   aggiungera' l'invio non deve ricordarsi di toglierlo, deve ricordarsi di
   metterlo — e non lo fara'. */

/**
 * Risolto sul modulo, non sulla pagina: un `src` relativo si risolverebbe
 * sull'URL del documento, e in Fase 8 il documento sara' una pagina di
 * WordPress che sta altrove. Cosi' il logo segue il codice ovunque finisca.
 */
export const LOGO_SRC = new URL('../images/logo.png', import.meta.url).href;

/** §7.1: distanza dai due bordi, in unita' di lavagna. */
export const LOGO_MARGINE = 40;

/**
 * Larghezza del logo, in unita' di lavagna (l'export a 1600 le rende 1:1).
 *
 * Due misure e non una perche' l'immagine salvata non ha un formato solo:
 * su telefono e' un ritratto alto quasi 3500 unita', dove 220 sarebbero un
 * francobollo; su desktop e' un panorama, dove un terzo della larghezza
 * coprirebbe il disegno.
 *
 *   stretta  un terzo della lavagna  (chiesto come "1/3 vw": su telefono la
 *            lavagna e' larga quanto il viewport, quindi e' la stessa cosa)
 *   larga    220 unita', il 13,75% della larghezza
 */
export const LOGO_W_STRETTA = Math.round(BOARD_W / 3);
export const LOGO_W_LARGA = 220;

/** La stessa soglia che raddoppia gli strumenti: "stretto" e' uno solo. */
export const larghezzaLogo = (cssW) => (cssW < SOGLIA_STRETTA ? LOGO_W_STRETTA : LOGO_W_LARGA);

/** In unita' di lavagna: il contesto dell'export e' gia' trasformato. */
export function rettangoloLogo(larghezza, aspetto) {
  return {
    x: LOGO_MARGINE,
    y: LOGO_MARGINE,
    w: larghezza,
    h: aspetto > 0 ? larghezza / aspetto : 0,
  };
}

/** Riempita da precaricaLogo(). Letta in modo sincrono al momento del salvataggio. */
let logo = null;

/**
 * Da chiamare all'avvio, una volta. Non fallisce mai in modo rumoroso: un
 * logo mancante e' un difetto dell'immagine, non un motivo per non salvarla.
 *
 * @returns {Promise<boolean>} se il logo e' utilizzabile.
 */
export function precaricaLogo(src = LOGO_SRC) {
  const img = new Image();
  img.src = src;
  return img
    .decode()
    .then(() => { logo = img; return true; })
    .catch(() => {
      console.warn(`Logo non caricato (${src}): l'immagine salvata ne sara' priva.`);
      return false;
    });
}

export const logoPronto = () => logo !== null;

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

/**
 * Il disegno su un canvas nuovo, opaco, pronto per il JPEG.
 *
 * @param {number} logoW larghezza del logo in unita' di lavagna. 0 = niente
 *   logo, ed e' il default: vedi la nota sopra LOGO_SRC.
 */
export function disegnaSuCanvas(drawing, larghezza = EXPORT_W, logoW = 0) {
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

  // Sopra i tratti, ma prima del fondo: il logo ha l'alpha e i suoi vuoti
  // devono lasciar passare la lavagna, non restare neri.
  if (logoW > 0 && logo) {
    const r = rettangoloLogo(logoW, logo.naturalWidth / logo.naturalHeight);
    // Il file e' 512 px e a schermo largo scende a 220: senza questo, su
    // Chrome la riduzione e' bilineare e il testo del logo si sgrana.
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(logo, r.x, r.y, r.w, r.h);
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'destination-over';
  ctx.fillStyle = BOARD_BG;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';

  return cv;
}

/** Sincrono di proposito: vedi la nota 3 in testa al file. */
export function esportaJpeg(drawing, larghezza = EXPORT_W, logoW = 0) {
  const url = disegnaSuCanvas(drawing, larghezza, logoW).toDataURL('image/jpeg', JPEG_QUALITY);
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
 * @param {number} logoW larghezza del logo in unita' di lavagna: questa e'
 *   l'immagine che l'utente si porta via, quindi il logo ci va (§7.2).
 * @returns {Promise<'condiviso'|'scaricato'|'annullato'>} come e' finita.
 *   Va chiamata direttamente dal gestore del click, senza await prima.
 */
export function scarica(drawing, logoW = 0, larghezza = EXPORT_W) {
  const nome = nomeFile();
  const blob = esportaJpeg(drawing, larghezza, logoW);
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
