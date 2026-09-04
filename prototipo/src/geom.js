/**
 * Geometria del tratto.
 *
 * I punti viaggiano sempre in ARRAY PIATTI con stride 3: [x, y, p, x, y, p, ...]
 * dove p e' la pseudo-pressione 0..1. E' il formato di D1, e tenerlo unico
 * evita conversioni fra il modello salvato e il render.
 */

export const STRIDE = 3;
export const count = (pts) => pts.length / STRIDE;

/**
 * Catmull-Rom CENTRIPETA (alpha = 0.5).
 *
 * La variante uniforme (alpha = 0) e' piu' semplice ma produce cappi e cuspidi
 * quando due punti sono molto vicini e il successivo e' lontano — cioe'
 * esattamente quando un dito rallenta e riparte. La centripeta lo garantisce
 * per costruzione, ed e' il motivo per cui vale il calcolo in piu'.
 */
function tj(ti, xi, yi, xj, yj) {
  const d = Math.hypot(xj - xi, yj - yi);
  // Il minimo garantisce nodi sempre crescenti: due campioni identici (un
  // dito fermo) azzererebbero il denominatore delle interpolazioni.
  return ti + Math.max(Math.sqrt(d), 1e-6);
}

function segmentPoint(p0, p1, p2, p3, s) {
  const t0 = 0;
  const t1 = tj(t0, p0[0], p0[1], p1[0], p1[1]);
  const t2 = tj(t1, p1[0], p1[1], p2[0], p2[1]);
  const t3 = tj(t2, p2[0], p2[1], p3[0], p3[1]);
  const t = t1 + (t2 - t1) * s;

  const lerp = (a, b, ta, tb) => {
    const w = (tb - t) / (tb - ta);
    const v = 1 - w;
    return [a[0] * w + b[0] * v, a[1] * w + b[1] * v, a[2] * w + b[2] * v];
  };

  const A1 = lerp(p0, p1, t0, t1);
  const A2 = lerp(p1, p2, t1, t2);
  const A3 = lerp(p2, p3, t2, t3);
  const B1 = lerp(A1, A2, t0, t2);
  const B2 = lerp(A2, A3, t1, t3);
  return lerp(B1, B2, t1, t2);
}

const at = (pts, i) => {
  const n = count(pts) - 1;
  const k = Math.min(Math.max(i, 0), n) * STRIDE;   // estremi ripetuti
  return [pts[k], pts[k + 1], pts[k + 2]];
};

/**
 * Ricampiona il tratto a distanza costante lungo la curva.
 *
 * Interpola, NON decima: i device di test consegnano ~55 campioni/s e un gesto
 * veloce li lascia distanti ~29 unita', mentre qui ne serve uno ogni 2,5.
 * Una interpolazione lineare fra campioni cosi' radi darebbe una spezzata
 * visibile proprio sui gesti rapidi, che sono quelli dei bambini.
 *
 * Deterministica: stesso input -> stesso output, sempre. E' la premessa del
 * seed riproducibile della Fase 3.
 */
export function resample(pts, spacing) {
  const n = count(pts);
  if (n === 0) return [];
  if (n === 1) return pts.slice();
  if (spacing <= 0) throw new Error('spacing deve essere > 0');

  // Campionatura densa della curva, poi camminata a passo costante sopra.
  const SUB = 12;
  const dense = [];
  for (let i = 0; i < n - 1; i++) {
    const p0 = at(pts, i - 1), p1 = at(pts, i), p2 = at(pts, i + 1), p3 = at(pts, i + 2);
    const steps = i === n - 2 ? SUB : SUB - 1;   // l'ultimo include l'estremo
    for (let s = 0; s <= steps; s++) {
      dense.push(segmentPoint(p0, p1, p2, p3, s / SUB));
    }
  }

  const out = [dense[0][0], dense[0][1], dense[0][2]];
  let carry = 0;
  for (let i = 1; i < dense.length; i++) {
    const a = dense[i - 1], b = dense[i];
    let segLen = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (segLen === 0) continue;
    let t = 0;
    while (carry + (1 - t) * segLen >= spacing) {
      t += (spacing - carry) / segLen;
      out.push(
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t,
      );
      carry = 0;
    }
    carry += (1 - t) * segLen;
  }

  // L'ultimo campione originale va sempre incluso: senza, il tratto si accorcia
  // di un pezzo variabile e il punto in cui si stacca il dito si sposta.
  const last = dense[dense.length - 1];
  const lx = out[out.length - 3], ly = out[out.length - 2];
  if (Math.hypot(last[0] - lx, last[1] - ly) > spacing * 0.25) {
    out.push(last[0], last[1], last[2]);
  }
  return out;
}

/**
 * Ramer-Douglas-Peucker sul piano x/y. La pressione viene portata dietro dai
 * punti superstiti: interpolarla non servirebbe, varia lentamente.
 */
export function simplify(pts, epsilon) {
  const n = count(pts);
  if (n < 3) return pts.slice();

  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;

  const stack = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    if (b - a < 2) continue;

    const ax = pts[a * STRIDE], ay = pts[a * STRIDE + 1];
    const bx = pts[b * STRIDE], by = pts[b * STRIDE + 1];
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;

    let far = -1, best = epsilon;
    for (let i = a + 1; i < b; i++) {
      const px = pts[i * STRIDE], py = pts[i * STRIDE + 1];
      let d;
      if (len2 === 0) {
        d = Math.hypot(px - ax, py - ay);
      } else {
        // proiezione sul segmento, non sulla retta: un tratto che torna
        // indietro su se stesso altrimenti verrebbe collassato
        let t = ((px - ax) * dx + (py - ay) * dy) / len2;
        t = Math.min(1, Math.max(0, t));
        d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
      }
      if (d > best) { best = d; far = i; }
    }

    if (far !== -1) {
      keep[far] = 1;
      stack.push([a, far], [far, b]);
    }
  }

  const out = [];
  for (let i = 0; i < n; i++) {
    if (keep[i]) out.push(pts[i * STRIDE], pts[i * STRIDE + 1], pts[i * STRIDE + 2]);
  }
  return out;
}

/** Lunghezza della polilinea, in unita' di lavagna. */
export function length(pts) {
  let L = 0;
  for (let i = 1; i < count(pts); i++) {
    L += Math.hypot(
      pts[i * STRIDE] - pts[(i - 1) * STRIDE],
      pts[i * STRIDE + 1] - pts[(i - 1) * STRIDE + 1],
    );
  }
  return L;
}
