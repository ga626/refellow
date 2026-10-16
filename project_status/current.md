# 当前状态（2026-10-16）

## 当前任务

- 用户已确认：日常在当前分支修改、定向检查、本地提交并及时更新开发版，无需逐次确认。仅明确说推送PR后才推送、PR、CI、合并和正式上线。
- 当前分支codex/collector-floating-edge；恢复密钥注册修复已交付开发版，源码21fe72e72f7af847efe9a81ef83313cadde93d56，包摘要a262cd27bf2a778c94bcd20ea2d1dfc27f4a372767da70f92530c8b3d47c5660。开发入口支持无PR的干净分支构建，正式入口继续要求已合并的PR候选。
- 部署入口24项定向检查通过；原账号／找回19项检查已通过。冻结worker及开发版真实API已验证注册、采集媒体保存、密钥找回、旧身份撤销及原媒体逐字节保留。测试账号已清理，未操作已有账号。
- 部署回执local/verification/pages-deployment/preview.json已verified，部署ID d7a55825-692d-4446-b526-e824db8c3772，72个公开文件摘要匹配；正式部署ID及摘要前后未变。本轮未推送GitHub、操作PR、更新正式版或扩展。
- 首次核对发现Pages的HTML规范地址跳转未被验证器接受，已在新提交修复并重新部署；新旧构建仅源码身份和发布摘要变化，应用与worker字节相同，账号接口证据按摘要复用。证据local/verification/workflow-preview-2026-10-16。

## 固定入口与数据

- 开发版：https://preview.refellow.pages.dev/；原DB为refellow-preview。
- 正式版：https://refellow.pages.dev/；原DB为refellow-production。
- 两站账户和资料隔离，原AUTH_PEPPER保留；5192仅本机按需调试，默认停止。
- 本轮部署前两站均为bff20ea；此前相同源于换址时人工上传同一包，没有发现preview自动同步正式版的链路。
- 只读核对：本机3账号、3工作台；开发库1账号、1工作台、3份媒体；正式库0账号。本机3账号在两云端均无同用户名或ID，未迁移，资料未删。证据local/verification/registration-delivery-2026-10-16/account-continuity.json。

## 账号与找回

- 已实现无验证码的账号＋密码注册，账号支持用户名、邮箱或手机号（只作账号名，不代表已验证）。注册后自动生成一次展示的个人恢复密钥，可复制／下载保存。
- 找回输入账号、密钥和新密码；成功轮换密钥、撤销旧网站及采集会话，保留用户ID、收藏和媒体。旧账号可用当前密码生成或更换密钥，不引入连接码。
- 本地检查覆盖注册、找回、媒体保留和实际Pages worker；不能代替线上完整使用链或真实Edge体验验收。
- 2026-10-16 Brevo工单#5619776已由客服人工完成验证；用户生成受限邮件密钥，已配置preview，真实验证码已进入163收件箱。production未启用，不使用个人163 SMTP，不升级付费。
- 本轮恢复邮件就绪时的默认邮箱注册和邮件找回，保留账号注册及恢复密钥备用；旧账号在账户设置绑定邮箱。19项定向检查通过，浏览器已核对注册方式及找回方式切换。实际邮箱绑定／密码重置待本人验收，未修改用户密码；测试邮箱与已有账号冲突返回409，空测试账号已清理。
- 邮件任务的配置、收件和清理证据在local/verification/mail-setup，最新开发部署源码及包摘要以local/verification/pages-deployment/preview.json为准；不以工具超时推断部署或发信失败。

## 采集器与后续顺序

1. 开发版注册、登录、密钥找回与保存／读取的线上API链已通过；用户刷新开发版，验收实际表单和密钥保存体验。
2. 真实Edge验证黄页自动小球、其他站手动开启、截图框选、区域／整页录制、停止、自动关联账号和上传；发现问题继续当前分支修复并更新开发版。
3. 用户明确说推送PR后，推进PR #2及CI、冻结正式候选、验收、合并和正式交付。Edge商城提交须明确纳入。

扩展当前仍是0.5.5，加载local/acceptance/current/edge-extension，previous为0.5.4；本轮只改网站，无需重新加载扩展。扩展ZIP摘要fe3f8f36203795922121bd8027765b6bc782e64d2bd91f45d94c00acc50f33fb。Edge草稿尚未提交审核，不能称商城可安装或自动更新；GitHub Release尚未创建。

## 保留事项

- 云端手动部署工作流未推送启用；当前只使用本机受管部署入口，不声称账号管理员直传权限被锁死。
- 旧lingganji项目保留作已安装扩展信任与旧浏览器资料过渡，不是日常第三入口；未完成旧资料核对前不删除。
- 清理记录及迁移连续性证据在local/verification/environment-cleanup和domain-migration；保留本机数据库、原云库、当前／上一版扩展及唯一迁移备份。
- 详细开发与验收步骤见docs/development-workflow.md，部署说明见docs/pages-deployment.md。
