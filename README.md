# PATROLI — Security Guard Management & Patrol Tracking System

Sistem manajemen satuan pengamanan dan pelacakan patroli: satu monorepo berisi
API, pusat komando berbasis web, dan aplikasi lapangan Android.

**Live:** https://patroli.gokar.id · **APK:** https://patroli.gokar.id/PATROLI.apk

## Struktur monorepo

```
patroli/
├─ packages/shared/     Tipe & konstanta bersama (peran, SLA, haversine, event realtime)
├─ apps/backend/        Node 20 + TypeScript + Express + Prisma + PostgreSQL + Redis + MinIO + Socket.IO
├─ apps/web/            React 18 + Vite + TypeScript + Tailwind + Recharts + Leaflet
├─ apps/mobile/         Flutter + Bloc (presensi, patroli, insiden, tombol darurat)
└─ deploy/              Docker Compose, Dockerfile, konfigurasi nginx
```

npm workspaces mengikat `packages/shared` ke backend dan web, sehingga satu definisi
peran/SLA/nama event dipakai kedua sisi tanpa duplikasi.

## Cakupan fungsional

| Modul | Isi |
|---|---|
| Master data | Klien, site (geofence), zona, titik patroli (QR/NFC), rute, shift, inventaris |
| Personel | Data anggota, peran & hak akses, profil kinerja |
| Jadwal | Roster mingguan, roster massal per rentang & hari |
| Presensi | Masuk/pulang bergeofence + swafoto, deteksi keterlambatan otomatis |
| Patroli | Sesi patroli, pemindaian QR/NFC/GPS, urutan wajib, foto wajib, titik terlewat, kepatuhan |
| Insiden | Pelaporan berfoto, tingkat keparahan + tenggat SLA, penugasan, riwayat penanganan |
| Darurat | Tombol panik dengan posisi, respons & penutupan oleh supervisor |
| Pos jaga | Buku tamu, lalu lintas kendaraan, serah terima shift |
| Analitik | Dasbor komando, tren kepatuhan, peringkat personel, titik rawan terlewat, ekspor CSV |
| Lainnya | Pengumuman, notifikasi realtime, jejak audit |

## Peran & akses

| Peran | Web | Mobile | Cakupan data |
|---|---|---|---|
| SUPER_ADMIN | ✅ penuh | ✅ | seluruh klien & site |
| ADMIN | ✅ penuh | ✅ | seluruh klien & site |
| SUPERVISOR | ✅ operasional | ✅ | operasional, tanpa kelola klien/site |
| GUARD | — | ✅ utama | jadwal, patroli, presensi, dan laporannya sendiri |
| CLIENT | ✅ pemantauan | ❌ | hanya site milik perusahaannya |

## Aplikasi lapangan (super app)

Alur pembuka: **splash beranimasi → pengenalan 4 langkah (sekali pasang) → masuk → beranda**.
Beranda bergaya super app: sapaan + petak status, kartu presensi, kisi pintasan 8 layanan,
kartu patroli berjalan, jadwal hari ini, carousel pengumuman, dan tombol darurat.
Bilah bawah lima tab dengan tombol pindai melayang di tengah.

Layar: Beranda · Patroli (pilih rute → pindai titik → akhiri) · Layanan (buku tamu, kendaraan,
serah terima, jadwal & presensi, riwayat patroli, lapor insiden, pengumuman) · Insiden · Profil.

## Dialog konfirmasi

Seluruh tindakan yang mengubah data — simpan, ubah, hapus, presensi masuk/pulang, mulai &
akhiri patroli, kirim laporan, respons sinyal darurat, konfirmasi serah terima, dan keluar —
melewati dialog konfirmasi beranimasi dengan warna sesuai jenis tindakan
(biru simpan, kuning peringatan, merah hapus/darurat, ungu keluar).

Di web: `apps/web/src/components/confirm.tsx` — dipanggil `await ask.save(...)`, `ask.remove(...)`,
`ask.action(...)`, `ask.logout()` dari mana pun tanpa menambah state di halaman.
Di mobile: `apps/mobile/lib/widgets/app_dialog.dart` — `askConfirm(...)` dan `showSuccess(...)`.

## Penggelaran

```bash
cd deploy
cp .env.example .env      # isi DB_PASSWORD, JWT_SECRET, MINIO_USER, MINIO_PASSWORD
docker compose up -d --build
```

Layanan: `db` (PostgreSQL 16), `redis`, `minio`, `backend` (:5027), `web` (nginx → 127.0.0.1:8113),
`backup` (dump harian, simpan 14 hari). Skema disinkronkan dan data contoh disemai otomatis
saat pertama kali dijalankan.

nginx host meneruskan `patroli.gokar.id` ke 8113; sertifikat TLS oleh certbot dengan
perpanjangan otomatis.

## Membangun APK

```bash
./build-apk.sh     # membangun lewat Docker (host tidak perlu Flutter SDK)
```

Hasil: `apps/mobile/dist/PATROLI.apk`, dengan alamat server ditanam lewat
`--dart-define=API_BASE`.

## Akun contoh

| Pengguna | Sandi | Peran |
|---|---|---|
| admin | admin123 | Super Admin |
| komandan | komandan123 | Chief Security |
| danru1 / danru2 | danru123 | Supervisor |
| guard1 … guard16 | guard123 | Anggota |
| klien | klien123 | Klien (PT Mega Pratama Kawasan) |

## Kesiapan produksi

- Sandi di-hash bcrypt, JWT 30 hari, pembatas laju (20 percobaan masuk/menit, 600 permintaan/menit).
- Helmet, CORS dikunci ke domain produksi, unggahan dibatasi jenis berkas dan 12 MB.
- Galat async Express ditangkap terpusat; proses tidak mati karena satu permintaan gagal.
- `ErrorBoundary` di web menahan galat render agar layar tidak menjadi putih.
- Pemeriksaan kesehatan kontainer (`/api/health`) + rotasi log Docker (10 MB × 5).
- Cadangan basis data harian otomatis, disimpan 14 hari.
- Jejak audit merekam setiap perubahan data beserta pelaku dan alamat IP.
- Uji regresi: `tools/e2e.sh` (API), `tools/uicheck.js` (render seluruh halaman),
  `tools/dialogcheck.js` (dialog konfirmasi), `tools/mobilecheck.js` (UI aplikasi lapangan).

## Catatan teknis

- **Verifikasi patroli** memakai tiga lapis: kode QR/NFC titik, jarak GPS terhadap
  koordinat titik, dan stempel waktu terhadap target menit rute.
- **Geofence presensi** menolak absen di luar radius site; jarak tersimpan sebagai bukti.
- **SLA insiden** dihitung dari tingkat keparahan (Kritis 1 jam, Tinggi 8, Sedang 24, Rendah 72)
  dan dinilai ulang bila keparahan diubah.
- **Realtime** lewat Socket.IO: posisi anggota, pemindaian, insiden, dan sinyal darurat
  langsung muncul di pusat komando.
- **Redis** menyimpan posisi terakhir tiap anggota (presence) dan cache agregasi dasbor.
