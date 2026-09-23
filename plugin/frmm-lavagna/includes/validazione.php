<?php
/**
 * La validazione di quel che arriva dall'invio. Funzioni pure: niente
 * WordPress qui dentro, di proposito.
 *
 * Il motivo e' uno solo: cosi' si provano con un PHP qualunque, senza un
 * WordPress attorno (plugin/test/validazione.php). E' il codice che sta fra
 * internet e la Media Library della Fondazione, ed e' quello che conviene
 * poter provare in dieci secondi dopo ogni modifica.
 *
 * Ogni funzione restituisce il valore ripulito, oppure una STRINGA che e' il
 * codice d'errore. Chi le chiama (invio.php) trasforma la stringa in un
 * WP_Error con lo status HTTP giusto.
 */

if (!defined('ABSPATH') && !defined('FRMM_LAVAGNA_TEST')) {
    exit;
}

/*
 * I limiti. Tutti larghi rispetto a un disegno vero, stretti rispetto a un
 * abuso: il punto non e' indovinare il disegno piu' grande possibile, ma far
 * si' che il piu' grande possibile resti un file di pochi MB.
 *
 * La lavagna e' larga sempre 1600 unita' (BOARD_W in palette.js) e alta
 * 1600 / rapporto della finestra: su un telefono in verticale supera i 2500.
 * Da qui l'intervallo dell'altezza, che corrisponde a rapporti fra 1:4 e 8:1.
 */
const FRMM_LAVAGNA_BOARD_W = 1600;
const FRMM_LAVAGNA_BOARD_H_MIN = 200;
const FRMM_LAVAGNA_BOARD_H_MAX = 6400;

// I punti sono float non arrotondati, ~18 caratteri l'uno: 3 MB sono circa
// 170.000 numeri, cioe' una cinquantina di migliaia di campioni dopo RDP.
const FRMM_LAVAGNA_MAX_JSON = 3 * 1024 * 1024;
const FRMM_LAVAGNA_MAX_TRATTI = 20000;
const FRMM_LAVAGNA_MAX_NUMERI = 600000;

// Un JPEG 1600 x 2500 a qualita' 0.92 pieno di grana di gesso sta sotto i 2 MB.
const FRMM_LAVAGNA_MAX_JPEG = 5 * 1024 * 1024;

/**
 * Il client_id e' un UUID v4 (D5), generato dall'app al primo accesso.
 * Minuscolo: lo normalizziamo noi, cosi' il rate limit per client_id non si
 * aggira cambiando le maiuscole.
 *
 * Eccezione alla regola del file: restituisce null e non un codice, perche'
 * un codice d'errore e' una stringa e lo sarebbe anche l'UUID.
 */
function frmm_lavagna_valida_client_id($v)
{
    if (!is_string($v)) {
        return null;
    }
    $v = strtolower(trim($v));
    if (!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/', $v)) {
        return null;
    }
    return $v;
}

/**
 * Il Drawing (D1), come stringa JSON. Restituisce la struttura RICOSTRUITA
 * campo per campo, non quella ricevuta: in archivio finisce solo quel che
 * abbiamo guardato, e un campo in piu' — innocuo o no — non ci arriva mai.
 */
function frmm_lavagna_valida_disegno($json)
{
    if (!is_string($json) || $json === '') {
        return 'disegno';
    }
    if (strlen($json) > FRMM_LAVAGNA_MAX_JSON) {
        return 'disegno_grande';
    }

    // Profondita' 8: il Drawing ne ha 4 (radice, strokes, stroke, pts). Un
    // JSON annidato a mille livelli si ferma qui, prima di costare qualcosa.
    $d = json_decode($json, true, 8);
    if (!is_array($d)) {
        return 'disegno';
    }

    if (!isset($d['version']) || $d['version'] !== 1) {
        return 'disegno';
    }
    if (!isset($d['board']['w'], $d['board']['h'])
        || $d['board']['w'] !== FRMM_LAVAGNA_BOARD_W
        || !is_int($d['board']['h'])
        || $d['board']['h'] < FRMM_LAVAGNA_BOARD_H_MIN
        || $d['board']['h'] > FRMM_LAVAGNA_BOARD_H_MAX) {
        return 'disegno';
    }
    if (!isset($d['strokes']) || !is_array($d['strokes']) || !frmm_lavagna_e_lista($d['strokes'])) {
        return 'disegno';
    }
    if (count($d['strokes']) > FRMM_LAVAGNA_MAX_TRATTI) {
        return 'disegno_grande';
    }

    $tratti = [];
    $numeri = 0;
    $gesso = false;

    foreach ($d['strokes'] as $s) {
        if (!is_array($s)) {
            return 'disegno';
        }
        $tool = isset($s['tool']) ? $s['tool'] : null;
        if ($tool !== 'chalk' && $tool !== 'eraser') {
            return 'disegno';
        }

        // Il colore della gomma non conta (render.js la disegna in nero con
        // destination-out), ma se c'e' deve comunque essere un colore.
        $color = isset($s['color']) ? $s['color'] : null;
        if ($color !== null && (!is_string($color) || !preg_match('/^#[0-9A-Fa-f]{6}$/', $color))) {
            return 'disegno';
        }
        if ($tool === 'chalk' && $color === null) {
            return 'disegno';
        }

        $width = isset($s['width']) ? $s['width'] : null;
        if (!(is_int($width) || is_float($width)) || $width <= 0 || $width > 1000) {
            return 'disegno';
        }

        $seed = isset($s['seed']) ? $s['seed'] : null;
        if (!is_int($seed) || $seed < 0 || $seed > 4294967295) {
            return 'disegno';
        }

        $pts = isset($s['pts']) ? $s['pts'] : null;
        if (!is_array($pts) || !frmm_lavagna_e_lista($pts) || count($pts) % 3 !== 0) {
            return 'disegno';
        }
        $numeri += count($pts);
        if ($numeri > FRMM_LAVAGNA_MAX_NUMERI) {
            return 'disegno_grande';
        }
        foreach ($pts as $n) {
            if (!(is_int($n) || is_float($n)) || !is_finite($n) || abs($n) > 100000) {
                return 'disegno';
            }
        }

        if ($tool === 'chalk' && count($pts) > 0) {
            $gesso = true;
        }

        $tratti[] = [
            'id'    => isset($s['id']) && is_int($s['id']) ? $s['id'] : count($tratti) + 1,
            'tool'  => $tool,
            'color' => $color,
            'width' => $width,
            'seed'  => $seed,
            'pts'   => $pts,
        ];
    }

    // Come haDisegno() in export.js: una lavagna con sole gommate e' vuota,
    // e l'app non deve poterla mandare. Se arriva, non viene dall'app.
    if (!$gesso) {
        return 'disegno_vuoto';
    }

    return [
        'version' => 1,
        'board'   => ['w' => FRMM_LAVAGNA_BOARD_W, 'h' => $d['board']['h']],
        'strokes' => $tratti,
    ];
}

/**
 * L'immagine, guardando i BYTE e non quel che dichiara il client: il tipo MIME
 * del multipart e l'estensione del nome li sceglie chi manda, e mentono gratis.
 *
 * Deve essere un JPEG largo esattamente 1600 px e alto quanto la lavagna del
 * disegno che l'accompagna: e' il controllo che scarta, a costo zero, la gran
 * parte delle immagini che non vengono dalla lavagna.
 *
 * Restituisce [larghezza, altezza] oppure il codice d'errore.
 */
function frmm_lavagna_valida_jpeg($percorso, $dimensione, $board_h)
{
    if (!is_string($percorso) || !is_file($percorso)) {
        return 'immagine';
    }
    if ($dimensione <= 0 || $dimensione > FRMM_LAVAGNA_MAX_JPEG) {
        return 'immagine_grande';
    }

    // I primi tre byte di ogni JPEG. Prima di chiedere a getimagesize di
    // interpretare il file, che e' un parser e come tutti i parser si
    // preferisce dargli in pasto solo quel che ha la forma giusta.
    $fh = fopen($percorso, 'rb');
    if (!$fh) {
        return 'immagine';
    }
    $testa = fread($fh, 3);
    fclose($fh);
    if ($testa !== "\xFF\xD8\xFF") {
        return 'immagine_tipo';
    }

    $info = @getimagesize($percorso);
    if (!$info || $info[2] !== IMAGETYPE_JPEG) {
        return 'immagine_tipo';
    }

    // Un pixel di tolleranza: l'app arrotonda (dimensioni() in export.js) e
    // non vogliamo scartare un disegno vero per un Math.round.
    if ($info[0] !== FRMM_LAVAGNA_BOARD_W || abs($info[1] - $board_h) > 1) {
        return 'immagine_misure';
    }

    return [$info[0], $info[1]];
}

/** Un array PHP con chiavi 0..n-1, cioe' un array JSON e non un oggetto. */
function frmm_lavagna_e_lista($a)
{
    return $a === [] || array_keys($a) === range(0, count($a) - 1);
}
