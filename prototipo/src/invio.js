/**
 * Mandare il disegno alla Fondazione (Fase 6, passo 2 del piano).
 *
 * SALVA scarica il disegno e POI chiede se mandarlo: INVIA / NO GRAZIE.
 * L'invio e' una scelta del bambino, mai una conseguenza del salvataggio.
 *
 * Il server e' l'endpoint del plugin (plugin/frmm-lavagna/includes/invio.php).
 * Il suo indirizzo arriva dallo shortcode, in coda all'URL dell'iframe
 * (?invio=...): fuori da WordPress — il prototipo sotto temp/, o aperto in
 * locale — il parametro non c'e' e la domanda non compare. SALVA resta il
 * download di sempre.
 *
 * Tre scelte non ovvie:
 *
 *  1. L'indirizzo si accetta solo se e' della STESSA ORIGINE della pagina.
 *     Altrimenti bastava un link alla lavagna con ?invio=https://altrove per
 *     farle spedire i disegni a chiunque.
 *
 *  2. La domanda si rifa' solo se il disegno e' cambiato dall'ultima
 *     risposta — INVIA andato a buon fine o NO GRAZIE. Salvare due volte lo
 *     stesso disegno non deve chiedere due volte la stessa cosa. Un invio
 *     fallito invece non e' una risposta: al SALVA dopo, si richiede.
 *
 *  3. L'immagine che parte NON ha il logo (fase-0 §7.2): esportaJpeg() senza
 *     il terzo argomento. E' il default di export.js, e il verso giusto.
 */

import { esportaJpeg, EXPORT_W } from './export.js';

/* --- il client_id (D5) -----------------------------------------------------

   Un UUID v4 generato al primo invio e tenuto in localStorage. Non e' un
   account e non identifica una persona: serve al rate limit del server e,
   in Fase 5, a collegare la bozza locale all'invio.

   La chiave NON contiene il percorso, a differenza di quella del tutorial:
   identifica il dispositivo, non la pagina, e la Fase 5 la leggera' da qui.
   Chi la cambiasse spezzerebbe il rate limit — ogni cartella numerata
   sarebbe un dispositivo nuovo. */

export const CHIAVE_CLIENT = 'frmm-lavagna:client_id';

let clientInMemoria = null;

function nuovoUuid(c = globalThis.crypto) {
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;           // versione 4
  b[8] = (b[8] & 0x3f) | 0x80;           // variante RFC 4122
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/**
 * Il client_id di questo dispositivo, creato la prima volta che serve.
 *
 * In Safari privato localStorage lancia: allora l'id vive in memoria per la
 * sessione. Il rate limit lo vede come un dispositivo nuovo a ogni
 * ricarica — per quello c'e' anche il limite per IP.
 */
export function clientId(store = globalThis.localStorage, c = globalThis.crypto) {
  try {
    const v = store.getItem(CHIAVE_CLIENT);
    if (v && /^[0-9a-f-]{36}$/.test(v)) return v;
    const nuovo = nuovoUuid(c);
    store.setItem(CHIAVE_CLIENT, nuovo);
    return nuovo;
  } catch {
    if (!clientInMemoria) clientInMemoria = nuovoUuid(c);
    return clientInMemoria;
  }
}

/** L'indirizzo dell'endpoint, o null: vedi la scelta 1 in testa al file. */
export function endpointInvio(search = globalThis.location?.search ?? '', origin = globalThis.location?.origin ?? '') {
  const v = new URLSearchParams(search).get('invio');
  if (!v) return null;
  try {
    const u = new URL(v);
    if (u.origin !== origin) {
      console.warn(`[invio] indirizzo di un'altra origine, ignorato: ${u.origin}`);
      return null;
    }
    return u.href;
  } catch {
    return null;
  }
}

/* --- il payload -------------------------------------------------------------- */

/**
 * Il Drawing come parte, con i punti arrotondati al centesimo di unita'.
 *
 * I punti in memoria sono float pieni, ~18 caratteri l'uno: arrotondati
 * pesano circa un terzo. Un centesimo di unita' di lavagna e' un
 * centosessantamillesimo della larghezza: non si vede a nessuna risoluzione.
 * Si arrotonda la COPIA che parte, non il Drawing, che resta quello che il
 * bambino ha sotto le mani.
 */
export function payloadDisegno(drawing) {
  const r = (n) => Math.round(n * 100) / 100;
  return {
    version: drawing.version,
    board: { w: drawing.board.w, h: drawing.board.h },
    strokes: drawing.strokes.map((s) => ({
      id: s.id, tool: s.tool, color: s.color ?? null, width: s.width, seed: s.seed,
      pts: s.pts.map(r),
    })),
  };
}

/**
 * Un'impronta del disegno, per sapere se e' cambiato (scelta 2).
 *
 * Numero di tratti e id dell'ultimo: gli id crescono e non si riusano, quindi
 * un tratto nuovo cambia l'impronta anche dopo un annulla che aveva riportato
 * il numero al valore di prima.
 */
export function firma(drawing) {
  const n = drawing.strokes.length;
  return `${n}:${n ? drawing.strokes[n - 1].id : 0}`;
}

/* --- l'invio ------------------------------------------------------------------ */

/**
 * Come e' andata, in un motivo solo. I codici del server servono a chi legge i
 * log; al bambino serve sapere se riprovare, aspettare o lasciar perdere.
 */
export function motivoDaStatus(status) {
  if (status === 201) return 'fatto';
  if (status === 413) return 'grande';
  if (status === 429) return 'troppi';
  if (!status) return 'rete';
  return 'server';
}

/**
 * Manda il disegno. Non lancia mai: risolve sempre con un motivo.
 *
 * Il JPEG si fa qui, al tocco di INVIA, e non al tocco di SALVA: chi
 * risponde NO GRAZIE non deve pagare una seconda codifica.
 */
export async function invia(url, drawing, cid, {
  jpeg = () => esportaJpeg(drawing, EXPORT_W),
  fetchImpl = globalThis.fetch,
  attesa = 45000,
} = {}) {
  if (globalThis.navigator && navigator.onLine === false) return 'rete';

  const corpo = new FormData();
  corpo.append('client_id', cid);
  corpo.append('disegno', JSON.stringify(payloadDisegno(drawing)));
  corpo.append('immagine', jpeg(), 'disegno.jpg');

  // 45 secondi: un JPEG da un paio di MB su una rete da telefono scarsa. Oltre,
  // meglio dire che non e' partito che lasciare un bambino davanti a "sto
  // mandando..." per sempre.
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), attesa);
  try {
    // credentials 'omit': l'invio e' anonimo anche per chi e' collegato al
    // sito. Senza, WordPress vedrebbe il cookie senza nonce e lo ignorerebbe
    // comunque — ma meglio che non parta.
    const r = await fetchImpl(url, { method: 'POST', body: corpo, credentials: 'omit', signal: stop.signal });
    return motivoDaStatus(r.status);
  } catch {
    return 'rete';
  } finally {
    clearTimeout(timer);
  }
}

/* --- la finestra ---------------------------------------------------------------

   Stessa grammatica del tutorial: velo, finestra senza bordo, tasti del sito.
   I testi sono per un bambino di cinque anni che se li fa leggere da un
   adulto, quindi corti e senza parole tecniche. */

export const TESTI = {
  domanda: {
    t: 'Vuoi mandare il tuo disegno alla Fondazione?',
    s: 'Prima lo guarda un adulto. Se va bene, lo mettiamo nella galleria!',
    si: 'INVIA', no: 'NO GRAZIE',
  },
  invio: { t: 'Sto mandando il tuo disegno…', s: '' },
  fatto: {
    t: 'Arrivato! Grazie per il tuo disegno.',
    s: 'Se va bene, presto lo vedrai nella galleria.',
    si: 'OK',
  },
  rete: {
    t: 'Il disegno non è partito.',
    s: 'Sembra che manchi internet. Riprova tra un momento.',
    si: 'RIPROVA', no: 'CHIUDI',
  },
  server: {
    t: 'Il disegno non è partito.',
    s: 'Qualcosa non ha funzionato. Riprova tra un momento.',
    si: 'RIPROVA', no: 'CHIUDI',
  },
  grande: {
    t: 'Questo disegno è troppo grande per essere mandato.',
    s: 'Puoi sempre tenerlo: è già salvato.',
    no: 'CHIUDI',
  },
  troppi: {
    t: 'Per oggi hai mandato tanti disegni!',
    s: 'Puoi mandarne altri domani.',
    no: 'CHIUDI',
  },
};

/**
 * @param {object} o
 * @param {HTMLElement} o.el          il contenitore #inv
 * @param {object} o.drawing
 * @param {string} o.url              l'endpoint, da endpointInvio()
 * @param {Function} [o.onRisposta]   chiamata con la firma del disegno quando
 *   c'e' una risposta che vale (inviato, o NO GRAZIE)
 */
export function createInvio({ el, drawing, url, onRisposta = () => {} }) {
  const t = el.querySelector('#inv-t');
  const s = el.querySelector('#inv-s');
  const si = el.querySelector('#inv-si');
  const no = el.querySelector('#inv-no');
  let stato = null;
  let firmaAperta = null;
  let focoPrima = null;

  function mostra(nuovo) {
    stato = nuovo;
    const x = TESTI[nuovo];
    t.textContent = x.t;
    s.textContent = x.s;
    s.hidden = !x.s;
    si.querySelector('span').textContent = x.si || '';
    si.hidden = !x.si;
    // L'aeroplanino solo su INVIA: e' lo stesso segno di SALVA, e dice
    // "questo parte". Su OK o RIPROVA direbbe una cosa falsa.
    si.dataset.ico = nuovo === 'domanda' ? 'invia' : '';
    no.textContent = x.no || '';
    no.hidden = !x.no;
    el.setAttribute('aria-busy', nuovo === 'invio' ? 'true' : 'false');
    (x.si ? si : x.no ? no : null)?.focus();
  }

  function chiudi() {
    el.hidden = true;
    stato = null;
    focoPrima?.focus?.();
  }

  async function manda() {
    mostra('invio');
    const esito = await invia(url, drawing, clientId());
    if (esito === 'fatto') onRisposta(firmaAperta);
    mostra(esito);
  }

  si.addEventListener('click', () => {
    if (stato === 'domanda' || stato === 'rete' || stato === 'server') manda();
    else chiudi();
  });

  no.addEventListener('click', () => {
    if (stato === 'domanda') onRisposta(firmaAperta);
    chiudi();
  });

  // Esc vale come il tasto secondario, tranne mentre parte: un invio a meta'
  // non si interrompe chiudendo la finestra.
  el.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || stato === 'invio') return;
    e.preventDefault();
    (no.hidden ? si : no).click();
  });

  return {
    /** Apre la domanda, se il disegno e' cambiato dall'ultima risposta. */
    chiedi(ultimaFirma) {
      const f = firma(drawing);
      if (f === ultimaFirma) return false;
      firmaAperta = f;
      focoPrima = document.activeElement;
      el.hidden = false;
      mostra('domanda');
      return true;
    },
    get aperta() { return !el.hidden; },
  };
}
