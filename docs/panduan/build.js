/**
 * Menyusun berkas HTML Panduan Penggunaan PATROLI.
 * Jalankan: node build.js  →  menghasilkan panduan.html
 */
const fs = require('fs');
const path = require('path');

/* ── Pembantu penulisan ── */
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const p = (...t) => t.map((x) => `<p>${x}</p>`).join('\n');
const h2 = (t) => `<h2>${t}</h2>`;
const h3 = (t) => `<h3>${t}</h3>`;
const steps = (arr) => `<ol class="steps">${arr.map((s) => `<li>${s}</li>`).join('')}</ol>`;
const ul = (arr) => `<ul class="plain">${arr.map((s) => `<li>${s}</li>`).join('')}</ul>`;
const note = (b, t) => `<div class="note"><b>${b}</b>${t}</div>`;
const warn = (b, t) => `<div class="warn"><b>${b}</b>${t}</div>`;
const tip = (b, t) => `<div class="tip"><b>${b}</b>${t}</div>`;
const img = (file, cap, cls = '') =>
  `<figure class="${cls}"><img src="imgopt/${file}.jpg" alt="${esc(cap)}"><figcaption>${cap}</figcaption></figure>`;
const hp = (file, cap) => img(file, cap, 'hp');
const hpPair = (a, b, cap) =>
  `<figure class="hp-pair-wrap"><div class="hp-pair"><img src="imgopt/${a}.jpg"><img src="imgopt/${b}.jpg"></div><figcaption>${cap}</figcaption></figure>`;
const table = (head, rows) =>
  `<table><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>` +
  rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('') +
  `</tbody></table>`;

/* ── Kerangka bab ── */
const bab = [];
let nomorBab = 0;
function part(kicker, judul, isi) {
  nomorBab++;
  const b = { nomor: nomorBab, kicker, judul, sub: [], html: "" };
  bab.push(b);
  // Dijalankan seketika supaya pemanggilan sub() menempel pada bab ini.
  b.html = isi();
}
function sub(judul) {
  const b = bab[bab.length - 1];
  b.sub.push(judul);
  return h2(`${b.nomor}.${b.sub.length} &nbsp;${judul}`);
}

/* ═══════════════ 1. TENTANG PANDUAN ═══════════════ */
part('Pendahuluan', 'Tentang Panduan Ini', () => {
  const s = [];
  s.push(p(
    'Panduan ini menjelaskan cara memakai <strong>PATROLI</strong> — sistem manajemen satuan pengamanan dan pelacakan patroli — baik lewat <strong>aplikasi web (Pusat Komando)</strong> maupun <strong>aplikasi lapangan Android</strong>. Seluruh gambar di dalamnya diambil langsung dari sistem yang berjalan, bukan gambar rancangan.'
  ));
  s.push(sub('Untuk siapa panduan ini'));
  s.push(`<div class="role-grid">
    <div class="role"><h4>Anggota Security</h4><p>Baca <strong>Bagian B</strong>. Anda memakai aplikasi Android untuk presensi, patroli, lapor kejadian, dan tombol darurat.</p></div>
    <div class="role"><h4>Supervisor / Danru</h4><p>Baca <strong>Bagian A dan B</strong>. Anda memantau lewat web sekaligus bertugas di lapangan.</p></div>
    <div class="role"><h4>Administrator</h4><p>Baca <strong>Bagian A</strong> secara utuh, terutama bab Konfigurasi dan Laporan.</p></div>
    <div class="role"><h4>Klien</h4><p>Baca <strong>Bagian A</strong> bab Pusat Komando, Insiden, dan Laporan. Data yang tampil hanya site milik perusahaan Anda.</p></div>
  </div>`);
  s.push(sub('Cara membaca'));
  s.push(p('Tiga jenis kotak dipakai di sepanjang panduan:'));
  s.push(note('Keterangan', 'Penjelasan tambahan yang membantu memahami cara kerja sistem.'));
  s.push(tip('Kiat', 'Cara kerja yang lebih cepat atau kebiasaan baik yang disarankan.'));
  s.push(warn('Perhatian', 'Hal yang bila diabaikan menimbulkan kesalahan data atau tindakan tidak tercatat.'));
  s.push(sub('Alamat sistem'));
  s.push(table(
    ['Layanan', 'Alamat', 'Keterangan'],
    [
      ['Aplikasi web', '<code>https://patroli.gokar.id</code>', 'Dibuka dari peramban komputer maupun ponsel'],
      ['Aplikasi Android', '<code>https://patroli.gokar.id/PATROLI.apk</code>', 'Unduh lalu pasang di ponsel anggota'],
    ]
  ));
  return s.join('\n');
});

/* ═══════════════ 2. MENGENAL PATROLI ═══════════════ */
part('Pendahuluan', 'Mengenal PATROLI', () => {
  const s = [];
  s.push(p(
    'PATROLI menggantikan buku jaga dan laporan tulis tangan dengan catatan digital yang dapat diverifikasi. Setiap kehadiran, putaran patroli, dan kejadian tercatat lengkap dengan waktu, koordinat, dan pelakunya — sehingga laporan kepada klien tidak lagi berdasarkan ingatan.'
  ));
  s.push(sub('Tiga bagian sistem'));
  s.push(table(
    ['Bagian', 'Dipakai oleh', 'Untuk apa'],
    [
      ['Pusat Komando (web)', 'Admin, supervisor, klien', 'Memantau situasi, mengatur jadwal & rute, menangani insiden, menarik laporan'],
      ['Aplikasi lapangan (Android)', 'Anggota & supervisor', 'Presensi, patroli, lapor kejadian, buku tamu, tombol darurat'],
      ['Titik patroli berkode', 'Terpasang di lokasi', 'Stiker QR / tag NFC yang dipindai anggota sebagai bukti kehadiran di titik'],
    ]
  ));
  s.push(sub('Peran dan hak akses'));
  s.push(table(
    ['Peran', 'Web', 'Mobile', 'Cakupan data'],
    [
      ['Super Admin', 'Penuh', 'Ya', 'Seluruh klien dan site'],
      ['Administrator', 'Penuh', 'Ya', 'Seluruh klien dan site'],
      ['Supervisor / Danru', 'Operasional', 'Ya', 'Operasional; tidak mengelola klien & site'],
      ['Anggota (Guard)', '—', 'Ya', 'Jadwal, patroli, presensi, dan laporannya sendiri'],
      ['Klien', 'Pemantauan', '—', 'Hanya site milik perusahaannya'],
    ]
  ));
  s.push(warn('Perhatian', 'Akun <strong>Klien</strong> sengaja tidak dapat masuk ke aplikasi Android. Bila dicoba, aplikasi menampilkan pesan agar memakai portal web.'));
  s.push(sub('Bagaimana bukti patroli dijaga'));
  s.push(p('Satu pemindaian titik hanya diterima bila tiga hal terpenuhi:'));
  s.push(ul([
    '<strong>Kode benar</strong> — QR atau NFC yang dipindai memang milik titik pada rute yang sedang berjalan.',
    '<strong>Jarak wajar</strong> — koordinat ponsel berada dalam radius toleransi titik (bawaan 30–40 meter).',
    '<strong>Waktu tercatat</strong> — sistem membandingkan waktu pemindaian dengan target menit rute, lalu menandai keterlambatan.',
  ]));
  s.push(note('Keterangan', 'Titik yang tidak dipindai sampai putaran ditutup otomatis tercatat sebagai <strong>terlewat</strong> dan menurunkan angka kepatuhan pada laporan.'));
  return s.join('\n');
});

/* ═══════════════ BAGIAN A — WEB ═══════════════ */
part('Bagian A · Aplikasi Web', 'Masuk dan Mengenal Layar', () => {
  const s = [];
  s.push(sub('Masuk ke sistem'));
  s.push(steps([
    'Buka <code>https://patroli.gokar.id</code> pada peramban (Chrome, Edge, atau Safari).',
    'Isi <strong>nama pengguna</strong> — dapat berupa nama pengguna, NIP, atau surel yang diberikan administrator.',
    'Isi <strong>kata sandi</strong>. Ketuk ikon mata bila ingin memastikan ketikan Anda benar.',
    'Tekan tombol <strong>Masuk</strong>.',
  ]));
  s.push(img('web-masuk', 'Halaman masuk. Kotak “Akun demonstrasi” hanya tampil pada lingkungan percobaan.'));
  s.push(warn('Perhatian', 'Setelah lima kali salah dalam satu menit, sistem membatasi percobaan masuk untuk sementara. Bila lupa kata sandi, hubungi administrator — sandi tidak dapat dipulihkan sendiri.'));
  s.push(sub('Bagian-bagian layar'));
  s.push(p('Seluruh halaman memakai tata letak yang sama:'));
  s.push(table(
    ['Bagian', 'Letak', 'Isi'],
    [
      ['Rel navigasi', 'Kiri', 'Menu dikelompokkan: Operasi, Personel, Pos Jaga, Konfigurasi, Analitik. Tombol <em>Ciutkan</em> di bawah menyempitkan rel agar layar lebih lega.'],
      ['Bilah atas', 'Atas', 'Penanda “Sistem Aktif”, jam berjalan, lonceng notifikasi, nama akun, dan tombol keluar.'],
      ['Area kerja', 'Tengah', 'Isi halaman yang sedang dibuka.'],
    ]
  ));
  s.push(img('web-dasbor', 'Tata letak Pusat Komando: rel navigasi kiri, bilah atas, dan area kerja.'));
  s.push(tip('Kiat', 'Lonceng notifikasi menyala merah bila ada kejadian baru. Notifikasi ditandai terbaca begitu daftarnya Anda buka.'));
  return s.join('\n');
});

part('Bagian A · Aplikasi Web', 'Pusat Komando', () => {
  const s = [];
  s.push(p('Halaman pertama setelah masuk. Isinya ringkasan situasi seluruh site pada saat itu juga — angka-angkanya menyegar sendiri tanpa perlu memuat ulang halaman.'));
  s.push(sub('Empat kartu utama'));
  s.push(table(
    ['Kartu', 'Artinya', 'Yang perlu dilakukan'],
    [
      ['Anggota Bertugas', 'Jumlah anggota yang sudah presensi masuk dan belum pulang.', 'Bandingkan dengan jumlah jadwal hari ini; selisihnya berarti ada yang belum presensi.'],
      ['Patroli Berjalan', 'Putaran patroli yang sedang dijalankan saat ini.', 'Ketuk kartu sesi di bawah untuk melihat sejauh mana titik sudah dipindai.'],
      ['Insiden Terbuka', 'Insiden yang belum selesai ditangani.', 'Perhatikan keterangan “lewat batas SLA” — itu insiden yang menunggak.'],
      ['Sinyal Darurat Aktif', 'Permintaan bantuan dari anggota yang belum direspons.', 'Tangani lebih dulu daripada apa pun di layar ini.'],
    ]
  ));
  s.push(sub('Panel di bawahnya'));
  s.push(ul([
    '<strong>Kepatuhan Patroli</strong> — cincin persentase hari ini beserta grafik 14 hari terakhir, jumlah titik terlewat, dan jumlah site yang dipantau.',
    '<strong>Sebaran Insiden 30 Hari</strong> — komposisi menurut tingkat keparahan serta persentase penanganan yang memenuhi tenggat SLA.',
    '<strong>Patroli Sedang Berjalan</strong> — daftar sesi aktif dengan bilah kemajuan; ketuk untuk membuka rinciannya.',
    '<strong>Aliran Kejadian</strong> — arus kejadian terbaru (pindai titik, insiden, presensi, darurat) yang bertambah sendiri.',
    '<strong>Peta Situasi</strong> — cuplikan peta; ketuk “Layar penuh” untuk membuka halaman peta.',
    '<strong>Peringkat Kinerja Anggota</strong> — sepuluh besar berdasarkan skor gabungan kepatuhan (70%) dan ketepatan waktu (30%).',
  ]));
  s.push(note('Keterangan', 'Angka “hari ini” dihitung menurut tanggal berjalan waktu Indonesia Barat. Pada dini hari angkanya wajar bila masih kecil — riwayat lengkap tetap tersedia di halaman Laporan.'));
  return s.join('\n');
});

part('Bagian A · Aplikasi Web', 'Peta Situasi', () => {
  const s = [];
  s.push(p('Menampilkan posisi seluruh anggota yang sedang online, lokasi site beserta radius geofence-nya, titik-titik patroli, dan sinyal darurat yang belum selesai.'));
  s.push(img('web-peta', 'Peta Situasi: penanda anggota berdenyut, lingkaran putus-putus adalah radius geofence site.'));
  s.push(sub('Membaca penanda peta'));
  s.push(table(
    ['Penanda', 'Arti'],
    [
      ['Kotak kuning bertanda <code>S</code>', 'Lokasi site. Lingkaran putus-putus di sekelilingnya adalah radius geofence presensi.'],
      ['Titik abu-abu', 'Titik patroli yang belum dipindai pada sesi yang sedang dilihat.'],
      ['Titik hijau bertanda centang', 'Titik patroli yang sudah dipindai.'],
      ['Penanda biru berdenyut', 'Posisi anggota yang sedang online.'],
      ['Penanda merah berdenyut', 'Sinyal darurat yang belum ditutup.'],
    ]
  ));
  s.push(sub('Panel kanan'));
  s.push(steps([
    'Ketuk nama pada daftar <strong>Anggota Online</strong> untuk memusatkan peta ke posisi anggota tersebut.',
    'Ketuk baris pada <strong>Sinyal Darurat</strong> untuk melompat ke lokasi kejadian.',
    'Tombol <strong>Fokus darurat</strong> di kanan atas menyembunyikan penanda lain agar hanya sinyal darurat yang terlihat.',
  ]));
  s.push(tip('Kiat', 'Persentase baterai ponsel anggota ikut tampil pada daftar. Angka di bawah 20% ditandai merah — pertanda anggota perlu diingatkan sebelum ponselnya mati di tengah patroli.'));
  return s.join('\n');
});

part('Bagian A · Aplikasi Web', 'Sesi Patroli', () => {
  const s = [];
  s.push(p('Berisi seluruh riwayat putaran patroli beserta buktinya. Halaman ini yang dipakai bila klien menanyakan “benarkah titik itu diperiksa tadi malam?”.'));
  s.push(img('web-patroli', 'Daftar sesi patroli dengan bilah kepatuhan pada tiap baris.'));
  s.push(sub('Menyaring data'));
  s.push(steps([
    'Pilih <strong>site</strong> bila ingin melihat satu lokasi saja.',
    'Pilih <strong>status</strong>: Berjalan, Tuntas, atau Terbengkalai (tidak ada satu pun titik dipindai).',
    'Isi rentang <strong>tanggal</strong> untuk periode tertentu.',
    'Tekan <strong>Ekspor CSV</strong> bila ingin mengolahnya di Excel.',
  ]));
  s.push(sub('Rincian satu sesi'));
  s.push(p('Ketuk tombol <strong>Detail</strong> pada baris mana pun. Halaman rincian menampilkan empat angka utama (kepatuhan, titik dipindai, durasi, jarak tempuh), peta jejak perjalanan, dan urutan pemeriksaan titik demi titik.'));
  s.push(img('web-patroli-detail', 'Rincian sesi: jejak GPS di peta dan urutan pemeriksaan dengan status tiap titik.'));
  s.push(table(
    ['Tanda pada urutan titik', 'Arti'],
    [
      ['Centang hijau', 'Titik dipindai dalam kondisi normal.'],
      ['Centang kuning + label “Temuan”', 'Titik dipindai, tetapi anggota melaporkan ada masalah. Catatannya tertera di bawah.'],
      ['Silang merah', 'Titik tidak dipindai sampai putaran ditutup.'],
      ['Label “Terlambat”', 'Pemindaian melewati target menit rute ditambah toleransi.'],
    ]
  ));
  s.push(note('Keterangan', 'Bila anggota melampirkan foto saat memindai, tautan <em>Lihat foto bukti</em> muncul pada titik tersebut.'));
  return s.join('\n');
});

part('Bagian A · Aplikasi Web', 'Insiden', () => {
  const s = [];
  s.push(p('Semua kejadian yang dilaporkan dari lapangan bermuara di sini, lengkap dengan tenggat penanganan dan jejak siapa melakukan apa.'));
  s.push(img('web-insiden', 'Daftar insiden. Garis warna di kiri menunjukkan tingkat keparahan.'));
  s.push(sub('Tingkat keparahan dan tenggat SLA'));
  s.push(table(
    ['Tingkat', 'Tenggat penanganan', 'Contoh kejadian'],
    [
      ['<span class="pill merah">Kritis</span>', '1 jam', 'Kebakaran, ancaman keselamatan jiwa'],
      ['<span class="pill kuning">Tinggi</span>', '8 jam', 'Pencurian, korban medis'],
      ['<span class="pill kuning">Sedang</span>', '24 jam', 'Orang mencurigakan, kecelakaan ringan'],
      ['<span class="pill hijau">Rendah</span>', '72 jam', 'Lampu mati, pagar penyok'],
    ]
  ));
  s.push(warn('Perhatian', 'Menaikkan atau menurunkan tingkat keparahan akan <strong>menghitung ulang tenggat SLA</strong> dari waktu kejadian. Ubah hanya bila memang keliru sejak awal.'));
  s.push(sub('Membuat laporan dari web'));
  s.push(steps([
    'Tekan <strong>Laporan Baru</strong> di kanan atas.',
    'Pilih <strong>site</strong>, <strong>kategori</strong>, dan <strong>tingkat keparahan</strong>.',
    'Isi judul singkat dan uraian kejadian: kronologi, tindakan yang sudah diambil, dan kondisi terakhir.',
    'Isi petunjuk lokasi dan perkiraan kerugian bila ada.',
    'Tekan <strong>Simpan Laporan</strong>, lalu setujui dialog konfirmasi.',
  ]));
  s.push(sub('Menangani insiden'));
  s.push(img('web-insiden-detail', 'Rincian insiden: uraian, bukti foto, tindakan komando, dan riwayat penanganan.'));
  s.push(steps([
    'Buka insiden dari daftar.',
    'Pada panel <strong>Tindakan Komando</strong>, ubah <strong>status</strong> mengikuti perkembangan: Baru → Ditangani → Selesai → Ditutup. Gunakan <em>Eskalasi</em> bila perlu naik ke pimpinan.',
    'Tunjuk <strong>penanggung jawab</strong>; yang bersangkutan langsung menerima notifikasi.',
    'Tulis perkembangan pada kolom catatan di bawah riwayat, lalu tekan <strong>Kirim Catatan</strong>.',
  ]));
  s.push(note('Keterangan', 'Setiap perubahan status dan catatan tersimpan permanen pada riwayat penanganan beserta nama pelakunya. Pelapor otomatis mendapat notifikasi setiap kali statusnya berubah.'));
  return s.join('\n');
});

part('Bagian A · Aplikasi Web', 'Sinyal Darurat', () => {
  const s = [];
  s.push(p('Halaman ini menampilkan permintaan bantuan yang dikirim anggota lewat tombol darurat di aplikasi lapangan. Sinyal baru juga memunculkan peringatan di layar mana pun yang sedang Anda buka.'));
  s.push(img('web-darurat', 'Daftar sinyal darurat beserta sebaran lokasinya.'));
  s.push(sub('Langkah penanganan'));
  s.push(steps([
    'Hubungi anggota lewat tombol nomor telepon yang tertera.',
    'Tekan <strong>Respons</strong> dan setujui konfirmasi. Anggota langsung menerima pemberitahuan bahwa bantuan sedang menuju lokasi, dan nama Anda tercatat sebagai penanggap.',
    'Kirim tim pendukung sesuai prosedur satuan.',
    'Setelah situasi benar-benar aman, tekan <strong>Tutup</strong> untuk menyelesaikan sinyal.',
  ]));
  s.push(warn('Perhatian', 'Jangan menutup sinyal hanya untuk membersihkan tampilan. Status “Ditutup” dibaca sebagai pernyataan bahwa situasi di lapangan sudah aman.'));
  return s.join('\n');
});

part('Bagian A · Aplikasi Web', 'Jadwal Jaga', () => {
  const s = [];
  s.push(p('Roster mingguan per site dan shift. Jadwal inilah yang menentukan apakah presensi anggota dihitung tepat waktu atau terlambat.'));
  s.push(img('web-jadwal', 'Roster satu pekan. Kolom hari ini diberi bingkai kuning.'));
  s.push(sub('Menambah satu jadwal'));
  s.push(steps([
    'Tekan <strong>Tambah Jadwal</strong>.',
    'Pilih site, shift, dan rute patroli (rute boleh dikosongkan).',
    'Pilih tanggal dan anggota.',
    'Tekan <strong>Simpan</strong> lalu setujui konfirmasi. Anggota menerima notifikasi jadwal baru.',
  ]));
  s.push(sub('Roster massal'));
  s.push(p('Dipakai untuk menyusun jadwal satu bulan sekaligus.'));
  s.push(steps([
    'Tekan <strong>Roster Massal</strong>.',
    'Pilih site, shift, dan rute.',
    'Tentukan rentang tanggal <strong>dari</strong> dan <strong>sampai</strong>.',
    'Pilih hari yang dikehendaki (mis. Senin–Jumat saja). Kosongkan bila untuk semua hari.',
    'Centang anggota yang dijadwalkan, lalu simpan.',
  ]));
  s.push(tip('Kiat', 'Roster massal aman dijalankan berulang: jadwal yang sudah ada dilewati, tidak digandakan.'));
  s.push(sub('Membaca kartu jadwal'));
  s.push(table(
    ['Label', 'Arti'],
    [
      ['<span class="pill kuning">Rencana</span>', 'Jadwal tersusun, anggota belum presensi.'],
      ['<span class="pill biru">Dikonfirmasi</span>', 'Anggota sudah presensi masuk.'],
      ['<span class="pill hijau">Selesai</span>', 'Anggota sudah presensi pulang.'],
      ['<span class="pill merah">Absen</span>', 'Ditandai tidak hadir.'],
    ]
  ));
  return s.join('\n');
});

part('Bagian A · Aplikasi Web', 'Presensi', () => {
  const s = [];
  s.push(p('Catatan kehadiran anggota beserta bukti lokasinya. Kolom <strong>jarak dari pos</strong> menunjukkan seberapa dekat anggota saat menekan tombol presensi.'));
  s.push(img('web-presensi', 'Rekap presensi dengan ringkasan keterlambatan dan rata-rata jam kerja.'));
  s.push(ul([
    '<strong>Tepat Waktu</strong> — presensi masuk dalam batas toleransi shift.',
    '<strong>Terlambat</strong> — melewati toleransi; selisih menit ikut tercatat.',
    '<strong>Pulang Awal</strong> — presensi pulang lebih dari 15 menit sebelum shift berakhir.',
    '<strong>bertugas</strong> pada kolom pulang — anggota masih dalam dinas.',
  ]));
  s.push(p('Tombol <strong>Ekspor CSV</strong> menghasilkan rekap sesuai rentang tanggal yang dipilih, siap dipakai untuk perhitungan gaji atau lampiran laporan bulanan.'));
  return s.join('\n');
});

part('Bagian A · Aplikasi Web', 'Data Personel', () => {
  const s = [];
  s.push(p('Daftar seluruh pengguna sistem: anggota, supervisor, administrator, dan akun klien.'));
  s.push(img('web-personel', 'Data personel dengan penyaring peran.'));
  s.push(sub('Menambah personel'));
  s.push(steps([
    'Tekan <strong>Tambah Personel</strong>.',
    'Isi nama lengkap, NIP, dan nama pengguna untuk masuk.',
    'Isi kata sandi awal. Bila dikosongkan, sistem memakai <code>patroli123</code>.',
    'Pilih peran dan penempatan utama (untuk akun klien: pilih perusahaan kliennya).',
    'Simpan, lalu setujui konfirmasi.',
  ]));
  s.push(warn('Perhatian', 'Menonaktifkan personel <strong>tidak menghapus</strong> riwayat patroli dan presensinya — data itu tetap dibutuhkan sebagai bukti. Akun hanya ditandai berhenti sehingga tidak bisa masuk lagi.'));
  s.push(p('Ketuk nama personel untuk membuka profil kinerjanya: jumlah patroli 30 hari, rata-rata kepatuhan, ketepatan waktu, jumlah insiden yang dilaporkan, dan sepuluh sesi terakhir.'));
  return s.join('\n');
});

part('Bagian A · Aplikasi Web', 'Pos Jaga: Tamu, Kendaraan, Inventaris', () => {
  const s = [];
  s.push(sub('Buku Tamu'));
  s.push(p('Menggantikan buku tamu kertas di pos. Data tamu dapat dicatat dari web maupun dari aplikasi anggota.'));
  s.push(img('web-tamu', 'Buku tamu dengan ringkasan jumlah tamu yang masih berada di dalam area.'));
  s.push(steps([
    'Tekan <strong>Tamu Masuk</strong> lalu isi site, nama, identitas, keperluan, dan orang yang dituju.',
    'Isi nomor polisi bila tamu membawa kendaraan.',
    'Simpan dan setujui konfirmasi — tamu berstatus <em>Di Dalam</em>.',
    'Saat tamu pulang, tekan <strong>Keluar</strong> pada barisnya lalu setujui konfirmasi.',
  ]));
  s.push(sub('Lalu Lintas Kendaraan'));
  s.push(p('Pencatatan kendaraan masuk dan keluar beserta muatannya — penting pada site gudang dan pabrik.'));
  s.push(img('web-kendaraan', 'Catatan kendaraan; nomor polisi otomatis diubah menjadi huruf kapital.'));
  s.push(sub('Inventaris'));
  s.push(p('Daftar peralatan jaga: handy talky, senter, metal detector, APAR. Mengisi kolom <strong>Dipegang oleh</strong> otomatis mengubah status barang menjadi <em>Dipegang</em>.'));
  s.push(img('web-inventaris', 'Inventaris peralatan dengan ringkasan status.'));
  return s.join('\n');
});

part('Bagian A · Aplikasi Web', 'Serah Terima Shift', () => {
  const s = [];
  s.push(p('Berita acara pergantian jaga: situasi terakhir, pekerjaan yang belum selesai, dan kondisi peralatan. Penerima shift wajib mengonfirmasi.'));
  s.push(img('web-serah-terima', 'Berita acara serah terima; kartu menunggu konfirmasi diberi bingkai kuning.'));
  s.push(steps([
    'Tekan <strong>Buat Berita Acara</strong>.',
    'Pilih site dan anggota penerima shift.',
    'Isi uraian situasi, pekerjaan tertunda, dan kondisi peralatan.',
    'Kirim — penerima langsung mendapat notifikasi.',
    'Penerima membuka kartu tersebut dan menekan <strong>Konfirmasi Terima</strong>.',
  ]));
  s.push(note('Keterangan', 'Isi berita acara tidak dapat diubah setelah dikirim. Ini disengaja agar catatan serah terima tidak bisa disunting belakangan.'));
  return s.join('\n');
});

part('Bagian A · Aplikasi Web', 'Konfigurasi: Klien, Site, Titik & Rute', () => {
  const s = [];
  s.push(p('Bab ini untuk administrator. Urutan penyiapan yang benar: <strong>Klien → Site → Titik Patroli → Rute → Shift → Personel → Jadwal</strong>.'));
  s.push(sub('Klien'));
  s.push(p('Perusahaan pengguna jasa pengamanan beserta nomor dan masa berlaku kontraknya.'));
  s.push(img('web-form-klien', 'Formulir data klien.'));
  s.push(sub('Site & Lokasi'));
  s.push(p('Lokasi penempatan. Dua isian yang paling menentukan:'));
  s.push(table(
    ['Isian', 'Cara mengisi'],
    [
      ['Lintang & Bujur', 'Buka Google Maps, klik kanan pada titik pos jaga, salin angka koordinat yang muncul (mis. <code>-6.27950, 107.14620</code>).'],
      ['Radius geofence', 'Jarak dalam meter dari koordinat itu. Presensi di luar radius akan ditolak. Untuk kawasan luas isi 300–500 m; untuk gedung tunggal 100–200 m.'],
    ]
  ));
  s.push(img('web-site', 'Daftar site beserta sebarannya di peta.'));
  s.push(warn('Perhatian', 'Radius terlalu sempit membuat anggota gagal presensi meski sudah di pos; terlalu longgar membuat presensi bisa dilakukan dari luar area. Sesuaikan dengan luas site sebenarnya.'));
  s.push(sub('Titik Patroli'));
  s.push(p('Titik pemeriksaan yang harus disambangi anggota. Kode titik dipakai sebagai isi QR.'));
  s.push(img('web-form-titik', 'Formulir titik patroli: koordinat, toleransi jarak, dan tag NFC.'));
  s.push(sub('Mencetak kartu QR'));
  s.push(steps([
    'Buka tab <strong>Titik Patroli</strong>.',
    'Tekan ikon QR pada baris titik yang dikehendaki.',
    'Periksa nama titik dan kodenya pada kartu yang muncul.',
    'Tekan <strong>Cetak Kartu</strong>, cetak, lalu laminasi dan tempel di lokasi titik.',
  ]));
  s.push(img('web-qr', 'Kartu QR siap cetak untuk ditempel di titik patroli.'));
  s.push(tip('Kiat', 'Tempel kartu pada ketinggian dada di tempat terlindung dari hujan, dan hindari permukaan yang memantulkan cahaya agar mudah dipindai malam hari.'));
  s.push(sub('Rute Patroli'));
  s.push(p('Rute adalah urutan titik yang harus dilalui dalam satu putaran.'));
  s.push(steps([
    'Buka tab <strong>Rute Patroli</strong> lalu tekan <strong>Tambah</strong>.',
    'Pilih site, isi nama rute dan durasi normal satu putaran (menit).',
    'Isi toleransi keterlambatan per titik.',
    'Centang <strong>Wajib berurutan</strong> bila anggota harus memindai sesuai urutan.',
    'Centang <strong>Wajib foto tiap titik</strong> untuk site berisiko tinggi.',
    'Klik titik pada daftar kiri satu per satu — urutan mengikuti urutan klik Anda.',
  ]));
  s.push(img('web-titik', 'Konfigurasi titik, rute, dan shift dalam satu halaman bertab.'));
  s.push(note('Keterangan', 'Target waktu tiap titik dihitung otomatis dengan membagi durasi rute secara merata. Angka inilah yang dipakai untuk menandai pemindaian terlambat.'));
  s.push(sub('Shift Jaga'));
  s.push(p('Pola jam kerja per site, mis. Pagi 07:00–15:00, Sore 15:00–23:00, Malam 23:00–07:00. Shift yang berakhir lebih pagi dari jam mulainya otomatis ditandai lintas hari. Toleransi telat menentukan berapa menit keterlambatan masih dihitung tepat waktu.'));
  return s.join('\n');
});

part('Bagian A · Aplikasi Web', 'Pengumuman, Laporan, dan Jejak Audit', () => {
  const s = [];
  s.push(sub('Pengumuman'));
  s.push(p('Instruksi resmi kepada seluruh anggota. Pengumuman yang diterbitkan langsung terkirim sebagai notifikasi dan muncul di beranda aplikasi lapangan.'));
  s.push(img('web-pengumuman', 'Daftar pengumuman menurut prioritas.'));
  s.push(sub('Laporan & Ekspor'));
  s.push(p('Pusat rekapitulasi untuk laporan bulanan kepada klien.'));
  s.push(img('web-laporan', 'Laporan: tren kepatuhan, profil risiko per site, peringkat personel, dan titik rawan terlewat.'));
  s.push(ul([
    '<strong>Tren Kepatuhan 30 Hari</strong> — perkembangan kepatuhan dan jumlah sesi per hari.',
    '<strong>Profil Risiko per Site</strong> — membandingkan kepatuhan dengan indeks insiden tiap site.',
    '<strong>Rekapitulasi per Site</strong> — jumlah patroli, kepatuhan, titik terlewat, insiden, presensi, dan tamu.',
    '<strong>Peringkat Kinerja Personel</strong> — dasar penilaian anggota terbaik bulanan.',
    '<strong>Titik Paling Sering Terlewat</strong> — bahan evaluasi rute; titik dengan angka merah perlu ditinjau letaknya.',
  ]));
  s.push(steps([
    'Tentukan rentang tanggal di kanan atas halaman.',
    'Baca ringkasan pada empat kartu dan grafik di bawahnya.',
    'Tekan salah satu tombol <strong>CSV</strong> untuk mengunduh data mentah patroli, insiden, atau presensi.',
  ]));
  s.push(tip('Kiat', 'Berkas CSV terbuka langsung di Excel dengan huruf Indonesia yang benar; gunakan untuk membuat lampiran laporan bulanan ke klien.'));
  s.push(sub('Jejak Audit'));
  s.push(p('Rekaman setiap tindakan pengguna: masuk, membuat, mengubah, menghapus, presensi, memulai dan menutup patroli, hingga menekan tombol darurat — lengkap dengan waktu dan alamat IP.'));
  s.push(img('web-audit', 'Jejak audit dengan penyaring per jenis data.'));
  s.push(note('Keterangan', 'Jejak audit hanya dapat dibaca; tidak ada tombol untuk mengubah atau menghapusnya, termasuk oleh administrator.'));
  return s.join('\n');
});

part('Bagian A · Aplikasi Web', 'Dialog Konfirmasi dan Profil', () => {
  const s = [];
  s.push(sub('Dialog konfirmasi'));
  s.push(p('Setiap tindakan yang mengubah data selalu meminta persetujuan lebih dulu. Warna dialog menunjukkan jenis tindakannya.'));
  s.push(table(
    ['Warna', 'Jenis tindakan', 'Contoh'],
    [
      ['<span class="pill biru">Biru</span>', 'Menyimpan data baru atau perubahan', 'Simpan klien, simpan titik patroli, simpan jadwal'],
      ['<span class="pill kuning">Kuning</span>', 'Tindakan operasional yang perlu dipastikan', 'Respons sinyal darurat, catat tamu keluar, ubah status insiden'],
      ['<span class="pill merah">Merah</span>', 'Penghapusan yang tidak dapat dibatalkan', 'Hapus site, hapus titik patroli, nonaktifkan personel'],
      ['<span class="pill ungu">Ungu</span>', 'Mengakhiri sesi', 'Keluar dari aplikasi'],
    ]
  ));
  s.push(img('web-dialog-simpan', 'Dialog konfirmasi penyimpanan data.'));
  s.push(img('web-dialog-keluar', 'Dialog konfirmasi keluar.'));
  s.push(p('Menekan <strong>Batal</strong>, tombol silang, atau area gelap di luar dialog akan membatalkan tindakan tanpa mengubah apa pun.'));
  s.push(sub('Profil dan kata sandi'));
  s.push(steps([
    'Ketuk nama Anda di kanan atas untuk membuka halaman profil.',
    'Periksa data akun: pangkat, penempatan, kontak, dan waktu masuk terakhir.',
    'Untuk mengganti sandi: isi sandi lama, sandi baru (minimal 6 karakter), dan ulangi sandi baru.',
    'Tekan <strong>Perbarui Kata Sandi</strong> lalu setujui konfirmasi.',
  ]));
  s.push(img('web-profil', 'Halaman profil beserta tautan unduh aplikasi Android.'));
  return s.join('\n');
});

/* ═══════════════ BAGIAN B — MOBILE ═══════════════ */
part('Bagian B · Aplikasi Lapangan', 'Memasang dan Membuka Aplikasi', () => {
  const s = [];
  s.push(sub('Memasang aplikasi'));
  s.push(steps([
    'Buka <code>https://patroli.gokar.id/PATROLI.apk</code> dari peramban ponsel Android.',
    'Ketuk berkas hasil unduhan.',
    'Bila muncul peringatan “sumber tidak dikenal”, ketuk <strong>Setelan</strong> lalu izinkan pemasangan dari peramban tersebut.',
    'Ketuk <strong>Pasang</strong>, lalu <strong>Buka</strong>.',
  ]));
  s.push(warn('Perhatian', 'Saat pertama dijalankan, aplikasi meminta izin <strong>lokasi</strong> dan <strong>kamera</strong>. Keduanya wajib diizinkan — tanpa lokasi, presensi dan pemindaian titik tidak dapat diverifikasi.'));
  s.push(sub('Layar pembuka dan pengenalan'));
  s.push(p('Sekali seumur pemasangan, aplikasi menampilkan empat halaman pengenalan. Geser ke kiri untuk melanjutkan atau ketuk <strong>Lewati</strong> di kanan atas.'));
  s.push(hpPair('hp-splash', 'hp-onboarding', 'Layar pembuka dan halaman pengenalan pertama.'));
  s.push(sub('Masuk'));
  s.push(steps([
    'Isi nama pengguna atau NIP yang diberikan komandan.',
    'Isi kata sandi.',
    'Ketuk <strong>MASUK</strong>.',
  ]));
  s.push(hp('hp-masuk', 'Layar masuk aplikasi lapangan.'));
  s.push(note('Keterangan', 'Sesi bertahan 30 hari. Anda tidak perlu masuk ulang setiap hari, cukup buka aplikasi.'));
  return s.join('\n');
});

part('Bagian B · Aplikasi Lapangan', 'Beranda', () => {
  const s = [];
  s.push(p('Beranda menyusun semua yang dibutuhkan selama bertugas dalam satu layar.'));
  s.push(hp('hp-beranda', 'Beranda aplikasi lapangan.'));
  s.push(table(
    ['Bagian', 'Isi'],
    [
      ['Kepala layar', 'Sapaan, nama Anda, dan lencana status: <strong>Bertugas</strong> (hijau) atau <strong>Luar Dinas</strong> (abu-abu).'],
      ['Tiga petak', 'Jumlah jadwal hari ini, titik yang sudah dipindai pada patroli berjalan, dan jam sekarang.'],
      ['Kartu presensi', 'Tombol presensi masuk atau pulang beserta keterangan shift Anda.'],
      ['Kisi pintasan', 'Delapan layanan: Buku Tamu, Kendaraan, Serah Terima, Jadwal Saya, Lapor Insiden, Pengumuman, Riwayat Patroli, dan Semua Layanan.'],
      ['Jadwal jaga', 'Shift Anda hari ini beserta rutenya.'],
      ['Pengumuman', 'Geser ke samping untuk membaca pengumuman terbaru.'],
      ['Tombol darurat', 'Kartu merah di bagian bawah.'],
    ]
  ));
  s.push(sub('Bilah bawah'));
  s.push(p('Empat tab: <strong>Beranda</strong>, <strong>Patroli</strong>, <strong>Insiden</strong>, dan <strong>Profil</strong>. Tombol bundar kuning yang menggantung tepat di tengah adalah <strong>pindai cepat</strong> — langsung membuka kamera pemindai bila ada patroli yang sedang berjalan.'));
  s.push(p('Layanan lain dibuka lewat pintasan <strong>Semua Layanan</strong> pada kisi di beranda.'));
  s.push(hp('hp-layanan', 'Halaman Semua Layanan: seluruh perangkat tugas dikelompokkan menurut jenisnya.'));
  s.push(tip('Kiat', 'Tarik layar ke bawah pada beranda untuk menyegarkan data bila jadwal baru saja diubah komandan.'));
  return s.join('\n');
});

part('Bagian B · Aplikasi Lapangan', 'Presensi Masuk dan Pulang', () => {
  const s = [];
  s.push(sub('Presensi masuk'));
  s.push(steps([
    'Pastikan Anda sudah berada di area pos jaga dan GPS ponsel menyala.',
    'Ketuk <strong>PRESENSI MASUK</strong> pada beranda.',
    'Baca dialog konfirmasi — di dalamnya tertera site dan shift Anda — lalu ketuk <strong>Ya, presensi</strong>.',
    'Kamera depan terbuka untuk swafoto. Ambil foto lalu setujui.',
    'Tunggu sampai muncul pesan “Presensi masuk berhasil dicatat”.',
  ]));
  s.push(hp('hp-dialog-presensi', 'Dialog konfirmasi presensi masuk.'));
  s.push(warn('Presensi ditolak?', 'Bila muncul pesan “Anda berada … m dari pos (batas … m)”, artinya posisi Anda di luar radius site. Mendekatlah ke pos jaga, tunggu GPS mengunci di ruang terbuka, lalu ulangi. Jangan meminta orang lain melakukan presensi untuk Anda — koordinat dan foto tercatat.'));
  s.push(sub('Presensi pulang'));
  s.push(steps([
    'Pastikan tidak ada patroli yang masih berjalan dan serah terima sudah dibuat.',
    'Ketuk <strong>PRESENSI PULANG</strong>, lalu setujui konfirmasi.',
    'Ambil swafoto sebagai bukti akhir tugas.',
  ]));
  s.push(note('Keterangan', 'Durasi kerja dihitung otomatis dari selisih jam masuk dan pulang. Pulang lebih dari 15 menit sebelum shift berakhir ditandai <em>Pulang Awal</em> pada laporan.'));
  return s.join('\n');
});

part('Bagian B · Aplikasi Lapangan', 'Menjalankan Patroli', () => {
  const s = [];
  s.push(sub('Memulai putaran'));
  s.push(steps([
    'Buka tab <strong>Patroli</strong>.',
    'Periksa kartu rute: jumlah titik, durasi target, dan aturannya (wajib urut / wajib foto).',
    'Ketuk <strong>MULAI PATROLI</strong> lalu setujui konfirmasi. Waktu mulai dicatat saat itu juga.',
  ]));
  s.push(hp('hp-patroli', 'Tab Patroli sebelum putaran dimulai.'));
  s.push(hp('hp-patroli-aktif', 'Putaran berjalan: peta titik, kemajuan, dan tombol AKHIRI di kanan atas.'));
  s.push(sub('Memindai titik'));
  s.push(steps([
    'Datangi titik sesuai urutan pada daftar.',
    'Ketuk tombol bundar kuning <strong>pindai</strong> yang menggantung di tengah bilah bawah.',
    'Arahkan kamera ke stiker QR sampai kode terbaca sendiri. Gunakan tombol senter di kanan atas bila gelap.',
    'Titik yang berhasil dipindai berubah menjadi centang hijau dan bilah kemajuan bertambah.',
  ]));
  s.push(sub('Bila QR rusak atau tidak terbaca'));
  s.push(steps([
    'Ketuk ikon <strong>⋯</strong> pada baris titik tersebut.',
    'Tulis catatan kondisi titik bila perlu.',
    'Aktifkan sakelar <strong>Ada temuan di titik ini</strong> bila menemukan masalah — supervisor langsung menerima notifikasi.',
    'Ambil foto bukti bila rute mewajibkannya.',
    'Ketuk <strong>VERIFIKASI LEWAT GPS</strong> lalu setujui konfirmasi.',
  ]));
  s.push(warn('Perhatian', 'Verifikasi GPS hanya diterima bila Anda benar-benar berada dalam radius titik. Bila muncul pesan jarak terlalu jauh, mendekatlah ke titik lalu ulangi.'));
  s.push(sub('Mengakhiri putaran'));
  s.push(steps([
    'Ketuk tombol <strong>AKHIRI</strong> di kanan atas, sebaris dengan angka kemajuan titik.',
    'Baca dialog: bila masih ada titik belum dipindai, jumlahnya disebutkan dan akan tercatat terlewat.',
    'Ketuk <strong>Ya, akhiri</strong>. Hasil kepatuhan langsung terkirim ke pusat komando.',
  ]));
  s.push(tip('Kiat', 'Selesaikan seluruh titik sebelum mengakhiri. Angka kepatuhan Anda menjadi dasar peringkat kinerja bulanan.'));
  return s.join('\n');
});

part('Bagian B · Aplikasi Lapangan', 'Insiden, Darurat, dan Pos Jaga', () => {
  const s = [];
  s.push(sub('Melaporkan insiden'));
  s.push(steps([
    'Buka tab <strong>Insiden</strong> lalu ketuk <strong>LAPOR KEJADIAN BARU</strong> — atau gunakan pintasan <em>Lapor Insiden</em> di beranda.',
    'Pilih kategori kejadian.',
    'Pilih tingkat keparahan; tenggat penanganan langsung ditampilkan di bawahnya.',
    'Isi judul singkat dan uraian: kronologi, tindakan yang sudah diambil, kondisi terakhir.',
    'Ketuk kotak <strong>+</strong> untuk mengambil foto bukti (boleh lebih dari satu).',
    'Ketuk <strong>KIRIM LAPORAN</strong> lalu setujui konfirmasi.',
  ]));
  s.push(hp('hp-insiden', 'Daftar insiden yang Anda laporkan.'));
  s.push(note('Keterangan', 'Anda hanya melihat laporan yang Anda buat sendiri. Perkembangan penanganannya dikirim sebagai notifikasi.'));
  s.push(sub('Tombol darurat'));
  s.push(steps([
    'Buka beranda, gulir ke kartu merah <strong>Tombol Darurat</strong>.',
    'Ketuk <strong>KIRIM SINYAL DARURAT</strong>.',
    'Setujui dialog konfirmasi. Posisi Anda langsung terkirim ke pusat komando dan seluruh supervisor.',
    'Tetap di tempat aman sampai menerima pemberitahuan bahwa bantuan sedang menuju lokasi.',
  ]));
  s.push(warn('Perhatian', 'Gunakan hanya untuk keadaan darurat sungguhan. Setiap penekanan tercatat beserta nama dan koordinat Anda.'));
  s.push(sub('Buku tamu dan kendaraan'));
  s.push(steps([
    'Ketuk pintasan <strong>Buku Tamu</strong> atau <strong>Kendaraan</strong> di beranda.',
    'Ketuk tombol di bawah layar untuk membuka formulir.',
    'Isi data tamu atau kendaraan, lalu simpan dan setujui konfirmasi.',
    'Saat tamu atau kendaraan keluar, ketuk <strong>Catat keluar</strong> pada barisnya.',
  ]));
  s.push(hpPair('hp-buku-tamu', 'hp-form-tamu', 'Buku tamu dan formulir pencatatan tamu masuk.'));
  s.push(sub('Serah terima shift'));
  s.push(steps([
    'Ketuk pintasan <strong>Serah Terima</strong>.',
    'Ketuk <strong>BUAT BERITA ACARA</strong>.',
    'Pilih anggota penerima shift.',
    'Isi uraian situasi, pekerjaan tertunda, dan kondisi peralatan.',
    'Kirim lalu setujui konfirmasi.',
  ]));
  s.push(p('Bila Anda yang menerima shift, buka kartu berita acara lalu ketuk <strong>Konfirmasi terima</strong> setelah memeriksa keadaan di lapangan.'));
  s.push(sub('Jadwal, riwayat, dan profil'));
  s.push(p('Pintasan <strong>Jadwal Saya</strong> berisi tiga tab: roster jaga, riwayat patroli beserta angka kepatuhannya, dan riwayat presensi. Tab <strong>Profil</strong> menampilkan kinerja 30 hari terakhir, pengumuman satuan, dan tombol keluar.'));
  s.push(hp('hp-profil', 'Tab Profil: kinerja pribadi dan pengumuman.'));
  return s.join('\n');
});

/* ═══════════════ C — ALUR HARIAN ═══════════════ */
part('Bagian C', 'Alur Kerja Harian', () => {
  const s = [];
  s.push(sub('Anggota security'));
  s.push(table(
    ['Waktu', 'Yang dilakukan', 'Di mana'],
    [
      ['Tiba di pos', 'Presensi masuk + swafoto', 'Beranda aplikasi'],
      ['Awal shift', 'Baca berita acara serah terima dan konfirmasi', 'Pintasan Serah Terima'],
      ['Selama shift', 'Jalankan patroli sesuai rute, pindai setiap titik', 'Tab Patroli'],
      ['Saat ada kejadian', 'Kirim laporan insiden berfoto', 'Tab Insiden'],
      ['Ada tamu / kendaraan', 'Catat masuk dan keluar', 'Pintasan Buku Tamu / Kendaraan'],
      ['Akhir shift', 'Buat berita acara, lalu presensi pulang', 'Pintasan Serah Terima → Beranda'],
    ]
  ));
  s.push(sub('Supervisor / Danru'));
  s.push(table(
    ['Waktu', 'Yang dilakukan', 'Di mana'],
    [
      ['Awal shift', 'Periksa jumlah anggota bertugas vs jadwal', 'Pusat Komando'],
      ['Sepanjang hari', 'Pantau patroli berjalan dan aliran kejadian', 'Pusat Komando / Peta Situasi'],
      ['Ada sinyal darurat', 'Hubungi anggota, tekan Respons, kirim bantuan', 'Sinyal Darurat'],
      ['Ada insiden baru', 'Tunjuk penanggung jawab, perbarui status sebelum tenggat SLA', 'Insiden'],
      ['Akhir shift', 'Periksa sesi dengan titik terlewat dan tindak lanjuti', 'Sesi Patroli'],
    ]
  ));
  s.push(sub('Administrator'));
  s.push(table(
    ['Berkala', 'Yang dilakukan', 'Di mana'],
    [
      ['Mingguan', 'Susun roster pekan berikutnya', 'Jadwal Jaga → Roster Massal'],
      ['Mingguan', 'Tinjau titik yang sering terlewat, evaluasi letak atau rutenya', 'Laporan'],
      ['Bulanan', 'Tarik rekap per site dan CSV untuk laporan klien', 'Laporan → Ekspor'],
      ['Bulanan', 'Tinjau peringkat kinerja untuk penilaian anggota', 'Laporan'],
      ['Sesuai kebutuhan', 'Tambah personel, site, titik, dan rute baru', 'Konfigurasi'],
    ]
  ));
  return s.join('\n');
});

/* ═══════════════ D — PEMECAHAN MASALAH ═══════════════ */
part('Bagian D', 'Pemecahan Masalah', () => {
  const s = [];
  s.push(table(
    ['Gejala', 'Penyebab yang paling sering', 'Tindakan'],
    [
      ['Presensi ditolak, muncul jarak dalam meter', 'Posisi di luar radius geofence site, atau GPS belum mengunci', 'Mendekat ke pos jaga, keluar dari bangunan beton sebentar, tunggu 10–20 detik, ulangi'],
      ['“Layanan lokasi perangkat mati”', 'GPS ponsel dinonaktifkan', 'Aktifkan lokasi di panel pengaturan cepat ponsel'],
      ['“Izin lokasi diblokir permanen”', 'Izin ditolak permanen saat pemasangan', 'Setelan ponsel → Aplikasi → PATROLI → Izin → Lokasi → Izinkan'],
      ['QR tidak terbaca', 'Stiker kotor, buram, atau terlalu gelap', 'Bersihkan stiker, nyalakan senter aplikasi; bila tetap gagal gunakan verifikasi GPS lewat ikon ⋯'],
      ['“Titik ini tidak termasuk dalam rute”', 'Memindai titik milik rute atau site lain', 'Periksa rute yang sedang berjalan; hubungi danru bila rute keliru'],
      ['“Titik ini sudah dipindai”', 'Titik yang sama dipindai dua kali', 'Lanjutkan ke titik berikutnya'],
      ['“Rute ini wajib berurutan”', 'Melompati titik pada rute berurutan', 'Kembali ke titik yang terlewat lalu pindai sesuai urutan'],
      ['“Masih ada patroli berjalan”', 'Putaran sebelumnya belum ditutup', 'Buka tab Patroli lalu ketuk AKHIRI pada putaran tersebut'],
      ['Tidak ada rute di tab Patroli', 'Jadwal hari ini belum diberi rute', 'Hubungi danru agar jadwal dilengkapi rute'],
      ['Tidak ada jadwal hari ini', 'Roster belum disusun', 'Hubungi administrator'],
      ['Aplikasi meminta masuk ulang', 'Sesi 30 hari berakhir atau sandi diubah', 'Masuk kembali dengan sandi terbaru'],
      ['Akun klien ditolak di aplikasi', 'Akun klien memang hanya untuk portal web', 'Buka <code>patroli.gokar.id</code> lewat peramban'],
      ['Peta kosong di web', 'Jaringan memblokir peta OpenStreetMap', 'Gunakan jaringan lain; fungsi lain tetap berjalan normal'],
      ['Angka “hari ini” nol pada dini hari', 'Hari baru saja berganti', 'Lihat rentang tanggal di halaman Laporan'],
    ]
  ));
  return s.join('\n');
});

/* ═══════════════ LAMPIRAN ═══════════════ */
part('Lampiran', 'Daftar Istilah dan Akun', () => {
  const s = [];
  s.push(sub('Daftar istilah'));
  s.push(table(
    ['Istilah', 'Arti'],
    [
      ['Site', 'Lokasi penempatan pengamanan milik satu klien'],
      ['Geofence', 'Radius di sekitar koordinat site; presensi hanya diterima di dalamnya'],
      ['Titik patroli', 'Lokasi pemeriksaan yang ditandai stiker QR atau tag NFC'],
      ['Rute', 'Urutan titik yang harus dilalui dalam satu putaran patroli'],
      ['Sesi patroli', 'Satu putaran patroli, dari ditekan mulai sampai diakhiri'],
      ['Kepatuhan', 'Persentase titik yang berhasil dipindai dibanding seluruh titik pada rute'],
      ['SLA', 'Batas waktu penanganan insiden menurut tingkat keparahannya'],
      ['Eskalasi', 'Menaikkan penanganan insiden ke tingkat yang lebih tinggi'],
      ['Serah terima', 'Berita acara pergantian shift antar anggota'],
      ['Jejak audit', 'Rekaman seluruh tindakan pengguna di dalam sistem'],
    ]
  ));
  s.push(sub('Akun percobaan'));
  s.push(p('Akun berikut tersedia pada lingkungan demonstrasi. <strong>Ganti seluruh kata sandi sebelum sistem dipakai sungguhan.</strong>'));
  s.push(table(
    ['Pengguna', 'Kata sandi', 'Peran'],
    [
      ['<code>admin</code>', '<code>admin123</code>', 'Super Admin'],
      ['<code>komandan</code>', '<code>komandan123</code>', 'Chief Security'],
      ['<code>danru1</code>, <code>danru2</code>', '<code>danru123</code>', 'Supervisor'],
      ['<code>guard1</code> … <code>guard16</code>', '<code>guard123</code>', 'Anggota'],
      ['<code>klien</code>', '<code>klien123</code>', 'Klien'],
    ]
  ));
  s.push(warn('Sebelum dipakai sungguhan', 'Hapus atau nonaktifkan akun percobaan, ganti kata sandi seluruh akun asli, sesuaikan radius geofence tiap site dengan luas sebenarnya, dan cetak ulang kartu QR untuk titik yang sudah final.'));
  return s.join('\n');
});

/* ── Perakitan berkas ── */
const isiBab = bab.map(
  (b) => `<h1 class="part"><span>${b.kicker}</span>${b.nomor}. ${b.judul}</h1>\n${b.html}`
);

const daftarIsi = bab
  .map((b) => {
    const utama = `<div class="toc-item"><span class="n">${b.nomor}</span><span>${b.judul}</span></div>`;
    const anak = b.sub
      .map((t, i) => `<div class="toc-item sub"><span class="n">${b.nomor}.${i + 1}</span><span>${t}</span></div>`)
      .join('');
    return utama + anak;
  })
  .join('');


const html = `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<title>Panduan Penggunaan PATROLI</title>
<link rel="stylesheet" href="style.css">
</head>
<body>

<section class="cover">
  <div>
    <div class="cover-brand">
      <div class="cover-mark"><svg viewBox="0 0 32 32" width="24" height="24" fill="none">
        <path d="M16 4l10 3.8v7.4c0 6.2-4.2 11.6-10 12.8C10.2 26.8 6 21.4 6 15.2V7.8L16 4z"
              stroke="#FFB020" stroke-width="2" stroke-linejoin="round"/>
        <circle cx="16" cy="14.5" r="3.2" fill="#22D3EE"/>
      </svg></div>
      <div>
        <div class="cover-name">PATROLI</div>
        <div class="cover-sub">Security Command Center</div>
      </div>
    </div>
  </div>
  <div>
    <h1>Panduan<br>Penggunaan<br><em>Aplikasi</em></h1>
    <p class="cover-lead">Sistem manajemen satuan pengamanan dan pelacakan patroli — untuk pengguna aplikasi web (Pusat Komando) dan aplikasi lapangan Android.</p>
  </div>
  <div class="cover-meta">
    <div><b>Versi 1.0</b>Dokumen panduan pengguna</div>
    <div><b>patroli.gokar.id</b>Alamat sistem</div>
    <div><b>Web &amp; Android</b>Cakupan panduan</div>
    <div><b>Semua peran</b>Anggota, supervisor, admin, klien</div>
  </div>
</section>

<section class="toc">
  <h1 class="part" style="page-break-before:auto"><span>Isi Panduan</span>Daftar Isi</h1>
  ${daftarIsi}
</section>

${isiBab.join('\n')}

</body>
</html>`;

fs.writeFileSync(path.join(__dirname, 'panduan.html'), html);
console.log(`▸ panduan.html tersusun — ${bab.length} bab`);
