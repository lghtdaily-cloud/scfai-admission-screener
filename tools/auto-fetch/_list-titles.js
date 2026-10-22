// 临时工具：列出 WX_PROJECTS 全部标题
const fs = require('fs')
const path = require('path')
const ROOT = 'C:\\Users\\美人鱼\\WorkBuddy\\2026-09-16-19-51-19'
const h = fs.readFileSync(path.join(ROOT, 'dist', 'index.html'), 'utf8')
const i = h.indexOf('const WX_PROJECTS=[')
const s = h.indexOf('[', i)
let d = 0, end = -1, st = false, ch = '', esc = false
for (let k = s; k < h.length; k++) {
  const c = h[k]
  if (st) {
    if (esc) esc = false
    else if (c === '\\') esc = true
    else if (c === ch) st = false
    continue
  }
  if (c === '"' || c === "'" || c === '`') { st = true; ch = c; continue }
  if (c === '[') d++
  else if (c === ']') { d--; if (d === 0) { end = k; break } }
}
const arr = eval(h.slice(s, end + 1))
console.log('总数', arr.length)
arr.forEach((p, n) => console.log((n + 1) + '. [' + (p.source || 'manual') + '] ' + p.title + ' | 截止:' + (p.deadline || '—')))
