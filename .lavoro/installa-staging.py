#!/usr/bin/env python3
"""
Installa (o aggiorna) lo zip del plugin sullo STAGING della Fondazione.

    python .lavoro/installa-staging.py            # l'ultima versione in dist/
    python .lavoro/installa-staging.py 1.3.0
    python .lavoro/installa-staging.py 1.6.1 --produzione   # il sito ufficiale
    python .lavoro/installa-staging.py custom-marquee [1.1.0]  # l'altro plugin

Il nome del plugin, se c'e', viene prima della versione; senza, e' la Lavagna.

Fa quel che si farebbe a mano da Plugin > Aggiungi nuovo > Carica plugin, e
se il plugin c'e' gia' sceglie "Sostituisci l'attuale con quello caricato".
L'aggiornamento conserva lo stato di attivazione.

Staging per default, sito ufficiale solo con --produzione; credenziali mai
stampate: vedi staging.py.
"""

import html
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import staging  # noqa: E402

DIST = Path(__file__).resolve().parent / "dist"


ARGOMENTI = [a for a in sys.argv[1:] if not a.startswith("--")]
PLUGIN = ARGOMENTI.pop(0) if ARGOMENTI and not re.match(r"\d", ARGOMENTI[0]) else "frmm-lavagna"
if PLUGIN not in ("frmm-lavagna", "custom-marquee"):
    sys.exit(f"Plugin sconosciuto: {PLUGIN}")
if "--produzione" in sys.argv:
    staging.usa_produzione()


def zip_da_installare():
    if ARGOMENTI:
        z = DIST / f"{PLUGIN}-{ARGOMENTI[0]}.zip"
    else:
        tutti = sorted(DIST.glob(f"{PLUGIN}-*.zip"), key=lambda p: [int(x) for x in re.findall(r"\d+", p.stem)])
        z = tutti[-1] if tutti else None
    if not z or not z.exists():
        sys.exit("Zip non trovato: prima python .lavoro/pacchetto.py")
    return z


def main():
    admin = staging.credenziali()[0]
    z = zip_da_installare()
    s = staging.collegata()

    r = s.get(admin + "plugin-install.php?tab=upload", timeout=30)
    nonce = re.search(r'action="[^"]*update\.php\?action=upload-plugin".*?name="_wpnonce" value="([^"]+)"', r.text, re.S)
    if not nonce:
        sys.exit("Non trovo il modulo di caricamento: l'utente puo' installare plugin?")

    with z.open("rb") as f:
        r = s.post(
            admin + "update.php?action=upload-plugin",
            data={
                "_wpnonce": nonce.group(1),
                "_wp_http_referer": "/wp-admin/plugin-install.php?tab=upload",
                "install-plugin-submit": "Installa ora",
            },
            files={"pluginzip": (z.name, f, "application/zip")},
            timeout=180,
        )

    # Gia' installato: WordPress mostra il confronto e chiede se sostituire.
    sost = re.search(r'href="([^"]*overwrite=update-plugin[^"]*)"', r.text)
    if sost:
        url = html.unescape(sost.group(1))
        if not url.startswith("http"):
            url = admin + url.lstrip("/")
        r = s.get(url, timeout=180)

    print(f"  {z.name} -> {admin}")
    print("  " + staging.testo(r.text)[:900])

    # Prima installazione: WordPress installa ma non attiva, e offre il link.
    # Un aggiornamento invece conserva lo stato, e il link non c'e'.
    attiva = re.search(r'href="([^"]*plugins\.php\?action=activate[^"]*plugin=' + PLUGIN + r'[^"]*)"', r.text)
    if attiva:
        url = html.unescape(attiva.group(1))
        if not url.startswith("http"):
            url = admin + url.lstrip("/")
        s.get(url, timeout=60)
        print("  attivato")

    # L'ultima parola non e' il messaggio, e' lo stato del plugin in elenco.
    r = s.get(admin + "plugins.php", timeout=30)
    # data-plugin e non data-slug: per un plugin che non viene da wordpress.org
    # lo slug e' ricavato dal nome ("custom-marquee-widget"), il percorso no.
    riga = re.search(r'<tr[^>]*data-plugin="' + PLUGIN + r'/[^"]*"[^>]*>.*?</tr>', r.text, re.S)
    if not riga:
        sys.exit(f"  !!  {PLUGIN} non compare nell'elenco dei plugin")
    attivo = 'class="active' in riga.group(0) or "class='active" in riga.group(0)
    ver = re.search(r"Versione\s*([\d.]+)|Version\s*([\d.]+)", staging.testo(riga.group(0)))
    v = next((g for g in ver.groups() if g), "?") if ver else "?"
    print(f"  in elenco: versione {v}, {'ATTIVO' if attivo else 'NON ATTIVO'}")


if __name__ == "__main__":
    main()
