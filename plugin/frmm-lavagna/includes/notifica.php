<?php
/**
 * L'email a ogni disegno arrivato, con la miniatura (Fase 7 del brief).
 *
 * La miniatura e' INCORPORATA nel messaggio (cid:), non linkata. Un'immagine
 * remota la maggior parte dei programmi di posta la blocca finche' non si
 * dice "mostra immagini", e l'email si riduce a un riquadro vuoto — che per
 * chi deve decidere se aprire la bacheca e' come non averla.
 *
 * A chi: dalla 1.10.0 l'impostazione "Notifiche dei disegni" in Impostazioni
 * > Generali (moderazione-mail.php); vuota, admin_email. Il filtro resta:
 *
 *   add_filter('frmm_lavagna_destinatari', fn () => 'moderazione@...');
 *
 * Dalla 1.10.0 la mail ha i tasti Approva e Rifiuta e NON ha piu' il link
 * alla bacheca: la riceve il cliente, che in WordPress non entra (Daniele,
 * 26/09/2026). Per lo stesso motivo non dice piu' quanti disegni ci sono "in
 * bacheca".
 *
 * Una email per disegno. Il tetto lo mette il rate limit dell'invio (passo 4
 * del piano): senza, 500 invii sarebbero 500 email.
 */

if (!defined('ABSPATH')) {
    exit;
}

add_action('frmm_lavagna_nuovo_disegno', 'frmm_lavagna_notifica', 10, 2);

function frmm_lavagna_notifica($post_id, $att_id)
{
    $a = apply_filters('frmm_lavagna_destinatari', frmm_lavagna_destinatario(), $post_id);
    if (!$a) {
        return false;
    }

    $sito = wp_specialchars_decode(get_bloginfo('name'), ENT_QUOTES);
    $mini = frmm_lavagna_file_miniatura($att_id);
    $scadenza = time() + FRMM_LAVAGNA_MAIL_DURATA;

    // I tasti sono celle di tabella: bordo, fondo, padding e distanza stanno
    // sulla <td>, che tutti i programmi di posta rispettano. Con gli stili
    // sull'<a> (1.10.0) Gmail teneva i colori e buttava bordo, padding e
    // margine: due parole colorate attaccate, non due tasti (screenshot di
    // Daniele, 26/09/2026). Squadrati come i tasti del sito.
    //
    // Aprono una pagina, non agiscono: il perche' e' in cima a
    // moderazione-mail.php.
    $tasto = '<td style="border:2px solid %2$s;background:%3$s;padding:13px 26px">'
        . '<a href="%1$s" style="font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;'
        . 'letter-spacing:1px;text-transform:uppercase;text-decoration:none;color:%4$s">%5$s</a></td>';
    $tasti = '<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:22px 0 12px"><tr>'
        . sprintf($tasto, esc_url(frmm_lavagna_link_mail($post_id, 'approva', $scadenza)),
            '#2f6b4a', '#2f6b4a', '#ffffff', esc_html__('Approva', 'frmm-lavagna'))
        . '<td style="width:20px;font-size:0;line-height:0">&nbsp;</td>'
        . sprintf($tasto, esc_url(frmm_lavagna_link_mail($post_id, 'rifiuta', $scadenza)),
            '#9a3b32', '#ffffff', '#9a3b32', esc_html__('Rifiuta', 'frmm-lavagna'))
        . '</tr></table>';

    $corpo = '<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#222">'
        . '<p>' . esc_html__('È arrivato un disegno dalla lavagna.', 'frmm-lavagna') . '</p>'
        . ($mini ? '<p><img src="cid:frmm-disegno" alt="" width="300" style="display:block;max-width:100%;height:auto;background:#1F2225"></p>' : '')
        . $tasti
        . '<p style="font-size:13px;color:#666">' . esc_html(sprintf(
            /* translators: %s: data e ora di scadenza dei tasti */
            __('I tasti aprono una pagina dove il disegno si vede grande e si conferma la scelta. Valgono fino al %s.', 'frmm-lavagna'),
            wp_date('d/m/Y H:i', $scadenza)
        )) . '</p>'
        . '</div>';

    // L'immagine incorporata passa da PHPMailer, a cui wp_mail non da'
    // accesso diretto: ci si aggancia a phpmailer_init solo per QUESTA email,
    // e ci si stacca subito dopo — altrimenti la miniatura finirebbe in ogni
    // email che il sito manda nella stessa richiesta.
    $incorpora = function ($m) use ($mini) {
        $m->addEmbeddedImage($mini, 'frmm-disegno', 'disegno.jpg', 'base64', 'image/jpeg');
    };
    if ($mini) {
        add_action('phpmailer_init', $incorpora);
    }
    $ok = wp_mail(
        $a,
        /* translators: %s: nome del sito */
        sprintf(__('[%s] Un nuovo disegno da guardare', 'frmm-lavagna'), $sito),
        $corpo,
        ['Content-Type: text/html; charset=UTF-8']
    );
    if ($mini) {
        remove_action('phpmailer_init', $incorpora);
    }

    // Un'email che non parte non deve far fallire l'invio del bambino: il
    // disegno e' gia' in bacheca. Resta traccia nel log.
    if (!$ok) {
        error_log('[frmm-lavagna] email di notifica non partita per il disegno ' . (int) $post_id);
    }
    return $ok;
}

/**
 * Il file della miniatura 'medium' (300 px), non l'originale: 1600 px pieni
 * di grana di gesso in una email sono qualche centinaio di KB per niente.
 */
function frmm_lavagna_file_miniatura($att_id)
{
    $m = image_get_intermediate_size($att_id, 'medium');
    if ($m && !empty($m['path'])) {
        $f = trailingslashit(wp_upload_dir()['basedir']) . $m['path'];
        if (is_file($f)) {
            return $f;
        }
    }
    $f = get_attached_file($att_id);
    return ($f && is_file($f)) ? $f : '';
}
