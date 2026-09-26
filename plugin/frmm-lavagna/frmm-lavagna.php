<?php
/**
 * Plugin Name:       FRMM Lavagna
 * Plugin URI:        https://github.com/issimissimo/frrm-drawing-plugin
 * Description:       La lavagna a gessetti della Fondazione. Si inserisce in una pagina con lo shortcode [lavagna], dentro un Container Elementor a cui si sia data un'altezza.
 * Version:           1.11.2
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            Issimissimo
 * Author URI:        https://issimissimo.com
 * License:           GPL-2.0-or-later
 * Text Domain:       frmm-lavagna
 *
 * ---------------------------------------------------------------------------
 *
 * COS'E' QUESTO PLUGIN, IN DUE FRASI
 *
 * La lavagna e' una web app di disegno in JavaScript puro, che vive interamente
 * nella cartella app/ qui accanto. Questo file PHP non fa altro che registrare
 * uno shortcode che la mette in un <iframe>: non una riga di logica di disegno
 * sta qui dentro, e non deve arrivarci.
 *
 * PERCHE' UN IFRAME E NON L'HTML DIRETTO NELLA PAGINA
 *
 * Perche' dentro un iframe la viewport E' il Container. L'app e' stata
 * progettata e validata su device veri come pagina a se': usa 100dvh, media
 * query sulla larghezza della finestra, position:fixed per il velo del
 * tutorial, e registra su document i listener che spengono pinch e doppio tap.
 * Messa in un iframe, tutte queste cose continuano a voler dire esattamente
 * quello che volevano dire prima, senza cambiare una riga.
 *
 * Messa inline direttamente nella pagina, ognuna di quelle cose andrebbe
 * riscritta, e i listener su document spegnerebbero pinch e doppio tap su
 * TUTTO il sito della Fondazione, header compreso.
 *
 * Il conto e' stato fatto sul codice, non a intuito: il dettaglio sta nel
 * README qui accanto.
 *
 * DOVE STA IL RESTO
 *
 * Dalla 1.3.0 il plugin riceve anche i disegni (Fasi 6-7 del brief), e il
 * codice si e' spacchettato in includes/:
 *
 *   includes/disegni.php      il tipo di contenuto, cioe' la casella di posta
 *   includes/invio.php        POST /wp-json/frmm-lavagna/v1/invio
 *   includes/validazione.php  i controlli su quel che arriva, senza WordPress
 *   includes/notifica.php     l'email a ogni disegno, con la miniatura
 *   includes/bacheca.php      miniature, Approva / Rifiuta, fuori dalla Libreria
 *   includes/galleria.php     gli approvati come sorgente del Custom Marquee
 *   includes/limiti.php       il rate limit dell'invio e la sua diagnostica
 *   includes/moderazione-mail.php  Approva / Rifiuta dai tasti della mail
 *
 * Qui resta lo shortcode, che e' quel che il plugin era prima e che non
 * dipende da niente di quanto sopra.
 *
 * L'iframe e' same-origin e non ha sandbox: l'app chiama l'endpoint
 * direttamente, come qualunque pagina del sito.
 */

// Nessun accesso diretto: e' la prima riga di qualunque file PHP di un plugin,
// e l'unica difesa contro chi prova a chiamarlo per URL.
if (!defined('ABSPATH')) {
    exit;
}

require_once __DIR__ . '/includes/validazione.php';
require_once __DIR__ . '/includes/disegni.php';
require_once __DIR__ . '/includes/invio.php';
require_once __DIR__ . '/includes/notifica.php';
require_once __DIR__ . '/includes/galleria.php';
require_once __DIR__ . '/includes/limiti.php';
require_once __DIR__ . '/includes/moderazione-mail.php';
if (is_admin()) {
    require_once __DIR__ . '/includes/bacheca.php';
}

/**
 * Versione, usata per due cose diverse: WordPress la mostra in bacheca, e noi
 * la appendiamo all'URL dell'iframe come cache buster.
 *
 * ⚠️ DEVE COINCIDERE con "Version:" nell'header qui sopra. Non e' un
 * promemoria a vuoto: .lavoro/pacchetto.py rifiuta di costruire lo zip se le
 * due divergono, cosi' la dimenticanza la trova una macchina e non un bambino
 * con la cache vecchia.
 */
define('FRMM_LAVAGNA_VER', '1.11.2');

/**
 * Altezza minima del contenitore.
 *
 * Serve a un caso solo, ma capita: qualcuno mette lo shortcode in un Container
 * Elementor ad altezza automatica. Li' height:100% non ha un riferimento a cui
 * agganciarsi e l'iframe collasserebbe a zero — la pagina sembrerebbe vuota e
 * nessuno capirebbe perche'. Con questa, nel caso peggiore la lavagna e'
 * piccola invece che invisibile.
 */
define('FRMM_LAVAGNA_MIN_H', '420px');

/**
 * Lo shortcode. Un solo attributo, e di norma non si usa.
 *
 *   [lavagna]                     l'altezza la decide il Container (il modo giusto)
 *   [lavagna altezza="schermo"]   la lavagna si misura da sola fino al fondo dello schermo
 *   [lavagna altezza="70vh"]      un valore CSS qualunque
 *
 * Il modo giusto e' il primo: in Elementor si da' al Container un'altezza
 * personalizzata di calc(100dvh - <altezza header>) e la lavagna la riempie.
 *
 * ⚠️ dvh, non vh. Su iOS Safari 100vh e' l'altezza a barra degli indirizzi
 * COLLASSATA: con vh il Container sfora di una sessantina di pixel, la pagina
 * torna a poter scorrere e lo fa proprio mentre un bambino disegna vicino al
 * bordo. Misurato, non temuto.
 *
 * ---------------------------------------------------------------------------
 * PERCHE' ESISTE altezza="schermo"
 *
 * Perche' scrivere calc(100dvh - 65px) a mano vuol dire sapere l'altezza di
 * TUTTO quello che sta sopra la lavagna, e quel numero non e' uno.
 *
 * Misurato sullo staging il 23/09/2026, su una pagina con l'header del sito:
 * la lavagna cominciava a 166px dal bordo, non a 65. Perche' sopra c'erano
 * la barra di amministrazione (46px, che un visitatore non vede e chi
 * costruisce la pagina si', ed e' il modo migliore per accorgersi del
 * problema il giorno dopo la pubblicazione), l'header (65px su telefono ma
 * 55 su desktop) e il titolo della pagina (55px).
 *
 * Con altezza="schermo" il conto lo fa il browser, che quei numeri li sa
 * tutti: la lavagna si prende lo spazio dal punto dove comincia fino al fondo
 * della finestra, e si ricalcola quando la finestra cambia.
 */
function frmm_lavagna_shortcode($atts = [])
{
    $atts = shortcode_atts(
        [
            'altezza' => '',        // vuoto = la decide il Container
            'titolo'  => __('Lavagna', 'frmm-lavagna'),
        ],
        $atts,
        'lavagna'
    );

    // Il cache buster. SiteGround serve i file statici con cache lunghe e ha
    // gia' fatto perdere mezza giornata a questo progetto: senza, dopo un
    // aggiornamento del plugin il browser continuerebbe a servire la lavagna
    // vecchia. La query string cambia, il PERCORSO no — ed e' la cosa giusta,
    // perche' il tutorial ricorda di essere stato visto in una chiave che
    // contiene location.pathname: se cambiasse il percorso, ogni
    // aggiornamento rimetterebbe il tutorial davanti a chi l'ha gia' fatto.
    //
    // Il secondo parametro e' l'indirizzo dell'endpoint di invio: l'app lo
    // legge da qui e, se non c'e', SALVA resta un download e basta. Non lo
    // indovina da se' perche' dipende da come e' configurato WordPress
    // (permalink, sottocartella), e perche' cosi' la stessa app gira anche
    // fuori da WordPress senza chiedere niente a nessuno.
    //
    // rawurlencode: add_query_arg non codifica i valori, e un URL dentro un
    // URL senza codifica si spezza al primo "?" o "&".
    //
    // ⚠️ L'app lo accetta solo se ha la sua stessa origine (invio.js). Se un
    // giorno home_url e site_url divergessero — www da una parte e non
    // dall'altra — la domanda dopo SALVA sparirebbe senza errori visibili:
    // lo dice solo un avviso nella console.
    $src = add_query_arg(
        [
            'v'     => FRMM_LAVAGNA_VER,
            'invio' => rawurlencode(rest_url(FRMM_LAVAGNA_REST_NS . '/invio')),
        ],
        plugins_url('app/index.html', __FILE__)
    );

    $classi  = 'frmm-lavagna';
    $stile   = 'min-height:' . FRMM_LAVAGNA_MIN_H . ';';
    $schermo = ($atts['altezza'] === 'schermo');

    if ($schermo) {
        // L'altezza definitiva la scrive lo script, che sta subito DOPO il div
        // (vedi in fondo a questa funzione) e gira prima che l'iframe abbia
        // finito di caricare. 100dvh e' solo il valore di partenza, per i
        // pochi millisecondi in cui lo script non ha ancora girato.
        $classi .= ' frmm-lavagna--schermo';
        $stile  .= 'height:100dvh;';
    } elseif ($atts['altezza'] !== '') {
        // esc_attr non basterebbe a impedire un valore CSS assurdo, ma questo
        // shortcode lo scrive chi amministra il sito, non un visitatore.
        $stile .= 'height:' . esc_attr($atts['altezza']) . ';';
    }

    frmm_lavagna_stile();

    $html = sprintf(
        '<div class="%s" style="%s"><iframe class="frmm-lavagna__frame" src="%s" title="%s" allow="web-share"></iframe></div>',
        esc_attr($classi),
        $stile,
        esc_url($src),
        esc_attr($atts['titolo'])
    );

    // ⚠️ LO SCRIPT VA DOPO IL DIV, e non e' una questione di stile.
    //
    // Prima stava prima, stampato con echo, e girava quando il div non
    // esisteva ancora: doveva aspettare DOMContentLoaded per fare il suo
    // conto. In quella finestra si apriva una CORSA con l'app dentro
    // l'iframe, che al suo primo layout congela il rapporto della lavagna
    // (freezeBoardHeight) per non deformare i tratti quando si ruota il
    // telefono. Dove l'app arrivava prima — Chrome su Android — il rapporto
    // restava congelato su un'altezza di 65px piu' del vero, e la lavagna
    // teneva bande nere ai lati per tutta la sessione. Su Chrome desktop e
    // su Safari arrivava prima lo script, e non si vedeva niente.
    //
    // Messo qui, gira col div gia' nel DOM e prima che l'iframe abbia finito
    // di caricare: quando l'app fa il suo primo layout, l'altezza e' gia'
    // quella definitiva e non c'e' piu' nessuna corsa da vincere.
    if ($schermo) {
        $html .= frmm_lavagna_script();
    }

    return $html;
}
add_shortcode('lavagna', 'frmm_lavagna_shortcode');

/**
 * Le sei righe di CSS che servono, stampate una volta sola e solo nelle pagine
 * che contengono davvero lo shortcode.
 *
 * Il brief chiedeva "wp_enqueue condizionali: niente JS della lavagna su tutto
 * il sito". Con l'iframe la richiesta e' soddisfatta in un modo piu' forte di
 * quanto chiedesse: nella pagina ospite non finisce NIENTE della lavagna — non
 * un file JS, non un CSS, non un font. Tutto vive dentro il frame. Quel che
 * resta e' come dimensionare il frame, e sono sei righe.
 *
 * Sono in un <style> e non in attributi inline apposta: uno stile inline
 * vincerebbe su qualunque regola di Elementor, e chi un domani volesse dare
 * alla lavagna un bordo o un raggio dal pannello non ci riuscirebbe e non
 * capirebbe perche'.
 */
function frmm_lavagna_stile()
{
    static $fatto = false;
    if ($fatto) {
        return;
    }
    $fatto = true;

    // display:block sull'iframe toglie i quattro pixel che un elemento inline
    // si porta dietro dal line-height, e che qui diventerebbero una striscia
    // arancione sotto la lavagna.
    echo '<style id="frmm-lavagna-css">'
        . '.frmm-lavagna{height:100%;}'
        . '.frmm-lavagna__frame{display:block;width:100%;height:100%;border:0;}'
        . '</style>';
}

/**
 * Le dodici righe che servono ad altezza="schermo", e solo a quello.
 *
 * ⚠️ Questo e' l'unico JavaScript che questo plugin mette nella pagina ospite,
 * ed e' OPT-IN: senza altezza="schermo" non viene stampato affatto. E' una
 * deroga deliberata al principio per cui nella pagina non finisce niente
 * dell'app — ma qui non c'e' niente dell'app: c'e' una sottrazione.
 *
 * Il conto: altezza = fondo della finestra − punto dove comincia la lavagna.
 *
 * Due cose da sapere prima di toccarlo:
 *
 * 1. NON si innesca un ciclo. Cambiare l'altezza della lavagna cambia
 *    l'altezza del documento, non la posizione del suo bordo superiore, che
 *    dipende solo da cio' che le sta sopra. Se un giorno qualcosa sopra la
 *    lavagna dipendesse dalla sua altezza, questo smetterebbe di essere vero.
 *
 * 2. Il top si prende in coordinate di DOCUMENTO (rect.top + scrollY), non di
 *    finestra. Se lo script gira mentre la pagina e' gia' scrollata — capita,
 *    con un'ancora nell'URL o un ritorno indietro del browser — con le
 *    coordinate di finestra la lavagna verrebbe alta quanto un francobollo.
 */
function frmm_lavagna_script()
{
    static $fatto = false;
    if ($fatto) {
        return '';
    }
    $fatto = true;

    return "<script id='frmm-lavagna-js'>(function(){"
        . "function a(){"
        . "var n=document.querySelectorAll('.frmm-lavagna--schermo'),i,e,t;"
        . "for(i=0;i<n.length;i++){e=n[i];t=e.getBoundingClientRect().top+window.scrollY;"
        . "e.style.height=Math.max(240,Math.round(window.innerHeight-t))+'px';}}"
        . "var p=0;function r(){if(p)return;p=requestAnimationFrame(function(){p=0;a();});}"
        . "window.addEventListener('resize',r);window.addEventListener('orientationchange',r);"
        // SUBITO, senza aspettare DOMContentLoaded: lo script sta dopo il div,
        // quindi il div c'e' gia'. E' tutto il punto — aspettare riaprirebbe
        // la corsa con il primo layout dell'app dentro l'iframe.
        . "a();"
        // E poi di nuovo, perche' quel che sta SOPRA la lavagna puo' ancora
        // cambiare altezza: un font che arriva, un'immagine dell'header che
        // si dimensiona, un banner che compare.
        . "if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',a);"
        . "window.addEventListener('load',a);"
        . "})();</script>";
}
