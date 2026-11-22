#!/usr/bin/env bash
# 用法: bash deploy.sh [user@host]   默认 root@81.70.239.202 (deepsong.top)
# 将 deepsong-site.tar.gz 上传并替换 nginx 站点根目录内容（旧内容直接删除，不留备份）
set -euo pipefail
HOST="${1:-root@81.70.239.202}"
DIR="$(cd "$(dirname "$0")" && pwd)"

scp "$DIR/deepsong-site.tar.gz" "$HOST:/tmp/deepsong-site.tar.gz"

ssh "$HOST" 'bash -s' <<'EOF'
set -euo pipefail
CONF="$(grep -rl 'server_name[^;]*deepsong\.top' /etc/nginx/ 2>/dev/null || true)"
ROOT=""
for f in $CONF; do
  ROOT="$(sed -nE 's/^[[:space:]]*root[[:space:]]+([^;]+);.*/\1/p' "$f" | head -1)"
  [ -n "$ROOT" ] && break
done
ROOT="${ROOT:-/usr/share/nginx/html}"
case "$ROOT" in /*/*) ;; *) echo "refusing unsafe site root: $ROOT"; exit 1;; esac
mkdir -p /tmp/deepsong-new
tar -xzf /tmp/deepsong-site.tar.gz -C /tmp/deepsong-new
find "$ROOT" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
cp -a /tmp/deepsong-new/. "$ROOT"/
chown -R root:root "$ROOT"
find "$ROOT" -name '._*' -delete
find "$ROOT" -type d -exec chmod 755 {} +
find "$ROOT" -type f -exec chmod 644 {} +
rm -rf /tmp/deepsong-new /tmp/deepsong-site.tar.gz
nginx -t
nginx -s reload
echo "DEPLOYED to $ROOT (old content removed)"
EOF