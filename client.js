/**
 * 浏览器半边：「影音工作室」——左侧栏入口 + 整页面板。
 *
 * 两个数据面：
 *   1. TMDB 元数据：热门电影/剧集、搜索、详情（经 /dsh-cinema/tmdb 代理）
 *   2. 片源（CMS V10 采集接口）：自己管理源、搜索、选集、面板内播放
 *      m3u8 由内置 hls.js 播放，分片经 /dsh-cinema/hls 代理；mp4 走 /dsh-cinema/media。
 *
 * 插件不内置任何片源，源由用户自己添加或粘贴导入。
 */
window.__ModuleLoader__.load({
  id: 'dsh-cinema',
  factory: (require) => {
    const React = require('react');
    const h = React.createElement;

    const NS = 'dshCinema';
    const PANEL_ID = 'cinema';
    const KEY_STORAGE = 'dsh-cinema:key';
    const HISTORY_STORAGE = 'dsh-cinema:history';
    const SOURCES_STORAGE = 'dsh-cinema:sources';
    const PROGRESS_STORAGE = 'dsh-cinema:progress';
    const FAVORITES_STORAGE = 'dsh-cinema:favorites';
    const HISTORY_MAX = 24;
    const TMDB_SIGNUP = 'https://www.themoviedb.org/settings/api';

    const GENRES = {
      movie: [
        ['28', '动作'],
        ['12', '冒险'],
        ['16', '动画'],
        ['35', '喜剧'],
        ['80', '犯罪'],
        ['99', '纪录'],
        ['18', '剧情'],
        ['10751', '家庭'],
        ['14', '奇幻'],
        ['36', '历史'],
        ['27', '恐怖'],
        ['10402', '音乐'],
        ['9648', '悬疑'],
        ['10749', '爱情'],
        ['878', '科幻'],
        ['53', '惊悚'],
        ['10752', '战争'],
        ['37', '西部'],
      ],
      tv: [
        ['10759', '动作冒险'],
        ['16', '动画'],
        ['35', '喜剧'],
        ['80', '犯罪'],
        ['99', '纪录'],
        ['18', '剧情'],
        ['10751', '家庭'],
        ['9648', '悬疑'],
        ['10765', '科幻奇幻'],
        ['10766', '肥皂剧'],
        ['10764', '真人秀'],
        ['10767', '脱口秀'],
      ],
    };

    /** 场景/心情词 → TMDB 类型（自然语言搜索的兜底扩展）。 */
    const SCENE_RULES = [
      { words: ['回南天', '梅雨', '下雨', '雨天', '潮湿'], genres: ['10749', '18'], label: '雨天/潮湿' },
      { words: ['夜宵', '宵夜', '深夜', '睡不着'], genres: ['35', '80'], label: '深夜/夜宵' },
      { words: ['聚会', '派对', '朋友', '多人'], genres: ['35', '12'], label: '聚会' },
      { words: ['心情不好', 'emo', '低落', '治愈', '难过'], genres: ['18', '10749'], label: '治愈' },
      { words: ['陪爸妈', '家庭', '家务', '背景音', '吃饭'], genres: ['10751', '35'], label: '家庭/背景音' },
      { words: ['恐怖', '吓人', '惊悚'], genres: ['27', '53'], label: '恐怖' },
      { words: ['科幻', '太空', '未来'], genres: ['878', '12'], label: '科幻' },
      { words: ['动画', '动漫', '二次元'], genres: ['16'], label: '动画' },
      { words: ['爱情', '恋爱', '甜'], genres: ['10749'], label: '爱情' },
      { words: ['动作', '打斗', '热血'], genres: ['28', '12'], label: '动作' },
      { words: ['悬疑', '烧脑', '推理'], genres: ['9648', '53'], label: '悬疑' },
    ];

    const zh = {
      title: '影音工作室',
      subtitle: '热门电影、剧集，以及你自己的片源',
      tabMovies: '电影',
      tabTv: '剧集',
      tabSources: '片源',
      searchPlaceholder: '搜索片名 / 剧名，回车确认',
      search: '搜索',
      refresh: '刷新',
      key: '密钥',
      back: '返回对话',
      setupTitle: '先填一个 TMDB 密钥',
      setupBody: '面板通过宿主的同源代理访问 TMDB，密钥只保存在这台浏览器里。v3 API Key 和 v4 Read Access Token 都支持。',
      setupLink: '去 themoviedb.org 申请',
      keyPlaceholder: '粘贴 API Key 或 Read Access Token',
      save: '保存',
      clear: '清除',
      loading: '正在加载…',
      empty: '没有结果',
      recent: '最近看过',
      noPoster: '暂无海报',
      openTmdb: '在 TMDB 打开',
      close: '关闭',
      proxyError: '连接 TMDB 失败',
      proxyHint: '确认 Clash / 代理在运行（默认 127.0.0.1:7897），或用环境变量 DSH_CINEMA_PROXY 指定。',
      noKey: '还没有配置密钥',
      manageSources: '管理源',
      addSource: '添加',
      sourceName: '名称（可留空）',
      sourceApi: '接口地址，如 http://xxx.com/api.php/provide/vod',
      noSources: '还没有片源接口',
      noSourcesBody: '填一个 CMS V10 采集接口地址，或把片源 JSON（{"sources":[{"name":"","url":""}]}）粘进下面导入。插件本身不带任何源。',
      importSources: '粘贴片源 JSON 导入',
      importBtn: '导入',
      sourceError: '片源接口返回失败',
      sourceLoading: '正在取列表…',
      sourceSearchPlaceholder: '在片源里搜片名',
      prevPage: '上一页',
      nextPage: '下一页',
      episodes: '选集',
      line: '线路',
      playNow: '播放',
      playing: '播放中',
      closePlayer: '关闭播放器',
      playWithSources: '用我的片源播放',
      sourceSearching: '正在你的片源里找…',
      sourceNoMatch: '你的片源里没找到这部',
      sourceNone: '还没有片源，先去「片源」里添加或导入',
      pickSource: '选一个源播放',
      tabHistory: '历史',
      favorites: '收藏',
      addFavorite: '收藏',
      removeFavorite: '取消收藏',
      noFavorites: '还没有收藏',
      noHistory: '还没有播放记录',
      resume: '继续',
      playAgain: '重播',
      removeRecord: '删除',
      progressDone: '已看完',
      speedTest: '测速',
      speedTesting: '测速中…',
      speedDead: '不通',
      searchCloudClear: '清空记录',
      quickSearch: '搜过',
      sceneHint: '已按场景扩展：{label}',
      tabLibrary: '片库',
      genre: '类型',
      year: '年份',
      all: '全部',
      libraryEnd: '已经到底了',
      needHls: 'HLS 播放器没加载成功，只能播 mp4 直链。',
      playerError: '播放失败',
      remove: '删除',
      sourceCount: '{count} 个源',
      results: '共 {count} 条',
      latest: '最新',
      searchIn: '搜索',
    };

    const en = {
      title: 'Cinema studio',
      subtitle: 'Trending titles and your own sources',
      tabMovies: 'Movies',
      tabTv: 'Shows',
      tabSources: 'Sources',
      searchPlaceholder: 'Search a title, press Enter',
      search: 'Search',
      refresh: 'Refresh',
      key: 'Key',
      back: 'Back to conversation',
      setupTitle: 'Add a TMDB key first',
      setupBody: 'The panel reaches TMDB through the Host’s same-origin proxy; the key stays in this browser. A v3 API key or a v4 read access token both work.',
      setupLink: 'Get one on themoviedb.org',
      keyPlaceholder: 'Paste an API key or read access token',
      save: 'Save',
      clear: 'Clear',
      loading: 'Loading…',
      empty: 'Nothing found',
      recent: 'Recently opened',
      noPoster: 'No poster',
      openTmdb: 'Open on TMDB',
      close: 'Close',
      proxyError: 'Could not reach TMDB',
      proxyHint: 'Check that your proxy (127.0.0.1:7897 by default) is running, or set DSH_CINEMA_PROXY.',
      noKey: 'No key configured yet',
      manageSources: 'Manage sources',
      addSource: 'Add',
      sourceName: 'Name (optional)',
      sourceApi: 'API URL, e.g. http://xxx.com/api.php/provide/vod',
      noSources: 'No source configured',
      noSourcesBody: 'Add a CMS V10 API endpoint, or paste a sources JSON ({"sources":[{"name":"","url":""}]}) below. No sources ship with this plugin.',
      importSources: 'Paste sources JSON to import',
      importBtn: 'Import',
      sourceError: 'The source returned an error',
      sourceLoading: 'Loading list…',
      sourceSearchPlaceholder: 'Search inside sources',
      prevPage: 'Prev',
      nextPage: 'Next',
      episodes: 'Episodes',
      line: 'Line',
      playNow: 'Play',
      playing: 'Playing',
      closePlayer: 'Close player',
      playWithSources: 'Play from my sources',
      sourceSearching: 'Searching your sources…',
      sourceNoMatch: 'Not found in your sources',
      sourceNone: 'No sources yet — add or import them in the Sources tab',
      pickSource: 'Pick a source to play',
      tabHistory: 'History',
      favorites: 'Favorites',
      addFavorite: 'Favorite',
      removeFavorite: 'Unfavorite',
      noFavorites: 'No favorites yet',
      noHistory: 'Nothing watched yet',
      resume: 'Resume',
      playAgain: 'Play again',
      removeRecord: 'Remove',
      progressDone: 'Finished',
      speedTest: 'Test',
      speedTesting: 'Testing…',
      speedDead: 'Down',
      searchCloudClear: 'Clear history',
      quickSearch: 'Recent searches',
      sceneHint: 'Scene match: {label}',
      tabLibrary: 'Library',
      genre: 'Genre',
      year: 'Year',
      all: 'All',
      libraryEnd: 'End of list',
      needHls: 'The HLS player did not load; only direct mp4 links can play.',
      playerError: 'Playback failed',
      remove: 'Remove',
      sourceCount: '{count} sources',
      results: '{count} results',
      latest: 'Latest',
      searchIn: 'Search',
    };

    function readStorage(name) {
      try {
        return window.localStorage.getItem(name);
      } catch {
        return null;
      }
    }

    function writeStorage(name, value) {
      try {
        if (value === null) window.localStorage.removeItem(name);
        else window.localStorage.setItem(name, value);
      } catch {
        /* ignore */
      }
    }

    function getKey() {
      const raw = readStorage(KEY_STORAGE);
      return typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : null;
    }

    function loadHistory() {
      try {
        const parsed = JSON.parse(readStorage(HISTORY_STORAGE) ?? '[]');
        return Array.isArray(parsed) ? parsed.filter((x) => x && typeof x.id === 'number') : [];
      } catch {
        return [];
      }
    }

    function loadSources() {
      try {
        const parsed = JSON.parse(readStorage(SOURCES_STORAGE) ?? '[]');
        if (!Array.isArray(parsed)) return [];
        return parsed
          .filter((s) => s && typeof s.url === 'string' && /^https?:\/\//i.test(s.url))
          .map((s, i) => ({
            id: String(s.id ?? `s${i}-${s.url}`),
            name: String(s.name ?? s.url).trim() || s.url,
            url: s.url,
          }));
      } catch {
        return [];
      }
    }

    function loadProgress() {
      try {
        const parsed = JSON.parse(readStorage(PROGRESS_STORAGE) ?? '[]');
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((x) => x && typeof x.url === 'string' && /^https?:\/\//i.test(x.url));
      } catch {
        return [];
      }
    }

    function loadFavorites() {
      try {
        const parsed = JSON.parse(readStorage(FAVORITES_STORAGE) ?? '[]');
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((x) => x && (x.kind === 'tmdb' || x.kind === 'vod'));
      } catch {
        return [];
      }
    }

    function remember(history, item) {
      if (!item || typeof item.id !== 'number') return history;
      const entry = {
        id: item.id,
        mediaType: item.mediaType === 'tv' ? 'tv' : 'movie',
        title: item.title ?? '',
        year: item.year ?? '',
        poster: item.poster ?? null,
        at: Date.now(),
      };
      const rest = history.filter((x) => !(x.id === entry.id && x.mediaType === entry.mediaType));
      return [entry, ...rest].slice(0, HISTORY_MAX);
    }

    function posterUrl(path, size) {
      const file = String(path).replace(/^\/+/, '');
      return `/dsh-cinema/img?size=${encodeURIComponent(size)}&file=${encodeURIComponent(file)}`;
    }

    function picUrl(raw) {
      return `/dsh-cinema/pic?u=${encodeURIComponent(raw)}`;
    }

    function mediaUrl(raw) {
      return `/dsh-cinema/media?u=${encodeURIComponent(raw)}`;
    }

    function hlsUrl(raw) {
      return `/dsh-cinema/hls?u=${encodeURIComponent(raw)}`;
    }

    function tmdbHeaders(key) {
      return key.startsWith('eyJ') ? { 'x-tmdb-token': key } : { 'x-tmdb-key': key };
    }

    async function tmdbGet(path, key) {
      const res = await fetch(`/dsh-cinema/tmdb${path}`, { headers: tmdbHeaders(key) });
      const text = await res.text();
      let json = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }
      if (!res.ok) {
        const message = json?.error ?? json?.status_message ?? `HTTP ${res.status}`;
        throw new Error(json?.detail ? `${message} (${json.detail})` : message);
      }
      return json;
    }

    function normalize(list, fallbackType) {
      return (Array.isArray(list) ? list : [])
        .filter((x) => x && typeof x.id === 'number' && x.media_type !== 'person')
        .map((x) => ({
          id: x.id,
          mediaType: x.media_type === 'tv' ? 'tv' : fallbackType === 'tv' ? 'tv' : 'movie',
          title: x.title ?? x.name ?? '',
          year: String(x.release_date ?? x.first_air_date ?? '').slice(0, 4),
          rating: typeof x.vote_average === 'number' && x.vote_average > 0 ? x.vote_average : null,
          poster: x.poster_path ?? null,
          overview: x.overview ?? '',
        }));
    }

    /* ------------------------------------------------------------ CMS */

    /** 解析片源文本：JSON 数组 / {sources} / TVBox {sites} / `名称|地址` 分行 / 裸地址。 */
    function parseSourcesText(text) {
      const out = [];
      const push = (name, url) => {
        const clean = String(url ?? '').trim();
        if (!/^https?:\/\//i.test(clean)) return;
        out.push({ name: String(name ?? '').trim() || clean, url: clean });
      };
      const raw = String(text ?? '').trim();
      if (raw === '') return out;

      if (raw.startsWith('{') || raw.startsWith('[')) {
        try {
          const parsed = JSON.parse(raw);
          const list = Array.isArray(parsed)
            ? parsed
            : Array.isArray(parsed?.sources)
              ? parsed.sources
              : Array.isArray(parsed?.sites)
                ? parsed.sites
                : [];
          for (const item of list) {
            if (typeof item === 'string') {
              const [name, url] = item.split('|');
              push(name, url);
            } else if (item && typeof item === 'object') {
              push(item.name ?? item.Name, item.url ?? item.api ?? item.Api ?? item.Url);
            }
          }
          if (out.length > 0) return out;
        } catch {
          /* 不是合法 JSON，按分行格式继续 */
        }
      }

      for (const line of raw.split(/\r?\n/)) {
        const value = line.trim();
        if (value === '' || value.startsWith('#')) continue;
        if (value.startsWith('{') || value.startsWith('[')) continue;
        if (value.includes('|')) {
          const at = value.indexOf('|');
          push(value.slice(0, at), value.slice(at + 1));
          continue;
        }
        if (/^https?:\/\//i.test(value)) push('', value);
      }
      return out;
    }

    function cmsEndpoint(base, params) {
      let url;
      try {
        url = new URL(base);
      } catch {
        throw new Error('接口地址不是合法 URL');
      }
      for (const [name, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== '') url.searchParams.set(name, value);
      }
      return url.toString();
    }

    async function cmsGet(base, params) {
      const target = cmsEndpoint(base, params);
      const res = await fetch(`/dsh-cinema/cms?u=${encodeURIComponent(target)}`);
      const text = await res.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(`接口返回的不是 JSON（HTTP ${res.status}）`);
      }
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
      if (json && json.code !== undefined && Number(json.code) === 0) throw new Error(json.msg ?? '接口返回失败');
      return json;
    }

    function normalizeCms(json) {
      const list = Array.isArray(json?.list) ? json.list : [];
      return list
        .map((x) => ({
          id: String(x.vod_id ?? ''),
          title: x.vod_name ?? '',
          pic: x.vod_pic ?? '',
          year: String(x.vod_year ?? ''),
          remarks: x.vod_remarks ?? '',
          raw: x,
        }))
        .filter((x) => x.id !== '' && x.title !== '');
    }

    function parsePlay(vod) {
      const lines = String(vod?.vod_play_from ?? '').split('$$$');
      const groups = String(vod?.vod_play_url ?? '').split('$$$');
      return groups
        .map((group, index) => ({
          name: lines[index]?.trim() || `线路${index + 1}`,
          episodes: group
            .split('#')
            .filter(Boolean)
            .map((part) => {
              const at = part.indexOf('$');
              const name = at >= 0 ? part.slice(0, at) : part;
              const url = at >= 0 ? part.slice(at + 1) : '';
              return { name: name.trim(), url: url.trim() };
            })
            .filter((ep) => /^https?:\/\//i.test(ep.url)),
        }))
        .filter((line) => line.episodes.length > 0);
    }

    function isHls(url) {
      return /\.m3u8(\?|#|$)/i.test(url);
    }

    function isFlv(url) {
      return /\.flv(\?|#|$)/i.test(url);
    }

    let flvLoader = null;
    function ensureFlv() {
      if (window.flvjs) return Promise.resolve(window.flvjs);
      if (!flvLoader) {
        flvLoader = new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = '/dsh-cinema/vendor/flv.min.js';
          script.onload = () => (window.flvjs ? resolve(window.flvjs) : reject(new Error('flv.js not registered')));
          script.onerror = () => reject(new Error('flv.js failed to load'));
          document.head.appendChild(script);
        });
      }
      return flvLoader;
    }

    function normalizeTitle(text) {
      return String(text ?? '')
        .toLowerCase()
        .replace(/[\s·:：\-—_.,，。!！?？'"“”‘’()（）\[\]【】《》<>]/g, '');
    }

    function matchesTitle(a, b) {
      const x = normalizeTitle(a);
      const y = normalizeTitle(b);
      if (x === '' || y === '') return false;
      return x.includes(y) || y.includes(x);
    }

    /** 在用户配置的所有片源里按片名搜索，返回聚合结果（带源名）。 */
    async function searchVodInSources(sources, titles) {
      const cleanTitles = [...new Set(titles.map((x) => String(x ?? '').trim()).filter(Boolean))];
      const jobs = sources.map(async (source) => {
        const found = [];
        for (const title of cleanTitles) {
          const controller = new AbortController();
          const timer = window.setTimeout(() => controller.abort(), 8000);
          try {
            const target = cmsEndpoint(source.url, { ac: 'detail', wd: title, pg: '1' });
            const res = await fetch(`/dsh-cinema/cms?u=${encodeURIComponent(target)}`, { signal: controller.signal });
            if (!res.ok) continue;
            const json = await res.json().catch(() => null);
            for (const item of normalizeCms(json)) {
              if (matchesTitle(item.title, title)) found.push({ ...item, sourceName: source.name });
            }
            if (found.length > 0) break;
          } catch {
            /* 单个源失败不影响其它源 */
          } finally {
            window.clearTimeout(timer);
          }
        }
        return found;
      });
      const settled = await Promise.all(jobs);
      return settled.flat();
    }

    let hlsLoader = null;
    function ensureHls() {
      if (window.Hls) return Promise.resolve(window.Hls);
      if (!hlsLoader) {
        hlsLoader = new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = '/dsh-cinema/vendor/hls.min.js';
          script.onload = () => (window.Hls ? resolve(window.Hls) : reject(new Error('hls.js not registered')));
          script.onerror = () => reject(new Error('hls.js failed to load'));
          document.head.appendChild(script);
        });
      }
      return hlsLoader;
    }

    function CinemaIcon(props) {
      const size = typeof props?.size === 'number' ? props.size : 16;
      return h(
        'svg',
        {
          viewBox: '0 0 24 24',
          width: size,
          height: size,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: props?.active ? 1.9 : 1.6,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          style: { display: 'block' },
        },
        h('rect', { x: 2.5, y: 6, width: 19, height: 12.5, rx: 2.5 }),
        h('path', { d: 'M2.5 9.5h19M6.5 6V4M12 6V4M17.5 6V4' }),
        h('path', { d: 'M8 12.5l3.5 2-3.5 2z' }),
      );
    }

    const styles = {
      root: {
        display: 'flex',
        flexDirection: 'column',
        flex: '1 1 auto',
        height: '100%',
        minHeight: 0,
        position: 'relative',
        boxSizing: 'border-box',
        background: 'var(--dsw-alias-bg-base)',
        color: 'var(--dsw-alias-label-primary)',
        padding: '22px 24px 20px',
        gap: '12px',
        overflow: 'hidden',
      },
      header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flex: '0 0 auto' },
      heading: { display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 },
      title: { margin: 0, fontSize: '18px', fontWeight: 600, lineHeight: 1.3 },
      subtitle: { margin: 0, fontSize: '12px', color: 'var(--dsw-alias-label-secondary)' },
      headerActions: { display: 'flex', gap: '8px', flex: '0 0 auto' },
      ghostBtn: {
        appearance: 'none',
        border: '1px solid var(--dsw-alias-border-l1)',
        background: 'transparent',
        color: 'var(--dsw-alias-label-secondary)',
        borderRadius: '8px',
        padding: '5px 10px',
        fontSize: '12px',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      },
      toolbar: { display: 'flex', gap: '8px', alignItems: 'center', flex: '0 0 auto', flexWrap: 'wrap' },
      tab: (active) => ({
        appearance: 'none',
        border: `1px solid ${active ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-border-l1)'}`,
        background: active ? 'var(--dsw-alias-bg-layer-2)' : 'transparent',
        color: active ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-label-secondary)',
        borderRadius: '999px',
        padding: '6px 14px',
        fontSize: '13px',
        fontWeight: active ? 600 : 400,
        cursor: 'pointer',
      }),
      searchWrap: { display: 'flex', flex: '1 1 240px', gap: '6px', minWidth: '180px' },
      input: {
        flex: '1 1 auto',
        minWidth: '120px',
        boxSizing: 'border-box',
        padding: '7px 12px',
        borderRadius: '8px',
        border: '1px solid var(--dsw-alias-border-l1)',
        background: 'var(--dsw-alias-bg-layer-1)',
        color: 'var(--dsw-alias-label-primary)',
        font: 'inherit',
        fontSize: '13px',
        outline: 'none',
      },
      primaryBtn: (disabled) => ({
        appearance: 'none',
        border: 'none',
        borderRadius: '8px',
        padding: '7px 14px',
        fontSize: '13px',
        fontWeight: 600,
        cursor: disabled ? 'default' : 'pointer',
        background: 'var(--dsw-alias-brand-primary)',
        color: 'var(--dsw-alias-bg-base)',
        opacity: disabled ? 0.45 : 1,
        whiteSpace: 'nowrap',
      }),
      status: { fontSize: '12px', color: 'var(--dsw-alias-label-secondary)', flex: '0 0 auto' },
      errorBox: {
        flex: '0 0 auto',
        border: '1px solid var(--dsw-alias-border-l1)',
        borderLeft: '3px solid var(--dsw-alias-state-error-primary)',
        borderRadius: '8px',
        background: 'var(--dsw-alias-bg-layer-1)',
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        fontSize: '12.5px',
      },
      grid: {
        flex: '1 1 auto',
        minHeight: 0,
        overflowY: 'auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(132px, 1fr))',
        gap: '14px 12px',
        alignContent: 'start',
        paddingRight: '2px',
      },
      card: {
        appearance: 'none',
        border: 'none',
        padding: 0,
        background: 'transparent',
        color: 'inherit',
        textAlign: 'left',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        minWidth: 0,
      },
      posterBox: {
        position: 'relative',
        width: '100%',
        aspectRatio: '2 / 3',
        borderRadius: '10px',
        overflow: 'hidden',
        background: 'var(--dsw-alias-bg-layer-2)',
        border: '1px solid var(--dsw-alias-border-l1)',
      },
      posterImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
      posterFallback: {
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: '11px',
        padding: '8px',
        textAlign: 'center',
      },
      ratingBadge: {
        position: 'absolute',
        right: '6px',
        bottom: '6px',
        padding: '1px 6px',
        borderRadius: '999px',
        fontSize: '11px',
        fontWeight: 600,
        background: 'rgba(0,0,0,0.62)',
        color: '#fff',
        fontVariantNumeric: 'tabular-nums',
      },
      remarkBadge: {
        position: 'absolute',
        left: '6px',
        top: '6px',
        maxWidth: 'calc(100% - 12px)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        padding: '1px 6px',
        borderRadius: '999px',
        fontSize: '11px',
        background: 'rgba(0,0,0,0.62)',
        color: '#fff',
      },
      cardTitle: {
        margin: 0,
        fontSize: '12.5px',
        lineHeight: 1.35,
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      },
      cardMeta: { margin: 0, fontSize: '11px', color: 'var(--dsw-alias-label-secondary)' },
      setup: { flex: '1 1 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0, overflowY: 'auto' },
      setupCard: {
        width: 'min(520px, 100%)',
        border: '1px solid var(--dsw-alias-border-l1)',
        background: 'var(--dsw-alias-bg-layer-1)',
        borderRadius: '12px',
        padding: '18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      },
      setupTitle: { margin: 0, fontSize: '15px', fontWeight: 600 },
      setupBody: { margin: 0, fontSize: '12.5px', lineHeight: 1.6, color: 'var(--dsw-alias-label-secondary)' },
      keyRow: { display: 'flex', gap: '6px', alignItems: 'center' },
      textarea: {
        width: '100%',
        boxSizing: 'border-box',
        minHeight: '90px',
        resize: 'vertical',
        padding: '8px 10px',
        borderRadius: '8px',
        border: '1px solid var(--dsw-alias-border-l1)',
        background: 'var(--dsw-alias-bg-layer-1)',
        color: 'var(--dsw-alias-label-primary)',
        font: 'inherit',
        fontSize: '12.5px',
        outline: 'none',
      },
      link: { color: 'var(--dsw-alias-brand-primary)', fontSize: '12px', textDecoration: 'none' },
      chipsRow: { display: 'flex', gap: '8px', overflowX: 'auto', flex: '0 0 auto', paddingBottom: '2px' },
      chip: (active) => ({
        appearance: 'none',
        border: `1px solid ${active ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-border-l1)'}`,
        background: active ? 'var(--dsw-alias-bg-layer-2)' : 'transparent',
        color: active ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-label-secondary)',
        borderRadius: '999px',
        padding: '4px 10px',
        fontSize: '12px',
        cursor: 'pointer',
        flex: '0 0 auto',
        whiteSpace: 'nowrap',
      }),
      recentWrap: { flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: '6px' },
      recentLabel: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)' },
      recentRow: { display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '2px' },
      recentChip: {
        appearance: 'none',
        border: '1px solid var(--dsw-alias-border-l1)',
        background: 'var(--dsw-alias-bg-layer-1)',
        borderRadius: '8px',
        padding: '3px',
        cursor: 'pointer',
        flex: '0 0 auto',
        width: '54px',
      },
      histRow: {
        display: 'flex',
        gap: '10px',
        alignItems: 'center',
        border: '1px solid var(--dsw-alias-border-l1)',
        background: 'var(--dsw-alias-bg-layer-1)',
        borderRadius: '10px',
        padding: '8px 10px',
      },
      modalBackdrop: {
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        zIndex: 5,
      },
      modal: {
        width: 'min(780px, 100%)',
        maxHeight: '100%',
        overflowY: 'auto',
        background: 'var(--dsw-alias-bg-layer-1)',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: '14px',
        padding: '18px',
        display: 'flex',
        gap: '16px',
      },
      modalPoster: { width: '170px', flex: '0 0 auto' },
      modalBody: { display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0, flex: '1 1 auto' },
      modalTitle: { margin: 0, fontSize: '17px', fontWeight: 600 },
      modalMeta: { fontSize: '12px', color: 'var(--dsw-alias-label-secondary)', display: 'flex', gap: '10px', flexWrap: 'wrap' },
      modalOverview: { margin: 0, fontSize: '13px', lineHeight: 1.65 },
      lineTabs: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' },
      epGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(74px, 1fr))', gap: '6px', maxHeight: '260px', overflowY: 'auto', paddingRight: '4px' },
      epBtn: {
        appearance: 'none',
        border: '1px solid var(--dsw-alias-border-l1)',
        background: 'var(--dsw-alias-bg-layer-2)',
        color: 'var(--dsw-alias-label-primary)',
        borderRadius: '6px',
        padding: '6px 4px',
        fontSize: '12px',
        cursor: 'pointer',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      },
      playerBackdrop: {
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,0.82)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 9,
      },
      playerBar: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px',
        padding: '10px 14px',
        color: '#fff',
        fontSize: '13px',
      },
      playerStage: { flex: '1 1 auto', minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 14px 14px' },
      video: { width: '100%', maxHeight: '100%', background: '#000', borderRadius: '8px' },
      playerError: { color: '#fff', fontSize: '12.5px', padding: '10px 14px' },
    };

    function Poster({ src, alt, fallbackText, style }) {
      const [broken, setBroken] = React.useState(false);
      React.useEffect(() => {
        setBroken(false);
      }, [src]);
      if (!src || broken) {
        return h('div', { style: style ? { ...styles.posterFallback, ...style } : styles.posterFallback }, fallbackText);
      }
      return h('img', {
        src,
        alt,
        loading: 'lazy',
        style: style ? { ...styles.posterImg, ...style } : styles.posterImg,
        onError: () => setBroken(true),
      });
    }

    function Player({ src, title, initialPosition, onProgress, onEnded, onClose, t }) {
      const videoRef = React.useRef(null);
      const [error, setError] = React.useState(null);

      React.useEffect(() => {
        const video = videoRef.current;
        if (!video) return undefined;
        let cancelled = false;
        let hlsInstance = null;
        let flvPlayer = null;

        if (isFlv(src)) {
          ensureFlv()
            .then((flvjs) => {
              if (cancelled) return;
              if (!flvjs.isSupported()) {
                setError('FLV not supported');
                return;
              }
              flvPlayer = flvjs.createPlayer(
                { type: 'flv', url: mediaUrl(src), isLive: false },
                { enableStashBuffer: false },
              );
              flvPlayer.attachMediaElement(video);
              flvPlayer.load();
              flvPlayer.play();
            })
            .catch(() => setError(t('needHls')));
          return () => {
            cancelled = true;
            if (flvPlayer) {
              try {
                flvPlayer.unload();
                flvPlayer.detachMediaElement();
                flvPlayer.destroy();
              } catch {
                /* ignore */
              }
            }
            video.removeAttribute('src');
            video.load();
          };
        }

        if (!isHls(src)) {
          video.src = mediaUrl(src);
          return () => {
            video.removeAttribute('src');
            video.load();
          };
        }

        ensureHls()
          .then((Hls) => {
            if (cancelled) return;
            if (Hls.isSupported()) {
              hlsInstance = new Hls({ maxBufferLength: 30, enableWorker: true });
              hlsInstance.on(Hls.Events.ERROR, (_event, data) => {
                if (data && data.fatal) setError(data.details || 'HLS error');
              });
              hlsInstance.loadSource(hlsUrl(src));
              hlsInstance.attachMedia(video);
            } else {
              video.src = hlsUrl(src);
            }
          })
          .catch(() => setError(t('needHls')));

        return () => {
          cancelled = true;
          if (hlsInstance) hlsInstance.destroy();
          video.removeAttribute('src');
          video.load();
        };
      }, [src]);

      React.useEffect(() => {
        const video = videoRef.current;
        if (!video) return undefined;
        const seek = () => {
          if (!initialPosition || initialPosition < 5) return;
          const max = Number.isFinite(video.duration) && video.duration > 5 ? video.duration - 5 : initialPosition;
          video.currentTime = Math.min(initialPosition, max);
        };
        if (video.readyState >= 1) seek();
        let lastAt = 0;
        const onTime = () => {
          const now = Date.now();
          if (now - lastAt < 5000) return;
          lastAt = now;
          if (onProgress && Number.isFinite(video.duration) && video.duration > 0) onProgress(video.currentTime, video.duration);
        };
        const handleEnded = () => {
          if (onProgress && Number.isFinite(video.duration)) onProgress(video.duration, video.duration);
          if (onEnded) onEnded();
        };
        video.addEventListener('loadedmetadata', seek);
        video.addEventListener('timeupdate', onTime);
        video.addEventListener('ended', handleEnded);
        return () => {
          video.removeEventListener('loadedmetadata', seek);
          video.removeEventListener('timeupdate', onTime);
          video.removeEventListener('ended', handleEnded);
        };
      }, [src, initialPosition]);

      return h(
        'div',
        { style: styles.playerBackdrop },
        h(
          'div',
          { style: styles.playerBar },
          h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, title),
          h(
            'button',
            { type: 'button', style: styles.ghostBtn, onClick: onClose },
            t('closePlayer'),
          ),
        ),
        h(
          'div',
          { style: styles.playerStage },
          h('video', {
            ref: videoRef,
            controls: true,
            autoPlay: true,
            playsInline: true,
            style: styles.video,
          }),
        ),
        error ? h('div', { style: styles.playerError }, `${t('playerError')}: ${error}`) : null,
      );
    }

    function createPanel(ctx, t) {
      return function CinemaPanel() {
        const [key, setKey] = React.useState(getKey);
        const [tab, setTab] = React.useState('movie');
        const [query, setQuery] = React.useState('');
        const [items, setItems] = React.useState([]);
        const [loading, setLoading] = React.useState(false);
        const [error, setError] = React.useState(null);
        const [nonce, setNonce] = React.useState(0);
        const [detail, setDetail] = React.useState(null);
        const [history, setHistory] = React.useState(loadHistory);
        const [keyDraft, setKeyDraft] = React.useState('');
        const [keyEditorOpen, setKeyEditorOpen] = React.useState(false);
        const requestId = React.useRef(0);

        const [sources, setSources] = React.useState(loadSources);
        const [activeSourceId, setActiveSourceId] = React.useState(() => loadSources()[0]?.id ?? null);
        const [sourceManagerOpen, setSourceManagerOpen] = React.useState(false);
        const [sourceName, setSourceName] = React.useState('');
        const [sourceUrl, setSourceUrl] = React.useState('');
        const [importText, setImportText] = React.useState('');
        const [cmsItems, setCmsItems] = React.useState([]);
        const [cmsLoading, setCmsLoading] = React.useState(false);
        const [cmsError, setCmsError] = React.useState(null);
        const [cmsQuery, setCmsQuery] = React.useState('');
        const [cmsPage, setCmsPage] = React.useState(1);
        const [cmsSearching, setCmsSearching] = React.useState(false);
        const [selectedVod, setSelectedVod] = React.useState(null);
        const [activeLine, setActiveLine] = React.useState(0);
        const [playing, setPlaying] = React.useState(null);
        const [speed, setSpeed] = React.useState({});
        const [testing, setTesting] = React.useState(false);
        const [searches, setSearches] = React.useState(() => {
          try {
            const parsed = JSON.parse(readStorage('dsh-cinema:searches') ?? '[]');
            return Array.isArray(parsed) ? parsed.filter((x) => x && typeof x.q === 'string') : [];
          } catch {
            return [];
          }
        });
        const [sceneLabel, setSceneLabel] = React.useState(null);
        const [progress, setProgress] = React.useState(loadProgress);
        const [favorites, setFavorites] = React.useState(loadFavorites);
        const [favoritesOpen, setFavoritesOpen] = React.useState(false);
        const [libType, setLibType] = React.useState('movie');
        const [libGenre, setLibGenre] = React.useState('');
        const [libYear, setLibYear] = React.useState('');
        const [libItems, setLibItems] = React.useState([]);
        const [libPage, setLibPage] = React.useState(1);
        const [libLoading, setLibLoading] = React.useState(false);
        const [libError, setLibError] = React.useState(null);
        const [libHasMore, setLibHasMore] = React.useState(true);

        const years = React.useMemo(() => {
          const current = new Date().getFullYear();
          return Array.from({ length: 37 }, (_, index) => String(current - index));
        }, []);

        React.useEffect(() => {
          if (tab !== 'library' || !key) return undefined;
          let cancelled = false;
          setLibLoading(true);
          setLibError(null);
          const params = new URLSearchParams({
            language: 'zh-CN',
            sort_by: 'popularity.desc',
            include_adult: 'false',
            page: String(libPage),
          });
          if (libGenre) params.set('with_genres', libGenre);
          if (libYear) params.set(libType === 'movie' ? 'primary_release_year' : 'first_air_date_year', libYear);
          tmdbGet(`/discover/${libType}?${params.toString()}`, key)
            .then((json) => {
              if (cancelled) return;
              const list = normalize(json?.results, libType);
              setLibItems((prev) => (libPage === 1 ? list : [...prev, ...list]));
              setLibHasMore(Number(json?.total_pages ?? 1) > libPage);
            })
            .catch((err) => {
              if (cancelled) return;
              setLibError(err.message);
            })
            .finally(() => {
              if (!cancelled) setLibLoading(false);
            });
          return () => {
            cancelled = true;
          };
        }, [tab, key, libType, libGenre, libYear, libPage]);

        const activeSource = sources.find((s) => s.id === activeSourceId) ?? null;

        React.useEffect(() => {
          writeStorage(SOURCES_STORAGE, JSON.stringify(sources));
        }, [sources]);

        React.useEffect(() => {
          writeStorage(PROGRESS_STORAGE, JSON.stringify(progress));
        }, [progress]);

        React.useEffect(() => {
          writeStorage(FAVORITES_STORAGE, JSON.stringify(favorites));
        }, [favorites]);

        React.useEffect(() => {
          writeStorage('dsh-cinema:searches', JSON.stringify(searches));
        }, [searches]);

        React.useEffect(() => {
          if (sources.length === 0) {
            if (activeSourceId !== null) setActiveSourceId(null);
            return;
          }
          if (!sources.some((s) => s.id === activeSourceId)) setActiveSourceId(sources[0].id);
        }, [sources, activeSourceId]);

        React.useEffect(() => {
          if (tab !== 'sources' || !activeSource) return undefined;
          let cancelled = false;
          setCmsLoading(true);
          setCmsError(null);
          cmsGet(activeSource.url, { ac: 'detail', pg: String(cmsPage) })
            .then((json) => {
              if (cancelled) return;
              setCmsItems(normalizeCms(json));
            })
            .catch((err) => {
              if (cancelled) return;
              setCmsItems([]);
              setCmsError(err.message);
            })
            .finally(() => {
              if (!cancelled) setCmsLoading(false);
            });
          return () => {
            cancelled = true;
          };
        }, [tab, activeSourceId, cmsPage]);

        React.useEffect(() => {
          if (!key || tab === 'sources') return undefined;
          const id = requestId.current + 1;
          requestId.current = id;
          let cancelled = false;
          setLoading(true);
          setError(null);
          tmdbGet(`/trending/${tab}/week?language=zh-CN`, key)
            .then((json) => {
              if (cancelled || requestId.current !== id) return;
              setItems(normalize(json?.results, tab));
              setSceneLabel(null);
            })
            .catch((err) => {
              if (cancelled || requestId.current !== id) return;
              setItems([]);
              setError(err.message);
            })
            .finally(() => {
              if (!cancelled && requestId.current === id) setLoading(false);
            });
          return () => {
            cancelled = true;
          };
        }, [key, tab, nonce]);

        React.useEffect(() => {
          if (!detail && !selectedVod && !playing) return undefined;
          const onKeyDown = (event) => {
            if (event.key !== 'Escape') return;
            if (playing) setPlaying(null);
            else if (selectedVod) setSelectedVod(null);
            else setDetail(null);
          };
          window.addEventListener('keydown', onKeyDown);
          return () => window.removeEventListener('keydown', onKeyDown);
        }, [detail, selectedVod, playing]);

        const saveKey = () => {
          const value = keyDraft.trim();
          if (value === '') return;
          writeStorage(KEY_STORAGE, value);
          setKey(value);
          setKeyDraft('');
          setKeyEditorOpen(false);
        };

        const clearKey = () => {
          writeStorage(KEY_STORAGE, null);
          setKey(null);
          setItems([]);
          setError(null);
          setKeyDraft('');
          setKeyEditorOpen(false);
        };

        const rememberSearch = (term) => {
          const q = String(term ?? '').trim();
          if (q === '') return;
          setSearches((prev) => {
            const hit = prev.find((x) => x.q === q);
            const next = hit
              ? prev.map((x) => (x.q === q ? { ...x, n: (x.n ?? 1) + 1 } : x))
              : [{ q, n: 1 }, ...prev];
            return next.sort((a, b) => (b.n ?? 1) - (a.n ?? 1)).slice(0, 30);
          });
        };

        const searchTmdb = (term) => {
          if (!key || !term) return;
          const id = requestId.current + 1;
          requestId.current = id;
          setLoading(true);
          setError(null);
          const scene = SCENE_RULES.find((rule) => rule.words.some((word) => term.includes(word)));
          setSceneLabel(scene ? scene.label : null);
          tmdbGet(`/search/multi?language=zh-CN&include_adult=false&query=${encodeURIComponent(term)}`, key)
            .then((json) => {
              if (requestId.current !== id) return null;
              const base = normalize(json?.results, 'movie');
              setItems(base);
              if (!scene) return null;
              return tmdbGet(
                `/discover/movie?language=zh-CN&sort_by=popularity.desc&page=1&with_genres=${scene.genres.join('|')}`,
                key,
              )
                .then((extra) => {
                  if (requestId.current !== id) return null;
                  const seen = new Set(base.map((x) => `${x.mediaType}-${x.id}`));
                  const merged = [
                    ...base,
                    ...normalize(extra?.results, 'movie').filter((x) => !seen.has(`${x.mediaType}-${x.id}`)),
                  ];
                  setItems(merged);
                  return null;
                })
                .catch(() => null);
            })
            .catch((err) => {
              if (requestId.current !== id) return;
              setItems([]);
              setError(err.message);
            })
            .finally(() => {
              if (requestId.current === id) setLoading(false);
            });
        };

        const runSearch = (event) => {
          event.preventDefault();
          const term = query.trim();
          if (term === '') {
            setNonce((n) => n + 1);
            return;
          }
          rememberSearch(term);
          searchTmdb(term);
        };

        const openDetail = (item) => {
          setDetail({ item, loading: true, data: null, error: null, sourcesLoading: false, matches: null });
          const nextHistory = remember(history, item);
          setHistory(nextHistory);
          writeStorage(HISTORY_STORAGE, JSON.stringify(nextHistory));

          if (sources.length === 0) {
            setDetail((prev) => (prev ? { ...prev, matches: [] } : prev));
          } else {
            setDetail((prev) => (prev ? { ...prev, sourcesLoading: true } : prev));
            searchVodInSources(sources, [item.title]).then((matches) => {
              setDetail((prev) => (prev ? { ...prev, sourcesLoading: false, matches } : prev));
            });
          }

          if (!key) return;
          tmdbGet(`/${item.mediaType}/${item.id}?language=zh-CN`, key)
            .then((data) => {
              setDetail((prev) => (prev ? { ...prev, loading: false, data, error: null } : prev));
              const localized = data?.title ?? data?.name;
              if (localized && sources.length > 0 && localized !== item.title) {
                searchVodInSources(sources, [localized]).then((extra) => {
                  if (extra.length === 0) return;
                  setDetail((prev) => {
                    if (!prev) return prev;
                    const seen = new Set((prev.matches ?? []).map((m) => `${m.sourceName}|${m.id}`));
                    const merged = [...(prev.matches ?? []), ...extra.filter((m) => !seen.has(`${m.sourceName}|${m.id}`))];
                    return { ...prev, matches: merged };
                  });
                });
              }
            })
            .catch((err) => setDetail((prev) => (prev ? { ...prev, loading: false, data: null, error: err.message } : prev)));
        };

        /* ------------------------------------------------------ sources */

        const addSource = () => {
          const url = sourceUrl.trim();
          if (!/^https?:\/\//i.test(url)) {
            setCmsError('接口地址必须以 http:// 或 https:// 开头');
            return;
          }
          const name = sourceName.trim() || (() => {
            try {
              return new URL(url).host;
            } catch {
              return url;
            }
          })();
          const id = `${name}-${Date.now()}`;
          setSources((prev) => [...prev, { id, name, url }]);
          setActiveSourceId(id);
          setSourceName('');
          setSourceUrl('');
          setSourceManagerOpen(false);
        };

        const removeSource = (id) => {
          setSources((prev) => prev.filter((s) => s.id !== id));
        };

        const importSources = async () => {
          const text = importText.trim();
          if (text === '') return;
          setCmsError(null);
          let raw = text;
          if (/^https?:\/\/\S+$/i.test(text)) {
            try {
              const res = await fetch(`/dsh-cinema/cms?u=${encodeURIComponent(text)}`);
              raw = await res.text();
            } catch (err) {
              setCmsError(`配置地址拉取失败：${err.message}`);
              return;
            }
          }
          const incoming = parseSourcesText(raw).map((item, index) => ({
            id: `imp-${Date.now()}-${index}`,
            name: item.name,
            url: item.url,
          }));
          if (incoming.length === 0) {
            setCmsError('没解析出可用的接口地址（支持 JSON、TVBox 配置、名称|地址、配置地址）');
            return;
          }
          setSources((prev) => {
            const seen = new Set(prev.map((s) => s.url));
            return [...prev, ...incoming.filter((x) => !seen.has(x.url))];
          });
          setImportText('');
        };

        const testSources = async () => {
          if (sources.length === 0 || testing) return;
          setTesting(true);
          const results = {};
          await Promise.all(
            sources.map(async (source) => {
              const started = Date.now();
              const controller = new AbortController();
              const timer = window.setTimeout(() => controller.abort(), 6000);
              try {
                const target = cmsEndpoint(source.url, { ac: 'detail', pg: '1' });
                const res = await fetch(`/dsh-cinema/cms?u=${encodeURIComponent(target)}`, { signal: controller.signal });
                const json = await res.json().catch(() => null);
                const list = normalizeCms(json);
                results[source.id] = list.length > 0 ? { ok: true, ms: Date.now() - started } : { ok: false, ms: 0 };
              } catch (err) {
                results[source.id] = { ok: false, ms: 0, error: err.name === 'AbortError' ? '超时' : err.message };
              } finally {
                window.clearTimeout(timer);
              }
            }),
          );
          setSpeed(results);
          setTesting(false);
        };

        const runCmsSearch = (event) => {
          event.preventDefault();
          if (!activeSource) return;
          const term = cmsQuery.trim();
          if (term === '') {
            setCmsSearching(false);
            setCmsPage(1);
            return;
          }
          rememberSearch(term);
          searchCms(term);
        };

        const searchCms = (term) => {
          if (!activeSource || !term) return;
          setCmsSearching(true);
          setCmsLoading(true);
          setCmsError(null);
          cmsGet(activeSource.url, { ac: 'detail', wd: term, pg: '1' })
            .then((json) => setCmsItems(normalizeCms(json)))
            .catch((err) => {
              setCmsItems([]);
              setCmsError(err.message);
            })
            .finally(() => setCmsLoading(false));
        };

        const openVod = (item) => {
          const lines = parsePlay(item.raw);
          setActiveLine(0);
          setSelectedVod({ item, lines });
        };

        const playEpisode = (episode, index) => {
          if (!selectedVod) return;
          const line = selectedVod.lines[activeLine];
          const episodes = (line?.episodes ?? []).map((ep) => ({ name: ep.name, url: ep.url }));
          setPlaying({
            url: episode.url,
            title: `${selectedVod.item.title} · ${episode.name}`,
            position: 0,
            episodes,
            index: typeof index === 'number' ? index : episodes.findIndex((ep) => ep.url === episode.url),
            vodTitle: selectedVod.item.title,
            pic: selectedVod.item.pic,
            raw: selectedVod.item.raw,
            lineName: line?.name ?? '',
            episodeName: episode.name,
          });
          setSelectedVod(null);
        };

        const recordProgress = (position, duration) => {
          if (!playing) return;
          const entry = {
            key: playing.url,
            title: playing.vodTitle ?? playing.title,
            pic: playing.pic ?? '',
            url: playing.url,
            episode: playing.episodeName ?? '',
            line: playing.lineName ?? '',
            raw: playing.raw ?? null,
            position: Math.max(0, Math.round(position || 0)),
            duration: Math.max(0, Math.round(duration || 0)),
            updatedAt: Date.now(),
          };
          setProgress((prev) => [entry, ...prev.filter((x) => x.key !== entry.key)].slice(0, 40));
        };

        const playNext = () => {
          setPlaying((prev) => {
            if (!prev || !Array.isArray(prev.episodes) || prev.episodes.length === 0) return prev;
            const nextIndex = (prev.index ?? -1) + 1;
            if (nextIndex >= prev.episodes.length) return prev;
            const next = prev.episodes[nextIndex];
            return {
              ...prev,
              url: next.url,
              title: `${prev.vodTitle} · ${next.name}`,
              position: 0,
              index: nextIndex,
              episodeName: next.name,
            };
          });
        };

        const toggleFavorite = (entry) => {
          setFavorites((prev) =>
            prev.some((f) => f.kind === entry.kind && String(f.id) === String(entry.id))
              ? prev.filter((f) => !(f.kind === entry.kind && String(f.id) === String(entry.id)))
              : [entry, ...prev].slice(0, 100),
          );
        };

        const isFavorite = (kind, id) => favorites.some((f) => f.kind === kind && String(f.id) === String(id));

        const close = () => {
          try {
            ctx.layout.selectPanel(null);
          } catch {
            /* ignore */
          }
        };

        const cloud = (onPick) =>
          searches.length === 0
            ? null
            : h(
                'div',
                { style: { display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', flex: '0 0 auto' } },
                h('span', { style: styles.status }, t('quickSearch')),
                searches.map((item) =>
                  h(
                    'button',
                    {
                      key: item.q,
                      type: 'button',
                      style: { ...styles.chip(false), fontSize: `${Math.min(15, 11 + (item.n ?? 1))}px` },
                      onClick: () => onPick(item.q),
                      title: `${item.n ?? 1}×`,
                    },
                    item.q,
                  ),
                ),
                h('button', { type: 'button', style: styles.ghostBtn, onClick: () => setSearches([]) }, t('searchCloudClear')),
              );

        /* ------------------------------------------------------ render */

        const tabs = h(
          'div',
          { style: styles.toolbar },
          ['movie', 'tv', 'library', 'sources', 'history'].map((id) =>
            h(
              'button',
              {
                key: id,
                type: 'button',
                style: styles.tab(tab === id),
                onClick: () => {
                  setTab(id);
                  setQuery('');
                },
              },
              id === 'movie'
                ? t('tabMovies')
                : id === 'tv'
                  ? t('tabTv')
                  : id === 'library'
                    ? t('tabLibrary')
                    : id === 'sources'
                      ? t('tabSources')
                      : t('tabHistory'),
            ),
          ),
        );

        const setupView = h(
          'div',
          { style: styles.setup },
          h(
            'div',
            { style: styles.setupCard },
            h('h2', { style: styles.setupTitle }, t('setupTitle')),
            h('p', { style: styles.setupBody }, t('setupBody')),
            h('a', { href: TMDB_SIGNUP, target: '_blank', rel: 'noreferrer', style: styles.link }, t('setupLink')),
            h(
              'div',
              { style: styles.keyRow },
              h('input', {
                type: 'password',
                style: styles.input,
                value: keyDraft,
                placeholder: t('keyPlaceholder'),
                onChange: (e) => setKeyDraft(e.target.value),
                onKeyDown: (e) => {
                  if (e.key === 'Enter') saveKey();
                },
                autoFocus: true,
              }),
              h('button', { type: 'button', style: styles.primaryBtn(keyDraft.trim() === ''), onClick: saveKey }, t('save')),
            ),
          ),
        );

        const gridCard = (keyId, poster, badge, title, meta, onOpen) =>
          h(
            'button',
            { key: keyId, type: 'button', style: styles.card, onClick: onOpen },
            h(
              'div',
              { style: styles.posterBox },
              h(Poster, { src: poster, alt: title, fallbackText: t('noPoster') }),
              badge,
            ),
            h('p', { style: styles.cardTitle }, title || '—'),
            h('p', { style: styles.cardMeta }, meta || '—'),
          );

        const tmdbBody = !key
          ? setupView
          : h(
              React.Fragment,
              null,
              h(
                'div',
                { style: styles.toolbar },
                h(
                  'form',
                  { style: styles.searchWrap, onSubmit: runSearch },
                  h('input', {
                    style: styles.input,
                    value: query,
                    placeholder: t('searchPlaceholder'),
                    onChange: (e) => setQuery(e.target.value),
                  }),
                  h('button', { type: 'submit', style: styles.primaryBtn(false) }, t('search')),
                ),
                h('button', { type: 'button', style: styles.ghostBtn, onClick: () => setNonce((n) => n + 1) }, t('refresh')),
              ),
              query.trim() === ''
                ? cloud((term) => {
                    setQuery(term);
                    rememberSearch(term);
                    searchTmdb(term);
                  })
                : null,
              sceneLabel ? h('div', { style: styles.status }, t('sceneHint').replace('{label}', sceneLabel)) : null,
              keyEditorOpen
                ? h(
                    'div',
                    { style: styles.keyRow },
                    h('input', {
                      type: 'password',
                      style: styles.input,
                      value: keyDraft,
                      placeholder: t('keyPlaceholder'),
                      onChange: (e) => setKeyDraft(e.target.value),
                    }),
                    h('button', { type: 'button', style: styles.primaryBtn(keyDraft.trim() === ''), onClick: saveKey }, t('save')),
                    h('button', { type: 'button', style: styles.ghostBtn, onClick: clearKey }, t('clear')),
                  )
                : null,
              loading ? h('div', { style: styles.status }, t('loading')) : null,
              error
                ? h(
                    'div',
                    { style: styles.errorBox },
                    h('strong', null, t('proxyError')),
                    h('span', null, error),
                    h('span', { style: { color: 'var(--dsw-alias-label-secondary)' } }, t('proxyHint')),
                  )
                : null,
              !loading && !error && items.length === 0 ? h('div', { style: styles.status }, t('empty')) : null,
              h(
                'div',
                { style: styles.grid },
                items.map((item) =>
                  gridCard(
                    `${item.mediaType}-${item.id}`,
                    item.poster ? posterUrl(item.poster, 'w342') : null,
                    item.rating !== null ? h('span', { style: styles.ratingBadge }, `★ ${item.rating.toFixed(1)}`) : null,
                    item.title,
                    item.year,
                    () => openDetail(item),
                  ),
                ),
              ),
              history.length > 0
                ? h(
                    'div',
                    { style: styles.recentWrap },
                    h('span', { style: styles.recentLabel }, t('recent')),
                    h(
                      'div',
                      { style: styles.recentRow },
                      history.map((entry) =>
                        h(
                          'button',
                          {
                            key: `${entry.mediaType}-${entry.id}`,
                            type: 'button',
                            style: styles.recentChip,
                            title: entry.title,
                            onClick: () => openDetail(entry),
                          },
                          h(Poster, {
                            src: entry.poster ? posterUrl(entry.poster, 'w154') : null,
                            alt: entry.title,
                            fallbackText: '',
                            style: { width: '100%', height: 'auto', aspectRatio: '2 / 3' },
                          }),
                        ),
                      ),
                    ),
                  )
                : null,
            );

        const sourceManager = h(
          'div',
          { style: styles.setupCard },
          h('h2', { style: styles.setupTitle }, t('manageSources')),
                h(
                  'div',
                  { style: styles.chipsRow },
                  sources.map((s) =>
                    h(
                      'span',
                      { key: s.id, style: { display: 'inline-flex', alignItems: 'center', gap: '6px' } },
                      h(
                        'button',
                        { type: 'button', style: styles.chip(s.id === activeSourceId), onClick: () => setActiveSourceId(s.id) },
                        s.name,
                      ),
                      speed[s.id]
                        ? h(
                            'span',
                            {
                              style: {
                                fontSize: '11px',
                                color: speed[s.id].ok ? 'var(--dsw-alias-state-success-primary)' : 'var(--dsw-alias-state-error-primary)',
                              },
                            },
                            speed[s.id].ok ? `${speed[s.id].ms}ms` : t('speedDead'),
                          )
                        : null,
                      h(
                        'button',
                        {
                          type: 'button',
                          style: { ...styles.ghostBtn, padding: '2px 6px' },
                          onClick: () => removeSource(s.id),
                          title: t('remove'),
                        },
                        '×',
                      ),
                    ),
                  ),
                ),
                h(
                  'div',
                  { style: { display: 'flex', gap: '8px', justifyContent: 'flex-end' } },
                  h('button', { type: 'button', style: styles.ghostBtn, onClick: testSources, disabled: testing }, testing ? t('speedTesting') : t('speedTest')),
                ),
          h(
            'div',
            { style: styles.keyRow },
            h('input', {
              style: { ...styles.input, flex: '0 0 140px' },
              value: sourceName,
              placeholder: t('sourceName'),
              onChange: (e) => setSourceName(e.target.value),
            }),
            h('input', {
              style: styles.input,
              value: sourceUrl,
              placeholder: t('sourceApi'),
              onChange: (e) => setSourceUrl(e.target.value),
            }),
            h('button', { type: 'button', style: styles.primaryBtn(sourceUrl.trim() === ''), onClick: addSource }, t('addSource')),
          ),
          h('label', { style: { fontSize: '12px', color: 'var(--dsw-alias-label-secondary)' } }, t('importSources')),
          h('input', {
            type: 'file',
            accept: '.txt,.json,application/json',
            style: { fontSize: '12px', color: 'var(--dsw-alias-label-secondary)' },
            onChange: (event) => {
              const file = event.target.files && event.target.files[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => setImportText(String(reader.result ?? ''));
              reader.readAsText(file);
              event.target.value = '';
            },
          }),
          h('textarea', {
            style: styles.textarea,
            value: importText,
            placeholder: '{"sources":[{"name":"示例","url":"http://xxx/api.php/provide/vod"}]}',
            onChange: (e) => setImportText(e.target.value),
          }),
          h(
            'div',
            { style: { display: 'flex', justifyContent: 'flex-end', gap: '8px' } },
            h('button', { type: 'button', style: styles.primaryBtn(importText.trim() === ''), onClick: importSources }, t('importBtn')),
            h('button', { type: 'button', style: styles.ghostBtn, onClick: () => setSourceManagerOpen(false) }, t('close')),
          ),
        );

        const sourcesBody =
          sources.length === 0
            ? h('div', { style: styles.setup }, sourceManager)
            : h(
                React.Fragment,
                null,
                h(
                  'div',
                  { style: styles.toolbar },
                  h(
                    'div',
                    { style: styles.chipsRow },
                    sources.map((s) =>
                      h(
                        'button',
                        {
                          key: s.id,
                          type: 'button',
                          style: styles.chip(s.id === activeSourceId),
                          onClick: () => {
                            setActiveSourceId(s.id);
                            setCmsPage(1);
                            setCmsSearching(false);
                            setCmsQuery('');
                          },
                        },
                        s.name,
                      ),
                    ),
                  ),
                  h('button', { type: 'button', style: styles.ghostBtn, onClick: () => setSourceManagerOpen((v) => !v) }, t('manageSources')),
                ),
                cmsQuery.trim() === ''
                  ? cloud((term) => {
                      setCmsQuery(term);
                      rememberSearch(term);
                      searchCms(term);
                    })
                  : null,
                sourceManagerOpen ? sourceManager : null,
                h(
                  'div',
                  { style: styles.toolbar },
                  h(
                    'form',
                    { style: styles.searchWrap, onSubmit: runCmsSearch },
                    h('input', {
                      style: styles.input,
                      value: cmsQuery,
                      placeholder: t('sourceSearchPlaceholder'),
                      onChange: (e) => setCmsQuery(e.target.value),
                    }),
                    h('button', { type: 'submit', style: styles.primaryBtn(false) }, t('search')),
                  ),
                  cmsSearching
                    ? h(
                        'button',
                        {
                          type: 'button',
                          style: styles.ghostBtn,
                          onClick: () => {
                            setCmsSearching(false);
                            setCmsQuery('');
                            setCmsPage(1);
                          },
                        },
                        t('latest'),
                      )
                    : null,
                  cmsSearching
                    ? null
                    : h(
                        React.Fragment,
                        null,
                        h(
                          'button',
                          {
                            type: 'button',
                            style: styles.ghostBtn,
                            disabled: cmsPage <= 1,
                            onClick: () => setCmsPage((p) => Math.max(1, p - 1)),
                          },
                          t('prevPage'),
                        ),
                        h('button', { type: 'button', style: styles.ghostBtn, onClick: () => setCmsPage((p) => p + 1) }, t('nextPage')),
                      ),
                ),
                cmsLoading ? h('div', { style: styles.status }, t('sourceLoading')) : null,
                cmsError
                  ? h(
                      'div',
                      { style: styles.errorBox },
                      h('strong', null, t('sourceError')),
                      h('span', null, cmsError),
                    )
                  : null,
                !cmsLoading && !cmsError && cmsItems.length === 0 ? h('div', { style: styles.status }, t('empty')) : null,
                h(
                  'div',
                  { style: styles.grid },
                  cmsItems.map((item) =>
                    gridCard(
                      item.id,
                      item.pic ? picUrl(item.pic) : null,
                      item.remarks ? h('span', { style: styles.remarkBadge }, item.remarks) : null,
                      item.title,
                      item.year,
                      () => openVod(item),
                    ),
                  ),
                ),
              );

        const vodModal = selectedVod
          ? h(
              'div',
              {
                style: styles.modalBackdrop,
                onClick: (event) => {
                  if (event.target === event.currentTarget) setSelectedVod(null);
                },
              },
              h(
                'div',
                { style: styles.modal },
                h(
                  'div',
                  { style: styles.modalPoster },
                  h(
                    'div',
                    { style: styles.posterBox },
                    h(Poster, {
                      src: selectedVod.item.pic ? picUrl(selectedVod.item.pic) : null,
                      alt: selectedVod.item.title,
                      fallbackText: t('noPoster'),
                    }),
                  ),
                ),
                h(
                  'div',
                  { style: styles.modalBody },
                  h(
                    'div',
                    { style: { display: 'flex', justifyContent: 'space-between', gap: '10px' } },
                    h('h2', { style: styles.modalTitle }, selectedVod.item.title),
                    h(
                      'div',
                      { style: { display: 'flex', gap: '6px' } },
                      h(
                        'button',
                        {
                          type: 'button',
                          style: styles.ghostBtn,
                          onClick: () =>
                            toggleFavorite({
                              kind: 'vod',
                              id: selectedVod.item.id,
                              title: selectedVod.item.title,
                              pic: selectedVod.item.pic,
                              year: selectedVod.item.year,
                              remarks: selectedVod.item.remarks,
                              raw: selectedVod.item.raw,
                            }),
                        },
                        isFavorite('vod', selectedVod.item.id) ? t('removeFavorite') : t('addFavorite'),
                      ),
                      h('button', { type: 'button', style: styles.ghostBtn, onClick: () => setSelectedVod(null) }, t('close')),
                    ),
                  ),
                  h(
                    'div',
                    { style: styles.modalMeta },
                    selectedVod.item.year ? h('span', null, selectedVod.item.year) : null,
                    selectedVod.item.remarks ? h('span', null, selectedVod.item.remarks) : null,
                  ),
                  h('p', { style: styles.modalOverview }, String(selectedVod.item.raw?.vod_content ?? '').replace(/<[^>]+>/g, '').slice(0, 400)),
                  selectedVod.lines.length > 1
                    ? h(
                        'div',
                        { style: styles.lineTabs },
                        selectedVod.lines.map((line, index) =>
                          h(
                            'button',
                            {
                              key: `${line.name}-${index}`,
                              type: 'button',
                              style: styles.tab(index === activeLine),
                              onClick: () => setActiveLine(index),
                            },
                            `${t('line')} ${index + 1} · ${line.name}`,
                          ),
                        ),
                      )
                    : null,
                  h('div', { style: styles.epGrid },
                    (selectedVod.lines[activeLine]?.episodes ?? []).map((episode, index) =>
                      h(
                        'button',
                        {
                          key: `${episode.name}-${index}`,
                          type: 'button',
                          style: styles.epBtn,
                          title: episode.url,
                          onClick: () => playEpisode(episode, index),
                        },
                        episode.name || String(index + 1),
                      ),
                    ),
                  ),
                ),
              ),
            )
          : null;

        const libraryBody = !key
          ? setupView
          : h(
              React.Fragment,
              null,
              h(
                'div',
                { style: styles.toolbar },
                ['movie', 'tv'].map((type) =>
                  h(
                    'button',
                    {
                      key: type,
                      type: 'button',
                      style: styles.tab(libType === type),
                      onClick: () => {
                        setLibType(type);
                        setLibGenre('');
                        setLibPage(1);
                        setLibItems([]);
                        setLibHasMore(true);
                      },
                    },
                    type === 'movie' ? t('tabMovies') : t('tabTv'),
                  ),
                ),
                h(
                  'select',
                  {
                    style: { ...styles.input, flex: '0 0 140px' },
                    value: libGenre,
                    onChange: (event) => {
                      setLibGenre(event.target.value);
                      setLibPage(1);
                      setLibItems([]);
                      setLibHasMore(true);
                    },
                  },
                  h('option', { value: '' }, `${t('genre')} · ${t('all')}`),
                  ...(GENRES[libType] ?? []).map(([id, name]) => h('option', { key: id, value: id }, name)),
                ),
                h(
                  'select',
                  {
                    style: { ...styles.input, flex: '0 0 120px' },
                    value: libYear,
                    onChange: (event) => {
                      setLibYear(event.target.value);
                      setLibPage(1);
                      setLibItems([]);
                      setLibHasMore(true);
                    },
                  },
                  h('option', { value: '' }, `${t('year')} · ${t('all')}`),
                  ...years.map((year) => h('option', { key: year, value: year }, year)),
                ),
              ),
              libLoading && libItems.length === 0 ? h('div', { style: styles.status }, t('loading')) : null,
              libError
                ? h('div', { style: styles.errorBox }, h('strong', null, t('proxyError')), h('span', null, libError))
                : null,
              !libLoading && !libError && libItems.length === 0 ? h('div', { style: styles.status }, t('empty')) : null,
              h(
                'div',
                {
                  style: styles.grid,
                  onScroll: (event) => {
                    const el = event.currentTarget;
                    if (!libLoading && libHasMore && el.scrollTop + el.clientHeight >= el.scrollHeight - 240) {
                      setLibPage((page) => page + 1);
                    }
                  },
                },
                libItems.map((item) =>
                  gridCard(
                    `${item.mediaType}-${item.id}`,
                    item.poster ? posterUrl(item.poster, 'w342') : null,
                    item.rating !== null ? h('span', { style: styles.ratingBadge }, `★ ${item.rating.toFixed(1)}`) : null,
                    item.title,
                    item.year,
                    () => openDetail(item),
                  ),
                ),
              ),
              libLoading && libItems.length > 0 ? h('div', { style: styles.status }, t('loading')) : null,
            );

        const historyBody =
          progress.length === 0
            ? h('div', { style: styles.status }, t('noHistory'))
            : h(
                'div',
                {
                  style: {
                    flex: '1 1 auto',
                    minHeight: 0,
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    paddingRight: '2px',
                  },
                },
                progress.map((entry) => {
                  const pct = entry.duration > 0 ? Math.min(100, Math.round((entry.position / entry.duration) * 100)) : 0;
                  const meta = [entry.episode, entry.line, pct >= 95 ? t('progressDone') : `${pct}%`].filter(Boolean).join(' · ');
                  return h(
                    'div',
                    { key: entry.key, style: styles.histRow },
                    h(
                      'div',
                      { style: { width: '46px', flex: '0 0 auto' } },
                      h(Poster, {
                        src: entry.pic ? picUrl(entry.pic) : null,
                        alt: entry.title,
                        fallbackText: '',
                        style: { width: '100%', height: 'auto', aspectRatio: '2 / 3', borderRadius: '6px' },
                      }),
                    ),
                    h(
                      'div',
                      { style: { flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' } },
                      h(
                        'span',
                        { style: { fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
                        entry.title,
                      ),
                      h('span', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)' } }, meta),
                      h(
                        'div',
                        { style: { height: '3px', borderRadius: '2px', background: 'var(--dsw-alias-bg-layer-2)', overflow: 'hidden' } },
                        h('div', { style: { width: `${pct}%`, height: '100%', background: 'var(--dsw-alias-brand-primary)' } }),
                      ),
                    ),
                    h(
                      'div',
                      { style: { display: 'flex', gap: '6px', flex: '0 0 auto' } },
                      h(
                        'button',
                        {
                          type: 'button',
                          style: styles.primaryBtn(false),
                          onClick: () =>
                            setPlaying({
                              url: entry.url,
                              title: entry.title,
                              position: entry.position,
                              vodTitle: entry.title,
                              pic: entry.pic,
                              raw: entry.raw,
                              lineName: entry.line,
                              episodeName: entry.episode,
                              episodes: null,
                              index: 0,
                            }),
                        },
                        entry.position > 0 ? t('resume') : t('playAgain'),
                      ),
                      h(
                        'button',
                        {
                          type: 'button',
                          style: styles.ghostBtn,
                          onClick: () => setProgress((prev) => prev.filter((x) => x.key !== entry.key)),
                        },
                        t('removeRecord'),
                      ),
                    ),
                  );
                }),
              );

        const favoritesModal = favoritesOpen
          ? h(
              'div',
              {
                style: styles.modalBackdrop,
                onClick: (event) => {
                  if (event.target === event.currentTarget) setFavoritesOpen(false);
                },
              },
              h(
                'div',
                { style: { ...styles.modal, display: 'block' } },
                h(
                  'div',
                  { style: { display: 'flex', justifyContent: 'space-between', marginBottom: '10px' } },
                  h('h2', { style: styles.modalTitle }, t('favorites')),
                  h('button', { type: 'button', style: styles.ghostBtn, onClick: () => setFavoritesOpen(false) }, t('close')),
                ),
                favorites.length === 0
                  ? h('p', { style: styles.status }, t('noFavorites'))
                  : h(
                      'div',
                      { style: { display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '440px', overflowY: 'auto' } },
                      favorites.map((fav) =>
                        h(
                          'div',
                          { key: `${fav.kind}-${fav.id}`, style: styles.histRow },
                          h(Poster, {
                            src: fav.pic ? picUrl(fav.pic) : fav.poster ? posterUrl(fav.poster, 'w154') : null,
                            alt: fav.title,
                            fallbackText: '',
                            style: { width: '40px', height: '60px', objectFit: 'cover', borderRadius: '5px' },
                          }),
                          h(
                            'span',
                            {
                              style: {
                                flex: '1 1 auto',
                                fontSize: '13px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              },
                            },
                            fav.title,
                          ),
                          h(
                            'button',
                            {
                              type: 'button',
                              style: styles.ghostBtn,
                              onClick: () => {
                                setFavoritesOpen(false);
                                if (fav.kind === 'tmdb') {
                                  openDetail({
                                    id: fav.id,
                                    mediaType: fav.mediaType,
                                    title: fav.title,
                                    year: fav.year,
                                    poster: fav.poster,
                                    rating: null,
                                    overview: '',
                                  });
                                } else {
                                  openVod({
                                    id: String(fav.id),
                                    title: fav.title,
                                    pic: fav.pic,
                                    year: fav.year,
                                    remarks: fav.remarks,
                                    raw: fav.raw,
                                  });
                                }
                              },
                            },
                            t('playAgain'),
                          ),
                          h(
                            'button',
                            {
                              type: 'button',
                              style: styles.ghostBtn,
                              onClick: () =>
                                setFavorites((prev) =>
                                  prev.filter((f) => !(f.kind === fav.kind && String(f.id) === String(fav.id))),
                                ),
                            },
                            '×',
                          ),
                        ),
                      ),
                    ),
              ),
            )
          : null;

        const tmdbModal = detail
          ? h(
              'div',
              {
                style: styles.modalBackdrop,
                onClick: (event) => {
                  if (event.target === event.currentTarget) setDetail(null);
                },
              },
              h(
                'div',
                { style: styles.modal },
                h(
                  'div',
                  { style: styles.modalPoster },
                  h(
                    'div',
                    { style: styles.posterBox },
                    h(Poster, {
                      src: detail.data?.poster_path
                        ? posterUrl(detail.data.poster_path, 'w500')
                        : detail.item?.poster
                          ? posterUrl(detail.item.poster, 'w500')
                          : null,
                      alt: detail.item?.title ?? '',
                      fallbackText: t('noPoster'),
                    }),
                  ),
                ),
                h(
                  'div',
                  { style: styles.modalBody },
                  h(
                    'div',
                    { style: { display: 'flex', justifyContent: 'space-between', gap: '10px' } },
                    h('h2', { style: styles.modalTitle }, detail.data?.title ?? detail.data?.name ?? detail.item?.title ?? '—'),
                    h(
                      'div',
                      { style: { display: 'flex', gap: '6px' } },
                      h(
                        'button',
                        {
                          type: 'button',
                          style: styles.ghostBtn,
                          onClick: () =>
                            toggleFavorite({
                              kind: 'tmdb',
                              id: detail.item.id,
                              mediaType: detail.item.mediaType,
                              title: detail.data?.title ?? detail.data?.name ?? detail.item?.title ?? '',
                              poster: detail.data?.poster_path ?? detail.item?.poster ?? null,
                              year: detail.item?.year ?? '',
                            }),
                        },
                        isFavorite('tmdb', detail.item.id) ? t('removeFavorite') : t('addFavorite'),
                      ),
                      h('button', { type: 'button', style: styles.ghostBtn, onClick: () => setDetail(null) }, t('close')),
                    ),
                  ),
                  h(
                    'div',
                    { style: styles.modalMeta },
                    detail.item?.year ? h('span', null, detail.item.year) : null,
                    typeof detail.data?.vote_average === 'number'
                      ? h('span', null, `★ ${detail.data.vote_average.toFixed(1)}`)
                      : null,
                    Array.isArray(detail.data?.genres) && detail.data.genres.length > 0
                      ? h('span', null, detail.data.genres.map((g) => g.name).join(' / '))
                      : null,
                  ),
                  detail.loading
                    ? h('p', { style: styles.modalOverview }, t('loading'))
                    : detail.error
                      ? h('p', { style: styles.modalOverview }, detail.error)
                      : h('p', { style: styles.modalOverview }, detail.data?.overview || detail.item?.overview || ''),
                  h(
                    'div',
                    {
                      style: {
                        borderTop: '1px solid var(--dsw-alias-border-l1)',
                        paddingTop: '10px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      },
                    },
                    h('span', { style: { fontSize: '12px', fontWeight: 600 } }, t('playWithSources')),
                    detail.sourcesLoading ? h('span', { style: styles.status }, t('sourceSearching')) : null,
                    !detail.sourcesLoading && (detail.matches?.length ?? 0) === 0
                      ? h('span', { style: styles.status }, sources.length === 0 ? t('sourceNone') : t('sourceNoMatch'))
                      : null,
                    (detail.matches ?? []).slice(0, 10).map((match, index) =>
                      h(
                        'button',
                        {
                          key: `${match.sourceName}-${match.id}-${index}`,
                          type: 'button',
                          style: { ...styles.epBtn, textAlign: 'left', padding: '8px 10px' },
                          onClick: () => {
                            setDetail(null);
                            openVod({
                              id: match.id,
                              title: match.title,
                              pic: match.pic,
                              year: match.year,
                              remarks: match.remarks,
                              raw: match.raw,
                            });
                          },
                        },
                        `${match.sourceName} · ${match.title}${match.remarks ? ` · ${match.remarks}` : ''}`,
                      ),
                    ),
                  ),
                  h(
                    'a',
                    {
                      href: `https://www.themoviedb.org/${detail.item?.mediaType === 'tv' ? 'tv' : 'movie'}/${detail.item?.id}`,
                      target: '_blank',
                      rel: 'noreferrer',
                      style: styles.link,
                    },
                    t('openTmdb'),
                  ),
                ),
              ),
            )
          : null;

        return h(
          'div',
          { style: styles.root, 'data-dsh-plugin': 'cinema' },
          h(
            'div',
            { style: styles.header },
            h(
              'div',
              { style: styles.heading },
              h('h1', { style: styles.title }, t('title')),
              h('p', { style: styles.subtitle }, t('subtitle')),
            ),
            h(
              'div',
              { style: styles.headerActions },
              tab === 'sources' ? null : key
                ? h(
                    'button',
                    { type: 'button', style: styles.ghostBtn, onClick: () => setKeyEditorOpen((v) => !v) },
                    t('key'),
                  )
                : null,
              h(
                'button',
                { type: 'button', style: styles.ghostBtn, onClick: () => setFavoritesOpen(true) },
                `${t('favorites')}${favorites.length > 0 ? ` ${favorites.length}` : ''}`,
              ),
              h('button', { type: 'button', style: styles.ghostBtn, onClick: close }, t('back')),
            ),
          ),
          tabs,
          tab === 'sources' ? sourcesBody : tab === 'library' ? libraryBody : tab === 'history' ? historyBody : tmdbBody,
          tmdbModal,
          vodModal,
          favoritesModal,
          playing
            ? h(Player, {
                src: playing.url,
                title: playing.title,
                initialPosition: playing.position ?? 0,
                onProgress: recordProgress,
                onEnded: playNext,
                onClose: () => setPlaying(null),
                t,
              })
            : null,
        );
      };
    }

    return {
      inject: ['slots', 'locale', 'layout'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'cinema: dictionaries');
        const t = ctx.locale.bind(NS);

        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register(
            { name: 'sidebar.panellist', id: PANEL_ID, order: 100, label: () => t('title') },
            CinemaIcon,
          ),
        );

        ctx.slots.inject('main', () =>
          ctx.slots.register({ name: 'main', key: PANEL_ID }, createPanel(ctx, t)),
        );
      },
    };
  },
});
