// cloudfunctions/parseRecruit/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const { chat } = require('./aiClient.js')
const env = require('./env.js')

async function getLLMSettings() {
  try {
    const r = await db.collection('config').doc('llm').get()
    if (r.data) return r.data
  } catch (e) { /* 回退到 env */ }
  return env.LLM
}

// 规则引擎：从文本抽取最少录取人数，三张清单给通用默认（可在 UI 编辑）
function ruleExtract(text) {
  let minAdmit = 0
  const m = text.match(/(?:招生计划|最低开班人数)[：:】]?\s*(\d+)\s*人/)
  if (m) minAdmit = parseInt(m[1], 10)
  return {
    hard: ['本校在读', '年级符合（大三及以上）', '专业相关', '每周可投入时长满足', '到岗时间符合'],
    bonus: ['相关项目/实习经历', '作品集完整且有代表性', '掌握 AI 辅助设计等技能', '有获奖或落地案例'],
    exclude: ['材料严重不齐（缺报名表或作品集）', '简历与报名表信息矛盾', '明显无投递动机'],
    minAdmit,
    hardPriority: ['每周可投入时长满足', '到岗时间符合', '专业相关', '年级符合（大三及以上）', '本校在读'],
    engine: 'rule'
  }
}

exports.main = async (event) => {
  const text = event.text
  if (!text) return { ok: false, msg: '缺少招募信息文本' }

  const settings = await getLLMSettings()
  let criteria = null

  if (settings && settings.ENABLED && settings.API_KEY) {
    try {
      const sys = '你是招募信息解析助手。从文本中提取筛选标准，仅输出 JSON：' +
        '{ "hard": string[], "bonus": string[], "exclude": string[], "minAdmit": number, "hardPriority": string[] }。' +
        'hardPriority 为硬条件放宽优先级，从最易放宽排到最不易放宽。'
      const out = await chat(settings, sys, text)
      if (out) {
        const p = JSON.parse(out)
        criteria = Object.assign(ruleExtract(text), p, { engine: 'llm' })
      }
    } catch (e) {
      console.error('LLM 解析失败，回退规则引擎', e)
    }
  }

  if (!criteria) criteria = ruleExtract(text)
  return { ok: true, criteria }
}
