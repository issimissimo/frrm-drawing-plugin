# Stato — Lavagna (FRRM - Drawing plugin)
Ultimo aggiornamento: 17/09/2026
Versione corrente: prototipo fasi 0–4b. Nessun numero di versione.

## Dove siamo

Si disegna a gesso su lavagna nera con nove gessetti, tre spessori, cancellino, annulla/rifai, e il disegno si **scarica in JPEG** sul device. Dal 17/09/2026 c'è un **tutorial in sette passi** che parte alla prima apertura, SCARICA e INVIA sono un solo **SALVA**, e i tasti hanno lo stile del sito della Fondazione.

Online: <https://issimissimo.com/temp/frmm-drawing-plugin-05/> (con `?tutorial` il tutorial parte comunque). Codice su <https://github.com/issimissimo/frrm-drawing-plugin>, **44 test** (`node test/run.js`).

**Tutto è verificato in Chrome desktop. Niente è ancora stato provato su un telefono vero da quando esiste il tutorial.**

## Piano attivo

Obiettivo: la lavagna si apre dentro una pagina del sito WordPress della Fondazione, inserita da un **shortcode**, e continua a funzionare come funziona oggi sul telefono. È la **Fase 7** del brief; le fasi 5 e 6 restano chiuse, quindi SALVA continuerà a scaricare e non a inviare.

**Due decisioni da prendere prima di scrivere una riga.** Sono la ragione per cui questa fase non comincia dal codice:

1. **Iframe o inline?** Vedi «Il nodo dell'integrazione» sotto. La raccomandazione è **iframe**, e non è una preferenza di stile: inline si porta dietro la riscrittura della gestione dello scroll, che è la cosa validata su device più importante del progetto.
2. **Dove si prova?** Installare un plugin non provato sul sito di produzione di una Fondazione non si fa. Serve sapere se esiste uno **staging** su SiteGround, o se si prova su un WordPress locale. Senza questa risposta il piano non ha un posto dove atterrare.

Criterio di finito (da confermare quando le due decisioni sono prese):

- Lo shortcode `[lavagna]` in una pagina Elementor apre la lavagna, e **sul telefono vale ancora la DoD della Fase 1**: si disegna a 60 fps, la pagina non scorre mentre si disegna, niente pull-to-refresh, niente zoom da doppio tap, il palmo appoggiato non disegna.
- Il tutorial parte alla prima apertura **dentro la pagina** e non riparte alla seconda.
- I font arrivano da Elementor e la lavagna non eredita stili del tema che ne cambino la mensola.
- «Torna al sito» porta a una pagina del sito, non a una pagina bianca.
- La pagina che ospita la lavagna scorre normalmente **fuori** dall'area di disegno.

Fuori perimetro, e va detto se ci si avvicina:

- **L'invio al backend** (Fase 6) e **la persistenza** (Fase 5). SALVA scarica, punto.
- **Moderazione e gallery** (Fasi 8–9).
- Il logo nell'export: dipendenza esterna ancora aperta.
- Qualunque modifica al motore del gesso. Se l'integrazione sembra chiederla, è il segno che la strada scelta è sbagliata.

Passi:

1. [ ] **Rispondere alle due decisioni qui sopra.** Punto di fermata.
2. [ ] **Provare il prototipo attuale su iPhone 13 Pro e Galaxy S10** (vedi «Non provato su device»). Va fatto *prima* dell'integrazione: se il tutorial ha un problema sul telefono, si scopre su un URL semplice e non dentro WordPress.
3. [ ] **Il plugin minimo**: una cartella `lavagna/` con l'header del plugin e uno shortcode che stampa l'app. Nessuna opzione, nessuna pagina di amministrazione.
4. [ ] **Far convivere l'app con la pagina**: scroll, altezza, safe area, e «Torna al sito» che deve portare da qualche parte di sensato.
5. [ ] **Prova su device dentro la pagina vera**, con la DoD della Fase 1 ripetuta lì.
6. [ ] **Guardare la lavagna nera dentro una pagina a fondo `#FF6000`** e decidere se serve una cornice. Finora nessuno l'ha vista.

Rischi aperti:

- **La gestione dello scroll è la cosa più fragile che tocchiamo.** `html, body { position: fixed }` non si può mettere in una pagina WordPress, e tutta la tenuta su iOS della Fase 1 è costruita su quello.
- **Il CSS di Elementor e del tema.** Inline, la mensola erediterebbe regole su `button`, `padding`, `box-sizing` e la tipografia globale. In iframe il problema non esiste.
- **Il plugin va su un sito di terzi**, vivo, di una Fondazione. Ogni prova ha un pubblico.
- **Un plugin è codice destinato a durare.** Fra sei mesi nessuno ricorderà com'è fatto: merita un README suo dentro la cartella del plugin.

Costo stimato: 6 passi, di cui due sono attese o prove su device. L'ordine di grandezza dipende tutto dalla decisione 1: in iframe è una sessione, inline sono diverse e con il rischio di rompere la Fase 1.

### Il nodo dell'integrazione: iframe o inline

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
- **Spessore/velocità: chiuso, non si tocca più** (decisione di Daniele, 17/09/2026). `PRESSURE_MIN 0.84`, `PRESSURE_ALPHA_MIN 0.85`. Chi riaprisse non ricominci ritarando: la conclusione era che *la metrica non descrive il fenomeno*, e due tarature alla cieca non hanno risolto.
- **Un solo SALVA al posto di SCARICA + INVIA.** Toglie la possibilità di scaricare senza inviare: oggi non si vede perché l'invio non esiste, quando arriverà va deciso se un tocco fa entrambe le cose senza chiedere.
- **Nessun CHIUDI nei primi sei passi del tutorial**, per non farlo chiudere per sbaglio. Su desktop `Esc` funziona comunque; sul dito no.
- **La grammatica dei tasti viene dal sito, misurata e non dedotta**: fondo `#FFFFFF1A`, bordo `2px #FFFFFF54`, raggio 0, icona sempre a destra, corpo `clamp(0.8rem, 0.9vw, 1rem)` / 16px / 14px sulle soglie di Elementor. A 1440 px il clamp dà 12,96 px, che è esattamente il corpo del pulsante DONA: i numeri combaciano.
- **L'arancione istituzionale `#FF6000` non è entrato nell'app.** Scelto «gesso»: su una lavagna dove nove gessetti portano informazione col colore, un tasto arancione pieno diventa l'elemento più colorato dello schermo e non dice nulla. La variabile `--arancio` è in `index.html` ma non in uso.
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

### Non provato su device, e va fatto prima di integrare

Aprire <https://issimissimo.com/temp/frmm-drawing-plugin-05/> su **iPhone 13 Pro (Safari)** e **Galaxy S10 (Chrome)**:

1. il tutorial parte alla prima apertura, il velo si legge con la luminosità di un telefono, il passo 1 dice **«con il dito»**, e ruotando lo schermo a tutorial aperto il riquadro segue la mensola;
2. **SALVA su iPhone**: il JPEG deve finire in **Foto**, non nei Download di Safari. Il ramo `navigator.share` è verificato solo con uno stub su Chrome desktop, ed è tutta la ragione per cui esiste.

E la verifica che nessun test può dare: **il tutorial funziona?** Lo dice una persona che non ha mai visto l'app, preferibilmente un bambino.

## Prossimo passo

Provare il prototipo sui due telefoni veri (i due punti qui sopra). Solo dopo si apre la Fase 7, e la prima cosa che chiede è la scelta fra iframe e inline.
