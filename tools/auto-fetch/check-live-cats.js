const https = require('https')
const URL = 'https://scfai-screener-demo.app.workbuddy.host/'

https.get(URL, res => {
  let d = ''
  res.on('data', c => d += c)
  res.on('end', () => {
    console.log('状态码:', res.statusCode)
    console.log('长度:', d.length)
    const checks = [
      ['CAT_DEFS 分类定义', 'const CAT_DEFS=['],
      ['inferCategories', 'function inferCategories('],
      ['catHas 判定', 'function catHas('],
      ['#p-cats 容器', 'id="p-cats"'],
      ['分类栏渲染', "const cb=$('#p-cats')"],
      ['分类过滤', "if(typeof pCat!=='undefined' && pCat!=='all')"],
      ['分类标签', 'const catTags=catTagHTML(p)'],
      ['CSS .catchip', '.catchip{'],
      ['CSS .ctag', '.ctag{'],
      ['微信链接按钮', 'data-act="copy"'],
      ['copyWxHint', 'function copyWxHint('],
      ['isWxUrl', 'function isWxUrl('],
    ]
    checks.forEach(([n, s]) => console.log('  ' + (d.includes(s) ? '✓' : '✗') + ' ' + n))

    // 抽取 WX_PROJECTS 并统计
    const key = 'const WX_PROJECTS=['
    const i = d.indexOf(key)
    if(i >= 0){
      let s = i + key.length - 1, dep = 0, q = null, esc = false, end = -1
      for(let j = s; j < d.length; j++){
        const c = d[j]
        if(esc){ esc = false; continue }
        if(c === '\\'){ esc = true; continue }
        if(q){ if(c === q) q = null; continue }
        if(c === "'" || c === '"' || c === '`'){ q = c; continue }
        if(c === '[') dep++
        else if(c === ']'){ dep--; if(dep === 0){ end = j; break } }
      }
      const arr = d.slice(s, end + 1).replace(/cover:"data:[^"]*"/g, 'cover:""')
      try {
        const data = new Function('return ' + arr)()
        console.log('\n项目库条目数:', data.length)
        data.forEach((p, n) => {
          const wx = /^https:\/\/mp\.weixin\.qq\.com\//.test(p.url)
          console.log('  ' + (n + 1) + '. ' + p.title.slice(0, 40))
          console.log('     ' + (wx ? '✓ 微信链接' : '✗ 非微信链接') + '  ' + p.url.slice(0, 60))
        })
      } catch(e){ console.log('\nWX_PROJECTS 解析失败:', e.message) }
    }
  })
}).on('error', e => console.log('请求失败:', e.message))
