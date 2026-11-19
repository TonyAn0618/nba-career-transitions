# Shot Atlas · NBA 生涯转型

从一名球员的整段生涯中找到出手分布变化最明显的区间，查看哪位历史球员在相同年龄段经历过相似变化，以及他随后三个赛季的得分效率和产量。默认案例是 Anthony Edwards，球员、区间和历史 twin 都可以切换，当前选择可以通过网址分享。

## 在线查看

[打开生涯转型网站](https://tonyan0618.github.io/nba-career-transitions/)。

有写权限的组员可以向 `main` 提交 PR。PR 结束草稿状态、构建和测试通过且没有合并冲突后，GitHub 会自动合并，无需另行审批。其他贡献者的 PR 由组员审核。每次更新 `main` 都会触发部署；发布成功后刷新同一网址即可看到新版。[查看构建与发布进度](https://github.com/TonyAn0618/nba-career-transitions/actions/workflows/pages.yml)

## 本地运行

首次安装需要 Node.js 22.12+、npm、Python 3.10+、curl 和网络。在仓库根目录执行以下命令。

```sh
npm ci
npm run dev
```

浏览器打开 <http://127.0.0.1:5181/>。Mac 也可以双击 `start.command`。首次启动会从固定版本的数据源导入赛季统计和投篮坐标，已有数据时会跳过。生成的网页数据占用约 492 MB，本地缓存和生成文件均由 Git 忽略。构建静态网站使用 `npm run build`，发布目录为 `dist/`。网页支持部署到域名根目录或仓库子路径。

## 如何阅读

- 系统扫描连续 2–4 个赛季的五区出手变化。点选图上的区间可切换，展开「手动选赛季」可指定起止年份。
- Twin 来自更早的赛季，起止年龄和区间跨度均与所选球员对齐。相似度结合五区出手的变化方向及幅度（60%）、起始分布（25%）与两个端点的每 36 分钟出手量（15%）。展开「相似度怎么算？」可核对各项贡献。
- 赛季柱、饼图和球场可以联动比较。球探建议结合 twin 转型前后的相对真实命中率、每 36 分钟得分以及后三季的延续情况。展开「查看依据」可核对数字和样本限制。

## 数据与组员协作

赛季统计覆盖 1996–97 至 2024–25，来自 Basketball-Reference 的固定版本汇编。投篮坐标覆盖 2003–04 至 2024–25，通过索引按球员和赛季加载。缺失记录和真实的零值分别处理。[赛季来源清单](data/source-manifest.json) · [逐球数据与坐标说明](docs/shot-data.md)

| 要修改的内容         | 从哪里入手                                                                                                                                                           |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 赛季或球员统计       | 使用 `playerId` 和赛季结束年份关联记录，在 `scripts/sync-data.mjs` 更新来源和导入逻辑。新增年份时一并更新来源校验与覆盖范围，运行 `npm run data`。                   |
| 球员头像             | 将核实的 NBA 260 × 190 PNG 按球员 ID 命名放入 `public/players/`，运行 `npm run photos` 更新映射并核对清单。缺图时页面显示姓名缩写。[头像来源](docs/photo-sources.md) |
| 转型识别和 twin 排名 | `src/lib/career-shifts.ts` 和 `src/lib/transition-matches.ts` 包含样本门槛及评分公式。                                                                               |
| 球探建议             | `src/lib/twin-performance.ts` 计算所选 twin 的指标和建议，`src/components/ComparisonTakeaway.tsx` 展示结论与依据。                                                   |

更新球员身份映射、赛季出手总数或坐标来源后，运行 `npm run data:shots` 重建坐标索引。已有完整缓存时可以运行 `python3 scripts/sync-shots.py --offline` 离线重建。组员提交源码、头像、锁文件和数据清单即可，新克隆的项目会自行生成数据。

## 验证

```sh
npm run prepare:data
npm test
npm run check:data
npm run check:shots
npm run build
```
