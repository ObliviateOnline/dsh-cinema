# dsh-cinema · 影音工作室

[English](#english) | 中文

一个 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web 插件：左侧栏多一个「影音工作室」图标，点开是整页海报墙——TMDB 热门电影、热门剧集、片名搜索、详情弹窗、最近看过。

> 形态参考 CineFlow 那种「桌面观影入口」，但这里是独立实现的 DSH 面板：原生 React，不用 iframe，不移植原项目代码。

## 功能

- **热门电影 / 剧集**：`/trending/{movie,tv}/week`，海报墙 + 评分角标 + 年份
- **搜索**：`/search/multi`，电影、剧集统一搜
- **详情弹窗**：简介、类型、片长、评分，可跳转 TMDB 页面
- **最近看过**：点过的片子记在浏览器本地，最多 24 条
- **中英双语**，只用 DSH 主题 token，跟随明暗主题

## 为什么需要宿主代理

TMDB 在国内直连不可达；海报 CDN（image.tmdb.org）同样不可达。插件的 Host 半边提供两个同源代理：

| 路由 | 作用 |
|---|---|
| `/dsh-cinema/tmdb/...` | 转发到 `api.themoviedb.org/3/...`，密钥走请求头，不进 URL |
| `/dsh-cinema/img?size=w342&file=xxx.jpg` | 转发海报图片 |

出网方式：`node:https` + HTTP `CONNECT` 隧道。代理地址按
`DSH_CINEMA_PROXY` → `HTTPS_PROXY` → `http://127.0.0.1:7897`（Clash 默认端口）→ 直连回退 依次解析。

## 安装

这是一个 DSH **bundle**（`package.json` 里声明 `dsh.bundle.patch`），用插件管理器安装，不要手工改 profile：

```powershell
git clone https://github.com/<you>/dsh-cinema.git D:\plugins\dsh-cinema
```

然后在 DSH 会话里：

```
plugin_manager  action=install_bundle  target=<上面那个目录的绝对路径>
```

装好之后：左侧栏出现胶片图标 → 点开 → 首次会让填 TMDB 密钥。

## 使用

1. 去 [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api) 注册免费的 Developer Plan，拿到 **API Key (v3)** 或 **Read Access Token (v4)**
2. 粘进面板的输入框保存（存在当前浏览器 localStorage，键 `dsh-cinema:key`）
3. 顶部切「电影 / 剧集」，或在搜索框输入片名回车

代理没跑时，面板会显示「连接 TMDB 失败」并给出提示；换网络后可用环境变量指到自己的代理再启动 DSH：

```powershell
$env:DSH_CINEMA_PROXY = "http://127.0.0.1:7897"
```

## 结构

```
dsh-cinema/
├─ package.json       # dsh.bundle.patch + dsh.client（web, immediately）声明
├─ cordis.patch.yml   # 插入 Loader 行，id: cinema
├─ index.js           # Host 半边：两个 webServer 代理路由
├─ client.js          # 浏览器半边：sidebar.panellist + main 槽位
├─ locale/{zh,en}.json
├─ icon.svg
└─ LICENSE (MIT)
```

## 安全边界

- 代理路由只接受 `/movie/123`、`/trending/movie/week` 这类路径：拒绝绝对 URL、`..`、反斜杠、查询串走私
- 图片路由只放行固定尺寸档位与 `xxx.jpg|png|webp` 纯文件名，不做任意 URL 转发
- 密钥只存在浏览器 localStorage，随单次请求头发给本机宿主；宿主不缓存、不写日志
- 插件不发送任何遥测

## 已验证 / 未验证

在本机（Windows + DSH Desktop 0.2.2-rc.1）实测：

| 请求 | 结果 |
|---|---|
| `/dsh-cinema/tmdb/configuration` 无密钥 | 400（自校验） |
| 同上 + 伪密钥 | 401（来自 TMDB，说明宿主经代理出网成功） |
| `/dsh-cinema/tmdb/trending/movie/week` + 伪密钥 | 401（路径与会话参数正确透传） |
| `/dsh-cinema/img?size=w342&file=f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg` | 200，58,477 字节真实海报 |
| 非法尺寸 / 非法文件名 / 不存在的图 | 400 / 400 / 404 |

**未验证**：浏览器里的实际渲染与交互（开发环境没有浏览器调试通道），以及带真实密钥时的列表数据。欢迎 issue 反馈。

## English

A DeepSeek Harness Web plugin: adds a cinema entry to the left sidebar and opens a full-page TMDB poster wall with trending movies/shows, title search, a detail dialog and local history.

- Host half proxies TMDB API and posters through `node:https` + HTTP `CONNECT`, so the browser only talks to the same origin. Proxy URL resolution: `DSH_CINEMA_PROXY` → `HTTPS_PROXY` → `http://127.0.0.1:7897` → direct fallback.
- Your TMDB key stays in browser localStorage and travels only in request headers.
- Install with DSH's plugin manager (`install_bundle`, target = the package directory). Do not edit the profile by hand.

## License

MIT © 2026 ObliviateOnline
