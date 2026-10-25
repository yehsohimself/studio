#!/bin/bash
# Kurulum (macOS, Apple işlemci). Sudo istemez; Homebrew yoksa önce https://brew.sh adresinden kurun.
set -e
cd "$(dirname "$0")"

echo "1/4 Araçlar (Homebrew): ffmpeg, deno, uv"
if ! command -v brew >/dev/null; then echo "Homebrew bulunamadı: https://brew.sh"; exit 1; fi
for p in ffmpeg deno uv; do brew list "$p" >/dev/null 2>&1 || brew install "$p"; done

echo "2/4 Python ortamı (.venv) ve paketler"
[ -d .venv ] || uv venv .venv --python 3.12
uv pip install --python .venv/bin/python --only-binary :all: -r requirements.txt

echo "3/4 Ayarlar ve klasörler"
[ -f ayarlar.json ] || cp ayarlar.ornek.json ayarlar.json
[ -f atolye/markalar.json ] || cp atolye/markalar.ornek.json atolye/markalar.json
mkdir -p kayitlar indirilenler yuklemeler kareler profil ghost misafir modeller .onbellek

echo "4/4 Hazır. Başlatmak için:"
echo "    .venv/bin/python site.py"
echo "Tarayıcıda http://127.0.0.1:8765 (Studio); Meet :8766, Ghost :8767, Couple :8768, Content :8769, PT :8771."
echo "İsteğe bağlı: brew install ollama && ollama pull gemma3:4b (Claude yoksa yerel yazı modeli); brew install rclone (Drive); brew install cloudflared (davet linki)."
