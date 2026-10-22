// utils/mask.js — 对外输出脱敏

function maskPhone(p) {
  if (!p) return ''
  p = String(p).trim()
  if (/^\d{11}$/.test(p)) return p.slice(0, 3) + '****' + p.slice(7)
  if (p.length > 4) return p.slice(0, 3) + '****' + p.slice(-2)
  return p
}

function maskEmail(e) {
  if (!e) return ''
  const i = e.indexOf('@')
  if (i < 0) return e
  const name = e.slice(0, i)
  const head = name.slice(0, Math.min(2, name.length))
  return head + '***' + e.slice(i)
}

module.exports = { maskPhone, maskEmail }
