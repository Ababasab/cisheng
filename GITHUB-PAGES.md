# GitHub Pages 发布

- 公开仓库：https://github.com/Ababasab/cisheng
- Pages 地址：https://ababasab.github.io/cisheng/
- 发布来源：GitHub Actions；工作流为 `.github/workflows/pages.yml`。

在独立项目目录修改应用后，先执行 `node --test tests/*.test.js`，然后提交并推送 `main`。检查仓库 Actions 中 `Publish Word Notes to GitHub Pages` 的最新运行成功后，再验证网页。工作流仅上传 `dist` 静态产物。

旧站点继续保留。单词和文件夹按浏览器与网站域名分别保存，切换到 Pages 前请先在旧站逐文件夹导出 TXT。新站可点击“导入词表文件”选择 TXT，或通过“直接输入 / 粘贴单词”导入；TXT 不包含归档和发音设置。

请用手机关闭 VPN，分别通过移动网络和 Wi-Fi 测试新地址；部署成功不代表所有国内网络均能直连。额外 Tatoeba 例句依赖外部网络，实际发音取决于设备语音能力。

本机若 Git 不能自动使用 Windows 代理，可在单次推送时传入与系统设置相同的 `http.proxy` 参数。GitHub CLI 负责仓库与 Pages 管理；现有 GitHub 连接器可提交工作流。不要在仓库中保存登录凭据、本地词汇、截图或缓存。

## 文件词表导入

支持 PDF、DOCX、XLSX、TXT、CSV、TSV，单文件最多 20 MB / 20,000 行，PDF 最多 200 页。旧版 DOC/XLS 请先另存为 DOCX/XLSX。文件只在浏览器处理，所有解析资源均随站点提供，不依赖第三方 CDN。PDF 有文字层时直接提取；扫描页面使用原有本地英语 OCR，支持取消。加密 PDF 需用户先解锁。

导入后进入校对：可选工作表/正文/表格、英文列、词条短语或全部英文，再选目标文件夹并确认。自动识别列仅为启发式；请校对，原文件的中文释义不会替换本地词典。Word 读取正文及表格；Excel 读取可见工作表的文本及公式已有缓存值，不执行公式。

新增自动检查：`node --test tests/file-words.test.js`；真实文件浏览器检查：`python tests/file_import_browser_qa.py`。后者需 Playwright、Pillow、reportlab、python-docx、openpyxl；测试依赖可放 qa/python-deps（不提交），支持 QA_URL 环境变量测试线上版本。
