"""Menyesuaikan kerangka Android hasil `flutter create` untuk kebutuhan PATROLI.

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
src = re.sub(r'android:label="[^"]*"', 'android:label="PATROLI"', src, count=1)
manifest.write_text(src)

SHIM = """
// Sebagian plugin (mis. geolocator_android) mengambil compileSdk/minSdk dari
// ekstensi Flutter yang belum tersedia saat proyeknya dievaluasi, sehingga
// konfigurasi gagal dengan "compileSdkVersion is not specified".
// Blok ini menetapkan nilainya lebih dulu untuk setiap subproyek Android.
subprojects { p ->
    // :app sudah dievaluasi lebih dulu oleh blok evaluationDependsOn di atas.
    if (p.state.executed) {
        return
    }
    p.afterEvaluate {
        if (p.hasProperty("android")) {
            p.android {
                if (compileSdkVersion == null) {
                    compileSdkVersion 34
                }
                if (namespace == null) {
                    namespace p.group.toString()
                }
                if (defaultConfig.minSdkVersion == null) {
                    defaultConfig.minSdkVersion 21
                }
            }
        }
    }
}
"""

root_gradle = pathlib.Path("android/build.gradle")
root_text = root_gradle.read_text()
if "compileSdkVersion is not specified" not in root_text:
    root_gradle.write_text(root_text + SHIM)

print("▸ Manifest & Gradle disesuaikan: izin lokasi/kamera, label PATROLI, compileSdk plugin")
