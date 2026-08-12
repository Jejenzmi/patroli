#!/bin/bash
# Membangun APK PATROLI lewat Docker agar host tidak perlu memasang Flutter SDK.
set -e
IMG=ghcr.io/cirruslabs/flutter:3.24.5
ROOT="$(cd "$(dirname "$0")" && pwd)"

mkdir -p "$HOME/.pub-cache-patroli" "$HOME/.gradle-patroli"

docker run --rm \
  -v "$ROOT/apps/mobile":/work \
  -v "$HOME/.pub-cache-patroli":/home/cirrus/.pub-cache \
  -v "$HOME/.gradle-patroli":/home/cirrus/.gradle \
  -v /root/gradle-dists:/dist:ro -w /work -u root \
  -e PUB_CACHE=/home/cirrus/.pub-cache \
  -e GRADLE_USER_HOME=/home/cirrus/.gradle \
  "$IMG" bash tools/build-in-docker.sh

echo "▸ APK: $ROOT/apps/mobile/dist/PATROLI.apk"
