/**
 * 智能择校：匹配算法
 *
 * 1. 先按问卷条件筛掉不符合的专业（省份、层次、学硕/专硕、方向、学习方式、科目、招生人数），
 *    条件判断和院校库筛选共用 utils/filter.js 的 passBasic，两边结果一致。
 * 2. 再拿「预估分」和最近一年（有复试线的那年）的数据比：
 *      预估分 = (总分最低 + 总分最高) ÷ 2
 *      复试线 line、录取最低分 min、录取平均分 avg 都取最近一年；以后加了新年份自动用新年份
 *    分档（GAP = 10，在 config.js 的 MATCH）：
 *      保底：预估分 ≥ avg + GAP
 *      稳妥：min + GAP ≤ 预估分 < avg + GAP
 *      冲击：line ≤ 预估分 < min + GAP（刚好擦线也算）
 *      低于复试线：不推荐，计入 tooHard
 *    没有录取最低分时 min 按复试线算；没有录取平均分时不判保底（最高到稳妥），卡片上注明。
 * 3. 单科检查：某科最低分 < 该专业单科线 → 卡片上提醒，但不剔除（单科线数据可能不全）。
 *    名额 < LOW_PLAN 也在卡片上提醒；复录比 > HIGH_RATIO 的标签由 utils/format.js 加在所有专业卡片上。
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
  { key: 'reach', label: '冲击', desc: '过了复试线，但没比录取最低分高出 10 分，复试要拼一拼' },
  { key: 'steady', label: '稳妥', desc: '比录取最低分高出 10 分以上，但没比录取平均分高出 10 分' },
  { key: 'safe', label: '保底', desc: '比录取平均分高出 10 分以上，比较稳妥' }
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
 * 某个专业按最近一年数据分档。返回 null 表示缺复试线，无法判断。
 * 返回 { tier: 'safe' | 'steady' | 'reach' | null(低于复试线), line, min, avg, hasMin, noAdmit }
 */
function tierOf(p, userScore) {
  const line = p.latestLine
  if (typeof line !== 'number') return null
  const min = typeof p.latestAdmitMin === 'number' ? Math.max(p.latestAdmitMin, line) : line
  const avg = typeof p.latestAdmitAvg === 'number' ? p.latestAdmitAvg : null
  let tier = null
  if (avg !== null && userScore >= avg + MATCH.GAP) tier = 'safe'
  else if (userScore >= min + MATCH.GAP) tier = 'steady'
  else if (userScore >= line) tier = 'reach'
  const hasMin = typeof p.latestAdmitMin === 'number'
  return { tier, line, min, avg, hasMin, noAdmit: !hasMin || avg === null }
}

/**
 * 返回 { tiers: { reach, steady, safe }, noLine, tooHard, score }
 * 每个专业附加：userScore, line, min, avg, noAdmit, weak（单科可能不过线的科目名数组）
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
    const r = tierOf(p, userScore)
    if (!r) {
      noLine++
      return
    }
    if (!r.tier) {
      tooHard++
      return
    }
    const singles = p.lineSingles || {}
    const weak = SUBJECTS.filter((s) => typeof singles[s.key] === 'number' && score.min[s.key] < singles[s.key]).map((s) => s.label)
    tiers[r.tier].push(Object.assign({}, p, r, { userScore, weak }))
  })
  // 每档内：复试线高的（通常学校更好）排前面
  Object.keys(tiers).forEach((key) => tiers[key].sort((a, b) => b.latestLine - a.latestLine))
  return { tiers, noLine, tooHard, score }
}

function diffText(d, name, v) {
  const n = Math.round(Math.abs(d))
  if (n === 0) return '与' + name + ' ' + v + ' 持平'
  return d > 0 ? '比' + name + ' ' + v + ' 高 ' + n + ' 分' : '低于' + name + ' ' + v + ' ' + n + ' 分'
}

/** 卡片上的分差说明，如「比 2026 年录取平均分 370 高 12 分」 */
function gapText(p) {
  const y = p.lineYear ? ' ' + p.lineYear + ' 年' : ''
  const s = p.userScore
  const avg = p.avg === null ? '' : '，录取平均分 ' + p.avg
  let t
  if (p.tier === 'safe') t = diffText(s - p.avg, y + '录取平均分', p.avg)
  else if (p.tier === 'steady') t = diffText(s - p.min, y + (p.hasMin ? '录取最低分' : '复试线'), p.min) + avg
  else t = diffText(s - p.line, y + '复试线', p.line) + (p.min > p.line ? '，录取最低分 ' + p.min : '') + avg
  if (p.noAdmit) t += '（缺录取分数据，仅供参考）'
  return t
}

/** 橙色提醒：单科可能不过线、名额少 */
function weakText(p) {
  const parts = []
  if (p.weak && p.weak.length) parts.push(p.weak.join('、') + '最低分低于单科线')
  if (typeof p.latestPlan === 'number' && p.latestPlan < MATCH.LOW_PLAN) parts.push('名额少，分数线波动大')
  return parts.length ? '⚠ ' + parts.join('；') : ''
}

module.exports = { SUBJECTS, TIERS, defaultAnswers, parseScores, answersToFilters, tierOf, matchPrograms, gapText, weakText }
