#!/bin/bash
# Build APK PATROLI di dalam kontainer Flutter — dijalankan dari dalam kontainer.
set -e
git config --global --add safe.directory /sdks/flutter || true

if [ ! -d android ]; then
  echo "▸ Membuat kerangka Android…"
  rm -rf /tmp/scaffold
  flutter create --platforms=android --org id.gokar --project-name patroli_mobile /tmp/scaffold
  cp -r /tmp/scaffold/android ./
  [ -f analysis_options.yaml ] || cp /tmp/scaffold/analysis_options.yaml ./ 2>/dev/null || true
fi

python3 tools/patch_android.py

# services.gradle.org tidak stabil dari VPS ini; pakai distribusi yang sudah
# diunduh ke /dist bila tersedia.
WRAP=android/gradle/wrapper/gradle-wrapper.properties
LOCAL_ZIP=$(ls /dist/gradle-*-bin.zip 2>/dev/null | head -1 || true)
if [ -n "$LOCAL_ZIP" ]; then
  echo "▸ Memakai distribusi Gradle lokal: $LOCAL_ZIP"
  sed -i "s|^distributionUrl=.*|distributionUrl=file\\\\:$LOCAL_ZIP|" "$WRAP"
  grep distributionUrl "$WRAP"
fi

echo "▸ Mengambil dependensi…"
flutter pub get

echo "▸ Membangun APK rilis…"
flutter build apk --release --dart-define=API_BASE=https://patroli.gokar.id

mkdir -p dist
cp build/app/outputs/flutter-apk/app-release.apk dist/PATROLI.apk
ls -lh dist/PATROLI.apk
echo "▸ Selesai."
