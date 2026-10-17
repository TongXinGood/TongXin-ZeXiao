const api = require('../../utils/api')
const compare = require('../../utils/compare')
const { buildDetail, LEVEL_CLASS, imgUrl } = require('../../utils/format')
const { DISCLAIMER, MAX_COMPARE } = require('../../config')


Page({
  data: {
    loading: true,
    error: '',
    school: null,
    tabs: [],      // 本校所有专业，用于切换
    current: null, // 当前专业（已加工）
    review: null,  // 院校评价（学校级，切换专业不变）
    inCompare: false,
    compareCount: 0,
    disclaimer: DISCLAIMER
  },

  programs: [],
  query: {},

  onLoad(query) {
    this.query = query
    this.load()
  },

  onShow() {
    this.syncCompare()
  },

  load() {
    this.setData({ loading: true, error: '' })
    api
      .getSchoolDetail(this.query.schoolId)
      .then((d) => {
        this.programs = d.programs || []
        const school = Object.assign({}, d.school, {
          levelClass: LEVEL_CLASS[d.school.level] || 'lv-sf',
          otherTags: (d.school.tags || []).filter((t) => t !== d.school.level)
        })
        const tabs = this.programs.map((p) => ({
          id: p.id,
          label: p.majorCode + ' ' + p.majorName,
          sub: p.degreeType === 'academic' ? '学硕' : '专硕'
        }))
        wx.setNavigationBarTitle({ title: school.name })
        const r = d.review
        const review = r
          ? Object.assign({}, r, { photos: r.photos.map((ph) => Object.assign({}, ph, { src: imgUrl(ph.image) })) })
          : null
        this.setData({ loading: false, school, tabs, review })
        this.select(this.query.id)
      })
      .catch((e) => {
        this.setData({ loading: false, error: e.message || '加载失败' })
      })
  },

  select(id) {
    const p = this.programs.find((x) => x.id === id) || this.programs[0]
    if (!p) return
    this.setData({ current: buildDetail(p) })
    this.syncCompare()
  },

  onTab(e) {
    this.select(e.currentTarget.dataset.id)
  },

  syncCompare() {
    const ids = compare.getIds()
    const cur = this.data.current
    this.setData({ inCompare: !!cur && ids.indexOf(cur.id) >= 0, compareCount: ids.length })
  },

  onCompare() {
    const res = compare.toggle(this.data.current.id)
    if (res.full) {
      wx.showToast({ title: `最多对比 ${MAX_COMPARE} 个专业`, icon: 'none' })
      return
    }
    wx.showToast({ title: res.added ? '已加入对比' : '已移出对比', icon: 'none' })
    this.syncCompare()
  },

  // 点照片放大，可左右滑动看全部照片
  previewPhoto(e) {
    wx.previewImage({
      current: e.currentTarget.dataset.src,
      urls: this.data.review.photos.map((ph) => ph.src)
    })
  },

  goCompare() {
    wx.switchTab({ url: '/pages/compare/compare' })
  },

  // 小程序里不能直接打开外部网页，复制链接到浏览器打开
  copyLink(e) {
    const url = e.currentTarget.dataset.url
    if (!url) return
    wx.setClipboardData({
      data: url,
      success: () => wx.showToast({ title: '链接已复制，请在浏览器打开', icon: 'none' })
    })
  },

  retry() {
    this.load()
  }
})
