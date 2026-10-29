#!/usr/bin/env node
/**
 * 智能择校算法测试（纯 Node，不依赖 wx）
 * 用法：先 node scripts/build.js，再 node scripts/test-match.js
 */
const fs = require('fs')
const path = require('path')
const assert = require('assert')

const ROOT = path.resolve(__dirname, '..')
const { lineStats } = require('./line-stats')
const { defaultAnswers, matchPrograms, TIERS, gapText, weakText } = require('../miniprogram/utils/match')

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
const yearsOf = (lines) => lines.map((t, i) => ({ year: 2024 + i, retestLine: t === null ? null : { total: t } }))

// ---------- 1. 预测线与波动 ----------
console.log('\n【1】predLine / lineSigma 计算')
check('复试线 370→380→390 时 predLine 为 395', () => {
  assert.strictEqual(lineStats(yearsOf([370, 380, 390]), 30).predLine, 395)
})
check('只有一年数据时 lineSigma 为 15（名额 ≥ 5）', () => {
  const r = lineStats(yearsOf([null, null, 350]), 20)
  assert.strictEqual(r.lineSigma, 15)
  assert.strictEqual(r.predLine, 350)
})
check('只有一年数据且名额 < 5 时 lineSigma 为 20', () => {
  assert.strictEqual(lineStats(yearsOf([null, null, 350]), 3).lineSigma, 20)
})
check('波动很小时取下限 8', () => {
  assert.strictEqual(lineStats(yearsOf([350, 351, 350]), 30).lineSigma, 8)
})
check('波动大时用标准差：330→360→340 → σ ≈ 15.3', () => {
  assert.strictEqual(lineStats(yearsOf([330, 360, 340]), 30).lineSigma, 15.3)
})
check('跳过为 null 的年份：320→330→null → predLine 335', () => {
  assert.strictEqual(lineStats(yearsOf([320, 330, null]), 30).predLine, 335)
})
check('没有任何复试线 → 都是 null', () => {
  assert.deepStrictEqual(lineStats(yearsOf([null, null, null]), 30), { predLine: null, lineSigma: null })
})

// ---------- 2. programs.json 里的字段与重新计算一致 ----------
console.log('\n【2】dist/api/v1/programs.json 字段检查')
const programs = JSON.parse(fs.readFileSync(path.join(ROOT, 'dist/api/v1/programs.json'), 'utf8'))
check(`${programs.length} 个专业都有 predLine / lineSigma 字段`, () => {
  programs.forEach((p) => {
    assert.ok('predLine' in p && 'lineSigma' in p, p.id + ' 缺字段')
  })
})
check('与 detail 原始数据重新计算的结果一致', () => {
  programs.forEach((p) => {
    const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'dist/api/v1/detail', p.schoolId + '.json'), 'utf8'))
    const full = d.programs.filter((x) => x.id === p.id)[0]
    const r = lineStats(full.years, p.latestPlan)
    assert.deepStrictEqual({ predLine: p.predLine, lineSigma: p.lineSigma }, r, p.id)
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
      console.log(`    ${name} predLine ${p.predLine}  σ ${String(p.lineSigma).padEnd(4)}  k ${p.k.toFixed(2).padStart(5)}  ${gapText(p)}${warn ? '  ' + warn : ''}`)
    })
  })
})

console.log('\n【4】分档逻辑检查')
check('每个结果的 k 都落在所在档的区间内', () => {
  Object.keys(results).forEach((total) => {
    const t = results[total].tiers
    t.safe.forEach((p) => assert.ok(p.k > 1, p.id))
    t.steady.forEach((p) => assert.ok(p.k > 0 && p.k <= 1, p.id))
    t.reach.forEach((p) => assert.ok(p.k > -1 && p.k <= 0, p.id))
  })
})
check('分数越高，「保」的数量不减少', () => {
  assert.ok(results[330].tiers.safe.length <= results[360].tiers.safe.length)
  assert.ok(results[360].tiers.safe.length <= results[390].tiers.safe.length)
})
check('每组：保 + 稳 + 冲 + 不推荐 + 缺线 = 参与筛选的专业数（全日制）', () => {
  const full = programs.filter((p) => p.studyMode === 'full').length
  Object.keys(results).forEach((total) => {
    const r = results[total]
    const n = r.tiers.safe.length + r.tiers.steady.length + r.tiers.reach.length + r.tooHard + r.noLine
    assert.strictEqual(n, full, '总分 ' + total)
  })
})

console.log(failed ? `\n有 ${failed} 项失败` : '\n全部通过')
process.exit(failed ? 1 : 0)
