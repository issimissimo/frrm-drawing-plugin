<?php
/**
 * L'email a ogni disegno arrivato, con la miniatura (Fase 7 del brief).
 *
 * La miniatura e' INCORPORATA nel messaggio (cid:), non linkata. Un'immagine
 * remota la maggior parte dei programmi di posta la blocca finche' non si
 * dice "mostra immagini", e l'email si riduce a un riquadro vuoto — che per
 * chi deve decidere se aprire la bacheca e' come non averla.
 *
 * A chi: admin_email del sito. Sullo staging e' l'indirizzo di Daniele, in
 * produzione sara' quello della Fondazione. Per mandarla altrove senza
 * toccare admin_email:
 *
 *   add_filter('frmm_lavagna_destinatari', fn () => 'moderazione@...');
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
    $a = apply_filters('frmm_lavagna_destinatari', get_option('admin_email'), $post_id);
    if (!$a) {
        return false;
    }

    $sito = wp_specialchars_decode(get_bloginfo('name'), ENT_QUOTES);
    $link = admin_url('edit.php?post_type=' . FRMM_LAVAGNA_CPT . '&post_status=pending');
    $attesa = (int) wp_count_posts(FRMM_LAVAGNA_CPT)->pending;
    $mini = frmm_lavagna_file_miniatura($att_id);

    $corpo = '<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#222">'
        . '<p>' . esc_html__('È arrivato un disegno dalla lavagna.', 'frmm-lavagna') . '</p>'
        . ($mini ? '<p><img src="cid:frmm-disegno" alt="" width="300" style="display:block;max-width:100%;height:auto;background:#1F2225"></p>' : '')
        . '<p>' . esc_html(sprintf(
            _n('In bacheca c\'è %d disegno da guardare.', 'In bacheca ci sono %d disegni da guardare.', $attesa, 'frmm-lavagna'),
            $attesa
        )) . '</p>'
        . '<p><a href="' . esc_url($link) . '">' . esc_html__('Apri i disegni in attesa', 'frmm-lavagna') . '</a></p>'
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
