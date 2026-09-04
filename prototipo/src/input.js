/**
 * Input della lavagna. E' il pezzo che la Fase 1 esiste per validare:
 * se questo non regge su iOS Safari, il resto del progetto non serve.
 *
 * Tre problemi distinti, risolti separatamente:
 *
 *  1. Il browser vuole scrollare/zoomare invece di lasciar disegnare.
 *     -> touch-action:none nel CSS, piu' le difese qui sotto per i gesti
 *        che il CSS da solo non ferma (pinch di Safari, menu da long press).
 *
 *  2. Piu' dita contemporaneamente. Un bambino appoggia il palmo mentre
 *     disegna. -> un solo pointer attivo per volta, gli altri si ignorano.
 *
 *  3. Campioni persi fra un frame e l'altro. Su schermi a 120Hz il browser
 *     accorpa i movimenti. -> getCoalescedEvents() recupera l'originale.
 */

/**
 * Timestamp del campione. Si usa quello dell'evento, non l'istante in cui lo
 * si legge: con gli eventi accorpati sono cose diverse, e il filtro ha bisogno
 * dell'intervallo reale fra i campioni.
 */
const stamp = (e) => e.timeStamp || performance.now();

export function createInput(canvas, board, handlers) {
  const { onStart, onMove, onEnd } = handlers;

  let activeId = null;      // un solo pointer per volta
  let pending = [];         // punti accumulati fra un frame e l'altro
  let rafId = 0;
  let startedAt = 0;

  const stats = {
    pointerType: '—',
    /* Se l'API manca il fallback restituisce 1 campione, indistinguibile da
       "l'API c'e' e non c'era nulla da accorpare". Sono due situazioni molto
       diverse e il pannello deve poterle separare.

       Due rilevazioni distinte, perche' la prima ha gia' dato un risultato
       sospetto (assente su Chrome Android, che invece lo implementa): un
       browser potrebbe esporre il metodo sull'istanza ma non sul prototipo. */
    apiOnProto: typeof PointerEvent !== 'undefined'
      && 'getCoalescedEvents' in PointerEvent.prototype,
    apiOnEvent: null,      // rilevato al primo pointermove reale
    lastCoalesced: 0,
    maxCoalesced: 0,
    moveEvents: 0,     // eventi pointermove ricevuti nel tratto
    samples: 0,        // campioni estratti dopo il coalescing
    elapsed: 0,        // durata del tratto in ms
  };

  function flush() {
    if (pending.length) {
      onMove(pending);
      pending = [];
    }
  }

  function frame() {
    rafId = 0;
    if (activeId === null) return;
    flush();
    rafId = requestAnimationFrame(frame);
  }

  function pump() {
    if (!rafId) rafId = requestAnimationFrame(frame);
  }

  function stopPump() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  function onPointerDown(e) {
    if (activeId !== null) return;            // gia' si sta disegnando
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    activeId = e.pointerId;
    stats.pointerType = e.pointerType;
    // Le misure valgono per il tratto corrente: un massimo che non si azzera
    // mai finisce per riportare per sempre il frame perso all'avvio.
    stats.moveEvents = 0;
    stats.samples = 1;
    stats.maxCoalesced = 0;
    stats.elapsed = 0;
    startedAt = performance.now();

    // Il capture garantisce di ricevere move e up anche se il dito esce
    // dal canvas: senza, uno stroke che sconfina resta aperto per sempre.
    try { canvas.setPointerCapture(e.pointerId); } catch { /* iOS puo' rifiutare */ }

    const p = board.toBoard(e.clientX, e.clientY);
    onStart({ ...p, pressure: e.pressure, pointerType: e.pointerType, t: stamp(e) });
    stats.points++;
    pump();
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (e.pointerId !== activeId) return;

    let batch = [e];
    const hasFn = typeof e.getCoalescedEvents === 'function';
    if (stats.apiOnEvent === null) stats.apiOnEvent = hasFn;
    if (hasFn) {
      const co = e.getCoalescedEvents();
      if (co && co.length) batch = co;
    }
    stats.lastCoalesced = batch.length;
    if (batch.length > stats.maxCoalesced) stats.maxCoalesced = batch.length;

    for (const ev of batch) {
      const p = board.toBoard(ev.clientX, ev.clientY);
      p.pressure = ev.pressure;
      p.t = stamp(ev);
      pending.push(p);
    }
    stats.moveEvents++;
    stats.samples += batch.length;
    stats.elapsed = performance.now() - startedAt;
    e.preventDefault();
  }

  function finish(e) {
    if (e.pointerId !== activeId) return;
    flush();                                   // l'ultimo tratto non si perde
    stopPump();
    activeId = null;
    try { canvas.releasePointerCapture(e.pointerId); } catch { /* gia' rilasciato */ }
    onEnd();
  }

  /* --- difese contro i gesti del browser ---------------------------- */

  // touch-action:none copre lo scroll, non il pinch-zoom di Safari.
  const killGesture = (e) => e.preventDefault();

  // Long press su iOS apre il menu "copia immagine" sopra il canvas.
  const killMenu = (e) => e.preventDefault();

  // Ridondante con touch-action:none, ma iOS piu' vecchi lo richiedono.
  const killTouch = (e) => { if (e.cancelable) e.preventDefault(); };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', finish);
  canvas.addEventListener('pointercancel', finish);
  canvas.addEventListener('contextmenu', killMenu);
  canvas.addEventListener('touchstart', killTouch, { passive: false });
  canvas.addEventListener('touchmove', killTouch, { passive: false });
  document.addEventListener('gesturestart', killGesture, { passive: false });
  document.addEventListener('gesturechange', killGesture, { passive: false });
  document.addEventListener('gestureend', killGesture, { passive: false });
  document.addEventListener('dblclick', killGesture, { passive: false });

  return {
    stats,
    get drawing() { return activeId !== null; },
    destroy() {
      stopPump();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', finish);
      canvas.removeEventListener('pointercancel', finish);
      canvas.removeEventListener('contextmenu', killMenu);
      canvas.removeEventListener('touchstart', killTouch);
      canvas.removeEventListener('touchmove', killTouch);
      document.removeEventListener('gesturestart', killGesture);
      document.removeEventListener('gesturechange', killGesture);
      document.removeEventListener('gestureend', killGesture);
      document.removeEventListener('dblclick', killGesture);
    },
  };
}
