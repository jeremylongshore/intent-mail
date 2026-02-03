/**
 * Simple Structured Logger
 *
 * Provides structured JSON logging for production use.
 * Can be replaced with pino or winston for more features.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  msg: string;
  timestamp: string;
  [key: string]: unknown;
}

/**
 * Current log level (can be set via LOG_LEVEL env var)
 */
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

/**
 * Check if a log level should be output
 */
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

/**
 * Format and output a log entry
 */
function log(level: LogLevel, msg: string, context?: Record<string, unknown>): void {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    level,
    msg,
    timestamp: new Date().toISOString(),
    ...context,
  };

  // Output to stderr (standard for logs in Node.js)
  // JSON format for structured logging
  if (process.env.LOG_FORMAT === 'json') {
    console.error(JSON.stringify(entry));
  } else {
    // Human-readable format for development
    const prefix = `[${entry.timestamp}] ${level.toUpperCase()}:`;
    if (context && Object.keys(context).length > 0) {
      console.error(prefix, msg, context);
    } else {
      console.error(prefix, msg);
    }
  }
}

/**
 * Logger instance with level methods
 */
export const logger = {
  debug: (msg: string, context?: Record<string, unknown>) => log('debug', msg, context),
  info: (msg: string, context?: Record<string, unknown>) => log('info', msg, context),
  warn: (msg: string, context?: Record<string, unknown>) => log('warn', msg, context),
  error: (msg: string, context?: Record<string, unknown>) => log('error', msg, context),
};

/**
 * Create a child logger with default context
 */
export function createLogger(defaultContext: Record<string, unknown>) {
  return {
    debug: (msg: string, context?: Record<string, unknown>) =>
      log('debug', msg, { ...defaultContext, ...context }),
    info: (msg: string, context?: Record<string, unknown>) =>
      log('info', msg, { ...defaultContext, ...context }),
    warn: (msg: string, context?: Record<string, unknown>) =>
      log('warn', msg, { ...defaultContext, ...context }),
    error: (msg: string, context?: Record<string, unknown>) =>
      log('error', msg, { ...defaultContext, ...context }),
  };
}
