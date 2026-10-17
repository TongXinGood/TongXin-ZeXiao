/**
 * 智能择校：匹配算法
 *
 * 1. 先按问卷条件筛掉不符合的专业（省份、层次、学硕/专硕、方向、学习方式、科目、招生人数），
 *    条件判断和院校库筛选共用 utils/filter.js 的 passBasic，两边结果一致。
 * 2. 再用预估总分范围 [最低, 最高] 与该专业「最近一年复试线」比较分档：
 *      保：最低分 − 复试线 > SAFE_GAP
 *      稳：最低分 ≥ 复试线
 *      冲：最低分 < 复试线，且 最高分 ≥ 复试线 − REACH_MAX_GAP
 *      其余：不推荐（计入 tooHard）
 * 3. 单科检查：某科最低分 < 该专业单科线 → 卡片上提醒，但不剔除（单科线数据可能不全）。
 *
 * 参数在 config.js 的 MATCH 里调整。
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
  { key: 'reach', label: '冲', desc: '最低分没过线，发挥好才能过' },
  { key: 'steady', label: '稳', desc: '最低分也能过线，高出 0–' + MATCH.SAFE_GAP + ' 分' },
  { key: 'safe', label: '保', desc: '最低分也高出复试线 ' + MATCH.SAFE_GAP + ' 分以上' }
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
 * 每个专业附加：gapMin, gapMax, weak（单科可能不过线的科目名数组）
 */
function matchPrograms(programs, answers) {
  const score = parseScores(answers.scores)
  const f = answersToFilters(answers)
  const tiers = { reach: [], steady: [], safe: [] }
  let noLine = 0
  let tooHard = 0
  if (!score.ok) return { tiers, noLine, tooHard, score }

  programs.forEach((p) => {
    if (!passBasic(p, f)) return
    if (typeof p.latestLine !== 'number') {
      noLine++
      return
    }
    const gapMin = score.totalMin - p.latestLine
    const gapMax = score.totalMax - p.latestLine
    const singles = p.lineSingles || {}
    const weak = SUBJECTS.filter((s) => typeof singles[s.key] === 'number' && score.min[s.key] < singles[s.key]).map((s) => s.label)
    const item = Object.assign({}, p, { gapMin, gapMax, weak })

    if (gapMin > MATCH.SAFE_GAP) tiers.safe.push(item)
    else if (gapMin >= 0) tiers.steady.push(item)
    else if (gapMax >= -MATCH.REACH_MAX_GAP) tiers.reach.push(item)
    else tooHard++
  })
  // 每档内：复试线高的（通常学校更好）排前面
  Object.keys(tiers).forEach((k) => tiers[k].sort((a, b) => b.latestLine - a.latestLine))
  return { tiers, noLine, tooHard, score }
}

/** 卡片上的分差说明 */
function gapText(p) {
  if (p.gapMin >= 0) return '最低分高出复试线 ' + p.gapMin + ' 分'
  const hi = p.gapMax > 0 ? '最高分高出 ' + p.gapMax + ' 分' : p.gapMax === 0 ? '最高分刚好持平' : '最高分差 ' + -p.gapMax + ' 分'
  return '最低分差 ' + -p.gapMin + ' 分，' + hi
}

function weakText(p) {
  return p.weak && p.weak.length ? '⚠ ' + p.weak.join('、') + '最低分低于单科线' : ''
}

module.exports = { SUBJECTS, TIERS, defaultAnswers, parseScores, answersToFilters, matchPrograms, gapText, weakText }
