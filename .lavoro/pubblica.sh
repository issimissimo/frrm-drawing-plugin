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

# --ftp-ssl-control: TLS sul canale di CONTROLLO, dati in chiaro.
#
# Misurato il 18/09/2026, e la ragione e' nel traccia di curl:
#
#     * Remembering we are in dir ...
#     * SSL shutdown timeout          <- 10 secondi esatti
#
# Questo server manda il "close notify" ma non completa lo shutdown TLS del
# canale DATI, e curl aspetta 10 secondi a ogni trasferimento. Con 16 file
# erano ~3 minuti, scambiati due volte per lentezza della rete mentre la banda
# era 21 Mbit/s. Togliendo il TLS dal canale dati: da 11,3s a 0,98s per
# operazione.
#
# ⚠️ E' un downgrade deliberato, accettabile QUI e per una ragione precisa:
# sul canale dati passano solo file che stanno gia' in un repo PUBBLICO su
# GitHub, piu' i nomi dei file. Le credenziali viaggiano sul canale di
# controllo, che resta cifrato. Non copiare questa riga in uno script che
# carichi dati di clienti, database o qualunque cosa non sia gia' pubblica.
#
# Nota: --ssl-reqd ANNULLA --ftp-ssl-control (richiede TLS su tutto). I due
# non si mettono insieme: e' costato una misura sbagliata.
ftp_do() {
  curl -sS --ftp-ssl-control --user "$FTP_USER:$FTP_PASS" "$@"
}

# La cartella deve essere nuova: caricare sopra una consegna gia' fatta
# rimette in gioco la cache che la numerazione serve a evitare.
if ftp_do --list-only "ftp://$FTP_HOST:$FTP_PORT$DEST/" >/dev/null 2>&1; then
  echo "La cartella -$NN esiste gia'. Usa il numero successivo." >&2
  exit 1
fi

# TUTTI i file in UNA sola invocazione di curl, che riusa la connessione.
#
# Non e' micro-ottimizzazione: misurato il 18/09/2026, una connessione FTPS a
# SiteGround costa ~11 secondi, di cui 48 ms di TCP e il resto di attesa del
# server dopo il trasferimento (la sessione TLS sul canale dati non viene
# chiusa e curl aspetta il timeout). Con una connessione per file erano ~3
# minuti per 16 file, ed e' stato scambiato due volte per lentezza della rete
# quando la banda era 21 Mbit/s. Aprire una volta sola e' l'unica cura.
#
# --fail-early: senza, un file che fallisce a meta' lascerebbe una cartella
# incompleta e lo script direbbe comunque di si'.
args=()
push() { args+=( -T "$1" "ftp://$FTP_HOST:$FTP_PORT$2" ); }

push "$LOCAL/index.html" "$DEST/index.html"
for f in "$LOCAL"/src/*.js; do
  push "$f" "$DEST/src/$(basename "$f")"
done
# I font non sono nel repo (di terzi, repo pubblico) ma servono online, e
# dagli URL della Fondazione non si possono linkare: manca il CORS.
if compgen -G "$LOCAL/font/*.woff2" >/dev/null; then
  for f in "$LOCAL"/font/*.woff2; do push "$f" "$DEST/font/$(basename "$f")"; done
else
  echo "  !!  font/ vuota: online si vedra' il fallback. Vedi prototipo/README.md" >&2
fi

ftp_do --ftp-create-dirs --fail-early \
       -w '  ok  %{url_effective}  (%{size_upload} byte)\n' \
       "${args[@]}"

# Anche i tre listing in una sola connessione, per lo stesso motivo.
echo
echo "--- listing di controllo: $DEST ---"
ftp_do "ftp://$FTP_HOST:$FTP_PORT$DEST/" \
       "ftp://$FTP_HOST:$FTP_PORT$DEST/src/" \
       "ftp://$FTP_HOST:$FTP_PORT$DEST/font/"
echo
echo "https://issimissimo.com/temp/frmm-drawing-plugin-$NN/"
