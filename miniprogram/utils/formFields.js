// utils/formFields.js — 报名表字段定义（需求文档 §7）
// 学生端表单与主办方端解析均引用此处的统一定义。

const BASIC = [
  { key: 'name', label: '姓名', type: 'text', required: true },
  { key: 'studentId', label: '学号', type: 'text', required: true },
  { key: 'age', label: '年龄', type: 'number' },
  { key: 'gender', label: '性别', type: 'radio', options: ['男', '女', '其他'] },
  { key: 'grade', label: '年级', type: 'text', placeholder: '如：大三 / 2023级' },
  { key: 'major', label: '专业', type: 'text' },
  { key: 'email', label: '邮箱', type: 'text', required: true },
  { key: 'phone', label: '手机号', type: 'text', required: true },
  { key: 'strengths', label: '个人特长与优势', type: 'textarea' },
  { key: 'awards', label: '在校奖项、荣誉或专业成果', type: 'textarea', placeholder: '含专业竞赛、设计竞赛、展览、科研项目、创新创业项目等' }
]

// 专业能力与技能（16 项）
const SKILLS = [
  '平面设计', '视觉传达', '摄影', '视频拍摄/剪辑', '插画', '品牌设计',
  '空间设计', '产品设计', '展览策划', '活动策划', '文案与内容创作',
  '新媒体运营', '调研与用户研究', '项目策划与运营', 'AI辅助设计', '其他'
]

// 项目实践意愿 — 期望提升方向（10 项）
const IMPROVE = [
  '文旅项目策划能力', '在地文化资源挖掘能力', '文旅产品设计能力',
  '文旅场景与体验设计能力', '艺术活动策划能力', '品牌与内容传播能力',
  '项目运营能力', '商业转化能力', '团队协作与项目实践能力', '其他'
]

// 项目实践意愿 — 希望承担工作（10 项）
const WORK = [
  '前期调研', '文化资源挖掘', '项目策划', '视觉设计', '空间/场景设计',
  '活动策划', '内容创作', '品牌传播', '项目运营', '其他'
]

// 上传材料类型
const FILE_TYPES = [
  { key: 'form', label: '报名表', required: false, note: '在线填写即等同于提交报名表' },
  { key: 'resume', label: '个人简历', required: true },
  { key: 'portfolio', label: '作品集（不少于3件）', required: true },
  { key: 'transcript', label: '主修专业成绩单', required: true },
  { key: 'statement', label: '个人陈述（500字内）', required: true }
]

module.exports = { BASIC, SKILLS, IMPROVE, WORK, FILE_TYPES }
