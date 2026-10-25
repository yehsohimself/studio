# sunucu/00_baslangic.py — içe aktarmalar, yollar, ortak durum (app, isler, kilit, kuyruklar).
# site.py bu dosyayı diğer parçalarla AYNI ad alanında, numara sırasıyla yürütür; tek başına çalıştırılmaz.
import collections
import datetime
import hashlib
import json
import os
import queue
import re
import shutil
import subprocess
import sys
import threading
import time
import urllib.request
import uuid
from pathlib import Path

from flask import Flask, Response, abort, jsonify, make_response, redirect, request, send_from_directory, stream_with_context

KLASOR = Path(__file__).resolve().parent
PYTHON = sys.executable
SCRIPT = KLASOR / "transkript.py"
ISIMLENDIR = KLASOR / "isimlendir.py"
INDIR_SCRIPT = KLASOR / "indir.py"
YAKMA_SCRIPT = KLASOR / "yakma.py"
FFMPEG = "/opt/homebrew/bin/ffmpeg"
CEVIRI_SCRIPT = KLASOR / "ceviri.py"
INDIRILENLER = KLASOR / "indirilenler"
INDIR_DIZIN = INDIRILENLER / ".dizin.json"
KALITELER = ("mp3", "360", "480", "720", "1080", "en")
ISLER_DOSYASI = KLASOR / ".isler.json"
COP = KLASOR / ".cop"
GUNCELLEME_IZI = KLASOR / ".son_guncelleme"
HF = Path.home() / ".cache" / "huggingface" / "hub"
MODEL_KLASORLERI = {"turbo": ("models--mlx-community--whisper-large-v3-turbo", "models--mobiuslabsgmbh--faster-whisper-large-v3-turbo"),
                    "best": ("models--mlx-community--whisper-large-v3-mlx", "models--Systran--faster-whisper-large-v3")}
HIZ = {"turbo": 4.0, "best": 1.5}    # çözüm: video dakikası / işlem dakikası (grafik işlemci, bu bilgisayarda ölçüldü)
HIZ_KONUSMACI = 400.0                 # konuşmacı ayırma: video dakikası / işlem dakikası
HIZ_OZET = 11.5                       # özet: video dakikası / işlem dakikası
PORT = 8765

sys.path.insert(0, str(KLASOR))
from transkript import link_duzelt, paragrafla, ciktilari_yaz, hayalet_temizle, _zincir_metni  # noqa: E402
import transkript as _transkript_modulu  # noqa: E402
_transkript_modulu.ERTELE_SN = 2.0            # sitede docx/srt gecikmeli (transkript.ciktilari_yaz); indirme/zip/dışa aktarma önce bekleyenleri yazar
import ozet as ozet_modulu  # noqa: E402
import sor as sor_modulu  # noqa: E402
import takip as takip_modulu  # noqa: E402

AYARLAR_DOSYASI = KLASOR / "ayarlar.json"
VARSAYILAN_AYARLAR = {"ozet": True, "ozet_dili": "tr", "ag_paylasimi": False, "drive": True, "drive_klasor": "Toplantılar",
                      "drive_yol": str(Path.home() / "Desktop" / "Drive"), "oto_kayit": True,
                      "musteriler": [], "sozluk": [], "takvim_ics": "",
                      "benim_epostalar": [], "notlar_gonder": True}
KAYIT = KLASOR / "kayitlar"
RCLONE = Path("/opt/homebrew/bin/rclone")
DRIVE_REMOTE = "gdrive"


def ayarlar_oku():
    """Ayarlar + Anahtar Zinciri'ndeki sırlar (gizli.py). Dosyada sır kalmışsa ilk okumada Anahtar Zinciri'ne taşınır."""
    import gizli
    try:
        d = json.loads(AYARLAR_DOSYASI.read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001
        d = {}
    d2, degisti = gizli.goc(d)
    if degisti:
        AYARLAR_DOSYASI.write_text(json.dumps(d2, ensure_ascii=False, indent=1), encoding="utf-8")
    return {**VARSAYILAN_AYARLAR, **gizli.birlestir(d2)}


def ayarlar_yaz(d):
    import gizli
    AYARLAR_DOSYASI.write_text(json.dumps(gizli.ayir(d), ensure_ascii=False, indent=1), encoding="utf-8")


def yerel_ip():
    import socket
    try:
        sk = socket.socket(socket.AF_INET, socket.SOCK_DGRAM); sk.connect(("8.8.8.8", 80))
        ip = sk.getsockname()[0]; sk.close(); return ip
    except Exception:  # noqa: BLE001
        return "127.0.0.1"

# ---- Varsayılan zaman aşımları (2026-10-25 gözden geçirme: 94 `subprocess.run` ve 10 `requests` çağrısı zaman aşımsızdı; asılı kalan bir
# ffmpeg/osascript/rclone bir iş parçacığını sonsuza dek kilitleyebiliyordu). Yalnız site sürecinde: timeout verilmemişse 3 saat; stdin
# verilmemişse kapalı (ffmpeg klavye bekleyip takılmasın). Açıkça verilen değerler değişmez.
import functools as _functools
_run_asil = subprocess.run


@_functools.wraps(_run_asil)
def _run_varsayilan(*a, **k):
    k.setdefault("timeout", 3 * 3600)
    if "stdin" not in k and "input" not in k:
        k["stdin"] = subprocess.DEVNULL
    return _run_asil(*a, **k)


subprocess.run = _run_varsayilan
try:
    import requests as _requests
    _istek_asil = _requests.Session.request

    @_functools.wraps(_istek_asil)
    def _istek_varsayilan(self, *a, **k):
        k.setdefault("timeout", 60)
        return _istek_asil(self, *a, **k)
    _requests.Session.request = _istek_varsayilan
except Exception:  # noqa: BLE001
    pass

app = Flask(__name__, static_folder=str(KLASOR / "static"), static_url_path="/static")


@app.after_request
def _cors(resp):
    if request.path.startswith("/api/") and str(request.environ.get("SERVER_PORT")) != "8770":   # 8770 (davetli kapısı, internete açık) hariç; 2026-10-25
        resp.headers["Access-Control-Allow-Origin"] = "*"
        resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
        resp.headers["Access-Control-Allow-Methods"] = "GET, POST, DELETE, OPTIONS"
    return resp


@app.route("/api/<path:_yol>", methods=["OPTIONS"])
def _preflight(_yol):
    return ("", 204)
app.config["MAX_CONTENT_LENGTH"] = 4 * 1024 ** 3     # 4 GB

isler = {}
sira = queue.Queue()
sira_indir = queue.Queue()      # indirmeler ayrı kuyrukta: saatlik bir çözümün arkasında beklemesinler
kilit = threading.Lock()
onizleme_bellek = {}




# ---- Kapanış (2026-10-25): launchd SIGTERM gönderince süren işlerin alt süreç grupları da durdurulur (eskiden yetim transkript.py/ffmpeg
# çalışmaya devam ediyor, açılışta aynı iş yeniden sıraya girip ikinci kez çalışıyordu); iş listesi son haliyle yazılır.
import signal as _signal


def _kapanis(_sig, _frame):
    try:
        for i in list(isler.values()):
            p = i.get("p")
            if p is not None and p.poll() is None:
                try:
                    os.killpg(os.getpgid(p.pid), _signal.SIGTERM)
                except Exception:  # noqa: BLE001
                    pass
        try:
            _kaydet()
        except Exception:  # noqa: BLE001
            pass
    finally:
        os._exit(0)


try:
    _signal.signal(_signal.SIGTERM, _kapanis)
except Exception:  # noqa: BLE001
    pass
