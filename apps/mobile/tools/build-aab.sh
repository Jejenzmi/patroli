#!/bin/bash
# Build App Bundle (AAB) DHARMAPATI untuk Google Play — dijalankan di kontainer.
set -e
git config --global --add safe.directory /sdks/flutter || true

python3 tools/patch_android.py

# Google Play mewajibkan API 36; komponen SDK-nya belum ada di image Flutter.
if [ ! -d "$ANDROID_SDK_ROOT/platforms/android-36" ]; then
  echo "▸ Memasang Android SDK 36…"
  yes | sdkmanager --install "platforms;android-36" "build-tools;36.0.0" >/dev/null 2>&1 || \
    echo "  (sdkmanager gagal — build akan memberi tahu bila SDK 36 memang belum ada)"
fi

WRAP=android/gradle/wrapper/gradle-wrapper.properties
LOCAL_ZIP=$(ls /dist/gradle-*-bin.zip 2>/dev/null | head -1 || true)
if [ -n "$LOCAL_ZIP" ]; then
  echo "▸ Memakai distribusi Gradle lokal: $LOCAL_ZIP"
  sed -i "s|^distributionUrl=.*|distributionUrl=file\\\\:$LOCAL_ZIP|" "$WRAP"
fi

echo "▸ Mengambil dependensi…"
flutter pub get

echo "▸ Membangun App Bundle rilis…"
flutter build appbundle --release --dart-define=API_BASE=https://dashboard.dharmapati.co.id

mkdir -p dist
cp build/app/outputs/bundle/release/app-release.aab dist/DHARMAPATI.aab
ls -lh dist/DHARMAPATI.aab
echo "▸ Selesai."
