# 账号与采集器：0.5.4 本地候选

目标是“网站登录一次，采集器直接保存”。这次只准备本地代码和候选，不代表公网部署或 Edge 商城更新。

## 用户流程

- 右上角登录／注册；登录后显示默认头像和昵称，账户内可改昵称。
- 新账户用邮箱、6位邮件验证码和密码注册。昵称默认生成，之后再改，注册时不增加表单负担。
- 忘记密码时验证邮箱并设置新密码；不再使用恢复码。验证码10分钟有效、一次使用、最多5次错误；发送间隔60秒，站点每日最多90封，避免触发免费邮件额度。
- 旧账户继续用原用户名及密码登录，账户页验证绑定邮箱。旧用户名恰好是邮箱也不会自动视为已验证，原收藏与媒体保留。
- 采集器自动识别参伴网站登录；截图和录像保存到该账户。退出网站后关联采集权限立即失效。重新登录同一账户可重试仍保留的录像，不转存至其他账户。
- 站点与扩展的正常界面均不再显示连接码、恢复码或复制令牌。

## 自动连接设计

比较两条路线：一是扩展申请 cookies 权限并读取网站会话；二是仅在受信参伴站点注入 isolated content script，在站内通过 HttpOnly Cookie 换取采集权限。采用第二条，保留现有权限范围，不申请 cookies 或全站访问。

account-bridge.js 只运行在 lingganji.pages.dev、其预览子域和明确授权的127.0.0.1:5192。凭据通过扩展内部消息发往 service worker，不放进 DOM、window 消息、URL或 localStorage。页面通知事件仅触发重新查询，不携带令牌。后台检查扩展ID、顶层 frame、实际 tab URL和来源；后台另一个环境不能覆盖当前选择的空间。

capture_sessions 将采集 token 绑定到网站父会话；服务端每次请求校验父会话仍有效。退出、删除账号和密码重置立即使关联 token 失效。切换账户保留媒体归属检查，旧账户待上传媒体不能改发到新账户。受限采集身份不能管理工作台或读取个人媒体。

本机开发仍用可选回环权限：更新扩展后若尚未授权，在扩展详情打开“扩展选项”，选择“本机开发网站”，点击“前往网站登录”，只需允许一次。以后刷新5192网站即可同步，不需要输入任何连接码。正式用户直接登录正式网站。三个环境的数据保持隔离。

## 真实邮件开通：待办

已实现 Brevo 和 Resend 的 HTTPS 邮件 API，零新增依赖，服务端配置：

| 字段 | 类型 | 内容 |
| --- | --- | --- |
| MAIL_FROM | 环境变量 | 已在邮件服务中验证的发件邮箱 |
| BREVO_API_KEY | Secret | Brevo API密钥，与RESEND_API_KEY二选一 |
| RESEND_API_KEY | Secret | Resend API密钥，与BREVO_API_KEY二选一 |

Cloudflare：现有 lingganji Pages → Settings → Variables and secrets，按环境分别设置。不要把密钥写进仓库、前端或对话。本机相应读取 REFELLOW_MAIL_FROM、REFELLOW_BREVO_API_KEY、REFELLOW_RESEND_API_KEY，设置后用受管脚本重启。未配置时，已有账户仍可登录；注册／重置会明确显示邮件尚未开通，绝不伪报验证码已发送。

Brevo 官方价格页当前提供免费方案，每日300封，发件能力须经账号批准并验证发件人。具体发件人／域名是否获批必须在实际后台验证，不能保证仅凭现有163邮箱就能发件。Resend免费额度每日100封、每月3000封，但要求拥有并验证发件域名，pages.dev不是可自行验证的发件域名。当前尚未新建邮件服务账号、接受条款、设置新Secret或发送真实邮件。注册第三方账号、条款和邮箱验证需要账号持有人完成相应步骤，随后可继续配置与验证。

云端部署前先执行 cloud/migrations/0003-email-and-auto-session.sql；只新增表，不删除或重命名旧表。与账号升级配套部署网站／worker和扩展，旧版连接码接口返回410，避免继续使用已废弃流程。回滚应先恢复上一个完整候选；新增表可保留，不回滚用户数据。

## 验证与证据边界

定向自动测试使用注入的测试邮件接收器，覆盖验证码、绑定、密码重置、会话、媒体和消息校验；不等于真实邮件送达。浏览器采用明确标记的本机一次性测试账户验收昵称／头像／退出和响应布局。真实 Edge 扩展重新加载、真实验证码邮件送达、云端数据库迁移与部署单列为待验。

外部核查：2026-10-15，原生 KnowledgeRadar health_check／get_capabilities 成功，经 kr_research 路由，extract_web_page 获取官方正文；host_internal_web_wave搜索无可用结果。采用官方合同与本地实现相互验证。未展开社交／视频生态，因本次问题可由官方API与运行测试判定；不是完整站点审计报告。

- https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts ：isolated world、内容脚本与后台通信。
- https://developer.chrome.com/docs/extensions/develop/concepts/network-requests ：内容脚本请求代表注入页面的 origin。
- https://developers.brevo.com/docs/send-a-transactional-email ：已验证发件人、api-key及请求结构。
- https://www.brevo.com/pricing/ ：免费方案、账号获批后每日300封。
- https://resend.com/docs/knowledge-base/resend-sending-limits ：免费发送配额。
- https://resend.com/docs/dashboard/domains/introduction ：须验证自己拥有的发件域名。
