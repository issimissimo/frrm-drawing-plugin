# FRMM Lavagna — plugin WordPress

La lavagna a gessetti della Fondazione, da mettere in una pagina con lo shortcode `[lavagna]`.

Questo file e' per chi apre la cartella fra sei mesi senza ricordarsi niente. Il progetto completo, con le undici fasi e le decisioni, sta in `lavagna-brief-progetto.md` nel repo.

## Cosa fa

Registra uno shortcode. Tutto qui.

Lo shortcode stampa un `<iframe>` che carica la web app da `app/index.html`. L'app e' JavaScript puro, senza dipendenze e senza build: quel che c'e' nella cartella e' quel che gira.

Nella pagina che ospita la lavagna **non finisce niente dell'app** — non un file JS, non un CSS, non un font. Sei righe di CSS per dimensionare l'iframe, e basta.

## Installazione

Da bacheca: **Plugin → Aggiungi nuovo → Carica plugin**, e si sceglie lo zip.

Lo zip si costruisce dal repo con:

```
python .lavoro/pacchetto.py
```

Non si zippa questa cartella a mano. Nel repo qui dentro c'e' **solo il PHP**: l'app vive in `prototipo/` e lo script ce la copia al momento. E' voluto — due copie della stessa app diventano diverse al primo fix fatto nella copia sbagliata.

⚠️ **I font non sono nel repo.** `SebinoSoft` e' un font commerciale della Fondazione e il repo e' pubblico. Stanno in `prototipo/font/`, gitignorati, e lo script di pacchetto li include se li trova **e avvisa se non li trova**. Senza, il plugin si installa, funziona e ha la tipografia sbagliata.

## Uso

Si crea una pagina, si mette un Container Elementor, gli si da' un'altezza e dentro ci va lo shortcode:

```
[lavagna]
```

**L'altezza la decide il Container**, ed e' il modo giusto. In Elementor: Container → Layout → Altezza minima → `calc(100dvh - 65px)`, dove 65px e' l'altezza dell'header.

> ⚠️ **`dvh`, non `vh`.**
>
> Su iOS Safari `100vh` e' l'altezza della finestra **a barra degli indirizzi collassata**, cioe' una sessantina di pixel piu' di quelli che si vedono davvero. Con `vh` il Container sfora, la pagina diventa scrollabile, e scrolla proprio mentre un bambino appoggia il dito vicino al bordo per disegnare. `dvh` e' l'altezza vera, momento per momento.

### Se non si vuole fare il conto a mano

```
[lavagna altezza="schermo"]
```

La lavagna si misura da sola: si prende lo spazio dal punto dove comincia fino al fondo della finestra, e si ricalcola quando la finestra cambia.

**Perche' esiste.** Scrivere `calc(100dvh - 65px)` vuol dire sapere l'altezza di tutto quello che sta sopra la lavagna, e quel numero non e' uno solo. Misurato sullo staging il 23/09/2026: la lavagna cominciava a **166px** dal bordo, non a 65. Sopra c'erano la barra di amministrazione (46px), l'header (65px su telefono, **55 su desktop**) e il titolo della pagina (55px).

La barra di amministrazione merita una riga a parte, perche' e' una trappola di quelle che si pagano il giorno dopo: **la vede solo chi e' collegato**, cioe' esattamente chi costruisce la pagina. Si prova, sembra a posto, si pubblica, e il primo visitatore vede 46px di lavagna in piu' del previsto — o, se si era compensata a mano, 46px di pagina che scrolla.

**Il prezzo, dichiarato**: questo e' l'unico JavaScript che il plugin mette nella pagina ospite, dodici righe. E' **opt-in**: senza `altezza="schermo"` non viene stampato affatto.

> ⚠️ **Lo `<script>` esce DOPO il `<div>`, e gira subito.** Non spostarlo e non rimandarlo a `DOMContentLoaded`.
>
> Nella 1.1.0 stava prima, e doveva aspettare che il DOM fosse pronto. In quella finestra si apriva una **corsa** con l'app dentro l'iframe, che al primo layout congela il rapporto della lavagna per non deformare i tratti quando si ruota il telefono. Dove l'app arrivava prima — **Chrome su Android** — il rapporto restava congelato su un'altezza di 65px piu' del vero, e la lavagna teneva bande nere ai lati per tutta la sessione, col tratto sfalsato dal dito. Su Chrome desktop e su Safari arrivava prima lo script e non si vedeva niente: il difetto che esiste solo sul telefono di qualcun altro.
>
> La corsa e' chiusa da entrambi i lati: qui, e nell'app, dove **a lavagna vuota il rapporto si puo' ancora ricongelare** (`unfreezeBoardHeight`). Se c'e' anche un solo tratto, invece, il rapporto non si tocca piu': li' c'e' un disegno da proteggere.

### Altri valori

```
[lavagna altezza="70vh"]
```

Un valore CSS qualunque, per i casi che non rientrano nei due di sopra.

Se il Container non ha altezza e lo shortcode nemmeno, entra in gioco un `min-height` di 420px: nel caso peggiore la lavagna e' piccola invece che invisibile.

## La pagina che ospita la lavagna

### L'header del sito e' `position: fixed`, quindi serve un margine

Un header fuori dal flusso non occupa spazio: senza un margine, la lavagna gli finisce **sotto**. Al Container va dato un `margin-top` pari all'altezza dell'header — e quell'altezza **non e' una sola**. Misurata sul sito il 23/09/2026:

| Larghezza | Header | Breakpoint Elementor |
|---|---|---|
| 1200 e oltre | **55px** | Desktop |
| 1024 e sotto | **65px** | Tablet e Mobile |

Il salto cade fra 1200 e 1024, cioe' esattamente sul breakpoint tablet. **Il margine va impostato su tutti e tre i dispositivi**, non solo su desktop: lasciarlo a 55 significa mandare la lavagna 10px sotto l'header su tablet e su telefono, che e' dove la usano i bambini.

**Il margine e' l'unica cosa da impostare a mano.** L'altezza no: con `altezza="schermo"` la calcola lo script, e il margine e' gia' compreso nel conto, perche' entra nel punto in cui la lavagna comincia. E' la ragione per cui conviene `altezza="schermo"` invece di dare l'altezza al Container: con quella si terrebbero due numeri sincronizzati (`margin-top: 55px` e `height: calc(100dvh - 55px)`) per ogni breakpoint, e il giorno che l'header cambia altezza se ne sbaglia uno.

> **Nota sull'editor di Elementor**: li' dentro la misura non e' attendibile, perche' lo script legge l'altezza del frame di anteprima e non quella della finestra. Si guarda in anteprima o sulla pagina pubblicata.

### Altre due cose

Non dipendono dal plugin, ma decidono se funziona:

- **Niente footer e niente titolo della pagina.** Sono contenuto sotto o sopra la lavagna, e la pagina torna a scorrere. La lavagna vuole essere l'unica cosa sotto l'header.
- **La pagina non deve scorrere.** E' il presupposto su cui poggia tutto: se scorre, scorre mentre un bambino disegna. Se serve, `overflow:hidden` e `overscroll-behavior:none` sul documento lo garantiscono.

## Perche' un iframe

Perche' **dentro un iframe la viewport e' il Container**, e questo tiene in piedi gratis tutto quello che l'app da' per scontato.

L'app e' nata come pagina a se' ed e' stata validata cosi' su iPhone e Android veri: usa `100dvh`, media query sulla larghezza della finestra, `position: fixed` per il velo del tutorial, e registra su `document` i listener che spengono pinch e doppio tap. In un iframe ognuna di quelle cose continua a voler dire quello che voleva dire prima.

Inline nella pagina andrebbero riscritte tutte, e in piu' i listener su `document` spegnerebbero pinch e doppio tap su **tutto il sito**, header compreso.

Il conto e' stato fatto leggendo il codice, non a intuito: inline sono cinque o sei modifiche sparse piu' una rivalidazione su device; in iframe e' una cancellazione (il vecchio tasto «Torna al sito», inutile da quando la pagina ha l'header) e una verifica.

Il prezzo dell'iframe, da sapere:

- **Il viewport meta e' quello della pagina ospite**, non dell'app. L'app da sola si metteva `user-scalable=no`; dentro WordPress non puo'. La difesa contro lo zoom accidentale resta `touch-action: none` sul canvas, che vale comunque.
- **`env(safe-area-inset-*)` vale 0 dentro un iframe.** Notch e home bar li deve gestire la pagina WordPress.
- **Niente `sandbox` sull'iframe, ed e' deliberato.** Un `sandbox` senza `allow-downloads` spegnerebbe il salvataggio dell'immagine, che e' tutto quello che il bambino porta a casa. L'iframe e' same-origin e carica codice nostro: non c'e' niente da isolare.
- `allow="web-share"` e' dichiarato esplicitamente anche se la policy `web-share` ha gia' `self` come default. Costa nulla e toglie un dubbio.

## Aggiornare la lavagna

1. Si modifica l'app in `prototipo/`, come sempre.
2. Si alza la versione **in due punti dello stesso file**, `frmm-lavagna.php`: l'header `Version:` e la costante `FRMM_LAVAGNA_VER`.
3. `python .lavoro/pacchetto.py`.

La versione finisce in coda all'URL dell'iframe (`?v=1.0.0`) e serve da cache buster: SiteGround serve i file statici con cache lunghe e ha gia' fatto perdere tempo a questo progetto.

Se le due versioni divergono, **lo script si rifiuta di costruire lo zip**. Non e' pedanteria: se divergessero, la bacheca direbbe una cosa e i browser ne servirebbero un'altra.

Cambia la query string e **non il percorso**, e anche questo e' voluto: il tutorial ricorda di essere stato visto in una chiave di `localStorage` che contiene `location.pathname`. Se cambiasse il percorso, ogni aggiornamento del plugin rimetterebbe il tutorial davanti a chi l'aveva gia' fatto.

## L'invio dei disegni (dalla 1.3.0)

`POST /wp-json/frmm-lavagna/v1/invio`, anonimo, `multipart/form-data`:

| campo | cosa |
|---|---|
| `client_id` | UUID v4 generato dall'app (D5) |
| `disegno` | il Drawing di D1, come stringa JSON |
| `immagine` | JPEG largo **1600 px** e alto quanto `board.h` del disegno, **senza logo** |
| `invio_id` | facoltativo, UUID v4 dell'invio, **uguale a ogni tentativo**: il secondo arrivo risponde `200 {doppio: true}` e non scrive niente (dalla 1.5.0) |
| `tentativo` | facoltativo, 1, 2, 3...: si salva in `_frmm_tentativo`, e serve a misurare quanto spesso la ripresa dell'app e' servita |

Risponde `201 {ok, id}` se il disegno e' in attesa, altrimenti `400` / `413` / `415` con un `code` (`frmm_client_id`, `frmm_disegno`, `frmm_disegno_vuoto`, `frmm_disegno_grande`, `frmm_immagine`, `frmm_immagine_tipo`, `frmm_immagine_misure`, `frmm_immagine_grande`), o `429 frmm_troppi` oltre il rate limit (dalla 1.8.0, vedi sotto). L'app sceglie la frase da mostrare dal codice, mai dal messaggio.

Il codice sta in `includes/`:

- `disegni.php` — il tipo di contenuto `frmm_disegno`: non pubblico, non in REST, senza URL. Visibile solo in bacheca, dove si modera. Il nome ha il prefisso, e non e' `disegno` come nel brief, perche' i tipi di WordPress condividono un solo spazio di nomi.
- `invio.php` — l'endpoint. Scrive l'immagine in `uploads/frmm-lavagna/` con un **nome casuale a 128 bit**, crea il post `pending`, lo collega all'allegato e lo mette come immagine in evidenza. Se un pezzo fallisce, toglie i pezzi gia' scritti.
- `bacheca.php` — la moderazione: miniatura al posto del titolo, **Approva / Rifiuta** come pulsanti nella riga, Approva in blocco, il numero dei disegni in attesa nel menu, la colonna Tentativo. Toglie i disegni **non approvati** dalla Libreria media e da ogni selettore d'immagine, perche' nessuno ne inserisca uno in una pagina prima che sia stato guardato. L'approvato ci resta, perche' la galleria dovra' poterlo prendere.
- `notifica.php` — l'email a ogni disegno arrivato, ad `admin_email` o a quel che dice il filtro `frmm_lavagna_destinatari`. La miniatura e' **incorporata** nel messaggio e non linkata: le immagini remote i programmi di posta le bloccano, e l'email diventerebbe un riquadro vuoto.
- `limiti.php` — il rate limit e la sua diagnostica (dalla 1.8.0, sezione qui sotto).
- `validazione.php` — i controlli, **senza WordPress**, cosi' si provano in locale: `php -d extension=gd plugin/test/validazione.php`. Dalla 1.8.0 anche la parte del rate limit che non ha bisogno di WordPress: IP da contare, impronta, finestra.

Cose da non disfare per sbaglio:

- **L'immagine si ricodifica, non si copia.** Un JPEG con del PHP appeso in coda passa ogni controllo sui byte e sulle misure: e' la ricodifica con GD che lo ripulisce. Provato sullo staging.
- **Il tipo si legge dai byte**, mai dal MIME del multipart o dall'estensione, che sceglie chi manda.
- **Il Drawing salvato e' ricostruito campo per campo**: in archivio non entra niente che non sia stato guardato.
- **Niente nonce**, ed e' deciso: per un anonimo e' uguale per tutti, e una pagina in cache lo servirebbe scaduto.
- **La risposta non contiene l'URL dell'immagine.** Il nome casuale protegge solo finche' nessuno lo dice.
- **Il CPT resta `public => false` e `show_in_rest => false`** (D3). Verificato da anonimo il 23/09/2026: `?attachment_id=`, `?p=`, `/wp/v2/media` chiusi (404/401), cartella non elencabile (403), niente sitemap degli allegati in Yoast.

Prove: `python .lavoro/prova-invio.py` contro lo staging (40 controlli; lascia tre disegni in attesa a ogni giro, e azzera i contatori del rate limit all'inizio).

### Il cestino: un disegno eliminato si porta via la sua immagine (dalla 1.9.0)

Un disegno rifiutato va nel cestino e ci resta `EMPTY_TRASH_DAYS` giorni (30, misurato su staging e produzione), poi WordPress lo elimina da solo. **Eliminare un post non cancella i suoi allegati: li stacca.** Fino alla 1.8.0 l'immagine di un disegno rifiutato sopravviveva senza disegno, usciva dal filtro della Libreria (che guarda il disegno a cui e' attaccata), ricompariva nei selettori di Elementor, e `/wp-json/wp/v2/media/<id>` la mostrava **a chiunque**, originale e miniature. Riprodotto sullo staging il 26/09/2026, prima che capitasse davvero: nessun disegno era ancora rimasto 30 giorni nel cestino.

Dalla 1.9.0 `disegni.php`, su `before_delete_post`, cancella allegato, file e miniature. Cose da non disfare per sbaglio:

- **Sta in `disegni.php`, non in `bacheca.php`**: lo svuotamento automatico gira nel cron, dove `bacheca.php` non e' caricato. Tutte e tre le strade ("Elimina definitivamente", "Svuota cestino", il cron) passano da `wp_delete_post()`.
- **Cancella solo gli allegati in `uploads/frmm-lavagna/`**: chi mettesse a mano una foto della Libreria come immagine in evidenza di un disegno non deve vedersela sparire.
- Vale anche per un disegno approvato che qualcuno toglie e poi elimina: la sua immagine se ne va, ed e' irreversibile.

Prove: `python .lavoro/prova-retention.py` (un disegno: invia, rifiuta, elimina, e guarda Libreria, REST da anonimo e file), `svuota` («Svuota cestino» dei disegni), `orfani` (sola lettura). La diagnostica (`GET /limiti`) riporta anche i giorni del cestino e il prossimo svuotamento.

### Il rate limit (dalla 1.8.0)

Al massimo **3 disegni per dispositivo** (`client_id`) e **20 per IP** in **24 ore dal primo invio** (Daniele, 25/09/2026). Oltre, `429 frmm_troppi` e niente scritto. L'app lo sa (`motivoDaStatus` → `troppi`) e lascia perdere **senza dire niente al bambino** e senza riprovare.

Due limiti perche' il `client_id` lo genera chi manda: un ciclo con curl ne inventa uno a giro, e lo ferma solo l'IP. Ma 3 per IP farebbe perdere in silenzio i disegni di una classe dietro la stessa rete. **Chi cambia rete non e' coperto, per scelta**: si riapre se ne arrivano a centinaia, e l'allarme e' la casella di posta.

Cose da non disfare per sbaglio:

- **Solo `REMOTE_ADDR`, mai le intestazioni.** Misurato il 25/09/2026 con `.lavoro/diagnostica-ip.py`: in produzione, dietro la CDN di SiteGround, `REMOTE_ADDR` e' gia' l'IP vero e un `X-Forwarded-For` falso non lo cambia; sullo staging `X-Forwarded-For` arriva **cosi' come lo scrive il client**. Leggerlo "per sicurezza" darebbe a chiunque il modo di ricominciare da zero a ogni invio.
- **L'ordine nell'endpoint**: dimensione dichiarata → `client_id` → doppione di `invio_id` → **limite** → JSON, JPEG, GD. Il doppione viene prima perche' la ripresa di un disegno arrivato deve sentirsi dire "c'e' gia'" (200), non "troppi". Il limite viene prima del JSON e di GD perche' sono le due cose che costano.
- **Si conta solo a disegno archiviato.** Una ripresa o un invio respinto non consumano: un bambino con la rete che va e viene non deve giocarsi i suoi tre disegni sul primo.
- **Contatori in transient, con un'impronta HMAC nel nome e non l'IP**, che scadono con la finestra: dell'IP non resta niente dopo 24 ore, e mai nei meta del disegno. Va detto nel testo per i genitori (passo 6). Con la cache a oggetti un transient puo' sparire prima (il limite si azzera in anticipo), e due invii simultanei possono prendersi entrambi l'ultimo posto: accettati tutti e due.
- **Azzerare e' incrementare un numero di generazione** (opzione `frmm_lavagna_limiti_gen`), non cancellare: con la cache a oggetti i transient non si possono elencare.
- **PHP legge corpi fino a 256 MB prima del nostro codice** (`post_max_size` misurato su staging e produzione). "Limiti prima di leggere il corpo" in un plugin non si puo': si cambia solo nella configurazione del sito. Fuori perimetro, si sa.

`GET /wp-json/frmm-lavagna/v1/limiti` (solo amministratore) dice che IP vede PHP, il suo contatore e i limiti; `DELETE` azzera tutto. Prove: `php plugin/test/validazione.php` (le funzioni pure), `python .lavoro/diagnostica-ip.py [--produzione]` (solo lettura) e `python .lavoro/prova-abuso.py` sullo staging (20 disegni e 20 email a giro: per vedere respinto il 21° bisogna farne passare 20; `raffica` rifà solo la raffica con 3, `pulisci` li rifiuta).

### Dall'app (dalla 1.4.0; domanda prima di salvare dalla 1.5.0)

SALVA chiede **prima** «SALVA E INVIA» / «SOLO SALVA». Dopo sarebbe inutile: chi condivide su WhatsApp resta in WhatsApp. L'invio parte nello stesso tocco che apre la condivisione, e se non arriva l'app riprova da sola. Aspettarlo prima di condividere non si puo', perche' Safari rifiuta `navigator.share` dopo un'attesa di rete. Da qui `invio_id`: la ripresa di un invio arrivato, di cui si e' persa la risposta, non deve creare un doppione.

Lo shortcode passa l'indirizzo dell'endpoint all'iframe in `?invio=`, codificato. L'app (`app/src/invio.js`) lo accetta **solo se ha la sua stessa origine**. Senza il parametro, SALVA resta un download e basta: e' il caso del prototipo fuori da WordPress. Se un giorno `home_url` e `site_url` divergessero, per esempio `www` da una parte sola, la domanda dopo SALVA sparirebbe e lo direbbe solo un avviso nella console.

## La galleria: i disegni approvati nel Custom Marquee (dalla 1.7.0)

La galleria è il widget **Custom Marquee** (`plugin/custom-marquee/`, dalla 1.2.0), che la Lavagna alimenta da sola. In Elementor si imposta **Sorgente delle immagini → «Disegni della Lavagna (approvati)»**: da lì la striscia si aggiorna a ogni approvazione, senza toccare la pagina.

Il codice sta in `includes/galleria.php`, che si aggancia ai due filtri del marquee (`custom_marquee/sorgenti`, `custom_marquee/immagini`). Il marquee non sa niente di disegni. Se la Lavagna viene disattivata, la sorgente sparisce dalla tendina e il widget non stampa niente.

- **Quali**: gli ultimi N (impostato nel widget, 20 di default) per **data di approvazione**, mostrati dal più vecchio al più nuovo. La data di approvazione la scrive `transition_post_status` nel meta `_frmm_approvato_il`: `wp_publish_post()` lascia quella d'invio, e con quella un disegno inviato un mese fa e approvato oggi potrebbe restare fuori dai 20. I disegni approvati prima della 1.7.0 ricadono sulla data d'invio.
- **Solo `publish`.** È uno **scostamento da D3**, dichiarato: il brief voleva la galleria alimentata dalla Libreria media, qui si leggono i `frmm_disegno`. La garanzia resta, perché publish vuol dire approvato. E migliora: un disegno tolto dalla pubblicazione sparisce da solo dalla striscia.
- **La cache di Speed Optimizer si svuota** a ogni ingresso o uscita da `publish`, con `sg_cachepress_purge_cache()` senza URL, cioè tutta la cache dinamica. Non con `sg_cachepress_purge_everything()`, che svuota anche memcached e cancella gli asset combinati. Sullo staging Speed Optimizer è spento: **questo ramo si verifica in produzione.**
- La cache degli elementi di Elementor non c'entra: un widget che non dichiara `is_dynamic_content()` falso viene rigenerato a ogni richiesta (verificato nel sorgente di Elementor 4.2.3).

Prove: `php plugin/test/galleria.php` (la scelta, senza WordPress) e `python .lavoro/prova-galleria.py prova <url-pagina> <immagini-al-massimo>` (il giro completo sullo staging: invia, approva, toglie, e legge la pagina da anonimo dopo ogni mossa).

## Aggiornare: la cache di un anno sui `.js`

SiteGround serve i file statici con `Cache-Control: max-age=31536000`. Il `?v=` dello shortcode rinnova `index.html`, **ma non i moduli che importa**. Per questo `pacchetto.py` aggiunge `?v=<versione>` a ogni import della copia che va nello zip, e **si rifiuta di costruire** se un import resta senza.

Senza quella riscrittura, chi aveva gia' aperto la lavagna riceveva l'`index.html` nuovo con i moduli vecchi. Nel caso peggiore un modulo nuovo importava una funzione assente da quello vecchio e la lavagna non si apriva, **solo per chi c'era gia' stato**. Scoperto sullo staging il 23/09/2026.

Il logo e i font restano senza versione: se cambiassero, vanno rinominati.

## Cosa non fa (ancora)

Mancano i testi per i genitori. Sono i passi 6 e 9 del piano in `.lavoro/stato.md`.

L'iframe e' same-origin e senza sandbox, quindi l'app chiama l'endpoint con una `fetch` diretta: non serve `postMessage`.
