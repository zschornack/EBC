#!/bin/bash
# PUBLICAÇÃO NA CLOUDFLARE
# Copia para a pasta "dist" só os arquivos que devem ficar públicos no site.
# Assim o PDF de lançamento, o script da planilha e outros arquivos internos não ficam acessíveis.
# (O backend — worker/index.js + functions/api/lead.js — é empacotado pelo "wrangler deploy".)
set -e
rm -rf dist
mkdir dist
cp index.html styles.css script.js favicon.ico dist/
cp -r img dist/
find dist -name ".DS_Store" -delete
echo "Arquivos publicados:"
find dist -type f | sort
