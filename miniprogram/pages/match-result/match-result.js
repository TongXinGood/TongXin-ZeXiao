const api = require('../../utils/api')
const compare = require('../../utils/compare')
const { decorateProgram } = require('../../utils/format')
const { TIERS, defaultAnswers, matchPrograms, gapText, weakText } = require('../../utils/match')
const { MAX_COMPARE } = require('../../config')
const { STUDY_MODES } = require('../../utils/dict')

function toMap(ids) {
  const m = {}
  ids.forEach((id) => { m[id] = true })
  return m
}

function short(list, max) {
  return list.length > max ? list.slice(0, max).join('、') + ' 等 ' + list.length + ' 个' : list.join('、')
}

/** 条件摘要，如「专硕（计算机技术）· 英语二 · 数学二 · 408 · 全日制 · 江苏、浙江」 */
function describe(a) {
  const parts = []
  let degree = a.degree === 'academic' ? '学硕' : a.degree === 'professional' ? '专硕' : '学硕/专硕'
  if (a.degree && a.directions.length) degree += '（' + short(a.directions, 2) + '）'
  parts.push(degree)
  if (a.foreign) parts.push(a.foreign)
  if (a.math) parts.push(a.math)
  if (a.proType) parts.push(a.proType === '408' ? '408' : '自命题')
  parts.push(STUDY_MODES[a.studyMode] || '全日制')
  if (a.minPlan) parts.push('招生 ≥ ' + a.minPlan + ' 人')
  if (a.levels.length) parts.push(a.levels.join('/'))
  parts.push(a.provinces.length ? short(a.provinces, 3) : '省份不限')
  return parts.join(' · ')
}

Page({
  data: {
    loading: true,
    error: '',
    scoreText: '',
    condText: '',
    tiers: [],      // [{ key, label, desc, count }]
    active: 'steady',
    list: [],
    noLine: 0,
    tooHard: 0,
    compareMap: {}
  },

  result: null,

  onLoad() {
    let answers = defaultAnswers()
    try {
      answers = Object.assign(answers, wx.getStorageSync('match_answers') || {})
    } catch (e) {}
    this.setData({ condText: describe(answers) })

    api
      .getPrograms()
      .then((programs) => {
        const r = matchPrograms(programs, answers)
        if (!r.score.ok) throw new Error(r.score.error)
        this.result = r
        const sc = r.score
        this.setData({ scoreText: sc.totalMin === sc.totalMax ? String(sc.totalMin) : sc.totalMin + ' ~ ' + sc.totalMax })
        const tiers = TIERS.map((t) => Object.assign({}, t, { count: r.tiers[t.key].length }))
        // 默认打开「稳妥」，没有就打开第一个有结果的档
        const first = tiers.filter((t) => t.count)[0]
        const active = r.tiers.steady.length ? 'steady' : first ? first.key : 'steady'
        this.setData({ loading: false, tiers, noLine: r.noLine, tooHard: r.tooHard })
        this.show(active)
      })
      .catch((e) => this.setData({ loading: false, error: e.message || '加载失败' }))
  },

  onShow() {
    this.setData({ compareMap: toMap(compare.getIds()) })
  },

  show(key) {
    const tier = TIERS.find((t) => t.key === key)
    const list = this.result.tiers[key].map((p) =>
      Object.assign(decorateProgram(p), { note: tier.label + ' · ' + gapText(p), noteClass: key, warn: weakText(p) })
    )
    this.setData({ active: key, list })
    wx.pageScrollTo({ scrollTop: 0, duration: 0 })
  },

  onTier(e) {
    this.show(e.currentTarget.dataset.key)
  },

  onEdit() {
    wx.navigateBack()
  },

  onOpen(e) {
    const { id, schoolId } = e.detail
    wx.navigateTo({ url: `/pages/detail/detail?schoolId=${schoolId}&id=${id}` })
  },

  onCompare(e) {
    const res = compare.toggle(e.detail.id)
    if (res.full) {
      wx.showToast({ title: `最多对比 ${MAX_COMPARE} 个专业`, icon: 'none' })
      return
    }
    this.setData({ compareMap: toMap(res.ids) })
  },

  goCompare() {
    wx.switchTab({ url: '/pages/compare/compare' })
  }
})
