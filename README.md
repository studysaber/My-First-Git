# 物理知识地图

面向自学者的《物理学》（马文蔚，第七版，下册）第 9—16 章互动学习图谱。这里的讲解、案例与练习为原创转述，按[出版社公开目录](https://xuanshu.hep.com.cn/front/h5Mobile/bookDetails?bookId=61704ca3938b7cc2960edcb7)组织，不是教材电子版，也不提供教材习题答案。

[打开 GitHub Pages 学习](https://studysaber.github.io/My-First-Git/)

## 怎样使用

1. 从“速学路线”选跨章短路线，或在“章节地图”按本章核心路径逐站学习；先读概念、公式、适用条件和带数值的例子。
2. 在“实验”先记录预测，再改参数，观察读数和图像；物理演示带模型边界说明。
3. 在“练习”作答。自评掌握与做题通过分开记录，错题有解释，复习间隔为本地日历的 1、3、7 天。
4. “完整图谱”先显示 8 个章节，点进章节再看节点和关系；搜索、筛选与键盘节点列表也可定位。
5. 学习记录保存在当前浏览器。换设备前点“导出学习进度”，新备份包含自评与练习；旧版 v1 自评文件仍可导入。自评记录会同步留在旧版键中供页面回退读取，练习记录只有新版可读。

目前 93 个核心节点各有讲解、原创案例、核对来源和两道练习；29 个扩展节点仍是部分展开，具体范围见[内容覆盖表](docs/content-coverage.md)。节点层级是本站自学导航标签，不代表出版社的正式课程分级。物理内容以卡片列出的适用条件为准，互动图不是通用数值求解器。

## 本地预览与验证

需要 Node.js 24。首次运行：

```powershell
npm ci
npx playwright install chromium
npm test
npm run test:browser
npm run serve
```

本地预览地址为 `http://127.0.0.1:4173/My-First-Git/`。站点文件在 `dist/`；浏览器测试以实际仓库路径前缀运行。公式使用仓库内固定版本 KaTeX，许可证保留在 `dist/assets/vendor/katex/LICENSE`；访问网站不依赖运行时 CDN。

## 发布

推送到原仓库 `main` 后，`.github/workflows/pages.yml` 先运行 Node 与浏览器测试，再将 `dist/` 发布到 GitHub Pages。仓库 Settings → Pages 的 Source 需要设为 **GitHub Actions**，具体核对与回退步骤见[发布清单](docs/release-checklist.md)。GitHub Pages 是公开静态托管，但不能保证中国大陆每个网络或时段都可访问；正式分享前请用目标网络实测。
