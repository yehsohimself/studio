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

![Studio](docs/ekran.jpg)

Paste a video link or drop a file → transcript with speaker labels, summary, translation, subtitled video, clips and vertical Shorts,
dubbing in the speaker's own voice, and a publishing kit (titles, description, thumbnail text). Everything runs on your own Mac:
speech recognition on the Apple GPU (mlx-whisper), speaker separation on device (sherpa-onnx), writing with your own Claude
subscription (Claude Code sign-in) or, without it, a local Ollama model. No video or text leaves the computer.

Interface in English or Turkish (Settings → General → Language; follows the browser language on first launch).

## What it does

- **Transcribe:** YouTube, Instagram, TikTok, Vimeo and similar links, or local files; speaker separation and voice recognition;
  mixed languages; filtering of the lines Whisper hallucinates in silence; resume after interruption; Word, text and SRT output.
- **Summarize:** summary, highlights, timestamped chapters, decisions; ask questions about the video.
- **Translate and dub:** sentence-by-sentence translation (bilingual Word, translated SRT); dubbing in the speaker's own voice
  (Chatterbox on the Apple GPU).
- **Video:** subtitled video (box, plain, karaoke, pop and emphasis styles), clip cutting, face-tracked vertical framing (Shorts),
  text-based editing (click a paragraph → remove or reorder), silence removal, export to Final Cut / Premiere / DaVinci.
- **Publishing kit:** title options, description and chapters, tags, thumbnail text and thumbnail images, Shorts cuts, LinkedIn and
  Instagram copy; learns from what you like.
- **Library:** search in text and in the picture, channel watch (new videos are transcribed automatically), weekly digest.
- **Invite link:** share with a closed group (5 people, 3 videos a day) through a Cloudflare tunnel; guests only see their own records.
- **Self-improvement:** tracks tool versions and installs safe updates at night, weekly scan of what changed in the field,
  weekly self-review.

## Install (macOS, Apple silicon)

```bash
./kurulum.sh
.venv/bin/python site.py
```

Open http://127.0.0.1:8765. Or double-click `Studio.command`. The script installs `ffmpeg`, `deno` and `uv` with Homebrew, creates
`.venv` with the packages, and copies `ayarlar.ornek.json` → `ayarlar.json`. Optional: Ollama + `gemma3:4b` (local writing model when
Claude is not signed in), `cloudflared` (invite links). The Whisper model downloads on first use (~1.6 GB).

For writing with Claude, Claude Code only needs to be signed in on this Mac (`claude auth login`); without it everything falls back to
the local model.

## Personal data

The repository holds code and templates only. Your name, accounts, brand styles and all records live in files outside git
(`ayarlar.json`, `profil/`, `markalar/`, record and output folders). `python sizinti.py` scans the repo for personal data; a commit hook
and the restart gate enforce it.

## Development

`site.py` is a small loader; the code runs in `sunucu/00_… 24_….py` parts within one namespace. Tests: `.venv/bin/python -m pytest
tests -q` and `duman_testi.py hizli|birim|canli|studio`. After changing the server: `.venv/bin/python yeniden_baslat.py`. Architecture:
[docs/MIMARI.md](docs/MIMARI.md). Code identifiers and comments are in Turkish; the UI is bilingual. This repo is cut from a larger
workspace that develops sibling products (Meet, Ghost, Couple, Content, PT) on the same engine; siblings that are not installed are
simply off.

License: MIT.

---

**Türkçe:** Video linki ya da dosyası → transkript, özet, çeviri, altyazılı video, klip ve dikey Shorts, kendi sesiyle dublaj, yayın
paketi. Her şey kendi Mac'inizde çalışır; hiçbir video ya da metin dışarı gitmez. Kurulum: `./kurulum.sh` sonra `.venv/bin/python site.py`
ve tarayıcıda http://127.0.0.1:8765. Arayüz dili Ayarlar → Genel → Arayüz dili.
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
