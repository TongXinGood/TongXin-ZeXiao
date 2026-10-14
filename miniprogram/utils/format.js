/** 把专业索引数据加工成卡片直接可用的展示字段 */

const LEVEL_CLASS = { C9: 'lv-c9', '985': 'lv-985', '211': 'lv-211', '双一流': 'lv-syl', '双非': 'lv-sf' }

function dash(v) {
  return v === null || v === undefined ? '—' : v
}

function decorateProgram(p) {
  let deltaText = ''
  let deltaClass = ''
  if (typeof p.lineDelta === 'number') {
    if (p.lineDelta > 0) { deltaText = '↑' + p.lineDelta; deltaClass = 'up' }
    else if (p.lineDelta < 0) { deltaText = '↓' + -p.lineDelta; deltaClass = 'down' }
    else { deltaText = '持平'; deltaClass = 'flat' }
  }
  return Object.assign({}, p, {
    levelClass: LEVEL_CLASS[p.level] || 'lv-sf',
    degreeLabel: p.degreeType === 'academic' ? '学硕' : '专硕',
    degreeClass: p.degreeType === 'academic' ? 'tag-blue' : 'tag-green',
    proLabel: p.is408 ? '408' : '自命题 ' + (p.proCodes || []).join('/'),
    lineText: dash(p.latestLine),
    planText: dash(p.latestPlan),
    exemptText: dash(p.latestExempt),
    deltaText,
    deltaClass
  })
}

module.exports = { dash, decorateProgram }

/** 详情页：把一个专业的完整数据加工成页面直接可用的结构 */
function buildDetail(p) {
  const years = (p.years || []).slice().sort((a, b) => a.year - b.year)

  // 复试线柱状图：高度按最低~最高之间的相对位置，保证差异看得出来；数值直接标在柱子上
  const totals = years.map((y) => (y.retestLine ? y.retestLine.total : null)).filter((v) => typeof v === 'number')
  const min = Math.min.apply(null, totals)
  const max = Math.max.apply(null, totals)
  let prev = null
  const bars = years.map((y) => {
    const v = y.retestLine ? y.retestLine.total : null
    let deltaText = ''
    let deltaClass = ''
    if (v !== null && prev !== null) {
      const d = v - prev
      deltaText = d > 0 ? '↑' + d : d < 0 ? '↓' + -d : '持平'
      deltaClass = d > 0 ? 'up' : d < 0 ? 'down' : 'flat'
    }
    if (v !== null) prev = v
    const height = v === null ? 0 : max === min ? 70 : Math.round(40 + (60 * (v - min)) / (max - min))
    return { year: y.year, value: dash(v), height, empty: v === null, deltaText, deltaClass }
  })

  const lines = years.map((y) => {
    const r = y.retestLine || {}
    return { year: y.year, total: dash(r.total), politics: dash(r.politics), foreign: dash(r.foreign), math: dash(r.math), pro: dash(r.pro) }
  })

  const enroll = years.map((y) => {
    const plan = y.planCount
    const exempt = y.exemptCount
    let exemptRate = '—'
    if (typeof plan === 'number' && typeof exempt === 'number' && plan + exempt > 0) {
      exemptRate = Math.round((exempt * 100) / (plan + exempt)) + '%'
    }
    return {
      year: y.year,
      plan: dash(plan),
      exempt: dash(exempt),
      exemptRate,
      admitted: dash(y.admittedCount),
      retest: dash(y.retestCount)
    }
  })

  const notes = years.filter((y) => y.note).map((y) => ({ year: y.year, text: y.note }))
  const exam = p.exam || {}

  return {
    id: p.id,
    majorCode: p.majorCode,
    majorName: p.majorName,
    college: p.college,
    degreeLabel: p.degreeType === 'academic' ? '学硕' : '专硕',
    degreeClass: p.degreeType === 'academic' ? 'tag-blue' : 'tag-green',
    is408: !!p.is408,
    subjects: [
      { label: '政治', value: exam.politics || '—' },
      { label: '外语', value: exam.foreign || '—' },
      { label: '数学', value: exam.math || '不考数学' },
      { label: '专业课', value: (exam.pro || []).map((x) => x.code + ' ' + x.name).join('、') || '—' }
    ],
    bars,
    lines,
    enroll,
    notes,
    remark: p.remark || '',
    sources: (p.sources || []).filter((s) => s.title)
  }
}

module.exports.buildDetail = buildDetail
