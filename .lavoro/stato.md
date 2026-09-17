# Stato — Lavagna (FRRM - Drawing plugin)
Ultimo aggiornamento: 17/09/2026
Versione corrente: prototipo fasi 0–4 + 4b (tutorial) + download del disegno. Nessun numero di versione.

## Dove siamo

Si disegna a gesso su lavagna nera con nove gessetti, tre spessori, cancellino, annulla/rifai: validato su iPhone 13 Pro e Galaxy S10 a 60 fps. Dal 16/09/2026 il disegno si **scarica in JPEG** sul proprio device (`src/export.js`), senza logo e senza backend. Dal 17/09/2026 c'è un **tutorial in sette passi** che parte alla prima apertura (`src/tutorial.js`), SCARICA e INVIA sono diventati un solo **SALVA**, e i tasti hanno preso lo stile del sito della Fondazione.

Online su <https://issimissimo.com/temp/frmm-drawing-plugin-01/> — cartella numerata, **niente query string** (17/09/2026, vedi le trappole). Codice su <https://github.com/issimissimo/frrm-drawing-plugin>, 37 test (`node test/run.js`).

## Piano attivo

Obiettivo: un bambino che apre la lavagna e non sa cosa fare capisce da sé che si disegna col dito e a cosa servono gli strumenti — chiesto dal cliente il 17/09/2026, che riferisce persone bloccate davanti alla lavagna vuota. Nella stessa tornata, **SCARICA e INVIA diventano un tasto solo, SALVA**.

Criterio di finito:

- Su iPhone 13 Pro e Galaxy S10, alla **prima** apertura il tutorial parte da solo; chiuso e ricaricata la pagina, non riparte; l'icona `?` lo riapre. La prova vale su device reale, non su Chrome desktop.
- Ognuno dei 7 step tiene il riquadro **sull'area giusta in entrambi i layout** (desktop a una riga, mobile a tre righe), verificato dopo una rotazione dello schermo.
- La mensola non perde niente per far posto al `?`: i nove gessetti restano della larghezza di oggi a 360 px.
- Il tutorial non disegna: aperto e chiuso senza toccare la lavagna, `history.count` resta 0 e SALVA resta spento.
- La suite passa (oggi 37 test), con casi nuovi sulla geometria del riquadro e sulla macchina a stati degli step.

Fuori perimetro, e va detto se ci si avvicina:

- **L'invio al backend.** SALVA oggi scarica e basta. Nessuna chiamata di rete, nessun endpoint, nessuna conferma di invio: è Fase 6 e resta chiusa.
- **Il TODO spessore/velocità**, che resta aperto qui sotto e non viene toccato da questo fronte.
- Persistenza vera (IndexedDB, Fase 5). Il "già visto" del tutorial è **un flag in localStorage**, tre righe, e non diventa un archivio.
- Animazioni, mascotte, voce narrante, mano che disegna da sola. Se il testo non basta, si decide dopo con una prova in mano.
- Traduzioni. Solo italiano.

Passi:

1. [x] **Tasto unico SALVA** — fatto. `#btn-send` non esiste più; `#btn-save` prende il fondo pieno e, su mobile, l'ultima riga a piena larghezza.
2. [x] **Prova di design del tutorial** — fatta il 17/09/2026, `design-tutorial/prova.html`. Riproduce la mensola vera e ci mette sopra il tutorial, con gli assi confrontabili a schermo. Verificata a 1440×900 e 390×844: in tutti e 7 gli step il riquadro cade sull'elemento giusto e la finestra non copre l'area in luce (0%).

   **Design chiuso il 17/09/2026. v5, l'ultima, online su <https://issimissimo.com/temp/frmm-tutorial-design-05/>** (le precedenti si tengono per confronto).

3. [x] **Design approvato il 17/09/2026**, con le correzioni chieste, tutte applicate in v2:
   - evidenziazione **buio+gesso**, testi **da bambino**, SALVA **largo**;
   - «TUTORIAL: PASSO n DI 7» al posto di «PASSO n DI 7»;
   - **nessun CHIUDI negli step 1–6** e «PROCEDI» rinominato **PROSSIMO**, per non far chiudere il tutorial per sbaglio;
   - allo step 7 **RIPETI** (testo nudo, riavvia) accanto a **HO CAPITO** (pieno, chiude).

   Resta da scegliere **l'accento**: gesso (come oggi) / arancio sobrio (bordo e testo `#FF6000`) / arancio pieno. Tre varianti nel pannello della prova.

   **Secondo giro di correzioni, 17/09/2026, tutte in v3.** Da qui esce la grammatica dei tasti, che vale per l'app intera e non solo per il tutorial:

   - **Un tasto è: fondo `#FFFFFF1A`, bordo `2px #FFFFFF54`, raggio 0.** Uguale per tutti.
   - **L'icona sta sempre a destra del testo**, dimensionata `1em` così segue il corpo invece di avere una misura sua.
   - **Corpo del testo `--btn-size`**: `clamp(0.8rem, 0.9vw, 1rem)` da 1025 px, `16px` fino a 1024, `14px` fino a 767. Le soglie sono quelle di **Elementor**, non i 700 px con cui l'app cambia layout: i valori vengono dal sito, e tenerli allineati evita che mensola e sito dicano corpi diversi. Conferma che i numeri sono giusti: a 1440 px il clamp dà **12,96 px**, esattamente il corpo del pulsante DONA misurato sul sito.
   - **La finestra del tutorial non ha bordo**: si stacca dal velo con la sola ombra.
   - **I tasti della finestra sono allineati a sinistra**, con il primario per primo nel DOM così «HO CAPITO» si legge prima di «RIPETI».
   - **Lo step 1 dice «col dito» o «col mouse»** secondo `matchMedia('(pointer: coarse)')` — lo stesso criterio con cui `export.js` decide del foglio di condivisione: dice con che cosa si tocca lo schermo, non quanto è grande. Una finestra desktop stretta resta «mouse», un tablet grande resta «dito».
   - **Le icone sono path di Font Awesome 6 Solid messi inline** (`arrow-right` su PROSSIMO, `check` su HO CAPITO): l'icona è una, e tirarsi dietro la libreria vorrebbe dire una richiesta esterna e ~100 KB. Dentro WordPress Font Awesome c'è già e si potrà passare a `<i class="fa-solid fa-arrow-right">` senza toccare altro.
   - **Tasti a `font-weight: 300`, testo della finestra a `17px`** (ultimo giro). Attenzione: **300 non esiste in SebinoSoft**, che ha 400 / 500 / 700 — il browser lo mappa sul 400, verificato misurando (peso 300 e peso 400 danno la stessa larghezza al pixel). Quello che si vede è il Regular, non un Light: per un Light vero servirebbe un `SebinoSoft-Light.woff2`, che sul sito della Fondazione non c'è. Il `17px` del testo è fisso e non varia più col device: la media query che lo portava a 19px è stata rimossa.
4. [x] **Il motore** — `prototipo/src/tutorial.js`. Le parti calcolate (`areaUnione`, `posizionaFinestra`, `testoStep`, `giaVisto`/`segnaVisto`) sono pure e sotto test; il DOM lo tocca solo `createTutorial()`.
5. [x] **I 7 step come dati**: `STEPS`, una lista di `{ sel, pad, testo }`. Cambiare una frase non tocca il motore.
6. [x] **Prima apertura e riapertura**: flag `localStorage` con try/catch su lettura *e* scrittura, icona `?` in testa alla fila dei comandi.
7. [x] **Verificato in Chrome e documentato.** `README.md` e `CLAUDE.md` aggiornati. **Resta da provare sui due device reali** (vedi sotto).

**Online: <https://issimissimo.com/temp/frmm-drawing-plugin-05/>.** Le precedenti hanno difetti noti e non vanno date a nessuno: nella `-02` RIPETI si vede a ogni passo, nella `-03` i tasti spenti sono illeggibili nei passi che li spiegano, nella `-04` il tutorial non parte a chi aveva già visto una versione precedente.

**`?tutorial` in coda all'URL lo fa partire comunque**, qualunque cosa dica lo storage. Serve a provarlo e a mostrarlo a qualcuno senza svuotare il browser — che è l'unica altra via e non è una cosa da chiedere a un cliente.

### Il "già visto" e le cartelle numerate si pestavano i piedi

**Trovato il 17/09/2026 provando la `-04`: il tutorial non partiva più.** Non era un caso limite, ed era una collisione fra due meccanismi introdotti nella stessa giornata:

- si pubblica in **cartelle numerate** per battere la cache di SiteGround;
- il "già visto" stava in `localStorage`, che è **per origine, non per cartella**.

Quindi tutte le versioni sotto `issimissimo.com/temp/` condividevano lo stesso archivio: chiuso il tutorial sulla `-03`, la `-04` lo leggeva come già visto e non partiva. La pubblicazione in cartella nuova, che serve a *mostrare* la novità, faceva sparire proprio la cosa da provare. Riprodotto in laboratorio prima di correggere: chiuso sulla `-03`, aperta la `-04`, tutorial assente.

Risolto legando la chiave al percorso — `lavagna.tutorial.visto.v1:/temp/frmm-drawing-plugin-05/` — così ogni versione pubblicata è nuova per il browser. In produzione la lavagna sta a un solo indirizzo e il comportamento è quello voluto; se quella pagina cambiasse percorso, il tutorial ripartirebbe una volta per tutti, che è il verso giusto in cui sbagliare.

Verificato online sul browser che portava ancora il flag della `-03`: sulla `-05` il tutorial parte, chiuso non riparte al reload, e `?tutorial` lo riapre.

**Riaperta il 17/09/2026: i tasti spenti erano illeggibili proprio nei passi che li spiegano.** Alla prima apertura non c'è ancora un disegno, quindi annulla, rifai e SALVA sono `disabled` e il cestino sta a `--dim`: quattro passi su sette evidenziavano un'area in cui non si vedeva nulla. Era un difetto vero, non un dettaglio, e l'unico modo di trovarlo era usare l'app — il controllo automatico guardava che il riquadro fosse nel posto giusto, non che dentro ci fosse qualcosa di visibile.

Risolto con `data-tutorial` sul `<body>`, che mentre il tutorial è aperto cambia **solo l'aspetto**: `disabled` resta, i tasti restano inerti, e comunque il velo intercetta i tocchi. Misurato sul contrasto contro il fondo della mensola, non a occhio:

| | prima | durante il tutorial |
|---|---|---|
| annulla / rifai | 1,57 | **9,9** |
| cestino | 4,0 | **9,9** |
| SALVA | 1,57 | **15,06** |

Effetto collaterale accettato: per la durata del tutorial il cestino perde la sua gerarchia più bassa e pesa come annulla e rifai. A `--dim` sotto il velo era altrettanto illeggibile.

Criterio di finito, verificato in Chrome a 1440×900 e 390×844:

| | esito |
|---|---|
| parte da solo alla prima apertura | sì |
| ricaricando non riparte | sì (`lavagna.tutorial.visto.v1` = `1`) |
| il `?` lo riapre dal passo 1 | sì |
| il riquadro cade sull'elemento giusto, 7 passi su 7 | sì, anche dopo un `resize` |
| la finestra non copre l'area in luce | 0% su tutti e 7 |
| durante il tutorial non si disegna | sì: `elementFromPoint` sul centro della lavagna dà `#tut`, e dopo la chiusura il canvas ha 0 pixel dipinti e SALVA è spento |
| si disegna dopo la chiusura | sì, e SALVA si accende |
| suite | 43 test, 0 falliti |

**Il difetto che il controllo automatico non aveva visto.** RIPETI compariva a ogni passo: il CSS nascondeva `#tut-ripeti` mentre l'elemento si chiama `#btn-ripeti`, e `.btn` è `inline-flex`, che vince sul `display:none` implicito dell'attributo `hidden`. Lo controllavo leggendo **l'attributo** `hidden`, che era corretto — la misura giusta è `offsetParent !== null`, cioè la visibilità resa. Ora la regola è `.btn[hidden] { display: none }`, che copre qualunque tasto futuro.

### Lo stile del sito della Fondazione — misurato, non dedotto (17/09/2026)

Rilevato aprendo <https://fondazione-riccardo-marina-mantovani.org/> e leggendo le variabili del tema, non a occhio:

| | valore |
|---|---|
| fondo del sito | `#FF6000` — l'arancione **è il fondo**, non un accento |
| pulsante primario (DONA) | `#FF0505`, squadrato, maiuscolo, `letter-spacing .3px`, padding 12/24 |
| raggi | `0px` su tutto |
| bordi e testi su arancione | bianco a opacità variabile: `#FFFFFF63`, `#FFFFFF54`, `#FFFFFFA6`, `#FFFFFFE3` — è il «quasi bianco» |
| font | `SebinoSoft-Regular` / `-Medium` / `-Bold` (non «Sebino-Soft-…»), woff2 da 16–24 KB |

Applicato in v2 della prova: raggio 0, bordo quasi bianco al posto dell'ombra, font SebinoSoft.

- **I font si possono usare subito, ma non dal loro URL.** I file sono pubblici su `wp-content/uploads/2026/{05,06}/`, e **non hanno l'header CORS**: cross-origin il browser li rifiuta. Vanno copiati same-origin. Dentro WordPress il problema non esiste — li carica Elementor.
- **I font NON sono nel repo**, che è pubblico: `SebinoSoft` è un font commerciale di terzi. Stanno in `design-tutorial/font/`, in `.gitignore`, e si riscaricano dal sito (URL nel blocco `@font-face` della prova). Da verificare che la licenza webfont copra `issimissimo.com`, dove la prova è pubblicata: è un dominio diverso da quello della Fondazione.
- **SebinoSoft è il 15% più larga** di Atkinson Hyperlegible a pari corpo (272 px contro 236 su una stringa di prova). Nessuno dei testi sfora, verificato a 390 px, ma i margini si sono assottigliati.
- **L'arancione istituzionale è il problema di design vero, non un dettaglio.** La mensola è acromatica per necessità: nove gessetti portano informazione col colore, e c'è già un arancio `#F1A366` in palette. Un SALVA `#FF6000` pieno a tutta larghezza diventa l'elemento più colorato dello schermo e non dice nulla — è lo stesso difetto del riquadro rosso. Da qui la terza variante, `arancio sobrio`: bordo e testo arancione su fondo scuro, che richiama il brand restando nel registro a linee dell'app.

Trovato montando la prova di design (17/09/2026):

- **Il velo scuro funziona**, e il rischio dichiarato non si è materializzato: su lavagna `#1F2225` con un disegno sopra, un velo a `rgba(8,9,11,.78)` legge come "guarda qui" e non come "app spenta". Serve però **un bordo sul buco**: senza, il confine fra area in luce e velo non si vede.
- **La quarta combinazione è meglio delle tre pensate**: velo forte **più** il riquadro tratteggiato a gesso. Il velo porta l'attenzione, il tratteggio bianco dice con che mano è stato fatto, e non introduce un linguaggio estraneo all'app. È il default della prova (`buio+gesso`). Costo: una riga di CSS.
- **Il riquadro rosso mette in evidenza il gessetto rosso.** Non era teoria: nello step dei colori il riquadro corre attorno alla palette e passa sul gessetto rosso, che a colpo d'occhio sembra selezionato. Verificato a schermo.
- **"La finestra al centro" non può stare al centro sempre.** Allo step 0 l'area evidenziata *è* il centro e la finestra la coprirebbe. Risolto mettendola nella metà opposta a quella dove cade l'area: misurato, copre lo 0% dell'area in luce in tutti e 7 gli step, su desktop e su mobile.

Rischi aperti:

- **Il tutorial punta a elementi che su mobile stanno altrove.** La mensola cambia griglia sotto i 700 px: il riquadro va preso dall'elemento, mai da coordinate scritte a mano. Nella prova è già così (`getBoundingClientRect` su un selettore, con l'unione dei rettangoli per lo step annulla/rifai, che sono due pulsanti ma un concetto).
- **Sei-sette finestre di testo per un bambino di 5 anni si saltano.** È il rischio di fondo: se non funziona, non è colpa dell'implementazione ma della forma scelta, e va detto al cliente prima di irrobustirla.
- **Nessuno degli step chiesti dal cliente spiegava di disegnare col dito.** Aggiunto come step 0 il 17/09/2026; è l'ipotesi su *cosa* non capiscono davvero, e va verificata su una persona vera, non su di noi.
- **Un tasto solo al posto di due** toglie la possibilità di scaricare senza inviare. Oggi non si vede, perché l'invio non esiste; quando arriverà, va deciso se un solo tocco fa entrambe le cose senza chiedere. Decisione rinviata, non risolta.
- **Senza CHIUDI negli step 1–6 non c'è via d'uscita** fino alla fine: chi riapre il tutorial col `?` per sbaglio deve fare sette tocchi. È voluto (chiesto il 17/09/2026 per non farlo chiudere involontariamente), ma se dà fastidio la correzione è una `×` discreta nell'angolo della finestra, lontana da PROSSIMO.
- **RIPETI ha perso il bordo** (17/09/2026) perché con fondo e bordo uguali a HO CAPITO i due tasti si somigliavano troppo e allo step 7 si rischiava il tocco sbagliato. Il bordo è `transparent`, non rimosso, così i due tasti restano della stessa altezza e con il testo sulla stessa linea di base. **Il fondo `#FFFFFF1A` ce l'ha ancora**: se la distinzione non basta, il passo successivo è togliere anche quello.
- **Due punti dove la regola «tutti i tasti» non è stata applicata alla lettera**, in attesa di conferma: «Torna al sito» tiene la freccia **a sinistra** (è una freccia che indica indietro: a destra del testo direbbe «avanti»), e non ha né fondo né bordo, come il `?`, i gessetti, il cancellino, gli spessori e annulla/rifai/cestino. Dare fondo e bordo anche a quelli trasformerebbe la mensola in una griglia di scatole.
- **Domanda di Fase 7 da porre prima di scrivere il plugin: la lavagna andrà in un iframe o inline nella pagina Elementor?** Cambia due cose già oggi: inline i font arrivano gratis ma il CSS del tema può interferire con la mensola; in iframe l'app è isolata ma i font vanno ricaricati. Non va deciso ora, va deciso **prima** di costruire l'integrazione.
- **Una lavagna nera dentro una pagina a fondo `#FF6000`.** L'accostamento è brutale e nessuno l'ha ancora visto: la prova sta su fondo scuro, da sola. Va guardato in una pagina arancione vera prima del go-live, e probabilmente serve una cornice o un margine.
- **L'icona `?` occupa spazio in una mensola già piena.** A 360 px i gessetti sono il primo elemento che si stringe.

Costo stimato: 7 passi, di cui uno (il passo 1) si chiude in mezz'ora e uno (il passo 3) è un'attesa. Il grosso è il motore del tutorial. Ordine di grandezza: due sessioni, la prima delle quali finisce sulla prova di design.

**Lo chiamo Fase 4b, non Fase 11**: è UI e si appoggia alla Fase 4, così la numerazione del brief non si tocca.

---

Il resto, aperto da prima e non toccato da questo fronte. **In attesa del feedback del cliente** su effetto gesso, spessori e UI, richiesto il 15/09/2026 — il tutorial è arrivato come richiesta a parte, non è la risposta a quella domanda. Le fasi 5+ (IndexedDB, export con logo, plugin WP, moderazione, gallery, go-live) si riaprono **esplicitamente**, mai per scivolamento.

Due cose aperte, nessuna delle due è "una fase":

### Spessore del tratto in base alla velocità — chiuso, si resta così

**Chiuso il 17/09/2026 per decisione di Daniele: non si tocca più.** Lo stato attuale (terza riga della tabella) è quello definitivo. Quel che segue si tiene solo perché, se qualcuno riaprisse la questione, ricominciare dalla taratura sarebbe la terza volta a vuoto.

| | `PRESSURE_MIN` | `PRESSURE_ALPHA_MIN` | variazione misurata | esito |
|---|---|---|---|---|
| originale | 0,35 | 0,55 | ~65% | "si restringe troppo" |
| 1° tentativo | 0,92 | 0,90 | 13 / 12 / 9% | "identico, non c'è distinzione" |
| 2° tentativo | **0,84** | **0,85** | 21 / 21 / 16% | **"non hai risolto"** ← stato attuale |

**Il punto non è ritarare: è che la misura non descrive il fenomeno.** La metrica usata è la banda resa a soglia di opacità 0,25, con pressione **imposta** a `p=0` o `p=1`. Dice 21%, l'occhio dice di no. Ipotesi in ordine di probabilità:

1. **`SPEED_MAX = 2200` unità/s è fuori scala** rispetto ai gesti veri: se stanno molto sotto, `p` resta alto e il tratto non si assottiglia mai, qualunque siano le due costanti. La meno costosa da verificare.
2. **La `p` reale durante un gesto non arriva mai agli estremi** — mai misurata. Da strumentare: registrare `speed` e `smoothed` su un tratto vero e guardarne l'istogramma.
3. **Il filtro sulla pressione è lento**: `smoothed += (target - smoothed) * 0.25` in `pen.js`, con ~55 campioni/s.
4. Il segnale mancante potrebbe essere la **densità** più che la larghezza: il gesso mosso veloce deposita meno materiale.

**Da non rifare:** ritarare le due costanti alla cieca. Combinazioni già misurate in `fase-0-specifiche.md` §4.1.

### Manca la prova su telefono vero — due cose, una sola sessione

Entrambe si verificano aprendo <https://issimissimo.com/temp/frmm-drawing-plugin-03/> su iPhone 13 Pro e Galaxy S10:

1. **Il tutorial.** Tutto il criterio di finito è stato verificato in Chrome, non su iOS. Da guardare: che il velo si legga su uno schermo vero con la luminosità di un telefono, che il passo 1 dica «col dito» (`pointer: coarse`), e che ruotando lo schermo a tutorial aperto il riquadro segua la mensola.
2. **Il download.** Il ramo `navigator.share` è verificato solo con stub su Chrome desktop. Su iOS il file deve finire in **Foto**, non nei Download di Safari — è tutta la ragione per cui quel ramo esiste.

Sospeso anche: **il tutorial funziona?** Nessun test lo dice. Lo dice una persona che non ha mai visto l'app — preferibilmente un bambino.

## Decisioni prese e perché

- **Perimetro Fasi 1–3**, riaperto per la Fase 4 (UI) e, il 16/09/2026, per il solo **download** (fetta di Fase 6, su richiesta esplicita). Le fasi 5+ restano chiuse.
- **Nessun nickname, nessuna attribuzione**: i disegni sono anonimi, e cade l'intero capitolo consenso genitoriale.
- **Fondo lavagna a colore pieno, senza texture.** Ne discende che il canvas dei tratti è trasparente e il fondo sta nel CSS: altrimenti la gomma in `destination-out` aprirebbe buchi neri invece di scoprire la lavagna.
- **Nell'export il fondo si dipinge dopo i tratti**, in `destination-over`, per lo stesso motivo: il JPEG non ha alpha, e dipinto prima restituirebbe le gommate come macchie nere.
- **Il download ri-renderizza dal modello**, non copia il canvas a schermo: a schermo la lavagna è larga quanto il viewport (780 px su un telefono) e l'export deve stare a 1600 px (§7.4). Si paga la solita divergenza di grana; la forma no.
- **Il Blob dell'export si costruisce sincrono** (`toDataURL` + `atob`): `navigator.share()` pretende l'attivazione del tocco ancora valida, e una callback asincrona la perde.
- **Foglio di condivisione solo col dito** (`pointer: coarse`), non ovunque `canShare` esista: Chrome su Windows lo dichiara, e aprirebbe il pannello di Windows a chi ha premuto "Scarica".
- **Si salvano i punti radi, non quelli ricampionati**: il ricampionamento al render è deterministico, e conservarlo moltiplicherebbe per dieci il payload.
- **Lo smoothing si governa con l'epsilon RDP, non col filtro.**
- **A fine gesto non si ridisegna mai dal modello**: si travasano i pixel già a schermo. Senza, il tratto saltava del 42% al rilascio.
- **La punta di gesso ha dimensione fissa**: un tratto largo si ottiene affiancando più impronte. Il gesso vero ha *più* grana, non grana più grande.
- **Rosso e marrone escono dalla serie isoluminante** (cliente, 15/09/2026): a L 0.780 il rosso è un rosa salmone e il marrone non esiste. Costano contrasto, 4,6 e 4,3 contro 7,6–8,4.
- **Spessori a 21 / 27 / 50** (`WIDTHS`), alzati il 15/09/2026 perché sottile e medio erano troppo esili, e raddoppiati sotto i 700 px da `SCALA_STRUMENTI`. Il passo fra i tre è 1,29× e 1,85×: il salto sottile→medio è piccolo, e il commento in `palette.js` che promette «rapporto 2.2x» è rimasto indietro. Qui era scritto 16 / 28 / 44, valori che il codice non ha mai avuto — corretto il 17/09/2026.
- **Commit automatico su GitHub a feature completata e verificata.**
- **MCP playwright pinnato a 0.0.81**, non `@latest`: aggiornamenti a mano, in cambio di avvii che non vanno in timeout.

## Trappole

- **La cache di SiteGround si batte con una cartella nuova, non con la query string** (17/09/2026). Storia in due atti:

  Il 16/09/2026 il proxy serviva l'URL della cartella da cache (`x-proxy-cache: HIT`, vecchio di giorni) e i file con `max-age` di sei mesi / un anno, quindi il browser di chi aveva già visto la pagina si teneva `index.html` e i `.js` — combinazione che uccideva il modulo. Il rimedio era `.../index.html?v=<n>`. Un `.htaccess` con `Header set Cache-Control` non serve a niente (provato e rimosso): quelle intestazioni le mette NGINX davanti ad Apache.

  Il 17/09/2026 le risposte **non portano più né `cache-control` né `expires`**, e il proxy risponde `x-proxy-cache-info: DT:1` invece di `HIT` — misurato sulla cartella vecchia *e* sulla nuova, quindi è cambiato lato hosting, non per effetto della pubblicazione. Il rimedio adottato non dipende da questo: **ogni consegna va in una cartella numerata nuova** (`-01`, `-02`, …), che nessuna cache può avere visto. Vale qualunque cosa faccia l'hosting, e il link che arriva al cliente è pulito. Script: `.lavoro/pubblica.sh <NN>`, che si rifiuta di scrivere sopra una cartella esistente.
- **Gli elementi nuovi della UI si cercano con la guardia** (`btnSave?.`): per la trappola qui sopra, un `index.html` vecchio incontra un `main.js` nuovo, e un `getElementById` che torna `null` non fa perdere un pulsante — uccide il modulo e la lavagna non si apre affatto. Già successo, in produzione, il 16/09/2026.
- **`getCoalescedEvents` è assente su entrambi i device** di test, e il rAF gira a 60 Hz anche sull'iPhone ProMotion: ~55 campioni/s, radi. È il motivo per cui il ricampionamento **interpola su una curva** invece di decimare.
- **`performance.now()` è quantizzato a 1 ms su Safari iOS.** Le misure di singolo frame non valgono lì: si legge `FPS TRATTO` nel pannello di diagnostica.
- **Il livello dei tratti diverge dal modello.** Si riallinea su undo/redo/resize, e lì la grana cambia (~30% dei pixel), la forma no. È voluto, e vale anche per il file scaricato.
- **Vicolo cieco già percorso**: legare l'aspetto del timbro alla *posizione* anziché alla sequenza sembra la soluzione elegante al salto del tratto, e invece peggiora.
- **Alzare `minCutoff` o `beta` per avere più smoothing non funziona**: il tremore gonfia la stima di velocità e il filtro lo scambia per un gesto veloce.
- **`puntaBase()` non è monotona**: a 14 unità la punta vale 14, a 16 scende a 10, perché superata `PUNTA` le impronte affiancate saltano da 1 a 2. Il sottile ha grana più fine del 21% rispetto agli altri due. Debito noto.
- **Due nomi diversi, voluto**: online è `frmm`, la cartella locale e il repo sono `frrm` (refuso). Non "correggere" l'FTP riportandolo a `frrm`.
- **Le credenziali FTP aprono l'intero account SiteGround**, dove convivono altri domini e lavori di clienti. Operare solo dentro `/issimissimo.com/public_html/temp/frmm-drawing-plugin/`, sempre con un listing prima di scrivere.
- **Il token GitHub è in chiaro** in `~/.claude/.secrets/github-pat.txt`, nella configurazione MCP utente e nel transcript della chat del 05/09/2026: **da revocare e rigenerare**.
- Il `.md` del brief ha il markdown escapato (`\---`, `\*\*`). È voluto, non va ripulito.

## Prossimo passo

Il TODO prioritario: misurare la `p` reale di un gesto e verificare l'ipotesi 1 (`SPEED_MAX` fuori scala). Niente taratura prima della misura.
