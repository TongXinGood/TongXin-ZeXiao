/**
 * 复试线统计：预测线 predLine、历年波动 lineSigma
 * scripts/build.js 和 scripts/test-match.js 共用
 */
const { MATCH } = require('../miniprogram/config')

const TREND_WEIGHT = 0.5  // 预测时只计入一半的年均变化，避免把短期波动当成趋势
const SIGMA_MIN = 8       // 波动下限：数据少时标准差可能很小，给个底
const SIGMA_ONE_YEAR = 15 // 只有一年数据，无法估计波动，取经验值
const SIGMA_LOW_PLAN = 5  // 名额少时分数线更容易大起大落，额外加的波动

/**
 * @param years    [{ year, retestLine: { total } | null }, ...]（顺序不限）
 * @param latestPlan 最近一年统招计划（planCount），可为 null
 * @return { predLine, lineSigma } ；没有任何一年的复试线时两者都是 null
 */
function lineStats(years, latestPlan) {
  const pts = (years || [])
    .filter((y) => y.retestLine && typeof y.retestLine.total === 'number')
    .map((y) => ({ year: y.year, total: y.retestLine.total }))
    .sort((a, b) => a.year - b.year)
  if (!pts.length) return { predLine: null, lineSigma: null }

  const first = pts[0]
  const last = pts[pts.length - 1]

  // 年均变化 = (最近一年 − 最早一年) ÷ 相隔年数（中间缺年份也按实际年数算）
  const slope = pts.length > 1 ? (last.total - first.total) / (last.year - first.year) : 0
  const predLine = Math.round(last.total + TREND_WEIGHT * slope)

  // 标准差：用样本标准差（除以 n−1），年份少时更保守
  let sigma
  if (pts.length === 1) {
    sigma = SIGMA_ONE_YEAR
  } else {
    const mean = pts.reduce((s, p) => s + p.total, 0) / pts.length
    const variance = pts.reduce((s, p) => s + (p.total - mean) * (p.total - mean), 0) / (pts.length - 1)
    sigma = Math.max(SIGMA_MIN, Math.sqrt(variance))
  }
  if (typeof latestPlan === 'number' && latestPlan < MATCH.LOW_PLAN) sigma += SIGMA_LOW_PLAN

  return { predLine, lineSigma: Math.round(sigma * 10) / 10 }
}

module.exports = { lineStats, TREND_WEIGHT, SIGMA_MIN, SIGMA_ONE_YEAR, SIGMA_LOW_PLAN }
