const api = require('../../utils/api')
const { decorateNews } = require('../../utils/format')

Page({
  data: {
    loading: true,
    error: '',
    item: null
  },

  onLoad(query) {
    this.id = query.id
    this.load()
  },

  load() {
    api
      .getNews()
      .then((n) => {
        const item = (n.items || []).find((x) => x.id === this.id)
        if (!item) throw new Error('这条资讯不存在或已下线')
        this.setData({ loading: false, error: '', item: decorateNews(item) })
      })
      .catch((e) => this.setData({ loading: false, error: e.message || '加载失败' }))
  },

  // 点图片放大，可左右滑动查看本文所有图片
  previewImage(e) {
    const urls = this.data.item.content.filter((b) => b.src).map((b) => b.src)
    wx.previewImage({ current: e.currentTarget.dataset.src, urls })
  },

  goSchool() {
    const sid = this.data.item.schoolId
    if (sid) wx.navigateTo({ url: '/pages/detail/detail?schoolId=' + sid })
  },

  copyLink() {
    const src = this.data.item.source
    if (!src || !src.url) return
    wx.setClipboardData({
      data: src.url,
      success: () => wx.showToast({ title: '链接已复制，请在浏览器打开', icon: 'none' })
    })
  },

  onShareAppMessage() {
    const item = this.data.item
    return item ? { title: item.title, path: '/pages/news-detail/news-detail?id=' + item.id } : {}
  },

  retry() {
    this.setData({ loading: true })
    this.load()
  }
})
