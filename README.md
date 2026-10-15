# Refellow · 参伴

网站黄页、个人参考收藏夹和项目参考工作台。先保存画面和具体网址，再整理借鉴意图、图片、录像与资料。

免费使用，原创代码采用[MIT](LICENSE)许可。公开仓库 ga626/refellow；发布者 ga626；支持：18703937308@163.com。第三方画面与品牌权利仍属原权利人。

原生 JavaScript/CSS、ES modules，无第三方运行依赖；开发工具使用 Node >=22.13。网站与扩展同仓库，日常只使用两个网站：

- [开发版](https://preview.refellow.pages.dev/)：新功能先在这里验收。
- [正式版](https://refellow.pages.dev/)：平时使用，保留原账号、收藏和媒体。

两个网站的账户和资料分开。本机5192是AI排错工具，默认停止，不是第三个云端网站。本地修改不会自动上线；实际部署与待上线内容见[当前状态](project_status/current.md)。

日常在既有分支修改、定向检查、本地提交，再更新开发版供用户刷新验收；不要求先建PR，也不逐次询问。只有用户明确说推送PR，才推送、创建／更新PR，检查合并后更新正式版。[部署入口](docs/pages-deployment.md)区分开发和正式发布；本地提交不等于GitHub推送。

0.5.5换址开发版：黄页18站自动显示可拖动悬浮入口，其他网站点击工具栏显示；截图框选／整个可见画面，静音区域／整个标签页录制，菜单停止后上传个人空间。首次权限与真实 Edge 路径仍待验收。没有120秒时长限制，达到媒体缓冲容量会停止并尝试保存。

网站暂用账号＋密码注册登录，账号可用用户名、邮箱或手机号（仅作账号，不代表已验证）。注册后保存一次展示的个人恢复密钥，忘记密码时用它重设；旧账户可继续登录，在右上角账户设置中用当前密码生成密钥。找回后会生成新密钥并撤销旧登录，收藏与媒体保留。右上角显示头像和昵称；扩展自动识别网站登录，不需要连接码。邮件接入等待Brevo工单处理，用户确认问题解决后再推进，详见[账号与找回方式](docs/account-integration.md)。新云端不自动上传或清除旧版浏览器收藏，已有备份可按原格式导入。

Cloudflare Pages _worker.js 提供 API，D1 保存账户、工作台和分块媒体。需要专用 DB 绑定及服务端 AUTH_PEPPER；未配置时明确返回503，不能冒充保存成功。免费首版有容量和请求额度，超额提示，不自动启用付费服务。部署、测试和限制见[云端部署说明](docs/cloud-deployment.md)。

本机调试按需运行start.cmd，以scripts/stop-local.ps1核对身份后停止。local/runtime保留本机账号和媒体，与云端资料分开；不作为用户日常验收入口。邮件测试接收器不能代表真实邮件送达。秘密和本机资料不进入制品。

npm test 验证；npm run build:pages 生成白名单 Pages 包；node scripts/build-collector.mjs 同步共享源并生成扩展开发包。public/collector 是共享模块源，采集器/shared 和 floating.js 是派生副本。普通开发包不能作为商城候选；正式候选绑定真实 PR、干净提交和摘要，公开前还须同一制品的云端及真实 Edge 验收。

网站由AI准备并核对开发版部署，用户刷新开发网址验收；扩展首次加载local/acceptance/current/edge-extension，之后重新加载并刷新目标页。AI准备版本、包和回执；current/previous只保留两版。[开发、加载与发布](docs/development-workflow.md)。

两站线上为0.5.5源码bff20ea；上文恢复密钥方案为本地待上线修改。Edge草稿已建，尚未提交审核；PR #2未合并、未创建GitHub Release。参阅[发布状态](docs/release-status.md)和[申报材料](docs/edge-store/申报材料.md)。
