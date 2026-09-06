"""Menyesuaikan kerangka Android hasil `flutter create` untuk kebutuhan DHARMAPATI.

Nilai compileSdk/minSdk sengaja dibiarkan mengikuti bawaan Flutter
(`flutter.compileSdkVersion` dkk.) — plugin seperti geolocator_android membaca
nilai yang sama, dan menuliskannya secara manual justru memutus rantai itu.
"""
import re
import pathlib

PERMS = """    <uses-permission android:name="android.permission.INTERNET"/>
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
    <uses-permission android:name="android.permission.CAMERA"/>
    <uses-permission android:name="android.permission.VIBRATE"/>
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
    <uses-feature android:name="android.hardware.camera" android:required="false"/>

"""

manifest = pathlib.Path("android/app/src/main/AndroidManifest.xml")
src = manifest.read_text()

if "ACCESS_FINE_LOCATION" not in src:
    src = src.replace("<application", PERMS + "    <application", 1)
src = re.sub(r'android:label="[^"]*"', 'android:label="DHARMAPATI"', src, count=1)

# Layar penuh pada perangkat berlayar jangkung: tanpa ini sebagian ROM
# menyempitkan jendela aplikasi sehingga isinya menempel di satu sisi.
if "android.max_aspect" not in src:
    src = src.replace(
        "<application",
        '<application\n        android:resizeableActivity="true"',
        1,
    )
    src = src.replace(
        "    </application>",
        '        <meta-data android:name="android.max_aspect" android:value="2.6" />\n'
        '        <meta-data android:name="android.notch_support" android:value="true" />\n'
        "    </application>",
        1,
    )
manifest.write_text(src)

# Warna latar jendela saat proses dimulai — mencegah kedipan putih sebelum
# layar pembuka Flutter tampil.
LATAR = "#FF05070C"

launch = pathlib.Path("android/app/src/main/res/drawable/launch_background.xml")
if launch.exists():
    launch.write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<layer-list xmlns:android="http://schemas.android.com/apk/res/android">\n'
        f'    <item android:drawable="@color/patroli_void" />\n'
        "</layer-list>\n"
    )

for malam in ["drawable", "drawable-v21"]:
    d = pathlib.Path(f"android/app/src/main/res/{malam}/launch_background.xml")
    if d.exists():
        d.write_text(
            '<?xml version="1.0" encoding="utf-8"?>\n'
            '<layer-list xmlns:android="http://schemas.android.com/apk/res/android">\n'
            f'    <item android:drawable="@color/patroli_void" />\n'
            "</layer-list>\n"
        )

warna = pathlib.Path("android/app/src/main/res/values/colors.xml")
warna.parent.mkdir(parents=True, exist_ok=True)
warna.write_text(
    '<?xml version="1.0" encoding="utf-8"?>\n'
    "<resources>\n"
    f'    <color name="patroli_void">{LATAR}</color>\n'
    "</resources>\n"
)

GAYA = """<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="LaunchTheme" parent="@android:style/Theme.Black.NoTitleBar">
        <item name="android:windowBackground">@drawable/launch_background</item>
    </style>
    <style name="NormalTheme" parent="@android:style/Theme.Black.NoTitleBar">
        <item name="android:windowBackground">@color/patroli_void</item>
    </style>
</resources>
"""

# Atribut poni layar baru ada sejak API 27, jadi dipisah ke folder bernomor.
GAYA_V27 = """<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="LaunchTheme" parent="@android:style/Theme.Black.NoTitleBar">
        <item name="android:windowBackground">@drawable/launch_background</item>
        <item name="android:windowLayoutInDisplayCutoutMode">shortEdges</item>
    </style>
    <style name="NormalTheme" parent="@android:style/Theme.Black.NoTitleBar">
        <item name="android:windowBackground">@color/patroli_void</item>
        <item name="android:windowLayoutInDisplayCutoutMode">shortEdges</item>
    </style>
</resources>
"""

for folder, isi in [("values", GAYA), ("values-night", GAYA), ("values-v27", GAYA_V27)]:
    f = pathlib.Path(f"android/app/src/main/res/{folder}/styles.xml")
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text(isi)

# Ikon peluncur bermerek Dharmapati. Kerangka android/ tidak dilacak git
# (dibuat ulang oleh `flutter create`), jadi ikonnya disimpan di tools/ikon
# dan disalin di sini agar mereknya tidak hilang saat membangun dari repo
# yang masih bersih. Sumbernya assets/merek/logo.png — jalankan
# tools/buat_ikon.py bila lambangnya berubah.
import shutil

ikon = pathlib.Path("tools/ikon")
disalin = 0
if ikon.exists():
    for folder in ikon.iterdir():
        if not folder.is_dir():
            continue
        tujuan = pathlib.Path("android/app/src/main/res") / folder.name
        tujuan.mkdir(parents=True, exist_ok=True)
        for berkas in folder.iterdir():
            shutil.copy2(berkas, tujuan / berkas.name)
            disalin += 1

print(f"▸ Manifest, warna latar, dan gaya jendela disesuaikan; {disalin} ikon peluncur dipasang")
