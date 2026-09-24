# Stato — Lavagna (FRRM - Drawing plugin)
Ultimo aggiornamento: 24/09/2026
Versione corrente: plugin `frmm-lavagna` **1.7.0 sullo staging**, **1.6.2 in produzione**; `custom-marquee` **1.2.0 sullo staging**, originale in produzione (installato e attivo il 23/09/2026). Prototipo online: `temp/frmm-drawing-plugin-18/`.

## Dove siamo
Sullo staging (`/lavagna-prova-plugin/`) la lavagna salva e, se il bambino sceglie «SALVA E INVIA», manda il disegno: arriva in bacheca con miniatura, email all'admin, Approva/Rifiuta in un click. Provato sul telefono da Daniele il 23/09/2026, WhatsApp compreso. **In produzione (23/09/2026, decisione di Daniele) il plugin 1.6.1 è installato e attivo con l'invio acceso**, prima dei passi 4-6; nessuna pagina lo usa ancora. `admin_email` lì è `d.suppo@issimissimo.com`.
Verifiche: `node prototipo/test/run.js` (68) · `php -d extension=gd plugin/test/validazione.php` (48) · `python .lavoro/prova-invio.py` (40, staging) · `python .lavoro/prova-bacheca.py` (14, staging, consuma 2 disegni in attesa). Zip: `python .lavoro/pacchetto.py`; installazione: `python .lavoro/installa-staging.py`.

## Piano attivo — Fasi 6, 7, 9, 10 sullo staging (approvato 23/09/2026)
Obiettivo: un bambino **sceglie** di mandare il disegno; arriva in bacheca, un adulto lo approva o lo rifiuta dalla miniatura, gli approvati vanno in una galleria.

Criterio di finito (sullo staging): dal telefono SALVA → «SALVA E INVIA» → il disegno è in bacheca, con «SOLO SALVA» sul server non arriva niente ✅ · email con miniatura ✅ · bacheca con miniatura e Approva/Rifiuta ✅ · l'approvato compare in galleria, il rifiutato mai e sparisce dal server immagine compresa · lo script di abuso (500 invii, 50 MB, non-immagine, immagine estranea, JSON rotto) fallisce tutto · nessuna immagine in attesa a un URL indovinabile ✅ · bozze legali consegnate.

Fuori perimetro: ~~go-live in produzione~~ (fatto da Daniele il 23/09/2026, fuori piano) · Fase 5 (eccezione: `client_id`) · alta risoluzione · Turnstile · nickname · approvazione dei testi legali (della Fondazione).

1. [x] Endpoint `POST /wp-json/frmm-lavagna/v1/invio` (1.3.0).
2. [x] Invio dall'app (1.5.1): domanda PRIMA di salvare, invio in parallelo alla condivisione con ripresa, `invio_id` contro i doppioni, `tentativo` registrato.
3. [x] Bacheca ed email (1.6.0).
4. [ ] **Anti-abuso**: rate limit per IP in hash e per `client_id`, limiti prima di leggere il corpo, honeypot, script ripetibile. **Da decidere all'apertura: quanti invii al giorno per dispositivo** (brief: 3; proposta Claude: 10). Oltre il limite il bambino non vede errori.
5. [ ] Retention: cestino 30 giorni, cancellazione dell'allegato **e del file** (oggi svuotare il cestino lascia il JPEG in `uploads/frmm-lavagna/`).
6. [ ] Bozze legali per un genitore: privacy policy + testo accanto alla domanda. Devono dire che «SALVA E INVIA» manda il disegno alla Fondazione.
7. [x] **Fermata sciolta** (Daniele, 23/09/2026): la galleria è il **Custom Marquee** già presente sul sito. **Ordine dei fronti deciso da Daniele: prima la galleria, poi il 4.**
8. [ ] Galleria sullo staging, solo approvati — sotto-piano qui sotto.
9. [ ] QA su device veri, flusso intero.

### Sotto-piano del passo 8 — il Custom Marquee si aggiorna da solo (approvato 24/09/2026, passo 2 compreso)
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
5. [ ] **Prova sullo staging** — `python .lavoro/prova-galleria.py prova <url> <max>`: pagina di prova col marquee (la crea Daniele nell'editor: è anche la prova che il flusso si capisce), 4-5 disegni di prova inviati e approvati da script, N messo a 3 per provare il tetto. Script ripetibile `prova-galleria.py` + misure Playwright. Criterio di finito punto per punto.
6. [ ] README dei due plugin, decisioni in questo file, `CLAUDE.md`. Commit e push.

Rischi aperti:
- **Il purge di Speed Optimizer non si può provare sullo staging** (lì è spento): **si verifica in produzione** (Daniele, 24/09/2026). Senza purge, in produzione un disegno approvato compare quando scade la cache di pagina.
- Lo zip in Download è quello dello staging (verificato al passo 1) e, per Daniele, anche quello di produzione.
- Velocità e riempimento sono calcolati sui valori desktop: su tablet/mobile, con misure diverse, i px/s cambiano in proporzione, come oggi con i secondi.
- Ogni disegno di prova manda un'email all'`admin_email` dello staging (4-5 email).
- Il marquee carica tutte le immagini subito e a priorità alta (scelta originale, contro gli scatti di layout): con 20 disegni in `large` il peso va misurato, non stimato.
- **Scostamento da D3, dichiarato**: la striscia legge i `frmm_disegno` pubblicati, non la Libreria media. La garanzia resta (solo `publish` = solo approvati) e migliora: un disegno tolto dalla pubblicazione sparisce da solo.
- Il passo 4 resta aperto: **l'endpoint in produzione è senza rate limit** per tutta la durata di questo sotto-piano.

Costo stimato: 6 passi (5 senza il 2), una sessione piena. Proporzionato: tre dei sei passi esistono perché una lista che cresce da sola rompe velocità, riempimento e peso, non per abbellire.

Rischi: **l'endpoint in produzione è aperto senza rate limit e senza testi per i genitori** finché non si chiudono i passi 4 e 6 — per questo il 4 va fatto per primo e installato anche lì · il nome casuale rende l'URL non indovinabile, non segreto · SiteGround Optimizer, se sposta gli script inline, riaprirebbe la corsa di `altezza="schermo"` · i testi legali sono una dipendenza esterna · le prove d'invio non vanno fatte in produzione: ogni disegno di prova resta nella bacheca del sito ufficiale.

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

## Prossimo passo
Sotto-piano del passo 8: fatti 1-4 (marquee 1.2.0 e Lavagna 1.7.0 sullo staging, commit locali non pushati). Manca la pagina di prova di Daniele per il 5. Subito dopo il passo 4, anti-abuso — **urgente: l'endpoint in produzione è già aperto**. Prima di scrivere codice, far decidere a Daniele quanti invii al giorno per dispositivo; poi installarlo sullo staging **e** in produzione.
