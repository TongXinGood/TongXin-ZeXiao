const api = require('../../utils/api')
const { SUBJECTS, defaultAnswers, parseScores, answersToFilters } = require('../../utils/match')
const { passBasic } = require('../../utils/filter')
const { LEVELS, DIRECTIONS } = require('../../utils/dict')

const KEY = 'match_answers'
const STEPS = ['预估成绩', '专业与科目', '院校偏好']

function loadAnswers() {
  const d = defaultAnswers()
  try {
    const saved = wx.getStorageSync(KEY)
    // 旧版问卷没有 scores 字段，直接用默认值
    if (saved && saved.scores) return Object.assign(d, saved, { scores: Object.assign(d.scores, saved.scores) })
  } catch (e) {}
  return d
}

function clone(a) {
  return JSON.parse(JSON.stringify(a))
}

Page({
  data: {
    steps: STEPS,
    step: 0,
    answers: defaultAnswers(),
    subjects: SUBJECTS,
    total: { text: '—', error: '' },
    dirOptions: [],
    levelOptions: LEVELS,
    planOptions: [0, 5, 10, 15, 20, 30],
    provinceCounts: {},
    showTips: false,
    matchCount: 0 // 满足第 2、3 步条件的专业数（不看分数）
  },

  programs: [],

  onLoad() {
    this.update(loadAnswers())
    Promise.all([api.getMeta(), api.getPrograms()])
      .then(([meta, programs]) => {
        this.programs = programs
        this.setData({ provinceCounts: meta.provinceCounts || {} })
        this.update(this.data.answers)
      })
      .catch(() => {})
  },

  /** 所有改动都走这里：重算总分、方向选项、符合条件的专业数，并保存 */
  update(answers) {
    const s = parseScores(answers.scores)
    const filled = SUBJECTS.some((x) => answers.scores[x.key].min !== '')
    const f = answersToFilters(answers)
    this.setData({
      answers,
      total: s.ok
        ? { text: s.totalMin === s.totalMax ? String(s.totalMin) : s.totalMin + ' ~ ' + s.totalMax, error: '' }
        : { text: '—', error: filled ? s.error : '' },
      dirOptions: answers.degree ? DIRECTIONS[answers.degree] : [],
      matchCount: this.programs.filter((p) => passBasic(p, f)).length
    })
    try {
      wx.setStorageSync(KEY, answers)
    } catch (e) {}
  },

  patch(obj) {
    this.update(Object.assign(clone(this.data.answers), obj))
  },

  // ---------- 第 1 步：成绩 ----------
  onScore(e) {
    const { key, end } = e.currentTarget.dataset
    const a = clone(this.data.answers)
    a.scores[key][end] = e.detail.value.replace(/\D/g, '').slice(0, 3)
    this.update(a)
  },

  // ---------- 通用选项 ----------
  onPick(e) {
    const { key, value } = e.currentTarget.dataset
    const obj = { [key]: key === 'minPlan' ? Number(value) : value }
    if (key === 'degree') obj.directions = [] // 换了学硕/专硕，方向清空
    this.patch(obj)
  },

  onMulti(e) {
    const { key, value } = e.currentTarget.dataset
    if (value === '') return this.patch({ [key]: [] }) // 「不限 / 都可以」
    const list = this.data.answers[key].slice()
    const i = list.indexOf(value)
    if (i >= 0) list.splice(i, 1)
    else list.push(value)
    this.patch({ [key]: list })
  },

  onProvinces(e) {
    this.patch({ provinces: e.detail.value })
  },

  toggleTips() {
    this.setData({ showTips: !this.data.showTips })
  },

  // ---------- 翻页 ----------
  prev() {
    this.setData({ step: this.data.step - 1 })
    wx.pageScrollTo({ scrollTop: 0, duration: 0 })
  },

  next() {
    if (this.data.step === 0) {
      const s = parseScores(this.data.answers.scores)
      if (!s.ok) {
        wx.showToast({ title: s.error, icon: 'none' })
        return
      }
    }
    if (this.data.step < STEPS.length - 1) {
      this.setData({ step: this.data.step + 1 })
      wx.pageScrollTo({ scrollTop: 0, duration: 0 })
      return
    }
    if (!this.data.matchCount) {
      wx.showToast({ title: '没有符合条件的专业，请放宽一些条件', icon: 'none' })
      return
    }
    wx.navigateTo({ url: '/pages/match-result/match-result' })
  },

  onReset() {
    wx.showModal({
      title: '重新填写',
      content: '清空所有已填内容？',
      confirmColor: '#3BA7FF',
      success: (res) => {
        if (res.confirm) {
          this.setData({ step: 0 })
          this.update(defaultAnswers())
        }
      }
    })
  }
})
