# 发布与渠道状态

本轮按用户明确授权，使用 PR [#2](https://github.com/ga626/refellow/pull/2) 完成0.5.5公开发布与 Edge 商城提交。发布前检查不等于已交付；最终不可变制品、摘要与上线回执统一记录在 [GitHub Releases](https://github.com/ga626/refellow/releases)。

| 渠道 | 固定位置与判断依据 |
| --- | --- |
| 正式网站 | https://refellow.pages.dev/；/source-identity.json与/release.json可核对实际部署身份 |
| 开发网站 | https://preview.refellow.pages.dev/；账户、收藏与正式站隔离 |
| 源码与检查 | PR #2，quality CI冻结绑定源码SHA的候选 |
| 安装包 | GitHub Release中的refellow-collector-0.5.5.zip与SHA256SUMS.txt |
| Edge 商城 | [商城安装页](https://microsoftedge.microsoft.com/addons/detail/ahoahhmbphieigiefgceeoebfdijlcih)；2026-10-17 后台显示 0.5.5、Live / Public，公开详情页可访问，用户已确认通过 Edge 安装 |

正式发布只提升同一已验Pages候选与扩展ZIP，不从main重建代替。云端发信由服务器调用Brevo，与用户电脑代理是否开启无关；服务端秘密不包含在仓库或安装包内。原有数据库与AUTH_PEPPER保持，开发和正式环境分别配置邮件密钥。

2026-10-17 已复核 PR #2 合并、quality CI 成功及 main 为 e7a54b83dc651ef701e9a913b9c392fcf4c6130d。两站均配置邮件秘密，验证码接口分别返回成功，Brevo 日志中两封测试邮件均为 Delivered。用户电脑不承担发信；邮件投递成功不等于完整密码找回流程已验收。

源码、自动检查、真实 Edge、用户体验和商城审核各自记录。用户已确认商城安装通路，最终候选的截图、录像、账户关联及云端保存体验尚未全部确认；不把此前截图、网页预览或历史包检查冒充本轮真实 Edge 验收。现有邮件密钥在明确用途前保留，不凭名称停用。

版本功能和限制见 [0.5.5说明](releases/0.5.5.md)，开发与正式部署规则见 [部署入口](pages-deployment.md)。
