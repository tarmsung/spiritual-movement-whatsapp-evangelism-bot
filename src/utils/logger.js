import dotenv from 'dotenv';

dotenv.config();

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Simple console-based logger for better readability
// Must include `level` property and proper `child()` for Baileys/Pino compatibility
const logger = {
  level: 'silent',
  trace: (...args) => LOG_LEVEL === 'trace' && console.log('[TRACE]', ...args),
  debug: (...args) => (LOG_LEVEL === 'debug' || LOG_LEVEL === 'trace') && console.log('[DEBUG]', ...args),
  info: (...args) => console.log('[INFO]', ...args),
  warn: (...args) => console.warn('[WARN]', ...args),
  error: (...args) => console.error('[ERROR]', ...args),
  fatal: (...args) => console.error('[FATAL]', ...args),
  child: (opts) => logger
};

export default logger;
