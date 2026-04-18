#!/usr/bin/env bash

set -euo pipefail

if rg -q "bg-amber-500/100(/100)?/10(/(35|60|80))?" apps/web; then
  echo "Found invalid amber Tailwind classes"
  exit 1
fi

if rg -q "tracking-tight tracking-tight" apps/web; then
  echo "Found duplicated tracking-tight classes"
  exit 1
fi

if rg -q "CommandPalette|command-palette" apps/web; then
  echo "Found removed command palette references"
  exit 1
fi

if find apps/web -name '* 2.tsx' | grep -q .; then
  echo "Found duplicate '* 2.tsx' files"
  exit 1
fi
