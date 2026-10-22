// pages/organizer/candidate/candidate.js
const formFields = require('../../../utils/formFields.js')
const { maskPhone, maskEmail } = require('../../../utils/mask.js')

Page({
  data: {
    id: '',
    c: null,
    fileTypes: formFields.FILE_TYPES,
    fileList: []
  },
  onLoad(q) {
    this.setData({ id: q.id })
    this.load()
  },
  async load() {
    const db = wx.cloud.database()
    const r = await db.collection('candidates').doc(this.data.id).get()
    const c = r.data
    const fileList = this.data.fileTypes.map(t => ({
      key: t.key,
      label: t.label,
      fileID: (c.files && c.files[t.key]) || '',
      isOnline: t.key === 'form' && c.files && c.files.form === 'online'
    }))
    this.setData({
      c,
      fileList,
      maskedPhone: maskPhone(c.phone),
      maskedEmail: maskEmail(c.email)
    })
  },
  async toggleFav() {
    const db = wx.cloud.database()
    const fav = !this.data.c.favorite
    await db.collection('candidates').doc(this.data.id).update({ data: { favorite: fav } })
    this.setData({ 'c.favorite': fav })
    wx.showToast({ title: fav ? '已标记心仪' : '已取消' })
  },
  openFile(e) {
    const fileID = e.currentTarget.dataset.id
    if (!fileID) { wx.showToast({ title: '无材料', icon: 'none' }); return }
    if (fileID === 'online') { wx.showToast({ title: '在线填写的报名表', icon: 'none' }); return }
    wx.showLoading({ title: '打开中' })
    wx.cloud.downloadFile({
      fileID,
      success: (res) => {
        wx.openDocument({
          filePath: res.tempFilePath,
          showMenu: true,
          fail: () => wx.showToast({ title: '无法预览该格式', icon: 'none' }),
          complete: () => wx.hideLoading()
        })
      },
      fail: () => { wx.hideLoading(); wx.showToast({ title: '下载失败', icon: 'none' }) }
    })
  },
  contact() {
    wx.navigateTo({ url: '/pages/organizer/contact/contact?id=' + this.data.id })
  }
})
