"""Studio video dışı içerik: link türü, güvenli bağlantı, sayfadan yazı (kopyalamaya kapalı dahil, ücretli işaretli), yazı kaydı, uçlar, davetli kapısı."""
import json

UZUN = " ".join(["Bu cümle yazının gövdesindeki gerçek bir paragrafı temsil ediyor ve yeterince uzun tutuldu."] * 6)
SAYFA = f"""<!doctype html><html lang="tr"><head><title>Deneme Başlığı</title><meta property="og:title" content="Deneme Başlığı"><meta property="og:type" content="article">
<style>body{{user-select:none}}</style></head><body oncontextmenu="return false" oncopy="return false"><article><h1>Deneme Başlığı</h1>
<p>{UZUN}</p><h2>İkinci bölüm</h2><p>{UZUN} farklı</p><ul><li>Birinci madde burada duruyor</li><li>İkinci madde burada duruyor</li></ul><p>{UZUN} son</p></article></body></html>"""


def test_link_turu(kok):
    import icerik
    assert icerik.link_turu("https://www.instagram.com/p/ABC/") == "gorsel"
    assert icerik.link_turu("https://www.instagram.com/reel/ABC/") == "video"
    assert icerik.link_turu("https://www.tiktok.com/@a/video/1") == "video"
    assert icerik.link_turu("https://www.tiktok.com/@a/photo/1") == "gorsel"
    assert icerik.link_turu("https://x.com/a/status/1") == "gorsel"
    assert icerik.link_turu("https://youtu.be/x") == "video"
    assert icerik.link_turu("https://site.com/a.png?x=1") == "gorsel"
    assert icerik.link_turu("https://site.com/rapor.pdf") == "pdf"
    assert icerik.link_turu("https://site.com/haber/bir-yazi") == "sayfa"


def test_yerel_baglanti_acilmaz(kok):
    import icerik
    for u in ("http://127.0.0.1:8765/", "http://localhost/", "http://192.168.1.1/x", "file:///etc/passwd", "http://[::1]/", "http://mac.local/"):
        assert not icerik.guvenli(u)


def test_kopyalamaya_kapali_sayfadan_yazi(kok):
    import icerik
    s = icerik.html_coz(SAYFA, "https://site.com/y")
    assert s["baslik"] == "Deneme Başlığı" and s["kopya_engeli"] and s["kelime"] > 150 and s["dil"] == "tr" and not s["ucretli"]
    turler = [b["tur"] for b in s["bloklar"]]
    assert "h2" in turler and turler.count("li") == 2
    assert not any(b["metin"] == "Deneme Başlığı" for b in s["bloklar"])                 # başlık gövdede tekrar etmez


def test_ucretli_govde_alinmaz(kok):
    import icerik
    govde = " ".join(["gizli"] * 400)
    h = f"""<html><head><title>T</title><script type="application/ld+json">{json.dumps({"@type": "NewsArticle", "isAccessibleForFree": False, "articleBody": govde})}</script></head>
    <body><article><p>{" ".join(["açık"] * 60)} kısım burada bitiyor.</p></article></body></html>"""
    s = icerik.html_coz(h, "https://site.com/y")
    assert s["ucretli"] and "gizli" not in " ".join(b["metin"] for b in s["bloklar"])
    acik = h.replace('"isAccessibleForFree": false, ', "")
    assert "gizli" in " ".join(b["metin"] for b in icerik.html_coz(acik, "https://site.com/y")["bloklar"])   # açık yazıda yapısal veri kullanılır


def test_engel_sayfasi_yazi_sayilmaz(kok):
    import icerik
    assert icerik.html_coz("<html><title>Access Denied</title><body><h1>Access Denied</h1><p>You don't have permission to access this page.</p></body></html>", "https://a.com/x")["blok"]


def test_yazi_kaydi_ve_belgeler(kok, monkeypatch):
    import icerik
    monkeypatch.setattr(icerik, "_resim_indir", lambda *a, **k: None)
    s = {**icerik.html_coz(SAYFA, "https://site.com/y"), "link": "https://site.com/y", "yontem": "duz"}
    temel = icerik.yazi_kaydet(s)
    assert temel.startswith("transkript_yazi_")
    d = json.loads((kok / f"{temel}.json").read_text(encoding="utf-8"))
    from transkript import ciktilari_yaz, paragrafla
    par = paragrafla(d["segmentler"], d["veri"]["etiket"])
    assert len(par) == len(d["segmentler"]) == len(d["veri"]["yazi"]["turler"])            # her blok kendi paragrafı; türler bire bir
    assert d["veri"]["sure"] > 0 and d["veri"]["yazi"]["kopya_engeli"]
    d["veri"]["ozet"] = {"ozet": "Kısa özet.", "maddeler": ["Bir"]}
    ciktilari_yaz(kok / temel, d["veri"], d["segmentler"])                                  # özet eklenince belgeler yenilenir, srt yazılmaz
    assert (kok / f"{temel}.docx").exists() and not (kok / f"{temel}.srt").exists()
    assert "Kısa özet." in (kok / f"{temel}.md").read_text(encoding="utf-8") and "ÖZET" in (kok / f"{temel}.txt").read_text(encoding="utf-8")
    assert icerik.mevcut_yazi("https://site.com/y")["temel"] == temel


def _gorsel_on(kok, icerik):
    from PIL import Image
    kod = icerik._kisa("https://www.instagram.com/p/ABC/")
    d = icerik.ONB / kod
    d.mkdir(parents=True, exist_ok=True)
    for i in range(2):
        Image.new("RGB", (800, 800), (i * 90, 10, 10)).save(d / f"g{i}.jpg")
        Image.new("RGB", (200, 200)).save(d / f"k{i}.jpg")
    (d / "bilgi.json").write_text(json.dumps({"tur": "gorsel", "id": kod, "link": "https://www.instagram.com/p/ABC/", "baslik": "Başlık", "kanal": "@hesap", "metin": "Açıklama metni", "platform": "Instagram", "tarih": "2026-10-20",
                                              "dosyalar": [{"i": i, "ad": f"g{i}.jpg", "kucuk": f"k{i}.jpg", "en": 800, "boy": 800, "boyut": 100, "yazi": "Üstteki yazı" if i == 0 else ""} for i in range(2)]}), encoding="utf-8")
    return kod


def test_gorsel_uclari(site, kok, monkeypatch):
    import icerik
    monkeypatch.setattr(icerik, "gorsel_betimle", lambda *_: None)
    c = site.app.test_client()
    kod = _gorsel_on(kok, icerik)
    r = c.post("/api/icerik/gorsel", json={"id": kod, "secim": [1]})
    assert r.status_code == 200 and [f["i"] for f in r.get_json()["dosyalar"]] == [1]
    assert c.post("/api/icerik/gorsel", json={"id": kod}).get_json()["dosyalar"][0]["yazi"] == "Üstteki yazı"   # ikinci istek eksikleri ekler
    L = c.get("/api/icerik/gorseller").get_json()
    assert len(L) == 1 and len(L[0]["dosyalar"]) == 2
    assert c.get(f"/gorsel/{kod}/0?indir=1").status_code == 200 and c.get(f"/gorsel-zip/{kod}.zip").status_code == 200
    assert c.get("/gorsel/uydurma/0").status_code == 404 and c.post("/api/icerik/gorsel", json={"id": "../x"}).status_code == 400
    assert c.delete(f"/api/icerik/gorsel/{kod}").status_code == 200 and c.get("/api/icerik/gorseller").get_json() == []
    assert c.post(f"/api/icerik/gorsel/{kod}/geri").status_code == 200 and len(c.get("/api/icerik/gorseller").get_json()) == 1
    assert list(icerik.GORSELLER.glob("*.jpg"))                                              # dosyalar Görseller klasöründe


def test_onizleme_yonlendirir(site, monkeypatch):
    import icerik
    c = site.app.test_client()
    monkeypatch.setattr(icerik, "guvenli", lambda u: True)
    monkeypatch.setattr(icerik, "yazi_al", lambda l, ce="": {**icerik.html_coz(SAYFA, l), "link": l, "yontem": "duz"})
    monkeypatch.setitem(site.app.view_functions, "onizle", site.app.view_functions["onizle"])
    monkeypatch.setattr(site, "_onizle_video", lambda: site.jsonify({"hata": "bulunamadi"}), raising=False)
    j = c.get("/api/onizle?link=https://site.com/yazi-1").get_json()
    assert j["icerik"]["tur"] == "yazi" and j["icerik"]["kopya_engeli"] and j["icerik"]["okuma_dk"] >= 1


def test_davetliye_kapali(site):
    d = site.app.test_client()
    for yol in ("/api/icerik/gorsel", "/api/icerik/yazi", "/api/icerik/al"):
        assert d.post(yol, json={"link": "https://a.com"}, base_url="http://localhost:8770/").status_code in (401, 403)
    assert d.get("/api/icerik/gorseller", base_url="http://localhost:8770/").status_code in (401, 403)
