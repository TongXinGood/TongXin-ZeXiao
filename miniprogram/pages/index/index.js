const api = require('../../utils/api')
const compare = require('../../utils/compare')
const { decorateProgram } = require('../../utils/format')
const { DISCLAIMER, MAX_COMPARE } = require('../../config')

function toMap(ids) {
  const m = {}
  ids.forEach((id) => { m[id] = true })
  return m
}

Page({
  data: {
    loading: true,
    error: '',
    meta: null,
    list: [],
    compareMap: {},
    compareCount: 0,
    disclaimer: DISCLAIMER
  },

  onLoad() {
    this.load()
  },

  onShow() {
    this.syncCompare()
  },

  onPullDownRefresh() {
    this.load(true).then(() => wx.stopPullDownRefresh())
  },

  load(force) {
    this.setData({ loading: !this.data.list.length, error: '' })
    return Promise.all([api.getMeta(force), api.getPrograms(force)])
      .then(([meta, programs]) => {
        this.setData({
          loading: false,
          meta,
          list: programs.map(decorateProgram)
        })
      })
      .catch((e) => {
        this.setData({ loading: false, error: e.message || '加载失败' })
      })
  },

  syncCompare(ids) {
    ids = ids || compare.getIds()
    this.setData({ compareMap: toMap(ids), compareCount: ids.length })
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
    this.syncCompare(res.ids)
    wx.vibrateShort({ type: 'light' })
  },

  goCompare() {
    wx.switchTab({ url: '/pages/compare/compare' })
  },

  retry() {
    this.load(true)
  }
})
