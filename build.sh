#!/usr/bin/env bash
# Dựng thư mục site/ (Cloudflare phục vụ thẳng thư mục này). Chạy sau MỖI lần sửa js/css/html.
set -e
cd "$(dirname "$0")"
rm -rf site && mkdir -p site
npx esbuild app=js/main.js --bundle --splitting --format=esm --minify --target=es2020,safari15 --outdir=site --chunk-names=chunks/[name]-[hash] --log-level=warning
cp index.html site/index.html
cp css/app.css site/app.css
cp -r public/* site/
echo "Đã dựng site/: $(du -sh site | cut -f1)"
