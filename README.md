# dsh-cinema · 影音工作室

[English](#english) | 中文

一个 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web 插件：左侧栏多一个「影音工作室」图标，点开是整页面板——TMDB 热门海报墙，加上你自己的 **CMS 片源管理、搜索、选集和面板内播放**。

> 形态参考 CineFlow，但这里是独立实现：原生 React 面板（不用 iframe），不移植原项目代码。插件不内置任何片源，源由使用者自己添加。

## 功能

**片源（核心）**

- **内置 34 个常用采集接口**：首次加载自动合并进你的源列表；删掉的不会自动回来，需要时可点「恢复内置源」
- 管理多个 CMS V10 采集接口：单个添加、删除，或整份 JSON / TVBox 配置 / `名称|地址` 分行一键导入，也支持拉取一个配置地址
- **源测速**：并发测一遍所有源，直接在源列表里显示毫秒数或「不通」
- 在源里搜索片名，或翻页浏览最新；**搜索词云**记录最近搜过的词，点一下重放
- 点结果 → 选集弹窗：多线路切换、集数网格
- 点集数 → 面板内播放：m3u8 由内置 hls.js、FLV 由内置 flv.js，mp4 直链走媒体代理（支持拖动进度）
- **播放历史与续播**：每 5 秒记录一次进度（含源、线路、集数、秒数），历史页一键续播、单条删除；播完自动下一集
- **收藏**：TMDB 条目和片源结果都能收藏，顶栏收藏面板一键直达

**TMDB 元数据**

- 热门电影 / 热门剧集海报墙、评分
- **分类片库**：类型 × 年份筛选、下滑自动续拉
- `/search/multi` 搜索、详情弹窗、最近看过（最多 24 条），详情页可直接用你自己的片源起播
- **自然语言/场景搜索**：搜「回南天」「夜宵」「陪爸妈」「烧脑」这类词时，自动扩展到对应类型并合并结果
- 打开插件默认落在「电影」标签

## 架构

```
浏览器面板  ──同源请求──>  Host 代理  ──node:https──> 上游
```

| 路由 | 用途 |
|---|---|
| `/dsh-cinema/tmdb/...` | TMDB API，密钥走 `x-tmdb-key` / `x-tmdb-token` 请求头 |
| `/dsh-cinema/img` | TMDB 海报 |
| `/dsh-cinema/cms` | CMS V10 JSON（`ac=detail&wd=...&pg=1`） |
| `/dsh-cinema/pic` | 片源海报（带 Referer，绕开防盗链） |
| `/dsh-cinema/media` | mp4/ts 直通，支持 `Range` |
| `/dsh-cinema/hls` | 拉取 m3u8 并把分片地址重写回本代理，解决跨域/防盗链 |
| `/dsh-cinema/vendor/hls.min.js` | 内置 hls.js（Apache-2.0，见 `vendor/hls.js.LICENSE`） |

出网策略分两种，因为国外和国内站点的可达性相反：

- **TMDB**：代理优先（`DSH_CINEMA_PROXY` → `HTTPS_PROXY` → `http://127.0.0.1:7897`），失败回退直连
- **片源**：直连优先，失败回退代理（实测某 CDN 直连 200、走代理 404）
- 直连使用显式 `https.Agent`，避免宿主全局 agent 被代理接管

## 安装

**从 npm（推荐给使用者）**

```powershell
# 在 DSH「插件 → 添加插件」里直接填包名：
dsh-cinema
```

或在会话里用插件管理器：

```
plugin_manager  action=install_bundle  target=dsh-cinema
```

**从源码（开发用，改完即时生效）**

```powershell
git clone https://github.com/ObliviateOnline/dsh-cinema.git D:\plugins\dsh-cinema
```

然后在 DSH 会话里用插件管理器安装（不要手改 profile）：

```
plugin_manager  action=install_bundle  target=<插件目录绝对路径>
```

## 使用

**片源**

1. 左侧栏点胶片图标 → 面板默认就在「片源」
2. 「管理源」→ 填接口地址（形如 `http://xxx.com/api.php/provide/vod`），或把整份
   `{"sources":[{"name":"…","url":"…"}]}` 粘进文本框 / 选文件导入
3. 选一个源 → 搜索片名或翻页 → 点海报 → 选集 → 播放

**TMDB**（可选，只影响「电影 / 剧集 / 片库」三个标签）

1. 去 [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api) 申请免费 Developer Plan
2. 把 **API Key (v3)** 或 **Read Access Token (v4)** 填进面板，保存时会实时校验（401 直接提示密钥无效），存在浏览器 localStorage（键 `dsh-cinema:key`）
3. 面板首次打开会显示分步引导；不想配也可以点「先看片源」直接看片

## 安全与边界

- 代理路由只接受 `/movie/123`、`/trending/movie/week` 这类 TMDB 路径；CMS/图片/媒体/播放列表的 `u` 参数只放行 `http(s)` 绝对地址，拒绝其它协议
- 密钥只存在浏览器 localStorage，随单次请求头发给本机宿主；宿主不缓存、不写日志
- 插件不内置任何片源、不带遥测；接什么源、看什么内容由使用者决定并自负其责

## 已验证 / 未验证

在本机（Windows + DSH Desktop 0.2.2-rc.1）实测：

| 检查 | 结果 |
|---|---|
| `/dsh-cinema/tmdb/configuration` 无密钥 / 伪密钥 | 400 / 401（401 来自 TMDB，说明代理出网正常） |
| `/dsh-cinema/cms?u=<真实 CMS>` | 200，`code:1`，20 条数据 |
| `/dsh-cinema/pic?u=<真实海报>` | 200，24,628 字节 JPEG |
| `/dsh-cinema/hls?u=<master m3u8>` | 200，返回重写后的播放列表 |
| 子播放列表 → 分片 | 子列表 200；首个 `.ts` 分片 200，393,108 字节 `video/mp2t` |
| `/dsh-cinema/vendor/hls.min.js` | 200，623,915 字节 |
| 非法尺寸 / 非法文件名 / 不存在的图 | 400 / 400 / 404 |

**未验证**：浏览器里的实际渲染与交互（开发环境没有浏览器调试通道），以及不同源、不同 CDN 的兼容性。不同源的反盗链策略差异很大，遇到不能播的源请开 issue 附上接口地址与报错。

## English

A DeepSeek Harness Web plugin: a left-sidebar cinema entry that opens a full-page panel with TMDB trending/search **and your own CMS source management** — add/import Apple CMS V10 endpoints, search titles, pick episodes, and play in-panel (m3u8 via bundled hls.js, mp4 via a Range-capable media proxy).

Host proxies: TMDB API/posters, CMS JSON, source posters, media passthrough, and an m3u8 rewriter. Proxy policy differs by target: TMDB is proxy-first, sources are direct-first with proxy fallback.

No sources ship with this plugin. The key stays in browser localStorage and travels only in request headers.

## License

MIT © 2026 ObliviateOnline. Bundled hls.js is Apache-2.0 (`vendor/hls.js.LICENSE`).
