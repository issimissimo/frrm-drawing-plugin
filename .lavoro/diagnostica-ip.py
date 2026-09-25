#!/usr/bin/env python3
"""
Quale IP vede PHP per chi manda un disegno? (passo 4 del piano, anti-abuso)

    python .lavoro/diagnostica-ip.py                # staging
    python .lavoro/diagnostica-ip.py --produzione   # il sito ufficiale

Il rate limit conta per IP, e la produzione sta dietro la CDN di SiteGround
mentre lo staging no. Se PHP, in produzione, vedesse l'indirizzo della CDN,
il limite varrebbe per tutti insieme. Questo script chiede al plugin (rotta
GET /limiti, solo amministratore, dalla 1.7.1) cosa vede, e lo confronta con
l'IP pubblico di questo PC.

Solo lettura: non scrive niente sul sito, non manda disegni. Per questo si
puo' lanciare anche in produzione.
"""

import json
import sys
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))
import staging  # noqa: E402

if "--produzione" in sys.argv:
    staging.usa_produzione()

# L'IP pubblico di questo PC, visto da fuori. api.ipify.org risponde solo in
# IPv4: il sito non ha record AAAA (misurato il 25/09/2026), quindi e' in
# IPv4 che ci arriva anche PHP.
mio = requests.get("https://api.ipify.org", timeout=20).text.strip()

s = staging.collegata()
r = s.get(staging.base() + "wp-json/frmm-lavagna/v1/limiti", timeout=30)
if r.status_code != 200:
    sys.exit(f"La rotta risponde {r.status_code}: il plugin e' almeno alla 1.7.1? {r.text[:200]}")
d = r.json()

print(f"sito          {'PRODUZIONE' if '--produzione' in sys.argv else 'staging'}, plugin {d['versione']}")
print(f"IP del PC     {mio}")
print(f"REMOTE_ADDR   {d['remote_addr']}")
print(f"inoltro       {json.dumps(d['inoltro'], ensure_ascii=False) if d['inoltro'] else '(nessuna intestazione)'}")
print(f"intestazioni  {', '.join(d['intestazioni'])}")
print(f"PHP           {d['php']}")
print()
if d["remote_addr"] != mio:
    dove = [k for k, v in d["inoltro"].items() if mio in v]
    print("ATTENZIONE: REMOTE_ADDR non e' l'IP del PC.")
    print("  L'IP del PC compare in: " + (", ".join(dove) if dove else "nessuna intestazione nota"))
    print("  Non scrivere il limite su REMOTE_ADDR. Vedi il sotto-piano del passo 4 in stato.md.")
    sys.exit(1)
print("OK: PHP vede l'IP vero di chi chiede.")

# Seconda domanda: chi manda puo' SCEGLIERSI l'IP? Se il server ricava
# REMOTE_ADDR da X-Forwarded-For prendendone il primo elemento — che scrive
# il client — basta un'intestazione per ricominciare da zero a ogni invio.
# 203.0.113.7 e' della documentazione (RFC 5737): non e' di nessuno.
FALSO = "203.0.113.7"
r = s.get(
    staging.base() + "wp-json/frmm-lavagna/v1/limiti",
    headers={"X-Forwarded-For": FALSO, "X-Real-IP": FALSO, "Forwarded": f"for={FALSO}"},
    timeout=30,
)
f = r.json()
print(f"con IP falso  REMOTE_ADDR {f['remote_addr']}, inoltro {json.dumps(f['inoltro'])}")
if f["remote_addr"] != mio:
    print("ATTENZIONE: un'intestazione falsa cambia REMOTE_ADDR. Il limite per IP si aggirerebbe.")
    sys.exit(1)
print("OK: un'intestazione falsa non cambia REMOTE_ADDR. Il limite puo' contare su REMOTE_ADDR, e solo su quello.")
