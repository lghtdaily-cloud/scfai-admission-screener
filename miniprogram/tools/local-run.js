/**
 * tools/local-run.js — 本地自测：脱离微信云开发，完整跑通五步流水线并导出 5 个 xlsx
 * 用法：
 *   NODE_PATH=<隔离工作区>/node_modules node tools/local-run.js
 * 说明：仅依赖 exceljs（生成 xlsx 用），筛选逻辑全部来自 utils/ 与 cloudfunctions/ 的真实代码。
 */
const path = require('path')
const fs = require('fs')
const { runPipeline } = require('../utils/screenRules.js')
const { analyzeByRules } = require('../utils/portfolio.js')
const { archive } = require('../cloudfunctions/importMail/mailParse.js')

let ExcelJS
try { ExcelJS = require('exceljs') } catch (e) {
  console.error('缺少 exceljs，请先安装： npm i exceljs --prefix <node-workspace>')
  process.exit(1)
}

// ---------- 1. 模拟：邮件导入的文件条目 ----------
const NAMES = ['张一鸣', '李思睿', '王梓涵', '陈牧之', '周雨桐', '吴清扬', '郑南星', '孙可欣',
  '何书瑶', '林致远', '徐若彤', '高子墨', '马语杉', '梁亦寒', '谢知微', '唐斯年',
  '许安然', '邓文澜', '冯亦驰', '曾浣青', '彭嘉树', '袁清越', '苏白露', '崔明轩']

const PORTFOLIO_TEXT = [
  '作品集包含平面设计海报3组、在地文化插画2组，采用国潮风格，已完成落地打样并投入使用，附用户调研问卷与迭代草图，团队4人协作完成。',
  '摄影作品1组，纪实风格，聚焦乡镇集市；含前期访谈记录与用户画像，但未见落地成果。',
  '品牌设计完整案例：包装设计落地量产，AI 辅助生成视觉（Midjourney），有过程草图与方案比选。',
  '空间设计课程作业，模型照片若干，无文字说明。',
  '',
  '短视频与剪辑作品2组，实验性影像，含分镜脚本；与插画师团队合作完成市集活动策划并执行。'
]

function buildEntries() {
  const entries = []
  NAMES.forEach((n, i) => {
    const base = n + '/'
    entries.push({ path: base + n + '_报名表.pdf', size: 120000 })
    entries.push({ path: base + n + '_简历.pdf', size: 90000 })
    // 3 人缺作品集（命中排除项）
    if (i % 8 !== 3) entries.push({ path: base + n + '_作品集.pdf', size: 3000000 })
    if (i % 3 === 0) entries.push({ path: base + n + '_成绩单.pdf', size: 80000 })
    if (i % 4 === 1) entries.push({ path: base + n + '_个人陈述.pdf', size: 60000 })
  })
  // 2 个无法分组的散落文件
  entries.push({ path: '说明.txt', size: 100 })
  return entries
}

// ---------- 2. 模拟：候选人库（邮件归档 + 学生端直传）----------
function buildCandidates(arch) {
  return arch.applicants.map((a, i) => {
    const has = (t) => !!a.files[t]
    return {
      _id: 'id_' + i,
      name: a.name,
      studentId: '2023' + String(10000 + i),
      age: 19 + (i % 4),
      gender: i % 2 ? '女' : '男',
      grade: i % 9 === 5 ? '大二' : (i % 5 === 0 ? '研一' : '大三'),
      major: ['视觉传达设计', '环境设计', '产品设计', '数字媒体艺术'][i % 4],
      email: 'stu' + i + '@qq.com',
      phone: '138' + String(10000000 + i).slice(0, 8),
      strengths: i % 3 === 0 ? '擅长手绘与视觉叙事，有团队协作经验' : '',
      awards: i % 4 === 0 ? '全国大学生设计竞赛二等奖；参与省级创新创业项目' : '',
      skills: ['平面设计', '插画', i % 2 ? 'AI辅助设计' : '摄影', '调研与用户研究'].filter(Boolean),
      improve: ['文旅产品设计', '在地文化资源挖掘'],
      work: ['前期调研', '视觉设计'],
      wechat: 'wx_' + i,
      files: Object.keys(a.files).reduce((o, t) => { o[t] = { type: t, path: a.files[t].path, fileID: '' }; return o }, {}),
      source: 'mail',
      missing: a.missing,
      favorite: i % 7 === 0,
      screen: null
    }
  })
}

// ---------- 3. 步骤3：作品集解析 ----------
function parsePortfolios(list) {
  list.forEach((c, i) => {
    if (!c.files.portfolio) return
    const text = PORTFOLIO_TEXT[i % PORTFOLIO_TEXT.length]
    c.portfolioOverview = analyzeByRules({ text, fileNames: Object.values(c.files).map(f => f.path), statement: c.strengths })
  })
}

// ---------- 4. 导出 xlsx ----------
async function writeXlsx(file, headers, rows) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('sheet')
  ws.columns = headers.map(h => ({ header: h, width: 18 }))
  rows.forEach(r => ws.addRow(r))
  const outDir = path.join(__dirname, 'output')
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
  await wb.xlsx.writeFile(path.join(outDir, file))
  return file
}

;(async () => {
  console.log('=== 步骤1 解压整理（邮件导入归档）===')
  const arch = archive(buildEntries())
  console.log('文件数 %d，识别申请者 %d，材料齐全 %d，不齐 %d，未识别 %d',
    arch.stats.files, arch.stats.applicants, arch.stats.complete, arch.stats.incomplete, arch.stats.ungrouped)
  const noPortfolio = arch.applicants.filter(a => a.excludedByMaterial).map(a => a.name)
  console.log('缺报名表/作品集（排除项）：', noPortfolio.join('、') || '无')

  const list = buildCandidates(arch)
  console.log('\n=== 步骤2 解析建表 ===')
  console.log('候选人 %d 人，含心仪标记 %d 人', list.length, list.filter(c => c.favorite).length)

  console.log('\n=== 步骤3 作品集解析（规则引擎样例）===')
  parsePortfolios(list)
  const sample = list.find(c => c.portfolioOverview)
  if (sample) {
    console.log('样例 ·', sample.name)
    console.log('  类别：', sample.portfolioOverview.category)
    console.log('  风格：', sample.portfolioOverview.style)
    console.log('  优势：', sample.portfolioOverview.advantage)
    console.log('  短板：', sample.portfolioOverview.weakness)
  }

  console.log('\n=== 步骤4-5 规则初筛 + 录取率兜底 ===')
  const criteria = {
    hard: ['本校在读', '专业相关', '年级符合', '每周可投入时长满足'],
    bonus: ['相关项目/实习经历', '作品集完整', 'AI 辅助设计技能', '获奖或落地案例'],
    exclude: ['材料严重不齐（缺报名表或作品集）'],
    minAdmit: 12,
    hardPriority: ['年级不符合（需大三及以上）']
  }
  const result = runPipeline(list, criteria)
  console.log('统计：', result.stats)
  console.log('兜底记录：', result.fallbackLog.length ? result.fallbackLog : '无（首次即达标）')
  const fb = result.screenResults.filter(r => r.fallback)
  console.log('兜底入选 %d 人：%s', fb.length, fb.map(r => r.name).join('、') || '无')

  // ---------- 导出 ----------
  console.log('\n=== 导出交付物 ===')
  await writeXlsx('材料清单.xlsx',
    ['姓名', '学号', '报名表', '简历', '作品集', '成绩单', '个人陈述', '是否齐全'],
    result.materialList.map(m => [m.name, m.studentId, m.form ? '✓' : '✗', m.resume ? '✓' : '✗',
      m.portfolio ? '✓' : '✗', m.transcript ? '✓' : '✗', m.statement ? '✓' : '✗', m.complete ? '齐全' : '不齐']))

  await writeXlsx('候选人信息总表.xlsx',
    ['姓名', '学号', '年龄', '性别', '年级', '专业', '邮箱(脱敏)', '手机号(脱敏)', '特长优势', '奖项成果', '专业技能', '提升方向', '承担工作', '作品集概述'],
    result.masterRows.map(m => [m.name, m.studentId, m.age, m.gender, m.grade, m.major, m.email, m.phone,
      m.strengths, m.awards, (m.skills || []).join('、'), (m.improve || []).join('、'), (m.work || []).join('、'),
      m.portfolioOverview ? [m.portfolioOverview.category, m.portfolioOverview.style, m.portfolioOverview.advantage, m.portfolioOverview.weakness].filter(Boolean).join('；') : '']))

  await writeXlsx('初筛结果.xlsx',
    ['姓名', '档位', '理由', '兜底入选', '加分项数', '评分'],
    result.screenResults.map(r => [r.name, r.tier, r.reason || r.fallbackReason || '', r.fallback ? '是' : '', r.bonusCount, r.score]))

  await writeXlsx('面试准备表.xlsx',
    ['姓名', '邮箱(脱敏)', '手机号(脱敏)', '优势1', '优势2', '优势3', '面试问题1', '面试问题2', '面试问题3'],
    result.interviewPrep.map(p => [p.name, p.email, p.phone,
      (p.advantages[0] && p.advantages[0].text) || '', (p.advantages[1] && p.advantages[1].text) || '',
      (p.advantages[2] && p.advantages[2].text) || '', p.questions[0] || '', p.questions[1] || '', p.questions[2] || '']))

  await writeXlsx('心仪候选者名单.xlsx',
    ['姓名', '学号', '专业', '年级', '邮箱(脱敏)', '手机号(脱敏)'],
    list.filter(c => c.favorite).map(c => [c.name, c.studentId, c.major, c.grade,
      c.email.replace(/^(..).*@/, '$1***@'), c.phone.slice(0, 3) + '****' + c.phone.slice(7)]))

  console.log('已生成 5 个文件 → tools/output/')
  console.log(['材料清单.xlsx', '候选人信息总表.xlsx', '初筛结果.xlsx', '面试准备表.xlsx', '心仪候选者名单.xlsx'].join(' / '))
  console.log('\n全部通过 ✅')
})()
