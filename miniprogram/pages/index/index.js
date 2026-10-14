const api = require('../../utils/api')
const compare = require('../../utils/compare')
const { decorateProgram } = require('../../utils/format')
const { defaultFilters, applyFilters, countActive } = require('../../utils/filter')
const { DISCLAIMER, MAX_COMPARE } = require('../../config')

const SORTS = [
  { key: 'default', label: '默认排序' },
  { key: 'lineAsc', label: '复试线从低到高' },
  { key: 'planDesc', label: '招生人数从多到少' }
]

function toMap(ids) {
  const m = {}
  ids.forEach((id) => { m[id] = true })
  return m
}

function clone(f) {
  return Object.assign({}, f, { regions: f.regions.slice(), levels: f.levels.slice() })
}

Page({
  data: {
    loading: true,
    error: '',
    meta: null,
    list: [],
    total: 0,
    filters: defaultFilters(),
    activeCount: 0,
    sortLabel: SORTS[0].label,
    focus: false,
    // 筛选面板
    showPanel: false,
    draft: defaultFilters(),
    draftCount: 0,
    customLine: '', // 自定义复试线输入框的内容
    regionOptions: [],
    levelOptions: ['C9', '985', '211', '双一流', '双非'],
    linePresets: [300, 330, 350, 370, 390],
    compareMap: {},
    compareCount: 0,
    disclaimer: DISCLAIMER
  },

  allList: [],

  onLoad() {
    this.load()
  },

  onShow() {
    this.syncCompare()
    this.consumePending()
  },

  onPullDownRefresh() {
    this.load(true).then(() => wx.stopPullDownRefresh())
  },

  load(force) {
    this.setData({ loading: !this.allList.length, error: '' })
    return Promise.all([api.getMeta(force), api.getPrograms(force)])
      .then(([meta, programs]) => {
        this.allList = programs.map(decorateProgram)
        this.setData({ loading: false, meta, regionOptions: meta.regions || [], total: this.allList.length })
        this.refresh()
      })
      .catch((e) => {
        this.setData({ loading: false, error: e.message || '加载失败' })
      })
  },

  /** 首页跳过来时带的筛选条件 / 聚焦搜索 */
  consumePending() {
    const app = getApp()
    const pending = app.globalData.pendingSearch
    if (!pending) return
    app.globalData.pendingSearch = null
    const filters = Object.assign(defaultFilters(), pending.filters || {})
    this.setData({ filters, focus: !!pending.focus })
    this.refresh()
  },

  refresh() {
    const f = this.data.filters
    const sort = SORTS.find((s) => s.key === f.sort) || SORTS[0]
    this.setData({
      list: applyFilters(this.allList, f),
      activeCount: countActive(f),
      sortLabel: sort.label
    })
  },

  setFilters(patch) {
    this.setData({ filters: Object.assign({}, this.data.filters, patch) })
    this.refresh()
  },

  // ---------- 搜索 ----------
  onInput(e) {
    clearTimeout(this.inputTimer)
    const keyword = e.detail.value
    this.inputTimer = setTimeout(() => this.setFilters({ keyword }), 250)
  },
  onClearKeyword() {
    this.setFilters({ keyword: '' })
  },
  onBlur() {
    this.setData({ focus: false })
  },

  // ---------- 快捷标签 ----------
  onQuick(e) {
    const { key, value } = e.currentTarget.dataset
    const f = this.data.filters
    if (key === 'only408') this.setFilters({ only408: !f.only408 })
    else this.setFilters({ [key]: f[key] === value ? '' : value })
  },

  onSort() {
    wx.showActionSheet({
      itemList: SORTS.map((s) => s.label),
      success: (res) => this.setFilters({ sort: SORTS[res.tapIndex].key })
    })
  },

  // ---------- 筛选面板 ----------
  openPanel() {
    const draft = clone(this.data.filters)
    const isPreset = this.data.linePresets.indexOf(Number(draft.maxLine)) >= 0
    this.setData({
      showPanel: true,
      draft,
      draftCount: applyFilters(this.allList, draft).length,
      customLine: isPreset ? '' : draft.maxLine
    })
  },
  closePanel() {
    this.setData({ showPanel: false })
  },
  setDraft(draft) {
    this.setData({ draft, draftCount: applyFilters(this.allList, draft).length })
  },
  onToggleMulti(e) {
    const { key, value } = e.currentTarget.dataset
    const draft = clone(this.data.draft)
    const arr = draft[key]
    const i = arr.indexOf(value)
    if (i >= 0) arr.splice(i, 1)
    else arr.push(value)
    this.setDraft(draft)
  },
  onPickSingle(e) {
    const { key, value } = e.currentTarget.dataset
    const draft = clone(this.data.draft)
    draft[key] = draft[key] === value ? '' : value
    this.setDraft(draft)
  },
  onToggle408() {
    const draft = clone(this.data.draft)
    draft.only408 = !draft.only408
    this.setDraft(draft)
  },
  onPickLine(e) {
    const draft = clone(this.data.draft)
    const v = String(e.currentTarget.dataset.value)
    draft.maxLine = draft.maxLine === v && !this.data.customLine ? '' : v
    this.setData({ customLine: '' })
    this.setDraft(draft)
  },
  onLineInput(e) {
    const draft = clone(this.data.draft)
    const v = e.detail.value.replace(/\D/g, '').slice(0, 3)
    draft.maxLine = v
    this.setData({ customLine: v })
    this.setDraft(draft)
  },
  onResetDraft() {
    const draft = defaultFilters()
    draft.keyword = this.data.filters.keyword
    draft.sort = this.data.filters.sort
    this.setData({ customLine: '' })
    this.setDraft(draft)
  },
  onConfirmPanel() {
    this.setData({ filters: clone(this.data.draft), showPanel: false })
    this.refresh()
  },
  onClearAll() {
    this.setData({ filters: defaultFilters() })
    this.refresh()
  },
  noop() {},

  // ---------- 卡片 / 对比 ----------
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
