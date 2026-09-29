# Stato — Lavagna (FRRM - Drawing plugin)
Ultimo aggiornamento: 30/09/2026
Versione corrente: `frmm-lavagna` **1.13.0 su staging** (gessetto nero, mensola a due righe fra 701 e 1099px), **1.12.0 in produzione** (rate limit tolto, 28/09/2026); `custom-marquee` **1.2.1** su entrambi. Prototipo online: `temp/frmm-drawing-plugin-20/` (main), **`-22/` col gesso nuovo (branch `gesso-realistico`)**. Stato approvato dal cliente: tag `approvato-cliente-25092026` (su `0d6df7c`), zip in `.lavoro/dist/approvato-cliente-25092026/` (solo locale: contengono i font commerciali).

## Dove siamo
In produzione: la lavagna salva e manda il disegno; arriva in bacheca; la mail di notifica ha un link a una pagina con Approva / Rifiuta, senza login; la galleria (Custom Marquee) mostra gli approvati. Ci sono rate limit (3 per dispositivo, 20 per IP in 24 ore) e retention; **il rate limit è tolto nella 1.12.0, anche in produzione dal 28/09/2026** (sotto). La mail in produzione va ancora ad `admin_email` (`d.suppo@issimissimo.com`): l'impostazione «Notifiche dei disegni» è vuota.

## Piano attivo — Fasi 6, 7, 9, 10 (approvato 23/09/2026)
Criterio di finito (staging): dal telefono SALVA E INVIA → in bacheca ✅ · email ✅ · moderazione ✅ (bacheca e mail) · approvato in galleria, rifiutato mai e sparisce dal server immagine compresa ✅ · abuso respinto ✅ (**poi tolto**, 1.12.0, cliente) · nessuna immagine in attesa a URL indovinabile ✅ · **bozze legali consegnate ✗ (passo 6, sospeso da Daniele)**.

1-5, 7-8. [x] Endpoint, invio dall'app, bacheca ed email, anti-abuso, retention, galleria.
6. [ ] **Sospeso** (Daniele, 26/09/2026): bozze legali per i genitori. Devono dire che SALVA E INVIA manda il disegno alla Fondazione. **Dalla 1.12.0 non c'è più da dire che un'impronta dell'IP resta 24 ore**: senza rate limit non si conserva niente dell'IP.
9. [ ] QA su device veri, flusso intero, **in produzione**: un disegno vero dal telefono → mail → link → Approva → galleria (compreso il purge di Speed Optimizer).
- [x] Fuori piano, chiesto da Daniele: moderazione dalla mail (1.10.0 → 1.11.5), in produzione dal 26/09/2026.
- [x] Fuori piano, cliente 28/09/2026: **gessetto nero** (1.13.0, solo staging; produzione dopo la prova di Daniele).
- [x] **La mensola fra 701 e 1099px è su due righe** (1.13.0): era aperto dal 26/09/2026, e il nero lo peggiorava.

## Fronte aperto — gesso realistico (branch `gesso-realistico`, 29–30/09/2026)
Chiesto da Daniele: riaprire l'effetto gessetto per un upgrade estetico. **Solo prototipi su FTP, niente produzione.** Codice in `prototipo/src/gesso.js`, spiegazione nel README del prototipo.
Criterio di finito: confronto affiancato vecchio/nuovo (`confronto-gesso.html`) ✅ · larghezza percepita pari al vecchio ✅ (24 px contro 25) · **60 fps su iPhone 13 e Galaxy S10 ✗ (da provare, Daniele)** · **il cliente vede la differenza ✗**. Se non la vede, si chiude lì e il branch resta com'è.
- **-21** (29/09): primo giro, grana ancorata alla lavagna e opacità 95%. Daniele: tratto più nitido e grana visibile ✓, ma grana «troppo uniforme e grossolana» e **tratto troppo opaco**: senza pressione, il bambino deve poter ripassare per fare il pieno e mescolare i colori. Riferimento scelto da lui: foto dreamstime 189200205 («I ♥ School»).
- **-22** (30/09): punta trascinata con filamenti, trama finissima spostata per ogni tratto, una passata al 70%.
- **Da decidere (Daniele/cliente)**: sul gesto veloce il nuovo si fa più rado ma non più stretto (larghezza −8% contro −28% del vecchio, inchiostro −29% come prima). Tocca il fronte spessore/velocità chiuso il 17/09: non ritarato di nascosto.
- Da provare su device: `-22/?debug=1`, FPS TRATTO su un tratto lungo e grosso; confronto sullo stesso telefono con `?gesso=vecchio`. Memoria: tre canvas d'appoggio grandi quanto la lavagna (~14 MB a DPR 2 su telefono).
- Prima di unire a main: cambia l'aspetto approvato dal cliente. E la galleria mescolerebbe disegni vecchi e nuovi, perché le immagini approvate non si rigenerano (e 11973/11975 non hanno un Drawing vero).
- Scartati, per non ripercorrerli: **grana ancorata alla lavagna** (ripassare non riempie i buchi); **grana nell'impronta tonda** (si media via, pastello); **solo moltiplicazione deposito × cresta** (resta l'alone: serve la soglia vera); **guadagno alto col deposito basso** (grana a due toni, «mimetica»); **velo ≥ 0,3** (alone grigio); **striature come linee tracciate sopra il deposito, e solchi in `destination-out`** (fili tirati, graffi negli scarabocchi); **impronte più strette per le striature** (il doppio dei timbri, striature invisibili); **filamento medio a 3,2 unità** (binari); **una striscia per passo nelle curve strette** (pettine alle inversioni); **opacità 95%** (niente ripassate).

## Decisioni prese e perché
- **Produzione con l'invio acceso dal 23/09/2026** (Daniele), contro il consiglio di un interruttore spento fino ai passi 4-6.
- **Domanda d'invio PRIMA di salvare; invio in parallelo alla condivisione con ripresa; `invio_id` fisso per tentativo**: Safari rifiuta `navigator.share` dopo un'attesa, e chi va su WhatsApp non torna a rispondere.
- **Endpoint anonimo senza nonce**: per un anonimo il nonce è uguale per tutti e la cache lo servirebbe scaduto. La difesa erano i limiti.
- **Rate limit TOLTO nella 1.12.0 (28/09/2026), su richiesta esplicita del cliente**, contro il consiglio di tenere almeno un tetto per IP (proposto: niente limite per dispositivo, 100 per IP). Da allora l'endpoint non ha tetto: un ciclo di invii è un ciclo di post, JPEG e **mail**. Per rimetterlo: tag `rate-limit-1.11.5`; se per IP, **solo `REMOTE_ADDR`** (sullo staging `X-Forwarded-For` lo scrive il client). Regole nel README del plugin.
- **Honeypot tolto; un'immagine estranea con le misure giuste passa**: la difesa è la moderazione più il limite.
- **Retention in `disegni.php`, non in `bacheca.php`**: lo svuotamento automatico gira nel cron, dove `bacheca.php` non c'è.
- **Moderazione dalla mail: aprire il link non agisce mai, agisce solo il pulsante in POST** (scanner di posta; motivi in cima a `moderazione-mail.php`). Link firmato, 7 giorni, un disegno per link, niente ri-moderazione dalla pagina. Destinatario in un'impostazione a sé, non `admin_email`. Mail senza miniatura né link alla bacheca. Mittente col nome del sito, oggetto senza (26/09/2026).
- **Pagina di moderazione**: titolo con lo stato («Nuovo disegno» / «Disegno approvato» / «Disegno rifiutato»); tasti copiati dal kit Elementor del sito; **Rifiuta senza bordo per decisione di Daniele**, contro l'obiezione che fa pesare meno il tasto prudente (registrata nel codice). Il design Nunito (<https://claude.ai/artifact/QZApsX3hLAqZtKDwwbsQoN>) è superato: la pagina segue il sito.
- **`drop-shadow`, `random-tilt` e i tasti della pagina sono copie** del sito: se il sito cambia, qui restano com'erano.
- **Il nero è nero (#050506), non il colore della lavagna** come chiesto all'inizio (28/09/2026): provato, #1F2225 sul fondo vuoto non lascia segno e sopra i colori appena un graffio. Sta dopo il bianco. Su telefono la stecca passa da 22 a 20px (a 360 restano ~6px fra le stecche). Col nero in mano i segni degli spessori prendono un bordo (`scuro` in `palette.js`).
- **Opacità del tratto 0.35** (cliente); se torna «tratti sottili», la causa è questa, non `PRESSURE_*`. **Spessore/velocità chiuso** il 17/09/2026.
- **Iframe, non inline, senza `sandbox`; cache buster in query string, non nel percorso** (il tutorial ha il percorso nella chiave).
- **Disegni anonimi, niente nickname. CPT `frmm_disegno`**, non pubblico, non in REST.

## Trappole
- **Due disegni in produzione hanno un Drawing finto**: post **11973 e 11975** (28/09/2026), respinti a suo tempo dal rate limit e caricati a mano dall'endpoint partendo da ritagli JPEG 1128x1280 ingranditi a 1600. Il loro `_frmm_disegno` è un segnaposto (un punto del colore del fondo): oggi non lo legge nessuno, ma un render dai tratti (alta risoluzione) li darebbe vuoti. L'immagine è quella vera.
- **La mensola a una riga chiede ~1050px** (dieci gessetti): sotto, cancellino e gessetti si sovrappongono (38px a 1024, 242 a 820 misurati il 28/09/2026). Per questo fra 701 e 1099px va su due righe (`index.html`). Chi aggiunge un gessetto o allarga la mensola rimisuri il limite: la soglia 1099 non si sposta da sola.
- **Il `main.js` del prototipo resta in cache nel Chrome di Playwright** anche ricaricando con una query diversa: svuotare con CDP `Network.clearBrowserCache`, o si prova il codice vecchio.
- **Firefox misura una fila flex dal contenuto dei figli, non dal `flex-basis`**: per questo `.tools .chalk` ha anche `width`. Chrome non mostra il difetto.
- **Chrome/Edge headless hanno una larghezza minima di finestra ~500px**: per gli screenshot da telefono si mette la pagina in un iframe da 390. Firefox headless scatta allo `load` e usa la cache del profilo: profilo nuovo a ogni giro.
- **Il firewall di SiteGround filtra `/wp-admin/` per user agent**: `python-requests` prende 403, un browser passa. Gli script si presentano come Safari. In produzione un link falso risponde 403 «Link non valido» (verificato 26/09/2026): la pagina passa CDN e firewall.
- **I link delle mail degli script di prova non mostrano i tasti**: quei disegni li modera lo script stesso. Per provare i tasti serve un disegno lasciato in attesa.
- **`prova-mail.py` riscrive «Notifiche dei disegni» dello staging a `danielesuppo@gmail.com`**, e manda due mail vere a ogni giro.
- **`prova-bacheca.py` consuma i due disegni in attesa più vecchi**: lanciato prima di una prova di Daniele, gli brucia i disegni lasciati apposta.
- **L'IP del PC di Daniele cambia a metà prova** (FWA/mobile): da ricordare se si rimette un limite per IP.
- **Gmail butta padding e bordo sugli `<a>` e cambia i colori col tema scuro**: stili sugli `<span>`, mai sull'`<a>`.
- **SiteGround serve i `.js` con un anno di cache**: `pacchetto.py` mette `?v=` su ogni import e rifiuta di costruire se ne manca uno.
- **Chrome Android ≠ desktop ≠ Safari**; lo `<script>` di `altezza="schermo"` esce DOPO il `<div>`; il `rect` del canvas si rilegge a ogni `pointerdown`; header `fixed` → `margin-top` 55/65px su tutti e tre i dispositivi; `dvh`, non `vh`.
- **PHP non è installato sul PC**: i test usano la copia in `…\e--Claude-Workspace-frrm-drawing-plugin\63a19454…\scratchpad\php\php.exe` (`-d extension_dir=<cartella>\ext -d extension=gd`). Cartella temporanea: può sparire.
- **`.lavoro/` non è gitignorata e il repo è pubblico**: niente credenziali lì. Token GitHub e password dello staging passati in chiaro in transcript: **da ruotare**.
- **FTP**: credenziali che aprono tutto l'account; solo `temp/frmm-drawing-plugin*`. Online `frmm`, repo `frrm`: non correggere.
- Verifiche: `node prototipo/test/run.js` (76) · `php … plugin/test/validazione.php` (81) · `php plugin/test/galleria.php` (9) · `prova-invio.py` (40) · `prova-mail.py` (33, due mail) · `prova-bacheca.py` (14, consuma disegni) · `prova-abuso.py` (20 mail) · `prova-retention.py [svuota|orfani]` · `diagnostica-ip.py [--produzione]` (sola lettura).

## Prossimo passo
In produzione: un disegno vero dal telefono, la mail a `d.suppo@issimissimo.com`, Approva dal link, verificare che compaia nella galleria del sito (purge di Speed Optimizer). Solo dopo, l'indirizzo del cliente in «Notifiche dei disegni».
