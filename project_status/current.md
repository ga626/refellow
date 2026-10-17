# 当前状态（2026-10-17）

## 已交付

- 产品 PR #2 已于 2026-10-16 合并；main / v0.5.5 为 e7a54b83dc651ef701e9a913b9c392fcf4c6130d。quality CI 38931498688 成功，冻结源码为 711871f95d76dfdb3d08bf9704d3fd31714924f2。
- 正式站 https://refellow.pages.dev/，开发站 https://preview.refellow.pages.dev/。同一已验候选分别部署，两站账号、收藏和媒体隔离。正式部署 3ea972cd-1634-4c6e-aeb3-f1e1660581f0；开发部署 364d9814-59aa-403f-a486-95899e23d836。Pages 包摘要 297f82f24406e8dc9e4611673aba6c402ffd673c9593046a36692a7012f58e4e。
- GitHub Release v0.5.5 已建立。扩展 ZIP 为 153923 bytes，SHA-256 74b2306420688c6d7b0e0a3e66e430b701bb127c4f63980795c0e8a771db460c。验收目录仍为 local/acceptance/current/edge-extension。
- Edge 商城后台与公开详情页均已确认版本 0.5.5、Live / Public，产品 b7512a08-0a17-44f5-b7e0-b5b44a66c881，CRX ID ahoahhmbphieigiefgceeoebfdijlcih。用户确认已通过 Edge 商城安装；不能据此宣称截图、录像和云端保存全部体验通过。

## 邮件核对

- 2026-10-17 实查 Cloudflare：两环境均有 secret_text 类型的 BREVO_API_KEY、MAIL_FROM、AUTH_PEPPER；原 DB 绑定及正式部署身份保持。
- 两站 /api/status 均 ready=true、emailReady=true。分别调用验证码接口均 HTTP 200，Brevo 日志对应两封“参伴 · 邮箱验证”均 Delivered。仅验证投递，未改变用户账号或密码；本轮未验证完整邮件找回流程。
- 既有两把密钥此前显示为 Refellow account emails、Refellow production account emails。Cloudflare 不返回秘密原文，不能仅凭名称证明对应关系，也不能把开发密钥当作废弃密钥。当前未生成、替换或停用密钥；密钥列表重新打开后核对使用记录。此前“production未启用邮件”“商城尚未提交”等记录已过期。
- 发信在 Cloudflare 服务端执行，用户电脑不承担邮件发送。不得改用个人 163 SMTP 或自动升级付费。

## 验收边界与保留事项

- 用户已确认商城安装通路；最终版本的真实框选截图、区域／整页录像、账户自动关联、上传与播放，仍待实际体验确认。邮箱注册／找回的完整用户操作亦未记录通过。
- 旧 lingganji 项目及迁移备份保留，未核对旧入口与资料前不删除。此前账号清理仅对应 2026-10-16 已授权范围，不包含此后用户新建账号。5192 默认停止。
- 本轮收尾证据在 local/verification/release-0.5.5：发布／部署回执、mail-config-audit.json、mail-send-check.json、brevo-delivered-2026-10-17.jpg。秘密与私有证据不入 Git。
- 日常开发继续遵循既有分支 → 定向检查／本地提交 → 更新开发站 → 用户明确启动 PR → CI／合并 → 提升正式候选。仅整理状态文档不重新发布网站或扩展。
