# Custom Marquee Widget — plugin WordPress

Widget Elementor: una striscia di immagini che scorre senza fine. Autore: Issimissimo.

È usato sul sito della Fondazione in `/chi-siamo/` (immagini scelte a mano) e, dalla 1.2.0, per la galleria dei disegni della Lavagna.

## Come funziona

Il PHP stampa l'elenco delle immagini **due volte** e un `@keyframes` porta la striscia da `translateX(0)` a `translateX(-50%)`: a fine giro la seconda copia è esattamente dove era la prima, e l'animazione ricomincia senza che si veda. Niente JavaScript, tranne le poche righe che fermano la striscia al tocco su telefono.

I controlli con `selectors` (misure, gap, margine, durata) non finiscono nell'HTML ma nel CSS che Elementor scrive per ogni pagina (`uploads/elementor/css/post-N.css`).

## Sorgenti (dalla 1.2.0)

Il controllo **Sorgente delle immagini** vale «Immagini scelte a mano» di default. È anche quel che fanno le istanze create prima che il controllo esistesse, e per loro non cambia niente: verificato su `/chi-siamo/` byte per byte, HTML e CSS.

Altre sorgenti le aggiungono altri plugin, con due filtri:

```php
// Compare nella tendina.
add_filter('custom_marquee/sorgenti', function ($sorgenti) {
    $sorgenti['mia_sorgente'] = 'La mia sorgente';
    return $sorgenti;
});

// Dà gli id degli allegati, in ordine, al massimo $max.
add_filter('custom_marquee/immagini', function ($ids, $sorgente, $max) {
    return $sorgente === 'mia_sorgente' ? [/* id degli allegati */] : $ids;
}, 10, 3);
```

La sorgente dà solo gli id. Misura del file, ripetizioni e durata le decide il marquee, perché dipendono da come la striscia è disegnata. Per una sorgente esterna il pannello mostra:

- **Immagini al massimo** (20);
- **Misura del file** (`large`): non l'originale, perché il marquee carica tutto subito e a priorità alta. Se un file non ha la misura chiesta si usa la più piccola fra quelle che ha che sia almeno altrettanto larga;
- **Velocità in pixel al secondo** (60) al posto dei secondi.

E fa due cose da solo:

- **ripete l'elenco per intero finché un giro copre 3840 px**, così con pochi disegni non si vede il buco;
- **calcola la durata dai px/s**, così la striscia non accelera a ogni immagine in più.

I conti stanno in `includes/giro.php`, senza WordPress: `php plugin/test/marquee.php`. Usano i valori **desktop** dei controlli: su tablet e telefono, con immagini più piccole, la striscia scorre in proporzione più lenta, come già faceva con i secondi. Misurato sullo staging: 60,00 px/s reali contro 60 impostati.

## Cose da non disfare per sbaglio

- **Il `padding-right` pari al gap chiude il giro** (1.1.0). Senza, la striscia misura due copie più `2n − 1` gap e il −50% cade mezzo gap prima della seconda copia: a ogni giro l'immagine scattava in avanti di `gap/2`. Misurato 11,9 px su `/chi-siamo/`, 0 dopo.
- **`CUSTOM_MARQUEE_VER` va cambiata insieme a `Version:`**: al cambio, il plugin fa rigenerare a Elementor il CSS di tutte le pagine. Senza, un selettore cambiato resta nel CSS vecchio e la correzione è installata ma non si vede. `pacchetto.py` rifiuta lo zip se le due divergono.
- **Il controllo `sorgente` si registra sempre**, anche con una sola opzione: `gallery` ha una condizione che lo nomina, e una condizione su un controllo inesistente nasconde la galleria e ne butta via le immagini.
- **I fine riga sono CRLF e restano CRLF** (`.gitattributes`): il widget stampa il proprio template, e i `\r` finiscono nell'HTML del sito.
- **Chiesta una misura che il file non ha, WordPress restituisce l'originale** con le dimensioni ridotte, non un errore. Il sito della Fondazione non genera `medium_large`, `1536x1536` e `2048x2048`: è il motivo di `custom_marquee_misura_vicina()`.

## Costruire e installare

```
python .lavoro/pacchetto.py custom-marquee
python .lavoro/installa-staging.py custom-marquee [versione] [--produzione]
python .lavoro/prova-marquee.py foto <nome> / confronta <a> <b>
```

`prova-marquee.py` fotografa il widget di `/chi-siamo/` sullo staging, HTML e regole CSS, e confronta due foto byte per byte: è la prova che il sito esistente non è cambiato.
