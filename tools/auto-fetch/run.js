// tools/auto-fetch/run.js
// 每日自动检索总调度（微信公众号侧）
//   1. 多关键词轮询调用 wechat-article-search（搜狗微信）
//   2. 汇总原始结果到 data/raw-<date>.json
//   3. 调用 ingest.js 做过滤/去重/入库（含「只要微信链接」白名单）
//
// 用法: node run.js [--days 1] [--dry-run] [--max 12] [--all]
//   --days N   只收录最近 N 天发布的信息（默认 1）
//   --max N    每个关键词最多取多少条（默认 12）
//   --dry-run  只预览不写库
//   --all      使用全部关键词（默认只跑川美+重庆，不含全国院校）

const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const ROOT = 'C:\\Users\\美人鱼\\WorkBuddy\\2026-09-16-19-51-19'
const WORK = path.join(ROOT, 'data')
const SEARCH_SCRIPT = 'C:\\Users\\美人鱼\\.workbuddy\\skills\\wechat-article-search\\scripts\\search_wechat.js'
const SEARCH_CWD = 'C:\\Users\\美人鱼\\.workbuddy\\skills\\wechat-article-search'
const NODE_MODULES = 'C:\\Users\\美人鱼\\.workbuddy\\binaries\\node\\workspace\\node_modules'

const K = require('./keywords.js')

function log(...a) { console.log('[run]', ...a) }

function today() {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

function daysAgo(n) {
  const d = new Date(Date.now() - n * 86400000)
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const useAll = args.includes('--all')
  const days = Number((args.find(a => a.startsWith('--days')) || '').split(/[= ]/)[1]) || 1
  const maxN = Number((args.find(a => a.startsWith('--max')) || '').split(/[= ]/)[1]) || 12

  if (!fs.existsSync(WORK)) fs.mkdirSync(WORK, { recursive: true })

  let allKeywords = [].concat(
    K.SCFAI_COLLEGES,
    K.SCFAI_SCHOOL,
    K.CQ_ART_KEYWORDS
  )
  if (useAll) {
    allKeywords = allKeywords.concat(K.NATIONAL_ART_SCHOOLS, K.ACADEMIC_FORUM_KEYWORDS)
  }

  log(`关键词数: ${allKeywords.length} | 每词取 ${maxN} 条 | 只保留近 ${days} 天 | 全国院校: ${useAll ? '含' : '不含'}`)

  const batches = []
  let okCount = 0, failCount = 0, rawTotal = 0

  allKeywords.forEach((kw, idx) => {
    const outFile = path.join(WORK, `_kw_${idx}.json`)
    try {
      execFileSync(process.execPath, [SEARCH_SCRIPT, kw, '-n', String(maxN), '-o', outFile], {
        cwd: SEARCH_CWD,
        env: Object.assign({}, process.env, { NODE_PATH: NODE_MODULES }),
        stdio: 'pipe',
        timeout: 90000
      })
      if (fs.existsSync(outFile)) {
        const j = JSON.parse(fs.readFileSync(outFile, 'utf8'))
        // 搜狗返回的是中间跳转链接，无法直接得到 mp.weixin.qq.com 真实链接。
        // 用 -r 参数可尝试解析，但反爬严重、成功率低。
        // 这里的策略：保留 url，由 ingest.js 的白名单决定取舍；
        // 另用 WebSearch 侧补齐微信链接（见 automation 提示词）。
        const arr = (j.articles || []).map(a => Object.assign({}, a, { _query: kw }))
        batches.push({ query: kw, articles: arr })
        rawTotal += arr.length
        okCount++
        log(`  ✓ ${kw} -> ${arr.length} 条`)
        fs.unlinkSync(outFile)
      } else {
        failCount++
        log(`  ✗ ${kw} -> 无输出`)
      }
    } catch (e) {
      failCount++
      log(`  ✗ ${kw} -> ${String(e.message).slice(0, 80)}`)
    }
  })

  log(`检索完成: 成功 ${okCount} / 失败 ${failCount} / 原始 ${rawTotal} 条`)

  const stamp = today()
  const rawPath = path.join(WORK, `raw-${stamp}.json`)
  fs.writeFileSync(rawPath, JSON.stringify({ generatedAt: new Date().toISOString(), batches }, null, 2), 'utf8')
  log(`原始汇总 -> ${path.basename(rawPath)}`)

  const cutoff = daysAgo(days)
  const ingestArgs = [path.join(__dirname, 'ingest.js'), rawPath, cutoff]
  if (dryRun) ingestArgs.push('--dry-run')

  log(`执行入库 (cutoff=${cutoff})...`)
  execFileSync(process.execPath, ingestArgs, { stdio: 'inherit', cwd: __dirname })
  log('入库完成')
}

main()
