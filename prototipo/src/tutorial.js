/**
 * Fase 4b — il tutorial.
 *
 * Sette passi, ognuno con una finestra al centro e l'area spiegata in luce
 * dentro un velo scuro, cerchiata di gesso. Chiesto dal cliente il
 * 17/09/2026: alcuni aprono la lavagna e non capiscono cosa devono fare.
 *
 * Tre cose non ovvie, tutte trovate nella prova di design (design-tutorial/):
 *
 *  - Il riquadro si prende dall'ELEMENTO, mai da coordinate scritte a mano:
 *    sotto i 700 px la mensola cambia griglia e quel che sta a destra finisce
 *    in mezzo. Con piu' selettori si unisce il rettangolo di tutti, che serve
 *    ad annulla/rifai — due pulsanti, un concetto.
 *
 *  - La finestra "al centro" non puo' stare al centro: al primo passo l'area
 *    in luce E' il centro e la finestra coprirebbe quel che spiega. Sta nella
 *    meta' opposta a quella dove cade l'area.
 *
 *  - Il velo intercetta i tocchi, e va bene cosi': mentre il tutorial e'
 *    aperto non si disegna e non si toccano gli strumenti.
 *
 * Il modulo si importa anche da node per i test, quindi qui dentro non si
 * tocca il DOM fuori dalle funzioni.
 */

/** Prefisso della chiave del "gia' visto". Cambiarlo fa ripartire il tutorial. */
export const CHIAVE_VISTO = 'lavagna.tutorial.visto.v1';

const percorsoCorrente = () => (typeof location === 'undefined' ? '/' : location.pathname);

/**
 * La chiave porta dentro il percorso della pagina, e non e' un vezzo.
 *
 * localStorage e' per ORIGINE, non per cartella: tutte le versioni pubblicate
 * sotto issimissimo.com/temp/ condividono lo stesso archivio. Con una chiave
 * fissa, chi aveva visto il tutorial su una cartella non lo vedeva piu' su
 * quella pubblicata dopo — e la pubblicazione in cartelle numerate, che serve
 * a battere la cache di SiteGround, faceva sparire proprio la cosa da
 * provare. Succeduto il 17/09/2026 fra la -03 e la -04.
 *
 * In produzione la lavagna sta a un solo indirizzo, quindi il comportamento e'
 * quello voluto. Se un giorno quella pagina cambiasse percorso il tutorial
 * ripartirebbe una volta per tutti: prezzo accettabile, e preferibile al suo
 * contrario.
 */
export const chiaveVisto = (percorso = percorsoCorrente()) => `${CHIAVE_VISTO}:${percorso}`;

/**
 * I passi, come dati.
 *
 * `sel` e' un selettore CSS, anche multiplo. `pad` allarga il riquadro
 * attorno all'elemento; negativo lo stringe, che serve alla lavagna — il suo
 * bordo e' gia' il bordo dello schermo.
 *
 * `{cosa}` diventa "con il dito" o "con il mouse": vedi testoStep().
 */
export const STEPS = [
  { sel: '#layers',            pad: -10, testo: 'Disegna nell’area tratteggiata {cosa}.' },
  { sel: '#chalks',                      testo: 'Scegli il colore del gessetto.' },
  { sel: '#widths',                      testo: 'Un gessetto sottile, medio o grosso?' },
  { sel: '#tool-eraser',                 testo: 'Il cancellino toglie un pezzo di disegno.' },
  { sel: '#btn-undo,#btn-redo',          testo: 'Hai sbagliato un segno? Torna indietro.' },
  { sel: '#btn-clear',                   testo: 'Butta via tutto e ricomincia da zero.' },
  { sel: '#btn-save',                    testo: 'Salva e condividi il disegno. Inoltre i più belli li faremo vedere a tutti!' },
];

/**
 * Il testo del passo.
 *
 * `coarse` viene da `pointer: coarse`, non dalla larghezza dello schermo: e'
 * lo stesso criterio con cui export.js decide del foglio di condivisione, e
 * dice quel che serve davvero — con che cosa si tocca lo schermo. Un tablet
 * grande resta "dito", una finestra desktop stretta resta "mouse".
 */
export function testoStep(i, coarse) {
  return STEPS[i].testo.replace('{cosa}', coarse ? 'con il dito' : 'con il mouse');
}

/**
 * Il rettangolo che racchiude tutti quelli passati, allargato di `pad`.
 * Torna null su una lista vuota: un passo che punta a un elemento che non
 * esiste non deve far cadere il tutorial.
 */
export function areaUnione(rects, pad = 8) {
  if (!rects || !rects.length) return null;
  const L = Math.min(...rects.map((r) => r.left));
  const T = Math.min(...rects.map((r) => r.top));
  const R = Math.max(...rects.map((r) => r.right));
  const B = Math.max(...rects.map((r) => r.bottom));
  return { left: L - pad, top: T - pad, width: (R - L) + pad * 2, height: (B - T) + pad * 2 };
}

/**
 * Dove mettere la finestra perche' non copra l'area in luce.
 *
 * Sta nella meta' opposta a quella dove cade il centro dell'area, e comunque
 * dentro lo schermo: su un telefono corto la finestra e la mensola insieme
 * possono non starci, e allora meglio una finestra visibile che una centrata.
 */
export function posizionaFinestra(area, viewportH, panelH, margine = 18) {
  const areaInBasso = (area.top + area.height / 2) > viewportH / 2;
  const centrata = (viewportH - panelH) / 2;
  const top = areaInBasso
    ? Math.min(area.top - panelH - margine, centrata)
    : Math.max(area.top + area.height + margine, centrata);
  // Il minimo vince sul massimo: con poco spazio la finestra resta a vista.
  return Math.max(margine, Math.min(top, viewportH - panelH - margine));
}

/** Se il tutorial e' gia' stato visto su questo device. */
export function giaVisto(store = globalThis.localStorage, percorso = percorsoCorrente()) {
  // In Safari privato il solo accesso a localStorage lancia: senza la guardia
  // il modulo muore all'avvio e la lavagna non si apre affatto.
  try { return store.getItem(chiaveVisto(percorso)) === '1'; } catch { return false; }
}

export function segnaVisto(store = globalThis.localStorage, percorso = percorsoCorrente()) {
  try { store.setItem(chiaveVisto(percorso), '1'); return true; } catch { return false; }
}

/* ---------------- il pezzo che tocca il DOM ---------------- */

/**
 * Crea il tutorial sugli elementi passati. Non li cerca da solo: main.js li
 * prende con la sua guardia, che esiste per un motivo (vedi README).
 */
export function createTutorial({ root, spot, panel, etichetta, testo, btnAvanti, btnRipeti }) {
  if (!root || !spot || !panel) return null;

  let i = 0;
  const coarse = matchMedia('(pointer: coarse)').matches;

  const aperto = () => !root.hidden;

  function disegna() {
    const s = STEPS[i];
    const ultimo = i === STEPS.length - 1;

    etichetta.textContent = `TUTORIAL: PASSO ${i + 1} DI ${STEPS.length}`;
    testo.textContent = testoStep(i, coarse);
    btnAvanti.querySelector('span').textContent = ultimo ? 'HO CAPITO' : 'PROSSIMO';
    // All'ultimo passo il tasto chiude: una freccia "avanti" direbbe che c'e'
    // un altro passo.
    btnAvanti.dataset.ico = ultimo ? 'check' : 'avanti';
    btnRipeti.hidden = !ultimo;

    const els = [...document.querySelectorAll(s.sel)];
    const area = areaUnione(els.map((e) => e.getBoundingClientRect()), s.pad ?? 8);
    if (!area) return;

    spot.style.left = `${area.left}px`;
    spot.style.top = `${area.top}px`;
    spot.style.width = `${area.width}px`;
    spot.style.height = `${area.height}px`;
    // L'altezza della finestra si conosce solo dopo che il testo e' dentro.
    requestAnimationFrame(() => {
      panel.style.top = `${posizionaFinestra(area, innerHeight, panel.offsetHeight)}px`;
    });
  }

  /**
   * `data-tutorial` sul body accende l'ASPETTO dei tasti spenti.
   *
   * Alla prima apertura non c'e' ancora un disegno: annulla, rifai e SALVA
   * sono disabilitati e quasi invisibili, e quattro passi su sette
   * evidenziavano un'area dove non si vedeva niente. Lo stato resta
   * disabilitato — cambia solo come si vede. Le regole stanno in index.html.
   */
  function apri(da = 0) {
    i = da;
    document.body.dataset.tutorial = '1';
    root.hidden = false;
    disegna();
  }

  function chiudi() {
    root.hidden = true;
    delete document.body.dataset.tutorial;
    segnaVisto();
  }

  btnAvanti.addEventListener('click', () => {
    if (i === STEPS.length - 1) { chiudi(); return; }
    i++;
    disegna();
  });
  btnRipeti.addEventListener('click', () => apri(0));

  // Il riquadro e' in coordinate di viewport: ruotare il telefono o cambiare
  // la finestra lo lascia dov'era. Stesso ritardo di relayout() in main.js.
  addEventListener('resize', () => { if (aperto()) disegna(); });
  addEventListener('orientationchange', () => { if (aperto()) setTimeout(disegna, 120); });

  // Una via d'uscita per chi naviga da tastiera. Sul dito non c'e', ed e'
  // voluto: un CHIUDI accanto a PROSSIMO si tocca per sbaglio.
  addEventListener('keydown', (e) => {
    if (!aperto()) return;
    if (e.key === 'Escape') chiudi();
    else if (e.key === 'Enter' || e.key === ' ') { btnAvanti.click(); e.preventDefault(); }
  });

  return { apri, chiudi, aperto, get passo() { return i; } };
}
