# Prototipo — avvio

Il codice usa ES modules: aprire `index.html` con doppio click **non funziona**, il browser blocca i moduli su `file://`. Serve un server statico.

```
cd prototipo
python -m http.server 8123 --bind 0.0.0.0
```

- Desktop: <http://localhost:8123/>
- Telefono sulla stessa wifi: `http://<ip-del-pc>:8123/`

L'IP si trova con `ipconfig`. Se il telefono non raggiunge il PC, quasi sempre è il firewall di Windows che blocca la porta, non il codice.

## Test

```
node test/run.js
```

43 test sulle funzioni pure, nessuna dipendenza. Coprono filtro, ricampionamento, semplificazione, effetto gessetto, export e la geometria del tutorial. Ciò che resta soggettivo — "un cerchio sembra un cerchio", quanto smoothing è giusto, se un bambino capisce il tutorial — si verifica a mano sul telefono.

### I font non sono nel repo

`index.html` dichiara **SebinoSoft**, il font del sito della Fondazione, e si aspetta i tre `.woff2` in `prototipo/font/`. Non sono versionati: sono font commerciali di terzi e il repo è pubblico. Senza di loro la pagina non si rompe — ripiega su Atkinson Hyperlegible — ma i corpi risultano più stretti del 15%.

Si riscaricano dal sito:

```
mkdir -p font && cd font
B=https://fondazione-riccardo-marina-mantovani.org/wp-content/uploads
curl -O $B/2026/05/SebinoSoft-Regular.woff2
curl -O $B/2026/05/SebinoSoft-Medium.woff2
curl -O $B/2026/06/SebinoSoft-Bold.woff2
```

Non si possono linkare direttamente da lì: su quegli URL **manca l'header CORS**, e un font cross-origin senza CORS viene rifiutato dal browser. Dentro WordPress il problema non esiste, li carica Elementor.

## Stato: Fase 3

Effetto gessetto. Il tratto **non viene disegnato: viene timbrato**, ripetendo lungo la curva una piccola impronta irregolare pre-renderizzata (`chalk.js`). Nessuna linea, per quanto lavorata, restituisce bordi sfrangiati, grana e opacità irregolare tutti insieme.

Pipeline completa:

| Quando | Cosa | Dove |
|---|---|---|
| a ogni campione | One Euro Filter | `filter.js` |
| a ogni campione | pseudo-pressione dalla velocità | `pen.js` |
| a fine gesto | semplificazione RDP | `geom.js` |
| a ogni render | Catmull-Rom + ricampionamento | `geom.js` |
| a ogni render | timbratura delle impronte | `chalk.js` |

**Il fondo lavagna è un colore pieno nel CSS, senza texture** (scelta del 04/09/2026). Il canvas dei tratti è quindi trasparente: il cancellino lavora in `destination-out` e, se il fondo fosse dipinto insieme ai tratti, aprirebbe buchi neri invece di scoprire la lavagna.

### Tre scelte contro il brief §5.2, tutte per costo

**Il passo dei timbri è legato alla larghezza** (un terzo), non al passo fisso di 2,5 unità della polilinea. Le impronte sono larghe quanto il tratto, quindi a un terzo si sovrappongono già a sufficienza: 90 timbri per tratto invece di 800.

**La polvere sta dentro l'impronta**, non è uno scatter disegnato a parte: sono granelli isolati oltre il disco centrale, e così costano zero.

**Niente rotazione per timbro**, che imporrebbe un `save`/`rotate`/`restore` ogni volta. La varietà viene da otto impronte diverse pescate a caso.

### Cosa fa sembrare gesso quello che si vede

Il primo tentativo produceva una matita grigia. Due correzioni:

**La grana deve essere a macchie larghe** (5 celle su 96 px). L'impronta viene disegnata a una frazione della dimensione sorgente — da 96 px a una ventina — quindi una grana fine si media via e restituisce un grigio uniforme.

**Servono vuoti veri, non zone più chiare.** Sotto una soglia l'opacità va a zero e la lavagna traspare: è il buco a fare il gesso. Un interno solo più chiaro legge come inchiostro diluito.

### Perché il tratto non salta più quando alzi il dito

A fine gesto il tratto **non viene ri-renderizzato: si travasano i pixel** dell'overlay sul livello persistente (`board.commitOverlay`). Il risultato è che ciò che si è visto disegnare resta esattamente com'era: **0% di pixel cambiati**, contro il 41,8% della prima versione.

Ci sono voluti tre tentativi, e i due scartati valgono la pena di essere ricordati.

**Semplificazione incrementale durante il tratto** (consolidare i punti già passati invece di rifare tutto a `pointerup`). Portava il salto da 41,8% a 29%: meglio, non risolto. È rimasta comunque, perché rende il tratto vivo già quasi identico al salvato.

**Aspetto del timbro legato alla posizione anziché alla sequenza.** Sembrava la soluzione elegante — un timbro in più non avrebbe sfasato tutti gli altri — e invece **peggiorava**: uno spostamento di due unità passava dal 2,8% al 16,5% dei pixel, perché ogni micro-movimento della curva ricalcolava l'aspetto di ogni impronta.

La causa vera è che aggiungere un solo campione cambia la curva Catmull-Rom *e* il numero di impronte: non è eliminabile ri-renderizzando, qualunque generatore si usi.

**Nessun ridisegno dal modello a fine gesto, nemmeno per la gomma.** All'inizio la gomma faceva un `repaint()` completo per agire sui tratti sottostanti nell'ordine giusto — e così la prima gommata ricostruiva *tutti* i tratti, cambiando la grana dell'intero disegno. Non serve: la gomma ha già inciso il livello durante il gesto, in `destination-out`. Il risultato corretto è già a schermo.

**Il prezzo, dichiarato:** il livello dei tratti diverge dal modello. Su **undo, redo o ridimensionamento** il disegno viene ricostruito e la grana cambia (un tratto ri-renderizzato ha circa il 20-30% di pixel in più di quello travasato, per via degli arrotondamenti sull'alpha premoltiplicato). **La forma resta identica**, cambia solo la texture. È il momento giusto in cui pagarlo: mentre si disegna si guarda il tratto che si sta facendo, dopo un undo si guarda il disegno intero.

### La gomma cancella mentre si muove il dito

Non è scontato, e nella prima versione non funzionava: il tratto in corso vive sull'overlay, ma la gomma lavora in `destination-out` e sull'overlay cancellava l'overlay — vuoto. Non si vedeva nulla fino al rilascio.

La gomma va quindi applicata **direttamente al livello dei tratti, e solo sul pezzo nuovo**: ridisegnarla tutta a ogni frame cancellerebbe sessanta volte lo stesso punto. Da qui il parametro `da` di `timbra()`.

Per lo stesso motivo **la gomma non viene semplificata** (`eps 0`): se i punti cambiassero sotto, l'indice dei timbri già applicati non corrisponderebbe più. Con questa scelta lo scarto al rilascio è **1,8%**, era il 45,3%.

### Verificato

| | |
|---|---|
| due render dello stesso Drawing | **0 pixel diversi** (il seed funziona) |
| stesso Drawing a 800 / 1600 / 3200 px | differenza media 0,44% |
| 40 tratti, 8359 timbri, ridisegno completo | 26,5 ms su desktop |
| costo di un singolo tratto | 0,17 ms |

Il costo per tratto è ciò che si paga a ogni frame mentre si disegna: con quel margine il budget di 8 ms non è in discussione. Il ridisegno completo si paga solo su undo, resize e cancellino.

### La taratura dello smoothing — chiusa

Livello scelto: **Molto** (`eps 10`), confermato sul telefono il 31/08/2026.

**La leva è l'epsilon della semplificazione RDP, non il filtro.** One Euro toglie il tremore ad alta frequenza; è la semplificazione geometrica a rendere il tratto *disegnato bene*.

Misura: rugosità = variazione angolare media fra segmenti consecutivi, in gradi. È ciò che l'occhio legge come "tremolante". Una curva pulita sta a **0,30**.

| livello | eps | rugosità | effetto |
|---|---|---|---|
| **Molto** (scelto) | 10 | **0,31** | liscio come una curva disegnata |
| Medio | 3 | 0,7 | ripulito ma riconoscibile |
| Poco | 1 | 3,5 | il gesto com'è, tremore compreso |

Il selettore nella barra resta come strumento: in Fase 3 la texture del gessetto cambierà la resa e potrebbe valere la pena riguardarlo. Va rimosso con la UI definitiva della Fase 4.

**Due trappole, per non ripercorrerle.**

Una versione precedente faceva variare **solo `beta`**, e i tre livelli risultavano indistinguibili: `beta` interviene sopra una certa velocità, e a mano lenta — cioè proprio quando si guarda lo smoothing — non cambia nulla. Un test copre ora il caso.

Neppure abbassare `minCutoff` serve: il tremore gonfia la stima di velocità (±4 unità a 55 Hz valgono ~440 unità/s apparenti), quindi `beta·velocità` domina e il filtro scambia il tremore per un gesto veloce.

**`beta` non è un compromesso.** A parità di epsilon la rugosità resta 0,30 per qualunque `beta` fra 0,02 e 0,3, mentre il lag passa da 6,7 a 0,5 unità. Si è scelto **0,2**: il valore migliore, senza contropartita.

Il prezzo di `eps 10` è il dettaglio fine: un tratto molto corto può venire ridotto a una linea retta.

### Verificato

| | |
|---|---|
| stesso Drawing a scale 800 / 1600 / 3200 px | differenza media 0,13%, massimo 6,7% sui bordi |
| due render identici | 0 pixel diversi |
| compressione tipica | 4 punti salvati → 643 disegnati |

La prima riga è la Definition of Done della fase. Regge **per costruzione**, non per attenzione: il contesto è trasformato in unità di lavagna una volta sola in `board.js`, quindi il codice di render non sa nulla di scala, pixel o DPR e non ha modo di dipenderne.

## Il pannello Info

Serve sul telefono, dove non c'è una console.

| Voce | Cosa dice |
|---|---|
| **`FPS TRATTO`** | **la misura che conta.** Media sull'intero tratto, resta leggibile dopo il rilascio |
| `fps ora` | istantaneo, solo mentre il dito è giù |
| `frame max` | frame peggiore del tratto corrente |
| `timer` | risoluzione reale di `performance.now()` |
| `eventi/s` | quanti `pointermove` arrivano davvero dal sistema |
| `ultimo tratto` | campioni grezzi → punti salvati → punti disegnati |
| `smoothing` | il livello attivo e il suo eps |

Tre avvertenze su come si leggono.

**Guardare `FPS TRATTO`, non `frame max`.** `performance.now()` è quantizzato per sicurezza: 1 ms su Safari iOS, 0,1 ms su Chrome. A 1 ms di granularità un frame da 16,7 ms viene riportato come 16 o 17, e le misure di singolo frame restano indicative.

**`frame max` si azzera a ogni tratto**, e il primo frame dopo il `pointerdown` viene scartato: contiene il risveglio del rAF, che Safari rallenta a pagina ferma. È latenza di avvio, non costo di disegno.

**`coalesced 1` non è un difetto in sé.** Il coalescing serve solo quando il touch campiona più in fretta di quanto lo schermo disegni.

## Misurato su device reali (30/08/2026)

| | iPhone 13 Pro / Safari | Galaxy S10 / Chrome |
|---|---|---|
| FPS tratto | 60 | 60 |
| frame max | 21 ms | 16,9 ms |
| timer | 1,00 ms | 0,10 ms |
| **refresh (rAF)** | **62 Hz** | **62 Hz** |
| eventi/s | 52–54 | 57–59 |
| dpr | 2 | 2 |
| `getCoalescedEvents` | assente | assente |

Il rAF gira a 60 Hz su entrambi, ProMotion incluso: Safari limita le pagine web a 60 anche sui display a 120 Hz. Con ~55 eventi/s si riceve quasi un campione per frame, e il coalescing non aggiungerebbe fluidità.

**Ma i campioni sono radi**, ed è la ragione per cui il ricampionamento interpola su una curva invece di decimare: a ~55 campioni/s un gesto veloce li lascia distanti ~29 unità, mentre ne serve uno ogni 2,5.

## Il tutorial (Fase 4b)

Sette passi, chiesti dal cliente il 17/09/2026: alcuni aprono la lavagna e non sanno cosa fare. Parte **da solo alla prima apertura**, poi mai più; il `?` nella mensola lo riapre. Codice in `src/tutorial.js`, progettato prima in `design-tutorial/prova.html` (cinque giri di revisione, l'ultimo online su `temp/frmm-tutorial-design-05/`).

| | |
|---|---|
| Evidenziazione | velo `rgba(8,9,11,.78)` più riquadro tratteggiato arancione, che scorre |
| Finestra | nella metà opposta all'area, mai sopra ciò che spiega |
| Avanzamento | «TUTORIAL: PASSO n DI 7», nessun pallino |
| Uscita | solo all'ultimo passo, oppure `Esc` da tastiera |
| «Già visto» | `localStorage`, chiave `lavagna.tutorial.visto.v1:<percorso>` |
| Per rivederlo | il `?` in fondo a destra nella mensola, o `?tutorial` in coda all'URL |

Le cose che non si leggono dal codice:

**Il riquadro si prende dall'elemento, mai da coordinate.** Sotto i 700 px la mensola cambia griglia e quel che sta a destra finisce in mezzo: `areaUnione()` lavora sui `getBoundingClientRect` reali, e con più selettori unisce i rettangoli — serve ad annulla/rifai, due pulsanti ma un concetto.

**La finestra "al centro" non può stare al centro.** Al primo passo l'area in luce *è* il centro dello schermo, e una finestra centrata coprirebbe proprio quello che sta spiegando. `posizionaFinestra()` la mette nella metà opposta a quella dove cade l'area, e con poco spazio preferisce tenerla dentro lo schermo piuttosto che centrata. Misurato: copre lo 0% dell'area in luce in tutti e sette i passi, a 1440×900 e a 390×844.

**Il velo intercetta i tocchi, ed è voluto.** Mentre il tutorial è aperto non si disegna e non si toccano gli strumenti: verificato che `elementFromPoint` sul centro della lavagna restituisca `#tut` e che chiudendo il tutorial senza aver toccato nulla il disegno resti vuoto.

**Non c'è un CHIUDI nei primi sei passi.** È una richiesta esplicita: un CHIUDI accanto ad AVANTI si tocca per sbaglio e il tutorial sparisce prima di aver spiegato niente. Il prezzo è che chi lo riapre col `?` deve fare sette tocchi per uscirne — `Esc` funziona, ma non sul dito. Se dà fastidio, la correzione è una `×` discreta nell'angolo, lontana da AVANTI.

**Il velo su desktop mostra due grigi**, ed è normale: la lavagna è `#1F2225` e il fondo pagina `#15171A`, quindi sotto il velo la lavagna resta la zona più chiara. Non è un riquadro di troppo.

**La chiave del «già visto» porta dentro il percorso della pagina.** `localStorage` è per *origine*, non per cartella: tutte le versioni pubblicate sotto `temp/` condividono lo stesso archivio, quindi con una chiave fissa chi aveva visto il tutorial su una cartella non lo vedeva più su quella pubblicata dopo — e la pubblicazione in cartelle numerate, che serve a battere la cache, faceva sparire proprio la cosa da provare. In produzione la lavagna sta a un solo indirizzo e il comportamento è quello voluto.

**Il tratteggio è un `<rect>` SVG, non un `outline`** — cambiato il 18/09/2026 su richiesta del cliente, che lo voleva animato. `stroke-dashoffset` si anima, `outline-style` no: il tratto scorre lungo il perimetro in senso orario, un ciclo da 22px ogni 1,1s, e si ferma con `prefers-reduced-motion`. Due trappole, entrambe già pagate:

- **Un `<svg>` è un elemento rimpiazzato**: con il solo `inset: -4px` resta alla sua dimensione predefinita di 300×150 invece di stirarsi sul riquadro. Servono `width`/`height` espliciti. Le misure di `#spot` erano giuste e il tratteggio stava altrove — se ne accorge solo uno screenshot.
- `width="100%"` va messo come **attributo**, non in CSS: le geometry properties di SVG2 sono recenti, l'attributo lo capiscono tutti.

**Quanto sporge il riquadro fuori dall'elemento detta il margine della mensola.** Sono `pad` (6) + `inset` (4) + mezzo tratto (1,5) = **11,5px**, e su mobile `.ledge` tiene 16px di padding laterale proprio per starci dentro: sotto, il tratteggio degli elementi a filo di schermo — gessetti, cancellino, cestino, SALVA — viene tagliato dal bordo e sembra schiacciato. I due numeri si cambiano insieme.

⚠️ **A 360px la mensola è satura**: il suo min-content misura 326px, quindi oltre i 17px di padding il contenuto non si stringe, *sfora*, e il lato destro torna a filo — peggio di prima. Provato a 20px il 18/09/2026: `.tools` finiva a 346 invece di 340. Chi volesse più margine deve prima far scendere il min-content, non alzare il padding.

**Il `?` sta in fondo alla riga dei comandi, dopo il cestino** — spostato il 18/09/2026 su segnalazione del cliente. Prima era il primo della riga, quindi confinava con gli spessori: si toccava per sbaglio scegliendo un tratto, e il tutorial ripartiva in mezzo a un disegno. È il peggior vicino possibile per un controllo che si usa mentre si disegna. In fondo non confina con niente di analogo, e il `margin` che lo staccava è passato da `right` a `left`.

**Rifai è stato tolto poche ore dopo**, e ha sistemato da solo il resto: `.cmds` è allineato a destra, quindi togliendo un pulsante i comandi sono scivolati là e l'aria fra l'ultimo segno di spessore e annulla è passata da **10px a 54px**. Il vicino pericoloso degli spessori non c'è più.

⚠️ **Ma annulla ora è irreversibile.** Finché c'era rifai, sfiorare annulla costava un secondo; oggi il tratto è perso. È il motivo per cui quei 54px contano più di prima, e per cui la scorciatoia `Ctrl+Y` è stata tolta insieme al pulsante: una via nascosta che rifà contraddirebbe quello che la mensola dichiara. `history.redo()` esiste ancora in `model.js`, ma **nessuno la chiama** — è lì per il giorno in cui la rivolessero.

**Il passo degli spessori punta ai segni, non ai pulsanti.** I `.wbtn` sono alti `--stick-h` (64px sul telefono, 94 sul desktop) perché devono essere bersagli da dito, ma il segno di gesso dentro ne occupa 19: un riquadro attorno al pulsante invadeva i gessetti sopra di 2px e SALVA sotto di 4. Il selettore è `#widths .wbtn i`, così il riquadro abbraccia quel che si vede e la cosa funziona da sola sui due layout, senza una costante da mantenere. Misurato dopo: 15,9px di aria verso i gessetti, 22 verso SALVA.

**L'arancione istituzionale vive qui dentro, e solo qui** (cliente, 18/09/2026: si parla di bambini). Porta **il tratteggio animato e l'etichetta «PASSO n DI 7»** a 11px. Nella mensola non entra: lì nove gessetti portano già informazione col colore, e un tasto arancione pieno sarebbe l'elemento più colorato dello schermo senza dire nulla. Sotto il velo i gessetti sono spenti, quindi l'obiezione cade e l'arancione resta l'unica cosa accesa — che è esattamente il punto.

**Sui tasti c'è passato per un giro, ed è stato tolto** (stesso giorno, richiesta del cliente). AVANTI / HO CAPITO sono tornati alla grammatica dei tasti presa dal sito: testo `#FAF8F3`, bordo `2px #FFFFFF54`, fondo `#FFFFFF1A`. Se qualcuno ci riprovasse, sappia che il contrasto del testo scendeva da 9,69:1 a **3,39:1** e quello del bordo a 2,10:1 — l'arancione istituzionale su un fondo tasto chiaro non ci arriva, e lo sfondo era da lasciare com'era.

⚠️ **Se un giorno si colorano di nuovo, le regole vanno sull'id, non sulla classe.** `#btn-save` è anche lui `.btn.primario`: una regola su `.primario` cola sulla mensola.

**I contrasti, misurati e non dedotti** (fondo pannello `#272C31`, fondo tasto composito `rgb(61,65,70)`):

| | rapporto | soglia | |
|---|---|---|---|
| «PASSO n DI 7» arancione, 11px/700 | 4,64:1 | 4,5 | passa |
| testo del passo, 19px | 12,22:1 | 4,5 | passa |
| HO CAPITO / AVANTI | 9,69:1 | 4,5 | passa |
| RIPETI bianco su trasparente | 13,27:1 | 4,5 | passa |
| bordo del tasto, `#FFFFFF54` | 2,89:1 | 3 | appena sotto |

Il bordo a 2,89 **non è una conseguenza del tutorial**: è la grammatica dei tasti presa dal sito della Fondazione, e vale anche per SALVA nella mensola. Non è l'unico segno che identifica il tasto — ci sono fondo e testo — ma se un giorno serve la conformità piena, si alza lì, una volta per tutti.

**La gerarchia fra i due tasti sta tutta nel contenitore.** Da quando RIPETI è bianco, i due hanno **lo stesso colore di testo**: si distinguono perché HO CAPITO ha fondo e bordo e RIPETI no — un tasto contro un link. Prima RIPETI era a `--dim` e la differenza stava anche nel colore. Funziona, ma è una gerarchia che regge su un solo dispositivo invece che su due: togliere il bordo a HO CAPITO la azzererebbe.

**SALVA spento ha anche il fondo spento** (`#FFFFFF08` invece di `#FFFFFF1A`, cliente 18/09/2026): con il fondo pieno sembrava un tasto premibile con la scritta sbiadita. È l'unico `.btn` che vada mai in `disabled`, quindi la regola sta su `.btn:disabled` e non tocca nient'altro. **Dentro il tutorial il fondo torna pieno** insieme a testo e bordo: al passo 7 l'app sta indicando SALVA e deve mostrarlo com'è da acceso.

**Durante il tutorial i tasti spenti si accendono, ma solo nell'aspetto.** Alla prima apertura non c'è un disegno, quindi annulla, rifai e SALVA sono `disabled` e il cestino sta a `--dim`: quattro passi su sette evidenziavano un'area in cui non si vedeva niente. `data-tutorial` sul `<body>` alza il colore — `disabled` resta, i tasti restano inerti, e comunque il velo intercetta i tocchi. Il contrasto sul fondo della mensola passa da 1,57 a 9,9 su annulla e da 1,57 a 15,06 su SALVA. Per la durata del tutorial il cestino perde la sua gerarchia più bassa: a `--dim` sotto il velo era illeggibile quanto gli altri.

## Salva e scarica il disegno

**Dal 17/09/2026 SCARICA e INVIA sono un tasto solo, SALVA**, che prende il fondo pieno e la piena larghezza su mobile: è l'azione dichiarata della schermata. Oggi scarica e, sul dito, apre il foglio di condivisione. **L'invio al backend si innesterà qui dentro**, in Fase 6, senza toccare la mensola.

Conseguenza da tenere presente: non esiste più il modo di scaricare *senza* inviare. Oggi non si vede, perché l'invio non c'è; quando arriverà va deciso se un solo tocco fa entrambe le cose senza chiedere.

Il download è stato aggiunto il 16/09/2026 su richiesta: è una fetta anticipata della Fase 6 (requisiti in `fase-0-specifiche.md` §7). **Manca il logo della Fondazione**, che è una dipendenza esterna; quando arriva si compone in `disegnaSuCanvas()`, dopo i tratti.

Tutto avviene sul device: nessun server, nessun dato in uscita.

| | |
|---|---|
| Formato | JPEG, qualità 0,92 — ~40 KB su un disegno normale |
| Risoluzione | 1600 px di larghezza, altezza dal rapporto della lavagna |
| Nome | `lavagna-AAAAMMGG-hhmm.jpg` |
| Su telefono | foglio di condivisione (`navigator.share`) |
| Altrove | `<a download>` |

Tre scelte che non si leggono dal codice:

**L'immagine si ri-renderizza dal modello, non si copia dallo schermo.** Il canvas a schermo è grande quanto il viewport — su un telefono 780 px — e §7.4 chiede 1600. Il prezzo è quello già noto: la grana del gesso cambia, la forma no. Chi confronta il file con lo schermo trova lo stesso disegno, non gli stessi pixel.

**Il fondo si dipinge dopo i tratti, in `destination-over`.** Dipingerlo prima sarebbe più naturale, ma il cancellino lavora in `destination-out` e lo bucherebbe: il JPEG non ha alpha, e le gommate tornerebbero fuori come macchie nere. È lo stesso motivo per cui a schermo il fondo sta nel CSS.

**Il Blob si costruisce in modo sincrono**, con `toDataURL` + `atob` invece di `canvas.toBlob`. Non è pignoleria: `navigator.share()` pretende di essere chiamato mentre l'attivazione del tocco è ancora valida, e una callback asincrona la perde. Il sintomo, su iPhone, è un pulsante che non apre niente.

Il pulsante resta spento finché non c'è un tratto di gesso: una lavagna di sole gommate non è un disegno.

**Da provare su device vero**: il ramo `navigator.share` è verificato solo in simulazione (stub su Chrome desktop). Su iOS il file deve finire in Foto, non nei Download.

## File

```
index.html      pagina + CSS anti-scroll (la parte fragile su iOS)
package.json    solo per dire a node che i .js sono ES modules
src/palette.js  costanti da fase-0-specifiche.md
src/board.js    due canvas, DPR, schermo -> lavagna logica
src/input.js    pointer events, un dito solo, coalesced
src/filter.js   One Euro Filter
src/geom.js     Catmull-Rom, ricampionamento, RDP
src/model.js    Drawing / Stroke, undo, redo
src/pen.js      costruisce lo stroke mentre il dito si muove
src/render.js   render puro e deterministico
src/export.js   il disegno in JPEG, download o foglio di condivisione
src/tutorial.js i sette passi, il riquadro e il "gia visto"
src/main.js     colla e diagnostica
test/run.js     test delle funzioni pure
font/           i .woff2 della Fondazione, NON versionati (vedi sopra)
```

I due canvas (`base` e `overlay`) servono perché a fine gesto lo stroke grezzo viene sostituito da quello semplificato: con un canvas solo, cancellare il tratto provvisorio costringerebbe a un ridisegno completo a ogni tratto.
