// config/env.js — 环境与可选 LLM 配置
// 说明：
// 1. CLOUD_ENV 改为你在微信开发者工具「云开发」控制台创建的环境 ID。
// 2. LLM 部分：留空（ENABLED=false）时，全部走确定性规则引擎，无需任何密钥即可跑通；
//    填入 OpenAI 兼容的 BASE_URL / API_KEY / MODEL 并 ENABLED=true 后，
//    「招募信息解析」「作品集解析」「智能筛选」自动升级为调用大模型。
module.exports = {
  // 云开发环境 ID。留空('')时，前端会自动使用你开通的【默认】云环境，
  // 无需修改本文件。若你有多个云环境、需指定某一个，再填这里。
  CLOUD_ENV: '',

  // 可选大模型配置（OpenAI 兼容接口）
  LLM: {
    ENABLED: false,
    BASE_URL: 'https://api.openai.com/v1',
    API_KEY: '',
    MODEL: 'gpt-4o-mini'
  },

  // 活动名称（用于录取文案变量 {活动名称}）
  ACTIVITY_NAME: '艺术与文旅产业融合创新设计微专业',

  // 「有新的报名」订阅消息（推送给主办方微信）
  // 1. 小程序后台 mp.weixin.qq.com → 功能 → 订阅消息 → 公用模板库，选用「新申请 / 报名提醒」类模板
  // 2. 把模板 ID 填到这里，并保持与 cloudfunctions/notifyNewApply/env.js 里的 SUBSCRIBE_TEMPLATE_ID 一致
  // 3. 部署 notifyNewApply 云函数后，主办方在首页点「开启新报名提醒」授权即可
  SUBSCRIBE: {
    TEMPLATE_ID: ''
  }
}
