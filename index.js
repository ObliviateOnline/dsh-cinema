/**
 * Host 半边：给「影音工作室」面板提供两个同源代理。
 *
 * 为什么需要它：TMDB 在浏览器里直连会被墙，且 api.themoviedb.org 的 CORS 与密钥
 * 处理都不适合放在页面里。页面只请求本机同源地址 /dsh-cinema/...，由这里用
 * Node 的 https 出去；本机开着 Clash 时走 127.0.0.1:7897 的 CONNECT 隧道，没开就直连。
 *
 * 代理地址解析顺序：DSH_CINEMA_PROXY > HTTPS_PROXY > http://127.0.0.1:7897 > 直连回退。
 */
import http from 'node:http';
import https from 'node:https';
import tls from 'node:tls';

export const name = 'dsh-cinema';
export const inject = ['webServer'];

const API_HOST = 'api.themoviedb.org';
const IMG_HOST = 'image.tmdb.org';
const PROXY_URL =
  process.env.DSH_CINEMA_PROXY || process.env.HTTPS_PROXY || process.env.https_proxy || 'http://127.0.0.1:7897';

const IMG_SIZES = new Set(['w92', 'w154', 'w185', 'w342', 'w500', 'w780', 'original']);

/** 只允许「/movie/123」「/trending/movie/week」这种路径，杜绝绝对 URL 与目录穿越。 */
function safeApiPath(rest) {
  if (typeof rest !== 'string') return null;
  if (!rest.startsWith('/')) return null;
  if (rest.includes('?') || rest.includes('#')) return null;
  if (rest.includes('..') || rest.includes('\\')) return null;
  if (!/^\/[A-Za-z0-9._\/-]*$/.test(rest)) return null;
  return rest;
}

function safeImageFile(file) {
  if (typeof file !== 'string') return null;
  if (!/^[A-Za-z0-9_.-]+\.(jpg|jpeg|png|webp)$/i.test(file)) return null;
  return file;
}

/** 通过 HTTP 代理的 CONNECT 隧道建立到目标主机的 TLS 连接。 */
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
      const secure = tls.connect(
        { socket, servername: targetHost, host: targetHost, port: targetPort },
        () => done(null, secure),
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

let proxyAgent = null;
function getProxyAgent() {
  if (proxyAgent === null) {
    try {
      proxyAgent = new ConnectProxyAgent(PROXY_URL);
    } catch {
      proxyAgent = false;
    }
  }
  return proxyAgent === false ? null : proxyAgent;
}

/**
 * 对 host 发一次 GET，返回 { status, headers, body: Buffer }。
 * 先走代理；代理本身连不上时退回直连，这样换网络也不用改代码。
 */
function fetchUpstream({ host, path, headers = {} }) {
  const ask = (agent) =>
    new Promise((resolve, reject) => {
      const req = https.request(
        {
          host,
          port: 443,
          path,
          method: 'GET',
          headers: { 'user-agent': 'dsh-cinema/1.0', accept: '*/*', ...headers },
          agent: agent ?? undefined,
          timeout: 20000,
        },
        (res) => {
          const chunks = [];
          res.on('data', (chunk) => {
            chunks.push(chunk);
            if (chunks.reduce((n, c) => n + c.length, 0) > 8 * 1024 * 1024) req.destroy();
          });
          res.on('end', () =>
            resolve({
              status: res.statusCode ?? 502,
              contentType: res.headers['content-type'] ?? 'application/octet-stream',
              cacheControl: res.headers['cache-control'],
              body: Buffer.concat(chunks),
            }),
          );
          res.on('error', reject);
        },
      );
      req.once('timeout', () => req.destroy(new Error('upstream timeout')));
      req.once('error', reject);
      req.end();
    });

  const agent = getProxyAgent();
  return agent
    ? ask(agent).catch((err) => {
        if (err && (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND')) return ask(null);
        throw err;
      })
    : ask(null);
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(payload));
}

function sendText(res, status, message) {
  res.statusCode = status;
  res.setHeader('content-type', 'text/plain; charset=utf-8');
  res.end(message);
}

/** /dsh-cinema/tmdb/<api path>?<query>：密钥走请求头，不进 URL。 */
async function tmdbHandler(req, res) {
  if (req.method !== 'GET') return sendText(res, 405, 'method not allowed');

  let parsed;
  try {
    parsed = new URL(req.url ?? '/', 'http://localhost');
  } catch {
    return sendText(res, 400, 'bad url');
  }

  const rest = safeApiPath(parsed.pathname.slice('/dsh-cinema/tmdb'.length));
  if (rest === null) return sendText(res, 400, 'bad api path');

  const token = String(req.headers['x-tmdb-token'] ?? '').trim();
  const key = String(req.headers['x-tmdb-key'] ?? '').trim();
  if (!token && !key) return sendJson(res, 400, { error: 'missing TMDB credential' });
  if (token && !/^[A-Za-z0-9._-]+$/.test(token)) return sendJson(res, 400, { error: 'bad TMDB token' });
  if (!token && apiKeyInvalid(key)) return sendJson(res, 400, { error: 'bad TMDB API key' });

  const params = new URLSearchParams(parsed.search);
  if (key) params.set('api_key', key);
  const query = params.toString();

  try {
    const upstream = await fetchUpstream({
      host: API_HOST,
      path: `/3${rest}${query ? `?${query}` : ''}`,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
    res.statusCode = upstream.status;
    res.setHeader('content-type', upstream.contentType);
    res.setHeader('cache-control', 'no-store');
    res.end(upstream.body);
  } catch (err) {
    sendJson(res, 502, {
      error: 'TMDB 连接失败',
      detail: `${err && err.code ? err.code + ' ' : ''}${err && err.message ? err.message : String(err)}`,
      hint: `代理 ${PROXY_URL} 没连上的话，请确认 Clash / 代理在运行，或设置环境变量 DSH_CINEMA_PROXY`,
    });
  }
}

function apiKeyInvalid(key) {
  return !/^[A-Za-z0-9]{16,64}$/.test(key);
}

/** /dsh-cinema/img?size=w342&file=xxx.jpg：海报图片代理（浏览器直连图片 CDN 也会被墙）。 */
async function imageHandler(req, res) {
  if (req.method !== 'GET') return sendText(res, 405, 'method not allowed');
  let parsed;
  try {
    parsed = new URL(req.url ?? '/', 'http://localhost');
  } catch {
    return sendText(res, 400, 'bad url');
  }
  const size = parsed.searchParams.get('size') ?? 'w342';
  if (!IMG_SIZES.has(size)) return sendText(res, 400, 'bad size');
  const file = safeImageFile(parsed.searchParams.get('file') ?? '');
  if (file === null) return sendText(res, 400, 'bad file');

  try {
    const upstream = await fetchUpstream({
      host: IMG_HOST,
      path: `/t/p/${size}/${file}`,
      headers: { accept: 'image/*' },
    });
    res.statusCode = upstream.status;
    res.setHeader('content-type', upstream.contentType);
    res.setHeader('cache-control', upstream.status === 200 ? 'public, max-age=86400' : 'no-store');
    res.end(upstream.body);
  } catch {
    sendText(res, 502, 'image upstream failed');
  }
}

export function apply(ctx) {
  ctx.effect(
    () => ctx.webServer.register({ kind: 'prefix', path: '/dsh-cinema/tmdb', handler: tmdbHandler }),
    'cinema: TMDB proxy route',
  );
  ctx.effect(
    () => ctx.webServer.register({ kind: 'prefix', path: '/dsh-cinema/img', handler: imageHandler }),
    'cinema: image proxy route',
  );
}
