/**
 * Fase 3 — effetto gessetto.
 *
 * Il tratto passa per: One Euro (live) -> pseudo-pressione -> RDP (a fine
 * gesto) -> ricampionamento su curva (al render). Vedi pen.js e render.js.
 *
 * Il tratto non e' disegnato ma timbrato: vedi chalk.js. Il fondo lavagna e'
 * un colore pieno nel CSS, senza texture.
 *
 * Deliberatamente assenti: UI definitiva, persistenza, invio. Fase 4 e oltre.
 */

import { CHALKS, chalkById, DEFAULT_CHALK, DEFAULT_WIDTH, ERASER_WIDTH,
         SMOOTHING, DEFAULT_SMOOTHING } from './palette.js';
import { createBoard } from './board.js';
import { createInput } from './input.js';
import { createPen } from './pen.js';
import { createDrawing, createHistory } from './model.js';
import { render, renderStroke, strokeGeometry } from './render.js';
import { count } from './geom.js';

const stage = document.getElementById('stage');
const layers = document.getElementById('layers');
const baseCanvas = document.getElementById('base');
const overlayCanvas = document.getElementById('overlay');
const hud = document.getElementById('hud');

const board = createBoard(baseCanvas, overlayCanvas, stage);
const drawing = createDrawing();
const history = createHistory(drawing);

let ink = chalkById(DEFAULT_CHALK).hex;
let tool = 'chalk';
let pen = null;
let lastLayout = null;

/* Taratura dal vivo: la scelta e' soggettiva e va fatta col dito su un
   telefono, non sui numeri. Strumento di Fase 2, non UI definitiva. */
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
      width: tool === 'eraser' ? ERASER_WIDTH : DEFAULT_WIDTH,
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

/* ---------- comandi ---------- */

const btnUndo = document.getElementById('btn-undo');
const btnRedo = document.getElementById('btn-redo');
const btnClear = document.getElementById('btn-clear');
const btnHud = document.getElementById('btn-hud');

function syncButtons() {
  btnUndo.disabled = !history.canUndo;
  btnRedo.disabled = !history.canRedo;
}

/* Selettori di Fase 3: servono a giudicare la texture su tutta la palette
   e a provare il cancellino. La UI vera e' Fase 4. */
const segColor = document.getElementById('seg-color');
for (const c of CHALKS) {
  const b = document.createElement('button');
  b.type = 'button';
  b.dataset.color = c.hex;
  b.style.background = c.hex;
  b.title = c.id;
  b.setAttribute('aria-label', c.id);
  b.setAttribute('aria-pressed', String(c.id === DEFAULT_CHALK));
  segColor.appendChild(b);
}
segColor.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  segColor.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
  ink = btn.dataset.color;
});

document.getElementById('seg-tool').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  document.querySelectorAll('#seg-tool button').forEach((b) => {
    b.setAttribute('aria-pressed', String(b === btn));
  });
  tool = btn.dataset.tool;
});

document.getElementById('seg-smooth').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  document.querySelectorAll('#seg-smooth button').forEach((b) => {
    b.setAttribute('aria-pressed', String(b === btn));
  });
  smoothing = btn.dataset.smooth;
});

btnUndo.addEventListener('click', () => { if (history.undo()) { repaint(); syncButtons(); } });
btnRedo.addEventListener('click', () => { if (history.redo()) { repaint(); syncButtons(); } });
btnClear.addEventListener('click', () => {
  history.clear();
  lastStroke = null;
  repaint();
  syncButtons();
});

document.addEventListener('keydown', (e) => {
  if (!(e.ctrlKey || e.metaKey)) return;
  if (e.key === 'z' && !e.shiftKey) { if (history.undo()) { repaint(); syncButtons(); } e.preventDefault(); }
  else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { if (history.redo()) { repaint(); syncButtons(); } e.preventDefault(); }
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

/* ---------- diagnostica ---------- */

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
const TIMER_RES = timerResolution();

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
    let compress = '—', disegnati = '—';
    if (lastStroke) {
      const salvati = count(lastStroke.pts);
      disegnati = count(strokeGeometry(lastStroke));
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
      ``,
      `smoothing    ${smoothing}`,
      `  eps        ${SMOOTHING[smoothing].eps}`,
      `stroke       ${history.count}`,
      `dpr          ${lastLayout ? lastLayout.dpr : '—'}`,
      `canvas       ${board.info.px}`,
    ].join('\n');

    frames = 0;
    hudSince = now;
    hudNext = now + 500;
  }
  requestAnimationFrame(tick);
}

/* ---------- avvio ---------- */

relayout();
syncButtons();
