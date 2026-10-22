// pages/organizer/favorite/favorite.js
Page({
  data: { list: [], files: [] },
  onShow() { this.load() },
  async load() {
    const db = wx.cloud.database()
    const all = await db.collection('candidates').where({ favorite: true }).limit(1000).get().catch(() => ({ data: [] }))
    this.setData({ list: all.data, files: [] })
  },
  tap(e) {
    wx.navigateTo({ url: '/pages/organizer/candidate/candidate?id=' + e.currentTarget.dataset.id })
  },
  async exportFav() {
    if (!this.data.list.length) { wx.showToast({ title: '暂无心仪候选者', icon: 'none' }); return }
    wx.showLoading({ title: '生成中' })
    try {
      const res = await wx.cloud.callFunction({ name: 'exportXlsx', data: { scope: 'favorite' } })
      wx.hideLoading()
      if (res.result && res.result.ok) {
        this.setData({ files: res.result.files })
        wx.showToast({ title: '已生成' })
      } else {
        wx.showToast({ title: '导出失败', icon: 'none' })
      }
    } catch (e) {
      wx.hideLoading()
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
