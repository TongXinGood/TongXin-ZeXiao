/**
 * 智能择校：匹配算法
 *
 * 1. 先按问卷条件筛掉不符合的专业（省份、层次、学硕/专硕、方向、学习方式、科目、招生人数），
 *    条件判断和院校库筛选共用 utils/filter.js 的 passBasic，两边结果一致。
 * 2. 再看「预估分」比「预测线」高出多少个「历年波动」：
 *      预估分   = (总分最低 + 总分最高) ÷ 2
 *      预测线   predLine  = 最近一年复试线 + 0.5 × 年均变化（考虑分数线逐年上涨）
 *      历年波动 lineSigma = 历年复试线的标准差（下限 8；只有一年数据取 15；名额 < 5 再 +5）
 *      k = (预估分 − predLine) ÷ lineSigma
 *    同样高出 10 分，分数线稳定的学校 k 大、更稳；波动大的学校 k 小、风险更高。
 *    分档（阈值在 config.js 的 MATCH）：
 *      保：k > SAFE_K(1)
 *      稳：STEADY_K(0) < k ≤ SAFE_K(1)
 *      冲：REACH_K(-1) < k ≤ STEADY_K(0)
 *      其余（k ≤ -1）：不推荐，计入 tooHard
 *    predLine / lineSigma 由 scripts/build.js 调用 scripts/line-stats.js 预先算好写进 programs.json。
 * 3. 单科检查：某科最低分 < 该专业单科线 → 卡片上提醒，但不剔除（单科线数据可能不全）。
 */
const { MATCH } = require('../config')
const { defaultFilters, passBasic } = require('./filter')

const SUBJECTS = [
  { key: 'politics', label: '政治', max: 100 },
  { key: 'foreign', label: '英语', max: 100 },
  { key: 'math', label: '数学', max: 150 },
  { key: 'pro', label: '专业课', max: 150 }
]

const TIERS = [
  { key: 'reach', label: '冲', desc: '略低于预测线，差距在 1 倍历年波动以内，发挥好有机会' },
  { key: 'steady', label: '稳', desc: '高出预测线，但不到 1 倍历年波动，正常发挥大概率过线' },
  { key: 'safe', label: '保', desc: '高出预测线超过 1 倍历年波动，比较稳妥' }
]

function defaultAnswers() {
  const scores = {}
  SUBJECTS.forEach((s) => { scores[s.key] = { min: '', max: '' } })
  return {
    scores,
    degree: '',
    directions: [],
    foreign: '',
    math: '',
    proType: '',
    studyMode: 'full',
    minPlan: 0,
    levels: [],
    provinces: []
  }
}

/** 解析成绩：最高分不填按最低分算。返回 { ok, error, min, max, totalMin, totalMax } */
function parseScores(scores) {
  const min = {}
  const max = {}
  let totalMin = 0
  let totalMax = 0
  for (let i = 0; i < SUBJECTS.length; i++) {
    const s = SUBJECTS[i]
    const v = scores[s.key] || {}
    if (v.min === '' || v.min === undefined) return { ok: false, error: '请填写' + s.label + '的最低分' }
    const lo = Number(v.min)
    const hi = v.max === '' || v.max === undefined ? lo : Number(v.max)
    if (lo > s.max || hi > s.max) return { ok: false, error: s.label + '满分 ' + s.max + '，请检查' }
    if (hi < lo) return { ok: false, error: s.label + '的最高分不能低于最低分' }
    min[s.key] = lo
    max[s.key] = hi
    totalMin += lo
    totalMax += hi
  }
  return { ok: true, min, max, totalMin, totalMax }
}

/** 把问卷答案转成筛选条件（和院校库同一套） */
function answersToFilters(a) {
  return Object.assign(defaultFilters(), {
    provinces: a.provinces,
    levels: a.levels,
    degree: a.degree,
    directions: a.degree ? a.directions : [],
    studyMode: a.studyMode,
    foreign: a.foreign,
    math: a.math,
    proType: a.proType,
    minPlan: a.minPlan
  })
}

/**
 * 返回 { tiers: { reach, steady, safe }, noLine, tooHard, score }
 * 每个专业附加：predLine, lineSigma, diff（预估分 − 预测线）, k, weak（单科可能不过线的科目名数组）
 */
function matchPrograms(programs, answers) {
  const score = parseScores(answers.scores)
  const f = answersToFilters(answers)
  const tiers = { reach: [], steady: [], safe: [] }
  let noLine = 0
  let tooHard = 0
  if (!score.ok) return { tiers, noLine, tooHard, score }

  const userScore = (score.totalMin + score.totalMax) / 2
  programs.forEach((p) => {
    if (!passBasic(p, f)) return
    if (typeof p.predLine !== 'number' || typeof p.lineSigma !== 'number' || p.lineSigma <= 0) {
      noLine++
      return
    }
    const diff = userScore - p.predLine
    const k = diff / p.lineSigma
    const singles = p.lineSingles || {}
    const weak = SUBJECTS.filter((s) => typeof singles[s.key] === 'number' && score.min[s.key] < singles[s.key]).map((s) => s.label)
    const item = Object.assign({}, p, { diff, k, weak })

    if (k > MATCH.SAFE_K) tiers.safe.push(item)
    else if (k > MATCH.STEADY_K) tiers.steady.push(item)
    else if (k > MATCH.REACH_K) tiers.reach.push(item)
    else tooHard++
  })
  // 每档内：复试线高的（通常学校更好）排前面
  Object.keys(tiers).forEach((key) => tiers[key].sort((a, b) => b.latestLine - a.latestLine))
  return { tiers, noLine, tooHard, score }
}

/** 卡片上的分差说明，如「高出预测线 8 分，历年波动 ±10 分」 */
function gapText(p) {
  const d = Math.round(Math.abs(p.diff))
  const sigma = Math.round(p.lineSigma)
  if (p.diff > 0 && d > 0) return '高出预测线 ' + d + ' 分，历年波动 ±' + sigma + ' 分'
  if (p.diff < 0 && d > 0) return '低于预测线 ' + d + ' 分'
  return '与预测线持平，历年波动 ±' + sigma + ' 分'
}

/** 橙色提醒：单科可能不过线、名额少 */
function weakText(p) {
  const parts = []
  if (p.weak && p.weak.length) parts.push(p.weak.join('、') + '最低分低于单科线')
  if (typeof p.latestPlan === 'number' && p.latestPlan < MATCH.LOW_PLAN) parts.push('名额少，分数线波动大')
  return parts.length ? '⚠ ' + parts.join('；') : ''
}

module.exports = { SUBJECTS, TIERS, defaultAnswers, parseScores, answersToFilters, matchPrograms, gapText, weakText }
