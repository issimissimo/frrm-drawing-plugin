/**
 * Fase 4 — UI desktop e mobile.
 *
 * Il tratto passa per: One Euro (live) -> pseudo-pressione -> RDP (a fine
 * gesto) -> ricampionamento su curva (al render). Vedi pen.js e render.js.
 *
 * Il tratto non e' disegnato ma timbrato: vedi chalk.js. Il fondo lavagna e'
 * un colore pieno nel CSS, senza texture.
 *
 * La mensola: i gessetti sono oggetti, non pastiglie di colore. Selezionare
 * significa sollevare — nessun bordo, nessun anello, nessuna spunta. Il
 * cancellino segue la stessa grammatica con materia e proporzione diverse.
 * I comandi (annulla, rifai, cestino, invia) stanno nel registro opposto:
 * icone di linea, monocrome, all'estremita' lontana.
 *
 * Il download del disegno (export.js) e' una fetta anticipata della Fase 6:
 * resta tutto sul device, nessun backend. Deliberatamente assenti:
 * persistenza, invio, cursore custom. Fase 5 e oltre.
 */

import { CHALKS, chalkById, DEFAULT_CHALK, WIDTHS, DEFAULT_WIDTH, ERASER_WIDTH,
         SMOOTHING, DEFAULT_SMOOTHING, SOGLIA_STRETTA } from './palette.js';
import { createBoard } from './board.js';
import { createInput } from './input.js';
import { createPen } from './pen.js';
import { createDrawing, createHistory } from './model.js';
import { render, renderStroke, strokeGeometry } from './render.js';
import { count } from './geom.js';
import { affiancate, puntaBase } from './chalk.js';
import { scarica, haDisegno, precaricaLogo, larghezzaLogo } from './export.js';
import { createTutorial, giaVisto } from './tutorial.js';

const stage = document.getElementById('stage');
const layers = document.getElementById('layers');
const baseCanvas = document.getElementById('base');
const overlayCanvas = document.getElementById('overlay');
const hud = document.getElementById('hud');

const board = createBoard(baseCanvas, overlayCanvas, stage);

/* Il primo layout congela il rapporto della lavagna sul viewport (vedi
   freezeBoardHeight in palette.js). Deve avvenire PRIMA di createDrawing():
   il Drawing quel rapporto se lo porta dentro e non lo cambia piu'. */
const primoLayout = board.layout();

const drawing = createDrawing();
const history = createHistory(drawing);

let ink = chalkById(DEFAULT_CHALK).hex;
let tool = 'chalk';
let pen = null;
let lastLayout = null;

/**
 * Su schermo stretto gli strumenti raddoppiano.
 *
 * La lavagna logica e' 1600 unita' su qualunque device, ma quelle 1600 unita'
 * occupano 1440 px CSS su un desktop e 390 su un telefono: un tratto da 22
 * unita' passa da 19,8 px a 5,4, ed e' troppo sottile per leggersi come gesso.
 *
 * Il fattore guarda la larghezza REALE della lavagna, non una media query:
 * e' quella la causa, e cosi' vale anche per una finestra desktop stretta o
 * per un telefono aperto in orizzontale.
 *
 * Raddoppia lo STRUMENTO, non il render. Il Drawing registra il tratto che il
 * bambino ha davvero disegnato, quindi resta riproducibile identico a
 * qualunque scala (D1): se raddoppiassimo al render, lo stesso Drawing darebbe
 * immagini diverse su device diversi.
 */
const SCALA_STRUMENTI = primoLayout.cssW < SOGLIA_STRETTA ? 2 : 1;

/**
 * Il logo sull'immagine salvata, in unita' di lavagna (export.js).
 *
 * Si decide qui e una volta sola, come SCALA_STRUMENTI e per la stessa
 * ragione: rimpicciolire la finestra a meta' disegno non deve cambiare le
 * misure sotto le mani di chi sta disegnando.
 */
const LOGO_W = larghezzaLogo(primoLayout.cssW);

let strokeWidth = DEFAULT_WIDTH * SCALA_STRUMENTI;

/* Taratura dal vivo: la scelta e' soggettiva e va fatta col dito su un
   telefono, non sui numeri. Strumento di Fase 2, ora dietro ?debug=1. */
let smoothing = DEFAULT_SMOOTHING;

/* ---------- disegno ---------- */

function repaint() {
  board.clearBase();
  render(drawing, board.base);
}

/**
 * Il tratto in corso.
 *
 * Il gesso vive sull'overlay e si ridisegna intero a ogni frame: e' corto e
 * costa poco. La gomma no: lavora in destination-out, e sull'overlay
 * cancellerebbe l'overlay stesso, che e' vuoto — non si vedrebbe nulla fino
 * al rilascio. Va applicata al livello dei tratti, e solo sul pezzo nuovo,
 * perche' ripassare cancella ogni volta di piu'.
 */
let timbriApplicati = 0;

function paintLive() {
  if (!pen || !pen.current || !pen.current.pts.length) return;
  if (pen.current.tool === 'eraser') {
    timbriApplicati = renderStroke(board.base, pen.current, timbriApplicati);
  } else {
    board.clearOverlay();
    renderStroke(board.overlay, pen.current);
  }
}

/* ---------- input ---------- */

const input = createInput(overlayCanvas, board, {
  onStart(p) {
    pen = createPen({
      tool,
      color: ink,
      width: tool === 'eraser' ? ERASER_WIDTH * SCALA_STRUMENTI : strokeWidth,
      // La gomma non si semplifica: vedi consolida() in pen.js.
      eps: tool === 'eraser' ? 0 : SMOOTHING[smoothing].eps,
    });
    pen.begin(p);
    timbriApplicati = 0;
    paintLive();
    worst = 0;
    skipFirst = true;
    strokeFrames = 0;
  },

  onMove(points) {
    if (!pen) return;
    pen.extend(points);
    paintLive();
  },

  onEnd() {
    if (!pen) return;
    const stroke = pen.end();
    pen = null;
    if (stroke) {
      history.add(stroke);
      lastStroke = stroke;
      // In nessuno dei due casi si ridisegna dal modello: quel che e' a
      // schermo e' gia' il risultato giusto, e ricostruirlo cambierebbe la
      // grana di TUTTI i tratti, non solo di quello appena chiuso.
      if (stroke.tool !== 'eraser') board.commitOverlay();
      // La gomma ha gia' inciso il livello durante il gesto: nulla da fare.
    }
    board.clearOverlay();
    syncButtons();

    const ms = input.stats.elapsed;
    if (ms > 200) strokeFps = Math.round((strokeFrames * 1000) / ms);
  },
});

/* ---------- strumenti ---------- */

const chalksEl = document.getElementById('chalks');
const widthsEl = document.getElementById('widths');
const eraserBtn = document.getElementById('tool-eraser');

/** Mescola due colori in RGB. Serve solo a dare volume al gessetto. */
function mix(hex, target, t) {
  const parse = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const a = parse(hex), b = parse(target);
  return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

/**
 * Il gessetto e' un cilindro visto di lato: scuro ai bordi, chiaro al centro.
 * E' modellazione della forma, non decorazione — senza, sono nove rettangoli.
 */
function gradiente(hex) {
  const chiaro = mix(hex, '#FFFFFF', 0.30);
  const scuro = mix(hex, '#000000', 0.38);
  return `linear-gradient(96deg, ${scuro} 0%, ${hex} 26%, ${chiaro} 48%, ${hex} 74%, ${scuro} 100%)`;
}

for (const c of CHALKS) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'chalk';
  b.dataset.color = c.hex;
  b.setAttribute('aria-label', c.id);
  b.style.setProperty('--grad', gradiente(c.hex));
  b.style.setProperty('--glow', `${c.hex}55`);
  const s = document.createElement('span');
  s.className = 'stick';
  b.appendChild(s);
  chalksEl.appendChild(b);
}

for (const w of WIDTHS) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'wbtn';
  b.dataset.w = String(w.w * SCALA_STRUMENTI);
  b.setAttribute('aria-label', w.id);
  const i = document.createElement('i');
  // Il segno sul pulsante mostra la PROPORZIONE fra i tre spessori, non il
  // valore: se raddoppiasse anche lui non ci starebbe nella mensola.
  i.style.height = `calc(var(--wscale) * ${w.w})`;
  b.appendChild(i);
  widthsEl.appendChild(b);
}

function syncTools() {
  for (const b of chalksEl.children) {
    b.setAttribute('aria-pressed', String(tool === 'chalk' && b.dataset.color === ink));
  }
  for (const b of widthsEl.children) {
    b.setAttribute('aria-pressed', String(Number(b.dataset.w) === strokeWidth));
  }
  eraserBtn.setAttribute('aria-pressed', String(tool === 'eraser'));
  // Col cancellino in mano nessun gessetto e' alzato: senza questo la
  // palette intera si spegnerebbe, e non e' il momento di nasconderla.
  chalksEl.classList.toggle('chalks-idle', tool !== 'chalk');
  // Gli spessori sono segni nel colore corrente: seguono il gessetto.
  widthsEl.style.setProperty('--c', ink);
}

chalksEl.addEventListener('click', (e) => {
  const b = e.target.closest('.chalk');
  if (!b) return;
  ink = b.dataset.color;
  tool = 'chalk';
  syncTools();
});

widthsEl.addEventListener('click', (e) => {
  const b = e.target.closest('.wbtn');
  if (!b) return;
  strokeWidth = Number(b.dataset.w);
  syncTools();
});

eraserBtn.addEventListener('click', () => {
  tool = 'eraser';
  syncTools();
});

/* ---------- comandi ---------- */

const btnUndo = document.getElementById('btn-undo');
const btnClear = document.getElementById('btn-clear');
/**
 * Puo' essere null, e non e' teoria: il proxy di SiteGround tiene in cache
 * l'HTML della cartella per ore, mentre i .js li serve subito. Per un po',
 * dopo ogni pubblicazione, un index.html vecchio incontra un main.js nuovo.
 * Senza questa guardia l'intero modulo muore all'avvio e la lavagna non si
 * apre nemmeno: si perde il pulsante, non l'applicazione.
 */
const btnSave = document.getElementById('btn-save');

function syncButtons() {
  btnUndo.disabled = !history.canUndo;
  // Una lavagna di sole gommate non e' un disegno: vedi haDisegno().
  if (btnSave) btnSave.disabled = !haDisegno(drawing);
}

btnUndo.addEventListener('click', () => { if (history.undo()) { repaint(); syncButtons(); } });

btnClear.addEventListener('click', () => {
  if (!history.count) return;
  // Conferma provvisoria: il dialogo di sistema e' la cosa piu' brutta di
  // questa schermata e va rifatta come pannello dentro la lavagna.
  if (!window.confirm('Vuoi cancellare tutto il disegno?')) return;
  history.clear();
  lastStroke = null;
  repaint();
  syncButtons();
});

/**
 * SALVA.
 *
 * Un tasto solo al posto di SCARICA + INVIA (17/09/2026). Oggi scarica e, sul
 * dito, apre il foglio di condivisione; l'invio al backend si innestera' qui,
 * in Fase 6, senza toccare la mensola.
 *
 * scarica() va chiamata senza nulla davanti: il foglio di condivisione, su
 * telefono, si apre solo finche' l'attivazione del tocco e' valida (export.js).
 * Il pulsante si spegne durante l'operazione perche' su un disegno pieno la
 * codifica JPEG blocca il thread per qualche decina di millisecondi, e due
 * tocchi rapidi genererebbero due file.
 */
btnSave?.addEventListener('click', () => {
  if (btnSave.disabled) return;
  btnSave.disabled = true;
  scarica(drawing, LOGO_W)
    .catch((e) => {
      // Provvisorio come la conferma del cestino: va rifatto come pannello
      // dentro la lavagna.
      console.error(e);
      window.alert('Non e riuscito a salvare il disegno.');
    })
    .finally(syncButtons);
});

/* Qui c'era il cablaggio di "Torna al sito", tolto il 23/09/2026 insieme al
   pulsante: la pagina che ospita la lavagna ha l'header del sito, quindi il
   menu c'e' gia'. Il dettaglio da ricordare se un giorno servisse di nuovo:
   dentro un iframe window.history.back() naviga l'iframe, non la pagina. */

// Niente Ctrl+Y ne' Ctrl+Shift+Z: tolto il pulsante rifai (18/09/2026), una
// scorciatoia che lo fa lo stesso sarebbe una via nascosta che contraddice
// quel che la mensola dichiara.
document.addEventListener('keydown', (e) => {
  if (!(e.ctrlKey || e.metaKey)) return;
  if (e.key === 'z' && !e.shiftKey) { if (history.undo()) { repaint(); syncButtons(); } e.preventDefault(); }
});

/* ---------- layout ---------- */

function relayout() {
  lastLayout = board.layout();
  // I canvas sovrapposti hanno la stessa taglia: il contenitore la eredita.
  layers.style.width = `${lastLayout.cssW}px`;
  layers.style.height = `${lastLayout.cssH}px`;
  repaint();
  paintLive();
}

new ResizeObserver(relayout).observe(stage);
window.addEventListener('orientationchange', () => setTimeout(relayout, 120));

/* ---------- diagnostica (solo con ?debug=1) ---------- */

const debugOn = new URLSearchParams(location.search).has('debug');
const btnHud = document.getElementById('btn-hud');
if (debugOn) document.getElementById('debug').hidden = false;

document.getElementById('seg-smooth').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  document.querySelectorAll('#seg-smooth button').forEach((b) => {
    b.setAttribute('aria-pressed', String(b === btn));
  });
  smoothing = btn.dataset.smooth;
});

let frames = 0, worst = 0, worstEver = 0, skipFirst = false;
let prev = performance.now(), hudNext = 0, hudSince = 0;
let strokeFrames = 0, strokeFps = 0;
let refreshHz = 0, refreshFrames = 0, refreshStart = 0;
let hudOn = false;
let lastStroke = null;

/**
 * performance.now() e' quantizzato per sicurezza: 1 ms su Safari iOS. Le
 * misure di singolo frame vanno lette sapendolo; FPS TRATTO, che conta i
 * frame su centinaia di millisecondi, non ne risente.
 */
function timerResolution() {
  let best = Infinity, t0 = performance.now();
  for (let i = 0; i < 200000; i++) {
    const t = performance.now();
    if (t > t0) { if (t - t0 < best) best = t - t0; t0 = t; }
  }
  return best === Infinity ? 0 : best;
}
// Costa ~200k letture dell'orologio: si paga solo quando serve.
const TIMER_RES = debugOn ? timerResolution() : 0;

btnHud.addEventListener('click', () => {
  hudOn = !hudOn;
  hud.hidden = !hudOn;
  btnHud.setAttribute('aria-pressed', String(hudOn));
  if (hudOn) { prev = hudSince = performance.now(); frames = 0; hudNext = 0; tick(); }
});

function tick(now = performance.now()) {
  if (!hudOn) return;
  const dt = now - prev;
  prev = now;
  frames++;

  if (!refreshHz) {
    if (!refreshStart) refreshStart = now;
    refreshFrames++;
    const span = now - refreshStart;
    if (span >= 1000) refreshHz = Math.round((refreshFrames * 1000) / span);
  }

  if (input.drawing) {
    strokeFrames++;
    // Il primo frame dopo il pointerdown include il risveglio del rAF, che
    // Safari rallenta a pagina ferma: e' latenza di avvio, non costo di disegno.
    if (skipFirst) skipFirst = false;
    else if (dt > worst) { worst = dt; if (worst > worstEver) worstEver = worst; }
  }

  if (now >= hudNext) {
    const span = now - hudSince;
    const s = input.stats;
    const hz = (n) => (s.elapsed > 30 ? Math.round((n * 1000) / s.elapsed) : '—');
    const dubbio = TIMER_RES >= 4 ? ' ~' : '';

    // Quanto ha compresso la pipeline: campioni grezzi -> punti salvati.
    // I timbri sono il PRODOTTO fra punti lungo la curva e impronte
    // affiancate: e' quello il costo vero di un tratto grosso.
    let compress = '—', disegnati = '—', punta = '—';
    if (lastStroke) {
      const salvati = count(lastStroke.pts);
      const punti = count(strokeGeometry(lastStroke));
      const k = affiancate(lastStroke.width);
      disegnati = `${punti} x ${k} = ${punti * k}`;
      punta = `${puntaBase(lastStroke.width).toFixed(1)} su ${lastStroke.width}`;
      compress = `${salvati} pt`;
    }

    hud.textContent = [
      `FPS TRATTO   ${strokeFps || '—'}`,
      `fps ora      ${input.drawing ? Math.round((frames * 1000) / span) : '—'}`,
      `frame max    ${worst ? worst.toFixed(1) + dubbio : '—'}`,
      `  assoluto   ${worstEver ? worstEver.toFixed(1) + dubbio : '—'}`,
      `  timer      ${TIMER_RES ? TIMER_RES.toFixed(2) + ' ms' : '<0.01 ms'}`,
      `eventi/s     ${hz(s.moveEvents)}`,
      `campioni/s   ${hz(s.samples)}`,
      `refresh      ${refreshHz || '—'} Hz`,
      ``,
      `ultimo tratto`,
      `  grezzi     ${s.samples}`,
      `  salvati    ${compress}`,
      `  timbri     ${disegnati}`,
      `  punta      ${punta}`,
      ``,
      `smoothing    ${smoothing}`,
      `  eps        ${SMOOTHING[smoothing].eps}`,
      `stroke       ${history.count}`,
      `lavagna      ${drawing.board.w}x${drawing.board.h}`,
      `dpr          ${lastLayout ? lastLayout.dpr : '—'}`,
      `canvas       ${board.info.px}`,
    ].join('\n');

    frames = 0;
    hudSince = now;
    hudNext = now + 500;
  }
  requestAnimationFrame(tick);
}

/* ---------- tutorial (Fase 4b) ---------- */

/**
 * Gli elementi si cercano con la stessa guardia del resto: un index.html
 * vecchio in cache che incontra un main.js nuovo non deve uccidere il modulo
 * — si perde il tutorial, non la lavagna. E' gia' successo in produzione.
 */
const tutorial = createTutorial({
  root: document.getElementById('tut'),
  spot: document.getElementById('spot'),
  panel: document.getElementById('panel'),
  etichetta: document.getElementById('step-n'),
  testo: document.getElementById('step-t'),
  btnAvanti: document.getElementById('btn-avanti'),
  btnRipeti: document.getElementById('btn-ripeti'),
  btnChiudi: document.getElementById('btn-chiudi'),
});

const btnHelp = document.getElementById('btn-help');
btnHelp?.addEventListener('click', () => tutorial?.apri(0));
// Senza tutorial il "?" non porta a nulla, e un tasto che non fa niente e'
// peggio di un tasto che non c'e'.
if (!tutorial && btnHelp) btnHelp.hidden = true;

/* ---------- avvio ---------- */

relayout();
syncTools();
syncButtons();

/* Il logo si carica ora perche' al click di SALVA non c'e' tempo: l'export e'
   sincrono per non perdere l'attivazione del tocco (export.js, nota 3). Fra
   l'apertura della pagina e il primo salvataggio passano minuti; se anche non
   bastassero, l'immagine esce senza logo e il disegno si salva lo stesso. */
precaricaLogo();

/**
 * Alla prima apertura il tutorial parte da solo, poi mai piu'.
 *
 * Dopo relayout(): il riquadro si prende dai rettangoli reali degli elementi,
 * e prima del primo layout la mensola non ha ancora la sua geometria.
 *
 * `?tutorial` lo fa partire comunque. Serve a provarlo e a mostrarlo a
 * qualcuno senza dover svuotare lo storage del browser, che e' l'unica altra
 * via e non e' una cosa da chiedere a un cliente.
 */
const forzaTutorial = new URLSearchParams(location.search).has('tutorial');
if (tutorial && (forzaTutorial || !giaVisto())) tutorial.apri(0);
