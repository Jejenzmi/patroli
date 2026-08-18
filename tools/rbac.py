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


# ═══════════════ Modul BRD: tugas, instruksi, KPI, lantai, regu, cuti ═══════════════

kode, me_spv = panggil("GET", "/auth/me", TOKEN["SUPERVISOR"])
ID_SPV = me_spv["id"]
SITE_GUARD = me_guard["homeSite"]["id"]

# — Tugas —
for peran, harap in [("SUPER_ADMIN", 200), ("ADMIN", 200), ("SUPERVISOR", 200), ("GUARD", 200), ("CLIENT", 200)]:
    kode, _ = panggil("GET", "/tasks", TOKEN[peran])
    cek(f"{peran} membaca daftar tugas → {harap}", kode == harap, f"kode {kode}")

kode, tugas_admin = panggil("GET", "/tasks?limit=300", TOKEN["SUPER_ADMIN"])
kode, tugas_guard = panggil("GET", "/tasks?limit=300", TOKEN["GUARD"])
cek("Anggota hanya melihat tugas miliknya",
    isinstance(tugas_guard, list) and len(tugas_guard) < len(tugas_admin),
    f"{len(tugas_guard)} vs {len(tugas_admin)}")
cek("Tidak ada tugas milik orang lain di daftar anggota",
    all(x["assignee"]["id"] == ID_GUARD for x in tugas_guard) if isinstance(tugas_guard, list) else False)

kode, _ = panggil("POST", "/tasks", TOKEN["GUARD"],
                  {"title": "Percobaan tugas oleh anggota", "assigneeId": ID_GUARD, "siteId": SITE_GUARD})
cek("GUARD tidak boleh membuat tugas", kode == 403, f"kode {kode}")
kode, _ = panggil("POST", "/tasks", TOKEN["CLIENT"],
                  {"title": "Percobaan tugas oleh klien", "assigneeId": ID_GUARD, "siteId": SITE_KLIEN})
cek("CLIENT tidak boleh membuat tugas", kode == 403, f"kode {kode}")

if tugas_guard:
    kode, _ = panggil("PUT", f"/tasks/{tugas_guard[0]['id']}", TOKEN["GUARD"], {"priority": "MENDESAK"})
    cek("GUARD tidak boleh mengubah prioritas tugas", kode == 403, f"kode {kode}")
    kode, _ = panggil("PUT", f"/tasks/{tugas_guard[0]['id']}", TOKEN["GUARD"], {"status": "DIKERJAKAN"})
    cek("GUARD boleh mengubah status tugasnya", kode == 200, f"kode {kode}")

kode, tugas_lain = panggil("GET", "/tasks?limit=300", TOKEN["SUPERVISOR"])
milik_orang_lain = [x for x in tugas_admin if x["assignee"]["id"] != ID_GUARD]
if milik_orang_lain:
    kode, _ = panggil("PUT", f"/tasks/{milik_orang_lain[0]['id']}", TOKEN["GUARD"], {"status": "SELESAI"})
    cek("GUARD tidak boleh menyentuh tugas orang lain", kode == 403, f"kode {kode}")

# — Instruksi —
kode, _ = panggil("POST", "/tasks/instructions", TOKEN["GUARD"],
                  {"title": "Instruksi percobaan", "body": "seharusnya ditolak"})
cek("GUARD tidak boleh menerbitkan instruksi", kode == 403, f"kode {kode}")
kode, ins_guard = panggil("GET", "/tasks/instructions/list", TOKEN["GUARD"])
cek("GUARD menerima instruksi untuk regu/site-nya", kode == 200 and isinstance(ins_guard, list), f"kode {kode}")
if ins_guard:
    kode, _ = panggil("GET", f"/tasks/instructions/{ins_guard[0]['id']}/reads", TOKEN["GUARD"])
    cek("GUARD tidak boleh melihat tanda terima baca", kode == 403, f"kode {kode}")
    kode, _ = panggil("GET", f"/tasks/instructions/{ins_guard[0]['id']}/reads", TOKEN["SUPERVISOR"])
    cek("SUPERVISOR boleh melihat tanda terima baca", kode == 200, f"kode {kode}")

# — KPI & penilaian —
for peran, harap in [("SUPER_ADMIN", 200), ("ADMIN", 200), ("SUPERVISOR", 200), ("CLIENT", 200), ("GUARD", 403)]:
    kode, _ = panggil("GET", "/kpi", TOKEN[peran])
    cek(f"{peran} peringkat KPI → {harap}", kode == harap, f"kode {kode}")

kode, _ = panggil("GET", f"/kpi/{ID_GUARD}", TOKEN["GUARD"])
cek("GUARD melihat KPI dirinya sendiri", kode == 200, f"kode {kode}")
kode, _ = panggil("GET", f"/kpi/{ID_SPV}", TOKEN["GUARD"])
cek("GUARD tidak boleh melihat KPI orang lain", kode == 403, f"kode {kode}")

nilai = {"guardId": ID_GUARD, "period": "2026-07", "disiplin": 4, "penampilan": 4,
         "responsif": 4, "kualitasLaporan": 4, "komunikasi": 4, "note": "uji hak akses"}
kode, _ = panggil("POST", "/kpi/assessments", TOKEN["GUARD"], nilai)
cek("GUARD tidak boleh menilai personel", kode == 403, f"kode {kode}")
kode, _ = panggil("POST", "/kpi/assessments", TOKEN["SUPERVISOR"], nilai)
cek("SUPERVISOR boleh menilai personel", kode in (200, 201), f"kode {kode}")

kode, _ = panggil("PUT", "/kpi/config/bobot", TOKEN["SUPERVISOR"],
                  {"kehadiran": 25, "patroli": 30, "ronde": 15, "pelaporan": 10, "penilaian": 20})
cek("SUPERVISOR tidak boleh mengubah bobot KPI", kode == 403, f"kode {kode}")
kode, _ = panggil("PUT", "/kpi/config/bobot", TOKEN["SUPER_ADMIN"],
                  {"kehadiran": 25, "patroli": 30, "ronde": 15, "pelaporan": 10, "penilaian": 20})
cek("SUPER_ADMIN boleh mengubah bobot KPI", kode == 200, f"kode {kode}")
kode, _ = panggil("PUT", "/kpi/config/bobot", TOKEN["SUPER_ADMIN"],
                  {"kehadiran": 50, "patroli": 30, "ronde": 15, "pelaporan": 10, "penilaian": 20})
cek("Bobot KPI wajib berjumlah 100", kode == 400, f"kode {kode}")

# — Lantai, denah, dan regu —
kode, _ = panggil("POST", "/master/floors", TOKEN["GUARD"], {"siteId": SITE_GUARD, "name": "Lantai uji", "level": 9})
cek("GUARD tidak boleh membuat lantai", kode == 403, f"kode {kode}")
kode, _ = panggil("POST", "/master/teams", TOKEN["CLIENT"], {"siteId": SITE_KLIEN, "code": "UJI", "name": "Regu uji"})
cek("CLIENT tidak boleh membuat regu", kode == 403, f"kode {kode}")
kode, lantai = panggil("GET", f"/master/floors?siteId={SITE_GUARD}", TOKEN["GUARD"])
cek("GUARD boleh membaca denah lantai pos jaganya", kode == 200, f"kode {kode}")

# — Cuti, izin, lembur —
kode, cuti_guard = panggil("GET", "/tasks/leaves/list", TOKEN["GUARD"])
kode2, cuti_admin = panggil("GET", "/tasks/leaves/list", TOKEN["SUPER_ADMIN"])
cek("Anggota hanya melihat pengajuannya sendiri",
    isinstance(cuti_guard, list) and len(cuti_guard) < len(cuti_admin),
    f"{len(cuti_guard)} vs {len(cuti_admin)}")
kode, aju = panggil("POST", "/tasks/leaves", TOKEN["GUARD"],
                    {"type": "IZIN", "startDate": "2026-10-01T00:00:00.000Z",
                     "endDate": "2026-10-01T00:00:00.000Z", "reason": "Uji hak akses pengajuan"})
cek("GUARD boleh mengajukan izin", kode == 201, f"kode {kode}")
aju_id = aju.get("id") if isinstance(aju, dict) else None
if aju_id:
    kode, _ = panggil("POST", f"/tasks/leaves/{aju_id}/decide", TOKEN["GUARD"], {"status": "DISETUJUI"})
    cek("GUARD tidak boleh menyetujui pengajuannya sendiri", kode == 403, f"kode {kode}")
    kode, _ = panggil("POST", f"/tasks/leaves/{aju_id}/decide", TOKEN["CLIENT"], {"status": "DISETUJUI"})
    cek("CLIENT tidak boleh memutus pengajuan", kode == 403, f"kode {kode}")
    kode, _ = panggil("POST", f"/tasks/leaves/{aju_id}/decide", TOKEN["SUPERVISOR"],
                      {"status": "DITOLAK", "decisionNote": "Uji hak akses"})
    cek("SUPERVISOR boleh memutus pengajuan", kode == 200, f"kode {kode}")

# — Pendaftaran wajah & percobaan presensi ditolak —
kode, _ = panggil("POST", f"/users/{ID_SPV}/face", TOKEN["GUARD"], {"photoUrl": "/storage/x.jpg"})
cek("GUARD tidak boleh mendaftarkan wajah orang lain", kode == 403, f"kode {kode}")
kode, _ = panggil("DELETE", f"/users/{ID_GUARD}/face", TOKEN["SUPERVISOR"])
cek("SUPERVISOR tidak boleh menghapus template wajah", kode == 403, f"kode {kode}")
for peran, harap in [("GUARD", 403), ("SUPERVISOR", 200), ("ADMIN", 200)]:
    kode, _ = panggil("GET", "/schedules/attendance/attempts?limit=5", TOKEN[peran])
    cek(f"{peran} percobaan presensi ditolak → {harap}", kode == harap, f"kode {kode}")

# Bersihkan klien uji
for cid in dibuat_klien:
    panggil("DELETE", f"/master/clients/{cid}", TOKEN["SUPER_ADMIN"])

print("\n".join(rincian))
print("\n════════════════════════════════")
print(f"  LULUS: {lulus}   GAGAL: {gagal}")
print("════════════════════════════════")
