# Stato — Lavagna (FRRM - Drawing plugin)
Ultimo aggiornamento: 26/09/2026
Versione corrente: `frmm-lavagna` **1.11.5 su staging e produzione** (produzione aggiornata il 26/09/2026); `custom-marquee` **1.2.1** su entrambi. Prototipo online: `temp/frmm-drawing-plugin-19/`. Stato approvato dal cliente: tag `approvato-cliente-25092026` (su `0d6df7c`), zip in `.lavoro/dist/approvato-cliente-25092026/` (solo locale: contengono i font commerciali).

## Dove siamo
In produzione: la lavagna salva e manda il disegno; arriva in bacheca; la mail di notifica ha un link a una pagina con Approva / Rifiuta, senza login; la galleria (Custom Marquee) mostra gli approvati. Ci sono rate limit (3 per dispositivo, 20 per IP in 24 ore) e retention. La mail in produzione va ancora ad `admin_email` (`d.suppo@issimissimo.com`): l'impostazione «Notifiche dei disegni» è vuota.

## Piano attivo — Fasi 6, 7, 9, 10 (approvato 23/09/2026)
Criterio di finito (staging): dal telefono SALVA E INVIA → in bacheca ✅ · email ✅ · moderazione ✅ (bacheca e mail) · approvato in galleria, rifiutato mai e sparisce dal server immagine compresa ✅ · abuso respinto ✅ · nessuna immagine in attesa a URL indovinabile ✅ · **bozze legali consegnate ✗ (passo 6, sospeso da Daniele)**.

1-5, 7-8. [x] Endpoint, invio dall'app, bacheca ed email, anti-abuso, retention, galleria.
6. [ ] **Sospeso** (Daniele, 26/09/2026): bozze legali per i genitori. Devono dire che SALVA E INVIA manda il disegno alla Fondazione, e che un'impronta dell'IP resta 24 ore.
9. [ ] QA su device veri, flusso intero, **in produzione**: un disegno vero dal telefono → mail → link → Approva → galleria (compreso il purge di Speed Optimizer).
- [x] Fuori piano, chiesto da Daniele: moderazione dalla mail (1.10.0 → 1.11.5), in produzione dal 26/09/2026.
- [ ] **Aperto, fuori piano**: la mensola non ci sta fra 701 e ~1046px (sotto).

## Decisioni prese e perché
- **Produzione con l'invio acceso dal 23/09/2026** (Daniele), contro il consiglio di un interruttore spento fino ai passi 4-6.
- **Domanda d'invio PRIMA di salvare; invio in parallelo alla condivisione con ripresa; `invio_id` fisso per tentativo**: Safari rifiuta `navigator.share` dopo un'attesa, e chi va su WhatsApp non torna a rispondere.
- **Endpoint anonimo senza nonce**: per un anonimo il nonce è uguale per tutti e la cache lo servirebbe scaduto. La difesa sono i limiti.
- **Rate limit 3 per dispositivo + 20 per IP**, **solo `REMOTE_ADDR`** (sullo staging `X-Forwarded-For` lo scrive il client). Chi cambia rete non è coperto, per scelta.
- **Honeypot tolto; un'immagine estranea con le misure giuste passa**: la difesa è la moderazione più il limite.
- **Retention in `disegni.php`, non in `bacheca.php`**: lo svuotamento automatico gira nel cron, dove `bacheca.php` non c'è.
- **Moderazione dalla mail: aprire il link non agisce mai, agisce solo il pulsante in POST** (scanner di posta; motivi in cima a `moderazione-mail.php`). Link firmato, 7 giorni, un disegno per link, niente ri-moderazione dalla pagina. Destinatario in un'impostazione a sé, non `admin_email`. Mail senza miniatura né link alla bacheca. Mittente col nome del sito, oggetto senza (26/09/2026).
- **Pagina di moderazione**: titolo con lo stato («Nuovo disegno» / «Disegno approvato» / «Disegno rifiutato»); tasti copiati dal kit Elementor del sito; **Rifiuta senza bordo per decisione di Daniele**, contro l'obiezione che fa pesare meno il tasto prudente (registrata nel codice). Il design Nunito (<https://claude.ai/artifact/QZApsX3hLAqZtKDwwbsQoN>) è superato: la pagina segue il sito.
- **`drop-shadow`, `random-tilt` e i tasti della pagina sono copie** del sito: se il sito cambia, qui restano com'erano.
- **Opacità del tratto 0.35** (cliente); se torna «tratti sottili», la causa è questa, non `PRESSURE_*`. **Spessore/velocità chiuso** il 17/09/2026.
- **Iframe, non inline, senza `sandbox`; cache buster in query string, non nel percorso** (il tutorial ha il percorso nella chiave).
- **Disegni anonimi, niente nickname. CPT `frmm_disegno`**, non pubblico, non in REST.

## Trappole
- **La mensola non ci sta fra 701 e ~1046px, in tutti i browser**: il layout desktop chiede ~1046px; a 1024 gessetti e cancellino si toccano, a 820 (iPad verticale) si sovrappongono. Strade: mensola su due righe in quella fascia (solo CSS, preferita) o soglia mobile più alta (è la stessa `SOGLIA_STRETTA` che sceglie la misura del logo).
- **Firefox misura una fila flex dal contenuto dei figli, non dal `flex-basis`**: per questo `.tools .chalk` ha anche `width`. Chrome non mostra il difetto.
- **Chrome/Edge headless hanno una larghezza minima di finestra ~500px**: per gli screenshot da telefono si mette la pagina in un iframe da 390. Firefox headless scatta allo `load` e usa la cache del profilo: profilo nuovo a ogni giro.
- **Il firewall di SiteGround filtra `/wp-admin/` per user agent**: `python-requests` prende 403, un browser passa. Gli script si presentano come Safari. In produzione un link falso risponde 403 «Link non valido» (verificato 26/09/2026): la pagina passa CDN e firewall.
- **I link delle mail degli script di prova non mostrano i tasti**: quei disegni li modera lo script stesso. Per provare i tasti serve un disegno lasciato in attesa.
- **`prova-mail.py` riscrive «Notifiche dei disegni» dello staging a `danielesuppo@gmail.com`**, e manda due mail vere a ogni giro.
- **`prova-bacheca.py` consuma i due disegni in attesa più vecchi**: lanciato prima di una prova di Daniele, gli brucia i disegni lasciati apposta.
- **L'IP del PC di Daniele cambia a metà prova** (FWA/mobile): la raffica di `prova-abuso.py` usa il limite del dispositivo per questo.
- **Gmail butta padding e bordo sugli `<a>` e cambia i colori col tema scuro**: stili sugli `<span>`, mai sull'`<a>`.
- **SiteGround serve i `.js` con un anno di cache**: `pacchetto.py` mette `?v=` su ogni import e rifiuta di costruire se ne manca uno.
- **Chrome Android ≠ desktop ≠ Safari**; lo `<script>` di `altezza="schermo"` esce DOPO il `<div>`; il `rect` del canvas si rilegge a ogni `pointerdown`; header `fixed` → `margin-top` 55/65px su tutti e tre i dispositivi; `dvh`, non `vh`.
- **PHP non è installato sul PC**: i test usano la copia in `…\e--Claude-Workspace-frrm-drawing-plugin\63a19454…\scratchpad\php\php.exe` (`-d extension_dir=<cartella>\ext -d extension=gd`). Cartella temporanea: può sparire.
- **`.lavoro/` non è gitignorata e il repo è pubblico**: niente credenziali lì. Token GitHub e password dello staging passati in chiaro in transcript: **da ruotare**.
- **FTP**: credenziali che aprono tutto l'account; solo `temp/frmm-drawing-plugin*`. Online `frmm`, repo `frrm`: non correggere.
- Verifiche: `node prototipo/test/run.js` (68) · `php … plugin/test/validazione.php` (81) · `php plugin/test/galleria.php` (9) · `prova-invio.py` (40) · `prova-mail.py` (33, due mail) · `prova-bacheca.py` (14, consuma disegni) · `prova-abuso.py` (20 mail) · `prova-retention.py [svuota|orfani]` · `diagnostica-ip.py [--produzione]` (sola lettura).

## Prossimo passo
In produzione: un disegno vero dal telefono, la mail a `d.suppo@issimissimo.com`, Approva dal link, verificare che compaia nella galleria del sito (purge di Speed Optimizer). Solo dopo, l'indirizzo del cliente in «Notifiche dei disegni».
