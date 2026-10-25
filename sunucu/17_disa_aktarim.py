# sunucu/17_disa_aktarim.py — künye ve salt okunur dışa aktarım.
# site.py bu dosyayı diğer parçalarla AYNI ad alanında, numara sırasıyla yürütür; tek başına çalıştırılmaz.
# --- Künye ve salt okunur dışa aktarım (2026-10-23, ChatGPT brifi Ortak 3-4) ---------------------------------------------------------
_surum_onb = {}


def _surum_zamaninda(ts):
    """Kaydın işlendiği andaki Video Hub sürümü (yerel git): kısa kod + tarih. Yeni kayıtlarda veri['surum'] zaten yazılı."""
    anahtar = int(ts or 0) // 600
    if anahtar not in _surum_onb:
        try:
            r = subprocess.run(["git", "-C", str(KLASOR), "log", "-1", f"--before={int(ts or time.time())}", "--format=%h %cs"],
                               capture_output=True, text=True, timeout=5)
            p = r.stdout.split()
            _surum_onb[anahtar] = {"kod": p[0], "tarih": p[1]} if len(p) == 2 else None
        except Exception:  # noqa: BLE001
            _surum_onb[anahtar] = None
    return _surum_onb[anahtar]


def _model_adi(m):
    m = str(m or "")
    return {"claude:sonnet": "Claude Sonnet", "claude:opus": "Claude Opus", "large-v3-turbo": "Whisper large-v3 turbo",
            "large-v3": "Whisper large-v3"}.get(m, m.replace("claude:", "Claude "))


def _kunye(temel, veri):
    """Okuma ekranındaki 'Bu kayıt hakkında' satırları: kaynak, ne zaman işlendi, son değişiklik, hangi yöntem/model, hangi sürüm."""
    js = KLASOR / f"{temel}.json"
    link = veri.get("link") or ""
    if veri.get("toplanti"):
        kaynak = {"tur": "toplantı kaydı", "ad": veri.get("uygulama") or "kayıt", "link": ""}
    elif link.startswith("http"):
        pf = str(veri.get("platform") or "")
        kaynak = {"tur": {"youtube": "YouTube", "tiktok": "TikTok", "instagram": "Instagram", "vimeo": "Vimeo"}.get(pf.lower(), pf or "bağlantı"),
                  "ad": veri.get("kanal") or "", "link": link}
    else:
        kaynak = {"tur": "dosya", "ad": Path(link).name if link else "", "link": ""}
    satir = [{"ad": "Yazıya döküldü", "zaman": veri.get("olusturma"), "deger": veri.get("kaynak") or _model_adi(veri.get("model"))}]
    oz = veri.get("ozet") if isinstance(veri.get("ozet"), dict) else None
    if oz:
        satir.append({"ad": "Özet", "deger": _model_adi(oz.get("model"))})
    if veri.get("temizlik"):
        satir.append({"ad": "Ad ve terim düzeltmesi", "deger": f"{len((veri['temizlik'] or {}).get('ornekler') or [])} düzeltme"})
    ks = veri.get("kisaca") or {}
    if ks:
        satir.append({"ad": "Kısaca", "zaman": ks.get("zaman"), "deger": _model_adi(ks.get("model"))})
    for d, c in (veri.get("ceviriler") or {}).items():
        satir.append({"ad": f"Çeviri ({d.upper()})", "zaman": c.get("tarih"), "deger": _model_adi(c.get("model"))})
    if (veri.get("danisman") or {}).get("zaman"):
        satir.append({"ad": "Size özel not", "zaman": veri["danisman"].get("zaman"), "deger": _model_adi(veri["danisman"].get("model"))})
    try:
        son = js.stat().st_mtime
    except OSError:
        son = None
    return {"kaynak": kaynak, "islenme": veri.get("olusturma"), "son_degisiklik": son, "satirlar": satir,
            "surum": veri.get("surum") or _surum_zamaninda(veri.get("olusturma")), "surum_simdi": _surum_zamaninda(time.time())}


def _disa_veri(temel):
    """Salt okunur, sade şema: başka araçlar (ChatGPT, Notion, kendi betikleriniz) okusun diye. Ham dosyanın iç alanları yok."""
    d = json.loads((KLASOR / f"{temel}.json").read_text(encoding="utf-8"))
    v = d["veri"]
    par = paragrafla(d["segmentler"], v.get("etiket") or {})
    oz = v.get("ozet") if isinstance(v.get("ozet"), dict) else {}
    ks = v.get("kisaca") or {}
    kn = _kunye(temel, v)
    tarih = lambda t: time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(t)) if t else None  # noqa: E731
    return {
        "sema": "video-hub/kayit@1", "temel": temel, "baslik": v.get("baslik") or temel, "tur": "toplanti" if v.get("toplanti") else "video",
        "kaynak": kn["kaynak"], "dil": v.get("dil"), "sure_sn": round(v.get("sure") or 0),
        "islenme": tarih(kn["islenme"]), "son_degisiklik": tarih(kn["son_degisiklik"]), "disa_aktarim": tarih(time.time()),
        "surum": kn["surum"], "uretim": [{**s, "zaman": tarih(s.get("zaman"))} for s in kn["satirlar"]],
        "sirket": v.get("sirket") or None, "musteri": v.get("musteri") or None, "katilimcilar": v.get("katilimcilar") or [],
        "konusmacilar": sorted({p["ad"] for p in par}),
        "kisaca": " ".join(ks.get("ozet") or []) or None,
        "ozet": oz.get("ozet") or None, "one_cikanlar": oz.get("maddeler") or [],
        "kararlar": [{"karar": k.get("karar"), "kim": k.get("kim") or None, "sn": k.get("sn"), "alinti": k.get("alinti") or None,
                      "zincir": k.get("zincir") or [], "sonra": k.get("sonra") or []} for k in ks.get("kararlar") or []] or
                    [{"karar": k} for k in oz.get("kararlar") or []],
        "isler": [{"kim": p.get("ad"), "is": x.get("is"), "ne_zaman": x.get("ne_zaman") or None, "bitti": bool(x.get("bitti")), "sn": x.get("sn")}
                  for p in ks.get("kisiler") or [] for x in p.get("isler") or []],
        "bolumler": oz.get("bolumler") or [],
        "paragraflar": [{"sn": int(p["bas"]), "zaman": _zaman(p["bas"], True), "konusmaci": p["ad"], "metin": p["metin"]} for p in par],
    }


@app.get("/disa/kitaplik.<bicim>")
def disa_kitaplik(bicim):
    """Kitaplığın salt okunur dizini: son N gün (?gun=30), toplantılar ve videolar; her kayıt için tam dışa aktarım adresi."""
    if bicim not in ("md", "json"):
        abort(404)
    try:
        gun = max(1, min(3650, int(request.args.get("gun") or 30)))
    except ValueError:
        gun = 30
    sinir = time.time() - gun * 86400
    L = []
    for js in KLASOR.glob("transkript_*.json"):
        try:
            if js.stat().st_mtime < sinir:
                continue
            v = json.loads(js.read_text(encoding="utf-8"))["veri"]
        except Exception:  # noqa: BLE001
            continue
        if (v.get("olusturma") or 0) < sinir or v.get("atolye") or "/.atolye/" in str(v.get("link") or "") or v.get("onay_bekliyor"):
            continue
        ks = v.get("kisaca") or {}
        oz = v.get("ozet") if isinstance(v.get("ozet"), dict) else {}
        L.append({"temel": js.stem, "baslik": v.get("baslik") or js.stem, "tur": "toplanti" if v.get("toplanti") else "video",
                  "islenme": time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(v.get("olusturma") or 0)), "sure_sn": round(v.get("sure") or 0),
                  "kaynak": v.get("link") if str(v.get("link") or "").startswith("http") else None, "sirket": v.get("sirket") or None,
                  "musteri": v.get("musteri") or None, "ozet": (" ".join(ks.get("ozet") or []) or oz.get("ozet") or "")[:600] or None,
                  "md": f"/disa/{js.stem}.md", "json": f"/disa/{js.stem}.json"})
    L.sort(key=lambda o: o["islenme"], reverse=True)
    if bicim == "json":
        return Response(json.dumps({"sema": "video-hub/kitaplik@1", "gun": gun, "disa_aktarim": time.strftime("%Y-%m-%dT%H:%M:%S"), "kayitlar": L},
                                   ensure_ascii=False, indent=1), mimetype="application/json; charset=utf-8")
    md = [f"# Video Hub kitaplığı · son {gun} gün", "", f"{len(L)} kayıt · dışa aktarıldı {time.strftime('%Y-%m-%d %H:%M')} (salt okunur)", ""]
    for o in L:
        md += [f"## {o['baslik']}", f"- {o['islenme'][:16].replace('T', ' ')} · {'toplantı' if o['tur'] == 'toplanti' else 'video'}"
               + (f" · {o['kaynak']}" if o["kaynak"] else ""), f"- Tam kayıt: {request.host_url.rstrip('/')}{o['md']}", "", (o["ozet"] or ""), ""]
    return Response("\n".join(md), mimetype="text/markdown; charset=utf-8")


@app.get("/indir/<dosya>")
def indir(dosya):
    m = re.match(r"^([\w\-]+)\.(txt|docx|srt|senaryo\.docx|senaryo\.txt|notlar\.txt|[a-z]{2,3}\.(?:srt|docx|txt)|[a-z_]{4,30}\.(?:docx|txt))$", dosya)
    _transkript_modulu.bekleyenleri_yaz(str(KLASOR / m.group(1))) if m else None   # ertelenmiş docx/srt varsa önce yazılır
    if not m or not (KLASOR / dosya).exists():
        abort(404)
    ad = m.group(1)
    try:
        veri = json.loads((KLASOR / f"{ad}.json").read_text(encoding="utf-8"))["veri"]
        baslik = re.sub(r'[\\/:*?"<>|]+', " ", veri.get("baslik") or ad).strip()[:80]
    except Exception:  # noqa: BLE001
        baslik = ad
    uz = m.group(2)
    etiket = {"senaryo.docx": "Senaryo.docx", "senaryo.txt": "Senaryo.txt", "brief.docx": "Brief.docx", "finansal_terapi.docx": "İçerik paketi.docx",
              "danisman.docx": "Danışman notu (kişisel).docx", "danisman.txt": "Danışman notu (kişisel).txt"}.get(uz, f"Transkript.{uz}")
    if uz == "srt":
        etiket = "Altyazi.srt"
    mm = re.match(r"^([a-z]{2,3})\.(srt|docx|txt)$", uz)
    if mm:
        etiket = {"srt": "Altyazi", "docx": "Ceviri", "txt": "Ceviri"}[mm.group(2)] + f" {mm.group(1).upper()}.{mm.group(2)}"
    return send_from_directory(str(KLASOR), dosya, as_attachment=True, download_name=f"{baslik} – {etiket}")


@app.get("/disa/<temel>.<uz>")
def disa_aktar(temel, uz):
    """Ek çıktı biçimleri: vtt (web altyazısı), md (Obsidian/Notion için Markdown: künye, özet, kararlar, bölümler, konuşmacılı metin) ve
    json (salt okunur sade şema `video-hub/kayit@1`, başka araçlar okusun diye). Tarayıcıda açılır; ?indir=1 ile dosya olarak iner (vtt hep iner)."""
    t = _temel_dogrula(temel)
    if uz not in ("vtt", "md", "json"):
        abort(404)
    if uz == "json":
        r = make_response(json.dumps(_disa_veri(temel), ensure_ascii=False, indent=1))
        r.headers["Content-Type"] = "application/json; charset=utf-8"
        if request.args.get("indir"):
            from urllib.parse import quote
            r.headers["Content-Disposition"] = f"attachment; filename*=UTF-8''{quote(temel + '.json')}"
        return r
    vt = json.loads(t.with_suffix(".json").read_text(encoding="utf-8"))
    v = vt["veri"]
    baslik = re.sub(r'[\\/:*?"<>|]+', " ", v.get("baslik") or temel).strip()[:80]
    if uz == "vtt":
        srt = t.with_suffix(".srt")
        if not srt.exists():
            abort(404)
        govde = "WEBVTT\n\n" + re.sub(r"(\d{2}:\d{2}:\d{2}),(\d{3})", r"\1.\2", srt.read_text(encoding="utf-8"))
        tip, etiket = "text/vtt", "Altyazi.vtt"
    else:
        link = v.get("link") or ""
        yt = re.search(r"(?:youtu\.be/|v=|shorts/)([\w-]{11})", link)
        def zl(sn):
            z = _zaman(sn, sn >= 3600)
            return f"[{z}](https://youtu.be/{yt.group(1)}?t={int(sn)})" if yt else z
        oz = v.get("ozet") if isinstance(v.get("ozet"), dict) else {}
        kn = _kunye(temel, v); ks = v.get("kisaca") or {}
        tz = lambda x: time.strftime("%Y-%m-%d %H:%M", time.localtime(x)) if x else ""  # noqa: E731
        L = ["---", f'title: "{baslik}"', f"source: {link}" if link.startswith("http") else None,
             f"date: {time.strftime('%Y-%m-%d', time.localtime(v.get('olusturma') or t.with_suffix('.json').stat().st_mtime))}",
             f"processed: {tz(kn['islenme'])}", f"updated: {tz(kn['son_degisiklik'])}", f"exported: {tz(time.time())}",
             f"video_hub: {kn['surum']['kod']} ({kn['surum']['tarih']})" if kn.get("surum") else None,
             f"duration: {int((v.get('sure') or 0) // 60)} dk", f"speakers: [{', '.join(sorted(set(v.get('etiket', {}).values())))}]",
             f"tags: [{'meeting' if v.get('toplanti') else 'transcript'}]", "---", "", f"# {baslik}", "",
             "> Salt okunur kopya; asıl kayıt Video Hub'da. Üretim: " + "; ".join(f"{x['ad']}: {x['deger']}" for x in kn["satirlar"] if x.get("deger")), ""]
        if ks.get("ozet"):
            L += ["## Kısaca", ""] + [p + "\n" for p in ks["ozet"]]
        if oz.get("ozet"):
            L += ["## Özet", "", oz["ozet"], ""]
        if oz.get("maddeler"):
            L += ["## Öne çıkanlar", ""] + [f"- {x}" for x in oz["maddeler"]] + [""]
        if ks.get("kararlar"):
            L += ["## Kararlar", ""]
            for k in ks["kararlar"]:
                L.append(f"- {k.get('karar')}" + (f" ({k['kim']})" if k.get("kim") else "") + (f" · {zl(k['sn'])}" if k.get("sn") is not None else ""))
                L += [f"  - ↳ {_zincir_metni(z)}" for z in [dict(z, yon="once") for z in k.get("zincir") or []] + [dict(z, yon="sonra") for z in k.get("sonra") or []]]
            L.append("")
        elif oz.get("kararlar"):
            L += ["## Kararlar", ""] + [f"- {x}" for x in oz["kararlar"]] + [""]
        if ks.get("kisiler"):
            L += ["## İşler", ""] + [f"- [{'x' if x.get('bitti') else ' '}] {p.get('ad')}: {x.get('is')}" + (f" ({x['ne_zaman']})" if x.get("ne_zaman") else "")
                                     for p in ks["kisiler"] for x in p.get("isler") or []] + [""]
        elif oz.get("yapilacaklar"):
            L += ["## Yapılacaklar", ""] + [f"- [ ] {x}" for x in oz["yapilacaklar"]] + [""]
        if oz.get("bolumler"):
            L += ["## Bölümler", ""] + [f"- {zl(b.get('sn', 0))} {b.get('baslik', '')}" for b in oz["bolumler"]] + [""]
        L += ["## Transkript", ""]
        for p in paragrafla(vt["segmentler"], v["etiket"]):
            L += [f"**{p['ad']}** · {zl(p['bas'])}  ", p["metin"], ""]
        govde, tip, etiket = "\n".join(x for x in L if x is not None), "text/markdown", "Transkript.md"
    r = make_response(govde)
    r.headers["Content-Type"] = tip + "; charset=utf-8"
    if uz == "vtt" or request.args.get("indir"):
        from urllib.parse import quote
        r.headers["Content-Disposition"] = f"attachment; filename*=UTF-8''{quote(baslik + ' – ' + etiket)}"
    return r


