<?php
/**
 * La diagnostica del plugin, solo per l'amministratore.
 *
 *   GET /wp-json/frmm-lavagna/v1/diagnostica
 *
 * Fino alla 1.11.5 questo file era limiti.php e conteneva il rate limit
 * dell'invio: 3 disegni per dispositivo e 20 per IP in 24 ore. TOLTO NELLA
 * 1.12.0 (28/09/2026), su richiesta esplicita del cliente e contro il
 * consiglio di tenere almeno il tetto per IP. Da allora l'endpoint anonimo
 * non ha piu' un tetto: ogni disegno arrivato e' un post, un JPEG sul disco e
 * una mail. L'allarme e' la casella di posta. Chi volesse rimetterlo trova
 * tutto nel tag git `rate-limit-1.11.5` — contatori, funzioni pure, test,
 * prova-abuso.py — e le misure sull'IP qui sotto.
 *
 * ⚠️ SE SI RIMETTE UN LIMITE PER IP: SOLO REMOTE_ADDR, MAI LE INTESTAZIONI.
 * Misurato il 25/09/2026 con .lavoro/diagnostica-ip.py: in produzione, dietro
 * la CDN di SiteGround, REMOTE_ADDR e' gia' l'IP vero e un X-Forwarded-For
 * falso non lo cambia. Sullo staging X-Forwarded-For arriva COSI' COME LO
 * SCRIVE IL CLIENT. Chi lo leggesse "per sicurezza" darebbe a chiunque il
 * modo di ricominciare da zero a ogni invio con una riga di intestazione.
 *
 * Nel database della produzione resta l'opzione frmm_lavagna_limiti_gen, un
 * numero: innocua, non la legge piu' nessuno. I contatori (transient) sono
 * scaduti da soli entro 24 ore dall'aggiornamento.
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Le intestazioni con cui un proxy puo' dichiarare l'IP di chi c'e' dietro.
 * La diagnostica le mostra, per verificare la regola qui sopra.
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
    register_rest_route(FRMM_LAVAGNA_REST_NS, '/diagnostica', [
        'methods'             => 'GET',
        'callback'            => 'frmm_lavagna_diagnostica',
        'permission_callback' => function () {
            return current_user_can('manage_options');
        },
    ]);
});

/**
 * Cosa vede PHP per QUESTA richiesta: la versione, l'IP e le intestazioni che
 * potrebbero portarne un altro, il cestino e i limiti di PHP sul corpo.
 */
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
        // Il passo 5 (disegni.php): quanti giorni resta nel cestino un
        // disegno rifiutato, e quando il cron lo svuota la prossima volta.
        // 0 giorni vorrebbe dire niente cestino: si cancella subito.
        'cestino'      => [
            'giorni'   => defined('EMPTY_TRASH_DAYS') ? (int) EMPTY_TRASH_DAYS : null,
            'prossimo' => wp_next_scheduled('wp_scheduled_delete') ?: null,
        ],
        'php'          => [
            'post_max_size'       => ini_get('post_max_size'),
            'upload_max_filesize' => ini_get('upload_max_filesize'),
            'max_input_time'      => ini_get('max_input_time'),
        ],
    ], 200);
}
