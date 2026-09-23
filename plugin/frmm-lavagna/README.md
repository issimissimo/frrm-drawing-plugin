# FRMM Lavagna — plugin WordPress

La lavagna a gessetti della Fondazione, da mettere in una pagina con lo shortcode `[lavagna]`.

Questo file e' per chi apre la cartella fra sei mesi senza ricordarsi niente. Il progetto completo, con le undici fasi e le decisioni, sta in `lavagna-brief-progetto.md` nel repo.

## Cosa fa

Registra uno shortcode. Tutto qui.

Lo shortcode stampa un `<iframe>` che carica la web app da `app/index.html`. L'app e' JavaScript puro, senza dipendenze e senza build: quel che c'e' nella cartella e' quel che gira.

Nella pagina che ospita la lavagna **non finisce niente dell'app** — non un file JS, non un CSS, non un font. Sei righe di CSS per dimensionare l'iframe, e basta.

## Installazione

Da bacheca: **Plugin → Aggiungi nuovo → Carica plugin**, e si sceglie lo zip.

Lo zip si costruisce dal repo con:

```
python .lavoro/pacchetto.py
```

Non si zippa questa cartella a mano. Nel repo qui dentro c'e' **solo il PHP**: l'app vive in `prototipo/` e lo script ce la copia al momento. E' voluto — due copie della stessa app diventano diverse al primo fix fatto nella copia sbagliata.

⚠️ **I font non sono nel repo.** `SebinoSoft` e' un font commerciale della Fondazione e il repo e' pubblico. Stanno in `prototipo/font/`, gitignorati, e lo script di pacchetto li include se li trova **e avvisa se non li trova**. Senza, il plugin si installa, funziona e ha la tipografia sbagliata.

## Uso

Si crea una pagina, si mette un Container Elementor, gli si da' un'altezza e dentro ci va lo shortcode:

```
[lavagna]
```

**L'altezza la decide il Container**, ed e' il modo giusto. In Elementor: Container → Layout → Altezza minima → `calc(100dvh - 65px)`, dove 65px e' l'altezza dell'header.

> ⚠️ **`dvh`, non `vh`.**
>
> Su iOS Safari `100vh` e' l'altezza della finestra **a barra degli indirizzi collassata**, cioe' una sessantina di pixel piu' di quelli che si vedono davvero. Con `vh` il Container sfora, la pagina diventa scrollabile, e scrolla proprio mentre un bambino appoggia il dito vicino al bordo per disegnare. `dvh` e' l'altezza vera, momento per momento.

### Se non si vuole fare il conto a mano

```
[lavagna altezza="schermo"]
```

La lavagna si misura da sola: si prende lo spazio dal punto dove comincia fino al fondo della finestra, e si ricalcola quando la finestra cambia.

**Perche' esiste.** Scrivere `calc(100dvh - 65px)` vuol dire sapere l'altezza di tutto quello che sta sopra la lavagna, e quel numero non e' uno solo. Misurato sullo staging il 23/09/2026: la lavagna cominciava a **166px** dal bordo, non a 65. Sopra c'erano la barra di amministrazione (46px), l'header (65px su telefono, **55 su desktop**) e il titolo della pagina (55px).

La barra di amministrazione merita una riga a parte, perche' e' una trappola di quelle che si pagano il giorno dopo: **la vede solo chi e' collegato**, cioe' esattamente chi costruisce la pagina. Si prova, sembra a posto, si pubblica, e il primo visitatore vede 46px di lavagna in piu' del previsto — o, se si era compensata a mano, 46px di pagina che scrolla.

**Il prezzo, dichiarato**: questo e' l'unico JavaScript che il plugin mette nella pagina ospite, dodici righe. E' **opt-in**: senza `altezza="schermo"` non viene stampato affatto.

> ⚠️ **Lo `<script>` esce DOPO il `<div>`, e gira subito.** Non spostarlo e non rimandarlo a `DOMContentLoaded`.
>
> Nella 1.1.0 stava prima, e doveva aspettare che il DOM fosse pronto. In quella finestra si apriva una **corsa** con l'app dentro l'iframe, che al primo layout congela il rapporto della lavagna per non deformare i tratti quando si ruota il telefono. Dove l'app arrivava prima — **Chrome su Android** — il rapporto restava congelato su un'altezza di 65px piu' del vero, e la lavagna teneva bande nere ai lati per tutta la sessione, col tratto sfalsato dal dito. Su Chrome desktop e su Safari arrivava prima lo script e non si vedeva niente: il difetto che esiste solo sul telefono di qualcun altro.
>
> La corsa e' chiusa da entrambi i lati: qui, e nell'app, dove **a lavagna vuota il rapporto si puo' ancora ricongelare** (`unfreezeBoardHeight`). Se c'e' anche un solo tratto, invece, il rapporto non si tocca piu': li' c'e' un disegno da proteggere.

### Altri valori

```
[lavagna altezza="70vh"]
```

Un valore CSS qualunque, per i casi che non rientrano nei due di sopra.

Se il Container non ha altezza e lo shortcode nemmeno, entra in gioco un `min-height` di 420px: nel caso peggiore la lavagna e' piccola invece che invisibile.

## La pagina che ospita la lavagna

### L'header del sito e' `position: fixed`, quindi serve un margine

Un header fuori dal flusso non occupa spazio: senza un margine, la lavagna gli finisce **sotto**. Al Container va dato un `margin-top` pari all'altezza dell'header — e quell'altezza **non e' una sola**. Misurata sul sito il 23/09/2026:

| Larghezza | Header | Breakpoint Elementor |
|---|---|---|
| 1200 e oltre | **55px** | Desktop |
| 1024 e sotto | **65px** | Tablet e Mobile |

Il salto cade fra 1200 e 1024, cioe' esattamente sul breakpoint tablet. **Il margine va impostato su tutti e tre i dispositivi**, non solo su desktop: lasciarlo a 55 significa mandare la lavagna 10px sotto l'header su tablet e su telefono, che e' dove la usano i bambini.

**Il margine e' l'unica cosa da impostare a mano.** L'altezza no: con `altezza="schermo"` la calcola lo script, e il margine e' gia' compreso nel conto, perche' entra nel punto in cui la lavagna comincia. E' la ragione per cui conviene `altezza="schermo"` invece di dare l'altezza al Container: con quella si terrebbero due numeri sincronizzati (`margin-top: 55px` e `height: calc(100dvh - 55px)`) per ogni breakpoint, e il giorno che l'header cambia altezza se ne sbaglia uno.

> **Nota sull'editor di Elementor**: li' dentro la misura non e' attendibile, perche' lo script legge l'altezza del frame di anteprima e non quella della finestra. Si guarda in anteprima o sulla pagina pubblicata.

### Altre due cose

Non dipendono dal plugin, ma decidono se funziona:

- **Niente footer e niente titolo della pagina.** Sono contenuto sotto o sopra la lavagna, e la pagina torna a scorrere. La lavagna vuole essere l'unica cosa sotto l'header.
- **La pagina non deve scorrere.** E' il presupposto su cui poggia tutto: se scorre, scorre mentre un bambino disegna. Se serve, `overflow:hidden` e `overscroll-behavior:none` sul documento lo garantiscono.

## Perche' un iframe

Perche' **dentro un iframe la viewport e' il Container**, e questo tiene in piedi gratis tutto quello che l'app da' per scontato.

L'app e' nata come pagina a se' ed e' stata validata cosi' su iPhone e Android veri: usa `100dvh`, media query sulla larghezza della finestra, `position: fixed` per il velo del tutorial, e registra su `document` i listener che spengono pinch e doppio tap. In un iframe ognuna di quelle cose continua a voler dire quello che voleva dire prima.

Inline nella pagina andrebbero riscritte tutte, e in piu' i listener su `document` spegnerebbero pinch e doppio tap su **tutto il sito**, header compreso.

Il conto e' stato fatto leggendo il codice, non a intuito: inline sono cinque o sei modifiche sparse piu' una rivalidazione su device; in iframe e' una cancellazione (il vecchio tasto «Torna al sito», inutile da quando la pagina ha l'header) e una verifica.

Il prezzo dell'iframe, da sapere:

- **Il viewport meta e' quello della pagina ospite**, non dell'app. L'app da sola si metteva `user-scalable=no`; dentro WordPress non puo'. La difesa contro lo zoom accidentale resta `touch-action: none` sul canvas, che vale comunque.
- **`env(safe-area-inset-*)` vale 0 dentro un iframe.** Notch e home bar li deve gestire la pagina WordPress.
- **Niente `sandbox` sull'iframe, ed e' deliberato.** Un `sandbox` senza `allow-downloads` spegnerebbe il salvataggio dell'immagine, che e' tutto quello che il bambino porta a casa. L'iframe e' same-origin e carica codice nostro: non c'e' niente da isolare.
- `allow="web-share"` e' dichiarato esplicitamente anche se la policy `web-share` ha gia' `self` come default. Costa nulla e toglie un dubbio.

## Aggiornare la lavagna

1. Si modifica l'app in `prototipo/`, come sempre.
2. Si alza la versione **in due punti dello stesso file**, `frmm-lavagna.php`: l'header `Version:` e la costante `FRMM_LAVAGNA_VER`.
3. `python .lavoro/pacchetto.py`.

La versione finisce in coda all'URL dell'iframe (`?v=1.0.0`) e serve da cache buster: SiteGround serve i file statici con cache lunghe e ha gia' fatto perdere tempo a questo progetto.

Se le due versioni divergono, **lo script si rifiuta di costruire lo zip**. Non e' pedanteria: se divergessero, la bacheca direbbe una cosa e i browser ne servirebbero un'altra.

Cambia la query string e **non il percorso**, e anche questo e' voluto: il tutorial ricorda di essere stato visto in una chiave di `localStorage` che contiene `location.pathname`. Se cambiasse il percorso, ogni aggiornamento del plugin rimetterebbe il tutorial davanti a chi l'aveva gia' fatto.

## Cosa non fa (ancora)

**Non invia niente a nessuno.** Il tasto SALVA scarica il JPEG sul dispositivo e finisce li'. Non c'e' backend, non c'e' un custom post type, non c'e' una coda di moderazione e non c'e' la gallery: sono la Fase 7 e la Fase 10 del progetto, e quando arriveranno vivranno **qui dentro**, non altrove.

Quando succedera', l'app parlera' col plugin via `postMessage` — dall'iframe non puo' fare altrimenti. E' anche il motivo per cui l'iframe e' same-origin e senza sandbox.

Finche' il plugin fa una cosa sola resta **un file solo**, che si legge meglio di quattro file da dieci righe. Si spacchettera' in `includes/` quando arrivera' il backend, non prima.
