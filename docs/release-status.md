# 发布与渠道状态

本轮按用户明确授权，使用 PR [#2](https://github.com/ga626/refellow/pull/2) 完成0.5.5公开发布与 Edge 商城提交。发布前检查不等于已交付；最终不可变制品、摘要与上线回执统一记录在 [GitHub Releases](https://github.com/ga626/refellow/releases)。

| 渠道 | 固定位置与判断依据 |
| --- | --- |
| 正式网站 | https://refellow.pages.dev/；/source-identity.json与/release.json可核对实际部署身份 |
| 开发网站 | https://preview.refellow.pages.dev/；账户、收藏与正式站隔离 |
| 源码与检查 | PR #2，quality CI冻结绑定源码SHA的候选 |
| 安装包 | GitHub Release中的refellow-collector-0.5.5.zip与SHA256SUMS.txt |
| Edge 商城 | 既有产品草稿b7512a08-0a17-44f5-b7e0-b5b44a66c881；Store ID 0RDCK98XBFMT。审核进度以Partner Center回执为准，通过审核前不能称已上架 |

正式发布只提升同一已验Pages候选与扩展ZIP，不从main重建代替。云端发信由服务器调用Brevo，与用户电脑代理是否开启无关；服务端秘密不包含在仓库或安装包内。原有数据库与AUTH_PEPPER保持，开发和正式环境分别配置邮件密钥。

源码、自动检查、真实Edge、用户体验和商城审核各自记录。当前用户尚未对最终冻结候选确认体验通过；不把此前截图、网页预览或历史包检查冒充本轮真实Edge验收。

版本功能和限制见 [0.5.5说明](releases/0.5.5.md)，开发与正式部署规则见 [部署入口](pages-deployment.md)。
