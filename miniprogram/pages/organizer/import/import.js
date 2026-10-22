// pages/organizer/import/import.js — 邮件/压缩包导入：解压 → 按人归档 → 材料缺失标记
Page({
  data: {
    mode: 'zip',            // zip | files
    fileName: '',
    picked: [],             // 逐个上传模式下的文件
    importing: false,
    result: null,
    tip: '建议压缩包结构：\n· 按人分目录：张三/简历.pdf、张三/作品集.pdf\n· 或统一命名：张三_作品集.pdf、李四_简历.pdf'
  },

  switchMode(e) { this.setData({ mode: e.currentTarget.dataset.mode, result: null }) },

  // 选择压缩包（聊天文件 / 本地文件）
  pickZip() {
    const choose = wx.chooseMessageFile
      ? (o) => wx.chooseMessageFile(o)
      : (o) => wx.chooseImage(Object.assign({ count: 1 }, o))
    choose({
      count: 1,
      type: 'file',
      extension: ['zip', 'rar', '7z'],
      success: (res) => {
        const f = res.tempFiles && res.tempFiles[0]
        if (!f) return
        this.setData({ fileName: f.name || '已选择文件', zipPath: f.path, result: null })
      },
      fail: () => {}
    })
  },

  // 逐个上传模式：多选文件
  pickFiles() {
    if (!wx.chooseMessageFile) {
      wx.showToast({ title: '当前版本不支持多选文件，请用压缩包模式', icon: 'none' }); return
    }
    wx.chooseMessageFile({
      count: 20,
      type: 'file',
      success: (res) => {
        this.setData({ picked: (res.tempFiles || []).map(f => ({ name: f.name, path: f.path, size: f.size })), result: null })
      },
      fail: () => {}
    })
  },

  async uploadToCloud(path, name) {
    const ext = (name && name.split('.').pop()) || 'bin'
    const cloudPath = 'mail-import/' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '.' + ext
    const r = await wx.cloud.uploadFile({ cloudPath, filePath: path })
    return r.fileID
  },

  async runImport(payload) {
    this.setData({ importing: true })
    wx.showLoading({ title: '导入中', mask: true })
    try {
      const res = await wx.cloud.callFunction({ name: 'importMail', data: payload })
      wx.hideLoading()
      const r = res.result || {}
      if (!r.ok) {
        wx.showToast({ title: (r.msg || '导入失败').slice(0, 20), icon: 'none' })
      } else {
        wx.showToast({ title: '导入 ' + r.stats.applicants + ' 人' })
      }
      this.setData({ importing: false, result: r })
    } catch (e) {
      wx.hideLoading()
      this.setData({ importing: false })
      wx.showToast({ title: '导入失败，请确认云函数已部署', icon: 'none' })
    }
  },

  async submitZip() {
    if (!this.data.zipPath) { wx.showToast({ title: '请先选择压缩包', icon: 'none' }); return }
    const fileID = await this.uploadToCloud(this.data.zipPath, this.data.fileName)
    this.runImport({ fileID })
  },

  async submitFiles() {
    if (!this.data.picked.length) { wx.showToast({ title: '请先选择文件', icon: 'none' }); return }
    wx.showLoading({ title: '上传中', mask: true })
    const files = []
    for (const f of this.data.picked) {
      try { files.push({ name: f.name, fileID: await this.uploadToCloud(f.path, f.name), size: f.size }) }
      catch (e) { /* 单个失败跳过 */ }
    }
    wx.hideLoading()
    if (!files.length) { wx.showToast({ title: '上传失败', icon: 'none' }); return }
    this.runImport({ files })
  },

  goCandidates() { wx.navigateTo({ url: '/pages/organizer/candidates/candidates' }) },
  goScreen() { wx.navigateTo({ url: '/pages/organizer/screen/screen' }) },
  copyTip() { wx.setClipboardData({ data: this.data.tip }) }
})
