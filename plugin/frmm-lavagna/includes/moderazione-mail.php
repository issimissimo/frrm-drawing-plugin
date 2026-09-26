<?php
/**
 * Approva / Rifiuta dalla mail di notifica (dalla 1.10.0).
 *
 * La mail va al cliente, che NON ha un accesso a WordPress (Daniele,
 * 26/09/2026): i due tasti della mail sono il suo solo modo di moderare.
 *
 * COME FUNZIONA. Ogni disegno ha un link firmato (validazione.php), valido 7
 * giorni. I due tasti portano allo stesso link, cambia solo quale azione la
 * pagina mette in evidenza. Il link apre una pagina col disegno a grandezza
 * piena e i due pulsanti; e' il pulsante, in POST, che agisce.
 *
 * ⚠️ APRIRE IL LINK NON DEVE MAI CAMBIARE NIENTE. I filtri antispam, Safe
 * Links di Outlook e le anteprime dei programmi di posta aprono da soli i
 * link che trovano: se bastasse aprirlo, uno scanner che li segue tutti e due
 * approverebbe e rifiuterebbe senza che nessuno abbia guardato il disegno.
 * Chi trasformasse la pagina in un'azione diretta sul GET "per risparmiare un
 * tocco" riaprirebbe esattamente quel buco.
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
                esc_html__('A chi arriva la mail di ogni disegno nuovo, con i tasti Approva e Rifiuta. Chi la riceve modera senza entrare in WordPress. Vuoto: l\'indirizzo email di amministrazione.', 'frmm-lavagna')
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

/** Il link di un disegno, con l'azione da mettere in evidenza. */
function frmm_lavagna_link_mail($id, $azione, $scadenza)
{
    return add_query_arg([
        'action' => 'frmm_mail',
        'd'      => (int) $id,
        's'      => (int) $scadenza,
        'f'      => frmm_lavagna_firma_mail($id, $scadenza, frmm_lavagna_segreto_mail()),
        'a'      => $azione === 'rifiuta' ? 'rifiuta' : 'approva',
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
    $evidenza = (isset($_GET['a']) && $_GET['a'] === 'rifiuta') ? 'rifiuta' : 'approva';

    $esito = frmm_lavagna_verifica_mail($id, $scadenza, $firma, frmm_lavagna_segreto_mail(), time());
    if ($esito === 'firma') {
        frmm_lavagna_rispondi_mail(403, __('Link non valido', 'frmm-lavagna'),
            '<p>' . esc_html__('Questo link non è valido. Usa i tasti della mail così come sono arrivati.', 'frmm-lavagna') . '</p>');
    }
    if ($esito === 'scaduto') {
        frmm_lavagna_rispondi_mail(410, __('Link scaduto', 'frmm-lavagna'),
            '<p>' . esc_html__('Questo link valeva 7 giorni ed è scaduto. Il disegno resta in attesa: se ne occupa chi gestisce il sito.', 'frmm-lavagna') . '</p>');
    }

    $post = get_post($id);
    if (!$post || $post->post_type !== FRMM_LAVAGNA_CPT) {
        frmm_lavagna_rispondi_mail(404, __('Disegno non trovato', 'frmm-lavagna'),
            '<p>' . esc_html__('Questo disegno non esiste più.', 'frmm-lavagna') . '</p>');
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

    frmm_lavagna_rispondi_mail(200, $post->post_title, frmm_lavagna_corpo_mail($id, $scadenza, $evidenza, $fatto));
}

/** Il corpo della pagina, secondo lo stato del disegno. */
function frmm_lavagna_corpo_mail($id, $scadenza, $evidenza, $fatto)
{
    $stato = get_post_status($id);
    $h = '';

    $img = wp_get_attachment_image_url((int) get_post_thumbnail_id($id), 'large');
    if ($img) {
        $h .= '<img src="' . esc_url($img) . '" alt="">';
    }

    if ($fatto === 'approva') {
        return $h . '<p class="esito">' . esc_html__('Fatto: il disegno è approvato. Comparirà nella galleria del sito.', 'frmm-lavagna') . '</p>';
    }
    if ($fatto === 'rifiuta') {
        return $h . '<p class="esito">' . esc_html__('Fatto: il disegno è rifiutato. Non comparirà da nessuna parte.', 'frmm-lavagna') . '</p>';
    }
    if ($stato === 'publish') {
        return $h . '<p class="esito">' . esc_html__('Questo disegno è già stato approvato.', 'frmm-lavagna') . '</p>';
    }
    if ($stato !== 'pending') {
        return $h . '<p class="esito">' . esc_html__('Questo disegno è già stato rifiutato.', 'frmm-lavagna') . '</p>';
    }

    // In attesa: i due pulsanti, quello del tasto premuto nella mail per primo
    // e pieno. L'azione del modulo e' la stessa pagina, col suo link firmato.
    $url = esc_url(add_query_arg([]));
    $bottoni = [
        'approva' => __('Approva', 'frmm-lavagna'),
        'rifiuta' => __('Rifiuta', 'frmm-lavagna'),
    ];
    if ($evidenza === 'rifiuta') {
        $bottoni = array_reverse($bottoni, true);
    }
    $h .= '<form method="post" action="' . $url . '">';
    foreach ($bottoni as $azione => $testo) {
        $h .= sprintf(
            '<button type="submit" name="azione" value="%s" class="%s%s">%s</button>',
            esc_attr($azione),
            esc_attr($azione),
            $azione === $evidenza ? ' pieno' : '',
            esc_html($testo)
        );
    }
    $h .= '</form>';
    $h .= '<p class="nota">' . esc_html(sprintf(
        /* translators: %s: data e ora di scadenza del link */
        __('Approvato, il disegno comparirà nella galleria del sito; rifiutato, non lo vedrà nessuno. Questo link vale fino al %s.', 'frmm-lavagna'),
        wp_date('d/m/Y H:i', $scadenza)
    )) . '</p>';
    return $h;
}

/**
 * Stampa la pagina ed esce. Nessuna cache, nessun indice, nessun referrer:
 * l'URL contiene la firma, e non deve finire nei log di nessuno.
 */
function frmm_lavagna_rispondi_mail($status, $titolo, $corpo)
{
    status_header($status);
    nocache_headers();
    header('Content-Type: text/html; charset=utf-8');
    header('X-Robots-Tag: noindex, nofollow');
    header('Referrer-Policy: no-referrer');

    $sito = wp_specialchars_decode(get_bloginfo('name'), ENT_QUOTES);
    echo '<!doctype html><html lang="it"><head><meta charset="utf-8">'
        . '<meta name="viewport" content="width=device-width,initial-scale=1">'
        . '<meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer">'
        . '<title>' . esc_html($titolo) . '</title><style>'
        . 'body{margin:0;background:#f4f3f0;color:#222;font:16px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}'
        . 'main{max-width:640px;margin:0 auto;padding:24px 16px 40px}'
        . '.sito{margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#777}'
        . 'h1{margin:0 0 16px;font-size:20px}'
        . 'img{display:block;width:100%;height:auto;background:#1F2225;margin:0 0 20px}'
        . 'form{display:flex;gap:12px;flex-wrap:wrap}'
        . 'button{flex:1 1 160px;min-height:52px;font:inherit;font-weight:700;border-radius:8px;cursor:pointer;background:#fff;border:2px solid}'
        . '.approva{color:#2f6b4a;border-color:#2f6b4a}.rifiuta{color:#9a3b32;border-color:#9a3b32}'
        . '.approva.pieno{background:#2f6b4a;color:#fff}.rifiuta.pieno{background:#9a3b32;color:#fff}'
        . '.esito{font-size:18px;font-weight:700}.nota{font-size:14px;color:#666;margin-top:20px}'
        . '</style></head><body><main>'
        . '<p class="sito">' . esc_html($sito) . '</p>'
        . '<h1>' . esc_html($titolo) . '</h1>'
        . $corpo
        . '</main></body></html>';
    exit;
}

/* --- per le prove ------------------------------------------------------------- */

/**
 * I link di un disegno, e com'e' stato moderato. Solo amministratore: serve a
 * .lavoro/prova-mail.py, che la posta non la legge.
 */
add_action('rest_api_init', function () {
    register_rest_route(FRMM_LAVAGNA_REST_NS, '/link-mail', [
        'methods'             => 'GET',
        'callback'            => function ($req) {
            $id = (int) $req->get_param('disegno');
            if (get_post_type($id) !== FRMM_LAVAGNA_CPT) {
                return new WP_Error('frmm_disegno', 'non e\' un disegno', ['status' => 404]);
            }
            $scadenza = time() + FRMM_LAVAGNA_MAIL_DURATA;
            return [
                'stato'         => get_post_status($id),
                'approva'       => frmm_lavagna_link_mail($id, 'approva', $scadenza),
                'rifiuta'       => frmm_lavagna_link_mail($id, 'rifiuta', $scadenza),
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
