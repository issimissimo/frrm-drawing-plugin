// Misura il cancellino su un telefono Android VERO, collegato via USB.
//
// Serve perche' il PC non vede il collo di bottiglia: il 01/10/2026 la gomma
// faceva 60 fps in Chrome sul PC (anche a CPU 1/6) e 5 fps sul Galaxy S10,
// dove ogni lettura fra canvas costava 2,2 ms sul thread della GPU.
//
// Preparazione (Debug USB acceso sul telefono, Chrome aperto, schermo acceso):
//   adb reverse tcp:8123 tcp:8123
//   adb forward tcp:9444 localabstract:chrome_devtools_remote
//   (se 9444/json/version non risponde: adb shell am force-stop com.android.chrome
//    e riaprirlo; lo schermo spento fa scadere il caricamento: adb shell input
//    keyevent KEYCODE_WAKEUP)
//
// Uso: node .lavoro/misura-telefono.mjs <cartella> <secondi> <ampiezza> [--trace] query...
//   node .lavoro/misura-telefono.mjs prototipo 6 0.42 "" "gruppo=1" "alone=0"
//   VEL=2 per un gesto due volte piu' veloce. --trace scrive la traccia di
//   Chrome nella cartella temporanea: si legge con riassumi-traccia.mjs.
//
// playwright-core e' quello della cache di npx: se il percorso qui sotto non
// esiste piu', `npx playwright --version` lo riscarica.
import { createRequire } from 'module';
import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
const require = createRequire('C:/Users/Daniele/AppData/Local/npm-cache/_npx/06d4b2c446e40bbc/node_modules/');
const { chromium } = require('playwright-core');

const [root, sec, ampArg, ...resto] = process.argv.slice(2);
const secondi = Number(sec), amp = Number(ampArg);
const trace = resto.includes('--trace');
const queries = resto.filter((q) => q !== '--trace');
const tipi = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  const f = path.join(root, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html'));
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': tipi[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); r.end(d); });
}).listen(8123);

const browser = await chromium.connectOverCDP('http://127.0.0.1:9444');
const ctx = browser.contexts()[0];
const page = await ctx.newPage();

async function gesto(q) {
  await page.goto(`http://localhost:8123/index.html?${q}&t=${Date.now()}`);
  await page.waitForTimeout(1500);
  await page.evaluate(() => { const b = document.getElementById('btn-chiudi'); if (b && b.offsetParent) b.click(); });
  await page.waitForTimeout(300);
  // Disegno quasi pieno: righe fitte di gesso spesso, poi il cancellino.
  return page.evaluate(({ secondi, amp, vel }) => new Promise((fine) => {
    const cv = document.getElementById('overlay');
    const bx = cv.getBoundingClientRect();
    const X = (u) => bx.left + u * bx.width, Y = (v) => bx.top + v * bx.height;
    const ev = (tipo, x, y) => cv.dispatchEvent(new PointerEvent(tipo, { pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, pressure: 0.5, bubbles: true, cancelable: true }));
    const larghi = document.querySelectorAll('#widths .wbtn'); larghi[larghi.length - 1]?.click();
    const colori = document.querySelectorAll('#chalks .chalk');
    const righe = [];
    for (let r = 0; r < 14; r++) righe.push(r);
    const riga = () => {
      if (!righe.length) return gomma();
      const r = righe.shift();
      colori[r % colori.length]?.click();
      const y = 0.08 + r * 0.062;
      ev('pointerdown', X(0.05), Y(y));
      let k = 0;
      const t = setInterval(() => {
        k++;
        ev('pointermove', X(0.05 + 0.9 * k / 25), Y(y + 0.01 * Math.sin(k)));
        if (k >= 25) { clearInterval(t); ev('pointerup', X(0.95), Y(y)); setTimeout(riga, 50); }
      }, 16);
    };
    const gomma = () => {
      document.getElementById('tool-eraser').click();
      const f = [];
      const loop = (t) => { f.push(t); raf = requestAnimationFrame(loop); };
      let raf = requestAnimationFrame(loop);
      let i = 0; const t0 = performance.now();
      ev('pointerdown', X(0.5), Y(0.2));
      const passo = () => {
        const t = performance.now() - t0;
        while (i * 16.7 < t) {
          ev('pointermove', X(0.5 + amp * Math.sin(i * 0.105 * vel)), Y(0.15 + 0.7 * ((i % 400) / 400)));
          i++;
        }
        if (t < secondi * 1000) setTimeout(passo, 4);
        else {
          ev('pointerup', X(0.5), Y(0.5));
          cancelAnimationFrame(raf);
          fine({ f, mosse: i, w: bx.width, dpr: devicePixelRatio, ua: navigator.userAgent });
        }
      };
      setTimeout(passo, 4);
    };
    riga();
  }), { secondi, amp, vel: Number(process.env.VEL || 1) });
}

for (const q of queries) {
  let cdp = null;
  if (trace) {
    cdp = await ctx.newCDPSession(page);
  }
  const r = await (async () => {
    if (!cdp) return gesto(q);
    // La traccia parte dopo il disegno: la avvio prima e la filtro per tempo.
    await cdp.send('Tracing.start', { categories: 'toplevel,gpu,cc,viz,blink.canvas,disabled-by-default-devtools.timeline,devtools.timeline,v8', transferMode: 'ReturnAsStream' });
    const res = await gesto(q);
    const fatto = new Promise((ok) => cdp.once('Tracing.tracingComplete', ok));
    await cdp.send('Tracing.end');
    const { stream } = await fatto;
    let dati = '';
    for (;;) { const c = await cdp.send('IO.read', { handle: stream }); dati += c.data; if (c.eof) break; }
    fs.writeFileSync(path.join(os.tmpdir(), `traccia-${q.replace(/[^a-z0-9]/gi, '_') || 'base'}.json`), dati);
    console.log(`traccia in ${os.tmpdir()}`);
    return res;
  })();
  const f = r.f;
  const iv = []; for (let k = 1; k < f.length; k++) iv.push(f[k] - f[k - 1]);
  const s = [...iv].sort((a, b) => a - b);
  const durata = (f[f.length - 1] - f[0]) / 1000;
  console.log(`[${q || 'base'}] amp ${amp}  fps ${(iv.length / durata).toFixed(1)}  mediana ${s[s.length >> 1].toFixed(1)}  p90 ${s[Math.floor(s.length * 0.9)].toFixed(1)}  max ${s[s.length - 1].toFixed(1)}  mosse ${r.mosse}  css ${r.w.toFixed(0)} dpr ${r.dpr}`);
}
await page.close();
await browser.close().catch(() => {});
srv.close();
