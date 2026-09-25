<?php
/**
 * L'invio: POST /wp-json/frmm-lavagna/v1/invio
 *
 * E' la "casella di posta" di D2/D4: riceve un disegno, lo mette in attesa, e
 * non fa nient'altro. Non lo mostra a nessuno, non lo restituisce, non dice
 * dove l'ha messo.
 *
 * Il corpo e' multipart/form-data, non JSON: l'immagine viaggia come file e
 * non in base64, che costerebbe un terzo in piu' di byte su una rete da
 * telefono e un terzo in piu' di memoria qui.
 *
 *   client_id   UUID v4 (D5)
 *   disegno     il Drawing di D1, come stringa JSON
 *   immagine    JPEG 1600 px di larghezza, SENZA il logo (fase-0 §7.2)
 *   invio_id    UUID v4 di QUESTO invio, facoltativo: vedi sotto
 *   tentativo   1, 2, 3...: quante volte l'app ha provato, facoltativo
 *
 * Risposte: 201 se e' in attesa, 200 se lo era gia' (lo stesso invio_id);
 * 400 / 413 / 415 con un codice d'errore leggibile da una macchina.
 *
 * PERCHE' invio_id (1.5.0). L'app manda il disegno nello stesso tocco che
 * apre la condivisione, e se il bambino passa a WhatsApp iOS puo' sospendere
 * la pagina a invio in corso. Al ritorno l'app riprova. Ma il caso piu'
 * probabile non e' l'invio perso: e' l'invio ARRIVATO con la risposta persa.
 * Senza un identificativo, la ripresa lo archivierebbe due volte. Con,
 * il secondo arrivo trova il primo e risponde 200 senza scrivere niente.
 *
 * PERCHE' tentativo. E' la misura promessa quando si e' scelta la ripresa
 * invece dell'attesa: dopo un periodo di prova si conta quanti disegni sono
 * arrivati al primo colpo (meta _frmm_tentativo). Se la ripresa servisse
 * spesso, l'ordine andrebbe rovesciato — prima l'invio, poi la condivisione
 * con un tocco in piu'.
 *
 * ⚠️ ENDPOINT ANONIMO, SENZA NONCE, ed e' deciso (piano del 23/09/2026). Un
 * nonce di WordPress per un visitatore non collegato e' uguale per tutti e
 * dura ore: non ferma nessuno, e in cambio la pagina in cache di SiteGround
 * lo serve scaduto e fa fallire gli invii veri. La difesa sta nei limiti di
 * questo file e, dalla 1.8.0, nel rate limit di limiti.php.
 */

if (!defined('ABSPATH')) {
    exit;
}

const FRMM_LAVAGNA_REST_NS = 'frmm-lavagna/v1';

/**
 * La cartella delle immagini, dentro uploads ma fuori dall'albero anno/mese.
 *
 * Il nome del file e' casuale a 128 bit: un disegno in attesa non ha un URL
 * che si possa indovinare. Non e' un segreto — chi ha l'URL lo apre — ma
 * nessuno lo ha, perche' questo endpoint non lo restituisce e la bacheca lo
 * mostra solo a chi e' collegato. Scelto contro la cartella protetta
 * (piano del 23/09/2026).
 */
const FRMM_LAVAGNA_CARTELLA = 'frmm-lavagna';

add_action('rest_api_init', function () {
    register_rest_route(FRMM_LAVAGNA_REST_NS, '/invio', [
        'methods'             => 'POST',
        'callback'            => 'frmm_lavagna_invio',
        // Anonimo per scelta: chi disegna e' un bambino senza account (D5).
        // Scritto per esteso, non omesso: WordPress da' un avviso se manca, e
        // chi legge deve vedere che e' voluto.
        'permission_callback' => '__return_true',
    ]);
});

/**
 * @param WP_REST_Request $req
 */
function frmm_lavagna_invio($req)
{
    // Un primo sbarramento sulla dimensione dichiarata. Non e' ancora il
    // limite "prima di leggere il corpo" del passo 4: quando WordPress arriva
    // qui PHP ha gia' letto il multipart. Ma evita di lavorare su un corpo
    // che sappiamo gia' essere troppo grande.
    $dichiarata = isset($_SERVER['CONTENT_LENGTH']) ? (int) $_SERVER['CONTENT_LENGTH'] : 0;
    if ($dichiarata > FRMM_LAVAGNA_MAX_JSON + FRMM_LAVAGNA_MAX_JPEG + 64 * 1024) {
        return frmm_lavagna_errore('troppo_grande');
    }

    $client_id = frmm_lavagna_valida_client_id($req->get_param('client_id'));
    if ($client_id === null) {
        return frmm_lavagna_errore('client_id');
    }

    // Facoltativo, ma se c'e' dev'essere giusto: un invio_id storto non si
    // ignora, perche' la deduplica ci si appoggia.
    //
    // PRIMA del limite: la ripresa di un disegno gia' arrivato deve sentirsi
    // dire "c'e' gia'" (200), non "troppi" (429), anche se quel disegno era
    // proprio l'ultimo che il limite concedeva.
    $invio_id = null;
    if ($req->get_param('invio_id') !== null) {
        $invio_id = frmm_lavagna_valida_client_id($req->get_param('invio_id'));
        if ($invio_id === null) {
            return frmm_lavagna_errore('invio_id');
        }
        $gia = frmm_lavagna_cerca_invio($invio_id);
        if ($gia) {
            return new WP_REST_Response(['ok' => true, 'id' => $gia, 'doppio' => true], 200);
        }
    }

    // Il rate limit (limiti.php), PRIMA di decodificare il JSON e di toccare
    // GD: sono le due cose che costano, e chi e' oltre il limite non deve
    // costarle. Prima di leggere il corpo non si puo' — quando parte questo
    // codice PHP il multipart l'ha gia' letto — ma dopo, questo e' il primo
    // punto utile.
    if (frmm_lavagna_limite_superato($client_id)) {
        return frmm_lavagna_errore('troppi');
    }

    $disegno = frmm_lavagna_valida_disegno($req->get_param('disegno'));
    if (!is_array($disegno)) {
        return frmm_lavagna_errore($disegno);
    }
    $tentativo = (int) $req->get_param('tentativo');
    $tentativo = ($tentativo >= 1 && $tentativo <= 99) ? $tentativo : 0;

    $file = $req->get_file_params();
    $file = isset($file['immagine']) ? $file['immagine'] : null;
    if (!$file || !isset($file['error'])) {
        return frmm_lavagna_errore('immagine');
    }
    if ($file['error'] === UPLOAD_ERR_INI_SIZE || $file['error'] === UPLOAD_ERR_FORM_SIZE) {
        return frmm_lavagna_errore('immagine_grande');
    }
    // is_uploaded_file: il percorso deve essere un file caricato in QUESTA
    // richiesta, non un percorso qualunque del server passato come stringa.
    if ($file['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($file['tmp_name'])) {
        return frmm_lavagna_errore('immagine');
    }

    $misure = frmm_lavagna_valida_jpeg($file['tmp_name'], (int) $file['size'], $disegno['board']['h']);
    if (!is_array($misure)) {
        return frmm_lavagna_errore($misure);
    }

    $id = frmm_lavagna_archivia($client_id, $disegno, $file['tmp_name'], $invio_id, $tentativo);
    if (is_wp_error($id)) {
        return $id;
    }
    frmm_lavagna_conta_invio($client_id);

    // Niente URL dell'immagine, niente id dell'allegato: all'app basta
    // sapere che e' arrivato. L'id del disegno serve solo a riconoscerlo nei
    // log e non apre niente — il CPT non e' pubblico e non e' in REST.
    return new WP_REST_Response(['ok' => true, 'id' => $id], 201);
}

/**
 * Scrive il disegno: l'immagine nella sua cartella, il post in attesa,
 * l'allegato collegato. O tutto o niente — se un pezzo fallisce, i pezzi gia'
 * scritti si tolgono, e in bacheca non restano disegni senza immagine.
 */
function frmm_lavagna_archivia($client_id, $disegno, $tmp, $invio_id = null, $tentativo = 0)
{
    $up = wp_upload_dir();
    if (!empty($up['error'])) {
        return frmm_lavagna_errore('server');
    }
    $dir = trailingslashit($up['basedir']) . FRMM_LAVAGNA_CARTELLA;
    if (!wp_mkdir_p($dir)) {
        return frmm_lavagna_errore('server');
    }
    // Difesa di riserva: se un giorno il server elencasse le cartelle, questa
    // resterebbe muta. Oggi uploads/ risponde 403 (verificato il 23/09/2026).
    if (!file_exists($dir . '/index.php')) {
        @file_put_contents($dir . '/index.php', "<?php\n// Silence is golden.\n");
    }

    $nome = bin2hex(random_bytes(16)) . '.jpg';
    $percorso = $dir . '/' . $nome;

    if (!frmm_lavagna_ricodifica($tmp, $percorso)) {
        return frmm_lavagna_errore('immagine');
    }

    $titolo = sprintf(
        /* translators: %s: data e ora dell'invio */
        __('Disegno del %s', 'frmm-lavagna'),
        wp_date('d/m/Y H:i')
    );

    $post_id = wp_insert_post([
        'post_type'   => FRMM_LAVAGNA_CPT,
        'post_status' => 'pending',
        'post_title'  => $titolo,
        'post_author' => 0,
    ], true);
    if (is_wp_error($post_id) || !$post_id) {
        @unlink($percorso);
        return frmm_lavagna_errore('server');
    }

    // wp_slash: i meta passano da wp_unslash, e un JSON perde i suoi
    // backslash — un colore no, ma una stringa con le virgolette si'.
    add_post_meta($post_id, '_frmm_client_id', $client_id, true);
    add_post_meta($post_id, '_frmm_disegno', wp_slash(wp_json_encode($disegno)), true);
    if ($invio_id) {
        add_post_meta($post_id, '_frmm_invio_id', $invio_id, true);
    }
    if ($tentativo) {
        add_post_meta($post_id, '_frmm_tentativo', $tentativo, true);
    }

    $att_id = wp_insert_attachment([
        'post_mime_type' => 'image/jpeg',
        'post_title'     => $titolo,
        'post_content'   => '',
        'post_status'    => 'inherit',
    ], $percorso, $post_id, true);
    if (is_wp_error($att_id) || !$att_id) {
        wp_delete_post($post_id, true);
        @unlink($percorso);
        return frmm_lavagna_errore('server');
    }

    // Le miniature: servono alla colonna della bacheca e all'email (passo 3).
    // Prendono il nome dal file, quindi sono casuali anche loro.
    require_once ABSPATH . 'wp-admin/includes/image.php';
    wp_update_attachment_metadata($att_id, wp_generate_attachment_metadata($att_id, $percorso));
    set_post_thumbnail($post_id, $att_id);

    // Solo qui, a disegno scritto per intero: un doppione (invio_id gia'
    // visto) non arriva fin qui, e non manda una seconda email.
    do_action('frmm_lavagna_nuovo_disegno', $post_id, $att_id);

    return $post_id;
}

/**
 * Il disegno gia' arrivato con questo invio_id, in qualunque stato — anche
 * approvato o nel cestino: un doppione di un disegno rifiutato non deve
 * tornare in bacheca dalla porta di servizio.
 */
function frmm_lavagna_cerca_invio($invio_id)
{
    $q = get_posts([
        'post_type'        => FRMM_LAVAGNA_CPT,
        'post_status'      => 'any',
        'meta_key'         => '_frmm_invio_id',
        'meta_value'       => $invio_id,
        'fields'           => 'ids',
        'numberposts'      => 1,
        'suppress_filters' => true,
    ]);
    if ($q) {
        return (int) $q[0];
    }
    // 'any' esclude il cestino: va chiesto a parte.
    $q = get_posts([
        'post_type'        => FRMM_LAVAGNA_CPT,
        'post_status'      => 'trash',
        'meta_key'         => '_frmm_invio_id',
        'meta_value'       => $invio_id,
        'fields'           => 'ids',
        'numberposts'      => 1,
        'suppress_filters' => true,
    ]);
    return $q ? (int) $q[0] : 0;
}

/**
 * Ridisegna il JPEG da capo invece di copiarlo.
 *
 * Il file ricevuto ha passato i controlli sui byte e sulle misure, ma un JPEG
 * puo' portarsi dietro altro: metadati, o qualunque cosa appesa dopo la fine
 * dell'immagine, che getimagesize non guarda. Decodificato in pixel e
 * ricodificato, di quel che c'era resta solo l'immagine.
 *
 * Le misure sono gia' state limitate (1600 x al massimo 6400): la
 * decodifica costa al peggio una quarantina di MB, non e' un invito a
 * mandare una bomba di decompressione.
 */
function frmm_lavagna_ricodifica($da, $a)
{
    if (function_exists('imagecreatefromjpeg')) {
        $img = @imagecreatefromjpeg($da);
        if (!$img) {
            return false;
        }
        // 90: il JPEG arriva a 0.92 e passa da una seconda compressione. Sotto
        // 90 la grana del gesso comincia a impastarsi.
        $ok = imagejpeg($img, $a, 90);
        imagedestroy($img);
        return $ok && is_file($a);
    }

    // Senza GD, l'editor di WordPress (Imagick). Toglie i metadati solo se
    // glielo si chiede, e glielo chiediamo.
    $ed = wp_get_image_editor($da);
    if (is_wp_error($ed)) {
        return false;
    }
    if (method_exists($ed, 'set_quality')) {
        $ed->set_quality(90);
    }
    $r = $ed->save($a, 'image/jpeg');
    return !is_wp_error($r) && is_file($a);
}

/**
 * I codici d'errore e il loro status HTTP. Il codice e' quello che l'app
 * guardera' (passo 2) per scegliere la frase da mostrare; il messaggio e'
 * per chi legge i log, non per un bambino.
 */
function frmm_lavagna_errore($codice)
{
    $tabella = [
        'client_id'       => [400, 'client_id mancante o non valido'],
        'invio_id'        => [400, 'invio_id non valido'],
        'disegno'         => [400, 'disegno mancante o malformato'],
        'disegno_vuoto'   => [400, 'il disegno non contiene tratti di gesso'],
        'disegno_grande'  => [413, 'disegno troppo grande'],
        'immagine'        => [400, 'immagine mancante o illeggibile'],
        'immagine_tipo'   => [415, "l'immagine non e' un JPEG"],
        'immagine_misure' => [400, "le misure dell'immagine non corrispondono al disegno"],
        'immagine_grande' => [413, 'immagine troppo grande'],
        'troppo_grande'   => [413, 'richiesta troppo grande'],
        'troppi'          => [429, 'troppi invii da questo dispositivo o da questa rete'],
        'server'          => [500, 'errore del server'],
    ];
    $v = isset($tabella[$codice]) ? $tabella[$codice] : $tabella['server'];
    return new WP_Error('frmm_' . $codice, $v[1], ['status' => $v[0]]);
}
