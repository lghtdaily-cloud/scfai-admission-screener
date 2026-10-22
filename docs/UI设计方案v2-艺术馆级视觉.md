# 川美课题招募筛选 · UI 设计方案 v2（艺术馆级视觉）

> 目标端：微信小程序
> 本版核心变化：以艺术馆网站为标尺重构视觉语言，配色从"多色"收敛到"近单色 + 一个强调色"，
> 吉祥物从扁平矢量升级为 3D 渲染风格，新增海报灰化显字交互与克制型动效系统。

---

## 一、调研结论：艺术馆网站到底高级在哪

### 1.1 三个标杆站点

| 站点 | 视觉策略 | 可借鉴点 |
|---|---|---|
| **荷兰国立博物馆**<br>rijksmuseum.nl | 白 `#FFFFFF` + 黑 `#000000` + 灰 `#C2CCCE`，**唯一强调色暖橙 `#CC4C28`** | 颜色越少越显贵。视觉丰富度全部交给摄影作品本身 |
| **梵高博物馆**<br>vangoghmuseum.nl | **每一页分配一个专属颜色**，取自该页展出的画作 | 颜色即导航。翻页像在展厅之间走动 |
| **大英博物馆**<br>britishmuseum.org | 黑底白字 + 柔和滑动动画 | 深色制造戏剧感与仪式感 |

### 1.2 四条可直接落地的规律

1. **颜色极少，一个强调色** —— 主色只用两种（近黑 + 白），第三个颜色只出现在 CTA 上。这是"高级"和"花哨"的分水岭。
2. **海报是主角，UI 必须退让** —— 文字直接压在图上，不额外加边框和底色。界面不应该和作品抢注意力。
3. **呼吸感来自留白** —— 间距阶梯 4→8→16→24→48→64，容器内边距给足，图片之间不挤。
4. **动效轻，但要顺** —— 微交互 220ms、转场 400ms、缓动 `cubic-bezier(.4,0,.2,1)`。不用弹跳、不用闪光。

### 1.3 因此本项目修正的方向

| 旧方案 | 新方案 |
|---|---|
| 青紫 + 淡黄 + 多个语义色，颜色偏多 | 近黑 + 米白 + **单一强调色**，语义色只在必要处出现 |
| 卡片有边框和底色，文字在卡片外 | 文字压在图上，卡片无框 |
| 吉祥物是扁平矢量线条 | 吉祥物升级为 3D 渲染风格 |
| 动效较随意 | 建立克制的动效系统，只有三个节点用星芒 |

---

## 二、配色系统 v2

### 2.1 主色板（近单色 + 一个强调色）

```
/* ===== 底色系 Base ===== */
--paper:      #FBFAF7;   /* 页面底，暖米白（比纯白更耐看，有纸感）*/
--surface:    #FFFFFF;   /* 卡片面 */
--ink:        #14131A;   /* 主文字，近黑但不死黑 */
--ink-2:      #55535E;   /* 次要文字 */
--ink-3:      #8E8C97;   /* 辅助/占位 */
--line:       #E6E4DE;   /* 分隔线 */
--line-soft:  #F0EEE9;   /* 极浅分隔 */

/* ===== 强调色 Accent（唯一一个）===== */
--accent:      #B5432A;  /* 陶土红 —— 取自窑火与雕塑，克制且暖 */
--accent-dark: #8E3320;  /* 按下态 */
--accent-soft: #FBF0EC;  /* 浅底，用于标签 */

/* ===== 语义色（只在状态标记处使用）===== */
--ok:   #2E7D5B;  --ok-bg:   #EDF6F1;   /* 录取 */
--warn: #9A6B12;  --warn-bg: #FDF6E6;   /* 待定 */
--no:   #8E3A3A;  --no-bg:   #FAEFEF;   /* 淘汰 */
```

### 2.2 为什么强调色选陶土红而不是青紫

- 青紫在 v1 里承担了"主色 + 强调色 + 装饰色"三个角色，导致界面每处都在喊。
- 陶土红只出现在**一个地方**：主 CTA。其余全部是米白和近黑。
- 这正好复刻了荷兰国立博物馆的做法 —— 白 + 黑 + 单一暖橙。视觉上立刻安静下来。

### 2.3 使用铁律

- **一屏内强调色出现不超过 2 处**（一个主 CTA + 一个时间角标）
- **禁止用强调色做标题**。标题只用 `--ink`
- **语义色只用于状态标签**，不做装饰
- **大面积色块只用于深色头部**，且高度不超过屏高 1/3

---

## 三、吉祥物「小川」v2 —— 3D 渲染风格

### 3.1 风格定位

从"扁平矢量线条"升级为 **3D 渲染风格**，路线参考 WorkBuddy 小猫：
- **体积光影**：径向渐变模拟球体受光，高光靠左上方
- **柔和材质**：哑光橡皮质感，不是塑料反光
- **嘟嘟脸**：脸颊有鼓起的体积，配淡粉腮红
- **大眼高光**：眼睛占脸 1/3 以上，瞳孔带双高光点

### 3.2 造型规格

| 部位 | 规格 |
|---|---|
| 头身比 | 约 1.8 : 1（Q 版二头身偏一点） |
| 眼睛 | 占脸部宽度 42%，双高光点 |
| 身体 | 椭圆 + 底部渐暗，腹部淡黄 |
| 耳朵 | 短圆耳，内耳浅色 |
| 喙 | 小三角，橙黄 |
| 配色 | 身体 `#7F73D0` 主 / `#564A9E` 暗 / `#B8AEF0` 亮；腹羽 `#F5D97A`；喙 `#E0A03C` |

### 3.3 三个状态

| 状态 | 特征 | 触发场景 |
|---|---|---|
| **默认 · 欢迎** | 圆眼平视，双翅自然下垂 | 首屏问候、引导首步 |
| **提示 · 有发现** | 眯眼 + 单翅上举 + 头顶气泡 | 新提交提醒、截止临近 |
| **成功 · 录取** | 弯月笑眼 + 双翅张开 + 星芒 | 提交成功、筛选完成、录取 |

### 3.4 交付形式（两种并行）

**方案 A：SVG 径向渐变近似**（零体积，直接内联）
优点：文件极小、可无损放大、可代码控制颜色。
已在预览中验证效果，日常够用。

**方案 B：AI 出图 + 抠图**（质感最好）
优点：材质真实、光影自然。
注意：需导出 PNG 透明底，最小 400×400，首屏用 2x 图。

### 3.5 出图提示词（可直接使用）

**主提示词 —— 3D 渲染猫咪引导员**

```
3D rendered cute mascot character, chibi owl-cat hybrid, oversized round head with tiny body,
large glossy eyes with double highlight sparkles, soft velvety matte fur texture,
plump round cheeks with soft pink blush, tiny orange beak, small rounded ears,
short stubby wings and feet, sitting pose, gentle friendly smile,
soft purple-lavender body (#7F73D0) with cream-yellow belly (#F5D97A),
soft studio lighting from upper left, soft shadow beneath,
Disney Pixar style, C4D octane render, high detail, clean plain background,
3D clay figurine texture, blind box toy style, masterpiece
```

**参数建议**：比例 1:1；风格强度中高；负向词 `flat vector, line art, 2d, sketch, outline, low detail, neon, harsh contrast`

**三个状态变体提示词**

```
[默认欢迎]
same character, round open eyes looking straight, wings resting down, calm welcoming expression

[提示有发现]
same character, squinting happy eyes, one wing raised up pointing upward, small speech bubble above head, excited expression

[成功录取]
same character, crescent moon smiling closed eyes, both wings spread open wide, small sparkles around head, joyful celebration
```

**微动效变体（用于加载/等待态）**

```
same character, blinking eyes, slight head tilt, subtle idle animation pose, loopable
```

---

## 四、核心交互：海报灰化显字

这是用户明确要求的核心交互，也是最出效果的一处。

### 4.1 交互定义

```
初始状态 → 全屏彩色海报（swiper 横向轮播，圆点指示）
    ↓ 点击海报
点击状态 → 海报灰化 + 压暗 + 白色信息卡从下方滑入
    ↓ 左右滑动
切换项目 → 上一个自动恢复彩色，新的显示为彩色待点击态
```

### 4.2 实现要点

**① 灰化用滤镜，不换图**

```css
.poster.is-open {
  filter: grayscale(1) brightness(0.55);
  transition: filter 320ms cubic-bezier(.4, 0, .2, 1);
}
```

一张海报搞定两个状态，省流量（重要：小程序主包 2MB 限制）。

**② 文字层叠在图上，卡片无框**

信息卡从下方滑入，占屏高约 45%，上方保留灰化区域作为视觉锚点。
卡片本身无边框无阴影，只用白色背景和圆角区分层级。

**③ 横滑切换用 swiper**

```html
<swiper class="poster-swiper" circular bindchange="onSwiperChange">
  <swiper-item wx:for="{{projects}}" wx:key="id">
    <view class="poster {{item.open ? 'is-open' : ''}}" bindtap="toggleOpen" data-id="{{item.id}}">
      <image class="poster-img" src="{{item.cover}}" mode="aspectFill" lazy-load />
      <view class="poster-info" wx:if="{{item.open}}">
        <text class="pi-title">{{item.title}}</text>
        <text class="pi-desc">{{item.desc}}</text>
        <view class="pi-tags">...</view>
        <button class="pi-cta">报名这个项目</button>
      </view>
    </view>
  </swiper-item>
</swiper>
```

**④ 尊重系统设置**

```css
@media (prefers-reduced-motion: reduce) {
  .poster { transition: none; }
  .poster-info { animation: none; }
}
```

### 4.3 首页结构

```
┌─────────────────────────┐
│  深色头部（屏高 28%）      │  川美标识 + 小川问候
├─────────────────────────┤
│                         │
│   全屏海报 swiper         │  彩色 → 点击灰化显字
│   （屏高 52%）            │
│                         │
│   ● ○ ○                 │  圆点指示
├─────────────────────────┤
│  当前项目摘要 / 快捷入口    │
└─────────────────────────┘
```

---

## 五、按键反馈系统

### 5.1 三层反馈

| 层级 | 形式 | 使用场景 |
|---|---|---|
| **基础** | 按下缩放 0.97 + 背景加深，120ms 回弹 | 所有按钮、卡片、列表项 |
| **中等** | 涟漪从点击点扩散两圈，300ms | 大按钮、整卡点击 |
| **高光** | 星芒放大淡出 700ms + 吉祥物弹句 | 仅三个节点 |

### 5.2 只有三个节点配星芒

1. **提交成功**
2. **筛选完成**
3. **查询出结果**

> 这是"高级"和"廉价"的分界线：到处都是星 = 哪里都不重要。

### 5.3 动效规格

```css
--dur-micro: 120ms;   /* 按压态 */
--dur-small: 220ms;   /* 状态切换 */
--dur-medium: 400ms;  /* 转场 */
--dur-burst: 700ms;   /* 星芒 */
--ease: cubic-bezier(.4, 0, .2, 1);
```

**只动两个属性**：`transform` 和 `opacity`。
动 `width` / `top` / `height` 会触发重排，低端安卓直接掉帧。

### 5.4 吉祥物联动（替代纯星芒）

操作完成后小川从屏幕角落弹出，说一句话，配 2~3 颗小星。

| 节点 | 小川的话 |
|---|---|
| 提交成功 | 收到啦，我帮你盯着进度 |
| 筛选完成 | 24 份都看完了，给你排好序了 |
| 录取通知 | 恭喜！老师想联系你聊聊 |

---

## 六、配色方案三选一（需用户确认）

| 方案 | 主色 | 强调色 | 气质 |
|---|---|---|---|
| **A · 纸墨** | 米白 `#FBFAF7` + 近黑 `#14131A` | 陶土红 `#B5432A` | 艺术馆标准做法，克制高级 |
| **B · 夜展** | 深墨 `#17161D` + 米白 | 暖金 `#C9A227` | 大英博物馆路线，戏剧感强 |
| **C · 青瓷** | 米白 + 近黑 | 青瓷绿 `#3E6B5A` | 更文气，但与美院窑火意象稍远 |

**推荐 A · 纸墨**：与"艺术馆"目标最贴合，且招生办公场景长时间看不累。

---

## 七、改造清单

### 7.1 新增

| 文件 | 内容 |
|---|---|
| `app.wxss` | v2 色板变量 + 动效变量 |
| `assets/xiaochuan-*.png/svg` | 小川三状态 3D 版 |
| `components/poster-swiper/` | 海报灰化显字轮播组件 |
| `components/xc-toast/` | 小川弹句反馈组件 |
| `components/burst/` | 星芒动效组件 |

### 7.2 改造

| 文件 | 改动 |
|---|---|
| `pages/student/intro/` | 改为全屏海报 swiper + 点击灰化显字 |
| 全部页面按钮 | 统一加按压态 |
| 三处成功节点 | 接入星芒 + 小川弹句 |

### 7.3 不做

- 不引入第三方组件库（主包体积敏感）
- 不用多处强调色（违背 v2 核心原则）

---

## 八、待确认

1. **配色选 A 纸墨 / B 夜展 / C 青瓷**
2. **小川 v2 的 3D 风格是否认可**；认可的话我按 3.5 的提示词出图，还是先用 SVG 渐变版？
3. **海报灰化显字交互**是否符合你设想（点击灰化、信息卡滑入、横滑切换）
4. 确认后先做**「v2 色板 + 小川组件 + 海报轮播首页」**三件套
