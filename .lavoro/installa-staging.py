#!/usr/bin/env python3
"""
Installa (o aggiorna) lo zip del plugin sullo STAGING della Fondazione.

    python .lavoro/installa-staging.py            # l'ultima versione in dist/
    python .lavoro/installa-staging.py 1.3.0

Fa quel che si farebbe a mano da Plugin > Aggiungi nuovo > Carica plugin, e
se il plugin c'e' gia' sceglie "Sostituisci l'attuale con quello caricato".
L'aggiornamento conserva lo stato di attivazione.

Solo staging e credenziali mai stampate: vedi staging.py.
"""

import html
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import staging  # noqa: E402

DIST = Path(__file__).resolve().parent / "dist"


def zip_da_installare():
    if len(sys.argv) > 1:
        z = DIST / f"frmm-lavagna-{sys.argv[1]}.zip"
    else:
        tutti = sorted(DIST.glob("frmm-lavagna-*.zip"), key=lambda p: [int(x) for x in re.findall(r"\d+", p.stem)])
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

    print(f"  {z.name}")
    print("  " + staging.testo(r.text)[:900])

    # L'ultima parola non e' il messaggio, e' lo stato del plugin in elenco.
    r = s.get(admin + "plugins.php", timeout=30)
    riga = re.search(r'<tr[^>]*data-slug="frmm-lavagna"[^>]*>.*?</tr>', r.text, re.S)
    if not riga:
        sys.exit("  !!  frmm-lavagna non compare nell'elenco dei plugin")
    attivo = 'class="active' in riga.group(0) or "class='active" in riga.group(0)
    ver = re.search(r"Versione\s*([\d.]+)|Version\s*([\d.]+)", staging.testo(riga.group(0)))
    v = next((g for g in ver.groups() if g), "?") if ver else "?"
    print(f"  in elenco: versione {v}, {'ATTIVO' if attivo else 'NON ATTIVO'}")


if __name__ == "__main__":
    main()
