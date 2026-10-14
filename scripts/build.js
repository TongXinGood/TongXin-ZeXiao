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
 *   miniprogram/mock/data.js
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const DATA_DIR = path.join(ROOT, 'data')
const OUT_DIR = path.join(ROOT, 'dist', 'api', 'v1')
const MOCK_FILE = path.join(ROOT, 'miniprogram', 'mock', 'data.js')

const YEARS = [2024, 2025, 2026]
const LEVELS = ['C9', '985', '211', '双一流', '双非']
const REGIONS = ['华北', '东北', '华东', '华中', '华南', '西南', '西北']
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
  if (!REGIONS.includes(s.region)) err(where, `region 必须是 ${REGIONS.join('/')}`)
  if (!s.province) err(where, '缺少 province')
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
    if (!/^\d{6}$/.test(p.majorCode || '')) err(where, 'majorCode 必须是 6 位数字')
    if (!p.majorName) err(where, '缺少 majorName')
    if (!DEGREE_TYPES.includes(p.degreeType)) err(where, 'degreeType 必须是 academic/professional')
    const exam = p.exam || {}
    if (!MATHS.includes(exam.math === undefined ? null : exam.math)) err(where, 'exam.math 必须是 数学一/数学二/null')
    if (!Array.isArray(exam.pro) || exam.pro.length === 0) err(where, 'exam.pro 至少一门专业课')

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
      math: exam.math || null,
      foreign: exam.foreign || null,
      proCodes: (exam.pro || []).map((x) => x.code),
      is408: p.is408,
      lineYear: last ? last.year : null,
      latestLine: last ? last.retestLine.total : null,
      lineDelta: last && prev ? last.retestLine.total - prev.retestLine.total : null,
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

fs.writeFileSync(
  MOCK_FILE,
  '// 由 scripts/build.js 自动生成，请勿手改。仅在 config.js 中 USE_MOCK=true 时使用。\n' +
    'module.exports = ' +
    JSON.stringify({ meta, schools, programs, details }) +
    '\n'
)

const size = (f) => (fs.statSync(f).size / 1024).toFixed(1) + ' KB'
console.log(`构建完成：${meta.schoolCount} 所学校，${meta.programCount} 个专业，版本 ${meta.version}${meta.sample ? '（示例数据）' : ''}`)
console.log(`  programs.json ${size(path.join(OUT_DIR, 'programs.json'))}`)
console.log(`  输出目录 ${path.relative(ROOT, OUT_DIR)}，mock ${path.relative(ROOT, MOCK_FILE)}`)
