#!/usr/bin/env node
/**
 * 智能择校算法测试（纯 Node，不依赖 wx）
 * 用法：先 node scripts/build.js，再 node scripts/test-match.js
 */
const fs = require('fs')
const path = require('path')
const assert = require('assert')

const ROOT = path.resolve(__dirname, '..')
const { defaultAnswers, matchPrograms, tierOf, TIERS, gapText, weakText } = require('../miniprogram/utils/match')

let failed = 0
function check(name, fn) {
  try {
    fn()
    console.log('  ✓ ' + name)
  } catch (e) {
    failed++
    console.log('  ✗ ' + name + '\n      ' + e.message)
  }
}

// ---------- 1. 分档边界（复试线 338，录取最低 340，平均 370）----------
console.log('\n【1】分档边界')
const P = { latestLine: 338, latestAdmitMin: 340, latestAdmitAvg: 370 }
const T = (score, p) => (tierOf(p || P, score) || {}).tier
check('337 低于复试线 → 不推荐', () => assert.strictEqual(T(337), null))
check('338 刚好擦线 → 冲击', () => assert.strictEqual(T(338), 'reach'))
check('345 过了录取最低分但不到 +10 → 冲击', () => assert.strictEqual(T(345), 'reach'))
check('350 = 录取最低分 +10 → 稳妥', () => assert.strictEqual(T(350), 'steady'))
check('370 与平均分持平 → 稳妥', () => assert.strictEqual(T(370), 'steady'))
check('379 不到平均分 +10 → 稳妥', () => assert.strictEqual(T(379), 'steady'))
check('380 = 平均分 +10 → 保底', () => assert.strictEqual(T(380), 'safe'))
check('缺录取最低分时按复试线算：348 → 稳妥', () => assert.strictEqual(T(348, { latestLine: 338, latestAdmitAvg: 370 }), 'steady'))
check('缺录取平均分时最高只到稳妥：420 → 稳妥', () => assert.strictEqual(T(420, { latestLine: 338, latestAdmitMin: 340 }), 'steady'))
check('缺复试线 → 无法判断', () => assert.strictEqual(tierOf({ latestLine: null }, 400), null))

// ---------- 2. programs.json 字段与最近一年数据一致 ----------
console.log('\n【2】dist/api/v1/programs.json 字段检查')
const programs = JSON.parse(fs.readFileSync(path.join(ROOT, 'dist/api/v1/programs.json'), 'utf8'))
check(`${programs.length} 个专业的最近一年复试线 / 录取分 / 复录比与 detail 一致`, () => {
  programs.forEach((p) => {
    const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'dist/api/v1/detail', p.schoolId + '.json'), 'utf8'))
    const full = d.programs.filter((x) => x.id === p.id)[0]
    const ys = full.years.filter((y) => y.retestLine && typeof y.retestLine.total === 'number').sort((a, b) => a.year - b.year)
    const y = ys[ys.length - 1] || {}
    const num = (v) => (typeof v === 'number' ? v : null)
    assert.strictEqual(p.lineYear, y.year || null, p.id)
    assert.strictEqual(p.latestAdmitMin, num(y.admitMin), p.id)
    assert.strictEqual(p.latestAdmitAvg, num(y.admitAvg), p.id)
    const ratio = num(y.retestCount) !== null && num(y.admittedCount) ? Math.round((y.retestCount / y.admittedCount) * 100) / 100 : null
    assert.strictEqual(p.retestRatio, ratio, p.id)
  })
})

// ---------- 3. 三组分数跑匹配 ----------
console.log('\n【3】匹配结果（不加任何筛选条件，学习方式默认全日制）')
const SPLITS = { 330: [65, 65, 100, 100], 360: [70, 70, 110, 110], 390: [75, 75, 120, 120] }
const results = {}
Object.keys(SPLITS).forEach((total) => {
  const a = defaultAnswers()
  const [po, fo, ma, pr] = SPLITS[total]
  a.scores = {
    politics: { min: String(po), max: '' },
    foreign: { min: String(fo), max: '' },
    math: { min: String(ma), max: '' },
    pro: { min: String(pr), max: '' }
  }
  const r = matchPrograms(programs, a)
  results[total] = r
  console.log(`\n总分 ${total}（不推荐 ${r.tooHard} 个，缺复试线 ${r.noLine} 个）`)
  TIERS.slice().reverse().forEach((t) => {
    const list = r.tiers[t.key]
    console.log(`  【${t.label}】${list.length} 个`)
    list.forEach((p) => {
      const name = (p.schoolName + ' ' + p.majorCode + ' ' + p.majorName).padEnd(22, '　')
      const warn = weakText(p)
      const ratio = typeof p.retestRatio === 'number' && p.retestRatio > 1.3 ? '  [复录比 ' + p.retestRatio + ']' : ''
      console.log(`    ${name} ${gapText(p)}${ratio}${warn ? '  ' + warn : ''}`)
    })
  })
})

console.log('\n【4】分档逻辑检查')
check('每个结果都符合所在档的规则', () => {
  Object.keys(results).forEach((total) => {
    const t = results[total].tiers
    t.safe.forEach((p) => assert.ok(p.avg !== null && p.userScore >= p.avg + 10, p.id))
    t.steady.forEach((p) => assert.ok(p.userScore >= p.min + 10 && (p.avg === null || p.userScore < p.avg + 10), p.id))
    t.reach.forEach((p) => assert.ok(p.userScore >= p.line && p.userScore < p.min + 10, p.id))
  })
})
check('分数越高，「保底」的数量不减少', () => {
  assert.ok(results[330].tiers.safe.length <= results[360].tiers.safe.length)
  assert.ok(results[360].tiers.safe.length <= results[390].tiers.safe.length)
})
check('每组：保底 + 稳妥 + 冲击 + 不推荐 + 缺线 = 参与筛选的专业数（全日制）', () => {
  const full = programs.filter((p) => p.studyMode === 'full').length
  Object.keys(results).forEach((total) => {
    const r = results[total]
    const n = r.tiers.safe.length + r.tiers.steady.length + r.tiers.reach.length + r.tooHard + r.noLine
    assert.strictEqual(n, full, '总分 ' + total)
  })
})

console.log(failed ? `\n有 ${failed} 项失败` : '\n全部通过')
process.exit(failed ? 1 : 0)
