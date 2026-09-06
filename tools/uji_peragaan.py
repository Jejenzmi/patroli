#!/usr/bin/env python3
"""
Menguji akun peragaan dari keadaan seperti peninjau Google Play:
emulator, penyedia lokasi tiruan, penanda perangkat berganti-ganti, dan
koordinat ribuan kilometer dari pos jaga.

Sekaligus memastikan kelonggarannya tidak bocor ke akun biasa.

    python3 tools/uji_peragaan.py
"""

import json
import sys
import urllib.error
import urllib.request
import uuid

API = "https://dashboard.dharmapati.co.id/api"
AKUN = {"username": "demo.playstore", "password": "DemoPlay2026"}

# Mountain View — kira-kira tempat peninjau Google menjalankan emulatornya.
LAT_JAUH, LNG_JAUH = 37.4220, -122.0841

lulus = gagal = 0


def req(path, method="GET", body=None, token=None):
    r = urllib.request.Request(API + path, method=method)
    r.add_header("Content-Type", "application/json")
    if token:
        r.add_header("Authorization", "Bearer " + token)
    data = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(r, data) as resp:
            return json.loads(resp.read().decode() or "{}"), resp.status
    except urllib.error.HTTPError as e:
        try:
            return json.loads(e.read().decode() or "{}"), e.code
        except Exception:
            return {}, e.code


def cek(nama, syarat, catatan=""):
    global lulus, gagal
    if syarat:
        lulus += 1
        print("  ✓ %s" % nama)
    else:
        gagal += 1
        print("  ✗ %s%s" % (nama, (" — " + catatan) if catatan else ""))


def perangkat_emulator(ciri="google|sdk_gphone64_x86_64|emu64x|ranchu|34", nama="Emulator Peninjau"):
    """
    Emulator selalu melaporkan dirinya bukan perangkat fisik.

    `ciri` sengaja dapat diganti: penanda acak yang berbeda dengan ciri yang
    sama berarti aplikasi dipasang ulang di ponsel yang sama — itu bukan
    pelanggaran. Ponsel yang benar-benar lain punya ciri yang lain pula.
    """
    return {
        "deviceId": str(uuid.uuid4()),
        "fingerprint": ciri,
        "label": nama,
        "platform": "android",
        "osVersion": "14",
        "appVersion": "1.6.0",
        "isPhysical": False,
    }


print("== Masuk dari emulator, penanda perangkat baru tiap kali ==")
tokens = []
for i in range(3):
    r, k = req("/auth/login", "POST", {**AKUN, "platform": "mobile", "device": perangkat_emulator()})
    tokens.append(r.get("token"))
    cek("masuk ke-%d dari emulator berbeda" % (i + 1), k == 200 and r.get("token"), r.get("message", "kode %s" % k))
T = tokens[-1]
if not T:
    sys.exit("akun peragaan tidak dapat masuk — hentikan")

print("\n== Jadwal hari ini tersedia ==")
jadwal, k = req("/schedules/my/today", "GET", None, T)
baris = jadwal if isinstance(jadwal, list) else jadwal.get("data", [])
hari_ini = baris[0] if baris else None
cek("ada jadwal jaga hari ini", k == 200 and hari_ini is not None, "kode %s, %d baris" % (k, len(baris)))
if hari_ini:
    print("  · %s · shift %s · %s" % (
        hari_ini.get("site", {}).get("name", "?"),
        hari_ini.get("shift", {}).get("name", "?"),
        hari_ini.get("shift", {}).get("startTime", "?"),
    ))
if not hari_ini:
    sys.exit("tidak ada jadwal hari ini — peninjau akan melihat layar kosong")

print("\n== Presensi dari lokasi tiruan, ribuan km dari pos ==")
sid = (hari_ini or baris[0]).get("site", {}).get("id") or (hari_ini or baris[0]).get("siteId")
masuk, k = req(
    "/schedules/attendance/check-in",
    "POST",
    {
        "scheduleId": (hari_ini or baris[0]).get("id"),
        "siteId": sid,
        "lat": LAT_JAUH,
        "lng": LNG_JAUH,
        "accuracyM": 20,
        "mocked": True,
        "isPhysical": False,
        "deviceId": str(uuid.uuid4()),
    },
    T,
)
cek("presensi masuk diterima", k in (200, 201, 409), masuk.get("message", "kode %s" % k))
if k in (200, 201):
    cek(
        "jarak sebenarnya tetap dicatat apa adanya",
        (masuk.get("checkInDistanceM") or 0) > 1_000_000,
        "tercatat %s m" % masuk.get("checkInDistanceM"),
    )

print("\n== Ronde patroli lewat verifikasi GPS ==")
rute, k = req("/patrols/my/active", "GET", None, T)
cek("layar patroli dapat dibuka", k == 200, "kode %s" % k)

print("\n== Kelonggaran tidak boleh bocor ke akun biasa ==")
adm, _ = req("/auth/login", "POST", {"username": "admin", "password": "admin123", "platform": "web"})
TA = adm.get("token")
u, k = req("/users?pageSize=200", "GET", None, TA)
semua = u.get("data", []) if isinstance(u, dict) else []
demo = [x for x in semua if x.get("username") == AKUN["username"]]
biasa = [x for x in semua if x.get("username") != AKUN["username"] and x.get("role") == "GUARD"]
cek("hanya satu akun bertanda peragaan", len(demo) == 1, "%d akun" % len(demo))
cek("akun peragaan berperan anggota, bukan administrator", demo and demo[0].get("role") == "GUARD")

# Uji sungguhan: anggota biasa harus tetap terhadang seluruh pemeriksaan.
sid_demo = demo[0].get("homeSite", {}).get("id") if demo else None
uji, kode = req(
    "/users", "POST",
    {"username": "uji_pagar", "name": "Uji Pagar Keamanan", "role": "GUARD",
     "password": "UjiPagar123", "homeSiteId": sid_demo}, TA)
if kode == 409:
    uji = next(x for x in semua if x["username"] == "uji_pagar")
    req("/users/%s" % uji["id"], "PUT", {"password": "UjiPagar123", "status": "ACTIVE"}, TA)

d1 = perangkat_emulator()
r1, k1 = req("/auth/login", "POST",
             {"username": "uji_pagar", "password": "UjiPagar123", "platform": "mobile", "device": d1})
cek("anggota biasa boleh masuk pertama kali", k1 == 200, "kode %s" % k1)

# Ciri sama, penanda baru = pasang ulang di ponsel yang sama; harus diterima.
r2, k2 = req("/auth/login", "POST",
             {"username": "uji_pagar", "password": "UjiPagar123", "platform": "mobile",
              "device": perangkat_emulator()})
cek("pasang ulang di ponsel yang sama tetap diterima", k2 == 200, "kode %s" % k2)

# Ciri berbeda = ponsel lain; harus ditolak.
r3, k3 = req("/auth/login", "POST",
             {"username": "uji_pagar", "password": "UjiPagar123", "platform": "mobile",
              "device": perangkat_emulator("samsung|SM-A546E|a54x|s5e8835|34", "Ponsel Lain")})
cek("anggota biasa DITOLAK dari ponsel yang berbeda", k3 == 403,
    "kode %s — pengikatan perangkat bocor!" % k3)
cek("alasannya perangkat tidak dikenal", r3.get("code") == "PERANGKAT_TIDAK_DIKENAL",
    "alasan: %s" % r3.get("code"))

if k1 == 200:
    jad, _ = req("/schedules/my/today", "GET", None, r1["token"])
    salah, kk = req("/schedules/attendance/check-in", "POST",
                    {"siteId": sid_demo, "lat": LAT_JAUH, "lng": LNG_JAUH,
                     "mocked": True, "isPhysical": False, "deviceId": d1["deviceId"]}, r1["token"])
    cek("presensi berlokasi palsu DITOLAK untuk anggota biasa", kk == 422,
        "kode %s — deteksi lokasi palsu bocor!" % kk)
    cek("alasannya memang lokasi palsu", salah.get("code") == "LOKASI_PALSU",
        "alasan: %s" % salah.get("code"))

req("/users/%s?permanen=true" % uji["id"], "DELETE", None, TA)
print("  · akun uji dihapus permanen")

print("\n" + "═" * 40)
print("  LULUS: %d   GAGAL: %d" % (lulus, gagal))
print("═" * 40)
sys.exit(1 if gagal else 0)
