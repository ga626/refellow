# Refellow · 参伴

网站黄页、个人参考收藏夹和项目参考工作台。先保存画面和出处，再整理借鉴意图，将实际媒体交给 AI。

免费使用，原创代码采用 [MIT](LICENSE) 许可，公开仓库 ga626/refellow。第三方画面与品牌权利仍属原权利人。支持：18703937308@163.com。

原生 JavaScript/CSS、Node >=20、ES modules，无第三方运行依赖，无需 npm install。运行 start.cmd 或 node server.mjs，默认入口 http://127.0.0.1:5192/。npm test 验证；node scripts/build-collector.mjs 构建扩展；npm run build:pages 构建静态白名单包。

采集器0.4.0：工具栏授权后显示可拖动贴边圆钮，点击展开／收起，隐藏后工具栏恢复。用户主动截图或静音录制，再次点击停止，最多120秒／12MB。数据本地保存，网站与扩展通过含媒体文件交换，不自动同步。

public/collector 是共享源，采集器/shared 和 floating.js 为派生。local、部署和历史研究不进入源码库。开发包不是正式安装候选；正式候选绑定真实 PR、干净提交和摘要，完成真实 Edge 验收后才发布。

Edge 草稿已建立，尚未提交审核，真实扩展权限与外站录制待验。配套网站 https://lingganji.pages.dev/ 保持原入口，新版尚未部署。参阅[当前状态](docs/release-status.md)与[上架材料](docs/edge-store/申报材料.md)。
