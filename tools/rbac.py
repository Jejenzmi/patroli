#!/usr/bin/env python3
"""Menguji matriks hak akses PATROLI: tiap peran terhadap tiap endpoint."""
import json
import ssl
import urllib.request
import urllib.error

# Python di macOS ini tanpa berkas akar CA; verifikasi dilewati khusus untuk pengujian.
KONTEKS = ssl.create_default_context()
KONTEKS.check_hostname = False
KONTEKS.verify_mode = ssl.CERT_NONE

BASE = "https://patroli.gokar.id/api"

AKUN = {
    "SUPER_ADMIN": ("admin", "admin123"),
    "ADMIN": ("komandan", "komandan123"),
    "SUPERVISOR": ("danru1", "danru123"),
    "GUARD": ("guard1", "guard123"),
    "CLIENT": ("klien", "klien123"),
}

lulus = gagal = 0
rincian = []


def panggil(metode, path, token=None, body=None):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=metode)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req, timeout=30, context=KONTEKS) as r:
            isi = r.read().decode()
            try:
                return r.status, json.loads(isi)
            except Exception:
                return r.status, isi
    except urllib.error.HTTPError as e:
        isi = e.read().decode()
        try:
            return e.code, json.loads(isi)
        except Exception:
            return e.code, isi


def cek(nama, syarat, catatan=""):
    global lulus, gagal
    if syarat:
        lulus += 1
        rincian.append(f"  ✓ {nama}")
    else:
        gagal += 1
        rincian.append(f"  ✗ {nama}  {catatan}")


def masuk(peran, platform=None):
    u, p = AKUN[peran]
    body = {"username": u, "password": p}
    if platform:
        body["platform"] = platform
    return panggil("POST", "/auth/login", body=body)


print("═══ 1. Pintu masuk per peran ═══")
TOKEN = {}
for peran in AKUN:
    kode, isi = masuk(peran)
    TOKEN[peran] = isi.get("token") if isinstance(isi, dict) else None
    cek(f"{peran} dapat masuk (tanpa penanda platform)", kode == 200 and TOKEN[peran], f"kode {kode}")

kode, isi = masuk("GUARD", "web")
cek("GUARD ditolak di portal web", kode == 403, f"kode {kode}")
kode, isi = masuk("CLIENT", "mobile")
cek("CLIENT ditolak di aplikasi lapangan", kode == 403, f"kode {kode}")
kode, _ = masuk("SUPERVISOR", "web")
cek("SUPERVISOR diterima di portal web", kode == 200, f"kode {kode}")
kode, _ = masuk("GUARD", "mobile")
cek("GUARD diterima di aplikasi lapangan", kode == 200, f"kode {kode}")
kode, _ = masuk("CLIENT", "web")
cek("CLIENT diterima di portal web", kode == 200, f"kode {kode}")

# Data acuan
kode, sites_admin = panggil("GET", "/master/sites", TOKEN["SUPER_ADMIN"])
JUM_SITE = len(sites_admin)
SITE_LAIN = next(s["id"] for s in sites_admin if s["client"]["code"] != "GRD-MPK")
SITE_KLIEN = next(s["id"] for s in sites_admin if s["client"]["code"] == "GRD-MPK")

print("\n═══ 2. Master data: siapa boleh melihat & mengubah ═══")
HARAP = [
    # (metode, path, body, {peran: kode yang diharapkan})
    ("GET", "/master/clients", None,
     {"SUPER_ADMIN": 200, "ADMIN": 200, "SUPERVISOR": 200, "GUARD": 200, "CLIENT": 200}),
    ("POST", "/master/clients", {"code": "X-RBAC", "name": "Uji RBAC"},
     {"SUPER_ADMIN": 201, "ADMIN": 201, "SUPERVISOR": 403, "GUARD": 403, "CLIENT": 403}),
    ("POST", "/master/sites", {"clientId": "x", "code": "X", "name": "X", "lat": 0, "lng": 0},
     {"SUPER_ADMIN": 500, "ADMIN": 500, "SUPERVISOR": 403, "GUARD": 403, "CLIENT": 403}),
    ("POST", "/master/checkpoints", {"siteId": "x", "code": "XX", "name": "XX", "lat": 0, "lng": 0},
     {"SUPER_ADMIN": 500, "ADMIN": 500, "SUPERVISOR": 500, "GUARD": 403, "CLIENT": 403}),
    ("DELETE", "/master/shifts/tidak-ada", None,
     {"SUPER_ADMIN": 404, "ADMIN": 404, "SUPERVISOR": 404, "GUARD": 403, "CLIENT": 403}),
]
dibuat_klien = []
for metode, path, body, harapan in HARAP:
    for peran, kode_harap in harapan.items():
        b = dict(body) if body else None
        if b and path.endswith("/clients"):
            b["code"] = f"X-{peran[:4]}"
            b["name"] = f"Uji RBAC {peran}"
        kode, isi = panggil(metode, path, TOKEN[peran], b)
        # Untuk peran yang berhak, yang diuji adalah "tidak ditolak" (bukan kode persisnya).
        ok = kode == kode_harap if kode_harap == 403 else kode != 403
        cek(f"{peran} {metode} {path} → {'ditolak' if kode_harap == 403 else 'boleh'}", ok, f"dapat {kode}")
        if kode == 201 and isinstance(isi, dict) and isi.get("id"):
            dibuat_klien.append(isi["id"])

print("\n═══ 3. Cakupan data per peran ═══")
kode, sites_klien = panggil("GET", "/master/sites", TOKEN["CLIENT"])
cek("CLIENT hanya melihat site miliknya", len(sites_klien) == 2, f"{len(sites_klien)} dari {JUM_SITE}")
kode, sites_guard = panggil("GET", "/master/sites", TOKEN["GUARD"])
cek("GUARD hanya melihat site penempatannya", 0 < len(sites_guard) < JUM_SITE, f"{len(sites_guard)} dari {JUM_SITE}")

kode, _ = panggil("GET", f"/master/sites/{SITE_LAIN}", TOKEN["CLIENT"])
cek("CLIENT ditolak membuka site klien lain", kode == 403, f"kode {kode}")
kode, _ = panggil("GET", f"/master/sites/{SITE_KLIEN}", TOKEN["CLIENT"])
cek("CLIENT boleh membuka site miliknya", kode == 200, f"kode {kode}")

kode, cp_admin = panggil("GET", "/master/checkpoints", TOKEN["SUPER_ADMIN"])
kode, cp_klien = panggil("GET", "/master/checkpoints", TOKEN["CLIENT"])
kode, cp_guard = panggil("GET", "/master/checkpoints", TOKEN["GUARD"])
cek("Titik patroli klien lebih sedikit", len(cp_klien) < len(cp_admin), f"{len(cp_klien)} vs {len(cp_admin)}")
cek("Titik patroli anggota lebih sedikit", len(cp_guard) < len(cp_admin), f"{len(cp_guard)} vs {len(cp_admin)}")

kode, sh_admin = panggil("GET", "/master/shifts", TOKEN["SUPER_ADMIN"])
kode, sh_klien = panggil("GET", "/master/shifts", TOKEN["CLIENT"])
cek("Shift klien terbatas site miliknya", len(sh_klien) < len(sh_admin), f"{len(sh_klien)} vs {len(sh_admin)}")

kode, eq_admin = panggil("GET", "/master/equipment", TOKEN["SUPER_ADMIN"])
kode, eq_klien = panggil("GET", "/master/equipment", TOKEN["CLIENT"])
cek("Inventaris klien terbatas site miliknya", len(eq_klien) < len(eq_admin), f"{len(eq_klien)} vs {len(eq_admin)}")

print("\n═══ 4. Personel ═══")
kode, _ = panggil("GET", "/users", TOKEN["GUARD"])
cek("GUARD tidak boleh melihat daftar personel", kode == 403, f"kode {kode}")
kode, u_admin = panggil("GET", "/users?pageSize=200", TOKEN["SUPER_ADMIN"])
kode, u_klien = panggil("GET", "/users?pageSize=200", TOKEN["CLIENT"])
cek("CLIENT hanya melihat personel di site-nya",
    0 < u_klien["total"] < u_admin["total"], f"{u_klien['total']} vs {u_admin['total']}")
kode, _ = panggil("POST", "/users", TOKEN["SUPERVISOR"], {"username": "x", "name": "x", "role": "GUARD"})
cek("SUPERVISOR tidak boleh menambah personel", kode == 403, f"kode {kode}")

kode, me_guard = panggil("GET", "/auth/me", TOKEN["GUARD"])
ID_GUARD = me_guard["id"]
kode, _ = panggil("GET", f"/users/{ID_GUARD}/performance", TOKEN["GUARD"])
cek("GUARD boleh melihat kinerjanya sendiri", kode == 200, f"kode {kode}")
lain = next(u["id"] for u in u_admin["data"] if u["id"] != ID_GUARD and u["role"] == "GUARD")
kode, _ = panggil("GET", f"/users/{lain}/performance", TOKEN["GUARD"])
cek("GUARD ditolak melihat kinerja anggota lain", kode == 403, f"kode {kode}")

print("\n═══ 5. Analitik & laporan ═══")
for path in ["/reports/dashboard", "/reports/map", "/reports/feed", "/reports/sites/summary",
             "/reports/trend/compliance", "/reports/guards/ranking", "/reports/export/patrols"]:
    kode, _ = panggil("GET", path, TOKEN["GUARD"])
    cek(f"GUARD ditolak {path}", kode == 403, f"kode {kode}")
for path in ["/reports/dashboard", "/reports/map", "/reports/sites/summary"]:
    kode, _ = panggil("GET", path, TOKEN["CLIENT"])
    cek(f"CLIENT boleh {path}", kode == 200, f"kode {kode}")

kode, peta_klien = panggil("GET", "/reports/map", TOKEN["CLIENT"])
cek("Peta klien hanya memuat site miliknya", len(peta_klien["sites"]) == 2, f"{len(peta_klien['sites'])}")
kode, rekap_klien = panggil("GET", "/reports/sites/summary", TOKEN["CLIENT"])
cek("Rekap per site klien terbatas", len(rekap_klien) == 2, f"{len(rekap_klien)}")

print("\n═══ 6. Patroli, insiden, darurat ═══")
kode, _ = panggil("POST", "/patrols/start", TOKEN["CLIENT"], {"routeId": "x"})
cek("CLIENT tidak boleh memulai patroli", kode == 403, f"kode {kode}")
kode, _ = panggil("POST", "/incidents", TOKEN["CLIENT"], {"siteId": "x", "category": "LAINNYA", "title": "xxx", "description": "xxx"})
cek("CLIENT tidak boleh membuat insiden", kode == 403, f"kode {kode}")
kode, _ = panggil("POST", "/incidents/panic/trigger", TOKEN["CLIENT"], {"siteId": "x"})
cek("CLIENT tidak boleh menekan tombol darurat", kode == 403, f"kode {kode}")

kode, inc_admin = panggil("GET", "/incidents?pageSize=100", TOKEN["SUPER_ADMIN"])
kode, inc_guard = panggil("GET", "/incidents?pageSize=100", TOKEN["GUARD"])
kode, inc_klien = panggil("GET", "/incidents?pageSize=100", TOKEN["CLIENT"])
cek("GUARD hanya melihat laporannya sendiri", inc_guard["total"] < inc_admin["total"],
    f"{inc_guard['total']} vs {inc_admin['total']}")
cek("CLIENT hanya melihat insiden site-nya", inc_klien["total"] < inc_admin["total"],
    f"{inc_klien['total']} vs {inc_admin['total']}")

lain_inc = next((i for i in inc_admin["data"] if i["id"] not in [x["id"] for x in inc_guard["data"]]), None)
if lain_inc:
    kode, _ = panggil("GET", f"/incidents/{lain_inc['id']}", TOKEN["GUARD"])
    cek("GUARD ditolak membuka insiden orang lain", kode == 403, f"kode {kode}")
    kode, _ = panggil("PUT", f"/incidents/{lain_inc['id']}", TOKEN["GUARD"], {"status": "CLOSED"})
    cek("GUARD tidak boleh mengubah status insiden", kode == 403, f"kode {kode}")
    kode, _ = panggil("PUT", f"/incidents/{lain_inc['id']}", TOKEN["CLIENT"], {"status": "CLOSED"})
    cek("CLIENT tidak boleh mengubah status insiden", kode == 403, f"kode {kode}")

kode, pat_admin = panggil("GET", "/patrols?limit=200", TOKEN["SUPER_ADMIN"])
kode, pat_guard = panggil("GET", "/patrols?limit=200", TOKEN["GUARD"])
cek("GUARD hanya melihat patrolinya sendiri", len(pat_guard) < len(pat_admin),
    f"{len(pat_guard)} vs {len(pat_admin)}")
milik_orang_lain = next((p for p in pat_admin if p["guard"]["id"] != ID_GUARD), None)
if milik_orang_lain:
    kode, _ = panggil("GET", f"/patrols/{milik_orang_lain['id']}", TOKEN["GUARD"])
    cek("GUARD ditolak membuka sesi patroli orang lain", kode == 403, f"kode {kode}")

kode, _ = panggil("GET", "/incidents/panic/list", TOKEN["GUARD"])
cek("GUARD tidak boleh melihat daftar sinyal darurat", kode == 403, f"kode {kode}")

print("\n═══ 7. Pos jaga ═══")
kode, tamu_admin = panggil("GET", "/frontdesk/visitors?limit=300", TOKEN["SUPER_ADMIN"])
kode, tamu_klien = panggil("GET", "/frontdesk/visitors?limit=300", TOKEN["CLIENT"])
kode, tamu_guard = panggil("GET", "/frontdesk/visitors?limit=300", TOKEN["GUARD"])
cek("Buku tamu klien terbatas site-nya", len(tamu_klien) < len(tamu_admin), f"{len(tamu_klien)} vs {len(tamu_admin)}")
cek("Buku tamu anggota terbatas penempatannya", len(tamu_guard) < len(tamu_admin), f"{len(tamu_guard)} vs {len(tamu_admin)}")

kode, _ = panggil("POST", "/frontdesk/visitors", TOKEN["CLIENT"], {"siteId": SITE_KLIEN, "name": "x", "purpose": "x"})
cek("CLIENT tidak boleh mencatat tamu", kode == 403, f"kode {kode}")
kode, _ = panggil("POST", "/frontdesk/visitors", TOKEN["GUARD"], {"siteId": SITE_LAIN, "name": "Uji", "purpose": "Uji"})
cek("GUARD ditolak mencatat tamu di site lain", kode == 403, f"kode {kode}")

kode, _ = panggil("POST", "/frontdesk/announcements", TOKEN["GUARD"], {"title": "xxx", "body": "xxx"})
cek("GUARD tidak boleh membuat pengumuman", kode == 403, f"kode {kode}")
kode, _ = panggil("POST", "/frontdesk/announcements", TOKEN["CLIENT"], {"title": "xxx", "body": "xxx"})
cek("CLIENT tidak boleh membuat pengumuman", kode == 403, f"kode {kode}")

kode, ann_guard = panggil("GET", "/frontdesk/announcements", TOKEN["GUARD"])
cek("Pengumuman anggota hanya yang ditujukan kepadanya",
    all(a["audience"] in ("ALL", "GUARD") for a in ann_guard), "ada yang bukan untuk anggota")
kode, ann_klien = panggil("GET", "/frontdesk/announcements", TOKEN["CLIENT"])
cek("Pengumuman klien hanya yang ditujukan kepadanya",
    all(a["audience"] in ("ALL", "CLIENT") for a in ann_klien), "ada yang bukan untuk klien")

print("\n═══ 8. Jadwal, presensi, jejak audit ═══")
kode, jad_admin = panggil("GET", "/schedules", TOKEN["SUPER_ADMIN"])
kode, jad_guard = panggil("GET", "/schedules", TOKEN["GUARD"])
kode, jad_klien = panggil("GET", "/schedules", TOKEN["CLIENT"])
cek("Jadwal anggota hanya miliknya", len(jad_guard) < len(jad_admin), f"{len(jad_guard)} vs {len(jad_admin)}")
cek("Jadwal klien terbatas site-nya", len(jad_klien) < len(jad_admin), f"{len(jad_klien)} vs {len(jad_admin)}")

kode, _ = panggil("POST", "/schedules", TOKEN["GUARD"], {"siteId": "x", "shiftId": "x", "guardId": "x", "date": "2026-01-01"})
cek("GUARD tidak boleh menyusun jadwal", kode == 403, f"kode {kode}")
kode, _ = panggil("POST", "/schedules/attendance/check-in", TOKEN["CLIENT"], {"siteId": SITE_KLIEN, "lat": 0, "lng": 0})
cek("CLIENT tidak boleh presensi", kode == 403, f"kode {kode}")
kode, _ = panggil("POST", "/schedules/attendance/check-in", TOKEN["GUARD"], {"siteId": SITE_LAIN, "lat": 0, "lng": 0})
cek("GUARD ditolak presensi di site bukan penempatannya", kode == 403, f"kode {kode}")

for peran, harap in [("GUARD", 403), ("CLIENT", 403), ("SUPERVISOR", 200), ("ADMIN", 200)]:
    kode, _ = panggil("GET", "/frontdesk/audit?limit=5", TOKEN[peran])
    cek(f"{peran} jejak audit → {harap}", kode == harap, f"kode {kode}")

# Bersihkan klien uji
for cid in dibuat_klien:
    panggil("DELETE", f"/master/clients/{cid}", TOKEN["SUPER_ADMIN"])

print("\n".join(rincian))
print("\n════════════════════════════════")
print(f"  LULUS: {lulus}   GAGAL: {gagal}")
print("════════════════════════════════")
