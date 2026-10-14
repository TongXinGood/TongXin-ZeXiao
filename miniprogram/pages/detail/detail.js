// 第 3 步实现：详情页
Page({
  data: { schoolId: '', id: '' },
  onLoad(query) {
    this.setData({ schoolId: query.schoolId || '', id: query.id || '' })
  }
})
