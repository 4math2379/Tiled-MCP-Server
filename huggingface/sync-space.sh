#!/bin/sh
# Publish the current commit of this repository to its Hugging Face Space.
#
#   huggingface/sync-space.sh [OWNER/SPACE]        default: 4math/tiled-map-builder
#
# Needs git and the hf CLI (pip install -U huggingface_hub), logged in with write access to the
# Space: run "hf auth login" or set HF_TOKEN. The Space then rebuilds from the Dockerfile.
#
# The Space's README.md must start with its YAML card, so the uploaded README is
# huggingface/space-card.md followed by the repository README. Files deleted from the
# repository are deleted from the Space too.
set -eu

SPACE="${1:-4math/tiled-map-builder}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

git -C "$ROOT" archive HEAD | tar -x -C "$STAGE"
cat "$ROOT/huggingface/space-card.md" "$ROOT/README.md" > "$STAGE/README.md"

hf upload "$SPACE" "$STAGE" . \
  --repo-type space \
  --delete "*" \
  --commit-message "Sync from GitHub $(git -C "$ROOT" rev-parse --short HEAD)"
