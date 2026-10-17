/** 搜索 + 筛选 + 排序（院校库和智能择校共用同一套条件） */

function defaultFilters() {
  return {
    keyword: '',
    provinces: [],  // 多选省份，空 = 不限
    levels: [],     // 多选层次，如 ['C9', '985']
    degree: '',     // '' | 'academic' | 'professional'
    directions: [], // 多选专业方向，空 = 不限
    studyMode: '',  // '' | 'full' | 'part'
    foreign: '',    // '' | '英语一' | '英语二'
    math: '',       // '' | '数学一' | '数学二'
    proType: '',    // '' | '408' | 'self'（自命题）
    minPlan: 0,     // 最近一年统招计划 ≥ 该值，0 = 不限
    maxLine: '',    // 复试线上限，'' = 不限
    sort: 'default' // 'default' | 'lineAsc' | 'planDesc'
  }
}

function matchKeyword(p, keyword) {
  const words = keyword.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return true
  const text = [p.schoolName, p.majorName, p.majorCode, p.college, p.province, p.city, p.level, p.direction]
    .join(' ')
    .toLowerCase()
  return words.every((w) => text.indexOf(w) >= 0)
}

/** 单个专业是否满足条件（不含关键词、复试线） */
function passBasic(p, f) {
  if (f.provinces.length && f.provinces.indexOf(p.province) < 0) return false
  if (f.levels.length && f.levels.indexOf(p.level) < 0) return false
  if (f.degree && p.degreeType !== f.degree) return false
  if (f.directions.length && f.directions.indexOf(p.direction) < 0) return false
  if (f.studyMode && p.studyMode !== f.studyMode) return false
  if (f.foreign && p.foreign !== f.foreign) return false
  if (f.math && p.math !== f.math) return false
  if (f.proType === '408' && !p.is408) return false
  if (f.proType === 'self' && p.is408) return false
  if (f.minPlan && !(typeof p.latestPlan === 'number' && p.latestPlan >= f.minPlan)) return false
  return true
}

function applyFilters(list, f) {
  const maxLine = f.maxLine === '' ? null : Number(f.maxLine)
  const res = list.filter((p) => {
    if (!passBasic(p, f)) return false
    if (maxLine !== null && !(typeof p.latestLine === 'number' && p.latestLine <= maxLine)) return false
    return matchKeyword(p, f.keyword)
  })
  // 没有数据的排在最后
  if (f.sort === 'lineAsc') {
    res.sort((a, b) => (a.latestLine == null ? 9999 : a.latestLine) - (b.latestLine == null ? 9999 : b.latestLine))
  } else if (f.sort === 'planDesc') {
    res.sort((a, b) => (b.latestPlan == null ? -1 : b.latestPlan) - (a.latestPlan == null ? -1 : a.latestPlan))
  }
  return res
}

/** 已生效的筛选条件数（不含关键词和排序），用于按钮角标 */
function countActive(f) {
  let n = 0
  ;['provinces', 'levels', 'directions'].forEach((k) => { if (f[k].length) n++ })
  ;['degree', 'studyMode', 'foreign', 'math', 'proType'].forEach((k) => { if (f[k]) n++ })
  if (f.minPlan) n++
  if (f.maxLine !== '') n++
  return n
}

module.exports = { defaultFilters, passBasic, applyFilters, countActive }
