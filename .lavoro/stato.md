# Stato — Lavagna (FRRM - Drawing plugin)
Ultimo aggiornamento: 30/09/2026
Versione corrente: `frmm-lavagna` **1.13.0 su staging** (gessetto nero, mensola a due righe fra 701 e 1099px), **1.12.0 in produzione** (rate limit tolto, 28/09/2026); `custom-marquee` **1.2.1** su entrambi. Prototipo online: `temp/frmm-drawing-plugin-20/` (main), **`-24/` col gesso nuovo (branch `gesso-realistico`, non in main)**. Stato approvato dal cliente: tag `approvato-cliente-25092026` (su `0d6df7c`), zip in `.lavoro/dist/approvato-cliente-25092026/` (solo locale: contengono i font commerciali).

## Dove siamo
In produzione: la lavagna salva e manda il disegno; bacheca, mail con Approva / Rifiuta senza login, galleria degli approvati; retention; niente rate limit dalla 1.12.0. La mail in produzione va ancora ad `admin_email` (`d.suppo@issimissimo.com`): «Notifiche dei disegni» è vuota.
Sul branch `gesso-realistico` c'è un gesso nuovo (`prototipo/src/gesso.js`), online solo nella -24: Daniele «molto soddisfatto» (30/09/2026). Il gesso vecchio resta raggiungibile con `?gesso=vecchio`.

## Piano attivo
**A. Fasi 6, 7, 9, 10 (approvato 23/09/2026)** — tutto fatto tranne:
6. [ ] **Sospeso** (Daniele, 26/09/2026): bozze legali per i genitori. Devono dire che SALVA E INVIA manda il disegno alla Fondazione. Senza rate limit non si conserva niente dell'IP.
9. [ ] QA su device veri, flusso intero, **in produzione**: disegno dal telefono → mail → link → Approva → galleria (compreso il purge di Speed Optimizer).

**B. Gesso realistico (branch `gesso-realistico`, 29–30/09/2026)** — solo prototipi su FTP, niente produzione.
Criterio di finito: confronto affiancato (`-24/confronto-gesso.html`) ✅ · ripassare riempie i buchi anche senza staccare ✅ · **60 fps su iPhone 13 e Galaxy S10 ✗ (Daniele)** · **due desideri aperti ✗** (sotto) · **il cliente vede la differenza ✗**.
1. [x] -21 → -24: punta trascinata con filamenti, trama fine con valli che si sottraggono al deposito, passata semitrasparente che si accumula, bordi che si allargano. Storia dei giri e numeri in `prototipo/README.md` e in `GESSO` (`palette.js`).
2. [ ] **Desiderio di Daniele (30/09)**: tratto più irregolare, **bordi meno definiti** di quelli della -24.
3. [ ] **Desiderio di Daniele (30/09)**: **fondo lavagna come la reference** (dreamstime 189200205, «I ♥ School»), non un colore pieno.
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
Daniele prova la -24 sul telefono (`?debug=1`, FPS TRATTO su uno scarabocchio lungo; ripassare col dito). Se regge i 60 fps, si passa ai due desideri B2 e B3.
