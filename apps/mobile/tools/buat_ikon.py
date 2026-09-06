"""
Membuat ikon peluncur Android dari lambang Dharmapati.

Dijalankan ulang hanya bila lambangnya berubah; hasilnya disimpan di
`tools/ikon/` dan ikut dilacak git, lalu dipasang oleh `patch_android.py`
setiap kali kerangka Android dibuat ulang.

    python3 tools/buat_ikon.py     (butuh Pillow)
"""
import pathlib

from PIL import Image

SUMBER = pathlib.Path("assets/merek/logo.png")
TUJUAN = pathlib.Path("tools/ikon")
# Navy merek Dharmapati; lambang emasnya sudah kontras di atasnya.
LATAR = (10, 20, 64, 255)
UKURAN = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}

logo = Image.open(SUMBER).convert("RGBA")
for dens, n in UKURAN.items():
    kanvas = Image.new("RGBA", (n, n), LATAR)
    # Ruang napas 12% supaya lambang tidak menempel tepi ikon.
    r = logo.copy()
    r.thumbnail((int(n * 0.76), int(n * 0.76)), Image.LANCZOS)
    kanvas.paste(r, ((n - r.width) // 2, (n - r.height) // 2), r)
    folder = TUJUAN / f"mipmap-{dens}"
    folder.mkdir(parents=True, exist_ok=True)
    kanvas.save(folder / "ic_launcher.png")
    print(f"  · mipmap-{dens} {n}x{n}")
print("▸ Ikon peluncur diperbarui")
