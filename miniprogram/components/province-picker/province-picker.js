/**
 * 省份多选：按大区分组，每组可「全选」，不选 = 不限
 * 用法：<province-picker value="{{provinces}}" counts="{{meta.provinceCounts}}" bind:change="onProvinces" />
 */
const { REGION_PROVINCES } = require('../../utils/dict')

Component({
  properties: {
    value: { type: Array, value: [] },
    counts: { type: Object, value: {} } // 省份 → 专业数，用来提示哪些省有数据
  },
  data: {
    groups: []
  },
  observers: {
    'value, counts': function (value, counts) {
      this.build(value, counts)
    }
  },
  lifetimes: {
    attached() {
      this.build(this.data.value, this.data.counts)
    }
  },
  methods: {
    build(value, counts) {
      const sel = {}
      ;(value || []).forEach((p) => { sel[p] = true })
      this.setData({
        groups: REGION_PROVINCES.map((g) => ({
          region: g.region,
          all: g.provinces.every((p) => sel[p]),
          items: g.provinces.map((p) => ({ name: p, on: !!sel[p], count: (counts || {})[p] || 0 }))
        }))
      })
    },
    emit(list) {
      this.triggerEvent('change', { value: list })
    },
    onClear() {
      this.emit([])
    },
    onToggle(e) {
      const name = e.currentTarget.dataset.name
      const list = this.data.value.slice()
      const i = list.indexOf(name)
      if (i >= 0) list.splice(i, 1)
      else list.push(name)
      this.emit(list)
    },
    onAll(e) {
      const g = REGION_PROVINCES.filter((x) => x.region === e.currentTarget.dataset.region)[0]
      const group = this.data.groups.filter((x) => x.region === g.region)[0]
      let list = this.data.value.filter((p) => g.provinces.indexOf(p) < 0)
      if (!group.all) list = list.concat(g.provinces)
      this.emit(list)
    }
  }
})
