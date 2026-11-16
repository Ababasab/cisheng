# GitHub Pages 发布

- 公开仓库：https://github.com/Ababasab/cisheng
- Pages 地址：https://ababasab.github.io/cisheng/
- 发布来源：GitHub Actions；工作流为 `.github/workflows/pages.yml`。

在独立项目目录修改应用后，先执行 `node --test tests/*.test.js`，然后提交并推送 `main`。检查仓库 Actions 中 `Publish Word Notes to GitHub Pages` 的最新运行成功后，再验证网页。工作流仅上传 `dist` 静态产物。

旧站点继续保留。单词和文件夹按浏览器与网站域名分别保存，切换到 Pages 前请先在旧站逐文件夹导出 TXT。新站通过“直接输入 / 粘贴单词”导入；TXT 不包含归档和发音设置。

请用手机关闭 VPN，分别通过移动网络和 Wi-Fi 测试新地址；部署成功不代表所有国内网络均能直连。额外 Tatoeba 例句依赖外部网络，实际发音取决于设备语音能力。

本机若 Git 不能自动使用 Windows 代理，可在单次推送时传入与系统设置相同的 `http.proxy` 参数。GitHub CLI 负责仓库与 Pages 管理；现有 GitHub 连接器可提交工作流。不要在仓库中保存登录凭据、本地词汇、截图或缓存。
