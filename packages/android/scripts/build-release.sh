#!/usr/bin/env bash
# Builds the signed app bundle (.aab) you upload to the Play Console, plus a signed .apk for direct installs,
# and writes assetlinks.json (the file that lets the app open your site full screen).
#
#   export TWA_URL=https://your-domain.com            # the deployed site, https only
#   export CHAYAN_KEYSTORE=$HOME/chayan-keys/chayan-upload.jks
#   export CHAYAN_KEYSTORE_PASSWORD='…'               # (CHAYAN_KEY_ALIAS defaults to "chayan")
#   export VERSION_CODE=1 VERSION_NAME=1.0.0          # raise VERSION_CODE by 1 for every upload
#   export PLAY_SIGNING_SHA256='AA:BB:…'              # optional, after the first upload: Play Console → App integrity
#   ./scripts/build-release.sh
set -euo pipefail
source "$(dirname "$0")/env.sh"

: "${TWA_URL:?Set TWA_URL to your deployed https site, e.g. https://your-domain.com}"
: "${CHAYAN_KEYSTORE:?Set CHAYAN_KEYSTORE to the path of your .jks (run scripts/create-keystore.sh once)}"
: "${CHAYAN_KEYSTORE_PASSWORD:?Set CHAYAN_KEYSTORE_PASSWORD}"
case "$TWA_URL" in https://*) ;; *) echo "TWA_URL must start with https:// for a Play Store build." >&2; exit 1 ;; esac
case "$TWA_URL" in *REPLACE-WITH*|*example*) echo "TWA_URL still looks like a placeholder." >&2; exit 1 ;; esac
[ -f "$CHAYAN_KEYSTORE" ] || { echo "Keystore not found: $CHAYAN_KEYSTORE" >&2; exit 1; }
export CHAYAN_KEYSTORE CHAYAN_KEYSTORE_PASSWORD CHAYAN_KEY_ALIAS="${CHAYAN_KEY_ALIAS:-chayan}"

URL="${TWA_URL%/}/dashboard"
APP_ID="${APP_ID:-com.chayan.app}"
echo "Building $APP_ID  version ${VERSION_NAME:-1.0.0} (${VERSION_CODE:-1})  opening $URL"
./gradlew clean bundleRelease assembleRelease \
  -PtwaUrl="$URL" -PappId="$APP_ID" -PversionCode="${VERSION_CODE:-1}" -PversionName="${VERSION_NAME:-1.0.0}" \
  --no-daemon --console=plain -q

AAB=app/build/outputs/bundle/release/app-release.aab
APK=app/build/outputs/apk/release/app-release.apk
UPLOAD_SHA=$(keytool -list -v -keystore "$CHAYAN_KEYSTORE" -alias "$CHAYAN_KEY_ALIAS" -storepass "$CHAYAN_KEYSTORE_PASSWORD" 2>/dev/null | awk '/SHA256:/{print $2; exit}')
[ -n "$UPLOAD_SHA" ] || { echo "Could not read the key fingerprint (wrong password or alias?)" >&2; exit 1; }

# assetlinks.json: one entry per signing key (your upload key, and Google's Play signing key once you know it)
OUT="${ASSETLINKS_OUT:-$(pwd)/../frontend/public/.well-known/assetlinks.json}"
mkdir -p "$(dirname "$OUT")"
FPS="\"$UPLOAD_SHA\""
[ -n "${PLAY_SIGNING_SHA256:-}" ] && FPS="$FPS, \"$PLAY_SIGNING_SHA256\""
cat > "$OUT" <<JSON
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "$APP_ID",
      "sha256_cert_fingerprints": [$FPS]
    }
  }
]
JSON

echo
echo "✔ Upload this to Play Console:  $(pwd)/$AAB   ($(du -h "$AAB" | cut -f1))"
echo "✔ Signed APK for direct install: $(pwd)/$APK"
echo "✔ assetlinks.json written to:    $OUT"
echo "  → it must be reachable at ${TWA_URL%/}/.well-known/assetlinks.json (deploy the website with it)."
[ -z "${PLAY_SIGNING_SHA256:-}" ] && echo "  → after your first upload, copy 'App signing key certificate' SHA-256 from Play Console → App integrity, set PLAY_SIGNING_SHA256 and run this script again."
exit 0
