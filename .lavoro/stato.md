# Stato — Lavagna (FRRM - Drawing plugin)
Ultimo aggiornamento: 01/10/2026
Versione corrente: `frmm-lavagna` **1.13.0 su staging**, **1.12.0 in produzione**; `custom-marquee` **1.2.1** su entrambi. Prototipo: `temp/frmm-drawing-plugin-20/` (main), **`-30/` (branch `gesso-realistico`, non in main)**. Stato approvato dal cliente: tag `approvato-cliente-25092026`.

## Dove siamo
Produzione: la lavagna salva e manda il disegno; bacheca, moderazione dalla mail, galleria, retention; niente rate limit dalla 1.12.0. Mail ancora ad `admin_email`.
Branch `gesso-realistico`, online nella -30 (la -29 piu' il cancellino veloce, 01/10): gesso nuovo con bordi a granelli, fondo lavagna generato, cancellino che lascia l'alone del gesso tolto. Daniele: «adesso abbiamo DAVVERO l'effetto gessetto» (30/09); gomma provata sul telefono: «funziona, l'effetto mi piace» (01/10).
Confronti sul device: `?gesso=vecchio`, `?fondo=pieno`, `?alone=0` / `0.3` / `0.7`.

## Piano attivo
**A. Fasi 6, 7, 9, 10 (approvato 23/09/2026)** — tutto fatto tranne:
- [ ] **Sospeso** (Daniele, 26/09): bozze legali per i genitori (SALVA E INVIA manda il disegno alla Fondazione).
- [ ] QA in produzione su device veri: telefono → mail → Approva → galleria (compreso il purge di Speed Optimizer).

**B. Gesso realistico (branch `gesso-realistico`)** — solo prototipi su FTP.
Criterio di finito: confronto affiancato ✅ · ripassare riempie i buchi ✅ · bordi a granelli ✅ (Daniele, via di mezzo) · fondo lavorato ✅ · cancellino con l'alone ✅ (Daniele, 01/10) · **intensità dell'alone ✗ (la decide il cliente)** · **60 fps della -30 su iPhone 13 e S10 ✗** (verificati solo sulla -24) · **sì del cliente ✗**.
- [ ] Il cliente vede la -30 e sceglie l'intensità dell'alone (default 0,5 in `gomma.js`; la -28 a 0,2 «non si notava»).
- [ ] 60 fps della -30 sul telefono, `?debug=1`, disegnando e cancellando a lungo.
- [ ] Da vedere col cliente: sul gesto veloce il tratto si stringe del ~12% (lento 21 px, veloce 18,5); il 15/09 aveva chiesto ~20%.
- [ ] **Prima di unire a main** (decisione di Daniele, dopo il sì del cliente): cambia l'aspetto approvato il 25/09; la galleria mescolerebbe gesso, fondo e gomma vecchi e nuovi (le immagini approvate non si rigenerano; 11973/11975 non hanno un Drawing vero); il JPEG passa da ~354 a ~739 KB. All'unione: versione nuova del plugin, `pacchetto.py`, staging.
- [ ] Annotato, non aperto: polvere neutra del cancellino anche sul vuoto.

## Decisioni prese e perché
- **Produzione con l'invio acceso dal 23/09/2026** (Daniele), contro il consiglio di un interruttore spento fino ai passi 4-6.
- **Domanda d'invio PRIMA di salvare; invio in parallelo alla condivisione con ripresa; `invio_id` fisso per tentativo**: Safari rifiuta `navigator.share` dopo un'attesa, e chi va su WhatsApp non torna.
- **Endpoint anonimo senza nonce**: per un anonimo il nonce è uguale per tutti e la cache lo servirebbe scaduto.
- **Rate limit TOLTO nella 1.12.0 (28/09), su richiesta del cliente**, contro il consiglio. Per rimetterlo: tag `rate-limit-1.11.5`; se per IP, **solo `REMOTE_ADDR`**.
- **Honeypot tolto**: la difesa è la moderazione.
- **Retention in `disegni.php`, non in `bacheca.php`**: lo svuotamento gira nel cron, dove `bacheca.php` non c'è.
- **Moderazione dalla mail: aprire il link non agisce mai, solo il pulsante in POST** (scanner di posta). Link firmato, 7 giorni.
- **Rifiuta senza bordo** nella pagina di moderazione: decisione di Daniele, contro l'obiezione nel codice.
- **Il nero è #050506, non il colore della lavagna**: sul vuoto non lascerebbe segno.
- **Iframe senza `sandbox`; cache buster in query string, non nel percorso** (il tutorial ha il percorso nella chiave).
- **Disegni anonimi; CPT `frmm_disegno` non pubblico, non in REST.**
- **Gesso nuovo: la valle si SOTTRAE al deposito** (moltiplicando, i buchi non si riempiono senza staccare); **nessun tetto di opacità per tratto**; **trama spostata per ogni tratto**, non ancorata alla lavagna.
- **Granelli: la fascia sporge FUORI dal nucleo** (`GESSO.granelli` 0,13): centrata sul bordo assottigliava il tratto da 22 a 16,5 px. **`velo` a 0**: nella fascia faceva un alone continuo.
- **Fondo generato, non foto né piastrella** (`fondo.js`): le forme sono funzioni della posizione, si ripete solo la grana su due piastrelle di lati primi fra loro. **Base più scura** (`#15181B`) perché la media resti il `#1F2225` su cui sono tarati i gessetti.
- **Fondo su un canvas `#fondo` sotto i tratti, e nell'export in destination-over**: la gomma deve scoprirlo, non bucarlo.
- **Alone del cancellino rimesso ALL'INDIETRO lungo il gesto**: in avanti lo ricancellerebbe il timbro successivo.
- **Gomma un timbro alla volta, dal vivo incisi per sempre solo i timbri definitivi (`resample(..., info)`), la coda provvisoria incisa e ritirata da una foto**: gomma sotto il dito (22% di gesso residuo, era 84%) e schermo = modello entro 1-2 livelli su poche decine di pixel. L'identità al bit chiederebbe la lavagna in CPU.
- **Cancellino veloce senza toccare l'estetica (01/10, -30)**: rallentava col gesto perche' `timbra()` consumava il PRNG dall'inizio a ogni timbro (O(n²), 40% del tempo) e la curva si ricampionava da capo tre volte a frame. Ora `mulberry32(seme, salta)` salta in O(1) e `resample(..., memo)` riparte dall'ultimo punto fermo. Pixel identici per costruzione (due test bit per bit). Misurato in Chrome a CPU 1/6, gesto di 20 s: 60 fps fissi (prima, a 1/4, da 59 a 6 in 10 s). Resta la parte GPU (~16 drawImage a timbro, 3 travasi fra canvas): **non misurabile qui, si vede solo sul telefono**.
- **Spessore/velocità chiuso il 17/09** col gesso vecchio (`PRESSURE_*` non si toccano).

## Trappole
- **`pacchetto.py` sul branch scrive `frmm-lavagna-1.13.0.zip` SOPRA lo zip di main**: stesso numero, contenuto diverso. Il 01/10 lo zip del branch è stato rinominato `…-BRANCH-gesso-realistico-NON-INSTALLARE.zip` e quello di main ricostruito da un worktree (copiandoci i font, che non sono nel repo). Sul branch non si costruisce lo zip senza cambiare versione.
- **Fotografare e rimettere un pezzo di canvas in GPU non è esatto al bit** (±1 sui pixel semitrasparenti). È esatto solo dopo un `getImageData`, che sposta il canvas in CPU: un test che legge prima di provare dà «esatto» dove il telefono no. Le differenze si misurano sul colore pesato per l'opacità.
- **In `main.js` `coda` è la coda d'invio**: la foto della gomma si chiama `codaGomma`. Una collisione di nomi blocca l'app intera, senza errori visibili se non in console.
- **Due disegni in produzione hanno un Drawing finto**: post **11973 e 11975**.
- **La mensola a una riga chiede ~1050px**: fra 701 e 1099px va su due righe.
- **«auto mode classifier gave no verdict (error)»**: la revisione dei comandi lato server Anthropic non risponde per 2-3 minuti alla volta (28/09, 30/09). Non è la rete. Decisione di Daniele: si aspetta, niente regole di permesso né cambi di modalità.
- **Playwright MCP «Browser is already in use»**: non uccidere il server rimasto vivo; `playwright-core` dalla cache npx con `channel: 'chrome'` lancia un'istanza a sé. Con `newPage({ viewport: {width: 390}, deviceScaleFactor: 2 })` si ha la geometria del telefono senza iframe.
- **Il mouse sintetico va mosso con ~16 ms fra un evento e l'altro**, o filtro e pseudo-pressione deformano il tratto.
- **Gesso dal vivo ≠ gesso dal modello** (grana diversa, forma uguale: regola del 04/09). Per confrontare la gomma dal vivo col modello, prima si ridisegna dal modello (finestra ridimensionata e rimessa).
- **Nella pagina di confronto un seme solo inganna**: le nuvole della trama fanno ±15 punti; si media su più semi.
- **Firefox misura una fila flex dal contenuto dei figli**: `.tools .chalk` ha anche `width`.
- **Il firewall di SiteGround filtra `/wp-admin/` per user agent**: gli script si presentano come Safari.
- **`prova-mail.py` manda due mail vere; `prova-bacheca.py` consuma i due disegni in attesa più vecchi.**
- **SiteGround serve i `.js` con un anno di cache**: `pacchetto.py` mette `?v=` su ogni import (verificato il 01/10 anche su `fondo.js` e `gomma.js`: 40 import).
- **Chrome Android ≠ desktop ≠ Safari**; `<script>` di `altezza="schermo"` DOPO il `<div>`; `rect` riletto a ogni `pointerdown`; `margin-top` 55/65px; `dvh`.
- **PHP non è installato sul PC.**
- **`.lavoro/` non è gitignorata e il repo è pubblico**: niente credenziali. Token GitHub e password dello staging passati in chiaro in transcript: **da ruotare**. `esempio.jpg` (foto stock con filigrana) e i due `disegno-da-aggiungere-*.jpg` stanno nella root, fuori da git: non vanno committati.
- **FTP**: solo `temp/frmm-drawing-plugin*`. Online `frmm`, repo `frrm`: non correggere.
- Verifiche: `node prototipo/test/run.js` (84) · `python .lavoro/pacchetto.py` (import versionati) · `php … plugin/test/validazione.php` (81) · `php plugin/test/galleria.php` (9) · `prova-invio.py` (40) · `prova-mail.py` (33) · `prova-bacheca.py` (14) · `prova-abuso.py` · `prova-retention.py` · `diagnostica-ip.py` (sola lettura).

## Prossimo passo
Daniele prova la -30 sul telefono (`?debug=1`, cancellando a lungo). Poi mostra la -30 al cliente e gli fa scegliere l'intensità dell'alone (`?alone=0.3` / default 0,5 / `?alone=0.7`).
