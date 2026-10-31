"""studio_asistan.py - Studio'nun konuşan asistanı (2026-10-31; kullanıcı: "çok kısıtlı hissediyorum, bir soruya soruyla da karşılık
verebilmeliyim, chatbox olmalı"). Tek sohbet, her ekranda: kullanıcı ne istediğini kendi cümlesiyle anlatır ya da soru sorar; asistan
açık videonun tamamını, kitaplığı ve süren işleri bilerek yanıtlar, gerekirse tek bir soruyla netleştirir ve yapılacak işi öneri kartı olarak verir.

Akış: yanıt yazıldıkça akar; sonunda isteğe bağlı <eylem>{json}</eylem> bloğu (seçenekler, eylemler, hatırla). Blok kullanıcıya gösterilmez;
`eylemleri_dogrula` yalnızca bilinen işleri, geçerli alanlarla geçirir ve etiketlerini KOD yazar. İşleri tarayıcı başlatır (her uç kendi
kapısından geçer; davetli kapısı da). Hafıza `kayitlar/studio_asistan.json`: son 200 mesaj + kullanıcının açıkça söylediği tercihler (≤30).
"""
import json
import re
import threading
import time
from pathlib import Path

KLASOR = Path(__file__).resolve().parent
HAFIZA = KLASOR / "kayitlar" / "studio_asistan.json"
GECMIS_MESAJ = 14
_kilit = threading.Lock()

STILLER = ("kutu", "sade", "karaoke", "pop", "vurgu")
KALITELER = ("mp3", "360", "480", "720", "1080", "en")
DIL_AD = {"tr": "Türkçe", "en": "İngilizce", "de": "Almanca", "fr": "Fransızca", "es": "İspanyolca", "it": "İtalyanca", "ar": "Arapça",
          "ru": "Rusça", "pt": "Portekizce", "nl": "Felemenkçe", "ja": "Japonca", "zh": "Çince", "ko": "Korece", "orijinal": "orijinal dil"}
STIL_AD = {"kutu": "kutulu", "sade": "sade", "karaoke": "karaoke", "pop": "pop", "vurgu": "vurgulu"}


# ---------------------------------------------------------------- hafıza
def _oku():
    try:
        d = json.loads(HAFIZA.read_text(encoding="utf-8"))
        return {"mesajlar": list(d.get("mesajlar") or []), "tercihler": list(d.get("tercihler") or []), "kartlar": dict(d.get("kartlar") or {})}
    except Exception:  # noqa: BLE001
        return {"mesajlar": [], "tercihler": [], "kartlar": {}}


def _yaz(d):
    HAFIZA.parent.mkdir(parents=True, exist_ok=True)
    gecici = HAFIZA.with_suffix(".tmp")
    gecici.write_text(json.dumps(d, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    gecici.replace(HAFIZA)


def hafiza():
    with _kilit:
        return _oku()


def mesaj_ekle(*mesajlar):
    with _kilit:
        d = _oku()
        for m in mesajlar:
            m = dict(m); m.setdefault("zaman", time.time())
            d["mesajlar"].append(m)
        d["mesajlar"] = d["mesajlar"][-200:]
        _yaz(d)


def kart_yaz(anahtar, durum):
    """Öneri kartının durumu (başladı, iş kimliği, bitti, hata) sunucuda da tutulur: başka cihazdan açınca kart doğru görünür."""
    anahtar = re.sub(r"[^\w.\-]", "", str(anahtar or ""))[:60]
    if not anahtar or not isinstance(durum, dict):
        return False
    izin = ("durum", "is", "not", "hata", "yuzde", "ac", "acEt", "ceviri", "yayin", "dublaj")
    with _kilit:
        d = _oku()
        k = d["kartlar"].setdefault(anahtar, {})
        k.update({x: durum[x] for x in izin if x in durum})
        if len(d["kartlar"]) > 300:
            for eski in list(d["kartlar"])[:-300]:
                d["kartlar"].pop(eski, None)
        _yaz(d)
    return True


def temizle():
    with _kilit:
        d = _oku(); d["mesajlar"] = []; d["kartlar"] = {}; _yaz(d)


def tercih_ekle(metin):
    metin = re.sub(r"\s+", " ", str(metin or "")).strip()[:200]
    if len(metin) < 6:
        return False
    with _kilit:
        d = _oku()
        if any(t["metin"].lower() == metin.lower() for t in d["tercihler"]):
            return False
        d["tercihler"].append({"metin": metin, "zaman": time.time()})
        d["tercihler"] = d["tercihler"][-30:]
        _yaz(d)
    return True


def tercih_sil(i):
    with _kilit:
        d = _oku()
        if 0 <= i < len(d["tercihler"]):
            d["tercihler"].pop(i); _yaz(d); return True
    return False


# ---------------------------------------------------------------- bağlam
def _zaman(sn):
    sn = int(max(0, sn or 0))
    return f"{sn // 3600}:{sn % 3600 // 60:02d}:{sn % 60:02d}" if sn >= 3600 else f"{sn // 60}:{sn % 60:02d}"


def _kitaplik(haric=""):
    """Kullanıcının videoları (toplantılar, davetli kayıtları ve arka plan öğrenmesi hariç), en yeniden eskiye."""
    import kitaplik_onbellek
    out = []
    for x in kitaplik_onbellek.hepsi():
        v = x["veri"] or {}
        if v.get("toplanti") or v.get("misafir") or v.get("onay_bekliyor") or "/.atolye/" in str(v.get("link") or "") or v.get("atolye"):
            continue
        out.append({"temel": x["temel"], "baslik": v.get("baslik") or x["temel"], "tarih": v.get("olusturma") or x["mtime"], "sure": v.get("sure") or 0,
                    "dil": v.get("dil") or "", "kanal": v.get("kanal") or "", "ozet": bool((v.get("ozet") or {}).get("ozet")) if isinstance(v.get("ozet"), dict) else False,
                    "ceviriler": sorted((v.get("ceviriler") or {}).keys()), "link": v.get("link") or "",
                    "ozet_metin": ((v.get("ozet") or {}).get("ozet") or "") if isinstance(v.get("ozet"), dict) else ""})
    out.sort(key=lambda r: -float(r["tarih"] or 0))
    return out


def _kitaplik_metni(liste, n=40):
    satir = []
    for r in liste[:n]:
        t = time.strftime("%d.%m.%Y", time.localtime(float(r["tarih"] or 0)))
        ek = []
        if r["ceviriler"]:
            ek.append("çeviri: " + ",".join(r["ceviriler"]))
        if not r["ozet"]:
            ek.append("özet yok")
        satir.append(f"- {r['temel']} | {r['baslik'][:90]} | {t} | {_zaman(r['sure'])} | {r['dil'] or '?'}" + (f" | {'; '.join(ek)}" if ek else ""))
        if len(satir) <= 12 * 2 and r.get("ozet_metin"):          # son videoların özeti: "son videomu anlat" sorusu açmadan yanıtlansın
            satir.append("    özet: " + re.sub(r"\s+", " ", r["ozet_metin"])[:1200 if len(satir) < 8 else 500])
    return "\n".join(satir) or "(kitaplık boş)"


def _ilgili_paragraflar(soru, haric="", n=14):
    """Kitaplıkta soruyla en çok örtüşen paragraflar (sor.py dizini; toplantılar hariç)."""
    try:
        import sor
        b = sor._belirtec(soru)
        if not b:
            return []
        puan = []
        for p in sor.dizin():
            if p.get("toplanti") or p.get("misafir") or p["temel"] == haric:
                continue
            o = len(b & p["b"])
            if o >= max(1, min(2, len(b) // 2)):
                puan.append((o + (0.5 if p.get("ozet") else 0), p))
        puan.sort(key=lambda x: -x[0])
        return [p for _, p in puan[:n]]
    except Exception:  # noqa: BLE001
        return []


def _video_metni(temel, ciktilar=None):
    """Açık videonun tamamı: künye, özet, bölümler, öne çıkanlar, üretilmiş çıktılar ve zamanlı transkript."""
    import sohbet
    yol = KLASOR / f"{temel}.json"
    d = json.loads(yol.read_text(encoding="utf-8"))
    v = d["veri"]
    ek = [f"TEMEL: {temel}", f"SÜRE: {_zaman(v.get('sure'))}", f"DİL: {v.get('dil') or '?'}", f"KANAL: {v.get('kanal') or '-'}", f"LİNK: {v.get('link') or '-'}"]
    o = v.get("ozet") if isinstance(v.get("ozet"), dict) else {}
    if o.get("bolumler"):
        ek.append("BÖLÜMLER: " + "; ".join(f"[{_zaman(b.get('sn')) if isinstance(b.get('sn'), (int, float)) else (b.get('zaman') or '')}] {b.get('baslik') or b.get('ad') or ''}" for b in o["bolumler"][:30]))
    if v.get("klipler"):
        ek.append("ÖNE ÇIKAN ANLAR: " + "; ".join(f"{_zaman(k.get('bas'))}-{_zaman(k.get('bit'))} {k.get('baslik') or k.get('kanca') or ''}" for k in v["klipler"][:8]))
    if v.get("ceviriler"):
        ek.append("HAZIR ÇEVİRİLER: " + ", ".join(DIL_AD.get(k, k) for k in v["ceviriler"]))
    if ciktilar:
        ek.append("BU VİDEODAN ÜRETİLENLER: " + "; ".join(ciktilar[:12]))
    if v.get("yayin"):
        ek.append("YAYIN PAKETİ: hazır")
    metin = sohbet._baglam(d)
    if len(metin) > 150000:
        metin = metin[:150000] + "\n…(transkriptin kalanı kısaltıldı)"
    return "\n".join(ek) + "\n" + metin, v


YETENEKLER = """STUDIO'NUN YAPABİLDİKLERİ (eylem kodlarıyla):
- yaziya_dok {link, ozet:true|false, ceviri:"en"|"", altyazili:false, dublaj:"en"|"", indir:false} : linkteki videoyu yazıya döker (konuşmacılar ayrılır). İsterse aynı işte çeviri, altyazılı video, dublaj ve video dosyası.
- ozetle {link} : yalnız özet (hızlı yol, konuşmacı ayrımı yok).
- indir {link, kalite:"mp3|360|480|720|1080|en", kesit:"1:20-2:45"|""} : videoyu ya da sesini bilgisayara indirir.
- ac {temel} : kitaplıktaki bir videoyu açar.
- git {sn} : açık videoda o saniyeye gider (oynatıcı ve metin oraya kayar).
- klip {temel, bas, bit, dikey:true|false, stil:"kutu|sade|karaoke|pop|vurgu", dil:"orijinal"|"en"...} : bas-bit saniyeleri arasından altyazılı klip (dikey = 9:16, yüzü takip eder). 15-90 sn ideal.
- altyazili {temel, dil, stil, dikey} : videonun tamamına altyazı gömer.
- cevir {temel, dil} : transkripti ve özeti başka dile çevirir (altyazı dosyası da çıkar).
- dublaj {temel, dil, onizleme:true|false} : konuşmacının kendi sesiyle başka dilde seslendirir. Uzun sürer; ilk kez isteyene önce onizleme:true (ilk 30 sn) öner.
- one_cikanlar {temel} : paylaşılabilir 3-5 an seçer (Klipler sekmesi).
- yayin {temel} : YouTube başlıkları, açıklama, bölümler, etiketler, kapak yazıları, Shorts önerileri, Instagram/LinkedIn metni.
- ozet_yenile {temel, bicim:"kisa|ayrintili|madde", not:"..."} : özeti istenen biçimde yeniden yazar.
- sessizlik {temel, bicim:"mp4|fcpxml|premiere|resolve"} : sessiz yerleri kesilmiş video ya da kurgu programı dosyası.
- kitaplik {} : kitaplığı açar.
YAPAMADIKLARI: bir yere paylaşmak/yüklemek (YouTube, Instagram), renk düzeltme, müzik bestelemek, videoya yeni görüntü üretmek. Yapamıyorsan açıkça söyle ve en yakın yapabildiğini öner."""

SISTEM = """Sen Studio'sun: {ad} için çalışan, videoyu baştan sona izlemiş gibi bilen, sıcak ve keskin bir video yapımcısı arkadaş. Bir prodüktör, kurgucu, editör ve sosyal medya uzmanının bilgisini taşırsın ama bunu hissettirmeden, sade konuşursun.

NASIL KONUŞURSUN
- Kısa, doğal Türkçe; "siz" diye hitap et, ara sıra adını kullan ({ad}). Robot gibi değil, karşısında oturan biri gibi.
- "Elbette!", "Harika soru", "İşte ...", "Size yardımcı olmaktan mutluluk duyarım" gibi kalıplar YOK. Başlık yok. Önce doğrudan yanıt.
- Kullanıcı soruya soruyla karşılık verebilir, konuyu değiştirebilir, fikir danışabilir; sohbeti takip et.
- Açık videodaki bir şeyden söz ederken zamanını [dk:sn] yaz (ör. [12:34]); başka bir videodaki ana değinirken [dk:sn@temel] yaz (ör. [3:05@transkript_tr_X]). Bu zamanlar tıklanabilir; temel değerini listeden birebir kopyala.
- Bilmediğini uydurma. Transkriptte yoksa "videoda bu geçmiyor" de.
- KİTAPLIK listesindeki "özet:" satırları o videoların gerçek içeriğidir; bir video hakkında sorulunca önce onlara dayan ("içeriği önümde değil" deme). Daha ayrıntı gerekirse videoyu açmayı (ac) öner.
- Sohbet geçmişindeki eski yanıtların varsayımlarını tekrarlama; her yeni mesajı şu anki bağlama göre yanıtla.

İŞ İSTEDİĞİNDE
- İstek netse soru sorma: yapılacak işi öner (eylem). Birden çok iş gerekiyorsa sırayla birkaçını öner.
- Gerçekten belirsizse TEK soru sor ve 2-4 kısa cevap seçeneği ver (ör. "Dikey mi yatay mı?" → ["Dikey (Reels/Shorts)", "Yatay (YouTube)"]).
- Klip isteyince transkriptten en iyi anı SEN seç: cümle başında başlasın, düşünce bitince bitsin; neden o an olduğunu bir cümleyle söyle.
- İşler kullanıcı karttaki düğmeye basınca başlar; "başlattım" deme, "hazırladım, başlatın" de. Ne kadar süreceğini biliyorsan kabaca söyle.
- Kullanıcı kalıcı bir tercih söylerse ("altyazıyı hep pop isterim", "klipler hep dikey olsun") onu "hatirla" alanına yaz; bundan sonra o tercihe uy.

YANITIN SONU
Gerekirse yanıtın en sonuna şu bloğu ekle (yoksa ekleme):
<eylem>{{"secenekler": ["..."], "eylemler": [{{"tur": "...", ...}}], "hatirla": ""}}</eylem>
- secenekler: kullanıcının tek dokunuşla verebileceği kısa cevaplar (en çok 4, her biri ≤6 kelime). Soru sormadıysan ya da önerinin devamı yoksa boş bırak; uygun olunca 1-3 "sonraki adım" önerisi de olabilir.
- eylemler: yalnızca aşağıdaki kodlar ve alanlar; temel değerlerini listeden birebir kopyala; saniyeler sayı.
Blok dışında JSON ya da kod gösterme.

{yetenekler}"""


def _sistem(ad):
    return SISTEM.format(ad=ad or "kullanıcı", yetenekler=YETENEKLER)


def _odak(mesajlar, gecerli):
    """Video açık değilken sohbetin son birkaç mesajında üzerinde konuşulan video (önerilen işin temeli); o videonun tam metni bir sonraki
    turda verilir ki kullanıcı "dikey olsun" dediğinde asistan anı kendisi seçebilsin."""
    for m in reversed(mesajlar[-4:]):
        for e in reversed(m.get("eylemler") or []):
            if e.get("temel") in gecerli:
                return e["temel"]
        if m.get("temel") in gecerli:
            return m["temel"]
    return ""


def istem_kur(mesaj, temel="", link="", isler=None, ciktilar=None, onizleme=None):
    import ortak
    kim = ortak.kimlik()
    d = hafiza()
    parca = [f"ŞU AN: {time.strftime('%d.%m.%Y %A %H:%M')}"]
    if d["tercihler"]:
        parca.append("KULLANICININ KALICI TERCİHLERİ (uy):\n" + "\n".join(f"- {t['metin']}" for t in d["tercihler"]))
    liste = _kitaplik()
    parca.append(f"KİTAPLIK ({len(liste)} video; en yeniler, temel | başlık | tarih | süre | dil):\n" + _kitaplik_metni(liste))
    if isler:
        parca.append("İŞLER (en yeniler):\n" + "\n".join(f"- {i}" for i in isler[:8]))
    if link:
        oz = onizleme or {}
        parca.append(f"KULLANICININ YAPIŞTIRDIĞI LİNK: {link}" + (f" — başlık: {oz.get('baslik')}, süre: {_zaman(oz.get('sure'))}, kanal: {oz.get('kanal') or '-'}" if oz.get("baslik") else "")
                     + (" (bu video kitaplıkta zaten var: " + oz["mevcut"] + ")" if oz.get("mevcut") else ""))
    odak = "" if temel else _odak(d["mesajlar"], {r["temel"] for r in liste})
    if temel and (KLASOR / f"{temel}.json").exists():
        metin, _v = _video_metni(temel, ciktilar)
        parca.append("KULLANICININ ŞU AN AÇIK OLAN VİDEOSU (soruların çoğu bununla ilgili):\n" + metin)
    elif odak:
        metin, _v = _video_metni(odak)
        parca.append(f"SOHBETTE KONUŞULAN VİDEO (açık değil; zamanları [dk:sn@{odak}] biçiminde ver):\n" + metin)
    if not temel:
        ilgili = _ilgili_paragraflar(mesaj)
        if ilgili:
            parca.append("KİTAPLIKTA BU MESAJLA İLGİLİ GEÇEN YERLER (temel · [zaman] · konuşan: söz):\n" + "\n".join(
                f"- {p['temel']} · [{_zaman(p['sn'])}] · {p['ad']}: {p['metin'][:500]}" for p in ilgili))
    konusma = [m for m in d["mesajlar"] if m.get("rol") in ("ben", "studio", "not")][-GECMIS_MESAJ:]
    if konusma:
        adlar = {r["temel"]: r["baslik"] for r in liste}
        satir, bag = [], None
        for m in konusma:
            if m["rol"] == "ben" and (m.get("temel") or "") != bag:
                bag = m.get("temel") or ""
                satir.append(f"(— bu noktada açık video: {adlar.get(bag, bag) if bag else 'yok (ana sayfa)'} —)")
            satir.append(f"{'KULLANICI' if m['rol'] == 'ben' else ('STUDIO' if m['rol'] == 'studio' else 'BİLGİ')}: {m.get('metin', '')[:1500]}")
        parca.append("ŞİMDİYE KADARKİ SOHBET (eski mesajlar başka bir videoyla ilgili olabilir; YENİ mesaj şu anki bağlamla ilgilidir):\n" + "\n".join(satir))
    parca.append(f"KULLANICININ YENİ MESAJI: {mesaj}")
    return "\n\n".join(parca), _sistem(kim["ilk_ad"])


# ---------------------------------------------------------------- eylemler
def _sn(x):
    try:
        if isinstance(x, str) and ":" in x:
            p = [float(y) for y in x.split(":")]
            return p[0] * 3600 + p[1] * 60 + p[2] if len(p) == 3 else p[0] * 60 + p[1]
        return float(x)
    except Exception:  # noqa: BLE001
        return None


def _dil(x, varsayilan=""):
    x = str(x or "").lower().strip()
    return x if re.match(r"^[a-z]{2}$", x) else varsayilan


def _link(x):
    x = str(x or "").strip()
    return x if re.match(r"^https?://\S+$", x) and len(x) < 600 else ""


def eylemleri_dogrula(ham, temel_acik=""):
    """Modelin önerdiği işleri süzer; etiketi ve ayrıntıyı kod yazar. Döner: geçerli eylem listesi."""
    out = []
    kitap = {r["temel"]: r for r in _kitaplik()}
    for e in (ham or [])[:5]:
        if not isinstance(e, dict):
            continue
        t = str(e.get("tur") or "")
        temel = str(e.get("temel") or temel_acik or "")
        neden = str(e.get("neden") or "")[:160]
        r = None
        if t in ("klip", "altyazili", "cevir", "dublaj", "one_cikanlar", "yayin", "ozet_yenile", "sessizlik", "ac"):
            if temel not in kitap:
                continue
            bas = kitap[temel]["baslik"]
            sure = float(kitap[temel]["sure"] or 0)
            if t == "ac":
                r = {"tur": t, "temel": temel, "etiket": "Videoyu aç", "detay": bas}
            elif t == "klip":
                b, s = _sn(e.get("bas")), _sn(e.get("bit"))
                if b is None or s is None or s <= b or (sure and b >= sure):
                    continue
                if sure:
                    s = min(s, sure)
                dikey = bool(e.get("dikey"))
                stil = e.get("stil") if e.get("stil") in STILLER else "kutu"
                dil = str(e.get("dil") or "orijinal").lower()
                dil = dil if dil == "orijinal" or re.match(r"^[a-z]{2}$", dil) else "orijinal"
                r = {"tur": t, "temel": temel, "bas": round(b, 1), "bit": round(s, 1), "dikey": dikey, "stil": stil, "dil": dil,
                     "etiket": f"Klip · {_zaman(b)}–{_zaman(s)}", "detay": f"{'Dikey 9:16' if dikey else 'Yatay'} · {STIL_AD[stil]} altyazı" + (f" · {DIL_AD.get(dil, dil)}" if dil != "orijinal" else "") + f" · {int(s - b)} sn"}
            elif t == "altyazili":
                stil = e.get("stil") if e.get("stil") in STILLER else "kutu"
                dil = str(e.get("dil") or "orijinal").lower()
                dil = dil if dil == "orijinal" or re.match(r"^[a-z]{2}$", dil) else "orijinal"
                dikey = bool(e.get("dikey"))
                r = {"tur": t, "temel": temel, "stil": stil, "dil": dil, "dikey": dikey, "etiket": "Altyazılı video",
                     "detay": f"{STIL_AD[stil]} altyazı · {DIL_AD.get(dil, dil)}" + (" · dikey" if dikey else "")}
            elif t == "cevir":
                dil = _dil(e.get("dil"))
                if not dil:
                    continue
                r = {"tur": t, "temel": temel, "dil": dil, "etiket": f"{DIL_AD.get(dil, dil)} çeviri", "detay": "Metin, özet ve altyazı dosyası"}
            elif t == "dublaj":
                dil = _dil(e.get("dil"), "en")
                on = bool(e.get("onizleme"))
                r = {"tur": t, "temel": temel, "dil": dil, "onizleme": on, "etiket": f"{DIL_AD.get(dil, dil)} dublaj" + (" · önizleme" if on else ""),
                     "detay": "İlk 30 saniye, konuşmacının kendi sesiyle" if on else "Konuşmacının kendi sesiyle, videonun tamamı"}
            elif t == "one_cikanlar":
                r = {"tur": t, "temel": temel, "etiket": "Öne çıkan anlar", "detay": "Paylaşılabilir 3-5 an"}
            elif t == "yayin":
                r = {"tur": t, "temel": temel, "etiket": "Yayın paketi", "detay": "Başlık, açıklama, bölümler, etiketler, kapak yazısı"}
            elif t == "ozet_yenile":
                bicim = e.get("bicim") if e.get("bicim") in ("kisa", "ayrintili", "madde") else ""
                r = {"tur": t, "temel": temel, "bicim": bicim, "not": str(e.get("not") or "")[:300], "etiket": "Özeti yeniden yaz",
                     "detay": {"kisa": "Kısa", "ayrintili": "Ayrıntılı", "madde": "Maddeler halinde", "": "Yeni biçimde"}[bicim] + (f" · {str(e.get('not'))[:60]}" if e.get("not") else "")}
            elif t == "sessizlik":
                bicim = e.get("bicim") if e.get("bicim") in ("mp4", "fcpxml", "premiere", "resolve") else "mp4"
                r = {"tur": t, "temel": temel, "bicim": bicim, "etiket": "Sessizlikleri kes",
                     "detay": {"mp4": "Kısaltılmış video", "fcpxml": "Final Cut dosyası", "premiere": "Premiere dosyası", "resolve": "DaVinci dosyası"}[bicim]}
            if r:
                r["baslik"] = bas
        elif t == "git":
            s = _sn(e.get("sn"))
            if s is None or not temel_acik:
                continue
            r = {"tur": t, "temel": temel_acik, "sn": round(s, 1), "etiket": f"{_zaman(s)} anına git", "detay": neden}
        elif t in ("yaziya_dok", "ozetle", "indir"):
            link = _link(e.get("link"))
            if not link:
                continue
            if t == "indir":
                k = str(e.get("kalite") or "720").lower().replace("p", "")
                k = k if k in KALITELER else "720"
                kesit = str(e.get("kesit") or "")
                kesit = kesit if re.match(r"^[\d:.]*-[\d:.]*$", kesit) else ""
                r = {"tur": t, "link": link, "kalite": k, "kesit": kesit, "etiket": "Videoyu indir",
                     "detay": ("Yalnız ses (MP3)" if k == "mp3" else ("En iyi kalite" if k == "en" else f"{k}p")) + (f" · {kesit}" if kesit else "")}
            elif t == "ozetle":
                r = {"tur": t, "link": link, "etiket": "Özetle", "detay": "Hızlı özet; konuşmacılar ayrılmaz"}
            else:
                c = _dil(e.get("ceviri"))
                db = _dil(e.get("dublaj"))
                ek = ["konuşmacılar"] + (["özet"] if e.get("ozet", True) else [])
                if c:
                    ek.append(f"{DIL_AD.get(c, c)} çeviri")
                if e.get("altyazili"):
                    ek.append("altyazılı video")
                if db:
                    ek.append(f"{DIL_AD.get(db, db)} dublaj")
                if e.get("indir"):
                    ek.append("video dosyası")
                r = {"tur": t, "link": link, "ozet": bool(e.get("ozet", True)), "ceviri": c, "altyazili": bool(e.get("altyazili")), "dublaj": db,
                     "indir": bool(e.get("indir")), "etiket": "Yazıya dök", "detay": "Transkript · " + ", ".join(ek[1:] or ek)}
        elif t == "kitaplik":
            r = {"tur": t, "etiket": "Kitaplığı aç", "detay": ""}
        if r:
            if neden and t != "git":
                r["neden"] = neden
            out.append(r)
    return out


def _blok_coz(metin):
    """Yanıt metninden <eylem>...</eylem> bloğunu ayırır. Döner: (görünen metin, blok dict)."""
    i = metin.find("<eylem>")
    if i < 0:
        return metin.strip(), {}
    gorunen = metin[:i].rstrip()
    ham = metin[i + 7:]
    j = ham.find("</eylem>")
    ham = ham[:j] if j >= 0 else ham
    ham = ham.strip().strip("`")
    if ham.startswith("json"):
        ham = ham[4:]
    try:
        blok = json.loads(ham)
    except Exception:  # noqa: BLE001
        m = re.search(r"\{.*\}", ham, re.S)
        try:
            blok = json.loads(m.group(0)) if m else {}
        except Exception:  # noqa: BLE001
            blok = {}
    return gorunen, blok if isinstance(blok, dict) else {}


def akis(mesaj, temel="", link="", isler=None, ciktilar=None, onizleme=None):
    """Üreteç: ("metin", parça) ... sonra ("ek", {secenekler, eylemler, hatirlandi}). Hata: ("hata", mesaj)."""
    import claude_yaz
    if not claude_yaz.hazir():
        yield ("hata", "Claude şu an kullanılamıyor (giriş yok ya da abonelik sınırı). Ayarlar → Genel → Claude ile yaz.")
        return
    istem, sistem = istem_kur(mesaj, temel, link, isler, ciktilar, onizleme)
    tam, verilen = "", 0
    try:
        for p in claude_yaz.sor_akis(istem, sistem, zaman_asimi=240):
            tam += p
            i = tam.find("<eylem")
            sinir = i if i >= 0 else max(verilen, len(tam) - 7)     # "<eylem>" yarım gelebilir; son 7 karakter bekletilir
            if sinir > verilen:
                yield ("metin", tam[verilen:sinir]); verilen = sinir
    except claude_yaz.ClaudeHata as e:
        yield ("hata", f"Şu an yanıt veremiyorum: {e}")
        return
    gorunen, blok = _blok_coz(tam)
    if len(gorunen) > verilen:
        yield ("metin", gorunen[verilen:])
    secenekler = [re.sub(r"\s+", " ", str(s)).strip()[:60] for s in (blok.get("secenekler") or []) if str(s).strip()][:4]
    eylemler = eylemleri_dogrula(blok.get("eylemler"), temel)
    hatirlandi = blok.get("hatirla") if tercih_ekle(blok.get("hatirla")) else ""
    z = round(time.time(), 3)                  # kart anahtarı = mesaj zamanı; tarayıcı bunu kullanır ki kart durumu sunucudakiyle eşleşsin
    mesaj_ekle({"rol": "ben", "metin": mesaj, "temel": temel or "", "link": link or "", "zaman": z - 0.001},
               {"rol": "studio", "metin": gorunen, "temel": temel or "", "secenekler": secenekler, "eylemler": eylemler, "hatirlandi": hatirlandi, "zaman": z})
    yield ("ek", {"secenekler": secenekler, "eylemler": eylemler, "hatirlandi": hatirlandi, "zaman": z})


if __name__ == "__main__":
    import sys
    soru = " ".join(sys.argv[1:]) or "Neler yapabilirsin?"
    for tur, p in akis(soru):
        print(p if tur == "metin" else f"\n[{tur}] {json.dumps(p, ensure_ascii=False)}", end="", flush=True)
    print()
