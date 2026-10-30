#!/usr/bin/env bash
# 服务器上更新数据和网站：bash /var/www/kaoyan/scripts/deploy.sh
set -e
REPO=/var/www/kaoyan
cd "$REPO"

# 第一步：拉取最新代码，然后用「拉下来的新版本脚本」继续执行后面的步骤。
# （git pull 可能会更新这个脚本本身，不重新执行的话，跑的还是旧内容）
if [ "$1" != "--after-pull" ]; then
  OLD_CONF=$(md5sum server/nginx-kaoyan.conf | cut -d' ' -f1)
  git pull --ff-only
  exec bash "$REPO/scripts/deploy.sh" --after-pull "$OLD_CONF"
fi
OLD_CONF="$2"

# Nginx 配置有变化才重载
NEW_CONF=$(md5sum server/nginx-kaoyan.conf | cut -d' ' -f1)
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
