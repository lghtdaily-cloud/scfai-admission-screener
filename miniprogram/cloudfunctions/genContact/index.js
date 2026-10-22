// cloudfunctions/genContact/index.js
// 生成录取文案（变量替换）与一键联系通道信息
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const env = require('./env.js')

exports.main = async (event) => {
  const { template, name, activity, candidate } = event
  const act = activity || env.ACTIVITY_NAME
  const text = (template || '')
    .replace(/{姓名}/g, name || '')
    .replace(/{活动名称}/g, act)
  return {
    ok: true,
    text,
    channels: {
      email: candidate && candidate.email,
      phone: candidate && candidate.phone,
      wechat: candidate && candidate.wechat
    }
  }
}
