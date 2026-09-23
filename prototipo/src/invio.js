/**
 * Mandare il disegno alla Fondazione (Fase 6, passo 2 del piano).
 *
 * SALVA chiede PRIMA: «SALVA E INVIA» / «SOLO SALVA». Il tocco su uno dei due
 * fa partire il salvataggio — e, se si e' scelto di inviare, nello stesso
 * tocco parte anche l'invio.
 *
 * Perche' prima e non dopo (cambiato il 23/09/2026, dopo la prova sul
 * telefono): la prima versione chiedeva DOPO la condivisione, ma chi
 * condivide su WhatsApp resta in WhatsApp. La domanda aspettava nel browser
 * un bambino che non ci sarebbe tornato.
 *
 * Perche' in parallelo e non «prima l'invio, poi la condivisione»: il foglio
 * di condivisione si apre solo in risposta IMMEDIATA a un tocco. Aspettare la
 * rete in mezzo lo fa rifiutare a Safari, in silenzio (export.js, nota 3). La
 * certezza costerebbe un tocco in piu' a ogni salvataggio. Si e' scelto
 * invece: l'invio parte subito, e se non arriva — la pagina sospesa da iOS
 * mentre il bambino e' in WhatsApp, la rete che cade — si riprova da soli,
 * quando il browser torna in primo piano o torna la rete. La coda sotto.
 *
 * Il server (plugin/frmm-lavagna/includes/invio.php) riceve anche:
 *   invio_id   lo stesso a ogni tentativo dello stesso invio: la ripresa di
 *              un invio arrivato ma con la risposta persa non crea doppioni;
 *   tentativo  per misurare quanto spesso la ripresa serve davvero.
 *
 * L'indirizzo dell'endpoint arriva dallo shortcode (?invio=...). Fuori da
 * WordPress non c'e', e SALVA resta il download di sempre, senza domanda.
 *
 * L'immagine che parte NON ha il logo (fase-0 §7.2): esportaJpeg() senza il
 * terzo argomento, che e' il default di export.js.
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

export function nuovoUuid(c = globalThis.crypto) {
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

/**
 * L'indirizzo dell'endpoint, o null.
 *
 * Si accetta solo se e' della STESSA ORIGINE della pagina: altrimenti bastava
 * un link alla lavagna con ?invio=https://altrove per farle spedire i disegni
 * a chiunque.
 */
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
 * Un'impronta del disegno, per non rifare la domanda sullo stesso disegno.
 *
 * Numero di tratti e id dell'ultimo: gli id crescono e non si riusano, quindi
 * un tratto nuovo cambia l'impronta anche dopo un annulla che aveva riportato
 * il numero al valore di prima.
 */
export function firma(drawing) {
  const n = drawing.strokes.length;
  return `${n}:${n ? drawing.strokes[n - 1].id : 0}`;
}

/* --- un invio ----------------------------------------------------------------- */

/**
 * Come e' andata. Conta una cosa sola: se vale la pena riprovare.
 *
 *   fatto      201, o 200 se il server l'aveva gia' (ripresa di un arrivato)
 *   rete       non si sa se e' arrivato: si riprova
 *   server     5xx, un guasto di passaggio: si riprova
 *   grande     413: riprovare non cambierebbe niente
 *   troppi     429: il rate limit, si lascia perdere
 *   rifiutato  qualunque altro 4xx: un difetto dell'app, non della rete
 */
export function motivoDaStatus(status) {
  if (status === 201 || status === 200) return 'fatto';
  if (status === 413) return 'grande';
  if (status === 429) return 'troppi';
  if (!status) return 'rete';
  if (status >= 500) return 'server';
  return 'rifiutato';
}

export const DA_RIPROVARE = new Set(['rete', 'server']);

/**
 * Manda una voce della coda. Non lancia mai: risolve sempre con un motivo.
 *
 * 45 secondi di attesa: un JPEG da un paio di MB su una rete da telefono
 * scarsa. Oltre, meglio considerarlo non partito e riprovare dopo.
 */
export async function inviaVoce(url, voce, { fetchImpl = globalThis.fetch, attesa = 45000 } = {}) {
  if (globalThis.navigator && navigator.onLine === false) return 'rete';

  const corpo = new FormData();
  corpo.append('client_id', voce.cid);
  corpo.append('invio_id', voce.invioId);
  corpo.append('tentativo', String(voce.tentativo));
  corpo.append('disegno', voce.disegno);
  corpo.append('immagine', voce.jpeg, 'disegno.jpg');

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

/* --- la coda ------------------------------------------------------------------

   Gli invii partiti e non ancora arrivati. Vive in memoria: se iOS chiude la
   scheda mentre il bambino e' in WhatsApp, si perde con la scheda — ma con
   la scheda si perde anche il disegno sullo schermo, e nessun ordine delle
   operazioni lo salverebbe. Tenerla in localStorage vorrebbe dire metterci
   JPEG da centinaia di KB: e' la Fase 5, che e' fuori perimetro.

   Si riprova in tre occasioni: la pagina torna visibile (il bambino rientra
   nel browser), torna la rete, e a tempo, con attese crescenti, per chi e'
   rimasto nella pagina. Dopo MAX_TENTATIVI si lascia perdere. */

export const ATTESE = [10000, 30000, 120000, 300000, 600000];
export const MAX_TENTATIVI = 6;
export const MAX_CODA = 5;

/**
 * @param {object} o
 * @param {string} o.url
 * @param {Function} [o.invia]      (url, voce) => Promise<motivo>; di default inviaVoce
 * @param {Function} [o.pianifica]  (fn, ms) => annulla; di default setTimeout
 * @param {object} [o.finestra]     dove ascoltare 'online'; di default window
 * @param {object} [o.documento]    dove ascoltare 'visibilitychange'
 */
export function createCoda({
  url,
  invia = (u, v) => inviaVoce(u, v),
  pianifica = (fn, ms) => { const t = setTimeout(fn, ms); return () => clearTimeout(t); },
  finestra = globalThis.window,
  documento = globalThis.document,
  cid = () => clientId(),
} = {}) {
  const voci = [];
  let inCorso = false;
  let annullaTimer = null;

  async function svuota() {
    if (inCorso) return;
    inCorso = true;
    annullaTimer?.();
    annullaTimer = null;
    try {
      while (voci.length) {
        const v = voci[0];
        v.tentativo++;
        const esito = await invia(url, v);
        if (esito === 'fatto') { voci.shift(); continue; }
        if (!DA_RIPROVARE.has(esito) || v.tentativo >= MAX_TENTATIVI) {
          console.warn(`[invio] lasciato perdere dopo ${v.tentativo} tentativi: ${esito}`);
          voci.shift();
          continue;
        }
        // Si ferma qui: se non passa questo, non passeranno nemmeno gli altri.
        const ms = ATTESE[Math.min(v.tentativo - 1, ATTESE.length - 1)];
        annullaTimer = pianifica(() => { annullaTimer = null; svuota(); }, ms);
        break;
      }
    } finally {
      inCorso = false;
    }
  }

  // Il bambino torna nel browser dopo WhatsApp: e' IL momento in cui un invio
  // sospeso da iOS ha la sua occasione.
  documento?.addEventListener?.('visibilitychange', () => {
    if (documento.visibilityState === 'visible' && voci.length) svuota();
  });
  finestra?.addEventListener?.('online', () => { if (voci.length) svuota(); });

  return {
    /**
     * Mette in coda il disegno COM'E' ORA e lo manda. La fotografia si fa qui
     * — JSON e JPEG — cosi' se il bambino continua a disegnare mentre la
     * ripresa aspetta, parte quello che ha scelto di mandare, non quello dopo.
     */
    aggiungi(drawing, jpeg = () => esportaJpeg(drawing, EXPORT_W)) {
      voci.push({
        cid: cid(),
        invioId: nuovoUuid(),
        tentativo: 0,
        disegno: JSON.stringify(payloadDisegno(drawing)),
        jpeg: jpeg(),
      });
      // Un tetto, perche' ogni voce tiene un JPEG in memoria. Oltre cinque
      // disegni in attesa di rete, il piu' vecchio si lascia andare.
      if (voci.length > MAX_CODA) {
        voci.shift();
        console.warn('[invio] coda piena: lasciato andare l\'invio piu\' vecchio');
      }
      return svuota();
    },
    get lunghezza() { return voci.length; },
  };
}

/* --- la domanda ----------------------------------------------------------------

   Stessa grammatica del tutorial: velo, finestra senza bordo, tasti del sito.
   Una domanda sola e due risposte, nessuno stato dopo: la finestra si chiude
   al tocco, perche' quel tocco deve aprire la condivisione. */

export const TESTI = {
  t: 'Vuoi mandare il tuo disegno anche alla Fondazione?',
  s: 'Prima lo guarda un adulto. Se va bene, lo mettiamo nella galleria!',
  si: 'SALVA E INVIA',
  no: 'SOLO SALVA',
};

/**
 * @param {object} o
 * @param {HTMLElement} o.el     il contenitore #inv
 * @param {Function} o.onScelta  (invia: boolean) => void, chiamata DENTRO il
 *   gestore del tocco: e' li' che il salvataggio deve partire.
 */
export function createDomanda({ el, onScelta }) {
  const si = el.querySelector('#inv-si');
  const no = el.querySelector('#inv-no');
  el.querySelector('#inv-t').textContent = TESTI.t;
  el.querySelector('#inv-s').textContent = TESTI.s;
  si.querySelector('span').textContent = TESTI.si;
  no.textContent = TESTI.no;
  let focoPrima = null;

  function chiudi() {
    el.hidden = true;
    focoPrima?.focus?.();
  }

  // Prima si chiude, poi si sceglie: onScelta apre il foglio di
  // condivisione, che deve trovare la finestra gia' tolta di mezzo.
  si.addEventListener('click', () => { chiudi(); onScelta(true); });
  no.addEventListener('click', () => { chiudi(); onScelta(false); });

  // Esc chiude senza salvare: e' "ci ho ripensato", non una delle due scelte.
  el.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    chiudi();
  });

  return {
    apri() {
      focoPrima = document.activeElement;
      el.hidden = false;
      si.focus();
    },
    get aperta() { return !el.hidden; },
  };
}
