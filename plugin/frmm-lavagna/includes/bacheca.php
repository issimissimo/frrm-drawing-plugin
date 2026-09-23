<?php
/**
 * La moderazione in bacheca: Disegni → la miniatura, Approva, Rifiuta.
 *
 * Il criterio del brief (Fase 7): si modera GUARDANDO LE MINIATURE, senza
 * aprire niente, in due click — uno per arrivare all'elenco, uno per
 * decidere. Da qui:
 *
 *   - l'elenco ha la miniatura al posto del titolo, che era una data;
 *   - Approva e Rifiuta sono pulsanti nella riga, non voci di un menu;
 *   - il menu Disegni porta il numero di quelli in attesa, come i commenti;
 *   - Approva si puo' fare anche in blocco, dal menu delle azioni di gruppo.
 *
 * Approvare = pubblicare il post. Il CPT resta non pubblico: pubblicato vuol
 * dire solo "la galleria lo puo' prendere" (D3). Rifiutare = cestino; cosa
 * succede dopo al file e' la retention (passo 5 del piano).
 *
 * E una cosa che non si vede: i disegni NON approvati spariscono dalla
 * Libreria media. Senza, chi cerca una foto per una pagina della Fondazione
 * se li ritrova mescolati alle immagini del sito, e ne puo' inserire uno per
 * sbaglio prima che qualcuno l'abbia guardato.
 */

if (!defined('ABSPATH')) {
    exit;
}

/* --- le colonne ------------------------------------------------------------- */

add_filter('manage_' . FRMM_LAVAGNA_CPT . '_posts_columns', function ($cols) {
    return [
        'cb'               => $cols['cb'],
        'frmm_miniatura'   => __('Disegno', 'frmm-lavagna'),
        'frmm_moderazione' => __('Moderazione', 'frmm-lavagna'),
        // Quante volte l'app ha dovuto provare prima che arrivasse. E' la
        // misura della ripresa (vedi invio.php): se i 2 e i 3 fossero tanti,
        // l'invio in parallelo alla condivisione non basterebbe.
        'frmm_tentativo'   => __('Tentativo', 'frmm-lavagna'),
        'date'             => $cols['date'],
    ];
});

// Le azioni di riga (Modifica, Cestino) WordPress le mette nella colonna
// principale, che di norma e' il titolo. Il titolo non c'e' piu': la
// principale diventa la miniatura.
add_filter('list_table_primary_column', function ($col, $screen) {
    return $screen === 'edit-' . FRMM_LAVAGNA_CPT ? 'frmm_miniatura' : $col;
}, 10, 2);

add_action('manage_' . FRMM_LAVAGNA_CPT . '_posts_custom_column', function ($col, $id) {
    if ($col === 'frmm_miniatura') {
        $att = get_post_thumbnail_id($id);
        if (!$att) {
            echo '<em>' . esc_html__('senza immagine', 'frmm-lavagna') . '</em>';
            return;
        }
        // La miniatura porta all'immagine intera, in un'altra scheda: per
        // guardare un dettaglio non si apre la schermata di modifica.
        printf(
            '<a href="%s" target="_blank" rel="noopener" class="frmm-mini">%s</a>',
            esc_url(wp_get_attachment_url($att)),
            wp_get_attachment_image($att, 'medium', false, ['alt' => esc_attr(get_the_title($id))])
        );
        return;
    }

    if ($col === 'frmm_moderazione') {
        $stato = get_post_status($id);
        if ($stato === 'pending') {
            printf(
                '<a class="button button-primary" href="%s">%s</a> <a class="button" href="%s">%s</a>',
                esc_url(frmm_lavagna_url_azione('approva', $id)),
                esc_html__('Approva', 'frmm-lavagna'),
                esc_url(frmm_lavagna_url_azione('rifiuta', $id)),
                esc_html__('Rifiuta', 'frmm-lavagna')
            );
        } elseif ($stato === 'publish') {
            // Approvato si puo' ancora togliere: e' il ripensamento, e deve
            // costare quanto la decisione.
            printf(
                '<strong>%s</strong><br><a href="%s">%s</a>',
                esc_html__('Approvato', 'frmm-lavagna'),
                esc_url(frmm_lavagna_url_azione('rifiuta', $id)),
                esc_html__('Togli e rifiuta', 'frmm-lavagna')
            );
        } elseif ($stato === 'trash') {
            echo '<strong>' . esc_html__('Rifiutato', 'frmm-lavagna') . '</strong>';
        }
        return;
    }

    if ($col === 'frmm_tentativo') {
        $t = (int) get_post_meta($id, '_frmm_tentativo', true);
        echo $t ? (int) $t : '&mdash;';
    }
}, 10, 2);

// Le miniature a misura: 'medium' e' 300 px, qui ne bastano 180 per vederne
// una colonna intera senza scorrere a ogni disegno.
add_action('admin_head-edit.php', function () {
    if (get_current_screen()->post_type !== FRMM_LAVAGNA_CPT) {
        return;
    }
    echo '<style>'
        . '.column-frmm_miniatura{width:200px}'
        . '.frmm-mini img{display:block;width:180px;height:auto;max-height:240px;object-fit:contain;background:#1F2225}'
        . '.column-frmm_moderazione{width:190px}'
        . '.column-frmm_tentativo{width:80px}'
        . '</style>';
});

/* --- Approva / Rifiuta ------------------------------------------------------- */

function frmm_lavagna_url_azione($azione, $id)
{
    return wp_nonce_url(
        admin_url('admin-post.php?action=frmm_' . $azione . '&post=' . (int) $id),
        'frmm_' . $azione . '_' . (int) $id
    );
}

add_action('admin_post_frmm_approva', function () {
    frmm_lavagna_esegui('approva');
});
add_action('admin_post_frmm_rifiuta', function () {
    frmm_lavagna_esegui('rifiuta');
});

function frmm_lavagna_esegui($azione)
{
    $id = isset($_GET['post']) ? (int) $_GET['post'] : 0;
    check_admin_referer('frmm_' . $azione . '_' . $id);
    if (get_post_type($id) !== FRMM_LAVAGNA_CPT) {
        wp_die(esc_html__('Non e\' un disegno.', 'frmm-lavagna'), 400);
    }
    $n = frmm_lavagna_modera($azione, [$id]);
    wp_safe_redirect(add_query_arg(
        ['frmm_esito' => $azione, 'frmm_n' => $n],
        wp_get_referer() ?: admin_url('edit.php?post_type=' . FRMM_LAVAGNA_CPT)
    ));
    exit;
}

/**
 * Approva o rifiuta, controllando i permessi disegno per disegno: con
 * PublishPress Capabilities sul sito, un ruolo puo' vedere l'elenco senza
 * poter pubblicare. Restituisce quanti ne ha fatti davvero.
 */
function frmm_lavagna_modera($azione, $ids)
{
    $n = 0;
    foreach ($ids as $id) {
        if ($azione === 'approva' && current_user_can('publish_post', $id) && get_post_status($id) === 'pending') {
            wp_publish_post($id);
            $n++;
        } elseif ($azione === 'rifiuta' && current_user_can('delete_post', $id) && wp_trash_post($id)) {
            $n++;
        }
    }
    return $n;
}

// In blocco: solo Approva. Rifiutare in blocco c'e' gia', e' "Sposta nel
// cestino" di WordPress.
add_filter('bulk_actions-edit-' . FRMM_LAVAGNA_CPT, function ($azioni) {
    return ['frmm_approva' => __('Approva', 'frmm-lavagna')] + $azioni;
});
add_filter('handle_bulk_actions-edit-' . FRMM_LAVAGNA_CPT, function ($redirect, $azione, $ids) {
    if ($azione !== 'frmm_approva') {
        return $redirect;
    }
    $n = frmm_lavagna_modera('approva', array_map('intval', $ids));
    return add_query_arg(['frmm_esito' => 'approva', 'frmm_n' => $n], $redirect);
}, 10, 3);

add_action('admin_notices', function () {
    if (!isset($_GET['frmm_esito'], $_GET['frmm_n'])) {
        return;
    }
    $n = (int) $_GET['frmm_n'];
    $msg = $_GET['frmm_esito'] === 'approva'
        ? sprintf(_n('%d disegno approvato.', '%d disegni approvati.', $n, 'frmm-lavagna'), $n)
        : sprintf(_n('%d disegno rifiutato.', '%d disegni rifiutati.', $n, 'frmm-lavagna'), $n);
    printf('<div class="notice notice-%s is-dismissible"><p>%s</p></div>', $n ? 'success' : 'warning', esc_html($msg));
});

/* --- il numero nel menu ------------------------------------------------------- */

add_action('admin_menu', function () {
    global $menu;
    $n = (int) wp_count_posts(FRMM_LAVAGNA_CPT)->pending;
    if (!$n) {
        return;
    }
    foreach ($menu as $i => $voce) {
        if (isset($voce[2]) && $voce[2] === 'edit.php?post_type=' . FRMM_LAVAGNA_CPT) {
            // La stessa classe del numero dei commenti: WordPress la colora da solo.
            $menu[$i][0] .= sprintf(' <span class="awaiting-mod count-%1$d"><span class="pending-count">%1$d</span></span>', $n);
            break;
        }
    }
}, 99);

/* --- fuori dalla Libreria media ----------------------------------------------- */

/**
 * Gli id dei disegni non approvati: in attesa, nel cestino, o in qualunque
 * altro stato che non sia pubblicato. Una volta per richiesta.
 *
 * La lista e' corta per costruzione: la coda di moderazione piu' il cestino
 * degli ultimi 30 giorni (passo 5). Se un giorno fosse lunga, la strada e' un
 * meta sull'allegato, non questa.
 */
function frmm_lavagna_non_approvati()
{
    static $ids = null;
    if ($ids === null) {
        $ids = get_posts([
            'post_type'        => FRMM_LAVAGNA_CPT,
            'post_status'      => ['pending', 'draft', 'future', 'private', 'trash'],
            'fields'           => 'ids',
            'numberposts'      => -1,
            'suppress_filters' => true,
        ]);
    }
    return $ids;
}

// La griglia della Libreria, e ogni finestra "scegli un'immagine" che la
// usa: Elementor, il blocco immagine, FileBird.
add_filter('ajax_query_attachments_args', function ($q) {
    $ids = frmm_lavagna_non_approvati();
    if ($ids) {
        $q['post_parent__not_in'] = array_merge(
            isset($q['post_parent__not_in']) ? (array) $q['post_parent__not_in'] : [],
            $ids
        );
    }
    return $q;
});

// La Libreria in modalita' elenco.
add_action('pre_get_posts', function ($q) {
    global $pagenow;
    if (!is_admin() || !$q->is_main_query() || $pagenow !== 'upload.php') {
        return;
    }
    $ids = frmm_lavagna_non_approvati();
    if ($ids) {
        $q->set('post_parent__not_in', array_merge((array) $q->get('post_parent__not_in'), $ids));
    }
});
