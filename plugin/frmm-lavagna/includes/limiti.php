<?php
/**
 * Il rate limit dell'invio (passo 4 del piano) e la sua diagnostica.
 *
 * DALLA 1.7.1 C'E' SOLO LA DIAGNOSTICA, ed e' voluto. Il limite conta per IP,
 * e l'IP e' la cosa che non si puo' dare per scontata: la produzione sta
 * dietro la CDN di SiteGround (X-SG-CDN: 1, quattro IP anycast), lo staging
 * no — misurato il 25/09/2026. Se PHP in produzione vedesse l'indirizzo della
 * CDN invece di quello di chi disegna, "20 per IP" diventerebbe "20 al giorno
 * per tutti", e lo staging non se ne accorgerebbe mai. Quindi prima si guarda
 * cosa vede PHP, lassu', e solo dopo si scrive il limite.
 *
 *   GET /wp-json/frmm-lavagna/v1/limiti      solo amministratore
 *
 * Risponde con l'IP che vede PHP per QUESTA richiesta, le intestazioni che
 * potrebbero portarne un altro, e i limiti di upload del server (che sono
 * l'unica difesa "prima di leggere il corpo": quando parte il codice del
 * plugin, PHP il multipart l'ha gia' letto).
 *
 * Si legge con: python .lavoro/diagnostica-ip.py [--produzione]
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Le intestazioni con cui un proxy puo' dichiarare l'IP di chi c'e' dietro.
 * Se ne arriva una che non e' qui, la si vede comunque fra i nomi.
 */
const FRMM_LAVAGNA_INTESTAZIONI_INOLTRO = [
    'HTTP_X_FORWARDED_FOR',
    'HTTP_X_REAL_IP',
    'HTTP_FORWARDED',
    'HTTP_CLIENT_IP',
    'HTTP_X_CLIENT_IP',
    'HTTP_TRUE_CLIENT_IP',
    'HTTP_CF_CONNECTING_IP',
];

add_action('rest_api_init', function () {
    register_rest_route(FRMM_LAVAGNA_REST_NS, '/limiti', [
        'methods'             => 'GET',
        'callback'            => 'frmm_lavagna_diagnostica',
        'permission_callback' => function () {
            return current_user_can('manage_options');
        },
    ]);
});

function frmm_lavagna_diagnostica()
{
    $inoltro = [];
    foreach (FRMM_LAVAGNA_INTESTAZIONI_INOLTRO as $k) {
        if (isset($_SERVER[$k])) {
            $inoltro[$k] = (string) $_SERVER[$k];
        }
    }

    // Delle altre intestazioni solo i NOMI: servono a scoprire se SiteGround
    // ne aggiunge una sua per l'IP. I valori no, perche' fra quelle ci sono
    // il cookie di sessione e il nonce di chi sta chiedendo.
    $nomi = [];
    foreach (array_keys($_SERVER) as $k) {
        if (strpos($k, 'HTTP_') === 0) {
            $nomi[] = $k;
        }
    }
    sort($nomi);

    return new WP_REST_Response([
        'versione'     => FRMM_LAVAGNA_VER,
        'remote_addr'  => isset($_SERVER['REMOTE_ADDR']) ? (string) $_SERVER['REMOTE_ADDR'] : null,
        'inoltro'      => $inoltro,
        'intestazioni' => $nomi,
        'php'          => [
            'post_max_size'       => ini_get('post_max_size'),
            'upload_max_filesize' => ini_get('upload_max_filesize'),
            'max_input_time'      => ini_get('max_input_time'),
        ],
    ], 200);
}
