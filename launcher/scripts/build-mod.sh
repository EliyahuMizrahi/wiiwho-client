#!/usr/bin/env bash
# Build the client-mod jar and stage it under launcher/resources/mod/
# so electron-builder can bundle it via extraResources.
#
# Phase 3 only needs the jar on disk — Phase 4 wires classpath injection.
#
# Runs on: Windows (Git Bash / MSYS), macOS, Linux.
set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
LAUNCHER_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"
MOD_DIR="$( cd "$LAUNCHER_DIR/../client-mod" && pwd )"

MOD_VERSION="0.1.0"
JAR_NAME="wiiwho-${MOD_VERSION}.jar"
JAR_SRC="$MOD_DIR/build/libs/$JAR_NAME"
JAR_DEST_DIR="$LAUNCHER_DIR/resources/mod"
JAR_DEST="$JAR_DEST_DIR/$JAR_NAME"

echo "[build-mod] mod dir:     $MOD_DIR"
echo "[build-mod] version:     $MOD_VERSION"
echo "[build-mod] dest:        $JAR_DEST"

cd "$MOD_DIR"

# Heal CRLF line endings on gradlew if Git autocrlf mangled them on clone.
# bash refuses to exec a shebang line ending in \r ("required file not found").
if [[ -f "./gradlew" ]] && head -1 ./gradlew | grep -q $'\r'; then
  echo "[build-mod] gradlew has CRLF line endings; normalizing to LF in-place"
  sed -i 's/\r$//' ./gradlew
fi

# Pick the right gradle wrapper for the host OS.
# POSIX / WSL:   ./gradlew build -Pversion=...
# Git Bash / MSYS / Cygwin: ./gradlew.bat build -Pversion=...
if [[ "${OSTYPE:-}" == "msys" || "${OSTYPE:-}" == "cygwin" || "${OS:-}" == "Windows_NT" ]]; then
  GRADLE_CMD="./gradlew.bat"
else
  GRADLE_CMD="./gradlew"
fi

echo "[build-mod] $ $GRADLE_CMD build -Pversion=$MOD_VERSION"
"$GRADLE_CMD" build -Pversion="$MOD_VERSION"

if [[ ! -f "$JAR_SRC" ]]; then
  echo "[build-mod] ERROR: expected jar not produced at $JAR_SRC" >&2
  echo "[build-mod] Listing $MOD_DIR/build/libs/:" >&2
  ls -la "$MOD_DIR/build/libs/" 2>&1 >&2 || true
  exit 1
fi

mkdir -p "$JAR_DEST_DIR"
cp "$JAR_SRC" "$JAR_DEST"
echo "[build-mod] OK: $JAR_DEST"
