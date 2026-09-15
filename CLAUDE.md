# FRRM - Drawing plugin → progetto "Lavagna"

Web app di disegno a gessetti su lavagna, per il sito WordPress + Elementor Pro di una Fondazione ETS attiva sul tema dell'infanzia. Utenti: bambini 5–12 anni, mouse su desktop e dito su mobile. I disegni vengono moderati a mano dall'admin e pubblicati in una gallery.

## Documento di riferimento

**`lavagna-brief-progetto.md` è la fonte di verità.** Contiene scope, decisioni architetturali D1–D5, analisi tecnica e il piano in 11 fasi. Va letto prima di scrivere codice. Le decisioni D1–D5 non si rimettono in discussione senza un motivo esplicito.

Il markdown di quel file è escapato (`\---`, `\*\*`). È voluto: non ripulirlo.

## Stato

> **⏸ In attesa del feedback del cliente** (dal 15/09/2026) su effetto gesso, spessori, UI e app nel complesso.
>
> Finché non arriva: **non si aprono fasi nuove e non si rifinisce di iniziativa.** Il prototipo è in uno stato consegnabile. Se il feedback porta correzioni, si parte da quelle; se è positivo, si riaprono le fasi 5+ **esplicitamente**.
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

**Fase 4 fatta** (UI a mensola, lavagna adattiva, punta di gesso a dimensione fissa) e, il 15/09/2026, due richieste del cliente: **rosso e marrone** al posto di corallo e acqua, **cancellino** più leggibile. Nella stessa sessione **spessori alzati a 16 / 28 / 44** perché sottile e medio risultavano troppo esili. 35 test.

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

   Dipendenza esterna da avviare presto: serve il **logo in versione per fondo scuro** (la lavagna è `#1F2225`), che la Fondazione deve fornire.

### Cosa resta fuori, e va detto se ci si avvicina

Le **Fasi 5–10** (IndexedDB, export con logo, plugin WP, moderazione, gallery, go-live) sono **fuori perimetro**. La Fase 4 è stata fatta, riaprendo il perimetro esplicitamente. Anche la DoD della Fase 0 è stata ridotta di conseguenza: testo del form di invio e decisione legale servono alle Fasi 6–9 e non sono stati scritti.

Se una sessione futura comincia a costruire persistenza, backend o integrazione WP, va nominato prima di scrivere il codice.

## ⚠️ Due nomi diversi, ed è voluto

Il nome corretto del progetto è **`frmm`**. La cartella su FTP è stata rinominata il 09/09/2026.

**Restano scritti `frrm`**, che è un refuso: la cartella locale `frrm-drawing-plugin` e il repo GitHub. Non sono stati allineati perché rinominare la cartella locale scollega memoria e cronologia (vedi `Claude_Workspace/CLAUDE.md`) e va fatto a sessione chiusa.

Chi trovasse la discrepanza **non la "corregga" rimettendo `frrm` sull'FTP**: il percorso online giusto è quello con `frmm`.

## Pubblicazione

**Online:** <https://issimissimo.com/temp/frmm-drawing-plugin/>

Solo `prototipo/index.html` e `prototipo/src/` — i test e `package.json` non servono in rete. I percorsi sono tutti relativi, quindi la cartella si può spostare.

Credenziali FTP in `~/.claude/.secrets/ftp-siteground.env`, condivise fra i progetti del workspace; le regole d’uso stanno in `~/.claude/rules/credenziali.md`.

**Attenzione**: quelle credenziali aprono l'intero account SiteGround, dove convivono altri domini e lavori di clienti — compreso il sito della Fondazione. Operare solo dentro `/issimissimo.com/public_html/temp/frmm-drawing-plugin/`.

## Regole di lavoro

**Commit automatico su GitHub a feature completata.** Quando una funzionalità è implementata *e verificata*, si committa e si pusha senza chiedere — deciso il 05/09/2026.

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
