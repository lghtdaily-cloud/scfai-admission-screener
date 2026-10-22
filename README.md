# 川美招生筛选工具（SCFAI Admission Screener）

> 为「四川美术学院实验艺术学院 · 艺术与文旅产业融合创新设计微专业」招募打造的**双端应用**：单文件网页版 + 微信小程序 + 微信云开发，覆盖「收材料 → 筛选 → 联系」全流程。

##  项目简介

一套完整的招生筛选解决方案，三个形态共用同一套筛选引擎：

| 形态 | 入口 | 说明 |
|---|---|---|
| 单文件网页版 | `webapp/川美招生筛选-单文件体验版.html` | 双击即用，零依赖、可离线 |
| 微信小程序 | `miniprogram/` | 学生端 + 主办方端 + 云开发云函数 |
| 网页版（小程序内置） | `miniprogram/web/` | 浏览器直接打开，无需微信环境 |

**主办方端能力**：上传招募信息 → 自动解析筛选标准（三张清单 + 最少录取人数）→ 候选人库管理 → 五步流水线智能筛选（含录取率兜底）→ 心仪标记 → 录取文案编辑 → 一键联系（QQ 邮箱 / 电话 / 微信）→ 导出 5 个 xlsx 交付物。

**学生端能力**：在线报名（字段与官方报名表一一对应）、上传简历 / 作品集 / 成绩单 / 个人陈述、查看提交状态。

智能能力默认走**确定性规则引擎**，无需任何密钥即可完整跑通；在 `config/env.js` 配置 OpenAI 兼容 LLM Key 后，「招募信息解析 / 作品集解析 / 智能筛选」自动升级为大模型驱动。

##  关键词 / 分类标签

**领域分类**：招生管理 · 报名系统 · 作品集解析 · 智能筛选 · 教育信息化
**技术栈**：`wechat-miniprogram` `wechat-cloudbase` `single-file-html` `vanilla-js` `exceljs` `llm-optional`
**功能词**：五步流水线筛选 / 录取率兜底 / 邮件一键导入 / 订阅消息通知 / xlsx 导出 / 脱敏
**英文检索词**：`admission` `screening` `miniprogram` `cloudbase` `wechat` `excel-export`

##  仓库结构

```
scfai-admission-screener/
├── README.md
├── LICENSE
├── webapp/                        # 单文件网页版（1.5MB，双击即用）
├── miniprogram/                   # 微信小程序完整源码
│   ├── pages/student/             # 学生端：intro / apply / status
│   ├── pages/organizer/           # 主办方端：login/home/recruit/import/portfolio/
│   │                              #   candidates/candidate/screen/favorite/contact
│   ├── cloudfunctions/            # 云函数：submitApply / parseRecruit / parseFormTpl /
│   │                              #   parsePortfolio / importMail / screenPipeline /
│   │                              #   genContact / exportXlsx
│   ├── utils/                     # 字段定义 / 脱敏 / 规则引擎 / 作品集解析
│   ├── web/                       # 内置网页版 + PWA（sw.js 离线缓存）
│   ├── tools/local-run.js         # 脱离云开发本地自测五步流水线
│   └── config/env.js              # 云环境 ID 与可选 LLM 配置（密钥留空）
├── docs/                          # 设计方案全记录（小程序 UI v2–v5、架构与上线路径等）
├── data/                          # 每日自动检索数据（公开招生信息）
└── tools/auto-fetch/              # 每日自动检索脚本与历次结果
```

##  快速开始

**网页版**：双击 `webapp/川美招生筛选-单文件体验版.html`。

**小程序**：用微信开发者工具导入 `miniprogram/` 目录（AppID `wx375ff55d8526f92b`），在 `config/env.js` 填入你的云环境 ID（留空则使用默认云环境），右键各云函数目录「上传并部署」。

**本地自测**（不依赖云开发）：

```bash
cd miniprogram
node tools/local-run.js
```

##  安全说明

- 仓库中**不包含任何真实密钥**：`config/env.js` 的 LLM Key、订阅消息模板 ID 均为空占位符
- 简历 / 作品集等敏感字段在导出与日志中默认脱敏（`utils/mask.js`）
- 报名数据存储在你自己的微信云开发环境中，本仓库不涉及任何数据上传

##  许可

MIT License
