#!/usr/bin/env bash
# Prepares a fresh Hetzner server (Ubuntu 24.04) for Kandokids. Run ONCE, as root:
#   curl -fsSL https://raw.githubusercontent.com/eureparoangola-lgtm/kandokids/main/deploy/setup-server.sh | bash -s -- kandokids.ao
set -euo pipefail
DOMAIN="${1:?Indique o domínio, ex.: bash setup-server.sh kandokids.ao}"
REPO="https://github.com/eureparoangola-lgtm/kandokids.git"
DIR=/opt/kandokids

echo "==> Memória extra (swap 2 GB) para a compilação"
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  echo "/swapfile none swap sw 0 0" >> /etc/fstab
fi

echo "==> Atualizações automáticas de segurança"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q && apt-get install -y -q git ufw unattended-upgrades >/dev/null

echo "==> Docker"
command -v docker >/dev/null || curl -fsSL https://get.docker.com | sh

echo "==> Firewall: só SSH, HTTP e HTTPS"
ufw allow OpenSSH >/dev/null && ufw allow 80/tcp >/dev/null && ufw allow 443 >/dev/null && ufw --force enable >/dev/null

echo "==> Utilizador 'deploy' (usado pelo GitHub para atualizar o site)"
id -u deploy >/dev/null 2>&1 || adduser --disabled-password --gecos "" deploy >/dev/null
usermod -aG docker deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
if [ ! -f /home/deploy/.ssh/github_deploy ]; then
  sudo -u deploy ssh-keygen -q -t ed25519 -N "" -C "github-deploy" -f /home/deploy/.ssh/github_deploy
  cat /home/deploy/.ssh/github_deploy.pub >> /home/deploy/.ssh/authorized_keys
  chown deploy:deploy /home/deploy/.ssh/authorized_keys && chmod 600 /home/deploy/.ssh/authorized_keys
fi

echo "==> Código da Kandokids em $DIR"
[ -d "$DIR/.git" ] || git clone --depth 1 "$REPO" "$DIR"
echo "DOMAIN=$DOMAIN" > "$DIR/deploy/.env"
chown -R deploy:deploy "$DIR"

echo "==> Primeira compilação e arranque (5–10 minutos)"
sudo -u deploy bash "$DIR/deploy/update.sh"

cat <<MSG

============================================================
 Kandokids está a correr em https://$DOMAIN
 (o certificado HTTPS pode demorar 1 minuto na primeira vez)

 Para as atualizações automáticas, copie a CHAVE PRIVADA abaixo
 para o GitHub (secret HETZNER_SSH_KEY). Não a partilhe com mais ninguém.
============================================================
MSG
cat /home/deploy/.ssh/github_deploy
