Component({
  properties: {
    item: { type: Object, value: {} },
    inCompare: { type: Boolean, value: false }
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
