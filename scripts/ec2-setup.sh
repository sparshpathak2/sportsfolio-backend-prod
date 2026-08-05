#!/bin/bash
# Run once on a fresh Ubuntu LTS EC2 instance (t3.small or bigger recommended
# for Postgres + backend + nginx together).
set -euo pipefail

echo "== Swap =="
if [ ! -f /swapfile ]; then
  sudo fallocate -l 1G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi

echo "== Docker install (official apt repo) =="
for pkg in docker.io docker-doc docker-compose docker-compose-v2 podman-docker containerd runc; do
  sudo apt-get remove -y "$pkg" || true
done
sudo apt-get update
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker "$USER"

echo "== fail2ban =="
sudo apt-get install -y fail2ban
sudo systemctl enable --now fail2ban

echo "== UFW: host-level egress/ingress =="
# Protects the HOST itself (not containers — see DOCKER-USER section below)
sudo ufw default deny outgoing
sudo ufw default deny incoming
sudo ufw allow out 53      # DNS
sudo ufw allow out 80/tcp  # HTTP (apt, Docker Hub pulls)
sudo ufw allow out 443/tcp # HTTPS
sudo ufw allow in 22/tcp   # SSH (restrict to your IP in the Security Group too)
sudo ufw allow in 80/tcp   # nginx
sudo ufw --force enable

echo "== DOCKER-USER chain: container egress lockdown (THIS is what UFW misses) =="
# Docker manipulates iptables directly and bypasses UFW's rules for container
# traffic. Default-deny all container egress, then explicitly allow only what's
# needed. This is the single highest-value control against crypto miners:
# even if a container is compromised, it cannot reach out to a mining pool,
# a C2 server, or exfiltrate data.
#
# This app calls out to AWS S3, Firebase/Google APIs, and an SMTP server —
# all on rotating cloud IP ranges, so pinning exact IPs isn't practical the
# way it would be for a single fixed third-party API. The realistic version
# of least-privilege here is: allow only the specific PORTS these integrations
# need (443 for S3/Firebase, 587/465 for SMTP), deny everything else — no
# arbitrary outbound port, no plaintext SMTP (25), no random high ports a
# miner or reverse shell would use.
sudo iptables -I DOCKER-USER -j DROP
# Allow return traffic for connections we've already accepted. Without this,
# an inbound request (e.g. a client hitting nginx) gets ACCEPTed on the way
# in but the response going back out doesn't match any interface-specific
# rule below and gets silently DROPped — the connection hangs with no error,
# looking identical to a closed port from the outside. This bit us on the
# very first live deploy.
sudo iptables -I DOCKER-USER -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
# Allow traffic to/from any Compose-managed bridge network. Using a wildcard
# (trailing +) instead of a specific bridge name/ID is deliberate: Docker
# assigns bridge interface names like br-<12 hex chars> dynamically, and
# that ID can change if the network is ever removed and recreated (e.g. a
# `docker compose down` without `up` in between). A hardcoded name silently
# breaks the rule the next time that happens; `br-+` matches any of them.
sudo iptables -I DOCKER-USER -o br-+ -j ACCEPT
# DNS resolution for containers
sudo iptables -I DOCKER-USER -p udp --dport 53 -j ACCEPT
sudo iptables -I DOCKER-USER -p tcp --dport 53 -j ACCEPT
# HTTPS out — covers AWS S3, Firebase/Google APIs, and any other HTTPS API
sudo iptables -I DOCKER-USER -p tcp --dport 443 -j ACCEPT
# SMTP submission (nodemailer) — adjust to whichever port your SMTP provider uses
sudo iptables -I DOCKER-USER -p tcp --dport 587 -j ACCEPT
sudo iptables -I DOCKER-USER -p tcp --dport 465 -j ACCEPT
# If you later narrow this to specific IPs (e.g. your SMTP provider's fixed
# relay IPs), replace the blanket port rules above with -d <ip> --dport <port> rules.

# Persist these rules across reboots — WITHOUT iptables-persistent.
# iptables-persistent conflicts with ufw as a package (installing one on
# Ubuntu removes the other, since both try to own the system's iptables
# rule-loading at boot) — this bit us on the very first live deploy, when
# installing iptables-persistent silently uninstalled ufw with no warning.
# ufw itself already reloads /etc/ufw/after.rules on every boot, so we hook
# our DOCKER-USER rules into that file instead of using a separate package.
if ! grep -q "DOCKER-USER" /etc/ufw/after.rules 2>/dev/null; then
  sudo tee -a /etc/ufw/after.rules > /dev/null <<'EOF'
*filter
:DOCKER-USER - [0:0]
-A DOCKER-USER -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
-A DOCKER-USER -o br-+ -j ACCEPT
-A DOCKER-USER -p udp --dport 53 -j ACCEPT
-A DOCKER-USER -p tcp --dport 53 -j ACCEPT
-A DOCKER-USER -p tcp --dport 443 -j ACCEPT
-A DOCKER-USER -p tcp --dport 587 -j ACCEPT
-A DOCKER-USER -p tcp --dport 465 -j ACCEPT
-A DOCKER-USER -j DROP
COMMIT
EOF
  sudo ufw reload
fi

echo "== EC2 metadata / IAM reminders (set these in the AWS console, not here) =="
echo " - Instance metadata: set to V2 only (token required), hop limit 1"
echo " - IAM instance profile: none, unless a specific AWS API need is identified"
echo " - Security group: SSH (22) from your IP only, HTTP (80) from anywhere, nothing else"

echo "== Done. Log out and back in for the docker group membership to take effect. =="