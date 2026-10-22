// utils/screenRules.js — 五步流水线规则引擎（确定性，无需密钥即可跑通）
// 被云函数 screenPipeline 引用；纯 JS，可在 Node 云函数与小程序端共用。
const { maskPhone, maskEmail } = require('./mask.js')

// 年级 -> 数字（大三=3）。无法识别返回 null。
function gradeYear(grade) {
  if (!grade) return null
  const cn = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10 }
  // 研究生统一视为高于大三（符合年级要求）
  if (/研[一二三四]/.test(String(grade))) return 5
  let m = String(grade).match(/大([一二三四五六七八九十])/)
  if (m) return cn[m[1]]
  m = String(grade).match(/(\d)年级/)
  if (m) return parseInt(m[1], 10)
  m = String(grade).match(/(\d{4})级/)
  if (m) {
    const y = parseInt(m[1], 10)
    const cur = new Date().getFullYear()
    return cur - y + 1
  }
  return null
}

// 步骤1 - 材料清单：每位候选人材料齐备情况
function buildMaterialRow(c) {
  const f = c.files || {}
  const hasForm = !!(f.form) || c.source === 'student'
  const resume = !!f.resume
  const portfolio = !!f.portfolio
  const transcript = !!f.transcript
  const statement = !!f.statement
  const complete = hasForm && resume && portfolio && transcript && statement
  return { name: c.name, studentId: c.studentId, form: hasForm, resume, portfolio, transcript, statement, complete }
}

// 单候选人的基础判定（排除项 / 硬条件 / 加分项 / 评分）
function screenOne(c, criteria) {
  const f = c.files || {}
  const hasForm = !!(f.form) || c.source === 'student'
  const hasPortfolio = !!f.portfolio
  const text = ((c.strengths || '') + (c.awards || '') + (c.statement || '')).toLowerCase()

  // 排除项：需求 §8.1 —— 缺报名表「或」缺作品集即视为材料严重不齐
  let excludeReason = ''
  const missing = []
  if (!hasForm) missing.push('报名表')
  if (!hasPortfolio) missing.push('作品集')
  if (missing.length) excludeReason = '材料严重不齐（缺' + missing.join('、') + '）'

  const hardFails = []
  const gy = gradeYear(c.grade)
  if (gy !== null && gy < 3) hardFails.push('年级不符合（需大三及以上）')

  let bonusCount = 0
  if (/项目|实习|经历|落地/.test(text)) bonusCount++
  if (hasPortfolio) bonusCount++
  if ((c.skills || []).includes('AI辅助设计')) bonusCount++
  if (c.awards && c.awards.trim()) bonusCount++

  const portfolioQuality = c.portfolioOverview ? 2 : (hasPortfolio ? 1 : 0)
  const score = bonusCount * 10 + portfolioQuality * 3 + (c.awards ? 2 : 0) +
    (((c.improve || []).length + (c.work || []).length) > 0 ? 1 : 0)

  let tier = '待定'
  let reason = ''
  if (excludeReason) { tier = '淘汰'; reason = excludeReason }
  else if (hardFails.length) { tier = '淘汰'; reason = '硬条件不满足：' + hardFails.join('、') }

  return { _id: c._id, name: c.name, bonusCount, score, hardFails, tier, reason }
}

// 步骤5 - 面试准备（优势 + 脱敏联系方式 + 针对性问题）
function buildInterviewPrep(c, r) {
  const src = c || {}
  const advantages = []
  if (src.awards && src.awards.trim()) advantages.push({ text: '有专业奖项/成果', source: src.awards.slice(0, 40) })
  if ((src.skills || []).includes('AI辅助设计')) advantages.push({ text: '掌握 AI 辅助设计', source: '专业技能勾选 AI辅助设计' })
  if (src.portfolioOverview && src.portfolioOverview.advantage) advantages.push({ text: src.portfolioOverview.advantage, source: '作品集解析' })
  if ((src.strengths || '').trim()) advantages.push({ text: src.strengths.slice(0, 40), source: '个人特长与优势' })

  const questions = []
  if (!src.portfolioOverview) questions.push('作品集未解析，请现场展示并讲述1件最满意的作品。')
  else if (src.portfolioOverview.weakness) questions.push('作品集中' + src.portfolioOverview.weakness + '，请补充说明相关思考。')
  if (!(src.skills || []).includes('调研与用户研究')) questions.push('本微专业强调在地文化挖掘，你打算如何补足用户研究能力？')
  questions.push('结合你的实践意愿（' + (src.work || []).join('、') + '），你希望在本期真实文旅项目中承担什么角色？')
  while (questions.length < 3) questions.push('请简述你报名本微专业的动机与学习目标。')

  return {
    name: r.name,
    email: maskEmail(src.email),
    phone: maskPhone(src.phone),
    advantages: advantages.slice(0, 3),
    questions: questions.slice(0, 3)
  }
}

// 五步流水线主入口 + 录取率兜底
function runPipeline(candidates, criteria) {
  const minAdmit = criteria.minAdmit || 0
  const materialList = candidates.map(buildMaterialRow)
  const masterRows = candidates.map(c => ({
    name: c.name, studentId: c.studentId, age: c.age, gender: c.gender, grade: c.grade, major: c.major,
    email: maskEmail(c.email), phone: maskPhone(c.phone),
    strengths: c.strengths || '', awards: c.awards || '',
    skills: c.skills || [], improve: c.improve || [], work: c.work || [],
    portfolioOverview: c.portfolioOverview || null
  }))

  const base = candidates.map(c => screenOne(c, criteria))
  let eliminated0 = base.filter(r => r.tier === '淘汰')
  let survivors = base.filter(r => r.tier !== '淘汰')
  survivors.sort((a, b) => b.score - a.score)

  const n = survivors.length
  let rate = 0.25
  let recommendCut = Math.max(1, Math.ceil(n * rate))
  let recommend = survivors.slice(0, recommendCut)
  let pending = survivors.slice(recommendCut)
  recommend.forEach(r => { r.tier = '推荐' })
  pending.forEach(r => { r.tier = '待定' })

  const fallbackLog = []
  let guard = 0
  // 逐步放宽：差额驱动，每轮只补足到 minAdmit，避免一次性全部拉入
  while (recommend.length < minAdmit && guard < 40) {
    guard++
    const need = () => minAdmit - recommend.length
    let progressed = false

    // 1) 放宽加分项门槛：≥2 → ≥1 → ≥0（按评分降序，只取差额）
    for (const threshold of [1, 0]) {
      if (recommend.length >= minAdmit) break
      const pool = pending.filter(r => r.bonusCount >= threshold).sort((a, b) => b.score - a.score)
      if (!pool.length) continue
      const take = pool.slice(0, need())
      take.forEach(r => {
        r.tier = '推荐'; r.fallback = true
        r.fallbackReason = '兜底入选：加分项门槛放宽至≥' + threshold
        recommend.push(r)
      })
      pending = pending.filter(r => !take.includes(r))
      fallbackLog.push('放宽加分项门槛至≥' + threshold + '（+' + take.length + '人）')
      progressed = true
    }
    if (recommend.length >= minAdmit) break

    // 2) 放宽硬条件（仅放宽 hardPriority 中声明的低优先级条件）
    const lowPri = criteria.hardPriority || []
    const reAdd = eliminated0
      .filter(r => r.hardFails.length && r.hardFails.every(f => lowPri.includes(f)))
      .sort((a, b) => b.score - a.score)
    if (reAdd.length) {
      const take = reAdd.slice(0, need())
      take.forEach(r => {
        r.tier = '推荐'; r.fallback = true
        r.fallbackReason = '兜底入选：放宽硬条件「' + r.hardFails.join('、') + '」'
        recommend.push(r)
        eliminated0.splice(eliminated0.indexOf(r), 1)
      })
      fallbackLog.push('放宽硬条件：' + take.map(r => r.hardFails[0]).join('、') + '（+' + take.length + '人）')
      progressed = true
    }
    if (recommend.length >= minAdmit) break

    // 3) 提高录取率 25% → 30% → 35% …（上限 50%）
    if (rate < 0.5 && pending.length) {
      const prev = rate
      rate = Math.min(0.5, rate + 0.05)
      const newCut = Math.max(recommendCut, Math.ceil(n * rate))
      const take = pending.slice(0, newCut - recommend.length)
      if (take.length > 0) {
        take.forEach(r => {
          r.tier = '推荐'; r.fallback = true
          r.fallbackReason = '兜底入选：录取率由' + (prev * 100).toFixed(0) + '%提升至' + (rate * 100).toFixed(0) + '%'
          recommend.push(r)
        })
        pending = pending.slice(take.length)
        recommendCut = newCut
        fallbackLog.push('提高录取率至' + (rate * 100).toFixed(0) + '%（+' + take.length + '人）')
        progressed = true
      }
    }
    if (!progressed) break
  }
  recommend.sort((a, b) => b.score - a.score)

  const byId = {}
  candidates.forEach(c => { byId[c._id] = c })

  const screenResults = [...recommend, ...pending, ...eliminated0].map(r => ({
    _id: r._id, name: r.name, tier: r.tier, reason: r.reason,
    fallback: !!r.fallback, fallbackReason: r.fallbackReason || '',
    bonusCount: r.bonusCount, score: r.score, hardFails: r.hardFails
  }))

  const interviewPrep = [...recommend, ...pending].map(r => buildInterviewPrep(byId[r._id], r))

  const stats = {
    total: candidates.length,
    recommend: recommend.length,
    pending: pending.length,
    eliminated: eliminated0.length,
    fallbackCount: fallbackLog.length
  }

  return { materialList, masterRows, screenResults, interviewPrep, fallbackLog, stats }
}

module.exports = { gradeYear, buildMaterialRow, screenOne, runPipeline }
