# FRRM - Drawing plugin → progetto "Lavagna"

Web app di disegno a gessetti su lavagna, per il sito WordPress + Elementor Pro di una Fondazione ETS attiva sul tema dell'infanzia. Utenti: bambini 5–12 anni, mouse su desktop e dito su mobile. I disegni vengono moderati a mano dall'admin e pubblicati in una gallery.

## Documento di riferimento

**`lavagna-brief-progetto.md` è la fonte di verità.** Contiene scope, decisioni architetturali D1–D5, analisi tecnica e il piano in 11 fasi. Va letto prima di scrivere codice. Le decisioni D1–D5 non si rimettono in discussione senza un motivo esplicito.

Il markdown di quel file è escapato (`\---`, `\*\*`). È voluto: non ripulirlo.

## Spessore del tratto in base alla velocità — chiuso così

**Chiuso il 17/09/2026 per decisione di Daniele: non si tocca più.** Resta come è: `PRESSURE_MIN 0.84`, `PRESSURE_ALPHA_MIN 0.85`, variazione misurata 21 / 21 / 16%.

Era stato segnalato due volte dal cliente il 15/09/2026 e due tarature non avevano risolto. L'analisi si era fermata a una conclusione che vale ancora, se qualcuno riaprisse: **il problema non è la taratura, è che la metrica non descrive il fenomeno** — i numeri dicono 21%, l'occhio dice di no. Ipotesi mai verificate e combinazioni già provate in `.lavoro/stato.md`.

Chi lo riaprisse non ricominci ritarando le due costanti: è la strada già percorsa due volte senza risultato.

## Stato

> **Fase 4b (tutorial) chiusa il 17/09/2026**, più due tornate di correzioni del cliente il 18/09/2026: prima AVANTI al posto di PROSSIMO, testo del passo 3, riquadro degli spessori sui segni e non sui pulsanti, tratteggio animato e margine della mensola a 16px su mobile; poi **l'arancione istituzionale dentro il tutorial** e i testi più grandi, perché si parla di bambini. L'arancione era passato anche sui tasti AVANTI / HO CAPITO ed è stato tolto poche ore dopo, su richiesta: restano arancioni **solo il tratteggio e l'etichetta «ISTRUZIONI: n DI 7»**. Il prototipo è consegnabile e online.
>
> **Provato su telefono il 18/09/2026**: il tutorial funziona e SALVA funziona, compreso il ramo `navigator.share` che fino a quel giorno era verificato solo con uno stub. I due punti in sospeso sono chiusi.
>
> **Prossima fase concordata: l'integrazione in una pagina Elementor tramite shortcode — che è la Fase 8 del brief, non la 7.** Il piano è in `.lavoro/stato.md` e **comincia con tre decisioni, non col codice**: pagina dedicata o integrata, iframe o inline, e dove si prova. Le fasi 5, 6, 7, 9, 10 restano fuori perimetro: SALVA continuerà a scaricare e non a inviare.
>
> ⚠️ **La numerazione era sbagliata, corretta il 18/09/2026.** Il brief numera: 7 backend (inbox, CPT, REST, moderazione), 8 integrazione WP/Elementor, 9 hardening/legale/QA, 10 gallery e go-live. Qui era scalata di uno da 7 in poi, e l'effetto era che **la Fase 9 spariva**: privacy policy, testo di consenso, anti-abuso, retention. Su disegni di bambini non è una fase che si perde per una trascrizione. Vale la numerazione del brief.
>
> ⚠️ **Il nodo iframe/inline era mal posto.** La Fase 8 del brief prescrive il template **Elementor Canvas**, senza header né footer: lì `html, body { position: fixed }` torna applicabile quasi com'è e il rischio anti-scroll si sgonfia. La domanda che viene prima è se la lavagna sta in una pagina dedicata o dentro una pagina normale. Dettaglio nello stato.
>
> ⚠️ **Due scostamenti dal brief da non dimenticare**: **D1 (aspect 4:3 fisso) è stato violato** in Fase 4 — la lavagna si adatta alla finestra e la motivazione di D1 era «gallery coerente», conto da pagare prima della Fase 6 — e la **Fase 5 (persistenza locale) è in scope v1 del brief**, non un extra. Censimento completo nello stato.
>
> **La DoD della Fase 4 non è mai stata soddisfatta**: il brief chiede il test con un utente sotto i 10 anni. Il tutorial è nato perché la UI da sola non bastava, che è il sintomo che quella DoD descrive.
>
> Dettaglio in `.lavoro/stato.md`.


**Fase 0 chiusa.** Specifiche in `fase-0-specifiche.md`: fondo nero carbone `#1F2225`, palette di 9 gessetti isoluminanti (L 0.780 / C 0.120), 3 spessori, costanti tecniche.

**Fase 1 chiusa.** Codice in `prototipo/` (avvio: vedi `prototipo/README.md`).

Validata il 30/08/2026 su **iPhone 13 Pro (Safari)** e **Galaxy S10 (Chrome)**: si disegna fluidamente a 60 fps pieni, nessuno scroll accidentale, nessun pull-to-refresh, nessuno zoom da doppio tap né da pinch, nessun menu da long press, il palmo appoggiato non disegna, il tratto sopravvive alla rotazione. È la Definition of Done del brief, ed era il rischio che poteva fermare il progetto.

Misure complete in `prototipo/README.md`.

**Fase 2 chiusa.** Modello dati, One Euro, ricampionamento su curva, RDP, undo/redo, render puro. 29 test in `prototipo/test/run.js` (`node test/run.js`).

DoD verificata: lo stesso Drawing renderizzato a 800 / 1600 / 3200 px dà immagini che differiscono in media dello 0,13%, e due render identici danno 0 pixel diversi. Regge per costruzione: il contesto è trasformato in unità di lavagna una volta sola, quindi il render non sa nulla di scala.

Due scostamenti dal brief, entrambi documentati in `prototipo/README.md`:

- **Niente conversione in curve di Bézier** (§5.1 punto 6). Serviva a disegnare con `bezierCurveTo`, ma la Fase 3 usa stamp lungo la curva e la Catmull-Rom viene valutata direttamente. Si salvano i punti radi (D1 letterale) e si ricampiona al render.
- **Taratura della pipeline chiusa il 31/08/2026**, provando sul telefono: `RDP epsilon 10`, `beta 0.2`. Valori in `fase-0-specifiche.md` §5.

  Il risultato non ovvio: **lo smoothing si governa con l'epsilon RDP, non con il filtro**. A parità di epsilon la levigatezza è identica per qualunque `beta`, quindi `beta` va messo al valore che minimizza il lag e basta. Chi tentasse di aumentare lo smoothing agendo su `minCutoff` o `beta` non otterrà nulla: il tremore gonfia la stima di velocità e il filtro lo scambia per un gesto veloce.

**Fase 3 chiusa.** Effetto gessetto in `prototipo/src/chalk.js`: il tratto è timbrato, non disegnato. 29 test. Validata sul device il 04/09/2026: sembra gesso, 60 fps, il tratto non salta al rilascio e la gomma cancella sotto il dito.

**Con la Fase 3 si chiudeva il perimetro concordato (Fasi 1–3).**

**Fase 4 fatta** (UI a mensola, lavagna adattiva, punta di gesso a dimensione fissa) e, il 15/09/2026, due richieste del cliente: **rosso e marrone** al posto di corallo e acqua, **cancellino** più leggibile. Nella stessa sessione **spessori alzati** perché sottile e medio risultavano troppo esili. 35 test.

I valori in vigore sono **21 / 27 / 50** (`WIDTHS` in `palette.js`), raddoppiati sotto i 700 px di lavagna da `SCALA_STRUMENTI`. Qui era rimasto scritto 16 / 28 / 44, che il codice non ha mai avuto: corretto il 17/09/2026 leggendo il file. Il codice è la fonte, non questa riga.

**Scarica il disegno — 16/09/2026.** JPEG 1600 px sul device. È una **fetta anticipata della Fase 6**, chiesta esplicitamente: solo il download, nessun backend. Codice in `prototipo/src/export.js`, note in `prototipo/README.md`.

**Il logo della Fondazione — 18/09/2026.** `prototipo/images/logo.png` (512x451 RGBA), in alto a sinistra a 40 unità dai bordi, largo **220 unità su lavagna larga e 533 (un terzo) su lavagna stretta**. Chiude la dipendenza esterna aperta il 31/08/2026. Va **solo sull'immagine che l'utente scarica**: il PNG che in Fase 6 partirà per la moderazione e quello della gallery non lo hanno (§7.2). 46 test.

A 220 unità **il nome della Fondazione non si legge** — il marchio sì, le parole no. Misurato, non temuto. Se il cliente lo vuole leggibile anche su desktop la misura da provare è ~320: è una decisione sua.

**Fase 4b chiusa — 17/09/2026. Il tutorial**, chiesto dal cliente: sette passi con una finestra al centro e l'area spiegata in luce dentro un velo, cerchiata di gesso. Parte alla prima apertura, poi il `?` lo riapre. Codice in `prototipo/src/tutorial.js`, progettato prima in `design-tutorial/prova.html` (cinque giri di revisione). Nella stessa tornata **SCARICA e INVIA sono diventati un solo SALVA** e i tasti hanno preso lo stile del sito della Fondazione. 44 test.

Dettaglio in `prototipo/README.md`; le decisioni e quel che resta da provare su device in `.lavoro/stato.md`.

Cose da non disfare per sbaglio:

- **Il riquadro del tutorial si prende dall'elemento** (`getBoundingClientRect`), mai da coordinate: sotto i 700 px la mensola cambia griglia.
- **La finestra non sta al centro**, ma nella metà opposta all'area in luce — al primo passo l'area *è* il centro e la finestra coprirebbe quel che spiega.
- **`.btn[hidden] { display: none }` non è ridondante**: `.btn` è `inline-flex` e vince sull'attributo `hidden`. Senza, RIPETI compare a tutti i passi. Già succeduto.
- **`data-tutorial` sul `<body>` serve**: accende l'aspetto dei tasti spenti mentre il tutorial è aperto. Senza, quattro passi su sette evidenziano un'area vuota, perché alla prima apertura non c'è un disegno e annulla / rifai / SALVA sono `disabled`. Cambia solo il colore: lo stato disabilitato resta.
- **`#spot-line` ha `width`/`height` espliciti e non solo `inset`**: un `<svg>` è un elemento rimpiazzato e con le sole distanze dai bordi resta a 300×150. Il riquadro risulta giusto a misurarlo e sbagliato a guardarlo.
- **Il passo degli spessori punta a `#widths .wbtn i`, non a `#widths`**: i pulsanti sono alti `--stick-h` per il dito, i segni dentro ne occupano 19. Puntare il pulsante invade i gessetti sopra e SALVA sotto.
- **`pad` 6 + `inset` 4 + mezzo tratto = 11,5px, e il padding laterale della mensola su mobile è 16px**: i due numeri si cambiano insieme, o il tratteggio degli elementi a filo di schermo viene tagliato. E oltre i 17px la mensola a 360px non si stringe più, sfora.
- **Rifai non esiste più nell'interfaccia** (18/09/2026, cliente): niente pulsante, niente `Ctrl+Y`. `history.redo()` e `canRedo` sono ancora in `model.js` ma **non li chiama nessuno** — chi ci si appoggiasse leggerebbe uno stato che nessuno aggiorna. Conseguenza: **annulla è irreversibile**.
- **Il logo dell'export è un parametro e vale zero se non lo si chiede**: `disegnaSuCanvas(drawing, larghezza, logoW)` non lo mette da solo. È il verso giusto per §7.2 — chi scriverà l'invio non deve ricordarsi di *toglierlo*. Chi invertisse il default si ritroverebbe il logo nella gallery.
- **Il logo si precarica all'avvio e si compone in modo sincrono**: al click di SALVA non c'è tempo per un `decode()`, perché l'export è sincrono per non perdere l'attivazione del tocco. Se il file manca l'immagine esce senza logo, non fallisce.
- **`SOGLIA_STRETTA` in `palette.js` è una sola per due cose**: raddoppia gli strumenti e sceglie la misura del logo. Era un `700` letterale dentro `main.js`; chi lo riportasse lì farà divergere le due decisioni senza che nulla lo segnali.
- **L'arancione del tutorial sta sul tratteggio e sull'etichetta del passo, non sui tasti**: c'è passato il 18/09/2026 ed è stato tolto lo stesso giorno. Chi lo rimettesse scriva le regole sull'**id** e non su `.primario`: `#btn-save` condivide quella classe e l'arancione finirebbe nella mensola, dove è stato deciso che non entra.

**I font della Fondazione non sono nel repo.** `index.html` dichiara `SebinoSoft` e si aspetta i `.woff2` in `prototipo/font/`: sono font commerciali di terzi e il repo è pubblico. Si riscaricano col comando in `prototipo/README.md`; `.lavoro/pubblica.sh` li carica se li trova e avvisa se non ci sono. **Da verificare**: che la licenza webfont copra `issimissimo.com`, che non è il dominio della Fondazione.

**Il fondo lavagna resta un colore pieno, senza texture** (deciso il 04/09/2026). Conseguenza architetturale: il canvas dei tratti è trasparente e il fondo sta nel CSS, altrimenti il cancellino in `destination-out` aprirebbe buchi neri invece di scoprire la lavagna.

Verificato: due render dello stesso Drawing danno 0 pixel diversi, il render a 800/1600/3200 px differisce dello 0,44%, un tratto costa 0,17 ms.

Due difetti trovati provando e risolti il 04/09/2026:

- **Il tratto saltava alzando il dito** (41,8% dei pixel). Ora a fine gesto non si ri-renderizza: si travasano i pixel dell'overlay sul livello persistente. Salto **0%**. Prezzo dichiarato: dopo undo/redo o resize il tratto viene ridisegnato dal modello e la grana cambia (~30%), la forma no.
- **La gomma non cancellava durante il gesto**, solo al rilascio: `destination-out` sull'overlay cancella l'overlay, che è vuoto. Ora agisce sul livello dei tratti in modo incrementale, e non viene semplificata (`eps 0`) perché l'indice dei timbri applicati resti valido.
- **La prima gommata ridisegnava tutti i tratti**, cambiando la grana dell'intero disegno: era il `repaint()` completo che la gomma faceva a fine gesto. Tolto — la gomma ha già inciso il livello durante il gesto, il risultato giusto è già a schermo.

**Regola che ne discende: a fine gesto non si ridisegna mai dal modello.** Il livello dei tratti diverge dal modello, e si riallinea solo su undo/redo/resize, dove la grana cambia ma la forma no.

Vicolo cieco da non ripercorrere: legare l'aspetto del timbro alla **posizione** anziché alla sequenza sembra la soluzione elegante al salto, ma peggiora — ogni micro-movimento della curva ricalcola l'aspetto di tutte le impronte. Dettagli in `prototipo/README.md`.

### Vincolo emerso dal test di Fase 1, applicato in Fase 2

`getCoalescedEvents` è **assente su entrambi i device**, e il rAF gira a **60 Hz su entrambi** (Safari limita le pagine web a 60 anche su ProMotion). Si ricevono ~55 eventi/s: quasi un campione per frame, quindi la fluidità non ne soffre.

Ma i campioni sono radi. **A ~55 campioni/s un gesto veloce li lascia distanti ~29 unità di lavagna, mentre il resampling ne vuole uno ogni 2,5.**

**Conseguenza: il resampling deve interpolare su una curva, non decimare.** Un'interpolazione lineare fra campioni così distanti produce una spezzata visibile proprio sui gesti rapidi — quelli dei bambini. Risolto in Fase 2 con Catmull-Rom centripeta (`geom.js`).

Due note di metodo, per non rifare il lavoro:

- `performance.now()` è quantizzato a 1 ms su Safari iOS: le misure di singolo frame restano indicative, va letto `FPS TRATTO` che è immune.
- Il rilevamento di `getCoalescedEvents` dice "assente" anche su Chrome Android, che invece dovrebbe implementarlo. Anomalia non spiegata, non inseguita perché non cambia alcuna decisione: a 60 Hz di rAF il coalescing non aggiungerebbe fluidità.

## Decisioni prese (30/08 – 15/09/2026)

1. **Si parte dalla Fase 0.**
2. **Nessun nickname, nessuna attribuzione.** Il nodo §4 del brief è chiuso: i disegni sono anonimi, non si raccoglie alcun dato personale. Niente consenso genitoriale, niente moderazione del nickname, form di invio senza campi di testo.
3. **Perimetro di questa tornata: Fasi 1–3.** Canvas + input touch (Fase 1), modello dati + smoothing (Fase 2), effetto gessetto (Fase 3). Si arriva a un **prototipo standalone fuori da WordPress**, poi si rivaluta se proseguire.
4. **Download dell'immagine** — aggiunto il 31/08/2026. L'utente può salvare il disegno sul proprio device, col logo della Fondazione in alto a sinistra. Requisiti in `fase-0-specifiche.md` §7. **Si implementa in Fase 6**, fuori dal perimetro attuale: qui è solo specificato.

   ~~Dipendenza esterna da avviare presto: serve il **logo in versione per fondo scuro**~~ — **chiuso il 18/09/2026**: il logo è arrivato ed è a colori su fondo trasparente. Sul `#1F2225` regge: arcobaleno, cuori e nuvole grigie si leggono; il testo attorno all'arco no, ma solo alla misura desktop.

### Cosa resta fuori, e va detto se ci si avvicina

Le **Fasi 5–10** sono **fuori perimetro**. Con i nomi del brief, che è l'unica numerazione valida: 5 persistenza IndexedDB, 6 export a tre risoluzioni e payload di invio, 7 backend (inbox, CPT, REST, moderazione), 8 integrazione WP/Elementor, 9 hardening/legale/QA, 10 gallery e go-live. La Fase 4 è stata fatta, riaprendo il perimetro esplicitamente. Anche la DoD della Fase 0 è stata ridotta di conseguenza: testo del form di invio e decisione legale servono alle Fasi 6–9 e non sono stati scritti.

Se una sessione futura comincia a costruire persistenza, backend o integrazione WP, va nominato prima di scrivere il codice.

## ⚠️ Due nomi diversi, ed è voluto

Il nome corretto del progetto è **`frmm`**. La cartella su FTP è stata rinominata il 09/09/2026.

**Restano scritti `frrm`**, che è un refuso: la cartella locale `frrm-drawing-plugin` e il repo GitHub. Non sono stati allineati perché rinominare la cartella locale scollega memoria e cronologia (vedi `Claude_Workspace/CLAUDE.md`) e va fatto a sessione chiusa.

Chi trovasse la discrepanza **non la "corregga" rimettendo `frrm` sull'FTP**: il percorso online giusto è quello con `frmm`.

## Pubblicazione

**Online:** <https://issimissimo.com/temp/frmm-drawing-plugin-14/> — con `?tutorial` in coda il tutorial parte comunque. La **-13** è la stessa cosa **senza il logo** sull'immagine scaricata.

⚠️ Le precedenti hanno **difetti noti** e non vanno date a nessuno: nella `-02` RIPETI si vede a ogni passo, nella `-03` i tasti spenti sono illeggibili nei passi che li spiegano, nella `-04` il tutorial non parte a chi ha già visto una versione precedente. La `-05` non ha difetti — è solo priva delle correzioni del 18/09/2026 (AVANTI, riquadro degli spessori, tratteggio animato in arancione, corpi più grandi) e serve da confronto. La `-06` è **il giro intermedio con i tasti arancioni**, rientrato poche ore dopo: non va data al cliente, perché mostra una scelta che è stata annullata. La `-07` è buona ma precede lo spostamento del `?` e il fondo spento di SALVA.

⚠️ **La `-11` e la `-12` sono state ritirate il 18/09/2026**: contengono i **gessetti accorciati** e, la `-12`, anche la finestra del tutorial compattata. Il cliente ha cambiato idea poche ore dopo averli chiesti, e il codice è tornato indietro con un `reset --hard` su `ac04733`. **Non vanno date a nessuno**: mostrano una mensola che il progetto non ha più. Restano online come tutte le altre — si lasciano dove sono, non si cancella niente dall'FTP.

⚠️ **La cartella numerata batte la cache HTTP, non il `localStorage`**, che è per origine: tutte le versioni sotto `temp/` condividono lo stesso archivio. Qualunque stato che il prototipo ricorda va messo in una chiave che porta dentro `location.pathname`, altrimenti una versione nuova eredita quel che sapeva la precedente — ed è già costato un "il tutorial non parte più" il 17/09/2026. Vedi `chiaveVisto()` in `prototipo/src/tutorial.js`.

Cartella **numerata**, dal 17/09/2026: il link da dare al cliente è quello, senza query string. La numerazione è la difesa dalla cache di SiteGround — un URL nuovo non è in nessuna cache, né del proxy né del browser di chi ha già visto il prototipo. **Ogni consegna al cliente va in una cartella nuova** (`-02`, `-03`), non sopra la precedente. Le vecchie si lasciano dove sono: servono a confrontare, e cancellarle non fa guadagnare niente.

Solo `prototipo/index.html`, `prototipo/src/`, `prototipo/images/` e `prototipo/font/` — i test e `package.json` non servono in rete. I percorsi sono tutti relativi, quindi la cartella si può spostare.

Lo script di caricamento sta in `.lavoro/pubblica.sh`: prende il numero di cartella come argomento, carica i 17 file (`index.html`, 12 moduli, il logo, 3 font) e rilegge il listing per confronto.

⚠️ **Lo script usa `--ftp-ssl-control`, e non è una svista.** Questo server manda il `close notify` ma non completa lo shutdown TLS del **canale dati**: curl aspetta 10 secondi a ogni trasferimento, e con 16 file erano ~3 minuti. Misurato il 18/09/2026 nel trace (`* SSL shutdown timeout`), dopo aver scambiato due volte quel tempo per lentezza della rete mentre la banda era 21 Mbit/s. Togliendo il TLS dal solo canale dati si passa da 11,3s a 0,98s per operazione.

Il prezzo è che **i file viaggiano in chiaro**: accettabile qui perché sono già in un repo pubblico, e le credenziali restano sul canale di controllo, che è cifrato. **Non va copiato** in uno script che carichi dati di clienti o roba non pubblica. E `--ssl-reqd` annulla `--ftp-ssl-control`: i due non si mettono insieme.

Credenziali FTP in `~/.claude/.secrets/ftp-siteground.env`, condivise fra i progetti del workspace; le regole d’uso stanno in `~/.claude/rules/credenziali.md`.

**Attenzione**: quelle credenziali aprono l'intero account SiteGround, dove convivono altri domini e lavori di clienti — compreso il sito della Fondazione. Operare solo dentro `/issimissimo.com/public_html/temp/frmm-drawing-plugin*`.

## Regole di lavoro

**Commit automatico su GitHub a feature completata.** Quando una funzionalità è implementata *e verificata*, si committa e si pusha senza chiedere — deciso il 05/09/2026.

**E si pubblica senza chiedere** — deciso il 18/09/2026, dopo la quarta richiesta di conferma in una sera. Finita e verificata una modifica, si carica la **cartella numerata successiva** e si comunica il link a cose fatte: la cartella è nuova, non sovrascrive niente, e lo script rifiuta di scrivere dove esiste già. Restano due limiti che non cambiano: **solo dentro `temp/frmm-drawing-plugin-*`**, mai altrove sull'account, e **pubblicare non è consegnare** — il link al cliente lo dà Daniele.

Vale a feature riuscita, non a ogni salvataggio: il criterio è che i test passino e che la cosa sia stata provata. Un lavoro a metà o un esperimento non si pushano.

Il remote non contiene il token (`git remote -v` mostra l'URL pulito): il push chiede le credenziali, oppure lo si fa con l'MCP `github`. Token in `~/.claude/.secrets/github-pat.txt`.

Repo: <https://github.com/issimissimo/frrm-drawing-plugin> — pubblico.

## Regole di questa cartella

- Sessione a sé. Aprire VSCode / Claude Code **direttamente su questa cartella**, mai sulla root `Claude_Workspace`: memoria e cronologia sono indicizzate sul percorso.
- Il nome della cartella non va cambiato: rinominarla scollega memoria e cronologia.

## MCP disponibili

Registrati a scope utente, già attivi qui:

- **playwright** — pilota il Chrome installato sul sistema. Utile per il QA del canvas, ma **non sostituisce il test su device reale**: la Fase 1 si valida su iPhone Safari vero.
- **google-apps-script** — codice in `C:\Users\Daniele\.claude\mcp-servers\google-apps-script`. Non pertinente a questo progetto.
