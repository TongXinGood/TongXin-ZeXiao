const api = require('../../utils/api')
const compare = require('../../utils/compare')
const { defaultFilters, applyFilters } = require('../../utils/filter')
const { DISCLAIMER } = require('../../config')

// 首页快捷入口：点击后带着筛选条件进入院校库
const QUICK = [
  { label: '考 408', filters: { only408: true } },
  { label: '数学二', filters: { math: '数学二' } },
  { label: '专硕', filters: { degree: 'professional' } },
  { label: '学硕', filters: { degree: 'academic' } },
  { label: 'C9 / 985', filters: { levels: ['C9', '985'] } },
  { label: '复试线 ≤ 330', filters: { maxLine: '330' } }
]

Page({
  data: {
    meta: null,
    quick: QUICK.map((q) => ({ label: q.label, count: '' })),
    compareCount: 0,
    disclaimer: DISCLAIMER
  },

  onLoad() {
    Promise.all([api.getMeta(), api.getPrograms()])
      .then(([meta, programs]) => {
        this.setData({
          meta,
          quick: QUICK.map((q) => ({ label: q.label, count: applyFilters(programs, Object.assign(defaultFilters(), q.filters)).length }))
        })
      })
      .catch(() => {})
  },

  onShow() {
    this.setData({ compareCount: compare.getIds().length })
  },

  goLibrary(filters, focus) {
    getApp().globalData.pendingSearch = { filters: filters || {}, focus: !!focus }
    wx.switchTab({ url: '/pages/index/index' })
  },

  onSearch() {
    this.goLibrary({}, true)
  },

  onLibrary() {
    this.goLibrary({})
  },

  onQuick(e) {
    this.goLibrary(QUICK[e.currentTarget.dataset.index].filters)
  },

  onMatch() {
    wx.navigateTo({ url: '/pages/match/match' })
  },

  goCompare() {
    wx.switchTab({ url: '/pages/compare/compare' })
  }
})
