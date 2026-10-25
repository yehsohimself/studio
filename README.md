# Studio

Studio brings transcription, subtitles, video clips, dubbing and publishing drafts into one workspace on your Mac.
Built for Apple silicon. Open source under the MIT license.

![Studio](docs/ekran.jpg)

## What you can do

Paste a video link (YouTube, Instagram, TikTok, Vimeo…) or drop a file, then pick what you want:

- **Transcript** with speaker labels and voice recognition; Word, text and SRT files.
- **Summary**, highlights, timestamped chapters; ask questions about the video.
- **Subtitled video** (five caption styles), **clips** and face-tracked vertical **Shorts**, text-based editing, silence removal,
  export to Final Cut / Premiere / DaVinci.
- **Translation** and **dubbing** in the speaker's own voice.
- **Publishing kit:** title options, description and chapters, tags, thumbnail text and images, LinkedIn and Instagram copy.
- **Library** with text and picture search, channel watch, weekly digest; an invite link for a small closed group.

Interface in English or Turkish (TR/EN in the top bar).

## Install

Requirements: a Mac with Apple silicon, macOS 14 or newer, [Homebrew](https://brew.sh) and Git.

```bash
git clone https://github.com/yehsohimself/studio.git
cd studio
./kurulum.sh
.venv/bin/python site.py
```

Then open http://127.0.0.1:8765. For later launches, double-click `Studio.command`. The install script adds `ffmpeg`, `deno` and `uv`
with Homebrew, creates `.venv` with the Python packages and copies `ayarlar.ornek.json` → `ayarlar.json`. The speech model (~1.6 GB)
downloads on first use.

### Writing features: Claude or a local model

Transcription and speaker separation need nothing else. Summaries, translations, the publishing kit and other writing tasks need one of:

- **Claude** through your own subscription: install [Claude Code](https://claude.com/claude-code) and sign in once (`claude auth login`).
  When you use Claude, the text needed for that task is sent to Claude.
- **A local model:** `brew install ollama`, `brew services start ollama`, `ollama pull gemma3:4b`. Everything then stays on the Mac
  (slower, less accurate for long texts).

If neither is set up, transcription still works; summaries and writing tasks are skipped.

## Where your data goes

Speech recognition, speaker separation, subtitles, clips and dubbing run on your Mac. Video and audio files never leave it. For writing
tasks, the transcript (or the part needed) is sent to Claude only if you chose Claude; with Ollama nothing is sent. Downloads use
`yt-dlp`, which talks to the video site. Optional integrations (Cloudflare tunnel for invite links, sync.so for lip sync, Pexels for B-roll)
are off until you enable them in Settings.

## Tested on

MacBook Air M4, 16 GB, macOS 26.6, Claude Code signed in. Developed and used daily on this machine; a clean install in a fresh folder has
been done with the script above.

## Known limits

- macOS with Apple silicon only (mlx-whisper, Vision, AppKit).
- Code identifiers and comments are in Turkish; the interface is bilingual.
- Instagram and TikTok sometimes require a browser session (Settings → "Browser session").

## Development

`site.py` is a small loader; the code runs in `sunucu/00_… 24_….py` parts within one namespace. Tests: `.venv/bin/python -m pytest
tests -q` and `duman_testi.py hizli|birim|canli|studio`. After changing the server: `.venv/bin/python yeniden_baslat.py`. Architecture:
[docs/MIMARI.md](docs/MIMARI.md). `python sizinti.py` scans the repo for personal data (also run by the commit hook). This repo is cut from
a larger workspace that develops sibling products (Meet, Ghost, Content, PT) on the same engine; siblings that are not installed are off.

Issues and pull requests are welcome; say which video site and which step failed.

---

**Türkçe:** Video linki ya da dosyası → transkript, özet, çeviri, altyazılı video, klip ve dikey Shorts, kendi sesiyle dublaj, yayın
paketi; tek yerde, kendi Mac'inizde. Ses tanıma Mac'te çalışır; özet ve yazı işleri için Claude (kendi hesabınız; o işin metni Claude'a
gider) ya da yerel Ollama modeli gerekir. Kurulum: yukarıdaki dört komut, sonra tarayıcıda http://127.0.0.1:8765. Arayüz dili üst
çubuktaki TR/EN düğmesinden.
