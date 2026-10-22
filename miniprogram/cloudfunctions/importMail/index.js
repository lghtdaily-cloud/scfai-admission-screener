// cloudfunctions/importMail/index.js
// 邮件导入：主办方上传报名邮件附件压缩包（1 封邮件 = 1 位申请者）
// 自动解压 → 按人归档 → 识别材料类型 → 标记缺失 → 写入候选人库（source: 'mail'）
const cloud = require('wx-server-sdk')
const fs = require('fs')
const path = require('path')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const { archive, TYPE_LABEL } = require('./mailParse.js')

// 解压 zip（依赖 adm-zip；云端安装依赖会自动安装）
function unzipToTmp(fileID) {
  return cloud.downloadFile({ fileID }).then(res => {
    const zipPath = '/tmp/import_' + Date.now() + '.zip'
    fs.writeFileSync(zipPath, res.fileContent)
    const AdmZip = require('adm-zip')
    const zip = new AdmZip(zipPath)
    const outDir = '/tmp/unzip_' + Date.now()
    fs.mkdirSync(outDir, { recursive: true })
    zip.extractAllTo(outDir, true)
    const entries = []
    const walk = (dir, prefix) => {
      for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name)
        const rel = prefix ? prefix + '/' + name : name
        if (fs.statSync(full).isDirectory()) walk(full, rel)
        else entries.push({ path: rel, localPath: full, size: fs.statSync(full).size })
      }
    }
    walk(outDir, '')
    return entries
  })
}

// 本地文件上传到云存储，返回 fileID
async function uploadLocal(p) {
  const res = await cloud.uploadFile({
    cloudPath: 'mail-import/' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '_' + path.basename(p),
    filePath: p
  })
  return res.fileID
}

exports.main = async (event) => {
  const { fileID, files } = event || {}
  let entries = []

  if (fileID) {
    try {
      entries = await unzipToTmp(fileID)
    } catch (e) {
      return { ok: false, msg: '解压失败：' + e.message + '（请确认已在云端安装依赖 adm-zip，或改用「逐个上传」模式）' }
    }
    for (const e of entries) {
      try { e.fileID = await uploadLocal(e.localPath) } catch (err) { e.fileID = '' }
    }
  } else if (files && files.length) {
    entries = files.map(f => ({ path: f.name || f.path, fileID: f.fileID || '', size: f.size || 0 }))
  } else {
    return { ok: false, msg: '缺少压缩包 fileID 或文件列表' }
  }

  const { applicants, ungrouped, stats } = archive(entries)
  if (!applicants.length) return { ok: false, msg: '未能识别出申请者，请检查压缩包结构（建议按「姓名/材料」分目录或「姓名_材料类型」命名）', stats }

  // 写入 / 合并候选人库
  const exist = (await db.collection('candidates').limit(1000).get()).data
  const byName = {}
  exist.forEach(c => { byName[(c.name || '') + '|' + (c.studentId || '')] = c })

  const added = []
  const updated = []
  for (const a of applicants) {
    const k = a.name + '|'
    const old = byName[k]
    const doc = {
      files: a.files,
      source: 'mail',
      missing: a.missing,
      missingRequired: a.missingRequired,
      materialComplete: a.complete,
      status: a.complete ? '已提交' : '材料不齐',
      updatedAt: Date.now()
    }
    if (old) {
      // 合并：新文件覆盖同类型旧文件
      const merged = Object.assign({}, old.files || {})
      Object.keys(a.files).forEach(t => { merged[t] = a.files[t] })
      await db.collection('candidates').doc(old._id).update({ data: Object.assign(doc, { files: merged }) })
      updated.push(a.name)
    } else {
      await db.collection('candidates').add({
        data: Object.assign({
          name: a.name,
          studentId: '', age: '', gender: '', grade: '', major: '', email: '', phone: '',
          strengths: '', awards: '', skills: [], improve: [], work: [], wechat: '',
          favorite: false, screen: null, createdAt: Date.now()
        }, doc)
      })
      added.push(a.name)
    }
  }

  return {
    ok: true,
    stats,
    added,
    updated,
    ungrouped: ungrouped.map(u => u.path),
    applicants: applicants.map(a => ({
      name: a.name, fileCount: a.fileCount, complete: a.complete,
      missing: a.missing, excludedByMaterial: a.excludedByMaterial,
      types: Object.keys(a.files).map(t => TYPE_LABEL[t] || t)
    }))
  }
}
