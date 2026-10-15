# 发布状态（2026-10-16）

开发preview.refellow.pages.dev已部署21fe72e72f7af847efe9a81ef83313cadde93d56，包摘要a262cd27bf2a778c94bcd20ea2d1dfc27f4a372767da70f92530c8b3d47c5660；正式refellow.pages.dev仍为bff20eaae71febff3c73dde4affad598fd74a3b3。原有两个数据库和认证配置保留，资料隔离。

开发版已可无验证码注册、生成个人恢复密钥并找回密码。真实API注册、采集会话、媒体上传／读取、找回及旧身份撤销通过；72个公开文件核对通过，正式部署ID和摘要未变。邮件未开通，真实网页及Edge体验待用户验收。

当前继续codex/collector-floating-edge，本轮仅本地提交并更新开发版，没有GitHub推送或PR操作；PR #2仍未合并main，未创建GitHub Release或提交Edge审核。扩展仍为0.5.5，固定加载路径不变，本轮无需重新加载。

公开仓库ga626/refellow，MIT、免费；发布者ga626，支持18703937308@163.com。日常只提供两个新网址；旧lingganji尚留兼容，退役缺口见[当前状态](../project_status/current.md)。
