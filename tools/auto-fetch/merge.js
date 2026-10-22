// tools/auto-fetch/merge.js
// 把检索到的原始结果 → 过滤 → 去重 → 转换为项目库格式 → 写回 dist/index.html 的 WX_PROJECTS
//
// 用法：
//   node merge.js <raw.json 路径> <cutoff 日期 YYYY-MM-DD> [--dry-run]
//
// 设计原则：
//   1. 只接受发布时间 >= cutoff 的信息（用户明确要求"只要新的"）
//   2. 必须命中 ACTION_WORDS（是活动招募，不是新闻/招聘）
//   3. 必须排除 EXCLUDE_WORDS（求职招聘、艺考须知等噪音）
//   4. 与项目库已有条目按「标题相似度」去重，不重复入库
//   5. 写入前备份 index.html

const fs = require('fs')
const path = require('path')

const ROOT = 'C:\\Users\\美人鱼\\WorkBuddy\\2026-09-16-19-51-19'
const INDEX_HTML = path.join(ROOT, 'dist', 'index.html')
const STORE_JSON = path.join(ROOT, 'data', 'fetched-projects.json')

const { ACTION_WORDS, EXCLUDE_WORDS } = require('./keywords.js')

// ---------- 工具函数 ----------

function log(...a) { console.log('[merge]', ...a) }

/** 从标题推断活动类型，用于生成 tags */
function inferTags(text) {
  const tags = []
  const rules = [
    [/学术营|学术|论坛|研讨|讲座|研修/, '学术研讨'],
    [/工作坊|workshop/i, '实践工作坊'],
    [/驻留/, '艺术驻留'],
    [/志愿者|志愿/, '志愿服务'],
    [/征集|征稿/, '作品征集'],
    [/训练营|夏令营|冬令营/, '创作训练营'],
    [/微专业/, '微专业'],
    [/展览|年展|美展/, '展览'],
    [/市集|集市/, '创意市集'],
    [/公共美育|美育/, '公共美育'],
    [/微专业|学分/, '学分课程']
  ]
  rules.forEach(([re, tag]) => { if (re.test(text) && !tags.includes(tag)) tags.push(tag) })
  if (!tags.length) tags.push('艺术活动')
  return tags.slice(0, 4)
}

/** 从摘要里提取邮箱 */
function extractEmail(text) {
  const m = String(text).match(/[\w.\-]+@[\w\-]+\.[\w.\-]+/)
  return m ? m[0] : ''
}

/** 从文本里提取日期（YYYY-MM-DD / YYYY年M月D日 / M月D日） */
function extractDates(text) {
  const out = []
  const s = String(text)
  let m
  const reFull = /(20\d{2})[年\-\/.](\d{1,2})[月\-\/.](\d{1,2})/g
  while ((m = reFull.exec(s))) {
    out.push(`${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`)
  }
  return out
}

/** 标题归一化，用于相似度比较 */
function normTitle(t) {
  return String(t)
    .replace(/[\s\u3000]/g, '')
    .replace(/[｜|丨丨]/g, '')
    .replace(/[【】\[\]（）()《》<>「」『』""''·、，,。.！!？?：:；;\-—–_*#~]/g, '')
    .replace(/招募|招生|征集|报名|公告|通知|启事|简章|正式|开启|啦|啦！/g, '')
    .toLowerCase()
}

/** 判断两条标题是否重复（归一化后互为包含 或 编辑距离足够接近） */
function isSimilar(a, b) {
  const na = normTitle(a), nb = normTitle(b)
  if (!na || !nb) return false
  if (na === nb) return true
  if (na.length >= 6 && nb.length >= 6) {
    if (na.includes(nb) || nb.includes(na)) return true
  }
  // 字符集合 Jaccard
  const sa = new Set(na.split('')), sb = new Set(nb.split(''))
  const inter = [...sa].filter(c => sb.has(c)).length
  const union = new Set([...sa, ...sb]).size
  return union > 0 && inter / union > 0.82
}

// ---------- 主流程 ----------

function main() {
  const args = process.argv.slice(2)
  const rawPath = args[0]
  const cutoff = args[1] || '2026-09-19'
  const dryRun = args.includes('--dry-run')

  if (!rawPath || !fs.existsSync(rawPath)) {
    console.error('用法: node merge.js <raw.json> <cutoff YYYY-MM-DD> [--dry-run]')
    process.exit(1)
  }

  const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'))

  // 兼容多种输入形态：{articles:[...]} 或 [...]
  let items = []
  if (Array.isArray(raw)) items = raw
  else if (raw.articles) items = raw.articles
  else if (raw.results) items = raw.results
  else if (raw.data) items = raw.data
  else if (raw.batches) {
    raw.batches.forEach(b => {
      const arr = b.articles || b.results || b.data || []
      if (Array.isArray(arr)) items = items.concat(arr)
    })
  }

  log(`原始条目: ${items.length}, 截止日期: ${cutoff}`)

  // ---- 过滤 ----
  const accepted = []
  const rejected = { outOfDate: 0, noAction: 0, excluded: 0, noDate: 0 }

  items.forEach(it => {
    const title = it.title || ''
    const summary = it.summary || it.description || it.digest || ''
    const dt = it.datetime || it.date || it.publish_time || it.published_at || ''
    const blob = title + ' ' + summary

    // 日期过滤
    const day = String(dt).slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) { rejected.noDate++; return }
    if (day < cutoff) { rejected.outOfDate++; return }

    // 必须命中动作词
    const hitAction = ACTION_WORDS.some(w => blob.includes(w))
    if (!hitAction) { rejected.noAction++; return }

    // 排除噪音
    const hitExclude = EXCLUDE_WORDS.some(w => blob.includes(w))
    if (hitExclude) { rejected.excluded++; return }

    accepted.push({
      title: title.trim(),
      summary: summary.trim(),
      url: it.url || it.link || '',
      datetime: dt,
      day,
      source: it.source || it.account || it.author || '',
      query: it.query || it._query || ''
    })
  })

  log(`过滤后: ${accepted.length}  (过期${rejected.outOfDate} / 无动作词${rejected.noAction} / 命中排除${rejected.excluded} / 无日期${rejected.noDate})`)

  // ---- 组内去重（按标题相似度）----
  const deduped = []
  accepted.forEach(a => {
    if (!deduped.some(d => isSimilar(d.title, a.title))) deduped.push(a)
  })
  log(`组内去重后: ${deduped.length}`)

  // ---- 读取已入库列表 ----
  let store = { updatedAt: '', items: [] }
  if (fs.existsSync(STORE_JSON)) {
    try { store = JSON.parse(fs.readFileSync(STORE_JSON, 'utf8')) } catch (e) { log('store 解析失败，重建') }
  }
  const existing = store.items || []

  // ---- 与已入库去重 ----
  const fresh = deduped.filter(d => !existing.some(e => isSimilar(e.title, d.title)))
  log(`新条目: ${fresh.length}  (已入库 ${existing.length})`)

  if (!fresh.length) {
    log('本次无新增，结束')
    return
  }

  // ---- 转换为项目库格式 ----
  const newProjects = fresh.map((f, i) => {
    const combined = f.title + ' ' + f.summary
    const dates = extractDates(combined)
    const email = extractEmail(combined)
    // 取第一个看起来像截止日的日期（活动正文里通常是报名截止）
    const deadline = dates[0] || ''
    const start = dates[1] || ''
    return {
      _id: 'auto_' + Date.now().toString(36) + '_' + i,
      title: f.title,
      org: f.source || '四川美术学院 / 重庆艺术机构',
      deadline,
      start,
      url: f.url,
      cover: '',
      summary: f.summary || f.title,
      tags: inferTags(combined),
      source: 'auto-fetch',
      fetchedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
      publishedAt: f.day,
      parsed: {
        hard: [], bonus: [],
        exclude: [], minAdmit: 0,
        email,
        note: '本条由每日自动检索收录，请以原文公告为准'
      },
      createdAt: Date.now()
    }
  })

  // ---- 预览 ----
  console.log('\n=== 本次新增 ===')
  newProjects.forEach((p, i) => {
    console.log(`${i + 1}. [${p.publishedAt}] ${p.title}`)
    console.log(`   来源: ${p.org} | 截止: ${p.deadline || '未识别'} | 标签: ${p.tags.join('/')}`)
    console.log(`   链接: ${p.url.slice(0, 80)}...`)
  })

  if (dryRun) { log('dry-run，不写入'); return }

  // ---- 写回 index.html ----
  if (!fs.existsSync(INDEX_HTML)) { console.error('找不到 index.html:', INDEX_HTML); process.exit(1) }
  let html = fs.readFileSync(INDEX_HTML, 'utf8')

  // 备份
  const bak = INDEX_HTML + '.bak-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')
  fs.writeFileSync(bak, html, 'utf8')
  log('已备份 ->', path.basename(bak))

  // 找到 WX_PROJECTS 数组，在末尾插入
  const marker = 'const WX_PROJECTS=['
  const startIdx = html.indexOf(marker)
  if (startIdx === -1) { console.error('index.html 中找不到 WX_PROJECTS'); process.exit(1) }

  // 从 startIdx 开始做括号配对，找到数组闭合位置
  let i = html.indexOf('[', startIdx)
  let depth = 0, endIdx = -1
  let inStr = false, strCh = '', esc = false
  for (let k = i; k < html.length; k++) {
    const c = html[k]
    if (inStr) {
      if (esc) esc = false
      else if (c === '\\') esc = true
      else if (c === strCh) inStr = false
      continue
    }
    if (c === '"' || c === "'" || c === '`') { inStr = true; strCh = c; continue }
    if (c === '[') depth++
    else if (c === ']') { depth--; if (depth === 0) { endIdx = k; break } }
  }
  if (endIdx === -1) { console.error('无法定位数组结尾'); process.exit(1) }

  // 序列化为 JS 对象字面量（键不加引号，值用 JSON）
  const serialized = newProjects.map(p => {
    const parts = []
    const q = v => JSON.stringify(v)
    parts.push(`_id:${q(p._id)}`)
    parts.push(`title:${q(p.title)}`)
    parts.push(`org:${q(p.org)}`)
    parts.push(`deadline:${q(p.deadline)}`)
    parts.push(`start:${q(p.start)}`)
    parts.push(`url:${q(p.url)}`)
    parts.push(`cover:''`)
    parts.push(`summary:${q(p.summary)}`)
    parts.push(`tags:${JSON.stringify(p.tags)}`)
    parts.push(`source:'auto-fetch'`)
    parts.push(`publishedAt:${q(p.publishedAt)}`)
    parts.push(`parsed:${JSON.stringify(p.parsed)}`)
    parts.push(`createdAt:Date.now()`)
    return '  {' + parts.join(',') + '}'
  }).join(',\n')

  const before = html.slice(0, endIdx)
  const after = html.slice(endIdx)
  // 原数组最后可能有换行，插入前先补逗号
  const trimmedBefore = before.replace(/\s*$/, '')
  html = trimmedBefore + ',\n' + serialized + '\n' + after

  fs.writeFileSync(INDEX_HTML, html, 'utf8')
  log('已写入 index.html')

  // ---- 更新 store ----
  store.items = existing.concat(fresh)
  store.updatedAt = new Date().toISOString()
  if (!fs.existsSync(path.dirname(STORE_JSON))) fs.mkdirSync(path.dirname(STORE_JSON), { recursive: true })
  fs.writeFileSync(STORE_JSON, JSON.stringify(store, null, 2), 'utf8')
  log('已更新 store ->', path.basename(STORE_JSON))

  // ---- 输出新增数量，供上层脚本读取 ----
  fs.writeFileSync(path.join(ROOT, 'data', 'last-run.json'), JSON.stringify({
    added: newProjects.length,
    total: store.items.length,
    at: new Date().toISOString(),
    cut: cutoff
  }, null, 2), 'utf8')
}

main()
