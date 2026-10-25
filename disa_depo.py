"""disa_depo.py - Bir ürünü tek başına çalışan ayrı bir depo olarak keser (2026-10-25; kullanıcı: "her ürün ayrı depo, seri yok").

python disa_depo.py studio <hedef klasör>      Studio + ortak motor → hedef (var olan dosyaların üstüne yazar, fazlalıkları siler)

Ne kopyalanır: ürünün sunucu parçaları + onların kullandığı modüller (kapanış), statik dosyalar, testler, şablonlar, lisans. Kişisel dosyalar
(ayarlar.json, profil/, markalar/, kayıtlar...) hiçbir zaman kopyalanmaz. Kesilen depo 'ürünler isteğe bağlı' mekanizmasıyla çalışır:
olmayan sunucu parçası = kapalı ürün (sunucu/10_sayfalar.py, 01_yardimcilar.mesgul_nedenler). Çıkış: hedefte `python -m pytest tests -q` ve
`python duman_testi.py hizli` geçmeli (bu betik çalıştırır, sonucu yazar).
"""
import re
import shutil
import subprocess
import sys
from pathlib import Path

KOK = Path(__file__).resolve().parent

URUNLER = {
    "studio": {
        "ad": "Studio",
        "parcalar": ["00_baslangic", "01_yardimcilar", "02_isci", "03_video_isleri", "06_marka", "10_sayfalar", "11_ozellik_sayaci", "12_api",
                     "13_takip", "16_altyapi_ve_meet", "17_disa_aktarim", "18_indirilenler", "21_studio", "22_misafir", "24_guvenlik"],
        "moduller": ["site", "transkript", "indir", "isimlendir", "adlar", "altyazi", "anlam", "arkaplan", "broll", "ceviri", "claude_yaz", "dublaj",
                     "dudak", "duzenle", "goruntu", "harfler", "kadraj", "kalite", "kapak", "kayit_json", "kitaplik_onbellek", "klipler", "konusan", "marka",
                     "ozet", "sahne_dizin", "sesler", "sor", "sohbet", "studio_duzelt", "studio_gelisim", "studio_onizle", "takip", "temizle", "terimler",
                     "yakma", "yayin", "haftalik", "notlar", "notlarim", "yedek", "geri_yukle", "sizinti", "ortak", "gizli", "duman_testi", "yeniden_baslat",
                     "videohub_mcp", "disa_depo"],
        "static": ["index.html", "studio_ek.js", "studio_ek.css", "misafir.js", "manifest.webmanifest", "ikon-180.png", "ikon-192.png", "ikon-512.png",
                   "ikon-512-maskable.png", "il", "logo", "ikon", "altyazi_ornek", "arka_ornek", "dublaj_ornek"],
        "dosyalar": ["requirements.txt", "pytest.ini", "LICENSE", "kurulum.sh", "ayarlar.ornek.json", ".gitignore", "atolye/markalar.ornek.json",
                     "tests/conftest.py", "tests/test_birimler.py", "tests/test_site.py", "tests/test_yedek.py"],
        "requirements_cikar": ["python-pptx", "scenedetect", "opencv-python-headless", "pywebpush", "segno"],
        "komut": ("Video Hub.command", "Studio.command"),
    },
}


def kes(urun, hedef, log=print):
    U = URUNLER[urun]
    hedef = Path(hedef).expanduser().resolve()
    if hedef == KOK or KOK in hedef.parents:
        raise SystemExit("Hedef, kaynak klasörün içinde olamaz.")
    hedef.mkdir(parents=True, exist_ok=True)
    kopyalanan = set()

    def kopyala(kaynak, yol):
        d = hedef / yol
        d.parent.mkdir(parents=True, exist_ok=True)
        if kaynak.is_dir():
            if d.exists():
                shutil.rmtree(d)
            shutil.copytree(kaynak, d, ignore=shutil.ignore_patterns("__pycache__", ".DS_Store"))
            for f in d.rglob("*"):
                if f.is_file():
                    kopyalanan.add(f.relative_to(hedef).as_posix())
        else:
            shutil.copy2(kaynak, d)
            kopyalanan.add(Path(yol).as_posix())

    for p in U["parcalar"]:
        kopyala(KOK / "sunucu" / f"{p}.py", f"sunucu/{p}.py")
    for m in U["moduller"]:
        if (KOK / f"{m}.py").exists():
            kopyala(KOK / f"{m}.py", f"{m}.py")
        else:
            log(f"  (yok, atlandı: {m}.py)")
    for s in U["static"]:
        if (KOK / "static" / s).exists():
            kopyala(KOK / "static" / s, f"static/{s}")
    for f in U["dosyalar"]:
        if (KOK / f).exists():
            kopyala(KOK / f, f)
    eski_ad, yeni_ad = U["komut"]
    if (KOK / eski_ad).exists():
        kopyala(KOK / eski_ad, yeni_ad)
    # ürüne özel düzeltmeler
    req = (hedef / "requirements.txt").read_text(encoding="utf-8").splitlines()
    (hedef / "requirements.txt").write_text("\n".join(l for l in req if not any(l.startswith(c) for c in U["requirements_cikar"])) + "\n", encoding="utf-8")
    site = hedef / "site.py"
    site.write_text(site.read_text(encoding="utf-8").replace('"Video Hub.command"', f'"{yeni_ad}"').replace("Transkript sisteminin", f"{U['ad']} ürününün"), encoding="utf-8")
    gi = hedef / ".gitignore"
    ek = "\n# kesilen depo: örnek medya ve ekran görüntüsü depoya girer (monorepo'da *.mp4/*.jpg dışarıdaydı)\n!static/*_ornek/*.mp4\n!docs/ekran.jpg\n"
    if "!docs/ekran.jpg" not in gi.read_text(encoding="utf-8"):
        gi.write_text(gi.read_text(encoding="utf-8") + ek, encoding="utf-8")
    (hedef / "README.md").write_text(README[urun], encoding="utf-8"); kopyalanan.add("README.md"); kopyalanan.add("docs/ekran.jpg")
    (hedef / "docs").mkdir(exist_ok=True)
    (hedef / "docs" / "MIMARI.md").write_text(_mimari(urun), encoding="utf-8"); kopyalanan.add("docs/MIMARI.md")
    # fazlalıkları sil (yalnız bu betiğin yazdığı türden dosyalar; .git, veri klasörleri dokunulmaz)
    for f in list(hedef.rglob("*")):
        rel = f.relative_to(hedef).as_posix()
        if f.is_file() and rel not in kopyalanan and not rel.startswith(".git/") and f.suffix in {".py", ".js", ".css", ".html", ".svg", ".png", ".md", ".txt", ".json", ".webmanifest", ".command", ".mp4", ".ini", ".sh"} \
                and not rel.startswith(("kayitlar/", "profil/", "indirilenler/", "yuklemeler/", ".onbellek/", "static/derlenmis/")) and rel not in ("ayarlar.json", "sesler.json", "takip.json", "CLAUDE.md"):
            f.unlink()
    for d in sorted((x for x in hedef.rglob("*") if x.is_dir() and ".git" not in x.parts), key=lambda x: -len(x.parts)):
        if not any(d.iterdir()):
            d.rmdir()
    log(f"{len(kopyalanan)} dosya → {hedef}")
    return hedef


def dogrula(hedef, log=print):
    """Kesilen depoda testler: pytest + duman hizli (kaynak .venv ile; hedefte venv olmayabilir)."""
    py = KOK / ".venv" / "bin" / "python"
    sonuc = {}
    for ad, cmd in (("pytest", [str(py), "-m", "pytest", "tests", "-q", "-x"]), ("duman hizli", [str(py), "duman_testi.py", "hizli"])):
        r = subprocess.run(cmd, cwd=hedef, capture_output=True, text=True, timeout=1200)
        sonuc[ad] = r.returncode == 0
        log(f"  {'✓' if r.returncode == 0 else '✗'} {ad}" + ("" if r.returncode == 0 else "\n" + (r.stdout + r.stderr)[-1500:]))
    return sonuc


README = {"studio": """# Studio

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
"""}


def _mimari(urun):
    s = (KOK / "docs" / "MIMARI.md").read_text(encoding="utf-8")
    # ürün bölümünden yalnız bu ürün ve motor kalır
    a = s.find("## Ürünler"); b = s.find("## Veri")
    if a > 0 and b > a:
        satirlar = [l for l in s[a:b].splitlines() if l.startswith("## ") or l.startswith(f"- **{URUNLER[urun]['ad']}**") or (l.startswith("  ") and "**" not in l)]
        s = s[:a] + "\n".join(satirlar) + "\n\n" + s[b:]
    return s.replace("Altı ürün, tek sunucu süreci, ortak motor.", f"{URUNLER[urun]['ad']} ve ortak motor; kardeş ürünler kurulu değilse kapalıdır.")


if __name__ == "__main__":
    if len(sys.argv) < 3 or sys.argv[1] not in URUNLER:
        raise SystemExit(__doc__)
    h = kes(sys.argv[1], sys.argv[2])
    dogrula(h)
