/** 搜索 + 筛选 + 排序（院校库和后面的智能择校共用） */

function defaultFilters() {
  return {
    keyword: '',
    regions: [],   // 多选，如 ['华东', '华北']
    levels: [],    // 多选，如 ['C9', '985']
    degree: '',    // '' | 'academic' | 'professional'
    math: '',      // '' | '数学一' | '数学二'
    only408: false,
    maxLine: '',   // 复试线上限，'' 表示不限
    sort: 'default' // 'default' | 'lineAsc' | 'planDesc'
  }
}

function matchKeyword(p, keyword) {
  const words = keyword.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return true
  const text = [p.schoolName, p.majorName, p.majorCode, p.college, p.province, p.city, p.level]
    .join(' ')
    .toLowerCase()
  return words.every((w) => text.indexOf(w) >= 0)
}

function applyFilters(list, f) {
  const maxLine = f.maxLine === '' ? null : Number(f.maxLine)
  const res = list.filter((p) => {
    if (f.regions.length && f.regions.indexOf(p.region) < 0) return false
    if (f.levels.length && f.levels.indexOf(p.level) < 0) return false
    if (f.degree && p.degreeType !== f.degree) return false
    if (f.math && p.math !== f.math) return false
    if (f.only408 && !p.is408) return false
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
  if (f.regions.length) n++
  if (f.levels.length) n++
  if (f.degree) n++
  if (f.math) n++
  if (f.only408) n++
  if (f.maxLine !== '') n++
  return n
}

module.exports = { defaultFilters, applyFilters, countActive }
