// pages/organizer/portfolio/portfolio.js — 作品集解析：类别 / 风格 / 优势 / 短板
Page({
  data: { running: false, list: [], engine: '', parsed: 0 },

  onShow() { this.load() },

  async load() {
    try {
      const db = wx.cloud.database()
      const r = await db.collection('candidates').limit(1000).get()
      const list = r.data
        .filter(c => c.portfolioOverview)
        .map(c => ({
          _id: c._id,
          name: c.name,
          source: c.portfolioOverview.source === 'llm' ? 'AI' : '规则',
          category: c.portfolioOverview.category,
          style: c.portfolioOverview.style,
          advantage: c.portfolioOverview.advantage,
          weakness: c.portfolioOverview.weakness
        }))
      this.setData({ list })
    } catch (e) { /* 云环境未就绪 */ }
  },

  async runAll() {
    this.setData({ running: true })
    wx.showLoading({ title: '解析中', mask: true })
    try {
      const res = await wx.cloud.callFunction({ name: 'parsePortfolio', data: { all: true } })
      wx.hideLoading()
      const r = res.result || {}
      this.setData({ running: false, engine: r.engine === 'llm' ? 'AI 大模型' : '规则引擎', parsed: r.parsed || 0 })
      if (!r.ok) wx.showToast({ title: (r.msg || '解析失败').slice(0, 20), icon: 'none' })
      else wx.showToast({ title: '解析 ' + r.parsed + ' 份' })
      this.load()
    } catch (e) {
      wx.hideLoading()
      this.setData({ running: false })
      wx.showToast({ title: '解析失败，请确认云函数已部署', icon: 'none' })
    }
  }
})
