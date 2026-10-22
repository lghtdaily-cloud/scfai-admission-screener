// tools/auto-fetch/cleanup.js
// 清理 index.html 中链接不合规（非微信公众号）的条目
// 用法: node cleanup.js [--dry-run]
//
// 背景：早期入库时未强制"只要微信链接"，混入了 scfai.edu.cn 官网链接与第三方聚合站链接。
// 用户反馈：官网链接需登录验证、聚合站会失效，均打不开。

const fs = require('fs')
const path = require('path')

const ROOT = 'C:\\Users\\美人鱼\\WorkBuddy\\2026-09-16-19-51-19'
const INDEX_HTML = path.join(ROOT, 'dist', 'index.html')
const WEBAPP_HTML = path.join(ROOT, 'webapp', 'index.html')

const { URL_WHITELIST_PATTERNS } = require('./keywords.js')

function log(...a) { console.log('[cleanup]', ...a) }
function isWechatUrl(u) { return !!u && URL_WHITELIST_PATTERNS.some(re => re.test(u)) }

/** 定位并求值 WX_PROJECTS 数组 */
function readProjects(html) {
  const si = html.indexOf('const WX_PROJECTS=[')
  if (si === -1) throw new Error('找不到 WX_PROJECTS')
  let d = 0, e = -1, inS = false, sc = '', esc = false
  for (let k = html.indexOf('[', si); k < html.length; k++) {
    const c = html[k]
    if (inS) {
      if (esc) esc = false
      else if (c === '\\') esc = true
      else if (c === sc) inS = false
      continue
    }
    if (c === '"' || c === "'" || c === '`') { inS = true; sc = c; continue }
    if (c === '[') d++
    else if (c === ']') { d--; if (d === 0) { e = k; break } }
  }
  if (e === -1) throw new Error('无法定位数组结尾')
  const open = html.indexOf('[', si)
  return { arr: (new Function('return ' + html.slice(open, e + 1)))(), open, close: e, si }
}

/** 把对象数组序列化为 index.html 使用的 JS 字面量 */
function serialize(arr) {
  const q = v => JSON.stringify(v)
  return arr.map(p => {
    const parts = []
    parts.push(`_id:${q(p._id)}`)
    parts.push(`title:${q(p.title)}`)
    parts.push(`org:${q(p.org || '')}`)
    parts.push(`deadline:${q(p.deadline || '')}`)
    parts.push(`start:${q(p.start || '')}`)
    parts.push(`url:${q(p.url || '')}`)
    parts.push(`cover:${q(p.cover || '')}`)
    parts.push(`summary:${q(p.summary || '')}`)
    if (p.tags) parts.push(`tags:${JSON.stringify(p.tags)}`)
    if (p.source) parts.push(`source:${q(p.source)}`)
    if (p.publishedAt) parts.push(`publishedAt:${q(p.publishedAt)}`)
    if (p.parsed) parts.push(`parsed:${JSON.stringify(p.parsed)}`)
    parts.push(`createdAt:${typeof p.createdAt === 'number' ? p.createdAt : 'Date.now()'}`)
    return '  {' + parts.join(',') + '}'
  }).join(',\n')
}

function processFile(file, dryRun) {
  if (!fs.existsSync(file)) { log('跳过（不存在）', file); return 0 }
  const html = fs.readFileSync(file, 'utf8')
  const { arr, open, close } = readProjects(html)

  const kept = arr.filter(p => isWechatUrl(p.url))
  const removed = arr.filter(p => !isWechatUrl(p.url))

  log(`${path.basename(path.dirname(file))}/${path.basename(file)}: 原 ${arr.length} 条 → 保留 ${kept.length} 条，移除 ${removed.length} 条`)
  removed.forEach(p => log(`   ✗ 移除 [${p.source || 'manual'}] ${p.title}`))
  removed.forEach(p => log(`      链接: ${p.url}`))

  if (!removed.length) return 0

  if (dryRun) { log('dry-run，不写入'); return removed.length }

  const bak = file + '.bak-cleanup-' + Date.now()
  fs.writeFileSync(bak, html, 'utf8')
  log('备份 ->', path.basename(bak))

  // HTML 里保留原来的数组前导空格风格
  const head = html.slice(0, open)
  const tail = html.slice(close + 1)
  const body = kept.length ? '\n' + serialize(kept) + '\n' : ''
  fs.writeFileSync(file, head + '[' + body + ']' + tail, 'utf8')
  log('已写入', path.basename(file))
  return removed.length
}

function main() {
  const dryRun = process.argv.includes('--dry-run')
  let total = 0
  total += processFile(INDEX_HTML, dryRun)
  total += processFile(WEBAPP_HTML, dryRun)
  log(`共移除 ${total} 条不合规条目`)
}

main()
