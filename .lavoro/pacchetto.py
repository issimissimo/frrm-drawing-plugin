#!/usr/bin/env python3
"""
Costruisce lo zip installabile del plugin WordPress.

    python .lavoro/pacchetto.py                  # la Lavagna
    python .lavoro/pacchetto.py custom-marquee   # il Custom Marquee (passo 8)

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


def versiona_moduli(app, versione):
    """Mette ?v=<versione> in coda a OGNI modulo, non solo a index.html.

    ⚠️ Scoperto il 23/09/2026 provando la 1.4.0 sullo staging: SiteGround serve
    i .js con Cache-Control max-age=31536000, un anno. Il ?v= dello shortcode
    rinnova index.html, ma i moduli che index.html importa hanno sempre lo
    stesso URL: chi aveva gia' aperto la lavagna riceveva l'index nuovo e il
    main.js vecchio. Nel caso buono non vedeva la novita'; in quello cattivo
    un modulo nuovo importava una funzione da un modulo vecchio che non ce
    l'ha, e la lavagna non si apriva — solo per chi c'era gia' stato.

    Si riscrive la COPIA che va nello zip: il sorgente in prototipo/ resta
    senza versioni, e il prototipo in locale o sotto temp/ gira come prima.
    Ogni import di un modulo diventa './x.js?v=1.4.0' in tutti i file, quindi
    per il browser ogni modulo ha un solo URL e non ne esistono due copie.

    Non si usa un import map, che farebbe lo stesso senza toccare i file:
    Safari lo supporta dalla 16.4, e un iPad di qualche anno fa e' proprio il
    dispositivo che un bambino si fa prestare.

    Il logo (new URL('../images/logo.png', import.meta.url)) e i font restano
    senza versione: non cambiano, e se cambiassero andrebbero rinominati.
    """
    q = f"?v={versione}"
    import_rel = re.compile(r"""(\bfrom\s+|\bimport\s*\(\s*|\bimport\s+)(['"])(\.{1,2}/[^'"?]+\.js)\2""")
    for js in sorted((app / "src").glob("*.js")):
        testo = js.read_text(encoding="utf-8")
        nuovo = import_rel.sub(lambda m: f"{m.group(1)}{m.group(2)}{m.group(3)}{q}{m.group(2)}", testo)
        js.write_text(nuovo, encoding="utf-8", newline="")

    html_p = app / "index.html"
    html = html_p.read_text(encoding="utf-8")
    html = re.sub(r'(<script[^>]*\bsrc=")(\./src/[^"?]+\.js)(")', lambda m: m.group(1) + m.group(2) + q + m.group(3), html)
    html_p.write_text(html, encoding="utf-8", newline="")

    # La verifica, che vale piu' di un conteggio di file: ogni modulo
    # importato esiste nel pacchetto e porta la versione. Un import mancante o
    # senza versione dentro un iframe da' una lavagna nera senza un messaggio.
    riferimenti = [("index.html", m) for m in re.findall(r'<script[^>]*\bsrc="(\./src/[^"]+)"', html)]
    for js in sorted((app / "src").glob("*.js")):
        for m in re.findall(r"""(?:\bfrom\s+|\bimport\s*\(\s*|\bimport\s+)['"](\.{1,2}/[^'"]+)['"]""", js.read_text(encoding="utf-8")):
            riferimenti.append((f"src/{js.name}", m))
    if not riferimenti:
        sys.exit(rosso("Non trovo nessun import: la riscrittura dei moduli non ha visto niente."))
    for chi, rif in riferimenti:
        percorso, _, query = rif.partition("?")
        base = app if chi == "index.html" else app / "src"
        if not (base / percorso).resolve().exists():
            sys.exit(rosso(f"{chi} importa {rif}, che nel pacchetto non c'e'."))
        if query != f"v={versione}":
            sys.exit(rosso(f"{chi} importa {rif} senza la versione: resterebbe in cache un anno."))
    print(f"      {len(riferimenti)} import versionati con {q}")


def marquee():
    """Il Custom Marquee: niente app, niente costante di versione, solo il PHP.

    Si copia com'e', byte per byte: il widget stampa il proprio template, e
    i fine riga CRLF del sorgente finiscono nell'HTML del sito (vedi
    .gitattributes). Uno zip che li convertisse cambierebbe /chi-siamo/.
    """
    sorgente = RADICE / "plugin" / "custom-marquee"
    testo = (sorgente / "custom-marquee.php").read_text(encoding="utf-8")
    v = re.search(r"^\s*\*\s*Version:\s*(\S+)", testo, re.M)
    if not v:
        sys.exit(rosso("Non trovo Version: nell'header di custom-marquee.php."))
    zip_path = DIST / f"custom-marquee-{v.group(1)}.zip"
    DIST.mkdir(exist_ok=True)
    if zip_path.exists():
        zip_path.unlink()
    file = [f for f in sorted(sorgente.rglob("*")) if f.is_file()]
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
        for f in file:
            z.write(f, Path("custom-marquee") / f.relative_to(sorgente))
    print(f"  ok  {zip_path.relative_to(RADICE)}  ({len(file)} file)")


def main():
    if sys.argv[1:] == ["custom-marquee"]:
        return marquee()
    if sys.argv[1:]:
        sys.exit(__doc__)

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

    # Il PHP, il README e includes/. Tutto quel che sta nella cartella del
    # plugin, sottocartelle comprese: dalla 1.3.0 il PHP non e' piu' un file
    # solo, e un include dimenticato qui sarebbe un errore fatale in bacheca.
    for f in PLUGIN.iterdir():
        if f.is_file():
            shutil.copy2(f, staging / f.name)
        elif f.is_dir():
            shutil.copytree(f, staging / f.name)

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

    versiona_moduli(staging / "app", v_header)

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
