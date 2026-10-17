Component({
  properties: {
    item: { type: Object, value: {} }
  },
  methods: {
    onTap() {
      this.triggerEvent('open', { id: this.data.item.id })
    }
  }
})
