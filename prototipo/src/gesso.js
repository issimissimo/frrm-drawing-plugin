/**
 * Il gesso nuovo (dal 29/09/2026, branch gesso-realistico).
 *
 * chalk.js timbra il tratto con impronte tonde che hanno la grana DENTRO.
 * Si sovrappongono una decina per punto e ogni grana fine si media via: per
 * questo le sue macchie sono larghe e il risultato legge come pastello
 * morbido, con i riempimenti piatti come un pennarello.
 *
 * Qui il tratto e' fatto come lo fa un gessetto vero:
 *
 *   1. PUNTA      una striscia sottile, con un profilo di filamenti lungo la
 *                 larghezza, TRASCINATA lungo la curva e ruotata nella
 *                 direzione del gesto. I filamenti restano allineati da un
 *                 capo all'altro del tratto: e' la grana allungata che si vede
 *                 nel gesso vero, e che le impronte tonde non possono fare.
 *   2. LAVAGNA    dal deposito si SOTTRAE la profondita' delle valli di una
 *                 trama fine: con poco gesso si accendono solo le creste, con
 *                 tanto si riempiono anche le valli. Ripassare riempie i
 *                 buchi anche senza staccare il dito, perche' e' il deposito
 *                 accumulato a riempirli. (Fino al 30/09 si MOLTIPLICAVA per
 *                 la cresta: una valle a zero restava zero per qualunque
 *                 deposito, e i buchi sparivano solo staccando il dito.)
 *   3. SOGLIA     con la stessa sottrazione, meno una costante; poi un
 *                 guadagno: il bordo resta netto invece di sfumare.
 *   4. COLORE     una passata copre solo in parte (GESSO.opacita): i bambini
 *                 ripassano per avere il colore pieno, e due colori sovrapposti
 *                 si mescolano. Non c'e' una pressione vera da cui ricavarlo.
 *
 * Tutto in GPU, con operazioni di composizione: niente getImageData, che su
 * Safari riporterebbe i pixel dalla GPU a ogni frame.
 *
 * Deterministico dal seme dello stroke (D1): stessa punta, stessa trama,
 * stesso tremolio, a qualunque risoluzione.
 */

import { timbra, mulberry32, passoTimbri } from './chalk.js';
import { resample, count, length } from './geom.js';
import { GESSO, PRESSURE_MIN, PRESSURE_ALPHA_MIN } from './palette.js';

/** Come timbra(): la pressione stringe la banda fino a PRESSURE_MIN. */
const PRESSIONE_BANDA = (p) => PRESSURE_MIN + (1 - PRESSURE_MIN) * p;

const liscia = (t) => t * t * (3 - 2 * t);
const tra = (a, b, x) => liscia(Math.min(1, Math.max(0, (x - a) / (b - a))));

/** Hash intero -> [0, 1). Deterministico, senza stato. Lo usa anche fondo.js. */
export function hash(x, y, o) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(o + 1, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/* --- La trama della lavagna ------------------------------------------------ */

/**
 * Lato della tessera che si ripete, in unita' di lavagna. Grande abbastanza
 * che la ripetizione non si legga dentro un riempimento, piccola abbastanza da
 * generarla in qualche decina di millisecondi anche a DPR 2.
 */
export const TRAMA = 512;

/**
 * Le ottave della trama: lato della cella in unita' di lavagna e peso. Ogni
 * lato divide TRAMA, cosi' la tessera si ripete senza cucitura.
 *
 *     1   la grana: a DPR 1 e' un pixel, com'e' nel gesso vero
 *     2   la tiene insieme appena, altrimenti e' rumore televisivo
 *    16   nuvole: zone dove la lavagna "prende" meglio o peggio
 *    64   e piu' larghe, perche' un riempimento non sia uniforme
 *
 * Il 29/09/2026 la cella piu' fine era 2 e pesava insieme alla 4: grana
 * giudicata "troppo uniforme e grossolana" da Daniele sul confronto con una
 * foto di gesso vero. Il 30/09 le nuvole (16 e 64) sono scese da 0,32 a
 * 0,26: con l'opacita' che nasce dal deposito, una nuvola sfortunata faceva
 * sembrare un tratto molto piu' debole di un altro.
 */
export const OTTAVE = [
  { cella: 1, peso: 0.50 },
  { cella: 2, peso: 0.24 },
  { cella: 16, peso: 0.15 },
  { cella: 64, peso: 0.11 },
];

/** Il reticolo di un'ottava, calcolato una volta sola. */
const reticoli = OTTAVE.map(({ cella }, o) => {
  const n = TRAMA / cella;
  const r = new Float32Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) r[y * n + x] = hash(x, y, o);
  return { n, cella, r };
});

/**
 * Altezza grezza della lavagna nel punto (u, v), in unita' di lavagna.
 * Periodica su TRAMA in entrambe le direzioni. Media ~0,5, poco dispersa:
 * e' una somma di ottave, quindi il contrasto lo da' `cresta()`.
 */
export function altezza(u, v) {
  let h = 0;
  for (let o = 0; o < reticoli.length; o++) {
    const { n, cella, r } = reticoli[o];
    const gx = u / cella, gy = v / cella;
    const x0 = Math.floor(gx), y0 = Math.floor(gy);
    const fx = liscia(gx - x0), fy = liscia(gy - y0);
    const xa = ((x0 % n) + n) % n, ya = ((y0 % n) + n) % n;
    const xb = (xa + 1) % n, yb = (ya + 1) % n;
    const a = r[ya * n + xa], b = r[ya * n + xb];
    const c = r[yb * n + xa], d = r[yb * n + xb];
    const top = a + (b - a) * fx, bot = c + (d - c) * fx;
    h += OTTAVE[o].peso * (top + (bot - top) * fy);
  }
  return h;
}

/**
 * Quanto il punto (u, v) trattiene il gesso: 0 valle, 1 cresta. Il contrasto
 * e' la leva che separa il gesso dal pastello.
 */
export function cresta(u, v) {
  return tra(GESSO.valle, GESSO.picco, altezza(u, v));
}

/**
 * La tessera renderizzata a `k` pixel per unita' di lavagna, campionata al
 * centro di ogni pixel: a risoluzioni diverse e' la stessa trama, campionata
 * piu' o meno fitta.
 *
 * Nell'alfa c'e' la PROFONDITA' della valle (1 - cresta), non la cresta: e'
 * quel che si sottrae al deposito.
 */
function tessera(k) {
  const lato = Math.max(1, Math.round(TRAMA * k));
  const cv = document.createElement('canvas');
  cv.width = cv.height = lato;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(lato, lato);
  const d = img.data;
  const passo = TRAMA / lato;
  for (let y = 0; y < lato; y++) {
    const v = (y + 0.5) * passo;
    for (let x = 0; x < lato; x++) {
      const i = (y * lato + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = 255;
      d[i + 3] = Math.round((1 - cresta((x + 0.5) * passo, v)) * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

/**
 * Le tessere gia' generate, per lato in pixel e taratura. Condivise fra tutti
 * i canvas d'appoggio: la stessa scala sullo schermo e nell'export e' la
 * stessa tessera, e generarla costa (a DPR 2 qualche decina di ms).
 */
const tessere = new Map();

const chiaveTessera = (k) =>
  `${Math.max(1, Math.round(TRAMA * k))}:${GESSO.valle}:${GESSO.picco}`;

function tesseraPer(k) {
  const chiave = chiaveTessera(k);
  let t = tessere.get(chiave);
  if (!t) {
    // Poche voci — schermo ed export — ma senza tetto crescerebbe a ogni
    // resize della finestra.
    if (tessere.size >= 4) tessere.delete(tessere.keys().next().value);
    t = tessera(k);
    tessere.set(chiave, t);
  }
  return t;
}

/**
 * Genera in anticipo la tessera per la scala `k`. La chiama main.js a ogni
 * layout: senza, la prima tessera si genererebbe al primo tocco, e a DPR 2
 * sono qualche decina di millisecondi proprio sul primo tratto.
 */
export const precaricaTrama = (k) => { tesseraPer(k); };

/* --- La punta del gessetto -------------------------------------------------- */

/** Rumore a una dimensione, liscio, in [0, 1]: celle di `cella` unita'. */
function rumore1(seme, cella) {
  return (s) => {
    const g = s / cella, i = Math.floor(g);
    const a = hash(i, seme, 7), b = hash(i + 1, seme, 7);
    return a + (b - a) * liscia(g - i);
  };
}

/**
 * Il profilo della punta attraverso il tratto: quanto gesso deposita alla
 * distanza `v` dal bordo sinistro, per un tratto largo `w`. In [0, 1].
 *
 *  - i FILAMENTI: rumore fine attraverso la larghezza, meno di un'unita' di
 *    lavagna, piu' uno piu' largo che li raggruppa. Trascinato lungo la curva
 *    diventa la striatura;
 *  - i BORDI: il deposito cala nell'ultimo decimo della larghezza. Netti,
 *    perche' un bordo morbido e' l'aerografo di prima;
 *  - i GRANELLI (dal 30/09/2026): la punta sporge di `granelli(w)` per lato
 *    oltre la larghezza nominale, e il calo del deposito si allunga su tutta
 *    quella fascia. Li' il deposito e' poco, e la soglia sulla trama lascia
 *    solo le creste: il bordo si sgrana in puntini, come nella "I" della foto
 *    di riferimento, invece di sfumare. La rampa si allunga solo verso
 *    l'esterno: il nucleo resta quello della -24. Centrata sul bordo di
 *    prima toglieva deposito anche dentro, e le linee sottili sembravano
 *    piu' esili (provato il 30/09/2026).
 *
 * `v` va da 0 a `w + 2 * granelli(w)`: la larghezza di tutta la punta.
 */
export function profiloPunta(seme, w) {
  // Il medio a 3,2 unita' faceva corsie leggibili: l'ellisse di prova
  // sembrava un binario. A 2 raggruppa senza disegnare righe.
  const fine = rumore1(seme, 0.9);
  const medio = rumore1(seme ^ 0x2545F491, 2);
  const est = granelli(w);
  const bordo = Math.min(w * 0.18, 1 + w * GESSO.bordo) + est;
  const wt = w + 2 * est;
  const f = GESSO.filamenti;
  return (v) => {
    const fil = 0.7 * fine(v) + 0.3 * medio(v);
    const striato = 1 - f + f * tra(0.2, 0.75, fil);
    return striato * tra(0, bordo, v) * tra(0, bordo, wt - v);
  };
}

/**
 * Di quanto la punta sporge per lato oltre la larghezza nominale, in unita'
 * di lavagna. A zero il bordo e' quello della -24.
 */
export const granelli = (w) => w * GESSO.granelli;

/**
 * La punta come immagine: `lungo` unita' nella direzione del gesto, `w`
 * attraverso, a `k` pixel per unita'. Lungo il gesto la striscia sfuma ai due
 * capi (finestra di Hann), cosi' le strisce successive si fondono senza
 * cuciture.
 *
 * Attraverso si campiona tre volte per pixel: sul telefono un'unita' di
 * lavagna e' mezzo pixel, e senza media i filamenti diventerebbero aliasing.
 */
function immaginePunta(seme, w, lungo, k) {
  const wt = w + 2 * granelli(w);
  const W = Math.max(2, Math.round(lungo * k));
  const H = Math.max(2, Math.round(wt * k));
  const prof = profiloPunta(seme, w);
  const colonna = new Float32Array(H);
  for (let y = 0; y < H; y++) {
    let s = 0;
    for (let q = 0; q < 3; q++) s += prof(((y + (q + 0.5) / 3) / H) * wt);
    colonna[y] = s / 3;
  }
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(W, H);
  const d = img.data;
  for (let x = 0; x < W; x++) {
    const hann = 0.5 - 0.5 * Math.cos((2 * Math.PI * (x + 0.5)) / W);
    for (let y = 0; y < H; y++) {
      const i = (y * W + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = 255;
      d[i + 3] = Math.round(colonna[y] * hann * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

/**
 * L'ultima punta generata. Il tratto in corso si ridisegna a ogni frame con
 * la stessa punta: rigenerarla ogni volta sarebbe lavoro buttato. Per gli
 * altri tratti costa poco — qualche centinaio di pixel — e non si conserva.
 */
let puntaInCache = { chiave: '', cv: null };
function punta(seme, w, lungo, k) {
  const chiave = `${seme}:${w}:${lungo}:${k}:${GESSO.filamenti}:${GESSO.bordo}:${GESSO.granelli}`;
  if (puntaInCache.chiave !== chiave) puntaInCache = { chiave, cv: immaginePunta(seme, w, lungo, k) };
  return puntaInCache.cv;
}

/**
 * Lunghezza della striscia lungo il gesto. Lunga abbastanza da posarne poche
 * (il costo e' una drawImage ciascuna), corta abbastanza da seguire le curve:
 * a 12 unita' su un raggio di 20 la corda si scosta dalla curva di 0,9.
 */
export const lunghezzaPunta = (w) => Math.min(12, Math.max(4, w * 0.3));

/** Distanza fra due strisce: 0,4 della lunghezza, cosi' si coprono. */
export const passoPunta = (w) => lunghezzaPunta(w) * 0.4;

/**
 * Trascina la punta lungo il tratto, sul contesto `ctx` gia' ripulito.
 * `m` e' la trasformazione della lavagna.
 *
 * `da` e `a` limitano le strisce posate a [da, a), con le strisce del
 * ventaglio che precedono ciascuna: servono al tratto dal vivo, che posa
 * ogni striscia definitiva una volta sola (disegnaGessoVivo). Ogni striscia
 * dipende solo dal suo indice, dai vicini e dalla lunghezza del tratto,
 * quindi a pezzi o tutte insieme sono le stesse strisce nello stesso ordine.
 * `pts` e' il tratto gia' ricampionato col passo della punta, se c'e'.
 */
export function trascina(ctx, m, stroke, da = 0, a = Infinity, pts = null) {
  const { width: w, seed } = stroke;
  const lungo = lunghezzaPunta(w);
  const passo = passoPunta(w);
  if (!pts) pts = resample(stroke.pts, passo);
  const n = count(pts);
  const k = m.a;
  const img = punta(seed, w, lungo, k);

  // Il tremolio della mano: la striscia si sposta di poco di lato, lentamente.
  // Lento e non a ogni striscia, o i filamenti si sfalserebbero e si
  // confonderebbero fra loro.
  const lato = rumore1(seed ^ 0x6A09E667, 40);
  const dose = rumore1(seed ^ 0x510E527F, 18);

  // I due bordi, ciascuno per conto suo (Daniele, 30/09/2026: "il gessetto
  // viene inclinato, in ogni direzione"). Due scale:
  //  - l'INCLINAZIONE, lenta (70 unita'): il tratto si allarga da un lato e
  //    poi dall'altro, come nella "I" e nella "S" della foto di riferimento.
  //    Veloce leggerebbe come una mano che trema, non come un gesso inclinato;
  //  - la SFRANGIATURA, fine (5 unita'): il bordo organico, non tirato.
  const inclSx = rumore1(seed ^ 0x3C6EF372, 70);
  const inclDx = rumore1(seed ^ 0xA54FF53A, 70);
  const sfrSx = rumore1(seed ^ 0x9B05688C, 5);
  const sfrDx = rumore1(seed ^ 0x1F83D9AB, 5);
  const bordoSx = (s) => 1 + GESSO.inclinazione * (2 * inclSx(s) - 1) + GESSO.sfrangia * (2 * sfrSx(s) - 1);
  const bordoDx = (s) => 1 + GESSO.inclinazione * (2 * inclDx(s) - 1) + GESSO.sfrangia * (2 * sfrDx(s) - 1);

  const L = (n - 1) * passo;
  const r = w / 2;
  // La punta disegnata e' piu' larga della nominale della fascia dei granelli:
  // sx e dx sono le meta' nominali, `sporge` le porta a tutta la punta.
  const sporge = 1 + (2 * granelli(w)) / w;

  // Una striscia nel punto (x, y), ruotata di `ang`, a distanza `s`
  // dall'inizio, con una frazione `peso` del deposito.
  const posa = (x, y, ang, p, s, peso = 1) => {
    // Le estremita' si arrotondano: vicino ai capi la striscia si stringe
    // come un semicerchio. Senza, ogni tratto finirebbe tagliato netto.
    const dal = Math.min(s, L - s);
    const capo = dal >= r ? 1 : Math.max(0.2, Math.sqrt(1 - (1 - dal / r) ** 2));
    const meta = r * PRESSIONE_BANDA(p) * capo;
    const sx = meta * bordoSx(s), dx = meta * bordoDx(s);
    const off = (lato(s) - 0.5) * 0.06 * w;
    const c = Math.cos(ang), sn = Math.sin(ang);
    ctx.setTransform(k * c, k * sn, -k * sn, k * c, k * x + m.e, k * y + m.f);
    // La pressione toglie anche deposito, come in timbra(): e' cio' che fa
    // leggere la variazione di spessore col gesto (tarata il 17/09/2026).
    // Senza, la soglia la schiacciava al 9%.
    ctx.globalAlpha = GESSO.deposito * peso * (0.75 + 0.25 * dose(s))
      * (PRESSURE_ALPHA_MIN + (1 - PRESSURE_ALPHA_MIN) * p);
    ctx.drawImage(img, -lungo / 2, off - sx * sporge, lungo, (sx + dx) * sporge);
  };

  let prec = null;   // [x, y, angolo, p] della striscia precedente
  const fine = Math.min(a, n);
  for (let i = Math.max(0, da - 1); i < fine; i++) {
    const x = pts[i * 3], y = pts[i * 3 + 1], p = pts[i * 3 + 2];
    const ia = Math.max(0, i - 1), ib = Math.min(n - 1, i + 1);
    const ang = Math.atan2(pts[ib * 3 + 1] - pts[ia * 3 + 1], pts[ib * 3] - pts[ia * 3]);
    const s = i * passo;
    // La striscia prima di `da` non si posa: serve solo al ventaglio della
    // prima, che si apre a partire da lei.
    if (i < da) { prec = [x, y, ang, p]; continue; }

    // Dove il gesto gira stretto — le inversioni dello scarabocchio — fra
    // una striscia e la successiva l'angolo salta, e sul lato esterno della
    // curva le strisce si aprono a ventaglio: un pettine di filamenti come
    // raggi. Si riempie il ventaglio con strisce intermedie, un passo ogni
    // 0,15 radianti. Costa solo nelle curve strette.
    //
    // Piu' leggere delle altre: dal 30/09/2026 il deposito si accumula dentro
    // lo stesso tratto, e le strisce del ventaglio si sovrappongono tutte
    // vicino al perno. A peso pieno ogni inversione diventava un punto bianco.
    if (prec) {
      let d = ang - prec[2];
      d = Math.atan2(Math.sin(d), Math.cos(d));
      const extra = Math.min(24, Math.floor(Math.abs(d) / 0.15));
      for (let e = 1; e <= extra; e++) {
        const t = e / (extra + 1);
        posa(prec[0] + (x - prec[0]) * t, prec[1] + (y - prec[1]) * t,
          prec[2] + d * t, prec[3] + (p - prec[3]) * t, s - passo * (1 - t), GESSO.ventaglio);
      }
    }
    posa(x, y, ang, p, s);
    prec = [x, y, ang, p];
  }
  return n;
}

/* --- Il canvas d'appoggio -------------------------------------------------- */

/**
 * Tre canvas d'appoggio per ogni misura di destinazione: lo schermo ne ha
 * una, l'export un'altra. Poche voci, ma una mappa senza tetto crescerebbe a
 * ogni resize della finestra.
 *
 * Pesano: tre canvas grandi quanto la lavagna, cioe' ~14 MB su un telefono a
 * DPR 2 e ~60 MB su un desktop a DPR 2. E' il prezzo delle passate in GPU.
 */
const appoggi = new Map();
const MAX_APPOGGI = 3;

function appoggio(w, h) {
  const chiave = `${w}x${h}`;
  let a = appoggi.get(chiave);
  if (a) return a;
  const nuovo = () => {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    return cv.getContext('2d');
  };
  a = { dep: nuovo(), aux: nuovo(), fin: nuovo(), pattern: new Map() };
  if (appoggi.size >= MAX_APPOGGI) appoggi.delete(appoggi.keys().next().value);
  appoggi.set(chiave, a);
  return a;
}

/**
 * Il pattern della trama per il contesto `ctx`, a `k` pixel per unita'. Si
 * disegna nello spazio utente — gia' in unita' di lavagna — e la sua
 * trasformazione riporta la tessera da pixel a unita' (vedi disegnaGesso).
 */
function patternTrama(a, ctx, k) {
  const chiave = chiaveTessera(k);
  let p = a.pattern.get(chiave);
  if (p) return p;
  p = ctx.createPattern(tesseraPer(k), 'repeat');
  if (a.pattern.size >= 4) a.pattern.delete(a.pattern.keys().next().value);
  a.pattern.set(chiave, p);
  return p;
}

/* --- Il tratto ------------------------------------------------------------- */

/**
 * Il rettangolo del tratto in unita' di lavagna, con il margine che copre la
 * punta e il suo tremolio. Largo di proposito: fuori dal tratto le passate
 * costano solo pixel vuoti.
 */
export function rettangoloTratto(pts, width) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < pts.length; i += 3) {
    const x = pts[i], y = pts[i + 1];
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  const m = width * 1.4 + 4;
  return { x: x0 - m, y: y0 - m, w: x1 - x0 + 2 * m, h: y1 - y0 + 2 * m };
}

/**
 * Valli, soglia, guadagno e colore, sul rettangolo in pixel (px0, py0, pw,
 * ph), con il deposito gia' in `a.dep`; poi il risultato su `ctx`.
 *
 * Sono tutte operazioni punto per punto: lo stesso pixel da' lo stesso
 * risultato che il rettangolo sia tutto il tratto o un pezzo. E' cio' che
 * permette al tratto dal vivo di rifarle solo dove e' cambiato qualcosa.
 *
 * Con `sopra` il rettangolo di `ctx` si svuota prima: e' l'overlay, che
 * dentro quel rettangolo aveva la versione precedente dello stesso tratto.
 */
function passate(ctx, a, m, color, seed, px0, py0, pw, ph, sopra = false) {
  const k = m.a;
  const { dep, aux, fin } = a;

  // 1b. Il velo: il gesso lascia polvere anche nelle valli, poca. Si prende
  //     dal deposito prima che le valli lo buchino.
  fin.setTransform(1, 0, 0, 1, 0, 0);
  fin.globalCompositeOperation = 'source-over';
  fin.globalAlpha = 1;
  fin.clearRect(px0, py0, pw, ph);
  fin.globalCompositeOperation = 'lighter';
  if (GESSO.velo > 0) {
    fin.globalAlpha = GESSO.velo;
    fin.drawImage(dep.canvas, px0, py0, pw, ph, px0, py0, pw, ph);
  }

  // 2-3. Valli e soglia: X = max(0, D - profondita' x valle - c).
  //    Canvas 2D non sottrae, ma sa invertire (destination-out sopra un pieno
  //    da' 1 - a) e sommare con tetto a 1 (lighter). Quindi:
  //      1 - min(1, (1 - D) + p x valle + c) = max(0, D - p x valle - c)
  //    La costante c toglie i valori bassi: senza, restano pixel fiochi e
  //    attorno al tratto c'e' un alone morbido.
  //
  //    La trama si sposta a caso per ogni tratto: due tratti diversi hanno
  //    le valli in posti diversi, e sovrapposti si completano.
  const pat = patternTrama(a, aux, k);
  const s = TRAMA / tesseraPer(k).width;
  const sp = mulberry32((seed ^ 0x1B873593) >>> 0);
  pat.setTransform(new DOMMatrix([s, 0, 0, s, sp() * TRAMA, sp() * TRAMA]));
  const pieno = (c) => {
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    c.fillStyle = '#ffffff';
    c.fillRect(px0, py0, pw, ph);
  };
  dep.setTransform(1, 0, 0, 1, 0, 0);
  aux.setTransform(1, 0, 0, 1, 0, 0);
  pieno(aux);
  aux.globalCompositeOperation = 'destination-out';
  aux.drawImage(dep.canvas, px0, py0, pw, ph, px0, py0, pw, ph);     // 1 - D
  aux.globalCompositeOperation = 'lighter';
  aux.globalAlpha = GESSO.profondita;
  // La trama si stende su TUTTO il canvas, senza ritaglio, qualunque sia il
  // rettangolo: la GPU interpola le coordinate del motivo sul quadrilatero
  // che riempie, e quadrilateri diversi la campionano con arrotondamenti
  // diversi. Dal vivo il rettangolo cambia a ogni frame (disegnaGessoVivo):
  // riempiendo solo quello, il tratto dal vivo e quello dal modello
  // differivano di 1-4 livelli su file di pixel (misurato il 01/10/2026;
  // anche un clip rimpicciolisce il quadrilatero). Fuori dal rettangolo
  // `aux` non si legge mai.
  aux.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
  aux.fillStyle = pat;
  aux.fillRect(-m.e / k - 1, -m.f / k - 1, (aux.canvas.width + 2) / k, (aux.canvas.height + 2) / k);   // + p x valle
  aux.setTransform(1, 0, 0, 1, 0, 0);
  aux.fillStyle = '#ffffff';
  aux.globalAlpha = GESSO.soglia;
  aux.fillRect(px0, py0, pw, ph);                                     // + c
  pieno(dep);
  dep.globalCompositeOperation = 'destination-out';
  dep.drawImage(aux.canvas, px0, py0, pw, ph, px0, py0, pw, ph);     // 1 - (...)
  dep.globalCompositeOperation = 'source-over';

  // 4. Guadagno: g copie sommate, sopra il velo. La parte frazionaria entra
  //    come opacita' dell'ultima copia.
  for (let g = GESSO.guadagno; g > 0; g -= 1) {
    fin.globalAlpha = Math.min(1, g);
    fin.drawImage(dep.canvas, px0, py0, pw, ph, px0, py0, pw, ph);
  }

  // 5. Colore, e quanto copre una passata sola.
  fin.globalCompositeOperation = 'source-in';
  fin.globalAlpha = GESSO.opacita;
  fin.fillStyle = color;
  fin.fillRect(px0, py0, pw, ph);
  fin.globalCompositeOperation = 'source-over';
  fin.globalAlpha = 1;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (sopra) ctx.clearRect(px0, py0, pw, ph);
  ctx.drawImage(fin.canvas, px0, py0, pw, ph, px0, py0, pw, ph);
  ctx.restore();
}

/**
 * Disegna un tratto di gesso su `ctx`, che e' gia' in unita' di lavagna.
 *
 * @param {number[]} pts il tratto ricampionato col passo di chalk.js
 *   (strokeGeometry): serve al rettangolo e ai tratti-punto.
 * @returns {number} quanti punti ha il tratto ricampionato
 */
export function disegnaGesso(ctx, stroke, pts) {
  const { color, width, seed } = stroke;
  const n = count(pts);
  if (n === 0) return 0;
  const m = ctx.getTransform();
  const k = m.a;
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const a = appoggio(W, H);
  const dep = a.dep;

  // Il rettangolo in pixel, intero e dentro il canvas: tutte le passate
  // successive lavorano solo li'.
  const r = rettangoloTratto(pts, width);
  const px0 = Math.max(0, Math.floor(r.x * k + m.e));
  const py0 = Math.max(0, Math.floor(r.y * k + m.f));
  const px1 = Math.min(W, Math.ceil((r.x + r.w) * k + m.e));
  const py1 = Math.min(H, Math.ceil((r.y + r.h) * k + m.f));
  const pw = px1 - px0, ph = py1 - py0;
  if (pw <= 0 || ph <= 0) return n;

  // 1. Deposito, in bianco: il colore arriva alla fine, cosi' le somme della
  //    soglia lavorano su una maschera e non alterano la tinta.
  dep.setTransform(1, 0, 0, 1, 0, 0);
  dep.globalCompositeOperation = 'source-over';
  dep.globalAlpha = 1;
  dep.clearRect(0, 0, W, H);
  if (length(stroke.pts) < width * 0.3) {
    // Un tocco senza trascinare: non c'e' una direzione in cui trascinare la
    // punta. Il timbro tondo di chalk.js fa il punto.
    dep.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
    timbra(dep, pts, { color: '#ffffff', width, seed, alpha: GESSO.deposito });
  } else {
    trascina(dep, m, stroke);
  }
  dep.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
  dep.globalAlpha = 1;

  passate(ctx, a, m, color, seed, px0, py0, pw, ph);
  return n;
}

/* --- Il tratto dal vivo ---------------------------------------------------- */

/**
 * Il tratto in corso, sull'overlay, a ogni frame. Fino al 01/10/2026 si
 * rifaceva da capo: tutte le strisce, e tutte le passate su tutto il suo
 * rettangolo. Su un Galaxy S10, uno zig-zag ampio di 8 secondi scendeva da
 * 60 a 32 fps, col thread di JavaScript al 99% (posa() da sola un quarto
 * del tempo) e quello della GPU all'86%; 15 secondi a velocita' doppia, da
 * 58 a 9. Cosi', 60 fps fissi in entrambi i casi.
 *
 * Ora:
 *   1. le strisce DEFINITIVE si posano una volta sola su un deposito che
 *      resta per tutto il tratto (`depositoVivo`);
 *   2. a ogni frame si rifanno solo le PROVVISORIE, sopra una copia del
 *      deposito, nel rettangolo che e' cambiato;
 *   3. valli, soglia, guadagno e colore si rifanno solo in quel rettangolo:
 *      sono operazioni punto per punto (passate()).
 *
 * Il rettangolo cambiato e' l'unione di: le strisce appena diventate
 * definitive, le provvisorie di adesso, le provvisorie del frame prima (che
 * vanno tolte). Fuori da li' il deposito non e' cambiato, quindi nemmeno il
 * risultato.
 *
 * Una striscia e' definitiva quando non puo' piu' cambiare:
 *   - il suo punto e il successivo (da cui prende la direzione) vengono da
 *     punti del tratto che la penna non tocchera' piu' (`fissi`, pen.js) e
 *     da segmenti della curva gia' chiusi (resample() con `info`);
 *   - e' lontana almeno mezza larghezza dalla fine: vicino ai capi la
 *     striscia si stringe (posa()), e la fine si sposta finche' il dito va.
 *
 * Le strisce si posano nello stesso ordine del render dal modello, quindi il
 * deposito e' lo stesso. Misurato: dal vivo e dal modello differiscono in
 * ~100 pixel su ~230.000 di gesso, di un livello, come quando si rifaceva
 * tutto. Per arrivarci la trama si stende su tutto il canvas (passate()).
 */
let vivo = null;
let depositoVivo = null;

/** Il tratto dal vivo ricomincia da capo al prossimo frame: overlay compreso. */
export const azzeraGessoVivo = () => { vivo = null; };

/**
 * Il rettangolo in pixel dei punti [da, a) di `pts`, col margine di
 * rettangoloTratto(). Intero e dentro il canvas; null se vuoto.
 */
function rettangoloPixel(pts, da, a, width, m, W, H) {
  da = Math.max(0, da);
  a = Math.min(a, count(pts));
  if (a <= da) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = da; i < a; i++) {
    const x = pts[i * 3], y = pts[i * 3 + 1];
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  const mg = width * 1.4 + 4;
  const k = m.a;
  const px0 = Math.max(0, Math.floor((x0 - mg) * k + m.e)), py0 = Math.max(0, Math.floor((y0 - mg) * k + m.f));
  const px1 = Math.min(W, Math.ceil((x1 + mg) * k + m.e)), py1 = Math.min(H, Math.ceil((y1 + mg) * k + m.f));
  if (px1 <= px0 || py1 <= py0) return null;
  return { x: px0, y: py0, w: px1 - px0, h: py1 - py0 };
}

const unisci = (r, q) => {
  if (!r) return q;
  if (!q) return r;
  const x = Math.min(r.x, q.x), y = Math.min(r.y, q.y);
  return { x, y, w: Math.max(r.x + r.w, q.x + q.w) - x, h: Math.max(r.y + r.h, q.y + q.h) - y };
};

/**
 * Disegna il tratto in corso su `ctx` (l'overlay, in unita' di lavagna),
 * rifacendo solo quel che e' cambiato dal frame prima.
 *
 * @param {number} fissi quanti punti di `stroke.pts` la penna non cambiera'
 *   piu' (pen.fissi)
 */
export function disegnaGessoVivo(ctx, stroke, fissi) {
  const { color, width: w, seed } = stroke;
  const m = ctx.getTransform();
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const svuota = () => {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.restore();
  };

  // Un tocco senza trascinare si fa col timbro tondo, come in disegnaGesso():
  // e' piccolo, si rifa' intero.
  if (length(stroke.pts) < w * 0.3) {
    vivo = null;
    svuota();
    disegnaGesso(ctx, stroke, resample(stroke.pts, passoTimbri(w)));
    return;
  }

  if (!vivo || vivo.stroke !== stroke || vivo.W !== W || vivo.H !== H) {
    if (!depositoVivo || depositoVivo.canvas.width !== W || depositoVivo.canvas.height !== H) {
      const cv = document.createElement('canvas');
      cv.width = W; cv.height = H;
      depositoVivo = cv.getContext('2d');
    }
    depositoVivo.setTransform(1, 0, 0, 1, 0, 0);
    depositoVivo.globalCompositeOperation = 'source-over';
    depositoVivo.globalAlpha = 1;
    depositoVivo.clearRect(0, 0, W, H);
    svuota();
    // Con niente di posato, il rettangolo cambiato sara' tutto il tratto.
    vivo = { stroke, W, H, posate: 0, prima: null };
  }

  const passo = passoPunta(w);
  const pts = resample(stroke.pts, passo);
  const n = count(pts);
  const info = {};
  resample(stroke.pts.slice(0, fissi * 3), passo, info);
  const stabili = info.stabili;
  const definitive = Math.max(0, Math.min(n, stabili - 1, Math.floor(stabili - (w / 2) / passo)));

  // 1. Le strisce appena diventate definitive, sul deposito che resta.
  let R = null;
  if (definitive > vivo.posate) {
    trascina(depositoVivo, m, stroke, vivo.posate, definitive, pts);
    R = rettangoloPixel(pts, vivo.posate - 1, definitive, w, m, W, H);
    vivo.posate = definitive;
  }

  // 2. Dove si rifa': quelle, le provvisorie di adesso e quelle di prima.
  const coda = rettangoloPixel(pts, vivo.posate - 1, n, w, m, W, H);
  R = unisci(unisci(R, coda), vivo.prima);
  vivo.prima = coda;
  if (!R) return;

  // 3. Il deposito di quel rettangolo: il definitivo, piu' le provvisorie.
  const a = appoggio(W, H);
  const dep = a.dep;
  dep.setTransform(1, 0, 0, 1, 0, 0);
  dep.globalCompositeOperation = 'source-over';
  dep.globalAlpha = 1;
  dep.clearRect(R.x, R.y, R.w, R.h);
  dep.drawImage(depositoVivo.canvas, R.x, R.y, R.w, R.h, R.x, R.y, R.w, R.h);
  trascina(dep, m, stroke, vivo.posate, n, pts);

  // 4. Valli, soglia, colore, e sull'overlay al posto di prima.
  passate(ctx, a, m, color, seed, R.x, R.y, R.w, R.h, true);
}
