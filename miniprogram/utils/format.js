/** 把专业索引数据加工成卡片直接可用的展示字段 */

const { directionOf } = require('./dict')

const LEVEL_CLASS = { C9: 'lv-c9', '985': 'lv-985', '211': 'lv-211', '双一流': 'lv-syl', '研究院': 'lv-yjy', '双非': 'lv-sf' }

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
    partTime: p.studyMode === 'part',
    lineText: dash(p.latestLine),
    planText: dash(p.latestPlan),
    exemptText: dash(p.latestExempt),
    deltaText,
    deltaClass
  })
}

module.exports = { dash, decorateProgram, LEVEL_CLASS }

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
    }
  })

  // 招录数据：年份做列、指标做行；整行都没有数据的指标不显示
  const num = (v) => (typeof v === 'number' ? v : null)
  const ratio = (y) => {
    const r = num(y.retestCount)
    const a = num(y.admittedCount)
    return r !== null && a ? (r / a).toFixed(2) : null
  }
  const ADMIT_ROWS = [
    { label: '复试人数', get: (y) => num(y.retestCount) },
    { label: '录取人数', get: (y) => num(y.admittedCount) },
    { label: '复录比', get: ratio, strong: true },
    { label: '录取最低分', get: (y) => num(y.admitMin) },
    { label: '录取平均分', get: (y) => (num(y.admitAvg) === null ? null : Math.round(y.admitAvg * 10) / 10) },
    { label: '录取最高分', get: (y) => num(y.admitMax) }
  ]
  const admitRows = ADMIT_ROWS.map((r) => ({
    label: r.label,
    strong: !!r.strong,
    cells: years.map((y) => ({ year: y.year, text: dash(r.get(y)) }))
  })).filter((r) => r.cells.some((c) => c.text !== '—'))
  const admit = { years: years.map((y) => y.year), rows: admitRows }

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
    partTime: p.studyMode === 'part',
    direction: directionOf(p),
    subjects: [
      { label: '政治', value: exam.politics || '—' },
      { label: '外语', value: exam.foreign || '—' },
      { label: '数学', value: exam.math || '不考数学' },
      { label: '专业课', value: (exam.pro || []).map((x) => x.code + ' ' + x.name).join('、') || '—' }
    ],
    bars,
    lines,
    enroll,
    admit,
    notes,
    remark: p.remark || '',
    sources: (p.sources || []).filter((s) => s.title)
  }
}

module.exports.buildDetail = buildDetail

/**
 * 对比页：生成表格行
 * items: [{ p: 索引里的专业, full: 详情里的完整专业 }]
 * 行类型：{ type: 'sec', label } 分组标题；{ type: 'row', label, cells: [{ text, best, cls }] }
 */
function buildCompareRows(items, years) {
  const yearData = (full, year) => (full.years || []).filter((y) => y.year === year)[0] || {}
  const num = (v) => (typeof v === 'number' ? v : null)

  // better: 'min' 越小越好 / 'max' 越大越好 / null 不比较
  function row(label, values, better, fmt) {
    const nums = values.map(num).filter((v) => v !== null)
    let best = null
    if (better && nums.length >= 2 && Math.min.apply(null, nums) !== Math.max.apply(null, nums)) {
      best = better === 'min' ? Math.min.apply(null, nums) : Math.max.apply(null, nums)
    }
    return {
      type: 'row',
      label,
      cells: values.map((v, i) => ({
        k: i,
        text: v === null || v === undefined || v === '' ? '—' : fmt ? fmt(v) : v,
        best: best !== null && v === best
      }))
    }
  }

  const rows = []
  rows.push({ type: 'sec', label: '基本信息' })
  rows.push(row('地区', items.map((x) => x.p.province + ' · ' + x.p.region)))
  rows.push(row('层次', items.map((x) => x.p.level)))
  rows.push(row('类型', items.map((x) => (x.p.degreeType === 'academic' ? '学硕' : '专硕'))))
  rows.push(row('方向', items.map((x) => x.p.direction)))
  rows.push(row('学习方式', items.map((x) => (x.p.studyMode === 'part' ? '非全日制' : '全日制'))))
  rows.push(row('数学', items.map((x) => x.p.math || '不考')))
  rows.push(row('外语', items.map((x) => x.p.foreign)))
  rows.push(row('专业课', items.map((x) => (x.p.is408 ? '408' : '自命题 ' + x.p.proCodes.join('/')))))

  rows.push({ type: 'sec', label: '复试线（总分）' })
  const desc = years.slice().sort((a, b) => b - a)
  desc.forEach((y) => {
    rows.push(row(y + ' 年', items.map((x) => num((yearData(x.full, y).retestLine || {}).total)), 'min'))
  })
  rows.push(
    row(
      '三年平均',
      items.map((x) => {
        const v = desc.map((y) => num((yearData(x.full, y).retestLine || {}).total)).filter((n) => n !== null)
        return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null
      }),
      'min'
    )
  )
  const delta = row('最近变化', items.map((x) => num(x.p.lineDelta)), null, (d) => (d > 0 ? '↑' + d : d < 0 ? '↓' + -d : '持平'))
  delta.cells.forEach((c, i) => {
    const d = items[i].p.lineDelta
    c.cls = typeof d === 'number' ? (d > 0 ? 'up' : d < 0 ? 'down' : '') : ''
  })
  rows.push(delta)

  const last = desc[0]
  rows.push({ type: 'sec', label: '招生（' + last + ' 年）' })
  rows.push(row('统招计划', items.map((x) => num(yearData(x.full, last).planCount)), 'max'))
  rows.push(row('推免', items.map((x) => num(yearData(x.full, last).exemptCount))))
  rows.push(
    row(
      '推免占比',
      items.map((x) => {
        const d = yearData(x.full, last)
        const plan = num(d.planCount)
        const ex = num(d.exemptCount)
        return plan !== null && ex !== null && plan + ex > 0 ? Math.round((ex * 100) / (plan + ex)) : null
      }),
      'min',
      (v) => v + '%'
    )
  )
  rows.push(row('录取', items.map((x) => num(yearData(x.full, last).admittedCount))))
  rows.push(
    row(
      '复录比',
      items.map((x) => {
        const d = yearData(x.full, last)
        const r = num(d.retestCount)
        const a = num(d.admittedCount)
        return r !== null && a ? Math.round((r / a) * 100) / 100 : null
      }),
      'min',
      (v) => v.toFixed(2)
    )
  )
  return rows
}

module.exports.buildCompareRows = buildCompareRows

/** 倒计时：返回 { title, days, text, note }；date 为 'YYYY-MM-DD' */
function buildCountdown(cd, now) {
  if (!cd || !cd.date) return null
  const parts = cd.date.split('-').map(Number)
  const target = new Date(parts[0], parts[1] - 1, parts[2]) // 本地时间零点，避免时区和 iOS 解析问题
  const n = now || new Date()
  const today = new Date(n.getFullYear(), n.getMonth(), n.getDate())
  const days = Math.round((target - today) / 86400000)
  return {
    title: cd.title,
    date: cd.date,
    days,
    note: cd.note || '',
    ended: days < 0,
    isToday: days === 0
  }
}

/** 资讯日期显示：今年的只显示 月-日 */
function newsDate(date, now) {
  const y = String((now || new Date()).getFullYear())
  return date.indexOf(y + '-') === 0 ? date.slice(5) : date
}

module.exports.buildCountdown = buildCountdown
module.exports.newsDate = newsDate

/** 图片地址：本地调试读代码包里的 mock/images，线上读服务器 /images */
function imgUrl(rel) {
  if (!rel) return ''
  const config = require('../config')
  return config.USE_MOCK ? '/mock/images/' + rel : config.BASE_URL + '/images/' + rel
}

/** 资讯：补上显示用字段（日期、缩略图、正文图片完整地址） */
function decorateNews(n) {
  return Object.assign({}, n, {
    dateText: newsDate(n.date),
    coverUrl: imgUrl(n.cover),
    content: (n.content || []).map((b, i) => Object.assign({ k: i }, b, b.image ? { src: imgUrl(b.image) } : {}))
  })
}

module.exports.imgUrl = imgUrl
module.exports.decorateNews = decorateNews
