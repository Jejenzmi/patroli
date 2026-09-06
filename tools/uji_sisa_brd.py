"""Uji butir BRD yang baru ditutup: jejak peta, denah lantai, instruksi khusus,
jejak audit pembacaan data pribadi, dan kebijakan masa simpan berkas."""
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

def login(u, p, platform="web"):
    s, r = call("POST", "/auth/login", body={"username": u, "password": p, "platform": platform})
    assert s == 200, r
    return r["token"], r["user"]

adm, me_adm = login("admin", "admin123")
grd, me_grd = login("guard1", "guard123", "mobile")
spv, me_spv = login("danru1", "danru123")

print("── FR-GPS-001/002: peta situasi ──")
s, peta = call("GET", "/reports/map", adm)
cek("peta memuat site", s == 200 and len(peta.get("sites", [])) > 0, (s, peta))
cek("titik QR ikut dikirim ke peta",
    any(len(x.get("checkpoints", [])) > 0 for x in peta.get("sites", [])), "tidak ada checkpoint")
cek("bidang jejak pergerakan tersedia", "tracks" in peta, list(peta)[:6])

# Kirim beberapa jejak lalu pastikan terbentuk garis
call("POST", "/schedules/attendance/check-in", grd,
     {"siteId": me_grd.get("homeSite", {}).get("id"), "lat": -6.2, "lng": 107.15})
for i in range(3):
    call("POST", "/patrols/tracking/ping", grd, {"lat": -6.2 + i * 0.0004, "lng": 107.15 + i * 0.0004})
    time.sleep(0.3)
s, peta2 = call("GET", "/reports/map", adm)
jejak = [t for t in peta2.get("tracks", []) if t["guardId"] == me_grd["id"]]
cek("jejak anggota terbentuk dari ping", bool(jejak) and len(jejak[0]["points"]) > 1,
    f"{len(peta2.get('tracks', []))} jejak")

print("\n── FR-GPS-003: denah lantai langsung ──")
s, lantai = call("GET", "/reports/floors", adm)
cek("daftar lantai terbaca", s == 200 and isinstance(lantai, list) and len(lantai) > 0, (s, lantai))
if isinstance(lantai, list) and lantai:
    f0 = lantai[0]
    cek("lantai memuat titik QR berposisi denah",
        any(c.get("planX") is not None for f in lantai for c in f.get("checkpoints", [])),
        "tidak ada titik ber-planX")
    cek("lantai memuat daftar anggota", all("guards" in f for f in lantai))
s, _ = call("GET", "/reports/floors", grd)
cek("anggota tidak boleh membuka denah pemantauan", s == 403, f"kode {s}")

print("\n── FR-PAT-002: instruksi khusus penugasan ──")
s, sites = call("GET", "/master/sites", adm)
site = sites[0]
s, shifts = call("GET", f"/master/shifts?siteId={site['id']}", adm)
s, jd = call("POST", "/schedules", adm, {
    "siteId": site["id"], "shiftId": shifts[0]["id"], "guardId": me_grd["id"],
    "date": "2026-12-24", "notes": "Dampingi teknisi lift pukul 10.00"})
cek("jadwal tersimpan dengan instruksi khusus",
    s in (200, 201) and jd.get("notes") == "Dampingi teknisi lift pukul 10.00", (s, jd))
s, jdl = call("GET", "/schedules?from=2026-12-24&to=2026-12-24", grd)
cek("anggota membaca instruksi khusus pada jadwalnya",
    s == 200 and any(x.get("notes") for x in jdl), (s, jdl))
if jd.get("id"): call("DELETE", f"/schedules/{jd['id']}", adm)

s, bulk = call("POST", "/schedules/bulk", adm, {
    "siteId": site["id"], "shiftId": shifts[0]["id"], "guardIds": [me_grd["id"]],
    "from": "2026-12-26", "to": "2026-12-27", "notes": "Pengamanan libur akhir tahun"})
s2, cekBulk = call("GET", "/schedules?from=2026-12-26&to=2026-12-27", adm)
cek("roster massal membawa instruksi khusus",
    any(x.get("notes") == "Pengamanan libur akhir tahun" for x in cekBulk), cekBulk[:1])

print("\n── NFR: jejak audit pembacaan data pribadi ──")
call("GET", f"/patrols/tracking/history/{me_grd['id']}", spv)
call("GET", "/schedules/attendance/attempts?limit=5", spv)
s, audit = call("GET", "/frontdesk/audit?limit=40", adm)
baris = audit.get("data", audit) if isinstance(audit, dict) else audit
aksi = {a["action"] for a in baris} if isinstance(baris, list) else set()
cek("pembacaan riwayat lokasi tercatat", "READ_LOCATION_HISTORY" in aksi, sorted(aksi)[:8])
cek("pembacaan percobaan presensi tercatat", "READ_ATTENDANCE_ATTEMPTS" in aksi, sorted(aksi)[:8])

# Bersihkan
call("POST", "/schedules/attendance/check-out", grd, {"lat": -6.2, "lng": 107.15})

print(f"\nHasil: {ok} lulus, {fail} gagal")
sys.exit(1 if fail else 0)
