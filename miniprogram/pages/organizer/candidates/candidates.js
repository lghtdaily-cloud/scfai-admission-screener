// pages/organizer/candidates/candidates.js
Page({
  data: { all: [], list: [], kw: '' },
  onShow() { this.load() },
  async load() {
    const db = wx.cloud.database()
    const all = await db.collection('candidates').limit(1000).get().catch(() => ({ data: [] }))
    this.setData({ all: all.data, list: all.data })
  },
  onSearch(e) {
    const kw = e.detail.value.trim()
    const list = kw
      ? this.data.all.filter(c =>
          (c.name || '').includes(kw) || (c.studentId || '').includes(kw) || (c.major || '').includes(kw))
      : this.data.all
    this.setData({ kw, list })
  },
  tap(e) {
    wx.navigateTo({ url: '/pages/organizer/candidate/candidate?id=' + e.currentTarget.dataset.id })
  }
})
