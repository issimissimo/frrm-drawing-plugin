# Stato — Lavagna (FRRM - Drawing plugin)
Ultimo aggiornamento: 26/09/2026
Versione corrente: `frmm-lavagna` **1.11.4 sullo staging**, **1.9.0 in produzione**; `custom-marquee` **1.2.1** su entrambi. Prototipo online: `temp/frmm-drawing-plugin-18/`. Stato approvato dal cliente: tag `approvato-cliente-25092026` (su `0d6df7c`), zip in `.lavoro/dist/approvato-cliente-25092026/` (solo locale: contengono i font commerciali).

## Dove siamo
La lavagna salva e, con «SALVA E INVIA», manda il disegno; arriva in bacheca e la galleria (Custom Marquee) mostra gli approvati. **In produzione** (1.9.0) ci sono anche il rate limit (3 per dispositivo, 20 per IP in 24 ore) e la retention (un disegno eliminato si porta via la sua immagine). **Sullo staging** (1.11.4) la mail di notifica ha un link che apre una pagina con Approva / Rifiuta, senza login: provato da Daniele dal telefono il 26/09/2026 (11765 approvato e in galleria, 11755 e 11768 rifiutati, tutti «via email»).

## Piano attivo — Fasi 6, 7, 9, 10 (approvato 23/09/2026)
Criterio di finito (staging): dal telefono SALVA E INVIA → in bacheca ✅ · email ✅ · moderazione ✅ (bacheca e mail) · approvato in galleria, rifiutato mai e sparisce dal server immagine compresa ✅ · abuso respinto ✅ (con due scostamenti, sotto) · nessuna immagine in attesa a URL indovinabile ✅ · **bozze legali consegnate ✗ (passo 6, sospeso da Daniele)**.

1. [x] Endpoint (1.3.0) · 2. [x] Invio dall'app (1.5.1) · 3. [x] Bacheca ed email (1.6.0)
4. [x] Anti-abuso (1.8.0, staging e produzione, 25/09/2026)
5. [x] Retention (1.9.0, staging e produzione, 26/09/2026)
6. [ ] **Sospeso** (Daniele, 26/09/2026): bozze legali per i genitori. Devono dire che SALVA E INVIA manda il disegno alla Fondazione, e che un'impronta dell'IP resta 24 ore.
7-8. [x] Galleria nel Custom Marquee (1.7.0, produzione 24/09/2026)
9. [ ] QA su device veri, flusso intero.
- **Fuori dal piano, chiesto da Daniele**: moderazione dalla mail (1.10.0 → 1.11.4, **solo staging**). Fatto e provato. La 1.11.3 (26/09/2026) toglie «[nome del sito]» dall'oggetto, intitola la pagina «Nuovo disegno», dà ai tasti lo stile di quelli del sito (copiato dal kit Elementor, valori nel commento di `frmm_lavagna_rispondi_mail()`) e toglie il fondo alla frase d'esito. La 1.11.4: il titolo dice lo stato («Disegno approvato» / «Disegno rifiutato», anche subito dopo il tasto), e Rifiuta è senza bordo — pesa meno di Approva, obiezione registrata nel codice. Il design <https://claude.ai/artifact/QZApsX3hLAqZtKDwwbsQoN> (font Nunito) resta com'era: la pagina segue il sito, non quelle tavole. **Per la produzione servono**: l'indirizzo del cliente (`b.bruschi@monaco.mc`, personale) nell'impostazione «Notifiche dei disegni», e una prova del link da telefono in produzione (CDN + firewall).

## Decisioni prese e perché
- **Produzione con l'invio acceso dal 23/09/2026** (Daniele), contro il consiglio di un interruttore spento fino ai passi 4-6.
- **Domanda d'invio PRIMA di salvare; invio in parallelo alla condivisione con ripresa; `invio_id` fisso per tentativo**: Safari rifiuta `navigator.share` dopo un'attesa, e chi va su WhatsApp non torna a rispondere.
- **Endpoint anonimo senza nonce**: per un anonimo il nonce è uguale per tutti e la cache lo servirebbe scaduto. La difesa sono i limiti.
- **Rate limit 3 per dispositivo + 20 per IP**: il `client_id` lo inventa chi manda (lo ferma solo l'IP), ma 3 per IP perderebbe i disegni di una classe. Chi cambia rete non è coperto, per scelta. **Solo `REMOTE_ADDR`**: sullo staging `X-Forwarded-For` lo scrive il client.
- **Honeypot tolto**: non c'è un modulo HTML da compilare, e chi copia la richiesta trova il campo già vuoto.
- **Un'immagine estranea con le misure giuste passa**: la difesa è la moderazione più il limite.
- **Retention in `disegni.php`, non in `bacheca.php`**: lo svuotamento automatico gira nel cron, dove `bacheca.php` non c'è. Tocca solo gli allegati in `uploads/frmm-lavagna/`.
- **Moderazione dalla mail: aprire il link non agisce mai, agisce solo il pulsante in POST.** Gli scanner di posta aprono i link dai loro server; discussi e scartati tasti diretti, doppio clic, conferma via JavaScript (motivi in cima a `moderazione-mail.php`). Aperta: misurare in produzione chi apre i link prima del cliente.
- **Link firmato, 7 giorni, un disegno per link, niente ri-moderazione dalla pagina** (errori e scaduti li gestisce Daniele dalla bacheca). **Destinatario in un'impostazione a sé**, non `admin_email`. **Mail senza miniatura** (un disegno inappropriato non finisce in nessuna casella) e senza link alla bacheca (il cliente non entra in WordPress). Mittente col nome del sito, indirizzo lasciato a WordPress (SPF).
- **`drop-shadow` e `random-tilt` nella pagina sono una copia** del codice personalizzato del sito: lì sono inline nel tema, non in un file collegabile.
- **Opacità del tratto 0.35** (cliente); se torna «tratti sottili», la causa è questa, non `PRESSURE_*`. **Spessore/velocità chiuso** il 17/09/2026: non si ritara.
- **Iframe, non inline, senza `sandbox`; cache buster in query string, non nel percorso** (il tutorial ha il percorso nella chiave).
- **Disegni anonimi, niente nickname. CPT `frmm_disegno`**, non pubblico, non in REST.

## Trappole
- **Il firewall di SiteGround filtra `/wp-admin/` per user agent**: `python-requests` prende 403, un browser passa. La pagina della mail sta lì: gli script si presentano come Safari. In produzione c'è anche la CDN: il link va provato da telefono prima di darlo al cliente.
- **`prova-bacheca.py` consuma i due disegni in attesa più vecchi**: lanciato prima di una prova di Daniele, gli brucia i disegni lasciati apposta. Già successo il 26/09/2026.
- **Da ora le mail dello staging vanno a `danielesuppo@gmail.com`** (impostazione «Notifiche dei disegni»), anche quelle degli script di prova.
- **L'IP del PC di Daniele cambia a metà prova** (FWA/mobile): la raffica di `prova-abuso.py` usa il limite del dispositivo per questo.
- **Gmail butta padding e bordo sugli `<a>` e cambia i colori col tema scuro**: stili sulle celle di tabella o sugli `<span>`, mai sull'`<a>`.
- **Il dominio della Fondazione non ha BIMI** (nessun record, DMARC `p=none`): l'icona nelle mail non dipende dal plugin.
- **SiteGround serve i `.js` con un anno di cache**: `pacchetto.py` mette `?v=` su ogni import e rifiuta di costruire se ne manca uno.
- **Chrome Android ≠ desktop ≠ Safari**; lo `<script>` di `altezza="schermo"` esce DOPO il `<div>`; il `rect` del canvas si rilegge a ogni `pointerdown`; header `fixed` → `margin-top` 55/65px su tutti e tre i dispositivi; `dvh`, non `vh`.
- **Il purge di Speed Optimizer all'approvazione si verifica solo in produzione** (sullo staging è spento): ancora da vedere.
- **PHP non è installato sul PC**: i test girano con una copia nella scratchpad della sessione `63a19454…` (`…\scratchpad\php\php.exe`, con `-d extension_dir=<quella cartella>\ext -d extension=gd`). Cartella temporanea: può sparire.
- **`.lavoro/` non è gitignorata e il repo è pubblico**: niente credenziali lì. Token GitHub e password dello staging passati in chiaro in transcript: **da ruotare**.
- **FTP**: credenziali che aprono tutto l'account; solo `temp/frmm-drawing-plugin*`. Online `frmm`, repo `frrm`: non correggere.
- Verifiche: `node prototipo/test/run.js` (68) · `php … plugin/test/validazione.php` (81) · `php plugin/test/galleria.php` (9) · `prova-invio.py` (40) · `prova-mail.py` (28) · `prova-bacheca.py` (14, consuma disegni) · `prova-abuso.py` (20 mail) · `prova-retention.py [svuota|orfani]` · `diagnostica-ip.py [--produzione]` (sola lettura).

## Prossimo passo
Leggere il design <https://claude.ai/artifact/QZApsX3hLAqZtKDwwbsQoN> così come l'ha lasciato Daniele e portarne le modifiche in `frmm_lavagna_rispondi_mail()` / `frmm_lavagna_corpo_mail()`, poi screenshot a 390px e `prova-mail.py`.
