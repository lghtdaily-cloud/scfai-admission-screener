// utils/portfolio.js — 作品集解析：输出「类别 / 风格 / 优势 / 短板」四维度结构化概述
// 双引擎：配置 LLM 时由大模型生成；未配置时走确定性规则引擎（关键词词典 + 证据引用）。
// 纯 JS，可在小程序端与云函数中被 require 复用。
const { maskPhone, maskEmail } = require('./mask.js')

// —— 词典：类别 ——
const CATEGORIES = [
  { name: '平面设计', kw: ['平面设计', '海报', 'poster', '字体设计', '版式', '标志', 'logo'] },
  { name: '视觉传达', kw: ['视觉传达', '视传', '信息设计', '图形设计', '导视'] },
  { name: '摄影', kw: ['摄影', '写真', '纪实', '人像', 'photography', '影像'] },
  { name: '视频拍摄/剪辑', kw: ['短片', '视频', '纪录片', '剪辑', '分镜', '动画', '影片'] },
  { name: '插画', kw: ['插画', '绘本', '手绘', 'illustration', '漫画', '涂鸦'] },
  { name: '品牌设计', kw: ['品牌设计', 'branding', '品牌形象', '包装设计', '包装', 'vi设计'] },
  { name: '空间设计', kw: ['空间设计', '室内', '展陈', '景观', '建筑', '装置', '场景设计'] },
  { name: '产品设计', kw: ['产品设计', '工业设计', '家具', '文创产品', '周边', '产品造型'] },
  { name: '展览策划', kw: ['展览', '策展', '美术馆', '展厅', '展陈方案'] },
  { name: '活动策划', kw: ['活动策划', 'campaign', '市集', '工作坊', '活动执行', '路演'] },
  { name: '文案与内容创作', kw: ['文案', '内容创作', '新媒体', '推文', '公众号', '脚本撰写'] },
  { name: 'UI/交互设计', kw: ['ui设计', '界面设计', '交互设计', 'app设计', '网页设计', 'h5', '原型'] }
]

// —— 词典：风格 ——
const STYLES = [
  { name: '国潮', kw: ['国潮', '国风', '传统纹样', '东方美学', '非遗', '民俗', '水墨'] },
  { name: '在地文化', kw: ['在地', '本土', '地域', '乡土', '村落', '文旅', '地方文化', '方言'] },
  { name: '极简', kw: ['极简', '简约', '留白', '克制', '几何', '黑白'] },
  { name: '插画叙事', kw: ['叙事', '故事', '绘本', '角色设定', '世界观'] },
  { name: '实验性', kw: ['实验', '先锋', '跨界', '材料实验', '生成艺术', '参数化'] },
  { name: '复古怀旧', kw: ['复古', '怀旧', '胶片', '像素', '千禧', 'y2k'] },
  { name: '科技感', kw: ['科技', '未来感', '赛博', '数字化', 'ai生成', '虚拟'] }
]

// —— 规则：优势（命中关键词即成立，附原文证据）——
const ADVANTAGE_RULES = [
  { text: '叙事能力强，作品有完整故事线', kw: ['叙事', '故事', '脚本', '情节', '世界观'] },
  { text: '有完整落地项目，方案具备可执行性', kw: ['落地', '量产', '已上线', '投入使用', '实施', '打样', '投产'] },
  { text: '手绘/插画功底扎实', kw: ['手绘', '插画', '水彩', '素描', '速写', '版画'] },
  { text: '掌握 AI 辅助设计工具', kw: ['ai', 'midjourney', 'stable diffusion', 'comfyui', '生成式', 'aigc'] },
  { text: '具备用户研究与数据支撑', kw: ['用户研究', '调研', '问卷', '访谈', '数据分析', 'persona', '用户画像'] },
  { text: '有展览/活动策划与执行经验', kw: ['策展', '展览', '活动执行', '工作坊', '市集'] },
  { text: '有团队协作与项目统筹经验', kw: ['团队', '统筹', '主导', '负责', '组长', '项目负责人'] },
  { text: '设计流程完整，含调研—草图—迭代记录', kw: ['草图', '迭代', '原型', '测试', '方案比选', '设计流程'] }
]

// —— 规则：短板（未命中对应证据即记为短板，供面试提问）——
const WEAKNESS_RULES = [
  { text: '缺少用户研究与数据支撑的说明', kw: ['用户研究', '调研', '问卷', '访谈', '数据', '用户画像'] },
  { text: '未见完整落地成果，多为概念方案', kw: ['落地', '量产', '已上线', '投入使用', '投产'] },
  { text: '未展示设计过程与迭代记录', kw: ['草图', '迭代', '原型', '过程', '方案比选'] },
  { text: '未体现团队协作或真实项目背景', kw: ['团队', '协作', '统筹', '客户', '甲方'] }
]

function hits(text, words) {
  const t = String(text || '').toLowerCase()
  const found = []
  for (const w of words) {
    const idx = t.indexOf(String(w).toLowerCase())
    if (idx >= 0) found.push({ word: w, snippet: t.slice(Math.max(0, idx - 8), idx + w.length + 12).trim() })
  }
  return found
}

function take(arr, n) { return (arr || []).slice(0, n) }

/**
 * 规则引擎解析作品集
 * @param {Object} input
 * @param {string} input.text   作品集文本（PDF 抽取结果 / 作品说明 / 文件名拼接）
 * @param {string[]} [input.fileNames] 附件文件名，用于兜底识别类别
 * @param {string}  [input.statement]  个人陈述，作为补充语料
 * @returns {{category:string, style:string, advantage:string, weakness:string, evidence:string[], source:string, confidence:number}}
 */
function analyzeByRules(input) {
  const corpus = [input.text, (input.fileNames || []).join(' '), input.statement]
    .filter(Boolean).join(' ')
  const corpusL = String(corpus).toLowerCase()
  const evidence = []

  // 类别：按命中关键词数量排序，取前 3，最多 4 组
  const catHits = CATEGORIES.map(c => ({ name: c.name, n: hits(corpus, c.kw).length }))
    .filter(x => x.n > 0).sort((a, b) => b.n - a.n)
  const categories = take(catHits, 4)
  const category = categories.length
    ? categories.map(c => c.name + (c.n > 1 ? ' ' + c.n + ' 组' : ' 1 组')).join('、')
    : ''

  // 风格：取前 2
  const styleHits = STYLES.map(s => ({ name: s.name, n: hits(corpus, s.kw).length }))
    .filter(x => x.n > 0).sort((a, b) => b.n - a.n)
  const style = take(styleHits, 2).map(s => s.name).join(' + ')

  // 优势：命中即成立，最多 3 条
  const advantages = []
  for (const r of ADVANTAGE_RULES) {
    const h = hits(corpus, r.kw)
    if (h.length) {
      advantages.push({ text: r.text, source: h[0].snippet })
      evidence.push(h[0].snippet)
    }
  }
  // 跨媒介推导：类别 ≥ 3 视为跨媒介能力
  if (categories.length >= 3) {
    advantages.push({ text: '跨媒介能力强（覆盖 ' + categories.length + ' 类作品）', source: '作品类别统计' })
  }

  // 短板：未命中证据的维度
  const weaknesses = []
  for (const r of WEAKNESS_RULES) {
    if (!hits(corpus, r.kw).length) weaknesses.push(r.text)
  }
  if (categories.length <= 1) weaknesses.push('作品类型偏单一，跨媒介能力待验证')
  if (!corpusL) weaknesses.push('作品集无有效文本内容，需人工查看原件')

  const confidence = Math.min(1, (categories.length * 0.2) + (advantages.length * 0.1))

  return {
    category: category || '未识别（无有效文本）',
    style: style || '未识别',
    advantage: take(advantages, 3).map(a => a.text).join('；'),
    advantageDetail: take(advantages, 3),
    weakness: take(weaknesses, 2).join('；'),
    evidence: take(evidence, 5),
    source: 'rule',
    confidence: Number(confidence.toFixed(2))
  }
}

/**
 * 构造 LLM 解析提示词（OpenAI 兼容 /chat/completions）
 * 硬性约束：必须引用原文，找不到写「无」，禁止猜测补充。
 */
function buildPortfolioPrompt(input) {
  const text = String(input.text || '').slice(0, 6000)
  return [
    {
      role: 'system',
      content: '你是艺术设计类招生助理，负责把申请人的作品集解析为结构化概述。硬性约束：所有结论必须来自给定原文；找不到对应信息一律写「无」，禁止猜测补充；输出必须是纯 JSON，不要任何解释或代码块标记。'
    },
    {
      role: 'user',
      content: '请阅读以下作品集内容，按四维度输出 JSON：\n' +
        '{"category":"作品类别及组数，如：平面设计 3 组、摄影 1 组","style":"整体风格特征，如：国潮 + 在地文化","advantage":"突出能力，2-3 条，每条后用括号附上原文依据","weakness":"明显缺失或薄弱项，1-2 条，供面试提问；没有则写无","evidence":["原文摘录1","原文摘录2"]}\n\n' +
        '作品集内容：\n' + (text || '（无文本内容，可能为纯图片 PDF）')
    }
  ]
}

// 解析 LLM 返回的 JSON（容错：去掉代码块标记、截取首个 JSON 对象）
function parseLlmResult(content) {
  if (!content) return null
  try {
    let s = String(content).trim()
    s = s.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
    const a = s.indexOf('{')
    const b = s.lastIndexOf('}')
    if (a >= 0 && b > a) s = s.slice(a, b + 1)
    const obj = JSON.parse(s)
    return {
      category: obj.category || '无',
      style: obj.style || '无',
      advantage: typeof obj.advantage === 'string' ? obj.advantage : (obj.advantage || []).join('；'),
      weakness: typeof obj.weakness === 'string' ? obj.weakness : (obj.weakness || []).join('；'),
      evidence: Array.isArray(obj.evidence) ? obj.evidence : [],
      source: 'llm',
      confidence: 0.9
    }
  } catch (e) {
    return null
  }
}

/**
 * 统一入口：优先 LLM，失败或内容过少时回退规则引擎
 */
async function analyzePortfolio(input, llm) {
  if (llm && llm.chat) {
    try {
      const content = await llm.chat(buildPortfolioPrompt(input))
      const parsed = parseLlmResult(content)
      if (parsed && parsed.category && parsed.category !== '无') return parsed
    } catch (e) {
      // 静默回退
    }
  }
  return analyzeByRules(input)
}

/**
 * 从 PDF 原始二进制中尽力抽取文本（不依赖第三方库的最简实现）
 * 说明：仅对未压缩文本流有效；真正的流式/PDF 解析请在云函数中用 pdf-parse 覆盖此方法。
 */
function extractPdfText(buffer) {
  try {
    const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
    const raw = buf.toString('latin1')
    const chunks = []
    const re = /stream\r?\n([\s\S]{0,200000}?)\r?\nendstream/g
    let m
    while ((m = re.exec(raw)) !== null) {
      const seg = m[1]
      // FlateDecode 流为二进制，跳过；仅取可读 ASCII 文本
      const txt = seg.replace(/[^\x20-\x7e\u4e00-\u9fa5]/g, ' ')
      if (/[一-龥]/.test(txt) || /[A-Za-z]{4,}/.test(txt)) chunks.push(txt)
      if (chunks.join('').length > 40000) break
    }
    return chunks.join(' ').replace(/\s+/g, ' ').slice(0, 20000)
  } catch (e) {
    return ''
  }
}

/** 按文件名识别材料类型：resume / portfolio / form / transcript / statement / other */
function detectFileType(fileName) {
  const n = String(fileName || '').toLowerCase()
  if (/作品集|portfolio|works?/.test(n)) return 'portfolio'
  if (/简历|resume|cv|个人简历/.test(n)) return 'resume'
  if (/报名|申请表|form|application/.test(n)) return 'form'
  if (/成绩|transcript|grade/.test(n)) return 'transcript'
  if (/陈述|statement|动机|自述/.test(n)) return 'statement'
  return 'other'
}

/** 从文件名中猜测姓名：形如「张三_作品集.pdf」「李四-简历.pdf」 */
function guessNameFromFileName(fileName) {
  const base = String(fileName || '').replace(/\.[a-z0-9]+$/i, '')
  const m = base.match(/^[\s_\-]*([一-龥]{2,4}|[A-Za-z ]{2,20})/)
  if (!m) return ''
  let n = m[1].trim()
  if (/^(作品集|简历|报名表|申请表|成绩单|个人陈述|portfolio|resume|cv|form|transcript)$/i.test(n)) return ''
  if (/[一-龥]/.test(n) && n.length > 4) n = n.slice(0, 4)
  return n
}

module.exports = {
  CATEGORIES, STYLES, ADVANTAGE_RULES, WEAKNESS_RULES,
  analyzeByRules, analyzePortfolio, buildPortfolioPrompt, parseLlmResult,
  extractPdfText, detectFileType, guessNameFromFileName,
  maskPhone, maskEmail
}
