// pages/student/status/status.js
Page({
  data: {
    name: '',
    studentId: '',
    result: null,
    notFound: false
  },
  onLoad(q) {
    if (q.name) {
      this.setData({ name: q.name }, () => this.query())
    }
  },
  onInput(e) {
    this.setData({ [e.currentTarget.dataset.key]: e.detail.value })
  },
  async query() {
    const name = this.data.name.trim()
    const sid = this.data.studentId.trim()
    if (!name && !sid) { wx.showToast({ title: '请输入姓名或学号', icon: 'none' }); return }
    wx.showLoading({ title: '查询中' })
    try {
      const db = wx.cloud.database()
      let q = db.collection('candidates')
      if (name) q = q.where({ name })
      if (sid) q = q.where({ studentId: sid })
      const res = await q.limit(10).get()
      wx.hideLoading()
      if (res.data.length) {
        this.setData({ result: res.data[0], notFound: false })
      } else {
        this.setData({ result: null, notFound: true })
      }
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: '查询失败', icon: 'none' })
    }
  }
})
