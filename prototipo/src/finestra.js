/**
 * La finestra al posto di confirm() e alert() (02/10/2026).
 *
 * I dialoghi di sistema mettono sopra la domanda il nome del sito
 * («issimissimo.com dice...»), con l'aspetto del browser e non della lavagna.
 * Questa e' la finestra della domanda d'invio (invio.js): velo, finestra
 * senza bordo, tasti del sito. Le regole CSS sono le sue, in index.html.
 *
 * Due usi, i testi li passa main.js:
 *   il cestino               due tasti; il primario e' NO, LO TENGO
 *   il salvataggio fallito   un tasto solo
 *
 * Il primario e' quello col contenitore e col fuoco, e nel cestino e' la
 * risposta che NON cancella: il cestino non si annulla (model.js), e chi lo
 * tocca per sbaglio accanto ad annulla, poi preme d'istinto il tasto piu'
 * visibile, non deve perdere il disegno.
 */

/**
 * @param {HTMLElement} el  il contenitore #msg
 */
export function createFinestra(el) {
  const titolo = el.querySelector('#msg-t');
  const sotto = el.querySelector('#msg-s');
  const a = el.querySelector('#msg-a');
  const b = el.querySelector('#msg-b');
  let risolvi = null;
  let focoPrima = null;

  function chiudi(risposta) {
    el.hidden = true;
    focoPrima?.focus?.();
    const r = risolvi;
    risolvi = null;
    r?.(risposta);
  }

  a.addEventListener('click', () => chiudi('a'));
  b.addEventListener('click', () => chiudi('b'));

  // Esc e' "ci ho ripensato": nel cestino vale NO.
  el.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    chiudi(null);
  });

  return {
    /**
     * Apre la finestra. Risolve con 'a' (il primario), 'b' (il secondario)
     * o null (Esc).
     *
     * @param {{t: string, s: string, a: string, b?: string}} testi
     *   senza `b` il secondario non c'e'.
     */
    chiedi(testi) {
      // Una domanda rimasta aperta vale "ci ho ripensato": chi l'aspettava
      // non deve restare appeso.
      if (risolvi) chiudi(null);
      titolo.textContent = testi.t;
      sotto.textContent = testi.s;
      a.querySelector('span').textContent = testi.a;
      b.hidden = !testi.b;
      b.querySelector('span').textContent = testi.b ?? '';
      focoPrima = document.activeElement;
      el.hidden = false;
      a.focus();
      return new Promise((r) => { risolvi = r; });
    },
  };
}
