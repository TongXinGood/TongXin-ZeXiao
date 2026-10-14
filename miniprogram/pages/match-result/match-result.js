const api = require('../../utils/api')
const compare = require('../../utils/compare')
const { decorateProgram } = require('../../utils/format')
const { TIERS, defaultAnswers, matchPrograms, gapText } = require('../../utils/match')
const { MAX_COMPARE, MATCH } = require('../../config')

function toMap(ids) {
  const m = {}
  ids.forEach((id) => { m[id] = true })
  return m
}

function describe(a) {
  const parts = []
  parts.push(a.regions.length ? a.regions.join('、') : '地区不限')
  parts.push(a.degree === 'academic' ? '学硕' : a.degree === 'professional' ? '专硕' : '学硕/专硕')
  parts.push(a.math || '数学不限')
  if (a.only408) parts.push('只看 408')
  return parts.join(' · ')
}

Page({
  data: {
    loading: true,
    error: '',
    score: '',
    condText: '',
    tiers: [],      // [{ key, label, desc, count }]
    active: 'steady',
    list: [],
    noLine: 0,
    tooHard: 0,
    reachMin: -MATCH.REACH_MIN,
    compareMap: {}
  },

  result: null,

  onLoad() {
    let answers = defaultAnswers()
    try {
      answers = Object.assign(answers, wx.getStorageSync('match_answers') || {})
    } catch (e) {}
    this.setData({ score: answers.score, condText: describe(answers) })

    api
      .getPrograms()
      .then((programs) => {
        const r = matchPrograms(programs, answers)
        this.result = r
        const tiers = TIERS.map((t) => Object.assign({}, t, { count: r.tiers[t.key].length }))
        // 默认打开「稳」，没有就打开第一个有结果的档
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
      Object.assign(decorateProgram(p), { note: tier.label + ' · ' + gapText(p.gap), noteClass: key })
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
