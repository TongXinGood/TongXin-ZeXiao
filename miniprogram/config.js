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
  // 智能择校分档：差值 = 预估分 − 最近一年复试线
  MATCH: {
    REACH_MIN: -20, // 冲：差值在 [-20, 0) 之间；低于 -20 分太难，不推荐
    SAFE_GAP: 15    // 稳：[0, 15]；保：> 15
  },
  DISCLAIMER: '数据仅供参考，以研招网和院校官网为准'
}
