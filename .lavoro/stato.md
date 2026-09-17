# Stato — Lavagna (FRRM - Drawing plugin)
Ultimo aggiornamento: 16/09/2026
Versione corrente: prototipo fasi 0–4 + download del disegno. Nessun numero di versione.

## Dove siamo

Si disegna a gesso su lavagna nera con nove gessetti, tre spessori, cancellino, annulla/rifai: validato su iPhone 13 Pro e Galaxy S10 a 60 fps. Dal 16/09/2026 il disegno si **scarica in JPEG** sul proprio device (`src/export.js`), senza logo e senza backend.

Online su <https://issimissimo.com/temp/frmm-drawing-plugin-01/> — cartella numerata, **niente query string** (17/09/2026, vedi le trappole). Codice su <https://github.com/issimissimo/frrm-drawing-plugin>, 37 test (`node test/run.js`).

## Piano attivo

**In attesa del feedback del cliente**, richiesto il 15/09/2026 su effetto gesso, spessori, UI e app nel complesso. Fino ad allora non si comincia niente di nuovo: il prototipo è consegnabile e va lasciato così. Le fasi 5+ (IndexedDB, export con logo, plugin WP, moderazione, gallery, go-live) si riaprono **esplicitamente**, mai per scivolamento.

Due cose aperte, nessuna delle due è "una fase":

### 🔴 TODO prioritario — spessore del tratto in base alla velocità

**Aperto.** Segnalato due volte dal cliente il 15/09/2026, due tentativi di taratura falliti.

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

### Download: manca la prova su telefono vero

Il ramo `navigator.share` è verificato solo con stub su Chrome desktop. Su iOS il file deve finire in **Foto**, non nei Download di Safari — è tutta la ragione per cui quel ramo esiste.

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
- **Spessori a 16 / 28 / 44** dal 15/09/2026: il passo scende a 1,83× e 1,64×, meno margine di quello che la Fase 0 si era data.
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
