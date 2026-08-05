#!/bin/bash
# Usage: ./scripts/deploy.sh v3   (run from your local machine, repo root)
set -euo pipefail

NEW_TAG="${1:?Usage: deploy.sh <tag>}"
DOCKERHUB_USER="spa511"
EC2_KEY="~/.ssh/sparsh-admin-sportsfolio-ssh.pem"
EC2_HOST="ubuntu@15.206.209.67"
REMOTE_DIR="~/sportsfolio-backend-prod"

echo "== npm audit gate =="
npm audit --audit-level=critical

echo "== Build (always pin platform — don't let a Mac build silently produce amd64/v3) =="
docker buildx build --platform linux/amd64 --provenance=false \
  -t "${DOCKERHUB_USER}/sportsfolio-backend:${NEW_TAG}" --push .

echo "== Image scan =="
docker scout quickview "${DOCKERHUB_USER}/sportsfolio-backend:${NEW_TAG}" || true

echo "== Deploy =="
ssh -i "${EC2_KEY}" "${EC2_HOST}" "
  cd ${REMOTE_DIR} &&
  sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=${NEW_TAG}/' .env &&
  docker compose pull &&
  docker compose run --rm migrate &&
  docker compose up -d &&
  docker compose ps
"

echo "== Verify =="
ssh -i "${EC2_KEY}" "${EC2_HOST}" "bash ~/security-audit.sh"
