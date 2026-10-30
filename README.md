# 考研择校（计算机）

微信小程序，数据为静态 JSON，放在自己的服务器上。

## 目录

```
miniprogram/        小程序代码（开发者工具打开仓库根目录即可）
  config.js         USE_MOCK / BASE_URL 配置
  mock/data.js      本地调试数据（自动生成，勿手改）
data/
  schools.json      院校基础信息
  detail/{院校代码}.json  每校的专业及 2024–2026 历年数据
  csv/              整理数据时用的原始表格（留档，便于核对）
scripts/build.js    校验数据并生成 dist/ 与 mock
dist/api/v1/        上传到服务器的 JSON（已 gitignore）
```

## 更新数据

```bash
node scripts/build.js
```

校验失败会列出具体文件和字段；成功后把 `dist/api/v1/` 上传到服务器。

## 数据字段速查（data/detail/*.json 里每个专业）

| 字段 | 说明 |
|---|---|
| `majorCode` | 6 位专业代码，如 `085404`、`0812Z1` |
| `degreeType` | `academic` 学硕 / `professional` 专硕 |
| `direction` | 可不填，按专业代码自动判断；判断不了时构建会提示你补 |
| `studyMode` | 可不填，默认 `full` 全日制；非全日制填 `part` |
| `exam` | 政治、外语（英语一/二）、数学（数学一/二）、专业课（含 408 即视为考 408） |
| `years[].retestLine` | 复试线：总分 + 单科（政治、外语、数学、专业课），智能择校会做单科检查 |

院校的 `level` 可选：C9 / 985 / 211 / 双一流 / 研究院 / 双非；`region` 不用填，按省份自动归类。
问卷、院校库筛选、构建校验共用 `miniprogram/utils/dict.js`，要增删方向或层次改这一个文件。
智能择校算法在 `miniprogram/utils/match.js`，分档参数在 `miniprogram/config.js` 的 `MATCH`；
预测线 `predLine` 和历年波动 `lineSigma` 由 `scripts/line-stats.js` 计算，构建时写进 `programs.json`。
改了算法后运行 `node scripts/build.js && node scripts/test-match.js` 检查。

## 院校评价（data/reviews/{院校代码}.json）

```json
{
  "schoolId": "10335",
  "updatedAt": "2026-10-17",
  "editor": ["编辑点评第一段", "第二段"],
  "photos": [{ "image": "reviews/10335-dorm.jpg", "caption": "宿舍" }],
  "comments": [{ "text": "原话摘录", "author": "某 2025 级研究生", "source": "知乎", "date": "2026-09" }]
}
```

三项至少有一项；照片放 `data/images/reviews/`，单张 500 KB 以内。没有评价文件的学校，详情页不显示这个板块。

## 服务器部署（Ubuntu 24.04 + Nginx）

数据由 Claude 构建好（`dist/` 已提交到仓库），服务器只需拉代码，不用装 Node.js。

首次部署：
```bash
sudo git clone https://github.com/TongXinGood/TongXin-ZeXiao.git /var/www/kaoyan
sudo chown -R ubuntu:ubuntu /var/www/kaoyan
sudo cp /var/www/kaoyan/server/nginx-kaoyan.conf /etc/nginx/snippets/kaoyan.conf
sudo sed -i 's/^\s*server_name _;/&\n\tinclude snippets\/kaoyan.conf;/' /etc/nginx/sites-available/default
sudo nginx -t && sudo systemctl reload nginx
```

以后更新数据：
```bash
bash /var/www/kaoyan/scripts/deploy.sh
```

访问地址：`http://服务器IP/kaoyan/api/v1/meta.json`

## 网站首页（site/）

`site/index.html` 是域名首页（个人学习笔记页），备案要求网站能正常访问、底部挂 ICP 备案号。
`scripts/deploy.sh` 每次会把 `site/` 同步到 `/var/www/html/`。
