// cloudfunctions/submitApply/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { form, skills, improve, work, files, wechat, projectTitle } = event
  if (!form || !form.name) return { ok: false, msg: '缺少必要字段' }

  const doc = {
    name: form.name,
    studentId: form.studentId || '',
    age: form.age || '',
    gender: form.gender || '',
    grade: form.grade || '',
    major: form.major || '',
    email: form.email || '',
    phone: form.phone || '',
    strengths: form.strengths || '',
    awards: form.awards || '',
    skills: skills || [],
    improve: improve || [],
    work: work || [],
    wechat: wechat || '',
    projectTitle: projectTitle || '',
    files: files || {},
    source: 'student',
    status: '已提交',
    favorite: false,
    screen: null,
    createdAt: Date.now()
  }

  await db.collection('candidates').add({ data: doc })

  // 新报名 → 给已开启提醒的主办方推送订阅消息（失败不影响本次提交）
  let notify = null
  try {
    const r = await cloud.callFunction({
      name: 'notifyNewApply',
      data: { name: doc.name, projectTitle: doc.projectTitle }
    })
    notify = r && r.result
  } catch (e) {
    notify = { ok: false, msg: String((e && e.message) || e) }
  }

  return { ok: true, notify }
}
