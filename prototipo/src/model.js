/**
 * Modello dati (D1). La source of truth e' questa struttura, non un'immagine:
 * il PNG e' un derivato che si rigenera a qualsiasi risoluzione.
 *
 * Drawing {
 *   version, board: {w, h},
 *   strokes: [ Stroke ]
 * }
 * Stroke {
 *   id, tool: 'chalk'|'eraser', color, width,
 *   seed,                       // PRNG riproducibile, serve dalla Fase 3
 *   pts: [x, y, p, ...]         // coordinate lavagna, p = pseudo-pressione
 * }
 *
 * Gli stroke conservano i punti DOPO il filtro e la semplificazione, non quelli
 * ricampionati: il resampling a 2,5 unita' moltiplicherebbe per dieci il
 * payload, e viene rifatto al render, dove costa nulla ed e' deterministico.
 */

import { BOARD_W, boardHeight } from './palette.js';

export const VERSION = 1;

let nextId = 1;

export function createDrawing() {
  return {
    version: VERSION,
    board: { w: BOARD_W, h: boardHeight() },
    strokes: [],
  };
}

/** Seed a 32 bit, generato una volta sola e mai piu' toccato (vedi D1). */
export const makeSeed = () => (Math.random() * 0x100000000) >>> 0;

export function createStroke({ tool = 'chalk', color, width, seed = makeSeed() }) {
  return { id: nextId++, tool, color, width, seed, pts: [] };
}

/**
 * Undo e redo. Con gli stroke in un array costano quanto un pop, che e' il
 * motivo per cui D1 sceglie il vettoriale.
 */
export function createHistory(drawing, { maxRedo = 50 } = {}) {
  const redoStack = [];

  return {
    drawing,

    add(stroke) {
      drawing.strokes.push(stroke);
      redoStack.length = 0;         // un tratto nuovo chiude i futuri alternativi
    },

    undo() {
      const s = drawing.strokes.pop();
      if (!s) return false;
      redoStack.push(s);
      if (redoStack.length > maxRedo) redoStack.shift();
      return true;
    },

    redo() {
      const s = redoStack.pop();
      if (!s) return false;
      drawing.strokes.push(s);
      return true;
    },

    /**
     * Il cestino NON e' annullabile: undo e redo lavorano sul singolo stroke, e
     * infilare qui un'operazione di natura diversa richiederebbe un vero stack
     * di comandi. La protezione contro il tocco accidentale e' la conferma
     * prevista in Fase 4, non l'undo.
     */
    clear() {
      if (!drawing.strokes.length) return false;
      drawing.strokes.length = 0;
      redoStack.length = 0;
      return true;
    },

    get canUndo() { return drawing.strokes.length > 0; },
    get canRedo() { return redoStack.length > 0; },
    get count() { return drawing.strokes.length; },
  };
}
