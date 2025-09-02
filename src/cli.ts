#!/usr/bin/env node
import 'dotenv/config';
import { Command } from 'commander';
import { startClient } from './client';

const program = new Command();

program
  .name('free-tunnel')
  .description('Reverse tunnel client (connects to server and forwards to local target)')
  .option('-s, --server-ws-url <url>', 'WebSocket server URL (overrides --host/--ws-port)', process.env.SERVER_WS_URL)
  .option('-H, --host <host>', 'Server hostname', process.env.SERVER_HOST || 'localhost')
  .option('-W, --ws-port <port>', 'Server WebSocket port', process.env.SERVER_WS_PORT || '8081')
  .option('-d, --subdomain <name>', 'Requested subdomain', process.env.SUBDOMAIN)
  .option('-t, --token <token>', 'Auth token', process.env.AUTH_TOKEN)
  .option('-T, --to <url>', 'Local target URL (overrides --to-host/--to-port/--to-proto)', process.env.TO)
  .option('--to-host <host>', 'Local target hostname', process.env.TO_HOST || 'localhost')
  .option('--to-port <port>', 'Local target port', process.env.TO_PORT || '3000')
  .option('--to-proto <proto>', 'Local target protocol (http|https)', process.env.TO_PROTO || 'http')
  .action((opts) => {
    if (!opts.subdomain) {
      console.error('Error: --subdomain is required');
      process.exit(1);
    }
    const serverWsUrl = opts.serverWsUrl
      ? String(opts.serverWsUrl)
      : `ws://${String(opts.host)}:${String(opts.wsPort)}`;
    const toUrl = opts.to
      ? String(opts.to)
      : `${String(opts.toProto)}://${String(opts.toHost)}:${String(opts.toPort)}`;
    startClient({
      serverWsUrl,
      subdomain: String(opts.subdomain),
      token: opts.token ? String(opts.token) : undefined,
      to: toUrl,
    });
  });

program.parse();
