<?php
/**
 * L'email a ogni disegno arrivato (Fase 7 del brief).
 *
 * Dalla 1.11.0 (Daniele, 26/09/2026) e' una mail di tre righe: il disegno e'
 * arrivato, un link per guardarlo e deciderne, la scadenza del link. Niente
 * miniatura e niente tasti.
 *
 * - LA MINIATURA NON C'E' PIU', ed e' voluto: la pagina del link mostra il
 *   disegno grande, e nella mail era un doppione. Effetto collaterale utile:
 *   un disegno inappropriato non finisce piu' nella casella di nessuno.
 *   Fino alla 1.10.x era incorporata (cid:) con un aggancio a phpmailer_init:
 *   chi la rimettesse, la rimetta incorporata e non linkata, o i programmi di
 *   posta la bloccano e resta un riquadro vuoto.
 * - UN LINK SOLO, non due tasti: i tasti Approva / Rifiuta nella mail
 *   promettevano un'azione che non potevano fare (il perche' e' in cima a
 *   moderazione-mail.php). Il link dice quel che fa: apre il disegno, e li'
 *   si approva o si rifiuta.
 *
 * A chi: l'impostazione "Notifiche dei disegni" in Impostazioni > Generali
 * (moderazione-mail.php); vuota, admin_email. La riceve il cliente, che in
 * WordPress non entra: per questo la mail non ha il link alla bacheca. Il
 * filtro resta:
 *
 *   add_filter('frmm_lavagna_destinatari', fn () => 'moderazione@...');
 *
 * Una email per disegno. Il tetto lo mette il rate limit dell'invio
 * (limiti.php): 3 per dispositivo, 20 per IP in 24 ore.
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
    $scadenza = time() + FRMM_LAVAGNA_MAIL_DURATA;

    $corpo = '<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#222">'
        . '<p style="margin:0 0 18px">' . esc_html__('È arrivato un disegno dalla lavagna.', 'frmm-lavagna') . '</p>'
        // Colore e sottolineatura stanno sullo <span>, non sull'<a>: Gmail
        // (tema scuro) ignorava il colore dell'<a> e metteva il suo, con la
        // sottolineatura di un altro colore ancora (screenshot di Daniele,
        // 26/09/2026). Cosi' testo e riga li disegna lo stesso elemento.
        // Arancione istituzionale: si legge sul bianco e sul tema scuro; il
        // nero lavagna sul tema scuro sparirebbe.
        . '<p style="margin:0 0 6px"><a href="' . esc_url(frmm_lavagna_link_mail($post_id, $scadenza)) . '"'
        . ' style="color:#FF6000;text-decoration:none">'
        . '<span style="font-size:17px;font-weight:bold;color:#FF6000;text-decoration:underline">'
        . esc_html__('Guardalo per approvarlo o rifiutarlo', 'frmm-lavagna') . '</span></a></p>'
        . '<p style="margin:0;font-size:13px;color:#777">' . esc_html(sprintf(
            /* translators: %s: data e ora di scadenza del link */
            __('Valido fino al %s', 'frmm-lavagna'),
            wp_date('d/m/Y H:i', $scadenza)
        )) . '</p>'
        . '</div>';

    // Il mittente: il nome del sito e non "WordPress", che e' il default di
    // wp_mail (Daniele, 26/09/2026). Solo il NOME: l'indirizzo resta quello
    // di WordPress, wordpress@<dominio>, perche' le mail escono dai server
    // di SiteGround che l'SPF del dominio autorizza; un indirizzo scelto a
    // mano rischierebbe lo spam. Il filtro si aggancia solo per QUESTA mail.
    $nome = function () use ($sito) {
        return $sito;
    };
    add_filter('wp_mail_from_name', $nome);
    $ok = wp_mail(
        $a,
        // Niente "[nome del sito]" in testa all'oggetto (Daniele, 26/09/2026):
        // il nome c'e' gia' nel mittente, e ripeterlo spingeva fuori dalla
        // colonna dei programmi di posta proprio le parole che contano.
        __('Un nuovo disegno da guardare', 'frmm-lavagna'),
        $corpo,
        ['Content-Type: text/html; charset=UTF-8']
    );
    remove_filter('wp_mail_from_name', $nome);

    // Un'email che non parte non deve far fallire l'invio del bambino: il
    // disegno e' gia' in bacheca. Resta traccia nel log.
    if (!$ok) {
        error_log('[frmm-lavagna] email di notifica non partita per il disegno ' . (int) $post_id);
    }
    return $ok;
}
