const api = require('../../utils/api')
const { defaultAnswers } = require('../../utils/match')

const KEY = 'match_answers'

function loadAnswers() {
  try {
    return Object.assign(defaultAnswers(), wx.getStorageSync(KEY) || {})
  } catch (e) {
    return defaultAnswers()
  }
}

Page({
  data: {
    answers: defaultAnswers(),
    regionOptions: [],
    valid: false
  },

  onLoad() {
    this.setAnswers(loadAnswers())
    api
      .getMeta()
      .then((meta) => this.setData({ regionOptions: meta.regions || [] }))
      .catch(() => {})
  },

  setAnswers(answers) {
    const s = Number(answers.score)
    this.setData({ answers, valid: answers.score !== '' && s >= 200 && s <= 500 })
  },

  patch(obj) {
    this.setAnswers(Object.assign({}, this.data.answers, obj))
  },

  onScore(e) {
    this.patch({ score: e.detail.value.replace(/\D/g, '').slice(0, 3) })
  },

  onRegion(e) {
    const v = e.currentTarget.dataset.value
    if (!v) return this.patch({ regions: [] }) // 不限
    const regions = this.data.answers.regions.slice()
    const i = regions.indexOf(v)
    if (i >= 0) regions.splice(i, 1)
    else regions.push(v)
    this.patch({ regions })
  },

  onPick(e) {
    const { key, value } = e.currentTarget.dataset
    this.patch({ [key]: key === 'only408' ? value === 'yes' : value })
  },

  onSubmit() {
    if (!this.data.valid) {
      wx.showToast({ title: '请填写 200–500 之间的预估总分', icon: 'none' })
      return
    }
    try {
      wx.setStorageSync(KEY, this.data.answers)
    } catch (e) {}
    wx.navigateTo({ url: '/pages/match-result/match-result' })
  }
})
