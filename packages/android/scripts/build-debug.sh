#!/usr/bin/env bash
# Test build you can install on your own phone. It opens whatever address you give it.
#   ./scripts/build-debug.sh                          → opens http://<this computer's Wi-Fi IP>:5173/dashboard
#   ./scripts/build-debug.sh https://your-site.com    → opens your deployed site
# Output: app/build/outputs/apk/debug/app-debug.apk
set -euo pipefail
source "$(dirname "$0")/env.sh"
URL="${1:-http://$(hostname -I | awk '{print $1}'):5173/dashboard}"
case "$URL" in */dashboard) ;; *) URL="${URL%/}/dashboard" ;; esac
echo "App will open: $URL"
./gradlew assembleDebug -PtwaUrl="$URL" --no-daemon --console=plain -q
ls -la app/build/outputs/apk/debug/app-debug.apk
