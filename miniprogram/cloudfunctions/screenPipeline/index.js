// cloudfunctions/screenPipeline/index.js
// 五步流水线：解压整理 → 解析建表 → 作品集解析 → 规则初筛 → 二轮备注；含录取率兜底。
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const { runPipeline } = require('./screenRules.js')
const { analyzePortfolio, extractPdfText } = require('./portfolio.js')
const ai = require('./aiClient.js')
const ENV = require('./env.js')

// 步骤3 - 作品集解析：为尚无概述的候选人补齐四维度概述（未配置 LLM 时走规则引擎）
async function parsePortfolios(list) {
  let llm = null
  let s = ENV.LLM
  try {
    const r = await db.collection('config').doc('llm').get().catch(() => null)
    if (r && r.data && r.data.API_KEY) s = r.data
  } catch (e) { /* 使用本地配置 */ }
  if (s && s.ENABLED && s.API_KEY) {
    llm = { chat: (messages) => ai.chat(s, messages[0].content, messages[1].content) }
  }

  const parsed = []
  for (const c of list) {
    if (c.portfolioOverview) continue
    let text = ''
    const pf = c.files && c.files.portfolio
    if (pf && pf.fileID) {
      try {
        const res = await cloud.downloadFile({ fileID: pf.fileID })
        try {
          const pdfParse = require('pdf-parse')
          const d = await pdfParse(res.fileContent)
          text = (d && d.text) || ''
        } catch (e) { text = extractPdfText(res.fileContent) }
      } catch (e) { text = '' }
    }
    if (!text) text = [c.portfolioText, c.statement, c.strengths].filter(Boolean).join(' ')
    if (!text && !pf) continue

    const overview = await analyzePortfolio({ text, fileNames: Object.values(c.files || {}).map(f => f.name || ''), statement: c.statement }, llm)
    overview.parsedAt = Date.now()
    c.portfolioOverview = overview
    parsed.push({ _id: c._id, name: c.name, source: overview.source })
    await db.collection('candidates').doc(c._id).update({ data: { portfolioOverview: overview } })
  }
  return parsed
}

exports.main = async () => {
  const cand = await db.collection('candidates').limit(1000).get()
  const list = cand.data
  if (!list.length) return { ok: false, msg: '候选人库为空，请先收集报名材料' }

  const portfolioParsed = await parsePortfolios(list)

  const rec = await db.collection('recruit').limit(1).get().catch(() => ({ data: [] }))
  const criteria = (rec.data[0] && rec.data[0].criteria) || {
    hard: [], bonus: [], exclude: [], minAdmit: 0, hardPriority: []
  }

  const result = runPipeline(list, criteria)

  // 将初筛结果写回每位候选人
  for (const r of result.screenResults) {
    await db.collection('candidates').doc(r._id).update({
      data: {
        screen: {
          tier: r.tier,
          reason: r.reason,
          fallback: r.fallback,
          fallbackReason: r.fallbackReason,
          bonusCount: r.bonusCount,
          score: r.score,
          hardFails: r.hardFails
        }
      }
    })
  }

  // 保存完整流水线输出，供展示与导出
  const added = await db.collection('screenResult').add({
    data: {
      createdAt: Date.now(),
      materialList: result.materialList,
      masterRows: result.masterRows,
      screenResults: result.screenResults,
      interviewPrep: result.interviewPrep,
      fallbackLog: result.fallbackLog,
      stats: result.stats
    }
  }).catch(() => ({ _id: '' }))

  return {
    ok: true,
    stats: result.stats,
    fallbackLog: result.fallbackLog,
    results: result.screenResults,
    portfolioParsed,
    resultId: added._id
  }
}
