#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
MAVEN_VERSION=3.9.16
MAVEN_SHA256=5af3b743dd8b876b5c45da33b676251e5f1687712644abb4ee519ca56e1d89ce
RUNTIME_ROOT="$ROOT/.lifebridge-local/toolchains"
ARCHIVE="$RUNTIME_ROOT/apache-maven-$MAVEN_VERSION-bin.zip"
MAVEN_HOME_LOCAL="$RUNTIME_ROOT/apache-maven-$MAVEN_VERSION"

if [ -z "${JAVA_HOME:-}" ] || [ ! -x "$JAVA_HOME/bin/java" ]; then
  echo "JAVA_HOME must reference the accepted JDK before invoking ./mvnw." >&2
  exit 1
fi

mkdir -p "$RUNTIME_ROOT"
if [ ! -f "$ARCHIVE" ]; then
  curl -fsSL \
    "https://archive.apache.org/dist/maven/maven-3/$MAVEN_VERSION/binaries/apache-maven-$MAVEN_VERSION-bin.zip" \
    -o "$ARCHIVE"
fi
ACTUAL_SHA256=$(sha256sum "$ARCHIVE" | awk '{print $1}')
if [ "$ACTUAL_SHA256" != "$MAVEN_SHA256" ]; then
  echo "Maven distribution checksum mismatch." >&2
  exit 1
fi
if [ ! -x "$MAVEN_HOME_LOCAL/bin/mvn" ]; then
  TMP="$RUNTIME_ROOT/maven-extract-$$"
  mkdir -p "$TMP"
  unzip -q "$ARCHIVE" -d "$TMP"
  mv "$TMP/apache-maven-$MAVEN_VERSION" "$MAVEN_HOME_LOCAL"
  rmdir "$TMP"
fi
exec "$MAVEN_HOME_LOCAL/bin/mvn" "$@"
