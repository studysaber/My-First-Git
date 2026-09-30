---
name: "物理知识地图"
description: "以浅色学习手册承载概念阅读、科学观察与自测。"
colors:
  ink: "#202731"
  muted: "#5c6670"
  field: "#f8f9f6"
  panel: "#fff"
  line: "#dce1dd"
  teal: "#286653"
  blue: "#275f91"
  amber: "#8a5a12"
  violet: "#71539a"
  selected: "#eaf0eb"
  plot-green: "#24664f"
  plot-axis: "#637067"
  plot-ink: "#303D35"
  plot-selection: "#E8F1EC"
typography:
  display:
    fontFamily: '"Microsoft YaHei UI", "PingFang SC", "Noto Sans CJK SC", sans-serif'
    fontSize: "clamp(30px, 3vw, 44px)"
    fontWeight: 650
    lineHeight: 1.25
  title:
    fontFamily: '"Microsoft YaHei UI", "PingFang SC", "Noto Sans CJK SC", sans-serif'
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.4
  summary:
    fontFamily: '"Microsoft YaHei UI", "PingFang SC", "Noto Sans CJK SC", sans-serif'
    fontSize: "18px"
    lineHeight: 1.7
  body:
    fontFamily: '"Microsoft YaHei UI", "PingFang SC", "Noto Sans CJK SC", sans-serif'
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.7
  label:
    fontFamily: '"Microsoft YaHei UI", "PingFang SC", "Noto Sans CJK SC", sans-serif'
    fontSize: "14px"
    lineHeight: 1.7
  readout:
    fontFamily: '"Microsoft YaHei UI", "PingFang SC", "Noto Sans CJK SC", sans-serif'
    fontSize: "42px"
    fontWeight: 600
    lineHeight: 1.3
rounded:
  square: "0"
  control: "6px"
  experiment: "12px"
spacing:
  "4": "4px"
  "8": "8px"
  "12": "12px"
  "16": "16px"
  "20": "20px"
  "24": "24px"
  "40": "40px"
components:
  button-primary:
    backgroundColor: "{colors.teal}"
    textColor: "{colors.panel}"
    rounded: "{rounded.control}"
    padding: "8px 14px"
  button-primary-hover:
    backgroundColor: "{colors.selected}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "8px 14px"
  button-neutral:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "8px 14px"
  button-neutral-hover:
    backgroundColor: "{colors.selected}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "8px 14px"
  button-quiet:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.muted}"
    rounded: "{rounded.control}"
    padding: "8px"
    typography: "{typography.label}"
  input-search:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
    width: "274px"
  directory-item:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "9px 14px 9px 20px"
    width: "100%"
  directory-item-current:
    backgroundColor: "{colors.selected}"
    textColor: "{colors.teal}"
    rounded: "{rounded.control}"
    padding: "9px 14px 9px 20px"
    width: "100%"
  task-tab:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.square}"
    padding: "10px 5px"
  task-tab-selected:
    backgroundColor: "transparent"
    textColor: "{colors.teal}"
    rounded: "{rounded.square}"
    padding: "10px 5px"
  choice-option:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  choice-option-checked:
    backgroundColor: "{colors.selected}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  experiment-container:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    rounded: "{rounded.experiment}"
    padding: "18px 22px 20px"
  disclosure:
    textColor: "{colors.muted}"
    padding: "10px 0"
    typography: "{typography.label}"
  period-readout:
    textColor: "{colors.ink}"
    typography: "{typography.readout}"
---

# Design System: 物理知识地图

## Overview

**Creative North Star: "浅色学习手册"**

用一本清爽的学习手册承载真实的物理内容。暖白页面托住白色正文，深灰中文系统字承担阅读，墨绿只在当前选择、链接和主要动作处出现。界面平静、直接、可连续阅读，科学图形承担解释而不是装饰。

用户选定的浅色手册方向已经替换旧深蓝世界。后来确认的“内容和功能优先”意味着标题、完整目录、实验参数和科学模型遵从实际内容；预览约束布局和风格，不能成为删减内容或模仿错误物理几何的理由。此文档记录当前实现的设计系统，不代表独立视觉验收、阶段通过或线上发布结论。

**Key Characteristics:**

- 连续正文、细分隔线与充足留白。
- 清晰的中文系统字和独立排版的公式。
- 墨绿选择与主要动作；科学配色有明确含义。
- 小幅圆角控件、无阴影的阅读表面。
- 手机目录收起，实验控件随可用宽度重排。

## Colors

配色以暖白、白色和深灰建立长时间阅读的安静底色，绿色强调明确的操作位置，其他色彩服务科学区分。

### Primary

- **墨绿交互**（`teal`）：链接、当前目录项、选中任务标签、主要按钮与键盘焦点。
- **浅绿选择面**（`selected`）：目录选中与悬停、按钮悬停、已选答案的背景。
- **模型绿**（`plot-green`）：科学曲线、摆球和模型重点；与交互绿保留各自的源值。

### Secondary

- **模型蓝**（`blue`）：知识图节点以及科学图中需要与绿色区分的量。
- **赭色标记**（`amber`）：模型标记和图谱节点悬停/焦点轮廓。
- **模型紫**（`violet`）：科学图中额外的量或过程；不扩散为装饰徽章。

### Neutral

- **深灰正文**（`ink`）：正文、标题和主要读数。
- **次级灰字**（`muted`）：章节提示、来源、状态、说明与次要动作。
- **暖白纸面**（`field`）：页面、目录、搜索框和实验容器。
- **白色正文**（`panel`）：阅读区、页头与普通控件。
- **细线灰**（`line`）：表面边界、内容分隔和控件边框。
- **坐标灰绿**（`plot-axis`）：科学坐标轴。
- **图中文字灰**（`plot-ink`）：科学 SVG 标签的现有回退色。
- **图内浅绿选择**（`plot-selection`）：粒子相互作用图中的当前行；不替代目录的选择面。

**The Meaningful Color Rule.** 颜色服务当前选择、主要动作和模型区分；科学图同时使用标签或线型解释差异。

## Typography

**Display Font / Body Font:** 中文系统无衬线字族，共用同一字体栈。无远程运行时字体；公式由站内 KaTeX 排版，失败时保留文本。

**Character:** 文字清楚、稳重，不制造宣传式视觉竞争。知识点标题明显大于摘要，正文保持舒展行距；控制值和科学读数使用等宽数字特性，而不是另一套装饰字体。

### Hierarchy

- **Display**（`display`）：知识点主标题。手机改为（29px），完整图谱旁的详情标题为（28px）。
- **Title**（`title`）：实验标题；手机为（18px）。正文分节标题为（17px），练习、章内分节和复习题标题通常为（18px）。
- **Summary**（`summary`）：主标题下的简短概念摘要；手机为正文大小。
- **Body**（`body`）：连续正文。摘要与正文分节最大行宽为（75ch）；长中文和链接允许换行。
- **Label**（`label`）：次级说明、状态和轻量操作。来源/辅助文字另有（13px），章节标记为（12px）。
- **Readout**（`readout`）：单摆周期输出。参数与读数使用 `font-variant-numeric: tabular-nums`。
- **Formula**：默认公式容器为（22px），实验公式为（28px），允许局部横向滚动。

**The Reading Hierarchy Rule.** 标题、摘要、当前学习任务和公式建立阅读顺序；不添加占据首屏的营销标题。

## Layout

桌面阅读工作区是目录与正文两栏。目录宽度为（`clamp(240px, 18.42vw, 283px)`），正文使用剩余宽度；页头左右内边距为（40px），正文桌面内边距为（12px 40px 24px 43px）。目录列表自身滚动，正文连续向下展开。

完整图谱是独立宽工作区，栏宽比例为（1.6fr / .85fr），详情列最小宽度为（330px）；不能把其图结构重新塞回阅读目录。章节与教材评估的内容由分隔线组织，默认两列，手机一列。

宽屏实验容器采用模型与设置两列（1.45fr / 1fr），设置列最小宽度为（280px），两列间隔为（30px），设置侧有细竖线。到（1100px）时实验变为一列，控件可分两列；到（760px）时整个工作区竖排、控件单列，正文左右内边距为（16px）。手机目录默认收起，展开后列表最大高度为（60vh）；当前知识点先进入阅读视线。主导航按钮在手机改为选择框。

间距前置层仅记录实际重复使用的步长；非等比的局部尺寸保留在组件中，不强行整成一套新网格。按钮、输入、选择框、披露标题的最小高度为（44px），图标/独立目标应保留同样可操作空间。页面最小宽度为（320px）；公式局部滚动，不能引出整页横向滚动。

## Elevation & Depth

当前实现没有阴影。层次由暖白纸面与白色正文、细灰边界、留白和选中底色表达；不使用渐变、发光连线或装饰背景。实验容器是一块轻微色调变化的连续区域，不扩展成层层包裹的卡片。

**The Flat Reading Rule.** 阅读表面以色调和细线分层，不增加阴影或背景动效。

界面状态直接变化，样式表未定义通用过渡或动效时间标记。物理动画只表达模型随时间的变化；暂停和单步是学习操作。系统减少动态设置关闭 CSS 动画与过渡，应用的暂停状态同时控制科学演示。

## Shapes

控件使用轻微圆角（`rounded.control`），实验容器使用更柔和的角（`rounded.experiment`）。任务标签是平直底边，用选中线表达当前状态，不使用胶囊。常见边框和分隔线为（1px），选中任务标签底线为（3px）。

图谱保留圆形节点与章节框；科学几何由模型和坐标比例决定。不要以统一圆角或视觉对称覆盖科学关系。

## Components

### Buttons

简洁、直接、文字优先。普通按钮为白底细线，主要按钮用于“开始练习”和“暂停演示”，使用墨绿底与白字；轻量路线/自评动作为灰字透明边界。普通与主要按钮内边距为（8px 14px），轻量动作为（8px）。

悬停使用浅绿底；主要按钮悬停同时转深灰字。默认焦点是墨绿轮廓（2px），向外偏移（3px）。禁用按钮使用现有灰字和灰底并显示不可操作光标。手机“开始练习”占满可用宽度。暂停状态改变为“继续演示”，不伪造新的颜色体系。

### Inputs / Fields

搜索采用暖白底，其余输入与选择框采用白底，细灰边框和控件圆角。输入内边距为（8px 12px），搜索桌面宽度为（274px），手机填充剩余页头空间；有可读占位文字和绿色插入符。焦点沿用统一外轮廓。范围输入保留原生控件、绿色强调和邻近单位读数，不重新绘制一套滑杆。

### Navigation

目录采用章节 `details` 和整行概念按钮。当前项以浅绿底、墨绿字和中等偏重字重表示；悬停沿用相同色调，当前项仍有 `aria-current` 状态。章节披露可开合；手机入口为“学习目录”，默认收起。

次级主导航在桌面是安静的两列文字按钮，当前视图用墨绿和较重字重表示；手机由原生选择框承载。学习任务是“理解、实验、练习、知识关系”的平直标签组，选中项为绿色底线和绿色较重文字；键盘焦点使用统一外轮廓。无实验的概念隐藏实验标签。

### Choice Options

练习答案使用带边框的行，原生单选框与文字同行，内边距为（10px 12px）。预测选项是相同语言的较短行（8px 12px）。选中行转浅绿底与墨绿边框，保留单选框的状态；没有额外的悬停动画、答题彩带或徽章堆叠。

### Cards / Containers

当前系统以连续阅读分节为主，分节只用细横线。唯一反复出现的显著圆角容器是实验区：暖白底、无阴影、柔和圆角；其宽屏内边距为（18px 22px 20px），手机为（16px 12px）。模型、参数、单位、反馈同处一区，不能把它们拆成互相竞争的卡片。

### Disclosures

路线、学习进度、预测、振幅角与完整模型说明使用原生 `details/summary`。披露标题有足够点击高度，开合由原生三角与实际内容表达；预测和详细说明退到科学模型之后。静止时没有单独的阴影、悬停提亮或装饰动效。

### Period Readout

单摆周期以大读数、较小单位说明与细分隔线建立层次，输出为一行可比较的数字。默认示例来自现有参数（摆长 1 m、重力加速度 9.8 m·s⁻²），显示（2.01 s）；这个静态示例不是新的模拟器。完整状态与模型说明收在其后的披露里，保持近似条件可读。

### Feedback

搜索空结果、学习进度状态、练习解析和今日复习使用文字及原有状态语义，不新增未实现的 toast 或模态样式。模拟无效参数的反馈位于实验容器下方；它保留现有错误色和文字说明。历史成功、最近答案、自评与到期信息必须清楚区分，不能仅凭绿色外观暗示当前掌握。

## Do's and Don'ts

### Do:

- **Do** 使用暖白页面、白色正文、深灰文字和墨绿交互，遵从前置层中的实际源值。
- **Do** 优先保留完整知识内容、实验参数、单位、模型条件和真实科学几何。
- **Do** 用连续正文、细线和留白组织阅读；让科学模型、控件和读数相邻。
- **Do** 保留手机收起目录、原生表单、清晰键盘焦点和公式局部滚动。
- **Do** 用真实文字说明选中、暂停、错误、自评、作答历史和到期状态，并尊重减少动态设置。

### Don't:

- **Don't** 恢复旧深蓝背景、装饰渐变、发光连线、层层嵌套卡片或营销式大标题。
- **Don't** 用效果图中的错误文字或几何替换实际科学内容。
- **Don't** 把科学区分色扩展为装饰徽章，或只靠颜色传达科学过程与学习状态。
- **Don't** 增加远程运行时字体、背景动画或未实现的组件状态。
- **Don't** 把设计文档、测试通过或本地截图等同于独立视觉验收、全书审校或线上发布成功。
