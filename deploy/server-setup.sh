#!/usr/bin/env bash
# One-time (idempotent) host preparation. Runs ON the Lightsail instance as the ubuntu user:
#   bash /opt/freelanceflow/server-setup.sh
# Installs Docker Engine + Compose plugin, adds 2 GB swap, sets log limits and cron jobs.
set -euo pipefail
APP_DIR=/opt/freelanceflow

echo "==> OS packages"
sudo DEBIAN_FRONTEND=noninteractive apt-get update -q
sudo DEBIAN_FRONTEND=noninteractive apt-get -y -q -o Dpkg::Options::=--force-confold upgrade
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -q ca-certificates curl gnupg unattended-upgrades

echo "==> Docker Engine"
if ! command -v docker >/dev/null 2>&1; then
  sudo install -m 0755 -d /etc/apt/keyrings
  sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  sudo chmod a+r /etc/apt/keyrings/docker.asc
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
  sudo apt-get update -q
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -q docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
sudo usermod -aG docker "$USER"
# Container log rotation as a default for everything on the host.
if [[ ! -f /etc/docker/daemon.json ]]; then
  echo '{"log-driver":"json-file","log-opts":{"max-size":"10m","max-file":"3"}}' | sudo tee /etc/docker/daemon.json >/dev/null
  sudo systemctl restart docker
fi
sudo systemctl enable --now docker containerd

echo "==> Swap (2 GB safety margin for a 2 GB instance)"
if ! swapon --show | grep -q /swapfile; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile >/dev/null
  sudo swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi
echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-freelanceflow.conf >/dev/null
sudo sysctl -q --system

echo "==> journald size cap"
sudo mkdir -p /etc/systemd/journald.conf.d
printf '[Journal]\nSystemMaxUse=200M\n' | sudo tee /etc/systemd/journald.conf.d/size.conf >/dev/null
sudo systemctl restart systemd-journald

echo "==> App directory"
sudo mkdir -p "$APP_DIR/backups"
sudo chown -R "$USER":"$USER" "$APP_DIR"
chmod 700 "$APP_DIR/backups"

echo "==> Cron jobs"
crontab - <<CRON
# FreelanceFlow AI (managed by server-setup.sh)
15 3 * * * $APP_DIR/backup.sh >> $APP_DIR/backups/backup.log 2>&1
7 * * * * $APP_DIR/cleanup-demo.sh >> $APP_DIR/cleanup.log 2>&1
*/5 * * * * $APP_DIR/monitor.sh >> $APP_DIR/monitor.log 2>&1
CRON

echo "==> Done. Docker $(docker --version | cut -d' ' -f3) / $(docker compose version --short)"
