// app.js — 全局初始化（微信云开发）
const env = require('./config/env.js')

App({
  globalData: {
    // 当前登录的主办方 openid（登录后写入）
    organizerOpenid: null,
    // 云环境 ID（与 config/env.js 保持一致）
    cloudEnv: env.CLOUD_ENV
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error('当前基础库版本过低，请使用 2.2.3 以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        // 留空则自动使用默认云环境，免改代码
        env: env.CLOUD_ENV || wx.cloud.DYNAMIC_CURRENT_ENV,
        traceUser: true
      })
    }
  }
})
