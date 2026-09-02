#!/usr/bin/env bash
# NovaStaris — GMGN fixed-egress proxy (~$5/mo VPS)
# Run on Ubuntu 22.04/24.04 as root:  curl -fsSL ... | bash
# Or:  sudo bash scripts/setup-gmgn-egress-proxy.sh [proxy_user]

set -euo pipefail

PROXY_USER="${1:-gmgnproxy}"
PROXY_PORT="${GMGN_PROXY_PORT:-3128}"

if [[ "${EUID:-0}" -ne 0 ]]; then
  echo "Run as root: sudo bash $0"
  exit 1
fi

apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq squid apache2-utils ufw

PASS="$(openssl rand -base64 18 | tr -d '/+=' | head -c 20)"
htpasswd -bc /etc/squid/passwd "$PROXY_USER" "$PASS"

cat >/etc/squid/squid.conf <<EOF
http_port ${PROXY_PORT}
auth_param basic program /usr/lib/squid/basic_ncsa_auth /etc/squid/passwd
auth_param basic children 5 startup=5 idle=1
auth_param basic realm NovaStaris GMGN Proxy
auth_param basic credentialsttl 24 hours
acl authenticated proxy_auth REQUIRED
acl SSL_ports port 443
acl CONNECT method CONNECT
http_access allow CONNECT SSL_ports authenticated
http_access deny all
visible_hostname novastaris-gmgn-proxy
EOF

systemctl enable squid
systemctl restart squid

# Firewall: SSH + proxy only
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow "${PROXY_PORT}/tcp"
ufw --force enable

PUBLIC_IP="$(curl -fsSL https://api.ipify.org || curl -fsSL https://ip.me/ip)"
ENC_USER="$(python3 -c "import urllib.parse; print(urllib.parse.quote('${PROXY_USER}'))")"
ENC_PASS="$(python3 -c "import urllib.parse; print(urllib.parse.quote('${PASS}'))")"
PROXY_URL="http://${ENC_USER}:${ENC_PASS}@${PUBLIC_IP}:${PROXY_PORT}"

echo ""
echo "=============================================="
echo " GMGN egress proxy is ready"
echo "=============================================="
echo " VPS public IP (whitelist ONLY this in GMGN):"
echo "   ${PUBLIC_IP}"
echo ""
echo " Add to Vercel → Project → Settings → Environment Variables:"
echo "   GMGN_HTTPS_PROXY=${PROXY_URL}"
echo ""
echo " Proxy user: ${PROXY_USER}"
echo " Proxy pass: ${PASS}"
echo " (Save the password — shown once.)"
echo "=============================================="
