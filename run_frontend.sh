#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/frontend"
[ -f .env.local ] || cp .env.example .env.local
npm install
npm run dev
