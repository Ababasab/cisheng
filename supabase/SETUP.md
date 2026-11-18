# 词声邮箱登录与云同步

网站现有的访客模式与本机词库保留。云端只存单词、文件夹和同步版本；照片、密码、设备声音选择不进入词库表。

## 免费项目

1. 在 Supabase 的免费组织下创建名为 `cisheng` 的项目，区域建议新加坡。不要升级付费套餐；数据库密码保存在个人密码管理器，不提交到 Git。
2. 执行 `migrations/202611180001_word_notes_sync.sql`。表启用按 `auth.uid()` 隔离的 RLS，只有已登录用户能读写自己的数据。
3. Authentication → Providers 开启 Email，保留邮箱确认。配置密码至少 8 位。
4. Authentication → URL Configuration：Site URL 填 `https://ababasab.github.io/cisheng/`，将同一个地址加入 Redirect URLs；本机测试地址只在测试期间加入。
5. 把项目 URL 和 **publishable key**（也可用旧版 anon key）填入 `dist/cloud-config.js`。这些是允许在浏览器使用的公开配置；禁止填 service_role、sb_secret、数据库密码或管理令牌。网页也会拒绝服务端密钥。
6. 发布后用两个独立浏览器登录同一邮箱，实测首次合并、增删改、断网重连、退出和恢复登录。未连接到真实项目前，不宣称手机电脑已同步。

## 发信限制

Supabase 自带 SMTP 只向项目组织的预授权成员邮箱发送邮件，默认每小时邮件量也很少。可先用项目所有者邮箱进行个人测试；开放任意邮箱注册、确认和找回密码，需要配置自定义 SMTP。完成发信验证后，在公开 CLOUD_CONFIG 中设置 registrationLimited: false 可隐藏管理员邮箱试用提示。不要为省去发信设置而关闭邮箱确认。SMTP 凭据只放 Supabase 控制台，不能放网页或公开仓库。

PKCE 找回密码邮件需在发起请求的同一浏览器打开。注册确认后可以返回词声，用邮箱密码登录。

## 合并规则

首次登录合并本机访客数据与云端数据；相同名称文件夹合并，同文件夹中英文不区分大小写去重。不同文件夹保留各自单词。

后续采用版本检查与三方合并：并发新增保留；互不冲突字段保留；同一字段同时编辑以最后成功提交者为准；删除优先于另一个设备的旧修改，避免旧词复活。修改在上传期间发生也不会被响应覆盖。

访客与各账号使用独立的本机草稿。退出账号不清除账号草稿，重新登录后续传；不会把账号草稿转成下一个账号的访客导入内容。后台只先检查版本，有更新才下载词库，减少免费流量消耗。

## 验证

- `node --test tests/*.test.js`
- `python tests/sync_browser_qa.py`：真实 SDK + 隔离的 Auth/REST 测试接口，不等于线上实测。
- `node tests/sync_sql_qa.mjs`：需在忽略目录 `qa/pglite/package` 提供 `@electric-sql/pglite`，或用 PGLITE_MODULE 指定模块；验证真实 PostgreSQL 的 RLS、权限与版本冲突。

参考：
- https://supabase.com/docs/guides/auth/auth-smtp
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/auth/sessions/pkce-flow


## 本机已部署状态（2026-11-18）

项目：`cisheng`，区域：新加坡，组织：Ababasab's Org（Free）。数据库和 Auth 配置已应用。CLI 位于 `D:/CodexTools/supabase-cli/supabase.exe`。

数据库密码仅保存为当前 Windows 用户可解密的 DPAPI 文件：`D:/CodexTools/private/cisheng-db-password.dpapi`，不在 Git 中；不在任务日志记录任何密码、令牌或密钥值。

本机 SQL 测试运行时位于 D 盘，PowerShell 可设置：

```powershell
$env:PGLITE_MODULE='file:///D:/CodexTools/word-listen-dev/pglite/package/dist/index.js'
node tests/sync_sql_qa.mjs
```

`tests/sync_live_qa.py` 用 CLI 已保存的凭据临时创建两个 QA 账号，在 finally 中删除，仅删除临时测试数据。敏感凭据仅存在进程内存，不写文件、不输出；运行前应确认目标为上述项目。
