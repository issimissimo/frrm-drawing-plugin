# Stato — Lavagna (FRRM - Drawing plugin)
Ultimo aggiornamento: 26/09/2026 (passo 5 chiuso; Approva/Rifiuta dalla mail sullo staging, manca la prova da telefono)
Versione corrente: `frmm-lavagna` **1.9.0** (retention, 26/09/2026; rate limit dalla 1.8.0) e `custom-marquee` **1.2.1**, sullo staging **e in produzione**. Prototipo online: `temp/frmm-drawing-plugin-18/`. **Stato approvato dal cliente salvato il 25/09/2026**: tag `approvato-cliente-25092026` su `0d6df7c` (pushato), zip installati in `.lavoro/dist/approvato-cliente-25092026/` (solo locale: contengono i font commerciali).

## Dove siamo
Sullo staging (`/lavagna-prova-plugin/`) la lavagna salva e, se il bambino sceglie «SALVA E INVIA», manda il disegno: arriva in bacheca con miniatura, email all'admin, Approva/Rifiuta in un click. Provato sul telefono da Daniele il 23/09/2026, WhatsApp compreso. **In produzione (23/09/2026, decisione di Daniele) il plugin è installato e attivo con l'invio acceso** (oggi 1.8.0). Il passo 4 (rate limit, 25/09/2026) e il 5 (retention, 26/09/2026) sono chiusi e installati anche lì; resta scoperto il 6 (testi per i genitori), **sospeso** da Daniele. `admin_email` lì è `d.suppo@issimissimo.com`.
Verifiche: `node prototipo/test/run.js` (68) · `php -d extension=gd plugin/test/validazione.php` (71) · `python .lavoro/diagnostica-ip.py [--produzione]` (solo lettura) · `python .lavoro/prova-abuso.py` (staging, 20 disegni e 20 email; `raffica` 3, `pulisci`) · `python .lavoro/prova-invio.py` (40, staging) · `python .lavoro/prova-bacheca.py` (14, staging, consuma 2 disegni in attesa). Zip: `python .lavoro/pacchetto.py`; installazione: `python .lavoro/installa-staging.py`.

## Piano attivo — Fasi 6, 7, 9, 10 sullo staging (approvato 23/09/2026)
Obiettivo: un bambino **sceglie** di mandare il disegno; arriva in bacheca, un adulto lo approva o lo rifiuta dalla miniatura, gli approvati vanno in una galleria.

Criterio di finito (sullo staging): dal telefono SALVA → «SALVA E INVIA» → il disegno è in bacheca, con «SOLO SALVA» sul server non arriva niente ✅ · email con miniatura ✅ · bacheca con miniatura e Approva/Rifiuta ✅ · l'approvato compare in galleria, il rifiutato mai e sparisce dal server immagine compresa · lo script di abuso (500 invii, 50 MB, non-immagine, immagine estranea, JSON rotto) fallisce tutto · nessuna immagine in attesa a un URL indovinabile ✅ · bozze legali consegnate.

Fuori perimetro: ~~go-live in produzione~~ (fatto da Daniele il 23/09/2026, fuori piano) · Fase 5 (eccezione: `client_id`) · alta risoluzione · Turnstile · nickname · approvazione dei testi legali (della Fondazione).

1. [x] Endpoint `POST /wp-json/frmm-lavagna/v1/invio` (1.3.0).
2. [x] Invio dall'app (1.5.1): domanda PRIMA di salvare, invio in parallelo alla condivisione con ripresa, `invio_id` contro i doppioni, `tentativo` registrato.
3. [x] Bacheca ed email (1.6.0).
4. [ ] **Anti-abuso** — sotto-piano qui sotto: rate limit per IP in hash e per `client_id`, limiti prima di leggere il corpo, honeypot, script ripetibile. Oltre il limite il bambino non vede errori. **Numeri decisi da Daniele il 25/09/2026: 3 invii per dispositivo (`client_id`) e 20 per IP, finestra di 24 ore dal primo invio.** Perché due limiti: il `client_id` lo inventa chi manda, quindi da solo non ferma un ciclo con curl — lo ferma l'IP; ma 3 per IP farebbe perdere in silenzio i disegni di una classe (wifi della scuola, CGNAT mobile), e l'uso in classe è plausibile. Chi cambia rete e ne manda altri 100 **non è coperto, per scelta**: si riapre se ne arrivano a centinaia, e l'allarme è la casella stessa (una mail per disegno). **Prima di scrivere il limite**: verificare sullo staging e in produzione che `REMOTE_ADDR` sia l'IP di chi disegna e non quello di un proxy (CDN SiteGround, Cloudflare) — altrimenti 20 per IP diventa 20 al giorno per tutti.
5. [ ] Retention: cestino 30 giorni, cancellazione dell'allegato **e del file** (oggi svuotare il cestino lascia il JPEG in `uploads/frmm-lavagna/`).
6. [ ] Bozze legali per un genitore: privacy policy + testo accanto alla domanda. Devono dire che «SALVA E INVIA» manda il disegno alla Fondazione.
7. [x] **Fermata sciolta** (Daniele, 23/09/2026): la galleria è il **Custom Marquee** già presente sul sito. **Ordine dei fronti deciso da Daniele: prima la galleria, poi il 4.**
8. [x] Galleria: il Custom Marquee con sorgente «Disegni della Lavagna» — sotto-piano chiuso il 24/09/2026, installato anche in produzione. Resta da verificare lì il purge all'approvazione (vedi Prossimo passo).
9. [ ] QA su device veri, flusso intero.

### Sotto-piano del passo 5 — retention (approvato e CHIUSO il 26/09/2026, staging e produzione)
Ordine deciso da Daniele il 26/09/2026: **prima il 5, poi Approva/Rifiuta dalla mail; il 6 sospeso.**

Obiettivo: un disegno rifiutato sparisce davvero dopo 30 giorni nel cestino (post, allegato, file, miniature), e nel frattempo non ricompare da nessuna parte.

**Perché non è solo spazio su disco** (trovato il 26/09/2026 leggendo il codice): la Libreria media nasconde le immagini dei disegni in base al disegno a cui sono attaccate (`bacheca.php`). Eliminando un post, WordPress non cancella i suoi allegati: li stacca. A cestino svuotato, l'immagine di un disegno RIFIUTATO resta senza disegno, esce dal filtro e ricompare nella Libreria e nei selettori di Elementor. Probabilmente diventa anche leggibile da anonimo in `/wp/v2/media`, perché un allegato senza genitore la REST API lo tratta come pubblico: **ipotesi, da riprodurre al passo 1**. Oggi nessun orfano (26/09/2026: staging 51 allegati tutti attaccati, produzione 1). Diventa reale sullo staging verso il 23/10 (primi disegni di prova nel cestino da 30 giorni) e in produzione 30 giorni dopo il primo rifiuto.

Criterio di finito (staging):
- **con la 1.8.0**, un disegno di prova rifiutato ed eliminato definitivamente lascia un allegato orfano: si misura dove ricompare (Libreria, `/wp/v2/media` da anonimo, URL del file). È la prova del difetto;
- **con la 1.9.0**, la stessa sequenza non lascia niente: nessun allegato, file e miniature 404 da anonimo;
- vale per tutte le strade: «Elimina definitivamente», «Svuota cestino» (provato sui ~27 disegni di prova già nel cestino dello staging) e lo svuotamento automatico dopo 30 giorni, che passa dalla stessa funzione (`wp_delete_post`) e quindi dallo stesso aggancio. Quest'ultimo si dimostra dal codice, non aspettando 30 giorni;
- `EMPTY_TRASH_DAYS` misurato su staging e produzione (atteso 30, il default; se è 0 il cestino non esiste e si cancella subito);
- i disegni approvati non si toccano; test verdi.

Fuori perimetro: i disegni in attesa mai moderati (restano finché qualcuno decide) · orfani creati prima della 1.9.0 (oggi zero, misurato).

Passi:
1. [x] **Riprodotto, 26/09/2026, ipotesi confermata per intero**: sulla 1.8.0 l'allegato orfano restava, compariva nella Libreria e **`/wp/v2/media/<id>` lo dava a un anonimo (200)**, con originale e 4 miniature leggibili. L'orfano della prova è stato cancellato a mano. — **Riproduzione sulla 1.8.0**: `prova-retention.py` invia un disegno, lo rifiuta, lo elimina definitivamente con i link veri della bacheca, e guarda dove ricompare l'immagine.
2. [x] **Fatto**: 1.9.0, in `disegni.php` perché il cron non carica `bacheca.php`. Cancella solo gli allegati in `uploads/frmm-lavagna/`: un'immagine in evidenza messa a mano dalla Libreria non si tocca. — **1.9.0**: su `before_delete_post` di un `frmm_disegno`, `wp_delete_attachment(..., true)` dei suoi allegati (file e miniature compresi). La diagnostica (`GET /limiti`) riporta anche `EMPTY_TRASH_DAYS`.
3. [x] **Verde**: `prova-retention.py` 10/10 (niente allegato, niente Libreria, REST anonima 404, file e miniature 404, **anche fuori dall'albero anno/mese**); «Svuota cestino» sui 43 disegni di prova, zero orfani; ripetuto su un disegno apposta, 11/11. `EMPTY_TRASH_DAYS` 30 su staging e produzione. Non regressione: 71 PHP, 9 galleria, 68 JS, `prova-invio` 40, `prova-bacheca` 14. — **Prova sullo staging**: lo script di nuovo, poi «Svuota cestino» dei disegni di prova e ricerca degli orfani.
4. [x] README, `stato.md`, commit e push. **Produzione** (Daniele: «se funziona tutto installa anche in produzione»): 1.9.0 installata il 26/09/2026, cestino 30 giorni, zero orfani, endpoint vivo.

Rischi aperti:
- Il file sta in `uploads/frmm-lavagna/`, fuori dall'albero anno/mese: che `wp_delete_attachment` lo trovi e lo cancelli con le miniature va **verificato** (404 da anonimo), non supposto.
- Svuotare il cestino di un disegno approvato e poi tolto cancella anche la sua immagine: è giusto, ma è irreversibile.
- Lo svuotamento automatico dipende dal cron di WordPress, cioè dalle visite o dal cron di SiteGround: il giorno esatto non è garantito.
- **In produzione il difetto scatta 30 giorni dopo il primo rifiuto.** La 1.9.0 va installata lì prima di allora; consiglio subito dopo la prova sullo staging.

Costo stimato: 4 passi, una versione, poco codice (l'aggancio sono una decina di righe), mezza sessione.

### Sotto-piano — Approva/Rifiuta dalla mail (1.10.0 SULLO STAGING il 26/09/2026; aperta solo la prova da telefono)
Anticipato sul passo 6 per decisione di Daniele. **Solo staging.** Decisioni del 26/09/2026: **il link scade dopo 7 giorni**; **la pagina NON propone il disegno successivo**.

**Il destinatario sarà il cliente, che non ha accesso a WordPress** (Daniele, 26/09/2026). Poi, nello stesso giorno, Daniele ha semplificato: **niente rimedio dalla pagina** (un errore lo corregge lui dalla bacheca), **niente link alla bacheca nella mail**, i disegni in attesa li smaltisce lui. **L'indirizzo del cliente è personale.** Indirizzo di prova sullo staging: `danielesuppo@gmail.com`, impostato in Impostazioni → Generali → Notifiche dei disegni (opzione nuova: `admin_email` non si tocca). La rete di sicurezza per link scaduti o mail perse è Daniele dalla bacheca. **Da decidere prima della produzione**: se l'indirizzo del cliente è personale o condiviso (con una casella condivisa, chiunque la legga pubblica sul sito), e un'impostazione del plugin per il destinatario (oggi è `admin_email`, che porta con sé tutte le notifiche di WordPress). Un account WordPress limitato ai soli disegni è possibile ma non ora: oggi i disegni usano i permessi degli articoli.

Obiettivo: moderare un disegno dal telefono, partendo dalla mail di notifica, senza fare il login a WordPress.

Criterio di finito (staging):
- la mail vera ha due tasti, Approva e Rifiuta; dal telefono il tasto apre una pagina col disegno a grandezza piena e un pulsante di conferma; confermato, il disegno è approvato (compare su `/playground/`) o nel cestino;
- **aprire i link non cambia niente**: solo la conferma (POST) agisce. Lo script apre tutti i link come farebbe uno scanner di posta e verifica che lo stato non cambi;
- un link manomesso, scaduto o di un altro disegno non fa niente e lo dice; un link di un disegno già moderato dice com'è andata e offre l'azione contraria (togli un approvato, approva un rifiutato ancora nel cestino);
- il link alla bacheca nella mail c'è solo se il destinatario è un utente che può moderare;
- l'azione resta registrata come «via mail» nel disegno;
- test PHP delle funzioni pure (firma, scadenza) verdi, `prova-invio.py` e `prova-bacheca.py` ancora verdi.

Fuori perimetro: produzione · la coda (dopo un disegno, il successivo) · più destinatari · la mail riassuntiva.

Passi:
1. [x] **Fatto**: 10 test nuovi, 81 in tutto. — **Funzioni pure** in `validazione.php`: firma HMAC di (id del disegno, scadenza) e verifica, con i loro test. Il segreto è **un'opzione a sé** generata a caso, non il salt del sito: cambiarla invalida tutti i link in giro senza toccare i login di nessuno.
2. [x] **Fatto** (`includes/moderazione-mail.php`; senza rimedio, per la semplificazione di Daniele). — **La pagina** (`admin-post.php`, azione aperta anche agli anonimi): in GET mostra il disegno, il suo stato e i due pulsanti, con quello del tasto premuto in evidenza; in POST esegue (`wp_publish_post` / `wp_trash_post`, e per un rifiutato da riapprovare `wp_untrash_post` e poi pubblica, le stesse di oggi, quindi la data di approvazione e la cache della galleria seguono da sole) e scrive `_frmm_moderato_via = email`. Un solo link per disegno, per tutte e due le azioni: chi ha premuto Approva può ancora cambiare idea sulla pagina.
3. [x] **Fatto**: 1.10.0 sullo staging, destinatario come impostazione a sé. — **La mail**: i due tasti sotto la miniatura, il link alla bacheca resta. Versione 1.9.0, solo staging.
4. [~] **`prova-mail.py` 31/31**; non regressione 81 PHP, 9 galleria, 68 JS, `prova-invio` 40, `prova-bacheca` 14. **Trovato**: il firewall di SiteGround dà 403 a `/wp-admin/` se lo user agent è `python-requests`; un browser passa (lo script ora si presenta come Safari su iPhone). **Aperta: la prova di Daniele dal telefono**, con le mail dei disegni **11753 e 11755**, lasciati in attesa apposta (link validi fino al 03/10/2026). ⚠️ Non 11734/11736 come scritto prima: `prova-bacheca.py` consuma i due disegni in attesa più vecchi, e li aveva già moderati. **Chi lancia gli script di prova prima della prova di Daniele gli brucia i disegni.** 1.10.1/1.10.2 (26/09/2026, Daniele): tasti della mail rifatti come celle di tabella (Gmail buttava bordo e padding dell'`<a>`), pagina a un tocco in arancione istituzionale. Tasti che agiscono direttamente dalla mail: **discussi e scartati** (gli scanner di posta aprono i link; la posta del cliente è Monaco Telecom, `@monaco.mc`, server propri e webmail Open-Xchange, niente Microsoft né filtri esterni negli MX). Proposta rimasta aperta: misurare in produzione chi apre i link prima del cliente, e riconsiderare sui dati. — **Prova**: `prova-mail.py` (i link li dà una rotta per il solo amministratore, perché lo script non legge la posta) più la prova vera di Daniele dal telefono, dalla mail vera.
5. [x] README, `stato.md`, commit e push.

Rischi aperti:
- **Chi ha la mail modera**: inoltrarla vuol dire dare il potere di pubblicare. Oggi il destinatario è Daniele; il giorno che diventa la Fondazione o una casella condivisa, va ripensato.
- **Salta il controllo per ruolo** (PublishPress): l'autorizzazione diventa aver ricevuto la mail.
- Gli scanner di posta aprono i link (Safe Links, antispam): da qui la conferma in POST. Uno scanner che compila e invia moduli non l'ho mai visto, ma non lo escludo.
- L'immagine nella pagina è quella del disegno in attesa: il suo URL casuale lo vede solo chi ha il link.
- Ogni prova manda mail all'`admin_email` dello staging.

Costo stimato: 5 passi, una versione del plugin, mezza sessione più la prova sul telefono.

### Sotto-piano del passo 4 — anti-abuso (approvato e CHIUSO il 25/09/2026)
Obiettivo: una persona sola, da una rete sola, non può riempire la bacheca, il disco e la posta dell'account SiteGround; i bambini veri non se ne accorgono.

Criterio di finito:
- **produzione**: l'IP che PHP vede per una richiesta dal PC è l'IP pubblico del PC, non uno della CDN (rotta di diagnostica);
- **staging, `prova-abuso.py`**: stesso `client_id` → 3 × 201, il 4° 429 · stesso IP e `client_id` diversi → il 21° 429 · la ripresa di un `invio_id` già arrivato, a limite superato → 200 `doppio`, non 429 · 500 invii di fila → 20 in bacheca e il resto 429, senza scrivere niente (bacheca e file in `uploads/frmm-lavagna/` contati prima e dopo) · 50 MB → rifiutato, codice misurato · non-immagine e JSON rotto → 400 senza scrivere;
- dal telefono in 4G, con il PC già al limite, il disegno arriva: il limite è per IP e non globale;
- dopo l'azzeramento da amministratore un invio passa;
- test PHP (funzioni pure nuove comprese) e `node test/run.js` verdi, `prova-invio.py` ancora tutto verde.

Fuori perimetro: **honeypot** (vedi Rischi) · Turnstile/captcha · tetto globale · Approva/Rifiuta dalla mail · controllo che l'immagine corrisponda al disegno · passo 5 (retention) e 6 (testi legali). **L'app non si tocca**: al 429 lascia già perdere senza dire niente al bambino (`invio.js`, `motivoDaStatus` → `troppi`).

Passi:
1. [x] **Fatto, 25/09/2026: `REMOTE_ADDR` è l'IP vero sia sullo staging sia in produzione, e un'intestazione falsa non lo cambia** (`python .lavoro/diagnostica-ip.py [--produzione]`). In produzione la CDN aggiunge l'IP vero in coda a `X-Forwarded-For` (`falso,vero`); sullo staging `X-Forwarded-For` arriva **così come lo scrive il client**. Quindi il limite legge **solo** `REMOTE_ADDR`, mai le intestazioni. `post_max_size` e `upload_max_filesize` sono **256M** su tutti e due: PHP legge corpi fino a 256 MB prima del nostro codice. Non si cambia da un plugin (vale per la radice del sito): fuori perimetro, si sa. 1.7.1 installata su staging e produzione. — **1.7.1 — diagnostica, solo amministratore**: `GET /frmm-lavagna/v1/limiti` restituisce l'IP che vede PHP (`REMOTE_ADDR`), le intestazioni di inoltro presenti, `post_max_size` / `upload_max_filesize`. Installata su staging e produzione, confrontata con l'IP pubblico del PC. Se in produzione l'IP è della CDN ci si ferma e si decide come leggere l'inoltro, con i dati in mano.
2. [x] **Fatto, 25/09/2026**: 1.8.0 sullo staging, 71 test PHP (23 nuovi) e 68 JS verdi, `prova-invio.py` 40/40. Gli script che inviano azzerano i contatori all'inizio (`staging.azzera_limiti()`). — **1.8.0 — il limite**. Funzioni pure in `validazione.php` (chiave dell'IP con HMAC sul salt del sito, IPv6 contato per /64, finestra di 24 ore dal primo invio) con i loro test. Contatori in transient, con un numero di generazione nella chiave: azzerarli è incrementarlo, e funziona anche con la cache a oggetti, dove i transient non si possono elencare. Ordine nell'endpoint: dimensione dichiarata → `client_id` → doppione di `invio_id` → **limite** → JSON, JPEG, GD. Il contatore sale **solo a disegno archiviato**: una ripresa non consuma, un invio respinto nemmeno. `DELETE /limiti` da amministratore azzera.
3. [x] **Fatto, 25/09/2026, tutto verde**: `prova-abuso.py` 17/17 fino alla raffica, `raffica` 5/5 (97 invii oltre il limite, tutti 429, in bacheca +3 e non uno di più), `azzera` 2/2, `pulisci` 24 rifiutati. **Due scostamenti**: 100 invii e non 500 (anti-bot di SiteGround sull'IP del PC; oltre il 21° ogni invio passa per lo stesso controllo); file in `uploads/` non contati (solo via FTP sul sito della Fondazione), contati i disegni in bacheca. **La prova del telefono in 4G l'ha fatta la linea di Daniele**: l'IP del PC è cambiato a metà prova (109.118.72.129 → 109.118.64.235, connessione caduta), il vecchio era a 20 e il nuovo è passato: il limite è per IP e non globale. Gli 8,2 s per 429 misurati nella raffica erano la linea in quel momento: a rete normale un ramo che fa *più* lavoro del 429 costa 0,8-1,5 s con 509 KB di upload. — **Prova sullo staging**: `prova-abuso.py` (nuovo), `prova-invio.py` che azzera i contatori all'inizio, la prova dal telefono in 4G.
4. [x] **Fatto, 25/09/2026**: 1.8.0 in produzione, diagnostica verde col nuovo IP, limiti 3/20/86400 attivi, endpoint vivo (400 a un invio rotto), nessun disegno mandato. — **Produzione**: installazione, diagnostica rilanciata. Niente invii di prova lì (regola del piano): il limite in produzione si considera provato dal codice identico allo staging più l'IP giusto.
5. [x] README del plugin, `stato.md`, `CLAUDE.md`, commit e push.

Rischi aperti:
- **La produzione sta dietro la CDN di SiteGround, lo staging no** (misurato il 25/09/2026: produzione `X-SG-CDN: 1` e 4 IP anycast Google; staging un IP solo, niente CDN). Lo staging non prova niente sull'IP: da qui il passo 1. Se servisse leggere `X-Forwarded-For`, lo si legge **solo** quando `REMOTE_ADDR` è della CDN e se ne prende l'elemento aggiunto dalla CDN, **mai il primo**, che lo scrive chi manda. Altrimenti il limite si aggira con un'intestazione.
- **Honeypot tolto** (era nel passo 4 approvato il 23/09/2026): la richiesta la costruisce il JavaScript, non c'è un modulo HTML da riempire. I bot che cadono nei honeypot sono quelli che compilano moduli, e qui non arrivano. Chi copia la richiesta con «Copy as cURL» il campo lo trova già vuoto. Non prenderebbe nessuno.
- **«Prima di leggere il corpo» in PHP non si può**: quando parte il codice del plugin il multipart è già letto. Si fa il possibile, cioè il limite prima di decodificare il JSON e prima di GD; il resto lo fa `post_max_size` del server, misurato al passo 1.
- **Un'immagine estranea con le misure giuste passa**, oggi e dopo: il criterio del piano del 23/09/2026 («immagine estranea fallisce») vale solo per le misure sbagliate. La difesa è la moderazione (non va mai in galleria) più il limite (al massimo 20 al giorno da un IP). Resta però nella mail di notifica.
- Transient espulsi dalla cache a oggetti (Memcached di Speed Optimizer) → il limite si azzera prima delle 24 ore. Richieste in parallelo → qualche invio oltre il limite. Accettabili tutti e due.
- **Privacy**: un'impronta dell'IP (HMAC, non reversibile senza il salt) resta 24 ore in un transient, **mai nei meta del disegno**. Va scritto nel testo del passo 6.
- Ogni esecuzione di `prova-abuso.py` manda ~20 email all'`admin_email` dello staging.
- Un tablet usato da tre fratelli: 3 disegni in tutto. Deciso così (Daniele, 25/09/2026).

Costo stimato: 5 passi, due versioni del plugin (la 1.7.1 esiste solo per la diagnostica, ed è il prezzo della CDN), mezza sessione. Proporzionato.

### Sotto-piano del passo 8 — il Custom Marquee si aggiorna da solo (CHIUSO 24/09/2026)
Obiettivo: un disegno approvato compare nella striscia senza che nessuno la modifichi a mano, e il marquee già in uso (`/chi-siamo/`) non cambia.

Criterio di finito (staging, misurato con script e Playwright):
- pagina di prova con marquee in sorgente «Disegni della Lavagna»: mostra solo i disegni approvati, al massimo N, dal più vecchio al più nuovo;
- approvo un disegno → c'è al ricaricamento; lo rifiuto o lo tolgo dalla pubblicazione → sparisce;
- con 1 disegno la striscia è piena a 1920 px (un giro ≥ larghezza del track, nessun buco);
- velocità misurata = valore impostato in px/s ±5%, con 3 disegni e con N;
- nessun disegno servito all'originale (src = misura intermedia), peso della pagina misurato e riportato;
- `/chi-siamo/`: HTML del widget identico byte per byte a prima (con il passo 2: diverso solo nel CSS, scatto al giro da 11,9 a 0 px);
- test PHP e `node test/run.js` verdi.

Fuori perimetro: installazione in produzione di entrambi i plugin (decisione di Daniele, dopo la prova: tocca `/chi-siamo/` del sito ufficiale) · lightbox, pagina a griglia · nascondere il widget a zero disegni (oggi non stampa niente) · didascalie · anti-abuso (passo 4, subito dopo) · caricamento differito delle immagini.

Architettura scelta: **il marquee resta generico e la Lavagna gli fornisce una sorgente**, con due filtri (`custom_marquee/sorgenti`, `custom_marquee/immagini`). Scartato il *dynamic tag* di Elementor, più elegante: sullo staging Elementor Pro ha la licenza non valida e la parte editor non si potrebbe nemmeno provare; e le modifiche al marquee servirebbero comunque. Il marquee non sa niente di disegni: se la Lavagna viene disattivata, la sorgente sparisce e il widget non stampa niente.

Passi:
1. [x] **Il marquee entra nel repo così com'è** (`plugin/custom-marquee/`, dallo zip in Download), poi intestazione con Version e Author «Issimissimo». `pacchetto.py` e `installa-staging.py` imparano a costruirlo e installarlo. Prova: si fotografa l'HTML di `/chi-siamo/` PRIMA, si reinstalla, si confronta → identico. Conferma anche che lo zip scaricato è quello dello staging.
2. [x] **Scatto di mezzo gap al giro** (1.1.0: 11,9 → 0 px a 1920 e 390; CSS rigenerato da solo al cambio di versione): difetto già presente, misurato 11,9 px su `/chi-siamo/`. Una riga (`padding-right` pari al gap) + svuotamento del CSS di Elementor al cambio di versione, senza il quale la correzione resta invisibile. Prova: scatto 0 px, resto dell'HTML identico.
3. [x] **Marquee: la sorgente** (1.2.0, 17 test; `/chi-siamo/` identico a HTML e CSS rigenerato). Controllo «Sorgente» (default «Immagini scelte a mano»: le istanze esistenti non cambiano). Per le sorgenti esterne: massimo N (default 20), misura dell'immagine (default `large`, non l'originale fino a 2 MB), ripetizione fino a riempire ~3840 px, velocità in px/s calcolata in PHP sulle misure desktop. Prova: test PHP sulle funzioni pure (ripetizione, durata); `/chi-siamo/` identico.
4. [x] **Lavagna: la sorgente** (1.7.0, 9 test; purge con `sg_cachepress_purge_cache()`, non `_everything`, che svuota anche memcached e gli asset). Registra «Disegni della Lavagna»: ultimi N **per data di approvazione** (meta scritto su `transition_post_status`, fallback su `post_date` per i già approvati), mostrati dal più vecchio al più nuovo; solo `publish`. A ogni ingresso/uscita da `publish` svuota la cache di Speed Optimizer, se esiste. Prova: test PHP su selezione e ordine.
5. [x] **Prova sullo staging** — pagina `/playground/` (Daniele, 24/09/2026: «funziona tutto», anche il pannello). Fatto: ordine per approvazione, in attesa mai visibile, il tolto sparisce, mai l'originale (trovato e corretto in 1.2.1), 60,00 px/s reali su 60, giro 3904 px su track 1905, scatto 0, 106 KB per 4 disegni. Tetto 3 verificato dopo, 5/5 (ultimi tre approvati, 11653 approvato da Daniele). Disegni di prova rimasti: 11649, 11651 pubblicati, 11653 in attesa (`prova-galleria.py pulisci`). — `python .lavoro/prova-galleria.py prova <url> <max>`: pagina di prova col marquee (la crea Daniele nell'editor: è anche la prova che il flusso si capisce), 4-5 disegni di prova inviati e approvati da script, N messo a 3 per provare il tetto. Script ripetibile `prova-galleria.py` + misure Playwright. Criterio di finito punto per punto.
6. [x] README dei due plugin e `CLAUDE.md`, push. **Produzione** (Daniele, 24/09/2026): marquee 1.2.1 e Lavagna 1.7.0 installati; `/chi-siamo/` HTML identico, CSS diverso solo per il `padding-right` (le regole lì stanno nel CSS combinato di Speed Optimizer), scatto 0 px misurato, fogli tutti 200, cache svuotata da Speed Optimizer all'aggiornamento; endpoint vivo (richiesta invalida → 400, nessuna scrittura).

Rischi aperti:
- **Il purge di Speed Optimizer non si può provare sullo staging** (lì è spento): **si verifica in produzione** (Daniele, 24/09/2026). Senza purge, in produzione un disegno approvato compare quando scade la cache di pagina.
- Lo zip in Download è quello dello staging (verificato al passo 1) e, per Daniele, anche quello di produzione.
- Velocità e riempimento sono calcolati sui valori desktop: su tablet/mobile, con misure diverse, i px/s cambiano in proporzione, come oggi con i secondi.
- Ogni disegno di prova manda un'email all'`admin_email` dello staging (4-5 email).
- Il marquee carica tutte le immagini subito e a priorità alta (scelta originale, contro gli scatti di layout): con 20 disegni in `large` il peso va misurato, non stimato.
- **Scostamento da D3, dichiarato**: la striscia legge i `frmm_disegno` pubblicati, non la Libreria media. La garanzia resta (solo `publish` = solo approvati) e migliora: un disegno tolto dalla pubblicazione sparisce da solo.
- ~~Il passo 4 resta aperto~~ — chiuso il 25/09/2026.

Costo stimato: 6 passi (5 senza il 2), una sessione piena. Proporzionato: tre dei sei passi esistono perché una lista che cresce da sola rompe velocità, riempimento e peso, non per abbellire.

Rischi: **l'endpoint in produzione è aperto senza testi per i genitori** finché non si chiude il passo 6 (il 4, rate limit, è in produzione dal 25/09/2026) · il nome casuale rende l'URL non indovinabile, non segreto · SiteGround Optimizer, se sposta gli script inline, riaprirebbe la corsa di `altezza="schermo"` · i testi legali sono una dipendenza esterna · le prove d'invio non vanno fatte in produzione: ogni disegno di prova resta nella bacheca del sito ufficiale.

## Decisioni prese e perché
- **Plugin installato in produzione con l'invio acceso** (Daniele, 23/09/2026), contro il consiglio di Claude, che proponeva un interruttore per tenerlo spento fino ai passi 4-6. Aggiornamenti: `installa-staging.py <v> --produzione`.
- **La domanda d'invio sta PRIMA di salvare** (Daniele, dopo la prova della 1.4.1): chi condivide su WhatsApp non torna nel browser a rispondere. Il tocco sulla risposta dà l'attivazione al foglio di condivisione.
- **Invio in parallelo alla condivisione, con ripresa** (strada B, Daniele): aspettare l'upload prima di condividere non si può (Safari rifiuta `navigator.share` dopo un'attesa di rete). Si riprova al ritorno nel browser, al ritorno della rete e a tempo. La colonna Tentativo dice se basta; se no, strada A (un tocco in più).
- **`invio_id` uguale a ogni tentativo**: la ripresa di un invio arrivato con la risposta persa non crea doppioni né seconde email.
- **Opacità del tratto 0.35** (cliente → Daniele, prima 0.80; Claude consigliava 0.50). Non scala in proporzione. Prezzi scritti sopra `CHALK_ALPHA`; se torna «tratti sottili», la causa è questa, non `PRESSURE_*`.
- **SOLO SALVA bianco su trasparente, tasti impilati sotto 480px**: il no dev'essere disponibile quanto il sì; affiancati, a 390px andavano a capo.
- **Immagine ricodificata con GD, non copiata**: un JPEG con del PHP in coda passa ogni controllo sui byte.
- **CPT `frmm_disegno`**, non `disegno`: i tipi WP condividono un solo spazio di nomi. Non pubblico e non in REST; approvato = pubblicato ma senza pagina.
- **I non approvati fuori dalla Libreria media**, l'approvato dentro (la galleria dovrà prenderlo, D3).
- **Email con miniatura incorporata (`cid:`)**, non linkata: le immagini remote vengono bloccate.
- **Endpoint anonimo senza nonce**: per un anonimo il nonce è uguale per tutti, e la pagina in cache lo servirebbe scaduto.
- **Endpoint passato dallo shortcode in `?invio=`, accettato solo same-origin**: fuori da WordPress niente domanda.
- **`client_id` in `frmm-lavagna:client_id`, senza percorso**: identifica il dispositivo; la Fase 5 lo leggerà da lì.
- **Iframe, non inline; senza `sandbox`**: la viewport è il Container, e un sandbox spegnerebbe il download.
- **Cache buster in query string, non nel percorso**: il «già visto» del tutorial ha il percorso nella chiave.
- **Spessore/velocità chiuso (17/09/2026)**: `PRESSURE_MIN 0.84`, `PRESSURE_ALPHA_MIN 0.85`. Non si ritara.
- **Rifai tolto** (cliente): annulla è irreversibile. **Arancione solo nel tutorial**, regole sull'id.
- **Nessun nickname, disegni anonimi.** Il `nickname?` del brief non va implementato.
- **Fondo lavagna nel CSS, canvas trasparente; a fine gesto si travasano i pixel, non si ridisegna.**
- **Font della Fondazione e credenziali fuori dal repo**, che è pubblico.

## Trappole
- **SiteGround serve i `.js` con un anno di cache**: `pacchetto.py` mette `?v=` su ogni import dello zip e rifiuta di costruire se ne manca uno. Un modulo nuovo che importa da uno vecchio non apre la lavagna, e solo a chi c'era già stato.
- **`drawing.board.h` deve seguire `unfreezeBoardHeight()`**: `adattaLavagna()` in `model.js`, altrimenti l'immagine salvata ha le misure del primo layout.
- **Chrome Android ≠ Chrome desktop ≠ Safari**: ciò che non si riproduce sulla propria macchina non è per questo risolto.
- **Lo `<script>` di `altezza="schermo"` esce DOPO il `<div>` e gira subito**; il `rect` del canvas si rilegge a ogni `pointerdown`.
- **Header del sito `position: fixed`** nella pagina della lavagna: `margin-top` al Container 55px sopra 1200, 65px da 1024 in giù, su tutti e tre i dispositivi. `dvh`, non `vh`.
- **La barra admin (46px) la vede solo chi è collegato**; nell'editor Elementor la misura non è attendibile.
- **Elementor Pro sullo staging ha la licenza non valida**: guardare quello prima di indagare.
- **Nell'HTML della bacheca WordPress usa virgolette singole** (`class='pending'`, `href='edit.php...'`): le regex degli script di prova devono accettarle entrambe.
- **Playwright MCP non ha `require`, `setTimeout` né accesso ai file fuori dal progetto**, e `route.fetch` non raggiunge il server locale. Il login allo staging si fa dagli script Python, che leggono da sé le credenziali: copiarle in uno script Playwright è bloccato, ed è giusto così.
- **PHP non è installato sul PC**: per lint e test serve un PHP portatile (windows.php.net, zip NTS x64, `-d extension=gd`).
- **`localStorage` è per origine**: ogni stato ricordato porta `location.pathname` nella chiave (tranne `client_id`, voluto).
- **FTP**: credenziali che aprono tutto l'account; solo `temp/frmm-drawing-plugin*`, con un listing prima. `--ftp-ssl-control` voluto. Online `frmm`, repo `frrm`: non correggere.
- **`.lavoro/` non è gitignorata e il repo è pubblico**: niente credenziali lì.
- **Il token GitHub e la password dello staging sono passati in chiaro** in transcript: da ruotare entrambi.
- **Vicoli ciechi**: aspetto del timbro legato alla posizione; più smoothing con `minCutoff`/`beta`.
- Il `.md` del brief ha il markdown escapato: voluto.

- **PHP non è installato su questa macchina.** I test PHP girano con la copia rimasta nella scratchpad di una sessione precedente (`%LOCALAPPDATA%\Temp\claude\e--Claude-Workspace-frrm-drawing-plugin3a19454-...\scratchpad\php\php.exe`, PHP 8.3), cartella temporanea che può sparire. Per GD serve anche `-d extension_dir=<quella cartella>\ext`, altrimenti cerca in `C:\php\ext` e salta i test sui JPEG.

## Prossimo passo
Passo 8 chiuso e in produzione. **Da verificare in produzione quando ci sarà la pagina della galleria**: approvato un disegno, da anonimo e senza query string deve comparire al primo ricaricamento (è il purge di Speed Optimizer, non provabile sullo staging). Sullo staging restano i disegni di prova 11649, 11651, 11653 pubblicati su `/playground/` (`python .lavoro/prova-galleria.py pulisci` li toglie). **Passo 4 chiuso il 25/09/2026, passo 5 il 26/09/2026** (1.9.0 su staging e produzione). **Approva/Rifiuta dalla mail: 1.10.0 sullo staging, manca solo la prova di Daniele dal telefono** (mail dei disegni 11734 e 11736). **Prima della produzione**: impostare il destinatario del cliente, e riprovare il link da telefono in produzione, perché lì c'è la CDN e il firewall di SiteGround filtra `/wp-admin/` per user agent. Il 6 è sospeso. Da fare quando Daniele vuole: un SALVA E INVIA dal telefono sullo staging, per vedere il flusso vero con la 1.8.0 (l'app non è cambiata, il server sì). Poi, nell'ordine del piano: passo 5 (retention) e 6 (testi per i genitori, che devono dire anche dell'impronta dell'IP tenuta 24 ore).

**Proposta in attesa, dopo il passo 4 — Approva/Rifiuta dalla mail** (discussa il 25/09/2026, non decisa). Fattibile, ma non con i link della bacheca: il loro nonce nascerebbe nella richiesta anonima del bambino (utente 0) e richiede il login. Serve un link firmato (HMAC, per disegno e per azione, con scadenza) verso un endpoint pubblico. **Il link NON deve eseguire l'azione con un GET**: gli scanner di posta (Safe Links, gateway antispam, anteprime) aprono i link da soli e approverebbero e rifiuterebbero senza che nessuno guardi — apre una pagina col disegno a grandezza piena e un pulsante che fa POST. Da dichiarare: chi ha la mail modera (inoltro, casella condivisa), salta il controllo per ruolo di PublishPress, l'azione va registrata come «via email» perché non c'è un utente. Variante: dopo l'azione la pagina propone il disegno successivo in attesa (ma allora un link vale per tutta la coda).
