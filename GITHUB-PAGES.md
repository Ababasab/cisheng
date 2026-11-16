# GitHub Pages 发布

本目录准备为独立公开仓库，建议名为 cisheng。尚未创建远端仓库或部署新网址。

1. 所有者安装 GitHub 集成并授权自己的账户，不在聊天中发送密码、令牌或验证码。
2. 创建公开仓库，推送本目录到 main 分支；不要推送旧站点的 .git、.openai、data-cache 或 qa。
3. 仓库 Settings → Pages → Build and deployment → Source 选择 GitHub Actions。
4. 检查 Actions 中 Publish Word Notes to GitHub Pages 工作流成功，使用部署返回的真实 Pages 链接。
5. 用手机关闭 VPN 测试该链接；未实测前不保证国内网络直连。

工作流仅上传 dist 静态产物，不上传测试或源数据下载缓存。旧站保持运行。
单词和文件夹存储按浏览器域名隔离，换域名不会自动带过去，请先导出旧文件夹。
如工作流使用 setup 前不存在系统 Node，需配置 Node 22+；GitHub 托管 ubuntu-latest 通常预装 Node。

官方工作流参考：https://github.com/actions/starter-workflows/blob/main/pages/static.yml
