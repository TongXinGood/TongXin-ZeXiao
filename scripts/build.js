#!/usr/bin/env node
/**
 * 数据构建脚本：校验 data/ 下的源数据，生成服务器用的 JSON 和小程序本地调试用的 mock。
 *
 * 用法：node scripts/build.js          （只生成服务器数据，日常用这个）
 *       node scripts/build.js --mock   （额外生成小程序本地调试数据，不连服务器时用）
 * 输出：
 *   dist/api/v1/meta.json
 *   dist/api/v1/schools.json
 *   dist/api/v1/programs.json
 *   dist/api/v1/detail/{schoolId}.json
 *   dist/api/v1/news.json
 *   dist/api/v1/images/...（来自 data/images/）
 *   miniprogram/mock/data.js（不加 --mock 时是空壳）
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const DATA_DIR = path.join(ROOT, 'data')
const OUT_DIR = path.join(ROOT, 'dist', 'api', 'v1')
const MOCK_FILE = path.join(ROOT, 'miniprogram', 'mock', 'data.js')

const { LEVELS, REGION_PROVINCES, regionOf, DIRECTIONS, directionOf, STUDY_MODES } = require('../miniprogram/utils/dict')
const { lineStats } = require('./line-stats')

const YEARS = [2024, 2025, 2026]
const REGIONS = REGION_PROVINCES.map((g) => g.region)
const DEGREE_TYPES = ['academic', 'professional']
const MATHS = ['数学一', '数学二', null]

const errors = []
const err = (where, msg) => errors.push(`${where}: ${msg}`)

const isNumOrNull = (v) => v === null || (typeof v === 'number' && Number.isFinite(v))
function checkRange(where, name, v, min, max) {
  if (!isNumOrNull(v)) return err(where, `${name} 必须是数字或 null，当前为 ${JSON.stringify(v)}`)
  if (v !== null && (v < min || v > max)) err(where, `${name}=${v} 超出合理范围 [${min}, ${max}]`)
}

function readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (e) {
    err(path.relative(ROOT, file), `JSON 解析失败：${e.message}`)
    return null
  }
}

// ---------- 学校 ----------
const schools = readJSON(path.join(DATA_DIR, 'schools.json')) || []
const schoolMap = {}
schools.forEach((s, i) => {
  const where = `schools.json[${i}] ${s.name || ''}`
  if (!s.id) err(where, '缺少 id（建议用院校代码）')
  if (schoolMap[s.id]) err(where, `id 重复：${s.id}`)
  if (!s.name) err(where, '缺少 name')
  if (!LEVELS.includes(s.level)) err(where, `level 必须是 ${LEVELS.join('/')}`)
  // 大区由省份自动推出，不用手填；手填了就校验是否一致
  const region = regionOf(s.province)
  if (!region) err(where, `province「${s.province || ''}」不是有效省份（写「北京」「江苏」这样，不带省/市字）`)
  else if (s.region && s.region !== region) err(where, `region 应为 ${region}（${s.province} 属于${region}）`)
  s.region = region
  if (!Array.isArray(s.tags)) err(where, 'tags 必须是数组')
  schoolMap[s.id] = s
})

// ---------- 专业 ----------
const detailDir = path.join(DATA_DIR, 'detail')
const detailFiles = fs.readdirSync(detailDir).filter((f) => f.endsWith('.json')).sort()
const details = {}
const programs = []
const programIds = new Set()

detailFiles.forEach((file) => {
  const d = readJSON(path.join(detailDir, file))
  if (!d) return
  const sid = d.schoolId
  const school = schoolMap[sid]
  if (!school) return err(file, `schoolId=${sid} 在 schools.json 中不存在`)
  if (file !== `${sid}.json`) err(file, `文件名应为 ${sid}.json`)

  const progs = d.programs || []
  progs.forEach((p, i) => {
    const where = `${file} programs[${i}] ${p.majorCode || ''} ${p.majorName || ''}`
    if (!p.id) err(where, '缺少 id')
    if (programIds.has(p.id)) err(where, `id 重复：${p.id}`)
    programIds.add(p.id)
    if (!/^[0-9A-Z]{6}$/.test(p.majorCode || '')) err(where, 'majorCode 必须是 6 位（数字或大写字母，如 081200、0812Z1）')
    if (!p.majorName) err(where, '缺少 majorName')
    if (!DEGREE_TYPES.includes(p.degreeType)) err(where, 'degreeType 必须是 academic/professional')
    const exam = p.exam || {}
    if (!MATHS.includes(exam.math === undefined ? null : exam.math)) err(where, 'exam.math 必须是 数学一/数学二/null')
    if (!Array.isArray(exam.pro) || exam.pro.length === 0) err(where, 'exam.pro 至少一门专业课')
    p.studyMode = p.studyMode || 'full'
    if (!STUDY_MODES[p.studyMode]) err(where, 'studyMode 必须是 full（全日制）/ part（非全日制）')
    const direction = directionOf(p)
    const dirOptions = DIRECTIONS[p.degreeType] || []
    if (!direction) err(where, `无法从专业代码判断方向，请加 "direction"，可选：${dirOptions.join('/')}`)
    else if (dirOptions.indexOf(direction) < 0) err(where, `direction「${direction}」不在${p.degreeType === 'academic' ? '学硕' : '专硕'}方向里，可选：${dirOptions.join('/')}`)

    const years = (p.years || []).slice().sort((a, b) => a.year - b.year)
    years.forEach((y) => {
      const yw = `${where} ${y.year}`
      if (!YEARS.includes(y.year)) err(yw, `year 必须是 ${YEARS.join('/')}`)
      if (y.retestLine) {
        checkRange(yw, '总分线', y.retestLine.total, 200, 500)
        ;['politics', 'foreign', 'math', 'pro'].forEach((k) => checkRange(yw, k, y.retestLine[k] === undefined ? null : y.retestLine[k], 0, 150))
      }
      checkRange(yw, 'planCount', y.planCount, 0, 2000)
      checkRange(yw, 'exemptCount', y.exemptCount, 0, 2000)
      checkRange(yw, 'admittedCount', y.admittedCount === undefined ? null : y.admittedCount, 0, 2000)
      checkRange(yw, 'retestCount', y.retestCount === undefined ? null : y.retestCount, 0, 5000)
    })

    p.schoolId = sid
    p.is408 = (exam.pro || []).some((x) => x.code === '408')
    p.years = years

    // 最近一年（有复试线的那年）及与上一年的变化
    const withLine = years.filter((y) => y.retestLine && typeof y.retestLine.total === 'number')
    // 招生人数：取最近一个「有统招计划或推免人数」的年份（没有就用最近一年），卡片上显示「XXXX 统招计划」
    const withCount = years.filter((y) => isNumOrNull(y.planCount) && y.planCount !== null || isNumOrNull(y.exemptCount) && y.exemptCount !== null)
    const latest = withCount[withCount.length - 1] || years[years.length - 1] || {}
    const last = withLine[withLine.length - 1]
    const prev = withLine[withLine.length - 2]
    programs.push({
      id: p.id,
      schoolId: sid,
      schoolName: school.name,
      level: school.level,
      tags: school.tags,
      region: school.region,
      province: school.province,
      city: school.city,
      college: p.college || '',
      majorCode: p.majorCode,
      majorName: p.majorName,
      degreeType: p.degreeType,
      direction,
      studyMode: p.studyMode,
      math: exam.math || null,
      foreign: exam.foreign || null,
      proCodes: (exam.pro || []).map((x) => x.code),
      is408: p.is408,
      lineYear: last ? last.year : null,
      latestLine: last ? last.retestLine.total : null,
      lineDelta: last && prev ? last.retestLine.total - prev.retestLine.total : null,
      // 最近一年的单科线，智能择校做单科检查用
      lineSingles: last
        ? {
            politics: isNumOrNull(last.retestLine.politics) ? last.retestLine.politics : null,
            foreign: isNumOrNull(last.retestLine.foreign) ? last.retestLine.foreign : null,
            math: isNumOrNull(last.retestLine.math) ? last.retestLine.math : null,
            pro: isNumOrNull(last.retestLine.pro) ? last.retestLine.pro : null
          }
        : null,
      planYear: latest.year || null,
      latestPlan: isNumOrNull(latest.planCount) ? latest.planCount : null,
      latestExempt: isNumOrNull(latest.exemptCount) ? latest.exemptCount : null,
      // 智能择校用：预测线、历年波动（算法见 scripts/line-stats.js）
      ...lineStats(years, isNumOrNull(latest.planCount) ? latest.planCount : null)
    })
  })
  details[sid] = { school, programs: progs }
})

Object.keys(schoolMap).forEach((sid) => {
  if (!details[sid]) console.warn(`提示：学校 ${schoolMap[sid].name}(${sid}) 还没有专业数据`)
})

// ---------- 资讯 ----------
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const newsSrc = readJSON(path.join(DATA_DIR, 'news.json')) || { items: [] }
const cd = newsSrc.countdown || {}
if (newsSrc.countdown) {
  if (!cd.title) err('news.json countdown', '缺少 title')
  if (!DATE_RE.test(cd.date || '')) err('news.json countdown', 'date 必须是 YYYY-MM-DD')
}
const IMG_DIR = path.join(DATA_DIR, 'images')
const IMG_MAX_KB = 500
function checkImage(where, rel) {
  if (!/^[\w\-./]+\.(jpg|jpeg|png|webp)$/i.test(rel) || rel.indexOf('..') >= 0) {
    return err(where, `图片路径 ${rel} 只能用英文、数字、- _ /，后缀 jpg/png/webp`)
  }
  const f = path.join(IMG_DIR, rel)
  if (!fs.existsSync(f)) return err(where, `图片不存在：data/images/${rel}`)
  const kb = fs.statSync(f).size / 1024
  if (kb > IMG_MAX_KB) err(where, `图片 ${rel} 有 ${kb.toFixed(0)} KB，请压缩到 ${IMG_MAX_KB} KB 以内`)
}
const newsIds = new Set()
const newsItems = (newsSrc.items || []).map((n, i) => {
  const where = `news.json items[${i}] ${n.title || ''}`
  if (!n.id) err(where, '缺少 id')
  if (newsIds.has(n.id)) err(where, `id 重复：${n.id}`)
  newsIds.add(n.id)
  if (!n.title) err(where, '缺少 title')
  if (!DATE_RE.test(n.date || '')) err(where, 'date 必须是 YYYY-MM-DD')
  if (n.schoolId && !schoolMap[n.schoolId]) err(where, `schoolId=${n.schoolId} 在 schools.json 中不存在`)
  // 正文：字符串 = 一段文字；{ image, caption } = 一张图片（路径相对 data/images/）
  const raw = Array.isArray(n.content) ? n.content : n.content ? [String(n.content)] : []
  if (!raw.length) err(where, 'content 至少一段')
  const content = raw.map((b, j) => {
    if (typeof b === 'string') return { text: b }
    if (b && b.image) {
      checkImage(`${where} content[${j}]`, b.image)
      return { image: b.image, caption: b.caption || '' }
    }
    err(`${where} content[${j}]`, '必须是文字，或 { "image": "news/xxx.jpg", "caption": "说明" }')
    return { text: '' }
  })
  // 列表缩略图：优先用 cover，否则用正文第一张图
  const firstImg = content.filter((b) => b.image)[0]
  if (n.cover) checkImage(`${where} cover`, n.cover)
  const firstText = content.filter((b) => b.text)[0]
  return {
    id: n.id,
    title: n.title,
    summary: n.summary || (firstText ? firstText.text : ''),
    cover: n.cover || (firstImg ? firstImg.image : ''),
    date: n.date,
    pinned: !!n.pinned,
    content,
    schoolId: n.schoolId || '',
    schoolName: n.schoolId && schoolMap[n.schoolId] ? schoolMap[n.schoolId].name : '',
    source: n.source && n.source.title ? n.source : null
  }
})
// ---------- 院校评价（data/reviews/{schoolId}.json，挂到学校详情上） ----------
const REVIEW_DIR = path.join(DATA_DIR, 'reviews')
const reviewFiles = fs.existsSync(REVIEW_DIR) ? fs.readdirSync(REVIEW_DIR).filter((f) => f.endsWith('.json')).sort() : []
reviewFiles.forEach((file) => {
  const r = readJSON(path.join(REVIEW_DIR, file))
  if (!r) return
  const where = `reviews/${file}`
  const sid = r.schoolId
  if (!details[sid]) return err(where, `schoolId=${sid} 没有对应的学校或专业数据`)
  if (file !== `${sid}.json`) err(where, `文件名应为 ${sid}.json`)
  const editor = Array.isArray(r.editor) ? r.editor.filter(Boolean) : r.editor ? [String(r.editor)] : []
  const photos = (r.photos || []).map((ph, i) => {
    if (!ph || !ph.image) {
      err(`${where} photos[${i}]`, '缺少 image')
      return null
    }
    checkImage(`${where} photos[${i}]`, ph.image)
    return { image: ph.image, caption: ph.caption || '' }
  }).filter(Boolean)
  const comments = (r.comments || []).map((c, i) => {
    if (!c || !c.text) {
      err(`${where} comments[${i}]`, '缺少 text')
      return null
    }
    return { text: c.text, author: c.author || '网友', source: c.source || '', date: c.date || '' }
  }).filter(Boolean)
  if (!editor.length && !photos.length && !comments.length) return err(where, '编辑点评、照片、网友评价至少要有一项')
  details[sid].review = { editor, photos, comments, updatedAt: r.updatedAt || '' }
})

// 置顶在前，其余按日期倒序
newsItems.sort((a, b) => (b.pinned - a.pinned) || b.date.localeCompare(a.date))
const news = { countdown: newsSrc.countdown || null, items: newsItems }

// ---------- 待补充清单（null = 还没收集到） ----------
const FIELD_LABELS = [
  ['retestLine', '复试线'],
  ['planCount', '统招计划'],
  ['exemptCount', '推免人数'],
  ['admittedCount', '录取人数'],
  ['retestCount', '复试人数']
]
// 把 [2024, 2025, 2026] 压缩成「2024–2026」，[2024, 2026] 写成「2024、2026」
function yearText(ys) {
  if (ys.length > 1 && ys[ys.length - 1] - ys[0] === ys.length - 1) return ys[0] + '–' + ys[ys.length - 1]
  return ys.join('、')
}
const missing = []
Object.keys(details).forEach((sid) => {
  details[sid].programs.forEach((p) => {
    const lack = {} // 项目名 → [年份]
    const add = (label, y) => (lack[label] = lack[label] || []).push(y)
    YEARS.forEach((year) => {
      const y = p.years.filter((x) => x.year === year)[0]
      if (!y) return add('整年数据', year)
      FIELD_LABELS.forEach(([k, label]) => {
        if (y[k] === null || y[k] === undefined) add(label, year)
      })
      if (y.retestLine && ['politics', 'foreign', 'math', 'pro'].some((k) => typeof y.retestLine[k] !== 'number')) add('单科线', year)
    })
    const items = Object.keys(lack).map((label) => yearText(lack[label]) + ' ' + label)
    if (items.length) missing.push(`${details[sid].school.name} ${p.majorCode} ${p.majorName}${p.studyMode === 'part' ? '（非全）' : ''}：${items.join('、')}`)
  })
})

if (errors.length) {
  console.error(`\n数据校验失败，共 ${errors.length} 处：`)
  errors.forEach((e) => console.error('  - ' + e))
  process.exit(1)
}

// 排序：层次 → 学校代码 → 专业代码
const levelRank = (l) => LEVELS.indexOf(l)
programs.sort((a, b) => levelRank(a.level) - levelRank(b.level) || a.schoolId.localeCompare(b.schoolId) || a.majorCode.localeCompare(b.majorCode))

const now = new Date()
const pad = (n) => String(n).padStart(2, '0')
const meta = {
  version: `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`,
  updatedAt: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
  sample: fs.existsSync(path.join(DATA_DIR, 'SAMPLE')),
  years: YEARS,
  levels: LEVELS,
  regions: REGIONS.filter((r) => schools.some((s) => s.region === r)),
  // 各省专业数，问卷和筛选里显示在省份旁边
  provinceCounts: programs.reduce((m, p) => {
    m[p.province] = (m[p.province] || 0) + 1
    return m
  }, {}),
  schoolCount: Object.keys(details).length,
  programCount: programs.length,
  disclaimer: '数据仅供参考，以研招网和院校官网为准'
}

// ---------- 输出 ----------
fs.rmSync(OUT_DIR, { recursive: true, force: true })
fs.mkdirSync(path.join(OUT_DIR, 'detail'), { recursive: true })
const write = (file, obj) => fs.writeFileSync(file, JSON.stringify(obj))
write(path.join(OUT_DIR, 'meta.json'), meta)
write(path.join(OUT_DIR, 'schools.json'), schools)
write(path.join(OUT_DIR, 'programs.json'), programs)
Object.keys(details).forEach((sid) => write(path.join(OUT_DIR, 'detail', `${sid}.json`), details[sid]))
write(path.join(OUT_DIR, 'news.json'), news)

// 图片：服务器用 dist/api/v1/images/
if (fs.existsSync(IMG_DIR)) fs.cpSync(IMG_DIR, path.join(OUT_DIR, 'images'), { recursive: true })

// 本地调试数据：只有加 --mock 才生成完整数据；否则写一个空壳，发布包里不带示例数据和图片
const WITH_MOCK = process.argv.indexOf('--mock') >= 0
const MOCK_IMG_DIR = path.join(ROOT, 'miniprogram', 'mock', 'images')
fs.rmSync(MOCK_IMG_DIR, { recursive: true, force: true })
if (WITH_MOCK && fs.existsSync(IMG_DIR)) fs.cpSync(IMG_DIR, MOCK_IMG_DIR, { recursive: true })
fs.writeFileSync(
  MOCK_FILE,
  '// 由 scripts/build.js 自动生成，请勿手改。仅在 config.js 中 USE_MOCK=true 时使用。\n' +
    (WITH_MOCK
      ? 'module.exports = ' + JSON.stringify({ meta, schools, programs, details, news }) + '\n'
      : '// 当前未生成本地数据（运行 node scripts/build.js --mock 可生成）\nmodule.exports = null\n')
)

const size = (f) => (fs.statSync(f).size / 1024).toFixed(1) + ' KB'
console.log(`构建完成：${meta.schoolCount} 所学校，${meta.programCount} 个专业，版本 ${meta.version}${meta.sample ? '（示例数据）' : ''}`)
console.log(`  programs.json ${size(path.join(OUT_DIR, 'programs.json'))}`)
console.log(`  院校评价 ${Object.keys(details).filter((sid) => details[sid].review).length} 所`)
console.log(`  资讯 ${news.items.length} 条${news.countdown ? '，倒计时：' + news.countdown.title + ' ' + news.countdown.date : ''}`)
console.log(`  输出目录 ${path.relative(ROOT, OUT_DIR)}${WITH_MOCK ? '，本地调试数据 ' + path.relative(ROOT, MOCK_FILE) : '（未生成本地调试数据）'}`)

const MISSING_FILE = path.join(DATA_DIR, 'MISSING.txt')
if (missing.length) {
  fs.writeFileSync(MISSING_FILE, `待补充清单（${meta.updatedAt} 生成，共 ${missing.length} 个专业有缺项）\n\n` + missing.join('\n') + '\n')
  const SHOW = 10
  console.log(`\n待补充：${missing.length} 个专业有缺项${missing.length > SHOW ? `（下面列前 ${SHOW} 个）` : ''}`)
  missing.slice(0, SHOW).forEach((m) => console.log('  ' + m))
  console.log(`  完整清单：${path.relative(ROOT, MISSING_FILE)}`)
} else {
  fs.rmSync(MISSING_FILE, { force: true })
  console.log('\n数据完整，没有待补充项')
}
