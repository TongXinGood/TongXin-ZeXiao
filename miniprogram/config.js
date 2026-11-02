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
  // 智能择校分档参数（算法见 utils/match.js），都以最近一年数据为准
  MATCH: {
    GAP: 10,            // 进入上一档至少要高出的分数：录取最低分 +10 才算稳妥，录取平均分 +10 才算保底
    HIGH_RATIO: 1.3,    // 复录比（复试人数 ÷ 录取人数）超过这个数，卡片上提醒复试淘汰率高
    LOW_PLAN: 5         // 最近一年统招计划少于这个数，卡片上提醒名额少
  },
  DISCLAIMER: '数据仅供参考，以研招网和院校官网为准'
}
