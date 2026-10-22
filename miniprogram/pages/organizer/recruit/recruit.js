// pages/organizer/recruit/recruit.js
const sample = require('../../../utils/sampleRecruit.js')
const formFields = require('../../../utils/formFields.js')

Page({
  data: {
    text: '',
    criteria: null,
    basics: formFields.BASIC,
    skills: formFields.SKILLS,
    improve: formFields.IMPROVE,
    work: formFields.WORK,
    parsed: false,
    saving: false
  },
  onLoad() { this.loadExisting() },
  async loadExisting() {
    const db = wx.cloud.database()
    const r = await db.collection('recruit').limit(1).get().catch(() => ({ data: [] }))
    if (r.data.length) {
      this.setData({ text: r.data[0].text || '', criteria: r.data[0].criteria, parsed: true })
    }
  },
  loadSample() { this.setData({ text: sample.RECRUIT_TEXT }) },
  onText(e) { this.setData({ text: e.detail.value }) },
  async parse() {
    if (!this.data.text.trim()) { wx.showToast({ title: '请先粘贴招募信息', icon: 'none' }); return }
    wx.showLoading({ title: '解析中' })
    try {
      const res = await wx.cloud.callFunction({ name: 'parseRecruit', data: { text: this.data.text } })
      wx.hideLoading()
      if (res.result && res.result.ok) {
        this.setData({ criteria: res.result.criteria, parsed: true })
        wx.showToast({ title: '解析完成' + (res.result.criteria.engine === 'llm' ? '（AI）' : '（规则）') })
      } else {
        wx.hideLoading()
        wx.showToast({ title: '解析失败', icon: 'none' })
      }
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: '解析失败', icon: 'none' })
    }
  },
  onListInput(e) {
    const group = e.currentTarget.dataset.group
    const idx = e.currentTarget.dataset.idx
    const arr = this.data.criteria[group].slice()
    arr[idx] = e.detail.value
    this.setData({ ['criteria.' + group]: arr })
  },
  onMin(e) { this.setData({ 'criteria.minAdmit': parseInt(e.detail.value || '0', 10) }) },
  addItem(e) {
    const group = e.currentTarget.dataset.group
    const arr = this.data.criteria[group].slice()
    arr.push('')
    this.setData({ ['criteria.' + group]: arr })
  },
  delItem(e) {
    const group = e.currentTarget.dataset.group
    const idx = e.currentTarget.dataset.idx
    const arr = this.data.criteria[group].slice()
    arr.splice(idx, 1)
    this.setData({ ['criteria.' + group]: arr })
  },
  async save() {
    if (!this.data.criteria) { wx.showToast({ title: '请先解析', icon: 'none' }); return }
    this.setData({ saving: true })
    const db = wx.cloud.database()
    const doc = { text: this.data.text, criteria: this.data.criteria, updatedAt: Date.now() }
    const r = await db.collection('recruit').limit(1).get().catch(() => ({ data: [] }))
    if (r.data.length) await db.collection('recruit').doc(r.data[0]._id).set({ data: doc })
    else await db.collection('recruit').add({ data: doc })
    this.setData({ saving: false })
    wx.showToast({ title: '已保存' })
  }
})
