"""Membuat denah skematik contoh untuk tiap lantai.

Denah nyata datang dari klien dalam bentuk gambar. Untuk peragaan dan
pengujian, tiga denah sederhana ini dibuat sekali lalu ikut disimpan di repo
agar `seed-denah.ts` selalu menghasilkan tampilan yang sama.
"""
import pathlib
from PIL import Image, ImageDraw, ImageFont

TUJUAN = pathlib.Path("/root/patroli/apps/backend/prisma/assets")
TUJUAN.mkdir(parents=True, exist_ok=True)

L, T = 1400, 900
LATAR = (12, 16, 26)
GARIS = (58, 74, 104)
ISI = (22, 30, 48)
TEKS = (150, 168, 196)
AKSEN = (34, 211, 238)


def huruf(ukuran):
    for jalur in [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]:
        if pathlib.Path(jalur).exists():
            return ImageFont.truetype(jalur, ukuran)
    return ImageFont.load_default()


def ruang(d, kotak, nama, f):
    x1, y1, x2, y2 = kotak
    d.rectangle(kotak, fill=ISI, outline=GARIS, width=3)
    d.text(((x1 + x2) / 2, (y1 + y2) / 2), nama, fill=TEKS, font=f, anchor="mm")


DENAH = {
    "denah-lantai-1.png": [
        ((60, 60, 520, 400), "LOBI UTAMA"),
        ((540, 60, 900, 240), "RESEPSIONIS"),
        ((920, 60, 1340, 400), "AREA PARKIR DALAM"),
        ((60, 420, 380, 840), "POS JAGA"),
        ((400, 420, 900, 620), "KORIDOR TIMUR"),
        ((400, 640, 900, 840), "RUANG PANEL & GENSET"),
        ((920, 420, 1340, 840), "GUDANG LOGISTIK"),
        ((540, 260, 900, 400), "RUANG TUNGGU"),
    ],
    "denah-lantai-2.png": [
        ((60, 60, 460, 420), "RUANG KERJA A"),
        ((480, 60, 880, 420), "RUANG KERJA B"),
        ((900, 60, 1340, 260), "RUANG RAPAT"),
        ((900, 280, 1340, 420), "PANTRI"),
        ((60, 440, 1340, 560), "KORIDOR TENGAH"),
        ((60, 580, 500, 840), "RUANG SERVER"),
        ((520, 580, 940, 840), "RUANG ARSIP"),
        ((960, 580, 1340, 840), "TANGGA DARURAT"),
    ],
    "denah-lantai-3.png": [
        ((60, 60, 700, 380), "AULA SERBAGUNA"),
        ((720, 60, 1340, 220), "RUANG DIREKSI"),
        ((720, 240, 1340, 380), "RUANG SEKRETARIS"),
        ((60, 400, 1340, 520), "KORIDOR UTARA"),
        ((60, 540, 480, 840), "MUSALA"),
        ((500, 540, 940, 840), "RUANG ISTIRAHAT"),
        ((960, 540, 1340, 840), "AKSES ATAP"),
    ],
}

f_ruang = huruf(22)
f_judul = huruf(30)

for nama_berkas, ruangan in DENAH.items():
    im = Image.new("RGB", (L, T), LATAR)
    d = ImageDraw.Draw(im)

    # Kisi latar supaya terbaca sebagai denah teknis, bukan sekadar kotak.
    for x in range(0, L, 50):
        d.line([(x, 0), (x, T)], fill=(20, 27, 42), width=1)
    for y in range(0, T, 50):
        d.line([(0, y), (L, y)], fill=(20, 27, 42), width=1)

    for kotak, nama in ruangan:
        ruang(d, kotak, nama, f_ruang)

    d.rectangle((20, 20, L - 20, T - 20), outline=AKSEN, width=2)
    judul = nama_berkas.replace("denah-lantai-", "DENAH SKEMATIK LANTAI ").replace(".png", "")
    d.text((40, 34), judul, fill=AKSEN, font=f_judul)

    im.save(TUJUAN / nama_berkas, "PNG", optimize=True)
    print("▸", nama_berkas, (TUJUAN / nama_berkas).stat().st_size // 1024, "KB")
