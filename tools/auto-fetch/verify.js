// tools/auto-fetch/verify.js
// 验证 dist/index.html 里的 WX_PROJECTS 数组语法正确、结构完好
const fs = require('fs')
const path = require('path')

const INDEX_HTML = 'C:\\Users\\美人鱼\\WorkBuddy\\2026-09-16-19-51-19\\dist\\index.html'

const html = fs.readFileSync(INDEX_HTML, 'utf8')
const marker = 'const WX_PROJECTS=['
const startIdx = html.indexOf(marker)
if (startIdx === -1) { console.error('✗ 找不到 WX_PROJECTS'); process.exit(1) }

// 括号配对定位数组
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
if (endIdx === -1) { console.error('✗ 无法定位数组结尾'); process.exit(1) }

const arrSrc = html.slice(html.indexOf('[', startIdx), endIdx + 1)

let arr
try {
  // 用 Function 求值（数组字面量允许 Date.now() 调用）
  arr = (new Function('return ' + arrSrc))()
  console.log('✓ 数组语法正确，长度 =', arr.length)
} catch (e) {
  console.error('✗ 数组语法错误:', e.message)
  console.error('片段:', arrSrc.slice(0, 300))
  process.exit(1)
}

// 检查每条记录的关键字段
const problems = []
arr.forEach((p, i) => {
  if (!p._id) problems.push(`#${i} 缺 _id`)
  if (!p.title) problems.push(`#${i} 缺 title`)
  if (p.title && typeof p.title !== 'string') problems.push(`#${i} title 非字符串`)
  if (p.url && typeof p.url !== 'string') problems.push(`#${i} url 非字符串`)
})

if (problems.length) {
  console.error('✗ 字段问题:'); problems.slice(0, 20).forEach(s => console.error('  ' + s))
  process.exit(1)
}

// 重复 _id 检查
const ids = arr.map(p => p._id)
const dupIds = ids.filter((v, i) => ids.indexOf(v) !== i)
if (dupIds.length) { console.error('✗ 重复 _id:', [...new Set(dupIds)]); process.exit(1) }

// 相似标题检查
function norm(t) {
  return String(t).replace(/[\s\u3000]/g, '')
    .replace(/[【】\[\]（）()《》<>「」『』""''·、，,。.！!？?：:；;\-—–_*#~｜|]/g, '')
    .replace(/招募|招生|征集|报名|公告|通知|启事|简章|正式|开启|啦/g, '').toLowerCase()
}
const sims = []
for (let i = 0; i < arr.length; i++) {
  for (let j = i + 1; j < arr.length; j++) {
    const a = norm(arr[i].title || ''), b = norm(arr[j].title || '')
    if (!a || !b) continue
    if (a === b || (a.length >= 6 && b.length >= 6 && (a.includes(b) || b.includes(a)))) {
      sims.push(`「${arr[i].title}」 ≈ 「${arr[j].title}」`)
    }
  }
}

console.log('✓ 无重复 _id，字段完整')
console.log(`  总条目: ${arr.length}`)
console.log(`  自动收录: ${arr.filter(p => p.source === 'auto-fetch').length}`)
if (sims.length) {
  console.log(`⚠ 疑似重复标题 ${sims.length} 组:`)
  sims.slice(0, 10).forEach(s => console.log('   ' + s))
} else {
  console.log('✓ 无标题重复')
}

// 输出最近收录
const auto = arr.filter(p => p.source === 'auto-fetch')
if (auto.length) {
  console.log('\n最近自动收录:')
  auto.slice(-5).forEach(p => console.log(`  [${p.publishedAt || '—'}] ${p.title}`))
}
