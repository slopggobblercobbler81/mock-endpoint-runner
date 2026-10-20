/**
 * mock-endpoint-runner - Logger & Request Tracker
 * Colorized console output and memory ring-buffer for request inspection.
 */

const HAS_COLOR = process.env.NO_COLOR === undefined && process.stdout.isTTY;

const COLORS = {
  reset: HAS_COLOR ? '\x1b[0m' : '',
  dim: HAS_COLOR ? '\x1b[2m' : '',
  bold: HAS_COLOR ? '\x1b[1m' : '',
  green: HAS_COLOR ? '\x1b[32m' : '',
  yellow: HAS_COLOR ? '\x1b[33m' : '',
  red: HAS_COLOR ? '\x1b[31m' : '',
  cyan: HAS_COLOR ? '\x1b[36m' : '',
  magenta: HAS_COLOR ? '\x1b[35m' : '',
  blue: HAS_COLOR ? '\x1b[34m' : ''
};

function statusColor(status) {
  if (status >= 500) return COLORS.red;
  if (status >= 400) return COLORS.yellow;
  if (status >= 300) return COLORS.cyan;
  if (status >= 200) return COLORS.green;
  return COLORS.reset;
}

export class RequestTracker {
  constructor(maxSize = 200) {
    this.maxSize = maxSize;
    this.requests = [];
  }

  record(reqRecord) {
    this.requests.push({
      id: reqRecord.id || Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      method: reqRecord.method,
      url: reqRecord.url,
      path: reqRecord.path,
      query: reqRecord.query,
      headers: reqRecord.headers,
      body: reqRecord.body,
      status: reqRecord.status,
      durationMs: reqRecord.durationMs
    });

    if (this.requests.length > this.maxSize) {
      this.requests.shift();
    }
  }

  getRequests() {
    return [...this.requests];
  }

  clear() {
    this.requests = [];
  }
}

export class Logger {
  constructor(options = {}) {
    this.quiet = options.quiet || false;
    this.tracker = new RequestTracker(options.maxHistory || 200);
  }

  logRequest(method, url, status, durationMs) {
    if (this.quiet) return;

    const time = new Date().toLocaleTimeString();
    const color = statusColor(status);
    const methodStr = `${COLORS.bold}${method.padEnd(7)}${COLORS.reset}`;
    const statusStr = `${color}${status}${COLORS.reset}`;
    const durationStr = `${COLORS.dim}${durationMs}ms${COLORS.reset}`;

    console.log(`${COLORS.dim}[${time}]${COLORS.reset} ${methodStr} ${url} ${statusStr} ${durationStr}`);
  }

  info(msg) {
    if (!this.quiet) {
      console.log(`${COLORS.blue}[INFO]${COLORS.reset} ${msg}`);
    }
  }

  success(msg) {
    if (!this.quiet) {
      console.log(`${COLORS.green}[SUCCESS]${COLORS.reset} ${msg}`);
    }
  }

  warn(msg) {
    if (!this.quiet) {
      console.warn(`${COLORS.yellow}[WARN]${COLORS.reset} ${msg}`);
    }
  }

  error(msg) {
    console.error(`${COLORS.red}[ERROR]${COLORS.reset} ${msg}`);
  }
}

export default {
  Logger,
  RequestTracker,
  COLORS
};
