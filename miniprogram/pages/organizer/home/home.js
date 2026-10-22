// pages/organizer/home/home.js
const env = require('../../../config/env.js')

Page({
  data: {
    total: 0, screened: 0, recommend: 0, pending: 0, eliminated: 0, favorite: 0,
    hasRecruit: false,
    // 新报名提醒：模板 ID / 剩余可推送次数（订阅消息由【接收方】即主办方授权）
    tplId: (env.SUBSCRIBE && env.SUBSCRIBE.TEMPLATE_ID) || '',
    notifyCount: 0,
    notifyOn: false,
    menus: [
      { label: '上传招募信息', url: '/pages/organizer/recruit/recruit', icon: '📋' },
      { label: '邮件导入材料', url: '/pages/organizer/import/import', icon: '📥' },
      { label: '候选人库', url: '/pages/organizer/candidates/candidates', icon: '👥' },
      { label: '作品集解析', url: '/pages/organizer/portfolio/portfolio', icon: '🖼' },
      { label: '智能筛选', url: '/pages/organizer/screen/screen', icon: '🔍' },
      { label: '心仪候选者', url: '/pages/organizer/favorite/favorite', icon: '⭐' },
      { label: '录取文案 / 一键联系', url: '/pages/organizer/contact/contact', icon: '✉️' },
      { label: '导出交付物', url: '/pages/organizer/screen/screen', icon: '📤' }
    ]
  },
  onShow() { this.load() },
  async load() {
    const db = wx.cloud.database()
    let list = []
    try {
      const all = await db.collection('candidates').limit(1000).get()
      list = all.data
    } catch (e) { list = [] }
    const screened = list.filter(c => c.screen)
    const rec = await db.collection('recruit').limit(1).get().catch(() => ({ data: [] }))
    this.setData({
      total: list.length,
      screened: screened.length,
      recommend: screened.filter(c => c.screen.tier === '推荐').length,
      pending: screened.filter(c => c.screen.tier === '待定').length,
      eliminated: screened.filter(c => c.screen.tier === '淘汰').length,
      favorite: list.filter(c => c.favorite).length,
      hasRecruit: rec.data.length > 0
    })
    this.loadNotify()
  },
  /* 读取当前主办方的提醒授权状态 */
  async loadNotify() {
    if (!this.data.tplId) return
    try {
      const r = await wx.cloud.callFunction({ name: 'notifyNewApply', data: { action: 'status' } })
      const d = (r && r.result) || {}
      this.setData({ notifyCount: d.count || 0, notifyOn: (d.count || 0) > 0 })
    } catch (e) { /* 云函数未部署时静默 */ }
  },
  /* 开启新报名提醒：主办方授权订阅消息 → 记录 openid */
  async enableNotify() {
    const tplId = this.data.tplId
    if (!tplId) {
      wx.showModal({
        title: '还没配置模板 ID',
        content: '请到 config/env.js 的 SUBSCRIBE.TEMPLATE_ID 填入你在小程序后台申请的订阅消息模板 ID，并部署 notifyNewApply 云函数。',
        showCancel: false
      })
      return
    }
    let sub
    try {
      sub = await wx.requestSubscribeMessage({ tmplIds: [tplId] })
    } catch (e) {
      wx.showToast({ title: '调起授权失败', icon: 'none' })
      return
    }
    if (sub[tplId] !== 'accept') {
      wx.showToast({ title: '未授权，收不到提醒', icon: 'none' })
      return
    }
    try {
      const r = await wx.cloud.callFunction({ name: 'notifyNewApply', data: { action: 'subscribe' } })
      const d = (r && r.result) || {}
      this.setData({ notifyCount: d.count || 0, notifyOn: true })
      wx.showToast({ title: '已开启，剩余 ' + (d.count || 0) + ' 条', icon: 'none' })
    } catch (e) {
      wx.showToast({ title: '开启失败（云函数未部署？）', icon: 'none' })
    }
  },
  go(e) { wx.navigateTo({ url: e.currentTarget.dataset.url }) }
})
