/**
 * Host 半边：给「影音工作室」面板提供同源代理。
 *
 * TMDB：/dsh-cinema/tmdb/...（密钥走请求头）、/dsh-cinema/img
 * 片源：/dsh-cinema/cms（CMS V10 JSON）、/dsh-cinema/pic（海报）、
 *       /dsh-cinema/media（mp4 直通，支持 Range）、
 *       /dsh-cinema/hls（m3u8 重写 + 分片透传）、
 *       /dsh-cinema/vendor/hls.min.js（内置 hls.js，Apache-2.0）
 *
 * 出网策略：TMDB 走「代理优先」，片源走「直连优先」——两者可分别回退。
 */
import http from 'node:http';
import https from 'node:https';
import tls from 'node:tls';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const name = 'dsh-cinema';
export const inject = ['webServer'];

const ROOT = dirname(fileURLToPath(import.meta.url));
const HLS_FILE = join(ROOT, 'vendor', 'hls.min.js');
const FLV_FILE = join(ROOT, 'vendor', 'flv.min.js');
const PROXY_URL =
  process.env.DSH_CINEMA_PROXY || process.env.HTTPS_PROXY || process.env.https_proxy || 'http://127.0.0.1:7897';

const IMG_SIZES = new Set(['w92', 'w154', 'w185', 'w342', 'w500', 'w780', 'original']);

class ConnectProxyAgent extends https.Agent {
  constructor(proxyUrl) {
    super({ keepAlive: true, maxSockets: 12 });
    this.proxy = new URL(proxyUrl);
    this.connectTimeout = 8000;
  }

  createConnection(options, callback) {
    const targetHost = options.host;
    const targetPort = options.port || 443;
    let settled = false;
    const done = (err, socket) => {
      if (settled) {
        if (socket) socket.destroy();
        return;
      }
      settled = true;
      callback(err, socket);
    };

    const req = http.request({
      host: this.proxy.hostname,
      port: this.proxy.port || 80,
      method: 'CONNECT',
      path: `${targetHost}:${targetPort}`,
      headers: { host: `${targetHost}:${targetPort}`, 'proxy-connection': 'keep-alive' },
      timeout: this.connectTimeout,
    });

    req.once('connect', (res, socket) => {
      if (res.statusCode !== 200) {
        socket.destroy();
        done(new Error(`proxy CONNECT rejected with ${res.statusCode}`));
        return;
      }
      const secure = tls.connect({ socket, servername: targetHost, host: targetHost, port: targetPort }, () =>
        done(null, secure),
      );
      secure.once('error', (err) => done(err));
    });
    req.once('error', (err) => done(err));
    req.once('timeout', () => {
      req.destroy();
      done(new Error('proxy CONNECT timed out'));
    });
    req.end();
  }
}

let proxyAgent;
function getProxyAgent() {
  if (proxyAgent === undefined) {
    try {
      proxyAgent = new ConnectProxyAgent(PROXY_URL);
    } catch {
      proxyAgent = null;
    }
  }
  return proxyAgent;
}

// 宿主进程可能把 https.globalAgent 换成代理，直连必须用显式 Agent。
const directAgent = new https.Agent({ keepAlive: true, maxSockets: 16 });

function parseTarget(raw) {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 4096) return null;
  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (!url.hostname) return null;
  return url;
}

function openUrl(raw, headers = {}, mode = 'direct-first') {
  const url = parseTarget(raw);
  if (!url) return Promise.reject(new Error('bad target url'));
  const secure = url.protocol === 'https:';
  const transport = secure ? https : http;
  const options = {
    host: url.hostname,
    port: url.port || (secure ? 443 : 80),
    path: `${url.pathname}${url.search}`,
    method: 'GET',
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 dsh-cinema/1.0',
      accept: '*/*',
      ...headers,
    },
  };

  const attempt = (agent) =>
    new Promise((resolve, reject) => {
      const req = transport.request(
        { ...options, ...(secure ? { agent: agent ?? directAgent } : {}) },
        (res) => resolve(res),
      );
      req.setTimeout(20000, () => req.destroy(new Error('upstream timeout')));
      req.once('error', reject);
      req.end();
    });

  const agent = secure ? getProxyAgent() : null;
  if (!secure || !agent) return attempt(null);

  const retryWith = (err, next) => {
    const code = String((err && err.code) || (err && err.message) || '');
    if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|EHOSTUNREACH|proxy CONNECT|timed out|socket hang up/i.test(code)) {
      return next();
    }
    throw err;
  };

  if (mode === 'proxy-first') {
    return attempt(agent).catch((err) => retryWith(err, () => attempt(null)));
  }
  return attempt(null).catch((err) => retryWith(err, () => attempt(agent)));
}

function readBody(res, limitBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    res.on('data', (chunk) => {
      size += chunk.length;
      if (size > limitBytes) {
        res.destroy();
        reject(new Error('upstream body too large'));
        return;
      }
      chunks.push(chunk);
    });
    res.on('end', () => resolve(Buffer.concat(chunks)));
    res.on('error', reject);
  });
}

function sendText(res, status, message) {
  res.statusCode = status;
  res.setHeader('content-type', 'text/plain; charset=utf-8');
  res.end(message);
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(payload));
}

function queryOf(req) {
  try {
    return new URL(req.url ?? '/', 'http://localhost');
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ TMDB */

function safeApiPath(rest) {
  if (typeof rest !== 'string') return null;
  if (!rest.startsWith('/')) return null;
  if (rest.includes('?') || rest.includes('#')) return null;
  if (rest.includes('..') || rest.includes('\\')) return null;
  if (!/^\/[A-Za-z0-9._\/-]*$/.test(rest)) return null;
  return rest;
}

async function tmdbHandler(req, res) {
  if (req.method !== 'GET') return sendText(res, 405, 'method not allowed');
  const parsed = queryOf(req);
  if (!parsed) return sendText(res, 400, 'bad url');
  const rest = safeApiPath(parsed.pathname.slice('/dsh-cinema/tmdb'.length));
  if (rest === null) return sendText(res, 400, 'bad api path');

  const token = String(req.headers['x-tmdb-token'] ?? '').trim();
  const key = String(req.headers['x-tmdb-key'] ?? '').trim();
  if (!token && !key) return sendJson(res, 400, { error: 'missing TMDB credential' });
  if (token && !/^[A-Za-z0-9._-]+$/.test(token)) return sendJson(res, 400, { error: 'bad TMDB token' });
  if (!token && !/^[A-Za-z0-9]{16,64}$/.test(key)) return sendJson(res, 400, { error: 'bad TMDB API key' });

  const params = new URLSearchParams(parsed.search);
  if (key) params.set('api_key', key);
  const query = params.toString();

  try {
    const upstream = await openUrl(
      `https://api.themoviedb.org/3${rest}${query ? `?${query}` : ''}`,
      token ? { authorization: `Bearer ${token}` } : {},
      'proxy-first',
    );
    const body = await readBody(upstream, 8 * 1024 * 1024);
    res.statusCode = upstream.statusCode ?? 502;
    res.setHeader('content-type', upstream.headers['content-type'] ?? 'application/json; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    res.end(body);
  } catch (err) {
    sendJson(res, 502, {
      error: 'TMDB 连接失败',
      detail: String((err && err.code) || (err && err.message) || err),
      hint: `代理 ${PROXY_URL}；可设置环境变量 DSH_CINEMA_PROXY`,
    });
  }
}

async function tmdbImageHandler(req, res) {
  if (req.method !== 'GET') return sendText(res, 405, 'method not allowed');
  const parsed = queryOf(req);
  if (!parsed) return sendText(res, 400, 'bad url');
  const size = parsed.searchParams.get('size') ?? 'w342';
  if (!IMG_SIZES.has(size)) return sendText(res, 400, 'bad size');
  const file = parsed.searchParams.get('file') ?? '';
  if (!/^[A-Za-z0-9_.-]+\.(jpg|jpeg|png|webp)$/i.test(file)) return sendText(res, 400, 'bad file');

  try {
    const upstream = await openUrl(`https://image.tmdb.org/t/p/${size}/${file}`, { accept: 'image/*' }, 'proxy-first');
    const body = await readBody(upstream, 8 * 1024 * 1024);
    res.statusCode = upstream.statusCode ?? 502;
    res.setHeader('content-type', upstream.headers['content-type'] ?? 'image/jpeg');
    res.setHeader('cache-control', upstream.statusCode === 200 ? 'public, max-age=86400' : 'no-store');
    res.end(body);
  } catch {
    sendText(res, 502, 'image upstream failed');
  }
}

/* ------------------------------------------------------------------- CMS */

function requireTarget(req, res) {
  const parsed = queryOf(req);
  if (!parsed) {
    sendText(res, 400, 'bad url');
    return null;
  }
  const raw = parsed.searchParams.get('u') ?? '';
  const url = parseTarget(raw);
  if (!url) {
    sendText(res, 400, 'bad target');
    return null;
  }
  return url;
}

async function cmsHandler(req, res) {
  if (req.method !== 'GET') return sendText(res, 405, 'method not allowed');
  const url = requireTarget(req, res);
  if (!url) return;
  try {
    const upstream = await openUrl(url.toString(), { referer: `${url.origin}/`, accept: 'application/json,text/plain,*/*' });
    const body = await readBody(upstream, 16 * 1024 * 1024);
    res.statusCode = upstream.statusCode ?? 502;
    res.setHeader('content-type', upstream.headers['content-type'] ?? 'application/json; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    res.end(body);
  } catch (err) {
    sendJson(res, 502, { error: 'CMS 接口请求失败', detail: String((err && err.code) || (err && err.message) || err) });
  }
}

async function picHandler(req, res) {
  if (req.method !== 'GET') return sendText(res, 405, 'method not allowed');
  const url = requireTarget(req, res);
  if (!url) return;
  try {
    const upstream = await openUrl(url.toString(), { referer: `${url.origin}/`, accept: 'image/*' });
    const body = await readBody(upstream, 10 * 1024 * 1024);
    res.statusCode = upstream.statusCode ?? 502;
    res.setHeader('content-type', upstream.headers['content-type'] ?? 'image/jpeg');
    res.setHeader('cache-control', upstream.statusCode === 200 ? 'public, max-age=86400' : 'no-store');
    res.end(body);
  } catch {
    sendText(res, 502, 'poster upstream failed');
  }
}

async function mediaHandler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return sendText(res, 405, 'method not allowed');
  const url = requireTarget(req, res);
  if (!url) return;
  const headers = { referer: `${url.origin}/` };
  if (typeof req.headers.range === 'string') headers.range = req.headers.range;
  try {
    const upstream = await openUrl(url.toString(), headers);
    res.statusCode = upstream.statusCode ?? 502;
    for (const name of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'last-modified']) {
      const value = upstream.headers[name];
      if (typeof value === 'string') res.setHeader(name, value);
    }
    if (!res.hasHeader('accept-ranges')) res.setHeader('accept-ranges', 'bytes');
    res.setHeader('cache-control', 'no-store');
    if (req.method === 'HEAD') {
      res.end();
      upstream.destroy();
      return;
    }
    upstream.pipe(res);
    upstream.on('error', () => res.destroy());
  } catch (err) {
    sendJson(res, 502, { error: '媒体请求失败', detail: String((err && err.code) || (err && err.message) || err) });
  }
}

async function hlsHandler(req, res) {
  if (req.method !== 'GET') return sendText(res, 405, 'method not allowed');
  const url = requireTarget(req, res);
  if (!url) return;

  const looksPlaylist = /\.m3u8?$/i.test(url.pathname);
  try {
    const upstream = await openUrl(url.toString(), { referer: `${url.origin}/` });
    const contentType = String(upstream.headers['content-type'] ?? '');
    const isPlaylist = looksPlaylist || /mpegurl/i.test(contentType);

    if (isPlaylist) {
      const body = await readBody(upstream, 4 * 1024 * 1024);
      const text = body.toString('utf8');
      // 有些 CDN 对 .m3u8 路径返回 HTML 错误页，原样透传，不要当成播放列表改写。
      if (!text.trimStart().startsWith('#EXTM3U')) {
        res.statusCode = upstream.statusCode ?? 502;
        res.setHeader('content-type', contentType || 'text/plain; charset=utf-8');
        res.setHeader('cache-control', 'no-store');
        res.end(body);
        return;
      }
      const proxied = (absolute) => `/dsh-cinema/hls?u=${encodeURIComponent(absolute)}`;
      const base = url;
      const rewritten = text
        .split(/\r?\n/)
        .map((line) => {
          const trimmed = line.trim();
          if (trimmed === '') return line;
          if (trimmed.startsWith('#')) {
            return line.replace(/URI="([^"]+)"/g, (match, uri) => {
              try {
                return `URI="${proxied(new URL(uri, base).toString())}"`;
              } catch {
                return match;
              }
            });
          }
          try {
            return proxied(new URL(trimmed, base).toString());
          } catch {
            return line;
          }
        })
        .join('\n');
      res.statusCode = 200;
      res.setHeader('content-type', 'application/vnd.apple.mpegurl');
      res.setHeader('cache-control', 'no-store');
      res.end(rewritten);
      return;
    }

    res.statusCode = upstream.statusCode ?? 502;
    res.setHeader('content-type', contentType || 'application/octet-stream');
    res.setHeader('cache-control', 'no-store');
    upstream.pipe(res);
    upstream.on('error', () => res.destroy());
  } catch (err) {
    sendText(res, 502, `hls upstream failed: ${String((err && err.code) || (err && err.message) || err)}`);
  }
}

function serveHlsLib(req, res) {
  try {
    const body = readFileSync(HLS_FILE);
    res.statusCode = 200;
    res.setHeader('content-type', 'text/javascript; charset=utf-8');
    res.setHeader('cache-control', 'public, max-age=86400');
    res.end(body);
  } catch {
    sendText(res, 404, 'hls.js not bundled');
  }
}

function serveFlvLib(req, res) {
  try {
    const body = readFileSync(FLV_FILE);
    res.statusCode = 200;
    res.setHeader('content-type', 'text/javascript; charset=utf-8');
    res.setHeader('cache-control', 'public, max-age=86400');
    res.end(body);
  } catch {
    sendText(res, 404, 'flv.js not bundled');
  }
}

/* ---------------------------------------------------------------- routes */

export function apply(ctx) {
  const routes = [
    { kind: 'prefix', path: '/dsh-cinema/tmdb', handler: tmdbHandler },
    { kind: 'prefix', path: '/dsh-cinema/img', handler: tmdbImageHandler },
    { kind: 'prefix', path: '/dsh-cinema/cms', handler: cmsHandler },
    { kind: 'prefix', path: '/dsh-cinema/pic', handler: picHandler },
    { kind: 'prefix', path: '/dsh-cinema/media', handler: mediaHandler },
    { kind: 'prefix', path: '/dsh-cinema/hls', handler: hlsHandler },
    { kind: 'exact', path: '/dsh-cinema/vendor/hls.min.js', handler: serveHlsLib },
    { kind: 'exact', path: '/dsh-cinema/vendor/flv.min.js', handler: serveFlvLib },
  ];
  for (const route of routes) {
    ctx.effect(() => ctx.webServer.register(route), `cinema route ${route.path}`);
  }
}
