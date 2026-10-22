#!/usr/bin/env node
/**
 * patch-category.js —— 给首页项目库增加「分类」能力（幂等）
 *
 * 目标文件：dist/index.html、webapp/index.html、dist/川美招生筛选-单文件体验版.html
 *
 * 改动内容（4 处）：
 *   1) 新增分类推断函数 inferCategories() + 分类常量 CAT_DEFS
 *   2) seedProjects() 里为每个项目补 cats 字段
 *   3) 首页 HTML 里 #p-filters 下方增加一条 #p-cats 分类筛选栏
 *   4) renderFilters() 里同时渲染分类栏；filteredProjects() 里按分类过滤
 *   5) projectCard() 里显示分类小标签
 *
 * 幂等：已打过补丁（检测到 CAT_DEFS 标记）则直接跳过。
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..', '..')
const TARGETS = [
  path.join(ROOT, 'dist', 'index.html'),
  path.join(ROOT, 'webapp', 'index.html'),
  path.join(ROOT, 'dist', '川美招生筛选-单文件体验版.html'),
]

const MARK = '/* __CATEGORY_PATCH__ */'

/* ---------- 1. 分类定义 + 推断逻辑 ---------- */
const CAT_BLOCK = MARK + `
/* 分类体系：学术类 / 实践类 / 川美 / 重庆各区 */
const CAT_DEFS=[
  {k:'all',   label:'全部分类', icon:'▦'},
  {k:'academic', label:'学术类', icon:'📖'},
  {k:'practice', label:'实践类', icon:'🛠'},
  {k:'scfai',    label:'川美',   icon:'🎓'},
  {k:'chongqing',label:'重庆',   icon:'📍'},
  {k:'national', label:'全国院校', icon:'🏛'}
]
/* 重庆各区（用于更细的定位标签） */
const CQ_DISTRICTS=['沙坪坝','渝北','渝中','九龙坡','南岸','江北','大渡口','北碚','巴南','璧山','永川','涪陵','合川','江津','长寿','铜梁','潼南','荣昌','大足','綦江','万州','黔江','武隆','巫山','奉节','云阳','开州','梁平','城口','丰都','垫江','忠县','云阳','石柱','秀山','酉阳','彭水','两江新区','高新区','西部科学城']
const NATIONAL_SCHOOLS=['中央美术学院','中国美术学院','清华大学美术学院','上海大学','南京艺术学院','广州美术学院','天津美术学院','鲁迅美术学院','西安美术学院','湖北美术学院','中国传媒大学','同济大学','江南大学','北京服装学院','中央戏剧学院','中国戏曲学院','上海戏剧学院','北京电影学院','中央音乐学院','中国音乐学院']

function inferCategories(p){
  const out=[]
  const t=[p.title,p.org,p.summary,(p.parsed&&(p.parsed.hard||[]).join(' '))||''].join(' ')

  // —— 学术类 / 实践类 ——
  const academicRe=/(学术|论坛|研讨会|沙龙|讲座|讲坛|征稿|论文|课题|研究|学术营|研修|报告会|读书会|非遗|理论|批评|策展研究|会议|workshop学术|summer school|暑期学校|研学)/
  const practiceRe=/(工作坊|招募|实践|报名|征集|参赛|竞赛|大赛|展览|驻留|驻地|创作营|训练营|实训|志愿服务|志愿者|项目招募|实习|市集|演出|表演|公教|美育|体验营|workshop)/
  if(academicRe.test(t)) out.push('academic')
  if(practiceRe.test(t)) out.push('practice')
  if(!out.length) out.push('practice')

  // —— 川美 ——
  const scfaiRe=/(四川美术学院|川美|SCFAI|造型艺术|实验艺术|艺术人文|公共艺术|建筑与环境设计|中国画与书法|动画影视|设计学院|美术馆)/
  if(scfaiRe.test(t)) out.push('scfai')

  // —— 重庆 ——
  const cqRe=/(重庆|渝|巴渝|山城|两江|川渝|成渝|西南大学|重庆大学|四川美术学院|川美)/
  if(cqRe.test(t)) out.push('chongqing')

  // —— 全国院校 ——
  const natRe=new RegExp('('+NATIONAL_SCHOOLS.join('|')+')')
  if(natRe.test(t)) out.push('national')

  return Array.from(new Set(out))
}
function districtOf(p){
  const t=[p.title,p.org,p.summary].join(' ')
  const hit=CQ_DISTRICTS.find(d=>t.includes(d))
  return hit||''
}
function ensureCats(p){
  if(!p||typeof p!=='object') return p
  if(!Array.isArray(p.cats)||!p.cats.length) p.cats=inferCategories(p)
  if(p.district===undefined) p.district=districtOf(p)
  return p
}
`

/* ---------- 2. 分类筛选栏 HTML ---------- */
const CATS_HTML_OLD = `    <div class="chips" id="p-filters" style="margin-top:10px"></div>
  </div>`
const CATS_HTML_NEW = `    <div class="chips" id="p-filters" style="margin-top:10px"></div>
    <div class="cats" id="p-cats" style="margin-top:8px"></div>
  </div>`

/* ---------- 3. renderFilters 增强 ---------- */
const RF_OLD = `function renderFilters(){
  const fs=[['all','全部'],['open','进行中'],['soon','7 天内截止'],['over','已截止']]
  $('#p-filters').innerHTML=fs.map(([k,v])=>'<div class="chip'+(pFilter===k?' on':'')+'" data-f="'+k+'">'+v+'</div>').join('')
  $$('#p-filters .chip').forEach(c=>c.onclick=()=>{ pFilter=c.dataset.f; renderFilters(); renderProjects() })
}`
const RF_NEW = `function renderFilters(){
  const fs=[['all','全部'],['open','进行中'],['soon','7 天内截止'],['over','已截止']]
  $('#p-filters').innerHTML=fs.map(([k,v])=>'<div class="chip'+(pFilter===k?' on':'')+'" data-f="'+k+'">'+v+'</div>').join('')
  $$('#p-filters .chip').forEach(c=>c.onclick=()=>{ pFilter=c.dataset.f; renderFilters(); renderProjects() })
  /* 分类栏 */
  const cb=$('#p-cats'); if(!cb) return
  cb.innerHTML='<div class="cats-hint">项目分类</div>'+CAT_DEFS.map(d=>{
    const n=d.k==='all'?DB.projects.length:DB.projects.filter(p=>catHas(p,d.k)).length
    return '<div class="catchip'+(pCat===d.k?' on':'')+'" data-c="'+d.k+'">'+
      '<span class="ci">'+d.icon+'</span>'+d.label+'<span class="cn">'+n+'</span></div>'
  }).join('')
  $$('#p-cats .catchip').forEach(c=>c.onclick=()=>{ pCat=c.dataset.c; renderFilters(); renderProjects() })
}
function catHas(p,k){
  if(k==='all') return true
  ensureCats(p)
  return (p.cats||[]).includes(k)
}`
const RF_MARK = '/* __CATEGORY_PATCH__ */function catHas('

/* ---------- 4. filteredProjects 增加分类过滤 ---------- */
const FP_OLD = `function filteredProjects(){
  const kw=pKw.trim().toLowerCase()
  let list=DB.projects.slice()`
const FP_NEW = `function filteredProjects(){
  const kw=pKw.trim().toLowerCase()
  let list=DB.projects.slice()
  /* 分类过滤 */
  if(typeof pCat!=='undefined' && pCat!=='all') list=list.filter(p=>catHas(p,pCat))`

/* ---------- 5. 项目卡片显示分类标签 ---------- */
const PC_OLD = `  const cr=p.parsed||{}
  const req=[].concat(cr.hard||[]).slice(0,2).map(esc).join(' · ')`
const PC_NEW = `  const cr=p.parsed||{}
  const req=[].concat(cr.hard||[]).slice(0,2).map(esc).join(' · ')
  const catTags=catTagHTML(p)`

const PC_OLD2 = `      '<div class="t">'+esc(p.title)+'</div>'+
      '<div class="m">'+esc(p.org||'未注明主办方')+'</div>'+`
const PC_NEW2 = `      catTags+
      '<div class="t">'+esc(p.title)+'</div>'+
      '<div class="m">'+esc(p.org||'未注明主办方')+'</div>'+`

/* ---------- 6. catTagHTML 辅助函数 ---------- */
const CAT_TAG_FN = `function catTagHTML(p){
  ensureCats(p)
  const map={academic:['academic','📖 学术类'],practice:['practice','🛠 实践类'],scfai:['scfai','🎓 川美'],chongqing:['chongqing','📍 重庆'],national:['national','🏛 全国院校']}
  const list=(p.cats||[]).map(k=>map[k]).filter(Boolean)
  if(p.district) list.push(['district','📍 '+p.district])
  if(!list.length) return ''
  return '<div class="cattags">'+list.map(([k,v])=>'<span class="ctag c-'+k+'">'+v+'</span>').join('')+'</div>'
}
`

/* ---------- 7. CSS ---------- */
const CSS_ADD = MARK + `
.cats{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.cats-hint{font-size:12px;color:#8a94a6;font-weight:600;margin-right:2px}
.catchip{display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border-radius:999px;
  background:#fff;border:1px solid #e3e8f0;font-size:13px;color:#3d4759;cursor:pointer;
  transition:.16s;user-select:none}
.catchip:hover{border-color:#c6d2e6;background:#f7f9fd}
.catchip.on{background:linear-gradient(135deg,#2f6bff,#4b8bff);border-color:transparent;color:#fff;
  box-shadow:0 4px 12px rgba(47,107,255,.28)}
.catchip .ci{font-size:13px}
.catchip .cn{font-size:11px;padding:1px 6px;border-radius:999px;background:#eef2f9;color:#6b7688;font-weight:700}
.catchip.on .cn{background:rgba(255,255,255,.26);color:#fff}
.cattags{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px}
.ctag{font-size:11px;padding:2px 8px;border-radius:6px;font-weight:600;white-space:nowrap}
.ctag.c-academic{background:#eef0ff;color:#4b4fd6}
.ctag.c-practice{background:#e8f7f0;color:#12855e}
.ctag.c-scfai{background:#fff2e8;color:#c2661b}
.ctag.c-chongqing{background:#e9f4ff;color:#1a6fc4}
.ctag.c-national{background:#f4ecff;color:#7a3fd0}
.ctag.c-district{background:#f0f2f6;color:#5c6675}
`

/* ---------- 应用 ---------- */
function apply(file){
  if(!fs.existsSync(file)){ console.log('  [跳过] 不存在: '+file); return false }
  let t = fs.readFileSync(file, 'utf8')
  if(t.includes(MARK)){
    console.log('  [已打过补丁] '+path.basename(file))
    return false
  }
  const before = t.length
  let ok = 0

  // 1) 注入分类代码块（放在项目库声明之前）
  const anchor = '/* ==================== 项目库与首页 ==================== */'
  if(t.includes(anchor)){
    t = t.replace(anchor, anchor + '\n' + CAT_BLOCK)
    ok++
  } else {
    console.log('  [警告] 未找到注入锚点（项目库与首页）')
  }

  // 2) 状态变量 pCat
  const st = "let pKw='', pFilter='all'"
  if(t.includes(st)){ t = t.replace(st, st + ", pCat='all'"); ok++ }
  else console.log('  [警告] 未找到 pKw/pFilter 声明')

  // 3) HTML 分类栏容器
  if(t.includes(CATS_HTML_OLD)){ t = t.replace(CATS_HTML_OLD, CATS_HTML_NEW); ok++ }
  else console.log('  [警告] 未找到 #p-filters 容器')

  // 4) renderFilters + catHas
  if(t.includes(RF_OLD)){ t = t.replace(RF_OLD, RF_NEW); ok++ }
  else console.log('  [警告] 未找到 renderFilters')

  // 5) filteredProjects 分类过滤
  if(t.includes(FP_OLD)){ t = t.replace(FP_OLD, FP_NEW); ok++ }
  else console.log('  [警告] 未找到 filteredProjects')

  // 6) 卡片分类标签
  if(t.includes(PC_OLD) && t.includes(PC_OLD2)){
    t = t.replace(PC_OLD, PC_NEW)
    t = t.replace(PC_OLD2, PC_NEW2)
    ok++
  } else console.log('  [警告] 未找到 projectCard 片段')

  // 7) catTagHTML 辅助函数
  if(t.includes('function filteredProjects(){')){
    t = t.replace('function filteredProjects(){', CAT_TAG_FN + 'function filteredProjects(){')
    ok++
  }

  // 8) CSS
  const cssEnd = '</style>'
  const li = t.indexOf(cssEnd)
  if(li >= 0){ t = t.slice(0, li) + CSS_ADD + t.slice(li); ok++ }
  else console.log('  [警告] 未找到 </style>')

  // 9) 首次渲染时确保 cats 已注入
  const rp = 'function renderProjects(){'
  if(t.includes(rp)){
    t = t.replace(rp, rp + '\n  DB.projects.forEach(ensureCats)')
    ok++
  }

  fs.writeFileSync(file, t, 'utf8')
  console.log('  [完成] ' + path.basename(file) + '  ' + before + ' -> ' + t.length + '  成功替换 ' + ok + '/9')
  return true
}

console.log('=== 应用分类补丁 ===')
let n = 0
TARGETS.forEach(f => { if(apply(f)) n++ })
console.log('共更新 ' + n + ' 个文件')
