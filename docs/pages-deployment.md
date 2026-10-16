# 网站部署

日常：当前分支修改 → 定向检查 → 本地提交 → 更新开发版 → 用户继续调整。用户明确说推送PR后，才推送、PR、CI、合并和正式上线。普通开发不逐次确认，也不要求先建PR。

## 日常开发

运行npm run deploy:preview -- --execute。不加--execute只构建并核对，不上传。

- 只接受codex/分支的干净本地提交；开发包记录真实源码SHA，pullRequest为null，不伪造PR身份。提交源码后构建，逐文件及完整包摘要核对，再冻结临时副本上传。
- 固定项目refellow、部署分支preview；检查正式分支main和原有两个数据库绑定。沿用DB及秘密，不执行数据库迁移，不升级付费。
- 核对公开资产、服务就绪、部署ID，并确认正式版部署ID及包摘要前后未变。回执固定local/verification/pages-deployment/preview.json，构建覆盖local/build，不累积包。
- 使用环境中的部署凭据，或本机既有官方Wrangler登录；仅在内存调用官方auth token，不读写个人认证文件或把秘密写入日志。REFELLOW_WRANGLER_JS指定现有官方CLI绝对路径。

## 用户授权PR收口后

1. 推送并创建／更新PR；quality CI成功后取得同一不可变候选。
2. npm run deploy:preview -- --run <CI运行号> --execute：用PR候选核对开发版，不能把之前的日常开发包当成正式候选。
3. PR合并当前main、main文件树与候选一致、开发版核对通过后，正式部署：

    npm run deploy:production -- --run <CI运行号> --approve-preview <已确认验收的64位包摘要> --closeout --execute

正式入口拒绝未合并PR、失败／过期／fork候选、不同main内容及不同验收摘要；上传不重新构建。--closeout只是防误操作参数，不能替代用户授权或体验确认。失败保留上传状态，不伪报成功或自动回滚数据。

## 云端工作流与历史问题

手动GitHub部署工作流尚未推送启用；未来启用时分别配置preview、production部署凭据，production限定main及审批。不会绑定push、PR或开发上传自动发布正式版。本机部署使用同一串行锁，云端工作流使用并发控制；正式流程仍须按规则执行。

两站此前相同，是换址时人工分别上传同一未合并包；Cloudflare的main标签不会自动检查GitHub是否合并。账号管理员仍有直接上传权限，不能仅凭文档声称后台权限已锁死；AI不得绕过受管入口直传正式版。
