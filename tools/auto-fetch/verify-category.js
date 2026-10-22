#!/usr/bin/env node
/** verify-category.js —— 校验分类补丁是否正确落地 + 数组语法/唯一性 */
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..', '..')
const FILES = [
  ['dist/index.html', path.join(ROOT, 'dist', 'index.html')],
  ['webapp/index.html', path.join(ROOT, 'webapp', 'index.html')],
  ['dist/单文件体验版.html', path.join(ROOT, 'dist', '川美招生筛选-单文件体验版.html')],
]

function extractArray(src, name){
  const key = 'const ' + name + '=['
  const i = src.indexOf(key)
  if(i < 0) return null
  let s = i + key.length - 1, d = 0, q = null, esc = false
  for(let j = s; j < src.length; j++){
    const c = src[j]
    if(esc){ esc = false; continue }
    if(c === '\\'){ esc = true; continue }
    if(q){ if(c === q) q = null; continue }
    if(c === "'" || c === '"' || c === '`'){ q = c; continue }
    if(c === '[') d++
    else if(c === ']'){ d--; if(d === 0) return src.slice(s, j + 1) }
  }
  return null
}

function scriptBlocks(src){
  const out = []
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi
  let m
  while((m = re.exec(src))) out.push(m[1])
  return out
}

let fail = 0
FILES.forEach(([label, file]) => {
  console.log('\n=== ' + label + ' ===')
  if(!fs.existsSync(file)){ console.log('  ✗ 文件不存在'); fail++; return }
  const t = fs.readFileSync(file, 'utf8')
  console.log('  长度: ' + t.length)

  // 补丁点检查
  const checks = [
    ['CAT_DEFS 分类定义', 'const CAT_DEFS=['],
    ['inferCategories 推断', 'function inferCategories('],
    ['ensureCats 补全', 'function ensureCats('],
    ['catHas 判定', 'function catHas('],
    ['catTagHTML 标签', 'function catTagHTML('],
    ['pCat 状态变量', "pCat='all'"],
    ['#p-cats 容器', 'id="p-cats"'],
    ['分类栏渲染', "const cb=$('#p-cats')"],
    ['分类栏条目 DOM', "'<div class=\"catchip'"],
    ['分类过滤', "if(typeof pCat!=='undefined' && pCat!=='all')"],
    ['分类标签渲染', 'const catTags=catTagHTML(p)'],
    ['CSS .catchip', '.catchip{'],
    ['CSS .ctag', '.ctag{'],
    ['渲染前补全 cats', 'DB.projects.forEach(ensureCats)'],
  ]
  checks.forEach(([name, needle]) => {
    const hit = t.includes(needle)
    console.log('  ' + (hit ? '✓' : '✗') + ' ' + name)
    if(!hit) fail++
  })

  // WX_PROJECTS 数组语法
  const arr = extractArray(t, 'WX_PROJECTS')
  if(!arr){ console.log('  ✗ 未找到 WX_PROJECTS'); fail++; return }
  let data
  try {
    data = new Function('return ' + arr)()
    console.log('  ✓ WX_PROJECTS 语法正确，条目数 = ' + data.length)
  } catch(e){
    console.log('  ✗ WX_PROJECTS 语法错误: ' + e.message); fail++; return
  }

  // _id 唯一性 & 字段
  const ids = data.map(x => x._id)
  const dup = ids.filter((v, i) => ids.indexOf(v) !== i)
  console.log('  ' + (dup.length ? '✗ 重复 _id: ' + dup.join(',') : '✓ 无重复 _id'))
  if(dup.length) fail++

  const noUrl = data.filter(x => !x.url)
  console.log('  ' + (noUrl.length ? '⚠ 无链接条目 ' + noUrl.length + ' 条' : '✓ 全部有链接'))

  const notWx = data.filter(x => x.url && !/^https:\/\/mp\.weixin\.qq\.com\//.test(x.url))
  console.log('  ' + (notWx.length ? '✗ 非微信链接 ' + notWx.length + ' 条: ' + notWx.map(x => x.title).join(' / ') : '✓ 全部为微信公众号链接'))
  if(notWx.length) fail++

  // 分类推断结果预览
  // 注意：p.cats 是渲染时由 ensureCats 生成的，数组里并不存储，
  // 所以早期版本读 p.cats 永远得到「(未标注)」。这里改为用页面里真实的
  // inferCategories / districtOf 逻辑实算。
  console.log('  --- 分类推断预览 ---')
  const CN = { academic: '学术类', practice: '实践类', scfai: '川美', chongqing: '重庆', national: '全国院校' }
  let infer = null, districtOf = null
  try {
    const ls = t.split(/\r?\n/)
    const a = ls.findIndex(l => l.includes('const CAT_DEFS=['))
    const b = ls.findIndex((l, n) => n > a && l.includes('function ensureCats('))
    if (a >= 0 && b > a) {
      let depth = 0, started = false, bEnd = -1
      for (let n = b; n < ls.length; n++) {
        for (const ch of ls[n]) { if (ch === '{') { depth++; started = true } else if (ch === '}') depth-- }
        if (started && depth === 0) { bEnd = n; break }
      }
      const sb = new Function(ls.slice(a, bEnd + 1).join('\n') + '\nreturn {inferCategories, districtOf}')
      const o = sb(); infer = o.inferCategories; districtOf = o.districtOf
    }
  } catch (e) { console.log('    (无法提取推断逻辑，跳过预览: ' + e.message + ')') }

  if (infer) {
    data.forEach(p => {
      const cats = (infer(p) || []).map(k => CN[k] || k).join(' / ') || '(无)'
      const dist = districtOf ? districtOf(p) : ''
      console.log('    · ' + p.title.slice(0, 34) + '  →  [' + cats + ']' + (dist ? ' 📍' + dist : ''))
    })
  }

  // 内联脚本整体语法
  const blocks = scriptBlocks(t)
  let bad = 0
  blocks.forEach((b, i) => {
    try { new Function(b) } catch(e){
      // 有些脚本块使用了顶层 return/import 等，忽略这类
      if(!/return|import|await/.test(e.message)){ bad++; console.log('  ✗ 脚本#' + i + ' 语法错误: ' + e.message) }
    }
  })
  console.log('  ' + (bad ? '✗ ' + bad + ' 个脚本块有问题' : '✓ ' + blocks.length + ' 个内联脚本语法通过'))
  if(bad) fail++
})

console.log('\n' + (fail ? '❌ 共 ' + fail + ' 项校验失败' : '✅ 全部校验通过'))
process.exit(fail ? 1 : 0)
