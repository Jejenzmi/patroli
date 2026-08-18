"""Uji rangkaian darurat: jenis kejadian → divisi penanggap → sirene tiang."""
import json, urllib.request, urllib.error, sys, time

BASE = "https://patroli.gokar.id/api"
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

adm, _ = login("admin", "admin123")
grd, me = login("guard1", "guard123", "mobile")
site = me["homeSite"]["id"]

print("── Data induk darurat ──")
s, divisi = call("GET", "/master/divisions", adm)
cek("divisi penanggap terdaftar", s == 200 and len(divisi) >= 5, (s, len(divisi) if s == 200 else divisi))
kode = {d["code"] for d in divisi} if s == 200 else set()
cek("divisi mencakup damkar, medis, K3, sekuriti, tanggap bencana",
    {"DAMKAR", "MEDIS", "K3", "SEKURITI", "TANGGAP"} <= kode, kode)

s, rute = call("GET", "/master/panic-routes", adm)
peta = {}
for r in rute: peta.setdefault(r["type"], set()).add(r["division"]["code"])
cek("kebakaran diarahkan ke damkar", "DAMKAR" in peta.get("KEBAKARAN", set()), peta.get("KEBAKARAN"))
cek("kecelakaan diarahkan ke K3 dan medis",
    {"K3", "MEDIS"} <= peta.get("KECELAKAAN", set()), peta.get("KECELAKAAN"))
cek("kriminal diarahkan ke sekuriti", "SEKURITI" in peta.get("KRIMINAL", set()), peta.get("KRIMINAL"))

s, sirene = call("GET", f"/master/alarms?siteId={site}", adm)
cek("sirene terdaftar di site", s == 200 and len(sirene) >= 2, (s, len(sirene) if s == 200 else sirene))
gerbang = next((a for a in sirene if a["code"].endswith("GATE")), None)
cek("ada sirene tiang gerbang", gerbang is not None)

print("\n── Uji bunyi satu sirene ──")
if gerbang:
    s, hasil = call("POST", f"/master/alarms/{gerbang['id']}/test", adm, {"action": "ON"})
    cek("perintah nyala terkirim ke perangkat", s == 200 and hasil.get("ok"), (s, hasil))
    s2, st = call("GET", f"/alarm-sim/{gerbang['code']}/state?token=sirene-uji")
    cek("perangkat benar-benar menyala", s2 == 200 and st.get("state") == "ON", (s2, st))
    call("POST", f"/master/alarms/{gerbang['id']}/test", adm, {"action": "OFF"})
    s3, st3 = call("GET", f"/alarm-sim/{gerbang['code']}/state?token=sirene-uji")
    cek("perangkat dapat dimatikan", st3.get("state") == "OFF", st3)
    s4, _ = call("GET", f"/alarm-sim/{gerbang['code']}/state")
    cek("tiruan menolak tanpa token", s4 == 401, s4)

print("\n── Tombol darurat berjenis ──")
for jenis, divisi_wajib in [("KEBAKARAN", "DAMKAR"), ("KECELAKAAN", "K3"), ("MEDIS", "MEDIS"), ("KRIMINAL", "SEKURITI")]:
    s, r = call("POST", "/incidents/panic/trigger", grd,
                {"siteId": site, "lat": -6.2, "lng": 107.15, "type": jenis,
                 "message": f"Uji otomatis {jenis.lower()}"})
    if s != 201:
        cek(f"{jenis}: sinyal terkirim", False, (s, r)); continue
    kode_div = {d["code"] for d in r.get("divisi", [])}
    cek(f"{jenis} → divisi {divisi_wajib}", divisi_wajib in kode_div, kode_div)
    cek(f"{jenis}: sirene dibunyikan", any(a["ok"] for a in r.get("alarm", [])),
        [(a["code"], a["ok"], a["detail"][:40]) for a in r.get("alarm", [])])
    cek(f"{jenis}: jenis tersimpan", r.get("type") == jenis, r.get("type"))
    if jenis == "KEBAKARAN":
        panic_kebakaran = r["id"]

print("\n── Sirene mengikuti kejadian ──")
s, st = call("GET", "/alarm-sim/SRN-SITE-KIJ-GATE/state?token=sirene-uji")
s2, daftar = call("GET", "/incidents/panic/list?status=ACTIVE", adm)
aktif = [p for p in daftar if p["siteId"] == site]
cek("kejadian tercatat aktif", len(aktif) >= 4, len(aktif))
cek("kejadian membawa riwayat sirene", any(p.get("alarmEvents") for p in aktif))

if aktif:
    pid = aktif[0]["id"]
    s, ev = call("GET", f"/incidents/panic/{pid}/alarm", adm)
    cek("riwayat perintah sirene terbaca", s == 200 and len(ev) >= 1, (s, len(ev) if s == 200 else ev))
    s, r = call("POST", f"/incidents/panic/{pid}/alarm", adm, {"action": "OFF"})
    cek("sirene dapat dimatikan manual", s == 200 and any(h["ok"] for h in r.get("hasil", [])), r)
    s, _ = call("POST", f"/incidents/panic/{pid}/alarm", grd, {"action": "ON"})
    cek("anggota tidak boleh mengendalikan sirene", s == 403, s)

print("\n── Menutup kejadian mematikan sirene ──")
for p in aktif:
    call("POST", f"/incidents/panic/{p['id']}/resolve", adm, {"note": "Uji otomatis selesai"})
time.sleep(1)
s, st = call("GET", "/alarm-sim/SRN-SITE-KIJ-GATE/state?token=sirene-uji")
cek("sirene padam setelah kejadian ditutup", st.get("state") in ("OFF", "UNKNOWN"), st)

print("\n── Penanda lantai ──")
s, peta_map = call("GET", "/reports/map", adm)
cek("posisi anggota membawa penanda lantai",
    s == 200 and all("lantai" in x for x in peta_map.get("presence", [])),
    [list(x) for x in peta_map.get("presence", [])][:1])

print(f"\nHasil: {ok} lulus, {fail} gagal")
sys.exit(1 if fail else 0)
