#!/usr/bin/env python3
"""
Il passo 5 (retention), sullo STAGING: che fine fa l'immagine di un disegno
rifiutato quando il disegno viene eliminato per sempre.

    python .lavoro/prova-retention.py           # un disegno: invia, rifiuta, elimina, guarda
    python .lavoro/prova-retention.py svuota    # «Svuota cestino» dei disegni, poi cerca gli orfani
    python .lavoro/prova-retention.py orfani    # solo la ricerca degli orfani (sola lettura)

Il difetto che cerca: eliminando un post WordPress non cancella i suoi
allegati, li STACCA. La Libreria nasconde le immagini dei disegni in base al
disegno a cui sono attaccate (bacheca.php), quindi un'immagine rimasta senza
disegno ricompare nella Libreria, nei selettori di Elementor, e forse nella
REST API dei media da anonimo. Dalla 1.9.0 non deve restare niente: ne'
l'allegato, ne' il file, ne' le miniature.

Si passa dai link veri della bacheca (Rifiuta, Elimina definitivamente,
Svuota cestino), col loro nonce: si fa quel che fa l'amministratore.

Costo: un disegno e una email all'admin_email dello staging a ogni giro.
"""

import html
import json
import re
import sys
import uuid
import importlib.util
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))
import staging  # noqa: E402

_spec = importlib.util.spec_from_file_location("prova_invio", Path(__file__).with_name("prova-invio.py"))
pi = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(pi)

BASE = staging.base()
ADMIN = staging.credenziali()[0]

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


def lista(adm, stato):
    return adm.get(ADMIN + "edit.php", params={"post_type": "frmm_disegno", "post_status": stato}, timeout=60).text


def link_riga(pagina, pid, schema):
    riga = re.search(rf'<tr id="post-{pid}".*?</tr>', pagina, re.S)
    if not riga:
        sys.exit(f"  nella bacheca non trovo la riga del disegno {pid}")
    m = re.search(r'href="([^"]*' + schema + r'[^"]*)"', riga.group(0))
    if not m:
        sys.exit(f"  nella riga del disegno {pid} non trovo il link {schema}")
    u = html.unescape(m.group(1))
    return u if u.startswith("http") else ADMIN + u.lstrip("/")


def allegato(adm, pid):
    """L'allegato del disegno, con l'URL del file e delle miniature."""
    rr = adm.get(BASE + "wp-json/wp/v2/media", params={"parent": pid, "context": "edit"}, timeout=60).json()
    if not rr:
        return None
    m = rr[0]
    urls = [m["source_url"]] + [s["source_url"] for s in m.get("media_details", {}).get("sizes", {}).values()]
    return m["id"], sorted(set(urls))


def in_libreria(adm, att):
    """La griglia della Libreria e dei selettori (admin-ajax, query-attachments):
    e' la strada che il filtro di bacheca.php sorveglia."""
    r = adm.post(ADMIN + "admin-ajax.php",
                 data={"action": "query-attachments", "query[posts_per_page]": 200, "query[post_mime_type]": "image"},
                 timeout=60)
    try:
        return att in [a["id"] for a in r.json().get("data", [])]
    except ValueError:
        return None


def guarda(adm, att, urls, titolo):
    """Dove si trova ancora l'immagine. Tutto False = non resta niente."""
    print(f"\n  -- {titolo}\n")
    r = adm.get(BASE + f"wp-json/wp/v2/media/{att}", params={"context": "edit"}, timeout=60)
    esiste = r.status_code == 200
    esito(f"l'allegato {att} non esiste piu'", not esiste,
          f"(esiste, genitore {r.json().get('post')!r})" if esiste else "")
    esito("non e' nella Libreria (griglia e selettori)", not in_libreria(adm, att))
    anon = requests.get(BASE + f"wp-json/wp/v2/media/{att}", timeout=60)
    esito("da anonimo, /wp/v2/media/<id> non lo mostra", anon.status_code != 200, f"({anon.status_code})")
    for u in urls:
        st = requests.get(u, timeout=60).status_code
        esito(f"file {u.rsplit('/', 1)[-1][:40]}... non c'e' piu'", st == 404, f"({st})")


def giro():
    adm = staging.collegata()
    staging.azzera_limiti(adm)
    print(f"\n  staging, plugin {adm.get(BASE + 'wp-json/frmm-lavagna/v1/limiti', timeout=30).json()['versione']}")

    r = staging.anonima().post(BASE + "wp-json/frmm-lavagna/v1/invio",
                               data={"client_id": str(uuid.uuid4()), "disegno": json.dumps(pi.disegno())},
                               files={"immagine": ("d.jpg", pi.jpeg(), "image/jpeg")}, timeout=120)
    pid = r.json()["id"]
    att, urls = allegato(adm, pid)
    print(f"  disegno {pid}, allegato {att}, {len(urls)} file (originale e miniature)")

    adm.get(link_riga(lista(adm, "pending"), pid, r"admin-post\.php\?action=frmm_rifiuta"), timeout=60)
    esito("rifiutato: e' nel cestino", f'id="post-{pid}"' in lista(adm, "trash"))
    adm.get(link_riga(lista(adm, "trash"), pid, rf"post\.php\?post={pid}&(?:amp;)?action=delete"), timeout=60)
    esito("eliminato definitivamente: non e' piu' nel cestino", f'id="post-{pid}"' not in lista(adm, "trash"))

    guarda(adm, att, urls, "dopo l'eliminazione, che cosa resta dell'immagine")


def svuota():
    """«Svuota cestino» dei disegni: il modulo vero, col suo nonce."""
    adm = staging.collegata()
    pagina = lista(adm, "trash")
    n = len(re.findall(r'<tr id="post-\d+"', pagina))
    tot = re.search(r"""class=['"]trash['"].*?<span class="count">\((\d+)\)</span>""", pagina, re.S)
    nonce = re.search(r'name="_wpnonce" value="([0-9a-f]+)"', pagina)
    if not nonce:
        sys.exit("  non trovo il nonce del modulo nella pagina del cestino")
    print(f"\n  nel cestino: {tot.group(1) if tot else n} disegni. Svuoto.")
    # Il redirect non si segue: senza un Referer, WordPress rimanda a una
    # pagina che rimanda a se stessa (26/09/2026, 30 redirect). Il lavoro e'
    # gia' fatto quando arriva il 302; lo si verifica rileggendo il cestino.
    r = adm.get(ADMIN + "edit.php", params={"post_type": "frmm_disegno", "post_status": "trash",
                                            "_wpnonce": nonce.group(1), "delete_all": "Svuota cestino"},
                timeout=300, allow_redirects=False)
    esito(f"«Svuota cestino» accettato ({r.status_code})", r.status_code in (200, 302))
    esito("il cestino dei disegni e' vuoto", not re.search(r'<tr id="post-\d+"', lista(adm, "trash")))
    orfani(adm)


def orfani(adm=None):
    """Gli allegati in uploads/frmm-lavagna/ senza disegno. Sola lettura."""
    adm = adm or staging.collegata()
    trovati, attaccati, pag = [], 0, 1
    while True:
        r = adm.get(BASE + "wp-json/wp/v2/media",
                    params={"per_page": 100, "page": pag, "context": "edit", "search": "Disegno del"}, timeout=60)
        if r.status_code != 200 or not r.json():
            break
        for m in r.json():
            if "/frmm-lavagna/" in m["source_url"]:
                if m["post"]:
                    attaccati += 1
                else:
                    trovati.append(m["id"])
        if pag >= int(r.headers.get("X-WP-TotalPages", 1)):
            break
        pag += 1
    esito(f"nessun allegato orfano ({attaccati} attaccati a un disegno)", not trovati, f"orfani: {trovati}")


if __name__ == "__main__":
    comando = sys.argv[1] if len(sys.argv) > 1 else "giro"
    {"giro": giro, "svuota": svuota, "orfani": orfani}[comando]()
    print(f"\n  {ok} passati, {ko} falliti")
    sys.exit(1 if ko else 0)
