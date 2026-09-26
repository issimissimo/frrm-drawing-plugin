#!/usr/bin/env python3
"""
Approva / Rifiuta dalla mail (plugin 1.10.0+), sullo STAGING.

    python .lavoro/prova-mail.py

Imposta il destinatario delle notifiche dello staging all'indirizzo di prova
(Impostazioni > Generali > Notifiche dei disegni, via REST), manda due
disegni, e con i loro link fa quel che farebbero uno scanner di posta, un
furbo e il cliente:

  1. apre i link senza premere niente: NIENTE deve cambiare;
  2. manomette firma, id e scadenza: 403 e niente cambia;
  3. approva il primo e rifiuta il secondo, come il cliente;
  4. riprova su disegni gia' moderati: la pagina lo dice e non fa niente.

Lo script la posta non la legge: i link glieli da' GET /link-mail (solo
amministratore), costruiti dalla stessa funzione che li mette nella mail.
Le due mail vere arrivano comunque all'indirizzo di prova: sono la prova
dal telefono che resta da fare a mano.

Alla fine il disegno approvato si toglie (Rifiuta dalla bacheca), per non
lasciarlo nella striscia di /playground/.
"""

import html
import json
import re
import sys
import uuid
import importlib.util
from pathlib import Path
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))
import staging  # noqa: E402

_spec = importlib.util.spec_from_file_location("prova_invio", Path(__file__).with_name("prova-invio.py"))
pi = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(pi)

BASE = staging.base()
SAFARI = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
          "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")
DESTINATARIO = "danielesuppo@gmail.com"   # indirizzo di prova, scelto da Daniele il 26/09/2026

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


def info(adm, pid):
    return adm.get(BASE + "wp-json/frmm-lavagna/v1/link-mail", params={"disegno": pid}, timeout=30).json()


def invia():
    r = staging.anonima().post(BASE + "wp-json/frmm-lavagna/v1/invio",
                               data={"client_id": str(uuid.uuid4()), "disegno": json.dumps(pi.disegno())},
                               files={"immagine": ("d.jpg", pi.jpeg(), "image/jpeg")}, timeout=120)
    return r.json()["id"]


def ritocca(url, **campi):
    """Lo stesso link con qualche parametro cambiato."""
    u = urlparse(url)
    q = {k: v[0] for k, v in parse_qs(u.query).items()}
    q.update({k: str(v) for k, v in campi.items()})
    return urlunparse(u._replace(query=urlencode(q)))


def main():
    adm = staging.collegata()
    staging.azzera_limiti(adm)
    r = adm.post(BASE + "wp-json/wp/v2/settings", json={"frmm_lavagna_destinatario": DESTINATARIO}, timeout=30)
    esito(f"destinatario delle notifiche impostato a {DESTINATARIO}",
          r.status_code == 200 and r.json().get("frmm_lavagna_destinatario") == DESTINATARIO, r.text[:120])

    a, b = invia(), invia()
    ia, ib = info(adm, a), info(adm, b)
    esito("la mail parte per l'indirizzo impostato", ia["destinatario"] == DESTINATARIO, ia["destinatario"])
    print(f"\n  disegni {a} e {b}, in attesa\n\n  -- 1. aprire i link non cambia niente (lo scanner di posta)\n")

    # Un browser vero, non la libreria: il firewall di SiteGround risponde
    # 403 a /wp-admin/ quando lo user agent e' "python-requests" (misurato il
    # 26/09/2026), e la pagina sta sotto /wp-admin/admin-post.php.
    anon = requests.Session()
    anon.headers["User-Agent"] = SAFARI
    for nome, url in (("Approva", ia["approva"]), ("Rifiuta", ia["rifiuta"])):
        p = anon.get(url, timeout=60)
        esito(f"il tasto {nome} apre la pagina (200)", p.status_code == 200, p.status_code)
        esito(f"  ... col disegno e i due pulsanti", "<img" in p.text
              and 'value="approva"' in p.text and 'value="rifiuta"' in p.text)
        primo = re.search(r'<button[^>]*value="(\w+)"', p.text)
        esito(f"  ... con {nome} per primo e pieno",
              primo and primo.group(1) == nome.lower() and f'class="{nome.lower()} pieno"' in p.text)
        esito(f"  ... non indicizzabile e senza referrer",
              "noindex" in p.headers.get("X-Robots-Tag", "") and p.headers.get("Referrer-Policy") == "no-referrer")
    anon.head(ia["approva"], timeout=60)
    esito("dopo GET e HEAD su tutti e due i link, il disegno e' ancora in attesa", info(adm, a)["stato"] == "pending")

    print("\n  -- 2. i link manomessi non fanno niente\n")
    firma = parse_qs(urlparse(ia["approva"]).query)["f"][0]
    for nome, url in (
        ("firma cambiata di un carattere", ritocca(ia["approva"], f=firma[:-1] + ("0" if firma[-1] != "0" else "1"))),
        ("la firma del disegno A sul disegno B", ritocca(ia["approva"], d=b)),
        ("scadenza allungata di un giorno", ritocca(ia["approva"], s=int(parse_qs(urlparse(ia["approva"]).query)["s"][0]) + 86400)),
        ("senza firma", ritocca(ia["approva"], f="")),
    ):
        p = anon.post(url, data={"azione": "approva"}, timeout=60)
        esito(f"{nome}: 403, e dice che il link non e' valido", p.status_code == 403 and "non è valido" in p.text, p.status_code)
    esito("il disegno A e' ancora in attesa", info(adm, a)["stato"] == "pending")
    esito("il disegno B e' ancora in attesa", info(adm, b)["stato"] == "pending")

    print("\n  -- 3. approvare e rifiutare, come il cliente\n")
    p = anon.post(ia["approva"], data={"azione": "approva"}, timeout=60)
    esito("A: conferma Approva -> 'approvato'", p.status_code == 200 and "è approvato" in p.text)
    x = info(adm, a)
    esito("A e' pubblicato", x["stato"] == "publish", x["stato"])
    esito("A registra 'via email'", x["moderato_via"] == "email", x["moderato_via"])
    esito("A ha la data di approvazione (la galleria lo ordina con quella)", bool(x["approvato_il"]))
    p = anon.post(ib["rifiuta"], data={"azione": "rifiuta"}, timeout=60)
    esito("B: conferma Rifiuta -> 'rifiutato'", p.status_code == 200 and "è rifiutato" in p.text)
    y = info(adm, b)
    esito("B e' nel cestino", y["stato"] == "trash", y["stato"])
    esito("B registra 'via email'", y["moderato_via"] == "email", y["moderato_via"])

    print("\n  -- 4. un disegno gia' moderato non si ri-modera\n")
    p = anon.post(ia["rifiuta"], data={"azione": "rifiuta"}, timeout=60)
    esito("A approvato, Rifiuta dal link: dice 'gia' approvato'", "già stato approvato" in p.text)
    esito("  ... e resta pubblicato", info(adm, a)["stato"] == "publish")
    p = anon.post(ib["approva"], data={"azione": "approva"}, timeout=60)
    esito("B rifiutato, Approva dal link: dice 'gia' rifiutato'", "già stato rifiutato" in p.text)
    esito("  ... e resta nel cestino", info(adm, b)["stato"] == "trash")
    p = anon.get(ia["approva"], timeout=60)
    esito("riaprire il link di A: nessun pulsante", 'name="azione"' not in p.text)
    p = adm.get(ib["rifiuta"], timeout=60)
    esito("aperto da chi e' collegato a WordPress, il link funziona uguale", p.status_code == 200 and "già stato rifiutato" in p.text,
          p.status_code)

    # Via A dalla striscia di /playground/: «Rifiuta» dalla bacheca, riga dei pubblicati.
    pagina = adm.get(staging.credenziali()[0] + "edit.php",
                     params={"post_type": "frmm_disegno", "post_status": "publish"}, timeout=60).text
    riga = re.search(rf'<tr id="post-{a}".*?</tr>', pagina, re.S)
    m = riga and re.search(r'href="([^"]*admin-post\.php\?action=frmm_rifiuta[^"]*)"', riga.group(0))
    if m:
        u = html.unescape(m.group(1))
        adm.get(u if u.startswith("http") else staging.credenziali()[0] + u.lstrip("/"), timeout=60)
    esito(f"pulizia: A tolto dalla galleria", info(adm, a)["stato"] == "trash")

    print(f"\n  Le mail vere dei disegni {a} e {b} sono andate a {DESTINATARIO}.")


if __name__ == "__main__":
    main()
    print(f"\n  {ok} passati, {ko} falliti")
    sys.exit(1 if ko else 0)
