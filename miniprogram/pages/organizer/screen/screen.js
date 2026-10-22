// pages/organizer/screen/screen.js
Page({
  data: {
    running: false,
    stats: null,
    fallbackLog: [],
    groups: null,
    hasResult: false,
    resultId: '',
    exportFiles: []
  },
  onShow() { this.loadExisting() },
  async loadExisting() {
    const db = wx.cloud.database()
    const r = await db.collection('screenResult').orderBy('createdAt', 'desc').limit(1).get().catch(() => ({ data: [] }))
    if (r.data.length) this.render(r.data[0])
  },
  render(res) {
    const sr = res.screenResults || []
    this.setData({
      stats: res.stats,
      fallbackLog: res.fallbackLog || [],
      groups: {
        recommend: sr.filter(x => x.tier === '推荐'),
        pending: sr.filter(x => x.tier === '待定'),
        eliminated: sr.filter(x => x.tier === '淘汰')
      },
      hasResult: true,
      resultId: res._id
    })
  },
  async run() {
    this.setData({ running: true })
    wx.showLoading({ title: '筛选中' })
    let res
    try {
      res = await wx.cloud.callFunction({ name: 'screenPipeline', data: {} })
    } catch (e) {
      res = { result: { ok: false, msg: '调用失败' } }
    }
    wx.hideLoading()
    this.setData({ running: false })
    if (res.result && res.result.ok) {
      const sr = res.result.results || []
      this.setData({
        stats: res.result.stats,
        fallbackLog: res.result.fallbackLog || [],
        groups: {
          recommend: sr.filter(x => x.tier === '推荐'),
          pending: sr.filter(x => x.tier === '待定'),
          eliminated: sr.filter(x => x.tier === '淘汰')
        },
        hasResult: true,
        resultId: res.result.resultId
      })
      wx.showToast({ title: '筛选完成' })
    } else {
      wx.showToast({ title: (res.result && res.result.msg) || '筛选失败', icon: 'none' })
    }
  },
  async exportAll() {
    if (!this.data.resultId) { wx.showToast({ title: '请先运行筛选', icon: 'none' }); return }
    wx.showLoading({ title: '生成中' })
    let res
    try {
      res = await wx.cloud.callFunction({ name: 'exportXlsx', data: { resultId: this.data.resultId } })
    } catch (e) {
      res = { result: { ok: false } }
    }
    wx.hideLoading()
    if (res.result && res.result.ok) {
      this.setData({ exportFiles: res.result.files })
      wx.showToast({ title: '已生成 ' + res.result.files.length + ' 个文件' })
    } else {
      wx.showToast({ title: '导出失败', icon: 'none' })
    }
  },
  openFile(e) {
    const fileID = e.currentTarget.dataset.id
    wx.cloud.downloadFile({
      fileID,
      success: (r) => wx.openDocument({ filePath: r.tempFilePath, showMenu: true }),
      fail: () => wx.showToast({ title: '打开失败', icon: 'none' })
    })
  }
})
