// cloudfunctions/notifyNewApply/index.js
// 一个云函数做两件事：
//   1) action='subscribe'：主办方点「开启新报名提醒」后，把他的 openid 存进 notify 集合并累加可推送次数
//   2) 默认（无 action）：有新报名时，给所有已授权的主办方推送订阅消息
// 说明：订阅消息由【接收方】授权 —— 所以是主办方授权，不是学生。
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const env = require('./env.js')

const pad = n => String(n).padStart(2, '0')
function nowStr() {
  const d = new Date()
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
    ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
}

// 主办方授权：记录 openid + 累积可推送次数
async function subscribe() {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { ok: false, msg: '无法获取 openid' }
  const col = db.collection('notify')
  const exist = await col.where({ openid: OPENID }).limit(1).get()
  if (exist.data && exist.data.length) {
    const doc = exist.data[0]
    await col.doc(doc._id).update({
      data: { enabled: true, count: (typeof doc.count === 'number' ? doc.count : 0) + 1, updatedAt: Date.now() }
    })
    return { ok: true, count: (typeof doc.count === 'number' ? doc.count : 0) + 1 }
  }
  await col.add({ data: { openid: OPENID, enabled: true, count: 1, createdAt: Date.now(), updatedAt: Date.now() } })
  return { ok: true, count: 1 }
}

// 查询当前主办方的授权状态与剩余可推送条数
async function status() {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { ok: false, count: 0 }
  const r = await db.collection('notify').where({ openid: OPENID }).limit(1).get()
  const d = (r.data && r.data[0]) || null
  return { ok: true, count: d ? (typeof d.count === 'number' ? d.count : 0) : 0, enabled: d ? !!d.enabled : false }
}

// 新报名：给已授权的主办方推送
async function notify(event) {
  if (!env.SUBSCRIBE_TEMPLATE_ID || /^your-/.test(env.SUBSCRIBE_TEMPLATE_ID)) {
    return { ok: false, msg: '未配置订阅消息模板 ID（cloudfunctions/notifyNewApply/env.js → SUBSCRIBE_TEMPLATE_ID）' }
  }
  const name = String((event && event.name) || '新申请人')
  const projectTitle = String((event && event.projectTitle) || '') || env.ACTIVITY_NAME
  const subs = await db.collection('notify').where({ enabled: true }).limit(50).get()
  const targets = (subs.data || []).filter(s => s.openid && (typeof s.count !== 'number' || s.count > 0))
  if (!targets.length) return { ok: false, msg: '还没有主办方开启提醒' }

  let sent = 0
  const errors = []
  for (const t of targets) {
    try {
      await cloud.openapi.subscribeMessage.send({
        touser: t.openid,
        templateId: env.SUBSCRIBE_TEMPLATE_ID,
        // 点开消息直接跳到候选人库
        page: 'pages/organizer/candidates/candidates',
        // ⚠️ 下面 4 个字段名（thing1/thing2/time3/thing4）必须与你在小程序后台
        //    「订阅消息」里选用模板的实际字段一致，请照你申请的模板改。
        data: {
          thing1: { value: name.slice(0, 20) },
          thing2: { value: projectTitle.slice(0, 20) },
          time3: { value: nowStr() },
          thing4: { value: '已提交，等待初筛' }
        }
      })
      sent++
      // 一次性订阅：授权一次可推一条，推完扣减
      if (t._id && typeof t.count === 'number') {
        await db.collection('notify').doc(t._id).update({ data: { count: Math.max(0, t.count - 1), updatedAt: Date.now() } })
      }
    } catch (e) {
      errors.push(String((e && e.message) || e))
    }
  }
  return { ok: sent > 0, sent, errors }
}

exports.main = async (event) => {
  const action = event && event.action
  if (action === 'subscribe') return await subscribe()
  if (action === 'status') return await status()
  return await notify(event)
}
