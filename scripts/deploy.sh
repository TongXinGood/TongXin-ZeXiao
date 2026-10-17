#!/usr/bin/env bash
# 服务器上更新数据：bash /var/www/kaoyan/scripts/deploy.sh
set -e
cd /var/www/kaoyan

OLD_CONF=$(md5sum server/nginx-kaoyan.conf | cut -d' ' -f1)
git pull --ff-only
NEW_CONF=$(md5sum server/nginx-kaoyan.conf | cut -d' ' -f1)

# Nginx 配置有变化才重载
if [ "$OLD_CONF" != "$NEW_CONF" ]; then
  echo "Nginx 配置有更新，重新加载……"
  sudo cp server/nginx-kaoyan.conf /etc/nginx/snippets/kaoyan.conf
  sudo nginx -t && sudo systemctl reload nginx
fi

echo "当前数据版本：$(grep -o '"version":"[0-9]*"' dist/api/v1/meta.json)"
echo "更新完成"
