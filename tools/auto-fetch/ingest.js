// tools/auto-fetch/ingest.js
// 统一入库入口：接受任意来源的搜索结果，过滤后写入项目库
//
// 用法:
//   node ingest.js <results.json> <cutoff YYYY-MM-DD> [--dry-run]
//
// results.json 支持两种格式:
//   A. [{title, summary, url, datetime, source}, ...]
//   B. {results:[{title, snippet|summary, url, date|datetime, ...}, ...]}

const fs = require('fs')
const path = require('path')

const ROOT = 'C:\\Users\\美人鱼\\WorkBuddy\\2026-09-16-19-51-19'
const INDEX_HTML = path.join(ROOT, 'dist', 'index.html')
const STORE_JSON = path.join(ROOT, 'data', 'fetched-projects.json')

const { ACTION_WORDS, EXCLUDE_WORDS, TITLE_BLACKLIST, URL_WHITELIST_PATTERNS } = require('./keywords.js')

/** 判断链接是否为允许的微信公众号文章链接 */
function isWechatUrl(url) {
  if (!url || typeof url !== 'string') return false
  return URL_WHITELIST_PATTERNS.some(re => re.test(url))
}

/**
 * 【硬规则 1 的官方降级方案】
 * 微信文章链接对外封闭、搜狗有反爬验证码，自动化确实拿不到 mp.weixin.qq.com 链接。
 * 此时允许：url 留空 + summary 末尾附「【公众号】XXX」，让前端渲染「复制标题用微信搜」按钮，
 * 用户粘贴到微信搜索框即可找到原文。
 * 注意：这只放宽「空链接」，任何非空但非 mp.weixin.qq.com 的链接（scfai.edu.cn / htkaoyan.com 等）
 * 依然一律拒绝。
 */
function isWxFallbackHint(summary) {
  return /【公众号】/.test(String(summary || ''))
}

/** 判断标题是否命中黑名单（用户已删除、禁止再加的活动） */
function isBlacklisted(title) {
  if (!title) return false
  const t = String(title).replace(/\s/g, '')
  return TITLE_BLACKLIST.some(b => t.includes(String(b).replace(/\s/g, '')))
}

function log(...a) { console.log('[ingest]', ...a) }

function inferTags(text) {
  const rules = [
    [/学术营|学术|论坛|研讨|讲座|研修|工作坊|沙龙/, '学术研讨'],
    [/工作坊|workshop/i, '实践工作坊'],
    [/驻留/, '艺术驻留'],
    [/志愿者|志愿/, '志愿服务'],
    [/征集|征稿|作品集/, '作品征集'],
    [/训练营|夏令营|冬令营/, '创作训练营'],
    [/微专业/, '微专业'],
    [/展览|年展|美展|个展/, '展览'],
    [/市集|集市/, '创意市集'],
    [/公共美育|美育/, '公共美育'],
    [/推免|硕士|研究生/, '升学'],
    [/宣讲会|双选会|招聘会|就业/, '就业宣讲']
  ]
  const tags = []
  rules.forEach(([re, tag]) => { if (re.test(text) && !tags.includes(tag)) tags.push(tag) })
  if (!tags.length) tags.push('艺术活动')
  return tags.slice(0, 4)
}

function extractEmail(t) {
  const m = String(t).match(/[\w.\-]+@[\w\-]+\.[\w.\-]+/)
  return m ? m[0] : ''
}

function extractDates(t) {
  const out = []
  const s = String(t)
  let m
  const re = /(20\d{2})[年\-\/.](\d{1,2})[月\-\/.](\d{1,2})/g
  while ((m = re.exec(s))) out.push(`${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`)
  return out
}

function normTitle(t) {
  return String(t)
    .replace(/[\s\u3000]/g, '')
    .replace(/[【】\[\]（）()《》<>「」『』""''·、，,。.！!？?：:；;\-—–_*#~｜|]/g, '')
    .replace(/招募|招生|征集|报名|公告|通知|启事|简章|正式|开启|啦/g, '')
    .toLowerCase()
}

function isSimilar(a, b) {
  const na = normTitle(a), nb = normTitle(b)
  if (!na || !nb) return false
  if (na === nb) return true
  if (na.length >= 6 && nb.length >= 6 && (na.includes(nb) || nb.includes(na))) return true
  const sa = new Set(na.split('')), sb = new Set(nb.split(''))
  const inter = [...sa].filter(c => sb.has(c)).length
  const union = new Set([...sa, ...sb]).size
  return union > 0 && inter / union > 0.82
}

function normalize(raw) {
  let items = []
  if (Array.isArray(raw)) items = raw
  else if (raw.results) items = raw.results
  else if (raw.articles) items = raw.articles
  else if (raw.data) items = raw.data

  return items.map(it => ({
    title: (it.title || '').trim(),
    summary: (it.summary || it.snippet || it.description || it.digest || it.content || '').trim(),
    // 微信文章链接统一升到 https：搜狗/转载稿常给 http://mp.weixin.qq.com/...，
    // verify-category.js 只认 https，不规范化会误报「非微信链接」。
    url: String(it.url || it.link || it.href || '').replace(/^http:\/\/mp\.weixin\.qq\.com\//, 'https://mp.weixin.qq.com/'),
    datetime: it.datetime || it.date || it.publish_time || it.published_at || it.publishedAt || '',
    source: it.source || it.account || it.author || it.site || ''
  }))
}

function main() {
  const args = process.argv.slice(2)
  const inPath = args[0]
  const cutoff = args[1] || '2026-09-19'
  const dryRun = args.includes('--dry-run')

  if (!inPath || !fs.existsSync(inPath)) {
    console.error('用法: node ingest.js <results.json> <cutoff YYYY-MM-DD> [--dry-run]')
    process.exit(1)
  }

  const items = normalize(JSON.parse(fs.readFileSync(inPath, 'utf8')))
  log(`输入 ${items.length} 条, cutoff=${cutoff}`)

  const accepted = []
  const rej = { noDate: 0, outOfDate: 0, noAction: 0, excluded: 0, noTitle: 0, notWechat: 0, blacklisted: 0, emptyWx: 0 }

  items.forEach(it => {
    if (!it.title) { rej.noTitle++; return }

    // 【硬规则 1】链接只接受微信公众号
    if (!isWechatUrl(it.url)) {
      if (it.url) { rej.notWechat++; return }                    // 非空但非微信链接 → 一律拒绝
      if (!isWxFallbackHint(it.summary)) { rej.notWechat++; return } // 空链接必须带「【公众号】XXX」提示
      rej.emptyWx++                                              // 走降级方案：空链接 + 公众号提示
    }

    // 【硬规则 2】黑名单活动（用户已删除，不得重复收录）
    if (isBlacklisted(it.title)) { rej.blacklisted++; return }

    const blob = it.title + ' ' + it.summary

    // 日期：没有日期的全网结果，按"本次检索即最新"处理（WebSearch 已有时效过滤）
    const day = String(it.datetime).slice(0, 10)
    const hasDate = /^\d{4}-\d{2}-\d{2}$/.test(day)
    if (hasDate && day < cutoff) { rej.outOfDate++; return }
    if (!hasDate) rej.noDate++

    const hitAction = ACTION_WORDS.some(w => blob.includes(w))
    if (!hitAction) { rej.noAction++; return }

    const hitExclude = EXCLUDE_WORDS.some(w => blob.includes(w))
    if (hitExclude) { rej.excluded++; return }

    accepted.push(Object.assign({}, it, { day: hasDate ? day : '' }))
  })

  log(`通过 ${accepted.length}  (非微信链接${rej.notWechat} / 空链接降级${rej.emptyWx} / 黑名单${rej.blacklisted} / 无日期${rej.noDate} / 过期${rej.outOfDate} / 无动作词${rej.noAction} / 排除${rej.excluded} / 无标题${rej.noTitle})`)

  // 组内去重
  const deduped = []
  accepted.forEach(a => { if (!deduped.some(d => isSimilar(d.title, a.title))) deduped.push(a) })
  log(`组内去重后 ${deduped.length}`)

  // 与已入库去重
  let store = { updatedAt: '', items: [] }
  if (fs.existsSync(STORE_JSON)) {
    try { store = JSON.parse(fs.readFileSync(STORE_JSON, 'utf8')) } catch (e) {}
  }
  const existing = store.items || []

  // 也与 index.html 里现有的 WX_PROJECTS 标题去重
  let htmlTitles = []
  if (fs.existsSync(INDEX_HTML)) {
    const h = fs.readFileSync(INDEX_HTML, 'utf8')
    const re = /title:'((?:[^'\\]|\\.)*)'/g
    let m
    while ((m = re.exec(h))) { htmlTitles.push(m[1].replace(/\\'/g, "'")) }
  }

  const fresh = deduped.filter(d =>
    !existing.some(e => isSimilar(e.title, d.title)) &&
    !htmlTitles.some(t => isSimilar(t, d.title))
  )
  log(`新条目 ${fresh.length}  (store ${existing.length} / html ${htmlTitles.length})`)

  if (!fresh.length) { log('无新增'); return }

  const newProjects = fresh.map((f, i) => {
    const combined = f.title + ' ' + f.summary
    const dates = extractDates(combined)
    return {
      title: f.title,
      org: f.source || '四川美术学院 / 重庆艺术机构',
      deadline: dates[0] || '',
      start: dates[1] || '',
      url: f.url,
      summary: f.summary || f.title,
      tags: inferTags(combined),
      publishedAt: f.day || '',
      email: extractEmail(combined)
    }
  })

  console.log('\n=== 本次新增 ===')
  newProjects.forEach((p, i) => {
    console.log(`${i+1}. ${p.title}`)
    console.log(`   来源:${p.org} | 发布:${p.publishedAt || '—'} | 截止:${p.deadline || '—'} | 标签:${p.tags.join('/')}`)
  })

  if (dryRun) { log('dry-run，不写入'); return }

  // ---- 写回 index.html ----
  let html = fs.readFileSync(INDEX_HTML, 'utf8')
  const bak = INDEX_HTML + '.bak-' + Date.now()
  fs.writeFileSync(bak, html, 'utf8')
  log('备份 ->', path.basename(bak))

  const marker = 'const WX_PROJECTS=['
  const startIdx = html.indexOf(marker)
  if (startIdx === -1) { console.error('找不到 WX_PROJECTS'); process.exit(1) }

  let depth = 0, endIdx = -1, inStr = false, strCh = '', esc = false
  for (let k = html.indexOf('[', startIdx); k < html.length; k++) {
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

  const q = v => JSON.stringify(v)
  const serialized = newProjects.map(p => {
    const parts = [
      `_id:${q('auto_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,6))}`,
      `title:${q(p.title)}`,
      `org:${q(p.org)}`,
      `deadline:${q(p.deadline)}`,
      `start:${q(p.start)}`,
      `url:${q(p.url)}`,
      `cover:''`,
      `summary:${q(p.summary)}`,
      `tags:${JSON.stringify(p.tags)}`,
      `source:'auto-fetch'`,
      `publishedAt:${q(p.publishedAt)}`,
      `parsed:${JSON.stringify({ hard: [], bonus: [], exclude: [], minAdmit: 0, email: p.email, note: '本条由每日自动检索收录，请以原文公告为准' })}`,
      `createdAt:Date.now()`
    ]
    return '  {' + parts.join(',') + '}'
  }).join(',\n')

  html = html.slice(0, endIdx).replace(/\s*$/, '') + ',\n' + serialized + '\n' + html.slice(endIdx)
  fs.writeFileSync(INDEX_HTML, html, 'utf8')
  log('已写入 index.html')

  store.items = existing.concat(newProjects.map(p => ({ title: p.title, url: p.url, publishedAt: p.publishedAt })))
  store.updatedAt = new Date().toISOString()
  fs.writeFileSync(STORE_JSON, JSON.stringify(store, null, 2), 'utf8')
  fs.writeFileSync(path.join(ROOT, 'data', 'last-run.json'), JSON.stringify({
    added: newProjects.length, total: store.items.length,
    at: new Date().toISOString(), cut: cutoff
  }, null, 2), 'utf8')
  log(`完成，累计 ${store.items.length} 条`)
}

main()
