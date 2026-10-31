#!/usr/bin/env bash
# Run this ONCE, yourself, in a terminal. It creates the key that signs your app for the Play Store.
# Keep the file and its passwords somewhere very safe (and backed up). If you lose it you cannot update the app
# without Google's key-reset process. Never commit it or share it.
set -euo pipefail
source "$(dirname "$0")/env.sh"
DIR="${CHAYAN_KEY_DIR:-$HOME/chayan-keys}"
FILE="$DIR/chayan-upload.jks"
mkdir -p "$DIR" && chmod 700 "$DIR"
[ -e "$FILE" ] && { echo "$FILE already exists, not overwriting it."; exit 1; }
echo "Creating $FILE (keytool will ask for a password and your details)…"
keytool -genkeypair -v -keystore "$FILE" -alias chayan -keyalg RSA -keysize 2048 -validity 10000
chmod 600 "$FILE"
echo
echo "Done. Back up $FILE and write the passwords down. Fingerprint:"
keytool -list -v -keystore "$FILE" -alias chayan | grep -E "SHA256"
