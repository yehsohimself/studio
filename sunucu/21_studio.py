# sunucu/21_studio.py — Studio geliştirmeleri (2026-10-24; kullanıcı "küçük büyük bütün geliştirmeleri yap, kendi kendini besleyen bir yapıya kavuştur"):
# metni yerinde düzeltme (+ öğrenme), altyazı önizlemesi, hepsini zip olarak indirme, indirilenleri temizleme önerisi, yayın paketi, kurgular
# (metinden düzenleme), görüntü araması (sahne dizini), Content/Couple köprüsü, Studio gelişim döngüsü (araç güncellemeleri + gelişme takibi).
# site.py bu dosyayı diğer parçalarla AYNI ad alanında, numara sırasıyla yürütür; tek başına çalıştırılmaz.
import urllib.parse
import zipfile

studio_durum = {}            # ad → {calisiyor, log, hata, baslangic, son}
ERISIM = INDIRILENLER / ".erisim.json"
_erisim_bellek = {"d": None, "yazildi": 0}

OZELLIK_ADLARI.update({
    "/api/metin-duzelt/<temel>": "Metin düzeltme", "/api/yayin/<temel>": "Yayın paketi", "/api/yayin/<temel>/kapak": "Yayın paketi: kapak görselleri",
    "/api/yayin/<temel>/shorts": "Yayın paketi: Shorts videoları", "/api/yayin/<temel>/tercih": "Yayın paketi: beğeni", "/api/kurgu/<temel>": "Kurgu (metinden düzenleme)",
    "/api/sahne-dizin/<temel>": "Görüntü araması: dizine ekleme", "/api/indirilenler/temizle": "İndirilenleri temizleme",
    "/api/studio-gelisim/guncelle": "Studio: araç güncelleme", "/api/studio-gelisim/tara": "Studio: gelişim taraması",
})


def _disk_bos_gb():
    try:
        return shutil.disk_usage(str(KLASOR)).free / 1e9
    except Exception:  # noqa: BLE001
        return 99.0


def _studio_is(ad, fn, *arg, **kw):
    """Uzun Studio işini arka planda, ad başına tek kopya çalıştırır."""
    d = studio_durum.setdefault(ad, {})
    if d.get("calisiyor"):
        return False
    d.update({"calisiyor": True, "hata": "", "log": [], "baslangic": time.time()})

    def _calis():
        try:
            d["sonuc"] = fn(*arg, log=lambda m: d["log"].append(str(m)), **kw)
        except SystemExit as e:
            d["hata"] = str(e)
        except Exception as e:  # noqa: BLE001
            d["hata"] = str(e)[:300]; print(f"Studio {ad}: {e}", flush=True)
        finally:
            d["calisiyor"] = False; d["son"] = time.time()
    threading.Thread(target=_calis, daemon=True).start()
    return True


_mesgul_onceki = mesgul_nedenler


def mesgul_nedenler():   # noqa: F811 — Studio'nun arka plan işleri de yeniden başlatmayı bekletir
    return _mesgul_onceki() + [f"Studio: {ad.split(':')[0]}" for ad, d in list(studio_durum.items()) if d.get("calisiyor")]


# ----------------------------------------------------------------------------- 1) metni yerinde düzeltme
@app.post("/api/metin-duzelt/<temel>")
def metin_duzelt(temel):
    """Bir paragrafın metnini düzeltir {bas, bit, metin}; Word, metin ve altyazı yenilenir, kısa düzeltmelerden ad/terim öğrenilir."""
    import studio_duzelt
    t = _temel_dogrula(temel)
    v = request.get_json(force=True) or {}
    try:
        bas, bit = float(v.get("bas")), float(v.get("bit"))
    except (TypeError, ValueError):
        return jsonify({"hata": "Paragraf bilgisi eksik."}), 400
    yeni = re.sub(r"\s+", " ", str(v.get("metin") or "")).strip()
    with kilit:
        ham = t.with_suffix(".json").read_text(encoding="utf-8")
        d = json.loads(ham)
        eski_metin = " ".join(s["metin"] for s in d["segmentler"] if s["bas"] >= bas - 0.05 and s["bit"] <= bit + 0.05)
        try:
            r = studio_duzelt.paragraf_duzelt(d["segmentler"], bas, bit, yeni)
        except ValueError as e:
            return jsonify({"hata": str(e)}), 400
        if not r["degisen"]:
            return jsonify({"tamam": True, "degisen": 0})
        COP.mkdir(exist_ok=True)
        (COP / f"{temel}.onceki.json").write_text(ham, encoding="utf-8")
        d["veri"]["elle_duzenleme"] = time.time()
        ciktilari_yaz(t, d["veri"], d["segmentler"])
    ogrenilen = [] if d["veri"].get("misafir") else studio_duzelt.kaydet(temel, r["ciftler"], eski_metin)   # davetlinin düzeltmeleri sahibin sözlüğüne girmez
    if d["veri"].get("drive"):
        threading.Thread(target=_belge_yenile, args=(temel,), daemon=True).start()
    return jsonify({"tamam": True, "degisen": r["degisen"], "ogrenilen": ogrenilen})


@app.get("/api/studio-duzeltmeler")
def studio_duzeltmeler():
    import studio_duzelt
    return jsonify(studio_duzelt.ozet())


# ----------------------------------------------------------------------------- 2) altyazı önizlemesi (tek kare)
@app.get("/api/altyazi-onizle/<temel>")
def altyazi_onizle(temel):
    t = _temel_dogrula(temel)
    stil = request.args.get("stil") if request.args.get("stil") in ("kutu", "sade", "karaoke", "pop", "vurgu") else "kutu"
    dil = re.sub(r"[^a-z]", "", request.args.get("dil") or "")[:8] or "orijinal"
    font = re.sub(r"[^a-z]", "", request.args.get("font") or "")[:12]
    renk = re.sub(r"[^0-9a-fA-F]", "", request.args.get("renk") or "")[:6]
    dikey = request.args.get("dikey") == "1"
    try:
        sn = float(request.args.get("sn") or 0)
    except ValueError:
        sn = 0.0
    kaynak, veri = _kaynak_video(temel)
    imza = hashlib.sha1(f"{temel}|{stil}|{dil}|{font}|{renk}|{dikey}|{int(sn)}|{t.with_suffix('.json').stat().st_mtime}|{kaynak}".encode()).hexdigest()[:16]
    on = KLASOR / ".onbellek" / "onizle"
    on.mkdir(parents=True, exist_ok=True)
    hedef = on / f"{imza}.jpg"
    if not hedef.exists():
        kapak = KLASOR / f"{temel}.jpg"
        komut = [PYTHON, str(KLASOR / "studio_onizle.py"), str(t.with_suffix(".json")), str(hedef), "--sn", str(sn), "--stil", stil, "--dil", dil]
        if kaynak:
            komut += ["--video", str(kaynak)]
        elif kapak.exists():
            komut += ["--kapak", str(kapak)]
        else:
            return jsonify({"hata": "Önizleme için video ya da kapak yok."}), 404
        komut += (["--dikey"] if dikey else []) + (["--font", font] if font else []) + (["--renk", renk] if len(renk) == 6 else [])
        p = subprocess.run(komut, capture_output=True, text=True, timeout=60, cwd=str(KLASOR))
        if p.returncode != 0 or not hedef.exists():
            return jsonify({"hata": (p.stderr or p.stdout).strip().splitlines()[-1:] or ["Önizleme yapılamadı"]}), 500
        for f in sorted(on.glob("*.jpg"), key=lambda x: x.stat().st_mtime)[:-80]:
            f.unlink(missing_ok=True)
    return send_from_directory(str(on), hedef.name, max_age=3600)


# ----------------------------------------------------------------------------- 3) hepsini zip olarak indir
@app.get("/zip/<temel>.zip")
def hepsi_zip(temel):
    """Videodan çıkan bütün dosyalar tek zip: Word, metin, altyazılar, çeviriler, yayın paketi, kapaklar ve (?video=1) üretilen videolar."""
    t = _temel_dogrula(temel)
    _transkript_modulu.bekleyenleri_yaz(str(t))
    dosyalar = [f for f in KLASOR.glob(f"{temel}.*") if f.is_file() and not f.name.endswith((".tmp", "_tmp", ".lock"))
                and not re.search(r"\.(danisman)\.", f.name)]
    videolar = []
    if request.args.get("video") == "1":
        videolar = [INDIRILENLER / x["ad"] for x in _turemisler(temel) if (INDIRILENLER / x["ad"]).is_file()]
    d = json.loads(t.with_suffix(".json").read_text(encoding="utf-8"))["veri"]
    ad = re.sub(r"[^\w\s\-ğüşıöçĞÜŞİÖÇ]", "", (d.get("baslik") or temel))[:60].strip() or temel
    gecici = KLASOR / ".onbellek" / "zip"
    gecici.mkdir(parents=True, exist_ok=True)
    for f in gecici.glob("*.zip"):
        if time.time() - f.stat().st_mtime > 3600:
            f.unlink(missing_ok=True)
    hedef = gecici / f"{temel}_{int(time.time())}.zip"
    with zipfile.ZipFile(hedef, "w", zipfile.ZIP_DEFLATED) as z:
        for f in dosyalar:
            z.write(f, f"{ad}/{f.name.replace(temel, ad)}")
        for f in videolar:
            z.write(f, f"{ad}/videolar/{f.name}", compress_type=zipfile.ZIP_STORED)
    from flask import send_file
    return send_file(str(hedef), as_attachment=True, download_name=f"{ad}.zip")


# ----------------------------------------------------------------------------- 4) indirilenleri temizleme önerisi
def _erisim_oku():
    if _erisim_bellek["d"] is None:
        try:
            _erisim_bellek["d"] = json.loads(ERISIM.read_text(encoding="utf-8"))
        except Exception:  # noqa: BLE001
            _erisim_bellek["d"] = {}
    return _erisim_bellek["d"]


@app.after_request
def _indirilen_erisim(yanit):
    """İndirilen bir videonun en son ne zaman açıldığını (oynatma, kaydetme, okuma görünümündeki oynatıcı) tutar."""
    try:
        yol = request.path
        if yanit.status_code in (200, 206) and (yol.startswith("/indirilen/") or yol.startswith("/medya/")):
            if yol.startswith("/indirilen/"):
                ad = urllib.parse.unquote(yol[len("/indirilen/"):])
            else:
                k, _v = _kaynak_video(yol[len("/medya/"):])
                ad = k.name if k and Path(k).parent == INDIRILENLER else ""
            if ad:
                d = _erisim_oku(); d[ad] = time.time()
                if time.time() - _erisim_bellek["yazildi"] > 30:
                    ERISIM.write_text(json.dumps(d, ensure_ascii=False), encoding="utf-8"); _erisim_bellek["yazildi"] = time.time()
    except Exception:  # noqa: BLE001
        pass
    return yanit



def temizlik_onerisi(gun=30, en_az_mb=40):
    """30 gündür açılmamış, 40 MB'tan büyük indirilenler (süren bir işin kaynağı olanlar hariç)."""
    if not INDIRILENLER.exists():
        return {"dosyalar": [], "toplam": 0}
    dizin, eris = _dizin_oku(), _erisim_oku()
    kullanilan = {Path(str(i.get("dosya") or "")).name for i in list(isler.values()) if i.get("durum") in ("sirada", "calisiyor")}
    sinir = time.time() - gun * 86400
    out = []
    for f in INDIRILENLER.iterdir():
        if not f.is_file() or f.name.startswith(".") or f.name in kullanilan:
            continue
        b = f.stat().st_size
        son = max(eris.get(f.name, 0), (dizin.get(f.name) or {}).get("olusturma") or f.stat().st_mtime)
        if b >= en_az_mb * 1024 * 1024 and son < sinir:
            out.append({"ad": f.name, "boyut": b, "son": son, "baslik": (dizin.get(f.name) or {}).get("baslik") or f.stem})
    out.sort(key=lambda x: -x["boyut"])
    return {"dosyalar": out, "toplam": sum(x["boyut"] for x in out), "gun": gun}


@app.get("/api/indirilenler/temizlik")
def indirilenler_temizlik():
    return jsonify(temizlik_onerisi())


@app.post("/api/indirilenler/temizle")
def indirilenler_temizle():
    v = request.get_json(force=True) or {}
    oneri = {x["ad"] for x in temizlik_onerisi()["dosyalar"]}
    tasinan = []
    COP.mkdir(exist_ok=True)
    for ad in v.get("dosyalar") or []:
        if ad in oneri and (INDIRILENLER / ad).is_file():
            shutil.move(str(INDIRILENLER / ad), str(COP / f"indirilen__{ad}"))
            tasinan.append(ad)
    return jsonify({"tamam": True, "dosyalar": tasinan})


# ----------------------------------------------------------------------------- 5) yayın paketi
def _kaynak_indir(temel, en_az=720, log=print):
    """Kaynak video yoksa 720p indirir (indirilenlere kaydeder). Döner: yol ya da None."""
    k, veri = _kaynak_video(temel, en_az=en_az)
    if k:
        return k
    link = (veri or {}).get("link") or ""
    if not re.match(r"^https?://", link):
        k, _ = _kaynak_video(temel)
        return k
    if _disk_bos_gb() < 3:
        raise SystemExit(f"Diskte yer az ({_disk_bos_gb():.1f} GB); kaynak video indirilmedi.")
    log("Kaynak video indiriliyor (720p)...")
    p = subprocess.run([PYTHON, "-u", str(INDIR_SCRIPT), link, "--kalite", "720", "--klasor", str(INDIRILENLER)],
                       capture_output=True, text=True, timeout=3600, cwd=str(KLASOR))
    m = re.search(r"Bitti\. Dosya: (.+)", p.stdout)
    if not m or not Path(m.group(1).strip()).is_file():
        raise SystemExit("Kaynak video indirilemedi.")
    _indirme_bitir({"dosya": m.group(1).strip(), "link": link, "baslik": veri.get("baslik") or temel, "kanal": veri.get("kanal", ""),
                    "kalite": "720", "sure": veri.get("sure", 0), "kapak": _kapak_yolu(temel, veri.get("kapak")), "platform": veri.get("platform", ""), "log": []})
    return Path(m.group(1).strip())


def _yayin_uret(temel, marka="", kapak=True, log=print):
    import yayin
    p = yayin.uret(KLASOR / f"{temel}.json", marka, log=log)
    if kapak and p.get("kapak"):
        try:
            video = _kaynak_indir(temel, 720, log=log)
            if video:
                yayin.kapak_gorselleri(KLASOR / f"{temel}.json", video, log=log)
        except SystemExit as e:
            log(f"Kapak görselleri çizilemedi: {e}")
    _bildir("Yayın paketi hazır", (json.loads((KLASOR / f"{temel}.json").read_text(encoding="utf-8"))["veri"].get("baslik") or temel)[:80])
    return True


@app.post("/api/yayin/<temel>")
def yayin_baslat(temel):
    _temel_dogrula(temel)
    v = request.get_json(silent=True) or {}
    marka = re.sub(r"[^a-z0-9_]", "", str(v.get("marka") or ""))[:40]
    if not _studio_is(f"yayin:{temel}", _yayin_uret, temel, marka, kapak=v.get("kapak", True)):
        return jsonify({"hata": "Bu video için yayın paketi zaten hazırlanıyor."}), 409
    return jsonify({"tamam": True})


@app.post("/api/yayin/<temel>/kapak")
def yayin_kapak(temel):
    _temel_dogrula(temel)

    def _kapak(temel, log=print):
        import yayin
        video = _kaynak_indir(temel, 720, log=log)
        if not video:
            raise SystemExit("Kaynak video yok.")
        return yayin.kapak_gorselleri(KLASOR / f"{temel}.json", video, log=log)
    if not _studio_is(f"yayin:{temel}", _kapak, temel):
        return jsonify({"hata": "Bu video için yayın paketi hazırlanıyor."}), 409
    return jsonify({"tamam": True})


@app.get("/api/yayin-durum/<temel>")
def yayin_durum(temel):
    t = _temel_dogrula(temel)
    d = studio_durum.get(f"yayin:{temel}") or {}
    veri = json.loads(t.with_suffix(".json").read_text(encoding="utf-8"))["veri"]
    import yayin
    import claude_yaz
    m, _ = ({}, {}) if claude_yaz.misafir() else yayin.markalar()
    return jsonify({"calisiyor": bool(d.get("calisiyor")), "hata": d.get("hata", ""), "log": (d.get("log") or [])[-4:], "paket": veri.get("yayin"),
                    "markalar": [{"kod": k, "ad": x.get("ad")} for k, x in m.items()], "onerilen_marka": "" if claude_yaz.misafir() else yayin.marka_sec(veri),
                    "aciklama_tam": yayin.youtube_aciklama(veri.get("yayin") or {}) if veri.get("yayin") else ""})


@app.post("/api/yayin/<temel>/tercih")
def yayin_tercih(temel):
    """Beğendim / beğenmedim (nedeniyle) ya da kopyalandı: sonraki paketlerin istemine 'geçmiş tercihler' olarak girer."""
    t = _temel_dogrula(temel)
    v = request.get_json(force=True) or {}
    parca = re.sub(r"[^a-z_]", "", str(v.get("parca") or ""))[:20]
    veri = json.loads(t.with_suffix(".json").read_text(encoding="utf-8"))["veri"]
    if veri.get("misafir"):
        return jsonify({"tamam": True})                     # davetlinin beğenileri sahibin tercihlerine karışmaz
    import yayin
    iyi = v.get("iyi")
    yayin.tercih_ekle({"temel": temel, "kanal": veri.get("kanal") or "", "marka": (veri.get("yayin") or {}).get("marka") or "", "parca": parca,
                       "metin": str(v.get("metin") or "")[:400], "iyi": None if iyi is None else bool(iyi), "not": str(v.get("not") or "")[:300],
                       "kopya": bool(v.get("kopya"))})
    return jsonify({"tamam": True})


@app.post("/api/yayin/<temel>/shorts")
def yayin_shorts(temel):
    """Paketteki Shorts kesitlerini dikey, yüz takipli, kelime kelime altyazılı videolar olarak kuyruğa alır (üstte kanca başlığı)."""
    js = _temel_dogrula(temel).with_suffix(".json")
    veri = json.loads(js.read_text(encoding="utf-8"))["veri"]
    kesitler = (veri.get("yayin") or {}).get("shorts") or []
    if not kesitler:
        return jsonify({"hata": "Pakette Shorts kesiti yok."}), 400
    v = request.get_json(silent=True) or {}
    sec = [int(i) for i in (v.get("secim") or range(len(kesitler))) if str(i).isdigit() and int(i) < len(kesitler)]
    stil = ayarlar_oku().get("shorts_altyazi_stil") or "pop"
    z = lambda x: f"{int(x) // 60}:{int(x) % 60:02d}"  # noqa: E731
    n = 0
    for i in sec:
        k = kesitler[i]
        if _video_isi_baslat({"islem": "klip", "temel": temel, "kesit": f"{z(k['bas'])}-{z(k['bit'] + 0.99)}", "dikey": True, "stil": stil,
                              "kalite": "1080", "en_az": 1080, "kanca": k.get("shorts_baslik") or "", "kanca_stil": "sade", "baslik_ek": f"Shorts {i + 1}"}):
            n += 1
    return jsonify({"tamam": True, "sayi": n})


@app.get("/yayin-kapak/<ad>")
def yayin_kapak_gorsel(ad):
    if not re.match(r"^[\w\-]+\.yayin_kapak\d\.png$", ad) or not (KLASOR / ad).exists():
        abort(404)
    return send_from_directory(str(KLASOR), ad, as_attachment=request.args.get("indir") == "1")


_zincir_onceki = _zincir


def _zincir(is_):   # noqa: F811 — kendi videolarınızda (yerel dosya) yayın paketi kendiliğinden
    _zincir_onceki(is_)
    try:
        temel = is_.get("temel")
        link = str(is_.get("link") or "")
        kendi = bool(link) and not re.match(r"^https?://", link) and "/.atolye/" not in link and "/kayitlar/" not in link
        if temel and kendi and not (is_.get("toplanti") or is_.get("couple") or is_.get("ghost") or is_.get("marka")) \
                and ayarlar_oku().get("yayin_oto", True):
            import claude_yaz
            if claude_yaz.hazir() and claude_yaz.arka_plan_uygun():
                _studio_is(f"yayin:{temel}", _yayin_uret, temel, "")
    except Exception as e:  # noqa: BLE001
        print(f"Yayın paketi kendiliğinden başlatılamadı: {e}", flush=True)


# ----------------------------------------------------------------------------- 6) kurgular (metinden düzenleme)
@app.get("/api/kurgu/<temel>")
def kurgu_liste(temel):
    t = _temel_dogrula(temel)
    return jsonify(json.loads(t.with_suffix(".json").read_text(encoding="utf-8"))["veri"].get("kurgular") or [])


@app.post("/api/kurgu/<temel>")
def kurgu_kaydet(temel):
    """{ad, tut: [[bas, bit], ...] (sırasıyla), id?} kaydeder; {sil: id} siler; {olustur: id, dikey, altyazisiz, stil} videosunu kuyruğa alır."""
    t = _temel_dogrula(temel)
    v = request.get_json(force=True) or {}
    with kilit:
        d = json.loads(t.with_suffix(".json").read_text(encoding="utf-8"))
        K = d["veri"].setdefault("kurgular", [])
        if v.get("sil"):
            d["veri"]["kurgular"] = [k for k in K if k.get("id") != v["sil"]]
        elif v.get("tut") is not None:
            tut = [[round(float(a), 2), round(float(b), 2)] for a, b in (v.get("tut") or []) if float(b) - float(a) >= 0.05][:400]
            if not tut:
                return jsonify({"hata": "Kurguda hiç bölüm yok."}), 400
            kid = re.sub(r"[^\w]", "", str(v.get("id") or ""))[:16] or uuid.uuid4().hex[:8]
            k = {"id": kid, "ad": str(v.get("ad") or "Kurgu").strip()[:60], "tut": tut, "zaman": time.time(),
                 "sure": round(sum(b - a for a, b in tut), 1),
                 "sira": [int(i) for i in (v.get("sira") or []) if str(i).isdigit()][:2000],        # düzenleyiciye geri yüklemek için
                 "cikan": [int(i) for i in (v.get("cikan") or []) if str(i).isdigit()][:2000]}
            d["veri"]["kurgular"] = [x for x in K if x.get("id") != kid] + [k]
        t.with_suffix(".json").write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8")
        K = d["veri"]["kurgular"]
    if v.get("olustur"):
        if _disk_bos_gb() < 2:
            return jsonify({"hata": f"Diskte yer az ({_disk_bos_gb():.1f} GB). Önce yer açın (Kitaplık → İndirilenler)."}), 507
        k = next((x for x in K if x.get("id") == v["olustur"]), None)
        if not k:
            return jsonify({"hata": "Kurgu bulunamadı."}), 404
        sirali = any(k["tut"][i][0] < k["tut"][i - 1][0] for i in range(1, len(k["tut"])))
        is_id = _video_isi_baslat({"islem": "kesim", "temel": temel, "tut": ",".join(f"{a:.2f}-{b:.2f}" for a, b in k["tut"]), "sirali": sirali,
                                   "dikey": bool(v.get("dikey")), "altyazisiz": bool(v.get("altyazisiz")), "stil": v.get("stil") or "kutu",
                                   "baslik_ek": k["ad"], "kalite": "720"})
        return jsonify({"tamam": True, "is": is_id, "kurgular": K})
    return jsonify({"tamam": True, "kurgular": K})


# ----------------------------------------------------------------------------- 7) görüntü araması
@app.get("/api/sahne-ara")
def sahne_ara():
    import sahne_dizin
    q = (request.args.get("q") or "").strip()[:200]
    if not q:
        return jsonify({"sonuclar": [], "durum": sahne_dizin.durum()})
    s = sahne_dizin.akilli_ara(q) if request.args.get("akilli") == "1" else sahne_dizin.ara(q)
    return jsonify({"sonuclar": s, "durum": sahne_dizin.durum()})


@app.get("/api/sahne-durum/<temel>")
def sahne_durum(temel):
    import sahne_dizin
    _temel_dogrula(temel)
    d = sahne_dizin.oku(temel)
    return jsonify({"var": bool(d), "sayi": len((d or {}).get("sahneler") or []), "calisiyor": bool((studio_durum.get(f"sahne:{temel}") or {}).get("calisiyor")),
                    "hata": (studio_durum.get(f"sahne:{temel}") or {}).get("hata", "")})


def _sahne_dizinle(temel, indir=False, log=print):
    import sahne_dizin
    video = _kaynak_indir(temel, 0, log=log) if indir else _kaynak_video(temel)[0]
    return sahne_dizin.dizinle(temel, video, log=log)


@app.post("/api/sahne-dizin/<temel>")
def sahne_dizin_ekle(temel):
    _temel_dogrula(temel)
    if not _studio_is(f"sahne:{temel}", _sahne_dizinle, temel, indir=True):
        return jsonify({"hata": "Bu video zaten dizine ekleniyor."}), 409
    return jsonify({"tamam": True})


def _sahne_adayi():
    """Dizinde olmayan, kaynak videosu bilgisayarda duran (ya da senaryo kareleri çıkarılmış) en yeni Studio videosu."""
    import sahne_dizin
    var = {p.stem for p in sahne_dizin.DIZIN.glob("*.json")} if sahne_dizin.DIZIN.exists() else set()
    import kitaplik_onbellek
    for kayit in sorted(kitaplik_onbellek.hepsi(), key=lambda k: -k["mtime"])[:200]:   # 2026-10-25: önbellekli (190 ms → ~2 ms)
        js, v = kayit["yol"], kayit["veri"]
        if js.stem in var:
            continue
        if v.get("toplanti") or v.get("atolye") or v.get("couple") or v.get("misafir") or "/.atolye/" in str(v.get("link") or ""):
            continue
        if v.get("goruntu") or _kaynak_video(js.stem)[0]:
            return js.stem
    return None


# ----------------------------------------------------------------------------- 8) Studio gelişim döngüsü
STUDIO_AYARLARI = ("sahne_dizini", "yayin_oto")


@app.post("/api/studio-ayar")
def studio_ayar():
    """Studio'ya özel aç/kapa ayarları (genel /api/ayarlar yalnız tanıdığı anahtarları yazıyor)."""
    v = request.get_json(force=True) or {}
    with kilit:
        d = ayarlar_oku()
        for k in STUDIO_AYARLARI:
            if k in v:
                d[k] = bool(v[k])
        if "ozet_bicim" in v:                      # 2026-10-27: yeni videoların özet biçimi (kisa | ayrintili | madde | "")
            import ozet as _oz
            d["ozet_bicim"] = str(v["ozet_bicim"]) if str(v["ozet_bicim"]) in _oz.BICIMLER else ""
        ayarlar_yaz(d)
    return jsonify({"tamam": True, **{k: d.get(k, True) for k in STUDIO_AYARLARI}, "ozet_bicim": d.get("ozet_bicim", "")})



@app.get("/api/studio-gelisim")
def studio_gelisim_get():
    import studio_gelisim
    d = studio_gelisim.durum()
    d["calisiyor"] = {ad: True for ad, x in studio_durum.items() if ad.startswith("gelisim") and x.get("calisiyor")}
    d["son_hata"] = {ad: x.get("hata") for ad, x in studio_durum.items() if ad.startswith("gelisim") and x.get("hata")}
    try:
        import studio_duzelt
        d["duzeltme"] = studio_duzelt.ozet()
    except Exception:  # noqa: BLE001
        pass
    try:
        import sahne_dizin
        d["sahne"] = sahne_dizin.durum()
    except Exception:  # noqa: BLE001
        pass
    d["temizlik"] = {k: v for k, v in temizlik_onerisi().items() if k != "dosyalar"}
    d["hatalar"] = globals().get("_hatalar", {"sayi": 0, "son": []})
    try:
        import yedek
        d["yedek"] = {"son": yedek.son(), "liste": yedek.yedekler()[:3], "sirlar": (KLASOR / ".yedek" / "sirlar.json").exists()}
    except Exception:  # noqa: BLE001
        d["yedek"] = {}
    a = ayarlar_oku()
    d["ayar"] = {k: a.get(k, True) for k in ("sahne_dizini", "yayin_oto")}
    return jsonify(d)


def _gelisim_tara(log=print):
    import studio_gelisim
    studio_gelisim.araclar(zorla=True, log=log)
    studio_gelisim.takip(zorla=True, log=log)
    return studio_gelisim.ozdegerlendirme(zorla=True, log=log)


@app.post("/api/studio-gelisim/tara")
def studio_gelisim_tara():
    if not _studio_is("gelisim:tara", _gelisim_tara):
        return jsonify({"hata": "Tarama sürüyor."}), 409
    return jsonify({"tamam": True})


@app.post("/api/studio-gelisim/guncelle")
def studio_gelisim_guncelle():
    import studio_gelisim
    paket = str((request.get_json(force=True) or {}).get("paket") or "")
    if paket not in studio_gelisim.ARACLAR:
        return jsonify({"hata": "Bilinmeyen araç."}), 400
    if any(i.get("durum") == "calisiyor" for i in list(isler.values())):
        return jsonify({"hata": "Şu an bir iş sürüyor; güncelleme iş bitince yapılabilir."}), 409
    if not _studio_is(f"gelisim:guncelle:{paket}", lambda log=print: studio_gelisim.guncelle(paket, log=log)):
        return jsonify({"hata": "Güncelleme sürüyor."}), 409
    return jsonify({"tamam": True})


@app.post("/api/studio-gelisim/oneri")
def studio_gelisim_oneri():
    import studio_gelisim
    v = request.get_json(force=True) or {}
    x = studio_gelisim.oneri_karar(str(v.get("id") or ""), bool(v.get("kabul")))
    return jsonify({"tamam": bool(x)})


def _kapak_tamamla(en_cok=30):
    """Kapağı olmayan videolara kapak (2026-10-29; kitaplıkta 70 video gri kutuyla görünüyordu): YouTube kimliği linkte ya da indirilen dosyanın
    adında ([YouTube-xxxx]) varsa YouTube'un küçük resmi, bilgisayardaki video dosyasıysa 3. saniyedeki kare. Toplantılar kapak kullanmaz."""
    import kitaplik_onbellek
    import requests
    n = 0
    for x in kitaplik_onbellek.hepsi():
        v, temel = x["veri"], x["temel"]
        hedef = KLASOR / f"{temel}.jpg"
        if n >= en_cok or v.get("toplanti") or hedef.exists():
            continue
        link = str(v.get("link") or "")
        m = re.search(r"\[YouTube-([\w-]{11})\]", link) or re.search(r"(?:youtu\.be/|[?&]v=|/shorts/)([\w-]{11})", link)
        try:
            if m:
                for boy in ("maxresdefault", "hqdefault"):
                    r = requests.get(f"https://i.ytimg.com/vi/{m.group(1)}/{boy}.jpg", timeout=15)
                    if r.ok and len(r.content) > 5000:
                        hedef.write_bytes(r.content); n += 1
                        break
            elif Path(link).suffix.lower() in (".mp4", ".mov", ".m4v", ".webm", ".mkv") and Path(link).exists():
                subprocess.run([FFMPEG, "-y", "-v", "error", "-ss", "3", "-i", link, "-frames:v", "1", "-vf", "scale=1280:-2", str(hedef)],
                               capture_output=True, timeout=60)
                n += hedef.exists()
        except Exception:  # noqa: BLE001
            hedef.unlink(missing_ok=True)
    return n


def _studio_isaret(ad, anahtar):
    """Günde/haftada bir işler için işaret dosyası (kayitlar/.gg_<ad>): anahtar değiştiyse True ve yazar. (19_ghost_gelisim'deki _gg_isaret ile aynı;
    Studio tek başına kurulduğunda Ghost olmayabilir, 2026-10-25.)"""
    f = KAYIT / f".gg_{ad}"
    if f.exists() and f.read_text(encoding="utf-8") == anahtar:
        return False
    f.write_text(anahtar, encoding="utf-8")
    return True


def _studio_gece_deneme(dublaj_da=False):
    """Studio'nun asıl zincirini sabit sentetik örnek videoyla dener (duman_testi.py studio; pazar geceleri dublaj da). Sorun varsa bildirim.
    2026-10-25: Ghost oturumunun 19'daki `_studio_gece_testi`'sinden devralındı (Studio ayrı depo; zamanlama bu döngüde, 05.00-07.00 site boşken)."""
    kat = "studio_dublaj" if dublaj_da else "studio"
    r = subprocess.run(["nice", "-n", "10", "/usr/bin/caffeinate", "-i", str(KLASOR / ".venv" / "bin" / "python"), str(KLASOR / "duman_testi.py"), kat],
                       capture_output=True, text=True, timeout=3600, cwd=str(KLASOR))
    try:
        h = json.loads((KAYIT / ".duman.json").read_text(encoding="utf-8")).get(kat, {}).get("hatalar") or []
    except Exception:  # noqa: BLE001
        h = ["sonuç okunamadı"]
    if h:
        _bildir(f"Studio gece testi: {len(h)} sorun", h[0][:150])
    print(f"Studio gece testi ({kat}): {'geçti' if not h else '; '.join(h)[:300]}", flush=True)
    return {"hatalar": h, "cikis": r.returncode}


def _studio_dongu():
    """Studio'nun kendini besleyen döngüsü. Her 10 dk: boştayken bir videoyu görüntü dizinine ekler. Gece 03.30-05.30: kendiliğinden
    güncellenen araçlar (deneme + geri dönüş). Pazartesi 08.30'dan sonra: araç taraması, gelişme takibi ve haftalık öz değerlendirme."""
    time.sleep(150)
    while True:
        try:
            import claude_yaz
            simdi = time.localtime()
            bos = not any(i.get("durum") in ("sirada", "calisiyor") and "/.atolye/" not in str(i.get("link") or "") for i in list(isler.values())) \
                and not any(x.get("calisiyor") for x in studio_durum.values())
            if bos and ayarlar_oku().get("sahne_dizini", True) and claude_yaz.arka_plan_uygun() and _disk_bos_gb() >= 8:
                temel = _sahne_adayi()
                if temel:
                    _studio_is(f"sahne:{temel}", _sahne_dizinle, temel)
            try:                                           # 2 günden eski, hiçbir sıradaki/süren işe bağlı olmayan yüklemeler (2026-10-25 gözden geçirme: temizlik yoktu)
                kullanilan = {str(i.get("link") or "") for i in list(isler.values()) if i.get("durum") in ("sirada", "calisiyor")}
                for f in (KLASOR / "yuklemeler").glob("*"):
                    if f.is_file() and str(f) not in kullanilan and time.time() - f.stat().st_mtime > 2 * 86400:
                        f.unlink()
            except Exception:  # noqa: BLE001
                pass
            if bos and _studio_isaret("studio_kapak", time.strftime("%Y-%m-%d-%H")):   # saatte bir: kapağı olmayan videolar
                try:
                    _kapak_tamamla()
                except Exception:  # noqa: BLE001
                    pass
            if _studio_isaret("studio_jsonl", time.strftime("%Y-%m-%d")):      # 2026-10-25: büyüyen ekleme dosyaları 5 MB'ı aşınca döndürülür
                for f in (KAYIT / ".claude_kullanim.jsonl", KAYIT / "uzanti_olaylar.jsonl", KAYIT / "canli_notlar.jsonl", KAYIT / ".kalite.jsonl"):
                    try:
                        if f.exists() and f.stat().st_size > 5_000_000:
                            f.replace(f.with_name(f.name + ".1"))
                    except OSError:
                        pass
            if bos and (3, 30) <= (simdi.tm_hour, simdi.tm_min) <= (5, 30) and _studio_isaret("studio_gece", time.strftime("%Y-%m-%d")):
                import studio_gelisim
                _studio_is("gelisim:gece", lambda log=print: studio_gelisim.otomatik_guncelle(log=log))
            if bos and _studio_isaret("studio_surum", time.strftime("%Y-%m-%d-%H")):   # saatte bir: araç dışarıdan güncellendiyse dene (2026-10-27)
                import studio_gelisim
                def _surum_dene(log=print):
                    for k in studio_gelisim.surum_degisimi_dene(log=log):
                        if not k["tamam"]:
                            _bildir("Studio", f"{k['ne']} {k['yeni']} sürümüyle denemeden geçmedi. Ayarlar → Sistem → Studio gelişimi")
                _studio_is("gelisim:surum", _surum_dene)
            if bos and (5, 0) <= (simdi.tm_hour, simdi.tm_min) <= (7, 0) and _studio_isaret("studio_gece_deneme", time.strftime("%Y-%m-%d")):
                _studio_is("gece testi", lambda log=print, _p=(simdi.tm_wday == 6): _studio_gece_deneme(_p))
            if bos and simdi.tm_wday == 0 and (simdi.tm_hour, simdi.tm_min) >= (8, 30) and _studio_isaret("studio_hafta", time.strftime("%G-%V")):
                _studio_is("gelisim:tara", _gelisim_tara)
                threading.Thread(target=lambda: (time.sleep(900), _bildir("Studio", "Haftalık gelişim raporu hazır: Ayarlar → Sistem")), daemon=True).start()
        except Exception as e:  # noqa: BLE001
            print(f"Studio döngüsü: {e}", flush=True)
        time.sleep(600)


threading.Thread(target=_studio_dongu, daemon=True).start()


@app.get("/api/harf")
def harf_get():
    """Büyük harf kuralı için kullanıcının markaları (ayarlar.json harf_tr / harf_en; sayfalardaki TR/EN kümelerine eklenir). Kodda marka adı yok (2026-10-25)."""
    a = ayarlar_oku()
    return jsonify({"tr": [str(x).lower() for x in (a.get("harf_tr") or [])], "en": [str(x).lower() for x in (a.get("harf_en") or [])]})

# ----------------------------------------------------------------------------- 9) ilk açılış denetimi (2026-10-27)
# GitHub'dan yeni kuran biri ilk videoda "ffmpeg yok", "Claude bağlı değil" gibi hatalarla karşılaşmasın: ana sayfa eksikleri tek kartta gösterir.
_kurulum_onb = {"t": 0, "d": None}


@app.get("/api/kurulum")
def kurulum_durum():
    if _kurulum_onb["d"] and time.time() - _kurulum_onb["t"] < 60 and not request.args.get("yenile"):
        return jsonify(_kurulum_onb["d"])
    import claude_yaz
    adim = []
    var = lambda ad, yol: bool(shutil.which(ad) or Path(yol).exists())   # noqa: E731
    adim.append({"kod": "ffmpeg", "ad": "Ses ve video aracı (ffmpeg)", "tamam": var("ffmpeg", FFMPEG), "zorunlu": True,
                 "nasil": "Terminal'de çalıştırın:", "komut": "brew install ffmpeg"})
    adim.append({"kod": "deno", "ad": "YouTube indirme yardımcısı (deno)", "tamam": var("deno", "/opt/homebrew/bin/deno"), "zorunlu": False,
                 "nasil": "YouTube linkleri için gerekli. Terminal'de:", "komut": "brew install deno"})
    model_ok, iniyor = _model_var("turbo"), bool(model_iniyor.get("turbo"))
    adim.append({"kod": "model", "ad": "Ses tanıma modeli (~1,6 GB)", "tamam": model_ok, "zorunlu": False, "iniyor": iniyor,
                 "nasil": "İlk videoda kendiliğinden iner; şimdiden indirirseniz ilk iş beklemez.", "eylem": "model"})
    try:
        c = claude_yaz.durum()
    except Exception:  # noqa: BLE001
        c = {"program": False, "giris": False}
    try:
        olla = ozet_modulu.ollama_hazir()
    except Exception:  # noqa: BLE001
        olla = False
    yazi_ok = bool(c.get("giris")) or olla
    adim.append({"kod": "yazi", "ad": "Özet ve çeviri için yapay zekâ", "tamam": yazi_ok, "zorunlu": False,
                 "durum": "Claude" if c.get("giris") else ("Bilgisayardaki model (Ollama)" if olla else ""),
                 "nasil": ("Claude hesabınızla bir kez giriş yapın." if c.get("program") else
                           "Claude masaüstü uygulamasını kurup giriş yapın ya da bilgisayarda çalışan bir model kurun:"),
                 "komut": "" if c.get("program") else "brew install ollama && brew services start ollama && ollama pull gemma3:4b",
                 "eylem": "claude" if c.get("program") else ""})
    bos = _disk_bos_gb()
    adim.append({"kod": "disk", "ad": "Boş disk alanı", "tamam": bos >= 5, "zorunlu": False, "durum": f"{bos:.0f} GB",
                 "nasil": "Videolar ve modeller için en az 5 GB boş alan gerekir."})
    d = {"hazir": all(a["tamam"] for a in adim if a["zorunlu"]), "eksik": sum(not a["tamam"] for a in adim), "adimlar": adim}
    _kurulum_onb.update(t=time.time(), d=d)
    return jsonify(d)


# ----------------------------------------------------------------------------- paylaşıma hazırla (2026-10-27; kapanan Content'ten taşındı)
@app.post("/api/indirilen-paylas/<path:dosya>")
def indirilen_paylas(dosya):
    import paylas_video
    kaynak = _indirilen_dogrula(dosya)
    if kaynak.suffix.lower() in (".mp3", ".m4a"):
        return jsonify({"hata": "Bu bir ses dosyası."}), 400
    hedef = kaynak.with_name(f"{kaynak.stem} [Reels-TikTok-Shorts].mp4")
    i = 2
    while hedef.exists():
        hedef = kaynak.with_name(f"{kaynak.stem} [Reels-TikTok-Shorts]_{i}.mp4"); i += 1
    try:
        r = paylas_video.hazirla(kaynak, hedef)
    except (ValueError, RuntimeError) as e:
        return jsonify({"hata": str(e)}), 400
    with kilit:
        d = _dizin_oku()
        d[hedef.name] = {**d.get(kaynak.name, {}), "kalite": "paylas", "zaman": time.time()}
        _dizin_yaz(d)
    return jsonify({"dosya": hedef.name, **r})
