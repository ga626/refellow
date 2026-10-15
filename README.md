# Refellow · 参伴

网站黄页、个人参考收藏夹和项目参考工作台。先保存画面和具体网址，再整理借鉴意图、图片、录像与资料。

免费使用，原创代码采用[MIT](LICENSE)许可。公开仓库 ga626/refellow；发布者 ga626；支持：18703937308@163.com。第三方画面与品牌权利仍属原权利人。

原生 JavaScript/CSS、ES modules，无第三方运行依赖。开发及测试使用 Node >=22.13（SQLite 开发适配器）。日常开发入口固定为 http://127.0.0.1:5192/；运行 start.cmd。网站仅更换公开名称和网址，保留原账号、密码、收藏、媒体和后端服务：正式 https://refellow.pages.dev/，固定测试 https://preview.refellow.pages.dev/。部署及开通状态见 project_status/current.md。

0.5.5换址开发版：黄页18站自动显示可拖动悬浮入口，其他网站点击工具栏显示；截图框选／整个可见画面，静音区域／整个标签页录制，菜单停止后上传个人空间。首次权限与真实 Edge 路径仍待验收。没有120秒时长限制，达到媒体缓冲容量会停止并尝试保存。

网站使用邮箱验证码注册、邮箱与密码登录，右上角显示头像及昵称。扩展在受信网站内自动识别登录，只获得与网站会话绑定的采集权限，不需要连接码。密码通过已验证邮箱重置；旧账户可用原用户名登录后绑定邮箱。支持修改昵称、退出及删除账户。真实邮件发送待配置免费发件服务，详见[账号接通与邮件配置](docs/account-integration.md)。新云端不自动上传或清除旧版浏览器收藏，已有备份可在使用与备份页按原格式导入。

Cloudflare Pages _worker.js 提供 API，D1 保存账户、工作台和分块媒体。需要专用 DB 绑定及服务端 AUTH_PEPPER；未配置时明确返回503，不能冒充保存成功。免费首版有容量和请求额度，超额提示，不自动启用付费服务。部署、测试和限制见[云端部署说明](docs/cloud-deployment.md)。

运行 start.cmd 默认启动持久的本机账户与媒体空间，已有账户可以直接登录测试。新注册需要配置真实邮件服务；自动测试使用隔离的测试邮件接收器，不代表邮件送达。扩展选项选择“本机开发网站”，首次按 Edge 提示允许回环访问，以后网站登录自动同步。界面明确标记测试空间，数据保存在本机专用 SQLite，不等于跨电脑云端，也不与线上账户混用。仅测试未配置分支时设置 REFELLOW_LOCAL_CLOUD=0。开发服务器的本机资料、数据库和秘密都位于 local，不进入制品。

npm test 验证；npm run build:pages 生成白名单 Pages 包；node scripts/build-collector.mjs 同步共享源并生成扩展开发包。public/collector 是共享模块源，采集器/shared 和 floating.js 是派生副本。普通开发包不能作为商城候选；正式候选绑定真实 PR、干净提交和摘要，公开前还须同一制品的云端及真实 Edge 验收。

网站、API 与扩展同仓库开发；网站刷新本地5192页面，扩展首次加载 local/acceptance/current/edge-extension，之后重新加载并刷新目标页。AI 负责准备版本、包和回执；current/previous只保留两版。[开发、加载与发布](docs/development-workflow.md)。

Edge 草稿已建，0.4真实加载后用户反馈核心采集行为不合需求；当前0.5正在修正、冻结和验证。尚未正式发版、更新生产网站或提交商店。参阅[发布状态](docs/release-status.md)和[申报材料](docs/edge-store/申报材料.md)。
