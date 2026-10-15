# 开发、验收与发布

## 一个仓库，两个网站

ga626/refellow 同时维护 public/ 网站、cloud/ API、采集器/ 扩展和 scripts/ 工具。Cloudflare 仅使用 refellow 项目：

- 开发版：https://preview.refellow.pages.dev/，部署分支 preview，独立测试账户和资料。
- 正式版：https://refellow.pages.dev/，部署分支 main，正式账户和资料。

127.0.0.1:5192 是本机调试工具，默认停止，不作为第三个日常验收网站。AI必要时用 start.cmd 启动，核对 /health 后用 scripts/stop-local.ps1 停止；保留本机数据。本地修改不会自动更新云端网站。

## 每轮开发

1. 默认在既有分支继续修改；独立新任务再从main建codex/<topic>。当前为codex/collector-floating-edge，已有PR #2未合并；不切回治理基线main。
2. AI修改、做受影响的定向检查并本地提交，无需逐次确认。共享源只改public/collector/，运行scripts/sync-collector.mjs同步；记录源码SHA及缺口。
3. 运行npm run deploy:preview -- --execute，按当前分支干净提交构建并只更新preview，无需PR或推送GitHub。核对线上身份、账户服务及正式版未变，再让用户刷新开发网址；未部署成功时如实说明。
4. 扩展有改动时，AI准备同一候选的固定加载包，给版本、SHA和下方目录；用户首次加载，以后重新加载。纯网站改动不用反复加载扩展。
5. 仅用户明确说推送PR时，才推送、创建／更新PR、处理CI、合并、正式上线和回main验证。先由PR CI冻结正式候选并在开发版核对，正式只提升该同一制品；普通开发包不冒充PR候选。开发验收通过不自动授权收口，Edge上架另按明确授权。

两站目前相同，是换址时人工把同一未合并候选分别上传到preview和main；未发现自动同步链路。Cloudflare的main部署标签不等于GitHub代码已合并；以后不能靠手选该标签更新正式站。保留现有线上基线，不为制造视觉差异回滚网站或改动数据。

日常开发包绑定本地提交与摘要，PR候选仍按prepare-candidate.mjs、stage-acceptance.mjs执行；部署使用[网站部署入口](pages-deployment.md)。仅本地实现的GitHub工作流不称云端已启用。当前状态见[当前状态](../project_status/current.md)。

## Edge加载

首次在 edge://extensions 开启开发人员模式，点击“加载解压缩的扩展”，选择文件夹：

D:/Projects/Refellow/local/acceptance/current/edge-extension

选择文件夹，不选ZIP或manifest.json。当前0.5.5；目录不移动。避免同时启用旧版本，先停用并保留资料。

以后AI更新current后，先结束录制和待保存任务，点击扩展“重新加载”，刷新目标网页。网站登录后工具自动识别账户，不需要连接码；正式与开发数据隔离。普通网页预览不能验证真实Edge采集。

## 保留与清理

- local/build、local/candidate固定覆盖，不每轮增加部署目录。
- local/acceptance只保留current、previous；核对身份及摘要后轮换，不动录制及待保存资料。
- 历史包已归local/history，不作为当前加载地址；原回执不改写，迁移可查moves.json。
- 已退役演示的node_modules和dist已清除，源码、lockfile和Git历史保留；迁移完整备份、本机账号与媒体保留。
- Actions临时制品按保留期清理，Release仅放正式制品。

## 必要验收

网站：注册后生成恢复密钥、找回保留资料且撤销旧会话、两账户隔离、媒体保存读取。邮件未开通时不列作可用。

扩展：黄页自动小球、其他站手动开启、截图框选与取消、静音区域及整页录制、手动停止、失败重试。首次采集仍需Edge当前页授权；截图可移动、八方向调整、Enter确认、Esc取消；导航结束录制。

自动测试、云端API、真实Edge、用户体验、商城审核分别记录，不互相替代。
