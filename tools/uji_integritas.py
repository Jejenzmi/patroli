"""Uji penjagaan keaslian: lokasi palsu ditolak namun tercatat, perpindahan
mustahil tertangkap di server, dan akun terikat pada satu perangkat."""
import json, urllib.request, urllib.error, sys, time

BASE = "https://dashboard.dharmapati.co.id/api"
ok = fail = 0

def call(method, path, token=None, body=None):
    req = urllib.request.Request(BASE + path, method=method)
    req.add_header("Content-Type", "application/json")
    if token: req.add_header("Authorization", "Bearer " + token)
    data = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(req, data, timeout=40) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"null")

def cek(nama, syarat, ket=""):
    global ok, fail
    if syarat: ok += 1; print(f"  ✓ {nama}")
    else: fail += 1; print(f"  ✗ {nama} — {ket}")

PONSEL_A = {"deviceId": "uji-ponsel-A", "fingerprint": "Samsung|SM-A155F|a15|exynos|34",
            "label": "Samsung SM-A155F", "platform": "android", "osVersion": "Android 14",
            "appVersion": "1.4.0+5", "isPhysical": True}
PONSEL_B = {"deviceId": "uji-ponsel-B", "fingerprint": "Xiaomi|2201117TY|fleur|mt6781|33",
            "label": "Xiaomi Redmi Note 11", "platform": "android", "osVersion": "Android 13",
            "appVersion": "1.4.0+5", "isPhysical": True}

def masuk(u, p, platform="mobile", device=None):
    body = {"username": u, "password": p, "platform": platform}
    if device is not None: body["device"] = device
    return call("POST", "/auth/login", body=body)

adm_s, adm_r = masuk("admin", "admin123", "web")
adm = adm_r["token"]

# Bersihkan seluruh ikatan perangkat akun uji lebih dulu. Penandanya tidak
# selalu berawalan 'uji-' — sesi pemotretan panduan meninggalkan penanda acak.
s, daftar = call("GET", "/users/devices/list", adm)
for d in (daftar if isinstance(daftar, list) else []):
    if d.get("user", {}).get("username") == "guard1":
        call("DELETE", f"/users/devices/{d['id']}", adm)

print("── Pengikatan perangkat ──")
s, r = masuk("guard1", "guard123", "mobile", PONSEL_A)
cek("masuk pertama mengikat ponsel", s == 200, (s, r))
grd = r.get("token")
me = r.get("user", {})

s, r = masuk("guard1", "guard123", "mobile", PONSEL_A)
cek("ponsel yang sama tetap diterima", s == 200, (s, r))

s, r = masuk("guard1", "guard123", "mobile", PONSEL_B)
cek("ponsel lain ditolak", s == 403 and r.get("code") == "PERANGKAT_TIDAK_DIKENAL", (s, r))
cek("pesan penolakan menjelaskan langkahnya", "administrator" in (r.get("message") or "").lower(), r.get("message"))

# Aplikasi dipasang ulang: penanda baru, ciri perangkat sama.
PASANG_ULANG = {**PONSEL_A, "deviceId": "uji-ponsel-A-baru"}
s, r = masuk("guard1", "guard123", "mobile", PASANG_ULANG)
cek("pasang ulang pada ponsel yang sama tidak merepotkan", s == 200, (s, r))

s, r = masuk("guard1", "guard123", "web")
cek("portal web tidak terikat perangkat", s == 403 and "lapangan" in (r.get("message") or ""), (s, r))

print("\n── Percobaan perangkat asing tercatat ──")
s, ev = call("GET", "/users/integrity/events?type=PERANGKAT_ASING&limit=10", adm)
asing = [e for e in ev if e.get("deviceId") == "uji-ponsel-B"] if isinstance(ev, list) else []
cek("percobaan dari ponsel lain tersimpan", len(asing) >= 1, (s, len(ev) if isinstance(ev, list) else ev))
cek("catatan menyebut pelakunya", asing and asing[0]["user"]["id"] == me.get("id"), asing[:1])

print("\n── Lokasi palsu ──")
site = me.get("homeSite", {}).get("id")
call("POST", "/schedules/attendance/check-out", grd, {"lat": -6.2, "lng": 107.15})

s, r = call("POST", "/schedules/attendance/check-in", grd,
            {"siteId": site, "lat": -6.2, "lng": 107.15, "mocked": True,
             "deviceId": "uji-ponsel-A", "accuracyM": 5.0})
cek("presensi dengan lokasi palsu ditolak", s == 422 and r.get("code") == "LOKASI_PALSU", (s, r))
cek("pesan menyebut fake GPS", "fake gps" in (r.get("message") or "").lower(), r.get("message"))

s, ev = call("GET", "/users/integrity/events?type=LOKASI_PALSU&limit=10", adm)
palsu = [e for e in ev if e["action"] == "PRESENSI_MASUK"] if isinstance(ev, list) else []
cek("percobaan lokasi palsu tercatat untuk admin", len(palsu) >= 1, (s, ev if not isinstance(ev, list) else len(ev)))
cek("catatan memuat koordinat yang dipalsukan", palsu and palsu[0]["lat"] is not None, palsu[:1])

s, att = call("GET", "/schedules/attendance/attempts?limit=10", adm)
tolakan = [a for a in att if a.get("mocked")] if isinstance(att, list) else []
cek("penolakan ikut masuk daftar percobaan presensi", len(tolakan) >= 1, len(att) if isinstance(att, list) else att)

s, r = call("POST", "/patrols/tracking/ping", grd,
            {"lat": -6.2, "lng": 107.15, "mocked": True, "deviceId": "uji-ponsel-A"})
cek("jejak lokasi palsu ditolak", s == 422 and r.get("code") == "LOKASI_PALSU", (s, r))

print("\n── Emulator ──")
s, r = call("POST", "/schedules/attendance/check-in", grd,
            {"siteId": site, "lat": -6.2, "lng": 107.15, "isPhysical": False, "deviceId": "uji-emulator"})
cek("presensi dari emulator ditolak", s == 422 and r.get("code") == "EMULATOR", (s, r))

print("\n── Perpindahan mustahil (deteksi sisi server) ──")
# Jejak sah lebih dulu, lalu presensi di tempat yang mustahil dicapai.
call("POST", "/patrols/tracking/ping", grd, {"lat": -6.2, "lng": 107.15})
time.sleep(2)
s, r = call("POST", "/schedules/attendance/check-in", grd,
            {"siteId": site, "lat": -6.9, "lng": 107.6, "deviceId": "uji-ponsel-A"})
cek("perpindahan mustahil ditolak tanpa bantuan aplikasi",
    s == 422 and r.get("code") == "KECEPATAN_TIDAK_WAJAR", (s, r))
s, ev = call("GET", "/users/integrity/events?type=KECEPATAN_TIDAK_WAJAR&limit=5", adm)
cek("perpindahan mustahil tercatat", isinstance(ev, list) and len(ev) >= 1, ev if not isinstance(ev, list) else len(ev))
cek("catatan menyebut kecepatannya", isinstance(ev, list) and ev and ev[0].get("speedKph", 0) > 130,
    ev[0].get("speedKph") if isinstance(ev, list) and ev else None)

print("\n── Hak akses & ringkasan ──")
s, _ = call("GET", "/users/integrity/events", grd)
cek("anggota tidak boleh membaca catatan pelanggaran", s == 403, s)
s, _ = call("GET", "/users/devices/list", grd)
cek("anggota tidak boleh membaca daftar perangkat", s == 403, s)
s, ring = call("GET", "/users/integrity/summary", adm)
cek("ringkasan pelanggaran tersedia", s == 200 and "perJenis" in ring, (s, ring))

print("\n── Melepaskan ikatan perangkat ──")
s, daftar = call("GET", "/users/devices/list", adm)
milik = [d for d in daftar if d["user"]["id"] == me.get("id")] if isinstance(daftar, list) else []
cek("perangkat terikat terbaca pengawas", len(milik) >= 1, len(daftar) if isinstance(daftar, list) else daftar)
if milik:
    s, _ = call("DELETE", f"/users/devices/{milik[0]['id']}", adm)
    cek("administrator dapat melepaskan ikatan", s == 200, s)
    s, r = masuk("guard1", "guard123", "mobile", PONSEL_B)
    cek("setelah dilepas, ponsel baru diterima", s == 200, (s, r))
    # Kembalikan ke keadaan semula
    s, daftar = call("GET", "/users/devices/list", adm)
    for d in daftar:
        if d["deviceId"].startswith("uji-ponsel"):
            call("DELETE", f"/users/devices/{d['id']}", adm)

print(f"\nHasil: {ok} lulus, {fail} gagal")
sys.exit(1 if fail else 0)
