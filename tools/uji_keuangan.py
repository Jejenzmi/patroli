#!/usr/bin/env python3
"""
Uji modul keuangan, kepatuhan, dan pengisian pos (Prioritas 1–3).

Menguji lewat API sungguhan pada instans yang sedang berjalan, lalu
membersihkan seluruh data yang dibuatnya sendiri. Jalankan dari VPS:

    python3 tools/uji_keuangan.py
    BASE=https://patroli.gokar.id python3 tools/uji_keuangan.py
"""

import datetime
import json
import os
import sys
import urllib.error
import urllib.request

BASE = os.environ.get("BASE", "http://127.0.0.1:8113")
API = BASE + "/api"

lulus = 0
gagal = 0
bersihkan = []  # (path, token) yang dihapus di akhir


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
        return json.loads(e.read().decode() or "{}"), e.code


def cek(nama, syarat, catatan=""):
    global lulus, gagal
    if syarat:
        lulus += 1
        print("  ✓ %s%s" % (nama, (" — " + catatan) if catatan else ""))
    else:
        gagal += 1
        print("  ✗ %s%s" % (nama, (" — " + catatan) if catatan else ""))


hari = lambda n: (datetime.date.today() + datetime.timedelta(days=n)).isoformat()

T, _ = req("/auth/login", "POST", {"username": "admin", "password": "admin123", "platform": "web"})
T = T.get("token")
if not T:
    sys.exit("gagal masuk sebagai admin")

periode = datetime.date.today().strftime("%Y-%m")

print("\n== 1. Penggajian ==")
grades, _ = req("/payroll/grades", token=T)
cek("golongan upah tersedia", len(grades) > 0, "%d golongan" % len(grades))

run, kode = req("/payroll/runs", "POST", {"period": periode, "type": "BULANAN"}, T)
if kode == 409:
    daftar, _ = req("/payroll/runs", token=T)
    run = next((r for r in daftar["data"] if r["period"] == periode and r["type"] == "BULANAN"), {})
    print("  · periode %s sudah ada, memakai yang tersimpan" % periode)
else:
    bersihkan.append("/payroll/runs/" + run["id"])

cek("periode penggajian terbentuk", bool(run.get("id")))
rinci, _ = req("/payroll/runs/%s" % run["id"], token=T)
slips = rinci.get("slips", [])
cek("slip tersusun", len(slips) > 0, "%d slip" % len(slips))

if slips:
    s = slips[0]
    bruto = sum(e["jumlah"] for e in s["earnings"])
    potongan = sum(dd["jumlah"] for dd in s["deductions"])
    cek("bruto sama dengan jumlah baris pendapatan", abs(bruto - s["bruto"]) < 1)
    cek("potongan sama dengan jumlah baris potongan", abs(potongan - s["totalPotongan"]) < 1)
    cek("netto = bruto − potongan", abs(s["bruto"] - s["totalPotongan"] - s["netto"]) < 1)
    cek("beban perusahaan = bruto + iuran perusahaan",
        abs(s["bruto"] + s["bpjsPerusahaan"] - s["biayaPerusahaan"]) < 1)
    cek("dasar PPh 21 tercatat", bool(s["pph21Basis"]), s["pph21Basis"] or "")

print("\n== 2. Tagihan & rekonsiliasi manning ==")
kontrak, _ = req("/billing/contracts", token=T)
cek("kontrak tersedia", len(kontrak) > 0, "%d kontrak" % len(kontrak))
if kontrak:
    k = kontrak[0]
    pra, _ = req("/billing/invoices/pratinjau", "POST", {"contractId": k["id"], "period": periode}, T)
    cek("rekonsiliasi menghitung hari-orang", "rekap" in pra and len(pra["rekap"]) >= 0)
    pos = sum(l["amount"] for l in pra["lines"] if l["kind"] == "POS")
    cek("nilai pos sama dengan subtotal", abs(pos - pra["subtotal"]) < 1)
    cek("potongan tidak melampaui nilai pos", pra["subtotal"] + pra["deductionTotal"] >= -1)
    batas = round(pos * (k.get("penaltyCapPct", 10)) / 100)
    cek("denda dibatasi plafon kontrak", abs(pra["penaltyTotal"]) <= batas + 1,
        "denda %d, plafon %d" % (abs(pra["penaltyTotal"]), batas))
    cek("total = DPP + PPN", abs(pra["dpp"] + pra["ppn"] - pra["total"]) < 2)

print("\n== 3. Laba-rugi per site ==")
pnl, _ = req("/finance/pnl?period=%s" % periode, token=T)
cek("laba-rugi terhitung", "rows" in pnl)
cek("persentase margin tidak menyesatkan saat pendapatan nol",
    all(r["marginPct"] == 0 or r["pendapatan"] > 0 for r in pnl.get("rows", [])))

print("\n== 4. Kepatuhan berkas ==")
orang, _ = req("/users?role=GUARD&pageSize=5", token=T)
g = orang["data"][0]
GID = g["id"]
SITE = (g.get("homeSite") or {}).get("id")
shifts, _ = req("/master/shifts?siteId=%s" % SITE, token=T)
SHIFT = shifts[0]["id"] if shifts else None

dok, _ = req("/compliance/documents", "POST",
             {"guardId": GID, "type": "KTA_POLRI", "number": "KTA-UJI-OTOMATIS",
              "expiresAt": "2020-01-31"}, T)
cek("berkas kedaluwarsa tercatat", bool(dok.get("id")))

r, kode = req("/schedules", "POST",
              {"siteId": SITE, "shiftId": SHIFT, "guardId": GID, "date": hari(120)}, T)
cek("penjadwalan ditolak saat berkas mati", kode == 422, r.get("message", ""))

req("/compliance/documents/%s" % dok["id"], "PUT", {"expiresAt": "2030-12-31"}, T)
r, kode = req("/schedules", "POST",
              {"siteId": SITE, "shiftId": SHIFT, "guardId": GID, "date": hari(120)}, T)
cek("penjadwalan diterima setelah berkas diperpanjang", kode in (200, 201))
if r.get("id"):
    bersihkan.append("/schedules/" + r["id"])

req("/compliance/blacklist/%s" % GID, "PUT", {"blacklisted": True, "reason": "uji otomatis"}, T)
r, kode = req("/schedules", "POST",
              {"siteId": SITE, "shiftId": SHIFT, "guardId": GID, "date": hari(121)}, T)
cek("penjadwalan ditolak untuk daftar hitam", kode == 422, r.get("message", ""))
req("/compliance/blacklist/%s" % GID, "PUT", {"blacklisted": False}, T)
req("/compliance/documents/%s" % dok["id"], "DELETE", None, T)

print("\n== 5. Pagar jam kerja ==")
konfig, _ = req("/relief/kelelahan/config", token=T)
maks = konfig["maksHariBerturut"]
dibuat = []
tertolak = False
for i in range(1, maks + 3):
    r, kode = req("/schedules", "POST",
                  {"siteId": SITE, "shiftId": SHIFT, "guardId": GID, "date": hari(200 + i)}, T)
    if r.get("id"):
        dibuat.append(r["id"])
    elif kode == 422 and len(dibuat) >= maks:
        tertolak = True
        break
cek("hari jaga berturut-turut dibatasi", tertolak, "berhenti setelah %d hari" % len(dibuat))
for sid in dibuat:
    req("/schedules/" + sid, "DELETE", None, T)

print("\n== 6. Pos kosong & calon pengganti ==")
papan, _ = req("/relief/pos-kosong", token=T)
cek("papan pos kosong terisi", "baris" in papan, "%d pos kosong dari %d" % (papan["posKosong"], papan["total"]))
cek("potongan pos kosong dihitung", papan["potonganHariIni"] >= 0)

if SHIFT:
    calon, _ = req("/relief/calon?siteId=%s&shiftId=%s&tanggal=%s" % (SITE, SHIFT, hari(3)), token=T)
    cek("calon pengganti terperingkat", isinstance(calon, list) and len(calon) > 0,
        "%d calon" % len(calon) if isinstance(calon, list) else "")
    if isinstance(calon, list) and calon:
        urut = all(calon[i]["score"] >= calon[i + 1]["score"] for i in range(len(calon) - 1))
        cek("urutan calon menurun menurut skor", urut)
        cek("alasan pemeringkatan tersimpan", all(c["reasons"] for c in calon))

print("\n== 7. Pembersihan ==")
for path in reversed(bersihkan):
    _, kode = req(path, "DELETE", None, T)
    print("  · hapus %s → %s" % (path, kode))

print("\n" + "═" * 32)
print("  LULUS: %d   GAGAL: %d" % (lulus, gagal))
print("═" * 32)
sys.exit(1 if gagal else 0)
