// tools/auto-fetch/fix-scfai-re.js
// 修正前端「川美」分类的误判规则（幂等，可重复运行）
//
// 问题：原 scfaiRe 里包含裸词「美术馆」「设计学院」，
//       导致「南京艺术学院美术馆」这类外校条目被误判为「🎓 川美」。
// 修正：去掉裸词「美术馆」「设计学院」，改为川美专属标识；
//       同时补入「四川美院」以覆盖"四川美院美术馆"这类常见简称。
//
// 用法: node fix-scfai-re.js [--dry-run]

const fs = require('fs')
const path = require('path')

const ROOT = 'C:\\Users\\美人鱼\\WorkBuddy\\2026-09-16-19-51-19'
const TARGETS = [
  'dist/index.html',
  'webapp/index.html',
  'dist/川美招生筛选-单文件体验版.html'
]

const OLD = 'const scfaiRe=/(四川美术学院|川美|SCFAI|造型艺术|实验艺术|艺术人文|公共艺术|建筑与环境设计|中国画与书法|动画影视|设计学院|美术馆)/'
const NEW = 'const scfaiRe=/(四川美术学院|四川美院|川美|SCFAI|造型艺术学院|实验艺术学院|艺术人文学院|公共艺术学院|建筑与环境设计学院|中国画与书法艺术学院|动画影视学院)/'

const dryRun = process.argv.includes('--dry-run')

let changed = 0
TARGETS.forEach(rel => {
  const f = path.join(ROOT, rel)
  if (!fs.existsSync(f)) { console.log('跳过（不存在）', rel); return }
  let t = fs.readFileSync(f, 'utf8')

  if (t.includes(NEW)) { console.log('· 已修正，跳过:', rel); return }
  if (!t.includes(OLD)) { console.log('✗ 未匹配到旧规则:', rel); return }

  t = t.replace(OLD, NEW)
  if (dryRun) { console.log('  dry-run 将修正:', rel); changed++; return }

  const bak = f + '.bak-scfai-re-' + Date.now()
  fs.writeFileSync(bak, fs.readFileSync(f))   // 二进制备份，避免编码问题
  fs.writeFileSync(f, t, 'utf8')
  console.log('✓ 已修正:', rel, '备份 ->', path.basename(bak))
  changed++
})

console.log(`\n完成，修正 ${changed} 个文件`)
