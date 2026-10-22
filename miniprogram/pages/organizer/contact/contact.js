// pages/organizer/contact/contact.js
const env = require('../../../config/env.js')

Page({
  data: {
    id: '',
    c: null,
    template: '尊敬的{姓名}同学：\n恭喜你通过「{活动名称}」初选！你的报名材料已进入优先约面名单。请留意后续面试安排通知。\n——{活动名称}项目组',
    filled: '',
    maskedPhone: '',
    maskedEmail: ''
  },
  onLoad(q) {
    if (q.id) {
      this.setData({ id: q.id })
      this.load()
    }
  },
  async load() {
    const db = wx.cloud.database()
    const r = await db.collection('candidates').doc(this.data.id).get()
    this.setData({ c: r.data })
    this.fill()
  },
  onTpl(e) { this.setData({ template: e.detail.value }); this.fill() },
  fill() {
    if (!this.data.c) return
    const t = this.data.template
      .replace(/{姓名}/g, this.data.c.name)
      .replace(/{活动名称}/g, env.ACTIVITY_NAME)
    const { maskPhone, maskEmail } = require('../../../utils/mask.js')
    this.setData({ filled: t, maskedPhone: maskPhone(this.data.c.phone), maskedEmail: maskEmail(this.data.c.email) })
  },
  async callGen() {
    if (!this.data.c) return
    try {
      const res = await wx.cloud.callFunction({
        name: 'genContact',
        data: { template: this.data.template, name: this.data.c.name, activity: env.ACTIVITY_NAME, candidate: this.data.c }
      })
      if (res.result && res.result.ok) this.setData({ filled: res.result.text })
    } catch (e) { this.fill() }
  },
  copyEmail() {
    if (!this.data.c) return
    wx.setClipboardData({ data: this.data.c.email, success: () => wx.showToast({ title: '收件人已复制' }) })
  },
  copyText() {
    wx.setClipboardData({ data: this.data.filled, success: () => wx.showToast({ title: '文案已复制' }) })
  },
  call() {
    if (!this.data.c || !this.data.c.phone) { wx.showToast({ title: '无手机号', icon: 'none' }); return }
    wx.makePhoneCall({ phoneNumber: this.data.c.phone })
  },
  copyWechat() {
    if (!this.data.c || !this.data.c.wechat) { wx.showToast({ title: '未提供微信号', icon: 'none' }); return }
    wx.setClipboardData({ data: this.data.c.wechat, success: () => wx.showToast({ title: '微信号已复制' }) })
  },
  openQQMail() {
    if (!this.data.c) return
    wx.setClipboardData({ data: this.data.c.email, success: () => {
      wx.showModal({
        title: '跳转 QQ 邮箱',
        content: '收件人邮箱已复制。请在 QQ 邮箱网页/客户端新建邮件，粘贴收件人并复制下方文案发送。',
        showCancel: false
      })
    } })
  }
})
