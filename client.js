/**
 * 浏览器半边：「影音工作室」——左侧栏入口 + 整页海报墙面板。
 *
 * 数据走同源代理 /dsh-cinema/tmdb/... 与 /dsh-cinema/img/...（Host 半边负责出网），
 * 密钥只存在本浏览器的 localStorage，并通过请求头传给宿主，不进 URL。
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
    const HISTORY_MAX = 24;
    const TMDB_SIGNUP = 'https://www.themoviedb.org/settings/api';

    const zh = {
      title: '影音工作室',
      subtitle: '热门电影、剧集与搜索，元数据来自 TMDB',
      movies: '电影',
      series: '剧集',
      searchPlaceholder: '搜索片名 / 剧名，回车确认',
      search: '搜索',
      refresh: '刷新',
      key: '密钥',
      back: '返回对话',
      setupTitle: '先填一个 TMDB 密钥',
      setupBody: '面板会通过宿主的同源代理访问 TMDB，密钥只保存在这台浏览器里。v3 API Key 和 v4 Read Access Token 都支持。',
      setupLink: '去 themoviedb.org 申请',
      keyPlaceholder: '粘贴 API Key 或 Read Access Token',
      save: '保存',
      clear: '清除',
      cancel: '取消',
      loading: '正在加载…',
      empty: '没有结果',
      retry: '重试',
      recent: '最近看过',
      noPoster: '暂无海报',
      rating: '评分',
      year: '年份',
      overview: '简介',
      genres: '类型',
      runtime: '片长',
      minutes: '分钟',
      openTmdb: '在 TMDB 打开',
      close: '关闭',
      proxyError: '连接 TMDB 失败',
      proxyHint: '宿主代理没通：确认 Clash / 代理在运行（默认 127.0.0.1:7897），或用环境变量 DSH_CINEMA_PROXY 指定。',
      noKey: '还没有配置密钥',
    };

    const en = {
      title: 'Cinema studio',
      subtitle: 'Trending movies, shows and search, powered by TMDB',
      movies: 'Movies',
      series: 'Shows',
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
      cancel: 'Cancel',
      loading: 'Loading…',
      empty: 'Nothing found',
      retry: 'Retry',
      recent: 'Recently opened',
      noPoster: 'No poster',
      rating: 'Rating',
      year: 'Year',
      overview: 'Overview',
      genres: 'Genres',
      runtime: 'Runtime',
      minutes: 'min',
      openTmdb: 'Open on TMDB',
      close: 'Close',
      proxyError: 'Could not reach TMDB',
      proxyHint: 'The Host proxy is down: check that your proxy (127.0.0.1:7897 by default) is running, or set DSH_CINEMA_PROXY.',
      noKey: 'No key configured yet',
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
        /* 隐私模式下忽略 */
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

    function tmdbHeaders(key) {
      if (key.startsWith('eyJ')) return { 'x-tmdb-token': key };
      return { 'x-tmdb-key': key };
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
        const detail = json?.detail ? ` (${json.detail})` : '';
        throw new Error(`${message}${detail}`);
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
        gap: '14px',
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
      searchInput: {
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
      setup: {
        flex: '1 1 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 0,
        overflowY: 'auto',
      },
      setupCard: {
        width: 'min(460px, 100%)',
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
      link: { color: 'var(--dsw-alias-brand-primary)', fontSize: '12px', textDecoration: 'none' },
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
      recentImg: { width: '100%', height: '76px', objectFit: 'cover', borderRadius: '5px', display: 'block' },
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
        width: 'min(760px, 100%)',
        maxHeight: '100%',
        overflowY: 'auto',
        background: 'var(--dsw-alias-bg-layer-1)',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: '14px',
        padding: '18px',
        display: 'flex',
        gap: '16px',
      },
      modalPoster: { width: '180px', flex: '0 0 auto' },
      modalBody: { display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 },
      modalTitle: { margin: 0, fontSize: '17px', fontWeight: 600 },
      modalMeta: { fontSize: '12px', color: 'var(--dsw-alias-label-secondary)', display: 'flex', gap: '10px', flexWrap: 'wrap' },
      modalOverview: { margin: 0, fontSize: '13px', lineHeight: 1.65, color: 'var(--dsw-alias-label-primary)' },
    };

    function Poster({ path, size, alt, fallbackText, style }) {
      const [broken, setBroken] = React.useState(false);
      React.useEffect(() => {
        setBroken(false);
      }, [path]);
      if (!path || broken) {
        return h(
          'div',
          { style: style ? { ...styles.posterFallback, ...style } : styles.posterFallback },
          fallbackText,
        );
      }
      return h('img', {
        src: posterUrl(path, size),
        alt,
        loading: 'lazy',
        style: style ? { ...styles.posterImg, ...style } : styles.posterImg,
        onError: () => setBroken(true),
      });
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

        React.useEffect(() => {
          if (!key) return undefined;
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
          if (!detail) return undefined;
          const onKeyDown = (event) => {
            if (event.key === 'Escape') setDetail(null);
          };
          window.addEventListener('keydown', onKeyDown);
          return () => window.removeEventListener('keydown', onKeyDown);
        }, [detail]);

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
              const list = normalize(json?.results, 'movie');
              setItems(list);
              if (list.length === 0) setError(null);
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
          setDetail({ item, loading: true, data: null, error: null });
          const nextHistory = remember(history, item);
          setHistory(nextHistory);
          writeStorage(HISTORY_STORAGE, JSON.stringify(nextHistory));
          if (!key) return;
          tmdbGet(`/${item.mediaType}/${item.id}?language=zh-CN`, key)
            .then((data) => setDetail({ item, loading: false, data, error: null }))
            .catch((err) => setDetail({ item, loading: false, data: null, error: err.message }));
        };

        const close = () => {
          try {
            ctx.layout.selectPanel(null);
          } catch {
            /* 面板已被切走时忽略 */
          }
        };

        const keyButton = h(
          'button',
          { type: 'button', style: styles.ghostBtn, onClick: () => setKeyEditorOpen((v) => !v) },
          key ? t('key') : t('noKey'),
        );

        const keyEditor = keyEditorOpen
          ? h(
              'div',
              { style: styles.keyRow },
              h('input', {
                type: 'password',
                style: styles.searchInput,
                value: keyDraft,
                placeholder: t('keyPlaceholder'),
                onChange: (e) => setKeyDraft(e.target.value),
                onKeyDown: (e) => {
                  if (e.key === 'Enter') saveKey();
                },
              }),
              h(
                'button',
                { type: 'button', style: styles.primaryBtn(keyDraft.trim() === ''), onClick: saveKey },
                t('save'),
              ),
              key
                ? h('button', { type: 'button', style: styles.ghostBtn, onClick: clearKey }, t('clear'))
                : null,
            )
          : null;

        const setupView = h(
          'div',
          { style: styles.setup },
          h(
            'div',
            { style: styles.setupCard },
            h('h2', { style: styles.setupTitle }, t('setupTitle')),
            h('p', { style: styles.setupBody }, t('setupBody')),
            h(
              'a',
              { href: TMDB_SIGNUP, target: '_blank', rel: 'noreferrer', style: styles.link },
              t('setupLink'),
            ),
            h(
              'div',
              { style: styles.keyRow },
              h('input', {
                type: 'password',
                style: styles.searchInput,
                value: keyDraft,
                placeholder: t('keyPlaceholder'),
                onChange: (e) => setKeyDraft(e.target.value),
                onKeyDown: (e) => {
                  if (e.key === 'Enter') saveKey();
                },
                autoFocus: true,
              }),
              h(
                'button',
                { type: 'button', style: styles.primaryBtn(keyDraft.trim() === ''), onClick: saveKey },
                t('save'),
              ),
            ),
          ),
        );

        const body = !key
          ? setupView
          : h(
              React.Fragment,
              null,
              h(
                'div',
                { style: styles.toolbar },
                h(
                  'button',
                  {
                    type: 'button',
                    style: styles.tab(tab === 'movie'),
                    onClick: () => {
                      setTab('movie');
                      setQuery('');
                    },
                  },
                  t('movies'),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    style: styles.tab(tab === 'tv'),
                    onClick: () => {
                      setTab('tv');
                      setQuery('');
                    },
                  },
                  t('series'),
                ),
                h(
                  'form',
                  { style: styles.searchWrap, onSubmit: runSearch },
                  h('input', {
                    style: styles.searchInput,
                    value: query,
                    placeholder: t('searchPlaceholder'),
                    onChange: (e) => setQuery(e.target.value),
                  }),
                  h('button', { type: 'submit', style: styles.primaryBtn(false) }, t('search')),
                ),
                h(
                  'button',
                  { type: 'button', style: styles.ghostBtn, onClick: () => setNonce((n) => n + 1) },
                  t('refresh'),
                ),
              ),
              keyEditor,
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
                  h(
                    'button',
                    {
                      key: `${item.mediaType}-${item.id}`,
                      type: 'button',
                      style: styles.card,
                      onClick: () => openDetail(item),
                    },
                    h(
                      'div',
                      { style: styles.posterBox },
                      h(Poster, {
                        path: item.poster,
                        size: 'w342',
                        alt: item.title,
                        fallbackText: t('noPoster'),
                      }),
                      item.rating !== null ? h('span', { style: styles.ratingBadge }, `★ ${item.rating.toFixed(1)}`) : null,
                    ),
                    h('p', { style: styles.cardTitle }, item.title || '—'),
                    h('p', { style: styles.cardMeta }, item.year || '—'),
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
                            path: entry.poster,
                            size: 'w154',
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

        const modal = detail
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
                      path: detail.data?.poster_path ?? detail.item?.poster,
                      size: 'w500',
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
                      'button',
                      {
                        type: 'button',
                        style: styles.ghostBtn,
                        onClick: () => setDetail(null),
                      },
                      t('close'),
                    ),
                  ),
                  h(
                    'div',
                    { style: styles.modalMeta },
                    detail.item?.year || detail.data?.release_date
                      ? h('span', null, `${t('year')} ${detail.item?.year || String(detail.data?.release_date ?? '').slice(0, 4)}`)
                      : null,
                    typeof detail.data?.vote_average === 'number'
                      ? h('span', null, `${t('rating')} ★ ${detail.data.vote_average.toFixed(1)}`)
                      : null,
                    typeof detail.data?.runtime === 'number'
                      ? h('span', null, `${t('runtime')} ${detail.data.runtime} ${t('minutes')}`)
                      : null,
                    Array.isArray(detail.data?.genres) && detail.data.genres.length > 0
                      ? h('span', null, `${t('genres')} ${detail.data.genres.map((g) => g.name).join(' / ')}`)
                      : null,
                  ),
                  detail.loading
                    ? h('p', { style: styles.modalOverview }, t('loading'))
                    : detail.error
                      ? h('p', { style: styles.modalOverview }, detail.error)
                      : h('p', { style: styles.modalOverview }, detail.data?.overview || detail.item?.overview || ''),
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
              key ? keyButton : null,
              h('button', { type: 'button', style: styles.ghostBtn, onClick: close }, t('back')),
            ),
          ),
          body,
          modal,
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
