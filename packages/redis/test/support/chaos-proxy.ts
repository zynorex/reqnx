// ──────────────────────────────────────────────────────────────────────────────
// @reqnx/redis — ChaosProxy (Test Support Tool)
//
// Pure node:net TCP proxy for deterministic fault injection and chaos testing.
// Placed between client adapters and real Redis servers.
// ──────────────────────────────────────────────────────────────────────────────

import * as net from 'node:net';

export type ProxyMode =
  | 'pass'
  | 'latency'
  | 'blackhole'
  | 'reset'
  | 'refuse'
  | 'slice'
  | 'limit'
  | 'lose-reply';

export interface LatencyOptions {
  readonly upstreamMs?: number;
  readonly downstreamMs?: number;
}

export interface BlackholeOptions {
  readonly direction?: 'upstream' | 'downstream' | 'both';
}

export interface SliceOptions {
  readonly chunkSize?: number;
}

export interface LimitOptions {
  readonly maxBytes: number;
}

export interface ChaosProxyOptions {
  readonly upstreamPort: number;
  readonly upstreamHost?: string;
  readonly listenPort?: number;
}

export interface ChaosProxyStats {
  readonly connectionsCount: number;
  readonly activeConnections: number;
  readonly bytesUpstream: number;
  readonly bytesDownstream: number;
}

export class ChaosProxy {
  private server: net.Server | null = null;
  private mode: ProxyMode = 'pass';
  private latencyOpts: LatencyOptions = {};
  private blackholeOpts: BlackholeOptions = { direction: 'both' };
  private sliceOpts: SliceOptions = { chunkSize: 1 };
  private limitOpts: LimitOptions = { maxBytes: Infinity };

  private readonly upstreamPort: number;
  private readonly upstreamHost: string;
  private assignedPort: number = 0;

  private connectionsCount = 0;
  private bytesUpstream = 0;
  private bytesDownstream = 0;

  private readonly activeSockets = new Set<{
    client: net.Socket;
    upstream: net.Socket | null;
  }>();

  private activeTimers = new Set<NodeJS.Timeout>();

  constructor(options: ChaosProxyOptions) {
    this.upstreamPort = options.upstreamPort;
    this.upstreamHost = options.upstreamHost ?? '127.0.0.1';
    this.assignedPort = options.listenPort ?? 0;
  }

  public get port(): number {
    return this.assignedPort;
  }

  public get url(): string {
    return `redis://127.0.0.1:${this.assignedPort}`;
  }

  public getStats(): ChaosProxyStats {
    return {
      connectionsCount: this.connectionsCount,
      activeConnections: this.activeSockets.size,
      bytesUpstream: this.bytesUpstream,
      bytesDownstream: this.bytesDownstream,
    };
  }

  public setMode(
    mode: 'pass' | 'reset' | 'refuse' | 'lose-reply',
  ): void;
  public setMode(mode: 'latency', options: LatencyOptions): void;
  public setMode(mode: 'blackhole', options?: BlackholeOptions): void;
  public setMode(mode: 'slice', options?: SliceOptions): void;
  public setMode(mode: 'limit', options: LimitOptions): void;
  public setMode(mode: ProxyMode, options?: unknown): void {
    this.mode = mode;
    if (mode === 'latency') {
      this.latencyOpts = (options as LatencyOptions) ?? {};
    } else if (mode === 'blackhole') {
      this.blackholeOpts = (options as BlackholeOptions) ?? { direction: 'both' };
    } else if (mode === 'slice') {
      this.sliceOpts = (options as SliceOptions) ?? { chunkSize: 1 };
    } else if (mode === 'limit') {
      this.limitOpts = (options as LimitOptions) ?? { maxBytes: Infinity };
    } else if (mode === 'reset') {
      this.destroyActiveConnections();
    } else if (mode === 'refuse') {
      this.stopListening();
    }
  }

  public async start(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.server = net.createServer((clientSocket) => {
        this.handleConnection(clientSocket);
      });

      this.server.on('error', (err) => {
        reject(err);
      });

      this.server.listen(this.assignedPort, '127.0.0.1', () => {
        const addr = this.server?.address();
        if (addr && typeof addr === 'object') {
          this.assignedPort = addr.port;
          resolve(this.assignedPort);
        } else {
          reject(new Error('Failed to obtain server address'));
        }
      });
    });
  }

  private closePromise: Promise<void> | null = null;

  public async restore(): Promise<void> {
    await this.stopListening();
    await this.start();
    this.mode = 'pass';
  }

  public destroyActiveConnections(): void {
    for (const pair of this.activeSockets) {
      pair.client.destroy();
      pair.upstream?.destroy();
    }
    this.activeSockets.clear();
  }

  public async stopListening(): Promise<void> {
    this.destroyActiveConnections();
    if (this.server) {
      if (!this.closePromise) {
        const s = this.server;
        this.closePromise = new Promise<void>((resolve) => {
          s.close(() => {
            this.server = null;
            this.closePromise = null;
            resolve();
          });
        });
      }
      await this.closePromise;
    }
  }

  public async close(): Promise<void> {
    for (const timer of this.activeTimers) {
      clearTimeout(timer);
    }
    this.activeTimers.clear();
    this.destroyActiveConnections();

    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server?.close(() => resolve());
        this.server = null;
      });
    }
  }

  private handleConnection(clientSocket: net.Socket): void {
    this.connectionsCount++;

    if (this.mode === 'reset') {
      if (typeof clientSocket.resetAndDestroy === 'function') {
        clientSocket.resetAndDestroy();
      } else {
        clientSocket.destroy(new Error('ECONNRESET'));
      }
      return;
    }

    if (this.mode === 'blackhole' && this.blackholeOpts.direction === 'upstream') {
      // Accept client socket but don't connect upstream
      const pair = { client: clientSocket, upstream: null };
      this.activeSockets.add(pair);
      clientSocket.on('data', (chunk) => {
        this.bytesUpstream += chunk.length;
      });
      clientSocket.on('close', () => this.activeSockets.delete(pair));
      clientSocket.on('error', () => this.activeSockets.delete(pair));
      return;
    }

    const upstreamSocket = net.connect({
      host: this.upstreamHost,
      port: this.upstreamPort,
    });

    const pair = { client: clientSocket, upstream: upstreamSocket };
    this.activeSockets.add(pair);

    clientSocket.on('error', () => {
      upstreamSocket.destroy();
      this.activeSockets.delete(pair);
    });

    upstreamSocket.on('error', () => {
      clientSocket.destroy();
      this.activeSockets.delete(pair);
    });

    clientSocket.on('close', () => {
      upstreamSocket.end();
      this.activeSockets.delete(pair);
    });

    upstreamSocket.on('close', () => {
      clientSocket.end();
      this.activeSockets.delete(pair);
    });

    let bytesForwardedToClient = 0;

    // Upstream (Client -> Server)
    clientSocket.on('data', (chunk) => {
      this.bytesUpstream += chunk.length;

      if (this.mode === 'reset') {
        clientSocket.destroy();
        upstreamSocket.destroy();
        return;
      }

      if (
        this.mode === 'blackhole' &&
        (this.blackholeOpts.direction === 'upstream' || this.blackholeOpts.direction === 'both')
      ) {
        return; // Discard client data
      }

      const forward = () => {
        if (upstreamSocket.writable) {
          if (this.mode === 'slice') {
            const size = Math.max(1, this.sliceOpts.chunkSize ?? 1);
            for (let i = 0; i < chunk.length; i += size) {
              upstreamSocket.write(chunk.subarray(i, Math.min(chunk.length, i + size)));
            }
          } else {
            upstreamSocket.write(chunk);
          }
        }
      };

      if (this.mode === 'latency' && this.latencyOpts.upstreamMs) {
        const timer = setTimeout(() => {
          this.activeTimers.delete(timer);
          forward();
        }, this.latencyOpts.upstreamMs);
        this.activeTimers.add(timer);
      } else {
        forward();
      }
    });

    // Downstream (Server -> Client)
    upstreamSocket.on('data', (chunk) => {
      this.bytesDownstream += chunk.length;

      if (this.mode === 'reset') {
        clientSocket.destroy();
        upstreamSocket.destroy();
        return;
      }

      if (
        this.mode === 'blackhole' &&
        (this.blackholeOpts.direction === 'downstream' || this.blackholeOpts.direction === 'both')
      ) {
        return; // Discard server reply
      }

      if (this.mode === 'lose-reply') {
        // Deterministic lost reply: Server executed request and returned reply.
        // We DISCARD the reply completely, and immediately destroy client connection!
        clientSocket.destroy();
        return;
      }

      if (this.mode === 'limit') {
        bytesForwardedToClient += chunk.length;
        if (bytesForwardedToClient >= this.limitOpts.maxBytes) {
          clientSocket.destroy();
          upstreamSocket.destroy();
          return;
        }
      }

      const forward = () => {
        if (clientSocket.writable) {
          if (this.mode === 'slice') {
            const size = Math.max(1, this.sliceOpts.chunkSize ?? 1);
            for (let i = 0; i < chunk.length; i += size) {
              clientSocket.write(chunk.subarray(i, Math.min(chunk.length, i + size)));
            }
          } else {
            clientSocket.write(chunk);
          }
        }
      };

      if (this.mode === 'latency' && this.latencyOpts.downstreamMs) {
        const timer = setTimeout(() => {
          this.activeTimers.delete(timer);
          forward();
        }, this.latencyOpts.downstreamMs);
        this.activeTimers.add(timer);
      } else {
        forward();
      }
    });
  }
}
