/* 网页版冒烟测试：用 jsdom 真实加载 web/index.html 并模拟
   首页搜索 → 立即报名 → ①自动解析需求 → 定制字段提交 → 学生四栏子导航（含使用教学）
   → 主页外项目「解析按键」按需弹出 → 报名查询四种柔化文案 → 星星特效
   → 主办方三栏子导航 → 发布项目 → 导入材料与 AI 筛选 → 提交码导入 → 删除持久化
   运行（需 jsdom）：NODE_PATH=<node 工作区>/node_modules node tools/web-smoke.js   */
const { JSDOM, VirtualConsole } = require('jsdom')
const fs = require('fs')
const path = require('path')

const HTML = process.argv[2] || path.join(__dirname, '..', 'web', 'index.html')
const html = fs.readFileSync(HTML, 'utf8')
const errs = []
const vc = new VirtualConsole()
vc.on('jsdomError', e => errs.push('jsdomError: ' + (e && e.message)))
vc.on('error', (...a) => errs.push('console.error: ' + a.join(' ')))

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  url: 'http://localhost:8080/',
  pretendToBeVisual: true,
  virtualConsole: vc,
  beforeParse(window) {
    // jsdom 未实现滚动 API，仅为冒烟测试打桩，不影响真实浏览器行为
    window.Element.prototype.scrollIntoView = function () {}
    window.scrollTo = function () {}
    // 冒烟测试期间关闭「首次进入引导」的自动播放，避免干扰既有断言
    try { window.localStorage.setItem('screener_tour_v1', '1') } catch (e) {}
  }
})
const w = dom.window
w.addEventListener('error', e => errs.push('window.error: ' + e.message))
const d = w.document

const q = s => d.querySelector(s)
const click = s => { const el = q(s); if (!el) { errs.push('缺失元素 ' + s); return } el.click() }
const txt = s => (q(s) ? q(s).textContent.trim() : '<无>')
const tab = v => { const t = [...d.querySelectorAll('.tab')].find(x => x.dataset.view === v); if (t) { t.click() } else { errs.push('缺失 tab ' + v) } }
const curTab = () => ([...d.querySelectorAll('.tab')].find(x => x.classList.contains('on')) || {}).dataset || {}
const vis = id => !!q('#' + id) && !q('#' + id).classList.contains('hide')
const subOf = navId => id => {
  const t = [...d.querySelectorAll('#' + navId + ' .subtab')].find(x => x.dataset.sub === id)
  if (t) t.click(); else errs.push('缺失子导航 ' + navId + ':' + id)
}
const starCount = () => d.querySelectorAll('.star-burst').length

setTimeout(async () => {
  console.log('=== 一、项目首页 ===')
  console.log('当前标签:', curTab().view, '| 项目数:', txt('#pCount'))
  console.log('轮播张数:', q('#heroTrack') ? q('#heroTrack').children.length : '<无>', '| 指示点:', q('#heroDots') ? q('#heroDots').children.length : '<无>')
  console.log('卡片数:', d.querySelectorAll('#pGrid .pcard').length)
  const c0 = q('#pGrid .pcard')
  console.log('首卡:', c0.querySelector('.t').textContent, '|', c0.querySelector('.ddl').textContent)

  console.log('\n=== 公众号海报项目校验 ===')
  const wxIds = ['wx_qd1am', 'wx_awqf', 'wx_pE4m', 'wx_vsEY']
  const all = w.eval('DB.projects')
  wxIds.forEach(id => {
    const p = all.find(x => x._id === id)
    if (!p) { errs.push('缺失公众号项目 ' + id); console.log('  缺失项目:', id); return }
    const coverOk = /^posters\/.+\.(jpg|jpeg|png|gif)$/i.test(p.cover || '') || /^data:image\//.test(p.cover || '')
    const fileOk = !!p.cover && (/^data:image\//.test(p.cover) || fs.existsSync(path.join(__dirname, '..', 'web', p.cover)))
    console.log('  ' + id, '| 截止:', p.deadline, '| 开课:', p.start || '-', '| 封面:', String(p.cover || '').slice(0, 34) + (String(p.cover || '').length > 34 ? '…' : ''), '| 文件存在:', fileOk)
    if (!coverOk) errs.push('项目 ' + id + ' 封面路径不合规: ' + p.cover)
    if (!fileOk) errs.push('项目 ' + id + ' 海报文件缺失: ' + p.cover)
    if (!p.deadline) errs.push('项目 ' + id + ' 缺少报名时间(deadline)')
  })
  const imgs = [...d.querySelectorAll('#pGrid .pcard .cover img')].map(i => i.getAttribute('src'))
  console.log('网格海报 <img> 数:', imgs.length, '| 示例:', imgs.slice(0, 4).join(', '))
  if (!imgs.some(s => /posters\//.test(s) || /^data:image\//.test(s))) errs.push('首页卡片未渲染公众号海报 <img>')
  const heroImgs = [...d.querySelectorAll('#heroTrack .hero-slide img')].map(i => i.getAttribute('src'))
  console.log('轮播海报 <img> 数:', heroImgs.length)

  q('#p-kw').value = '工作坊'
  q('#p-kw').dispatchEvent(new w.Event('input'))
  console.log('搜索「工作坊」→', txt('#pCount'), '| 卡片', d.querySelectorAll('#pGrid .pcard').length)
  q('#p-kw').value = '不存在的关键词'
  q('#p-kw').dispatchEvent(new w.Event('input'))
  console.log('无结果提示:', txt('#pEmpty').slice(0, 22))
  q('#p-kw').value = ''
  q('#p-kw').dispatchEvent(new w.Event('input'))
  ;[...d.querySelectorAll('#p-filters .chip')].find(c => c.dataset.f === 'soon').click()
  console.log('筛选「7 天内截止」→', txt('#pCount'))
  ;[...d.querySelectorAll('#p-filters .chip')].find(c => c.dataset.f === 'all').click()

  console.log('\n=== 二、立即报名 → ①自动解析需求 → 定制表单 ===')
  q('#pGrid [data-act="apply"]').click()
  const onSub = [...d.querySelectorAll('#stuNav .subtab')].find(x => x.classList.contains('on'))
  console.log('跳转后标签:', curTab().view, '| 落到子栏:', onSub ? onSub.dataset.sub : '<无>')
  console.log('项目条:', txt('#apTitle'))
  console.log('项目信息:', txt('#apMeta'))
  console.log('①自动解析结果可见:', vis('applyProjCard'), '| 未点解析即有内容:', txt('#pickParseResult').length > 0)
  if (!(txt('#pickParseResult').length > 0)) errs.push('选中项目后未自动渲染招募要求解析（#pickParseResult 为空）')
  const dyns = [...d.querySelectorAll('#dynFields [data-dyn]')]
  console.log('动态字段:', dyns.map(e => e.dataset.dyn).join(', '))
  console.log('材料要求:', txt('#dynMaterials').replace(/\s+/g, ' ').slice(0, 70))
  console.log('解析结果摘要:', txt('#pickParseResult').replace(/\s+/g, ' ').slice(0, 90))
  subOf('stuNav')('fill')
  console.log('点下一步切到②:', vis('sub-fill'))

  click('#btnSubmit')
  console.log('空表提交提示:', txt('#toast'))
  q('#f-name').value = '林清越'; q('#f-studentId').value = '20230215'
  q('#f-email').value = 'lin@qq.com'; q('#f-phone').value = '13800001111'
  q('#f-grade').value = '大三'; q('#f-major').value = '视觉传达设计'
  q('#f-grade').dispatchEvent(new w.Event('change'))
  click('#btnSubmit')
  console.log('缺必填项提示:', txt('#toast'))
  dyns.forEach(e => { e.value = e.type === 'number' ? '8' : '测试内容' })
  click('#btnSubmit')
  const code = q('#receiptCode').value
  console.log('提交成功，提交码:', code.slice(0, 12) + '…', '| 长度', code.length)
  const last = w.eval('DB.candidates[DB.candidates.length-1]')
  console.log('归属项目:', last.projectTitle, '| 专属字段:', JSON.stringify(last.projectFields))

  console.log('\n=== 三、学生端四栏子导航 & 使用教学 ===')
  tab('student')
  const stuSubs = [...d.querySelectorAll('#stuNav .subtab')]
  console.log('学生端子导航数量:', stuSubs.length, '(应=4)', '|', stuSubs.map(s => s.dataset.sub).join(' / '))
  if (stuSubs.length !== 4) errs.push('学生端子导航不是 4 个（应为 ①②③④）')
  console.log('默认: ①可见', vis('sub-pick'), '| ②隐藏', !vis('sub-fill'), '| ③隐藏', !vis('sub-query'), '| ④隐藏', !vis('sub-stuhelp'))
  if (!(vis('sub-pick') && !vis('sub-fill') && !vis('sub-query') && !vis('sub-stuhelp'))) errs.push('学生端默认子栏应为①项目选择与切换')
  subOf('stuNav')('fill')
  console.log('切到②: ①隐藏', !vis('sub-pick'), '| ②可见', vis('sub-fill'))
  if (!(!vis('sub-pick') && vis('sub-fill'))) errs.push('学生端切到②智能填表时子栏切换不正确')
  subOf('stuNav')('query')
  console.log('切到③: ③可见', vis('sub-query'), '| 其余隐藏', !vis('sub-pick') && !vis('sub-fill'))
  if (!(!vis('sub-pick') && !vis('sub-fill') && vis('sub-query'))) errs.push('学生端切到③报名查询时子栏切换不正确')
  subOf('stuNav')('stuhelp')
  console.log('切到④: ④可见', vis('sub-stuhelp'), '| 其余隐藏', !vis('sub-pick') && !vis('sub-fill') && !vis('sub-query'))
  if (!(vis('sub-stuhelp') && !vis('sub-pick') && !vis('sub-fill') && !vis('sub-query'))) errs.push('学生端切到④使用教学时子栏切换不正确')
  const stepItems = d.querySelectorAll('#sub-stuhelp .list-item').length
  const helpTxt = q('#sub-stuhelp').textContent
  console.log('使用教学步骤条目:', stepItems, '| 说明了「不用再上传链接」:', /不需要(你)?上传|不用再上传/.test(helpTxt))
  if (stepItems < 4) errs.push('学生端使用教学步骤条目过少：' + stepItems)
  if (!/不需要(你)?上传|不用再上传/.test(helpTxt)) errs.push('使用教学未说明「已有项目不需要上传微信链接」')
  if (!q('#sub-help')) errs.push('主办方教学面板 #sub-help 丢失（学生端 #sub-stuhelp 不应与它冲突）')
  subOf('stuNav')('pick')

  console.log('\n=== 主页外项目：选填区默认折叠 + 解析按键按需弹出 ===')
  console.log('选填区默认折叠（不强制学生填）:', q('#customProjBox').classList.contains('hide'))
  if (!q('#customProjBox').classList.contains('hide')) errs.push('「主页里没有这个项目」选填区默认应折叠')
  click('#btnToggleCustom')
  console.log('展开后: 有链接输入框', !!q('#stu-url'), '| 有抓取按钮', !!q('#btnFetchStuUrl'), '| 有解析按钮', !!q('#btnParseReq'))
  if (q('#customProjBox').classList.contains('hide')) errs.push('点「我来上传链接」未展开选填区')
  // 清掉「选项目自动解析」写入的状态，单独验证【主页外项目】分支是否仍然按需弹出
  w.eval('DB.stuRecruit=null; stagedText=""; DB.applyProject=null; renderApplyProject(); renderRecruitBrief()')
  const beforeParsed = w.eval('!!DB.stuRecruit')
  console.log('点解析前 DB.stuRecruit 为空（不裸奔）:', !beforeParsed)
  if (beforeParsed) errs.push('点解析前不应已有 DB.stuRecruit（主页外项目应仍为按需弹出）')
  w.eval("stagedText='本校在读 专业相关\\n大三及以上\\n每周可投入 10 小时\\n到岗时间 2026年10月\\n相关项目或实习经历\\n作品集完整且有代表性\\n掌握 AI 辅助设计等技能\\n有获奖或落地案例\\n最少录取 20 人'")
  click('#btnParseReq')
  const hardN = w.eval('DB.stuRecruit ? DB.stuRecruit.parsed.hard.length : 0')
  const minAdmit = w.eval('DB.stuRecruit ? DB.stuRecruit.parsed.minAdmit : 0')
  const briefAfter = txt('#recruitBrief')
  console.log('点「解析招募要求」后: 硬条件数', hardN, '| 招募人数', minAdmit, '| brief有内容', briefAfter.length > 0)
  if (!(hardN > 0 && minAdmit === 20)) errs.push('点击「解析招募要求」后未正确解析出硬条件/招募人数（应按需弹出）')

  console.log('\n=== 星星跳跃动画 ===')
  const dataStarCount = d.querySelectorAll('[data-star]').length
  console.log('带 data-star 的按钮数:', dataStarCount)
  if (dataStarCount === 0) errs.push('页面没有任何 data-star 按钮，星星动画无法触发')
  const s0 = starCount()
  w.eval('starBurst(120,120)')
  const s1 = starCount()
  const starKids = s1 > 0 ? q('.star-burst').children.length : 0
  console.log('调用 starBurst → .star-burst 出现:', s1 > s0, '| 单颗层内星星数:', starKids)
  if (!(s1 > s0 && starKids === 9)) errs.push('starBurst 未生成含 9 颗星星的动画层')

  console.log('\n=== 报名查询：四种柔化文案 + 星星特效 ===')
  tab('student'); subOf('stuNav')('query')
  const plain = s => q('#queryResult').textContent.replace(/\s+/g, ' ')
  q('#q-name').value = ''; q('#q-sid').value = ''
  let sb = starCount(); click('#btnQuery'); let sa = starCount()
  console.log('①空输入:', plain().slice(0, 34))
  if (!/两个都要填/.test(q('#queryResult').textContent)) errs.push('空输入未给出柔和提示「两个都要填哦」')
  if (!(sa > sb)) errs.push('查询结果未触发星星跳跃特效')
  q('#q-name').value = '查无此人'; q('#q-sid').value = '000000'
  click('#btnQuery')
  console.log('②未提交:', plain().slice(0, 46))
  if (!/还没有你的报名记录|还没提交/.test(q('#queryResult').textContent)) errs.push('查无记录时未显示「还没提交」柔和文案')
  q('#q-name').value = '林清越'; q('#q-sid').value = '20230215'
  click('#btnQuery')
  console.log('③已提交未筛选:', plain().slice(0, 46))
  if (!/再等一等|加载中/.test(q('#queryResult').textContent)) errs.push('已提交未筛选时未显示「加载中」文案')
  w.eval("DB.candidates.find(x=>x.name==='林清越').screen={tier:'推荐',reason:'综合素质突出'}; save()")
  click('#btnQuery')
  console.log('④已录取:', plain().slice(0, 60))
  if (!/录取|联系/.test(q('#queryResult').textContent)) errs.push('录取状态未显示「恭喜录取 / 联系老师」文案')
  w.eval("DB.candidates.find(x=>x.name==='林清越').screen={tier:'淘汰',reason:'名额有限'}; save()")
  click('#btnQuery')
  console.log('⑤未通过（柔和）:', plain().slice(0, 42))
  if (!/没能上岸|下次/.test(q('#queryResult').textContent)) errs.push('淘汰状态未显示柔和鼓励文案')

  console.log('\n=== 多元评价引擎：竞赛分级 / 作品集质量标准 ===')
  const ach = w.eval("analyzeAchievements({awards:'全国大学生工业设计大赛一等奖；四川省大学生数字艺术大赛二等奖；校级优秀学生奖学金；参与国家级大学生创新创业训练计划结项；论文被核心期刊收录；作品入选国际摄影年展并被图书馆收藏'})")
  console.log('竞赛级别分布:', ach.levelText)
  console.log('最高级别:', ach.topLevel, '| 竞赛分', ach.contestScore + '/20', '| 学术分', ach.academicScore + '/10', '| 实践分', ach.practiceScore + '/15')
  if (ach.topLevel !== '国家级') errs.push('国家级竞赛未被正确分级：' + ach.topLevel)
  if (!ach.contests.some(x => x.level === '省级')) errs.push('未识别出省级竞赛')
  if (!ach.contests.some(x => x.level === '校级')) errs.push('未识别出校级竞赛')
  if (!ach.academic.length) errs.push('未识别出学术成果（论文 / 大创）')
  if (!ach.practice.length) errs.push('未识别出实践成果（展览 / 收藏）')
  const pf = w.eval("analyzePortfolio('作品集包含平面设计海报3组、在地文化插画2组，采用国潮风格，已完成落地打样并投入使用，附用户调研问卷与迭代草图，团队4人协作完成。')")
  console.log('作品集等级:', pf.grade, '| 质量', pf.qualityScore + '/' + pf.qualityMax,
    '| 维度:', (pf.quality || []).map(q2 => q2.label + ' ' + q2.score + '/' + q2.max).join('，'))
  console.log('体裁类别:', pf.category, '| 主观结论:', String(pf.subjective).slice(0, 46))
  if (!(pf.quality && pf.quality.length === 6)) errs.push('作品集质量标准应有 6 个维度，实际 ' + (pf.quality || []).length)
  if (!(pf.qualityScore > 0)) errs.push('有内容的作品集质量分为 0（规则失效）')
  if (!pf.advantages.length) errs.push('有内容的作品集未输出任何优势（应具体到维度与证据）')
  const pfEmpty = w.eval("analyzePortfolio('')")
  console.log('空作品集等级:', pfEmpty.grade, '| 已提示人工复核:', /人工/.test(String(pfEmpty.subjective)))
  if (!/人工/.test(String(pfEmpty.subjective))) errs.push('空作品集未提示需人工复核')

  console.log('\n=== 免点击：导入后直接产出评选结果 ===')
  tab('organizer'); subOf('orgNav')('ai')
  w.eval('DB.result=null; save(); renderScreen()')
  const okRun = w.eval('runScreening(true)')
  const autoVis = vis('aiScreenCard')
  console.log('runScreening(true):', okRun, '| 结果卡自动展开:', autoVis, '| 未点「运行筛选」已有结果:', !!w.eval('DB.result'))
  if (!(okRun && autoVis && w.eval('!!DB.result'))) errs.push('runScreening(true) 未自动产出并展开评选结果')
  const sr = w.eval('DB.result.screenResults[0]')
  console.log('候选人:', sr.name, '| 总分', sr.score + '/100', '| 维度数', (sr.dims || []).length,
    '| 优势', (sr.advantages || []).length, '条 | 不足', (sr.disadvantages || []).length, '条')
  if ((sr.dims || []).length !== 7) errs.push('每位候选人应有 7 个评价维度，实际 ' + (sr.dims || []).length)
  if (sr.maxScore !== 100) errs.push('总分制应为 100，实际 ' + sr.maxScore)

  console.log('\n=== 学生提交 → 一键邮件直达主办方 ===')
  console.log('接收邮箱设置框:', !!q('#orgEmail'), '| 一键发信按钮:', !!q('#btnMailTo'))
  if (!q('#orgEmail')) errs.push('缺少主办方接收邮箱设置 #orgEmail')
  if (!q('#btnMailTo')) errs.push('提交回执缺少「📧 一键发给主办方」按钮')
  w.eval("DB.orgEmail='recruit@example.edu.cn'; save()")
  console.log('保存后 DB.orgEmail:', w.eval('DB.orgEmail'))
  if (w.eval('DB.orgEmail') !== 'recruit@example.edu.cn') errs.push('主办方接收邮箱未写入 DB.orgEmail')

  console.log('\n=== 一键导入所有邮件：.eml 拆解（发件人 / 附件 / 正文） ===')
  const b64s = s => Buffer.from(String(s), 'utf8').toString('base64')
  const emlSrc = [
    'From: 林清越 <linqingyue@qq.com>',
    'To: recruit@example.edu.cn',
    'Subject: =?UTF-8?B?5oql5ZCN55Sz6K+3?=',
    'Date: Mon, 15 Sep 2026 10:00:00 +0800',
    'MIME-Version: 1.0',
    'Content-Type: multipart/mixed; boundary="B1"',
    '',
    '--B1',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    b64s('我叫林清越，曾获全国大学生设计竞赛一等奖，作品在市级美术馆展览并被收藏。'),
    '--B1',
    'Content-Type: application/pdf',
    'Content-Disposition: attachment; filename="林清越_作品集.pdf"',
    'Content-Transfer-Encoding: base64',
    '',
    b64s('FAKE-PDF-BYTES'),
    '--B1',
    'Content-Type: application/msword',
    'Content-Disposition: attachment; filename="林清越_简历.docx"',
    'Content-Transfer-Encoding: base64',
    '',
    b64s('FAKE-DOCX-BYTES'),
    '--B1',
    'Content-Type: application/octet-stream',
    'Content-Disposition: attachment; filename="林清越_报名表.txt"',
    'Content-Transfer-Encoding: base64',
    '',
    b64s('姓名：林清越 学号：20230215 专业：视觉传达设计 年级：大三'),
    '--B1--'
  ].join('\r\n')
  w.__emlSrc = emlSrc
  const emlInfo = await w.eval("parseEmlFull(new File([window.__emlSrc],'t.eml')).then(function(r){return {name:r.name,email:r.email,subject:r.subject,atts:(r.attachments||[]).map(function(a){return a.name}),body:String(r.bodyText||'').slice(0,80)}})")
  console.log('发件人:', emlInfo.name, '| 邮箱:', emlInfo.email)
  console.log('拆出附件:', emlInfo.atts.join('、'))
  console.log('正文:', String(emlInfo.body).replace(/\s+/g, ' ').slice(0, 46))
  if (emlInfo.name !== '林清越') errs.push('.eml 发件人姓名解析错误：' + emlInfo.name)
  if (!/作品集/.test(emlInfo.atts.join(''))) errs.push('.eml 未拆出「作品集」附件')
  if (!/简历/.test(emlInfo.atts.join(''))) errs.push('.eml 未拆出「简历」附件')
  if (!/报名表/.test(emlInfo.atts.join(''))) errs.push('.eml 未拆出「报名表」附件')
  if (!/林清越/.test(String(emlInfo.body))) errs.push('.eml 正文 base64 解码失败')
  // 拆出来的正文应当能被成果分级引擎识别
  const bodyAch = w.eval("analyzeAchievements({awards:" + JSON.stringify(String(emlInfo.body)) + "})")
  console.log('正文成果分级:', bodyAch.levelText, '| 最高级:', bodyAch.topLevel)
  if (bodyAch.topLevel !== '国家级') errs.push('邮件正文里的国家级奖项未被识别：' + bodyAch.topLevel)

  console.log('\n=== 四、主办方三栏子导航 & 发布项目 ===')
  tab('organizer')
  const orgSubs = [...d.querySelectorAll('#orgNav .subtab')]
  console.log('主办方子导航数量:', orgSubs.length, '(应=3)')
  if (orgSubs.length !== 3) errs.push('主办方子导航不是 3 个')
  console.log('默认: ①可见', vis('sub-lib'), '| ②隐藏', !vis('sub-ai'), '| ③隐藏', !vis('sub-help'))
  if (!(vis('sub-lib') && !vis('sub-ai') && !vis('sub-help'))) errs.push('主办方默认子栏应为①项目库')
  subOf('orgNav')('ai')
  console.log('切到②: ①隐藏', !vis('sub-lib'), '| ②可见', vis('sub-ai'), '| ③隐藏', !vis('sub-help'))
  if (!(!vis('sub-lib') && vis('sub-ai') && !vis('sub-help'))) errs.push('主办方切到②导入材料与AI筛选时子栏切换不正确')
  subOf('orgNav')('help')
  console.log('切到③: ③可见', vis('sub-help'), '| 其余隐藏', !vis('sub-lib') && !vis('sub-ai'))
  if (!(!vis('sub-lib') && !vis('sub-ai') && vis('sub-help'))) errs.push('主办方切到③使用教学时子栏切换不正确')
  subOf('orgNav')('lib')

  click('#btnSample'); click('#btnParse')
  console.log('自动填标题:', q('#p-title').value)
  console.log('自动解析截止:', q('#p-ddl').value || '(样例无日期)')
  console.log('解析框可见:', !q('#criteriaBox').classList.contains('hide'))
  q('#p-title').value = '测试项目·城市更新设计营'
  q('#p-ddl').value = '2026-12-31'
  q('#p-org').value = '城市更新实验室'
  click('#btnSaveProject')
  console.log('主页项目数:', txt('#pCount'), '| 项目库:', txt('#projCount'))
  tab('projects')
  console.log('首页卡片数:', d.querySelectorAll('#pGrid .pcard').length)

  console.log('\n=== 五、导入材料与 AI 筛选（按项目、结果不裸奔）===')
  tab('organizer'); subOf('orgNav')('ai')
  click('#btnMock'); click('#btnRun')
  click('#btnViewScreen') // 验证「查看 AI 筛选结果」按钮
  console.log('筛选统计:', txt('#aiScreenStat').slice(0, 44).replace(/\s+/g, ' '))
  const r0 = q('#aiScreenStat .reason')
  console.log('推荐原因:', r0 ? r0.textContent.trim().slice(0, 70) : '<无>')
  if (!r0) errs.push('AI 筛选结果未渲染推荐原因（#aiScreenStat .reason 缺失）')
  click('#btnViewCands')
  console.log('点「候选人库与联系方式」后卡片可见:', vis('aiCandCard'))
  if (!vis('aiCandCard')) errs.push('点击「候选人库与联系方式」未展开卡片')
  subOf('orgNav')('lib')

  q('#codePaste').value = code
  click('#btnApplyCode')
  console.log('提交码导入:', txt('#syncStat'))
  console.log('导出表:', w.eval('JSON.stringify(sheetsFromResult().map(s=>[s.name,s.rows.length]))'))

  console.log('\n=== 六、截止时间排序 & 过期隐藏 ===')
  tab('projects')
  ;[...d.querySelectorAll('#p-filters .chip')].find(c => c.dataset.f === 'all').click()
  const fp = w.eval('filteredProjects()')
  console.log('全部筛选项目数:', fp.length)
  let sortOk = true
  for (let i = 1; i < fp.length; i++) {
    const a = w.eval('daysLeft')(fp[i - 1].deadline), b = w.eval('daysLeft')(fp[i].deadline)
    const va = a === null ? 1e9 : a, vb = b === null ? 1e9 : b
    if (va > vb) { sortOk = false; break }
  }
  console.log('按截止时间由近到远排序正确:', sortOk)
  if (!sortOk) errs.push('首页项目未按要求按截止时间排序')
  const overHidden = !fp.some(p => p._id === 'wx_qd1am')
  console.log('过期项目 wx_qd1am 默认隐藏:', overHidden)
  if (!overHidden) errs.push('过期项目默认应隐藏但未隐藏')
  ;[...d.querySelectorAll('#p-filters .chip')].find(c => c.dataset.f === 'over').click()
  const fpOver = w.eval('filteredProjects()')
  console.log('点「已截止」后项目数:', fpOver.length, '| 含 wx_qd1am:', fpOver.some(p => p._id === 'wx_qd1am'))
  if (!fpOver.some(p => p._id === 'wx_qd1am')) errs.push('点「已截止」后仍未显示过期项目')
  ;[...d.querySelectorAll('#p-filters .chip')].find(c => c.dataset.f === 'all').click()

  console.log('\n=== 七、主办方删除持久化 & 时间解析 ===')
  const before = w.eval('DB.projects.map(p=>p._id)')
  console.log('删除前项目数:', before.length, '| 含 p_seed1:', before.includes('p_seed1'))
  w.eval("DB.projects=DB.projects.filter(x=>x._id!=='p_seed1'); if(!DB.removed)DB.removed=[]; if(!DB.removed.includes('p_seed1'))DB.removed.push('p_seed1'); save()")
  const afterDel = w.eval('DB.projects.map(p=>p._id)')
  console.log('删除后含 p_seed1:', afterDel.includes('p_seed1'))
  w.eval('seedProjects()')
  const afterReload = w.eval('DB.projects.map(p=>p._id)')
  console.log('刷新合并后仍不含 p_seed1:', !afterReload.includes('p_seed1'))
  if (afterReload.includes('p_seed1')) errs.push('删除未持久化：seedProjects 重新补入了 p_seed1')
  if (!w.eval("Array.isArray(DB.removed)")) errs.push('DB.removed 不是数组')
  const ps = w.eval("parseStart('开课时间为2026年10月8日，上午9点报到')")
  console.log('parseStart 解析「2026年10月8日」→', ps)
  if (ps !== '2026-10-08') errs.push('parseStart 解析错误: ' + ps)
  const ps2 = w.eval("parseStart('报名时间9月20日截止')")
  console.log('parseStart（无开课词）→', JSON.stringify(ps2))

  console.log('\n=== 八、首次进入·动画引导（onboarding） ===')
  console.log('头部「使用引导」按钮存在:', !!q('#btnTour'))
  if (!q('#btnTour')) errs.push('缺少「使用引导」按钮 #btnTour')
  console.log('已标记看过 → 默认不自动弹出:', !q('.tour-catch'))
  if (q('.tour-catch')) errs.push('已标记看过仍自动弹出引导')
  click('#btnTour')
  console.log('点「使用引导」后出现 遮罩/高亮/提示:', !!q('.tour-catch'), !!q('.tour-spot'), !!q('.tour-tip'))
  if (!(q('.tour-catch') && q('.tour-spot') && q('.tour-tip'))) errs.push('使用引导未生成遮罩/高亮/提示层')
  await new Promise(r => setTimeout(r, 280))
  const tourStep1 = txt('.tour-tip .tt')
  console.log('第 1 步标题:', tourStep1)
  if (!tourStep1) errs.push('引导第 1 步未渲染标题')
  click('.tour-tip [data-tour="next"]')
  await new Promise(r => setTimeout(r, 280))
  const tourStep2 = txt('.tour-tip .tt')
  console.log('点「下一步」后标题:', tourStep2, '| 已推进:', tourStep1 !== tourStep2)
  if (tourStep1 === tourStep2) errs.push('点「下一步」后引导未推进')
  click('.tour-tip .tskip')
  console.log('点「跳过」后遮罩已清除:', !q('.tour-catch'))
  if (q('.tour-catch')) errs.push('点「跳过」未关闭引导')

  const real = errs.filter(e => !/Not implemented/.test(e))
  console.log('\n运行时错误:', real.length ? real : '无')
  process.exit(real.length ? 1 : 0)
}, 300)
