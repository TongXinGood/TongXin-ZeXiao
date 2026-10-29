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
  USE_MOCK: false,
  BASE_URL: 'http://124.221.122.184/kaoyan/api/v1', // 域名备案通过后改成 https://tongxingood.online/kaoyan/api/v1
  MAX_COMPARE: 4,
  // 智能择校分档参数（算法见 utils/match.js）
  // k = (预估分 − 预测线) ÷ 历年波动；k 越大越稳
  MATCH: {
    SAFE_K: 1,    // k > 1：保
    STEADY_K: 0,  // 0 < k ≤ 1：稳
    REACH_K: -1,  // -1 < k ≤ 0：冲；k ≤ -1 不推荐
    LOW_PLAN: 5   // 最近一年统招计划少于这个数，视为名额少（波动 +5，并在卡片上提醒）
  },
  DISCLAIMER: '数据仅供参考，以研招网和院校官网为准'
}
