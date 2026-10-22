// pages/student/apply/apply.js
const formFields = require('../../../utils/formFields.js')

Page({
  data: {
    basic: formFields.BASIC,
    skills: formFields.SKILLS,
    improve: formFields.IMPROVE,
    work: formFields.WORK,
    fileTypes: formFields.FILE_TYPES,
    form: {
      name: '', studentId: '', age: '', gender: '', grade: '', major: '',
      email: '', phone: '', strengths: '', awards: '', wechat: ''
    },
    skillsSel: [],
    improveSel: [],
    workSel: [],
    files: {}, // key -> { temp, name }
    submitting: false,
    selProject: null
  },

  onShow() {
    const p = getApp().globalData.selProject
    if (p && (!this.data.selProject || this.data.selProject.id !== p.id)) {
      this.setData({ selProject: p })
    }
  },

  onBasicInput(e) {
    const key = e.currentTarget.dataset.key
    this.setData({ ['form.' + key]: e.detail.value })
  },

  onGender(e) {
    this.setData({ 'form.gender': e.currentTarget.dataset.val })
  },

  toggle(e) {
    const group = e.currentTarget.dataset.group
    const val = e.currentTarget.dataset.val
    const key = group + 'Sel'
    const arr = this.data[key].slice()
    const i = arr.indexOf(val)
    if (i >= 0) arr.splice(i, 1); else arr.push(val)
    this.setData({ [key]: arr })
  },

  chooseFile(e) {
    const key = e.currentTarget.dataset.key
    wx.chooseMessageFile({
      count: 1,
      type: 'all',
      success: (res) => {
        const f = res.tempFiles[0]
        this.setData({ ['files.' + key]: { temp: f.path, name: f.name } })
      }
    })
  },

  removeFile(e) {
    const key = e.currentTarget.dataset.key
    const files = Object.assign({}, this.data.files)
    delete files[key]
    this.setData({ files })
  },

  validate() {
    const f = this.data.form
    if (!f.name) return '请填写姓名'
    if (!f.studentId) return '请填写学号'
    if (!/^\S+@\S+\.\S+$/.test(f.email)) return '请填写有效邮箱'
    if (!/^\d{11}$/.test(f.phone)) return '请填写11位手机号'
    for (const t of this.data.fileTypes) {
      if (t.required && !(this.data.files[t.key] && this.data.files[t.key].temp)) {
        return '请上传：' + t.label
      }
    }
    return ''
  },

  async uploadOne(key) {
    const f = this.data.files[key]
    if (!f || !f.temp) return null
    const ext = (f.name.split('.').pop() || 'file').toLowerCase()
    const safeName = (this.data.form.name || '申请人').replace(/[^\w一-龥]/g, '')
    const cloudPath = 'materials/' + Date.now() + '_' + safeName + '_' + key + '.' + ext
    const res = await wx.cloud.uploadFile({ cloudPath, filePath: f.temp })
    return res.fileID
  },

  async submit() {
    const err = this.validate()
    if (err) { wx.showToast({ title: err, icon: 'none' }); return }
    this.setData({ submitting: true })
    wx.showLoading({ title: '提交中...' })
    try {
      const files = {}
      for (const t of this.data.fileTypes) {
        const key = t.key
        if (this.data.files[key] && this.data.files[key].temp) {
          const id = await this.uploadOne(key)
          if (id) files[key] = id
        }
      }
      // 在线填写即等同于提交报名表
      files.form = 'online'

      const res = await wx.cloud.callFunction({
        name: 'submitApply',
        data: {
          form: this.data.form,
          skills: this.data.skillsSel,
          improve: this.data.improveSel,
          work: this.data.workSel,
          files,
          wechat: this.data.form.wechat || ''
        }
      })
      wx.hideLoading()
      this.setData({ submitting: false })
      if (res.result && res.result.ok) {
        wx.showToast({ title: '提交成功' })
        setTimeout(() => {
          wx.redirectTo({ url: '/pages/student/status/status?name=' + encodeURIComponent(this.data.form.name) })
        }, 800)
      } else {
        wx.showToast({ title: (res.result && res.result.msg) || '提交失败', icon: 'none' })
      }
    } catch (e) {
      wx.hideLoading()
      this.setData({ submitting: false })
      wx.showToast({ title: '提交失败，请重试', icon: 'none' })
      console.error(e)
    }
  }
})
