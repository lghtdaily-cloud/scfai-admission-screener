// tools/auto-fetch/resolve-wx.js
// 把搜狗微信中转链接解析为真实的 mp.weixin.qq.com 链接
//
// 背景：wechat-article-search 返回的是 weixin.sogou.com/link?url=... 中转链接。
// 该链接在浏览器里会 302 跳转到真实微信文章，但需要带 Referer 且会触发验证码。
//
// 本脚本尝试多种策略：
//   1) 直接请求中转链接，跟随重定向，从 Location 头拿真实地址
//   2) 请求后从 HTML 里正则提取 mp.weixin.qq.com/s?...
//   3) 失败则标记 unresolved
//
// 用法: node resolve-wx.js <input.json> <output.json> [--limit 10]

const fs = require('fs')
const https = require('https')
const http = require('http')

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

function fetchOnce(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return resolve({ ok: false, reason: 'too many redirects' })
    const mod = url.startsWith('https') ? https : http
    const req = mod.get(url, {
      headers: {
        'User-Agent': UA,
        'Referer': 'https://weixin.sogou.com/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9'
      },
      timeout: 15000
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume()
        let next = res.headers.location
        if (next.startsWith('/')) next = 'https://weixin.sogou.com' + next
        if (/mp\.weixin\.qq\.com/.test(next)) {
          return resolve({ ok: true, url: next, via: 'location' })
        }
        return fetchOnce(next, redirects + 1).then(resolve).catch(reject)
      }
      let body = ''
      res.setEncoding('utf8')
      res.on('data', c => { if (body.length < 300000) body += c })
      res.on('end', () => {
        // 从 HTML 里找真实微信链接
        const m = body.match(/https?:\/\/mp\.weixin\.qq\.com\/s[^"'\s<>\\]*/)
        if (m) return resolve({ ok: true, url: m[0].replace(/&amp;/g, '&'), via: 'body' })
        // 也检查是否被要求验证码
        if (/验证码|antispider|请输入验证码/.test(body)) {
          return resolve({ ok: false, reason: 'captcha' })
        }
        resolve({ ok: false, reason: 'no-link-found', status: res.statusCode })
      })
    })
    req.on('error', e => resolve({ ok: false, reason: 'error:' + e.message }))
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, reason: 'timeout' }) })
  })
}

async function main() {
  const inPath = process.argv[2]
  const outPath = process.argv[3] || inPath.replace(/\.json$/, '.resolved.json')
  const limit = Number((process.argv.find(a => a.startsWith('--limit')) || '').split(/[= ]/)[1]) || 20

  if (!inPath || !fs.existsSync(inPath)) {
    console.error('用法: node resolve-wx.js <input.json> [output.json] [--limit N]')
    process.exit(1)
  }

  const raw = JSON.parse(fs.readFileSync(inPath, 'utf8'))
  let items = raw.articles || raw.results || raw || []
  if (raw.batches) {
    items = []
    raw.batches.forEach(b => items = items.concat(b.articles || []))
  }

  // 只处理搜狗中转链接
  const targets = items.filter(it => /weixin\.sogou\.com\/link/.test(it.url || '')).slice(0, limit)
  console.log(`待解析 ${targets.length} 条（总 ${items.length} 条）`)

  let ok = 0, fail = 0
  const reasons = {}

  for (let i = 0; i < targets.length; i++) {
    const it = targets[i]
    const r = await fetchOnce(it.url)
    if (r.ok) {
      it.url = r.url
      it._resolvedVia = r.via
      ok++
      console.log(`  ✓ [${i + 1}] ${String(it.title).slice(0, 40)}`)
    } else {
      fail++
      reasons[r.reason] = (reasons[r.reason] || 0) + 1
      it._resolveFailed = r.reason
      console.log(`  ✗ [${i + 1}] ${r.reason} — ${String(it.title).slice(0, 40)}`)
    }
    await new Promise(r => setTimeout(r, 1200))  // 礼貌间隔
  }

  console.log(`\n解析结果: 成功 ${ok} / 失败 ${fail}`)
  console.log('失败原因分布:', JSON.stringify(reasons))

  fs.writeFileSync(outPath, JSON.stringify(raw, null, 2), 'utf8')
  console.log('已写入', outPath)
}

main()
