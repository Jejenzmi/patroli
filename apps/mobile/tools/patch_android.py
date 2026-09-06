"""Menyesuaikan kerangka Android hasil `flutter create` untuk kebutuhan DHARMAPATI.

minSdk dibiarkan mengikuti bawaan Flutter (`flutter.minSdkVersion`) — plugin
seperti geolocator_android membaca nilai yang sama. compileSdk dan targetSdk
justru harus ditulis tegas: Google Play mewajibkan API 36 bagi aplikasi baru
maupun pembaruan sejak 31 Agustus 2026, sedangkan bawaan Flutter 3.24 masih 34.

Penandatanganan rilis dibaca dari android/key.properties yang tidak ikut masuk
repo. Bila berkas itu tidak ada, build kembali memakai kunci debug supaya
`flutter run --release` tetap dapat dijalankan saat pengembangan.
"""
import re
import pathlib

# Nama paket permanen aplikasi di Google Play: sekali terbit tidak dapat diubah.
APP_ID = "id.co.dharmapati.patroli"

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


# ── Identitas paket, target API, dan penandatanganan rilis ──

gradle = pathlib.Path("android/app/build.gradle")
g = gradle.read_text()

g = g.replace("id.gokar.patroli_mobile", APP_ID)
g = g.replace("compileSdk = flutter.compileSdkVersion", "compileSdk = 36")
g = g.replace("targetSdk = flutter.targetSdkVersion", "targetSdk = 36")

if "keystoreProperties" not in g:
    g = g.replace(
        "android {",
        'def keystoreProperties = new Properties()\n'
        'def keystorePropertiesFile = rootProject.file("key.properties")\n'
        "if (keystorePropertiesFile.exists()) {\n"
        "    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))\n"
        "}\n\n"
        "android {",
        1,
    )
    g = g.replace(
        "    buildTypes {",
        "    signingConfigs {\n"
        "        release {\n"
        "            if (keystorePropertiesFile.exists()) {\n"
        '                keyAlias = keystoreProperties["keyAlias"]\n'
        '                keyPassword = keystoreProperties["keyPassword"]\n'
        '                storeFile = file(keystoreProperties["storeFile"])\n'
        '                storePassword = keystoreProperties["storePassword"]\n'
        "            }\n"
        "        }\n"
        "    }\n\n"
        "    buildTypes {",
        1,
    )
    g = g.replace(
        "        release {\n"
        "            // TODO: Add your own signing config for the release build.\n"
        "            // Signing with the debug keys for now, so `flutter run --release` works.\n"
        "            signingConfig = signingConfigs.debug\n"
        "        }",
        "        release {\n"
        "            // Kunci debug hanya dipakai bila key.properties belum disiapkan,\n"
        "            // supaya `flutter run --release` tetap bisa dijalankan.\n"
        "            signingConfig = keystorePropertiesFile.exists() ? signingConfigs.release : signingConfigs.debug\n"
        "        }",
        1,
    )

gradle.write_text(g)

# MainActivity harus berada di direktori yang sesuai dengan nama paketnya.
akarKotlin = pathlib.Path("android/app/src/main/kotlin")
adaMain = list(akarKotlin.rglob("MainActivity.kt")) if akarKotlin.exists() else []
tujuanMain = akarKotlin / APP_ID.replace(".", "/")
lamaMain = [m for m in adaMain if m.parent != tujuanMain]
if lamaMain and not (tujuanMain / "MainActivity.kt").exists():
    tujuanMain.mkdir(parents=True, exist_ok=True)
    isi = re.sub(r"^package .*$", "package " + APP_ID, lamaMain[0].read_text(), count=1, flags=re.M)
    (tujuanMain / "MainActivity.kt").write_text(isi)

# Sisa kelas dari nama paket lama harus benar-benar hilang: dua MainActivity
# dalam satu modul ikut terkompilasi dan menyesatkan siapa pun yang membacanya.
for m in lamaMain:
    m.unlink()
    d = m.parent
    while d != akarKotlin and d.is_dir() and not any(d.iterdir()):
        d.rmdir()
        d = d.parent
if lamaMain:
    print("▸ MainActivity dipindah ke paket " + APP_ID)
