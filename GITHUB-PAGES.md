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

## 固定编号与单词连读

每个文件夹的单词按录入顺序分配固定编号，显示为 `1.`、`2.`。既有词表自动补号，不改变单词、词义和文件夹；字母排序、录入顺序、搜索和编辑不改变编号。追加词汇续号，重复词跳过不占号。删除保留其他编号和续号计数，手动清空整个文件夹后重新从 1 开始。

“首 → 尾”“尾 → 首”按当前列表排序及搜索结果连读；编号范围如 `203-260` 则在整个文件夹内按编号读取，包含起止编号，`260-203` 可反向读。缺失起止编号会提示，中间已删除的词会跳过。范围连读开始时清空搜索以显示目标词。

显示当前词、编号、进度并高亮及滚动对应行。逐词等待语音完成事件，中间间隔 300ms；错误停止，沿用声音、口音及语速设置。停止、单词点读、切换文件夹、搜索/排序或更换发音设置会取消旧连读，避免残留的语音回调继续播放。批次状态不跨刷新恢复。

存储仍是本地 `word-notes-v1`（schemaVersion 3），新增词条 `number` 和文件夹 `nextNumber`，不提供云同步。测试：`node --test tests/reading.test.js` 和 `python tests/reading_browser_qa.py`（支持 QA_URL）；后者模拟语音引擎验证调度，真实设备出声仍需设备验证。
