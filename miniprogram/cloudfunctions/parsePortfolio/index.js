// cloudfunctions/parsePortfolio/index.js
// 作品集解析：PDF/图片 → 类别 / 风格 / 优势 / 短板 四维度结构化概述，写回候选人库。
// 能力顺序：pdf-parse（若已安装）→ 内置轻量文本抽取 → 规则引擎；配置 LLM 后自动升级为大模型解析。
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const { analyzeByRules, analyzePortfolio, extractPdfText, detectFileType } = require('./portfolio.js')
const { buildPortfolioPrompt, parseLlmResult } = require('./portfolio.js')
const ai = require('./aiClient.js')
const ENV = require('./env.js')

// 读取 LLM 配置：优先云数据库 config/llm，其次 env.js
async function loadLlm() {
  let s = ENV.LLM
  try {
    const r = await db.collection('config').doc('llm').get().catch(() => null)
    if (r && r.data && r.data.API_KEY) s = r.data
  } catch (e) { /* 忽略，使用本地配置 */ }
  if (!s || !s.ENABLED || !s.API_KEY) return null
  return {
    chat: async (messages) => ai.chat(s, messages[0].content, messages[1].content)
  }
}

// 尽力抽取作品集文本
async function getText(cand) {
  const f = (cand.files && cand.files.portfolio) || null
  if (f && f.fileID) {
    try {
      const res = await cloud.downloadFile({ fileID: f.fileID })
      const buf = res.fileContent
      // 1) 优先 pdf-parse（若云端已安装）
      try {
        const pdfParse = require('pdf-parse')
        const data = await pdfParse(buf)
        if (data && data.text && data.text.trim().length > 20) return data.text
      } catch (e) { /* 未安装或非 PDF，继续 */ }
      // 2) 内置轻量抽取
      const t = extractPdfText(buf)
      if (t && t.trim().length > 10) return t
    } catch (e) { /* 下载失败，继续用文本兜底 */ }
  }
  // 3) 兜底：用候选人的作品说明/个人陈述/文件名
  return [cand.portfolioText, cand.statement, cand.strengths, Object.keys(cand.files || {}).join(' ')]
    .filter(Boolean).join(' ')
}

exports.main = async (event) => {
  const { candidateId, all } = event || {}
  const llm = await loadLlm()

  let list = []
  if (candidateId) {
    const one = await db.collection('candidates').doc(candidateId).get().catch(() => null)
    if (one && one.data) list = [one.data]
  } else {
    const r = await db.collection('candidates').limit(1000).get()
    list = r.data
  }
  if (!list.length) return { ok: false, msg: '候选人库为空' }

  const results = []
  for (const c of list) {
    // 已有解析结果且非强制重解析则跳过
    if (c.portfolioOverview && !all && !candidateId) continue
    if (!(c.files && c.files.portfolio) && !c.portfolioText) continue

    const text = await getText(c)
    const overview = await analyzePortfolio(
      { text, fileNames: Object.values(c.files || {}).map(f => f.name || ''), statement: c.statement },
      llm
    )
    overview.parsedAt = Date.now()
    overview.hasPortfolio = !!(c.files && c.files.portfolio)

    await db.collection('candidates').doc(c._id).update({ data: { portfolioOverview: overview } })
    results.push({ _id: c._id, name: c.name, source: overview.source, category: overview.category, style: overview.style })
  }

  return { ok: true, parsed: results.length, results, engine: llm ? 'llm' : 'rule' }
}
