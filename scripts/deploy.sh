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

# 网站首页（个人学习笔记页，备案要求网站能正常访问并挂备案号）
sudo cp -r site/. /var/www/html/
echo "网站首页已同步到 /var/www/html"

echo "当前数据版本：$(grep -o '"version":"[0-9]*"' dist/api/v1/meta.json)"
echo "更新完成"
