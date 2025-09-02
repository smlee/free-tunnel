# @smlee/free-tunnel

Reverse-tunnel client that connects to a `free-tunnel-server` over WebSocket and forwards incoming HTTP traffic to a local target URL. Free ngrok alternative and free tunnel solution for exposing localhost with subdomain routing.

- CLI name: `free-tunnel`
- Connects to server using a public host or full ws(s) URL (prefers WSS, falls back to WS)
- Infers subdomain from the server host's first label (e.g., `myapp.example.com` → `myapp`)
- Forwards to a local target either via positional `host:port` or `--to`/`--to-*`
- Auth token required via `--token` (use the token configured or printed by the server)

> This client works hand-in-hand with the server package `@smlee/free-tunnel-server`.
> See the server README at `../server/README.md` and the npm package:
> https://www.npmjs.com/package/@smlee/free-tunnel-server

## Quick start (global install)

Install globally, then connect your local app to a deployed server.

```
npm i -g @smlee/free-tunnel

# Simple usage (clean and minimal):
#   <server> must be your subdomain host, e.g., myapp.example.com
#   [to] is your local target as host:port; scheme defaults to http
free-tunnel myapp.example.com localhost:3000 --token <TOKEN>

# Or provide full WS URL explicitly (client still infers subdomain):
free-tunnel wss://myapp.example.com/ws 3000 --token <TOKEN>

# Or use --to for a full local URL
free-tunnel myapp.example.com --token <TOKEN> --to https://localhost:8443

# The client will prefer secure (wss/https) if available, and fall back to ws/http.
```

Notes:
- The server requires a token. If the server started without `--auth-token`, it prints a generated token like:

```
[server] Generated auth token: <token>
```
  Copy that value for `--token`.
- The `<server>` positional accepts either a host (e.g., `myapp.example.com`) or a full `ws(s)://` URL. With a host, the client tries `wss://<host>/ws` then `ws://<host>/ws`.
- Subdomain is inferred from the first host label. Use a subdomain host (e.g., `myapp.example.com`), not an apex.

### Clean root (no /t/<subdomain>)

If you want your public base to be exactly `https://myapp.example.com/` (no `/t/myapp` path), add a small rewrite in your reverse proxy (no server code changes needed). Example Nginx:

```nginx
server {
  listen 443 ssl http2;
  server_name myapp.example.com;

  # WS control
  location = /ws {
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_pass http://127.0.0.1:8081;
  }

  # Clean root → path-based tunnel /t/myapp/*
  location / {
    proxy_http_version 1.1;
    rewrite ^/(.*)$ /t/myapp/$1 break;
    proxy_pass http://127.0.0.1:8080;
  }
}
```

For wildcard domains, use a map or rewrite to extract the first host label and proxy to `/t/<label>/*`.

## Install & Run (local)

```
npm install
npm run build
# Provide your own token or let the server generate one

# Option A: Provide public host (prefers wss)
npm start -- myapp.example.com localhost:3000 --token change-me-strong-token

# Option B: Provide full WS URL explicitly
npm start -- wss://myapp.example.com/ws 3000 --token change-me-strong-token

# Local target variations
npm start -- myapp.example.com --token change-me-strong-token --to https://localhost:8443
```

Pair with server:
```
# On server machine (or locally):
free-tunnel-server --http-port 8080 --ws-port 8081 --auth-token change-me-strong-token

# Then access via
curl -i http://localhost:8080/t/myapp/
```

## CLI Options

```
free-tunnel --help

Usage: free-tunnel <server> [to] [options]

Arguments:
  server                    Public tunnel host (subdomain.domain) or ws(s) URL
  to                        Local target as host:port (scheme defaults to http)

Options:
  -s, --server-ws-url <u>   WebSocket server URL (overrides host-based inference)
  -t, --token <token>       Auth token (required; obtain from server)
  -T, --to <url>            Local target URL (overrides [to] and --to-*)
      --to-host <host>      Local target hostname (default: "localhost")
      --to-port <port>      Local target port (default: "3000")
      --to-proto <proto>    Local target protocol (http|https) (default: "http")
  -h, --help                display help for command
```

## Environment Example

See `.env.example` for variables you can use instead of flags.

## Subdomain availability and conflicts

- If the server rejects your connection because the subdomain is already in use, this client will exit with an error.
- Ask the server for availability before connecting:

```
GET http://<server>:<httpPort>/availability/<subdomain>

Response: { "subdomain": "myapp", "available": true }
```

- Server admins can enable takeover with `--replace-existing` so newer connections replace existing ones.

## License

This package is provided under the PolyForm Noncommercial 1.0.0 license. You may use it for non‑commercial purposes. For commercial licensing, contact the author.

See `LICENSE` in this directory for the full text.
