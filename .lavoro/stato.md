# Stato — Lavagna (FRRM - Drawing plugin)
Ultimo aggiornamento: 30/09/2026
Versione corrente: `frmm-lavagna` **1.13.0 su staging** (gessetto nero, mensola a due righe fra 701 e 1099px), **1.12.0 in produzione** (rate limit tolto, 28/09/2026); `custom-marquee` **1.2.1** su entrambi. Prototipo online: `temp/frmm-drawing-plugin-20/` (main), **`-26/` col gesso nuovo e i bordi a granelli (branch `gesso-realistico`, non in main)**; la -25 ha i granelli al doppio, la -24 senza. Stato approvato dal cliente: tag `approvato-cliente-25092026` (su `0d6df7c`), zip in `.lavoro/dist/approvato-cliente-25092026/` (solo locale: contengono i font commerciali).

## Dove siamo
In produzione: la lavagna salva e manda il disegno; bacheca, mail con Approva / Rifiuta senza login, galleria degli approvati; retention; niente rate limit dalla 1.12.0. La mail in produzione va ancora ad `admin_email` (`d.suppo@issimissimo.com`): «Notifiche dei disegni» è vuota.
Sul branch `gesso-realistico` c'è un gesso nuovo (`prototipo/src/gesso.js`), online solo nella -24: Daniele «molto soddisfatto» (30/09/2026). Il gesso vecchio resta raggiungibile con `?gesso=vecchio`.

## Piano attivo
**A. Fasi 6, 7, 9, 10 (approvato 23/09/2026)** — tutto fatto tranne:
6. [ ] **Sospeso** (Daniele, 26/09/2026): bozze legali per i genitori. Devono dire che SALVA E INVIA manda il disegno alla Fondazione. Senza rate limit non si conserva niente dell'IP.
9. [ ] QA su device veri, flusso intero, **in produzione**: disegno dal telefono → mail → link → Approva → galleria (compreso il purge di Speed Optimizer).

**B. Gesso realistico (branch `gesso-realistico`, 29–30/09/2026)** — solo prototipi su FTP, niente produzione.
Criterio di finito: confronto affiancato (`-24/confronto-gesso.html`) ✅ · ripassare riempie i buchi anche senza staccare ✅ · **60 fps su iPhone 13 e Galaxy S10 ✅ (Daniele, 30/09)** · **due desideri aperti ✗** (sotto) · **il cliente vede la differenza ✗**.
1. [x] -21 → -24: punta trascinata con filamenti, trama fine con valli che si sottraggono al deposito, passata semitrasparente che si accumula, bordi che si allargano. Storia dei giri e numeri in `prototipo/README.md` e in `GESSO` (`palette.js`).
2. [ ] **Desiderio di Daniele (30/09)**: tratto più irregolare, **bordi meno definiti** di quelli della -24. → piano B2/B3 sotto.
3. [ ] **Desiderio di Daniele (30/09)**: **fondo lavagna come la reference** (dreamstime 189200205, «I ♥ School»), non un colore pieno. → piano B2/B3 sotto.
6. [ ] **Desiderio annotato (30/09), fuori da B2/B3**: il cancellino lascia un alone di gesso spalmato, come sulla lavagna vera, invece di scoprire il fondo pulito. Vincolo: la gomma incide il livello in `destination-out` durante il gesto, e a fine gesto non si ridisegna dal modello.

**B2/B3 — bordi a granelli e fondo lavorato (piano del 30/09/2026, approvato lo stesso giorno)**
Obiettivo: il tratto e la lavagna devono leggere come gesso vero su lavagna vera, come nella reference; oggi il bordo è troppo tirato e il fondo è un colore piatto.
Criterio di finito: in una nuova cartella numerata, con confronto affiancato alla -24, (a) il bordo del tratto si sgrana in granelli senza sfocatura, (b) la lavagna mostra nuvole di gesso cancellato, spugnate e grana a luminosità media ≈ #1F2225 (misurata, scarto ≤ 3/255), (c) il JPEG salvato ha lo stesso fondo dello schermo, (d) 60 fps ancora su iPhone 13 e S10, (e) sì di Daniele sul telefono, **poi sì del cliente**.
Fuori perimetro: schiarire il fondo e ritarare la palette; foto o texture esterne (la reference dreamstime non si usa, né va nel repo); alone del cancellino (punto 6); `PRESSURE_*`; unione in main e produzione (punto 5); i due `disegno-da-aggiungere-*.jpg` (da ignorare, fuori da git).
Passi:
1. [~] **Bordi a granelli — online nella -26, aspetta l'occhio di Daniele.** La -25 aveva `granelli` 0,25: «non male, farei una via di mezzo» (Daniele), quindi **0,13** nella -26. `sfrangia` 0,1, `velo` 0 (faceva alone nella fascia). -26: lento 21 px (-24: 22), veloce 18,5 (21); render 30 ms contro 32; ripassare riempie come prima; 77 test. Piano originale: (`gesso.js`, `GESSO`). Il deposito cala su una fascia più larga del bordo (oggi `bordo` 0,04, cioè ~2 unità), così la soglia sulla trama lo taglia a puntini staccati invece che a filo; `sfrangia` più ampia, più un'ondulazione a scala media. Misure come il 29/09: larghezza percepita lento/veloce, inchiostro, tabella delle passate su quattro semi. Test verdi. Prototipo -25 con `confronto-gesso.html` aggiornato. **Daniele guarda solo i bordi.**
2. [ ] **Fondo generato** (modulo nuovo, `fondo.js`). Deterministico da un seme fisso, in unità di lavagna: nuvole larghe di gesso cancellato, qualche spugnata ad arco, grana fine. Dipinto su un canvas sotto quello dei tratti, rigenerato al resize. La gomma continua a scoprirlo. Test: determinismo, luminosità media, stesso fondo a 800/1600/3200. Misura del costo di generazione al resize su DPR 2.
3. [ ] **Il fondo nel JPEG** (`export.js:165`). Stessa funzione al posto del `fillRect` di `BOARD_BG`, per download e invio. Misura del peso del JPEG a 1600 px, q 0,92 (la grana lo gonfia; tetto del plugin 5 MB, ma conta di più il tempo di invio da telefono). Confronto schermo/export.
4. [ ] **-26 con bordi e fondo insieme**, confronto con la -24 (e `?gesso=vecchio`). Daniele sul telefono: aspetto e 60 fps. Poi il link al cliente, che lo dà Daniele.
Rischi aperti:
- **Il bordo più largo fa SEMBRARE il tratto più sottile** (già scritto in `GESSO.bordo`): è la lamentela «tratti sottili» del cliente. La larghezza percepita va misurata e, se cala, compensata allargando la banda, non con `PRESSURE_*`.
- Granelli fuori dal tratto = pixel fiochi = rischio di alone grigio (`velo` sopra 0,15 lo faceva già). Il confine fra «sgranato» e «sporco» si trova solo guardando.
- Sul telefono un'unità di lavagna è mezzo pixel: granelli da un'unità diventano grigio medio. I granelli del bordo vanno misurati a DPR del telefono, non solo sul desktop.
- **Galleria mista**: in produzione (quando ci arriverà) si mescoleranno fondi pieni e lavorati, oltre a gesso vecchio e nuovo (punto 5). Accettato da Daniele il 30/09.
- Rosso e marrone con opacità 0,35 si perdevano già sul pieno; su un fondo con nuvole più chiare rischiano di più anche a luminosità media invariata. Da guardare al passo 4.
- `--board` è usato anche fuori dalla lavagna (`index.html:706`, il pannello debug): resta un colore, la texture va solo sotto `.layers`.
Costo stimato: 4 passi, tre prototipi (-25, -26, eventualmente uno intermedio). Proporzionato: è il fronte che Daniele ha chiesto; il rischio vero è il giro di taratura del passo 1, che si chiude a occhio.
4. [ ] Da vedere (Daniele/cliente): sul gesto veloce la larghezza cala del 18% (vecchio −28%, cliente voleva ~20%). Non cercato: viene dal deposito. Da fermo 22 px contro 25 del vecchio.
5. [ ] Prima di unire a main: cambia l'aspetto approvato dal cliente; la galleria mescolerebbe disegni vecchi e nuovi (le immagini approvate non si rigenerano; 11973/11975 non hanno un Drawing vero).

## Decisioni prese e perché
- **Produzione con l'invio acceso dal 23/09/2026** (Daniele), contro il consiglio di un interruttore spento fino ai passi 4-6.
- **Domanda d'invio PRIMA di salvare; invio in parallelo alla condivisione con ripresa; `invio_id` fisso per tentativo**: Safari rifiuta `navigator.share` dopo un'attesa, e chi va su WhatsApp non torna a rispondere.
- **Endpoint anonimo senza nonce**: per un anonimo il nonce è uguale per tutti e la cache lo servirebbe scaduto.
- **Rate limit TOLTO nella 1.12.0 (28/09/2026), su richiesta del cliente**, contro il consiglio di tenere un tetto per IP. Ogni invio è un post, un JPEG e una **mail**. Per rimetterlo: tag `rate-limit-1.11.5`; se per IP, **solo `REMOTE_ADDR`**.
- **Honeypot tolto; un'immagine estranea con le misure giuste passa**: la difesa è la moderazione.
- **Retention in `disegni.php`, non in `bacheca.php`**: lo svuotamento gira nel cron, dove `bacheca.php` non c'è.
- **Moderazione dalla mail: aprire il link non agisce mai, agisce solo il pulsante in POST** (scanner di posta). Link firmato, 7 giorni, un disegno per link. Destinatario in un'impostazione a sé, non `admin_email`.
- **Pagina di moderazione**: tasti copiati dal kit Elementor del sito; **Rifiuta senza bordo per decisione di Daniele**, contro l'obiezione registrata nel codice.
- **Il nero è nero (#050506), non il colore della lavagna** (28/09/2026): #1F2225 sul fondo vuoto non lascia segno.
- **Iframe, non inline, senza `sandbox`; cache buster in query string, non nel percorso** (il tutorial ha il percorso nella chiave).
- **Disegni anonimi, niente nickname. CPT `frmm_disegno`**, non pubblico, non in REST.
- **Gesso nuovo: la valle si SOTTRAE al deposito, non lo moltiplica** — moltiplicando, i buchi non si riempiono mai senza staccare il dito. Stessa doppia inversione in GPU della soglia (niente `getImageData`).
- **Gesso nuovo: nessun tetto di opacità sul tratto** (`opacita` 0,95 è solo il massimo): un tetto per tratto blocca l'accumulo dentro il tratto stesso.
- **Gesso nuovo: la grana è spostata per ogni tratto, non ancorata alla lavagna** — ancorata, ripassare schiariva sempre gli stessi granelli.
- **Gesso nuovo: la gomma è quella vecchia**, e `?gesso=vecchio` resta per il confronto sul device.
- **Spessore/velocità chiuso il 17/09/2026** col gesso vecchio (`PRESSURE_*` non toccate): il −18% del nuovo è emergente, non una ritaratura.

## Trappole
- **Due disegni in produzione hanno un Drawing finto**: post **11973 e 11975**; un render dai tratti li darebbe vuoti. L'immagine è quella vera.
- **La mensola a una riga chiede ~1050px**: fra 701 e 1099px va su due righe (`index.html`). Chi aggiunge un gessetto rimisuri.
- **Fondo lavagna (desiderio B3)**: oggi è un colore nel CSS **perché** la gomma lavora in `destination-out` e scopre ciò che sta sotto il canvas. Una texture può stare nel CSS allo stesso modo, ma **l'export dipinge `BOARD_BG` pieno** (`export.js`): va dipinta anche lì, o l'immagine salvata non somiglia allo schermo.
- **Playwright MCP «Browser is already in use»**: resta vivo il server di una sessione precedente. Non ucciderlo: `playwright-core` dalla cache npx (`npm-cache/_npx/*/node_modules/playwright-core`) con `channel: 'chrome'` lancia un'istanza a sé. Script nel transcript del 30/09.
- **Playwright: il mouse sintetico va mosso con una pausa di ~16 ms per evento.** Senza pause filtro e pseudo-pressione producono tratti deformati, e sembra un bug dell'app.
- **Confronti a hash fra overlay e livello dei tratti solo su zone dove non c'è altro**: alle inversioni gli scarabocchi sporgono, e l'hash differisce senza nessun salto vero.
- **Nella pagina di confronto un singolo seme inganna**: le nuvole della trama fanno ±15 punti fra un tratto e l'altro. Si media su più semi (`window.__prova`).
- **Il `main.js` del prototipo resta in cache nel Chrome di Playwright**: svuotare con CDP `Network.clearBrowserCache`.
- **Firefox misura una fila flex dal contenuto dei figli**: per questo `.tools .chalk` ha anche `width`.
- **Chrome/Edge headless: larghezza minima ~500px**; per il telefono la pagina va in un iframe da 390.
- **Il firewall di SiteGround filtra `/wp-admin/` per user agent**: gli script si presentano come Safari.
- **`prova-mail.py` riscrive «Notifiche dei disegni» dello staging e manda due mail vere; `prova-bacheca.py` consuma i due disegni in attesa più vecchi.**
- **Gmail butta padding e bordo sugli `<a>`**: stili sugli `<span>`.
- **SiteGround serve i `.js` con un anno di cache**: `pacchetto.py` mette `?v=` su ogni import (anche su `gesso.js`, verificato); `confronto-gesso.html` non va nello zip.
- **Chrome Android ≠ desktop ≠ Safari**; `<script>` di `altezza="schermo"` DOPO il `<div>`; `rect` riletto a ogni `pointerdown`; `margin-top` 55/65px; `dvh`.
- **PHP non è installato sul PC**: copia temporanea in uno scratchpad, può sparire.
- **`.lavoro/` non è gitignorata e il repo è pubblico**: niente credenziali. Token GitHub e password dello staging passati in chiaro in transcript: **da ruotare**.
- **FTP**: credenziali che aprono tutto l'account; solo `temp/frmm-drawing-plugin*`. Online `frmm`, repo `frrm`: non correggere.
- Verifiche: `node prototipo/test/run.js` (76) · `php … plugin/test/validazione.php` (81) · `php plugin/test/galleria.php` (9) · `prova-invio.py` (40) · `prova-mail.py` (33) · `prova-bacheca.py` (14) · `prova-abuso.py` · `prova-retention.py` · `diagnostica-ip.py` (sola lettura).

## Prossimo passo
Daniele guarda la -26 (`confronto-gesso.html`, a scala telefono con lente 2x; e la lavagna vera sul telefono). Se i bordi vanno, passo 2: il fondo generato. Il passo 4 del piano andrà nella -27, non nella -26.
