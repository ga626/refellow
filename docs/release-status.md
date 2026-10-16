# 发布状态（2026-10-16）

开发preview.refellow.pages.dev已部署6a3c111a4dd903b75c19f89c273cd3ba8dd31714，包摘要58241d65f3d6dcce6b734300c9eb9bfd94bab0efe8bc9e6c4d2968cee7704d78；正式refellow.pages.dev仍为bff20eaae71febff3c73dde4affad598fd74a3b3。原有两个数据库和认证配置保留，资料隔离。

开发版已可无验证码注册、生成个人恢复密钥并找回密码。此前真实API注册、采集会话、媒体上传／读取、密钥找回及旧身份撤销通过；2026-10-16开发环境已接通Brevo并验证真实收件，新增默认邮箱注册／找回且保留密钥备用。本轮19项定向检查及线上表单通过；独立只读回执local/verification/pages-deployment/preview-verification.json核对部署身份、4个变更／身份文件、安全响应头、404、邮件就绪和正式版未变。原上传命令超时回执保留unknown；本轮72文件全量公网检查遇TLS重置，未称全量通过。正式环境邮件未启用，真实用户绑定／重置和Edge体验待用户验收。

当前继续codex/collector-floating-edge，本轮仅本地提交并更新开发版，没有GitHub推送或PR操作；PR #2仍未合并main，未创建GitHub Release或提交Edge审核。扩展仍为0.5.5，固定加载路径不变，本轮无需重新加载。

公开仓库ga626/refellow，MIT、免费；发布者ga626，支持18703937308@163.com。日常只提供两个新网址；旧lingganji尚留兼容，退役缺口见[当前状态](../project_status/current.md)。
