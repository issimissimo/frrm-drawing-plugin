<?php
/**
 * Test della scelta dei disegni per la striscia, senza WordPress.
 *
 *   php plugin/test/galleria.php
 */

define('FRMM_LAVAGNA_TEST', true);
require __DIR__ . '/../frmm-lavagna/includes/galleria.php';

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

function riga($id, $att, $approvato)
{
    return ['id' => $id, 'att' => $att, 'approvato' => $approvato];
}

prova('nessun disegno', [], frmm_lavagna_scegli_per_galleria([], 20));

// Dal piu' vecchio al piu' nuovo per approvazione, qualunque sia l'ordine
// in cui arrivano (e qualunque sia l'id: conta la data).
prova('ordine per approvazione', [30, 10, 20], frmm_lavagna_scegli_per_galleria([
    riga(1, 10, 200), riga(2, 20, 300), riga(3, 30, 100),
], 20));

// Il tetto tiene i PIU' RECENTI: presi alla lettera i primi 20, la striscia
// si congelerebbe al ventunesimo disegno.
$tanti = [];
for ($i = 1; $i <= 25; $i++) {
    $tanti[] = riga($i, 100 + $i, 1000 + $i);
}
$scelti = frmm_lavagna_scegli_per_galleria($tanti, 20);
prova('tetto: 20', 20, count($scelti));
prova('tetto: si parte dal sesto', 106, $scelti[0]);
prova('tetto: si finisce col piu\' nuovo', 125, $scelti[19]);

// Inviato per primo, approvato per ultimo: e' il piu' nuovo della striscia.
prova('approvato tardi: in fondo', [20, 10], frmm_lavagna_scegli_per_galleria([
    riga(1, 10, 900), riga(2, 20, 500),
], 20));

// A pari data decide l'id: l'ordine non deve cambiare da un caricamento
// all'altro, o la striscia salterebbe a ogni ricarica.
prova('pari data: per id', [10, 20, 30], frmm_lavagna_scegli_per_galleria([
    riga(3, 30, 500), riga(1, 10, 500), riga(2, 20, 500),
], 20));

prova('senza allegato: fuori', [20], frmm_lavagna_scegli_per_galleria([
    riga(1, 0, 100), riga(2, 20, 200),
], 20));
prova('max non valido: almeno uno', [20], frmm_lavagna_scegli_per_galleria([
    riga(1, 10, 100), riga(2, 20, 200),
], 0));

echo "\n  $ok passati, $ko falliti\n";
exit($ko ? 1 : 0);
