// cloudfunctions/notifyNewApply/env.js — 订阅消息配置（独立配置，避免与前端 config 混淆）
module.exports = {
  // 云开发环境 ID。留空('')时使用默认云环境
  CLOUD_ENV: '',

  // 活动名称，用作模板里的「项目 / 活动」变量兜底值
  ACTIVITY_NAME: '艺术与文旅产业融合创新设计微专业',

  // 订阅消息模板 ID：小程序后台 mp.weixin.qq.com → 功能 → 订阅消息 → 公共模板库
  // 选用「报名结果通知 / 新申请提醒」类模板后，把模板 ID 粘到这里。
  // ⚠️ 模板里的字段名要与 index.js 中 data 的 thing1/thing2/time3/thing4 对齐。
  SUBSCRIBE_TEMPLATE_ID: 'your-subscribe-template-id'
}
