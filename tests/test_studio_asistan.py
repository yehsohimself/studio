"""Studio asistanı: yanıt bloğu ayrıştırma, önerilen işlerin süzülmesi (yalnız bilinen işler ve geçerli alanlar), hafıza, sohbet ucu."""


def _kitap(monkeypatch, sa):
    monkeypatch.setattr(sa, "_kitaplik", lambda haric="": [{"temel": "transkript_tr_v1", "baslik": "Video bir", "sure": 300, "tarih": 1, "dil": "tr",
                                                         "kanal": "", "ozet": True, "ceviriler": [], "link": "", "ozet_metin": ""}])


def test_blok_ayrisir_ve_gorunen_metinden_cikar(kok):
    import studio_asistan as sa
    g, b = sa._blok_coz('Şu anı seçtim [1:20].\n<eylem>{"secenekler": ["Dikey"], "eylemler": []}</eylem>')
    assert g == "Şu anı seçtim [1:20]." and b["secenekler"] == ["Dikey"]
    g, b = sa._blok_coz("Bloksuz yanıt")
    assert g == "Bloksuz yanıt" and b == {}
    g, b = sa._blok_coz("Bozuk <eylem>{json değil")
    assert g == "Bozuk" and b == {}


def test_eylemler_suzulur(kok, monkeypatch):
    import studio_asistan as sa
    _kitap(monkeypatch, sa)
    ham = [
        {"tur": "klip", "temel": "transkript_tr_v1", "bas": "1:00", "bit": 400, "dikey": True, "stil": "pop"},   # bitiş süreye kırpılır
        {"tur": "klip", "temel": "transkript_tr_v1", "bas": 90, "bit": 60},                                       # ters aralık: atılır
        {"tur": "klip", "temel": "uydurma", "bas": 1, "bit": 20},                                                  # kitaplıkta yok: atılır
        {"tur": "rm", "komut": "rm -rf /"},                                                                        # bilinmeyen iş: atılır
        {"tur": "yaziya_dok", "link": "file:///etc/passwd"},                                                       # http değil: atılır
        {"tur": "yaziya_dok", "link": "https://youtu.be/x", "ceviri": "EN", "dublaj": "türkçe"},
        {"tur": "cevir", "temel": "transkript_tr_v1", "dil": "xx1"},                                               # dil anlaşılamadı: atılır
        {"tur": "indir", "link": "https://youtu.be/x", "kalite": "4k", "kesit": "1:00-2:00; rm"},
        {"tur": "git", "sn": 30},                                                                                  # açık video yokken git olmaz
    ]
    assert len(sa.eylemleri_dogrula([ham[0]] * 9)) == 5                                                           # en çok 5 öneri
    e = sa.eylemleri_dogrula(ham[:5]) + sa.eylemleri_dogrula(ham[5:])
    turler = [x["tur"] for x in e]
    assert turler == ["klip", "yaziya_dok", "indir"]
    assert e[0]["bas"] == 60 and e[0]["bit"] == 300 and e[0]["dikey"] and e[0]["stil"] == "pop" and e[0]["etiket"].startswith("Klip · 1:00")
    assert e[1]["ceviri"] == "en" and e[1]["dublaj"] == ""
    assert e[2]["kalite"] == "720" and e[2]["kesit"] == ""
    assert sa.eylemleri_dogrula([{"tur": "git", "sn": "2:05"}], "transkript_tr_v1")[0]["sn"] == 125


def test_hafiza_tercih_ve_odak(kok, monkeypatch, tmp_path):
    import studio_asistan as sa
    monkeypatch.setattr(sa, "HAFIZA", tmp_path / "h.json")
    assert sa.tercih_ekle("Klipler hep dikey olsun") and not sa.tercih_ekle("klipler hep dikey olsun") and not sa.tercih_ekle("kısa")
    sa.mesaj_ekle({"rol": "ben", "metin": "a"}, {"rol": "studio", "metin": "b", "eylemler": [{"tur": "one_cikanlar", "temel": "transkript_tr_v1"}]})
    h = sa.hafiza()
    assert len(h["mesajlar"]) == 2 and h["tercihler"][0]["metin"] == "Klipler hep dikey olsun"
    assert sa._odak(h["mesajlar"], {"transkript_tr_v1"}) == "transkript_tr_v1" and sa._odak(h["mesajlar"], set()) == ""
    assert sa.tercih_sil(0) and sa.hafiza()["tercihler"] == []
    sa.temizle(); assert sa.hafiza()["mesajlar"] == []


def test_asistan_ucu_akis_ve_davetliye_kapali(site, monkeypatch):
    import studio_asistan as sa
    monkeypatch.setattr(sa, "akis", lambda *a, **k: iter([("metin", "Merhaba "), ("metin", "Emre."), ("ek", {"secenekler": ["Evet"], "eylemler": []})]))
    c = site.app.test_client()
    r = c.post("/api/asistan", json={"mesaj": "selam"})
    govde = r.get_data(as_text=True)
    assert r.status_code == 200 and govde.startswith("Merhaba Emre.") and '\x00EK:{"secenekler": ["Evet"]' in govde
    assert c.post("/api/asistan", json={"mesaj": " "}).status_code == 400
    d = site.app.test_client().post("/api/asistan", json={"mesaj": "selam"}, base_url="http://localhost:8770/")
    assert d.status_code in (401, 403)
