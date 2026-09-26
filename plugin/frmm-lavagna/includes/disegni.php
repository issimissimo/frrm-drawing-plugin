<?php
/**
 * Il tipo di contenuto "disegno": la casella di posta di D4.
 *
 * Ogni invio e' un post di questo tipo, in stato pending, con l'immagine come
 * allegato e immagine in evidenza, e il Drawing di D1 in un meta. Approvare
 * vuol dire pubblicarlo; la bacheca lo sa fare da sola.
 *
 * Il nome e' frmm_disegno e non "disegno" come nel brief: i tipi di contenuto
 * di WordPress stanno tutti nello stesso spazio di nomi, e sul sito della
 * Fondazione ci sono gia' GiveWP, Elementor e Complianz. Un prefisso costa
 * cinque lettere; una collisione costerebbe un pomeriggio.
 */

if (!defined('ABSPATH')) {
    exit;
}

// Massimo 20 caratteri: e' un limite di WordPress, non una scelta.
const FRMM_LAVAGNA_CPT = 'frmm_disegno';

add_action('init', function () {
    register_post_type(FRMM_LAVAGNA_CPT, [
        'labels' => [
            'name'               => __('Disegni', 'frmm-lavagna'),
            'singular_name'      => __('Disegno', 'frmm-lavagna'),
            'menu_name'          => __('Disegni', 'frmm-lavagna'),
            'all_items'          => __('Tutti i disegni', 'frmm-lavagna'),
            'edit_item'          => __('Disegno', 'frmm-lavagna'),
            'search_items'       => __('Cerca disegni', 'frmm-lavagna'),
            'not_found'          => __('Nessun disegno', 'frmm-lavagna'),
            'not_found_in_trash' => __('Nessun disegno nel cestino', 'frmm-lavagna'),
        ],

        // ⚠️ Nessuna di queste va girata a true senza aver riletto D3: la
        // galleria pubblica NON legge da qui. Un disegno in attesa non deve
        // avere un URL, una pagina, un posto nella ricerca o nelle API — ne'
        // per un istante, ne' per sbaglio.
        'public'              => false,
        'publicly_queryable'  => false,
        'exclude_from_search' => true,
        'show_in_nav_menus'   => false,
        'show_in_rest'        => false,
        'has_archive'         => false,
        'rewrite'             => false,
        'query_var'           => false,

        // La bacheca invece si': e' li' che si modera.
        'show_ui'       => true,
        'show_in_menu'  => true,
        'menu_position' => 25,
        'menu_icon'     => 'dashicons-art',

        'supports' => ['title', 'thumbnail'],

        // I disegni li crea solo l'endpoint. Un "Aggiungi nuovo" in bacheca
        // produrrebbe un disegno senza disegno.
        'capability_type' => 'post',
        'map_meta_cap'    => true,
        'capabilities'    => ['create_posts' => 'do_not_allow'],
    ]);
});

/**
 * Eliminare un disegno elimina la sua immagine (passo 5, dalla 1.9.0).
 *
 * WordPress, eliminando un post, NON cancella i suoi allegati: li stacca.
 * Qui era un buco, riprodotto sullo staging il 26/09/2026: l'immagine di un
 * disegno RIFIUTATO, a cestino svuotato, restava senza disegno. Usciva cosi'
 * dal filtro di bacheca.php, che la nasconde in base al disegno a cui e'
 * attaccata, e ricompariva nella Libreria e nei selettori di Elementor; e
 * /wp-json/wp/v2/media/<id> la mostrava a chiunque, originale e miniature,
 * perche' un allegato senza genitore la REST API lo tratta come pubblico.
 *
 * Vale per ogni strada: "Elimina definitivamente", "Svuota cestino" e lo
 * svuotamento automatico dopo EMPTY_TRASH_DAYS, che passano tutti da
 * wp_delete_post(). Per questo sta qui e non in bacheca.php: il cestino
 * automatico gira nel cron, dove bacheca.php non e' caricato.
 *
 * Si cancellano SOLO gli allegati in uploads/frmm-lavagna/, cioe' quelli
 * scritti dall'endpoint. Il disegno supporta l'immagine in evidenza, e chi
 * ci mettesse a mano una foto della Libreria non deve vedersela sparire
 * insieme al disegno.
 */
add_action('before_delete_post', function ($post_id) {
    if (get_post_type($post_id) !== FRMM_LAVAGNA_CPT) {
        return;
    }
    $allegati = get_children([
        'post_parent' => $post_id,
        'post_type'   => 'attachment',
        'fields'      => 'ids',
    ]);
    $allegati[] = (int) get_post_thumbnail_id($post_id);

    foreach (array_unique(array_filter(array_map('intval', $allegati))) as $att) {
        $file = (string) get_post_meta($att, '_wp_attached_file', true);
        if (strpos($file, FRMM_LAVAGNA_CARTELLA . '/') !== 0) {
            continue;
        }
        // true = davvero, non nel cestino dei media: cancella anche il file
        // e le miniature.
        if (!wp_delete_attachment($att, true)) {
            error_log('[frmm-lavagna] immagine ' . $att . ' del disegno ' . (int) $post_id . ' non cancellata');
        }
    }
});
