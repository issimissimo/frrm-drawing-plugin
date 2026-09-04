/**
 * One Euro Filter — Casiez, Roussel, Vogel (CHI 2012).
 *
 * Perche' non una media mobile: quella applica lo stesso smoothing sempre, e
 * il prezzo si paga come lag visibile sul gesto veloce ("il tratto molleggia").
 * One Euro adatta il taglio alla velocita': tanto smoothing a mano ferma, dove
 * serve a togliere il tremolio, quasi nessuno a mano veloce, dove il tremolio
 * non c'e' e il lag invece si vedrebbe.
 *
 * Due parametri da tarare:
 *   minCutoff  piu' basso  -> piu' fermo a bassa velocita' (ma piu' lag)
 *   beta       piu' alto   -> reagisce prima ai gesti rapidi (ma piu' tremolio)
 */

const alphaFor = (cutoff, dt) => {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
};

const lowpass = (alpha, x, prev) => alpha * x + (1 - alpha) * prev;

function createChannel(minCutoff, beta, dCutoff) {
  let xPrev = null;
  let dxPrev = 0;

  return {
    reset() { xPrev = null; dxPrev = 0; },
    /** @param {number} x @param {number} dt secondi dal campione precedente */
    filter(x, dt) {
      if (xPrev === null) { xPrev = x; return x; }
      const dx = (x - xPrev) / dt;
      const dxHat = lowpass(alphaFor(dCutoff, dt), dx, dxPrev);
      dxPrev = dxHat;
      // Il cutoff sale con la velocita': e' tutto il trucco del filtro.
      const cutoff = minCutoff + beta * Math.abs(dxHat);
      const xHat = lowpass(alphaFor(cutoff, dt), x, xPrev);
      xPrev = xHat;
      return xHat;
    },
  };
}

export function createOneEuro2D({ minCutoff = 1.0, beta = 0.007, dCutoff = 1.0 } = {}) {
  const fx = createChannel(minCutoff, beta, dCutoff);
  const fy = createChannel(minCutoff, beta, dCutoff);
  let tPrev = null;
  let last = null;      // ultimo punto filtrato, per la velocita'

  return {
    reset() { fx.reset(); fy.reset(); tPrev = null; last = null; },

    /**
     * @param {number} x @param {number} y in unita' di lavagna
     * @param {number} t timestamp in ms
     * @returns {{x:number, y:number, speed:number}} speed in unita'/secondo
     */
    filter(x, y, t) {
      // dt puo' risultare zero: performance.now() e' quantizzato a 1 ms su
      // Safari e due campioni possono cadere nello stesso tick.
      const dt = tPrev === null ? 1 / 60 : Math.max((t - tPrev) / 1000, 0.001);
      tPrev = t;

      const nx = fx.filter(x, dt);
      const ny = fy.filter(y, dt);

      // Velocita' misurata sul segnale filtrato: quella sul segnale grezzo
      // porta dentro il rumore che si e' appena tolto.
      const speed = last === null ? 0 : Math.hypot(nx - last.x, ny - last.y) / dt;
      last = { x: nx, y: ny };
      return { x: nx, y: ny, speed };
    },
  };
}
