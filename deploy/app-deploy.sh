#!/usr/bin/env bash
# 用法: bash app-deploy.sh [user@host]   默认 root@81.70.239.202
# 在服务器上从源码构建漫途 Wanderly 镜像并以 Docker 部署到 wanderly.deepsong.top
set -euo pipefail
HOST="${1:-root@81.70.239.202}"
DIR="$(cd "$(dirname "$0")" && pwd)"

scp "$DIR/wanderly-src.tar.gz" "$HOST:/tmp/wanderly-src.tar.gz"

ssh "$HOST" 'bash -s' <<'EOF'
set -euo pipefail
mkdir -p /opt/wanderly/src
tar -xzf /tmp/wanderly-src.tar.gz -C /opt/wanderly/src
rm -f /tmp/wanderly-src.tar.gz

if ! command -v docker >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y docker.io docker-compose-v2 || { curl -fsSL https://get.docker.com | sh; }
  mkdir -p /etc/docker
  printf '{\n  "registry-mirrors": ["https://mirror.ccs.tencentyun.com"]\n}\n' > /etc/docker/daemon.json
  systemctl enable --now docker
  systemctl restart docker || true
fi

cd /opt/wanderly/src
docker build --build-arg NPM_REGISTRY=https://registry.npmmirror.com -t wanderly:local .

cd /opt/wanderly
if [ ! -f .env ]; then
  umask 077
  {
    echo "ENCRYPTION_KEY=$(openssl rand -hex 32)"
    echo "ADMIN_PASSWORD=$(openssl rand -base64 12 | tr -d '/+=' | cut -c1-16)"
  } > .env
fi
cat > docker-compose.yml <<'YML'
services:
  app:
    image: wanderly:local
    container_name: wanderly
    read_only: true
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    cap_add:
      - CHOWN
      - SETUID
      - SETGID
    tmpfs:
      - /tmp:noexec,nosuid,size=128m
    ports:
      - "127.0.0.1:3000:3000"
    env_file: .env
    environment:
      - NODE_ENV=production
      - PORT=3000
      - TZ=Asia/Shanghai
      - DEFAULT_LANGUAGE=zh
      - FORCE_HTTPS=true
      - TRUST_PROXY=1
      - APP_URL=https://wanderly.deepsong.top
      - ALLOWED_ORIGINS=https://wanderly.deepsong.top
      - ADMIN_EMAIL=admin@deepsong.top
    volumes:
      - ./data:/app/data
      - ./uploads:/app/uploads
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 15s
YML
mkdir -p data uploads
docker compose up -d

cat > /etc/nginx/conf.d/wanderly.conf <<'NGX'
map $http_upgrade $connection_upgrade {
  default upgrade;
  ''      close;
}
server {
  listen 80;
  server_name wanderly.deepsong.top;
  client_max_body_size 60m;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 300s;
  }
}
NGX
nginx -t && nginx -s reload

if ! command -v certbot >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get install -y certbot python3-certbot-nginx
fi
certbot --nginx -d wanderly.deepsong.top --non-interactive --agree-tos -m admin@deepsong.top --redirect

for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:3000/api/health >/dev/null 2>&1; then break; fi
  sleep 2
done
curl -sf http://127.0.0.1:3000/api/health && echo
echo "ADMIN LOGIN: admin@deepsong.top / $(grep ADMIN_PASSWORD /opt/wanderly/.env | cut -d= -f2)"
echo "APP DEPLOYED: https://wanderly.deepsong.top"
EOF