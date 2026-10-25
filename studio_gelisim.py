"""studio_gelisim.py - Studio'nun kendini besleyen gelişim döngüsü (2026-10-24; kullanıcı: "kendi kendini besleyen, sürekli gelişen, sürekli yeni
özellikleri, gelişmeleri, güncellemeleri takip eden bir yapıya kavuştur"). Ghost'taki ghost_gelisim.py'nin Studio karşılığı.

1) ÖLÇER (`olcum`): son 7 günde Studio'da ne kullanıldı (özellik sayacı), hangi işler bitti / hata verdi / iptal edildi (hata metinleriyle),
   elle metin düzeltmeleri (studio_duzelt), yayın paketi tercihleri (yayin), görüntü dizini, transkript hızı (kalite.jsonl).
2) GÜNCELLER (`araclar`, `guncelle`): Studio'nun dayandığı açık kaynak araçların (yt-dlp, auto-editor, PySceneDetect, mlx-whisper, sherpa-onnx,
   faster-whisper, mlx-audio...) yeni sürümleri PyPI'dan bulunur, sürüm notları GitHub'dan okunur. `OTOMATIK` listesindekiler gece kendiliğinden
   güncellenir; her güncellemeden sonra o araca özel deneme + duman testi çalışır, geçmezse ortam güncelleme öncesine (pip freeze) geri döner.
   Ses modeli gibi çıktıyı etkileyenler yalnız kullanıcı "Güncelle" deyince (aynı deneme ve geri dönüşle).
3) İZLER (`takip`, haftada bir): video yapay zekâsı, YouTube/Shorts/Reels yenilikleri, açık kaynak ses tanıma / seslendirme / kurgu araçları
   (Google Haberler, Hacker News, GitHub) → sonnet "Studio için ne anlama geliyor" süzgeci → öneri.
4) DÜŞÜNÜR (`ozdegerlendirme`, haftada bir, opus): ölçüm + takip + güncellemelerden kişiye 2-3 cümlelik rapor ve kod gerektiren en çok 3 öneri.
   Öneriler onaya gider (Ayarlar → Sistem → Studio gelişimi); kabul edilenler bir sonraki Claude Code oturumunun iş listesidir. Kod kendini DEĞİŞTİRMEZ.
"""
import json
import re
import subprocess
import time
import urllib.parse
from pathlib import Path

KLASOR = Path(__file__).resolve().parent
DOSYA = KLASOR / "profil" / "studio_gelisim.json"
UV = Path.home() / ".local" / "bin" / "uv"
PY = KLASOR / ".venv" / "bin" / "python"
PY_TTS = KLASOR / ".venv-mlxtts" / "bin" / "python"

# paket → (ortam, GitHub deposu, ne işe yarıyor, deneme türü)
ARACLAR = {
    "yt-dlp": (PY, "yt-dlp/yt-dlp", "Video indirme (YouTube, Instagram, TikTok...)", "ytdlp"),
    "auto-editor": (PY, "WyattBlue/auto-editor", "Sessizlik kesme ve kurgu programına aktarma", "surum"),
    "scenedetect": (PY, "Breakthrough/PySceneDetect", "Sahne değişimi bulma", "surum"),
    "python-docx": (PY, "python-openxml/python-docx", "Word belgeleri", "ice"),
    "mlx-whisper": (PY, "ml-explore/mlx-examples", "Ses tanıma (Apple grafik işlemcisi)", "tam"),
    "mlx": (PY, "ml-explore/mlx", "Apple grafik işlemcisi altyapısı", "tam"),
    "sherpa-onnx": (PY, "k2-fsa/sherpa-onnx", "Konuşmacı ayırma", "tam"),
    "faster-whisper": (PY, "SYSTRAN/faster-whisper", "Ses tanıma yedeği ve sessizlik bulma", "tam"),
    "mlx-audio": (PY_TTS, "Blaizzy/mlx-audio", "Dublaj seslendirmesi (Apple grafik işlemcisi)", "ice"),
}
OTOMATIK = {"auto-editor", "scenedetect", "python-docx"}          # gece kendiliğinden (yt-dlp'yi site zaten haftada bir güncelliyor)
ICE = {"python-docx": "docx", "mlx-audio": "mlx_audio", "scenedetect": "scenedetect"}
KISITLAR = "av<15\n"                                               # faster-whisper 1.2.1 av 15 ile çalışmıyor (CLAUDE.md)
STUDIO_OZELLIK = ("Yazıya dökme", "Özet", "Altyazılı video", "Klip", "Video indirme", "Kesim", "Dublaj", "Sessizlik", "Çeviri", "Soru-cevap",
                  "Konuşmacı adı", "Metin düzeltme", "Yayın paketi", "Görüntü araması", "Kurgu", "Öne çıkan", "Senaryo", "Altyazı önizleme")


def oku():
    try:
        d = json.loads(DOSYA.read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001
        d = {}
    for k, v in (("raporlar", []), ("oneriler", []), ("takip", {}), ("araclar", {}), ("guncellemeler", [])):
        d.setdefault(k, v)
    return d


def yaz(d):
    DOSYA.parent.mkdir(exist_ok=True)
    tmp = DOSYA.with_suffix(".tmp")
    tmp.write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8")
    tmp.replace(DOSYA)


# ---------------------------------------------------------------- 1) ölçüm
def olcum(gun=7):
    sinir = time.time() - gun * 86400
    o = {"gun": gun}
    try:                                                   # özellik sayacı (yalnız Studio'ya ait olanlar)
        sayac = json.loads((KLASOR / "kayitlar" / ".ozellik_kullanim.json").read_text(encoding="utf-8"))
        topla = {}
        for g, v in sayac.items():
            if isinstance(v, dict) and time.mktime(time.strptime(g, "%Y-%m-%d")) >= sinir - 86400:
                for k, n in v.items():
                    if any(k.startswith(s) for s in STUDIO_OZELLIK):
                        topla[k] = topla.get(k, 0) + n
        o["ozellik"] = dict(sorted(topla.items(), key=lambda x: -x[1]))
    except Exception:  # noqa: BLE001
        o["ozellik"] = {}
    try:                                                   # işler: tür × durum, hata metinleri
        d = json.loads((KLASOR / ".isler.json").read_text(encoding="utf-8"))
        L = d if isinstance(d, list) else (d.get("isler") or list(d.values()))
        tur, hatalar = {}, []
        for i in L:
            if not isinstance(i, dict) or (i.get("olusturma") or 0) < sinir or i.get("toplanti") or i.get("ghost") or "/.atolye/" in str(i.get("link") or ""):
                continue
            k = f"{i.get('tur') or i.get('islem') or 'transkript'}:{i.get('durum')}"
            tur[k] = tur.get(k, 0) + 1
            if i.get("durum") in ("hata", "kesildi"):
                hatalar.append(f"{i.get('tur') or 'transkript'}: {str(i.get('hata') or '')[:160]}")
        o["isler"], o["hatalar"] = tur, hatalar[-15:]
    except Exception:  # noqa: BLE001
        o["isler"], o["hatalar"] = {}, []
    try:
        import studio_duzelt
        D = [c for c in (studio_duzelt._oku().get("ciftler") or []) if (c.get("t") or 0) >= sinir]
        o["duzeltme"] = {"sayi": len(D), "ornek": [f"{c['eski']} → {c['yeni']}" for c in D[-12:]], "ogrenilen_terim": studio_duzelt.ogrenilen_terimler()[:15]}
    except Exception:  # noqa: BLE001
        o["duzeltme"] = {}
    try:
        import yayin
        K = [k for k in (yayin.tercihler_oku().get("kayitlar") or []) if (k.get("t") or 0) >= sinir]
        o["yayin_tercih"] = {"begenilen": sum(1 for k in K if k.get("iyi")), "begenilmeyen": sum(1 for k in K if k.get("iyi") is False),
                             "notlar": [k.get("not") for k in K if k.get("not")][-8:]}
    except Exception:  # noqa: BLE001
        o["yayin_tercih"] = {}
    try:
        import sahne_dizin
        o["sahne_dizini"] = sahne_dizin.durum()
    except Exception:  # noqa: BLE001
        pass
    try:                                                   # transkript hızı (süre oranı) kalite kaydından
        oran = []
        for s in (KLASOR / "kayitlar" / ".kalite.jsonl").read_text(encoding="utf-8").splitlines()[-400:]:
            try:
                k = json.loads(s)
            except ValueError:
                continue
            if k.get("tur") == "transkript" and (k.get("t") or k.get("zaman") or 0) >= sinir and k.get("oran"):
                oran.append(float(k["oran"]))
        if oran:
            oran.sort(); o["transkript_hiz_ortanca"] = oran[len(oran) // 2]
    except Exception:  # noqa: BLE001
        pass
    return o


# ---------------------------------------------------------------- 2) araç güncellemeleri
def _surum(paket, py):
    try:
        p = subprocess.run([str(UV), "pip", "show", "--python", str(py), paket], capture_output=True, text=True, timeout=60)
        m = re.search(r"^Version:\s*(\S+)", p.stdout, re.M)
        return m.group(1) if m else ""
    except Exception:  # noqa: BLE001
        return ""


def _pypi(paket):
    import requests
    try:
        j = requests.get(f"https://pypi.org/pypi/{paket}/json", timeout=15).json()
        surum = j["info"]["version"]
        zaman = ((j.get("releases") or {}).get(surum) or [{}])[0].get("upload_time_iso_8601", "")[:10]
        return surum, zaman
    except Exception:  # noqa: BLE001
        return "", ""


def _notlar(depo, surum):
    """GitHub'daki sürüm notu (kısaltılmış); bulunamazsa boş."""
    import requests
    try:
        for etiket in (surum, "v" + surum):
            r = requests.get(f"https://api.github.com/repos/{depo}/releases/tags/{etiket}", timeout=15, headers={"Accept": "application/vnd.github+json"})
            if r.status_code == 200:
                return re.sub(r"\s+", " ", r.json().get("body") or "")[:1500]
        r = requests.get(f"https://api.github.com/repos/{depo}/releases", params={"per_page": 1}, timeout=15)
        if r.ok and r.json():
            return re.sub(r"\s+", " ", r.json()[0].get("body") or "")[:1500]
    except Exception:  # noqa: BLE001
        pass
    return ""


def _temiz_not(m):
    m = re.sub(r"\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)", "", m or "")            # rozet görselleri
    m = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", m)
    m = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", m)
    m = re.sub(r"https?://\S+", "", m)
    return re.sub(r"\s+", " ", m).strip()


def _not_ozeti(paket, eski, yeni, notlar):
    """Sürüm notunu Studio açısından tek sade Türkçe cümleye çevirir (Claude yoksa boş)."""
    try:
        import claude_yaz
        if not notlar or not claude_yaz.hazir():
            return ""
        c = claude_yaz.sor_json(f"'{paket}' aracı {eski} sürümünden {yeni} sürümüne güncellenebilir. Studio onu şunun için kullanıyor: {ARACLAR[paket][2]}. "
                                "Sürüm notundan Studio'yu ilgilendireni TEK cümleyle, sade Türkçe yaz (teknik terim yok). Risk varsa (eski davranış değişiyor, "
                                'büyük sürüm) "risk" alanına kısa yaz, yoksa boş. JSON: {"ozet": "...", "risk": ""}\n\nSÜRÜM NOTU:\n' + notlar[:3000],
                                "Yalnızca JSON döndürürsün.", zaman_asimi=120, model_adi="sonnet")
        return (str(c.get("ozet") or "").strip()[:240], str(c.get("risk") or "").strip()[:200])
    except Exception:  # noqa: BLE001
        return ""


def _sv(s):
    return tuple(int(x) if x.isdigit() else 0 for x in re.split(r"[.\-+]", s or "0")[:4])


def araclar(zorla=False, log=print):
    """Kurulu ve güncel sürümler. Günde en çok bir kez internete bakar. Döner: {paket: {...}}"""
    d = oku()
    if not zorla and time.time() - (d["araclar"].get("_zaman") or 0) < 20 * 3600:
        return {k: v for k, v in d["araclar"].items() if not k.startswith("_")}
    out = {"_zaman": time.time()}
    for paket, (py, depo, ne, _deneme) in ARACLAR.items():
        if not Path(py).exists():
            continue
        kurulu = _surum(paket, py)
        if not kurulu:
            continue
        son, tarih = _pypi(paket)
        x = {"kurulu": kurulu, "son": son or kurulu, "tarih": tarih, "ne": ne, "otomatik": paket in OTOMATIK or paket == "yt-dlp", "depo": depo}
        if son and _sv(son) > _sv(kurulu):
            eski = (d["araclar"].get(paket) or {})
            if eski.get("son") == son and eski.get("notlar") and eski.get("ozet"):
                x["notlar"], x["ozet"], x["risk"] = eski["notlar"], eski.get("ozet", ""), eski.get("risk", "")
            else:
                x["notlar"] = _temiz_not(_notlar(depo, son))
                oz = _not_ozeti(paket, kurulu, son, x["notlar"])
                x["ozet"], x["risk"] = oz if oz else ("", "")
            if _sv(son)[0] > _sv(kurulu)[0] and not x.get("risk"):
                x["risk"] = "Büyük sürüm değişikliği"
            x["yeni"] = True
        out[paket] = x
    d = oku(); d["araclar"] = out; yaz(d)
    yeni = [k for k, v in out.items() if not k.startswith("_") and v.get("yeni")]
    log(f"Studio araçları: {len(out) - 1} araç, {len(yeni)} güncelleme var" + (f" ({', '.join(yeni)})" if yeni else ""))
    return {k: v for k, v in out.items() if not k.startswith("_")}


def _dene(paket, tur, log):
    """Güncellemeden sonra aracın gerçekten çalıştığını sınar."""
    py = ARACLAR[paket][0]
    try:
        if tur == "ytdlp":
            r = subprocess.run([str(py), "-m", "yt_dlp", "-q", "--no-playlist", "--simulate", "--print", "%(id)s", "-f", "bestaudio",
                                "https://www.youtube.com/watch?v=jNQXAC9IVRw"], capture_output=True, text=True, timeout=180)
            return r.returncode == 0 and "jNQXAC9IVRw" in r.stdout
        if tur == "surum":
            ikili = KLASOR / ".venv" / "bin" / paket
            r = subprocess.run([str(ikili), "--version"], capture_output=True, text=True, timeout=60)
            return r.returncode == 0
        if tur == "ice":
            r = subprocess.run([str(py), "-c", f"import {ICE.get(paket, paket.replace('-', '_'))}"], capture_output=True, text=True, timeout=120)
            return r.returncode == 0
        if tur == "tam":                                   # Türkçe ses üretip yazıya dökme (duman_testi tam, ~1-2 dk)
            r = subprocess.run([str(PY), str(KLASOR / "duman_testi.py"), "tam"], capture_output=True, text=True, timeout=900, cwd=str(KLASOR))
            return r.returncode == 0
    except Exception as e:  # noqa: BLE001
        log(f"Deneme yapılamadı: {e}")
        return False
    return True


def guncelle(paket, log=print):
    """Tek aracı günceller; deneme ya da duman testi geçmezse ortam güncelleme öncesine döner. Döner: {tamam, eski, yeni, mesaj}."""
    if paket not in ARACLAR:
        return {"tamam": False, "mesaj": "Bilinmeyen araç."}
    py, _depo, ne, tur = ARACLAR[paket]
    if not UV.exists() or not Path(py).exists():
        return {"tamam": False, "mesaj": "Kurulum aracı bulunamadı."}
    eski = _surum(paket, py)
    son, _t = _pypi(paket)
    if not son or _sv(son) <= _sv(eski):
        return {"tamam": True, "eski": eski, "yeni": eski, "mesaj": "Zaten güncel."}
    yedek = KLASOR / ".onbellek" / f"freeze_{Path(py).parent.parent.name}_{int(time.time())}.txt"
    yedek.parent.mkdir(exist_ok=True)
    yedek.write_text(subprocess.run([str(UV), "pip", "freeze", "--python", str(py)], capture_output=True, text=True, timeout=120).stdout, encoding="utf-8")
    kisit = yedek.with_suffix(".kisit.txt"); kisit.write_text(KISITLAR, encoding="utf-8")
    log(f"{paket} {eski} → {son} güncelleniyor...")
    p = subprocess.run([str(UV), "pip", "install", "--python", str(py), "-c", str(kisit), f"{paket}=={son}"], capture_output=True, text=True, timeout=900)
    yeni = _surum(paket, py)
    ok = p.returncode == 0 and yeni == son and _dene(paket, tur, log)
    if ok and py == PY:
        r = subprocess.run([str(PY), str(KLASOR / "duman_testi.py"), "hizli"], capture_output=True, text=True, timeout=600, cwd=str(KLASOR))
        ok = r.returncode == 0
    kayit = {"zaman": time.time(), "paket": paket, "eski": eski, "yeni": son, "ne": ne}
    if not ok:
        subprocess.run([str(UV), "pip", "install", "--python", str(py), "-r", str(yedek)], capture_output=True, text=True, timeout=900)
        kayit.update({"tamam": False, "mesaj": f"{son} denemeden geçmedi; {eski} sürümüne geri dönüldü."})
        log(kayit["mesaj"])
    else:
        kayit.update({"tamam": True, "mesaj": f"{ne}: {eski} → {son}"})
        log(f"{paket} güncellendi ve denendi: {son}")
    kisit.unlink(missing_ok=True)
    for f in sorted(yedek.parent.glob("freeze_*.txt"))[:-6]:            # son 6 yedek kalır
        f.unlink(missing_ok=True)
    d = oku()
    d["guncellemeler"] = (d["guncellemeler"] + [kayit])[-30:]
    if paket in d["araclar"]:
        d["araclar"][paket].update({"kurulu": _surum(paket, py)})
        if kayit["tamam"]:
            d["araclar"][paket]["yeni"] = False
    yaz(d)
    return kayit


def otomatik_guncelle(log=print):
    """Gece: OTOMATIK listesindeki araçlardan yenisi çıkanları sırayla günceller."""
    yapilan = []
    for paket, x in araclar(log=log).items():
        if x.get("yeni") and paket in OTOMATIK:
            yapilan.append(guncelle(paket, log=log))
    return yapilan


# ---------------------------------------------------------------- 3) gelişme takibi
def _gn(q, dil="en"):
    bolge = {"tr": "TR"}.get(dil, "US")
    return f"https://news.google.com/rss/search?q={urllib.parse.quote(q + ' when:7d')}&hl={dil}&gl={bolge}&ceid={bolge}:{dil}"


TAKIP_KAYNAK = [
    ("platform", "YouTube", _gn('YouTube (Shorts OR creators OR "new feature" OR chapters OR thumbnails OR "auto dubbing")')),
    ("platform", "Instagram / TikTok", _gn('(Instagram Reels OR TikTok) "new feature" creators video')),
    ("arac", "Video yapay zekâsı", _gn('("AI video editing" OR "text-based video editing" OR "AI dubbing" OR "lip sync" OR Descript OR CapCut OR Opus Clip) new')),
    ("model", "Ses ve görüntü modelleri", _gn('(Whisper OR "speech recognition" OR "text-to-speech" OR "voice cloning" OR "video generation") open source model release')),
    ("model", "Anthropic / Claude", _gn('Anthropic Claude (release OR launches OR "new model" OR "Claude Code")')),
    ("platform", "Türkiye", _gn('YouTube OR Instagram yeni özellik içerik üreticileri', "tr")),
]


def takip(zorla=False, log=print):
    """Haftalık gelişme taraması. Döner: {tarih, maddeler}."""
    import claude_yaz
    d = oku()
    if not zorla and time.time() - (d["takip"].get("zaman") or 0) < 6 * 86400:
        return d["takip"]
    try:
        import kesif                                       # Ghost'un akış okuyucusu; Studio tek başına kuruluysa yok → takip yapılmaz (2026-10-25)
        import ghost_gelisim
    except ImportError:
        d["takip"] = {"zaman": time.time(), "maddeler": [], "not": "Gelişme takibi için Ghost'un kaynak okuyucusu gerekir (bu kurulumda yok)."}
        yaz(d); return d["takip"]
    M = []
    for tur, ad, url in TAKIP_KAYNAK:
        for m in kesif._akis("studio_gelisim", ad, url, saat=24 * 8)[:12]:
            M.append({"tur": tur, "kaynak": m["kaynak"], "baslik": m["baslik"], "link": m["link"], "ozet": m.get("ozet", "")[:200]})
    for q in ("video editing open source", "whisper", "text to speech", "subtitles", "lip sync", "yt-dlp"):
        M += ghost_gelisim._hn(q)
    for q in ("text-based video editor", "automatic subtitles video", "speaker diarization", "mlx audio speech", "video dubbing open source"):
        M += ghost_gelisim._github(q)
    gorulen, U = set(), []
    for m in M:
        k = re.sub(r"\W+", "", m["baslik"].lower())[:70]
        if k and k not in gorulen:
            gorulen.add(k); U.append(m)
    if not U or not claude_yaz.hazir():
        log("Studio gelişim takibi: kaynak gelmedi ya da Claude yok"); return d["takip"]
    eski = {x.get("baslik") for x in (d["takip"].get("maddeler") or [])}
    c = claude_yaz.sor_json(
        "Studio, programlama bilmeyen bir kişinin Mac'inde çalışan kişisel video aracı. Yaptıkları: "
        "link ya da dosyadan yazıya dökme (Apple grafik işlemcisinde Whisper), konuşmacı ayırma, özet, çeviri, altyazılı video (kelime kelime stiller), "
        "klip ve dikey Shorts (yüz takipli kadraj), metinden kesme, sessizlik kesme, kurgu programına aktarma, kendi sesiyle dublaj, yayın paketi "
        "(YouTube başlık/açıklama/bölümler, kapak), görüntü araması. Hepsi yerel ve ücretsiz araçlarla; metin işleri Claude aboneliğiyle.\n"
        "Aşağıdaki son bir haftanın maddelerinden STUDIO İÇİN GERÇEKTEN ÖNEMLİ olanları seç: (a) YouTube/Instagram/TikTok'un video yayınını "
        "değiştiren güncellemeleri (Shorts süresi, bölümler, kapak testleri, otomatik dublaj...), (b) Studio'nun benimseyebileceği açık kaynak araç "
        "ya da model (yerelde, Mac'te çalışabilen), (c) Claude'un yeni yetenekleri. Reklam, söylenti, ücretli bulut hizmeti tanıtımı alma. "
        "En çok 6 madde; hiçbiri önemli değilse boş liste.\n"
        "Her madde: no, tur (platform|arac|model), baslik (en çok 8 kelime, sade Türkçe), neden (Studio için ne anlama geliyor, tek cümle, sade Türkçe), "
        "oneri (Studio'da ne yapılabilir, tek cümle).\n"
        + ("GEÇEN HAFTA ZATEN BİLDİRİLENLER (tekrarlama): " + "; ".join(list(eski)[:12]) + "\n" if eski else "")
        + 'JSON: {"maddeler": [{"no": 0, "tur": "arac", "baslik": "...", "neden": "...", "oneri": "..."}]}\n\nMADDELER:\n'
        + "\n".join(f"[{i}] ({m['tur']} · {m['kaynak']}) {m['baslik']} — {m['ozet']}" for i, m in enumerate(U[:90])),
        "Sade Türkçe yazarsın; yalnızca JSON döndürürsün.", zaman_asimi=300, model_adi="sonnet")
    out = []
    for x in c.get("maddeler") or []:
        try:
            m = U[int(x.get("no"))]
        except (TypeError, ValueError, IndexError):
            continue
        out.append({**m, "tur": x.get("tur") or m["tur"], "neden": str(x.get("neden") or "")[:300], "oneri": str(x.get("oneri") or "")[:300]})
        d["oneriler"].append({"id": f"t{int(time.time())}{len(d['oneriler'])}", "baslik": str(x.get("baslik") or m["baslik"])[:160], "neden": str(x.get("neden") or "")[:400],
                              "ne_yapilir": str(x.get("oneri") or "")[:500], "kaynak": f"gelişme takibi · {m['kaynak']}", "link": m["link"],
                              "durum": "bekliyor", "zaman": time.time()})
    d["takip"] = {"zaman": time.time(), "tarih": time.strftime("%Y-%m-%d"), "taranan": len(U), "maddeler": out}
    d["oneriler"] = d["oneriler"][-40:]
    yaz(d)
    log(f"Studio gelişim takibi: {len(U)} madde tarandı, {len(out)} önemli bulundu")
    return d["takip"]


# ---------------------------------------------------------------- 4) haftalık öz değerlendirme
def ozdegerlendirme(zorla=False, log=print):
    import claude_yaz
    d = oku()
    son = d["raporlar"][-1]["zaman"] if d["raporlar"] else 0
    if not zorla and time.time() - son < 6 * 86400:
        return None
    if not claude_yaz.hazir():
        return None
    o = olcum(7)
    guncel = [g for g in d["guncellemeler"] if g["zaman"] >= time.time() - 7 * 86400]
    bekleyen = {k: v for k, v in d["araclar"].items() if not k.startswith("_") and v.get("yeni")}
    onceki = d["raporlar"][-1] if d["raporlar"] else {}
    c = claude_yaz.sor_json(
        "Kişisel bir video aracının (Studio) haftalık öz değerlendirmesini yapıyorsun. Amaç: kişinin işini gerçekten kolaylaştırmak. Ölçüm, araç "
        "güncellemeleri ve gelişme takibi aşağıda. Az kullanılan özellik bulunması zor ya da gereksiz olabilir; sık hata veren iş en önce düzeltilmeli; "
        "kişinin elle düzelttiği kelimeler ses tanımanın nerede yanıldığını gösterir; yayın paketi tercihleri neyi sevdiğini gösterir.\n"
        + (f"GEÇEN HAFTANIN DEĞERLENDİRMESİ: {onceki.get('ozet', '')}\n" if onceki else "")
        + "YAPACAKLARIN:\n1) ozet: kişiye hitaben 2-3 cümle, 'siz' diliyle, sade Türkçe, teknik terim yok: bu hafta ne oldu, ne güncellendi, neye dikkat.\n"
        "2) oneriler: kod değişikliği gerektiren en çok 3 ürün önerisi {baslik, neden, ne_yapilir}; yalnız ölçümün ya da takibin açıkça gösterdiği "
        "konularda. Öneri yoksa boş liste.\n"
        'JSON: {"ozet": "...", "oneriler": []}\n\n'
        f"ÖLÇÜM (son 7 gün):\n{json.dumps(o, ensure_ascii=False)[:16000]}\n\nBU HAFTA GÜNCELLENEN ARAÇLAR: {json.dumps(guncel, ensure_ascii=False)[:3000]}\n"
        f"GÜNCELLEMESİ BEKLEYEN (ses tanıma gibi, onayla): {json.dumps({k: [v['kurulu'], v['son'], (v.get('notlar') or '')[:300]] for k, v in bekleyen.items()}, ensure_ascii=False)[:4000]}\n"
        f"GELİŞME TAKİBİ: {json.dumps(d['takip'].get('maddeler') or [], ensure_ascii=False)[:5000]}",
        "Sade Türkçe yazarsın; yalnızca JSON döndürürsün.", zaman_asimi=400, model_adi="opus")
    if not c.get("ozet"):
        log("Studio gelişim: öz değerlendirme yanıtı boş"); return None
    for x in c.get("oneriler") or []:
        if isinstance(x, dict) and x.get("baslik"):
            d["oneriler"].append({"id": f"o{int(time.time())}{len(d['oneriler'])}", "baslik": str(x["baslik"])[:160], "neden": str(x.get("neden") or "")[:400],
                                  "ne_yapilir": str(x.get("ne_yapilir") or "")[:500], "kaynak": "öz değerlendirme", "durum": "bekliyor", "zaman": time.time()})
    rapor = {"zaman": time.time(), "tarih": time.strftime("%Y-%m-%d"), "ozet": str(c["ozet"])[:800],
             "olcum": {k: o.get(k) for k in ("ozellik", "isler", "duzeltme", "yayin_tercih", "sahne_dizini")}}
    d["raporlar"] = (d["raporlar"] + [rapor])[-12:]
    d["oneriler"] = d["oneriler"][-40:]
    yaz(d)
    log(f"Studio gelişim: rapor hazır ({len(c.get('oneriler') or [])} öneri)")
    return rapor


def oneri_karar(oid, kabul):
    d = oku()
    for x in d["oneriler"]:
        if x.get("id") == oid:
            x["durum"] = "kabul" if kabul else "red"; x["karar_zaman"] = time.time(); yaz(d)
            return x
    return None


def durum():
    d = oku()
    A = {k: v for k, v in d["araclar"].items() if not k.startswith("_")}
    return {"rapor": d["raporlar"][-1] if d["raporlar"] else None, "araclar": A, "araclar_zaman": d["araclar"].get("_zaman"),
            "guncellemeler": d["guncellemeler"][-8:][::-1], "takip": d["takip"],
            "oneriler": [x for x in d["oneriler"] if x.get("durum") == "bekliyor"][-10:][::-1],
            "kabul": [x for x in d["oneriler"] if x.get("durum") == "kabul"][-10:][::-1]}


if __name__ == "__main__":
    import sys
    a = sys.argv[1:]
    if a[:1] == ["araclar"]:
        print(json.dumps(araclar(zorla=True), ensure_ascii=False, indent=1))
    elif a[:1] == ["guncelle"]:
        print(json.dumps(guncelle(a[1]), ensure_ascii=False, indent=1))
    elif a[:1] == ["takip"]:
        print(json.dumps(takip(zorla=True), ensure_ascii=False, indent=1))
    elif a[:1] == ["degerlendir"]:
        print(json.dumps(ozdegerlendirme(zorla=True), ensure_ascii=False, indent=1))
    elif a[:1] == ["olc"]:
        print(json.dumps(olcum(), ensure_ascii=False, indent=1))
    else:
        print(json.dumps(durum(), ensure_ascii=False, indent=1)[:4000])
