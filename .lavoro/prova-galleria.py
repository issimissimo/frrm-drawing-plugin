#!/usr/bin/env python3
"""
La striscia dei disegni approvati, provata sullo STAGING (passo 8).

    python .lavoro/prova-galleria.py guarda  <url-pagina>
    python .lavoro/prova-galleria.py prova   <url-pagina> <immagini-al-massimo>
    python .lavoro/prova-galleria.py pulisci

guarda   legge la pagina da anonimo e dice cosa c'e' nella striscia.
prova    il giro completo: invia 4 disegni numerati (orizzontale, verticale,
         panoramico, orizzontale), ne approva 3 uno alla volta e controlla la
         pagina dopo ciascuno; il quarto resta in attesa e non deve comparire
         mai; poi toglie (cestino) il primo approvato e controlla che sparisca.
         Ogni disegno manda un'email all'admin dello staging.
pulisci  sposta nel cestino i disegni di prova ancora pubblicati o in attesa
         (quelli col titolo che comincia da "Disegno del" e il numero dipinto
         non si riconoscono dal titolo: si usa il file .lavoro/dist/
         prova-galleria.json scritto da "prova").

Cosa si controlla sulla pagina, a ogni passo:
  - ogni immagine della striscia e' l'allegato di un disegno PUBBLICATO;
  - l'ordine e' quello atteso (per approvazione, dal piu' vecchio);
  - non piu' di "Immagini al massimo" disegni diversi;
  - il file servito e' una misura intermedia, non l'originale;
  - la striscia e' ripetuta per intero (2 x ripetizioni x disegni).

Da anonimo e con una query nuova a ogni lettura: e' la pagina che vede il
pubblico, non quella di chi e' collegato.
"""

import io
import json
import random
import re
import sys
import time
import uuid
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent))
import staging  # noqa: E402

DIST = Path(__file__).resolve().parent / "dist"
REGISTRO = DIST / "prova-galleria.json"
ENDPOINT = staging.base() + "wp-json/frmm-lavagna/v1/invio"

ok = 0
ko = 0


def esito(nome, buono, dettaglio=""):
    global ok, ko
    if buono:
        ok += 1
        print(f"  ok  {nome}")
    else:
        ko += 1
        print(f"  KO  {nome}  {dettaglio}")


# --- invio -------------------------------------------------------------------

def disegno(h, seme):
    """Un Drawing come lo produce l'app: qualche tratto di gesso."""
    rnd = random.Random(seme)
    tratti = []
    for i in range(8):
        pts = []
        for _ in range(12):
            pts += [rnd.uniform(0, 1600), rnd.uniform(0, h), rnd.uniform(0.84, 1)]
        tratti.append({"id": i + 1, "tool": "chalk", "color": "#FAF8F3", "width": 27,
                       "seed": rnd.randrange(2**32), "pts": pts})
    return {"version": 1, "board": {"w": 1600, "h": h}, "strokes": tratti}


def jpeg(h, numero):
    """Lavagna col numero dipinto grande: nella striscia si legge l'ordine a occhio."""
    img = Image.new("RGB", (1600, h), "#1F2225")
    d = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("arial.ttf", min(900, h - 100))
    except OSError:
        font = ImageFont.load_default()
    d.text((800, h / 2), str(numero), fill="#F2C94C", font=font, anchor="mm")
    d.rectangle([20, 20, 1580, h - 20], outline="#FAF8F3", width=16)
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=90)
    return buf.getvalue()


def invia(h, numero):
    campi = {"client_id": str(uuid.uuid4()), "disegno": json.dumps(disegno(h, numero))}
    r = staging.anonima().post(ENDPOINT, data=campi,
                               files={"immagine": (f"prova-{numero}.jpg", jpeg(h, numero), "image/jpeg")},
                               timeout=120)
    if r.status_code != 201:
        sys.exit(f"  invio {numero} fallito: {r.status_code} {r.text[:200]}")
    return int(r.json()["id"])


# --- bacheca -----------------------------------------------------------------

def lista(adm, stato):
    return adm.get(staging.credenziali()[0] + "edit.php",
                   params={"post_type": "frmm_disegno", "post_status": stato}, timeout=60).text


def riga(pagina, pid):
    m = re.search(rf'<tr id="post-{pid}".*?</tr>', pagina, re.S)
    return m.group(0) if m else ""


def link(pagina, pid, azione):
    """Il link vero della riga, col suo nonce: si clicca quel che clicca l'admin."""
    import html
    r = riga(pagina, pid)
    if azione == "trash":
        m = re.search(r'href="([^"]*post\.php\?post=' + str(pid) + r'&(?:amp;)?action=trash[^"]*)"', r)
    else:
        m = re.search(r'href="([^"]*admin-post\.php\?action=frmm_' + azione + r'[^"]*)"', r)
    if not m:
        sys.exit(f"  nella bacheca non trovo «{azione}» per il disegno {pid}")
    u = html.unescape(m.group(1))
    return u if u.startswith("http") else staging.credenziali()[0] + u.lstrip("/")


def approva(adm, pid):
    adm.get(link(lista(adm, "pending"), pid, "approva"), timeout=60)


def cestina(adm, pid):
    adm.get(link(lista(adm, "publish"), pid, "trash"), timeout=60)


def pubblicati(adm):
    return [int(p) for p in re.findall(r'<tr id="post-(\d+)"', lista(adm, "publish"))]


def allegato(adm, pid):
    """Nome del file originale dell'allegato del disegno (senza estensione)."""
    rr = adm.get(staging.base() + "wp-json/wp/v2/media",
                 params={"parent": pid, "context": "edit"}, timeout=60).json()
    if not rr:
        return None
    return Path(rr[0]["source_url"]).stem


# --- pagina ------------------------------------------------------------------

def striscia(url):
    """Le striscie della pagina con sorgente esterna: src in ordine, stile."""
    sep = "&" if "?" in url else "?"
    t = staging.anonima().get(f"{url}{sep}prova-galleria={int(time.time() * 1000)}", timeout=60).text
    risultati = []
    for m in re.finditer(r'<div class="marquee-inner"( style="animation-duration:([\d.]+)s")?>(.*?)</div>\s*</div>', t, re.S):
        if not m.group(1):
            continue  # immagini scelte a mano: non e' la striscia dei disegni
        src = re.findall(r'<img[^>]*?\ssrc="([^"]+)"', m.group(3))
        risultati.append({"durata": float(m.group(2)), "src": src})
    return risultati


def stem_originale(src):
    """abc123-1024x768.jpg -> (abc123, True); abc123.jpg -> (abc123, False)."""
    s = Path(src.split("?")[0]).stem
    m = re.match(r"^(.*)-(\d+)x(\d+)$", s)
    return (m.group(1), True) if m else (s, False)


def controlla(adm, url, attesi, massimo, titolo):
    """attesi: id dei disegni che devono esserci, nell'ordine."""
    print(f"\n  -- {titolo}")
    strisce = striscia(url)
    if len(strisce) != 1:
        esito("una striscia con sorgente esterna nella pagina", False, f"trovate {len(strisce)}")
        return
    s = strisce[0]
    file_attesi = [allegato(adm, pid) for pid in attesi[-massimo:]]
    visti = [stem_originale(u) for u in s["src"]]
    stems = [v[0] for v in visti]
    n = len(file_attesi)
    esito(f"{len(stems)} immagini, multiplo esatto di {n} disegni x 2",
          n > 0 and len(stems) % (2 * n) == 0, f"{len(stems)}")
    esito(f"ordine per approvazione: {attesi[-massimo:]}", n > 0 and stems[:n] == file_attesi,
          f"visti {stems[:n]} attesi {file_attesi}")
    esito("il giro si ripete identico", n > 0 and all(stems[i] == file_attesi[i % n] for i in range(len(stems))))
    esito("mai l'originale: sempre una misura intermedia", all(v[1] for v in visti))
    pub = {allegato(adm, pid) for pid in pubblicati(adm)}
    esito("solo allegati di disegni pubblicati", set(stems) <= pub, set(stems) - pub)
    print(f"      durata del giro {s['durata']} s, {len(stems) // 2} immagini per giro")


# --- comandi -----------------------------------------------------------------

def prova(url):
    adm = staging.collegata()
    prima = pubblicati(adm)
    massimo = int(input_massimo(url))
    print(f"\n  pagina {url}\n  pubblicati prima: {prima}  (immagini al massimo: {massimo})")

    # L'ordine atteso di partenza: quello che la pagina mostra adesso, che per i
    # disegni approvati prima della 1.7.0 dipende dalla data d'invio.
    base = [p for p in sorted(prima)]  # ripiego: data d'invio = ordine degli id
    controlla(adm, url, base, massimo, "prima di tutto")

    formati = [(1200, 1), (2500, 2), (900, 3), (1200, 4)]
    nuovi = []
    for h, numero in formati:
        nuovi.append(invia(h, numero))
    REGISTRO.write_text(json.dumps(nuovi), encoding="utf-8")
    print(f"\n  inviati {nuovi} (l'ultimo resta in attesa)")

    attesi = list(base)
    for pid in nuovi[:3]:
        time.sleep(1.1)  # date di approvazione distinte: time() e' al secondo
        approva(adm, pid)
        attesi.append(pid)
        controlla(adm, url, attesi, massimo, f"approvato {pid}")

    esito("il disegno in attesa non c'e'",
          allegato(adm, nuovi[3]) not in [stem_originale(u)[0] for s in striscia(url) for u in s["src"]])

    cestina(adm, nuovi[0])
    attesi.remove(nuovi[0])
    controlla(adm, url, attesi, massimo, f"tolto {nuovi[0]} (cestino)")

    print(f"\n  {ok} passati, {ko} falliti")
    sys.exit(1 if ko else 0)


def input_massimo(url):
    """Il tetto impostato nel widget non si legge dalla pagina: lo si chiede."""
    if len(sys.argv) > 3:
        return sys.argv[3]
    sys.exit("  Serve il valore di «Immagini al massimo» del widget: prova <url> <massimo>")


def guarda(url):
    for s in striscia(url):
        stems = [stem_originale(u) for u in s["src"]]
        print(f"  durata {s['durata']} s, {len(stems)} immagini")
        for st, ridotta in stems[: len(stems) // 2]:
            print(f"    {st}{'' if ridotta else '   <-- ORIGINALE'}")


def pulisci():
    if not REGISTRO.exists():
        sys.exit("  Nessun registro: niente da pulire.")
    adm = staging.collegata()
    ids = json.loads(REGISTRO.read_text(encoding="utf-8"))
    for pid in ids:
        for stato in ("publish", "pending"):
            pagina = lista(adm, stato)
            if riga(pagina, pid):
                u = link(pagina, pid, "trash" if stato == "publish" else "rifiuta")
                adm.get(u, timeout=60)
                print(f"  {pid} ({stato}) nel cestino")
    REGISTRO.unlink()


if __name__ == "__main__":
    comando = sys.argv[1] if len(sys.argv) > 1 else ""
    if comando == "guarda" and len(sys.argv) > 2:
        guarda(sys.argv[2])
    elif comando == "prova" and len(sys.argv) > 2:
        prova(sys.argv[2])
    elif comando == "pulisci":
        pulisci()
    else:
        sys.exit(__doc__)
