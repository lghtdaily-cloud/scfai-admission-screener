// config/env.js — 环境与可选 LLM 配置
// 说明：
// 1. CLOUD_ENV 改为你在微信开发者工具「云开发」控制台创建的环境 ID。
// 2. LLM 部分：留空（ENABLED=false）时，全部走确定性规则引擎，无需任何密钥即可跑通；
//    填入 OpenAI 兼容的 BASE_URL / API_KEY / MODEL 并 ENABLED=true 后，
//    「招募信息解析」「作品集解析」「智能筛选」自动升级为调用大模型。
module.exports = {
  // 云开发环境 ID（必填，否则云函数/数据库不可用）
  CLOUD_ENV: 'your-cloud-env-id',

  // 可选大模型配置（OpenAI 兼容接口）
  LLM: {
    ENABLED: false,
    BASE_URL: 'https://api.openai.com/v1',
    API_KEY: '',
    MODEL: 'gpt-4o-mini'
  },

  // 活动名称（用于录取文案变量 {活动名称}）
  ACTIVITY_NAME: '艺术与文旅产业融合创新设计微专业'
}
