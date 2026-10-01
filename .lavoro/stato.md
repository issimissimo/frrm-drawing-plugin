# Stato — Lavagna (FRRM - Drawing plugin)
Ultimo aggiornamento: 02/10/2026
Versione corrente: `frmm-lavagna` **1.13.0 su staging**, **1.12.0 in produzione**; `custom-marquee` **1.2.1** su entrambi. Prototipo: `temp/frmm-drawing-plugin-20/` (main), **`-38/` (branch `gesso-realistico`, non in main)**. Stato approvato dal cliente: tag `approvato-cliente-25092026`.

## Dove siamo
Produzione: la lavagna salva e manda il disegno; bacheca, moderazione dalla mail, galleria, retention; niente rate limit dalla 1.12.0. Mail ancora ad `admin_email`.
Branch `gesso-realistico`, online nella -32: gesso nuovo a granelli, fondo generato, cancellino con l'alone; **ottimizzazione prestazioni CHIUSA il 01/10** (Daniele, S10: «il cancellino funziona benissimo», gesso «ottimo»): 60 fps fissi su gomma e gesso anche a gesto lungo e veloce.
**Tratto del gessetto CHIUSO il 02/10/2026** (Daniele): la versione è la **-38**, densità che varia con la velocità (lento pieno, veloce leggero). **Porta aperta solo sui quattro parametri di densità** lento / veloce / curva / riempie: `?taratura` apre il pannello, o da URL. Il resto non si riapre senza Daniele. Scartate, da non ridare a nessuno: **-33** (trasparenza uniforme sul tratto finito: velo e blocchi), **-34** (solo meno gesso: un colore veloce sopra un altro sbiadisce), **-36** (punta che salta).
Confronti sul device: `?gesso=vecchio`, `?fondo=pieno`, `?alone=0` / `0.3` / `0.7`.

## Piano attivo
**A. Fasi 6, 7, 9, 10 (approvato 23/09/2026)** — tutto fatto tranne:
- [ ] **Sospeso** (Daniele, 26/09): bozze legali per i genitori (SALVA E INVIA manda il disegno alla Fondazione).
- [ ] QA in produzione su device veri: telefono → mail → Approva → galleria (compreso il purge di Speed Optimizer).

**B. Gesso realistico (branch `gesso-realistico`)** — solo prototipi su FTP.
Criterio di finito: confronto affiancato ✅ · ripassare riempie i buchi ✅ · bordi a granelli ✅ (Daniele, via di mezzo) · fondo lavorato ✅ · cancellino con l'alone ✅ (Daniele, 01/10) · **intensità dell'alone ✗ (la decide il cliente)** · **prestazioni ✅ (chiuse 01/10: S10 misurato e provato col dito; iPhone 13 non misurato)** · **sì del cliente ✗**.
- [x] **Tratto chiuso il 02/10 alla -38.** Deposito scelto da Daniele col pannello: **lento 1,15, veloce 0,5, curva 1,1, riempie 0,25** (`TARATURA_PREDEFINITA` in `gesso.js`). Misure (spessore 27) contro la -32: lento alpha media 0,72 (0,54), grani pieni 44% (19%); a p 0,2 alpha 0,27 (0,46), grani pieni 0% (10%), pixel −57%; larghezza 26 / 22 / 20 / 19 px a p 1 / 0,5 / 0,2 / 0 (-32: 26 / 24 / 22 / 21). Il veloce è molto leggero e un colore veloce sopra un altro si vede poco: scelto guardandolo.
  - **Porta aperta**: solo i quattro valori di densità, col pannello (`?taratura`, `taratura.js`) o da URL. Nuovi valori → `TARATURA_PREDEFINITA`, cartella nuova.
  - **Non adottata (02/10)**: opacità uniforme per passata che si accumula anche senza staccare il dito (`?opacita=`, impronte di Hann su una maschera ridotta). Funzionava e verificata (a 1 = -38 al bit, uniforme fra velocità, vivo = modello), ma Daniele: troppo complicata da capire per chi usa la lavagna. Branch **locale** `prova-opacita-per-passata` (712e14e), mai pubblicata.
  - **Abbandonate**: la punta che salta (-36, branch locale `prova-punta-che-salta`), la trasparenza sul tratto finito (-33), il solo calo di deposito (-34).
  - Difetto corretto nella -38: con `curva` ≠ 1 la Catmull-Rom sforava sotto p = 0, `NaN` nell'alpha, schermo ≠ immagine salvata fino a 242 livelli. Test in `run.js` (88) con controprova.
- [ ] **Prestazioni sul S10 della -38 non misurate** (telefono scollegato dal 01/10): `riempie` aggiunge un riempimento con motivo a tutto canvas per frame. Da fare prima di dare la -38 al cliente: `STRUMENTO=gesso VEL=2 node .lavoro/misura-telefono.mjs prototipo 15 0.42 "" "riempie=0"`.
- [ ] Il cliente vede la -32 e sceglie l'intensità dell'alone (default 0,5 in `gomma.js`; la -28 a 0,2 «non si notava»).
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
- **Prestazioni (01/10, -30..-32, chiuse)**: sul telefono costa il NUMERO di letture fra canvas (S10: 2,2 ms ciascuna sul thread GPU di Chrome, sul PC un decimo) e rifare da capo il tratto in corso. Quindi: gomma per **gruppi fissi di 6 timbri** (`?gruppo=1` = timbro per timbro), parte non incisa sull'**overlay come fondo attraverso i timbri** (`velaCoda()`), gesso dal vivo **incrementale** (`disegnaGessoVivo()`, strisce definitive da `pen.fissi` posate una volta), PRNG che **salta** (`mulberry32(seme, salta)`), `resample(..., memo)`. S10: gomma 5→58 fps, gesso 58→9 diventato 60 fissi.
- **Gruppi e strisce definitive sono gli stessi dal vivo e dal modello**: schermo = annulla/rotazione/export entro 1 livello su ~100 pixel. L'alone per gruppi cambia la grana del 7,5% dei pixel (5 livelli medi) rispetto al timbro per timbro.
- **La trama del gesso si stende su TUTTO il canvas** (`passate()`): sul solo rettangolo la GPU la campiona diversa e dal vivo restavano file di pixel a 1-4 livelli. Prezzo: render cambiato rispetto alla -31 nell'8,6% dei pixel, max 6 livelli.
- **Spessore/velocità chiuso il 17/09** col gesso vecchio (`PRESSURE_*` non si toccano).
- **Opacità/velocità (01/10)**: la velocità toglie **deposito** (`calo` in `gesso.js`, fattore separato da `PRESSURE_ALPHA_MIN`, che non si tocca). La -33 la applicava come **trasparenza uniforme sul tratto finito** (maschera per striscia, `destination-in` dopo il colore): **scartata da Daniele provandola** a `?opacita=0.6`, velo grigio dove si strofina, blocchi rettangolari della maschera, un colore veloce sopra un altro che si mescola (rosso sul bianco → salmone) invece di posare grani. Sul deposito ripassare accumula e i colori si coprono a grani. Timore smentito misurando: la larghezza non cambia (22 → 22 px a p 0,2 con −25%). La soglia amplifica: −25% di deposito = −50% di inchiostro a p 0,2; a −60% il veloce è quasi tratteggiato. Tabella nel commento di `calo`. Vivo = modello al bit (prova deterministica con `pen.js`). Codice della maschera nel commit `94bc0ae`, se servisse riguardarlo.

## Trappole
- **`pacchetto.py` sul branch scrive `frmm-lavagna-1.13.0.zip` SOPRA lo zip di main**: stesso numero, contenuto diverso. Il 01/10 lo zip del branch è stato rinominato `…-BRANCH-gesso-realistico-NON-INSTALLARE.zip` e quello di main ricostruito da un worktree (copiandoci i font, che non sono nel repo). Sul branch non si costruisce lo zip senza cambiare versione.
- **Fotografare e rimettere un pezzo di canvas in GPU non è esatto al bit** (±1 sui pixel semitrasparenti). Le differenze si misurano sul colore pesato per l'opacità.
- **Un riempimento con pattern dà pixel diversi a seconda del rettangolo riempito** (anche con un clip): per la trama del gesso si riempie sempre tutto il canvas. Le copie 1:1 senza filtro invece non cambiano niente (provato, inutile).
- **In `main.js` `coda` è la coda d'invio**: la gomma ha `memoGomma` e `timbriApplicati`, mai `coda`. Una collisione di nomi blocca l'app intera, senza errori visibili se non in console (gia' successo con la foto della coda, tolta nella -31).
- **Le prestazioni si misurano sul telefono, non sul PC** (il PC ha dato 60 fps dove il S10 ne faceva 5): `.lavoro/misura-telefono.mjs` (USB, gesto sintetico identico per variante; `STRUMENTO=gesso`, `VEL=2`, `--trace`, `--profilo` per il JS sul telefono) e `.lavoro/riassumi-traccia.mjs`. Guardare `CrGpuMain` e il numero di `DoEndRasterCHROMIUM` al secondo. Lo schermo del telefono che si spegne fa scadere il caricamento: `adb shell input keyevent KEYCODE_WAKEUP`. Chiudere solo le schede `localhost:8123` lasciate aperte.
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
- Verifiche: `node prototipo/test/run.js` (87) · `python .lavoro/pacchetto.py` (import versionati) · `php … plugin/test/validazione.php` (81) · `php plugin/test/galleria.php` (9) · `prova-invio.py` (40) · `prova-mail.py` (33) · `prova-bacheca.py` (14) · `prova-abuso.py` · `prova-retention.py` · `diagnostica-ip.py` (sola lettura).

## Prossimo passo
1. Misurare la -38 sul S10 (vedi sopra): è l'unica verifica del tratto chiuso rimasta scoperta.
2. Daniele mostra la **-38** al cliente (non più la -32) e gli fa scegliere l'intensità dell'alone (`?alone=0.3` / default 0,5 / `?alone=0.7`, valgono anche sulla -38).
