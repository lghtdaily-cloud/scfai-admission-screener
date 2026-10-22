// cloudfunctions/importMail/mailParse.js
// 邮件/压缩包导入归档：1 封邮件 = 1 位申请者；按目录或文件名前缀分组，识别材料类型并标记缺失。
// 纯逻辑、无外部依赖，可被本地自测脚本直接 require。
const { detectFileType, guessNameFromFileName } = require('./portfolio.js')

const REQUIRED = ['form', 'resume', 'portfolio']          // 缺任意一项即视为不齐
const OPTIONAL = ['transcript', 'statement']
const TYPE_LABEL = {
  form: '报名表', resume: '简历', portfolio: '作品集',
  transcript: '成绩单', statement: '个人陈述', other: '其他'
}

// 剥离所有条目共有的根层目录
function stripRoot(paths) {
  if (!paths.length) return paths
  const roots = paths.map(p => String(p).replace(/\\/g, '/').split('/')[0])
  const first = roots[0]
  if (first && roots.every(r => r === first) && paths.some(p => String(p).includes('/'))) {
    return paths.map(p => String(p).replace(/\\/g, '/').split('/').slice(1).join('/'))
  }
  return paths.map(p => String(p).replace(/\\/g, '/'))
}

// 取「申请人键」：优先一级目录名，其次文件名分隔符前的片段
function applicantKey(relPath) {
  const p = String(relPath).replace(/\\/g, '/')
  if (p.includes('/')) {
    const dir = p.split('/')[0].trim()
    if (dir && dir !== '.' && dir !== '..') return { key: dir, from: 'dir' }
  }
  const base = p.split('/').pop()
  const name = base.replace(/\.[a-z0-9]+$/i, '')
  const m = name.match(/^([^_\-\s—－]+)[\s_\-—－]/)
  if (m && /[一-龥]{2,4}/.test(m[1])) return { key: m[1].trim(), from: 'prefix' }
  const guess = guessNameFromFileName(base)
  if (guess) return { key: guess, from: 'guess' }
  return { key: '', from: 'none' }
}

/**
 * 归档主逻辑
 * @param {Array<{path:string, fileID?:string, size?:number}>} entries 解压后的全部文件条目
 * @returns {{applicants:Array, ungrouped:Array, stats:Object}}
 */
function archive(entries) {
  const items = (entries || []).filter(e => e && e.path && !/\/$/.test(e.path) && !/(^|\/)__MACOSX\//.test(e.path) && !/^\./.test(e.path.split('/').pop()))
  const paths = stripRoot(items.map(i => i.path))
  const groups = new Map()
  const ungrouped = []

  items.forEach((it, i) => {
    const rel = paths[i]
    const { key, from } = applicantKey(rel)
    // 识别不出申请人，或文件不属于任何已知材料类型且不在申请人目录下 → 归入未识别，避免误建申请人
    const type = detectFileType(rel)
    if (!key || (type === 'other' && from !== 'dir')) { ungrouped.push({ ...it, path: rel }); return }
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push({ ...it, path: rel, from })
  })

  const applicants = []
  for (const [key, files] of groups.entries()) {
    const filesByType = {}
    files.forEach(f => {
      const t = detectFileType(f.path)
      // 同一类型保留首个（避免覆盖）
      if (!filesByType[t]) filesByType[t] = { type: t, path: f.path, fileID: f.fileID || '', size: f.size || 0 }
      else if (!filesByType[t].fileID && f.fileID) filesByType[t].fileID = f.fileID
    })
    const missing = [...REQUIRED, ...OPTIONAL].filter(t => !filesByType[t]).map(t => TYPE_LABEL[t])
    const missingRequired = REQUIRED.filter(t => !filesByType[t]).map(t => TYPE_LABEL[t])
    applicants.push({
      name: key,
      keyFrom: files[0].from,
      files: filesByType,
      fileCount: files.length,
      missing,
      missingRequired,
      complete: missing.length === 0,
      // 缺报名表或作品集 → 命中排除项，交由筛选引擎处理
      excludedByMaterial: missingRequired.includes('报名表') || missingRequired.includes('作品集')
    })
  }

  return {
    applicants,
    ungrouped,
    stats: {
      files: items.length,
      applicants: applicants.length,
      complete: applicants.filter(a => a.complete).length,
      incomplete: applicants.filter(a => !a.complete).length,
      ungrouped: ungrouped.length
    }
  }
}

module.exports = { archive, applicantKey, stripRoot, REQUIRED, OPTIONAL, TYPE_LABEL }
