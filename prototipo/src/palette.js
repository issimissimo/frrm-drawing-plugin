/**
 * Costanti della lavagna. Fonte unica: fase-0-specifiche.md
 *
 * Gli hex sono derivati dai valori OKLCH accanto a ciascuno. Se serve
 * ricalibrare la resa (probabile dopo la Fase 3: grana e opacita' irregolare
 * abbassano la saturazione percepita), si sposta L o C per tutti in un colpo
 * solo e si rigenerano gli hex, cosi' la palette resta isoluminante.
 */

/** Lavagna logica: tutte le coordinate degli stroke vivono qui dentro. */
export const BOARD_W = 1600;
export const BOARD_H = 1200;

/** Oltre 2 il costo di fill rate non ripaga: un iPhone a DPR 3 perde frame. */
export const DPR_CAP = 2;

export const BOARD_BG = '#1F2225';

/**
 * Nove gessetti a luminanza e croma costanti (L 0.780 / C 0.120), tranne il
 * bianco che sta fuori serie: e' il default e deve leggersi come "il gesso".
 */
export const CHALKS = [
  { id: 'bianco',  hex: '#FAF8F3', L: 0.980, C: 0.008, H: 95  },
  { id: 'giallo',  hex: '#C9B957', L: 0.780, C: 0.120, H: 100 },
  { id: 'arancio', hex: '#F1A366', L: 0.780, C: 0.120, H: 58  },
  { id: 'corallo', hex: '#FB9795', L: 0.780, C: 0.120, H: 22  },
  { id: 'rosa',    hex: '#F197C2', L: 0.780, C: 0.120, H: 350 },
  { id: 'lilla',   hex: '#C9A3F5', L: 0.780, C: 0.120, H: 305 },
  { id: 'azzurro', hex: '#71BFFF', L: 0.780, C: 0.120, H: 245 },
  { id: 'acqua',   hex: '#3BCFCF', L: 0.780, C: 0.120, H: 195 },
  { id: 'verde',   hex: '#85CC87', L: 0.780, C: 0.120, H: 145 },
];

export const DEFAULT_CHALK = 'bianco';

/** Spessori in unita' di lavagna. Rapporto 2.2x: distinguibili a colpo d'occhio. */
export const WIDTHS = [
  { id: 'sottile', w: 10 },
  { id: 'medio',   w: 22 },
  { id: 'grosso',  w: 44 },
];

export const DEFAULT_WIDTH = 22;

/** Il cancellino e' uno strumento a se': va largo, non di precisione. */
export const ERASER_WIDTH = 90;

/* --- Pipeline del tratto (fase-0-specifiche.md, sezione 5) ------------------
   Valori di partenza, da tarare sul device: non sono definitivi. */

/** Distanza fra i campioni dopo il ricampionamento, in unita' di lavagna. */
export const RESAMPLE_SPACING = 2.5;

/** Soglia RDP applicata a pointerup. */
export const RDP_EPSILON = 10;

/**
 * One Euro. Un solo assetto per tutti i livelli di smoothing.
 *
 * beta governa quanto il filtro segue i gesti rapidi, NON quanto il tratto
 * risulta liscio: a parita' di semplificazione la rugosita' finale resta
 * 0.30 gradi per qualunque beta fra 0.02 e 0.3, mentre il lag passa da 6.7
 * a 0.5 unita'. Non essendoci un compromesso, si tiene il valore migliore.
 *
 * Lo 0.007 del paper originale e' tarato per coordinate in pixel: qui, in
 * unita' di lavagna, lasciava 15 unita' di lag, visibili come un tratto che
 * insegue il dito.
 *
 * Nota per chi cerchera' di aumentare lo smoothing agendo qui: non funziona.
 * Il tremore gonfia la stima di velocita' (un rumore di +-4 unita' a 55 Hz
 * vale ~440 unita'/s apparenti), quindi il termine beta*velocita' domina e
 * ne' beta ne' minCutoff riescono a filtrarlo. La leva e' RDP_EPSILON.
 */
export const ONE_EURO = { minCutoff: 1.0, beta: 0.2, dCutoff: 1.0 };

/** Larghezza minima come frazione di quella nominale (tratto veloce). */
export const PRESSURE_MIN = 0.35;

/** Velocita' oltre la quale il tratto e' al minimo spessore, in unita'/s. */
export const SPEED_MAX = 2200;

/**
 * I tre livelli di smoothing, che differiscono solo per quanto semplificano.
 * Rugosita' = variazione angolare media fra segmenti consecutivi, in gradi:
 * e' cio' che l'occhio legge come "tremolante", e una curva pulita sta a 0.30.
 *
 *   molto  eps 10  ->  0.31   liscio come una curva disegnata
 *   medio  eps  3  ->  0.7    ripulito ma riconoscibile
 *   poco   eps  1  ->  3.5    il gesto com'e', tremore compreso
 */
export const SMOOTHING = {
  molto: { eps: 10 },
  medio: { eps: 3 },
  poco:  { eps: 1 },
};

/* Scelto il 31/08/2026 provando sul telefono: il tratto risulta pulito come
   una curva disegnata, che e' l'effetto voluto. */
export const DEFAULT_SMOOTHING = 'molto';

/* --- Effetto gessetto (Fase 3) --------------------------------------------
   Opacita' del singolo timbro. Le impronte si sovrappongono, quindi il valore
   e' molto sotto 1: alzarlo rende il tratto compatto e "a pennarello". */

export const CHALK_ALPHA = 0.80;

/**
 * Il cancellino deve togliere davvero al primo passaggio: a 0.55 lasciava
 * un'ombra invece di un vuoto, e un bambino ripassa cinque volte chiedendosi
 * perche' non funziona. Resta comunque granuloso e irregolare — il cancellino
 * che sporca fa parte dell'estetica, quello che sbiadisce e' solo un difetto.
 */
export const ERASER_ALPHA = 0.85;

export const chalkById = (id) => CHALKS.find((c) => c.id === id) || CHALKS[0];
