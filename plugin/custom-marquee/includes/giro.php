<?php
/**
 * I conti del giro, per le sorgenti esterne (1.2.0).
 *
 * Con le immagini scelte a mano la striscia la regola chi la costruisce:
 * sceglie quante immagini, e la durata in secondi la tara una volta. Una
 * sorgente esterna invece cambia da sola, e da sola romperebbe due cose:
 *
 *  - la VELOCITA': la durata e' quella di mezza striscia, quindi a durata
 *    fissa ogni immagine in piu' la fa scorrere piu' in fretta;
 *  - il RIEMPIMENTO: la striscia e' ripetuta due volte e basta. Se una copia
 *    e' piu' stretta dello schermo, nel giro si vede il buco.
 *
 * Qui si stima la larghezza di un giro dalle misure delle immagini e dai
 * controlli del widget, e da quella si ricavano ripetizioni e durata.
 *
 * La stima usa i valori DESKTOP dei controlli responsive: su tablet e
 * telefono, con misure piu' piccole, la striscia scorre in proporzione piu'
 * lenta — come gia' faceva con i secondi. E' una stima, non una misura:
 * corretta finche' il CSS del widget e' quello di marquee-widget.php.
 *
 * File senza WordPress, perche' i test lo caricano da soli
 * (plugin/test/marquee.php).
 */

if (!defined('ABSPATH') && !defined('CUSTOM_MARQUEE_TEST')) {
    exit;
}

// Il giro deve coprire lo schermo piu' largo che ci si aspetta: 3840 px CSS
// sono un 4K a densita' 1, piu' di qualunque monitor ultrawide comune. Le
// ripetizioni costano solo elementi nel DOM: le immagini sono le stesse, e il
// browser le scarica una volta.
const CUSTOM_MARQUEE_GIRO_MINIMO = 3840;

// Tetto alle ripetizioni: con immagini minuscole e una sola immagine si
// arriverebbe a centinaia di elementi. Oltre, meglio un buco che una pagina
// pesante.
const CUSTOM_MARQUEE_RIPETIZIONI_MAX = 40;

/**
 * Larghezza di un elemento della striscia, gap compreso.
 *
 * $modo 'ratio': l'immagine tiene le proporzioni, il lato lungo non supera
 * $lato e non viene mai ingrandita (max-width/max-height in CSS).
 * $modo 'crop': larghezza fissa $larghezza_crop.
 * Il margine e' su tutti i lati dell'immagine, quindi conta due volte.
 */
function custom_marquee_larghezza_elemento($w, $h, $modo, $lato, $larghezza_crop, $margine, $gap)
{
    if ($modo === 'crop') {
        $img = (float) $larghezza_crop;
    } else {
        if ($w <= 0 || $h <= 0) {
            return 0.0;
        }
        $scala = min(1.0, $lato / $w, $lato / $h);
        $img = $w * $scala;
    }
    return $img + 2 * $margine + $gap;
}

/**
 * Quante volte ripetere l'elenco perche' una copia copra $minimo px.
 * Sempre almeno 1; ripetizioni INTERE, cosi' due immagini uguali non si
 * trovano mai affiancate a cavallo fra una ripetizione e l'altra.
 */
function custom_marquee_ripetizioni($larghezza_copia, $minimo = CUSTOM_MARQUEE_GIRO_MINIMO)
{
    if ($larghezza_copia <= 0) {
        return 1;
    }
    return (int) max(1, min(CUSTOM_MARQUEE_RIPETIZIONI_MAX, ceil($minimo / $larghezza_copia)));
}

/**
 * Durata dell'animazione in secondi: mezza striscia (= un giro) a velocita'
 * costante. Una velocita' non positiva ricade su 60 px/s.
 */
function custom_marquee_durata($larghezza_giro, $px_al_secondo)
{
    if ($px_al_secondo <= 0) {
        $px_al_secondo = 60;
    }
    return max(1.0, $larghezza_giro / $px_al_secondo);
}
