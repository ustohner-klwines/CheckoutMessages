#!/usr/bin/env bash
#
# sync.sh — publish the checkout messaging prototypes to Azure.
#
# Copies the prototypes from the parent folder into this deploy repo, then
# commits and pushes to main, which triggers the Azure Static Web Apps build.
#
#   Mockups/CheckoutMessage/                 <- the prototypes (SOURCE OF TRUTH)
#   Mockups/CheckoutMessage/CheckoutMessages/ <- this repo (deploy target)
#
# Usage:
#   ./sync.sh                        sync + commit (timestamped) + push
#   ./sync.sh "what changed"         sync + commit with your message + push
#   ./sync.sh --force "what changed" overwrite prototypes edited in here
#
# ── WHY THE FOLDERS ARE MIRRORED ─────────────────────────────────────────
# The pages load tokens two directories up:
#     <link rel="stylesheet" href="../../KL-Design_System/tokens.css">
# so a flat copy would 404 on tokens.css and render with every design token
# undefined — the page still draws, just wrong, which is the hard kind of
# broken to notice. The deploy repo therefore mirrors the depth:
#
#     Mockups/CheckoutMessage/*.html          ../../ resolves from here
#     KL-Design_System/tokens.css             ...to here
#
# Keeping the paths identical to the source also means "what is live" can be
# answered by diffing, rather than by reading a transform.
#
# ── WHAT IS NOT PUBLISHED ────────────────────────────────────────────────
# NOTES.md. Azure Static Web Apps are PUBLIC — repo visibility is irrelevant,
# anyone with the URL reads whatever is published. NOTES.md is the internal
# decision record and stays in the design-system repo only. Same call as the
# VaultInventory prototypes. To publish it anyway, uncomment the marked line
# below — read it first and decide whether every line of it is fit to be public.
#
# This file, README.md and any other .md are blocked from the site by
# staticwebapp.config.json. That matters: THIS SCRIPT IS ITSELF PUBLISHED unless
# blocked, so its comments are public too. Do not describe the contents of
# NOTES.md here — say that it is internal and leave it at that.

set -euo pipefail

FORCE=0
if [ "${1:-}" = "--force" ]; then FORCE=1; shift; fi

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"   # this deploy repo
SRC="$(dirname "$HERE")"                                # the prototypes
DS="$(cd "$SRC/../.." && pwd)"                          # design-system root
cd "$HERE"

DEST="$HERE/Mockups/CheckoutMessage"
PROTOS=(cart-summary.html shipping-methods.html)

echo "→ source:  $SRC"
echo "→ tokens:  $DS/KL-Design_System/tokens.css"

# ── Guard: this copy is one-directional, and silently losing an edit made in
#    the wrong folder is the failure that removed the copy step from the
#    mobile-app script. Refuse rather than overwrite.
if [ "$FORCE" -eq 0 ]; then
  EDITED=""
  for f in "${PROTOS[@]}"; do
    [ -f "$DEST/$f" ] || continue
    if ! diff -q "$SRC/$f" "$DEST/$f" >/dev/null 2>&1; then
      if [ -n "$(git status --porcelain -- "Mockups/CheckoutMessage/$f")" ]; then
        EDITED="$EDITED  $f"
      fi
    fi
  done
  if [ -n "$EDITED" ]; then
    echo
    echo "✗ These prototypes have uncommitted edits INSIDE the deploy repo:"
    echo "$EDITED" | tr ' ' '\n' | sed '/^$/d;s/^/    /'
    echo
    echo "  Edit in $SRC, never in here — this copy only goes one way."
    echo "  Re-run with --force once you are sure the source folder is correct."
    exit 1
  fi
fi

# ── index.html is hand-maintained and lives only here. An uncommitted edit to
#    it must survive the copy: reverting it would undo exactly the step that
#    adding a new prototype asks for.
mkdir -p "$DEST/_shared" "$HERE/KL-Design_System"

for f in "${PROTOS[@]}"; do cp "$SRC/$f" "$DEST/$f"; done
cp "$SRC"/_shared/checkout-mock.css "$DEST/_shared/"
cp "$SRC"/_shared/checkout-mock.js  "$DEST/_shared/"
cp "$DS"/KL-Design_System/tokens.css "$HERE/KL-Design_System/"

# cp "$SRC"/NOTES.md "$DEST/"     # ← uncomment to publish the decision record

find "$HERE" -name '.DS_Store' -not -path '*/.git/*' -delete 2>/dev/null || true

# ── Warn about a prototype that is live but unreachable, since the landing page
#    is hand-maintained and this step is easy to forget.
for f in "${PROTOS[@]}"; do
  grep -q "$f" "$HERE/index.html" 2>/dev/null || \
    echo "⚠ $f is not linked from index.html — it will publish but be unreachable."
done

if [ -z "$(git status --porcelain)" ]; then
  echo "✓ Already up to date — nothing to deploy."
  exit 0
fi

git add -A
git status --short

MSG="${1:-Sync checkout messaging mockups ($(date '+%Y-%m-%d %H:%M'))}"
git commit -q -m "$MSG"

echo "→ Pushing to origin/main (triggers the Azure build)…"
git push -q origin main
echo "✓ Deployed. Azure rebuilds in ~1–2 min:"
echo "  https://purple-desert-05046be10.7.azurestaticapps.net/"
