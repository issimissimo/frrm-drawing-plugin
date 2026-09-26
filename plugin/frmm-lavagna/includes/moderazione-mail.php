<?php
/**
 * Approvare o rifiutare un disegno dalla mail di notifica (dalla 1.10.0).
 *
 * La mail va al cliente, che NON ha un accesso a WordPress (Daniele,
 * 26/09/2026): il link della mail e' il suo solo modo di moderare.
 *
 * COME FUNZIONA (dalla 1.11.0). Ogni disegno ha un link firmato
 * (validazione.php), valido 7 giorni: "Guardalo per approvarlo o rifiutarlo".
 * Apre una pagina col disegno e i due pulsanti, Approva e Rifiuta; e' il
 * pulsante, in POST, che agisce. Nella 1.10.x la mail aveva due tasti che
 * portavano alla stessa pagina: promettevano un'azione che non facevano, e
 * sono diventati un link che dice quel che fa.
 *
 * ⚠️ APRIRE IL LINK NON DEVE MAI CAMBIARE NIENTE. I filtri antispam, Safe
 * Links di Outlook e le anteprime dei programmi di posta aprono da soli i
 * link che trovano, dai loro server e prima che il destinatario legga la
 * mail: per il nostro server quella richiesta e il tocco di una persona sono
 * la stessa cosa. Se aprire il link agisse, uno scanner approverebbe un
 * disegno che nessuno ha guardato. Discusso a lungo con Daniele il 26/09/2026
 * (anche: doppio clic nella mail — nelle mail il JavaScript non gira, e lo
 * scanner il link non lo clicca, lo legge; conferma automatica via
 * JavaScript — ferma gli scanner semplici ma non quelli con un browser vero).
 * La strada rimasta aperta e' MISURARE in produzione chi apre i link prima
 * del cliente, e decidere sui dati.
 *
 * DECISIONI (Daniele, 26/09/2026):
 * - scade dopo 7 giorni; un disegno rimasto in attesa lo smaltisce Daniele
 *   dalla bacheca;
 * - un disegno gia' moderato non si ri-modera dalla pagina: dice com'e'
 *   andata e basta. Un errore si corregge dalla bacheca;
 * - la pagina non propone il disegno successivo: un link vale per un disegno.
 *
 * CHI HA LA MAIL MODERA, senza login e senza il controllo per ruolo della
 * bacheca. Oggi il destinatario e' un indirizzo personale del cliente; se
 * diventasse una casella condivisa, chiunque la legga pubblicherebbe sul sito.
 * Cambiare il segreto (opzione frmm_lavagna_segreto_mail) invalida tutti i
 * link in giro, senza toccare i login di nessuno.
 */

if (!defined('ABSPATH')) {
    exit;
}

const FRMM_LAVAGNA_MAIL_DURATA = 7 * 86400;
const FRMM_LAVAGNA_OPZIONE_DESTINATARIO = 'frmm_lavagna_destinatario';
const FRMM_LAVAGNA_OPZIONE_SEGRETO = 'frmm_lavagna_segreto_mail';

/* --- il destinatario ---------------------------------------------------------- */

/**
 * Un'impostazione a se', in Impostazioni > Generali, e non admin_email:
 * cambiare admin_email sposterebbe anche tutte le altre notifiche di
 * WordPress. Vuota = admin_email, com'era prima della 1.10.0.
 *
 * show_in_rest: la si legge e scrive anche da /wp-json/wp/v2/settings, che e'
 * come la imposta .lavoro/prova-mail.py.
 */
add_action('init', function () {
    register_setting('general', FRMM_LAVAGNA_OPZIONE_DESTINATARIO, [
        'type'              => 'string',
        'description'       => __('Destinatario delle notifiche dei disegni della lavagna', 'frmm-lavagna'),
        'sanitize_callback' => 'sanitize_email',
        'show_in_rest'      => true,
        'default'           => '',
    ]);
});

add_action('admin_init', function () {
    add_settings_field(
        FRMM_LAVAGNA_OPZIONE_DESTINATARIO,
        __('Notifiche dei disegni', 'frmm-lavagna'),
        function () {
            printf(
                '<input type="email" class="regular-text" name="%1$s" id="%1$s" value="%2$s" placeholder="%3$s">'
                . '<p class="description">%4$s</p>',
                esc_attr(FRMM_LAVAGNA_OPZIONE_DESTINATARIO),
                esc_attr(get_option(FRMM_LAVAGNA_OPZIONE_DESTINATARIO, '')),
                esc_attr(get_option('admin_email')),
                esc_html__('A chi arriva la mail di ogni disegno nuovo, con il link per approvarlo o rifiutarlo. Chi la riceve modera senza entrare in WordPress. Vuoto: l\'indirizzo email di amministrazione.', 'frmm-lavagna')
            );
        },
        'general',
        'default',
        ['label_for' => FRMM_LAVAGNA_OPZIONE_DESTINATARIO]
    );
});

function frmm_lavagna_destinatario()
{
    $a = (string) get_option(FRMM_LAVAGNA_OPZIONE_DESTINATARIO, '');
    return is_email($a) ? $a : get_option('admin_email');
}

/* --- il link ------------------------------------------------------------------ */

/**
 * Il segreto dei link, creato al primo uso. Suo e non il salt del sito:
 * cambiarlo deve poter spegnere i link senza scollegare nessuno.
 */
function frmm_lavagna_segreto_mail()
{
    $s = (string) get_option(FRMM_LAVAGNA_OPZIONE_SEGRETO, '');
    if (strlen($s) < 32) {
        $s = wp_generate_password(64, true, true);
        update_option(FRMM_LAVAGNA_OPZIONE_SEGRETO, $s, false);
    }
    return $s;
}

/**
 * Il link di un disegno. I link delle mail della 1.10.x hanno in piu' un
 * parametro "a" (il tasto premuto): la firma non lo copre, e la pagina lo
 * ignora, quindi continuano a funzionare fino alla loro scadenza.
 */
function frmm_lavagna_link_mail($id, $scadenza)
{
    return add_query_arg([
        'action' => 'frmm_mail',
        'd'      => (int) $id,
        's'      => (int) $scadenza,
        'f'      => frmm_lavagna_firma_mail($id, $scadenza, frmm_lavagna_segreto_mail()),
    ], admin_url('admin-post.php'));
}

/* --- la pagina ---------------------------------------------------------------- */

// Tutte e due: admin-post.php chiama la _nopriv per chi non e' collegato, e
// l'altra per chi lo e' — Daniele, che apre la mail dallo stesso browser con
// cui usa la bacheca.
add_action('admin_post_nopriv_frmm_mail', 'frmm_lavagna_pagina_mail');
add_action('admin_post_frmm_mail', 'frmm_lavagna_pagina_mail');

function frmm_lavagna_pagina_mail()
{
    $id       = isset($_GET['d']) ? (int) $_GET['d'] : 0;
    $scadenza = isset($_GET['s']) ? (int) $_GET['s'] : 0;
    $firma    = isset($_GET['f']) ? (string) wp_unslash($_GET['f']) : '';

    $esito = frmm_lavagna_verifica_mail($id, $scadenza, $firma, frmm_lavagna_segreto_mail(), time());
    if ($esito === 'firma') {
        frmm_lavagna_rispondi_mail(403, __('Link non valido', 'frmm-lavagna'),
            '<p class="messaggio">' . esc_html__('Questo link non è valido. Usa il link della mail così come è arrivato.', 'frmm-lavagna') . '</p>');
    }
    if ($esito === 'scaduto') {
        frmm_lavagna_rispondi_mail(410, __('Link scaduto', 'frmm-lavagna'),
            '<p class="messaggio">' . esc_html__('Questo link valeva 7 giorni ed è scaduto. Il disegno resta in attesa: se ne occupa chi gestisce il sito.', 'frmm-lavagna') . '</p>');
    }

    $post = get_post($id);
    if (!$post || $post->post_type !== FRMM_LAVAGNA_CPT) {
        frmm_lavagna_rispondi_mail(404, __('Disegno non trovato', 'frmm-lavagna'),
            '<p class="messaggio">' . esc_html__('Questo disegno non esiste più.', 'frmm-lavagna') . '</p>');
    }

    // L'azione: solo in POST, solo su un disegno ancora in attesa.
    $fatto = '';
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && get_post_status($id) === 'pending') {
        $azione = isset($_POST['azione']) ? (string) $_POST['azione'] : '';
        if ($azione === 'approva') {
            wp_publish_post($id);
        } elseif ($azione === 'rifiuta') {
            wp_trash_post($id);
        }
        if (get_post_status($id) !== 'pending') {
            update_post_meta($id, '_frmm_moderato_via', 'email');
            update_post_meta($id, '_frmm_moderato_il', time());
            $fatto = $azione;
        }
    }

    // Il titolo dice lo stato, anche subito dopo il tasto (Daniele, 26/09/2026):
    // stessa lettura di frmm_lavagna_corpo_mail(), fuori da pending e da
    // publish e' rifiutato (cestino, o eliminato dalla bacheca).
    $stato = get_post_status($id);
    if ($stato === 'pending') {
        $titolo = __('Nuovo disegno', 'frmm-lavagna');
    } elseif ($stato === 'publish') {
        $titolo = __('Disegno approvato', 'frmm-lavagna');
    } else {
        $titolo = __('Disegno rifiutato', 'frmm-lavagna');
    }

    frmm_lavagna_rispondi_mail(
        200,
        $titolo,
        frmm_lavagna_corpo_mail($id, $scadenza, $fatto),
        sprintf(
            /* translators: 1: data, 2: ora dell'invio */
            __('Arrivato il %1$s alle %2$s', 'frmm-lavagna'),
            get_the_date('d/m/Y', $post),
            get_the_time('H:i', $post)
        )
    );
}

/**
 * Il corpo della pagina, secondo lo stato del disegno.
 *
 * In attesa: il disegno, e sotto i due pulsanti affiancati. Rifiuta e'
 * senza bordo (Daniele, 26/09/2026), quindi pesa meno di Approva: fino alla
 * 1.11.3 erano di pari peso, perche' il link della mail non dice quale dei
 * due e la pagina non doveva suggerirlo. Obiezione registrata: l'errore
 * piu' costoso e' pubblicare per distrazione, non scartare.
 * Il disegno ha le classi del sito drop-shadow e random-tilt (Daniele,
 * 26/09/2026), definite in fondo a frmm_lavagna_rispondi_mail().
 */
function frmm_lavagna_corpo_mail($id, $scadenza, $fatto)
{
    $stato = get_post_status($id);
    $img = wp_get_attachment_image_url((int) get_post_thumbnail_id($id), 'large');
    $disegno = $img ? '<img class="disegno drop-shadow random-tilt" src="' . esc_url($img) . '" alt="">' : '';

    $esito = null;
    if ($fatto === 'approva') {
        $esito = ['approva', __('Fatto: il disegno è approvato. Comparirà nella galleria del sito.', 'frmm-lavagna')];
    } elseif ($fatto === 'rifiuta') {
        $esito = ['rifiuta', __('Fatto: il disegno è rifiutato. Non comparirà da nessuna parte.', 'frmm-lavagna')];
    } elseif ($stato === 'publish') {
        $esito = ['approva', __('Questo disegno è già stato approvato.', 'frmm-lavagna')];
    } elseif ($stato !== 'pending') {
        $esito = ['rifiuta', __('Questo disegno è già stato rifiutato.', 'frmm-lavagna')];
    }
    if ($esito) {
        return $disegno
            . '<p class="esito">' . frmm_lavagna_icona_mail($esito[0]) . '<span>' . esc_html($esito[1]) . '</span></p>';
    }

    // L'azione del modulo e' la stessa pagina, col suo link firmato.
    $h = $disegno . '<form method="post" action="' . esc_url(add_query_arg([])) . '" class="scelta">';
    foreach (['approva' => __('Approva', 'frmm-lavagna'), 'rifiuta' => __('Rifiuta', 'frmm-lavagna')] as $azione => $testo) {
        $h .= sprintf(
            '<button type="submit" name="azione" value="%1$s" class="%1$s">%2$s<span>%3$s</span></button>',
            esc_attr($azione),
            frmm_lavagna_icona_mail($azione),
            esc_html($testo)
        );
    }
    return $h . '</form>'
        . '<p class="nota">' . esc_html(sprintf(
            /* translators: %s: data e ora di scadenza del link */
            __('Approvato, il disegno comparirà nella galleria del sito; rifiutato, non lo vedrà nessuno. Questo link vale fino al %s.', 'frmm-lavagna'),
            wp_date('d/m/Y H:i', $scadenza)
        )) . '</p>';
}

/**
 * Il segno di spunta o la croce, nel colore del testo. Fino alla 1.11.2 erano
 * verde e rosso su tasti bianchi; sui tasti del sito, bianchi e trasparenti
 * sull'arancione, un verde e un rosso scuri non si leggevano: approva e
 * rifiuta li dicono la forma del segno e le parole.
 */
function frmm_lavagna_icona_mail($azione)
{
    $tratto = $azione === 'rifiuta' ? 'M6 6l12 12M18 6L6 18' : 'M4.5 12.5l5 5L19.5 7';
    return '<svg class="icona ' . esc_attr($azione) . '" viewBox="0 0 24 24" aria-hidden="true">'
        . '<path d="' . $tratto . '" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="square"/></svg>';
}

/**
 * Stampa la pagina ed esce. Nessuna cache, nessun indice, nessun referrer:
 * l'URL contiene la firma, e non deve finire nei log di nessuno.
 *
 * L'aspetto e' quello della Fondazione: fondo arancione istituzionale
 * (#FF6000, lo stesso del tutorial della lavagna), SebinoSoft, testi bianchi
 * (Daniele, 26/09/2026; il bianco sull'arancione ha contrasto 3:1, per questo
 * i corpi sono generosi).
 *
 * ⚠️ ANCHE I TASTI SONO UNA COPIA, dal kit di Elementor del sito
 * (.elementor-kit-15, letto il 26/09/2026 dal CSS combinato di produzione):
 * fondo bianco al 10% (--e-global-color-3a0fda2), bordo 2px bianco al 33%
 * (--e-global-color-34c2569), raggio 0, SebinoSoft Medium maiuscolo con
 * spaziatura 0.3px, padding 1.1em 1.2em, corpo clamp(0.8rem, 0.9vw, 1rem),
 * 16px sotto i 1025, 14px sotto i 768. Al passaggio: fondo al 33% e bordo
 * trasparente, in .3s. Scostamento voluto: l'altezza minima di 56px, che sul
 * sito non c'e', perche' qui il tasto pubblica un disegno e va preso col dito
 * al primo colpo. Se il sito cambia i suoi tasti, qui restano com'erano.
 *
 * ⚠️ drop-shadow e random-tilt SONO UNA COPIA. Nel sito stanno nel codice
 * personalizzato stampato dentro ogni pagina del tema, non in un file che si
 * possa collegare; e questa pagina non passa dal tema (ne' deve: si porterebbe
 * dietro header, footer e la cache di SiteGround). Copiati il 26/09/2026 dal
 * sito: ombra 0 0 20px 5px rgba(0,0,0,.44), rotazione casuale fra -4 e +4
 * gradi. Se il sito li cambia, qui restano com'erano.
 *
 * I font sono quelli che l'app ha gia' nello zip (app/font/): se mancano, il
 * testo esce in un carattere di sistema e la pagina funziona uguale.
 */
function frmm_lavagna_rispondi_mail($status, $titolo, $corpo, $sotto = '')
{
    status_header($status);
    nocache_headers();
    header('Content-Type: text/html; charset=utf-8');
    header('X-Robots-Tag: noindex, nofollow');
    header('Referrer-Policy: no-referrer');

    $principale = dirname(__DIR__) . '/frmm-lavagna.php';
    $font = '';
    foreach ([400 => 'Regular', 500 => 'Medium', 700 => 'Bold'] as $peso => $nome) {
        $font .= "@font-face{font-family:'SebinoSoft';font-weight:$peso;font-display:swap;src:url('"
            . esc_url(plugins_url("app/font/SebinoSoft-$nome.woff2", $principale)) . "') format('woff2')}";
    }

    $sito = wp_specialchars_decode(get_bloginfo('name'), ENT_QUOTES);
    echo '<!doctype html><html lang="it"><head><meta charset="utf-8">'
        . '<meta name="viewport" content="width=device-width,initial-scale=1">'
        . '<meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer">'
        . '<meta name="theme-color" content="#FF6000">'
        . '<title>' . esc_html($titolo) . '</title><style>' . $font
        . ':root{--arancio:#FF6000;--ink:#1F2225;--bianco:#FFFFFF;--tasto:#FFFFFF1A;--tasto-bordo:#FFFFFF54;'
        . "--tasto-corpo:clamp(0.8rem,0.9vw,1rem);--tasto-riga:16px}"
        . '@media(max-width:1024px){:root{--tasto-corpo:16px}}'
        . '@media(max-width:767px){:root{--tasto-corpo:14px;--tasto-riga:18px}}'
        . '*{box-sizing:border-box}'
        // overflow-x: il disegno ruotato e la sua ombra sporgono di qualche
        // pixel oltre il margine; senza, su telefono la pagina scorrerebbe di lato.
        . 'body{margin:0;min-height:100vh;overflow-x:hidden;background:var(--arancio);color:var(--bianco);'
        . "font:17px/1.45 'SebinoSoft',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}"
        . 'main{max-width:560px;margin:0 auto;padding:28px 16px 40px}'
        . '.sito{margin:0 0 10px;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}'
        . 'h1{margin:0;font-size:30px;line-height:1.1;font-weight:700}'
        . '.sotto{margin:6px 0 0;font-size:16px}'
        // Il disegno: alto al massimo meta' schermo, perche' i pulsanti sotto
        // si vedano senza scorrere anche con un disegno fatto col telefono in
        // verticale, che e' piu' alto che largo.
        . '.disegno{display:block;max-width:100%;max-height:50vh;width:auto;height:auto;margin:32px auto;background:#1F2225}'
        . '.scelta{display:flex;gap:12px;margin:0}'
        . 'button{-webkit-appearance:none;appearance:none;font:inherit;cursor:pointer;touch-action:manipulation;'
        . 'flex:1 1 0;display:flex;align-items:center;justify-content:center;gap:.6em;min-height:56px;padding:1.1em 1.2em;'
        . 'background:var(--tasto);color:var(--bianco);border:2px solid var(--tasto-bordo);border-radius:0;'
        . 'font-size:var(--tasto-corpo);font-weight:500;line-height:var(--tasto-riga);letter-spacing:.3px;'
        . 'text-transform:uppercase;transition:all .3s}'
        . 'button:hover,button:focus{background:var(--tasto-bordo);border-color:transparent}'
        // Rifiuta senza bordo: trasparente e non tolto, cosi' i due tasti
        // restano alti uguale. E' anche una variante del sito (fondo al 10%,
        // nessun bordo).
        . 'button.rifiuta{border-color:transparent}'
        . 'button:focus-visible{outline:3px solid var(--ink);outline-offset:3px}'
        . '.icona{width:1.2em;height:1.2em;flex:0 0 auto}'
        // Senza fondo (Daniele, 26/09/2026): e' una frase, non un riquadro.
        . '.esito{display:flex;gap:.6em;align-items:flex-start;margin:0;'
        . 'font-size:19px;font-weight:700;line-height:1.3}'
        . '.esito .icona{margin-top:.05em}'
        . '.nota{margin:18px 0 0;font-size:15px}'
        . '.messaggio{margin:24px 0 0;font-size:18px}'
        // Le due classi del sito, copiate (vedi sopra).
        . '.drop-shadow{box-shadow:0px 0px 20px 5px rgba(0,0,0,0.44)!important}'
        . '.random-tilt{will-change:transform;backface-visibility:hidden;-webkit-backface-visibility:hidden}'
        . '</style></head><body><main>'
        . '<p class="sito">' . esc_html($sito) . '</p>'
        . '<h1>' . esc_html($titolo) . '</h1>'
        . ($sotto !== '' ? '<p class="sotto">' . esc_html($sotto) . '</p>' : '')
        . $corpo
        . '</main>'
        // La rotazione di random-tilt, copiata dal sito: uno script, perche'
        // l'angolo e' casuale a ogni apertura. Non tocca l'azione: fa solo
        // girare l'immagine.
        . '<script>(function(){var A=-4,B=4;document.querySelectorAll(".random-tilt").forEach(function(e){'
        . 'if(e.dataset.tilted)return;var d=(Math.random()*(B-A)+A).toFixed(2);'
        . 'e.style.transition="none";e.style.transform="rotate("+d+"deg) translateZ(0)";e.dataset.tilted="true";});})();</script>'
        . '</body></html>';
    exit;
}

/* --- per le prove ------------------------------------------------------------- */

/**
 * Il link di un disegno, e com'e' stato moderato. Solo amministratore: serve
 * a .lavoro/prova-mail.py, che la posta non la legge.
 */
add_action('rest_api_init', function () {
    register_rest_route(FRMM_LAVAGNA_REST_NS, '/link-mail', [
        'methods'             => 'GET',
        'callback'            => function ($req) {
            $id = (int) $req->get_param('disegno');
            if (get_post_type($id) !== FRMM_LAVAGNA_CPT) {
                return new WP_Error('frmm_disegno', 'non e\' un disegno', ['status' => 404]);
            }
            return [
                'stato'         => get_post_status($id),
                'link'          => frmm_lavagna_link_mail($id, time() + FRMM_LAVAGNA_MAIL_DURATA),
                'moderato_via'  => get_post_meta($id, '_frmm_moderato_via', true) ?: null,
                'approvato_il'  => get_post_meta($id, '_frmm_approvato_il', true) ?: null,
                'destinatario'  => frmm_lavagna_destinatario(),
            ];
        },
        'permission_callback' => function () {
            return current_user_can('manage_options');
        },
    ]);
});
