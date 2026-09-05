# zenshare

Cloudflare Worker + D1 的匿名静态 HTML 分享项目。

## 功能

- 上传单个 `.html` 文件（最大 512KB），填写 alias 和基础 meta 信息。
- 访问地址为 `/zenshare/<alias>`。
- alias 唯一：前端提交前查重，D1 侧再以唯一索引兜底。
- 过期时间默认 7 天，可选 1-30 天；每次读取做懒清理，另有每日 UTC 20:00 Cron 清理。
- 后门约定：上传时 alias 填 `zenshare/<name>`，实际存储为 `<name>` 并设置为永久分享，且同样查重。
- 可选访问密码：文件在浏览器本地用 PBKDF2 + AES-256-GCM 加密，服务端不保存密码，也无法找回密码。
- 阅读页在 sandbox iframe 中展示内容，右上角信息图标可查看 meta，支持下载 HTML 和通过浏览器打印导出 PDF。
- 响应式布局，同时适配移动端与 PC。
- 支持浅色/深色模式切换，并通过 `localStorage` 记住偏好。
- 支持中文和英文界面切换。
- 页脚提供隐私政策、使用条款、zkraft.cc 产品入口、联系邮箱、MIT License 和 GitHub 开源地址。

## 目录

```text
src/index.js          Worker 路由、API、Cron 清理
public/               上传页与读取页静态资源
public/site.js        主题与多语言共享脚本
public/privacy.html   隐私政策
public/terms.html     使用条款
public/license.txt    MIT License 文本
migrations/           D1 migration
scripts/smoke-test.mjs 本地冒烟测试（加解密 + API 往返）
wrangler.toml         Worker / D1 / Cron 配置
```

## 本地开发

```bash
npm install
npm run db:local
npm run dev
```

本地服务默认运行在 `http://127.0.0.1:8787`。冒烟测试：

```bash
npm run smoke
```

测试脚本会创建一个密码保护的分享，验证上传、读取、解密、错误密码拒绝和 alias 查重。

## 数据库

`wrangler.toml` 已绑定数据库 `zkraft`：

```toml
[[d1_databases]]
binding = "DB"
database_name = "zkraft"
database_id = "8af0a86e-6a55-4e71-ab9e-4e53135a7510"
```

远程环境执行建表：

```bash
wrangler login
npm run db:remote
```

## 部署

```bash
npm run deploy
```

Worker 名称、发布路由和 Cron Trigger 都在 `wrangler.toml` 中。Cron 表达式为 `20 0 * * *`（UTC 20:00，即北京时间凌晨 4 点）。

如果要把 `/zenshare/*` 挂到自己的域名，按 Cloudflare 控制台路由规则添加到同一个 Worker 即可。

## API

### 检查 alias

```http
GET /api/alias-check?alias=demo
```

返回 `available`、规范化后的 `alias`，以及是否命中后门前缀 `permanent`。

### 创建分享

```http
POST /api/share
Content-Type: application/json
```

请求体：

```json
{
  "alias": "demo",
  "title": "报告标题",
  "description": "描述",
  "author": "作者",
  "tags": ["report", "demo"],
  "expires_days": 7,
  "password_protected": true,
  "content": "base64(ciphertext 或原文)",
  "salt": "base64(16 bytes)",
  "iv": "base64(12 bytes)"
}
```

`expires_days` 缺省为 7，范围 1-30。`password_protected` 为 `true` 时必须带 `salt` 和 `iv`（均为 base64）。

## 安全说明

- 有密码的分享全程零知识：密钥由读者输入的密码在浏览器本地派生，服务端只能看到密文、salt 和 IV。
- 无密码的分享不加密，服务端直接保存原文。
- 读取页将 HTML 放入不带 `allow-same-origin` 的 sandbox iframe，脚本可用但不能访问站点自身 origin。
- 永久分享目前不提供删除/更新界面，需要删除时直接在 D1 中手动删除对应记录。
