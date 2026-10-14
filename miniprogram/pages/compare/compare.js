const api = require('../../utils/api')
const compare = require('../../utils/compare')
const { buildCompareRows } = require('../../utils/format')
const { DISCLAIMER, MAX_COMPARE } = require('../../config')

const LEVEL_CLASS = { C9: 'lv-c9', '985': 'lv-985', '211': 'lv-211', '双一流': 'lv-syl', '双非': 'lv-sf' }
const LABEL_W = 150 // 左侧标题列宽度（rpx）
const AVAILABLE_W = 750 - 48 - LABEL_W // 右侧可用宽度（rpx）

Page({
  data: {
    loading: true,
    error: '',
    cols: [],   // 表头：每个专业一列
    rows: [],
    colWidth: 240,
    labelWidth: LABEL_W,
    max: MAX_COMPARE,
    disclaimer: DISCLAIMER
  },

  onShow() {
    this.load()
  },

  load() {
    const ids = compare.getIds()
    if (!ids.length) {
      this.setData({ loading: false, error: '', cols: [], rows: [] })
      return
    }
    this.setData({ loading: !this.data.cols.length, error: '' })
    Promise.all([api.getMeta(), api.getPrograms()])
      .then(([meta, programs]) => {
        // 数据更新后可能有专业已被删除，顺手清掉
        const list = ids.map((id) => programs.find((p) => p.id === id)).filter(Boolean)
        if (list.length !== ids.length) {
          compare.clear()
          list.forEach((p) => compare.toggle(p.id))
        }
        const schoolIds = list.map((p) => p.schoolId).filter((s, i, arr) => arr.indexOf(s) === i)
        return Promise.all(schoolIds.map((sid) => api.getSchoolDetail(sid))).then((details) => {
          const full = {}
          details.forEach((d) => (d.programs || []).forEach((x) => { full[x.id] = x }))
          const items = list.map((p) => ({ p, full: full[p.id] || { years: [] } }))
          const n = items.length
          this.setData({
            loading: false,
            colWidth: Math.max(180, Math.floor(AVAILABLE_W / Math.max(n, 2))), // 3 个以内一屏放下，4 个时可左右滑动
            cols: items.map(({ p }) => ({
              id: p.id,
              schoolId: p.schoolId,
              schoolName: p.schoolName,
              level: p.level,
              levelClass: LEVEL_CLASS[p.level] || 'lv-sf',
              majorCode: p.majorCode,
              majorName: p.majorName
            })),
            rows: buildCompareRows(items, meta.years || [2024, 2025, 2026])
          })
        })
      })
      .catch((e) => {
        this.setData({ loading: false, error: e.message || '加载失败' })
      })
  },

  onRemove(e) {
    compare.remove(e.currentTarget.dataset.id)
    this.load()
  },

  onClear() {
    wx.showModal({
      title: '清空对比',
      content: '确定移除全部对比专业吗？',
      confirmColor: '#3BA7FF',
      success: (res) => {
        if (res.confirm) {
          compare.clear()
          this.load()
        }
      }
    })
  },

  onOpen(e) {
    const { id, school } = e.currentTarget.dataset
    wx.navigateTo({ url: `/pages/detail/detail?schoolId=${school}&id=${id}` })
  },

  goLibrary() {
    wx.switchTab({ url: '/pages/index/index' })
  },

  retry() {
    this.load()
  }
})
