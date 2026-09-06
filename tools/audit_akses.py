#!/usr/bin/env python3
"""
Audit hak akses modul baru: keuangan, kepatuhan, pengisian pos, laporan harian,
dan wilayah.

Membuat akun sementara (anggota, danru, klien) beserta satu klien dan site,
menembak seluruh endpoint dari tiap peran, lalu menghapus kembali semua yang
dibuatnya. Aman dijalankan pada instans produksi yang sudah bersih.

    python3 tools/audit_akses.py
"""

import json
import sys
import urllib.error
import urllib.request

BASE = "https://dashboard.dharmapati.co.id"
API = BASE + "/api"

lulus = 0
gagal = 0


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


T, _ = req("/auth/login", "POST", {"username": "admin", "password": "admin123", "platform": "web"})
T = T.get("token")
if not T:
    sys.exit("gagal masuk sebagai admin")

bersih = []
print("== Menyiapkan akun & data sementara ==")

klien, _ = req("/master/clients", "POST", {"code": "AUDIT-C", "name": "PT Audit Sementara"}, T)
bersih.append(("/master/clients/%s" % klien["id"], None))

site, _ = req(
    "/master/sites", "POST",
    {"clientId": klien["id"], "code": "AUDIT-S", "name": "Site Audit", "lat": -6.3, "lng": 107.2},
    T,
)
bersih.insert(0, ("/master/sites/%s" % site["id"], None))

akun = {}
for peran, uname, home in [
    ("GUARD", "audit_guard", site["id"]),
    ("SUPERVISOR", "audit_danru", site["id"]),
    ("CLIENT", "audit_klien", None),
]:
    body = {
        "username": uname, "name": "Audit " + peran.title(), "role": peran,
        "password": "AuditSementara123",
    }
    if home:
        body["homeSiteId"] = home
    else:
        body["clientId"] = klien["id"]
    u, kode = req("/users", "POST", body, T)
    if kode == 409:
        # Sisa dari audit sebelumnya: pakai kembali akunnya, setel ulang sandi.
        semua, _ = req("/users?pageSize=300", "GET", None, T)
        u = next(x for x in semua["data"] if x["username"] == uname)
        req("/users/%s" % u["id"], "PUT", {"password": "AuditSementara123", "status": "ACTIVE"}, T)
    akun[peran] = u
    bersih.insert(0, ("/users/%s?permanen=true" % u["id"], None))

tok = {}
for peran, uname in [("GUARD", "audit_guard"), ("SUPERVISOR", "audit_danru"), ("CLIENT", "audit_klien")]:
    plat = "mobile" if peran == "GUARD" else "web"
    r, kode = req("/auth/login", "POST", {"username": uname, "password": "AuditSementara123", "platform": plat}, T)
    tok[peran] = r.get("token")
    cek("%s dapat masuk lewat %s" % (peran, plat), bool(tok[peran]), r.get("message", ""))

print("\n== Pemisahan pintu masuk ==")
_, k = req("/auth/login", "POST", {"username": "audit_guard", "password": "AuditSementara123", "platform": "web"})
cek("anggota ditolak di portal web", k == 403, "kode %s" % k)
_, k = req("/auth/login", "POST", {"username": "audit_klien", "password": "AuditSementara123", "platform": "mobile"})
cek("klien ditolak di aplikasi lapangan", k == 403, "kode %s" % k)
_, k = req("/auth/login", "POST", {"username": "audit_guard", "password": "salah-sekali", "platform": "mobile"})
cek("sandi salah ditolak", k == 401, "kode %s" % k)

print("\n== Keuangan: hanya administrator ==")
for nama, jalur in [
    ("periode penggajian", "/payroll/runs"),
    ("golongan upah", "/payroll/grades"),
    ("kasbon", "/payroll/loans"),
    ("laba-rugi", "/finance/pnl"),
    ("ringkasan keuangan", "/finance/ringkasan"),
    ("piutang", "/billing/piutang"),
]:
    for peran in ["GUARD", "SUPERVISOR", "CLIENT"]:
        _, k = req(jalur, "GET", None, tok[peran])
        cek("%s tertutup bagi %s" % (nama, peran), k == 403, "kode %s" % k)

print("\n== Data pribadi ==")
_, k = req("/compliance/documents", "GET", None, tok["CLIENT"])
cek("berkas personel tertutup bagi klien", k == 403, "kode %s" % k)
_, k = req("/compliance/documents", "GET", None, tok["GUARD"])
cek("berkas personel tertutup bagi anggota", k == 403, "kode %s" % k)
d, k = req("/compliance/documents/saya", "GET", None, tok["GUARD"])
cek("anggota tetap melihat berkasnya sendiri", k == 200, "kode %s" % k)
_, k = req("/compliance/blacklist", "GET", None, tok["GUARD"])
cek("daftar hitam tertutup bagi anggota", k == 403, "kode %s" % k)

print("\n== Laporan ==")
_, k = req("/reports/harian", "GET", None, tok["GUARD"])
cek("laporan harian tertutup bagi anggota", k == 403, "kode %s" % k)
h, k = req("/reports/harian", "GET", None, tok["CLIENT"])
cek("klien boleh membuka laporan harian", k == 200, "kode %s" % k)
if k == 200:
    luar = [r for r in h.get("rows", []) if r.get("siteName") not in (None, "Site Audit")]
    cek("laporan klien hanya berisi sitenya sendiri", not luar, "%d baris di luar cakupan" % len(luar))
_, k = req("/reports/harian.csv", "GET", None, tok["GUARD"])
cek("unduhan laporan harian tertutup bagi anggota", k == 403, "kode %s" % k)

print("\n== Pos kosong & tawaran pengganti ==")
_, k = req("/relief", "GET", None, tok["CLIENT"])
cek("daftar tawaran tertutup bagi klien", k == 403, "kode %s" % k)
_, k = req("/relief/calon?siteId=%s&shiftId=x" % site["id"], "GET", None, tok["GUARD"])
cek("pencarian calon tertutup bagi anggota", k == 403, "kode %s" % k)
r, k = req("/relief/saya", "GET", None, tok["GUARD"])
cek("anggota melihat tawaran untuk dirinya", k == 200, "kode %s" % k)
_, k = req("/relief/kelelahan/config", "PUT",
           {"maksHariBerturut": 9, "maksJamPekan": 99, "minJedaJam": 1, "tegakkan": False}, tok["SUPERVISOR"])
cek("pagar jam kerja hanya boleh diubah admin", k == 403, "kode %s" % k)

print("\n== Kontrak & tagihan ==")
c, k = req("/billing/contracts", "GET", None, tok["SUPERVISOR"])
cek("supervisor tetap dapat melihat susunan pos", k == 200, "kode %s" % k)
if k == 200 and c:
    bocor = any("nilaiBulanan" in x or any("ratePerPerson" in p for p in x.get("posts", [])) for x in c)
    cek("tarif & nilai kontrak tidak bocor ke supervisor", not bocor)
_, k = req("/billing/contracts-jatuh-tempo", "GET", None, tok["SUPERVISOR"])
cek("kontrak jatuh tempo tertutup bagi supervisor", k == 403, "kode %s" % k)
pk, k = req("/relief/pos-kosong", "GET", None, tok["SUPERVISOR"])
cek("nilai potongan tagihan tidak tampil bagi supervisor", k == 200 and pk.get("potonganHariIni") == 0, "kode %s" % k)
_, k = req("/billing/contracts", "POST", {"clientId": klien["id"], "number": "X", "startDate": "2026-01-01", "endDate": "2026-12-31"}, tok["SUPERVISOR"])
cek("kontrak hanya boleh dibuat admin", k == 403, "kode %s" % k)
_, k = req("/billing/invoices", "GET", None, tok["GUARD"])
cek("tagihan tertutup bagi anggota", k == 403, "kode %s" % k)
inv, k = req("/billing/invoices", "GET", None, tok["CLIENT"])
cek("klien boleh membuka tagihannya", k == 200, "kode %s" % k)

print("\n== Wilayah & unggahan ==")
w, k = req("/master/wilayah", "GET", None, tok["GUARD"])
cek("daftar wilayah terbuka bagi pengguna yang sudah masuk", k == 200 and len(w) == 38, "kode %s" % k)
_, k = req("/master/wilayah", "GET", None, None)
cek("wilayah tertutup tanpa token", k == 401, "kode %s" % k)
_, k = req("/users", "GET", None, None)
cek("daftar personel tertutup tanpa token", k == 401, "kode %s" % k)
_, k = req("/payroll/runs", "GET", None, "token-palsu")
cek("token palsu ditolak", k == 401, "kode %s" % k)

print("\n== Penyuntingan data oleh peran rendah ==")
_, k = req("/master/sites/%s" % site["id"], "PUT", {"name": "Diubah anggota"}, tok["GUARD"])
cek("anggota tidak dapat mengubah site", k == 403, "kode %s" % k)
_, k = req("/users/%s" % akun["GUARD"]["id"], "PUT", {"role": "SUPER_ADMIN"}, tok["GUARD"])
cek("anggota tidak dapat menaikkan perannya sendiri", k == 403, "kode %s" % k)
_, k = req("/compliance/blacklist/%s" % akun["GUARD"]["id"], "PUT", {"blacklisted": False}, tok["SUPERVISOR"])
cek("daftar hitam hanya boleh diubah admin", k == 403, "kode %s" % k)

print("\n== Pembersihan ==")
for jalur, _ in bersih:
    _, k = req(jalur, "DELETE", None, T)
    print("  · %s → %s" % (jalur, k))

print("\n" + "═" * 34)
print("  LULUS: %d   GAGAL: %d" % (lulus, gagal))
print("═" * 34)
sys.exit(1 if gagal else 0)
