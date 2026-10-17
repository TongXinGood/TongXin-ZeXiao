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
  // 智能择校分档参数（算法见 utils/match.js）
  MATCH: {
    SAFE_GAP: 15,    // 保：最低分比复试线高出 15 分以上
    REACH_MAX_GAP: 0 // 冲：最高分 ≥ 复试线 − 这个值（0 表示最高分要能过线）
  },
  DISCLAIMER: '数据仅供参考，以研招网和院校官网为准'
}
