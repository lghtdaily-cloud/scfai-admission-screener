// utils/aiClient.js — 可选大模型封装（OpenAI 兼容接口）
// 配置后返回模型输出（字符串），未配置返回 null，调用方回退到规则引擎。
// 在云函数中使用（Node 18+ 自带 fetch）。

async function chat(settings, systemPrompt, userPrompt) {
  if (!settings || !settings.ENABLED || !settings.API_KEY) return null
  const base = (settings.BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')
  const url = base + '/chat/completions'
  const body = {
    model: settings.MODEL || 'gpt-4o-mini',
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]
  }
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + settings.API_KEY },
    body: JSON.stringify(body)
  })
  if (!resp.ok) throw new Error('LLM HTTP ' + resp.status)
  const data = await resp.json()
  return (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || null
}

module.exports = { chat }
