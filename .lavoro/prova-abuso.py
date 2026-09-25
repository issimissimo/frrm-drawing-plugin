#!/usr/bin/env python3
"""
Lo script di abuso del passo 4: il rate limit, sullo STAGING (plugin 1.8.0+).

    python .lavoro/prova-abuso.py            # il giro; lascia l'IP di QUESTO PC al limite
    python .lavoro/prova-abuso.py raffica    # solo la raffica oltre il limite (3 disegni, non 20)
    python .lavoro/prova-abuso.py azzera     # azzera i contatori e prova che un invio ripassa
    python .lavoro/prova-abuso.py pulisci    # rifiuta (cestino) i disegni lasciati dai giri

Il giro lascia l'IP del PC al limite APPOSTA: e' il momento di provare dal
telefono che un disegno passa lo stesso. In 4G, NON in wifi: in wifi il
telefono esce su internet con lo stesso IP del PC, e verrebbe respinto per
la ragione giusta dando l'impressione sbagliata. E' la prova che il limite e'
per IP e non uno solo per tutti.

Costi, dichiarati:

- A ogni giro 20 disegni veri in bacheca e 20 email all'admin_email dello
  staging (uno e una in piu' con "azzera"). Non si evitano: per vedere
  respinto il 21° bisogna farne passare 20.
- 100 invii in fila, non 500 come diceva il piano. SiteGround ha un anti-bot
  che blocca gli IP che martellano, e rischiare di chiudere fuori dai propri
  siti il PC da cui si lavora, per provare 400 volte la stessa riga di
  codice, non vale: dal 21° in poi ogni invio passa per lo stesso controllo.
- L'IP del PC di Daniele CAMBIA, anche a meta' di una prova (25/09/2026:
  109.118.72.129 -> 109.118.64.235 durante la raffica, con la connessione
  caduta). Per questo la raffica usa il limite del DISPOSITIVO, che dall'IP
  non dipende, e una connessione che cade si conta invece di fermare tutto.
- I file in uploads/frmm-lavagna/ non si contano: si potrebbe solo via FTP
  sul sito della Fondazione, fuori dalla cartella del progetto. Si contano i
  disegni in bacheca: invio.php scrive file e post insieme o niente, e il 429
  esce prima di qualunque scrittura.
"""

import importlib.util
import json
import random
import re
import sys
import time
import uuid
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))
import staging  # noqa: E402

# disegno(), jpeg() e in_attesa() sono quelli di prova-invio.py: stessa forma
# di un invio vero, e un solo posto dove cambiarla.
_spec = importlib.util.spec_from_file_location("prova_invio", Path(__file__).with_name("prova-invio.py"))
pi = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(pi)

URL = staging.base() + "wp-json/frmm-lavagna/v1/invio"
LIMITI = staging.base() + "wp-json/frmm-lavagna/v1/limiti"
TRACCIA = Path(__file__).resolve().parent / "dist" / "prova-abuso.json"

TOTALE = 100          # invii in tutto nel giro, compresi i 20 che passano
LIMITE_DISPOSITIVO = 3
LIMITE_IP = 20

ok = 0
ko = 0
creati = []


def esito(nome, buono, dettaglio=""):
    global ok, ko
    if buono:
        ok += 1
        print(f"  ok  {nome}")
    else:
        ko += 1
        print(f"  KO  {nome}  {dettaglio}")


BUONO = json.dumps(pi.disegno())
IMG = pi.jpeg()


def invia(cid, invio_id=None, disegno=BUONO, immagine=IMG, nomefile="disegno.jpg", sessione=None):
    campi = {"client_id": cid, "disegno": disegno}
    if invio_id:
        campi["invio_id"] = invio_id
    r = (sessione or staging.anonima()).post(
        URL, data=campi, files={"immagine": (nomefile, immagine, "image/jpeg")}, timeout=300)
    try:
        corpo = r.json()
    except ValueError:
        corpo = {"code": f"(non JSON: {r.text[:60]!r})"}
    if r.status_code == 201:
        creati.append(corpo["id"])
    return r.status_code, corpo.get("code") if isinstance(corpo, dict) else None, corpo


def atteso(nome, status, codice, risposta):
    st, cod, corpo = risposta
    esito(f"{nome:58s} -> {st} {cod or ''}", st == status and (codice is None or cod == codice),
          f"(atteso {status} {codice or ''}; {json.dumps(corpo)[:140]})")
    return risposta


def contatore_ip(adm):
    c = adm.get(LIMITI, timeout=30).json()["contatore_ip"]
    return c["n"] if c else None


def salva_traccia():
    TRACCIA.parent.mkdir(exist_ok=True)
    vecchi = json.loads(TRACCIA.read_text()) if TRACCIA.exists() else []
    TRACCIA.write_text(json.dumps(sorted(set(vecchi + creati))))


def giro():
    adm = staging.collegata()
    gen = staging.azzera_limiti(adm)
    prima = pi.in_attesa(adm)
    print(f"\n  {URL}\n  contatori azzerati (generazione {gen}), in attesa prima: {prima}\n")

    print("  -- 1. i respinti non consumano il limite\n")
    cid = str(uuid.uuid4())
    atteso("JSON rotto", 400, "frmm_disegno", invia(cid, disegno=BUONO[:-40]))
    atteso("non un'immagine (PHP con estensione .jpg)", 415, "frmm_immagine_tipo",
           invia(cid, immagine=b"<?php phpinfo(); ?>", nomefile="x.jpg"))
    t = time.time()
    st, cod, _ = invia(cid, immagine=b"\xff\xd8\xff" + random.randbytes(50 * 1024 * 1024))
    esito(f"{'50 MB':58s} -> {st} {cod or ''}  ({time.time() - t:.0f} s)", st == 413)
    esito("contatore dell'IP ancora a 0", contatore_ip(adm) == 0, f"({contatore_ip(adm)})")

    print(f"\n  -- 2. un dispositivo: {LIMITE_DISPOSITIVO} passano, il successivo no\n")
    a = str(uuid.uuid4())
    ultimo = None
    for i in range(LIMITE_DISPOSITIVO):
        ultimo = str(uuid.uuid4())
        atteso(f"stesso dispositivo, invio {i + 1}", 201, None, invia(a, ultimo))
    atteso(f"stesso dispositivo, invio {LIMITE_DISPOSITIVO + 1}", 429, "frmm_troppi", invia(a, str(uuid.uuid4())))
    st, cod, corpo = atteso("ripresa dell'ultimo arrivato, a limite superato", 200, None, invia(a, ultimo))
    esito("  ... ed e' un doppione, non un disegno nuovo", corpo.get("doppio") is True, json.dumps(corpo))
    esito(f"contatore dell'IP a {LIMITE_DISPOSITIVO}", contatore_ip(adm) == LIMITE_DISPOSITIVO,
          f"({contatore_ip(adm)})")

    print(f"\n  -- 3. una rete: {LIMITE_IP} passano, il successivo no\n")
    passati = LIMITE_DISPOSITIVO
    while passati < LIMITE_IP:
        st, cod, corpo = invia(str(uuid.uuid4()))
        if st != 201:
            esito(f"dispositivo nuovo, invio {passati + 1} dall'IP", False, f"-> {st} {cod}")
            break
        passati += 1
    esito(f"dispositivi nuovi: passano fino a {LIMITE_IP} dall'IP", passati == LIMITE_IP, f"({passati})")
    atteso(f"dispositivo nuovo, invio {LIMITE_IP + 1} dall'IP", 429, "frmm_troppi", invia(str(uuid.uuid4())))
    atteso("oltre il limite anche un invio rotto e' 429 (il limite viene prima)", 429, "frmm_troppi",
           invia(str(uuid.uuid4()), disegno=BUONO[:-40]))
    esito(f"contatore dell'IP a {LIMITE_IP}", contatore_ip(adm) == LIMITE_IP, f"({contatore_ip(adm)})")

    fatti = 3 + LIMITE_DISPOSITIVO + 2 + (LIMITE_IP - LIMITE_DISPOSITIVO) + 2
    print(f"\n  -- 4. altri {TOTALE - fatti} invii di fila, tutti oltre il limite\n")
    scarica(a, TOTALE - fatti)
    dopo = pi.in_attesa(adm)
    esito(f"in bacheca {LIMITE_IP} disegni in piu', non uno di piu' ({prima} -> {dopo})", dopo - prima == LIMITE_IP)
    esito(f"creati in tutto: {len(creati)}", len(creati) == LIMITE_IP)

    salva_traccia()
    print(f"\n  L'IP di questo PC e' al limite per 24 ore (o fino a «prova-abuso.py azzera»).")
    print("  ADESSO la prova dal telefono, in 4G e non in wifi: sulla pagina di prova dello staging,")
    print("  SALVA -> SALVA E INVIA. Il disegno deve arrivare in bacheca (e con lui la sua email).")


def scarica(cid, quanti):
    """La raffica: `quanti` invii validi da un dispositivo gia' al limite.
    Una sessione sola (keep-alive): un ciclo con curl aprirebbe una
    connessione a invio, ma non e' quello che si prova qui."""
    s = staging.anonima()
    t = time.time()
    esiti = {}
    for _ in range(quanti):
        try:
            st, _, _ = invia(cid, str(uuid.uuid4()), sessione=s)
        except requests.exceptions.RequestException as e:
            st = f"rete ({type(e).__name__})"
            time.sleep(5)
            s = staging.anonima()
        esiti[st] = esiti.get(st, 0) + 1
    ms = (time.time() - t) / quanti * 1000
    esito(f"{quanti} invii: tutti 429  ({ms:.0f} ms l'uno, invio del corpo compreso)", esiti == {429: quanti}, esiti)


def raffica():
    """Solo la fase 4, per rifarla senza altri 20 disegni: un dispositivo
    portato al suo limite (3 disegni), poi la raffica."""
    adm = staging.collegata()
    gen = staging.azzera_limiti(adm)
    prima = pi.in_attesa(adm)
    ip = requests.get("https://api.ipify.org", timeout=20).text
    print(f"\n  contatori azzerati (generazione {gen}), in attesa prima: {prima}, IP {ip}\n")
    a = str(uuid.uuid4())
    for i in range(LIMITE_DISPOSITIVO):
        atteso(f"stesso dispositivo, invio {i + 1}", 201, None, invia(a, str(uuid.uuid4())))
    scarica(a, TOTALE - LIMITE_DISPOSITIVO)
    dopo = pi.in_attesa(adm)
    esito(f"in bacheca {LIMITE_DISPOSITIVO} disegni in piu', non uno di piu' ({prima} -> {dopo})",
          dopo - prima == LIMITE_DISPOSITIVO)
    ip2 = requests.get("https://api.ipify.org", timeout=20).text
    if ip2 != ip:
        print(f"  (l'IP del PC e' cambiato durante la prova: {ip} -> {ip2})")
    salva_traccia()


def azzera():
    adm = staging.collegata()
    gen = staging.azzera_limiti(adm)
    print(f"\n  contatori azzerati (generazione {gen})\n")
    atteso("dopo l'azzeramento un invio passa", 201, None, invia(str(uuid.uuid4())))
    esito("contatore dell'IP a 1", contatore_ip(adm) == 1, f"({contatore_ip(adm)})")
    salva_traccia()


def pulisci():
    """Rifiuta (cestino) i disegni dei giri. Si prende il link Rifiuta vero
    della riga, col suo nonce; la lista e' paginata, quindi si ricarica dopo
    ogni rifiuto finche' non ne resta nessuno."""
    import html
    adm = staging.collegata()
    ids = set(json.loads(TRACCIA.read_text())) if TRACCIA.exists() else set()
    fatti = 0
    for _ in range(len(ids) + 1):
        pagina = adm.get(staging.credenziali()[0] + "edit.php",
                         params={"post_type": "frmm_disegno", "post_status": "pending"}, timeout=60).text
        visti = [int(p) for p in re.findall(r'<tr id="post-(\d+)"', pagina) if int(p) in ids]
        if not visti:
            break
        riga = re.search(rf'<tr id="post-{visti[0]}".*?</tr>', pagina, re.S).group(0)
        u = html.unescape(re.search(r'href="([^"]*admin-post\.php\?action=frmm_rifiuta[^"]*)"', riga).group(1))
        adm.get(u, timeout=60)
        ids.discard(visti[0])
        fatti += 1
    TRACCIA.write_text(json.dumps(sorted(ids)))
    print(f"\n  rifiutati {fatti} disegni di prova; ne restano {len(ids)} non trovati fra quelli in attesa")


if __name__ == "__main__":
    comando = sys.argv[1] if len(sys.argv) > 1 else "giro"
    {"giro": giro, "raffica": raffica, "azzera": azzera, "pulisci": pulisci}[comando]()
    if comando != "pulisci":
        print(f"\n  {ok} passati, {ko} falliti")
        sys.exit(1 if ko else 0)
