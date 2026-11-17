// ──────────────────────────────────────────────────────────────────────────────
// @reqnx/redis — ChaosProxy Unit Tests
// ──────────────────────────────────────────────────────────────────────────────

import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import * as net from 'node:net';
import { ChaosProxy } from './chaos-proxy.js';

describe('ChaosProxy', () => {
  let echoServer: net.Server;
  let echoPort: number;

  beforeAll(async () => {
    echoServer = net.createServer((socket) => {
      socket.pipe(socket); // Echo server
    });

    await new Promise<void>((resolve) => {
      echoServer.listen(0, '127.0.0.1', () => {
        const addr = echoServer.address() as net.AddressInfo;
        echoPort = addr.port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => echoServer.close(() => resolve()));
  });

  function sendAndReceive(port: number, msg: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const client = net.connect({ port, host: '127.0.0.1' }, () => {
        client.write(msg);
      });

      let received = '';
      client.on('data', (chunk) => {
        received += chunk.toString();
        client.end();
      });

      client.on('end', () => resolve(received));
      client.on('error', (err) => reject(err));
    });
  }

  it('pass mode: byte-exact bidirectional forwarding', async () => {
    const proxy = new ChaosProxy({ upstreamPort: echoPort });
    const proxyPort = await proxy.start();

    const response = await sendAndReceive(proxyPort, 'PING\r\n');
    expect(response).toBe('PING\r\n');

    const stats = proxy.getStats();
    expect(stats.connectionsCount).toBe(1);
    expect(stats.bytesUpstream).toBe(6);
    expect(stats.bytesDownstream).toBe(6);

    await proxy.close();
  });

  it('latency mode: delays data forwarding by configured milliseconds', async () => {
    const proxy = new ChaosProxy({ upstreamPort: echoPort });
    const proxyPort = await proxy.start();
    proxy.setMode('latency', { downstreamMs: 80 });

    const start = Date.now();
    const response = await sendAndReceive(proxyPort, 'HELLO');
    const elapsed = Date.now() - start;

    expect(response).toBe('HELLO');
    expect(elapsed).toBeGreaterThanOrEqual(70);

    await proxy.close();
  });

  it('blackhole mode: discards data without reply until caller timeout', async () => {
    const proxy = new ChaosProxy({ upstreamPort: echoPort });
    const proxyPort = await proxy.start();
    proxy.setMode('blackhole', { direction: 'downstream' });

    let received = false;
    const client = net.connect({ port: proxyPort, host: '127.0.0.1' }, () => {
      client.write('BLACKHOLE');
    });

    client.on('data', () => {
      received = true;
    });

    await new Promise((r) => setTimeout(r, 60));
    expect(received).toBe(false);

    client.destroy();
    await proxy.close();
  });

  it('reset mode: destroys connection with ECONNRESET', async () => {
    const proxy = new ChaosProxy({ upstreamPort: echoPort });
    const proxyPort = await proxy.start();
    proxy.setMode('reset');

    let closedOrErrored = false;
    await new Promise<void>((resolve) => {
      const client = net.connect({ port: proxyPort, host: '127.0.0.1' }, () => {
        client.write('PING\r\n');
      });
      client.on('error', () => {
        closedOrErrored = true;
        resolve();
      });
      client.on('close', () => {
        closedOrErrored = true;
        resolve();
      });
    });

    expect(closedOrErrored).toBe(true);
    await proxy.close();
  });

  it('refuse mode: stops listening and restores on same port', async () => {
    const proxy = new ChaosProxy({ upstreamPort: echoPort });
    const proxyPort = await proxy.start();

    proxy.setMode('refuse');

    // Connection should be refused
    let connectionRefused = false;
    await new Promise<void>((resolve) => {
      const client = net.connect({ port: proxyPort, host: '127.0.0.1' });
      client.on('error', (err: unknown) => {
        if ((err as NodeJS.ErrnoException).code === 'ECONNREFUSED') {
          connectionRefused = true;
        }
        resolve();
      });
    });

    expect(connectionRefused).toBe(true);

    // Restore on same port
    await proxy.restore();
    const response = await sendAndReceive(proxyPort, 'RESTORED');
    expect(response).toBe('RESTORED');

    await proxy.close();
  });

  it('lose-reply mode: forwards request, discards reply, and drops client socket', async () => {
    const proxy = new ChaosProxy({ upstreamPort: echoPort });
    const proxyPort = await proxy.start();
    proxy.setMode('lose-reply');

    let replyReceived = false;
    let socketClosed = false;

    await new Promise<void>((resolve) => {
      const client = net.connect({ port: proxyPort, host: '127.0.0.1' }, () => {
        client.write('EXECUTED_COMMAND');
      });

      client.on('data', () => {
        replyReceived = true;
      });

      client.on('close', () => {
        socketClosed = true;
        resolve();
      });

      client.on('error', () => {
        resolve();
      });
    });

    expect(replyReceived).toBe(false);
    expect(socketClosed).toBe(true);

    await proxy.close();
  });

  it('slice mode: delivers payload across fragmented packets', async () => {
    const proxy = new ChaosProxy({ upstreamPort: echoPort });
    const proxyPort = await proxy.start();
    proxy.setMode('slice', { chunkSize: 1 });

    const response = await sendAndReceive(proxyPort, 'FRAGMENT');
    expect(response).toBe('FRAGMENT');

    await proxy.close();
  });
});
