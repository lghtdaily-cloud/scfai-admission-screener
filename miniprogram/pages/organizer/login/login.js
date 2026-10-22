// pages/organizer/login/login.js
Page({
  data: { pass: '', err: '' },
  onInput(e) { this.setData({ pass: e.detail.value }) },
  async login() {
    const db = wx.cloud.database()
    let pass = 'admin888'
    try {
      const res = await db.collection('config').doc('organizer').get()
      if (res.data && res.data.passcode) pass = res.data.passcode
    } catch (e) { /* 使用默认口令 */ }
    if (this.data.pass === pass) {
      wx.setStorageSync('isOrganizer', true)
      wx.switchTab({ url: '/pages/organizer/home/home' })
    } else {
      this.setData({ err: '口令错误（默认 admin888）' })
    }
  }
})
