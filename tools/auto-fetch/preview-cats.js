#!/usr/bin/env node
/** preview-cats.js —— 用页面里真实的 inferCategories 逻辑跑一遍 4 条数据，确认分类结果
 *  做法：按行切分 index.html，从含 `const CAT_DEFS=[` 的那一行起，
 *  一直取到含 `function ensureCats(` 函数体结束（用大括号配平），确保完整拿到推断逻辑。
 */
const fs = require('fs'), path = require('path')
const ROOT = path.resolve(__dirname, '..', '..')
const FILE = path.join(ROOT, 'dist', 'index.html')
const t = fs.readFileSync(FILE, 'utf8')
const lines = t.split(/\r?\n/)

const startLine = lines.findIndex(l => l.includes('const CAT_DEFS=['))
if(startLine < 0){ console.error('未找到 CAT_DEFS'); process.exit(1) }

// 从 startLine 开始，找到 `function ensureCats(` 的结束（大括号配平）
let endLine = -1
const ecLine = lines.findIndex((l, n) => n > startLine && l.includes('function ensureCats('))
if(ecLine >= 0){
  let depth = 0, started = false
  for(let n = ecLine; n < lines.length; n++){
    for(const ch of lines[n]){
      if(ch === '{'){ depth++; started = true }
      else if(ch === '}'){ depth-- }
    }
    if(started && depth === 0){ endLine = n; break }
  }
}
if(endLine < 0){ console.error('未定位到 ensureCats 结束行'); process.exit(1) }

const block = lines.slice(startLine, endLine + 1).join('\n')
console.log('提取分类代码块: 行 ' + (startLine + 1) + ' ~ ' + (endLine + 1) + '（' + block.length + ' 字符）')

// —— 摘 WX_PROJECTS ——
const key = 'const WX_PROJECTS=['
const i = t.indexOf(key)
let s = i + key.length - 1, d = 0, q = null, esc = false, arrEnd = -1
for(let j = s; j < t.length; j++){
  const c = t[j]
  if(esc){ esc = false; continue }
  if(c === '\\'){ esc = true; continue }
  if(q){ if(c === q) q = null; continue }
  if(c === "'" || c === '"' || c === '`'){ q = c; continue }
  if(c === '[') d++
  else if(c === ']'){ d--; if(d === 0){ arrEnd = j; break } }
}
const arrSrc = t.slice(s, arrEnd + 1)
const cleaned = arrSrc.replace(/cover:"data:[^"]*"/g, 'cover:""')

// —— 在沙箱里执行分类逻辑 ——
const sandbox = new Function(block + '\nreturn {inferCategories, districtOf, CAT_DEFS, CQ_DISTRICTS, NATIONAL_SCHOOLS}')
const { inferCategories, districtOf, CAT_DEFS, CQ_DISTRICTS, NATIONAL_SCHOOLS } = sandbox()
const data = new Function('return ' + cleaned)()

const CN = Object.fromEntries(CAT_DEFS.map(d => [d.k, d.label]))
console.log('\n分类体系: ' + CAT_DEFS.map(d => d.icon + d.label).join('   '))
console.log('重庆区县库: ' + CQ_DISTRICTS.length + ' 个    全国院校库: ' + NATIONAL_SCHOOLS.length + ' 所')

console.log('\n=== 4 条数据的分类结果 ===')
data.forEach((p, n) => {
  const cats = inferCategories(p)
  const dist = districtOf(p)
  console.log('\n[' + (n + 1) + '] ' + p.title)
  console.log('    主办: ' + (p.org || '—'))
  console.log('    分类: ' + (cats.map(k => CN[k] || k).join(' / ') || '(无)'))
  console.log('    区域: ' + (dist || '—'))
})

console.log('\n=== 各分类条目数 ===')
CAT_DEFS.forEach(d => {
  if(d.k === 'all'){ console.log('  ' + d.label + ': ' + data.length); return }
  const n = data.filter(p => inferCategories(p).includes(d.k)).length
  console.log('  ' + d.icon + ' ' + d.label + ': ' + n)
})
