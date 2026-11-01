# sunucu/39_icerik.py — video dışı içerik: görsel ve yazı (2026-11-01). Motor icerik.py; ekran static/studio_icerik.js.
# site.py bu dosyayı diğer parçalarla AYNI ad alanında, numara sırasıyla yürütür; tek başına çalıştırılmaz.
import icerik as icerik_modulu
from concurrent.futures import ThreadPoolExecutor as _IcHavuz
from flask import copy_current_request_context as _ic_baglam, send_file

_onizle_video = app.view_functions["onizle"]
_ic_bellek = {}                     # (link, cerez) -> (zaman, sonuç): önizleme ile "al" arasında sayfa yeniden okunmasın
_ic_havuz = _IcHavuz(4)
IC_SURE = 1800


def _ic_misafir():
    f = globals().get("_gid")
    return bool(f and f())


def _ic_sonuc(link, cerez):
    an = (link, cerez)
    k = _ic_bellek.get(an)
    if k and time.time() - k[0] < IC_SURE:
        return k[1]
    s = icerik_modulu.incele(link, cerez)
    if s.get("tur"):
        for eski in [x for x, v in _ic_bellek.items() if time.time() - v[0] > IC_SURE]:
            _ic_bellek.pop(eski, None)
        _ic_bellek[an] = (time.time(), s)
    return s


def _ic_goster(s, link, cerez, video=None):
    """Önizleme yanıtı: video önizlemesiyle aynı alanlar + `icerik`."""
    tur = s["tur"]
    if tur == "gorsel":
        dosyalar = [{**{k: f[k] for k in ("i", "en", "boy", "boyut")}, "yazi": f.get("yazi", ""), "kucuk": f"/icerik-onizleme/{s['id']}/{f['kucuk']}", "buyuk": f"/icerik-onizleme/{s['id']}/{f['ad']}"} for f in s["dosyalar"]]
        ic = {"tur": "gorsel", "id": s["id"], "baslik": s["baslik"], "kanal": s["kanal"], "metin": s["metin"], "platform": s["platform"], "tarih": s["tarih"], "dosyalar": dosyalar,
              "video_sayi": s.get("video_sayi", 0), "yalniz_metin": s.get("yalniz_metin", False), "tek_kucuk": s.get("tek_kucuk", False), "mevcut": icerik_modulu.mevcut_gorsel(link)}
        kapak = dosyalar[0]["kucuk"] if dosyalar else ""
    else:
        bl = s["bloklar"]
        ozet = " ".join(b["metin"] for b in bl if b["tur"] == "p")[:700]
        ic = {"tur": "yazi", "baslik": s["baslik"], "yazar": s["yazar"], "site": s["site"], "tarih": s["tarih"], "dil": s["dil"], "kelime": s["kelime"], "okuma_dk": max(1, round(s["kelime"] / 230)), "ozet": ozet,
              "bolum": sum(1 for b in bl if b["tur"] in ("h1", "h2")), "gorsel": sum(1 for b in bl if b["tur"] == "img"), "kapak": s.get("kapak", ""), "kisitli": bool(s.get("ucretli") and s["kelime"] < 500),
              "kopya_engeli": s.get("kopya_engeli", False), "yontem": s.get("yontem", ""), "oturum": cerez == "chrome", "mevcut": icerik_modulu.mevcut_yazi(link)}
        kapak = s.get("kapak", "")
    if video:
        ic["video_da"] = {"baslik": video.get("baslik"), "sure": video.get("sure")}
    d = {"video_id": "", "baslik": s["baslik"], "kanal": s.get("kanal") or s.get("site") or "", "sure": 0, "kapak": kapak, "platform": s.get("platform") or s.get("site") or "", "canli": False, "kaliteler": {},
         "video_dil": "", "dikey": False, "icerik_tur": tur, "icerik_ozet": (ic.get("ozet") or ic.get("metin") or "")[:900], "icerik_yazi": " / ".join(f.get("yazi", "") for f in s.get("dosyalar", []) if f.get("yazi"))[:600]}
    onizleme_bellek[(link, cerez)] = d                       # asistan da bu bağlantının ne olduğunu bilsin
    return jsonify({**d, "mevcut": None, "mevcut_indirme": [], "model_var": {"turbo": True, "best": True}, "tahmin": None, "icerik": ic})


def onizle_genel():
    link = (request.args.get("link") or "").strip()
    cerez = request.args.get("cerez") or ""
    if request.args.get("tur") == "video" or not re.match(r"^https?://", link) or _ic_misafir():
        return _onizle_video()
    tur = icerik_modulu.link_turu(link)
    if tur == "video" or not icerik_modulu.guvenli(link):
        return _onizle_video()
    if tur == "gorsel":
        s = _ic_sonuc(link, cerez)
        if s.get("tur"):
            return _ic_goster(s, link, cerez)
        r = _onizle_video()                                  # hepsi videoysa ya da görsel çıkmadıysa video yolu
        j, kod = (r[0], r[1]) if isinstance(r, tuple) else (r, r.status_code)
        oturum_denendi = cerez == "chrome" or "instagram.com" in link     # Instagram'a zaten kişinin oturumuyla bakıldı: "giriş yapın" demek yanıltır
        if kod == 200 or ((j.get_json(silent=True) or {}).get("hata") == "giris" and not oturum_denendi):
            return r
        return jsonify({"hata": "bulunamadi", "mesaj": "Bu gönderiye ulaşılamadı: silinmiş, gizli ya da hesabınıza kapalı olabilir."}), 404

    @_ic_baglam
    def dene():
        r = _onizle_video()
        r = r[0] if isinstance(r, tuple) else r
        return r.get_json(silent=True) or {}, r.status_code
    f = _ic_havuz.submit(dene)
    s = _ic_sonuc(link, cerez)
    gercek = lambda: (lambda j, k: j if k == 200 and float(j.get("sure") or 0) > 0 else None)(*f.result(timeout=3 if s.get("tur") == "yazi" and s.get("kelime", 0) >= 250 else 42))  # noqa: E731
    try:
        vid = gercek()
    except Exception:  # noqa: BLE001
        vid = None
    if s.get("tur") == "yazi" and s.get("kelime", 0) >= 250:
        return _ic_goster(s, link, cerez, vid)
    if vid:
        return jsonify(vid)
    if s.get("tur"):
        return _ic_goster(s, link, cerez)
    if s.get("hata") == "giris":
        return jsonify({"hata": "giris"}), 404
    return jsonify({"hata": "bulunamadi", "mesaj": s.get("hata") or "Bu linkte video, görsel ya da okunacak bir yazı bulamadım."}), 404


app.view_functions["onizle"] = onizle_genel


def _ic_gorsel_gor(k):
    return {**k, "dosyalar": [{**f, "kucuk": f"/gorsel-kucuk/{f['kucuk']}", "buyuk": f"/gorsel/{k['id']}/{f['i']}", "indir": f"/gorsel/{k['id']}/{f['i']}?indir=1"} for f in k.get("dosyalar") or []],
            "zip": f"/gorsel-zip/{k['id']}.zip"}


def _ic_yazi_kaydet(link, cerez):
    var = icerik_modulu.mevcut_yazi(link)
    if var and var.get("temel"):
        return var["temel"], True
    k = _ic_bellek.get((link, cerez))
    s = k[1] if k and k[1].get("tur") == "yazi" else icerik_modulu.yazi_al(link, cerez)
    if s.get("hata"):
        raise ValueError("Bu site giriş istiyor." if s["hata"] == "giris" else s["hata"])
    if s.get("kelime", 0) < 15:
        raise ValueError("Bu sayfada okunacak bir yazı bulamadım.")
    temel = icerik_modulu.yazi_kaydet(s)
    return temel, False


@app.post("/api/icerik/gorsel")
def icerik_gorsel_al():
    v = request.get_json(force=True) or {}
    try:
        k = icerik_modulu.gorsel_kaydet(str(v.get("id") or ""), [int(x) for x in v["secim"]] if isinstance(v.get("secim"), list) else None)
    except ValueError as e:
        return jsonify({"hata": str(e)}), 400
    threading.Thread(target=icerik_modulu.gorsel_betimle, args=(k["id"],), daemon=True).start()
    return jsonify(_ic_gorsel_gor(k))


@app.post("/api/icerik/yazi")
def icerik_yazi_al():
    v = request.get_json(force=True) or {}
    link = str(v.get("link") or "").strip()
    if not re.match(r"^https?://", link) or not icerik_modulu.guvenli(link):
        return jsonify({"hata": "Geçersiz link."}), 400
    try:
        temel, var = _ic_yazi_kaydet(link, str(v.get("cerez") or ""))
    except ValueError as e:
        return jsonify({"hata": str(e)}), 400
    return jsonify({"temel": temel, "mevcut": var})


@app.post("/api/icerik/al")
def icerik_al():
    """Tek adım (asistan): linkteki görseli ya da yazıyı alır."""
    v = request.get_json(force=True) or {}
    link = str(v.get("link") or "").strip()
    if not re.match(r"^https?://", link) or not icerik_modulu.guvenli(link):
        return jsonify({"hata": "Geçersiz link."}), 400
    s = _ic_sonuc(link, str(v.get("cerez") or ""))
    if s.get("tur") == "gorsel" and s.get("dosyalar"):
        k = icerik_modulu.gorsel_kaydet(s["id"])
        threading.Thread(target=icerik_modulu.gorsel_betimle, args=(k["id"],), daemon=True).start()
        return jsonify({"tur": "gorsel", "kayit": _ic_gorsel_gor(k)})
    if s.get("tur") == "yazi":
        temel, _var = _ic_yazi_kaydet(link, str(v.get("cerez") or ""))
        return jsonify({"tur": "yazi", "temel": temel, "baslik": s["baslik"]})
    return jsonify({"hata": "Bu site giriş istiyor." if s.get("hata") == "giris" else (s.get("hata") or "Bu linkte alınacak bir görsel ya da yazı bulamadım.")}), 400


@app.get("/api/icerik/gorseller")
def icerik_gorseller():
    return jsonify([_ic_gorsel_gor(k) for k in icerik_modulu.gorsel_liste()])


@app.delete("/api/icerik/gorsel/<kid>")
def icerik_gorsel_sil(kid):
    return jsonify({"tamam": True}) if icerik_modulu.gorsel_sil(kid) else (jsonify({"hata": "Bulunamadı."}), 404)


@app.post("/api/icerik/gorsel/<kid>/geri")
def icerik_gorsel_geri(kid):
    if not re.fullmatch(r"[0-9a-f]{14}", kid):
        abort(404)
    return jsonify({"tamam": True}) if icerik_modulu.gorsel_geri(kid) else (jsonify({"hata": "Geri alınamadı."}), 404)


@app.post("/api/icerik/gorsel/<kid>/goster")
def icerik_gorsel_goster(kid):
    y = icerik_modulu.gorsel_dosya(kid, int((request.get_json(silent=True) or {}).get("i") or 0))
    if not y:
        k = icerik_modulu.gorsel_kayit(kid)
        y = icerik_modulu.GORSELLER / k["dosyalar"][0]["ad"] if k and k.get("dosyalar") else None
    if not y:
        abort(404)
    subprocess.run(["open", "-R", str(y)], timeout=10)
    return jsonify({"tamam": True})


@app.get("/icerik-onizleme/<kod>/<ad>")
def icerik_onizleme(kod, ad):
    if not re.fullmatch(r"[0-9a-f]{14}", kod) or not re.fullmatch(r"[gk]\d+\.(jpg|png|gif)", ad) or not (icerik_modulu.ONB / kod / ad).is_file():
        abort(404)
    return send_from_directory(str(icerik_modulu.ONB / kod), ad, max_age=3600)


@app.get("/gorsel/<kid>/<int:n>")
def gorsel_dosyasi(kid, n):
    y = icerik_modulu.gorsel_dosya(kid, n)
    if not y:
        abort(404)
    return send_from_directory(str(y.parent), y.name, as_attachment=request.args.get("indir") == "1", conditional=True)


@app.get("/gorsel-kucuk/<ad>")
def gorsel_kucuk(ad):
    if not re.fullmatch(r"[0-9a-f]{14}_\d+\.jpg", ad) or not (icerik_modulu.KUCUK / ad).is_file():
        abort(404)
    return send_from_directory(str(icerik_modulu.KUCUK), ad, max_age=86400)


@app.get("/gorsel-zip/<kid>.zip")
def gorsel_zip(kid):
    import io
    import zipfile
    k = icerik_modulu.gorsel_kayit(kid)
    if not k:
        abort(404)
    sec = {int(x) for x in re.findall(r"\d+", request.args.get("i") or "")}
    tampon = io.BytesIO()
    with zipfile.ZipFile(tampon, "w", zipfile.ZIP_STORED) as z:
        for f in k["dosyalar"]:
            y = icerik_modulu.GORSELLER / f["ad"]
            if y.is_file() and (not sec or f["i"] in sec):
                z.write(y, f["ad"])
    tampon.seek(0)
    ad = re.sub(r'[\\/:*?"<>|]+', " ", (k.get("kanal") or "").lstrip("@") or k.get("baslik") or "Gorseller")[:60].strip() or "Gorseller"
    return send_file(tampon, mimetype="application/zip", as_attachment=True, download_name=f"{ad}.zip")


@app.get("/icerik-pdf/<temel>.pdf")
def icerik_pdf(temel):
    t = _temel_dogrula(temel)
    try:
        v = json.loads(t.with_suffix(".json").read_text(encoding="utf-8"))["veri"]
        if not v.get("yazi"):
            abort(404)
        y = icerik_modulu.pdf_yaz(temel)
    except OSError:
        abort(404)
    except RuntimeError as e:
        return jsonify({"hata": str(e)}), 500
    ad = re.sub(r'[\\/:*?"<>|]+', " ", v.get("baslik") or temel)[:80].strip()
    return send_file(str(y), mimetype="application/pdf", as_attachment=request.args.get("indir") == "1", download_name=f"{ad}.pdf")
