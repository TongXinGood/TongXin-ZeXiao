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
