import http from 'http';
import https from 'https';
import { URL } from 'url';
import WebSocket from 'ws';

export interface TunnelRequestMsg {
  id: string;
  type: 'request';
  method: string;
  path: string;
  headers?: Record<string, any>;
  bodyBase64?: string;
}

export interface TunnelResponseMsg {
  id: string;
  type: 'response';
  status?: number;
  headers?: Record<string, any>;
  bodyBase64?: string;
}

export interface ClientConfig {
  serverWsUrl?: string; // legacy single URL
  serverWsUrls?: string[]; // preferred: candidates in priority order (e.g., wss then ws)
  subdomain: string;
  token?: string;
  to: string; // http://localhost:3000
}

function forwardRequest(toUrl: string, reqMsg: TunnelRequestMsg): Promise<TunnelResponseMsg> {
  return new Promise((resolve) => {
    const base = new URL(toUrl);
    const isHttps = base.protocol === 'https:';
    const lib = isHttps ? https : http;

    const headers = { ...(reqMsg.headers || {}) } as Record<string, any>;
    // set Host header to target host
    headers['host'] = base.host;

    const options: http.RequestOptions = {
      protocol: base.protocol,
      hostname: base.hostname,
      port: base.port || (isHttps ? 443 : 80),
      method: reqMsg.method,
      path: base.pathname.replace(/\/$/, '') + reqMsg.path,
      headers,
    };

    const request = lib.request(options, (resp) => {
      const chunks: Buffer[] = [];
      resp.on('data', (c: Buffer) => chunks.push(c));
      resp.on('end', () => {
        const body = Buffer.concat(chunks);
        const headers: Record<string, any> = {};
        for (const [k, v] of Object.entries(resp.headers)) headers[k] = v as any;
        resolve({
          id: reqMsg.id,
          type: 'response',
          status: resp.statusCode || 200,
          headers,
          bodyBase64: body.length ? body.toString('base64') : undefined,
        });
      });
    });

    request.on('error', () => {
      resolve({ id: reqMsg.id, type: 'response', status: 502, headers: { 'content-type': 'application/json' }, bodyBase64: Buffer.from(JSON.stringify({ error: 'Upstream error' })).toString('base64') });
    });

    if (reqMsg.bodyBase64) request.write(Buffer.from(reqMsg.bodyBase64, 'base64'));
    request.end();
  });
}

export function startClient(cfg: ClientConfig) {
  const candidates: string[] = (cfg.serverWsUrls && cfg.serverWsUrls.length)
    ? cfg.serverWsUrls
    : (cfg.serverWsUrl ? [cfg.serverWsUrl] : []);

  if (!candidates.length) {
    console.error('[client] No server WebSocket URL provided.');
    process.exit(1);
  }

  const buildUrl = (base: string) => {
    const u = new URL(base);
    u.searchParams.set('subdomain', cfg.subdomain);
    if (cfg.token) u.searchParams.set('token', cfg.token);
    return u;
  };

  let ws: WebSocket | null = null;
  let currentIndex = 0;
  let connectedUrl: URL | null = null;

  const tryNext = () => {
    if (currentIndex >= candidates.length) {
      console.error('[client] Failed to connect to any server URL. Tried:', candidates.join(', '));
      process.exit(2);
    }
    const u = buildUrl(candidates[currentIndex]);
    console.log(`[client] Connecting: ${u.toString()}`);
    ws = new WebSocket(u.toString());

    ws.on('open', () => {
      connectedUrl = u;
      const usingWss = u.protocol === 'wss:';
      const toProto = new URL(cfg.to).protocol.replace(':', '');
      console.log(`[client] Connected (${usingWss ? 'secure wss' : 'ws'}) as subdomain="${cfg.subdomain}"`);
      console.log(`[client] Local target tunneled: ${cfg.to} (${toProto})`);
      const publicScheme = usingWss ? 'https' : 'http';
      const publicBase = `${publicScheme}://${u.hostname}/t/${cfg.subdomain}`;
      console.log(`[client] Public base URL: ${publicBase}/...`);
    });

    ws.on('message', async (message: WebSocket.RawData) => {
      try {
        const data = JSON.parse(message.toString()) as TunnelRequestMsg;
        if (data && data.type === 'request') {
          const resp = await forwardRequest(cfg.to, data);
          ws?.send(JSON.stringify(resp));
        }
      } catch {
        // ignore
      }
    });

    ws.on('close', (code: number, reasonBuf: Buffer) => {
      const reason = reasonBuf?.toString() || '';
      if (reason.includes('Subdomain already in use')) {
        console.error('[client] The requested subdomain is already in use. Choose another subdomain.');
        process.exit(2);
      }
      if (reason.includes('Invalid or not allowed subdomain')) {
        console.error('[client] Subdomain invalid or not allowed by server policy.');
        process.exit(3);
      }
      if (reason.includes('Auth failed')) {
        console.error('[client] Authentication failed. Check your token.');
        process.exit(4);
      }
      if (!connectedUrl && currentIndex < candidates.length - 1) {
        // Try fallback candidate immediately (e.g., ws after wss)
        currentIndex += 1;
        console.log(`[client] Falling back to next server URL...`);
        tryNext();
        return;
      }
      console.log('[client] Disconnected. Reconnecting in 2s...');
      setTimeout(() => {
        connectedUrl = null;
        tryNext();
      }, 2000);
    });

    ws.on('error', (err) => {
      console.warn('[client] WS error:', (err as any)?.message);
    });

    // Heartbeat
    const interval = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        try { ws.ping(); } catch {}
      } else {
        clearInterval(interval);
      }
    }, 30000);
  };

  tryNext();
}
