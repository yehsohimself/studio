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
    (hedef / "README.md").write_text(README[urun], encoding="utf-8"); kopyalanan.add("README.md")
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

Video linki ya da dosyası → transkript, özet, çeviri, altyazılı video, klip ve dikey Shorts, kendi sesiyle dublaj, yayın paketi.
Her şey kendi Mac'inizde çalışır: ses tanıma Apple grafik işlemcisinde (mlx-whisper), konuşmacı ayırma bilgisayarda (sherpa-onnx),
yazı işleri kendi Claude aboneliğinizle (Claude Code girişi), yoksa Ollama'daki yerel modelle. Hiçbir video ya da metin bir sunucuya gitmez.

## Ne yapar

- **Yazıya dökme:** YouTube, Instagram, TikTok, Vimeo ve benzeri linkler ya da yerel dosya; konuşmacı ayırma ve sesten tanıma; karışık dil;
  Whisper'ın sessizlikte uydurduğu satırların elenmesi; kaldığı yerden devam; Word, metin, SRT çıktıları.
- **Özet:** özet, öne çıkanlar, zaman damgalı bölümler, kararlar; soru-cevap ("Bu videoda X hakkında ne dendi?").
- **Çeviri ve dublaj:** cümle cümle çeviri (iki dilli Word, çevrilmiş SRT); konuşmacının kendi sesiyle dublaj (Chatterbox, Apple GPU).
- **Video:** altyazılı video (kutu, sade, karaoke, pop, vurgu stilleri), klip kesme, yüz takipli dikey kadraj (Shorts), metinden kurgu
  (paragrafa tıkla → çıkar/sırala), sessizlik kesme, Final Cut / Premiere / DaVinci'ye aktarma.
- **Yayın paketi:** başlık seçenekleri, açıklama ve bölümler, etiketler, kapak yazısı ve kapak görselleri, Shorts kesitleri, LinkedIn ve
  Instagram metinleri; beğenilerinizden öğrenir.
- **Kitaplık:** arama (metin ve görüntüde), kanal takibi (yeni videolar kendiliğinden yazıya dökülür), haftalık özet.
- **Davet linki:** kapalı bir gruba (5 kişi, günde 3 video) Cloudflare tüneliyle paylaşım; davetliler yalnız kendi kayıtlarını görür.
- **Kendini geliştirme:** araç sürümlerini izler ve güvenli olanları gece günceller, haftalık gelişme taraması, öz değerlendirme.

## Kurulum (macOS, Apple işlemci)

```bash
./kurulum.sh
.venv/bin/python site.py
```

Tarayıcıda http://127.0.0.1:8765. Çift tıklamak için `Studio.command`. Betik Homebrew ile `ffmpeg`, `deno`, `uv` kurar, `.venv` ve paketleri
hazırlar, `ayarlar.ornek.json` → `ayarlar.json`. İsteğe bağlı: Ollama + `gemma3:4b` (Claude yoksa yerel yazı modeli), `cloudflared` (davet
linki). Whisper modeli ilk kullanımda iner (~1,6 GB).

Claude ile yazım için Claude Code'un bu Mac'te girişli olması yeter (`claude auth login`); giriş yoksa her şey yerel modelle çalışır.

## Kişisel veri

Depoda yalnız kod ve şablon vardır. Adınız, hesaplarınız, marka stilleri ve bütün kayıtlar git dışı dosyalardadır (`ayarlar.json`,
`profil/`, `markalar/`, kayıt ve çıktı klasörleri). `python sizinti.py` depoyu kişisel bilgi için tarar; commit kancası ve yeniden
başlatma kapısı bunu zorunlu kılar.

## Geliştirme

`site.py` küçük bir yükleyicidir; kod `sunucu/00_… 24_….py` parçalarında aynı ad alanında çalışır. Testler: `.venv/bin/python -m pytest
tests -q` ve `duman_testi.py hizli|birim|canli|studio`. Siteyi değiştirdikten sonra: `.venv/bin/python yeniden_baslat.py`. Mimari:
[docs/MIMARI.md](docs/MIMARI.md). Bu depo, aynı motoru paylaşan kardeş ürünlerle (Meet, Ghost, Couple, Content, PT) birlikte geliştirilen
bir çalışmadan kesilir; kardeş ürünler kurulu değilse kapalıdır.

Lisans: MIT.
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
