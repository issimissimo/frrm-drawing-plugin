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

/**
 * L'altezza NON e' una costante: la lavagna prende il rapporto dello schermo
 * su cui viene aperta (Fase 4), altrimenti su un telefono in verticale il 4:3
 * si riduce a una striscia.
 *
 * Ma viene congelata al primo layout e non cambia piu' per tutta la vita del
 * disegno. Se seguisse il viewport in continuo, ruotare il telefono a meta'
 * disegno deformerebbe i tratti gia' tracciati — e "il tratto sopravvive alla
 * rotazione" e' una proprieta' validata in Fase 1 che non si perde.
 *
 * Il 4:3 resta il valore di partenza: vale nei test e ovunque non ci sia un
 * viewport da cui dedurre un rapporto.
 */
let boardH = 1200;
let boardFrozen = false;

export const boardHeight = () => boardH;

/** Chiamata dal primo layout. Le successive non fanno nulla, finche' e' congelato. */
export function freezeBoardHeight(aspect) {
  if (boardFrozen || !(aspect > 0)) return boardH;
  boardFrozen = true;
  boardH = Math.round(BOARD_W / aspect);
  return boardH;
}

/**
 * Riapre il congelamento. La chiama main.js al relayout, ma SOLO se sulla
 * lavagna non c'e' ancora niente.
 *
 * Il congelamento esiste per proteggere un disegno gia' fatto: cambiare il
 * rapporto sotto ai tratti li deformerebbe. Se di tratti non ce n'e' nessuno,
 * non c'e' niente da proteggere, e tenersi un rapporto misurato male e' solo
 * un danno.
 *
 * Perche' e' servito (23/09/2026, Chrome su Android): dentro WordPress il
 * contenitore della lavagna prende la sua altezza definitiva da uno script,
 * e c'era una CORSA fra quello script e il primo layout dell'app dentro
 * l'iframe. Dove vinceva l'app, il rapporto restava congelato su un'altezza
 * di 65px piu' del vero — per sempre, con bande nere ai lati per tutta la
 * sessione. Su Chrome desktop e su Safari vinceva lo script e non si vedeva
 * niente: il classico difetto che esiste solo sul device di qualcun altro.
 *
 * La corsa e' stata chiusa anche dall'altro lato, nel plugin. Questa e' la
 * difesa in profondita': se un domani qualcosa ridimensionasse il contenitore
 * dopo l'avvio — un header che si contrae, un banner cookie che si chiude —
 * la lavagna vuota si riadatta invece di restare storta.
 */
export function unfreezeBoardHeight() {
  boardFrozen = false;
}

/** Oltre 2 il costo di fill rate non ripaga: un iPhone a DPR 3 perde frame. */
export const DPR_CAP = 2;

/**
 * Sotto questa larghezza CSS della lavagna lo schermo e' "stretto".
 *
 * Non e' una media query: e' la larghezza REALE della lavagna, quindi vale
 * anche per una finestra desktop rimpicciolita o per un telefono in
 * orizzontale. Una soglia sola per tutte le decisioni che ne dipendono —
 * oggi il raddoppio degli strumenti (main.js) e la misura del logo
 * sull'immagine salvata (export.js) — cosi' che "stretto" voglia dire la
 * stessa cosa dappertutto.
 */
export const SOGLIA_STRETTA = 700;

export const BOARD_BG = '#1F2225';

/**
 * Dieci gessetti; sei a luminanza e croma costanti (L 0.780 / C 0.120), cosi' che
 * nessuno pesi piu' degli altri. Quattro stanno fuori serie, e ognuno per un
 * motivo suo:
 *
 *   bianco    piu' chiaro: e' il default, deve leggersi come "il gesso".
 *   rosso     piu' scuro:  a L 0.780 il rosso e' un rosa salmone, che era
 *             esattamente il vecchio "corallo". Per essere rosso deve scendere.
 *   marrone   piu' scuro:  il marrone E' un arancione scuro. A L 0.780 non
 *             esiste, viene beige.
 *
 * Rosso e marrone, richiesti dal cliente il 15/09/2026, costano contrasto sul fondo nero —
 * 4,6 e 4,3 contro i 7,6-8,4 degli altri — ed e' il minimo che si possa
 * pagare tenendoli riconoscibili: un rosso piu' pieno (#F90F0D) scende a
 * 3,9 e un marrone piu' scuro (#9E6F43) a 3,7, dove un tratto sottile
 * comincia a sparire.
 *
 *   nero      il quarto fuori serie, chiesto dal cliente il 28/09/2026 (i
 *             bambini lo cercavano; il cancellino non era una risposta). NON
 *             e' il colore della lavagna, che era la richiesta iniziale:
 *             provato, #1F2225 sul fondo vuoto non lascia alcun segno e
 *             sopra i colori appena un graffio, perche' il tratto e' al 35%.
 *             Un bambino lo prova sul vuoto e conclude che e' rotto. Il nero
 *             vero sul vuoto fa una macchia scura (contrasto 1,27) e sopra i
 *             colori taglia. `scuro` fa bordare i segni degli spessori, che
 *             sono nel colore corrente e sulla mensola sparirebbero.
 */
export const CHALKS = [
  { id: 'bianco',  hex: '#FAF8F3', L: 0.980, C: 0.008, H: 95  },
  { id: 'nero',    hex: '#050506', L: 0.116, C: 0.003, H: 286, scuro: true },
  { id: 'giallo', hex: '#C9B957', L: 0.780, C: 0.120, H: 100 },
  { id: 'arancio', hex: '#F1A366', L: 0.780, C: 0.120, H: 58  },
  { id: 'rosso',   hex: '#FE4335', L: 0.660, C: 0.225, H: 29  },
  { id: 'rosa',    hex: '#F197C2', L: 0.780, C: 0.120, H: 350 },
  { id: 'lilla',   hex: '#C9A3F5', L: 0.780, C: 0.120, H: 305 },
  { id: 'azzurro', hex: '#71BFFF', L: 0.780, C: 0.120, H: 245 },
  { id: 'marrone', hex: '#AD794B', L: 0.620, C: 0.090, H: 62  },
  { id: 'verde',   hex: '#85CC87', L: 0.780, C: 0.120, H: 145 },
];

export const DEFAULT_CHALK = 'bianco';

/** Spessori in unita' di lavagna. Rapporto 2.2x: distinguibili a colpo d'occhio. */
export const WIDTHS = [
  { id: 'sottile', w: 21 },
  { id: 'medio',   w: 27 },
  { id: 'grosso',  w: 50 },
];

export const DEFAULT_WIDTH = 27;

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

/**
 * Opacita' del tratto piu' veloce, come frazione di quella piena.
 *
 * La pseudo-pressione agisce su DUE cose: quanto e' largo il segno e quanto
 * gesso deposita. La seconda pesa di piu' sulla larghezza percepita — un
 * bordo meno opaco scende sotto la soglia di visibilita' e il tratto sembra
 * piu' stretto anche se geometricamente non lo e'.
 *
 * Va tarata INSIEME a PRESSURE_MIN: muovere una sola delle due non produce
 * il risultato atteso. Vedi la nota sotto.
 */
export const PRESSURE_ALPHA_MIN = 0.85;

/**
 * Larghezza del tratto piu' veloce, come frazione di quella nominale.
 *
 * Insieme a PRESSURE_ALPHA_MIN determina quanto il tratto cambia fra gesto
 * lento e gesto rapido. Il cliente ha chiesto il 15/09/2026 una variazione
 * **del 20%** su cio' che si vede: non un tetto da cui stare lontani — a
 * 13% il tratto sembra uniforme e la pressione non si legge piu'.
 *
 * Tarato misurando la banda resa, non calcolando. Le due leve si sommano in
 * modo non ovvio, ed e' il motivo per cui vanno mosse insieme:
 *
 *   geo 0.92  alfa 0.90  ->  13 / 12 /  9%   il tratto sembra sempre uguale
 *   geo 0.92  alfa 0.65  ->  21 / 18 / 10%   il grosso resta piatto
 *   geo 0.88  alfa 0.75  ->  25 / 18 / 14%   il sottile sfora
 *   geo 0.84  alfa 0.85  ->  21 / 21 / 16%   scelto: uniforme sui tre
 */
export const PRESSURE_MIN = 0.84;

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

/**
 * 0.35 dal 23/09/2026, prima 0.80: il cliente voleva il tratto meno opaco,
 * "piu' gessetto". Scelto da Daniele su un confronto a parita' di tratti e di
 * grana (0.80 / 0.65 / 0.50 / 0.35).
 *
 * Il valore NON scala in proporzione, perche' le impronte si sommano: sulla
 * campitura bianca la copertura media e' andata da 0.81 a 0.63, e i pixel
 * quasi pieni dal 57% all'11%. Sotto 0.65 non si vedeva quasi differenza.
 *
 * Prezzi dichiarati, misurati sul confronto:
 *   - i colori escono piu' scuri e meno saturi sul fondo; rosso e marrone,
 *     gia' i meno contrastati (4,6 e 4,3), in un tratto sottile si perdono
 *     per primi;
 *   - riempire una zona chiede piu' passate;
 *   - i bordi piu' trasparenti fanno SEMBRARE il tratto piu' sottile. E' lo
 *     stesso meccanismo della questione spessore/velocita' chiusa il
 *     17/09/2026 (PRESSURE_*): se tornasse la lamentela "i tratti sono
 *     sottili", la causa e' questa costante, non quelle.
 */
export const CHALK_ALPHA = 0.35;

/**
 * Il cancellino deve togliere davvero al primo passaggio: a 0.55 lasciava
 * un'ombra invece di un vuoto, e un bambino ripassa cinque volte chiedendosi
 * perche' non funziona. Resta comunque granuloso e irregolare — il cancellino
 * che sporca fa parte dell'estetica, quello che sbiadisce e' solo un difetto.
 */
export const ERASER_ALPHA = 0.85;

/**
 * Il gesso nuovo (gesso.js, dal 29/09/2026). Col gesso nuovo CHALK_ALPHA non
 * si usa piu': vale solo per `?gesso=vecchio`.
 *
 * Un oggetto e non costanti sciolte perche' la pagina di confronto
 * (confronto-gesso.html?taratura) li muove dal vivo: nel prototipo nessuno
 * li cambia.
 *
 * Il valore di ciascun pixel e', in ordine:
 *
 *   X = deposito della punta trascinata x cresta della lavagna
 *   min(1, guadagno x max(0, X - soglia)) + velo x deposito
 *   ... x opacita, nel colore del gessetto
 *
 *   deposito   opacita' di ciascuna striscia della punta: quanto gesso
 *              arriva a ogni passaggio.
 *   soglia     il deposito sotto cui non resta niente. E' cio' che fa il
 *              bordo netto invece che sfumato: a 0 torna l'alone.
 *   guadagno   quanto in fretta, sopra la soglia, il gesso diventa pieno.
 *   opacita    il tetto: quanto copre il gesso quando ce n'e' tanto.
 *              Quanto copre UNA passata lo decidono deposito e guadagno
 *              (~60%): senza pressione vera, e' ripassando che il bambino
 *              fa il pieno, e due colori si mescolano (Daniele, 29/09/2026).
 *              Fino al 30/09 era un 0,7 applicato al tratto intero, e
 *              ripassare SENZA staccare il dito non aumentava niente.
 *   valle      altezza della lavagna sotto cui non attacca niente,
 *   picco      e sopra cui attacca tutto: il contrasto della grana.
 *   velo       la polvere che resta nelle valli, come frazione del deposito.
 *              Sopra 0,15 torna l'alone grigio attorno ai tratti.
 *   filamenti  quanto si vedono i filamenti lungo il gesto: 0 punta liscia,
 *              1 punta a righe.
 *   bordo      quanto e' largo il bordo sfumato della punta, come frazione
 *              della larghezza. Piu' largo = tratto che SEMBRA piu' sottile.
 *   inclinazione  quanto il gesso inclinato allarga o stringe ciascun bordo,
 *              lentamente (su ~70 unita'). Frazione della meta' larghezza.
 *   sfrangia   l'irregolarita' fine del bordo (su ~5 unita'): organico,
 *              non tirato. Frazione della meta' larghezza.
 *   ventaglio  il deposito delle strisce aggiunte nelle curve strette, come
 *              frazione di quelle normali: a 1 ogni inversione dello
 *              scarabocchio diventa un punto bianco.
 *
 * Tarati il 29/09/2026 su una foto di disegni a gesso (dreamstime 189200205,
 * scelta da Daniele) e sulla larghezza percepita del vecchio, misurata sul
 * profilo medio del tratto a meta' altezza (export 1600, spessore 27):
 *
 *                     lento    inchiostro   veloce (p 0,2): inchiostro, larghezza
 *   vecchio (-20)     25 px    3252         -30%, -28%
 *   -22               24 px    2056         -29%,  -8%
 *   questi            23 px    2047         -31%,  -4%
 *
 * E la luminosita' media di una zona scarabocchiata, 1 / 2 / 3 passate,
 * media su sei semi (confronto-gesso.html, le sei zone in alto a sinistra):
 *
 *   tratti separati        63 / 83 / 93
 *   un tratto, senza staccare  64 / 73 / 79
 *
 * Senza staccare si accumula meno perche' dentro lo stesso tratto la trama
 * della lavagna e' la stessa: si riempiono le valli solo per deposito.
 *
 * L'inchiostro e' due terzi del vecchio di proposito: e' la passata
 * semitrasparente. Sul gesto veloce il gesso nuovo diventa piu' rado, non
 * piu' stretto, perche' il bordo resta netto: e' quel che fa il gesso vero,
 * ma e' diverso da quel che il cliente aveva chiesto il 15/09. Da decidere.
 *
 * Le combinazioni scartate, e perche', in .lavoro/stato.md.
 */
export const GESSO = {
  deposito: 0.55,
  soglia: 0.06,
  guadagno: 2,
  opacita: 0.95,
  valle: 0.25,
  picco: 0.72,
  velo: 0.1,
  filamenti: 0.4,
  bordo: 0.04,
  inclinazione: 0.12,
  sfrangia: 0.05,
  ventaglio: 0.35,
};

export const chalkById = (id) => CHALKS.find((c) => c.id === id) || CHALKS[0];
