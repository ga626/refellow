# 开发、加载与发布

## 一个仓库，三个运行位置

仓库 ga626/refellow 同时维护 public/ 网站、cloud/ API、采集器/ 扩展和 scripts/ 构建脚本。网站必须有源码，但不需要单独建仓库。网站部署到 Cloudflare，扩展提交 Edge，二者从同一提交构建，分别交付。

2026-10-15 远端核对：仓库公开；main=314cd49，仅治理文件。PR #2（codex/collector-floating-edge）包含网站、API 和扩展，远端 HEAD=de025a6，未合并，无 GitHub Release。本地更新不能冒充远端已同步。

## 每次开发

1. 新任务从 main 建 codex/<topic>；已有未合并任务继续原分支。完成 PR、CI、合并后回 main，再开下个任务。
2. 网站本地入口固定 http://127.0.0.1:5192/，修改后刷新；无须每次打包或更新公网。网站模拟页不能验证扩展 API。
3. 扩展源码、版本号、说明和测试由 AI 准备，用户不直接加载源码目录。先把本轮源码提交到本地 Git，记录实际 SHA、仓库、目标 PR；此时仍未推送，不等于 PR 远端 HEAD 或 CI 已更新。
4. AI 在干净提交上设置 REFELLOW_PR_NUMBER=2（当前任务）和 REFELLOW_REQUIRE_CANDIDATE=1，依次运行 node scripts/build-collector.mjs、node scripts/prepare-candidate.mjs、node scripts/stage-acceptance.mjs。PR 编号先通过远端查询核实，禁止凭空填写。
5. AI 先做风险定向检查，再给用户版本、SHA、固定路径、检查项和已知缺口。用户验收与自动测试分开记录。

## Edge 加载

首次在 Edge 地址栏输入 edge://extensions，打开开发人员模式，点击“加载解压缩的扩展”，选择：

D:/Projects/Refellow/local/acceptance/current/edge-extension

选择文件夹，不选 ZIP 或 manifest.json。旧 0.5.0 扩展先停用，避免两个悬浮入口；不卸载清除连接数据。加载后应显示 0.5.1。本地未打包扩展的 ID 可能变化；需要时在连接页重新连接已有测试账户。

以后 AI 更新同一目录后，用户先结束录制和待保存任务，再在 Edge 扩展页点击该扩展的“重新加载”，并刷新目标网页；不用重新选择目录。不要把右侧普通网页预览当成新版扩展已安装。

截图和录制上传使用已连接的网站；网站本地 UI 和云端测试空间不是同一份数据。云端验收使用既有预览站，连接页测试设置填该地址；正式用户保持默认正式站。不得为加载方便改生产数据库或偷搬账户。

## 包的保留

- local/build/pages：日常网站构建覆盖，避免每次新增“部署/包-摘要”。明确归档时才调用 buildPages({archive:true})。
- public/assets/collector.zip 与 local/candidate：构建和候选准备临时输出，固定位置覆盖。
- local/acceptance/current：本次实际加载的不可变内容和验收回执；previous：上一版。下次确认候选完整后轮换，淘汰更旧的受管 previous；目录内容无法识别时拒绝覆盖。先校验 ZIP、源码身份和网站逐文件摘要，失败保留当前版本。
- 验收目录中的 artifact/ 保留原 ZIP、网站包、schema；edge-extension/ 逐文件解包，acceptance.json 记录版本、源码 SHA、包 SHA 和文件摘要。
- 旧 local/candidates 和 部署 中的历史包不自动扫删；先核对已加载路径和历史引用，迁出旧加载路径后再专项清理。新流程不继续往那里堆日常包。
- GitHub Actions 当前制品保留30天；GitHub Release 仅保留正式发布制品，开发迭代不发 Release。

## 验收之后

有问题继续当前分支，修复后生成新 SHA 的候选；通过后再按已授权范围推送同一分支，更新 PR，CI 通过后合并并回 main。候选内容改变须重新验受影响项。正式站部署和 Edge 商城提交提升已验同一候选，核对公开内容与摘要；微软审核通过后才算商城上线。网站和扩展无需同步每次发版，只发布本次有变化的部分并核对兼容。

## 本次0.5.1验收范围

自动注入黄页18站、悬浮展开收起、截图框选视觉反馈、菜单停止录制。真实 Edge 的首次授权、自动入口能否直接截图/录制、手柄拖动调整、录制控件是否入画仍未验收；当前手柄仅视觉提示，不能宣传已支持拖动调尺寸。无需重复验网站全部功能。不要将本地版本加载成功记为商城已发布。
