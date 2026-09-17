#!/bin/bash
# Carica il prototipo in /temp/frmm-drawing-plugin-<NN>/ sull'FTP SiteGround.
#
#   bash .lavoro/pubblica.sh 02
#
# Il numero e' obbligatorio e serve a una cosa sola: dare al cliente un URL
# che nessuna cache ha mai visto. Vedi CLAUDE.md, sezione Pubblicazione.
#
# Le credenziali si leggono qui dentro e non si stampano mai. Aprono l'intero
# account SiteGround: per questo il percorso remoto non e' un parametro.
set -euo pipefail

NN="${1:-}"
[[ "$NN" =~ ^[0-9]{2}$ ]] || { echo "Uso: $0 <NN>   (due cifre, es. 02)" >&2; exit 1; }

LOCAL="$(cd "$(dirname "${BASH_SOURCE[0]}")/../prototipo" && pwd)"
DEST="/issimissimo.com/public_html/temp/frmm-drawing-plugin-$NN"

set -a; source ~/.claude/.secrets/ftp-siteground.env; set +a

ftp_do() {
  curl -sS --ssl-reqd --ftp-ssl --user "$FTP_USER:$FTP_PASS" "$@"
}

# La cartella deve essere nuova: caricare sopra una consegna gia' fatta
# rimette in gioco la cache che la numerazione serve a evitare.
if ftp_do --list-only "ftp://$FTP_HOST:$FTP_PORT$DEST/" >/dev/null 2>&1; then
  echo "La cartella -$NN esiste gia'. Usa il numero successivo." >&2
  exit 1
fi

up() {
  ftp_do --ftp-create-dirs -T "$1" "ftp://$FTP_HOST:$FTP_PORT$2"
  printf '  ok  %s  (%s byte)\n' "$2" "$(wc -c <"$1")"
}

up "$LOCAL/index.html" "$DEST/index.html"
for f in "$LOCAL"/src/*.js; do
  up "$f" "$DEST/src/$(basename "$f")"
done

echo
echo "--- $DEST ---";     ftp_do "ftp://$FTP_HOST:$FTP_PORT$DEST/"
echo "--- $DEST/src ---"; ftp_do "ftp://$FTP_HOST:$FTP_PORT$DEST/src/"
echo
echo "https://issimissimo.com/temp/frmm-drawing-plugin-$NN/"
