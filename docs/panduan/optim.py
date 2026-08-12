"""Mengecilkan tangkapan layar untuk PDF: lebar maksimal 1500 px, disimpan sebagai JPEG."""
import pathlib
from PIL import Image

src = pathlib.Path("/root/panduan/img")
dst = pathlib.Path("/root/panduan/imgopt")
dst.mkdir(exist_ok=True)
total_awal = total_akhir = 0

for f in sorted(src.glob("*.png")):
    im = Image.open(f).convert("RGB")
    lebar_maks = 900 if f.name.startswith("hp-") else 1500
    if im.width > lebar_maks:
        im = im.resize((lebar_maks, round(im.height * lebar_maks / im.width)), Image.LANCZOS)
    keluar = dst / (f.stem + ".jpg")
    im.save(keluar, "JPEG", quality=84, optimize=True, progressive=True)
    total_awal += f.stat().st_size
    total_akhir += keluar.stat().st_size

print(f"{total_awal/1e6:.1f} MB → {total_akhir/1e6:.1f} MB")
