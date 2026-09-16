# Stato — Lavagna (FRRM - Drawing plugin)
Ultimo aggiornamento: 16/09/2026
Versione corrente: prototipo fasi 0–4, nessun numero di versione

## Dove siamo

Prototipo completo con UI a mensola: nove gessetti fisici, tre spessori, cancellino, annulla/rifai. Si disegna a gesso su lavagna nera, validato su iPhone 13 Pro e Galaxy S10 a 60 fps.

Dal 16/09/2026 c'è anche il **download del disegno** in JPEG (`src/export.js`), anticipato dalla Fase 6 su richiesta: solo il salvataggio sul device, nessun backend, **senza logo**.

Online su <https://issimissimo.com/temp/frmm-drawing-plugin/>, codice su <https://github.com/issimissimo/frrm-drawing-plugin>. 37 test (`node test/run.js`).

## 🔴 TODO prioritario — spessore del tratto in base alla velocità

**Aperto, non risolto.** Due tentativi falliti il 15/09/2026.

### Cosa è stato provato, e non ha funzionato

| | `PRESSURE_MIN` | `PRESSURE_ALPHA_MIN` | variazione misurata | esito |
|---|---|---|---|---|
| originale | 0,35 | 0,55 | ~65% | "si restringe troppo" |
| 1° tentativo | 0,92 | 0,90 | 13 / 12 / 9% | "identico, non c'è distinzione" |
| 2° tentativo | **0,84** | **0,85** | 21 / 21 / 16% | **"non hai risolto"** ← stato attuale |

### Il vero problema: la misura non descrive il fenomeno

La metrica usata è la **banda resa a soglia di opacità 0,25**, misurata renderizzando uno stroke con pressione **imposta** a `p=0` oppure `p=1`. Dice 21% di variazione, ma l'occhio vede altro. Quindi si sta misurando la cosa sbagliata.

### Ipotesi da verificare, in ordine

1. **La `p` reale durante un gesto non arriva mai agli estremi.** Non è mai stata misurata: tutte le tarature sono state fatte imponendo `p`, mai osservando quale `p` produca davvero un gesto di un dito. Da strumentare: registrare `speed` e `smoothed` durante un tratto vero e guardarne l'istogramma.

2. **`SPEED_MAX = 2200` unità/s potrebbe essere fuori scala.** Se i gesti reali stanno molto sotto, `p` resta sempre alto e il tratto non si assottiglia mai; se stanno molto sopra, satura subito a 0 e il tratto è sempre al minimo. In entrambi i casi la variazione non si vede, **qualunque siano `PRESSURE_MIN` e `PRESSURE_ALPHA_MIN`**.

3. **Il filtro sulla pressione è lento**: `smoothed += (target - smoothed) * 0.25` in `pen.js`. Con ~55 campioni/s servono diversi campioni per rispondere, e un cambio di velocità breve potrebbe non arrivare mai a destinazione.

4. La variazione potrebbe doversi leggere sulla **densità** più che sulla larghezza: il gesso mosso veloce deposita meno materiale, e forse è quello il segnale che manca.

L'ipotesi 2 è la più probabile e la meno costosa da verificare.

### Cosa NON rifare

Ritarare `PRESSURE_MIN` e `PRESSURE_ALPHA_MIN` alla cieca: è già stato fatto due volte, con misure che tornavano e risultato percepito sbagliato. La tabella delle combinazioni misurate è in `fase-0-specifiche.md` §4.1.

Attenzione alla **cache** durante le misure: ha già falsato una taratura. Il sintomo è che le costanti riportate dalla pagina non corrispondono a quelle nel file. La causa è ora nota — vedi le trappole in fondo — e si aggira con una query (`?v=...`) o servendo la cartella da un percorso nuovo.

## Piano attivo

**In attesa del feedback del cliente**, richiesto il 15/09/2026. Deve dire se effetto gesso, spessori, UI e app nel complesso vanno bene.

- **se va bene** → si aprono le fasi successive (5 in poi: persistenza IndexedDB, export con logo, plugin WordPress, moderazione, gallery, go-live). Vanno riaperte **esplicitamente**, non per scivolamento.
- **se non va** → si rimette mano a ciò che indica, prima di procedere.

Fino ad allora **non si comincia niente di nuovo**: il prototipo è in uno stato consegnabile e va lasciato così. Unica deroga finora: il download del disegno, chiesto esplicitamente il 16/09/2026. Non ha riaperto le fasi 5+.

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
- **Il download ri-renderizza dal modello**, non copia il canvas a schermo: a schermo la lavagna è larga quanto il viewport (780 px su un telefono) e l'export deve stare a 1600. Si paga la solita divergenza di grana, la forma no.
- **Nell'export il fondo si dipinge dopo i tratti**, in `destination-over`: dipinto prima, il cancellino lo bucherebbe e il JPEG — che non ha alpha — restituirebbe le gommate come macchie nere.
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
- **`navigator.share()` va chiamato senza `await` davanti**: pretende che l'attivazione del tocco sia ancora valida, e su Safari iOS una callback asincrona la perde. È il motivo per cui `export.js` costruisce il Blob con `toDataURL` + `atob`, sincrono, invece di `canvas.toBlob`. Il sintomo del contrario è un pulsante che, solo su iPhone, non apre niente.
- **Il ramo `navigator.share` non è ancora stato provato su un telefono vero**, solo con stub su Chrome desktop. Su iOS il file deve finire in Foto, non nei Download del browser.
- **SiteGround serve il prototipo da due cache diverse, e dopo ogni pubblicazione le due versioni non coincidono** (misurato il 16/09/2026):
  - l'URL della cartella (`.../frmm-drawing-plugin/`) arriva dal proxy (`x-proxy-cache: HIT`) e può restare **vecchio di giorni**;
  - `.../index.html` e i `.js` arrivano freschi, ma con `Cache-Control: max-age` di **sei mesi / un anno**, quindi il browser di chi ha già visto la pagina se li tiene.

  Conseguenze pratiche: **subito dopo una pubblicazione si linka `.../index.html?v=<qualcosa>`**, non l'URL della cartella. E `main.js` non deve dare per scontato che l'HTML sia aggiornato: gli elementi nuovi si cercano con la guardia (`btnSave?.`), o un index.html vecchio con un main.js nuovo uccide l'intero modulo e la lavagna non si apre affatto.

  **Un `.htaccess` con `Header set Cache-Control` non serve a niente**: provato e rimosso il 16/09/2026, quelle intestazioni le mette NGINX davanti ad Apache. L'unica leva senza Site Tools è la query string.
- Il `.md` del brief ha il markdown escapato (`\---`, `\*\*`). È voluto, non va ripulito.

## Prossimo passo

Il TODO qui sopra: capire **perché la misura della variazione non corrisponde a quello che si vede**, partendo dall'ipotesi 2 (`SPEED_MAX` fuori scala). Non ritarare prima di aver misurato la `p` reale di un gesto.
