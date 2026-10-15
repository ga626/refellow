# 参伴云端部署与验收合同

2026-10-12。0.5候选，免费优先，当前0.5.4本地候选改为邮箱验证码注册＋密码登录。当前生产网站尚未更新；本地 QA 不是已交付云端。

## 部署结构

沿用 Cloudflare Pages 项目 lingganji。网站原生模块调用同源 /api；Pages 高级模式 _worker.js 由源码确定性生成，_routes.json 只把 /api/* 送往后端。其余白名单静态文件由 Pages 服务。D1 使用专用数据库，按 user_id 校验全部访问；不从其他项目数据库取资料。

生产和预览分别绑定专用数据库 DB，并设置不同的 AUTH_PEPPER（至少32字符随机秘密，仅服务端）。首版不绑定 R2，媒体继续按512KiB分块保存在 D1；以后用户明确同意产生费用后，才可为对应环境新增 MEDIA R2 绑定并执行迁移。秘密不进入 Git、前端、候选、URL或日志；不要读取旧账号配置或备份密钥。数据库权限绑定须取得明确确认。候选验收只使用预览数据库，不能混入生产用户数据。

schema.sql 是初始建表合同；首次预览库为空，无已有用户迁移。冻结候选同时携带 cloud-schema.sql。公开部署提升同一 Pages artifact，不能在上传时重建功能代码。部署包只携带已编译 _worker.js，不依赖另上传 Functions 源码目录。

## 免费首版容量

媒体按512KiB分块，单份最多64MiB，录制接近60MiB停止后保存；每账户媒体128MiB，首版媒体总量300MiB，工作台每账户1MiB文字JSON，合计48MiB文字，最多500账户。首版不启用 R2，分块直接写入 D1 的 `chunks` BLOB 表，保持零新增订阅费用；代码保留可选的 `MEDIA` R2 适配器，未来切换前须先绑定对应 R2、执行 `cloud/migrations/0002-r2-media.sql` 并重新完成同一候选验收。额度保护不自动购买或升级。

服务器逐块验证大小、SHA-256和首块格式；完成只做SQL分块数量与总大小核对，不一次加载整段录像。下载按块读取并由客户端复核每块及完整文件SHA。完整SHA是上传客户端计算的声明，服务器没有独立做整文件二次摘要；不得宣称服务器全文件摘要复验已完成。

工作台保存用 revision 比较，拒绝覆盖另一页面的新修改；批量验证全部媒体归属，避免每附件消耗一次D1查询。采集token仅可上传和查询自身账号，不能读取或修改工作台。登录会话最长30天，最多保留最近20个；采集会话绑定网站父会话，退出或重置密码立即失效，不再使用连接码。

## 账户与媒体

密码使用 WebCrypto PBKDF2-SHA256、随机salt与服务端pepper，100000迭代。邮箱验证码哈希存储、一次性消费、10分钟有效、最多5次错误；发送有间隔和每日额度保护。重置密码撤销全部旧会话。旧账户登录后可验证绑定邮箱，不自动信任旧用户名的邮箱形式。支持密码确认删除账户。真实邮件需配置MAIL_FROM和BREVO_API_KEY或RESEND_API_KEY，先执行0003迁移，见account-integration.md。生产安全与免费CPU可用性仍须在真正Cloudflare候选中检查，Node本地测试不能替代。

媒体上传使用稳定ID重试，完成后重复提交不添加重复收藏。截图等待框选时使用扩展临时缓冲，账号变更后拒绝保存旧截图；录像绑定开始时的账号。旧origin内的localStorage和IndexedDB不自动迁移，通过用户导出／确认导入进入账户。文字修改失败保留在本页面，暂停进一步写入，提供重试和备份；不得把排队保存当成服务端已保存。

## 冻结候选验收清单

- 邮件注册、登录、邮箱重置、跨端读取；两账户隔离；设备token不具备工作台权限。
- 实际PNG和静音WebM上传、分块下载、渲染、播放、摘要往返；损坏／缺块／空间超额明确拒绝；重复保存幂等。
- 同源写入、cookie保护、匿名拒绝、删除账户级联；日志不输出凭据。
- 真实Edge加载同候选：当前网页截图框选／整屏，DPR／125%映射、取消；区域／整屏静音录制、手动停止、源结束、后台休眠和上传失败重试。
- 自动测试、内置浏览器预览、模拟API、真实Edge、Cloudflare预览、生产交付分别写回执；不能相互冒充。
- 权限、隐私和商城审核说明与实际云保存一致；审核员需网站测试账号或自行注册、连接扩展。

## 官方核验路径

本轮先成功调用原生 KnowledgeRadar health_check(summary)、get_capabilities(summary)，经kr_research计划路由后执行 host_internal_web_wave；内置web工具未返回有效来源。Cloudflare官方正文通过 Codex IAB 读取，非本机探针代替MCP。

- https://developers.cloudflare.com/workers/platform/limits/ ：免费10ms CPU／请求、128MB isolate、100000请求／日；读取页面更新2026-10-08。认证和大JSON存在CPU风险，必须真实部署验证。
- https://developers.cloudflare.com/d1/platform/limits/ ：免费每DB500MB、账号5GB，50次查询／请求，行／BLOB最大2000000字节；上一连续轮官方浏览器已读取。
- https://developers.cloudflare.com/workers/runtime-apis/web-crypto/ ：WebCrypto原生接口与DigestStream。页面读取未明确给出PBKDF2迭代上限；100000的真实运行接受度尚未验证。
- https://developers.cloudflare.com/pages/get-started/direct-upload/ ：Dashboard不编译functions目录，但明确支持_worker.js；预览部署支持指定分支。
- 已登录账号D1页面实测0/10库、0/5M读取、0/100k写入、0B/5GB存储硬上限，未启用升级或支付。随后创建专用 refellow-preview，ID写入本机基础设施回执。

这些来源支持平台合同，不能证明生产账户功能已经部署成功。KR研究质量账本尚未关闭，不宣称深研治理通过。
