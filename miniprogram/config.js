/**
 * 全局配置
 * USE_MOCK = true ：读取本地 mock/data.js（由 scripts/build.js 生成），无需服务器
 * USE_MOCK = false：请求服务器 BASE_URL 下的 JSON
 *
 * 开发阶段（域名备案中）：BASE_URL 用 http://服务器IP/kaoyan/api/v1，
 *   并在开发者工具勾选「不校验合法域名」
 * 备案完成后：改成 https://你的域名/kaoyan/api/v1
 */
module.exports = {
  USE_MOCK: true,
  BASE_URL: 'http://YOUR_SERVER_IP/kaoyan/api/v1',
  MAX_COMPARE: 4,
  DISCLAIMER: '数据仅供参考，以研招网和院校官网为准'
}
