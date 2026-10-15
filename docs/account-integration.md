# 账号与采集器：临时恢复密钥方案

目标是“网站登录一次，采集器直接保存”。正式入口 https://refellow.pages.dev，固定测试入口 https://preview.refellow.pages.dev。2026-10-15 本地修改采用下述临时方案；线上仍为0.5.5，未部署本轮修改。进度见 project_status/current.md。

2026-10-16复查：两站仍是旧邮箱验证页面，emailReady=false，注册链条未打通。本地19项定向检查及构建通过不代表已上线。5192的3个本机账号保留，但与开发／正式库均不重合，未迁移；不要把本机账号当成已在云端注册的账号。没有清库或重建资料。

## 用户流程

- 右上角登录／注册；登录后显示默认头像和昵称，账户内可改昵称。
- 新账户用账号、密码及确认密码注册，自动生成昵称。账号可为用户名、邮箱或手机号；未验证的邮箱或手机号只是账号名称，不证明所有权，也不向其发信或短信。
- 注册完成后仅展示一次个人恢复密钥，可复制或下载，用户勾选“已妥善保存”后完成。密码和密钥不写入浏览器存储，密钥明文不进入账户资料或采集器自动连接信息。
- 忘记密码：输入账号、个人恢复密钥、新密码和确认密码；成功后生成新密钥、撤销旧网站及采集会话。用户ID、收藏、项目、媒体、昵称及已验证邮箱保持不变。
- 旧账户继续用原账号密码登录；已有原版恢复密钥继续有效。没有密钥的账户在账户设置中输入当前密码生成密钥；更换后旧密钥立即失效，后台不提供读回明文的接口。
- 密码和密钥都丢失时不能自助找回。不使用生日、安全问题或公共系统密钥代替身份凭证。
- 采集器自动识别参伴网站登录；截图和录像保存到该账户。退出网站后关联采集权限立即失效。重新登录同一账户可重试仍保留的录像，不转存至其他账户。
- 采集器无需连接码或复制令牌。个人恢复密钥仅用于账户找回，与采集器自动连接无关。

## 临时接口合同

- POST /api/register：显式 recoveryMethod="key"，username、password；创建时返回一次 recoveryCode。邮箱验证注册原合同保留，不能省略验证码后冒充已验证邮箱。
- POST /api/recover：username（或email作为账号别名）、password、recoveryCode；成功轮换密钥并重新登录。兼容原版32位十六进制密钥及摘要；可粘贴大小写和分组连字符。
- POST /api/account/recovery：网站登录＋当前password，创建或更换密钥。需要网站来源和website scope，采集身份不可调用；错误密码不清除当前登录。
- 仅保存密钥SHA-256摘要（混入原AUTH_PEPPER）。不迁移数据库、不修改原密码派生算法或AUTH_PEPPER。恢复使用条件更新与事务撤销，防止同一密钥并发重放。
- 继续沿用按IP及账号的认证频率限制；密钥管理每用户5次/5分钟。旧连接码接口继续返回410。

## 自动连接设计

比较两条路线：一是扩展申请 cookies 权限并读取网站会话；二是仅在受信参伴站点注入 isolated content script，在站内通过 HttpOnly Cookie 换取采集权限。采用第二条，保留现有权限范围，不申请 cookies 或全站访问。

account-bridge.js 运行在 refellow.pages.dev、preview.refellow.pages.dev，换址过渡期兼容旧 lingganji.pages.dev 及其预览子域，以及明确授权的127.0.0.1:5192。已有扩展连接不清除，不把旧令牌改写成新域名后发送。凭据通过扩展内部消息发往 service worker，不放进 DOM、window 消息、URL或 localStorage。页面通知事件仅触发重新查询，不携带令牌。后台检查扩展ID、顶层 frame、实际 tab URL和来源；后台另一个环境不能覆盖当前选择的空间。

capture_sessions 将采集 token 绑定到网站父会话；服务端每次请求校验父会话仍有效。退出、删除账号和密码重置立即使关联 token 失效。切换账户保留媒体归属检查，旧账户待上传媒体不能改发到新账户。受限采集身份不能管理工作台或读取个人媒体。

本机开发仍用可选回环权限：更新扩展后若尚未授权，在扩展详情打开“扩展选项”，选择“本机开发网站”，点击“前往网站登录”，只需允许一次。以后刷新5192网站即可同步，不需要输入任何连接码。正式用户直接登录正式网站。三个环境的数据保持隔离。

## 真实邮件开通：等待用户通知

Brevo工单 #5619776 已提交，并按客服要求私下补充手机号的国际／国内格式，请求人工审核。等待回复，不继续注册邮件服务，不使用个人163邮箱发系统邮件。用户明确通知验证问题解决后，再继续API密钥和真实收件验收。

已实现 Brevo 和 Resend 的 HTTPS 邮件 API，零新增依赖，服务端配置：

| 字段 | 类型 | 内容 |
| --- | --- | --- |
| MAIL_FROM | 环境变量 | 已在邮件服务中验证的发件邮箱 |
| BREVO_API_KEY | Secret | Brevo API密钥，与RESEND_API_KEY二选一 |
| RESEND_API_KEY | Secret | Resend API密钥，与BREVO_API_KEY二选一 |

将来接入时使用Cloudflare refellow Pages → Settings → Variables and secrets，按环境分别设置。不要把密钥写进仓库、前端或对话。本机相应读取 REFELLOW_MAIL_FROM、REFELLOW_BREVO_API_KEY、REFELLOW_RESEND_API_KEY，设置后用受管脚本重启。未配置时注册／找回使用个人密钥；已验证邮箱的绑定与邮件重置入口仅在emailReady时出现，绝不伪报验证码已发送。保留邮箱验证码合同：10分钟有效、一次使用、最多5次错误，发送间隔60秒，站点每日最多90封。

2026-10-15前期核查：Brevo免费方案每日300封，发件能力须经账号批准并验证发件人；Resend免费额度每日100封、每月3000封，但要求拥有并验证发件域名，pages.dev不是可自行验证的发件域名。实际Brevo个人资料已填写、后台发件邮箱显示Verified，两环境MAIL_FROM已配置，但API密钥生成受手机号验证阻断；未验证真实邮件送达。这些是之前的研究记录，不表示本轮开通了任何发信能力。

新网址继续连接原有正式／测试数据库，保留对应 AUTH_PEPPER。现有库按 cloud/migrations 补齐缺失表，禁止清库、重建账号或随意轮换密码秘密。换网址后需重新登录原账号，不需重新注册。浏览器本地存储不随网址移动，旧版仅存在本机的资料须单独核对并迁移。与账号升级配套部署网站／worker和扩展，旧版连接码接口返回410，避免继续使用已废弃流程。回滚应先恢复上一个完整候选；新增表可保留，不回滚用户数据。

## 验证与证据边界

定向自动测试使用注入的测试邮件接收器，覆盖验证码、绑定、密码重置、会话、媒体和消息校验；不等于真实邮件送达。浏览器采用明确标记的本机一次性测试账户验收昵称／头像／退出和响应布局。真实 Edge 扩展重新加载、真实验证码邮件送达、云端数据库迁移与部署单列为待验。

外部核查：2026-10-15，原生 KnowledgeRadar health_check／get_capabilities 成功，经 kr_research 路由，extract_web_page 获取官方正文；host_internal_web_wave搜索无可用结果。采用官方合同与本地实现相互验证。未展开社交／视频生态，因本次问题可由官方API与运行测试判定；不是完整站点审计报告。

- https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts ：isolated world、内容脚本与后台通信。
- https://developer.chrome.com/docs/extensions/develop/concepts/network-requests ：内容脚本请求代表注入页面的 origin。
- https://developers.brevo.com/docs/send-a-transactional-email ：已验证发件人、api-key及请求结构。
- https://www.brevo.com/pricing/ ：免费方案、账号获批后每日300封。
- https://resend.com/docs/knowledge-base/resend-sending-limits ：免费发送配额。
- https://resend.com/docs/dashboard/domains/introduction ：须验证自己拥有的发件域名。
