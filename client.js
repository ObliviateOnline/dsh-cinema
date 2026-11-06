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
  id: '@local/dsh-cinema',
  factory: (require) => {
    const React = require('react');
    const h = React.createElement;

    const NS = 'dshCinema';
    const PANEL_ID = 'cinema';
    const KEY_STORAGE = 'dsh-cinema:key';
    const HISTORY_STORAGE = 'dsh-cinema:history';
    const SOURCES_STORAGE = 'dsh-cinema:sources';
    const HISTORY_MAX = 24;
    const TMDB_SIGNUP = 'https://www.themoviedb.org/settings/api';

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

    function Player({ src, title, onClose, t }) {
      const videoRef = React.useRef(null);
      const [error, setError] = React.useState(null);

      React.useEffect(() => {
        const video = videoRef.current;
        if (!video) return undefined;
        let cancelled = false;
        let hlsInstance = null;

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
        const [tab, setTab] = React.useState('sources');
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

        const activeSource = sources.find((s) => s.id === activeSourceId) ?? null;

        React.useEffect(() => {
          writeStorage(SOURCES_STORAGE, JSON.stringify(sources));
        }, [sources]);

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

        const runSearch = (event) => {
          event.preventDefault();
          const term = query.trim();
          if (!key) return;
          if (term === '') {
            setNonce((n) => n + 1);
            return;
          }
          const id = requestId.current + 1;
          requestId.current = id;
          setLoading(true);
          setError(null);
          tmdbGet(`/search/multi?language=zh-CN&include_adult=false&query=${encodeURIComponent(term)}`, key)
            .then((json) => {
              if (requestId.current !== id) return;
              setItems(normalize(json?.results, 'movie'));
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

        const importSources = () => {
          try {
            const parsed = JSON.parse(importText);
            const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.sources) ? parsed.sources : [];
            const incoming = list
              .filter((x) => x && typeof x.url === 'string' && /^https?:\/\//i.test(x.url))
              .map((x, index) => ({
                id: `imp-${Date.now()}-${index}`,
                name: String(x.name ?? x.url).trim() || x.url,
                url: x.url,
              }));
            if (incoming.length === 0) {
              setCmsError('JSON 里没有可用的 url');
              return;
            }
            setSources((prev) => {
              const seen = new Set(prev.map((s) => s.url));
              return [...prev, ...incoming.filter((x) => !seen.has(x.url))];
            });
            setImportText('');
            setCmsError(null);
          } catch {
            setCmsError('JSON 解析失败，检查一下格式');
          }
        };

        const runCmsSearch = (event) => {
          event.preventDefault();
          if (!activeSource) return;
          const term = cmsQuery.trim();
          if (term === '') {
            setCmsSearching(false);
            setCmsPage((p) => (p === 1 ? 1 : 1));
            return;
          }
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

        const playEpisode = (episode) => {
          if (!selectedVod) return;
          setPlaying({ url: episode.url, title: `${selectedVod.item.title} · ${episode.name}` });
          setSelectedVod(null);
        };

        const close = () => {
          try {
            ctx.layout.selectPanel(null);
          } catch {
            /* ignore */
          }
        };

        /* ------------------------------------------------------ render */

        const tabs = h(
          'div',
          { style: styles.toolbar },
          ['movie', 'tv', 'sources'].map((id) =>
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
              id === 'movie' ? t('tabMovies') : id === 'tv' ? t('tabTv') : t('tabSources'),
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
                    h('button', { type: 'button', style: styles.ghostBtn, onClick: () => setSelectedVod(null) }, t('close')),
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
                          onClick: () => playEpisode(episode),
                        },
                        episode.name || String(index + 1),
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
                    h('button', { type: 'button', style: styles.ghostBtn, onClick: () => setDetail(null) }, t('close')),
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
              h('button', { type: 'button', style: styles.ghostBtn, onClick: close }, t('back')),
            ),
          ),
          tabs,
          tab === 'sources' ? sourcesBody : tmdbBody,
          tmdbModal,
          vodModal,
          playing ? h(Player, { src: playing.url, title: playing.title, onClose: () => setPlaying(null), t }) : null,
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
