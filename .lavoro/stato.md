# Stato — Lavagna (FRRM - Drawing plugin)
Ultimo aggiornamento: 05/09/2026
Versione corrente: prototipo fasi 0–3, nessun numero di versione

## Dove siamo

Prototipo standalone completo e funzionante: si disegna a gessetti su lavagna nera, nove colori, gomma granulosa, annulla/rifai. Validato su iPhone 13 Pro (Safari) e Galaxy S10 (Chrome) a 60 fps pieni.

Online su <https://issimissimo.com/temp/frmm-drawing-plugin/>, codice su <https://github.com/issimissimo/frrm-drawing-plugin>.

## Piano attivo

*(vuoto — il perimetro concordato, Fasi 1–3, è chiuso)*

Le Fasi 4–10 del brief (UI definitiva, IndexedDB, export con logo, plugin WordPress, moderazione, gallery, go-live) restano **fuori perimetro**: vanno riaperte esplicitamente, non per scivolamento.

## Decisioni prese e perché

- **Fasi 1–3 come perimetro**, poi ci si ferma e si rivaluta. Chiuso il 04/09/2026.
- **Nessun nickname, nessuna attribuzione**: i disegni sono anonimi, così cade l'intero capitolo consenso genitoriale e moderazione del testo.
- **Fondo lavagna a colore pieno, senza texture.** Ne discende che il canvas dei tratti è trasparente e il fondo sta nel CSS: se il fondo fosse dipinto insieme ai tratti, la gomma in `destination-out` aprirebbe buchi neri invece di scoprire la lavagna.
- **Si salvano i punti radi, non quelli ricampionati**: il ricampionamento a ogni render è deterministico, e conservarlo moltiplicherebbe per dieci il payload (mezzo MB per disegno contro i 10–50 KB del brief).
- **Niente conversione in curve di Bézier** (prevista dal brief §5.1): serviva a disegnare con `bezierCurveTo`, ma il gesso si disegna a timbri e la Catmull-Rom viene valutata direttamente. Un modulo in meno.
- **Lo smoothing si governa con l'epsilon RDP, non col filtro.** One Euro toglie il tremore ad alta frequenza; è la semplificazione geometrica a rendere il tratto "disegnato bene".
- **`beta` di One Euro non è un compromesso**: a parità di epsilon la levigatezza è identica per qualunque valore, mentre il lag cambia di dieci volte. Va messo al valore migliore (0.2) e basta.
- **A fine gesto non si ridisegna mai dal modello**: si travasano i pixel già a schermo. Senza, il tratto saltava del 42% al rilascio.
- **Commit automatico su GitHub a feature completata e verificata**, deciso il 05/09/2026.

## Trappole

- **`getCoalescedEvents` è assente su entrambi i device** di test, e il rAF gira a 60 Hz anche sull'iPhone ProMotion. Si ricevono ~55 campioni/s: radi. È il motivo per cui il ricampionamento **interpola su una curva** invece di decimare — una spezzata si vedrebbe proprio sui gesti veloci dei bambini.
- **`performance.now()` è quantizzato a 1 ms su Safari iOS.** Le misure di singolo frame non sono attendibili lì: si legge `FPS TRATTO` nel pannello Info, che conta i frame su centinaia di ms.
- **Il livello dei tratti diverge dal modello.** Si riallinea su undo/redo/resize, e lì la grana cambia (~30% dei pixel), la forma no. È voluto: è il prezzo per non far saltare il tratto mentre si disegna.
- **Vicolo cieco già percorso**: legare l'aspetto del timbro alla *posizione* anziché alla sequenza sembra la soluzione elegante al salto, e invece peggiora — ogni micro-movimento della curva ricalcola l'aspetto di tutte le impronte (16,5% di pixel cambiati invece di 2,8%).
- **Alzare `minCutoff` o `beta` per avere più smoothing non funziona**: il tremore gonfia la stima di velocità (±4 unità a 55 Hz valgono ~440 unità/s apparenti) e il filtro lo scambia per un gesto veloce.
- **Le credenziali FTP aprono l'intero account SiteGround**, dove convivono altri domini e lavori di clienti, compreso il sito della Fondazione. Operare solo dentro `/issimissimo.com/public_html/temp/frmm-drawing-plugin/`, e sempre con un listing prima di scrivere.
- **Il token GitHub è in chiaro** in `~/.claude/.secrets/github-pat.txt` e nella configurazione MCP utente. È anche finito nel transcript della chat del 05/09/2026: **da revocare e rigenerare**.
- Il `.md` del brief ha il markdown escapato (`\---`, `\*\*`). È voluto, non va ripulito.

## Prossimo passo

Decidere **esplicitamente** se aprire la Fase 4 (UI definitiva per bambini) o fermarsi qui: il perimetro concordato è concluso e il prototipo è consegnabile così com'è.
