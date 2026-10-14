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
  SAMPLE            存在即表示示例数据，页面会显示提示条
scripts/build.js    校验数据并生成 dist/ 与 mock
dist/api/v1/        上传到服务器的 JSON（已 gitignore）
```

## 更新数据

```bash
node scripts/build.js
```

校验失败会列出具体文件和字段；成功后把 `dist/api/v1/` 上传到服务器。
