# @smlee/free-tunnel

Reverse-tunnel client that connects to a `free-tunnel-server` over WebSocket and forwards incoming HTTP traffic to a local target URL.

- CLI name: `free-tunnel`
- Connects to server `--server-ws-url` (default ws://localhost:8081)
- Registers `--subdomain` on the server
- Forwards to local target via `--to` or `--to-host/--to-port/--to-proto`
- Auth token required via `--token` (use the token configured or printed by the server)

> This client works hand-in-hand with the server package `@smlee/free-tunnel-server`.
> See the server README at `../server/README.md` and the npm package:
> https://www.npmjs.com/package/@smlee/free-tunnel-server

## Quick start (global install)

Install globally, then connect your local app to a deployed server.

```
npm i -g @smlee/free-tunnel

# Example: public host is https://tunnel.example.com, subdomain is "tunnel",
# server proxies WS at /ws to the server's WS port, and HTTP to /t/tunnel/*.
free-tunnel --server-ws-url wss://tunnel.example.com/ws \
  --subdomain tunnel \
  --token <STRONG_TOKEN> \
  --to http://localhost:3000

# Now browse your public URL
#   https://tunnel.example.com/
```

Note: The server requires a token. If the server started without `--auth-token`, it prints a generated token like:

```
[server] Generated auth token: <token>
```
Copy that value for `--token`.

## Install & Run (local)

```
npm install
npm run build
# Option A: Provide full WS URL
npm start -- --server-ws-url ws://localhost:8081 --subdomain myapp --token change-me-strong-token --to http://localhost:3000

# Option B: Provide host and port (client builds ws://<host>:<port>)
npm start -- --host localhost --ws-port 8081 --subdomain myapp --token change-me-strong-token --to http://localhost:3000

# Local target options
# A) Full URL
npm start -- --server-ws-url ws://localhost:8081 --subdomain myapp --to https://dev.box:8443

# B) Build from parts
npm start -- --server-ws-url ws://localhost:8081 --subdomain myapp --to-host dev.box --to-port 8443 --to-proto https
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

Options:
  -s, --server-ws-url <url>  WebSocket server URL (overrides --host/--ws-port)
  -H, --host <host>          Server hostname (default: "localhost")
  -W, --ws-port <port>       Server WebSocket port (default: "8081")
  -d, --subdomain <name>     Requested subdomain (required)
  -t, --token <token>        Auth token (required; obtain from server)
  -T, --to <url>             Local target URL (overrides --to-host/--to-port/--to-proto)
      --to-host <host>       Local target hostname (default: "localhost")
      --to-port <port>       Local target port (default: "3000")
      --to-proto <proto>     Local target protocol (http|https) (default: "http")
  -h, --help                 display help for command
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
