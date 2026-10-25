# Studio

![Studio](docs/ekran.jpg)

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
