// pages/student/intro/intro.js
const ARTICLE_URL = 'https://mp.weixin.qq.com/s/pE4mmps9ZQvB7lPjLL8NFw'
const { PROJECTS } = require('../../../utils/projects.js')

Page({
  data: {
    articleUrl: ARTICLE_URL,
    projects: PROJECTS,
    current: 0,
    active: PROJECTS[0],
    summary: [
      { t: '招生对象', d: '全校本科生（大三及以上），各学院各专业均可报名，同期只能选报一个微专业。' },
      { t: '招生计划', d: '25 人（最低开班人数：25 人），学制 2 学期 / 12 学分，免收学费。' },
      { t: '提交材料', d: '报名申请表、主修专业成绩单、作品集（不少于3件）、个人陈述（500字内）。' },
      { t: '申请时间', d: '2026年9月10日 — 9月20日；资格审查 9/21-9/23；公布名单 9/24。' },
      { t: '联系方式', d: '邮箱报名 541040612@qq.com；李老师 18975560838。' }
    ]
  },
  onSwiper(e) {
    const i = e.detail.current
    this.setData({ current: i, active: this.data.projects[i] })
  },
  // 选好项目 → 带到「学生报名」页（tab 页用 globalData 传参）
  chooseProject(e) {
    const i = Number(e.currentTarget.dataset.i)
    const p = this.data.projects[i]
    getApp().globalData.selProject = p
    wx.switchTab({ url: '/pages/student/apply/apply' })
  },
  goApply() {
    wx.switchTab({ url: '/pages/student/apply/apply' })
  },
  copyLink() {
    wx.setClipboardData({ data: ARTICLE_URL, success: () => wx.showToast({ title: '链接已复制' }) })
  }
})
