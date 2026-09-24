<?php
/**
 * I disegni approvati come sorgente del Custom Marquee (1.7.0).
 *
 * Il marquee e' un plugin a se' e non sa niente di disegni: offre due filtri,
 * custom_marquee/sorgenti per comparire nella sua tendina e
 * custom_marquee/immagini per dargli gli id degli allegati. Qui ci si aggancia
 * a entrambi. Se il marquee non c'e', i filtri non li chiama nessuno; se la
 * Lavagna viene disattivata, la sorgente sparisce e il widget non stampa
 * niente.
 *
 * ⚠️ SCOSTAMENTO DA D3, dichiarato. Il brief vuole la galleria alimentata
 * dalla Libreria media, senza leggere la casella di posta. Qui si leggono i
 * frmm_disegno, ma SOLO quelli in stato publish, e publish vuol dire
 * approvato: la garanzia di D3 (niente di non approvato online, nemmeno per
 * un istante) resta. E migliora: un disegno tolto dalla pubblicazione sparisce
 * dalla striscia da solo, mentre una galleria composta a mano se lo terrebbe.
 *
 * Quali disegni: gli ultimi N per data di APPROVAZIONE, mostrati dal piu'
 * vecchio al piu' nuovo (Daniele, 23/09/2026). Per data di approvazione e non
 * d'invio: un disegno inviato un mese fa e approvato oggi deve comparire, e con
 * la data d'invio potrebbe restare fuori dai 20 piu' recenti. WordPress non la
 * registra — wp_publish_post() lascia la data dell'invio — quindi la scrive
 * transition_post_status qui sotto. I disegni approvati prima della 1.7.0 non
 * ce l'hanno e ricadono sulla data d'invio.
 */

if (!defined('ABSPATH') && !defined('FRMM_LAVAGNA_TEST')) {
    exit;
}

const FRMM_LAVAGNA_SORGENTE = 'frmm_disegni';

/**
 * Quali disegni vanno nella striscia. Senza WordPress, per i test.
 *
 * @param array $righe ogni disegno pubblicato: ['id' => post, 'att' => allegato,
 *                     'approvato' => timestamp dell'approvazione]
 * @param int   $max   quanti al massimo
 * @return int[] gli id degli allegati: gli ultimi $max approvati, dal piu'
 *               vecchio al piu' nuovo. A pari data decide l'id, cosi'
 *               l'ordine non cambia da un caricamento all'altro.
 */
function frmm_lavagna_scegli_per_galleria(array $righe, $max)
{
    $righe = array_values(array_filter($righe, function ($r) {
        return (int) $r['att'] > 0;
    }));
    usort($righe, function ($a, $b) {
        return [(int) $a['approvato'], (int) $a['id']] <=> [(int) $b['approvato'], (int) $b['id']];
    });
    $righe = array_slice($righe, -max(1, (int) $max));
    return array_map(function ($r) {
        return (int) $r['att'];
    }, $righe);
}

if (!function_exists('add_filter')) {
    return;
}

add_filter('custom_marquee/sorgenti', function ($sorgenti) {
    $sorgenti[FRMM_LAVAGNA_SORGENTE] = __('Disegni della Lavagna (approvati)', 'frmm-lavagna');
    return $sorgenti;
});

add_filter('custom_marquee/immagini', function ($ids, $sorgente, $max) {
    if ($sorgente !== FRMM_LAVAGNA_SORGENTE) {
        return $ids;
    }
    return frmm_lavagna_disegni_approvati($max);
}, 10, 3);

/**
 * Gli allegati dei disegni approvati, pronti per la striscia.
 *
 * Si leggono TUTTI i pubblicati e si sceglie in PHP: la data di approvazione
 * puo' mancare (disegni approvati prima della 1.7.0) e un ORDER BY su un meta
 * che a volte c'e' e a volte no, con ripiego sulla data del post, in SQL e'
 * fragile. I pubblicati sono pochi — li sceglie un adulto a mano — e la query
 * e' una sola, meta compresi.
 */
function frmm_lavagna_disegni_approvati($max)
{
    $posts = get_posts([
        'post_type'              => FRMM_LAVAGNA_CPT,
        'post_status'            => 'publish',
        'posts_per_page'         => -1,
        'no_found_rows'          => true,
        'update_post_term_cache' => false,
    ]);
    $righe = [];
    foreach ($posts as $p) {
        $righe[] = [
            'id'        => $p->ID,
            'att'       => (int) get_post_thumbnail_id($p),
            'approvato' => (int) get_post_meta($p->ID, '_frmm_approvato_il', true) ?: (int) get_post_time('U', true, $p),
        ];
    }
    return frmm_lavagna_scegli_per_galleria($righe, $max);
}

/**
 * Entrata e uscita dallo stato publish: la data di approvazione e la cache.
 *
 * Vale per qualunque strada porti un disegno dentro o fuori da publish: il
 * tasto Approva della bacheca, l'azione in blocco, il pulsante Pubblica
 * della schermata del disegno, il cestino.
 *
 * La cache: in produzione Speed Optimizer serve le pagine dalla sua cache
 * dinamica, e la striscia e' dentro la pagina. Senza svuotarla, un disegno
 * approvato comparirebbe solo alla scadenza della cache — e uno tolto
 * resterebbe online altrettanto. Si svuota tutta (sg_cachepress_purge_cache()
 * senza URL = la home e ogni percorso sotto): la striscia puo' stare in
 * qualunque pagina, e le approvazioni sono poche. Non sg_cachepress_purge_everything(),
 * che svuota anche memcached e cancella gli asset combinati: piu' del
 * necessario, a ogni approvazione.
 *
 * ⚠️ Sullo staging Speed Optimizer e' spento: questo ramo si verifica solo in
 * produzione (deciso da Daniele il 24/09/2026).
 */
add_action('transition_post_status', function ($nuovo, $vecchio, $post) {
    if ($post->post_type !== FRMM_LAVAGNA_CPT || ($nuovo === 'publish') === ($vecchio === 'publish')) {
        return;
    }
    if ($nuovo === 'publish') {
        update_post_meta($post->ID, '_frmm_approvato_il', time());
    }
    if (function_exists('sg_cachepress_purge_cache')) {
        sg_cachepress_purge_cache();
    }
}, 10, 3);
