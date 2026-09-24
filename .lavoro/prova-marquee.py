#!/usr/bin/env python3
"""
Il marquee gia' in uso sul sito non deve cambiare: questo script lo misura.

    python .lavoro/prova-marquee.py foto prima       # salva il riferimento
    python .lavoro/prova-marquee.py foto dopo
    python .lavoro/prova-marquee.py confronta prima dopo
    python .lavoro/prova-marquee.py foto prima --produzione   # il sito ufficiale

Con --produzione le foto si chiamano prod-<nome>: non si confondono con
quelle dello staging, e confronta le cerca con lo stesso prefisso. Sola
lettura, da anonimo.

Fotografa, sulla pagina /chi-siamo/ dello STAGING, due cose del widget
custom_marquee: il blocco HTML che il PHP stampa, e le regole che Elementor
ha scritto per lui nel CSS della pagina (i controlli con 'selectors' finiscono
li', non nell'HTML). Le foto stanno in .lavoro/dist/, che e' gitignorata.

Il confronto e' byte per byte: "sembra uguale" non e' un criterio, e il
sotto-piano del passo 8 promette che le istanze esistenti restano identiche.
"""

import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import staging  # noqa: E402

DIST = Path(__file__).resolve().parent / "dist"
PAGINA = "chi-siamo/"
PREFISSO = ""
if "--produzione" in sys.argv:
    sys.argv.remove("--produzione")
    staging.usa_produzione()
    PREFISSO = "prod-"


def blocco_widget(pagina):
    """Il <div> del widget custom_marquee, dall'apertura alla sua chiusura."""
    m = re.search(r'<div class="[^"]*elementor-widget-custom_marquee[^"]*"[^>]*>', pagina)
    if not m:
        sys.exit("Nella pagina non c'e' nessun widget custom_marquee.")
    livello, i = 0, m.start()
    for t in re.finditer(r"<div\b|</div>", pagina[m.start():]):
        livello += 1 if t.group(0) == "<div" else -1
        if livello == 0:
            return pagina[m.start(): m.start() + t.end()], m.group(0)
    sys.exit("Il blocco del widget non si chiude.")


def regole_css(sessione, pagina, apertura):
    """Le regole del CSS di Elementor che nominano questo widget."""
    wid = re.search(r'data-id="([0-9a-f]+)"', apertura).group(1)
    # Sullo staging le regole stanno in post-N.css; in produzione Speed
    # Optimizer combina i fogli e minifica: si cercano in ogni foglio del sito
    # e nei <style> della pagina.
    host = re.match(r"https?://[^/]+", staging.base()).group(0)
    fogli = [u for u in re.findall(r"""<link[^>]*rel=['"]stylesheet['"][^>]*href=['"]([^'"]+)['"]""", pagina)
             + re.findall(r"""<link[^>]*href=['"]([^'"]+\.css[^'"]*)['"][^>]*rel=['"]stylesheet['"]""", pagina)
             if u.startswith(host)]
    fogli = list(dict.fromkeys(fogli))
    testi = [sessione.get(url, timeout=60).text for url in fogli]
    testi += re.findall(r"<style[^>]*>(.*?)</style>", pagina, re.S)
    regole = []
    for css in testi:
        regole += [r.strip() for r in re.findall(r"[^{}]*\{[^{}]*\}", css) if f"elementor-element-{wid}" in r]
        # Le media query racchiudono le regole responsive: si prendono intere.
        for mq in re.finditer(r"@media[^{]*\{((?:[^{}]*\{[^{}]*\})*)\s*\}", css):
            if f"elementor-element-{wid}" in mq.group(0):
                regole.append(mq.group(0).strip())
    return wid, fogli, regole


def foto(nome):
    s = staging.anonima()
    # La query evita che una cache davanti al sito serva la pagina di prima.
    r = s.get(staging.base() + PAGINA + f"?prova-marquee={int(time.time())}", timeout=60)
    r.raise_for_status()
    html, apertura = blocco_widget(r.text)
    wid, fogli, regole = regole_css(s, r.text, apertura)
    DIST.mkdir(exist_ok=True)
    (DIST / f"marquee-{PREFISSO}{nome}.html").write_text(html, encoding="utf-8", newline="")
    (DIST / f"marquee-{PREFISSO}{nome}.css").write_text("\n".join(sorted(set(regole))), encoding="utf-8", newline="")
    immagini = html.count('class="mq-item"')
    print(f"  {PREFISSO}{nome} ({staging.base()}): widget {wid}, {len(html)} byte, {immagini} immagini, "
          f"{len(set(regole))} regole CSS da {len(fogli)} fogli")


def confronta(a, b):
    esito = 0
    for est in ("html", "css"):
        pa, pb = DIST / f"marquee-{PREFISSO}{a}.{est}", DIST / f"marquee-{PREFISSO}{b}.{est}"
        ta, tb = pa.read_text(encoding="utf-8"), pb.read_text(encoding="utf-8")
        if ta == tb:
            print(f"  ok  {est}: identico ({len(ta)} byte)")
            continue
        esito = 1
        la, lb = ta.splitlines(), tb.splitlines()
        import difflib
        print(f"  !!  {est}: DIVERSO")
        for riga in list(difflib.unified_diff(la, lb, a, b, lineterm="", n=1))[:60]:
            print("      " + riga)
    sys.exit(esito)


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "foto":
        foto(sys.argv[2])
    elif len(sys.argv) == 4 and sys.argv[1] == "confronta":
        confronta(sys.argv[2], sys.argv[3])
    else:
        sys.exit(__doc__)
