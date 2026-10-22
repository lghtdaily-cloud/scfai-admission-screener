// tools/auto-fetch/patch-frontend.js
// 前端补丁：非微信链接的卡片，按钮从「详情」改为「复制标题用微信搜」
//
// 背景：微信文章链接无法自动获取（搜狗反爬 + 微信内容对外封闭），
// 部分条目 url 为空。原「详情」按钮会弹 toast，体验生硬。
// 改为：提供「复制标题用微信搜」，一键复制"公众号名 + 标题"，用户粘到微信搜索框即可找到原文。
//
// 用法: node patch-frontend.js [--dry-run]

const fs = require('fs')

const TARGETS = [
  'C:\\Users\\美人鱼\\WorkBuddy\\2026-09-16-19-51-19\\dist\\index.html',
  'C:\\Users\\美人鱼\\WorkBuddy\\2026-09-16-19-51-19\\webapp\\index.html'
]

const dryRun = process.argv.includes('--dry-run')

// ---------- 1) 插入 isWxUrl 辅助函数 ----------
const ANCHOR_FN = 'function projectCard(p,opts){'
const HELPER = `function isWxUrl(u){ return !!u && /^https?:\\/\\/mp\\.weixin\\.qq\\.com\\//.test(u) }
function copyWxHint(p){
  const org=(p.org||'').trim()
  const txt=(org?org+' ':'')+p.title
  const done=()=>toast('已复制，去微信搜索框粘贴即可找到原文')
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(txt).then(done).catch(()=>fallbackCopy(txt,done))
  } else { fallbackCopy(txt,done) }
}
function fallbackCopy(txt,cb){
  const ta=document.createElement('textarea')
  ta.value=txt; ta.style.position='fixed'; ta.style.opacity='0'
  document.body.appendChild(ta); ta.select()
  try{ document.execCommand('copy'); cb() }catch(e){ toast(txt) }
  document.body.removeChild(ta)
}
`

// ---------- 2) 卡片按钮：非微信链接时改为「复制」 ----------
const OLD_BTN = `    : '<button class="btn btn-line btn-sm" data-act="src" data-id="'+p._id+'">详情</button>'+
      '<button class="btn btn-primary btn-sm" data-act="apply" data-id="'+p._id+'" data-star>立即报名</button>'`

const NEW_BTN = `    : (isWxUrl(p.url)
        ? '<button class="btn btn-line btn-sm" data-act="src" data-id="'+p._id+'">详情</button>'
        : '<button class="btn btn-line btn-sm" data-act="copy" data-id="'+p._id+'">复制标题用微信搜</button>')+
      '<button class="btn btn-primary btn-sm" data-act="apply" data-id="'+p._id+'" data-star>立即报名</button>'`

// ---------- 3) 事件绑定：处理 copy 动作 ----------
const OLD_BIND = `      if(b.dataset.act==='apply') applyTo(p)
      else openSource(p)`
const NEW_BIND = `      if(b.dataset.act==='apply') applyTo(p)
      else if(b.dataset.act==='copy') copyWxHint(p)
      else openSource(p)`

// ---------- 4) openSource 兜底：非微信链接给引导 ----------
const OLD_OPEN = `function openSource(p){
  if(!p.url){ toast('该项目没有填写原文链接'); return }
  window.open(p.url,'_blank','noopener')
}`
const NEW_OPEN = `function openSource(p){
  if(!p.url){ copyWxHint(p); return }
  if(!isWxUrl(p.url)){
    const go=confirm('该链接来自非微信公众号（可能需登录或已失效）。\\n\\n是否改用「复制标题去微信搜索」？')
    if(go){ copyWxHint(p); return }
  }
  window.open(p.url,'_blank','noopener')
}`

function patch(file) {
  if (!fs.existsSync(file)) { console.log('跳过（不存在）', file); return false }
  let t = fs.readFileSync(file, 'utf8')
  const before = t.length
  const applied = []

  // 1) helper（幂等：已存在则跳过）
  if (!t.includes('function isWxUrl(')) {
    const i = t.indexOf(ANCHOR_FN)
    if (i === -1) { console.log('  ✗ 找不到 projectCard 锚点'); return false }
    t = t.slice(0, i) + HELPER + t.slice(i)
    applied.push('插入 isWxUrl / copyWxHint 辅助函数')
  }

  // 2) 按钮
  if (t.includes(OLD_BTN)) {
    t = t.replace(OLD_BTN, NEW_BTN)
    applied.push('卡片按钮：非微信链接改为「复制标题用微信搜」')
  } else if (t.includes('data-act="copy"')) {
    console.log('  · 按钮已打过补丁，跳过')
  } else {
    console.log('  ✗ 按钮代码未匹配（可能格式有变）')
  }

  // 3) 绑定
  if (t.includes(OLD_BIND)) {
    t = t.replace(OLD_BIND, NEW_BIND)
    applied.push('事件绑定：新增 copy 动作')
  } else if (t.includes("b.dataset.act==='copy'")) {
    console.log('  · 绑定已打过补丁，跳过')
  } else {
    console.log('  ✗ 绑定代码未匹配')
  }

  // 4) openSource
  if (t.includes(OLD_OPEN)) {
    t = t.replace(OLD_OPEN, NEW_OPEN)
    applied.push('openSource：非微信链接改为确认后复制标题')
  } else if (t.includes('是否改用「复制标题去微信搜索」')) {
    console.log('  · openSource 已打过补丁，跳过')
  } else {
    console.log('  ✗ openSource 未匹配')
  }

  if (!applied.length) { console.log('  无改动'); return false }

  console.log(`  ✓ 应用 ${applied.length} 处改动:`)
  applied.forEach(a => console.log(`     - ${a}`))

  if (dryRun) { console.log('  dry-run，不写入'); return false }

  const bak = file + '.bak-patch-' + Date.now()
  fs.writeFileSync(bak, fs.readFileSync(file), 'binary')
  console.log('  备份 ->', bak.split('\\').pop())

  fs.writeFileSync(file, t, 'utf8')
  console.log(`  已写入 (${before} → ${t.length} 字符)`)
  return true
}

let n = 0
TARGETS.forEach(f => { console.log('处理:', f.split('\\').pop()); if (patch(f)) n++ })
console.log(`\n完成，改动 ${n} 个文件`)
