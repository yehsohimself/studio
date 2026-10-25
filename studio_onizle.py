"""Altyazı görünümü önizlemesi (Studio, 2026-10-24): videodan tek kare + seçilen stilde altyazı → jpg.
Video üretmeden önce Kutu / Sade / Karaoke / Pop / Vurgu, yazı tipi, renk ve yatay/dikey seçiminin nasıl görüneceğini gösterir.

Kullanım: python studio_onizle.py X.json cikti.jpg --sn 42 --stil pop [--dil en] [--dikey] [--font avenir] [--renk ffcc00] [--video v.mp4]
Video yoksa kapak görseli kullanılır. AppKit çizimi yakma.py'nin kendi işlevleriyle (videodakiyle birebir aynı görünüm).
"""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

import yakma

FFMPEG = "/opt/homebrew/bin/ffmpeg"


def kare_al(video, kapak, sn, hedef):
    if video and Path(video).is_file():
        p = subprocess.run([FFMPEG, "-y", "-v", "error", "-ss", f"{max(0, sn):.2f}", "-i", str(video), "-frames:v", "1", str(hedef)],
                           capture_output=True, timeout=30)
        if p.returncode == 0 and hedef.exists():
            return True
    if kapak and Path(kapak).is_file():
        subprocess.run([FFMPEG, "-y", "-v", "error", "-i", str(kapak), "-frames:v", "1", str(hedef)], capture_output=True, timeout=30)
        return hedef.exists()
    return False


def main():
    a = sys.argv[1:]
    js, cikti = Path(a[0]), Path(a[1])
    sec = {"--sn": "0", "--stil": "kutu", "--dil": None, "--font": None, "--renk": None, "--video": None, "--kapak": None}
    dikey = "--dikey" in a
    for i, x in enumerate(a):
        if x in sec and i + 1 < len(a):
            sec[x] = a[i + 1]
    sn = float(sec["--sn"])
    stil = sec["--stil"] if sec["--stil"] in ("kutu", "sade", "karaoke", "pop", "vurgu") else "kutu"
    yakma.SECIM["font"] = sec["--font"] if sec["--font"] in yakma.YAZI_TIPLERI else None
    yakma.SECIM["renk"] = yakma._hex(sec["--renk"]) if sec["--renk"] else None
    veri = json.loads(js.read_text(encoding="utf-8"))["veri"]
    yakma.TURKCE = (veri.get("dil") or "tr") == "tr" and (sec["--dil"] in (None, "orijinal", "tr"))
    cueler, _ = yakma.cueler_json(js, sec["--dil"])
    if not cueler:
        raise SystemExit("HATA: Altyazı yok.")
    c = next((c for c in cueler if c["bas"] <= sn <= c["bit"]), None) or min(cueler, key=lambda c: abs(c["bas"] - sn))
    orta = (c["bas"] + c["bit"]) / 2
    gecici = Path(tempfile.mkdtemp(prefix="onizle_"))
    kare = gecici / "kare.png"
    if not kare_al(sec["--video"], sec["--kapak"], orta, kare):
        raise SystemExit("HATA: Kare alınamadı.")
    bilgi = yakma.video_bilgi(kare)
    w, h = bilgi["w"] or 1280, bilgi["h"] or 720
    vf = ""
    if dikey and w / h > 0.57:
        cw = int(h * 9 / 16) // 2 * 2
        vf = f"crop={cw}:{h}:(iw-{cw})/2:0,"
        w = cw
    olcek = 1280 / max(w, h)                             # önizleme için uzun kenar 1280
    W, H = int(w * olcek) // 2 * 2, int(h * olcek) // 2 * 2
    vf += f"scale={W}:{H}"
    png = gecici / "alt.png"
    if stil in yakma.KELIME_STILLERI:
        st = yakma.KELIME_STILLERI[stil]
        kel = [k for _b, _e, k in (c.get("kelimeler") or [])] or c["metin"].split()
        gr = st["grup"]
        if gr:                                             # pop: kelimenin bulunduğu üçlü
            i = len(kel) // 2
            kel = kel[(i // gr) * gr:(i // gr) * gr + gr]
        yakma._png_ciz_kelime(W, H, kel, len(kel) // 2, png, stil)
    else:
        yakma._png_ciz(W, H, c.get("satirlar") or yakma._satira_bol(c["metin"]), png, stil)
    p = subprocess.run([FFMPEG, "-y", "-v", "error", "-i", str(kare), "-i", str(png), "-filter_complex", f"[0:v]{vf}[a];[a][1:v]overlay=0:0",
                        "-frames:v", "1", "-q:v", "3", str(cikti)], capture_output=True, text=True, timeout=30)
    if p.returncode != 0:
        raise SystemExit("HATA: " + p.stderr[-300:])
    print(json.dumps({"sn": round(orta, 2), "metin": c["metin"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
