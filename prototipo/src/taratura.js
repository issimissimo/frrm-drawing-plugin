/**
 * Il pannello di taratura del gesso (dal 01/10/2026), solo con `?taratura`.
 *
 * Serve a Daniele per trovare col dito, sul telefono, quanto gesso depositano
 * il gesto lento e quello veloce (TARATURA in gesso.js). Ogni cursore
 * ridisegna dal modello il disegno che c'e' gia': si confronta la stessa
 * cosa, non un disegno nuovo a ogni prova. E riscrive l'URL nella barra, cosi'
 * la combinazione si ricarica, si copia e si manda.
 *
 * Non e' interfaccia per i bambini: fuori da `?taratura` non esiste, e nella
 * pagina WordPress l'URL dell'iframe non lo porta mai.
 */

import { TARATURA, TARATURA_PREDEFINITA, LIMITI_TARATURA, impostaTaratura } from './gesso.js';

const VOCI = [
  ['lento', 'Lento'],
  ['veloce', 'Veloce'],
  ['curva', 'Curva'],
  ['riempie', 'Riempie'],
];
const PASSO = 0.05;

const STILE = `
#taratura {
  position: fixed; top: 8px; right: 8px; z-index: 40;
  width: min(280px, calc(100vw - 16px));
  padding: 0 12px 8px;
  background: rgba(21, 24, 27, 0.92);
  border-radius: 6px;
  color: #FAF8F3;
  font: inherit;
  touch-action: manipulation;
}
#taratura[data-chiuso] { width: auto; padding-bottom: 0; }
#taratura [hidden] { display: none; }
#taratura button {
  font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer;
  text-transform: inherit; letter-spacing: inherit;
}
#taratura .tt-testa {
  display: flex; justify-content: space-between; gap: 16px; width: 100%;
  padding: 9px 0 7px;
  font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
}
#taratura .tt-voce {
  display: grid; grid-template-columns: 58px 1fr 34px; gap: 8px; align-items: center;
}
#taratura .tt-nome {
  font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
  color: rgba(250, 248, 243, 0.55);
}
#taratura input[type=range] { width: 100%; height: 28px; margin: 0; accent-color: #FAF8F3; }
#taratura output {
  font-size: 13px; font-weight: 700; text-align: right; font-variant-numeric: tabular-nums;
}
#taratura .tt-piede {
  display: flex; gap: 16px; align-items: baseline; padding-top: 6px;
  font-size: 10px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
}
#taratura .tt-piede button { text-decoration: underline; text-underline-offset: 3px; }
#taratura .tt-esito { color: rgba(250, 248, 243, 0.55); text-transform: none; letter-spacing: 0; }
`;

/**
 * @param {() => void} ridisegna ridisegna il disegno dal modello (repaint di
 *   main.js). Si chiama al piu' una volta per frame.
 */
export function creaTaratura(ridisegna) {
  const stile = document.createElement('style');
  stile.textContent = STILE;
  document.head.appendChild(stile);

  const el = document.createElement('section');
  el.id = 'taratura';
  el.setAttribute('aria-label', 'Taratura del gesso');
  el.innerHTML = `
    <button type="button" class="tt-testa" aria-expanded="true"><span>Taratura</span><span class="tt-segno">−</span></button>
    <div class="tt-corpo">
      ${VOCI.map(([k, nome]) => {
        const [min, max] = LIMITI_TARATURA[k];
        return `<label class="tt-voce"><span class="tt-nome">${nome}</span>`
          + `<input type="range" data-voce="${k}" min="${min}" max="${max}" step="${PASSO}">`
          + `<output data-voce="${k}"></output></label>`;
      }).join('')}
      <div class="tt-piede">
        <button type="button" data-azione="copia">Copia link</button>
        <button type="button" data-azione="ripristina">Ripristina</button>
        <span class="tt-esito" aria-live="polite"></span>
      </div>
    </div>`;
  document.body.appendChild(el);

  const testa = el.querySelector('.tt-testa');
  const corpo = el.querySelector('.tt-corpo');
  const esito = el.querySelector('.tt-esito');
  const cursori = [...el.querySelectorAll('input[data-voce]')];
  const valori = [...el.querySelectorAll('output[data-voce]')];

  const mostra = () => {
    for (const c of cursori) c.value = String(TARATURA[c.dataset.voce]);
    for (const o of valori) o.textContent = TARATURA[o.dataset.voce].toFixed(2);
  };

  // L'URL nella barra e' la combinazione corrente: si ricarica e si copia.
  const scriviUrl = () => {
    const q = new URLSearchParams(location.search);
    for (const [k] of VOCI) q.set(k, String(TARATURA[k]));
    history.replaceState(null, '', `${location.pathname}?${q}`);
  };

  let richiesto = false;
  const cambiato = () => {
    mostra();
    scriviUrl();
    if (richiesto) return;
    richiesto = true;
    requestAnimationFrame(() => { richiesto = false; ridisegna(); });
  };

  for (const c of cursori) {
    c.addEventListener('input', () => {
      impostaTaratura({ [c.dataset.voce]: c.value });
      cambiato();
    });
  }

  testa.addEventListener('click', () => {
    const aperto = corpo.hidden;
    corpo.hidden = !aperto;
    testa.setAttribute('aria-expanded', String(aperto));
    el.querySelector('.tt-segno').textContent = aperto ? '−' : '+';
    el.toggleAttribute('data-chiuso', !aperto);
  });

  let timer = 0;
  const avvisa = (testo) => {
    esito.textContent = testo;
    clearTimeout(timer);
    timer = setTimeout(() => { esito.textContent = ''; }, 2500);
  };
  el.querySelector('[data-azione=copia]').addEventListener('click', () => {
    const fatto = () => avvisa('copiato');
    const no = () => avvisa('copialo dalla barra');
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(location.href).then(fatto, no);
    else no();
  });
  el.querySelector('[data-azione=ripristina]').addEventListener('click', () => {
    impostaTaratura(TARATURA_PREDEFINITA);
    cambiato();
  });

  mostra();
  scriviUrl();
}
