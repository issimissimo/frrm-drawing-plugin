# Stato — Lavagna (FRRM - Drawing plugin)
Ultimo aggiornamento: 23/09/2026 (notte)
Versione corrente: plugin `frmm-lavagna` **1.6.1** (installato solo sullo staging: endpoint di invio e invio dall'app). Il prototipo non ha numero.

## Dove siamo

La lavagna (fasi 0–4b, tutorial compreso, test con un bambino superato) vive in una pagina Elementor dello **staging** della Fondazione (`/lavagna-prova-plugin/`), via `[lavagna altezza="schermo"]` in un iframe. SALVA **chiede prima** «SALVA E INVIA» / «SOLO SALVA», poi scarica o condivide; con INVIA, nello stesso tocco, il disegno parte per la bacheca. **Provata sul telefono da Daniele il 23/09/2026: funziona tutto**, WhatsApp compreso.
In produzione il plugin non c'è. 68 test JS (`node prototipo/test/run.js`), 48 PHP (`php -d extension=gd plugin/test/validazione.php`), 40 sullo staging (`python .lavoro/prova-invio.py`) e 14 sulla bacheca (`python .lavoro/prova-bacheca.py`, consuma due disegni in attesa a giro). Zip con `python .lavoro/pacchetto.py`, installazione sullo staging con `python .lavoro/installa-staging.py` (credenziali lette dallo script, mai stampate).

## Piano attivo — Fasi 6, 7, 9, 10 (approvato il 23/09/2026, passi 1–2 fatti)

Obiettivo: un bambino **sceglie** di mandare il disegno (la domanda sta PRIMA del salvataggio, dal 23/09/2026); arriva in bacheca, un adulto lo approva o lo rifiuta dalla miniatura, gli approvati vanno in una galleria. Tutto sullo staging.

Decisioni d'apertura: SALVA scarica e **poi chiede** «Vuoi mandarlo alla Fondazione?» (INVIA / NO GRAZIE) · **D1 chiuso**: la galleria accetta proporzioni miste · una sola risoluzione, **1600px** · niente Turnstile · niente nonce sull'endpoint anonimo · immagini in attesa con **nome casuale a 128 bit** (confermato da Daniele: non la cartella protetta).
Assunzioni **confermate da Daniele il 23/09/2026**: JPEG senza logo · email ad `admin_email` · rifiutati nel cestino, via dopo 30 giorni **con l'immagine** · testi legali in bozza da Claude · plugin resta `frmm-lavagna`.

Criterio di finito (sullo staging): dal telefono SALVA → finestra → INVIA → conferma per bambini, e con NO GRAZIE sul server non arriva niente · l'email arriva con la miniatura · in bacheca miniatura e Approva/Rifiuta in due click · l'approvato compare in galleria, il rifiutato mai e sparisce dal server immagine compresa · lo script di abuso (500 invii, 50 MB, non-immagine, immagine estranea, JSON rotto) fallisce tutto · nessuna immagine in attesa a un URL indovinabile · bozze legali consegnate.

Fuori perimetro: go-live in produzione · Fase 5 (unica eccezione: il `client_id`, scritto con la chiave che userà la 5) · alta risoluzione · Turnstile · nickname · approvazione dei testi legali (è della Fondazione).

Passi:
1. [x] Endpoint senza l'app — **fatto il 23/09/2026, plugin 1.3.0**. CPT `frmm_disegno` (prefissato: i tipi WP condividono lo spazio di nomi), `POST /wp-json/frmm-lavagna/v1/invio` multipart (`client_id`, `disegno` JSON, `immagine` JPEG). Tipo dai byte, JPEG 1600 × `board.h` ±1, Drawing ricostruito campo per campo, **immagine ricodificata con GD** (toglie qualunque coda: provato con un poliglotta JPEG+PHP). File in `uploads/frmm-lavagna/<128 bit>.jpg`. Da anonimo verificati chiusi `?attachment_id=`, `?p=`, `/wp/v2/media` (404/401), cartella 403, Yoast senza sitemap degli allegati. Il plugin di sicurezza SiteGround **non** blocca i POST anonimi.
2. [x] Invio dall'app — **plugin 1.5.1, 23/09/2026, provato sul telefono**. `src/invio.js`.
   - **La domanda sta PRIMA di salvare** (Daniele, dopo la prova sul telefono della 1.4.1): chi condivide su WhatsApp resta in WhatsApp e non torna a rispondere a una domanda fatta dopo. SALVA → «SALVA E INVIA» / «SOLO SALVA»; il tocco sulla risposta fa partire il salvataggio, ed è quel tocco che dà l'attivazione al foglio di condivisione. Una domanda per disegno: salvare di nuovo lo stesso disegno rifà la scelta di prima senza chiedere. Esc chiude senza salvare.
   - **Invio e condivisione in parallelo, con ripresa** (scelta B, Daniele). Aspettare l'upload prima di aprire la condivisione non si può: Safari rifiuta `navigator.share` dopo un'attesa di rete, in silenzio. L'invio parte nello stesso tocco; se non arriva si riprova quando la pagina torna visibile, quando torna la rete, e a tempo (10 s → 10 min, 6 tentativi). La coda è in memoria (max 5): se iOS chiude la scheda si perde, ma con lei si perde anche il disegno.
   - **Niente doppioni**: ogni invio porta un `invio_id`, uguale a ogni tentativo; il server risponde 200 e non scrive se l'ha già (anche nel cestino). Verificato sullo staging: due arrivi, un disegno in bacheca.
   - **Misura della ripresa**: ogni disegno registra `_frmm_tentativo`. Dopo un periodo di prova si conta quanti sono arrivati al primo colpo; se la ripresa servisse spesso, si passa alla strada A (prima l'invio, poi un tocco in più per condividere).
   - Resta valido dalla 1.4.x: `client_id` in `frmm-lavagna:client_id` (senza percorso), punti arrotondati al centesimo nella copia che parte, JPEG senza logo, endpoint accettato solo same-origin. Tasti impilati a tutta larghezza sotto i 480px (affiancati «SALVA E INVIA» andava a capo); SOLO SALVA bianco su trasparente, perché il no sia disponibile quanto il sì. Peso: disegno fitto 1600×2248 → JPEG 368 KB + JSON 83 KB.
3. [x] Bacheca — **plugin 1.6.0, 23/09/2026; email confermata da Daniele**. `includes/bacheca.php`: elenco con la miniatura al posto del titolo (clic = immagine intera in un'altra scheda), **Approva / Rifiuta come pulsanti nella riga** (un click, con nonce e permessi per disegno: sul sito c'è PublishPress Capabilities), Approva anche in blocco, numero dei disegni in attesa nel menu come i commenti, colonna **Tentativo** (la misura della ripresa). Approvato = pubblicato, ma il CPT resta non pubblico: nessuna pagina, 404 da anonimo. Rifiutato = cestino. **I non approvati sono fuori dalla Libreria media** (griglia, elenco e ogni selettore d'immagine: Elementor, FileBird); l'approvato ci entra, perché la galleria dovrà poterlo prendere (D3). `includes/notifica.php`: email ad `admin_email` (sullo staging è `d.suppo@issimissimo.com`, non la Fondazione) con la miniatura 300 px **incorporata** (`cid:`), non linkata: le immagini remote i programmi di posta le bloccano. Filtro `frmm_lavagna_destinatari` per cambiare destinatario. Un doppione non manda una seconda email.
4. [ ] Anti-abuso con script ripetibile: rate limit per IP **in hash** e per `client_id`, limiti prima di leggere il corpo, honeypot.
5. [ ] Retention: Rifiuta = cestino, 30 giorni, hook che cancella l'allegato.
6. [ ] Bozze legali: sezione privacy policy + due righe della finestra di invio, per un genitore.
7. [ ] **Fermata**: masonry, custom marquee o altro? Senza risposta la Fase 10 non parte.
8. [ ] Galleria sullo staging, solo approvati, senza leggere l'inbox (D3).
9. [ ] QA su device veri, flusso intero.

Rischi: **i disegni in attesa compaiono nella Media Library** per chi è collegato, mescolati ai media della Fondazione: qualcuno potrebbe inserirne uno in una pagina per sbaglio — da nascondere al passo 3 (`ajax_query_attachments_args`) · il nome casuale rende l'URL non indovinabile, non segreto · l'email dallo staging può non partire · il plugin di sicurezza di SiteGround può bloccare i POST REST anonimi (si scopre al passo 1) · SiteGround Optimizer, se sposta o differisce gli script inline, riaprirebbe la corsa di `altezza="schermo"` · i rifiutati occupano la Media Library per 30 giorni · i testi legali sono una dipendenza esterna.

## Decisioni prese e perché

- **Opacità del tratto 0.35 (23/09/2026, cliente → Daniele)**, era 0.80. Confronto a parità di tratti e grana: 0.65 indistinguibile da 0.80, 0.50 consigliato da Claude, 0.35 scelto. Copertura della campitura bianca 0.81 → 0.63, pixel quasi pieni 57% → 11%. Prezzi e rischio di ricaduta sulla questione spessore/velocità scritti sopra `CHALK_ALPHA`. Online nella -18 e sullo staging (1.6.1); **provata sul telefono: funziona**.

- **Fase 8 chiusa (23/09/2026): iframe, non inline.** Dentro un iframe la viewport è il Container, e `100dvh`, media query, `#tut{position:fixed}` e i listener su `document` restano validi senza toccarli; inline andavano riscritti e avrebbero spento pinch e doppio tap su tutto il sito.
- **Il plugin è un file PHP e un README; l'app non è duplicata**: `pacchetto.py` copia `prototipo/` dentro `app/` al momento dello zip, e rifiuta di costruire se le due versioni del plugin divergono.
- **Cache buster in query string (`?v=`), non nel percorso**: il «già visto» del tutorial sta in una chiave che contiene `location.pathname`.
- **Iframe senza `sandbox`, con `allow="web-share"`**: un sandbox spegnerebbe il download, che è tutto quello che il bambino porta a casa.
- **`altezza="schermo"` esiste perché il conto a mano è sbagliato**: sopra la lavagna c'erano 166px, non 65. È l'unico JS che il plugin mette nella pagina, ed è opt-in.
- **«Torna al sito» tolto (23/09/2026)**: la pagina ha l'header; dentro un iframe `history.back()` avrebbe navigato l'iframe.
- **Rifai tolto (cliente, 18/09/2026)**: `history.redo()` resta in `model.js` ma non lo chiama nessuno. Annulla è irreversibile.
- **L'arancione `#FF6000` vive solo nel tutorial**, sul tratteggio e sull'etichetta del passo. Nella mensola no. Regole sull'**id**: `#btn-save` condivide `.primario`.
- **Due contrasti di AVANTI sotto soglia (3,39 e 2,10) sono un prezzo dichiarato**: arancione istituzionale su fondo chiaro voluto dal cliente.
- **Spessore/velocità chiuso (17/09/2026)**: `PRESSURE_MIN 0.84`, `PRESSURE_ALPHA_MIN 0.85`. Non si ritara: la metrica non descrive il fenomeno.
- **Grammatica dei tasti misurata sul sito**: fondo `#FFFFFF1A`, bordo `2px #FFFFFF54`, raggio 0, corpi sulle soglie di Elementor.
- **Nessun nickname, nessuna attribuzione**: disegni anonimi, niente consenso genitoriale. Il brief legge ancora `nickname?` nel payload di §6: non va implementato.
- **Fondo lavagna nel CSS, canvas trasparente**: la gomma in `destination-out` altrimenti aprirebbe buchi.
- **A fine gesto non si ridisegna dal modello**: si travasano i pixel. Senza, il tratto saltava del 42%.
- **Lo smoothing si governa con l'epsilon RDP, non col filtro.** Punta di gesso a dimensione fissa. Spessori 21 / 27 / 50, raddoppiati sotto 700px.
- **Rosso e marrone fuori dalla serie isoluminante** (cliente): a L 0.780 il rosso è salmone.
- **Font della Fondazione non nel repo** (commerciali, repo pubblico); il pacchetto li include se li trova.
- **Si pubblica in cartelle numerate** sotto `temp/`: difesa dalla cache di SiteGround.

## Trappole

- **SiteGround serve i `.js` con `max-age` di un anno.** Il `?v=` dello shortcode rinnova solo `index.html`: i moduli restavano quelli vecchi per chi aveva già aperto la lavagna, e un modulo nuovo che importa da uno vecchio **non apre la lavagna**. Dalla 1.4.1 `pacchetto.py` mette `?v=` su **ogni** import della copia nello zip e rifiuta di costruire se ne manca uno. Scoperto sullo staging il 23/09/2026: il browser di prova aveva il `main.js` della 1.2.0.
- **`drawing.board.h` non seguiva `unfreezeBoardHeight()`** (corretto il 23/09/2026, `adattaLavagna()` in `model.js`): a lavagna vuota il rapporto cambiava, il Drawing no, e l'immagine salvata aveva le misure del primo layout. Colpiva proprio Chrome Android dentro WordPress.

- **Chrome Android si comporta diversamente da Chrome desktop e da Safari.** La corsa script/primo layout si vedeva solo lì: ciò che non si riproduce sulla propria macchina non è per questo risolto.
- **Lo `<script>` di `altezza="schermo"` deve uscire DOPO il `<div>` e girare subito.** Rimandarlo a `DOMContentLoaded` riapre la corsa col `freezeBoardHeight()` dell'app.
- **Il `rect` del canvas si rilegge a ogni `pointerdown`**: nell'iframe il canvas può spostarsi senza cambiare dimensione, e nessun evento lo dice.
- **`unfreezeBoardHeight()` solo a lavagna vuota**: con un tratto sopra il rapporto non cambia più, ed è voluto.
- **L'header del sito è `position: fixed`** nella pagina della lavagna (sul sito pubblico misurato risultava `static`): serve `margin-top` al Container, **55px sopra 1200, 65px da 1024 in giù**, impostato su **tutti e tre** i dispositivi di Elementor.
- **`vh` su iOS non è l'altezza visibile**: si usa `dvh`.
- **La barra di amministrazione (46px) la vede solo chi è collegato**: la pagina provata da loggati non è quella del visitatore.
- **Nell'editor Elementor la misura di `altezza="schermo"` non è attendibile**: si guarda l'anteprima.
- **Elementor Pro sullo staging ha la licenza non valida** (dominio diverso): se un widget Pro si comporta male, prima di indagare si guarda quello.
- **`.lavoro/` NON è gitignorata e il repo è pubblico**: le credenziali dello staging stanno in `~/.claude/.secrets/wp-staging-fondazione.env`.
- **Verificare l'attributo non è verificare quel che si vede**: visibilità con `offsetParent`, leggibilità col contrasto calcolato, e poi lo schermo.
- **`localStorage` è per origine**, non per cartella: ogni stato ricordato porta `location.pathname` nella chiave.
- **SiteGround**: `Cache-Control` lo mette NGINX, un `.htaccess` non serve. Lo script FTP usa `--ftp-ssl-control` (TLS solo sul controllo) per un difetto dello shutdown TLS del canale dati: da non copiare per dati non pubblici.
- **Le credenziali FTP aprono tutto l'account SiteGround**, sito della Fondazione compreso: solo `temp/frmm-drawing-plugin*`, sempre con un listing prima.
- **Due nomi, voluto**: online `frmm`, cartella e repo `frrm`. Non correggere l'FTP.
- **I font della Fondazione non si linkano dal loro URL** (niente CORS). `SebinoSoft` non ha un 300 ed è il 15% più larga di Atkinson.
- **Campioni radi** (~55/s, niente `getCoalescedEvents`): il ricampionamento interpola su curva. `performance.now()` è a 1 ms su iOS.
- **Il livello dei tratti diverge dal modello**: su undo/resize la grana cambia (~30%), la forma no.
- **Vicoli ciechi**: aspetto del timbro legato alla posizione; più smoothing alzando `minCutoff`/`beta`.
- **Il token GitHub e la password dello staging sono passati in chiaro** in transcript: da ruotare entrambi.
- Il `.md` del brief ha il markdown escapato: voluto.

## Prossimo passo

**Passo 4: anti-abuso** — il rate limit è anche il tetto delle email: oggi 500 invii sarebbero 500 email.
