#!/usr/bin/env python3
"""
Prova la moderazione in bacheca sullo STAGING (passo 3 del piano).

    python .lavoro/prova-bacheca.py

Usa i link veri della pagina, come farebbe chi modera: prende il primo
disegno in attesa e lo approva, prende il secondo e lo rifiuta. Poi guarda:

  - il numero nel menu scende di due;
  - l'approvato e' pubblicato, il rifiutato e' nel cestino;
  - la Libreria media (la stessa chiamata della griglia e dei selettori di
    immagini) non mostra i disegni in attesa ne' il rifiutato, e mostra
    l'approvato — che e' quello che la galleria dovra' poter prendere (D3).

⚠️ Consuma due disegni in attesa a ogni giro: prima, se servono, si
generano con prova-invio.py.

Salva anche l'HTML dell'elenco in .playwright-mcp/bacheca.html, per
guardarlo in un browser senza doversi collegare.
"""

import html
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import staging  # noqa: E402

ok = ko = 0


def esito(nome, buono, dettaglio=""):
    global ok, ko
    ok, ko = (ok + 1, ko) if buono else (ok, ko + 1)
    print(f"  {'ok' if buono else 'KO'}  {nome}{'' if buono else '  ' + str(dettaglio)}")


def numero_menu(pagina):
    # L'href del menu WordPress lo scrive con le virgolette singole.
    m = re.search(r"""post_type=frmm_disegno['"][^>]*>.*?<span class="pending-count">(\d+)</span>""", pagina, re.S)
    return int(m.group(1)) if m else 0


def libreria(adm, admin):
    """Gli id degli allegati che la griglia della Libreria mostrerebbe."""
    r = adm.post(admin + "admin-ajax.php", data={
        "action": "query-attachments",
        "query[post_mime_type]": "image",
        "query[posts_per_page]": "400",
        "query[orderby]": "date", "query[order]": "DESC",
    }, timeout=60)
    return {a["id"] for a in r.json().get("data", [])} if r.ok else set()


def main():
    admin = staging.credenziali()[0]
    adm = staging.collegata()
    lista = admin + "edit.php?post_type=frmm_disegno"

    r = adm.get(lista + "&post_status=pending", timeout=30)
    pagina = r.text
    Path(__file__).resolve().parent.parent.joinpath(".playwright-mcp", "bacheca.html").write_text(pagina, encoding="utf-8")

    esito("colonna Disegno con la miniatura", 'class="frmm-mini"' in pagina)
    esito("colonna Tentativo", "column-frmm_tentativo" in pagina)
    esito("niente 'Aggiungi nuovo'", "post-new.php?post_type=frmm_disegno" not in pagina)
    prima = numero_menu(pagina)
    esito(f"numero nel menu ({prima})", prima >= 2, "servono almeno due disegni in attesa")

    righe = re.findall(r'<tr id="post-(\d+)".*?</tr>', pagina, re.S)
    link = {pid: [html.unescape(u) for u in re.findall(r'href="([^"]*admin-post\.php\?action=frmm_(?:approva|rifiuta)[^"]*)"',
                                                           re.search(rf'<tr id="post-{pid}".*?</tr>', pagina, re.S).group(0))]
            for pid in righe}
    if len(righe) < 2:
        sys.exit("  Servono almeno due disegni in attesa: python .lavoro/prova-invio.py")
    a, b = righe[0], righe[1]
    esito("ogni riga ha Approva e Rifiuta", all(len(v) == 2 for v in link.values()), link)

    att = {}
    for pid in (a, b):
        rr = adm.get(staging.base() + "wp-json/wp/v2/media", params={"parent": pid, "context": "edit"}, timeout=30).json()
        att[pid] = rr[0]["id"] if rr else None
    visti = libreria(adm, admin)
    esito("in attesa: fuori dalla Libreria", att[a] not in visti and att[b] not in visti, f"{att} / {len(visti)} visti")

    # Un click per disegno, sul link vero.
    ra = adm.get(next(u for u in link[a] if "frmm_approva" in u), headers={"Referer": lista}, timeout=30)
    rb = adm.get(next(u for u in link[b] if "frmm_rifiuta" in u), headers={"Referer": lista}, timeout=30)
    esito("Approva risponde con l'avviso", "disegno approvato" in ra.text, ra.url)
    esito("Rifiuta risponde con l'avviso", "disegno rifiutato" in rb.text, rb.url)

    dopo = numero_menu(adm.get(lista, timeout=30).text)
    esito(f"il numero nel menu scende di due ({prima} -> {dopo})", dopo == prima - 2)

    stati = {}
    for pid in (a, b):
        pg = adm.get(lista + "&post_status=all", timeout=30).text
        stati[pid] = "publish" if re.search(rf'<tr id="post-{pid}"[^>]*status-publish', pg) else None
    tr = adm.get(lista + "&post_status=trash", timeout=30).text
    esito("l'approvato e' pubblicato", stati[a] == "publish")
    esito("il rifiutato e' nel cestino", f'id="post-{b}"' in tr)

    visti = libreria(adm, admin)
    esito("l'approvato compare nella Libreria", att[a] in visti)
    esito("il rifiutato resta fuori dalla Libreria", att[b] not in visti)

    # Da anonimo, l'approvato non ha comunque una pagina: il CPT non e'
    # pubblico, e pubblicato vuol dire solo "la galleria lo puo' prendere".
    r = staging.anonima().get(staging.base(), params={"p": a, "post_type": "frmm_disegno"}, allow_redirects=False, timeout=30)
    esito("l'approvato non ha una pagina pubblica", r.status_code == 404, r.status_code)

    print(f"\n  {ok} passati, {ko} falliti\n")
    sys.exit(1 if ko else 0)


if __name__ == "__main__":
    main()
