/** 智能择校：按预估分与最近一年复试线的差值，分成 冲 / 稳 / 保 */
const { MATCH } = require('../config')
const { defaultFilters, applyFilters } = require('./filter')

const TIERS = [
  { key: 'reach', label: '冲', desc: '分数略低于复试线，有一定风险' },
  { key: 'steady', label: '稳', desc: '分数高出复试线 0–' + MATCH.SAFE_GAP + ' 分' },
  { key: 'safe', label: '保', desc: '分数高出复试线 ' + MATCH.SAFE_GAP + ' 分以上' }
]

function defaultAnswers() {
  return { score: '', regions: [], degree: '', math: '', only408: false }
}

/**
 * programs: 索引里的专业列表；answers: 问卷答案
 * 返回 { tiers: { reach: [], steady: [], safe: [] }, noLine: 缺复试线数量, tooHard: 差距过大数量 }
 */
function matchPrograms(programs, answers) {
  const score = Number(answers.score)
  const f = Object.assign(defaultFilters(), {
    regions: answers.regions,
    degree: answers.degree,
    math: answers.math,
    only408: answers.only408
  })
  const tiers = { reach: [], steady: [], safe: [] }
  let noLine = 0
  let tooHard = 0
  applyFilters(programs, f).forEach((p) => {
    if (typeof p.latestLine !== 'number') {
      noLine++
      return
    }
    const gap = score - p.latestLine
    const item = Object.assign({}, p, { gap })
    if (gap < MATCH.REACH_MIN) tooHard++
    else if (gap < 0) tiers.reach.push(item)
    else if (gap <= MATCH.SAFE_GAP) tiers.steady.push(item)
    else tiers.safe.push(item)
  })
  // 每档内：复试线高的（通常学校更好）排前面
  Object.keys(tiers).forEach((k) => tiers[k].sort((a, b) => b.latestLine - a.latestLine))
  return { tiers, noLine, tooHard }
}

/** 卡片上显示的差值说明 */
function gapText(gap) {
  if (gap < 0) return '低于复试线 ' + -gap + ' 分'
  if (gap === 0) return '与复试线持平'
  return '高出复试线 ' + gap + ' 分'
}

module.exports = { TIERS, defaultAnswers, matchPrograms, gapText }
