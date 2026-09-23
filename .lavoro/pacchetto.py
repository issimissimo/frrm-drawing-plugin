#!/usr/bin/env python3
"""
Costruisce lo zip installabile del plugin WordPress.

    python .lavoro/pacchetto.py

Esiste per una ragione sola, e non e' la comodita': nel repo il plugin e'
SOLTANTO il PHP. L'app (index.html, src/, images/, font/) resta dove e' sempre
stata, in prototipo/, e viene copiata qui dentro app/ solo al momento dello
zip.

Se invece l'app fosse duplicata nel repo dentro plugin/frmm-lavagna/app/,
esisterebbero due copie della stessa cosa e diverrebbero diverse al primo fix
fatto di fretta nella copia sbagliata. E' il genere di bug che si scopre sei
mesi dopo guardando due file che dovrebbero essere identici.

⚠️ I FONT NON SONO NEL REPO. SebinoSoft e' un font commerciale di terzi e
questo repo e' pubblico. Stanno in prototipo/font/, gitignorati. Senza di
loro il plugin si installa, funziona e ha la tipografia sbagliata — che e' il
modo piu' facile di consegnare una cosa che sembra a posto.
"""

import re
import shutil
import sys
import zipfile
from pathlib import Path

RADICE = Path(__file__).resolve().parent.parent
PLUGIN = RADICE / "plugin" / "frmm-lavagna"
APP = RADICE / "prototipo"
DIST = RADICE / ".lavoro" / "dist"

# Quel che dell'app va online. I test e package.json non servono in rete, e
# il README del prototipo racconta lo sviluppo, non l'uso.
DA_COPIARE = ["index.html", "src", "images", "font"]


def rosso(s):
    return f"\033[31m{s}\033[0m"


def versioni():
    """Le due versioni che devono coincidere: l'header del plugin e la costante.

    WordPress legge la prima, il cache buster dell'iframe usa la seconda. Se
    divergono, la bacheca dice una cosa e i browser ne servono un'altra: dopo
    un aggiornamento la lavagna vecchia resta in cache e nessuno capisce
    perche'. Meglio che se ne accorga questo script.
    """
    testo = (PLUGIN / "frmm-lavagna.php").read_text(encoding="utf-8")
    header = re.search(r"^\s*\*\s*Version:\s*(\S+)", testo, re.M)
    costante = re.search(r"define\(\s*'FRMM_LAVAGNA_VER'\s*,\s*'([^']+)'", testo)
    if not header or not costante:
        sys.exit(rosso("Non trovo la versione nell'header o la costante FRMM_LAVAGNA_VER."))
    return header.group(1), costante.group(1)


def main():
    v_header, v_costante = versioni()
    if v_header != v_costante:
        sys.exit(rosso(
            f"Le versioni divergono: header «{v_header}», FRMM_LAVAGNA_VER «{v_costante}».\n"
            "Vanno cambiate insieme, sono nello stesso file a venti righe di distanza."
        ))

    staging = DIST / "frmm-lavagna"
    if staging.exists():
        shutil.rmtree(staging)
    (staging / "app").mkdir(parents=True)

    # Il PHP e il README del plugin.
    for f in PLUGIN.iterdir():
        if f.is_file():
            shutil.copy2(f, staging / f.name)

    # L'app, dalla sua unica fonte.
    mancanti = []
    for nome in DA_COPIARE:
        sorgente = APP / nome
        if not sorgente.exists():
            mancanti.append(nome)
            continue
        destinazione = staging / "app" / nome
        if sorgente.is_dir():
            shutil.copytree(sorgente, destinazione)
        else:
            shutil.copy2(sorgente, destinazione)

    if "font" in mancanti:
        print(rosso("  !!  prototipo/font/ non c'e': il plugin avra' la tipografia sbagliata."))
        print("      I font si riscaricano col comando in prototipo/README.md.")
    if "images" in mancanti:
        print(rosso("  !!  prototipo/images/ non c'e': le immagini salvate non avranno il logo."))

    # Un controllo che vale piu' di un conteggio di file: i moduli che
    # index.html importa devono esserci tutti. Un import mancante dentro un
    # iframe da' una pagina nera senza un messaggio visibile.
    html = (staging / "app" / "index.html").read_text(encoding="utf-8")
    moduli = set(re.findall(r'src="(src/[^"]+\.js)"', html)) | set(
        re.findall(r"from\s+'(\./[^']+\.js)'", html)
    )
    for m in sorted(moduli):
        if not (staging / "app" / m.replace("./", "src/")).exists() and not (staging / "app" / m).exists():
            sys.exit(rosso(f"index.html carica {m}, che nel pacchetto non c'e'."))

    zip_path = DIST / f"frmm-lavagna-{v_header}.zip"
    if zip_path.exists():
        zip_path.unlink()
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
        for f in sorted(staging.rglob("*")):
            if f.is_file():
                z.write(f, f.relative_to(staging.parent))

    n = sum(1 for f in staging.rglob("*") if f.is_file())
    kb = zip_path.stat().st_size / 1024
    print(f"  ok  {zip_path.relative_to(RADICE)}  ({n} file, {kb:.0f} KB)")
    print(f"      versione {v_header} — si installa da Plugin > Aggiungi nuovo > Carica plugin")


if __name__ == "__main__":
    main()
