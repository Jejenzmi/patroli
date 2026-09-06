/**
 * Menyusun berkas HTML Panduan Penggunaan DHARMAPATI.
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
    'Panduan ini menjelaskan cara memakai <strong>DHARMAPATI</strong> — sistem manajemen satuan pengamanan dan pelacakan patroli — baik lewat <strong>aplikasi web (Pusat Komando)</strong> maupun <strong>aplikasi lapangan Android</strong>. Seluruh gambar di dalamnya diambil langsung dari sistem yang berjalan, bukan gambar rancangan.'
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
      ['Aplikasi web', '<code>https://dashboard.dharmapati.co.id</code>', 'Dibuka dari peramban komputer maupun ponsel'],
      ['Aplikasi Android', '<code>https://dashboard.dharmapati.co.id/DHARMAPATI.apk</code>', 'Unduh lalu pasang di ponsel anggota'],
    ]
  ));
  return s.join('\n');
});

/* ═══════════════ 2. MENGENAL DHARMAPATI ═══════════════ */
part('Pendahuluan', 'Mengenal DHARMAPATI', () => {
  const s = [];
  s.push(p(
    'DHARMAPATI menggantikan buku jaga dan laporan tulis tangan dengan catatan digital yang dapat diverifikasi. Setiap kehadiran, putaran patroli, dan kejadian tercatat lengkap dengan waktu, koordinat, dan pelakunya — sehingga laporan kepada klien tidak lagi berdasarkan ingatan.'
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
  s.push(warn('Pintu masuk terpisah', 'Setiap peran memakai pintunya sendiri. Akun <strong>Anggota</strong> ditolak di portal web dan diarahkan ke aplikasi lapangan; akun <strong>Klien</strong> ditolak di aplikasi lapangan dan diarahkan ke portal web. Penolakan ini dilakukan di sisi server, bukan sekadar disembunyikan di tampilan.'));
  s.push(sub('Rincian hak akses'));
  s.push(p('Tabel berikut adalah aturan yang benar-benar diberlakukan server pada setiap permintaan. Menyembunyikan menu saja tidak cukup — data yang bukan haknya tetap ditolak walau alamatnya diketik langsung.'));
  s.push(table(
    ['Kemampuan', 'Super Admin', 'Admin', 'Supervisor', 'Anggota', 'Klien'],
    [
      ['Kelola klien &amp; site', '✓', '✓', '—', '—', '—'],
      ['Kelola titik, rute, shift, inventaris', '✓', '✓', '✓', '—', '—'],
      ['Kelola personel', '✓', '✓', '—', '—', '—'],
      ['Susun jadwal &amp; roster', '✓', '✓', '✓', '—', '—'],
      ['Presensi &amp; jalankan patroli', '✓', '✓', '✓', '✓', '—'],
      ['Buat laporan insiden', '✓', '✓', '✓', '✓', '—'],
      ['Ubah status &amp; tugaskan insiden', '✓', '✓', '✓', '—', '—'],
      ['Tombol darurat', '✓', '✓', '✓', '✓', '—'],
      ['Respons &amp; tutup sinyal darurat', '✓', '✓', '✓', '—', '—'],
      ['Buku tamu &amp; kendaraan (mencatat)', '✓', '✓', '✓', '✓', '—'],
      ['Pengumuman (menerbitkan)', '✓', '✓', '✓', '—', '—'],
      ['Dasbor, peta, laporan, ekspor', '✓', '✓', '✓', '—', '✓'],
      ['Jejak audit', '✓', '✓', '✓', '—', '—'],
    ]
  ));
  s.push(sub('Cakupan data yang terlihat'));
  s.push(table(
    ['Peran', 'Data yang terlihat'],
    [
      ['Super Admin &amp; Admin', 'Seluruh klien dan seluruh site.'],
      ['Supervisor', 'Seluruh site untuk keperluan operasional; tidak mengelola klien, site, dan personel.'],
      ['Anggota', 'Hanya jadwal, presensi, patroli, dan laporan miliknya sendiri; buku tamu serta kendaraan hanya pada site penempatannya. Membuka milik anggota lain ditolak.'],
      ['Klien', 'Hanya site milik perusahaannya — termasuk personel yang ditempatkan di sana, patroli, insiden, tamu, kendaraan, dan laporannya. Site klien lain tidak dapat dibuka.'],
    ]
  ));
  s.push(note('Pengumuman', 'Pengumuman disaring menurut penerimanya: anggota hanya menerima yang ditujukan ke semua atau ke anggota, klien hanya yang ditujukan ke semua atau ke klien.'));
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
    'Buka <code>https://dashboard.dharmapati.co.id</code> pada peramban (Chrome, Edge, atau Safari).',
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
      ['Garis putus-putus biru', 'Jejak pergerakan anggota selama 90 menit terakhir. Ketuk garisnya untuk melihat namanya.'],
    ]
  ));
  s.push(note('Keterangan', 'Jejak hanya terbentuk selama anggota berstatus masuk. Di luar jam tugas aplikasi tidak mengirim posisi sama sekali.'));
  s.push(sub('Panel kanan'));
  s.push(steps([
    'Ketuk nama pada daftar <strong>Anggota Online</strong> untuk memusatkan peta ke posisi anggota tersebut.',
    'Ketuk baris pada <strong>Sinyal Darurat</strong> untuk melompat ke lokasi kejadian.',
    'Tombol <strong>Fokus darurat</strong> di kanan atas menyembunyikan penanda lain agar hanya sinyal darurat yang terlihat.',
  ]));
  s.push(sub('Denah lantai'));
  s.push(p('Di dalam gedung bertingkat, GPS tidak cukup teliti untuk menyebut lantai. Karena itu keberadaan anggota di dalam gedung dibaca dari <strong>titik QR terakhir yang ia pindai</strong> — satu-satunya keberadaan yang benar-benar terbukti.'));
  s.push(steps([
    'Tekan tombol <strong>Denah lantai</strong> di kanan atas halaman.',
    'Pilih site pada kotak pilihan, lalu pilih lantainya.',
    'Angka hijau pada tombol lantai menunjukkan berapa anggota yang terakhir terdeteksi di lantai itu.',
    'Titik biru adalah titik QR; foto profil berdenyut adalah anggota. Arahkan tetikus ke fotonya untuk melihat titik dan waktu pemindaian terakhirnya.',
    'Tekan <strong>Peta luar</strong> untuk kembali ke peta biasa.',
  ]));
  s.push(img('web-denah-lantai', 'Denah lantai dengan titik QR dan posisi anggota berdasarkan pemindaian terakhir.'));
  s.push(warn('Perhatian', 'Posisi pada denah adalah <em>tempat terakhir yang terbukti</em>, bukan posisi terkini. Waktu pemindaian selalu ditampilkan agar tidak keliru dibaca sebagai lokasi saat ini. Riwayat 12 jam terakhir yang dipakai.'));
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
    'Isi <strong>instruksi khusus</strong> bila ada — kalimat ini muncul pada kartu jadwal di aplikasi anggota, mis. “dampingi teknisi lift pukul 10.00”.',
    'Pilih tanggal dan anggota.',
    'Tekan <strong>Simpan</strong> lalu setujui konfirmasi. Anggota menerima notifikasi jadwal baru.',
  ]));
  s.push(sub('Roster massal'));
  s.push(p('Dipakai untuk menyusun jadwal satu bulan sekaligus.'));
  s.push(steps([
    'Tekan <strong>Roster Massal</strong>.',
    'Pilih site, shift, dan rute.',
    'Isi instruksi khusus bila berlaku untuk seluruh rentang tanggal tersebut.',
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

part('Bagian A · Aplikasi Web', 'Tugas Insidental dan Instruksi', () => {
  const s = [];
  s.push(p('Selain patroli terjadwal, komandan regu kerap memberi pekerjaan tambahan: mengawal setoran, mendampingi tamu audit, memeriksa APAR. Halaman <strong>Tugas &amp; Instruksi</strong> mencatat pekerjaan seperti itu agar tidak lagi disampaikan lewat pesan singkat yang mudah hilang.'));
  s.push(img('web-tugas', 'Halaman Tugas &amp; Instruksi dengan dua tab: penugasan perorangan dan instruksi massal.'));
  s.push(sub('Menerbitkan tugas'));
  s.push(steps([
    'Tekan <strong>Tugas Baru</strong>.',
    'Pilih site dan petugas pelaksana.',
    'Tulis judul pekerjaan dan uraian yang cukup jelas untuk dikerjakan tanpa bertanya lagi.',
    'Pilih prioritas dan tenggat penyelesaian.',
    'Tekan <strong>Kirim Tugas</strong> lalu setujui konfirmasi. Petugas menerima notifikasi seketika.',
  ]));
  s.push(table(
    ['Prioritas', 'Makna operasional'],
    [
      ['<span class="pill merah">Mendesak</span>', 'Ditinggalkan pekerjaan lain; dikerjakan lebih dulu'],
      ['<span class="pill kuning">Tinggi</span>', 'Diselesaikan pada shift yang sama'],
      ['<span class="pill biru">Normal</span>', 'Diselesaikan sebelum tenggat'],
      ['<span class="pill">Rendah</span>', 'Dikerjakan bila pekerjaan utama sudah tuntas'],
    ]
  ));
  s.push(sub('Memantau penyelesaian'));
  s.push(p('Status tugas berjalan dari <em>Baru</em> → <em>Dikerjakan</em> → <em>Selesai</em>. Petugas yang menuntaskan tugas wajib menuliskan catatan hasil dan boleh melampirkan foto bukti; keduanya tampil pada kartu tugas. Tugas yang melewati tenggat diberi tanda <strong>Lewat tenggat</strong> berwarna merah.'));
  s.push(note('Keterangan', 'Anggota hanya melihat tugas yang ditujukan kepadanya, dan hanya boleh mengubah status serta catatan hasil. Prioritas dan tenggat tetap menjadi kewenangan pengawas.'));
  s.push(sub('Instruksi dan tanda terima baca'));
  s.push(p('Tab <strong>Instruksi</strong> dipakai untuk arahan yang berlaku bagi banyak orang: perubahan prosedur, kewaspadaan khusus, atau pengumuman operasional. Instruksi dapat ditujukan kepada satu regu, satu site, atau seluruh satuan.'));
  s.push(steps([
    'Tekan <strong>Instruksi Baru</strong>.',
    'Pilih sasaran: regu tertentu, site tertentu, atau kosongkan keduanya untuk seluruh satuan.',
    'Tulis judul dan isi arahan.',
    'Centang <strong>Mendesak</strong> bila perlu dibaca segera — instruksi ditandai merah di aplikasi lapangan.',
    'Tekan <strong>Kirim</strong> lalu setujui konfirmasi.',
  ]));
  s.push(p('Tekan <strong>Siapa sudah membaca</strong> pada sebuah instruksi untuk melihat daftar anggota beserta waktu bacanya. Inilah bukti bahwa arahan benar-benar sampai, bukan sekadar terkirim.'));
  s.push(tip('Kiat', 'Untuk arahan yang menuntut tindakan perorangan, terbitkan tugas — bukan instruksi. Tugas punya penanggung jawab, tenggat, dan bukti penyelesaian; instruksi hanya punya tanda terima baca.'));
  return s.join('\n');
});

part('Bagian A · Aplikasi Web', 'Penilaian Kinerja (KPI)', () => {
  const s = [];
  s.push(p('Halaman <strong>Penilaian Kinerja</strong> mengubah catatan harian sistem menjadi satu angka 0–100 per personel, sehingga pembinaan dan penilaian anggota terbaik tidak lagi bertumpu pada kesan.'));
  s.push(img('web-kpi', 'Peringkat KPI beserta rincian lima komponen tiap personel.'));
  s.push(sub('Lima komponen dan bobotnya'));
  s.push(table(
    ['Komponen', 'Bobot bawaan', 'Dihitung dari'],
    [
      ['Kehadiran &amp; ketepatan', '25%', 'Presensi tepat waktu dibagi seluruh percobaan presensi, termasuk yang ditolak sistem'],
      ['Penyelesaian patroli', '30%', 'Rata-rata kepatuhan seluruh sesi patroli pada periode itu'],
      ['Ronde tuntas 100%', '15%', 'Jumlah sesi yang seluruh titiknya terpindai, dibagi jumlah sesi'],
      ['Aktivitas pelaporan', '10%', 'Jumlah laporan insiden; empat laporan sebulan dinilai penuh'],
      ['Penilaian Danru &amp; Klien', '20%', 'Rata-rata penilaian manual lima aspek pada periode itu'],
    ]
  ));
  s.push(p('Nilai akhir diterjemahkan menjadi predikat: <strong>A</strong> mulai 90, <strong>B</strong> mulai 80, <strong>C</strong> mulai 70, <strong>D</strong> mulai 60, dan <strong>E</strong> di bawah 60.'));
  s.push(sub('Memberi penilaian manual'));
  s.push(steps([
    'Tekan tombol <strong>Nilai</strong> pada baris personel yang bersangkutan.',
    'Beri angka 1 sampai 5 pada lima aspek: disiplin, penampilan, responsif, kualitas laporan, dan komunikasi.',
    'Tulis catatan pembinaan bila ada.',
    'Tekan <strong>Simpan Penilaian</strong> lalu setujui konfirmasi. Nilai KPI langsung dihitung ulang.',
  ]));
  s.push(img('web-form-nilai', 'Formulir penilaian manual lima aspek untuk satu periode.'));
  s.push(note('Keterangan', 'Satu penilai hanya boleh memberi satu penilaian per personel per periode; penilaian berikutnya menimpa yang lama. Komandan regu dan akun klien sama-sama dapat menilai, dan sistem mencatat siapa penilainya.'));
  s.push(sub('Mengubah bobot'));
  s.push(p('Bobot kelima komponen dapat disesuaikan dengan kesepakatan manajemen atau kontrak klien. Tekan <strong>Atur Bobot</strong> di kanan atas, ubah angkanya, lalu simpan. Jumlah seluruh bobot wajib tepat 100 — sistem menolak menyimpan bila tidak.'));
  s.push(p('Tekan <strong>Rincian</strong> pada seorang personel untuk membuka tren enam bulan terakhir beserta dasar perhitungannya: berapa kali presensi tepat waktu, berapa presensi ditolak, berapa sesi patroli, berapa ronde tuntas, dan berapa laporan yang dibuat.'));
  s.push(tip('Kiat', 'Nilai yang turun tajam pada satu komponen lebih berguna untuk pembinaan daripada nilai akhirnya. Komponen kehadiran yang jatuh biasanya berarti masalah jadwal atau jarak tempuh, bukan kemalasan.'));
  return s.join('\n');
});

part('Bagian A · Aplikasi Web', 'Lantai, Denah, dan Regu', () => {
  const s = [];
  s.push(p('Untuk objek bertingkat — gedung perkantoran, pusat belanja, apartemen — titik patroli perlu diletakkan di lantai yang benar. Halaman <strong>Lantai &amp; Regu</strong> menampung denah tiap lantai dan posisi titik di atasnya.'));
  s.push(img('web-lantai', 'Daftar lantai, denah terunggah, dan penempatan titik di atas denah.'));
  s.push(sub('Menyiapkan denah'));
  s.push(steps([
    'Pilih site di bagian atas halaman.',
    'Tekan <strong>Tambah Lantai</strong>, isi nama dan nomor lantai, lalu simpan.',
    'Tekan <strong>Unggah Denah</strong> pada lantai tersebut dan pilih berkas gambar denahnya.',
    'Klik satu titik patroli di daftar sebelah kanan, lalu klik posisinya di atas denah. Penanda langsung menempel di titik itu.',
    'Ulangi untuk seluruh titik pada lantai tersebut.',
  ]));
  s.push(p('Setelah denah terisi, laporan sinyal darurat dan temuan patroli ikut menyebutkan lantainya — bukan hanya nama gedung. Ini memangkas waktu pencarian saat keadaan darurat.'));
  s.push(sub('Regu jaga'));
  s.push(p('Tab <strong>Regu</strong> mengelompokkan anggota ke dalam regu A, B, C, dan seterusnya beserta komandan regunya. Pengelompokan ini dipakai untuk menujukan instruksi ke satu regu saja, dan memudahkan penyusunan roster.'));
  s.push(steps([
    'Buka tab <strong>Regu</strong> lalu tekan <strong>Tambah Regu</strong>.',
    'Isi kode dan nama regu, pilih site, lalu pilih komandan regunya.',
    'Centang anggota yang masuk regu tersebut.',
    'Simpan lalu setujui konfirmasi.',
  ]));
  s.push(note('Keterangan', 'Satu anggota hanya berada pada satu regu. Memindahkan anggota ke regu lain otomatis mengeluarkannya dari regu sebelumnya.'));
  return s.join('\n');
});

part('Bagian A · Aplikasi Web', 'Cuti, Izin, dan Lembur', () => {
  const s = [];
  s.push(p('Pengajuan cuti, izin, dan lembur diajukan dari aplikasi lapangan dan diputuskan di halaman ini, sehingga tidak ada lagi izin lisan yang tidak tercatat.'));
  s.push(img('web-cuti', 'Daftar pengajuan beserta status dan tombol keputusan.'));
  s.push(steps([
    'Baca pengajuan yang berstatus <strong>Menunggu</strong>.',
    'Periksa tanggal, alasan, dan jadwal jaga yang terdampak.',
    'Tekan <strong>Setujui</strong> atau <strong>Tolak</strong>.',
    'Tulis catatan keputusan — terutama bila menolak — lalu setujui konfirmasi.',
  ]));
  s.push(p('Pemohon langsung menerima notifikasi beserta catatan keputusan Anda. Riwayat pengajuan tersimpan permanen sebagai lampiran administrasi kepegawaian.'));
  s.push(note('Keterangan', 'Anggota hanya melihat pengajuannya sendiri dan tidak dapat memutus pengajuan siapa pun, termasuk miliknya. Akun klien tidak berwenang memutus pengajuan.'));
  return s.join('\n');
});

part('Bagian A · Aplikasi Web', 'Verifikasi Wajah pada Presensi', () => {
  const s = [];
  s.push(p('Titipan absen dicegah dengan mencocokkan swafoto presensi terhadap foto wajah yang sudah didaftarkan. Pencocokan berjalan di server sendiri — foto tidak dikirim ke layanan pihak ketiga mana pun.'));
  s.push(sub('Mendaftarkan wajah'));
  s.push(steps([
    'Buka halaman <strong>Personel</strong>.',
    'Tekan ikon wajah pada baris personel yang bersangkutan.',
    'Unggah satu foto menghadap kamera dengan pencahayaan cukup.',
    'Tekan <strong>Daftarkan Wajah</strong> lalu setujui konfirmasi.',
  ]));
  s.push(img('web-daftar-wajah', 'Formulir pendaftaran wajah pada data personel.'));
  s.push(p('Kolom <strong>Wajah</strong> pada daftar personel menunjukkan siapa yang sudah terdaftar. Sejak saat itu, presensi masuk yang bersangkutan hanya diterima bila swafotonya cocok.'));
  s.push(sub('Percobaan presensi yang ditolak'));
  s.push(p('Setiap penolakan presensi disimpan lengkap dengan sebab, jarak dari pos, angka kemiripan wajah, dan fotonya. Buka halaman <strong>Presensi</strong> lalu pilih tab <strong>Percobaan Ditolak</strong>.'));
  s.push(img('web-presensi-ditolak', 'Rekaman percobaan presensi yang ditolak beserta buktinya.'));
  s.push(table(
    ['Sebab penolakan', 'Arti'],
    [
      ['Di luar radius', 'Koordinat pemohon melampaui radius site'],
      ['Wajah tidak cocok', 'Kemiripan di bawah ambang; besar kemungkinan bukan orang yang bersangkutan'],
      ['Wajah tak terdeteksi', 'Foto buram, gelap, tertutup, atau tidak menghadap kamera'],
      ['Sudah presensi', 'Masih ada presensi masuk yang belum ditutup'],
    ]
  ));
  s.push(warn('Perhatian', 'Kemiripan wajah bukan bukti tunggal. Bila seorang anggota berulang kali ditolak padahal benar-benar hadir, periksa fotonya di kolom bukti dan daftarkan ulang wajahnya dengan foto yang lebih baik.'));
  s.push(note('Keterangan', 'Hanya administrator yang boleh menghapus atau mengganti template wajah. Rekaman percobaan yang ditolak tidak dapat dihapus dari antarmuka mana pun.'));
  return s.join('\n');
});

part('Bagian A · Aplikasi Web', 'Darurat Berjenis, Divisi & Sirene', () => {
  const s = [];
  s.push(p('Menekan tombol darurat tidak lagi sekadar mengirim pesan “ada kejadian”. Petugas memilih <strong>jenis kejadiannya</strong>, dan sistem meneruskannya kepada divisi yang memang menanganinya sekaligus membunyikan sirene di lapangan.'));
  s.push(sub('Siapa yang datang untuk kejadian apa'));
  s.push(table(
    ['Jenis kejadian', 'Diteruskan kepada (bawaan)'],
    [
      ['<span class="pill merah">Kebakaran</span>', 'Pemadam Kebakaran, K3, Komando Sekuriti'],
      ['<span class="pill kuning">Kecelakaan kerja</span>', 'K3, Klinik, Komando Sekuriti'],
      ['<span class="pill hijau">Gawat medis</span>', 'Klinik, K3'],
      ['<span class="pill merah">Tindak kriminal</span>', 'Komando Sekuriti'],
      ['<span class="pill ungu">Bencana alam</span>', 'Tim Tanggap Bencana, K3, Komando Sekuriti'],
      ['<span class="pill biru">Bantuan umum</span>', 'Komando Sekuriti'],
    ]
  ));
  s.push(p('Selain divisi, pusat komando dan akun klien pemilik site selalu menerima pemberitahuan yang sama pada saat yang sama.'));
  s.push(sub('Menyiapkan divisi penanggap'));
  s.push(steps([
    'Buka <strong>Darurat &amp; Sirene</strong> pada kelompok Konfigurasi.',
    'Pada tab <strong>Divisi Penanggap</strong>, tekan <strong>Divisi Baru</strong>.',
    'Isi kode dan nama divisi, misalnya <code>DAMKAR</code> — Pemadam Kebakaran.',
    'Isi nomor telepon yang dihubungi bila divisi itu belum punya akun di sistem.',
    'Centang anggota berakun yang menerima pemberitahuan divisi tersebut.',
    'Kosongkan cakupan site bila divisi berlaku untuk seluruh lokasi.',
    'Simpan lalu setujui konfirmasi.',
  ]));
  s.push(img('web-sirene-divisi', 'Daftar divisi penanggap beserta jenis kejadian yang ditanganinya.'));
  s.push(sub('Mengatur perutean'));
  s.push(p('Tab <strong>Perutean Darurat</strong> memperlihatkan enam kotak, satu untuk tiap jenis kejadian, berisi divisi yang akan dihubungi.'));
  s.push(steps([
    'Tekan <strong>Perutean Baru</strong>.',
    'Pilih jenis kejadian dan divisi penanggapnya.',
    'Bila aturan hanya berlaku untuk satu site, pilih site tersebut.',
    'Simpan lalu setujui konfirmasi.',
  ]));
  s.push(img('web-sirene-perutean', 'Perutean per jenis kejadian; satu jenis boleh mengarah ke beberapa divisi.'));
  s.push(note('Keterangan', 'Aturan yang diberi site menimpa aturan umum. Site yang memiliki klinik sendiri karena itu tidak lagi memanggil klinik pusat untuk kejadian medis.'));
  s.push(sub('Sirene di tiang'));
  s.push(p('Sirene didaftarkan sebagai perangkat jaringan. Papan relai yang lazim dipakai di lapangan — Shelly, Tasmota, atau papan berbasis ESP32 — cukup dipanggil lewat alamat HTTP-nya.'));
  s.push(steps([
    'Buka tab <strong>Sirene Tiang</strong> lalu tekan <strong>Sirene Baru</strong>.',
    'Pilih site. Isi lantai hanya bila sirene itu memang melayani satu lantai; kosongkan untuk sirene luar ruang yang selalu ikut berbunyi.',
    'Isi kode, nama, dan letak fisiknya.',
    'Pilih antarmuka: <strong>HTTP GET</strong> untuk Shelly dan Tasmota, <strong>HTTP JSON</strong> untuk papan yang menerima JSON.',
    'Isi alamat menyalakan dan mematikan, misalnya <code>http://192.168.1.50/relay/0?turn=on</code>.',
    'Tentukan lama bunyi. Isi 0 bila sirene harus berbunyi sampai dimatikan.',
    'Simpan, lalu tekan <strong>Bunyikan</strong> untuk menguji.',
  ]));
  s.push(img('web-sirene-sirene', 'Daftar sirene beserta keadaan terakhir dan tombol uji bunyi.'));
  s.push(warn('Sebelum menguji', 'Tombol <strong>Bunyikan</strong> benar-benar membunyikan sirene di lapangan. Beri tahu petugas jaga lebih dulu agar tidak dikira keadaan darurat sungguhan.'));
  s.push(sub('Yang terjadi saat tombol darurat ditekan'));
  s.push(steps([
    'Pemberitahuan terkirim serentak ke pusat komando, akun klien, dan seluruh divisi penanggap jenis kejadian itu.',
    'Sirene di site berbunyi. Bila lantai kejadian diketahui, sirene lantai tersebut ikut dibunyikan bersama sirene luar ruang.',
    'Kejadian muncul di halaman <strong>Sinyal Darurat</strong> lengkap dengan jenis, lantai, dan riwayat perintah sirene.',
    'Menutup kejadian ikut mematikan sirene — sirene yang dibiarkan berbunyi justru menumpulkan kewaspadaan.',
  ]));
  s.push(note('Keterangan', 'Setiap perintah ke sirene disimpan, termasuk yang gagal. Bila sebuah perangkat tidak menjawab, catatannya tetap ada sebagai bukti bahwa sistem sudah berusaha membunyikannya.'));
  return s.join('\n');
});

part('Bagian A · Aplikasi Web', 'Integritas Data & Perangkat', () => {
  const s = [];
  s.push(p('Bukti kehadiran hanya bernilai bila tidak dapat dibuat-buat. Halaman <strong>Integritas &amp; Perangkat</strong> memperlihatkan setiap upaya memalsukan lokasi atau memakai akun orang lain — semuanya sudah ditolak sistem, tetapi tetap tersimpan.'));
  s.push(img('web-integritas', 'Percobaan pelanggaran beserta pelaku, koordinat, dan perangkatnya.'));
  s.push(sub('Apa saja yang ditolak sistem'));
  s.push(table(
    ['Jenis', 'Cara sistem mengetahuinya'],
    [
      ['<span class="pill merah">Lokasi palsu</span>', 'Android menandai koordinat yang berasal dari aplikasi pengubah lokasi (fake GPS); aplikasi meneruskan tanda itu.'],
      ['<span class="pill kuning">Perpindahan mustahil</span>', 'Dihitung di server dari jarak dan selang waktu antar-catatan. Di atas 130 km/jam ditolak.'],
      ['<span class="pill ungu">Emulator</span>', 'Aplikasi dijalankan di komputer, bukan ponsel sungguhan.'],
      ['<span class="pill biru">Perangkat tidak terdaftar</span>', 'Akun dipakai masuk dari ponsel selain yang terikat padanya.'],
    ]
  ));
  s.push(warn('Mengapa ada dua cara', 'Penandaan dari aplikasi bergantung pada kejujuran aplikasi itu sendiri, dan aplikasi dapat diubah orang. Karena itu perhitungan kewajaran perpindahan dilakukan di server: cara ini tetap bekerja walaupun aplikasi di ponsel sudah dimodifikasi agar tidak melaporkan apa pun.'));
  s.push(sub('Membaca catatan pelanggaran'));
  s.push(p('Tiap baris memuat waktu, pelaku, jenis pelanggaran, tindakan yang sedang dicoba, koordinat yang dilaporkan, dan penanda perangkatnya. Empat kartu di atas tabel merangkum jumlah pelanggaran 30 hari terakhir.'));
  s.push(steps([
    'Gunakan kotak pilihan di kanan atas untuk menyaring satu jenis pelanggaran.',
    'Perhatikan pelaku yang berulang kali muncul — sekali mungkin kekeliruan pengaturan ponsel, berkali-kali adalah pola.',
    'Cocokkan waktunya dengan jadwal jaga yang bersangkutan sebelum mengambil tindakan kepegawaian.',
  ]));
  s.push(note('Keterangan', 'Percobaan presensi yang ditolak karena lokasi palsu juga muncul pada tab <strong>Percobaan Ditolak</strong> di halaman Presensi, lengkap dengan fotonya.'));
  s.push(sub('Satu akun, satu ponsel'));
  s.push(p('Akun anggota terikat pada ponsel yang dipakainya saat masuk pertama kali. Masuk dari ponsel lain ditolak — sehingga akun tidak dapat dipinjamkan kepada rekan.'));
  s.push(table(
    ['Keadaan', 'Yang terjadi'],
    [
      ['Masuk pertama kali', 'Akun terikat pada ponsel tersebut secara otomatis.'],
      ['Aplikasi dipasang ulang di ponsel yang sama', 'Diterima. Sistem mengenali ciri perangkatnya dan memperbarui sendiri penandanya.'],
      ['Masuk dari ponsel lain', 'Ditolak, dan percobaannya dicatat sebagai pelanggaran.'],
      ['Anggota berganti ponsel', 'Administrator melepaskan ikatannya; masuk berikutnya mengikat ponsel baru.'],
      ['Ponsel hilang', 'Administrator memblokir perangkat itu, lalu melepaskan ikatannya.'],
    ]
  ));
  s.push(steps([
    'Buka tab <strong>Perangkat Terikat</strong>.',
    'Cari nama anggota yang bersangkutan.',
    'Tekan ikon <strong>rantai putus</strong> untuk melepaskan ikatan, atau ikon <strong>larangan</strong> untuk memblokir perangkatnya.',
    'Setujui konfirmasi. Tindakan ini tercatat pada Jejak Audit.',
  ]));
  s.push(img('web-integritas-perangkat', 'Daftar ponsel yang terikat pada tiap akun beserta versi aplikasinya.'));
  s.push(tip('Kiat', 'Lepaskan ikatan hanya bila anggota memang berganti ponsel. Melepaskannya karena diminta lewat telepon, tanpa memastikan, sama saja membuka pintu yang baru saja dikunci.'));
  s.push(note('Keterangan', 'Portal web sengaja tidak diikat pada perangkat, karena pengawas dan administrator memang bekerja berpindah komputer.'));
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
    'Buka <code>https://dashboard.dharmapati.co.id/DHARMAPATI.apk</code> dari peramban ponsel Android.',
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
      ['Kisi pintasan', 'Dua belas layanan: Buku Tamu, Kendaraan, Serah Terima, Jadwal Saya, Lapor Insiden, Pengumuman, Riwayat Patroli, Tugas Saya, Instruksi, Nilai Kinerja, Cuti &amp; Lembur, dan Semua Layanan.'],
      ['Jadwal jaga', 'Shift Anda hari ini beserta rutenya.'],
      ['Pengumuman', 'Geser ke samping untuk membaca pengumuman terbaru.'],
      ['Tombol darurat', 'Kartu merah di bagian bawah, berisi enam jenis kejadian.'],
      ['Bilah keadaan jaringan', 'Muncul di paling atas hanya bila sinyal hilang atau ada catatan yang belum terkirim.'],
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
  s.push(warn('Bila wajah Anda sudah didaftarkan', 'Swafoto menjadi <strong>syarat mutlak</strong>: presensi tidak dapat dilanjutkan tanpa foto, dan foto itu dicocokkan dengan wajah Anda yang terdaftar. Ambil foto menghadap kamera, di tempat yang cukup terang, tanpa masker atau helm.'));
  s.push(hp('hp-dialog-presensi', 'Dialog konfirmasi presensi masuk.'));
  s.push(warn('Presensi ditolak?', 'Bila muncul pesan “Anda berada … m dari pos (batas … m)”, artinya posisi Anda di luar radius site. Mendekatlah ke pos jaga, tunggu GPS mengunci di ruang terbuka, lalu ulangi. Bila muncul “wajah tidak cocok” atau “wajah tidak terdeteksi”, ulangi swafoto di tempat yang lebih terang. Jangan meminta orang lain melakukan presensi untuk Anda — setiap percobaan tersimpan lengkap dengan koordinat dan fotonya.'));
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
    'Ketuk <strong>MULAI DHARMAPATI</strong> lalu setujui konfirmasi. Waktu mulai dicatat saat itu juga.',
  ]));
  s.push(hp('hp-patroli', 'Tab Patroli sebelum putaran dimulai.'));
  s.push(hp('hp-patroli-aktif', 'Putaran berjalan: peta titik, kemajuan, dan tombol AKHIRI di kanan atas.'));
  s.push(note('Penanda lantai', 'Titik yang berada di dalam gedung menampilkan lencana ungu <strong>Lt. 2</strong> dan seterusnya. Lencana itu pula yang dipakai pusat komando untuk mengetahui lantai keberadaan Anda, karena GPS tidak dapat membedakan lantai.'));
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
    'Pilih kondisi titik: <strong>Aman</strong>, <strong>Perlu perhatian</strong>, atau <strong>Bermasalah</strong>.',
    'Ambil foto bukti bila rute mewajibkannya.',
    'Ketuk <strong>VERIFIKASI LEWAT GPS</strong> lalu setujui konfirmasi.',
  ]));
  s.push(table(
    ['Kondisi', 'Kapan dipilih', 'Akibatnya'],
    [
      ['<span class="pill hijau">Aman</span>', 'Tidak ada yang perlu ditindaklanjuti', 'Titik dicatat terperiksa, tanpa notifikasi'],
      ['<span class="pill kuning">Perlu perhatian</span>', 'Ada yang mulai tidak beres: lampu redup, gembok longgar, sampah menumpuk', 'Pusat kendali menerima pemberitahuan untuk dijadwalkan perbaikannya'],
      ['<span class="pill merah">Bermasalah</span>', 'Kerusakan atau pelanggaran yang berdampak langsung pada keamanan', 'Pusat kendali menerima pemberitahuan segera; sesi ditandai bertemuan'],
    ]
  ));
  s.push(warn('Perhatian', 'Verifikasi GPS hanya diterima bila Anda benar-benar berada dalam radius titik. Bila muncul pesan jarak terlalu jauh, mendekatlah ke titik lalu ulangi. Bila jarak Anda jauh melampaui radius yang wajar, sesi ditandai <em>jarak tidak wajar</em> dan ditinjau pengawas.'));
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
    'Pilih <strong>jenis kejadian</strong> lebih dulu: Kebakaran, Kecelakaan, Gawat Medis, Kriminal, Bencana, atau Bantuan Umum. Keterangan di bawah pilihan menyebutkan divisi yang akan dihubungi.',
    'Tekan tombolnya dan <strong>tahan selama 2,5 detik</strong>. Bilah akan terisi dan ponsel bergetar sebagai tanda penekanan terbaca.',
    'Begitu bilah penuh, sinyal terkirim seketika beserta posisi Anda — tidak ada dialog yang perlu ditekan lagi.',
    'Tetap di tempat aman sampai menerima pemberitahuan bahwa bantuan sedang menuju lokasi.',
  ]));
  s.push(note('Mengapa harus ditahan', 'Sinyal darurat tidak dikirim oleh satu sentuhan agar tidak terpicu tanpa sengaja saat ponsel berada di dalam saku. Bila Anda melepas tombol sebelum bilahnya penuh, tidak ada yang terkirim.'));
  s.push(hp('hp-darurat', 'Enam jenis kejadian; tombol tahan mengikuti warna jenis yang dipilih.'));
  s.push(p('Memilih jenis yang tepat bukan sekadar melengkapi laporan: jenis itulah yang menentukan siapa yang datang. Kejadian kebakaran memanggil pemadam, kecelakaan kerja memanggil K3 dan klinik. Salah memilih berarti yang datang bukan yang Anda butuhkan.'));
  s.push(p('Bersamaan dengan pemberitahuan, <strong>sirene di tiang ikut berbunyi</strong> — di lantai tempat Anda terakhir memindai titik, dan di area luar site.'));
  s.push(warn('Perhatian', 'Gunakan hanya untuk keadaan darurat sungguhan. Setiap penekanan tercatat beserta nama, jenis kejadian, lantai, dan koordinat Anda.'));
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
part('Bagian B · Aplikasi Lapangan', 'Tugas, Instruksi, Nilai, dan Pengajuan', () => {
  const s = [];
  s.push(p('Empat pintasan pada beranda menghubungkan Anda dengan pekerjaan tambahan, arahan komandan, nilai kinerja pribadi, dan pengajuan kepegawaian. Semuanya juga tersedia lewat pintasan <strong>Semua Layanan</strong> pada kisi yang sama.'));
  s.push(hp('hp-pintasan', 'Kisi pintasan beranda: Tugas Saya, Instruksi, Nilai Kinerja, dan Cuti &amp; Lembur.'));
  s.push(sub('Tugas Saya'));
  s.push(steps([
    'Ketuk pintasan <strong>Tugas Saya</strong>.',
    'Baca kartu tugas: prioritas, tenggat, dan uraian pekerjaannya.',
    'Ketuk <strong>MULAI</strong> saat Anda benar-benar mengerjakannya — waktu mulai tercatat.',
    'Setelah tuntas, ketuk <strong>SELESAIKAN</strong>.',
    'Tulis catatan hasil, lampirkan foto bukti bila ada, lalu ketuk <strong>TANDAI SELESAI</strong> dan setujui konfirmasi.',
  ]));
  s.push(hp('hp-tugas', 'Daftar tugas beserta prioritas dan tenggatnya.'));
  s.push(note('Keterangan', 'Anda hanya menerima tugas yang ditujukan kepada Anda. Prioritas dan tenggat tidak dapat diubah dari aplikasi lapangan — bila keberatan, sampaikan kepada komandan regu.'));
  s.push(sub('Instruksi'));
  s.push(steps([
    'Ketuk pintasan <strong>Instruksi</strong> atau buka tab kedua pada layar Tugas.',
    'Instruksi bertanda merah <strong>Mendesak</strong> dibaca lebih dulu.',
    'Setelah membaca, ketuk <strong>Tandai dibaca</strong>. Komandan dapat melihat siapa saja yang sudah membaca.',
  ]));
  s.push(warn('Perhatian', 'Menandai dibaca berarti Anda menyatakan sudah memahami isinya. Bila ada yang tidak jelas, tanyakan lebih dulu kepada komandan regu sebelum menandainya.'));
  s.push(sub('Nilai Kinerja'));
  s.push(p('Pintasan <strong>Nilai Kinerja</strong> menampilkan nilai KPI Anda pada periode berjalan, predikatnya, peringkat Anda di antara seluruh personel, rincian lima komponen, tren enam bulan, dan dasar perhitungannya.'));
  s.push(hp('hp-kpi', 'Nilai kinerja pribadi beserta rincian komponen dan tren enam bulan.'));
  s.push(tip('Kiat', 'Komponen dengan bilah paling pendek adalah yang paling cepat memperbaiki nilai Anda. Ronde tuntas 100% biasanya paling mudah diperbaiki: selesaikan seluruh titik sebelum mengakhiri patroli.'));
  s.push(sub('Cuti, Izin, dan Lembur'));
  s.push(steps([
    'Ketuk pintasan <strong>Cuti &amp; Lembur</strong>.',
    'Ketuk <strong>AJUKAN</strong>.',
    'Pilih jenis pengajuan: cuti, izin, atau lembur.',
    'Pilih rentang tanggal — untuk lembur, isi jumlah jamnya.',
    'Tulis alasan secara ringkas namun jelas.',
    'Ketuk <strong>KIRIM PENGAJUAN</strong> lalu setujui konfirmasi.',
  ]));
  s.push(hp('hp-cuti', 'Riwayat pengajuan beserta statusnya.'));
  s.push(p('Status pengajuan berubah dari <strong>Menunggu</strong> menjadi <strong>Disetujui</strong> atau <strong>Ditolak</strong>, disertai catatan dari pengawas. Anda menerima notifikasi begitu keputusan dibuat.'));
  s.push(note('Keterangan', 'Pengajuan tidak dapat diubah setelah terkirim. Bila keliru, ajukan ulang dan sampaikan kepada pengawas agar pengajuan yang salah ditolak.'));
  return s.join('\n');
});

part('Bagian B · Aplikasi Lapangan', 'Bekerja di Area Tanpa Sinyal', () => {
  const s = [];
  s.push(p('Basement, gudang berdinding logam, perkebunan, lantai dalam gedung — sinyal seluler kerap hilang justru di tempat yang harus diperiksa. Aplikasi tidak berhenti bekerja di sana.'));
  s.push(sub('Yang perlu Anda ketahui'));
  s.push(ul([
    '<strong>Tetap kerjakan seperti biasa.</strong> Pindai titik, catat presensi, kirim laporan — semuanya diterima aplikasi walau tanpa sinyal.',
    '<strong>Tidak ada yang hilang.</strong> Catatan disimpan di ponsel Anda, berurutan sesuai waktu pengerjaannya.',
    '<strong>Terkirim sendiri.</strong> Begitu sinyal kembali, semuanya dikirim tanpa Anda perlu menekan apa pun.',
    '<strong>Jangan mengulang.</strong> Titik yang sudah dipindai tetap tercatat hijau meski catatannya belum terkirim.',
  ]));
  s.push(hp('hp-luring', 'Bilah kuning di atas layar menerangkan keadaan jaringan dan jumlah catatan yang menunggu.'));
  s.push(sub('Membaca bilah keadaan'));
  s.push(table(
    ['Yang tertulis', 'Artinya'],
    [
      ['Tidak ada bilah sama sekali', 'Semuanya normal; tidak ada yang tertunda.'],
      ['<strong>Tanpa jaringan · pekerjaan tetap tercatat di perangkat</strong>', 'Sinyal hilang, tetapi belum ada catatan yang mengantre.'],
      ['<strong>Tanpa jaringan · 3 catatan menunggu terkirim</strong>', 'Sinyal hilang dan ada tiga catatan yang menunggu giliran.'],
      ['<strong>Mengirim 3 catatan yang tertunda…</strong>', 'Sinyal sudah kembali dan pengiriman sedang berjalan.'],
    ]
  ));
  s.push(steps([
    'Ketuk bilah tersebut untuk melihat daftar catatan yang menunggu beserta waktunya.',
    'Bila Anda yakin sinyal sudah baik namun daftarnya belum berkurang, tekan <strong>COBA KIRIM SEKARANG</strong>.',
    'Titik yang bertanda <em>Menunggu kirim</em> pada daftar patroli berarti sudah Anda pindai — tidak perlu dipindai ulang.',
  ]));
  s.push(hp('hp-luring-antrean', 'Daftar catatan yang menunggu terkirim beserta tombol kirim ulang.'));
  s.push(warn('Sebelum mengakhiri patroli', 'Usahakan berada di tempat bersinyal ketika menekan AKHIRI, agar seluruh pemindaian sempat terkirim lebih dulu dan angka kepatuhan Anda terhitung utuh. Bila terpaksa, aplikasi tetap mengirimkannya kemudian.'));
  s.push(note('Waktu kejadian', 'Waktu yang tercatat resmi adalah waktu server saat catatan diterima, sedangkan waktu Anda mengerjakannya di lapangan ikut disimpan sebagai keterangan. Karena itu bekerja tanpa sinyal tidak merugikan Anda, dan juga tidak dapat dipakai memundurkan jam presensi.'));
  s.push(tip('Kiat', 'Jangan menghapus data aplikasi atau mencopotnya selagi masih ada catatan yang menunggu — catatan itu tersimpan di dalam aplikasi.'));
  return s.join('\n');
});

part('Bagian B · Aplikasi Lapangan', 'Aturan Keaslian Data', () => {
  const s = [];
  s.push(p('Nilai seluruh catatan lapangan bertumpu pada satu hal: bahwa catatan itu benar. Aplikasi karena itu menolak beberapa hal, dan setiap penolakan dilaporkan ke pengawas.'));
  s.push(sub('Aplikasi pengubah lokasi'));
  s.push(warn('Jangan dipasang', 'Presensi dan pemindaian titik akan <strong>ditolak</strong> bila ponsel menjalankan aplikasi pengubah lokasi (fake GPS). Penolakannya tidak berhenti di layar Anda: percobaan itu tercatat lengkap dengan koordinat, waktu, dan nama Anda, lalu dikirim ke pengawas saat itu juga.'));
  s.push(p('Bila Anda pernah memasang aplikasi semacam itu untuk keperluan lain, cabut izin “lokasi tiruan” pada Opsi Pengembang atau hapus aplikasinya sebelum bertugas.'));
  s.push(sub('Perpindahan yang tidak wajar'));
  s.push(p('Sistem juga menghitung kewajaran perpindahan Anda. Bila jarak antara dua catatan hanya mungkin ditempuh dengan kecepatan di atas 130 km/jam, tindakan itu ditolak. Bila Anda memang baru saja berpindah lokasi jauh, tunggu beberapa saat lalu ulangi.'));
  s.push(sub('Satu akun, satu ponsel'));
  s.push(steps([
    'Akun Anda terikat pada ponsel yang dipakai saat masuk pertama kali.',
    'Memasang ulang aplikasi di ponsel yang sama tidak bermasalah — Anda tidak perlu melapor.',
    'Bila Anda berganti ponsel atau ponsel Anda hilang, laporkan kepada administrator agar ikatannya dilepaskan.',
    'Meminjamkan akun kepada rekan tidak akan berhasil, dan percobaannya tercatat.',
  ]));
  s.push(note('Keterangan', 'Sinyal darurat dikecualikan dari seluruh aturan di atas. Dalam keadaan genting, sinyal tetap dikirim walau koordinatnya diragukan — keselamatan didahulukan, dan penyimpangan datanya ditinjau kemudian.'));
  return s.join('\n');
});

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
      ['“Izin lokasi diblokir permanen”', 'Izin ditolak permanen saat pemasangan', 'Setelan ponsel → Aplikasi → DHARMAPATI → Izin → Lokasi → Izinkan'],
      ['QR tidak terbaca', 'Stiker kotor, buram, atau terlalu gelap', 'Bersihkan stiker, nyalakan senter aplikasi; bila tetap gagal gunakan verifikasi GPS lewat ikon ⋯'],
      ['“Titik ini tidak termasuk dalam rute”', 'Memindai titik milik rute atau site lain', 'Periksa rute yang sedang berjalan; hubungi danru bila rute keliru'],
      ['“Titik ini sudah dipindai”', 'Titik yang sama dipindai dua kali', 'Lanjutkan ke titik berikutnya'],
      ['“Rute ini wajib berurutan”', 'Melompati titik pada rute berurutan', 'Kembali ke titik yang terlewat lalu pindai sesuai urutan'],
      ['“Masih ada patroli berjalan”', 'Putaran sebelumnya belum ditutup', 'Buka tab Patroli lalu ketuk AKHIRI pada putaran tersebut'],
      ['Tidak ada rute di tab Patroli', 'Jadwal hari ini belum diberi rute', 'Hubungi danru agar jadwal dilengkapi rute'],
      ['Tidak ada jadwal hari ini', 'Roster belum disusun', 'Hubungi administrator'],
      ['Aplikasi meminta masuk ulang', 'Sesi 30 hari berakhir atau sandi diubah', 'Masuk kembali dengan sandi terbaru'],
      ['Akun klien ditolak di aplikasi', 'Akun klien memang hanya untuk portal web', 'Buka <code>dashboard.dharmapati.co.id</code> lewat peramban'],
      ['Peta kosong di web', 'Jaringan memblokir peta OpenStreetMap', 'Gunakan jaringan lain; fungsi lain tetap berjalan normal'],
      ['Angka “hari ini” nol pada dini hari', 'Hari baru saja berganti', 'Lihat rentang tanggal di halaman Laporan'],
    ]
  ));
  return s.join('\n');
});

/* ═══════════════ LAMPIRAN ═══════════════ */
part('Lampiran', 'Privasi dan Masa Simpan Data', () => {
  const s = [];
  s.push(p('Sistem ini mengumpulkan foto wajah dan riwayat lokasi anggota. Keduanya adalah data pribadi, sehingga penanganannya diatur dan dibatasi — bukan disimpan seadanya selamanya.'));
  s.push(sub('Apa yang dikumpulkan dan untuk apa'));
  s.push(table(
    ['Data', 'Tujuan', 'Masa simpan bawaan'],
    [
      ['Template wajah', 'Mencocokkan swafoto presensi agar tidak ada titip absen', 'Selama anggota masih aktif; dihapus bersama pendaftaran wajahnya'],
      ['Foto presensi masuk & pulang', 'Bukti kehadiran', '180 hari, setelah itu fotonya dihapus dan catatan kehadirannya tetap'],
      ['Percobaan presensi yang ditolak', 'Penelusuran dugaan pelanggaran', '180 hari, foto dan barisnya dihapus bersamaan'],
      ['Jejak lokasi', 'Pemantauan sebaran personel saat bertugas', '30 hari'],
      ['Notifikasi yang sudah dibaca', 'Riwayat pemberitahuan', '90 hari'],
    ]
  ));
  s.push(note('Keterangan', 'Angka masa simpan di atas adalah nilai bawaan dan dapat disesuaikan dengan kesepakatan dengan klien melalui pengaturan sistem. Pembersihan berjalan otomatis sekali sehari; berkas di penyimpanan ikut terhapus, bukan hanya barisnya di basis data.'));
  s.push(sub('Pembatasan yang berlaku'));
  s.push(ul([
    '<strong>Pelacakan hanya saat bertugas</strong> — aplikasi mengirim posisi hanya selama anggota berstatus presensi masuk. Setelah presensi pulang, pengiriman berhenti sepenuhnya.',
    '<strong>Template wajah tidak pernah meninggalkan server</strong> — aplikasi hanya menerima penanda “sudah terdaftar”, tidak pernah datanya.',
    '<strong>Akses klien dibatasi</strong> — akun klien hanya melihat data pada site miliknya sendiri.',
    '<strong>Penghapusan template wajah</strong> hanya dapat dilakukan administrator, dan tindakannya tercatat.',
  ]));
  s.push(sub('Penelusuran akses'));
  s.push(p('Pembacaan data pribadi ikut dicatat di Jejak Audit, bukan hanya perubahannya:'));
  s.push(table(
    ['Tindakan tercatat', 'Kapan muncul'],
    [
      ['<code>READ_LOCATION_HISTORY</code>', 'Seseorang membuka riwayat lokasi anggota lain'],
      ['<code>READ_ATTENDANCE_ATTEMPTS</code>', 'Seseorang membuka daftar percobaan presensi yang ditolak beserta fotonya'],
      ['<code>ENROLL_FACE</code> / <code>RESET_FACE</code>', 'Pendaftaran atau penghapusan template wajah'],
    ]
  ));
  s.push(warn('Sebelum digunakan', 'Pengambilan foto wajah dan lokasi memerlukan persetujuan tertulis dari tiap anggota. Siapkan formulir persetujuan yang menyebutkan tujuan penggunaan, masa simpan, dan hak anggota untuk meminta penghapusan datanya, lalu simpan sebagai lampiran administrasi kepegawaian.'));
  return s.join('\n');
});

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
<title>Panduan Penggunaan DHARMAPATI</title>
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
        <div class="cover-name">DHARMAPATI</div>
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
    <div><b>dashboard.dharmapati.co.id</b>Alamat sistem</div>
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
