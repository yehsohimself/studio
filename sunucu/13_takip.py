# sunucu/13_takip.py — kanal takibi.
# site.py bu dosyayı diğer parçalarla AYNI ad alanında, numara sırasıyla yürütür; tek başına çalıştırılmaz.
# ----------------------------------------------------------------------------- takip
def _takip_isle(kanal, videolar):
    for vid in videolar:
        if _mevcut_kayit(vid["id"], vid["url"]):
            continue
        ozet_modu = kanal.get("islem", "ozet") == "ozet"
        _baslat({"link": vid["url"], "ozet": True, "konusmaci": not ozet_modu, "ozet_modu": ozet_modu, "takip": kanal.get("ad", "")})


def _takip_dongu():
    while True:
        time.sleep(1800)
        try:
            with app.app_context():                      # jsonify için
                for k in takip_modulu.oku()["kanallar"]:
                    if k.get("otomatik") and time.time() - k.get("son_kontrol", 0) > (3600 if takip_modulu._rss_adresi(k) else 6 * 3600):
                        try:
                            kanal, yeni = takip_modulu.kontrol(k["id"])
                            _takip_isle(kanal, yeni)
                        except Exception:  # noqa: BLE001
                            continue
        except Exception:  # noqa: BLE001
            pass


threading.Thread(target=_takip_dongu, daemon=True).start()


