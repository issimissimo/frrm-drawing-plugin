# Stato — Lavagna (FRRM - Drawing plugin)
Ultimo aggiornamento: 18/09/2026
Versione corrente: prototipo fasi 0–4b. Nessun numero di versione.

## Dove siamo

Si disegna a gesso su lavagna nera con nove gessetti, tre spessori, cancellino, annulla (senza rifai), e il disegno si **scarica in JPEG** sul device. Dal 17/09/2026 c'è un **tutorial in sette passi** che parte alla prima apertura, SCARICA e INVIA sono un solo **SALVA**, e i tasti hanno lo stile del sito della Fondazione.

Online: <https://issimissimo.com/temp/frmm-drawing-plugin-09/> (con `?tutorial` il tutorial parte comunque). Codice su <https://github.com/issimissimo/frrm-drawing-plugin>, **44 test** (`node test/run.js`).

**Provato su telefono il 18/09/2026: il tutorial funziona e SALVA funziona.** Cadono i due punti che erano in sospeso dal 17/09. Resta non fatta la sola verifica che nessun automatismo può dare: **il test con un bambino**, che è la DoD della Fase 4 nel brief e non è mai stata soddisfatta.

## Piano attivo

Obiettivo: la lavagna si apre dentro una pagina del sito WordPress della Fondazione, inserita da un **shortcode**, e continua a funzionare come funziona oggi sul telefono. È la **Fase 8** del brief; le fasi 5, 6 e 7 restano chiuse, quindi SALVA continuerà a scaricare e non a inviare.

> ⚠️ **Numerazione corretta il 18/09/2026.** Fino a ieri questa fase era chiamata «Fase 7», che nel brief è invece il **backend** (inbox, CPT, REST, moderazione). L'errore aveva fatto sparire dall'elenco operativo la **Fase 9 del brief — hardening, legale, QA**: privacy policy, testo di consenso, anti-abuso, retention. Su un progetto che raccoglie disegni di bambini non è una fase che si può perdere. La numerazione del brief è l'unica valida: 7 backend, 8 integrazione WP, 9 hardening/legale, 10 gallery e go-live.
>
> Fare la 8 prima della 7 è una scelta, non un errore: SALVA scarica e basta, quindi l'integrazione non ha bisogno del backend. Ma **il plugin nasce una volta sola**: va progettato sapendo che dovrà ospitare anche CPT e REST, non solo uno shortcode.

**Tre decisioni da prendere prima di scrivere una riga.** Sono la ragione per cui questa fase non comincia dal codice:

1. **Pagina dedicata o lavagna dentro una pagina normale?** È la domanda che viene prima di iframe/inline, e il brief l'aveva già decisa: la Fase 8 prescrive il template **Elementor Canvas**, «niente header/footer che rubano altezza verticale». Su una pagina Canvas la lavagna è sola, `html, body { position: fixed }` torna applicabile quasi com'è, e il rischio principale si sgonfia.

   ⏳ **In attesa: Daniele lo chiede alla Fondazione** (18/09/2026). Finché non arriva la risposta, la Fase 8 non si apre — le decisioni 2 e 3 dipendono da questa.
2. **Iframe o inline?** Dipende dalla 1. Con una pagina Canvas l'inline diventa praticabile e resta solo un problema di prefissi e specificità (CSS di Elementor su `button` e sulla tipografia, id generici `#hud`/`#tut`). Dentro una pagina normale, con header e footer, l'iframe è l'unica risposta sensata. Vedi «Il nodo dell'integrazione» sotto.
3. **Dove si prova?** Installare un plugin non provato sul sito di produzione di una Fondazione non si fa. Serve sapere se esiste uno **staging** su SiteGround, o se si prova su un WordPress locale. Senza questa risposta il piano non ha un posto dove atterrare.

Criterio di finito (da confermare quando le due decisioni sono prese):

- Lo shortcode `[lavagna]` in una pagina Elementor apre la lavagna, e **sul telefono vale ancora la DoD della Fase 1**: si disegna a 60 fps, la pagina non scorre mentre si disegna, niente pull-to-refresh, niente zoom da doppio tap, il palmo appoggiato non disegna.
- Il tutorial parte alla prima apertura **dentro la pagina** e non riparte alla seconda.
- I font arrivano da Elementor e la lavagna non eredita stili del tema che ne cambino la mensola.
- «Torna al sito» porta a una pagina del sito, non a una pagina bianca.
- La pagina che ospita la lavagna scorre normalmente **fuori** dall'area di disegno.

Fuori perimetro, e va detto se ci si avvicina:

- **L'export completo** (Fase 6), **la persistenza locale** (Fase 5) e **il backend** (Fase 7). SALVA scarica, punto.
- **Hardening e legale** (Fase 9), **gallery e go-live** (Fase 10).
- Il logo nell'export: dipendenza esterna ancora aperta.
- Qualunque modifica al motore del gesso. Se l'integrazione sembra chiederla, è il segno che la strada scelta è sbagliata.

Passi:

1. [ ] **Rispondere alle tre decisioni qui sopra.** Punto di fermata.
2. [x] **Provare il prototipo attuale sul telefono** — fatto il 18/09/2026: tutorial e SALVA funzionano.
3. [ ] **Il plugin minimo**: una cartella `lavagna/` con l'header del plugin e uno shortcode che stampa l'app. Nessuna opzione, nessuna pagina di amministrazione.
4. [ ] **Far convivere l'app con la pagina**: scroll, altezza, safe area, e «Torna al sito» che deve portare da qualche parte di sensato.
5. [ ] **Prova su device dentro la pagina vera**, con la DoD della Fase 1 ripetuta lì.
6. [ ] **Guardare la lavagna nera dentro una pagina a fondo `#FF6000`** e decidere se serve una cornice. Finora nessuno l'ha vista.

Rischi aperti:

- **La gestione dello scroll è la cosa più fragile che tocchiamo.** Tutta la tenuta su iOS della Fase 1 è costruita su `html, body { position: fixed }`. Quanto sia un rischio dipende dalla decisione 1: in una pagina **Elementor Canvas** quelle regole tornano applicabili quasi com'è, perché nella pagina non c'è altro da far scorrere; in una pagina normale con header e footer non si possono mettere, e andrebbe riscritta la strategia — che è la DoD della Fase 1.
- **Il CSS di Elementor e del tema.** Inline, la mensola erediterebbe regole su `button`, `padding`, `box-sizing` e la tipografia globale. In iframe il problema non esiste.
- **Il plugin va su un sito di terzi**, vivo, di una Fondazione. Ogni prova ha un pubblico.
- **Un plugin è codice destinato a durare.** Fra sei mesi nessuno ricorderà com'è fatto: merita un README suo dentro la cartella del plugin.

Costo stimato: 6 passi, di cui due sono attese o prove su device. L'ordine di grandezza dipende tutto dalla decisione 1: in iframe è una sessione, inline sono diverse e con il rischio di rompere la Fase 1.

### Il nodo dell'integrazione: iframe o inline

> **Il brief aveva già sciolto questo nodo, e la sessione del 17/09 non se n'era accorta.** La Fase 8 prescrive il template **Elementor Canvas**: senza header né footer, nella pagina non c'è altro da far scorrere e il punto qui sotto quasi decade. Quanto segue vale integralmente solo nell'ipotesi di una pagina normale.

**Inline** (lo shortcode stampa l'HTML della lavagna nella pagina): i font arrivano gratis da Elementor e non c'è un iframe da dimensionare. Ma:

- l'app blocca lo scroll con `html, body { position: fixed; overflow: hidden }`, e in una pagina che ha header, contenuto e footer quelle regole non si possono applicare: andrebbe riscritta la strategia anti-scroll, che è **la Definition of Done della Fase 1** e l'unico vero rischio che il progetto aveva;
- il CSS del tema interferisce con la mensola;
- `#hud`, `#tut` e i canvas usano `position: fixed` e id generici, che in una pagina possono collidere.

**Iframe** (lo shortcode stampa un `<iframe>` che punta alla lavagna): l'app resta **esattamente** com'è, con il suo `html`/`body`, e tutto quello che è stato validato su device continua a valere. Il prezzo è tutto noto e piccolo:

- i font vanno caricati dentro l'iframe — ma sullo stesso dominio della Fondazione sono same-origin, quindi bastano tre `@font-face`;
- l'altezza va data all'iframe (`100dvh` meno l'header, o un'altezza fissa);
- «Torna al sito» oggi fa `window.history.back()`, che dentro un iframe naviga l'iframe: va cambiato in `postMessage` al genitore, o in un link con `target="_parent"`;
- `allow="..."` e `sandbox` vanno impostati in modo da non bloccare il download e `navigator.share`.

## Decisioni prese e perché

- **Fase 4b (tutorial) chiusa il 17/09/2026**: sette passi, velo scuro più riquadro tratteggiato a gesso, testi da bambino, avvio alla prima apertura e `?` per riaprirlo. Progettata in cinque giri su `design-tutorial/prova.html` prima di scrivere codice di produzione, ed è il motivo per cui l'implementazione è filata.
- **Rifai è stato tolto** (cliente, 18/09/2026): pulsante, cablaggio in `main.js` e scorciatoia `Ctrl+Y` / `Ctrl+Shift+Z`. `history.redo()` e `canRedo` restano in `model.js` ma **non li chiama nessuno**: il giorno in cui lo rivolessero è un pulsante da ricablare, non una funzione da riscrivere.

  Due conseguenze, una buona e una da tenere d'occhio. **Buona**: `.cmds` è allineato a destra, quindi i comandi sono scivolati là e l'aria fra spessori e annulla è passata da 10px a **54px** — il problema per cui era stato spostato il `?` si è chiuso da solo. **Da tenere d'occhio**: annulla è diventato **irreversibile**. Il brief non ha mai chiesto il redo (§2 elenca «undo», non «redo»), quindi la rimozione riporta lo scope al documento.
- **I testi dei passi 1–5 riscritti dal cliente** (18/09/2026): il segnaposto `{cosa}` ora apre la frase, quindi vale «Con il dito» / «Con il mouse» con la maiuscola.
- **SALVA spento ha il fondo quasi trasparente** (cliente, 18/09/2026): `#FFFFFF08` invece di `#FFFFFF1A`. Col fondo pieno sembrava premibile con la scritta sbiadita. Dentro il tutorial il fondo torna pieno, perché il passo 7 lo indica e deve mostrarlo com'è da acceso.
- **Il `?` è passato in fondo alla riga dei comandi, dopo il cestino** (cliente, 18/09/2026). Da primo della riga confinava con gli spessori e si toccava per sbaglio scegliendo un tratto: il tutorial ripartiva in mezzo a un disegno. Ora accanto agli spessori c'è annulla, che è un danno reversibile.
- **Cinque correzioni del cliente al tutorial, 18/09/2026**: «PROSSIMO» diventa «AVANTI»; il passo 3 dice «Scegli un gessetto sottile, medio o grosso»; il riquadro del passo 3 abbraccia i segni e non i pulsanti; il tratteggio **scorre** (`<rect>` SVG animato in `stroke-dashoffset`, che un `outline` non può fare); il margine laterale della mensola sale a 16px su mobile perché il tratteggio degli elementi a filo di schermo non venga tagliato. Dettaglio e trappole in `prototipo/README.md`.
- **Seconda tornata, stesso giorno: l'arancione e i corpi più grandi**, chiesti «siccome parliamo di bambini». Tratteggio arancione, «PASSO n DI 7» a 11px in arancione, testo del passo a 19px, AVANTI / HO CAPITO con testo e icona arancioni e bordo al 50%, RIPETI bianco su fondo trasparente.

  **Due contrasti restano sotto soglia e sono un prezzo dichiarato, non una svista**: il testo di AVANTI dà 3,39:1 (serve 4,5) e il suo bordo 2,10:1 (serve 3). È l'arancione istituzionale su un fondo tasto chiaro, e lo sfondo il cliente lo voleva invariato. L'unica leva che rientra senza toccare il colore è portare il corpo del tasto a ≥18,66px con peso 700, perché sopra quella misura la soglia scende a 3:1. Tabella completa in `prototipo/README.md`.

  **La gerarchia fra i due tasti si è spostata dal contrasto al contenitore**: RIPETI bianco pesa 13,27 contro i 3,39 di HO CAPITO, e regge solo perché HO CAPITO ha il bordo e RIPETI no. Togliere quel bordo inverte la gerarchia.
- **Spessore/velocità: chiuso, non si tocca più** (decisione di Daniele, 17/09/2026). `PRESSURE_MIN 0.84`, `PRESSURE_ALPHA_MIN 0.85`. Chi riaprisse non ricominci ritarando: la conclusione era che *la metrica non descrive il fenomeno*, e due tarature alla cieca non hanno risolto.
- **Un solo SALVA al posto di SCARICA + INVIA.** Toglie la possibilità di scaricare senza inviare: oggi non si vede perché l'invio non esiste, quando arriverà va deciso se un tocco fa entrambe le cose senza chiedere.
- **Nessun CHIUDI nei primi sei passi del tutorial**, per non farlo chiudere per sbaglio. Su desktop `Esc` funziona comunque; sul dito no.
- **La grammatica dei tasti viene dal sito, misurata e non dedotta**: fondo `#FFFFFF1A`, bordo `2px #FFFFFF54`, raggio 0, icona sempre a destra, corpo `clamp(0.8rem, 0.9vw, 1rem)` / 16px / 14px sulle soglie di Elementor. A 1440 px il clamp dà 12,96 px, che è esattamente il corpo del pulsante DONA: i numeri combaciano.
- **L'arancione istituzionale `#FF6000` vive solo dentro il tutorial, e solo su due cose** (cliente, 18/09/2026): il **tratteggio animato** e l'etichetta **«PASSO n DI 7»**. **Nella mensola non entra**, ed è la decisione del 17/09 che regge ancora: lì nove gessetti portano informazione col colore, e un tasto arancione pieno diventerebbe l'elemento più colorato dello schermo senza dire nulla. Sotto il velo del tutorial i gessetti sono spenti, quindi l'obiezione non si applica e l'arancione resta l'unica cosa accesa — che è il punto.

  **Sui tasti c'è passato e ne è uscito, nella stessa giornata.** AVANTI / HO CAPITO erano diventati arancioni su richiesta e sono tornati alla grammatica del sito poche ore dopo, sempre su richiesta. Chi ci riprovasse sappia il prezzo misurato: il contrasto del testo scende da 9,69:1 a 3,39:1 e quello del bordo a 2,10:1. E le regole vanno scritte sull'**id**, non su `.primario` — **SALVA condivide quella classe** e l'arancione colerebbe nella mensola.
- **Con un fondo e un bordo uguali per tutti, la gerarchia fra i tasti sta nel colore del testo**, non nel contenitore. RIPETI ha il bordo `transparent` e non rimosso, così resta alto come HO CAPITO.
- **I font non sono nel repo**, che è pubblico: `SebinoSoft` è commerciale. Stanno in `prototipo/font/` e `design-tutorial/font/`, gitignorati, e `.lavoro/pubblica.sh` li carica se li trova.
- **Si pubblica in cartelle numerate**, una per consegna: è la difesa dalla cache di SiteGround, e un URL nuovo non è in nessuna cache.
- **Il «già visto» del tutorial porta il percorso nella chiave**, perché `localStorage` è per origine.
- **Nessun nickname, nessuna attribuzione**: disegni anonimi, e cade l'intero capitolo consenso genitoriale.
- **Fondo lavagna a colore pieno e canvas trasparente**: altrimenti la gomma in `destination-out` aprirebbe buchi neri invece di scoprire la lavagna.
- **A fine gesto non si ridisegna mai dal modello**: si travasano i pixel già a schermo. Senza, il tratto saltava del 42% al rilascio.
- **Lo smoothing si governa con l'epsilon RDP, non col filtro.**
- **La punta di gesso ha dimensione fissa**: un tratto largo si ottiene affiancando più impronte.
- **Spessori a 21 / 27 / 50** (`WIDTHS`), raddoppiati sotto i 700 px da `SCALA_STRUMENTI`. Il passo è 1,29× e 1,85×, e il commento in `palette.js` che promette «2.2x» è rimasto indietro.
- **Rosso e marrone escono dalla serie isoluminante** (cliente, 15/09/2026): a L 0.780 il rosso è un rosa salmone. Costano contrasto, 4,6 e 4,3 contro 7,6–8,4.
- **MCP playwright pinnato a 0.0.81**, non `@latest`.

## Trappole

- **Verificare l'attributo non è verificare quel che si vede.** Due difetti di fila sono passati sotto i controlli automatici perché guardavo lo stato e non la resa: RIPETI visibile a ogni passo (il CSS nascondeva un id che non esiste, e `.btn` è `inline-flex`, che vince sull'attributo `hidden`), e i tasti spenti illeggibili proprio nei passi che li spiegano. La misura giusta è `offsetParent !== null` per la visibilità e il contrasto calcolato per la leggibilità. **Su questa app il controllo numerico arriva fin dove arriva: bisogna guardare lo schermo.**
- **La cartella numerata batte la cache HTTP, non il `localStorage`**, che è per origine: tutte le versioni sotto `temp/` condividono l'archivio. Qualunque stato ricordato va in una chiave che porta dentro `location.pathname`, o una versione nuova eredita quel che sapeva la precedente. È già costato un «il tutorial non parte più».
- **SiteGround, cache**: il 16/09/2026 il proxy serviva l'URL della cartella da cache vecchia di giorni e i file con `max-age` di mesi; un `.htaccess` con `Header set Cache-Control` non serve a niente, quelle intestazioni le mette NGINX. Il 17/09/2026 quelle intestazioni **non c'erano più** (misurato su cartella vecchia e nuova, quindi è cambiato lato hosting). La cartella numerata regge comunque.
- **I font della Fondazione non si possono linkare dal loro URL**: manca l'header CORS, e un font cross-origin senza CORS il browser lo rifiuta. Vanno copiati same-origin. Dentro WordPress non serve: li carica Elementor.
- **`SebinoSoft` non ha un peso 300.** Ha 400 / 500 / 700, e il browser serve il 300 col Regular — verificato misurando: 300 e 400 danno la stessa larghezza al pixel. Chi cercasse un Light vero deve chiedere il file alla Fondazione.
- **`SebinoSoft` è il 15% più larga di Atkinson** a pari corpo: i margini dei testi sono più stretti di quanto sembri leggendo il CSS.
- **Il testo del passo 1 dice «area tratteggiata»**, che descrive solo l'evidenziazione scelta. Cambiando stile di evidenziazione, quella frase va riscritta.
- **`getCoalescedEvents` è assente su entrambi i device** di test e il rAF gira a 60 Hz anche sull'iPhone ProMotion: ~55 campioni/s, radi. È il motivo per cui il ricampionamento **interpola su una curva** invece di decimare.
- **`performance.now()` è quantizzato a 1 ms su Safari iOS**: si legge `FPS TRATTO` nel pannello di diagnostica.
- **Il livello dei tratti diverge dal modello.** Si riallinea su undo/redo/resize, e lì la grana cambia (~30% dei pixel), la forma no. Vale anche per il file scaricato.
- **Vicolo cieco già percorso**: legare l'aspetto del timbro alla *posizione* anziché alla sequenza sembra elegante e peggiora.
- **Alzare `minCutoff` o `beta` per avere più smoothing non funziona**: il tremore gonfia la stima di velocità e il filtro lo scambia per un gesto veloce.
- **`puntaBase()` non è monotona**: a 14 unità la punta vale 14, a 16 scende a 10. Il sottile ha grana più fine del 21%. Debito noto.
- **Due nomi diversi, voluto**: online è `frmm`, la cartella locale e il repo sono `frrm` (refuso). Non «correggere» l'FTP riportandolo a `frrm`.
- **Le credenziali FTP aprono l'intero account SiteGround**, dove convivono altri domini e lavori di clienti, **compreso il sito della Fondazione**. Operare solo dentro `/issimissimo.com/public_html/temp/frmm-drawing-plugin*`, sempre con un listing prima di scrivere. Questa trappola diventa più pericolosa nella Fase 7, che tocca il sito vero.
- **Il token GitHub è in chiaro** in `~/.claude/.secrets/github-pat.txt`, nella configurazione MCP utente e nel transcript del 05/09/2026: **da revocare e rigenerare**.
- Il `.md` del brief ha il markdown escapato (`\---`, `\*\*`). È voluto, non va ripulito.

### Provato su device — 18/09/2026

Il **tutorial** e **SALVA** sono stati provati sul telefono e funzionano. Cade il ramo `navigator.share`, che era verificato solo con uno stub su Chrome desktop ed era tutta la ragione per cui esiste: il JPEG finisce dove deve.

Resta la verifica che nessun test automatico può dare, e che il brief mette come **DoD della Fase 4**: *«test con un utente reale sotto i 10 anni. Se chiede "come faccio a…", la UI è sbagliata.»* Non è mai stata fatta. Vale la pena notare che **il tutorial è nato perché la UI da sola non bastava**, che è precisamente il sintomo descritto lì: il test serve a sapere se il tutorial ha risolto o solo coperto.

### Scostamenti dal brief, censiti il 18/09/2026

Il brief è la fonte di verità, ma il lavoro se n'è discostato in cinque punti. Tre sono stati decisi, due sono deriva.

- **D1, aspect ratio fisso 4:3 — violato, e il conto non è pagato.** Il brief lo prescrive con una sola motivazione dichiarata: «aspect fisso = gallery coerente» (Fase 10). Il codice fa altro: `freezeBoardHeight()` in `palette.js` fissa l'altezza **sulla finestra di apertura**, quindi `drawing.board.h` vale 1200 su desktop e altro su ogni telefono, e `export.js` propaga quel rapporto nel JPEG. La ragione è buona (su un telefono verticale il 4:3 lascia bande enormi) ma **la conseguenza sulla gallery non è scritta da nessuna parte**. Oggi non si vede perché gallery e invii non esistono. Va deciso prima della Fase 6, non alla 10: o una gallery che tollera proporzioni miste (masonry, che il brief cita), o un formato fisso imposto in export.
- **Fase 5 (persistenza locale) è in scope v1 del brief**, §2, alla pari col canvas. Qui è diventata «fuori perimetro». Oggi il disegno si perde chiudendo la pagina: bambino sul telefono del genitore, arriva una telefonata, dieci minuti di lavoro spariti. È il difetto più visibile che il prototipo ancora ha.
- **Export**: il brief (Fase 6) vuole tre risoluzioni — 400 / 1600 / 3200 — in PNG o WebP. Oggi è una sola a 1600 in JPEG. Per il download sul device il JPEG è la scelta giusta (400 KB, nessun artefatto sul nero); per archivio e gallery servirà il resto. Costo basso: `EXPORT_W` e `dimensioni()` sono già parametrizzati.
- **§4 chiuso più restrittivamente del default del brief**: niente nickname, non «nickname facoltativo». Sceltа sana e semplifica, ma **il brief legge ancora `nickname?` nel payload di §6**: va annotato lì, o alla Fase 7 qualcuno lo implementerà.
- **DoD della Fase 0 ancora incompleta**: testo del form di invio e decisione legale non scritti. Riduzione voluta, che torna bloccante alla Fase 6 e alla 9.

## Prossimo passo

**Il test con un bambino** — scelto il 18/09/2026. È la DoD della Fase 4 nel brief, non è mai stata soddisfatta, costa un pomeriggio e zero righe di codice. Si fa su <https://issimissimo.com/temp/frmm-drawing-plugin-09/>, da un telefono, con qualcuno fra i 5 e i 12 anni che non ha mai visto l'app.

Cosa si guarda, e non è la stessa cosa che chiedere se gli è piaciuto:

1. **Arriva in fondo al tutorial da solo**, o lo chiude al terzo passo? Se lo chiude, la domanda è se poi disegna lo stesso.
2. **Quali domande fa.** Il brief è netto: «se chiede *come faccio a…*, la UI è sbagliata». Vanno annotate testualmente, non riassunte: la parola che usa per una cosa è più informativa dell'icona che stiamo usando noi.
3. **Trova il cancellino?** È il tasto che ha già richiesto un intervento del cliente per leggibilità.
4. **Cambia colore e spessore senza che glielo si dica?**
5. **Cosa fa dopo aver finito**, se cerca un modo di tenere il disegno senza che nessuno gli indichi SALVA.

L'esito decide se la Fase 4 si chiude davvero o se ha un giro di correzioni — che è molto meglio scoprire prima di impacchettare tutto in un plugin WordPress.

Bloccato in attesa: **la Fase 8** non si apre finché la Fondazione non dice se la lavagna va in una pagina dedicata o dentro una pagina del sito.

Aperto e non assegnato: **D1**, il rapporto della lavagna. Non urge finché non esistono gli invii, ma costa un'ora oggi e una riscrittura alla Fase 10.
