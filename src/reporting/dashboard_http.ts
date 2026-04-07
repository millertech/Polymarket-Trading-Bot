import http from 'http';

export function resolveDashboardListenHost(): string {
  const explicitHost = process.env.DASHBOARD_BIND_HOST?.trim();
  if (explicitHost) return explicitHost;
  return '0.0.0.0';
}

function buildApiHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  const corsOrigin = process.env.DASHBOARD_CORS_ORIGIN?.trim();
  if (corsOrigin) {
    headers['Access-Control-Allow-Origin'] = corsOrigin;
  }

  return headers;
}

export function writeJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, buildApiHeaders());
  res.end(JSON.stringify(body, null, 2));
}

export function buildDashboardHtmlHeaders(): Record<string, string> {
  return {
    'Content-Type': 'text/html; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin',
  };
}

export function readJsonBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  const maxBytes = Number(process.env.DASHBOARD_MAX_BODY_BYTES ?? '1048576');
  return new Promise((resolve, reject) => {
    let data = '';
    let totalBytes = 0;
    req.on('data', (chunk: Buffer) => {
      totalBytes += chunk.length;
      if (totalBytes > maxBytes) {
        req.destroy(new Error('Request body too large'));
        return;
      }
      data += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(data) as Record<string, unknown>);
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('too large')) {
        reject(new Error('Request body too large'));
        return;
      }
      reject(err);
    });
  });
}

type RateLimitBucket = {
  windowStartedAtMs: number;
  requestCount: number;
  lastSeenAtMs: number;
};

export class FixedWindowIpRateLimiter {
  private readonly bucketsByIp = new Map<string, RateLimitBucket>();
  private readonly retentionMs: number;
  private readonly cleanupIntervalMs: number;
  private lastCleanupAtMs = 0;

  constructor(
    private readonly windowMs = Number(process.env.DASHBOARD_RATE_LIMIT_WINDOW_MS ?? '60000'),
    private readonly maxPerWindow = Number(process.env.DASHBOARD_RATE_LIMIT_MAX_REQUESTS ?? '240'),
  ) {
    this.retentionMs = this.windowMs * 2;
    this.cleanupIntervalMs = Math.max(10_000, this.windowMs);
  }

  isRateLimited(req: http.IncomingMessage): boolean {
    const ip = this.getClientIp(req);
    const now = Date.now();

    this.cleanupBuckets(now);

    const bucket = this.bucketsByIp.get(ip);
    if (!bucket || now - bucket.windowStartedAtMs >= this.windowMs) {
      this.bucketsByIp.set(ip, {
        windowStartedAtMs: now,
        requestCount: 1,
        lastSeenAtMs: now,
      });
      return false;
    }

    bucket.lastSeenAtMs = now;
    if (bucket.requestCount >= this.maxPerWindow) {
      return true;
    }

    bucket.requestCount += 1;
    return false;
  }

  private cleanupBuckets(now: number): void {
    if (now - this.lastCleanupAtMs < this.cleanupIntervalMs) return;

    this.lastCleanupAtMs = now;
    for (const [bucketIp, bucket] of this.bucketsByIp.entries()) {
      if (now - bucket.lastSeenAtMs > this.retentionMs) {
        this.bucketsByIp.delete(bucketIp);
      }
    }
  }

  private getClientIp(req: http.IncomingMessage): string {
    const rawForwarded = req.headers['x-forwarded-for'];
    const forwarded = Array.isArray(rawForwarded) ? rawForwarded[0] : rawForwarded;
    if (forwarded && forwarded.length > 0) {
      return forwarded.split(',')[0].trim();
    }
    return req.socket.remoteAddress ?? 'unknown';
  }
}
