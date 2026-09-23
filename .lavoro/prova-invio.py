#!/usr/bin/env python3
"""
Prova l'endpoint di invio sullo STAGING, dal PC, senza l'app.

    python .lavoro/prova-invio.py

Passo 1 del piano delle Fasi 6-10. Tre gruppi di prove:

  1. quel che deve passare passa (201), quel che non deve essere accettato
     viene rifiutato col codice giusto;
  2. da amministratore: il disegno e' in attesa, ha l'immagine, e l'immagine
     sul server e' stata RICODIFICATA (un JPEG con del PHP in coda arriva
     senza la coda);
  3. da anonimo: il disegno appena inviato non si trova per nessuna delle
     strade che WordPress apre da solo — ?attachment_id=, ?p=, la REST API
     dei media, quella dei post.

⚠️ Ogni esecuzione lascia sullo staging tre disegni in attesa (il valido,
quello col doppione e il poliglotta). E' lo staging e sono il materiale del passo 3 (la bacheca).

Non e' ancora lo script di abuso del passo 4 (500 invii, 50 MB): qui si
guarda che ogni singolo controllo faccia il suo lavoro.
"""

import io
import json
import random
import sys
import uuid
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
import staging  # noqa: E402

BASE = staging.base()
URL = BASE + "wp-json/frmm-lavagna/v1/invio"

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


def disegno(h=1200, solo_gomma=False):
    """Un Drawing come lo produce l'app: qualche tratto di gesso a caso."""
    rnd = random.Random(42)
    tratti = []
    for i in range(12):
        pts = []
        for _ in range(20):
            pts += [rnd.uniform(0, 1600), rnd.uniform(0, h), rnd.uniform(0.84, 1)]
        tratti.append({"id": i + 1, "tool": "eraser" if solo_gomma else "chalk",
                       "color": None if solo_gomma else "#FAF8F3",
                       "width": 27, "seed": rnd.randrange(2**32), "pts": pts})
    return {"version": 1, "board": {"w": 1600, "h": h}, "strokes": tratti}


def jpeg(w=1600, h=1200, fmt="JPEG", coda=b""):
    img = Image.new("RGB", (w, h), "#1F2225")
    d = ImageDraw.Draw(img)
    rnd = random.Random(7)
    for _ in range(40):
        d.line([(rnd.uniform(0, w), rnd.uniform(0, h)) for _ in range(6)], fill="#FAF8F3", width=14)
    buf = io.BytesIO()
    img.save(buf, fmt, quality=92)
    return buf.getvalue() + coda


def in_attesa(adm):
    """Quanti disegni in attesa conta la bacheca."""
    import re
    r = adm.get(staging.credenziali()[0] + "edit.php", params={"post_type": "frmm_disegno"}, timeout=30)
    m = re.search(r"""class=['"]pending['"].*?<span class="count">\((\d+)\)</span>""", r.text, re.S)
    return int(m.group(1)) if m else -1


def invia(campi, immagine=None, nomefile="disegno.jpg", tipo="image/jpeg"):
    files = {"immagine": (nomefile, immagine, tipo)} if immagine is not None else None
    r = staging.anonima().post(URL, data=campi, files=files, timeout=120)
    try:
        corpo = r.json()
    except ValueError:
        corpo = {"code": f"(non JSON: {r.text[:80]!r})"}
    return r.status_code, corpo


def attesa(nome, status_atteso, codice_atteso, campi, immagine=None, **kw):
    st, corpo = invia(campi, immagine, **kw)
    codice = corpo.get("code") if isinstance(corpo, dict) else None
    esito(f"{nome:44s} -> {st} {codice or ''}",
          st == status_atteso and (codice_atteso is None or codice == codice_atteso),
          f"(atteso {status_atteso} {codice_atteso or ''}; corpo {json.dumps(corpo)[:160]})")
    return st, corpo


def main():
    cid = str(uuid.uuid4())
    buono = json.dumps(disegno())
    img = jpeg()
    print(f"\n  {URL}\n\n  -- 1. cosa passa e cosa no\n")

    st, corpo = attesa("disegno valido", 201, None, {"client_id": cid, "disegno": buono}, img)
    valido_id = corpo.get("id") if st == 201 else None
    esito("la risposta non contiene URL", "http" not in json.dumps(corpo))

    attesa("senza client_id", 400, "frmm_client_id", {"disegno": buono}, img)
    attesa("client_id non UUID", 400, "frmm_client_id", {"client_id": "12345", "disegno": buono}, img)
    attesa("senza disegno", 400, "frmm_disegno", {"client_id": cid}, img)
    attesa("JSON rotto", 400, "frmm_disegno", {"client_id": cid, "disegno": buono[:-40]}, img)
    attesa("solo gommate", 400, "frmm_disegno_vuoto",
           {"client_id": cid, "disegno": json.dumps(disegno(solo_gomma=True))}, img)
    attesa("senza immagine", 400, "frmm_immagine", {"client_id": cid, "disegno": buono})
    attesa("PNG dichiarato JPEG", 415, "frmm_immagine_tipo", {"client_id": cid, "disegno": buono}, jpeg(fmt="PNG"))
    attesa("PHP con nome .jpg", 415, "frmm_immagine_tipo",
           {"client_id": cid, "disegno": buono}, b"<?php phpinfo(); ?>", nomefile="x.jpg")
    attesa("JPEG 800x600", 400, "frmm_immagine_misure", {"client_id": cid, "disegno": buono}, jpeg(800, 600))
    attesa("JPEG giusto, disegno di altra altezza", 400, "frmm_immagine_misure",
           {"client_id": cid, "disegno": json.dumps(disegno(h=2600))}, img)
    attesa("immagine da 6 MB", 413, "frmm_immagine_grande",
           {"client_id": cid, "disegno": buono}, b"\xff\xd8\xff" + random.randbytes(6 * 1024 * 1024))
    esito(f"{'GET al posto di POST':44s}", staging.anonima().get(URL, timeout=30).status_code == 404)

    # La ripresa dell'app: lo stesso invio_id due volte e' UN disegno.
    adm = staging.collegata()
    prima = in_attesa(adm)
    iid = str(uuid.uuid4())
    campi = {"client_id": cid, "disegno": buono, "invio_id": iid, "tentativo": "1"}
    st1, c1 = attesa("con invio_id, primo arrivo", 201, None, campi, img)
    campi["tentativo"] = "2"
    st2, c2 = attesa("stesso invio_id, secondo arrivo", 200, None, campi, img)
    esito("il doppione rimanda allo stesso disegno", c1.get("id") and c1.get("id") == c2.get("id") and c2.get("doppio") is True,
          f"{c1} / {c2}")
    esito("in bacheca un disegno in piu', non due", in_attesa(adm) == prima + 1, f"{prima} -> {in_attesa(adm)}")
    attesa("invio_id non UUID", 400, "frmm_invio_id", {"client_id": cid, "disegno": buono, "invio_id": "abc"}, img)

    st, corpo = attesa("JPEG con PHP in coda (poliglotta)", 201, None,
                       {"client_id": cid, "disegno": buono}, jpeg(coda=b"<?php system($_GET['c']); ?>"))
    poli_id = corpo.get("id") if st == 201 else None

    print("\n  -- 2. da amministratore\n")
    rest = BASE + "wp-json/wp/v2/"
    att = {}
    for nome, pid in (("valido", valido_id), ("poliglotta", poli_id)):
        if not pid:
            esito(f"{nome}: niente id, salto", False)
            continue
        r = adm.get(rest + "media", params={"parent": pid, "context": "edit"}, timeout=30)
        m = r.json() if r.status_code == 200 else []
        esito(f"{nome}: ha un allegato", len(m) == 1, f"HTTP {r.status_code} {r.text[:120]}")
        if not m:
            continue
        att[nome] = m[0]
        src = m[0]["source_url"]
        file = src.rsplit("/", 1)[1]
        esito(f"{nome}: file in uploads/frmm-lavagna/, nome casuale", "/uploads/frmm-lavagna/" in src
              and len(file.split(".")[0].replace("-scaled", "")) == 32, src)
        dati = adm.get(src, timeout=30).content
        esito(f"{nome}: il file e' un JPEG 1600x1200", Image.open(io.BytesIO(dati)).size == (1600, 1200))
        esito(f"{nome}: nessun '<?php' nel file sul server", b"<?php" not in dati)

    # Lo stato del post lo dice la bacheca: il CPT non e' in REST, di proposito.
    admin = staging.credenziali()[0]
    if valido_id:
        r = adm.get(admin + "edit.php", params={"post_type": "frmm_disegno", "post_status": "pending"}, timeout=30)
        esito("il valido e' fra i disegni in attesa", f'id="post-{valido_id}"' in r.text, f"HTTP {r.status_code}")

    print("\n  -- 3. da anonimo, il disegno in attesa non si trova\n")
    ano = staging.anonima()
    for nome, a in att.items():
        r = ano.get(BASE, params={"attachment_id": a["id"]}, allow_redirects=False, timeout=30)
        dove = r.headers.get("Location", "")
        esito(f"{nome}: ?attachment_id={a['id']} non porta al file",
              "frmm-lavagna/" not in dove and "frmm-lavagna/" not in r.text,
              f"HTTP {r.status_code} -> {dove}")
        r = ano.get(rest + f"media/{a['id']}", timeout=30)
        esito(f"{nome}: /wp/v2/media/{a['id']} chiuso", r.status_code in (401, 403, 404), f"HTTP {r.status_code}")
        r = ano.get(rest + "media", params={"parent": a["post"]}, timeout=30)
        esito(f"{nome}: /wp/v2/media?parent= vuoto", r.status_code != 200 or r.json() == [], r.text[:120])
        pid = a["post"]
        r = ano.get(BASE, params={"p": pid, "post_type": "frmm_disegno"}, allow_redirects=False, timeout=30)
        esito(f"{nome}: ?p={pid}&post_type=frmm_disegno non mostra niente", "frmm-lavagna/" not in r.text
              and "frmm-lavagna/" not in r.headers.get("Location", ""), f"HTTP {r.status_code}")
    r = ano.get(rest + "media", params={"per_page": 100, "search": "Disegno"}, timeout=30)
    esito("/wp/v2/media?search=Disegno non elenca disegni", "frmm-lavagna/" not in r.text)
    r = ano.get(rest + "frmm_disegno", timeout=30)
    esito("/wp/v2/frmm_disegno non esiste", r.status_code == 404, f"HTTP {r.status_code}")
    r = ano.get(BASE + "wp-content/uploads/frmm-lavagna/", timeout=30)
    esito("la cartella non si lascia elencare", "jpg" not in r.text, f"HTTP {r.status_code}")

    print(f"\n  {ok} passati, {ko} falliti\n")
    sys.exit(1 if ko else 0)


if __name__ == "__main__":
    main()
