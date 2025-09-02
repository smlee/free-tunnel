#!/usr/bin/env node
import 'dotenv/config';
import { Command } from 'commander';
import { startClient } from './client';

const program = new Command();

program
  .name('free-tunnel')
  .description('Reverse tunnel client (connects to server and forwards to local target)')
  .argument('<server>', 'Public tunnel host (subdomain.domain) or full ws(s) URL. Example: myapp.example.com or wss://myapp.example.com/ws')
  .argument('[to]', 'Local target host:port (e.g., localhost:3000). If omitted, uses --to or defaults.')
  .option('-s, --server-ws-url <url>', 'WebSocket server URL (overrides host-based inference)', process.env.SERVER_WS_URL)
  .option('-t, --token <token>', 'Auth token', process.env.AUTH_TOKEN)
  .option('-T, --to <url>', 'Local target URL (overrides host:port and --to-* options)', process.env.TO)
  .option('--to-host <host>', 'Local target hostname', process.env.TO_HOST || 'localhost')
  .option('--to-port <port>', 'Local target port', process.env.TO_PORT || '3000')
  .option('--to-proto <proto>', 'Local target protocol (http|https)', process.env.TO_PROTO || 'http')
  .action((serverArg: string, toArg: string | undefined, opts) => {
    // Infer subdomain from the provided server host when not a ws URL
    const inferSubdomainFromHost = (host: string): string | null => {
      const h = host.split(':')[0];
      const labels = h.split('.').filter(Boolean);
      if (labels.length >= 3) return labels[0]; // sub.example.com -> sub
      return null;
    };

    // Determine candidate WS URLs
    let candidates: string[] = [];
    let inferredHostForSub: string | null = null;
    if (opts.serverWsUrl) {
      candidates = [String(opts.serverWsUrl)];
      try { const u = new URL(candidates[0]); inferredHostForSub = u.hostname; } catch {}
    } else if (/^wss?:\/\//i.test(serverArg.trim())) {
      candidates = [serverArg.trim()];
      try { const u = new URL(candidates[0]); inferredHostForSub = u.hostname; } catch {}
    } else {
      const host = serverArg.trim().replace(/\/$/, '');
      inferredHostForSub = host;
      candidates = [
        `wss://${host}/ws`,
        `ws://${host}/ws`,
      ];
    }

    // Determine subdomain from host
    const subdomain = inferredHostForSub ? (inferSubdomainFromHost(inferredHostForSub) || 'unknown') : 'unknown';
    if (subdomain === 'unknown') {
      console.error('Error: Could not infer subdomain from server host. Provide a subdomain host like "myapp.example.com" or a full ws(s) URL.');
      process.exit(1);
    }

    // Determine local target URL
    let toUrl: string;
    if (opts.to) {
      toUrl = String(opts.to);
    } else if (toArg) {
      const s = String(toArg).trim();
      toUrl = /^https?:\/\//i.test(s) ? s : `http://${s}`;
    } else {
      toUrl = `${String(opts.toProto)}://${String(opts.toHost)}:${String(opts.toPort)}`;
    }

    console.log(`[client] Preparing to connect...`);
    console.log(`  Server candidates: ${candidates.join(', ')}`);
    console.log(`  Inferred subdomain: ${subdomain}`);
    console.log(`  Local target: ${toUrl}`);

    startClient({
      serverWsUrls: candidates,
      subdomain,
      token: opts.token ? String(opts.token) : undefined,
      to: toUrl,
    } as any);
  });

program.parse();
