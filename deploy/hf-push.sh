#!/usr/bin/env bash
# Usage: HF_USER=<hf username> SPACE=<space name> HF_TOKEN=<write token> bash deploy/hf-push.sh
# Builds a throwaway copy of the project, swaps in the production Dockerfile,
# adds the Space README and pushes it. Your own git repo/config is not touched.
set -euo pipefail
: "${HF_USER:?}" "${SPACE:?}" "${HF_TOKEN:?}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
cd "$ROOT"
git ls-files -co --exclude-standard -z | tar --null -T - -cf - | tar -xf - -C "$TMP"
cd "$TMP"
cp Dockerfile.prod Dockerfile
cat > README.md <<'MD'
---
title: Chayan
emoji: 📚
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 4000
pinned: false
---
Chayan exam-prep app.
MD
git init -q -b main
git config user.name "$HF_USER"
git config user.email "$HF_USER@users.noreply.huggingface.co"
git add -A
git commit -q -m "Deploy Chayan"
git -c credential.helper= push -f "https://$HF_USER:$HF_TOKEN@huggingface.co/spaces/$HF_USER/$SPACE" main
rm -rf "$TMP"
echo "Pushed. Build logs: https://huggingface.co/spaces/$HF_USER/$SPACE"
