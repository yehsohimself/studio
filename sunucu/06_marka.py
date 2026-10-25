# sunucu/06_marka.py — marka içerik paketi (markalar/<kod>/stil.json).
# site.py bu dosyayı diğer parçalarla AYNI ad alanında, numara sırasıyla yürütür; tek başına çalıştırılmaz.
# ----------------------------------------------------------------------------- marka içerik paketi
marka_durum = {}


@app.get("/api/markalar")
def markalar_get():
    import marka as marka_modulu
    return jsonify(marka_modulu.markalar())


@app.post("/api/marka-etiket/<temel>")
def marka_etiket(temel):
    tj = _temel_dogrula(temel).with_suffix(".json")
    v = request.get_json(silent=True) or {}
    kod = re.sub(r"[^a-z0-9_]", "", str(v.get("marka") or ""))[:40]
    d = json.loads(tj.read_text(encoding="utf-8"))
    if kod:
        d["veri"]["marka"] = kod
    else:
        d["veri"].pop("marka", None)
    with kilit:
        tj.write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8")
    return jsonify({"tamam": True, "marka": kod})


@app.post("/api/marka/<temel>")
def marka_uret(temel):
    """Seçilen parçaları arka planda üretir: {marka, secim: [kapak, youtube, blog, shorts]}"""
    tj = _temel_dogrula(temel).with_suffix(".json")
    v = request.get_json(silent=True) or {}
    kod = re.sub(r"[^a-z0-9_]", "", str(v.get("marka") or "finansal_terapi"))[:40]
    secim = [s for s in (v.get("secim") or []) if s in ("kapak", "youtube", "blog", "shorts", "kurgu", "linkedin", "instagram")]
    if not secim:
        return jsonify({"hata": "En az bir parça seçin."}), 400
    if marka_durum.get(temel, {}).get("calisiyor"):
        return jsonify({"hata": "Bu transkript için paket zaten hazırlanıyor."}), 409
    _marka_baslat(temel, kod, secim)
    return jsonify({"tamam": True})


def _marka_baslat(temel, kod, secim):
    """İçerik paketini arka planda üretir (elle düğmeyle ya da marka işi bitince kendiliğinden)."""
    tj = (KLASOR / temel).with_suffix(".json")
    if marka_durum.get(temel, {}).get("calisiyor"):
        return
    marka_durum[temel] = {"calisiyor": True, "log": [], "hata": "", "baslangic": time.time(), "secim": secim}

    def _calis():
        import marka as marka_modulu
        try:
            marka_modulu.uret(tj, kod, secim, log=lambda m: marka_durum[temel]["log"].append(m))
        except SystemExit as e:
            marka_durum[temel]["hata"] = str(e)
        except Exception as e:  # noqa: BLE001
            marka_durum[temel]["hata"] = str(e)
        marka_durum[temel]["calisiyor"] = False
        if not marka_durum[temel]["hata"]:
            _bildir("İçerik paketi hazır", temel)
            if "shorts" in secim and ayarlar_oku().get("marka_shorts_oto", True):
                try:
                    n = _marka_shorts_baslat(temel)
                    if n:
                        marka_durum[temel]["log"].append(f"{n} Shorts videosu sıraya alındı")
                except Exception as e:  # noqa: BLE001
                    marka_durum[temel]["log"].append(f"Shorts videoları başlatılamadı: {e}")
    threading.Thread(target=_calis, daemon=True).start()


def _marka_shorts_baslat(temel, zorla=False):
    """İçerik paketindeki Shorts kesitlerini hazır dikey videolar olarak kuyruğa alır: yüz takipli 9:16, kelime kelime
    altyazı, üstte markanın kapak stilinde kanca başlığı; kaynak en az 1080p. Döner: kuyruğa alınan iş sayısı."""
    js = KLASOR / f"{temel}.json"
    d = json.loads(js.read_text(encoding="utf-8")); veri = d["veri"]
    marka = veri.get("marka") or ""
    paket = (veri.get("marka_paket") or {}).get(marka) or {}
    kesitler = paket.get("shorts") or []
    if not kesitler or (paket.get("shorts_video") and not zorla):
        return 0
    stil = ayarlar_oku().get("shorts_altyazi_stil") or "pop"
    n = 0
    for i, k in enumerate(kesitler, 1):
        z = lambda x: f"{int(x) // 60}:{int(x) % 60:02d}"  # noqa: E731
        is_id = _video_isi_baslat({"islem": "klip", "temel": temel, "kesit": f"{z(k['bas'])}-{z(k['bit'] + 0.99)}", "dikey": True,
                                   "stil": stil, "kalite": "1080", "en_az": 1080, "kanca": k.get("shorts_baslik") or "",
                                   "kanca_stil": __import__("yakma").baslik_stili(marka), "baslik_ek": f"Shorts {i}"})
        if is_id:
            n += 1
    with kilit:
        d = json.loads(js.read_text(encoding="utf-8"))
        d["veri"].setdefault("marka_paket", {}).setdefault(marka, {})["shorts_video"] = time.time()
        js.write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8")
    return n


def _kapak_taslak(temel, video=None):
    try:
        import kapak as kapak_modulu
        video = video or _kaynak_video(temel, en_az=720)[0]
        if not video:
            return "Kaynak video yok; önce Shorts videoları oluşturulmalı (1080p iner)."
        kapak_modulu.taslaklar(KLASOR / f"{temel}.json", video, log=lambda m: print(m, flush=True))
        import marka as marka_modulu
        d = json.loads((KLASOR / f"{temel}.json").read_text(encoding="utf-8")); v = d["veri"]
        mk = v.get("marka") or ""
        if mk:
            p = (v.get("marka_paket") or {}).get(mk) or {}
            marka_modulu.belge_yaz(KLASOR / temel, v, marka_modulu.stil_yukle(mk), p, p.get("secim") or [])
        return ""
    except Exception as e:  # noqa: BLE001
        print(f"Kapak taslağı hatası: {e}", flush=True)
        return str(e)


@app.post("/api/marka-kapak/<temel>")
def marka_kapak(temel):
    _temel_dogrula(temel)
    h = _kapak_taslak(temel)
    return (jsonify({"hata": h}), 400) if h else jsonify({"tamam": True})


@app.get("/kapak-taslak/<ad>")
def kapak_taslak(ad):
    if not re.match(r"^[\w\-]+\.kapak\d\.png$", ad) or not (KLASOR / ad).exists():
        abort(404)
    return send_from_directory(str(KLASOR), ad, as_attachment=request.args.get("indir") == "1")


@app.post("/api/marka-shorts/<temel>")
def marka_shorts(temel):
    _temel_dogrula(temel)
    n = _marka_shorts_baslat(temel, zorla=True)
    return jsonify({"tamam": True, "sayi": n}) if n else (jsonify({"hata": "Bu pakette Shorts kesiti yok."}), 400)


@app.get("/api/marka-durum/<temel>")
def marka_durum_get(temel):
    tj = _temel_dogrula(temel).with_suffix(".json")
    d = marka_durum.get(temel) or {"calisiyor": False, "log": [], "hata": ""}
    veri = json.loads(tj.read_text(encoding="utf-8"))["veri"]
    return jsonify({**d, "marka": veri.get("marka", ""), "paket": (veri.get("marka_paket") or {}).get(veri.get("marka", ""))})


