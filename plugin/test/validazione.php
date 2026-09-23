<?php
/**
 * Test della validazione dell'invio, senza WordPress.
 *
 *   php -d extension=gd plugin/test/validazione.php
 *
 * Sta fuori da plugin/frmm-lavagna/ perche' lo zip prende tutta quella
 * cartella: i test non devono finire sul server.
 *
 * GD serve solo a fabbricare i JPEG di prova. Se manca, quei test si saltano
 * e lo si dice.
 */

define('FRMM_LAVAGNA_TEST', true);
require __DIR__ . '/../frmm-lavagna/includes/validazione.php';

$ok = 0;
$ko = 0;
function prova($nome, $atteso, $ottenuto)
{
    global $ok, $ko;
    if ($atteso === $ottenuto) {
        $ok++;
        return;
    }
    $ko++;
    echo "  KO  $nome\n      atteso:   " . var_export($atteso, true)
        . "\n      ottenuto: " . var_export($ottenuto, true) . "\n";
}

/** Un disegno valido, come lo produce l'app: un tratto di gesso e una gommata. */
function disegno($ritocchi = [])
{
    $d = [
        'version' => 1,
        'board'   => ['w' => 1600, 'h' => 1200],
        'strokes' => [
            ['id' => 1, 'tool' => 'chalk', 'color' => '#FAF8F3', 'width' => 27, 'seed' => 3000000000,
             'pts' => [100.5, 200.25, 0.9, 300, 400, 0.84]],
            ['id' => 2, 'tool' => 'eraser', 'color' => null, 'width' => 90, 'seed' => 7,
             'pts' => [120, 210, 1]],
        ],
    ];
    return array_replace_recursive($d, $ritocchi);
}

// --- client_id ---------------------------------------------------------------

prova('uuid v4 valido', '0f8fad5b-d9cb-469f-a165-70867728950e',
    frmm_lavagna_valida_client_id('0f8fad5b-d9cb-469f-a165-70867728950e'));
prova('uuid maiuscolo normalizzato', '0f8fad5b-d9cb-469f-a165-70867728950e',
    frmm_lavagna_valida_client_id(' 0F8FAD5B-D9CB-469F-A165-70867728950E '));
prova('uuid v1 rifiutato', null, frmm_lavagna_valida_client_id('0f8fad5b-d9cb-169f-a165-70867728950e'));
prova('stringa qualunque', null, frmm_lavagna_valida_client_id('ciao'));
prova('non stringa', null, frmm_lavagna_valida_client_id(['x']));
prova('mancante', null, frmm_lavagna_valida_client_id(null));

// --- disegno ----------------------------------------------------------------

$r = frmm_lavagna_valida_disegno(json_encode(disegno()));
prova('disegno valido', true, is_array($r));
prova('seed oltre 2^31 conservato', 3000000000, $r['strokes'][0]['seed']);
prova('float conservati', 200.25, $r['strokes'][0]['pts'][1]);

$extra = disegno();
$extra['intruso'] = '<script>';
$extra['strokes'][0]['altro'] = 'x';
$r = frmm_lavagna_valida_disegno(json_encode($extra));
prova('campi estranei tolti (radice)', false, isset($r['intruso']));
prova('campi estranei tolti (tratto)', false, isset($r['strokes'][0]['altro']));

prova('JSON rotto', 'disegno', frmm_lavagna_valida_disegno('{"version":1,'));
prova('stringa vuota', 'disegno', frmm_lavagna_valida_disegno(''));
prova('non stringa', 'disegno', frmm_lavagna_valida_disegno(null));
prova('JSON scalare', 'disegno', frmm_lavagna_valida_disegno('42'));
prova('versione 2', 'disegno', frmm_lavagna_valida_disegno(json_encode(disegno(['version' => 2]))));
prova('lavagna larga 1000', 'disegno', frmm_lavagna_valida_disegno(json_encode(disegno(['board' => ['w' => 1000]]))));
prova('lavagna alta 100', 'disegno', frmm_lavagna_valida_disegno(json_encode(disegno(['board' => ['h' => 100]]))));
prova('lavagna alta 9000', 'disegno', frmm_lavagna_valida_disegno(json_encode(disegno(['board' => ['h' => 9000]]))));
prova('altezza float', 'disegno', frmm_lavagna_valida_disegno(json_encode(disegno(['board' => ['h' => 1200.5]]))));
prova('lavagna alta 2600 (telefono)', true, is_array(frmm_lavagna_valida_disegno(json_encode(disegno(['board' => ['h' => 2600]])))));

$d = disegno(); $d['strokes'][0]['tool'] = 'pennarello';
prova('strumento sconosciuto', 'disegno', frmm_lavagna_valida_disegno(json_encode($d)));
$d = disegno(); $d['strokes'][0]['color'] = 'red';
prova('colore non esadecimale', 'disegno', frmm_lavagna_valida_disegno(json_encode($d)));
$d = disegno(); $d['strokes'][0]['color'] = null;
prova('gesso senza colore', 'disegno', frmm_lavagna_valida_disegno(json_encode($d)));
$d = disegno(); $d['strokes'][0]['width'] = 0;
prova('spessore zero', 'disegno', frmm_lavagna_valida_disegno(json_encode($d)));
$d = disegno(); $d['strokes'][0]['seed'] = -1;
prova('seed negativo', 'disegno', frmm_lavagna_valida_disegno(json_encode($d)));
$d = disegno(); $d['strokes'][0]['pts'] = [1, 2];
prova('punti non multipli di 3', 'disegno', frmm_lavagna_valida_disegno(json_encode($d)));
$d = disegno(); $d['strokes'][0]['pts'] = [1, 2, '3'];
prova('punto stringa', 'disegno', frmm_lavagna_valida_disegno(json_encode($d)));
$d = disegno(); $d['strokes'][0]['pts'] = ['a' => 1, 'b' => 2, 'c' => 3];
prova('punti come oggetto', 'disegno', frmm_lavagna_valida_disegno(json_encode($d)));
$d = disegno(); $d['strokes'][0]['pts'] = [1e9, 2, 3];
prova('coordinata assurda', 'disegno', frmm_lavagna_valida_disegno(json_encode($d)));
$d = disegno(); $d['strokes'] = ['a' => $d['strokes'][0]];
prova('strokes come oggetto', 'disegno', frmm_lavagna_valida_disegno(json_encode($d)));

$d = disegno(); $d['strokes'] = [$d['strokes'][1]];
prova('solo gommate = vuoto', 'disegno_vuoto', frmm_lavagna_valida_disegno(json_encode($d)));
$d = disegno(); $d['strokes'] = [];
prova('nessun tratto = vuoto', 'disegno_vuoto', frmm_lavagna_valida_disegno(json_encode($d)));

prova('annidamento profondo', 'disegno', frmm_lavagna_valida_disegno(str_repeat('[', 500) . str_repeat(']', 500)));
prova('oltre 3 MB', 'disegno_grande', frmm_lavagna_valida_disegno(str_repeat(' ', FRMM_LAVAGNA_MAX_JSON + 1)));

$d = disegno(); $t = $d['strokes'][0];
$d['strokes'] = array_fill(0, FRMM_LAVAGNA_MAX_TRATTI + 1, $t);
prova('troppi tratti', 'disegno_grande', frmm_lavagna_valida_disegno(json_encode($d)));

$d = disegno(); $d['strokes'][0]['pts'] = array_fill(0, FRMM_LAVAGNA_MAX_NUMERI + 3, 1);
prova('troppi punti', 'disegno_grande', frmm_lavagna_valida_disegno(json_encode($d)));

// --- immagine ----------------------------------------------------------------

$tmp = sys_get_temp_dir() . '/frmm-test-' . getmypid();
@mkdir($tmp);

$f = "$tmp/testo.jpg";
file_put_contents($f, "<?php echo 'ciao'; ?>");
prova('testo con estensione .jpg', 'immagine_tipo', frmm_lavagna_valida_jpeg($f, filesize($f), 1200));
prova('file inesistente', 'immagine', frmm_lavagna_valida_jpeg("$tmp/nessuno.jpg", 10, 1200));
prova('dimensione zero', 'immagine_grande', frmm_lavagna_valida_jpeg($f, 0, 1200));
prova('oltre 5 MB', 'immagine_grande', frmm_lavagna_valida_jpeg($f, FRMM_LAVAGNA_MAX_JPEG + 1, 1200));

if (!function_exists('imagecreatetruecolor')) {
    echo "  --  GD assente: salto i test sui JPEG veri (php -d extension=gd ...)\n";
} else {
    $img = imagecreatetruecolor(1600, 1200);
    imagejpeg($img, "$tmp/buono.jpg", 92);
    imagepng($img, "$tmp/png.jpg");
    imagedestroy($img);
    $img = imagecreatetruecolor(1600, 1201);
    imagejpeg($img, "$tmp/piu1.jpg", 92);
    imagedestroy($img);
    $img = imagecreatetruecolor(800, 600);
    imagejpeg($img, "$tmp/piccolo.jpg", 92);
    imagedestroy($img);

    prova('JPEG 1600x1200 valido', [1600, 1200], frmm_lavagna_valida_jpeg("$tmp/buono.jpg", filesize("$tmp/buono.jpg"), 1200));
    prova('JPEG alto un pixel in piu\' (arrotondamento)', [1600, 1201], frmm_lavagna_valida_jpeg("$tmp/piu1.jpg", filesize("$tmp/piu1.jpg"), 1200));
    prova('JPEG che non corrisponde al disegno', 'immagine_misure', frmm_lavagna_valida_jpeg("$tmp/buono.jpg", filesize("$tmp/buono.jpg"), 1500));
    prova('JPEG di altre misure', 'immagine_misure', frmm_lavagna_valida_jpeg("$tmp/piccolo.jpg", filesize("$tmp/piccolo.jpg"), 1200));
    prova('PNG con estensione .jpg', 'immagine_tipo', frmm_lavagna_valida_jpeg("$tmp/png.jpg", filesize("$tmp/png.jpg"), 1200));

    // Un JPEG vero con un PHP appeso in coda: passa la validazione, ed e'
    // giusto cosi' — e' la ricodifica in invio.php che lo ripulisce.
    file_put_contents("$tmp/poliglotta.jpg", file_get_contents("$tmp/buono.jpg") . "<?php system(\$_GET['c']); ?>");
    prova('JPEG con coda (lo ripulisce la ricodifica)', [1600, 1200],
        frmm_lavagna_valida_jpeg("$tmp/poliglotta.jpg", filesize("$tmp/poliglotta.jpg"), 1200));

    // E la ricodifica fatta come in invio.php la toglie davvero.
    $img = imagecreatefromjpeg("$tmp/poliglotta.jpg");
    imagejpeg($img, "$tmp/ripulito.jpg", 90);
    imagedestroy($img);
    prova('la ricodifica toglie la coda', false, strpos(file_get_contents("$tmp/ripulito.jpg"), '<?php') !== false);
}

array_map('unlink', glob("$tmp/*"));
@rmdir($tmp);

echo "\n  $ok passati, $ko falliti\n";
exit($ko ? 1 : 0);
