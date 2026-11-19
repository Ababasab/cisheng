# 牛津官方释义接入（待开通）

当前发布版 `dist/oxford-config.js` 的 enabled 为 false，未部署查询函数，也没有牛津凭据。未开通时隐藏“查牛津”按钮，已移除原有外链，不产生牛津请求或费用。本地 ECDICT 短语查询不受影响。

## 开通前提

- [Oxford API 官方凭据说明](https://developer.oxforddictionaries.com/documentation/getting_started)：需单独申请 App ID、App Key，并拥有所用语言/端点权限。
- [官方 Sandbox 说明](https://developer.oxforddictionaries.com/documentation/getting_started/sandbox)：500 次有限试用，英文仅 A 开头，不能用来测试 have trouble doing。
- [API 使用条款](https://developer.oxforddictionaries.com/api-terms-and-conditions)：需要在协议许可范围内展示、注明来源；以词典查询为主要用途的产品须按条款联系 Oxford 确认许可。API 数据集并不等于牛津学习词典网页。
- [翻译接口](https://developer.oxforddictionaries.com/translations-api)支持英汉词典数据，但并非任意句子的机器翻译；没有收录的短语会返回未找到。

## 配置与发布

1. 在 Supabase 项目的 Edge Functions Secrets 设置 `OXFORD_APP_ID`、`OXFORD_APP_KEY`。勿写进网页、Git、聊天或任务日志。
2. 将允许查询的账号 UUID 填入 `OXFORD_ALLOWED_USER_IDS`（逗号分隔）。默认空名单拒绝所有账号；先只开放管理员账号。还应在 Oxford 订阅端设好用量预算。函数内每实例每账号 10 次/分钟只是补充限流，不能替代供应商预算或上线收费服务时的全局配额。
3. 生产使用不设置 `OXFORD_SANDBOX`；如为有限 Sandbox 试用，设成 true。可用 `OXFORD_ALLOWED_ORIGINS` 明确允许额外站点，默认仅 https://ababasab.github.io。
4. 使用已登录 CLI 部署：`supabase functions deploy oxford-lookup --project-ref bmelpvnezfuxaagyhduo`。保留平台 JWT 校验；函数还请求 Auth `/user` 验证用户并检查名单，不信任客户端传来的账号 ID。
5. 在已获许可的真实账号验证英汉、英文回退、短语未收录、无权限及超时。成功后才将 `dist/oxford-config.js` 的 enabled 改为 true，发布 Pages。

## 展示行为

“查牛津”按钮调用同项目服务端函数，查询结果直接出现在当前词条的中文区内；真实官方返回才显示“牛津”标签。先尝试中文词典翻译，无中文权限或未收录时查英文词典并标注“英文释义”。不使用单个组成词的释义充当完整短语释义，不静默翻译英文或冒充牛津中文。

每次点击最多两个官方请求，只传当前词条，不发送整本单词或照片；网页中只保存当前会话内的结果，刷新后不保留。服务端不记录请求体、凭据或原始响应，不使用付费接口时不发出请求。无权、超时及未收录显示在原词条，不替换免费词库释义，也不改变排序、滚动位置或保存的词表。

Node 测试使用合成响应验证适配和权限，不代表已完成真实 Oxford 集成。没有正式凭据及真实验证时不得开启开关或声称上线了牛津释义。
