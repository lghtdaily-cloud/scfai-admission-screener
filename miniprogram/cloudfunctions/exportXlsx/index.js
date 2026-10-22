// cloudfunctions/exportXlsx/index.js
// 生成需求文档 §11 的交付物 xlsx：材料清单 / 候选人信息总表 / 初筛结果 / 面试准备表 / 心仪候选者名单
const cloud = require('wx-server-sdk')
const ExcelJS = require('exceljs')
const fs = require('fs')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const { maskPhone, maskEmail } = require('./mask.js')

async function uploadBuf(name, buf) {
  const tmp = '/tmp/' + name
  fs.writeFileSync(tmp, buf)
  const res = await cloud.uploadFile({ cloudPath: 'exports/' + Date.now() + '_' + name, filePath: tmp })
  return res.fileID
}

async function buildXlsx(name, columns, rows) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('sheet')
  ws.columns = columns
  rows.forEach(r => ws.addRow(r))
  const buf = await wb.xlsx.writeBuffer()
  const fileID = await uploadBuf(name, buf)
  return { name, fileID }
}

function buildMaterial(list) {
  const rows = (list || []).map(m => ([
    m.name, m.studentId, m.form ? '✓' : '✗', m.resume ? '✓' : '✗',
    m.portfolio ? '✓' : '✗', m.transcript ? '✓' : '✗', m.statement ? '✓' : '✗',
    m.complete ? '齐全' : '不齐'
  ]))
  return buildXlsx('材料清单.xlsx', [
    { header: '姓名', key: 'a' }, { header: '学号', key: 'b' }, { header: '报名表', key: 'c' },
    { header: '简历', key: 'd' }, { header: '作品集', key: 'e' }, { header: '成绩单', key: 'f' },
    { header: '个人陈述', key: 'g' }, { header: '材料是否齐全', key: 'h' }
  ], rows)
}

function buildMaster(rows) {
  const data = (rows || []).map(m => ([
    m.name, m.studentId, m.age, m.gender, m.grade, m.major, m.email, m.phone,
    m.strengths, m.awards, (m.skills || []).join('、'), (m.improve || []).join('、'),
    (m.work || []).join('、'),
    m.portfolioOverview ? [m.portfolioOverview.category, m.portfolioOverview.style, m.portfolioOverview.advantage, m.portfolioOverview.weakness].filter(Boolean).join('；') : ''
  ]))
  return buildXlsx('候选人信息总表.xlsx', [
    { header: '姓名', key: 'a' }, { header: '学号', key: 'b' }, { header: '年龄', key: 'c' },
    { header: '性别', key: 'd' }, { header: '年级', key: 'e' }, { header: '专业', key: 'f' },
    { header: '邮箱(脱敏)', key: 'g' }, { header: '手机号(脱敏)', key: 'h' },
    { header: '特长与优势', key: 'i' }, { header: '奖项成果', key: 'j' },
    { header: '专业技能', key: 'k' }, { header: '提升方向', key: 'l' },
    { header: '承担工作', key: 'm' }, { header: '作品集概述', key: 'n' }
  ], data)
}

function buildScreen(results) {
  const data = (results || []).map(r => ([
    r.name, r.tier, r.reason || r.fallbackReason || '', r.fallback ? '是' : '', r.bonusCount, r.score
  ]))
  return buildXlsx('初筛结果.xlsx', [
    { header: '姓名', key: 'a' }, { header: '档位', key: 'b' }, { header: '理由', key: 'c' },
    { header: '兜底入选', key: 'd' }, { header: '加分项数', key: 'e' }, { header: '评分', key: 'f' }
  ], data)
}

function buildInterview(list) {
  const data = (list || []).map(p => ([
    p.name, p.email, p.phone,
    (p.advantages[0] && p.advantages[0].text) || '', (p.advantages[1] && p.advantages[1].text) || '',
    (p.advantages[2] && p.advantages[2].text) || '',
    p.questions[0] || '', p.questions[1] || '', p.questions[2] || ''
  ]))
  return buildXlsx('面试准备表.xlsx', [
    { header: '姓名', key: 'a' }, { header: '邮箱(脱敏)', key: 'b' }, { header: '手机号(脱敏)', key: 'c' },
    { header: '优势1', key: 'd' }, { header: '优势2', key: 'e' }, { header: '优势3', key: 'f' },
    { header: '面试问题1', key: 'g' }, { header: '面试问题2', key: 'h' }, { header: '面试问题3', key: 'i' }
  ], data)
}

function buildFav(cands) {
  const data = (cands || []).map(c => ([
    c.name, c.studentId, c.major, c.grade, maskEmail(c.email), maskPhone(c.phone)
  ]))
  return buildXlsx('心仪候选者名单.xlsx', [
    { header: '姓名', key: 'a' }, { header: '学号', key: 'b' }, { header: '专业', key: 'c' },
    { header: '年级', key: 'd' }, { header: '邮箱(脱敏)', key: 'e' }, { header: '手机号(脱敏)', key: 'f' }
  ], data)
}

exports.main = async (event) => {
  const resultId = event.resultId
  const scope = event.scope
  const cands = (await db.collection('candidates').limit(1000).get()).data

  if (scope === 'favorite') {
    const fav = cands.filter(c => c.favorite)
    const f = await buildFav(fav)
    return { ok: true, files: [f] }
  }

  if (!resultId) return { ok: false, msg: '缺少筛选结果' }
  const screen = await db.collection('screenResult').doc(resultId).get().catch(() => ({ data: null }))
  if (!screen.data) return { ok: false, msg: '筛选结果不存在' }

  const files = []
  files.push(await buildMaterial(screen.data.materialList))
  files.push(await buildMaster(screen.data.masterRows))
  files.push(await buildScreen(screen.data.screenResults))
  files.push(await buildInterview(screen.data.interviewPrep))
  files.push(await buildFav(cands.filter(c => c.favorite)))
  return { ok: true, files }
}
