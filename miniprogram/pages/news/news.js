const api = require('../../utils/api')
const { decorateNews } = require('../../utils/format')
const { DISCLAIMER } = require('../../config')

Page({
  data: {
    loading: true,
    error: '',
    list: [],
    disclaimer: DISCLAIMER
  },

  onLoad() {
    this.load()
  },

  onPullDownRefresh() {
    this.load(true).then(() => wx.stopPullDownRefresh())
  },

  load(force) {
    return api
      .getNews(force)
      .then((n) => {
        const list = (n.items || []).map(decorateNews)
        this.setData({ loading: false, error: '', list })
      })
      .catch((e) => this.setData({ loading: false, error: e.message || '加载失败' }))
  },

  onOpen(e) {
    wx.navigateTo({ url: '/pages/news-detail/news-detail?id=' + e.detail.id })
  },

  retry() {
    this.setData({ loading: true })
    this.load(true)
  }
})
