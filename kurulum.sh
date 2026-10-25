#!/bin/bash
# Install (macOS, Apple silicon). No sudo. Needs Homebrew (https://brew.sh) and Git.
# Kurulum (macOS, Apple işlemci). Sudo istemez; Homebrew ve Git gerekir.
set -e
cd "$(dirname "$0")"

echo "1/4 Tools via Homebrew: ffmpeg, deno, uv"
if ! command -v brew >/dev/null; then echo "Homebrew not found. Install it first: https://brew.sh"; exit 1; fi
for p in ffmpeg deno uv; do brew list "$p" >/dev/null 2>&1 || brew install "$p"; done

echo "2/4 Python environment (.venv) and packages"
[ -d .venv ] || uv venv .venv --python 3.12
uv pip install --python .venv/bin/python --only-binary :all: -r requirements.txt

echo "3/4 Settings and folders"
[ -f ayarlar.json ] || cp ayarlar.ornek.json ayarlar.json
[ -f atolye/markalar.json ] || cp atolye/markalar.ornek.json atolye/markalar.json
mkdir -p kayitlar indirilenler yuklemeler kareler profil ghost misafir modeller .onbellek

echo "4/4 Done. Start with:"
echo "    .venv/bin/python site.py"
echo "then open http://127.0.0.1:8765 (later: double-click Studio.command)."
echo "Writing features need Claude Code signed in (claude auth login) or a local model: brew install ollama && brew services start ollama && ollama pull gemma3:4b"
echo "Optional: brew install cloudflared (invite links)."
