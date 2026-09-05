import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// See src/config/config.js for why this must be an absolute path rather than
// dotenv.config() with no path (which resolves relative to process.cwd()).
dotenv.config({ path: join(__dirname, '../../.env') });

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
