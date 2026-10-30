/**
 * 全局配置
 * USE_MOCK = true ：读取本地 mock/data.js（由 scripts/build.js 生成），无需服务器
 * USE_MOCK = false：请求服务器 BASE_URL 下的 JSON
 *
 * 正式地址：https://tongxingood.online/kaoyan/api/v1
 *   （需在小程序后台「开发管理 → 开发设置 → 服务器域名」把 https://tongxingood.online
 *    加入 request 合法域名和 downloadFile 合法域名）
 */
module.exports = {
  USE_MOCK: false,
  BASE_URL: 'https://tongxingood.online/kaoyan/api/v1',
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
