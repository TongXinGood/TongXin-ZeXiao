Component({
  properties: {
    item: { type: Object, value: {} },
    inCompare: { type: Boolean, value: false },
    // 智能择校结果页用：卡片顶部的分档说明，如「稳 · 高出复试线 8 分」
    note: { type: String, value: '' },
    noteClass: { type: String, value: '' }
  },
  methods: {
    onTap() {
      this.triggerEvent('open', { id: this.data.item.id, schoolId: this.data.item.schoolId })
    },
    onCompare() {
      this.triggerEvent('compare', { id: this.data.item.id })
    }
  }
})
