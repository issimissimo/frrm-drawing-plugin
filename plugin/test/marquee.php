<?php
/**
 * Test dei conti del giro del Custom Marquee, senza WordPress.
 *
 *   php plugin/test/marquee.php
 */

define('CUSTOM_MARQUEE_TEST', true);
require __DIR__ . '/../custom-marquee/includes/giro.php';

$ok = 0;
$ko = 0;
function prova($nome, $atteso, $ottenuto)
{
    global $ok, $ko;
    if (is_float($atteso) || is_float($ottenuto)) {
        $uguale = abs($atteso - $ottenuto) < 1e-9;
    } else {
        $uguale = $atteso === $ottenuto;
    }
    if ($uguale) {
        $ok++;
        return;
    }
    $ko++;
    echo "  KO  $nome\n      atteso:   " . var_export($atteso, true)
        . "\n      ottenuto: " . var_export($ottenuto, true) . "\n";
}

// --- larghezza di un elemento ------------------------------------------------

// Un disegno da desktop, 1024 x 768 nella misura large, lato massimo 400:
// 400 x 300, piu' 2 x 30 di margine e 24 di gap.
prova('orizzontale ridotto', 484.0, custom_marquee_larghezza_elemento(1024, 768, 'ratio', 400, 300, 30, 24));
// Da telefono in verticale, 655 x 1024: il lato lungo e' l'altezza.
prova('verticale ridotto', 400 * 655 / 1024 + 84, custom_marquee_larghezza_elemento(655, 1024, 'ratio', 400, 300, 30, 24));
// Piu' piccola del lato massimo: non si ingrandisce.
prova('mai ingrandita', 200.0 + 84, custom_marquee_larghezza_elemento(200, 150, 'ratio', 400, 300, 30, 24));
prova('crop: larghezza fissa', 300.0 + 84, custom_marquee_larghezza_elemento(1024, 768, 'crop', 400, 300, 30, 24));
prova('misure mancanti', 0.0, custom_marquee_larghezza_elemento(0, 0, 'ratio', 400, 300, 30, 24));

// --- ripetizioni ---------------------------------------------------------------

prova('un disegno solo: si ripete', 8, custom_marquee_ripetizioni(484));
prova('copia gia\' larga: una volta', 1, custom_marquee_ripetizioni(20 * 484));
prova('esattamente il minimo: una volta', 1, custom_marquee_ripetizioni(3840));
prova('un pixel sotto: due volte', 2, custom_marquee_ripetizioni(3839));
prova('larghezza zero: una volta, niente divisione per zero', 1, custom_marquee_ripetizioni(0));
prova('immagini minuscole: tetto', CUSTOM_MARQUEE_RIPETIZIONI_MAX, custom_marquee_ripetizioni(1));

// --- durata --------------------------------------------------------------------

prova('3872 px a 64 px/s', 60.5, custom_marquee_durata(3872, 64));
prova('velocita\' non valida: 60 px/s', 10.0, custom_marquee_durata(600, 0));
prova('mai sotto un secondo', 1.0, custom_marquee_durata(10, 60));

// La proprieta' che conta: la velocita' non dipende da quante immagini ci sono.
$uno = custom_marquee_larghezza_elemento(1024, 768, 'ratio', 400, 300, 30, 24);
foreach ([1, 3, 20] as $n) {
    $copia = $n * $uno;
    $giro = custom_marquee_ripetizioni($copia) * $copia;
    prova("$n disegni: 64 px/s", 64.0, $giro / custom_marquee_durata($giro, 64));
}

echo "\n  $ok passati, $ko falliti\n";
exit($ko ? 1 : 0);
