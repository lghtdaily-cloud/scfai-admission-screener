// cloudfunctions/parseFormTpl/index.js
// 报名表模板固定为《艺术与文旅产业融合创新设计微专业报名申请表》，
// 直接返回已识别字段（学生端表单据此生成，可在 UI 人工调整）。
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const formFields = require('./formFields.js')

exports.main = async () => {
  return {
    ok: true,
    fields: {
      basic: formFields.BASIC.map(f => ({ key: f.key, label: f.label, type: f.type, required: !!f.required })),
      skills: formFields.SKILLS,
      improve: formFields.IMPROVE,
      work: formFields.WORK
    },
    note: '已识别标准报名表字段；学生端表单据此生成，可人工调整。'
  }
}
