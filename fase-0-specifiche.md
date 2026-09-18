# Fase 0 — Specifiche

Progetto "Lavagna". Documento di riferimento: `lavagna-brief-progetto.md`.
Chiuso il 30/08/2026.

Fissa le costanti che le Fasi 1–3 useranno senza rimetterle in discussione. Tutto ciò che non serve alle Fasi 1–3 è deliberatamente assente (vedi §8).

---

## 1. Decisione legale — chiusa

**Nessuna attribuzione, nessun nickname, nessun dato personale.**

Il nodo §4 del brief è chiuso nella direzione più conservativa. Conseguenze operative:

- Il form di invio non ha campi di testo. Un bottone "Invia", una conferma. Nulla altro.
- Non serve consenso genitoriale, non serve moderazione del testo.
- Resta solo il `client_id` (UUID v4 in `localStorage`) come identificativo tecnico per rate limiting e per collegare la bozza locale all'invio. Va menzionato in privacy policy, ma non è un dato personale raccolto dall'utente.
- La gallery mostra i disegni senza didascalia.

Questa decisione **semplifica le Fasi 6–9** e va ricordata se qualcuno propone di "aggiungere solo il nome".

---

## 2. Lavagna

| | |
|---|---|
| Risoluzione logica | **1600 × 1200** unità |
| Aspect ratio | **4:3 fisso**, mai deformato |
| Colore fondo | **`#1F2225`** — nero carbone |
| DPR massimo | **2** (`Math.min(devicePixelRatio, 2)`) |

Tutte le coordinate degli stroke sono in unità della lavagna logica, mai in pixel fisici. La conversione avviene in un solo punto del codice.

Il verde ardesia è stato scartato: più riconoscibile come "lavagna di scuola", ma lascia meno contrasto e soprattutto avrebbe messo il gessetto verde in competizione col fondo. Il nero carbone tiene i colori fedeli, che è ciò che conta ora che la palette è satura.

---

## 3. Palette gessetti

Generata in **OKLCH a luminanza e croma costanti** (`L = 0.780`, `C = 0.120`), variando solo la tonalità. **Tre gessetti stanno fuori serie** — bianco, rosso e marrone: vedi §3.2. Il croma è il massimo che tiene tutte e otto le tonalità dentro il gamut sRGB a questa luminanza: oltre, i canali si saturano, il colore risultante non è più quello richiesto e l'isoluminanza si perde.

Fra i **sette in serie** lo spread di contrasto è di **0,82 punti** su un range 7,6–8,4: nessuno di loro sparisce, nessuno domina. I tre fuori serie stanno più in basso, e §3.2 dice di quanto.

| Gessetto | Hex | L | C | H |
|---|---|---|---|---|
| bianco | `#FAF8F3` | 0.980 | 0.008 | 95° |
| giallo | `#C9B957` | 0.780 | 0.120 | 100° |
| arancio | `#F1A366` | 0.780 | 0.120 | 58° |
| **rosso** | `#FE4335` | **0.660** | **0.225** | 29° |
| rosa | `#F197C2` | 0.780 | 0.120 | 350° |
| lilla | `#C9A3F5` | 0.780 | 0.120 | 305° |
| azzurro | `#71BFFF` | 0.780 | 0.120 | 245° |
| **marrone** | `#AD794B` | **0.620** | **0.090** | 62° |
| verde | `#85CC87` | 0.780 | 0.120 | 145° |

### 3.1 Perché questa luminanza e non un'altra

Croma e luminosità sono in **trade-off rigido**: a queste altezze il gamut sRGB si stringe man mano che si sale di L, quindi più saturo significa necessariamente più scuro. I gradini misurati:

| | L | C max | Croma vs base | Contrasto |
|---|---|---|---|---|
| Base | 0.865 | 0.071 | — | 10,3 – 10,9 |
| Media | 0.820 | 0.096 | +35% | 8,8 – 9,5 |
| **Alta (scelta)** | **0.780** | **0.120** | **+69%** | **7,6 – 8,4** |
| — | 0.740 | 0.126 | +77% | 6,5 – 7,3 |

L'ultimo gradino è stato scartato: guadagna **0,6% di croma** costando 0,04 di luminosità e un punto pieno di contrasto. `L = 0.780` è il ginocchio della curva, oltre si paga senza ricevere.

Note:

- I valori OKLCH vanno conservati nel codice accanto agli hex: se la texture del gesso altera troppo la resa, si sposta `L` per i sette in serie in un colpo solo e la palette resta coerente. **È probabile che serva**: grana e opacità irregolare abbassano la saturazione percepita, che è esattamente il motivo per cui si parte carichi.
- La **selezione del gessetto attivo** non si segnala con un bordo colorato attorno al pulsante: il colore è già nel gessetto. Si segnala con la posizione (gessetto sollevato) — dettaglio di Fase 4, annotato qui perché discende dalla palette.

### 3.2 I tre fuori serie

| | perché sta fuori |
|---|---|
| **bianco** `L 0.980` | è il gessetto di default e deve leggersi come *il gesso*, non come la nona tinta |
| **rosso** `L 0.660` | a `L 0.780` il rosso è un rosa salmone — era esattamente il vecchio `corallo`. Per essere rosso deve scendere |
| **marrone** `L 0.620` | il marrone **è** un arancione scuro: a `L 0.780` non esiste, viene beige |

Rosso e marrone sono stati **richiesti dal cliente il 15/09/2026**, in sostituzione di `corallo` e `acqua`.

Costano contrasto sul fondo nero, ed è bene sapere quanto:

| | contrasto tratto pieno |
|---|---|
| gli altri sette | 7,6 – 8,4 |
| rosso `#FE4335` | **4,63** |
| marrone `#AD794B` | **4,29** |

Sono i valori più scuri che restano attorno alla soglia WCAG di 4,5 pur essendo inequivocabilmente rossi e marroni. Un rosso più pieno (`#F90F0D`) scende a 3,89 e un marrone più scuro (`#9E6F43`) a 3,65: lì un tratto sottile comincia a sparire sul nero, ed è il caso peggiore perché la pseudo-pressione assottiglia proprio i gesti rapidi dei bambini.

**Da tenere d'occhio**: il marrone è a `H 62`, l'arancio a `H 58`. Sono parenti stretti di tonalità e si distinguono solo per luminosità e croma — se nella mensola risultassero confondibili, il marrone va spostato verso `H 70`.

---

## 4. Spessori

| | Nominale | Banda resa | Uso |
|---|---|---|---|
| Sottile | **21** | **24** | dettagli, occhi, contorni |
| Medio | **27** | **34** | il tratto normale, default all'avvio |
| Grosso | **50** | **58** | campiture, sfondi |

Le bande **24 / 35 / 58 sono state approvate dal cliente il 15/09/2026**; i valori nominali sono quelli che le producono, trovati misurando. Non si ricavano con una formula: la frangia aggiunge una quota quasi fissa, e `puntaBase()` non è monotona.

La "banda resa" è la larghezza del tratto a pressione piena, a soglia di opacità 0,25 sul fondo lavagna. **È il valore da modificare se il cliente chiede tratti diversi**: il nominale è solo il numero che lo produce.

### 4.1 La pseudo-pressione varia del 20%

Fissato dal cliente il 15/09/2026. **È un valore da centrare, non un tetto da cui stare lontani**: a una variazione del 13% il tratto sembra uniforme e la pressione non si legge più — provato e scartato.

Misurato sulla banda resa: **21 / 21 / 16%** fra gesto lento e gesto rapido.

La pressione agisce su **due grandezze**, e la seconda pesa più della prima:

| | costante | valore |
|---|---|---|
| quanto è largo il segno | `PRESSURE_MIN` | 0,84 |
| quanto gesso deposita | `PRESSURE_ALPHA_MIN` | 0,85 |

Un bordo meno opaco scende sotto la soglia di visibilità, e il tratto **sembra più stretto anche se geometricamente non lo è**. Le due leve vanno quindi mosse **insieme**: muoverne una sola non dà il risultato atteso. Le combinazioni misurate:

| geometria | opacità | variazione resa | |
|---|---|---|---|
| 0,92 | 0,90 | 13 / 12 / 9% | sembra sempre uguale |
| 0,92 | 0,65 | 21 / 18 / 10% | il grosso resta piatto |
| 0,88 | 0,75 | 25 / 18 / 14% | il sottile sfora |
| **0,84** | **0,85** | **21 / 21 / 16%** | **scelto: uniforme sui tre** |

Il grosso varia sempre un po' meno degli altri due: ha più impronte affiancate, quindi la geometria pesa di più e l'opacità di meno.

### 4.2 Sottile e medio sono vicini

Nominali 21 e 27: rapporto **1,29×**, bande rese 24 e 34, rapporto **1,42×**. La Fase 0 si era data 2,2×.

È una conseguenza diretta delle bande richieste, non una scelta. Restano distinguibili, ma se un bambino li confondesse l'unica via è allargare il grosso o stringere il sottile — non c'è spazio in mezzo.

**Debito noto**: `puntaBase()` non è monotona. Appena si supera `PUNTA` le impronte affiancate saltano da 1 a 2 e la punta quasi si dimezza. È il motivo per cui gli spessori si tarano misurando e non calcolando.

**Cancellino: 90 unità**, non selezionabile fra gli spessori. È uno strumento a sé, e va largo — un cancellino di precisione sarebbe frustrante e, soprattutto, non è ciò che fa un cancellino vero.

---

## 5. Costanti della pipeline del tratto

Erano valori di partenza; **tarati e confermati in Fase 2** (31/08/2026), misurando e poi provando sul telefono.

| Parametro | Valore | Note |
|---|---|---|
| Resampling | **2,5** unità | distanza costante fra i campioni, al render |
| **RDP epsilon** | **10** unità | applicato a fine gesto. **È la leva dello smoothing** |
| One Euro `minCutoff` | 1.0 | |
| One Euro `beta` | **0.2** | |
| One Euro `dCutoff` | 1.0 | |
| Pseudo-pressione | 0.35 – 1.0 | veloce = sottile, lento = spesso |
| Velocità di saturazione | 2200 unità/s | oltre, il tratto è al minimo spessore |
| Budget frame | < 8 ms | su iPhone SE / Android medio |

### 5.1 Le due cose non ovvie di questa taratura

**Lo smoothing si governa con l'epsilon RDP, non con il filtro.** One Euro toglie il tremore ad alta frequenza; è la semplificazione geometrica a rendere il tratto *disegnato bene*. Misurato come rugosità — variazione angolare media fra segmenti consecutivi, che è ciò che l'occhio legge come "tremolante", e che per una curva pulita vale 0,30 gradi:

| eps | rugosità | effetto |
|---|---|---|
| 1 | 3,5 | il gesto com'è, tremore compreso |
| 3 | 0,7 | ripulito ma riconoscibile |
| **10 (scelto)** | **0,31** | liscio come una curva disegnata |

Chi in futuro volesse più smoothing agendo su `minCutoff` o `beta` non otterrà nulla: il tremore gonfia la stima di velocità (un rumore di ±4 unità a 55 Hz vale ~440 unità/s apparenti), il termine `beta·velocità` domina e il filtro scambia il tremore per un gesto veloce.

**`beta` non è un compromesso, va messo al valore migliore.** A parità di epsilon la rugosità finale resta 0,30 per qualunque `beta` fra 0,02 e 0,3, mentre il lag passa da 6,7 a 0,5 unità. Non essendoci contropartita, si è scelto 0,2. Lo 0,007 del paper originale è tarato per coordinate in pixel e qui lasciava 15 unità di lag, visibili come un tratto che insegue il dito.

Il prezzo di `eps 10` è il dettaglio fine: un tratto molto corto può venire ridotto a una linea retta. Da riguardare in Fase 3, quando la texture del gessetto cambierà la resa.

### 5.2 Storia e seed

**Undo**: illimitato (`strokes.pop()`, costa nulla). **Redo**: stack separato, cap 50, svuotato al primo stroke nuovo. Il **cestino non è annullabile**: la protezione è la conferma prevista in Fase 4.

Il **seed** di ogni stroke è un intero a 32 bit, generato una sola volta alla creazione e mai più toccato. PRNG: **mulberry32**.

---

## 6. Struttura del prototipo

Prototipo standalone, fuori da WordPress. Nessun bundler in Fase 1–3: ES modules nativi, si apre `index.html` da un server statico locale.

```
prototipo/
  index.html
  src/
    prng.js        mulberry32
    palette.js     costanti di questo documento
    board.js       canvas, DPR, coordinate schermo ↔ lavagna
    input.js       pointer events, coalesced, touch-action
    filter.js      One Euro
    model.js       Drawing / Stroke, undo, redo
    render.js      render(drawing, ctx, scale) — puro e deterministico
    chalk.js       stamp, jitter, scatter          [Fase 3]
```

`palette.js` è generato dai valori di §3 ed è l'unico posto dove esistono quegli hex.

---

## 7. Download del disegno

Deciso il 31/08/2026, in aggiunta al brief. **Implementazione in Fase 6**, non prima: qui si fissano i requisiti perché non vadano persi.

L'utente deve poter salvare il proprio disegno come immagine sul telefono o sul PC, **indipendentemente dall'invio** per la moderazione. Sono due azioni distinte e nessuna richiede l'altra: chi non vuole essere pubblicato ottiene comunque il suo disegno, e chi invia non resta a mani vuote in attesa dell'approvazione.

Nessun impatto privacy: l'immagine è generata sul device e non passa dal server.

### 7.1 Il logo

Il logo della Fondazione viene composto sull'immagine esportata, **in alto a sinistra**.

| | |
|---|---|
| Posizione | angolo alto-sinistra |
| Margine | 40 unità di lavagna dai due bordi |
| Larghezza | **220 unità** su lavagna larga, **533** (un terzo) su lavagna stretta |
| Formato richiesto | SVG, oppure PNG con canale alpha, lato >= 600 px |

**✅ Arrivato il 18/09/2026** — `prototipo/images/logo.png`, PNG RGBA 512x451. La dipendenza esterna aperta il 31/08/2026 è chiusa. Due scostamenti da quanto scritto qui sopra, entrambi accettati:

- **Si misura in larghezza, non in altezza**, e le misure sono due: "1/3 vw" su telefono, 220 unità su desktop (richiesta di Daniele del 18/09/2026). Un'altezza sola non poteva funzionare, perché l'immagine salvata è un ritratto su telefono e un panorama su desktop.
- **Il file è 512 px, non 600.** Irrilevante: la misura massima a cui viene disegnato è 533 px, cioè un ingrandimento del 4%.

Resta aperta **la leggibilità del nome a 220 unità**: il marchio si riconosce, le parole no. È una scelta da sottoporre al cliente, non un difetto.

**Serve una versione del logo per fondo scuro, e non è scontato averla.** La lavagna è `#1F2225`: un logo disegnato per la carta bianca sparisce o si sporca di aloni. Va chiesto alla Fondazione il file in negativo o monocromatico chiaro. È una dipendenza esterna: conviene richiederla molto prima della Fase 6, perché i tempi non dipendono da noi.

**Il logo copre il disegno.** Un bambino disegna anche negli angoli. Il rischio è accettato — è il prezzo dell'attribuzione — ma in Fase 6 va guardato su disegni veri. Se risultasse invadente, l'alternativa è una fascia dedicata sotto il disegno, che però cambia l'aspect ratio dell'immagine esportata e quindi la coerenza della gallery.

### 7.2 Dove va il logo, e dove no

| Immagine | Logo |
|---|---|
| Download dell'utente | **sì** |
| PNG inviato per la moderazione | no |
| Gallery sul sito | no |

Sulla gallery il logo sarebbe ridondante — si è già sul sito della Fondazione — e ruberebbe spazio al disegno. Sull'immagine che **esce** dal sito, e finisce in Foto, su WhatsApp o in stampa, è invece la ragione stessa della richiesta.

*Da confermare se si preferisce il logo ovunque per uniformità.*

### 7.3 Come si scarica

Su desktop `<a download>` basta. **Su telefono no, ed è il punto critico di questa funzionalità.**

Ordine di tentativi:

1. **Web Share API** (`navigator.share` con `files`) dove disponibile. Apre il foglio di condivisione del sistema, da cui "Salva immagine" mette il file direttamente in Foto — o lo manda a un contatto. È il gesto che un genitore riconosce senza spiegazioni.
2. **`<a download>` con blob URL** come fallback.

Un `<a download>` su iOS Safari finisce nei Download del browser, non in Foto: tecnicamente funziona, ma l'utente **non ritrova il file**. La Web Share API qui non è raffinatezza, è la differenza fra "ho il mio disegno" e "non lo trovo più".

### 7.4 Risoluzione

**1600 x 1200**, cioè il render "web" già previsto dal brief.

Basta per lo sfondo di un telefono e per una stampa A5 decorosa, e pesa poche centinaia di KB. Il render hi-res 3200 x 2400 supera i 2 MB: su rete mobile la condivisione diventa lenta e il guadagno visibile è nullo su uno schermo.

---

## 8. Cosa NON è stato deciso, e perché

La DoD della Fase 0 nel brief chiede anche il **testo del form di invio** e la **decisione sull'hosting del plugin**. Entrambi servono alle Fasi 6–9, che sono fuori dal perimetro concordato (Fasi 1–3).

Scriverli ora significherebbe progettare la copy di una schermata che non esiste e scegliere un flusso di deploy per un plugin che non è stato iniziato: lavoro speculativo, che andrebbe rifatto. Si riaprono quando e se si supera la Fase 3.

Restano quindi aperti:

- **Il file del logo della Fondazione in versione per fondo scuro** (§7.1). Dipendenza esterna: va richiesta presto.
- Testo del form di invio e della schermata di conferma.
- Hosting e deploy del plugin WP.
- Retention delle submission rifiutate.
- Turnstile sì/no.

---

## 9. Definition of Done — Fase 0

- [x] Nodo legale chiuso (§1)
- [x] Fondo lavagna: nero carbone (§2)
- [x] Palette definita e verificata in gamut, saturazione Alta (§3)
- [x] Spessori definiti (§4)
- [x] Geometria e costanti di partenza (§2, §5)
- [x] Struttura del prototipo (§6)

**Fase 0 chiusa.** Si apre la Fase 1.
