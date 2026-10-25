"""Kitaplıkta görüntü araması (Studio, 2026-10-24).

Her videonun sahne karelerini bir kez çıkarır (goruntu.incele: sahne değişimleri, ekrandaki yazı, Claude ile kısa betim) ve
`kayitlar/sahne_dizin/<temel>.json`'a yazar; kareler `kareler/<temel>/k_*.jpg` (sitede /kare/...). Senaryo için zaten
incelenmiş videolarda (veri["goruntu"]) yeniden çıkarılmaz.

ara(q): kelime kökü eşleşmesi (5 harf, Türkçe küçük harf) betim + ekran yazısı + videonun başlığı üzerinde.
akilli_ara(q): bütün betimler Claude'a (sonnet) verilir, anlamca en uygun 12 sahne (ör. "dışarıda çekilmiş sahneler",
"logonun göründüğü anlar"). Kendi arşivinizi B-roll ve referans kaynağına çevirir.

Elle: python sahne_dizin.py dizinle <temel> <video>  |  ara "<sorgu>"  |  durum
"""
import json
import re
import sys
import time
from pathlib import Path

KLASOR = Path(__file__).resolve().parent
DIZIN = KLASOR / "kayitlar" / "sahne_dizin"


def _kucuk(s):
    return str(s or "").replace("I", "ı").replace("İ", "i").lower()


def _kokler(s):
    return {w[:5] for w in re.findall(r"[^\W\d_]{3,}|\d{2,}", _kucuk(s))}


def _misafir_id():
    try:
        import claude_yaz
        return (claude_yaz.misafir() or {}).get("id") or ""
    except Exception:  # noqa: BLE001
        return ""


def oku(temel):
    try:
        return json.loads((DIZIN / f"{temel}.json").read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return None


def _yaz(temel, d):
    DIZIN.mkdir(parents=True, exist_ok=True)
    tmp = DIZIN / f"{temel}.tmp"
    tmp.write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8")
    tmp.replace(DIZIN / f"{temel}.json")


def hepsi():
    if not DIZIN.exists():
        return []
    out = []
    for f in sorted(DIZIN.glob("*.json")):
        try:
            d = json.loads(f.read_text(encoding="utf-8"))
        except Exception:  # noqa: BLE001
            continue
        if (KLASOR / f"{d.get('temel')}.json").exists() and (d.get("misafir") or "") == _misafir_id():   # silinmiş transkript ve başkasının (sahip/misafir) sahneleri aranmaz
            out.append(d)
    return out


def dizinle(temel, video=None, log=print):
    """Videonun sahnelerini dizine ekler. video yoksa yalnız veri['goruntu'] kullanılabilir. Döner: sahne sayısı."""
    js = KLASOR / f"{temel}.json"
    veri = json.loads(js.read_text(encoding="utf-8"))["veri"]
    sahneler = veri.get("goruntu") or []
    if not sahneler:
        if not video or not Path(video).is_file():
            raise SystemExit("Kaynak video yok.")
        import goruntu
        sahneler = goruntu.incele(video, KLASOR / "kareler" / temel, float(veri.get("sure") or 0), "tr", betim=True, log=log)   # betim hep Türkçe: aramalar Türkçe
    sahneler = [{"sn": float(s.get("sn") or 0), "kare": s.get("kare") or "", "yazi": [str(y) for y in (s.get("yazi") or [])][:8],
                 "aciklama": str(s.get("aciklama") or "")} for s in sahneler if s.get("kare")]
    _yaz(temel, {"temel": temel, "baslik": veri.get("baslik") or temel, "kanal": veri.get("kanal") or "", "zaman": time.time(), "misafir": veri.get("misafir") or "",
                 "betimli": sum(1 for s in sahneler if s["aciklama"]), "sahneler": sahneler})
    log(f"Sahne dizini: {len(sahneler)} sahne")
    return len(sahneler)


def _sonuc(d, s, puan):
    return {"temel": d["temel"], "baslik": d.get("baslik") or d["temel"], "sn": s["sn"], "kare": s["kare"],
            "aciklama": s.get("aciklama") or "", "yazi": " · ".join(s.get("yazi") or [])[:160], "puan": puan}


def ara(q, n=24):
    k = _kokler(q)
    if not k:
        return []
    out = []
    for d in hepsi():
        bk = _kokler(d.get("baslik"))
        for s in d.get("sahneler") or []:
            sk = _kokler(s.get("aciklama")) | _kokler(" ".join(s.get("yazi") or []))
            ortak = len(k & sk) * 2 + len(k & bk) * 0.5
            if ortak >= 2 or (len(k) == 1 and k & sk):
                out.append(_sonuc(d, s, ortak))
    out.sort(key=lambda x: -x["puan"])
    return out[:n]


def akilli_ara(q, n=12):
    """Claude'a bütün sahne betimleri verilir; anlamca en uygun sahneler döner."""
    import claude_yaz
    if not claude_yaz.hazir():
        return ara(q, n)
    satirlar, harita = [], {}
    for d in hepsi():
        for s in d.get("sahneler") or []:
            if not (s.get("aciklama") or s.get("yazi")):
                continue
            i = len(harita) + 1
            harita[i] = (d, s)
            satirlar.append(f"{i}| {d.get('baslik', '')[:50]} | {s.get('aciklama', '')[:220]}" + (f" | yazı: {' · '.join(s.get('yazi') or [])[:80]}" if s.get("yazi") else ""))
            if len(satirlar) >= 3000:
                break
    if not satirlar:
        return []
    istem = (f"Aşağıda video kitaplığındaki sahnelerin kısa betimleri var (numara | video | betim | ekrandaki yazı). Arama: \"{q}\".\n"
             f"Bu aramaya anlamca en uygun en çok {n} sahnenin numarasını en uygundan başlayarak ver; gerçekten uymayanları verme. "
             "Yalnızca JSON: {\"sonuclar\": [{\"no\": 12, \"neden\": \"çok kısa\"}]}\n\n" + "\n".join(satirlar))
    try:
        c = claude_yaz.sor_json(istem, "Sen bir video arşivcisisin; kısa ve kesin seçersin.", zaman_asimi=240)
    except Exception:  # noqa: BLE001
        return ara(q, n)
    out = []
    for r in c.get("sonuclar") or []:
        try:
            d, s = harita[int(r.get("no"))]
        except (KeyError, TypeError, ValueError):
            continue
        x = _sonuc(d, s, 10 - len(out)); x["neden"] = str(r.get("neden") or "")[:120]
        out.append(x)
    return out[:n]


def durum():
    h = hepsi()
    return {"video": len(h), "sahne": sum(len(d.get("sahneler") or []) for d in h), "betimli": sum(d.get("betimli") or 0 for d in h)}


if __name__ == "__main__":
    a = sys.argv[1:]
    if a[:1] == ["dizinle"]:
        print(dizinle(a[1], a[2] if len(a) > 2 else None))
    elif a[:1] == ["ara"]:
        print(json.dumps(akilli_ara(a[1]) if "--akilli" in a else ara(a[1]), ensure_ascii=False, indent=1))
    else:
        print(durum())
