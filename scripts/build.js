#!/usr/bin/env node
/**
 * 数据构建脚本：校验 data/ 下的源数据，生成服务器用的 JSON 和小程序本地调试用的 mock。
 *
 * 用法：node scripts/build.js
 * 输出：
 *   dist/api/v1/meta.json
 *   dist/api/v1/schools.json
 *   dist/api/v1/programs.json
 *   dist/api/v1/detail/{schoolId}.json
 *   dist/api/v1/news.json
 *   dist/api/v1/images/...（来自 data/images/）
 *   miniprogram/mock/data.js
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const DATA_DIR = path.join(ROOT, 'data')
const OUT_DIR = path.join(ROOT, 'dist', 'api', 'v1')
const MOCK_FILE = path.join(ROOT, 'miniprogram', 'mock', 'data.js')

const { LEVELS, REGION_PROVINCES, regionOf, DIRECTIONS, directionOf, STUDY_MODES } = require('../miniprogram/utils/dict')

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
    const latest = years[years.length - 1] || {}
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
      latestExempt: isNumOrNull(latest.exemptCount) ? latest.exemptCount : null
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
// 置顶在前，其余按日期倒序
newsItems.sort((a, b) => (b.pinned - a.pinned) || b.date.localeCompare(a.date))
const news = { countdown: newsSrc.countdown || null, items: newsItems }

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

// 图片：服务器用 dist/api/v1/images/，本地调试用 miniprogram/mock/images/
const MOCK_IMG_DIR = path.join(ROOT, 'miniprogram', 'mock', 'images')
fs.rmSync(MOCK_IMG_DIR, { recursive: true, force: true })
if (fs.existsSync(IMG_DIR)) {
  fs.cpSync(IMG_DIR, path.join(OUT_DIR, 'images'), { recursive: true })
  fs.cpSync(IMG_DIR, MOCK_IMG_DIR, { recursive: true })
}

fs.writeFileSync(
  MOCK_FILE,
  '// 由 scripts/build.js 自动生成，请勿手改。仅在 config.js 中 USE_MOCK=true 时使用。\n' +
    'module.exports = ' +
    JSON.stringify({ meta, schools, programs, details, news }) +
    '\n'
)

const size = (f) => (fs.statSync(f).size / 1024).toFixed(1) + ' KB'
console.log(`构建完成：${meta.schoolCount} 所学校，${meta.programCount} 个专业，版本 ${meta.version}${meta.sample ? '（示例数据）' : ''}`)
console.log(`  programs.json ${size(path.join(OUT_DIR, 'programs.json'))}`)
console.log(`  资讯 ${news.items.length} 条${news.countdown ? '，倒计时：' + news.countdown.title + ' ' + news.countdown.date : ''}`)
console.log(`  输出目录 ${path.relative(ROOT, OUT_DIR)}，mock ${path.relative(ROOT, MOCK_FILE)}`)
