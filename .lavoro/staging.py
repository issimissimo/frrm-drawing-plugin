"""
Accesso allo STAGING della Fondazione, in comune fra gli script di .lavoro/.

Le credenziali si leggono da ~/.claude/.secrets/ e non si stampano mai.
Questo file sta in un repo PUBBLICO: nessun segreto va scritto qui.

⚠️ SOLO STAGING: se l'URL nelle credenziali non contiene "staging", ci si
ferma. Il sito di produzione non si tocca da questi script.
"""

import html
import re
import sys
from pathlib import Path

import requests

SEGRETI = Path.home() / ".claude" / ".secrets" / "wp-staging-fondazione.env"


def credenziali():
    env = {}
    for riga in SEGRETI.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^\s*([A-Z_]+)\s*=\s*'?([^'\n]*)'?\s*$", riga)
        if m:
            env[m.group(1)] = m.group(2)
    admin = env["WP_STAGING_URL"].rstrip("/") + "/"
    if "staging" not in admin:
        sys.exit("L'URL nelle credenziali non e' uno staging: mi fermo.")
    return admin, env["WP_STAGING_USER"], env["WP_STAGING_PASS"]


def base():
    """L'URL del sito, senza wp-admin/."""
    return credenziali()[0][: -len("wp-admin/")]


def anonima():
    s = requests.Session()
    s.headers["User-Agent"] = "frmm-lavagna script di prova"
    return s


def collegata():
    """Una sessione da amministratore, col nonce per la REST API."""
    admin, utente, password = credenziali()
    b = admin[: -len("wp-admin/")]
    s = anonima()
    # Il login di WordPress vuole il cookie di prova gia' presente.
    s.get(b + "wp-login.php", timeout=30)
    r = s.post(
        b + "wp-login.php",
        data={"log": utente, "pwd": password, "wp-submit": "Log In", "redirect_to": admin, "testcookie": "1"},
        timeout=30,
    )
    if not any(c.name.startswith("wordpress_logged_in") for c in s.cookies):
        err = re.search(r'id="login_error"[^>]*>(.*?)</div>', r.text, re.S)
        sys.exit("Login fallito: " + (testo(err.group(1)) if err else f"HTTP {r.status_code}, nessun cookie"))
    # Il nonce REST: senza, per la REST API il cookie non vale e si e' anonimi.
    n = re.search(r'wpApiSettings\s*=\s*\{[^}]*"nonce":"([0-9a-f]+)"', r.text)
    if not n:
        r = s.get(admin + "admin-ajax.php?action=rest-nonce", timeout=30)
        s.headers["X-WP-Nonce"] = r.text.strip()
    else:
        s.headers["X-WP-Nonce"] = n.group(1)
    return s


def testo(pagina):
    """Il testo del riquadro principale della bacheca, senza HTML."""
    m = re.search(r'<div class="wrap">(.*?)</div>\s*<div class="clear">', pagina, re.S)
    t = re.sub(r"<[^>]+>", " ", m.group(1) if m else pagina)
    return re.sub(r"\s+", " ", html.unescape(t)).strip()
