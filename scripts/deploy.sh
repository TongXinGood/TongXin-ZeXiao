#!/usr/bin/env bash
# 服务器上更新数据和网站：bash /var/www/kaoyan/scripts/deploy.sh
set -e
REPO=/var/www/kaoyan
cd "$REPO"

# 第一步：拉取最新代码（GitHub 在国内不稳定：自动重试，网速太慢时提前放弃本次）
# 然后用「拉下来的新版本脚本」继续执行后面的步骤（脚本可能更新了它自己）
if [ "$1" != "--after-pull" ]; then
  OLD_CONF=$(md5sum server/nginx-kaoyan.conf | cut -d' ' -f1)
  TRIES=5
  for i in $(seq 1 $TRIES); do
    echo "正在从 GitHub 拉取（第 $i/$TRIES 次）……"
    if git -c http.version=HTTP/1.1 -c http.lowSpeedLimit=1000 -c http.lowSpeedTime=20 fetch origin main; then
      break
    fi
    if [ "$i" = "$TRIES" ]; then
      echo "连续 $TRIES 次都连不上 GitHub，请过几分钟再运行一次。服务器上的数据没有变化。"
      exit 1
    fi
    echo "没连上，10 秒后重试……"
    sleep 10
  done
  # 服务器上不手工改代码，一律以 GitHub 为准（也能覆盖手动传上来的文件，避免冲突）
  git reset --hard origin/main
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
