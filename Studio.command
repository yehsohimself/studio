#!/bin/zsh
# Çift tıklayınca siteyi başlatır ve tarayıcıda açar.
cd "$(dirname "$0")"
if ! curl -s --max-time 1 http://127.0.0.1:8765/ping >/dev/null 2>&1; then
  echo "Site başlatılıyor..."
  nohup .venv/bin/python site.py >> site.log 2>&1 &
  for i in 1 2 3 4 5 6 7 8 9 10; do
    sleep 1
    curl -s --max-time 1 http://127.0.0.1:8765/ping >/dev/null 2>&1 && break
  done
fi
open "http://127.0.0.1:8765"
echo "Site açıldı: http://127.0.0.1:8765  (bu pencereyi kapatabilirsiniz)"
