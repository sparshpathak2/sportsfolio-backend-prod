#!/bin/bash
# Run after every deploy, and periodically via cron.
# Inspects the LIVE running state — never trust that a config change "took".
set -uo pipefail

PASS=0
FAIL=0
WARN=0

pass() { echo "PASS  $1"; PASS=$((PASS+1)); }
fail() { echo "FAIL  $1"; FAIL=$((FAIL+1)); }
warn() { echo "WARN  $1"; WARN=$((WARN+1)); }

echo "=== Container hardening ==="
for c in sportsfolio-backend sportsfolio-postgres sportsfolio-nginx; do
  if ! docker inspect "$c" >/dev/null 2>&1; then
    warn "$c: container not found (not running / different name)"
    continue
  fi

  restart=$(docker inspect -f '{{.HostConfig.RestartPolicy.Name}}' "$c")
  [ "$restart" = "unless-stopped" ] && pass "$c: restart policy ($restart)" || fail "$c: restart policy is '$restart', expected unless-stopped"

  capdrop=$(docker inspect -f '{{.HostConfig.CapDrop}}' "$c")
  echo "$capdrop" | grep -qi "ALL" && pass "$c: cap_drop ALL present" || fail "$c: cap_drop ALL missing"

  nnp=$(docker inspect -f '{{.HostConfig.SecurityOpt}}' "$c")
  echo "$nnp" | grep -qi "no-new-privileges" && pass "$c: no-new-privileges set" || fail "$c: no-new-privileges missing"

  ports=$(docker inspect -f '{{.HostConfig.PortBindings}}' "$c")
  if [ "$c" = "sportsfolio-nginx" ]; then
    echo "$ports" | grep -q "80" && pass "$c: expected port 80 published" || fail "$c: expected port 80 not found"
  else
    [ "$ports" = "map[]" ] && pass "$c: no host ports exposed (as expected)" || fail "$c: unexpected exposed port(s): $ports"
  fi

  ro=$(docker inspect -f '{{.HostConfig.ReadonlyRootfs}}' "$c")
  if [ "$c" = "sportsfolio-postgres" ]; then
    warn "$c: read_only not applicable (needs to write its own data dir) — expected"
  else
    [ "$ro" = "true" ] && pass "$c: read_only rootfs" || fail "$c: read_only rootfs not set"
  fi
done

echo ""
echo "=== Host checks ==="
swapon --show | grep -q swapfile && pass "swap enabled" || fail "no swap configured"

curl -s -H "X-aws-ec2-metadata-token-ttl-seconds: 21600" -X PUT \
  "http://169.254.169.254/latest/api/token" | grep -q . \
  && pass "IMDSv2 token endpoint reachable (verify hop-limit=1 + tokens-required in AWS console)" \
  || warn "could not confirm IMDSv2 from inside instance"

sudo ufw status | grep -q "Status: active" && pass "ufw active" || fail "ufw not active"

sudo iptables -L DOCKER-USER -n | grep -q "DROP" && pass "DOCKER-USER default-drop rule present" || fail "DOCKER-USER chain missing default-drop — containers can egress freely"

sudo systemctl is-active --quiet fail2ban && pass "fail2ban active" || fail "fail2ban not running"
sudo fail2ban-client status sshd >/dev/null 2>&1 && pass "fail2ban sshd jail active" || warn "fail2ban sshd jail not confirmed"

groups "$USER" | grep -q docker && warn "current user is in docker group (== root via socket) — expected for solo admin, don't add others casually"

echo ""
echo "=== Resource / anomaly spot-check ==="
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"

echo ""
echo "=== Summary: $PASS pass / $FAIL fail / $WARN warn ==="
[ "$FAIL" -eq 0 ] || exit 1