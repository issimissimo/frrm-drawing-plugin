# Progetto "Lavagna" — Web app di disegno a gessetti per Fondazione ETS

> Documento di brief + piano di sviluppo.
> Può essere incollato integralmente come \*\*prompt di apertura\*\* di una nuova sessione di lavoro.

\---

## 1\. Contesto e obiettivo

Sito WordPress + Elementor Pro di una Fondazione ETS attiva sul tema dell'infanzia.
Si vuole aggiungere una pagina con una **web app di disegno a gessetti colorati su lavagna**, utilizzabile da bambini con mouse (desktop) e dito (mobile/tablet).

I disegni migliori vengono **selezionati manualmente dall'admin** e pubblicati in una gallery del sito.

**Utente tipo:** bambino, 5–12 anni, spesso su smartphone dei genitori, senza account, senza pazienza.
**Volumi attesi:** bassi (decine di invii, non migliaia).

\---

## 2\. Scope

### In scope (v1)

* Canvas responsive, effetto gessetto realistico, smoothing del tratto.
* Palette colori, spessore, cancellino, undo, cancella tutto.
* Salvataggio automatico locale (l'utente ritrova il disegno riaprendo la pagina).
* Invio esplicito del disegno per la revisione.
* Download dell'immagine sul proprio device, col logo della Fondazione in alto a sinistra \(aggiunto il 31/08/2026 \- vedi `fase-0-specifiche.md` §7\).
* Pannello di moderazione per l'admin.
* Gallery pubblica dei disegni approvati.

### Esplicitamente fuori scope (v1)

* Account, login, registrazione.
* Zoom / pan / layer / importazione immagini.
* Collaborazione realtime tra più utenti.
* Pubblicazione automatica (l'approvazione è e resta **umana**).
* Riempimento aree (secchiello), forme geometriche, testo.

\---

## 3\. Decisioni architetturali (già prese — non rimetterle in discussione senza motivo)

### D1 — Il disegno è vettoriale, il PNG è un derivato

La *source of truth* è una struttura dati, non un'immagine:

```
Drawing {
  version: 1,
  board: { w: 1600, h: 1200 },        // lavagna logica a risoluzione fissa
  strokes: \[
    {
      id, tool: 'chalk' | 'eraser',
      color: '#FFF3C4',
      width: 12,                       // in unità della lavagna logica
      seed: 928374,                    // PRNG seed → texture riproducibile
      pts: \[x, y, p, x, y, p, ...]     // flat array, coord. lavagna, p = pressione 0..1
    }
  ]
}
```

Vantaggi diretti:

* **Responsive gratis**: si ridisegna a qualsiasi risoluzione fisica.
* **Undo gratis**: `strokes.pop()`.
* **Smoothing a posteriori**: si può rilavorare il tratto a fine gesto.
* **Salvataggio locale leggero**: \~10–50 KB di JSON invece di \~2 MB di PNG.
* **Re-render ad alta risoluzione** (es. 3200×2400) per la gallery o la stampa.

⚠️ **Trappola**: l'effetto gessetto è granulare/randomico. Senza un **PRNG seeded per stroke** (es. mulberry32), ogni ridisegno produce una texture diversa e il disegno "respira". Il seed va salvato nello stroke.

**Aspect ratio**: lavagna fissa **4:3**. In portrait su mobile occupa la larghezza piena (l'area sotto ospita la toolbar); suggerimento non bloccante di ruotare il device per più spazio. Aspect fisso = gallery coerente.

### D2 — "Salvo" e "Invio" sono due meccanismi distinti

Questa è la chiave del punto critico del progetto.

||Persistenza (bozza)|Invio (submission)|
|-|-|-|
|**Quando**|continuo, automatico, debounced|esplicito, click su "Invia"|
|**Dove**|IndexedDB, sul device dell'utente|backend|
|**Cosa**|JSON degli stroke|JSON + PNG renderizzati|
|**Costo**|zero|trascurabile|
|**GDPR**|nessun dato lascia il device|dato pseudonimo trattato|

Conseguenza: **il backend non è un database di disegni, è una casella di posta**. Non deve fare autosave, non deve fare sync, non deve gestire conflitti.

L'utente può disegnare per settimane senza che il server sappia della sua esistenza.

### D3 — La gallery pubblica NON parla con il backend

Flusso di pubblicazione:

```
invio → inbox (pending) → admin approva → immagine in Media Library → gallery Elementor statica
```

Nessuna lettura pubblica dell'inbox. Vantaggi:

* Impossibile che un disegno inappropriato appaia online, nemmeno per un istante.
* La gallery è HTML statico, cacheable, veloce, senza JS.
* Se il backend è giù, il sito pubblico non se ne accorge.

### D4 — La "casella di posta" vive in WordPress, non in Firebase

**Scelta: plugin WP custom + REST endpoint + Custom Post Type.**

||WordPress (scelto)|Firebase (alternativa)|
|-|-|-|
|Moderazione|**gratis**: è la bacheca WP (lista post `pending`)|pannello admin da costruire da zero|
|Approvazione|pubblica il post → l'immagine è **già** in Media Library|serve download + upload manuale|
|Dati|sul proprio hosting, EU|processor USA → privacy policy + cookie banner|
|Minori|nessun terzo coinvolto|trattamento dati minori presso terzi|
|Anti-bot|da implementare (nonce + rate limit + Turnstile)|App Check pronto|
|Costi|zero|zero fino a volumi alti|
|Complessità|\~200 righe di PHP|SDK + rules + auth anonima + funzione|

Dato che (a) i volumi sono bassi, (b) la moderazione è manuale, (c) la gallery è in WP, (d) si tratta di **disegni di bambini**, WordPress vince nettamente. Firebase sarebbe la scelta giusta con moderazione automatica, volumi alti o realtime.

### D5 — Identificazione utente: nessun account

`client\_id` = UUID v4 generato al primo accesso, salvato in `localStorage`.
Serve **solo** a due cose:

1. Collegare la bozza locale all'invio ("il tuo disegno è in attesa di revisione").
2. Rate limiting lato server.

Non è un account, non è tracciamento, non è profilazione. Va comunque menzionato nella privacy policy come identificativo tecnico.

\---

## 4\. Nodo aperto da chiudere con la Fondazione (BLOCCANTE)

**Vogliono attribuire i disegni?** ("Disegno di Marco, 8 anni")

* **Se sì** → dati personali di minore → serve **consenso genitoriale documentato** (checkbox non basta: serve un meccanismo verificabile, es. email al genitore). Impatta: form di invio, privacy policy, informativa, flusso di approvazione.
* **Se no** → solo **nickname facoltativo** con avvertenza esplicita ("non scrivere il tuo vero nome") + moderazione del nickname insieme al disegno. Rischio praticamente nullo.

**Default consigliato: nickname facoltativo, nessun altro dato.**

Questa decisione va presa **prima** della Fase 6. Cambia UI e documenti legali.

\---

## 5\. Analisi tecnica dei due nodi "difficili"

### 5.1 Pipeline di input: dal tremolio alla curva naturale

Il tratto di un bambino col dito è rumoroso. La correzione avviene in **due tempi**.

**A — Live (mentre disegna), latenza < 16ms:**

1. `pointerdown/move/up` con **Pointer Events** (unifica mouse/touch/pen).

   * `e.getCoalescedEvents()` per recuperare i campioni persi tra un frame e l'altro (fondamentale su 120Hz).
   * `touch-action: none` + `overscroll-behavior: none` sul canvas, altrimenti su mobile disegnare = scrollare.
2. **One Euro Filter** sui punti in arrivo.
Non una media mobile: quella introduce lag visibile e "molla" il tratto.
One Euro è adattivo: **smoothing aggressivo a bassa velocità** (elimina il tremolio della mano ferma) e **smoothing minimo ad alta velocità** (nessun lag percepito sul gesto rapido). È esattamente il comportamento che serve qui. Due parametri da tarare: `minCutoff` e `beta`.
3. **Resampling** a distanza costante (\~2–3 unità di lavagna) → gli stamp del gessetto risultano equidistanti indipendentemente dalla velocità del gesto.
4. **Larghezza dinamica**:

   * se `pointerType === 'pen'` → usa `e.pressure` (Apple Pencil, stilo Wacom).
   * altrimenti → **pseudo-pressione dalla velocità** (veloce = tratto più sottile e chiaro, lento = più spesso e denso). È ciò che rende il tratto "vivo".

**B — A fine stroke (`pointerup`), si può essere lenti:**

5. **Ramer–Douglas–Peucker** con epsilon piccolo → rimuove i punti ridondanti (tipicamente −70% di punti).
6. **Fitting Catmull-Rom → cubiche di Bézier** → il tratto salvato non è una polilinea ma una **curva**. Risultato: linee e archi puliti, e payload molto più piccolo.
7. Si sostituisce lo stroke "live" con quello "raffinato" e si ridisegna solo quello stroke.

Libreria opzionale: **`perfect-freehand`** (Steve Ruiz) genera un ottimo *outline* poligonale del tratto con pressione. Utile come scheletro, ma la texture del gesso va comunque aggiunta sopra. Valutare in Fase 3 se conviene rispetto a un'implementazione custom.

### 5.2 Rendering: l'effetto gessetto

Il gessetto è: **bordi sfrangiati + grana + opacità irregolare**.

Architettura di rendering a 3 layer:

```
\[canvas 0] lavagna: colore nero scuro + texture noise statica 

\[canvas 1] disegno: gli stroke (offscreen, persistente, mai ridisegnato per intero se non serve)
\[canvas 2] overlay: stroke in corso, cursore, UI (pulito a ogni frame)
```

Tecnica per lo stroke (la più efficace in termini di resa/costo):

1. Pre-renderizzare **stamp** (piccoli canvas offscreen) per ogni colore: un cerchio morbido con alpha irregolare + noise ritagliato.
2. Stampare gli stamp lungo la curva resamplata, con `globalAlpha` variabile, **jitter** di posizione (±1–2px) e **rotazione** casuale — tutto pilotato dal **PRNG seeded**.
3. Aggiungere uno **scatter di particelle** ai bordi (la "polvere") con densità proporzionale alla larghezza.
4. `globalCompositeOperation`: `source-over` per il gesso; **`destination-out`** per il cancellino (che deve essere anch'esso granuloso e ampio, non un rettangolo preciso — l'estetica del cancellino che sporca è parte del fascino).

**Performance mobile (critico):**

* Disegna **solo il nuovo segmento**, mai l'intero disegno a ogni `pointermove`.
* `requestAnimationFrame` a coalescere i move.
* Cap del DPR: `Math.min(devicePixelRatio, 2)`. Un iPhone a DPR 3 su un canvas grande = frame drop garantiti.
* Budget: mantenere < 8ms per frame su un iPhone SE / Android di fascia media. Se non ci si sta, ridurre densità delle particelle prima di ogni altra cosa.

\---

## 6\. Piano di sviluppo per fasi

Ogni fase è **autonoma e verificabile**. Non si passa alla successiva finché la "Definition of Done" non è soddisfatta.

\---

### Fase 0 — Decisioni e specifiche

**Obiettivo:** eliminare le ambiguità.

* Chiudere il nodo attribuzione/nickname con la Fondazione (§4).
* Definire palette colori definitiva (6–8 colori "gesso": bianco, giallo, rosa, azzurro, verde, arancio…).
* Definire i 3 spessori.
* Decidere hosting del plugin: repo Git privato + deploy manuale.

**DoD:** un documento di una pagina con palette, spessori, testo del form di invio, decisione legale.

\---

### Fase 1 — Scheletro: canvas + input, senza estetica

**Obiettivo:** validare la parte più rischiosa (il touch su iOS) prima di investire in tutto il resto.

* Pagina HTML standalone (fuori da WP, per ora).
* Canvas 4:3 responsive, DPR-aware, con coordinate → lavagna logica.
* Pointer Events, `touch-action: none`, coalesced events.
* Disegna una polilinea nera. Basta.

**DoD:** si disegna fluidamente su **iPhone Safari**, Android Chrome, desktop. Nessuno scroll accidentale, nessun pull-to-refresh, nessun zoom da doppio tap, nessuna selezione di testo. **Se questo non funziona, tutto il resto è inutile.**

\---

### Fase 2 — Modello dati + smoothing

**Obiettivo:** il tratto diventa una curva pulita e riproducibile.

* Implementare la struttura `Drawing` / `Stroke` (§D1).
* One Euro Filter + resampling + pseudo-pressione da velocità.
* RDP + fitting Bézier a `pointerup`.
* Undo / Redo / Cancella tutto.
* Funzione `render(drawing, ctx, scale)` **pura e deterministica**.

**DoD:** ridisegnando lo stesso `Drawing` a scale diverse si ottiene la stessa immagine, scalata. Un cerchio disegnato a mano libera *sembra* un cerchio.

\---

### Fase 3 — Effetto gessetto

**Obiettivo:** l'estetica.

* Sfondo lavagna con texture.
* Stamp pre-renderizzati + jitter + scatter, con PRNG seeded.
* Cancellino granuloso (`destination-out`).
* Profiling su device reale.

**DoD:** sembra gesso. Gira a 60fps su un dispositivo medio. Il seed garantisce che un ridisegno sia identico all'originale.

\---

### Fase 4 — UI desktop e mobile

**Obiettivo:** un bambino di 6 anni ci si orienta senza istruzioni.

* **Desktop**: barra laterale/superiore, colori come gessetti fisici cliccabili, cursore custom.
* **Mobile**: toolbar in basso (pollice), target ≥ 48px, palette a scomparsa (bottom sheet), niente testo dove basta un'icona.
* Pulsanti: colori, 3 spessori, cancellino, undo, cestino (con conferma), **Invia**.
* Nessun menu annidato, nessuna label in inglese.

**DoD:** test con un utente reale sotto i 10 anni. Se chiede "come faccio a…", la UI è sbagliata.

\---

### Fase 5 — Persistenza locale

**Obiettivo:** il disegno non si perde mai.

* IndexedDB (non localStorage: limite 5MB e API sincrona bloccante).
* Autosave debounced (\~1s dopo l'ultimo stroke) + su `visibilitychange` e `pagehide`.
* Al load: se esiste una bozza, la ripristina e mostra un avviso discreto ("Riprendi il tuo disegno" / "Inizia da capo").
* Generazione e persistenza del `client\_id`.

**DoD:** disegno → chiudo il browser di colpo → riapro → il disegno è lì, identico.

\---

### Fase 6 — Export e payload di invio

**Obiettivo:** produrre gli artefatti per l'admin.

* Render offscreen a **tre risoluzioni**: thumbnail (400px), web (1600px), hi-res (3200px).
* `canvas.toBlob()` in PNG (o WebP + fallback PNG).
* Payload di invio: `{ client\_id, drawing\_json, png\_web, png\_hires, nickname? }`.
* Schermata di conferma post-invio, kid-friendly ("Il tuo disegno è stato inviato! Se piacerà, lo vedrai nella galleria.").
* **Non cancellare la bozza locale dopo l'invio** — l'utente vuole ritrovare il suo disegno. Marcarla come `inviata` e mostrarne lo stato.

**DoD:** l'invio produce file corretti, il disegno resta in locale, l'utente capisce cosa è successo.

\---

### Fase 7 — Backend: inbox e moderazione

**Obiettivo:** far arrivare i disegni all'admin e permettergli di approvarli in 2 click.

* Plugin WP custom (`fondazione-lavagna`).
* **CPT** `disegno` (non pubblico, `show\_ui: true`), status `pending` di default.
* **REST endpoint** `POST /wp-json/lavagna/v1/submit`:

  * nonce, limite dimensione payload, validazione MIME e dimensioni immagine,
  * **rate limit** per IP e per `client\_id` (es. max 3 invii / 24h),
  * honeypot + (opzionale) Cloudflare Turnstile,
  * sanitizzazione del nickname,
  * salva PNG come **attachment**, JSON come post meta.
* Colonna "anteprima" nella lista admin del CPT → si modera **guardando le miniature**, senza aprire nulla.
* Notifica email all'admin a ogni invio (con thumbnail allegata).

**DoD:** invio dal telefono → arriva l'email → la miniatura è visibile nella bacheca WP → "Pubblica" → l'immagine è nella Media Library.

\---

### Fase 8 — Integrazione in WordPress / Elementor

**Obiettivo:** la web app vive nel sito.

* Shortcode `\[lavagna]` registrato dal plugin.
* `wp\_enqueue\_script/style` **condizionali** (solo sulla pagina della lavagna): niente JS della lavagna su tutto il sito.
* Pagina con template **Elementor Canvas** (niente header/footer che rubano altezza verticale).
* `100dvh` + `env(safe-area-inset-\*)` per notch e barra di Safari iOS.
* Widget Elementor custom (`Widget\_Base`) — **opzionale**, solo se serve configurare la palette dall'editor. Altrimenti lo shortcode basta.

⚠️ Non usare WPCode per questo. È il momento giusto per un plugin vero: qui c'è PHP, REST, CPT e asset da versionare.

**DoD:** la pagina funziona su iOS Safari, Android Chrome, Firefox, Safari desktop. Nessun conflitto con gli script del tema.

\---

### Fase 9 — Hardening, legale, QA

* Privacy policy aggiornata (`client\_id`, immagini inviate, nickname, conservazione, cancellazione).
* Testo di consenso nel form di invio, comprensibile a un genitore.
* Verifica anti-abuso: cosa succede se qualcuno invia 500 disegni? Se invia un payload da 50MB? Se invia un PNG che non viene dalla lavagna?
* Retention: cancellare automaticamente le submission `rejected` dopo N giorni.
* QA cross-device su device reali (non solo DevTools).

\---

### Fase 10 — Gallery e go-live

* Gallery Elementor (griglia/masonry) alimentata dalla Media Library o da un tag/categoria.
* Lightbox per l'ingrandimento.
* Eventuale didascalia (nickname, se deciso in Fase 0).
* Pubblicazione della pagina + link dal menu.

\---

## 7\. Stack

* **Frontend**: vanilla JS (ES modules), zero framework. Eventualmente `esbuild` per bundle+minify. Dipendenze esterne: nessuna obbligatoria (`perfect-freehand` opzionale, \~4KB).
* **Backend**: plugin WordPress custom (PHP), REST API, CPT.
* **Storage**: IndexedDB (client) + Media Library WP (server).
* **Niente**: React, Firebase, database esterni, servizi terzi.

\---

## 8\. Rischi principali

|Rischio|Impatto|Mitigazione|
|-|-|-|
|Performance del gessetto su mobile|Alto|Fase 3 con profiling su device reale; degradare le particelle prima di tutto|
|iOS Safari e gestione touch|Alto|Fase 1 lo valida **prima** di ogni altro investimento|
|Endpoint pubblico non autenticato|Medio|Rate limit + Turnstile + validazione severa + moderazione umana comunque a valle|
|Dati personali di minori|Medio-Alto|Nodo §4 chiuso a monte; default = nessun dato personale|
|Contenuti inappropriati|Basso|Nessuna pubblicazione automatica: **tutto passa da approvazione umana**|

\---

## 9\. Come usare questo documento come prompt

> Sto sviluppando la web app descritta qui sotto. Siamo alla \*\*Fase N\*\*.
> Rispetta le decisioni architetturali D1–D5 e non reintrodurre elementi fuori scope.
> Obiettivo di questa sessione: \[obiettivo]. Non passare alla fase successiva.
>
> \[incollare le sezioni 1–5 + la fase corrente]

