#!/bin/bash
# Carica UN SOLO file come index.html in /temp/frmm-drawing-plugin-<NN>/.
#
#   bash .lavoro/pubblica-file.sh 15 .lavoro/prova-ospite/index.html
#
# Gemello di pubblica.sh, che carica sempre l'intero prototipo. Serve alle
# pagine di prova che stanno in piedi da sole e puntano a una versione gia'
# online: caricare 17 file per provarne uno e' spreco, e la copia in piu'
# diverge il giorno che si corregge l'originale.
#
# Stesse precauzioni dell'altro, e per le stesse ragioni (vedi i commenti
# lunghi in pubblica.sh): cartella nuova obbligatoria, TLS sul solo canale di
# controllo, credenziali lette qui dentro e mai stampate.
set -euo pipefail

NN="${1:-}"
SRC="${2:-}"
[[ "$NN" =~ ^[0-9]{2}$ ]] || { echo "Uso: $0 <NN> <file>   (NN a due cifre)" >&2; exit 1; }
[[ -f "$SRC" ]] || { echo "File non trovato: $SRC" >&2; exit 1; }

DEST="/issimissimo.com/public_html/temp/frmm-drawing-plugin-$NN"

set -a; source ~/.claude/.secrets/ftp-siteground.env; set +a

# --ftp-ssl-control: TLS sul canale di CONTROLLO, dati in chiaro. E' un
# downgrade deliberato, misurato il 18/09/2026: senza, il server non chiude lo
# shutdown TLS del canale dati e curl aspetta 10s a ogni trasferimento.
# Accettabile solo perche' qui passa materiale gia' pubblico. Non copiare
# questa riga altrove. --ssl-reqd la ANNULLA: non si mettono insieme.
ftp_do() {
  curl -sS --ftp-ssl-control --user "$FTP_USER:$FTP_PASS" "$@"
}

if ftp_do --list-only "ftp://$FTP_HOST:$FTP_PORT$DEST/" >/dev/null 2>&1; then
  echo "La cartella -$NN esiste gia'. Usa il numero successivo." >&2
  exit 1
fi

ftp_do --ftp-create-dirs --fail-early \
       -w '  ok  %{url_effective}  (%{size_upload} byte)\n' \
       -T "$SRC" "ftp://$FTP_HOST:$FTP_PORT$DEST/index.html"

echo
echo "--- listing di controllo: $DEST ---"
ftp_do "ftp://$FTP_HOST:$FTP_PORT$DEST/"
echo
echo "https://issimissimo.com/temp/frmm-drawing-plugin-$NN/"
