/**
 * Costruisce uno stroke mentre il dito si muove.
 *
 * Divisione del lavoro:
 *   live         filtro One Euro, pseudo-pressione, e semplificazione
 *                INCREMENTALE dei punti gia' passati. Deve stare sotto i 16 ms.
 *   a fine gesto solo la breve coda ancora grezza.
 *
 * Perche' incrementale e non tutto alla fine, come diceva il brief: con una
 * semplificazione globale a pointerup il tratto cambiava forma nel momento in
 * cui si alzava il dito — con eps 10 si spostava il 42% dei pixel — e il
 * salto si vedeva. Consolidando via via, i punti gia' passati non si toccano
 * piu' e cio' che si vede mentre si disegna e' gia' cio' che verra' salvato.
 *
 * Il ricampionamento non avviene qui: appartiene al render, che lo rifa da
 * capo a ogni ridisegno. Conservarlo nel modello moltiplicherebbe per dieci
 * il payload senza aggiungere informazione.
 */

import { createOneEuro2D } from './filter.js';
import { simplify, STRIDE } from './geom.js';
import { createStroke } from './model.js';
import { ONE_EURO, RDP_EPSILON, SPEED_MAX } from './palette.js';

/** Quanti punti grezzi far accumulare prima di consolidarne un pezzo. */
const FINESTRA = 12;

/**
 * Quanti punti restano grezzi in fondo. Servono da contesto: semplificare
 * fino all'ultimo campione disponibile darebbe decisioni diverse un istante
 * dopo, ed e' esattamente il tremolio che si vuole evitare.
 */
const CODA = 4;

/**
 * Pseudo-pressione dalla velocita': lento = pieno, veloce = sottile.
 * E' cio' che rende il tratto "vivo" quando non c'e' uno stilo che misuri
 * la pressione vera.
 */
const pressureFromSpeed = (speed) => 1 - Math.min(Math.max(speed / SPEED_MAX, 0), 1);

export function createPen({ tool = 'chalk', color, width, oneEuro = ONE_EURO, eps = RDP_EPSILON }) {
  const filter = createOneEuro2D(oneEuro);
  let stroke = null;
  let stabili = 0;       // quanti punti sono gia' semplificati e non cambiano piu'
  let smoothed = 1;      // pressione, filtrata a parte
  let usePenPressure = false;

  /**
   * Semplifica il tratto dai punti stabili in poi, lasciando grezza la coda.
   * L'ultimo punto stabile entra nel calcolo come ancora, cosi' la giunzione
   * non forma uno scalino, e poi viene scartato dal risultato.
   */
  function consolida() {
    // eps 0 disattiva la semplificazione. La usa la gomma: i suoi timbri
    // vengono applicati dal vivo e in modo incrementale, e se i punti
    // cambiassero sotto l'indice dei timbri gia' applicati non corrisponderebbe
    // piu' — al rilascio la cancellazione farebbe un salto.
    if (!stroke || eps <= 0) return;
    const n = stroke.pts.length / STRIDE;
    const fine = n - CODA;
    const da = Math.max(0, stabili - 1);
    if (fine - da < 3) return;

    const testa = stroke.pts.slice(0, da * STRIDE);
    const mezzo = simplify(stroke.pts.slice(da * STRIDE, fine * STRIDE), eps);
    const coda = stroke.pts.slice(fine * STRIDE);

    stroke.pts = testa.concat(mezzo, coda);
    stabili = (testa.length + mezzo.length) / STRIDE;
  }

  return {
    /** @returns {object} lo stroke in costruzione, gia' con il primo punto */
    begin(p) {
      filter.reset();
      stroke = createStroke({ tool, color, width });
      stabili = 0;
      usePenPressure = p.pointerType === 'pen' && p.pressure > 0;
      smoothed = usePenPressure ? p.pressure : 1;   // il tratto nasce pieno

      const o = filter.filter(p.x, p.y, p.t);
      stroke.pts.push(o.x, o.y, smoothed);
      return stroke;
    },

    /**
     * @param {Array} points campioni grezzi dall'input
     * @returns {number} indice del primo punto aggiunto, per il disegno incrementale
     */
    extend(points) {
      if (!stroke) return 0;
      const prima = stroke.pts.length / STRIDE;

      for (const p of points) {
        const o = filter.filter(p.x, p.y, p.t);
        const target = usePenPressure ? p.pressure : pressureFromSpeed(o.speed);
        // La velocita' e' rumorosa anche dopo il filtro sulla posizione: senza
        // questo passaggio la larghezza pulserebbe lungo il tratto.
        smoothed += (target - smoothed) * 0.25;
        stroke.pts.push(o.x, o.y, smoothed);
      }

      if (stroke.pts.length / STRIDE - stabili > FINESTRA) consolida();
      return prima;
    },

    /**
     * Chiude il tratto SENZA ritoccare la coda ancora grezza.
     *
     * Risemplificarla sposterebbe la curva di un paio di unita' proprio nel
     * momento in cui si alza il dito, e il tratto "salterebbe". Restano quattro
     * punti in piu' nel modello — nulla, a fronte di cio' che si vede.
     */
    end() {
      if (!stroke) return null;
      const s = stroke;
      stroke = null;
      return s.pts.length ? s : null;
    },

    get active() { return stroke !== null; },
    /** Lo stroke in costruzione, per disegnarlo prima che sia chiuso. */
    get current() { return stroke; },
  };
}
