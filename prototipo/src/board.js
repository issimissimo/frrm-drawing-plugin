/**
 * La lavagna fisica: dimensiona i canvas, gestisce il DPR e traduce le
 * coordinate dello schermo in coordinate della lavagna logica.
 *
 * Scelta portante: i contesti vengono trasformati una volta sola, cosi' che
 * TUTTO il codice di disegno lavori in unita' di lavagna (0..1600, 0..1200) e
 * non sappia nulla di pixel, DPR o dimensioni della finestra. E' la premessa
 * della funzione di render pura.
 *
 * Due livelli sovrapposti:
 *   base     i tratti conclusi. Persistente, si ridisegna solo quando serve.
 *   overlay  il tratto in corso. Si cancella a ogni frame.
 *
 * Servono perche' a fine gesto lo stroke grezzo viene sostituito da quello
 * semplificato: con un canvas solo, cancellare il tratto provvisorio
 * costringerebbe a un ridisegno completo a ogni tratto.
 */

import { BOARD_W, boardHeight, freezeBoardHeight, DPR_CAP } from './palette.js';

export function createBoard(baseCanvas, overlayCanvas, host) {
  // Trasparente, non opaco: il colore della lavagna sta nel CSS sotto il
  // canvas. Se il fondo fosse dipinto qui, il cancellino — che lavora in
  // destination-out — aprirebbe buchi trasparenti invece di scoprire la
  // lavagna.
  const base = baseCanvas.getContext('2d');
  const overlay = overlayCanvas.getContext('2d');

  /**
   * Rect in coordinate viewport. Rileggerlo a ogni pointermove costerebbe un
   * reflow, quindi si tiene in cache — ma si rilegge all'inizio di OGNI
   * gesto, con refreshRect() qui sotto.
   *
   * Il commento che stava qui diceva: «la pagina non scrolla mai (body e'
   * fixed), quindi basta invalidarlo al resize». Era vero finche' la lavagna
   * era una pagina a se'. Dal 23/09/2026 vive in un iframe dentro una pagina
   * WordPress, e li' il canvas puo' SPOSTARSI senza CAMBIARE DIMENSIONE:
   * basta che la barra degli indirizzi di Chrome Android si ritragga. Nessun
   * resize, nessun ResizeObserver — e il tratto esce sfalsato dal dito.
   */
  let rect = null;
  let scale = 1;
  let cssW = 0, cssH = 0, dpr = 1;

  function layout() {
    const availW = host.clientWidth;
    const availH = host.clientHeight;

    // Il rapporto della lavagna si decide qui, alla prima chiamata, e da
    // quel momento e' fisso: vedi freezeBoardHeight(). Ruotare il telefono
    // dopo lascia delle bande, ma non tocca quel che c'e' gia' disegnato.
    freezeBoardHeight(availW / availH);
    const aspect = BOARD_W / boardHeight();

    cssW = availW;
    cssH = cssW / aspect;
    if (cssH > availH) { cssH = availH; cssW = cssH * aspect; }

    dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    const pxW = Math.round(cssW * dpr);
    const pxH = Math.round(cssH * dpr);

    for (const [cv, ctx] of [[baseCanvas, base], [overlayCanvas, overlay]]) {
      cv.style.width = `${cssW}px`;
      cv.style.height = `${cssH}px`;
      cv.width = pxW;
      cv.height = pxH;
      ctx.setTransform(pxW / BOARD_W, 0, 0, pxW / BOARD_W, 0, 0);
    }

    scale = pxW / BOARD_W;
    rect = baseCanvas.getBoundingClientRect();
    return { cssW, cssH, dpr, scale };
  }

  /**
   * Rilegge la posizione del canvas. Si chiama a ogni pointerdown, cioe' una
   * volta per gesto e non una volta per campione: il reflow e' pagato una
   * volta ogni tratto, dove non si vede, invece che cinquanta volte al
   * secondo, dove si vedrebbe.
   */
  function refreshRect() {
    rect = baseCanvas.getBoundingClientRect();
    return rect;
  }

  /** Schermo -> lavagna. L'unico punto del programma dove avviene. */
  function toBoard(clientX, clientY) {
    if (!rect) rect = baseCanvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * BOARD_W,
      y: ((clientY - rect.top) / rect.height) * boardHeight(),
    };
  }

  /**
   * Svuota in pixel, non in unita' di lavagna: larghezza e altezza dei canvas
   * sono arrotondate a interi e il loro rapporto non e' 4:3 esatto, quindi un
   * clearRect(0, 0, 1600, 1200) lascerebbe una frangia sporca.
   */
  function clearBase() {
    base.save();
    base.setTransform(1, 0, 0, 1, 0, 0);
    base.clearRect(0, 0, baseCanvas.width, baseCanvas.height);
    base.restore();
  }

  /**
   * Trasferisce il tratto in corso sul livello persistente cosi' com'e'.
   *
   * Ri-renderizzarlo dal modello darebbe un risultato leggermente diverso —
   * l'ultimo campione cambia la curva e il numero di impronte — e il tratto
   * "salterebbe" nel momento in cui si alza il dito. Copiando i pixel, quel
   * che si e' visto disegnare resta esattamente com'era.
   */
  function commitOverlay() {
    base.save();
    base.setTransform(1, 0, 0, 1, 0, 0);
    base.drawImage(overlayCanvas, 0, 0);
    base.restore();
  }

  function clearOverlay() {
    overlay.save();
    overlay.setTransform(1, 0, 0, 1, 0, 0);
    overlay.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    overlay.restore();
  }

  return {
    base,
    overlay,
    canvas: baseCanvas,
    layout,
    refreshRect,
    toBoard,
    clearBase,
    clearOverlay,
    commitOverlay,
    get scale() { return scale; },
    get info() { return { cssW, cssH, dpr, px: `${baseCanvas.width}x${baseCanvas.height}` }; },
  };
}
