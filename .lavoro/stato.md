# Stato — Lavagna (FRRM - Drawing plugin)
Ultimo aggiornamento: 23/09/2026
Versione corrente: plugin `frmm-lavagna` **1.2.0** (installato solo sullo staging). Il prototipo non ha numero.

## Dove siamo

La lavagna (fasi 0–4b, tutorial compreso, test con un bambino superato) vive in una pagina Elementor dello **staging** della Fondazione, via `[lavagna altezza="schermo"]` in un iframe: provata su iPhone/Safari e Android/Chrome, funziona. SALVA scarica il JPEG col logo; **non invia niente a nessuno**.
In produzione il plugin non c'è. 49 test (`node prototipo/test/run.js`), zip con `python .lavoro/pacchetto.py`.

## Piano attivo — Fasi 6, 7, 9, 10 (approvato il 23/09/2026, nessun passo iniziato)

Obiettivo: un bambino **sceglie** di mandare il disegno; arriva in bacheca, un adulto lo approva o lo rifiuta dalla miniatura, gli approvati vanno in una galleria. Tutto sullo staging.

Decisioni d'apertura: SALVA scarica e **poi chiede** «Vuoi mandarlo alla Fondazione?» (INVIA / NO GRAZIE) · **D1 chiuso**: la galleria accetta proporzioni miste · una sola risoluzione, **1600px** · niente Turnstile · niente nonce sull'endpoint anonimo · immagini in attesa con **nome casuale a 128 bit** (confermato da Daniele: non la cartella protetta).
Assunzioni non contestate, da riconfermare in una riga all'apertura: JPEG senza logo · email ad `admin_email` · rifiutati nel cestino, via dopo 30 giorni **con l'immagine** · testi legali in bozza da Claude · plugin resta `frmm-lavagna`.

Criterio di finito (sullo staging): dal telefono SALVA → finestra → INVIA → conferma per bambini, e con NO GRAZIE sul server non arriva niente · l'email arriva con la miniatura · in bacheca miniatura e Approva/Rifiuta in due click · l'approvato compare in galleria, il rifiutato mai e sparisce dal server immagine compresa · lo script di abuso (500 invii, 50 MB, non-immagine, immagine estranea, JSON rotto) fallisce tutto · nessuna immagine in attesa a un URL indovinabile · bozze legali consegnate.

Fuori perimetro: go-live in produzione · Fase 5 (unica eccezione: il `client_id`, scritto con la chiave che userà la 5) · alta risoluzione · Turnstile · nickname · approvazione dei testi legali (è della Fondazione).

Passi:
1. [ ] Endpoint senza l'app: `includes/`, CPT `disegno` pending, `POST /wp-json/frmm-lavagna/v1/invio` con validazione (MIME dai byte, dimensioni, struttura JSON), allegato con nome casuale. Provato con uno script dal PC.
2. [ ] Invio dall'app: `client_id`, export 1600 senza logo, finestra dopo SALVA, conferma ed errore per bambini, URL dell'endpoint passato dallo shortcode all'iframe. Richiede solo se il disegno è cambiato. Provato dal telefono.
3. [ ] Bacheca: colonna miniatura, Approva/Rifiuta, email con miniatura.
4. [ ] Anti-abuso con script ripetibile: rate limit per IP **in hash** e per `client_id`, limiti prima di leggere il corpo, honeypot.
5. [ ] Retention: Rifiuta = cestino, 30 giorni, hook che cancella l'allegato.
6. [ ] Bozze legali: sezione privacy policy + due righe della finestra di invio, per un genitore.
7. [ ] **Fermata**: masonry, custom marquee o altro? Senza risposta la Fase 10 non parte.
8. [ ] Galleria sullo staging, solo approvati, senza leggere l'inbox (D3).
9. [ ] QA su device veri, flusso intero.

Rischi: il nome casuale rende l'URL non indovinabile, non segreto · l'email dallo staging può non partire · il plugin di sicurezza di SiteGround può bloccare i POST REST anonimi (si scopre al passo 1) · SiteGround Optimizer, se sposta o differisce gli script inline, riaprirebbe la corsa di `altezza="schermo"` · i rifiutati occupano la Media Library per 30 giorni · i testi legali sono una dipendenza esterna.

## Decisioni prese e perché

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

**Passo 1 del piano: l'endpoint `POST /wp-json/frmm-lavagna/v1/invio` sullo staging, provato con uno script dal PC prima di toccare l'app** — dopo aver riconfermato in una riga le cinque assunzioni.
