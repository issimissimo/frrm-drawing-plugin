<?php
/**
 * Il rate limit dell'invio (passo 4 del piano) e la sua diagnostica.
 *
 * Al massimo 3 disegni per dispositivo e 20 per IP in 24 ore (Daniele,
 * 25/09/2026). Oltre, l'endpoint risponde 429 e non scrive niente; l'app lo
 * sa e lascia perdere senza dire nulla al bambino (motivoDaStatus in
 * invio.js).
 *
 * PERCHE' DUE LIMITI. Il client_id lo genera chi manda: un ciclo con curl ne
 * inventa uno nuovo a ogni giro, e il limite per dispositivo da solo non lo
 * ferma. Lo ferma l'IP. Ma 3 per IP farebbe perdere in silenzio i disegni di
 * una classe intera dietro la stessa rete, e l'uso in classe e' plausibile.
 * Quindi: 3 al bambino entusiasta, 20 alla rete.
 *
 * Chi cambia rete e ne manda altri cento NON e' coperto, per scelta: si
 * riapre se ne arrivano a centinaia, e l'allarme e' la casella di posta.
 *
 * ⚠️ SOLO REMOTE_ADDR, MAI LE INTESTAZIONI. Misurato il 25/09/2026 con
 * .lavoro/diagnostica-ip.py: in produzione, dietro la CDN di SiteGround,
 * REMOTE_ADDR e' gia' l'IP vero e un X-Forwarded-For falso non lo cambia.
 * Sullo staging X-Forwarded-For arriva COSI' COME LO SCRIVE IL CLIENT. Chi un
 * giorno lo leggesse "per sicurezza" darebbe a chiunque il modo di
 * ricominciare da zero a ogni invio con una riga di intestazione.
 *
 * DOVE STANNO I CONTATORI. In transient, con dentro il momento del primo
 * invio: la finestra e' di 24 ore da quello, non dal giorno di calendario. Il
 * nome contiene un'impronta HMAC, non l'IP (validazione.php), e scade con la
 * finestra: dell'IP non resta niente dopo 24 ore, e mai nei meta del disegno.
 * Con la cache a oggetti di SiteGround un transient puo' sparire prima: il
 * limite si azzera in anticipo, e va bene cosi'. Due invii nello stesso
 * istante possono passare entrambi l'ultimo posto libero: va bene anche
 * questo.
 *
 * AZZERARE. Nel nome c'e' anche un numero di generazione: azzerare e'
 * incrementarlo, e i contatori vecchi scadono da soli. Cancellarli uno per
 * uno non si potrebbe, perche' con la cache a oggetti i transient non si
 * possono elencare.
 *
 *   GET    /wp-json/frmm-lavagna/v1/limiti   solo amministratore: IP visto, contatore, limiti
 *   DELETE /wp-json/frmm-lavagna/v1/limiti   solo amministratore: azzera tutti i contatori
 *
 * Si leggono con .lavoro/diagnostica-ip.py; gli script di prova azzerano
 * all'inizio, per non consumare i 20 invii del PC di chi li lancia.
 */

if (!defined('ABSPATH')) {
    exit;
}

const FRMM_LAVAGNA_LIMITI = [
    'dispositivo' => 3,
    'ip'          => 20,
];
const FRMM_LAVAGNA_FINESTRA = 86400;

const FRMM_LAVAGNA_OPZIONE_GEN = 'frmm_lavagna_limiti_gen';

/**
 * I nomi dei contatori di questa richiesta. Senza client_id c'e' solo quello
 * dell'IP; senza un IP leggibile (non capita, ma REMOTE_ADDR non e' una
 * promessa) solo quello del dispositivo, invece di un contatore unico per
 * tutti.
 */
function frmm_lavagna_contatori($client_id = null)
{
    $gen = (int) get_option(FRMM_LAVAGNA_OPZIONE_GEN, 0);
    $segreto = wp_salt('auth');
    $nomi = [];
    if ($client_id !== null) {
        $nomi['dispositivo'] = 'frmm_lim_' . $gen . '_d_' . frmm_lavagna_impronta($client_id, $segreto);
    }
    $ip = frmm_lavagna_ip_da_contare(isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : null);
    if ($ip !== null) {
        $nomi['ip'] = 'frmm_lim_' . $gen . '_i_' . frmm_lavagna_impronta($ip, $segreto);
    }
    return $nomi;
}

/** Se questo invio va respinto. Legge soltanto. */
function frmm_lavagna_limite_superato($client_id)
{
    $ora = time();
    foreach (frmm_lavagna_contatori($client_id) as $tipo => $nome) {
        $c = frmm_lavagna_contatore(get_transient($nome), $ora, FRMM_LAVAGNA_FINESTRA);
        if ($c['n'] >= FRMM_LAVAGNA_LIMITI[$tipo]) {
            return true;
        }
    }
    return false;
}

/**
 * Conta un invio. Si chiama SOLO a disegno archiviato: una ripresa dell'app
 * che trova il doppione, o un invio respinto dalla validazione, non consuma
 * niente — altrimenti un bambino con la rete che va e viene si giocherebbe i
 * suoi tre disegni sul primo.
 */
function frmm_lavagna_conta_invio($client_id)
{
    $ora = time();
    foreach (frmm_lavagna_contatori($client_id) as $nome) {
        list($c, $ttl) = frmm_lavagna_contatore_piu_uno(get_transient($nome), $ora, FRMM_LAVAGNA_FINESTRA);
        set_transient($nome, $c, $ttl);
    }
}

/* --- le rotte dell'amministratore -------------------------------------------- */

/**
 * Le intestazioni con cui un proxy puo' dichiarare l'IP di chi c'e' dietro.
 * La diagnostica le mostra; il limite non le legge (vedi in cima).
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
    $solo_admin = function () {
        return current_user_can('manage_options');
    };
    register_rest_route(FRMM_LAVAGNA_REST_NS, '/limiti', [
        [
            'methods'             => 'GET',
            'callback'            => 'frmm_lavagna_diagnostica',
            'permission_callback' => $solo_admin,
        ],
        [
            'methods'             => 'DELETE',
            'callback'            => 'frmm_lavagna_azzera_limiti',
            'permission_callback' => $solo_admin,
        ],
    ]);
});

/**
 * Cosa vede il limite per QUESTA richiesta: l'IP, il suo contatore, e le
 * intestazioni che potrebbero portarne un altro. Nata con la 1.7.1 per
 * decidere su cosa contare; resta perche' e' il modo di riverificarlo se
 * cambia l'hosting o la CDN.
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

    $contatori = frmm_lavagna_contatori();
    $contatore_ip = isset($contatori['ip'])
        ? frmm_lavagna_contatore(get_transient($contatori['ip']), time(), FRMM_LAVAGNA_FINESTRA)
        : null;

    return new WP_REST_Response([
        'versione'     => FRMM_LAVAGNA_VER,
        'remote_addr'  => isset($_SERVER['REMOTE_ADDR']) ? (string) $_SERVER['REMOTE_ADDR'] : null,
        'inoltro'      => $inoltro,
        'intestazioni' => $nomi,
        'limiti'       => FRMM_LAVAGNA_LIMITI + ['finestra' => FRMM_LAVAGNA_FINESTRA],
        'generazione'  => (int) get_option(FRMM_LAVAGNA_OPZIONE_GEN, 0),
        'contatore_ip' => $contatore_ip,
        'php'          => [
            'post_max_size'       => ini_get('post_max_size'),
            'upload_max_filesize' => ini_get('upload_max_filesize'),
            'max_input_time'      => ini_get('max_input_time'),
        ],
    ], 200);
}

function frmm_lavagna_azzera_limiti()
{
    $gen = (int) get_option(FRMM_LAVAGNA_OPZIONE_GEN, 0) + 1;
    update_option(FRMM_LAVAGNA_OPZIONE_GEN, $gen, true);
    return new WP_REST_Response(['ok' => true, 'generazione' => $gen], 200);
}
