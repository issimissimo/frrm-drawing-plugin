# Stato — Lavagna (FRRM - Drawing plugin)
Ultimo aggiornamento: 15/09/2026
Versione corrente: prototipo fasi 0–4, nessun numero di versione

## Dove siamo

Prototipo completo con UI a mensola: nove gessetti fisici, tre spessori, cancellino, annulla/rifai. Si disegna a gesso su lavagna nera, validato su iPhone 13 Pro e Galaxy S10 a 60 fps.

Online su <https://issimissimo.com/temp/frmm-drawing-plugin/>, codice su <https://github.com/issimissimo/frrm-drawing-plugin>. 35 test (`node test/run.js`).

## Piano attivo

**In attesa del feedback del cliente**, richiesto il 15/09/2026. Deve dire se effetto gesso, spessori, UI e app nel complesso vanno bene.

- **se va bene** → si aprono le fasi successive (5 in poi: persistenza IndexedDB, export con logo, plugin WordPress, moderazione, gallery, go-live). Vanno riaperte **esplicitamente**, non per scivolamento.
- **se non va** → si rimette mano a ciò che indica, prima di procedere.

Fino ad allora **non si comincia niente di nuovo**: il prototipo è in uno stato consegnabile e va lasciato così.

## Decisioni prese e perché

- **Fasi 1–3 come perimetro iniziale**, poi riaperto per la Fase 4 (UI). Le fasi 5+ restano chiuse.
- **Nessun nickname, nessuna attribuzione**: i disegni sono anonimi, così cade l'intero capitolo consenso genitoriale.
- **Fondo lavagna a colore pieno, senza texture.** Ne discende che il canvas dei tratti è trasparente e il fondo sta nel CSS: altrimenti la gomma in `destination-out` aprirebbe buchi neri invece di scoprire la lavagna.
- **Si salvano i punti radi, non quelli ricampionati**: il ricampionamento al render è deterministico, e conservarlo moltiplicherebbe per dieci il payload.
- **Lo smoothing si governa con l'epsilon RDP, non col filtro.** One Euro toglie il tremore ad alta frequenza; è la semplificazione geometrica a rendere il tratto "disegnato bene".
- **A fine gesto non si ridisegna mai dal modello**: si travasano i pixel già a schermo. Senza, il tratto saltava del 42% al rilascio e la prima gommata ricostruiva l'intero disegno.
- **La punta di gesso ha dimensione fissa** (Fase 4): un tratto largo si ottiene affiancando più impronte, non ingrandendone una. Il gesso vero ha *più* grana, non grana più grande.
- **Rosso e marrone escono dalla serie isoluminante** — richiesta del cliente 15/09/2026. A L 0.780 il rosso è un rosa salmone e il marrone non esiste. Costano contrasto: 4,6 e 4,3 contro 7,6–8,4 degli altri.
- **Spessori alzati a 16 / 28 / 44** il 15/09/2026, guardando i tre tratti affiancati. Il passo scende da 2,2× a 1,83× e 1,64×: meno margine di quello che la Fase 0 si era data.
- **MCP playwright pinnato a 0.0.81**, non più `@latest`: aggiornamenti manuali, in cambio di avvii che non vanno in timeout.
- **Commit automatico su GitHub a feature completata e verificata.**

## Trappole

- **`getCoalescedEvents` è assente su entrambi i device** di test, e il rAF gira a 60 Hz anche sull'iPhone ProMotion: ~55 campioni/s, radi. È il motivo per cui il ricampionamento **interpola su una curva** invece di decimare.
- **`performance.now()` è quantizzato a 1 ms su Safari iOS.** Le misure di singolo frame non sono attendibili lì: si legge `FPS TRATTO` nel pannello di diagnostica.
- **Il livello dei tratti diverge dal modello.** Si riallinea su undo/redo/resize, e lì la grana cambia (~30% dei pixel), la forma no. È voluto.
- **Vicolo cieco già percorso**: legare l'aspetto del timbro alla *posizione* anziché alla sequenza sembra la soluzione elegante al salto del tratto, e invece peggiora.
- **Alzare `minCutoff` o `beta` per avere più smoothing non funziona**: il tremore gonfia la stima di velocità e il filtro lo scambia per un gesto veloce.
- **`puntaBase()` non è monotona**: a 14 unità la punta vale 14, a 16 scende a 10, perché superata `PUNTA` le impronte affiancate saltano da 1 a 2. Il sottile ha grana più fine del 21% rispetto agli altri due. Debito noto, non corretto.
- **Due nomi diversi, voluto**: online è `frmm`, la cartella locale e il repo sono `frrm` (refuso). Non "correggere" l'FTP riportandolo a `frrm`.
- **Le credenziali FTP aprono l'intero account SiteGround**, dove convivono altri domini e lavori di clienti. Operare solo dentro `/issimissimo.com/public_html/temp/frmm-drawing-plugin/`, sempre con un listing prima di scrivere.
- **Il token GitHub è in chiaro** in `~/.claude/.secrets/github-pat.txt`, nella configurazione MCP utente e nel transcript della chat del 05/09/2026: **da revocare e rigenerare**.
- Il `.md` del brief ha il markdown escapato (`\---`, `\*\*`). È voluto, non va ripulito.

## Prossimo passo

Aspettare il feedback del cliente. Non aprire fasi nuove né rifinire di iniziativa: se arriva una correzione, si parte da quella.
