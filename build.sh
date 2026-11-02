#!/bin/bash
# PUBLICAÇÃO NA CLOUDFLARE
# Copia para a pasta "dist" só os arquivos que devem ficar públicos no site.
# Assim o PDF de lançamento, o script da planilha, o gabarito do nivelamento e outros arquivos internos
# não ficam acessíveis. (O backend — worker/ + functions/api/ — é empacotado pelo "wrangler deploy".)
set -e
rm -rf dist
mkdir dist
# home
cp index.html styles.css script.js favicon.ico dist/
# teste de nivelamento (/nivelamento) — o gabarito NÃO vai junto, fica só no backend
cp nivelamento.html nivelamento.css nivelamento.js nivelamento-perguntas.js dist/
cp -r img dist/
find dist -name ".DS_Store" -delete
echo "Arquivos publicados:"
find dist -type f | sort
