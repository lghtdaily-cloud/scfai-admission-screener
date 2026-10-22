# 四川美术学院课题招募小程序 · 视觉系统重构（v5）

**受众**：川美在校本科生 / 研究生（学生端）、课题主办教师与教务（主办方端）
**主任务**：学生查项目 → 报名 → 查进度；主办方导入学生信息 → AI 筛选 → 管理候选人
**范围**：仅视觉与交互层。业务逻辑、云函数、数据结构一行不动。
**素材证据**：`webapp/index.html` 内嵌 4 张真实海报（已提取）+ 4 个真实项目数据（`WX_PROJECTS`）
**造成的假设**：海报均由主办方以竖版长图 / 方图上传，比例不统一；小程序需自行裁切。

---

## 1. 视觉主题

### 参考观察（来自已上线网页版）

网页版现状色板实测：

```
--primary:#6d5efc   --primary-2:#8b7dff   --cyan:#06b6d4
--grad:linear-gradient(120deg,#6d5efc 0%,#7c6cff 38%,#22d3ee 130%)
```

紫 + 青双色渐变，配 `--card:#fff` + `--radius:14px` + `1px` 边框 + 阴影。桌面宽屏上尚可，**在手机窄屏上放大后立刻显廉价**——原因不是配色本身，而是：

1. **渐变用在了大面积区块上**（`.hero-ph` 整个底、`.card-bar` 顶部条、`.subtab.on`）。
   渐变在 <=375px 宽度下只有 340px 左右的展示宽度，色相变化被压缩，看起来像"没调准的纯色"。
2. **紫青双色缺乏主从**。`#6d5efc` 与 `#22d3ee` 亮度接近、饱和都高，谁也不让谁。
3. **按钮全用渐变底**。`.btn-primary` 和 `.btn-cyan` 都是渐变，两个都像主按钮。

### 本项目规则（提议，非观察）

**主线：纸 · 墨 · 印泥。**

把整页当作一张纸：底色偏暖白，文字近黑，只用**一个**从真实海报上吸出来的砖红作强调。所有装饰性渐变一律删除。

这不是审美偏好，是三个可验证的理由：

| 理由 | 可验证的表现 |
|---|---|
| 海报是彩色的 | 4 张海报里有 1 张满幅砖红、1 张高密度纹理。UI 若也彩色，两者相撞，海报失去主角地位 |
| 美院气质 | 白 + 黑 + 一个印色，是展览海报与画册的通用语汇；紫青渐变是 SaaS 后台语汇 |
| 色盲友好 | 单强调色系统下，状态区分靠文字与位置而非色相，红绿色盲不会丢失信息 |

### 密度与层级

信息密度**中等偏低**，靠**留白与分隔线**分组，**弃用卡片边框**。

现状首页把 5 个白框纵向堆叠，每框都有 `1rpx 边框 + 阴影 + 20rpx 圆角`，各自占据相近的视觉重量，导致**没有落点**。新结构改为：

- 保留 1 个白面（卡片）作为"当前项目"的容器
- 其余分组靠 `0.5px` 分隔线 + `32rpx` 留白划分，不再加边框
- 一屏内呈现 3 个层级落差（页标题 40rpx → 区块标题 30rpx → 正文 24rpx）

---

## 2. 色彩板

### 语义角色表

| 角色 | CSS 变量 | 色值 | 用途 |
|---|---|---|---|
| 页面底 | `--paper` | `#FAF8F5` | `page` 背景、海报外的所有区域 |
| 浮层面 | `--surface` | `#FFFFFF` | 卡片、弹层、输入框聚焦态 |
| 次级面 | `--surface-2` | `#F5F2EE` | 禁用底、统计块底、微交互底 |
| 主文字 | `--ink` | `#1A1815` | 标题、项目名、主按钮底 |
| 次文字 | `--ink-2` | `#6B6560` | 正文、说明 |
| 弱文字 | `--ink-3` | `#9E9791` | 时间戳、辅助提示、占位符 |
| 分隔线 | `--line` | `#E8E4DE` | `0.5rpx` 分隔线（非边框） |
| 线-强 | `--line-2` | `#D9D4CC` | 描边按钮、可交互边界 |
| **强调** | `--seal` | `#B5432A` | 唯一强调色。截止日期、选中态、项目相关动作 |
| 强调-浅 | `--seal-soft` | `#FBEEE9` | 强调色浅底（选中底、标签底） |
| 强调-深 | `--seal-deep` | `#8E3320` | 强调色按下态 |
| 成功 | `--ok` | `#3D6B4A` | 已提交、通过 |
| 成功-浅 | `--ok-soft` | `#EDF4EF` | 成功标签底 |
| 警示 | `--warn` | `#8A6A1F` | 材料缺失、待补 |
| 警示-浅 | `--warn-soft` | `#F7F1E0` | 警示标签底 |
| 驳回 | `--danger` | `#9B3B33` | 不通过、错误 |
| 驳回-浅 | `--danger-soft` | `#F9ECEA` | 驳回标签底 |

**`--seal: #B5432A` 的来源**：从用户真实素材 `poster2.jpg`（"跨越山海——新西部主题雕塑创作"工作坊海报）的砖红底色中取样。取色同源的好处是——将来主办方上传任意海报，砖红都不会与它们打架。

### CSS 声明

```css
page {
  /* 面 */
  --paper: #FAF8F5;
  --surface: #FFFFFF;
  --surface-2: #F5F2EE;

  /* 墨 */
  --ink: #1A1815;
  --ink-2: #6B6560;
  --ink-3: #9E9791;

  /* 线 */
  --line: #E8E4DE;
  --line-2: #D9D4CC;

  /* 印（唯一强调色） */
  --seal: #B5432A;
  --seal-soft: #FBEEE9;
  --seal-deep: #8E3320;

  /* 状态 */
  --ok: #3D6B4A;         --ok-soft: #EDF4EF;
  --warn: #8A6A1F;       --warn-soft: #F7F1E0;
  --danger: #9B3B33;     --danger-soft: #F9ECEA;

  background: var(--paper);
  color: var(--ink);
}
```

### 对比度

以下比值基于 WCAG 2.1 相对亮度公式**手工计算**，未使用自动化工具复核：

| 前景 / 背景 | 比值 | 判定 |
|---|---|---|
| `--ink #1A1815` / `--paper #FAF8F5` | ≈ 15.8 : 1 | 通过 AAA |
| `--ink-2 #6B6560` / `--paper #FAF8F5` | ≈ 5.6 : 1 | 通过 AA |
| `--ink-3 #9E9791` / `--paper #FAF8F5` | ≈ 2.6 : 1 | **未达 AA**。仅用于 ≥ 24rpx 的辅助文字，禁止用于正文 |
| `#FFFFFF` / `--ink #1A1815`（主按钮） | ≈ 16.3 : 1 | 通过 AAA |
| `--seal #B5432A` / `--paper #FAF8F5` | ≈ 5.1 : 1 | 通过 AA |
| `--seal #B5432A` / `--seal-soft #FBEEE9` | ≈ 4.6 : 1 | 通过 AA（用于标签） |

⚠️ `--ink-3` 不达标是已知取舍。若该文字承载必要信息（如截止日期），必须升到 `--seal` 或 `--ink-2`。

---

## 3. 字体

### 字体栈

**不使用自定义中文字体。** 原因：中文字体子集化后仍 3~5MB，超过小程序主包 2MB 上限，无法内置。

```css
font-family: -apple-system, "PingFang SC", "Helvetica Neue",
             "Source Han Sans SC", "Noto Sans CJK SC", sans-serif;
```

质感不靠字体形态，靠**字距 + 行高 + 只两档字重**。

### 字重

**只使用 400 与 500。** 不用 600 / 700。

现状 `.title { font-weight: 600 }`、`.proj-title { font-weight: 700 }`、`.hero-title { font-weight: 700 }` 全部降档为 500。原因：小程序在部分安卓机上不加载细体字重，600/700 会被伪加粗（faux bold），横向笔画变粗、字面变脏，是"廉价感"的直接来源。

### 字号阶梯（rpx）

| 角色 | 字号 | 字重 | 行高 | 字距 | 用途 |
|---|---|---|---|---|---|
| 页主标题 | 40 | 500 | 1.3 | -0.4rpx | 首页「课题招募」 |
| 大数字 | 36 | 500 | 1.1 | -0.5rpx | 统计数字（进行中 4） |
| 区块标题 | 30 | 500 | 1.4 | -0.2rpx | 「正在招募」「全部项目」 |
| 项目名 | 26 | 500 | 1.45 | 0 | 海报卡片标题 |
| 正文 | 24 | 400 | 1.7 | 0 | 段落、说明 |
| 辅助 | 20 | 400 | 1.5 | 0 | 时间、标签、页脚 |
| 按钮 | 26 | 500 | 1 | 0.2rpx | 所有按钮文字 |

**字距说明**：技能规范要求字距为 0。此处标题使用负字距是**有意例外**，因为中文标题在大字号下默认字距偏松，收紧 0.2~0.5rpx 才能形成"块面感"。正文字距严格为 0。

### 长文本处理

| 场景 | 规则 |
|---|---|
| 项目名（可极长，如「招募｜"2026复调的艺术史·国际学术营"学员招募」，24 字） | 列表内 `-webkit-line-clamp: 2`；卡片内不限行数，完整展示 |
| 主办方名 | `-webkit-line-clamp: 1` + `text-overflow: ellipsis` |
| 邮箱地址 | `word-break: break-all`（长邮箱在小屏会溢出） |
| 表格 / KV 值 | `min-width: 0` + `flex: 1`，防止 flex 子项撑破容器 |

---

## 4. 组件样式

### 4.1 按钮（三层级）

**核心规则：一屏最多一个主按钮。**

```css
.btn {
  display: flex; align-items: center; justify-content: center;
  height: 88rpx;
  border-radius: 12rpx;
  font-size: 26rpx; font-weight: 500;
  letter-spacing: .2rpx;
  border: none;
  transition: transform 120ms cubic-bezier(.4,0,.2,1),
              opacity   120ms cubic-bezier(.4,0,.2,1);
}
.btn::after { border: none; }

/* 主 —— 深墨底白字。不用彩色，因为整页已有海报在彩。 */
.btn-primary { background: var(--ink); color: #fff; }

/* 次 —— 描边 / 浅底 */
.btn-line  { background: var(--surface); color: var(--ink); border: 1rpx solid var(--line-2); }
.btn-seal  { background: var(--seal-soft); color: var(--seal); }

/* 文字 —— 无底，但热区不变 */
.btn-text  { height: 88rpx; background: transparent; color: var(--ink-2); justify-content: flex-start; }

/* 按压反馈：所有按钮统一 120ms */
.btn:active { transform: scale(.97); opacity: .88; }
.btn[disabled] { background: var(--surface-2); color: #B4AEA8; }
```

**三处与现状的差异**：

| 项 | 现状 | 新 |
|---|---|---|
| 主按钮底色 | `--primary #6d5efc` 紫 | `--ink #1A1815` 深墨 |
| 按压反馈 | 无（仅微信默认） | `scale(.97)` + `opacity .88`，120ms |
| 禁用态 | `opacity: .5` | 浅灰底 + 中灰字。**不用透明度**——透明会让按钮看起来像正在加载 |

### 4.2 海报卡片 `pcard`

这是本次核心新组件。

```css
.pcard { display: flex; flex-direction: column; cursor: pointer; }

/* 海报位：真实主角 */
.pcard-cover {
  position: relative;
  width: 100%;
  aspect-ratio: 3 / 4;            /* 竖版长图；方图/横图由 object-fit 兜底 */
  border-radius: 10rpx;
  overflow: hidden;
  background: var(--surface-2);   /* 海报未加载时的占位色，不留白闪 */
}
.pcard-cover image { width: 100%; height: 100%; object-fit: cover; display: block; }

/* 无海报时的降级：显示项目名首字，不是破图 */
.pcard-cover.fallback {
  display: flex; align-items: center; justify-content: center;
  background: var(--seal-soft);
  color: var(--seal);
  font-size: 56rpx; font-weight: 500;
}

/* 选中态：海报转灰 + 文字高亮（沿用网页版交互） */
.pcard-cover.muted image { filter: grayscale(1) brightness(.55); }

.pcard-title {
  font-size: 26rpx; font-weight: 500; line-height: 1.45;
  color: var(--ink); margin-top: 16rpx;
}
.pcard-meta { font-size: 20rpx; color: var(--seal); margin-top: 8rpx; font-weight: 500; }
.pcard-org  { font-size: 20rpx; color: var(--ink-3); margin-top: 4rpx; }

.pcard:active { transform: scale(.985); }
```

**为什么用 `aspect-ratio`**：四张真实海报比例不一致（`poster1` 约 1.24:1 横版、`poster2-4` 约 2.55:1 横幅式）。固定 `aspect-ratio: 3/4` + `object-fit: cover` 保证卡片高度统一、网格不塌。代价是横幅式海报会被裁掉两侧——**这是必须接受的取舍**，否则四个卡片高度各不相同，网格立刻失控。

**备选**：若主办方后续统一上传竖版海报，可把 `aspect-ratio` 提到源码顶部作为常量。

### 4.3 项目列表行 `prow`

用于「全部项目」这类密集列表。

```css
.prow {
  display: flex; align-items: center; gap: 20rpx;
  padding: 22rpx 0;
  border-bottom: 0.5rpx solid var(--line);   /* 0.5rpx，不是 1rpx */
}
.prow:last-child { border-bottom: none; }
.prow-thumb { width: 68rpx; height: 68rpx; border-radius: 8rpx; object-fit: cover; flex: none; }
.prow-body  { flex: 1; min-width: 0; }
.prow-title {
  font-size: 26rpx; font-weight: 500; color: var(--ink); line-height: 1.45;
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden;
}
.prow-meta  { font-size: 20rpx; color: var(--ink-3); margin-top: 6rpx; }
```

### 4.4 标签 `tag`

```css
.tag {
  display: inline-block;
  padding: 4rpx 14rpx;
  border-radius: 6rpx;
  font-size: 20rpx;
  line-height: 1.5;
  background: var(--surface-2);
  color: var(--ink-2);
}
.tag-seal { background: var(--seal-soft); color: var(--seal); }
.tag-ok   { background: var(--ok-soft);   color: var(--ok); }
.tag-warn { background: var(--warn-soft); color: var(--warn); }
.tag-danger { background: var(--danger-soft); color: var(--danger); }
```

圆角从现状 `999rpx` 药丸改为 `6rpx` 方角。**理由**：药丸形标签在密集排布时边缘弧线互相干扰，显得碎；方角标签排在一起会形成整齐的色块行。

### 4.5 状态标签语义

| 状态 | 类名 | 底色 / 字色 |
|---|---|---|
| 进行中 | `.tag-seal` | `#FBEEE9` / `#B5432A` |
| 已提交 | `.tag-ok` | `#EDF4EF` / `#3D6B4A` |
| 待补材料 | `.tag-warn` | `#F7F1E0` / `#8A6A1F` |
| 不通过 | `.tag-danger` | `#F9ECEA` / `#9B3B33` |
| 已结束 | `.tag` | `#F5F2EE` / `#6B6560` |

### 4.6 输入控件

```css
.field-input, .field-textarea {
  width: 100%;
  background: var(--surface-2);
  border: 1rpx solid transparent;      /* 默认无边框，靠底色区分 */
  border-radius: 12rpx;
  padding: 20rpx 24rpx;
  font-size: 26rpx;
  box-sizing: border-box;
}
.field-input:focus, .field-textarea:focus {
  background: var(--surface);
  border-color: var(--ink);            /* 聚焦用墨色描边，不用彩色 */
}
```

### 4.7 反馈与加载

| 状态 | 表现 |
|---|---|
| 按钮加载 | 文字替换为 `24rpx` 细环旋转，**按钮宽度锁定**（`min-width` 不变）避免布局跳动 |
| 列表加载 | 3 条骨架行，底色 `--surface-2`，宽度 60% / 85% / 45%，1.2s 呼吸 |
| 空态 | 居中单行文字 + 一个次要按钮，不用插画 |
| 错误 | 输入框下方 `20rpx` 红色文字；表单顶部一条 `--danger-soft` 汇总条 |

### 4.8 动效

```css
page {
  --dur-micro: 120ms;    /* 按压 */
  --dur-small: 220ms;    /* 展开、淡入 */
  --dur-medium: 400ms;   /* 页面切换、卡片进出 */
  --ease: cubic-bezier(.4, 0, .2, 1);
}
```

**只动 `transform` 与 `opacity`。** 不动 `width` / `height` / `margin` / `top` / `left`——这些在低端安卓上触发重排，会掉帧。

小星星彩蛋**只保留 3 个节点**：提交成功、AI 筛选完成、查询出结果。其余所有按钮给 `scale(.97)` 即可。

---

## 5. 布局

### 5.1 首页信息顺序

```
① 页头      「四川美术学院」+「课题招募」          ~ 110rpx
② 统计条    进行中 4 / 即将截止 2 / 招录名额 90    ~ 130rpx  ← 新增，给全局感
③ 横滑大卡  海报 3:4 + 项目名 + 截止信息           ~ 570rpx
④ 全部项目  缩略图 68rpx + 标题 2 行 + 元信息      每行 ~ 112rpx
⑤ 页脚      一次性文字链接（简章 / 须知）           ~  80rpx
```

### 5.2 栅格与间距

- 基础网格：**4px**（对应 8rpx）
- 间距只允许这 6 个值：`8 / 16 / 24 / 32 / 48 / 64` rpx
- 安全边距：**32rpx**
- 容器最大宽度：无（小程序全宽），但正文段落两侧 32rpx
- 圆角只有三档：`6rpx`（标签）/ `10rpx`（缩略图、海报）/ `12rpx`（按钮、输入框）

### 5.3 弃用卡片边框

现状 `.card { border: 1rpx solid var(--line); border-radius: 20rpx; padding: 28rpx; box-shadow: ... }` 保留，但**仅用于真正需要"浮起"的内容块**（如当前项目卡）。

其余分组改用：

```css
.sec { padding: 32rpx 0; border-top: 0.5rpx solid var(--line); }
.sec:first-child { border-top: none; }
```

### 5.4 长内容与空态

| 场景 | 处理 |
|---|---|
| 项目数为 0 | 空态行 + 「刷新」次要按钮。**不显示统计条**（避免出现"进行中 0"） |
| 项目数 > 8 | 横滑区只放前 4 个（按截止日期升序），其余全在列表 |
| 项目名超 2 行 | 列表裁切；详情页完整显示 |
| 主办方名超 1 行 | 裁切 + 省略号 |
| 极窄屏（320px） | 横滑卡片降到 `width: 232rpx`，仍露出下一张边缘 |

### 5.5 关键工作流

**学生**：首页看项目 → 点海报 → 项目详情页（独立页）→ 「我要报名」→ 报名表单 → 提交 → 回执页

**主办方**：入口 → 选项目 → 导入邮件 → AI 筛选 → 候选人列表 → 候选人详情

每页一个主动作，详情独立成页，不在卡片内展开。

---

## 6. 层次与阴影

整体**扁平**。只有 3 类浮层用阴影：

| 层 | 阴影 | 说明 |
|---|---|---|
| 页面内容 | 无 | 靠 `--paper` 与 `--surface` 的色差区分 |
| 浮起卡片 | `0 2rpx 12rpx rgba(26,24,21,.06)` | 仅"当前项目"卡 |
| 固定底栏 | `0 -1rpx 0 var(--line)` + 无阴影 | 用 1rpx 上边线分界，不用阴影 |
| 弹层 / Toast | `0 8rpx 32rpx rgba(26,24,21,.14)` | 遮罩 `rgba(26,24,21,.4)` |

阴影色用 `rgba(26,24,21,...)`（即 `--ink` 的 rgb），**不用纯黑**——纯黑阴影在暖白底上会显得脏。

---

## 7. 注意事项

### 禁止的模式

| 禁止 | 原因 | 可观察的检查 |
|---|---|---|
| 大面积渐变区块 | 窄屏下渐变被压缩，看起来像没调准的纯色 | 搜索 `linear-gradient`，只允许出现在海报遮罩（`to top` 透明→半透明黑） |
| 彩色主按钮 | 与海报抢视觉，且第二主按钮无从区分 | 检查每屏 `.btn-primary` 数量 ≤ 1 |
| `font-weight: 600/700` | 部分安卓机伪加粗，字面变脏 | 搜索 `font-weight: [67]00` 应为 0 处 |
| 药丸形标签（`999rpx`） | 密集排布时边缘弧线互相干扰 | 标签圆角统一 `6rpx` |
| 用 `opacity` 表达禁用 | 与加载态混淆 | 禁用用 `background: var(--surface-2)` |
| 动画 `width` / `height` / `margin` | 触发重排，低端安卓掉帧 | 检查所有 `transition` 属性只含 `transform` / `opacity` |

### 素材约束

- **海报版权**：4 张海报来自川美官方公众号文章（`mp.weixin.qq.com`）。小程序内展示属课题官方使用；若需导出到外部或印刷，需另行确认授权。**本文件不声称已完成清权。**
- **海报比例不统一**：`poster1` 为横版、`poster2-4` 为横幅式。用 `aspect-ratio: 3/4` + `object-fit: cover` 统一，会裁掉左右两侧。
- **海报体积**：4 张 base64 合计约 300KB。改用云存储 URL 引用，避免主包超限。
- **无海报的项目**：`poster3` / `poster4` 实为纯文字简章图，作为缩略图尚可，作为横滑大卡则信息量不足。建议主办方补传竖版海报。

### 未决事项

1. 横滑大卡用 `aspect-ratio: 3/4` 还是 `1/1`——取决于后续是否统一竖版海报
2. 统计条是否保留（可能显得像后台报表）
3. 圆球吉祥物在首屏的位置与尺寸（v4 已定入口页，首页是否还保留待定）

---

## 8. 响应式与可访问性

### 尺寸断点

| 场景 | 适配 |
|---|---|
| 375 × 812（主流） | 基准 |
| 320 × 568（小屏） | 横滑卡 `232rpx`；页标题降到 `36rpx`；统计条改 2 列 |
| ≥ 428（大屏） | 横滑卡露出约 1.4 张；正文两侧留白增至 `48rpx` |
| 平板 / 折叠屏展开 | 内容区 `max-width: 640rpx` 居中 |

### 触摸

- 所有可点元素最小热区 **88rpx（≈44px）**。文字链接用 `padding` 撑开，不用 `min-height` 单撑。
- 卡片整块可点，不只是标题。
- 相邻可点元素间距 ≥ `16rpx`，防误触。

### 键盘与辅助

| 项 | 处理 |
|---|---|
| 输入框 | `adjust-position` 默认为 true；`cursor-spacing: 20` |
| 表单光标顺序 | 与视觉顺序一致 |
| 屏幕阅读器 | 海报 `image` 加 `aria-label`（项目名 + 主办方） |
| 动态数据 | 统计数字用 `aria-live="polite"` |

### 减弱动效

```css
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: .01ms !important; transition-duration: .01ms !important; }
}
```

在微信小程序中通过 `wx.getSystemInfoSync().enableDebug` 无法直接读取该偏好，采用**降级开关**：`app.globalData.reduceMotion`，由用户在设置页手动开启。

### 加载 / 错误 / 恢复

| 状态 | 处理 | 恢复路径 |
|---|---|---|
| 海报加载中 | 骨架块 + `--surface-2` 底 | 自动 |
| 海报加载失败 | 降级块显示项目名首字 | 自动，不弹错 |
| 列表请求失败 | 空态 + 「重试」 | 手动重试 |
| 提交失败 | 保留表单数据 + 错误条 | 重新提交，不清空 |
| 无网络 | 顶部细条提示，不阻断浏览 | 自动恢复 |

### 已执行 / 未执行的验证

**已执行**：
- 读取现有 `app.wxss` / `intro.wxss` / `intro.wxml`，确认改造靶点
- 提取 `webapp/index.html` 的实际色板与 4 张真实海报
- 对比度按 WCAG 公式手工计算（见第 2 节）

**未执行**（需真机或模拟器）：
- 未在任何设备上渲染本方案
- 未验证 `aspect-ratio` 在微信小程序基础库的实际支持情况（需基础库 ≥ 2.9.0，当前项目未声明最低版本）
- 未测量低端安卓上的动效帧率
- 未做屏幕阅读器实测
- 未验证 2MB 包体（需在实际构建后测量）

---

## 9. 实现提示词

```
项目：四川美术学院课题招募微信小程序（screener-miniprogram）
任务：仅视觉与交互层重构。不改 app.json 页面结构，不改任何 .js 业务逻辑，
      不改云函数，不改数据结构。

设计令牌（写入 app.wxss :root / page）：
  --paper:#FAF8F5  --surface:#FFFFFF  --surface-2:#F5F2EE
  --ink:#1A1815    --ink-2:#6B6560    --ink-3:#9E9791
  --line:#E8E4DE   --line-2:#D9D4CC
  --seal:#B5432A   --seal-soft:#FBEEE9 --seal-deep:#8E3320
  --ok:#3D6B4A --ok-soft:#EDF4EF
  --warn:#8A6A1F --warn-soft:#F7F1E0
  --danger:#9B3B33 --danger-soft:#F9ECEA
  --dur-micro:120ms --dur-small:220ms --dur-medium:400ms
  --ease:cubic-bezier(.4,0,.2,1)

字体：不引入自定义字体。font-family: -apple-system,"PingFang SC","Helvetica Neue",
      "Source Han Sans SC","Noto Sans CJK SC",sans-serif
      只允许 font-weight 400 / 500。

字号阶梯（rpx）：40/500 页主标题 · 36/500 大数字 · 30/500 区块标题
                26/500 项目名 · 24/400 正文 · 20/400 辅助 · 26/500 按钮

硬约束：
  1. 删除所有大面积 linear-gradient（仅保留海报遮罩的 to-top 透明到 rgba(26,24,21,.72)）
  2. 主按钮统一 background:var(--ink)，白字。每屏最多 1 个
  3. 所有按钮 :active { transform:scale(.97); opacity:.88 } 且 transition 仅 transform/opacity
  4. 禁用态用 background:var(--surface-2)，不用 opacity
  5. 标签圆角 6rpx，不用 999rpx
  6. 分隔线用 0.5rpx solid var(--line)，卡片边框只保留给"当前项目"卡
  7. 所有可点元素热区 ≥ 88rpx
  8. 项目名 2 行裁切（-webkit-line-clamp:2），邮箱 word-break:break-all

关键组件：
  .pcard       海报卡片，aspect-ratio:3/4，object-fit:cover
               .pcard-cover.fallback 无海报时显示项目名首字
               .pcard-cover.muted 选中态 filter:grayscale(1) brightness(.55)
  .prow        列表行，68rpx 缩略图 + 2 行标题 + 元信息，0.5rpx 下边线
  .btn-primary / .btn-line / .btn-seal / .btn-text  四类按钮
  .tag / .tag-seal / .tag-ok / .tag-warn / .tag-danger

改造顺序：
  1) app.wxss 令牌替换
  2) components/pcard 新组件
  3) pages/student/intro 首页重排
  4) pages/student/* + pages/organizer/* 共 15 页套用令牌
  5) 真机验收

验收标准：
  - 搜索 linear-gradient 的结果仅剩海报遮罩
  - 搜索 font-weight: 600|700 的结果为 0
  - 首页一屏内 .btn-primary 数量 ≤ 1
  - 首页首屏能看到至少 1 张完整海报
  - 所有可点元素热区 ≥ 88rpx
  - 四个不同比例的海报在同一网格内高度一致

验证状态：
  ✅ 色板对比度已按 WCAG 2.1 公式手工计算
  ✅ 真实素材已提取并核对（4 张海报 + 4 个项目数据）
  ❌ 未在任何设备渲染
  ❌ 未验证 aspect-ratio 基础库支持（项目未声明最低版本，需 ≥ 2.9.0）
  ❌ 未测量低端安卓动效帧率
  ❌ 未实测包体大小
  本文件是设计方案，不是测试通过证明。
```

---

## 附三：背景方案补充验证状态

**已执行**：

- 在浏览器环境中对比了 blur(14px) / blur(28px) / blur(48px) 三档的实际渲染效果
- 在浏览器环境中验证了 4 张真实海报在 blur(28px) + 86% 遮罩下的统一性
- 通过上述测试**发现白底海报（poster3/4）走路线 A 会失效**，并据此设计了路线 B

**未执行**：

- 未在微信小程序真机 / 模拟器上验证 `filter: blur()` 的实际渲染（小程序对 CSS filter 的支持与浏览器存在差异，**需确认基础库版本**）
- 未验证 `position: absolute` + `filter` 在小程序 `scroll-view` 内的表现
- 未测量低端安卓开启全屏模糊后的帧率
- 未验证 `benchmarkLevel` 字段在当前基础库的可用性（该字段在部分版本已废弃，需改用 `getDeviceBenchmarkLevelInfo` 或 `wx.getSystemInfoSync().platform` 组合判断）
- 未实测路线 B 的 `radial-gradient` 在小程序的渲染一致性

⚠️ **风险提示**：`filter` 在小程序中的支持情况是本方案最大的未知项。若基础库不支持，需降级为**预生成模糊图**（用设计工具离线处理一次，作为静态资源打包），代价是增加约 20~40KB 包体/项目。


---

## 附：与 v1–v4 方案的关系

| 项 | v3 / v4 曾定 | v5 修正 | 原因 |
|---|---|---|---|
| 主按钮色 | `--accent #B5432A` 砖红底 | `--ink #1A1815` 深墨底 | 砖红留给"与项目相关"的动作（如"我要报名"），主按钮让位 |
| 主色系 | 近单色 + 单强调色 | 保留，强调色改用素材取样值 | 从海报吸色，与素材同源 |
| 圆角 | 20rpx | 12rpx（按钮）/ 10rpx（海报）/ 6rpx（标签） | 20rpx 在窄屏上显得幼稚 |
| 标签形 | 药丸 999rpx | 方角 6rpx | 密集排布更整齐 |
| 字重 | 未限制 | 只用 400 / 500 | 避免安卓伪加粗 |

---

## 附二：选定项目后的海报背景（v5.1 追加）

**规则**：用户选定某个项目后，**后续所有页面**（项目详情 → 报名填表 → 提交回执 → 报名进度 → 结果页）的背景从 `--paper` 米白替换为**该项目的海报氛围色**。

### 三原由

| 收益 | 说明 |
|---|---|
| **空间连续性** | 学生在前三页"待在同一个项目里"，不会像翻页那样跳脱 |
| **身份指示** | 背景色即"当前在哪个项目"，比面包屑更直觉 |
| **展览语感** | 美术馆展厅按展览换墙面主色，这是同一逻辑的移动端版本 |

### 分层结构（关键）

`filter: blur()` **不可直接加在页面容器上**，否则会把表单文字一起糊掉。必须分层：

```
第 1 层  page 背景        --paper #FAF8F5          （兜底，海报加载失败时可见）
第 2 层  .bg-poster       绝对定位 + blur(28px)      （承担模糊，独立一层）
第 3 层  .bg-veil         绝对定位 + rgba 遮罩      （保证文字对比度）
第 4 层  .container       相对定位 + z-index: 3     （表单内容，完全不受模糊影响）
```

```css
.page {
  position: relative;
  min-height: 100vh;
  background: var(--paper);          /* 第 1 层 */
  overflow: hidden;
}

.bg-poster {
  position: absolute;                /* 第 2 层 */
  top: -80rpx; right: -80rpx; bottom: -80rpx; left: -80rpx;
  background-size: cover;
  background-position: center;
  filter: blur(56rpx);               /* 28px ≈ 56rpx */
  transform: scale(1.15);            /* 消除模糊产生的边缘透明带 */
  z-index: 0;
}

.bg-veil {
  position: absolute;                /* 第 3 层 */
  inset: 0;
  background: rgba(250, 248, 245, .86);
  z-index: 1;
}

.container {
  position: relative;                /* 第 4 层 */
  z-index: 3;
}
```

### 参数规范

| 项 | 值 | 理由 |
|---|---|---|
| 模糊半径 | `56rpx`（= 28px） | 低于 40rpx，海报纹理会与文字打架；高于 80rpx，退化成无信息的灰 |
| 遮罩 | `rgba(250,248,245,.86)` | 0.82 是可读性下限，0.86 留 4% 余量给深色海报 |
| 外扩 | `-80rpx` 四边 | 模糊会在边缘产生透明衰减，不外扩会出现白边 |
| `transform` | `scale(1.15)` | 二次保险，同时让背景微微"放大"，更有空间感 |
| 内容卡 | **必须实底** `--surface #FFFFFF` | 半透明卡会让海报纹理透过文字，阅读变累 |

### 两条路线（按海报类型分流）

**路线 A · 真图模糊** —— 海报有明确整幅底色时使用

```css
.bg-poster { background-image: url({{project.cover}}); }
```

已核对四张真实海报：

| 项目海报 | 底色特征 | 路线 |
|---|---|---|
| 跨越山海（砖红满幅） | 明度低、色相明确 | **A** · 效果最佳 |
| 复调的艺术史（高密度纹理） | 色彩丰富、有层次 | **A** · 良好 |
| 文旅微专业（白底黑字） | 明度 > 80% | **B** · A 会失效 |
| 数智影像（白底黑字） | 明度 > 80% | **B** · A 会失效 |

**路线 B · 主色块** —— 海报为白底 / 浅底 / 明度 > 80% 时兜底

```css
.bg-poster {
  background-image: radial-gradient(
    circle at 30% 20%,
    {{project.tintLight}} 0%,
    {{project.tint}} 45%,
    {{project.tintDeep}} 100%
  );
  filter: none;                      /* 色块本身够柔和，无需再模糊 */
  transform: none;
}
```

**分流判断规则**：取海报四角像素的平均色，若**明度 > 80%** 则走路线 B。

四张海报的实际取色结果：

| 项目 | 主色 | 浅 | 深 |
|---|---|---|---|
| 跨越山海 | `#B5432A` | `#C25A3C` | `#8E3320` |
| 复调的艺术史 | `#3F6B58` | `#6E8F7C` | `#24463A` |
| 文旅微专业 | `#DCD6CC` | `#EDE9E2` | `#C4BCB0` |
| 数智影像 | `#D2C9BC` | `#E8E0D4` | `#B8AEA0` |

**路线 B 的优势**：色值在设计阶段算一次写死在配置里，**运行时零额外流量**。适合小程序主包 2MB 的约束。

### 推荐实现：两者结合

```js
// 页面 onLoad 时按项目决定背景
const useBlur = project.posterLuma <= 0.8;   // 明度阈值
this.setData({
  bgMode: useBlur ? 'image' : 'tint',
  bgImage: useBlur ? project.cover : '',
  bgTint: project.tint || '#DCD6CC'
});
```

```html
<view class="page">
  <view wx:if="{{bgMode==='image'}}" class="bg-poster" style="background-image:url({{bgImage}})"></view>
  <view wx:else class="bg-poster bg-tint" style="background-image:radial-gradient(circle at 30% 20%, {{bgTintL}} 0%, {{bgTint}} 45%, {{bgTintD}} 100%)"></view>
  <view class="bg-veil"></view>
  <view class="container">...</view>
</view>
```

### ⚠️ 性能取舍

`filter: blur()` 在低端安卓上**由 CPU 合成**，一张全屏模糊图层可能掉到 30fps。

三条缓解措施：

| 措施 | 做法 |
|---|---|
| 限制模糊层数 | 一页**最多一个** `.bg-poster`，不要嵌套 |
| 降级开关 | 检测到低端机（`wx.getSystemInfoSync().benchmarkLevel < 20`）时自动切路线 B |
| 避免滚动重绘 | `.bg-poster` 用 `position: absolute` 而非 `fixed`，防止 iOS 滚动时反复重算 |

**低端机降级实现**：

```js
const sys = wx.getSystemInfoSync();
const lowEnd = (sys.benchmarkLevel || 50) < 20;
if (lowEnd) { /* 强制走路线 B，跳过 blur */ }
```

### 与 v5 主方案的冲突说明

v5 第 2 节定 `--paper #FAF8F5` 作全站底色。本节是**局部例外**：仅"已选定项目"之后的页面覆盖背景，**首页、入口页、主办方端保持米白**。

不覆盖的原因：首页要同时展示 4 个不同项目的海报，若背景也跟着变，会出现"不知道该跟哪个项目"的逻辑断裂。

